import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import { RenderPipeline, type WebGPURenderer } from "three/webgpu"
import { pass } from "three/tsl"
import { createViewCompositor, type DebugView } from "./debug-views-tsl/compositor"
import type { DebugNode, FloatNode } from "./debug-views-tsl/node-types"
import { createDebugViewUniforms, updateDebugViewUniforms } from "./debug-views-tsl/uniforms"
import { MeshBasicMaterial, MeshStandardMaterial, Vector2, Vector4, type Camera, type Scene } from "three"
import { createAoFallbacks } from "./debug-views-tsl/ao-fallbacks"
import {
  configureMaterialDetailPass,
  configureSceneDebugPass,
  createDefaultDebugNodeResolver,
} from "./debug-views-tsl/default-debug-nodes"
import { getDefaultDebugViewSource, getResolvedDebugViewMode } from "./debug-view-selection"
import {
  applyDebugTextureTypes,
  createDebugRenderPlan,
  type DebugRenderPlan,
} from "./debug-render-plan"
import {
  resolveDebugViewLayout,
  type DebugViewLayout,
  type DebugViewLayoutOptions,
  type ResolvedDebugViewLayout,
} from "./debug-view-layout"
import {
  createDebugViewportLabels,
  createDebugViewportPlanLabels,
  type DebugViewportLabels,
} from "./debug-viewport-labels"
import {
  createDebugViewportPlan,
  type DebugViewportPlan,
  type DebugViewportView,
  type DebugViewsMode,
} from "./debug-viewport-plan"
import {
  createDebugViewportRenderGraphPlan,
  type DebugViewportRenderGraphPlan,
} from "./debug-render-graph-plan"
import {
  createDebugViewportRects,
  toDebugViewportPixels,
} from "./debug-viewport-presenter"
import {
  createShaderCostOverride,
  type ShaderCostOverride,
} from "./shader-cost/cost-override"

export interface DebugViewsProps {
  views: DebugView[]
  mode?: DebugViewsMode
  viewportViews?: DebugViewportView[]
  activeView?: number
  layout?: DebugViewLayout
  slots?: number
  columns?: number
  rows?: number
  showLabels?: boolean
  viewportLabels?: DebugViewportLabels
  overlayOpacity?: number
  renderPriority?: number
  enabled?: boolean
}

export function DebugViews({
  views,
  mode = "compose",
  viewportViews,
  activeView = 0,
  layout = "single",
  slots,
  columns,
  rows,
  showLabels = false,
  viewportLabels,
  overlayOpacity = 0.35,
  renderPriority = 1,
  enabled = true,
}: DebugViewsProps) {
  const layoutOptions = useMemo(
    (): DebugViewLayoutOptions => ({ slots, columns, rows }),
    [slots, columns, rows],
  )

  if (!enabled) {
    return null
  }

  return (
    <DebugViewsPipeline
      views={views}
      mode={mode}
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
  views: DebugView[]
  mode: DebugViewsMode
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
  mode,
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
  const aoFallbacks = useMemo(() => createAoFallbacks(scene), [scene])
  const resolvedLayout = useMemo(
    () => resolveDebugViewLayout(layout, layoutOptions),
    [layout, layoutOptions],
  )
  const viewportPlan = useMemo(
    () => mode === "viewport"
      ? createDebugViewportPlan({ views, viewportViews, activeView, layout: resolvedLayout })
      : undefined,
    [mode, views, viewportViews, activeView, resolvedLayout],
  )
  const viewportGraph = useMemo(
    () => viewportPlan ? createDebugViewportRenderGraphPlan(viewportPlan) : undefined,
    [viewportPlan],
  )
  const pipelineViews = viewportPlan?.views ?? views
  const plan = useMemo(
    () => createDebugRenderPlan(pipelineViews, activeView, resolvedLayout),
    [pipelineViews, activeView, resolvedLayout],
  )
  const visibleViews = viewportPlan?.views ?? plan.views
  const showsShaderCost = useMemo(
    () => visibleViews.some((view) => getDefaultDebugViewSource(view) === "shaderCost"),
    [visibleViews],
  )

  const composePipelineRef = useDebugPipeline(
    mode === "compose",
    scene,
    camera,
    plan,
    resolvedLayout,
    toWebGpuRenderer(gl),
    uniforms,
    aoFallbacks,
  )
  const viewportRuntimeRef = useDebugViewportPipelines(
    mode === "viewport",
    scene,
    camera,
    viewportPlan,
    viewportGraph,
    toWebGpuRenderer(gl),
    uniforms,
    aoFallbacks,
  )

  useFrame(() => {
    const previousBackground = scene.background
    scene.background = null

    try {
      if (mode === "viewport") {
        const runtime = viewportRuntimeRef.current
        if (runtime?.usesAoFallback) {
          aoFallbacks.refresh()
        }
        runtime?.render()
      } else {
        updateDebugViewUniforms(uniforms, 0, resolvedLayout, plan.views.length, overlayOpacity)
        if (plan.usesAoFallback) {
          aoFallbacks.refresh()
        }
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
      {showsShaderCost ? <ShaderCostLegendOverlay /> : null}
    </>
  )
}

interface DebugViewportLabelOverlayProps {
  views: readonly DebugView[]
  layout: ResolvedDebugViewLayout
  labels?: DebugViewportLabels
  viewportPlan?: DebugViewportPlan
}

function DebugViewportLabelOverlay({
  views,
  layout,
  labels,
  viewportPlan,
}: DebugViewportLabelOverlayProps) {
  const viewportLabels = useMemo(
    () => viewportPlan
      ? createDebugViewportPlanLabels(viewportPlan, labels)
      : createDebugViewportLabels(views, layout, labels),
    [views, layout, labels, viewportPlan],
  )

  if (viewportLabels.length === 0) return null

  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        aria-hidden="true"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
          height: "100%",
          inset: 0,
          pointerEvents: "none",
          position: "absolute",
          width: "100%",
        }}
      >
        {viewportLabels.map((label, index) => (
          <div key={`${index}:${label}`} style={{ minWidth: 0, position: "relative" }}>
            <span
              style={{
                backdropFilter: "blur(8px)",
                background: "rgba(0, 0, 0, 0.58)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                borderRadius: 4,
                color: "#fff",
                fontFamily: "monospace",
                fontSize: 11,
                left: 10,
                letterSpacing: "0.04em",
                lineHeight: 1,
                padding: "6px 8px",
                position: "absolute",
                textTransform: "uppercase",
                top: 10,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </Html>
  )
}

function ShaderCostLegendOverlay() {
  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        aria-hidden="true"
        style={{
          alignItems: "center",
          bottom: 42,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          left: "50%",
          pointerEvents: "none",
          position: "absolute",
          transform: "translateX(-50%)",
          width: "min(560px, calc(100vw - 48px))",
          zIndex: 20,
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "rgba(0, 0, 0, 0.62)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: 6,
            boxShadow: "0 10px 32px rgba(0, 0, 0, 0.32)",
            display: "grid",
            gap: 8,
            gridTemplateColumns: "auto 1fr auto",
            padding: "8px 10px",
            width: "100%",
          }}
        >
          <span style={legendLabelStyle}>cheap</span>
          <div
            style={{
              background:
                "linear-gradient(90deg, #000 0%, #000 6%, #00ff1f 18%, #fff000 48%, #ff0d00 80%, #fff 100%)",
              border: "1px solid rgba(255, 255, 255, 0.24)",
              borderRadius: 999,
              height: 12,
              overflow: "hidden",
            }}
          />
          <span style={legendLabelStyle}>expensive</span>
        </div>
        <div
          style={{
            color: "rgba(255, 255, 255, 0.7)",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          estimated shader complexity · black = no rendered material
        </div>
      </div>
    </Html>
  )
}

const legendLabelStyle = {
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} as const

function useDebugPipeline(
  enabled: boolean,
  scene: Scene,
  camera: Camera,
  plan: DebugRenderPlan,
  layout: ResolvedDebugViewLayout,
  gl: WebGPURenderer,
  uniforms: ReturnType<typeof createDebugViewUniforms>,
  aoFallbacks: ReturnType<typeof createAoFallbacks>,
) {
  const pipelineRef = useRef<RenderPipeline | null>(null)

  useEffect(() => {
    if (!enabled) return

    const runtime = createDebugPipelineRuntime(scene, camera, plan, layout, gl, uniforms)
    if (plan.usesAoFallback) aoFallbacks.apply()

    pipelineRef.current = runtime.pipeline

    return () => {
      runtime.dispose()
      aoFallbacks.restore()
      pipelineRef.current = null
    }
  }, [enabled, scene, camera, plan, layout, gl, uniforms, aoFallbacks])

  return pipelineRef
}

interface DebugViewportRuntime {
  usesAoFallback: boolean
  render: () => void
}

function useDebugViewportPipelines(
  enabled: boolean,
  scene: Scene,
  defaultCamera: Camera,
  viewportPlan: DebugViewportPlan | undefined,
  viewportGraph: DebugViewportRenderGraphPlan | undefined,
  gl: WebGPURenderer,
  uniforms: ReturnType<typeof createDebugViewUniforms>,
  aoFallbacks: ReturnType<typeof createAoFallbacks>,
) {
  const runtimeRef = useRef<DebugViewportRuntime | null>(null)

  useEffect(() => {
    if (!enabled || !viewportPlan || !viewportGraph) return

    const passRuntimes = viewportGraph.passes.map((graphPass) => {
      const passPlan = createDebugRenderPlan([graphPass.view], 0, SINGLE_VIEW_LAYOUT)
      return {
        plan: passPlan,
        runtime: createDebugPipelineRuntime(
          scene,
          graphPass.camera ?? defaultCamera,
          passPlan,
          SINGLE_VIEW_LAYOUT,
          gl,
          uniforms,
          graphPass.resolutionScale,
        ),
      }
    })
    const rects = createDebugViewportRects(viewportPlan)
    const rendererSize = new Vector2()
    const previousViewport = new Vector4()
    const previousScissor = new Vector4()
    const usesAoFallback = passRuntimes.some((entry) => entry.plan.usesAoFallback)

    if (usesAoFallback) aoFallbacks.apply()

    runtimeRef.current = {
      usesAoFallback,
      render: () => {
        gl.getSize(rendererSize)
        const previousScissorTest = gl.getScissorTest()
        gl.getViewport(previousViewport)
        gl.getScissor(previousScissor)
        gl.setScissorTest(false)
        gl.setViewport(0, 0, rendererSize.x, rendererSize.y)
        gl.clear(true, true, false)
        gl.setScissorTest(true)

        try {
          for (const cell of viewportGraph.cells) {
            const rect = rects[cell.index]
            const passRuntime = passRuntimes[cell.passIndex]
            if (!rect || !passRuntime) continue

            const viewportRect = toDebugViewportPixels(rect.scissor, rendererSize)
            gl.setViewport(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height)
            gl.setScissor(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height)
            updateDebugViewUniforms(uniforms, 0, SINGLE_VIEW_LAYOUT, 1, 1)
            passRuntime.runtime.pipeline.render()
          }
        } finally {
          gl.setViewport(previousViewport)
          gl.setScissor(previousScissor)
          gl.setScissorTest(previousScissorTest)
        }
      },
    }

    return () => {
      for (const passRuntime of passRuntimes) {
        passRuntime.runtime.dispose()
      }
      aoFallbacks.restore()
      runtimeRef.current = null
    }
  }, [enabled, scene, defaultCamera, viewportPlan, viewportGraph, gl, uniforms, aoFallbacks])

  return runtimeRef
}

interface DebugPipelineRuntime {
  pipeline: RenderPipeline
  dispose: () => void
}

interface ShaderCostPass {
  setResolutionScale(resolutionScale: number): void
  getTextureNode(name?: string): DebugNode
  getViewZNode(name?: string): FloatNode
  updateBefore(frame: unknown): unknown
  dispose(): void
}

const SINGLE_VIEW_LAYOUT: ResolvedDebugViewLayout = {
  mode: "single",
  presentation: "single",
  columns: 1,
  rows: 1,
  slots: 1,
}

function createDebugPipelineRuntime(
  scene: Scene,
  camera: Camera,
  plan: DebugRenderPlan,
  layout: ResolvedDebugViewLayout,
  gl: WebGPURenderer,
  uniforms: ReturnType<typeof createDebugViewUniforms>,
  resolutionScale = 1,
): DebugPipelineRuntime {
  const sp = pass(scene, camera)
  sp.setResolutionScale(resolutionScale)
  configureSceneDebugPass(sp, plan.sceneOutputs)
  applyDebugTextureTypes(sp, plan.sceneTextureTypes)

  const materialDetailPass = plan.usesMaterialDetailPass ? pass(scene, camera) : undefined
  if (materialDetailPass) {
    materialDetailPass.setResolutionScale(resolutionScale)
    configureMaterialDetailPass(materialDetailPass, plan.materialDetailOutputs)
    applyDebugTextureTypes(materialDetailPass, plan.materialDetailTextureTypes)
  }

  const wireframePass = plan.usesWireframePass ? pass(scene, camera) : undefined
  if (wireframePass) {
    wireframePass.setResolutionScale(resolutionScale)
    wireframePass.overrideMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      toneMapped: false,
    })
  }

  const lightingOnlyPass = plan.usesLightingOnlyPass ? pass(scene, camera) : undefined
  if (lightingOnlyPass) {
    lightingOnlyPass.setResolutionScale(resolutionScale)
    lightingOnlyPass.overrideMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.72,
    })
  }

  const reflectionOnlyPass = plan.usesReflectionOnlyPass ? pass(scene, camera) : undefined
  if (reflectionOnlyPass) {
    reflectionOnlyPass.setResolutionScale(resolutionScale)
    reflectionOnlyPass.overrideMaterial = new MeshStandardMaterial({
      color: 0x000000,
      metalness: 1,
      roughness: 0.18,
    })
  }

  const shaderCostOverride = plan.usesShaderCostPass ? createShaderCostOverride() : undefined
  const shaderCostPass = plan.usesShaderCostPass
    ? createShaderCostPass(scene, camera, resolutionScale, shaderCostOverride)
    : undefined

  const getDefaultNode = createDefaultDebugNodeResolver(sp, {
    lightingOnlyPass,
    materialDetailPass,
    reflectionOnlyPass,
    shaderCostPass,
    wireframePass,
  })

  const resolvedViews = plan.views.map((v) => ({
    ...v,
    mode: getResolvedDebugViewMode(v),
    node: v.node ?? getDefaultNode(getDefaultDebugViewSource(v)),
  }))

  const outputNode = createViewCompositor({ views: resolvedViews, uniforms, layout })
  const pipeline = new RenderPipeline(gl, outputNode)

  return {
    pipeline,
    dispose: () => {
      pipeline.dispose()
      sp.dispose()
      materialDetailPass?.dispose()
      lightingOnlyPass?.overrideMaterial?.dispose()
      lightingOnlyPass?.dispose()
      reflectionOnlyPass?.overrideMaterial?.dispose()
      reflectionOnlyPass?.dispose()
      shaderCostPass?.dispose()
      shaderCostOverride?.dispose()
      wireframePass?.overrideMaterial?.dispose()
      wireframePass?.dispose()
    },
  }
}

function createShaderCostPass(
  scene: Scene,
  camera: Camera,
  resolutionScale: number,
  shaderCostOverride: ShaderCostOverride | undefined,
): ShaderCostPass {
  const shaderCostPass = pass(scene, camera) as ShaderCostPass
  shaderCostPass.setResolutionScale(resolutionScale)

  const renderOriginalPass = shaderCostPass.updateBefore.bind(shaderCostPass)

  shaderCostPass.updateBefore = (frame: unknown) => {
    const restore = shaderCostOverride?.apply(scene)

    try {
      return renderOriginalPass(frame)
    } finally {
      restore?.restore()
    }
  }

  return shaderCostPass
}

function toWebGpuRenderer(renderer: unknown): WebGPURenderer {
  return renderer as WebGPURenderer
}
