import {
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Camera,
  type RenderTarget,
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
import { type DebugViewUniforms } from "./debug-views-tsl/uniforms"
import { getDefaultDebugViewSource, getResolvedDebugViewMode } from "./debug-view-selection"
import {
  applyDebugTextureTypes,
  createDebugRenderPlan,
  type DebugRenderPlan,
} from "./debug-render-plan"
import type { ResolvedDebugViewLayout } from "./debug-view-layout"
import {
  createShaderCostOverride,
  type ShaderCostOverride,
} from "./shader-cost/cost-override"
import {
  createOverdrawOverride,
  type OverdrawOverride,
} from "./overdraw/overdraw-override"
import { createMeasuredOverdrawOverride } from "./overdraw/measured-overdraw-override"
import { createMeasuredOverdrawPass } from "./overdraw/measured-overdraw-pass"
import { createLightComplexityMaterialFromScene } from "./lighting/light-complexity-material"
import { DEFAULT_MAX_DISPLAY_LAYERS } from "./overdraw/overdraw-classification"

export interface DebugPipelineRuntime {
  pipeline: RenderPipeline
  setViewport: (x: number, y: number, width: number, height: number) => void
  readOverdrawLayerAt?: (x: number, y: number) => Promise<number | null>
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
  renderTarget: RenderTarget
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

  const measuredOverdrawOverride = plan.usesOverdrawPass
    ? createMeasuredOverdrawOverride()
    : undefined
  const overdrawPass = plan.usesOverdrawPass
    ? createMeasuredOverdrawPass(scene, camera, resolutionScale, measuredOverdrawOverride)
    : undefined
  const overdrawVisualOverride = plan.usesOverdrawVisualPass
    ? createOverdrawOverride()
    : undefined
  const overdrawVisualPass = plan.usesOverdrawVisualPass
    ? createOverdrawVisualPass(scene, camera, resolutionScale, overdrawVisualOverride)
    : undefined
  const shaderCostOverride = plan.usesShaderCostPass ? createShaderCostOverride() : undefined
  const shaderCostPass = plan.usesShaderCostPass
    ? createShaderCostPass(scene, camera, resolutionScale, shaderCostOverride)
    : undefined
  let lightComplexityMaterial = plan.usesLightComplexityPass
    ? createLightComplexityMaterialFromScene(scene)
    : undefined
  const lightComplexityPass = plan.usesLightComplexityPass ? pass(scene, camera) : undefined
  if (lightComplexityPass) {
    lightComplexityPass.setResolutionScale(resolutionScale)
    lightComplexityPass.overrideMaterial = lightComplexityMaterial ?? null
    const renderLightComplexityPass = lightComplexityPass.updateBefore.bind(lightComplexityPass)
    lightComplexityPass.updateBefore = (frame: unknown) => {
      const nextMaterial = createLightComplexityMaterialFromScene(scene)
      lightComplexityPass.overrideMaterial = nextMaterial
      lightComplexityMaterial?.dispose()
      lightComplexityMaterial = nextMaterial
      return renderLightComplexityPass(frame as Parameters<typeof renderLightComplexityPass>[0])
    }
  }
  const getDefaultNode = createDefaultDebugNodeResolver(sp, {
    lightingOnlyPass,
    lightComplexityPass,
    materialDetailPass,
    overdrawPass,
    overdrawVisualPass,
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
  if (overdrawVisualPass) viewportPasses.push(overdrawVisualPass)
  if (lightComplexityPass) viewportPasses.push(lightComplexityPass)
  if (shaderCostPass) viewportPasses.push(shaderCostPass)
  if (wireframePass) viewportPasses.push(wireframePass)

  return {
    pipeline,
    setViewport: (x, y, width, height) => {
      for (const debugPass of viewportPasses) {
        debugPass.setViewport(x, y, width, height)
      }
    },
    readOverdrawLayerAt: overdrawPass
      ? (pixelX, pixelY) => readMeasuredOverdrawLayer(gl, overdrawPass.renderTarget, pixelX, pixelY)
      : undefined,
    dispose: () => {
      pipeline.dispose()
      sp.dispose()
      materialDetailPass?.dispose()
      lightingOnlyPass?.overrideMaterial?.dispose()
      lightingOnlyPass?.dispose()
      reflectionOnlyPass?.overrideMaterial?.dispose()
      reflectionOnlyPass?.dispose()
      overdrawPass?.dispose()
      measuredOverdrawOverride?.dispose()
      overdrawVisualPass?.dispose()
      overdrawVisualOverride?.dispose()
      lightComplexityMaterial?.dispose()
      lightComplexityPass?.dispose()
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
  viewport?: { width: number; height: number },
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
    plan.usesOverdrawVisualPass,
    plan.usesShaderCostPass,
    plan.usesLightComplexityPass,
    viewport?.width ?? "",
    viewport?.height ?? "",
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

async function readMeasuredOverdrawLayer(
  gl: WebGPURenderer,
  renderTarget: RenderTarget,
  pixelX: number,
  pixelY: number,
) {
  const width = renderTarget.width
  const height = renderTarget.height
  if (width <= 0 || height <= 0) return null

  const x = Math.min(width - 1, Math.max(0, Math.floor(pixelX)))
  const y = Math.min(height - 1, Math.max(0, height - 1 - Math.floor(pixelY)))
  try {
    const buffer = await gl.readRenderTargetPixelsAsync(renderTarget, x, y, 1, 1)
    return Math.round(buffer[0] * DEFAULT_MAX_DISPLAY_LAYERS)
  } catch {
    return null
  }
}

function createOverdrawVisualPass(
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
