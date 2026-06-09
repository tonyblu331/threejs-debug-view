import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { RenderPipeline, WebGPURenderer } from "three/webgpu"
import type { Camera, Scene } from "three"
import { readHeatmapCostFromCanvas } from "./debug-views-tsl/heatmap-decode"
import { createDebugViewUniforms, updateDebugViewUniforms, type DebugViewUniforms } from "./debug-views-tsl/uniforms"
import { getDefaultDebugViewSource } from "./debug-view-selection"
import { createDebugRenderPlan, type DebugRenderPlan } from "./debug-render-plan"
import {
  resolveDebugViewLayout,
  type DebugViewLayout,
  type DebugViewLayoutOptions,
  type ResolvedDebugViewLayout,
} from "./debug-view-layout"
import type { DebugViewportLabels } from "./debug-viewport-labels"
import {
  createDebugViewportPlan,
  type DebugViewportPlan,
  type DebugViewportView,
} from "./debug-viewport-plan"
import {
  createDebugViewportRenderGraphPlan,
  type DebugViewportRenderGraphPlan,
} from "./debug-render-graph-plan"
import type { DebugView } from "./debug-views-tsl/compositor"
import type { DebugViewsOptions } from "./debug-views-options"
import {
  createDebugPipelineRuntime,
  createDebugPipelineRuntimeKey,
  type DebugPipelineRuntime,
} from "./debug-pipeline-runtime"
import { requiresViewportRuntime } from "./debug-viewport-plan"
import { createDebugViewportRenderer, type DebugViewportRenderer } from "./debug-viewport-renderer"
import {
  DebugViewportLabelOverlay,
  LightComplexityLegendOverlay,
  OverdrawLegendOverlay,
  ShaderCostLegendOverlay,
  type OverdrawLayerSample,
  type ShaderCostSample,
} from "./debug-views-overlays"

export type DebugViewsProps = DebugViewsOptions & {
  renderPriority?: number
}

export function DebugViews({
  views,
  viewportViews,
  activeView = 0,
  layout = "single",
  paneCount,
  columns,
  rows,
  diagonalAngle,
  maxDiagonalAngle,
  showLabels = false,
  showLegends = true,
  viewportLabels,
  overlayOpacity = 0.35,
  lineWidth,
  edgeColor,
  coreColor,
  renderPriority = 1,
  enabled = true,
}: DebugViewsProps) {
  const layoutOptions = useMemo(
    (): DebugViewLayoutOptions => ({ paneCount, columns, rows, diagonalAngle, maxDiagonalAngle }),
    [paneCount, columns, rows, diagonalAngle, maxDiagonalAngle],
  )
  const dividerStyle = useMemo(
    () => ({ lineWidth, edgeColor, coreColor }),
    [lineWidth, edgeColor, coreColor],
  )

  if (!enabled) {
    return null
  }

  return (
    <DebugViewsPipeline
      views={views}
      viewportViews={viewportViews}
      activeView={activeView}
      layout={layout}
      layoutOptions={layoutOptions}
      showLabels={showLabels}
      showLegends={showLegends}
      viewportLabels={viewportLabels}
      overlayOpacity={overlayOpacity}
      dividerStyle={dividerStyle}
      renderPriority={renderPriority}
    />
  )
}

interface DebugViewsPipelineProps {
  views: readonly DebugView[]
  viewportViews?: DebugViewportView[]
  activeView: number
  layout: DebugViewLayout
  layoutOptions: DebugViewLayoutOptions
  showLabels: boolean
  showLegends: boolean
  viewportLabels?: DebugViewportLabels
  overlayOpacity: number
  dividerStyle: Pick<DebugViewsOptions, "lineWidth" | "edgeColor" | "coreColor">
  renderPriority: number
}

function DebugViewsPipeline({
  views,
  viewportViews,
  activeView,
  layout,
  layoutOptions,
  showLabels,
  showLegends,
  viewportLabels,
  overlayOpacity,
  dividerStyle,
  renderPriority,
}: DebugViewsPipelineProps) {
  const { camera, gl, scene } = useThree()
  const uniforms = useMemo(() => createDebugViewUniforms(), [])
  const resolvedLayout = useMemo(
    () => resolveDebugViewLayout(layout, layoutOptions),
    [layout, layoutOptions],
  )
  const viewportPlan = useMemo(
    () => viewportViews?.length
      ? createDebugViewportPlan({ views, viewportViews, activeView, layout: resolvedLayout })
      : undefined,
    [views, viewportViews, activeView, resolvedLayout],
  )
  const usesViewportRuntime = Boolean(viewportPlan && requiresViewportRuntime(viewportPlan))
  const viewportGraph = useMemo(
    () => usesViewportRuntime && viewportPlan
      ? createDebugViewportRenderGraphPlan(viewportPlan)
      : undefined,
    [usesViewportRuntime, viewportPlan],
  )
  const pipelineViews = viewportPlan?.views ?? views
  const plan = useMemo(
    () => createDebugRenderPlan(pipelineViews, activeView, resolvedLayout),
    [pipelineViews, activeView, resolvedLayout],
  )
  const visibleViews = viewportPlan?.views ?? plan.views
  const visibleSources = useMemo(
    () => new Set(visibleViews.map(getDefaultDebugViewSource)),
    [visibleViews],
  )
  const showsShaderCost = visibleSources.has("shaderCost")
  const showsOverdraw = visibleSources.has("overdraw")
  const showsLightComplexity = visibleSources.has("lightComplexity")
  const composePipelineKey = useMemo(
    () => createDebugPipelineRuntimeKey(plan, resolvedLayout, {
      width: gl.domElement.width,
      height: gl.domElement.height,
    }),
    [plan, resolvedLayout, gl.domElement.width, gl.domElement.height],
  )
  const webGpuRenderer = gl as unknown as WebGPURenderer
  const [shaderCostSample, setShaderCostSample] = useState<ShaderCostSample | null>(null)
  const [overdrawSample, setOverdrawSample] = useState<OverdrawLayerSample | null>(null)
  const debugRuntimeRef = useDebugPipeline(
    !usesViewportRuntime,
    scene,
    camera,
    plan,
    composePipelineKey,
    resolvedLayout,
    webGpuRenderer,
    uniforms,
  )

  useEffect(() => {
    if (!showsShaderCost) {
      setShaderCostSample(null)
      return
    }

    const canvas = gl.domElement

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return

      const { clientX, clientY } = event

      requestAnimationFrame(() => {
        const sample = readHeatmapCostFromCanvas(canvas, clientX, clientY)
        if (!sample) return

        setShaderCostSample(sample)
      })
    }

    canvas.addEventListener("pointerdown", handlePointerDown)

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [gl, showsShaderCost])

  useEffect(() => {
    if (!showsOverdraw) {
      setOverdrawSample(null)
      return
    }

    const canvas = gl.domElement

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return

      const { clientX, clientY } = event
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const pixelX = ((clientX - rect.left) / rect.width) * canvas.width
      const pixelY = ((clientY - rect.top) / rect.height) * canvas.height

      requestAnimationFrame(() => {
        void debugRuntimeRef.current?.readOverdrawLayerAt?.(pixelX, pixelY).then((layers) => {
          if (layers == null) return

          setOverdrawSample({
            layers,
            x: clientX,
            y: clientY,
          })
        })
      })
    }

    canvas.addEventListener("pointerdown", handlePointerDown)

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [debugRuntimeRef, gl, showsOverdraw])

  const viewportRuntimeRef = useDebugViewportPipelines(
    usesViewportRuntime,
    scene,
    camera,
    viewportPlan,
    viewportGraph,
    webGpuRenderer,
    uniforms,
    overlayOpacity,
    dividerStyle,
  )

  useFrame(() => {
    const previousBackground = scene.background
    scene.background = null

    try {
      if (usesViewportRuntime) {
        viewportRuntimeRef.current?.render()
      } else {
        updateDebugViewUniforms(
          uniforms,
          plan.activePipelineView,
          resolvedLayout,
          plan.pipelineViews.length,
          overlayOpacity,
          dividerStyle,
        )
        debugRuntimeRef.current?.pipeline.render()
      }
    } finally {
      scene.background = previousBackground
    }
  }, renderPriority)

  return (
    <>
      {showLabels ? (
        <DebugViewportLabelOverlay
          views={visibleViews}
          layout={resolvedLayout}
          labels={viewportLabels}
          viewportPlan={viewportPlan}
        />
      ) : null}
      {showLegends && showsOverdraw ? <OverdrawLegendOverlay sample={overdrawSample} /> : null}
      {showLegends && showsLightComplexity ? <LightComplexityLegendOverlay /> : null}
      {showLegends && showsShaderCost ? (
        <ShaderCostLegendOverlay sample={shaderCostSample} />
      ) : null}
    </>
  )
}

function useDebugPipeline(
  enabled: boolean,
  scene: Scene,
  camera: Camera,
  plan: DebugRenderPlan,
  runtimeKey: string,
  layout: ResolvedDebugViewLayout,
  gl: WebGPURenderer,
  uniforms: DebugViewUniforms,
) {
  const runtimeRef = useRef<DebugPipelineRuntime | null>(null)

  useEffect(() => {
    if (!enabled) return

    const runtime = createDebugPipelineRuntime(scene, camera, plan, layout, gl, uniforms)

    runtimeRef.current = runtime

    return () => {
      runtime.dispose()
      runtimeRef.current = null
    }
  }, [enabled, scene, camera, runtimeKey, layout, gl, uniforms])

  return runtimeRef
}

function useDebugViewportPipelines(
  enabled: boolean,
  scene: Scene,
  defaultCamera: Camera,
  viewportPlan: DebugViewportPlan | undefined,
  viewportGraph: DebugViewportRenderGraphPlan | undefined,
  gl: WebGPURenderer,
  uniforms: DebugViewUniforms,
  overlayOpacity: number,
  dividerStyle: Pick<DebugViewsOptions, "lineWidth" | "edgeColor" | "coreColor">,
) {
  const runtimeRef = useRef<DebugViewportRenderer | null>(null)
  const passRuntimeKey = useMemo(
    () => viewportGraph?.passes.map((graphPass) => graphPass.key).join("\n") ?? "",
    [viewportGraph],
  )

  useEffect(() => {
    if (!enabled || !viewportPlan || !viewportGraph) return

    const renderer = createDebugViewportRenderer({
      gl,
      scene,
      defaultCamera,
      viewportPlan,
      viewportGraph,
      uniforms,
      overlayOpacity,
      dividerStyle,
    })

    runtimeRef.current = renderer

    return () => {
      renderer.dispose()
      runtimeRef.current = null
    }
  }, [enabled, scene, defaultCamera, viewportPlan, passRuntimeKey, viewportGraph, gl, uniforms, overlayOpacity, dividerStyle])

  return runtimeRef
}
