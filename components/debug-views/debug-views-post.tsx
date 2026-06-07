import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import { RenderPipeline, type WebGPURenderer } from "three/webgpu"
import { pass } from "three/tsl"
import { createViewCompositor, type DebugView } from "./debug-views-tsl/compositor"
import type { DebugNode, FloatNode } from "./debug-views-tsl/node-types"
import { createDebugViewUniforms, updateDebugViewUniforms } from "./debug-views-tsl/uniforms"
import { MeshBasicMaterial, MeshStandardMaterial, Vector2, Vector4, type Camera, type Scene } from "three"
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
import {
  createOverdrawOverride,
  type OverdrawOverride,
} from "./overdraw/overdraw-override"

export interface DebugViewsProps {
  views: readonly DebugView[]
  viewportViews?: DebugViewportView[]
  activeView?: number
  layout?: DebugViewLayout
  paneCount?: number
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
  viewportViews,
  activeView = 0,
  layout = "single",
  paneCount,
  columns,
  rows,
  showLabels = false,
  viewportLabels,
  overlayOpacity = 0.35,
  renderPriority = 1,
  enabled = true,
}: DebugViewsProps) {
  const layoutOptions = useMemo(
    (): DebugViewLayoutOptions => ({ paneCount, columns, rows }),
    [paneCount, columns, rows],
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
  const renderMode = viewportViews?.length ? "viewport" : "compose"
  const viewportPlan = useMemo(
    () => renderMode === "viewport"
      ? createDebugViewportPlan({ views, viewportViews, activeView, layout: resolvedLayout })
      : undefined,
    [renderMode, views, viewportViews, activeView, resolvedLayout],
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
  const showsOverdraw = useMemo(
    () => visibleViews.some((view) => getDefaultDebugViewSource(view) === "overdraw"),
    [visibleViews],
  )
  const composePipelineKey = useMemo(
    () => createDebugPipelineRuntimeKey(plan, resolvedLayout),
    [plan, resolvedLayout],
  )
  const webGpuRenderer = toWebGpuRenderer(gl)
  const [shaderCostScanPosition, setShaderCostScanPosition] = useState(0.5)

  const composePipelineRef = useDebugPipeline(
    renderMode === "compose",
    scene,
    camera,
    plan,
    composePipelineKey,
    resolvedLayout,
    webGpuRenderer,
    uniforms,
  )
  const viewportRuntimeRef = useDebugViewportPipelines(
    renderMode === "viewport",
    scene,
    camera,
    viewportPlan,
    viewportGraph,
    webGpuRenderer,
    uniforms,
  )

  useFrame((frameState) => {
    const previousBackground = scene.background
    scene.background = null

    try {
      if (renderMode === "viewport") {
        const runtime = viewportRuntimeRef.current
        runtime?.render()
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

      if (showsShaderCost) {
        const scanPosition = 0.5 - Math.cos(frameState.clock.elapsedTime * 1.35) * 0.5
        setShaderCostScanPosition(scanPosition)
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
      {showsOverdraw && !showsShaderCost ? <OverdrawLegendOverlay /> : null}
      {showsShaderCost ? (
        <ShaderCostLegendOverlay
          scanPosition={shaderCostScanPosition}
        />
      ) : null}
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
  const labelGridStyle = useMemo(
    () => createLabelGridStyle(layout),
    [layout],
  )

  if (viewportLabels.length === 0) return null

  return (
    <Html fullscreen style={htmlOverlayStyle}>
      <div
        aria-hidden="true"
        style={labelGridStyle}
      >
        {viewportLabels.map((label, index) => (
          <div key={`${index}:${label}`} style={labelCellStyle}>
            <span
              style={viewportLabelStyle}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </Html>
  )
}

function ShaderCostLegendOverlay({
  scanPosition,
}: {
  scanPosition: number
}) {
  return (
    <Html fullscreen style={htmlOverlayStyle}>
      <div
        aria-hidden="true"
        style={{ ...shaderCostScanCursorStyle, left: `${scanPosition * 100}%` }}
      >
        <span style={shaderCostScanCursorLabelStyle}>sample</span>
      </div>
      <div
        aria-hidden="true"
        style={shaderCostLegendOverlayStyle}
      >
        <div
          style={shaderCostLegendPanelStyle}
        >
          <span style={legendLabelStyle}>low shader work</span>
          <ShaderCostLegendRamp scanPosition={scanPosition} />
          <span style={legendLabelStyle}>high shader work</span>
        </div>
        <div
          style={shaderCostLegendNoteStyle}
        >
          estimated shader complexity sample
        </div>
      </div>
    </Html>
  )
}

function ShaderCostLegendRamp({ scanPosition }: { scanPosition: number }) {
  const markerPercent = `${(scanPosition * 100).toFixed(2)}%`
  const position = `clamp(30px, ${markerPercent}, calc(100% - 30px))`

  return (
    <div style={shaderCostLegendRampStyle}>
      <div style={{ ...shaderCostTimingMarkerStyle, left: position }}>
        <span style={shaderCostTimingMarkerTriangleStyle} />
        <span style={shaderCostTimingMarkerLabelStyle}>
          sample
        </span>
      </div>
    </div>
  )
}

function OverdrawLegendOverlay() {
  return (
    <Html fullscreen style={htmlOverlayStyle}>
      <div
        aria-hidden="true"
        style={shaderCostLegendOverlayStyle}
      >
        <div
          style={shaderCostLegendPanelStyle}
        >
          <span style={legendLabelStyle}>no overlap</span>
          <div
            style={shaderCostLegendRampStyle}
          />
          <span style={legendLabelStyle}>heavy overlap</span>
        </div>
        <div
          style={shaderCostLegendNoteStyle}
        >
          pixel overlap
        </div>
      </div>
    </Html>
  )
}

const htmlOverlayStyle: CSSProperties = {
  pointerEvents: "none",
}

const labelCellStyle: CSSProperties = {
  minWidth: 0,
  position: "relative",
}

const viewportLabelStyle: CSSProperties = {
  backdropFilter: "blur(8px)",
  background: "rgba(0, 0, 0, 0.58)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 0,
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  left: 10,
  letterSpacing: "0.04em",
  lineHeight: 1,
  padding: "6px 8px",
  position: "absolute",
  textTransform: "uppercase",
  top: 10,
  whiteSpace: "nowrap",
}

const shaderCostLegendOverlayStyle: CSSProperties = {
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
}

const shaderCostScanCursorStyle: CSSProperties = {
  border: "2px solid rgba(255, 255, 255, 0.9)",
  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.72), 0 0 22px rgba(255, 255, 255, 0.34)",
  height: 46,
  bottom: 118,
  position: "absolute",
  transform: "translateX(-50%)",
  transition: "left 90ms linear",
  width: 46,
  zIndex: 19,
}

const shaderCostScanCursorLabelStyle: CSSProperties = {
  background: "rgba(0, 0, 0, 0.72)",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 11,
  left: 8,
  letterSpacing: "0.06em",
  lineHeight: 1,
  padding: "4px 6px",
  position: "absolute",
  textTransform: "uppercase",
  top: 0,
  whiteSpace: "nowrap",
}

const shaderCostLegendPanelStyle: CSSProperties = {
  alignItems: "center",
  background: "rgba(0, 0, 0, 0.62)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 0,
  boxShadow: "0 10px 32px rgba(0, 0, 0, 0.32)",
  display: "grid",
  gap: 8,
  gridTemplateColumns: "auto 1fr auto",
  padding: "8px 10px",
  width: "100%",
}

const shaderCostLegendRampStyle: CSSProperties = {
  background:
    "linear-gradient(90deg, #000 0%, #000 6%, #00ff1f 18%, #fff000 48%, #ff0d00 80%, #fff 100%)",
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 0,
  height: 12,
  overflow: "visible",
  position: "relative",
}

const shaderCostLegendNoteStyle: CSSProperties = {
  color: "rgba(255, 255, 255, 0.7)",
  fontFamily: "monospace",
  fontSize: 12,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
}

const legendLabelStyle: CSSProperties = {
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
}

const shaderCostTimingMarkerStyle: CSSProperties = {
  bottom: -5,
  height: 22,
  position: "absolute",
  transform: "translateX(-50%)",
  transition: "left 220ms ease",
  width: 0,
}

const shaderCostTimingMarkerLabelStyle: CSSProperties = {
  background: "rgba(0, 0, 0, 0.78)",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 10,
  left: "50%",
  letterSpacing: "0.06em",
  lineHeight: 1,
  padding: "3px 5px",
  position: "absolute",
  textTransform: "uppercase",
  top: -20,
  transform: "translateX(-50%)",
  whiteSpace: "nowrap",
}

const shaderCostTimingMarkerTriangleStyle: CSSProperties = {
  borderLeft: "5px solid transparent",
  borderRight: "5px solid transparent",
  borderTop: "7px solid #fff",
  left: -5,
  position: "absolute",
  top: -1,
}

function createLabelGridStyle(layout: ResolvedDebugViewLayout): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
    height: "100%",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
    width: "100%",
  }
}

function useDebugPipeline(
  enabled: boolean,
  scene: Scene,
  camera: Camera,
  plan: DebugRenderPlan,
  runtimeKey: string,
  layout: ResolvedDebugViewLayout,
  gl: WebGPURenderer,
  uniforms: ReturnType<typeof createDebugViewUniforms>,
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

interface DebugViewportRuntime {
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

    runtimeRef.current = {
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
      runtimeRef.current = null
    }
  }, [enabled, scene, defaultCamera, viewportPlan, viewportGraph, gl, uniforms])

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

interface OverdrawPass {
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

  const overdrawOverride = plan.usesOverdrawPass ? createOverdrawOverride() : undefined
  const overdrawPass = plan.usesOverdrawPass
    ? createOverdrawPass(scene, camera, resolutionScale, overdrawOverride)
    : undefined
  const shaderCostOverride = plan.usesShaderCostPass ? createShaderCostOverride() : undefined
  const shaderCostPass = plan.usesShaderCostPass
    ? createShaderCostPass(scene, camera, resolutionScale, shaderCostOverride)
    : undefined
  const getDefaultNode = createDefaultDebugNodeResolver(sp, {
    lightingOnlyPass,
    materialDetailPass,
    overdrawPass,
    reflectionOnlyPass,
    shaderCostPass,
    wireframePass,
  })

  const resolvedViews = plan.pipelineViews.map((v) => ({
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
      overdrawPass?.dispose()
      overdrawOverride?.dispose()
      shaderCostPass?.dispose()
      shaderCostOverride?.dispose()
      wireframePass?.overrideMaterial?.dispose()
      wireframePass?.dispose()
    },
  }
}

function createDebugPipelineRuntimeKey(
  plan: DebugRenderPlan,
  layout: ResolvedDebugViewLayout,
) {
  const viewKey = plan.pipelineViews
    .map((view) => [
      view.id ?? "",
      view.label,
      view.source ?? "",
      view.mode ?? "",
      view.node ? `custom:${getCustomNodeKey(view.node)}` : "default",
      view.scale ?? "",
      view.bias ?? "",
    ].join(":"))
    .join("|")

  return [
    layout.mode,
    layout.columns,
    layout.rows,
    layout.slots,
    viewKey,
    JSON.stringify(plan.sceneOutputs),
    JSON.stringify(plan.materialDetailOutputs),
    plan.usesWireframePass,
    plan.usesLightingOnlyPass,
    plan.usesReflectionOnlyPass,
    plan.usesOverdrawPass,
    plan.usesShaderCostPass,
  ].join(";")
}

const customNodeKeys = new WeakMap<DebugNode, number>()
let nextCustomNodeKey = 0

function getCustomNodeKey(node: DebugNode) {
  let key = customNodeKeys.get(node)
  if (key === undefined) {
    key = nextCustomNodeKey
    nextCustomNodeKey += 1
    customNodeKeys.set(node, key)
  }

  return key
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

function createOverdrawPass(
  scene: Scene,
  camera: Camera,
  resolutionScale: number,
  overdrawOverride: OverdrawOverride | undefined,
): OverdrawPass {
  const overdrawPass = pass(scene, camera) as OverdrawPass
  overdrawPass.setResolutionScale(resolutionScale)

  const renderOriginalPass = overdrawPass.updateBefore.bind(overdrawPass)

  overdrawPass.updateBefore = (frame: unknown) => {
    const restore = overdrawOverride?.apply(scene)

    try {
      return renderOriginalPass(frame)
    } finally {
      restore?.restore()
    }
  }

  return overdrawPass
}

function toWebGpuRenderer(renderer: unknown): WebGPURenderer {
  return renderer as WebGPURenderer
}
