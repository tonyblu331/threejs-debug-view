import {
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector2,
  Vector4,
  type Camera,
  type Scene,
} from "three"
import { RenderPipeline, type WebGPURenderer } from "three/webgpu"
import { pass } from "three/tsl"
import { createViewCompositor } from "./debug-views-tsl/compositor"
import type { DebugNode, FloatNode } from "./debug-views-tsl/node-types"
import {
  configureMaterialDetailPass,
  configureSceneDebugPass,
  createDefaultDebugNodeResolver,
} from "./debug-views-tsl/default-debug-nodes"
import { createDebugViewUniforms, updateDebugViewUniforms, type DebugViewUniforms } from "./debug-views-tsl/uniforms"
import { getDefaultDebugViewSource, getResolvedDebugViewMode } from "./debug-view-selection"
import {
  applyDebugTextureTypes,
  createDebugRenderPlan,
  type DebugRenderPlan,
} from "./debug-render-plan"
import type { ResolvedDebugViewLayout } from "./debug-view-layout"
import type { DebugViewportPlan } from "./debug-viewport-plan"
import type { DebugViewportRenderGraphPlan } from "./debug-render-graph-plan"
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

export interface DebugPipelineRuntime {
  pipeline: RenderPipeline
  setViewport: (x: number, y: number, width: number, height: number) => void
  dispose: () => void
}

export interface DebugViewportRenderer {
  render: () => void
  dispose: () => void
}

interface DebugViewportPass {
  setViewport(x: number, y: number, width: number, height: number): void
}

interface ShaderCostPass {
  setResolutionScale(resolutionScale: number): void
  setViewport(x: number, y: number, width: number, height: number): void
  getTextureNode(name?: string): DebugNode
  getViewZNode(name?: string): FloatNode
  updateBefore(frame: unknown): unknown
  dispose(): void
}

interface OverdrawPass {
  setResolutionScale(resolutionScale: number): void
  setViewport(x: number, y: number, width: number, height: number): void
  getTextureNode(name?: string): DebugNode
  getViewZNode(name?: string): FloatNode
  updateBefore(frame: unknown): unknown
  dispose(): void
}

export const SINGLE_VIEW_LAYOUT: ResolvedDebugViewLayout = {
  mode: "single",
  presentation: "single",
  columns: 1,
  rows: 1,
  slots: 1,
  diagonalAngle: 0,
}

export function requiresViewportRuntime(plan: DebugViewportPlan) {
  return plan.cells.some((cell) => cell.camera || cell.resolutionScale !== 1)
}

export function createDebugPipelineRuntime(
  scene: Scene,
  camera: Camera,
  plan: DebugRenderPlan,
  layout: ResolvedDebugViewLayout,
  gl: WebGPURenderer,
  uniforms: DebugViewUniforms,
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
  const viewportPasses: DebugViewportPass[] = [sp]
  if (materialDetailPass) viewportPasses.push(materialDetailPass)
  if (lightingOnlyPass) viewportPasses.push(lightingOnlyPass)
  if (reflectionOnlyPass) viewportPasses.push(reflectionOnlyPass)
  if (overdrawPass) viewportPasses.push(overdrawPass)
  if (shaderCostPass) viewportPasses.push(shaderCostPass)
  if (wireframePass) viewportPasses.push(wireframePass)

  return {
    pipeline,
    setViewport: (x, y, width, height) => {
      for (const debugPass of viewportPasses) {
        debugPass.setViewport(x, y, width, height)
      }
    },
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

export function createDebugPipelineRuntimeKey(
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

export interface CreateDebugViewportRendererOptions {
  gl: WebGPURenderer
  scene: Scene
  defaultCamera: Camera
  viewportPlan: DebugViewportPlan
  viewportGraph: DebugViewportRenderGraphPlan
  uniforms: DebugViewUniforms
}

export function createDebugViewportRenderer({
  gl,
  scene,
  defaultCamera,
  viewportPlan,
  viewportGraph,
  uniforms,
}: CreateDebugViewportRendererOptions): DebugViewportRenderer {
  const passRuntimes = viewportGraph.passes.map((graphPass) => {
    const passPlan = createDebugRenderPlan([graphPass.view], 0, SINGLE_VIEW_LAYOUT)
    const camera = graphPass.camera ?? defaultCamera

    return {
      camera,
      runtime: createDebugPipelineRuntime(
        scene,
        camera,
        passPlan,
        SINGLE_VIEW_LAYOUT,
        gl,
        uniforms,
        graphPass.resolutionScale,
      ),
    }
  })
  const rendererSize = new Vector2()
  const previousViewport = new Vector4()
  const previousScissor = new Vector4()
  const cameraAspects = new Map<PerspectiveCamera, number>()

  return {
    render: () => {
      const rects = createDebugViewportRects(viewportPlan)
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
          passRuntime.runtime.setViewport(
            0,
            0,
            viewportRect.width,
            viewportRect.height,
          )
          setCameraAspectForViewport(
            passRuntime.camera,
            viewportRect.width,
            viewportRect.height,
            cameraAspects,
          )
          updateDebugViewUniforms(uniforms, 0, SINGLE_VIEW_LAYOUT, 1, 1)
          passRuntime.runtime.pipeline.render()
        }
      } finally {
        restoreCameraAspects(cameraAspects)
        gl.setViewport(previousViewport)
        gl.setScissor(previousScissor)
        gl.setScissorTest(previousScissorTest)
      }
    },
    dispose: () => {
      for (const passRuntime of passRuntimes) {
        passRuntime.runtime.dispose()
      }
    },
  }
}

function setCameraAspectForViewport(
  camera: Camera,
  width: number,
  height: number,
  previousAspects: Map<PerspectiveCamera, number>,
) {
  if (!(camera instanceof PerspectiveCamera) || height <= 0) return

  if (!previousAspects.has(camera)) {
    previousAspects.set(camera, camera.aspect)
  }

  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function restoreCameraAspects(previousAspects: Map<PerspectiveCamera, number>) {
  for (const [camera, aspect] of previousAspects) {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }

  previousAspects.clear()
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
