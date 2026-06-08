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
  createDebugViewportRenderer,
  requiresViewportRuntime,
  type DebugViewportRenderer,
} from "./debug-pipeline-runtime"
import {
  DebugViewportLabelOverlay,
  OverdrawLegendOverlay,
  ShaderCostLegendOverlay,
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
  viewportLabels,
  overlayOpacity = 0.35,
  renderPriority = 1,
  enabled = true,
}: DebugViewsProps) {
  const layoutOptions = useMemo(
    (): DebugViewLayoutOptions => ({ paneCount, columns, rows, diagonalAngle, maxDiagonalAngle }),
    [paneCount, columns, rows, diagonalAngle, maxDiagonalAngle],
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
      viewportLabels={viewportLabels}
      overlayOpacity={overlayOpacity}
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
  viewportLabels?: DebugViewportLabels
  overlayOpacity: number
  renderPriority: number
}

function DebugViewsPipeline({
  views,
  viewportViews,
  activeView,
  layout,
  layoutOptions,
  showLabels,
  viewportLabels,
  overlayOpacity,
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
  const composePipelineKey = useMemo(
    () => createDebugPipelineRuntimeKey(plan, resolvedLayout),
    [plan, resolvedLayout],
  )
  const webGpuRenderer = gl as unknown as WebGPURenderer
  const [shaderCostSample, setShaderCostSample] = useState<ShaderCostSample | null>(null)

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

  const composePipelineRef = useDebugPipeline(
    !usesViewportRuntime,
    scene,
    camera,
    plan,
    composePipelineKey,
    resolvedLayout,
    webGpuRenderer,
    uniforms,
  )
  const viewportRuntimeRef = useDebugViewportPipelines(
    usesViewportRuntime,
    scene,
    camera,
    viewportPlan,
    viewportGraph,
    webGpuRenderer,
    uniforms,
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
        )
        composePipelineRef.current?.render()
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
      {showsOverdraw ? <OverdrawLegendOverlay /> : null}
      {showsShaderCost ? (
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
  const pipelineRef = useRef<RenderPipeline | null>(null)

  useEffect(() => {
    if (!enabled) return

    const runtime = createDebugPipelineRuntime(scene, camera, plan, layout, gl, uniforms)

    pipelineRef.current = runtime.pipeline

    return () => {
      runtime.dispose()
      pipelineRef.current = null
    }
  }, [enabled, scene, camera, runtimeKey, layout, gl, uniforms])

  return pipelineRef
}

function useDebugViewportPipelines(
  enabled: boolean,
  scene: Scene,
  defaultCamera: Camera,
  viewportPlan: DebugViewportPlan | undefined,
  viewportGraph: DebugViewportRenderGraphPlan | undefined,
  gl: WebGPURenderer,
  uniforms: DebugViewUniforms,
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
    })

    runtimeRef.current = renderer

    return () => {
      renderer.dispose()
      runtimeRef.current = null
    }
  }, [enabled, scene, defaultCamera, viewportPlan, passRuntimeKey, viewportGraph, gl, uniforms])

  return runtimeRef
}
