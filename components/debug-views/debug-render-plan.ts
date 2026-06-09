import { UnsignedByteType, type Texture, type TextureDataType } from "three"
import type { DebugView, DebugViewSource } from "./debug-views-tsl/compositor"
import type {
  MaterialDebugChannels,
  MaterialDetailOutputs,
  SceneDebugOutputs,
} from "./debug-views-tsl/default-debug-nodes"
import {
  isResolvedDebugViewLayout,
  resolveDebugViewLayout,
  type DebugViewLayout,
  type ResolvedDebugViewLayout,
} from "./debug-view-layout"
import { getDefaultDebugViewSource, selectPipelineViews } from "./debug-view-selection"

export interface DebugTextureTypeOverride {
  name: string
  type: TextureDataType
}

export interface TextureTypedDebugPass {
  getTexture(name: string): Texture
}

export interface DebugRenderPlan {
  views: DebugView[]
  pipelineViews: DebugView[]
  activePipelineView: number
  sceneOutputs: SceneDebugOutputs
  materialDetailOutputs: MaterialDetailOutputs
  usesMaterialDetailPass: boolean
  usesWireframePass: boolean
  usesLightingOnlyPass: boolean
  usesReflectionOnlyPass: boolean
  usesOverdrawPass: boolean
  usesOverdrawVisualPass: boolean
  usesLightComplexityPass: boolean
  usesShaderCostPass: boolean
  sceneTextureTypes: DebugTextureTypeOverride[]
  materialDetailTextureTypes: DebugTextureTypeOverride[]
}

export function createDebugRenderPlan(
  views: readonly DebugView[],
  activeView: number,
  layout: DebugViewLayout | ResolvedDebugViewLayout,
): DebugRenderPlan {
  const selectedViews = selectPipelineViews(views, activeView, layout)
  const { activePipelineView, pipelineViews } = selectRuntimePipelineViews(
    views,
    selectedViews,
    activeView,
    layout,
  )
  const sceneOutputs = getSceneDebugOutputs(pipelineViews)
  const materialDetailOutputs = getMaterialDetailOutputs(pipelineViews)

  return {
    views: selectedViews,
    pipelineViews,
    activePipelineView,
    sceneOutputs,
    materialDetailOutputs,
    usesMaterialDetailPass: hasMaterialDetailOutputs(materialDetailOutputs),
    usesWireframePass: usesDefaultSource(pipelineViews, "wireframe"),
    usesLightingOnlyPass: usesDefaultSource(pipelineViews, "lightingOnly"),
    usesReflectionOnlyPass: usesDefaultSource(pipelineViews, "reflectionOnly"),
    usesOverdrawPass: usesDefaultSource(pipelineViews, "overdraw"),
    usesOverdrawVisualPass: usesDefaultSource(pipelineViews, "overdrawVisual"),
    usesLightComplexityPass: usesDefaultSource(pipelineViews, "lightComplexity"),
    usesShaderCostPass: usesDefaultSource(pipelineViews, "shaderCost"),
    sceneTextureTypes: getSceneTextureTypes(sceneOutputs),
    materialDetailTextureTypes: getMaterialDetailTextureTypes(materialDetailOutputs),
  }
}

export function applyDebugTextureTypes(
  passNode: TextureTypedDebugPass,
  overrides: readonly DebugTextureTypeOverride[],
) {
  for (const override of overrides) {
    passNode.getTexture(override.name).type = override.type
  }
}

function getSceneDebugOutputs(views: readonly DebugView[]): SceneDebugOutputs {
  const outputs: SceneDebugOutputs = {}
  const material: MaterialDebugChannels = {}

  for (const view of views) {
    if (view.node) continue

    switch (getDefaultDebugViewSource(view)) {
      case "normal":
        outputs.normal = true
        break
      case "albedo":
      case "baseColor":
        outputs.albedo = true
        break
      case "emissive":
        outputs.emissive = true
        break
      case "roughness":
        material.roughness = true
        break
      case "metalness":
      case "metallic":
        material.metalness = true
        break
      case "ao":
        material.ao = true
        break
      case "opacity":
      case "transparency":
        material.opacity = true
        break
    }
  }

  if (hasMaterialChannels(material)) {
    outputs.material = material
  }

  return outputs
}

function getMaterialDetailOutputs(views: readonly DebugView[]): MaterialDetailOutputs {
  const outputs: MaterialDetailOutputs = {}

  for (const view of views) {
    if (view.node) continue

    switch (getDefaultDebugViewSource(view)) {
      case "materialNormal":
      case "normalMap":
        outputs.materialNormal = true
        break
    }
  }

  return outputs
}

function getSceneTextureTypes(outputs: SceneDebugOutputs): DebugTextureTypeOverride[] {
  const overrides: DebugTextureTypeOverride[] = []

  if (outputs.normal) overrides.push(lowPrecision("normal"))
  if (outputs.albedo) overrides.push(lowPrecision("albedo"))
  if (outputs.emissive) overrides.push(lowPrecision("emissive"))
  if (outputs.material) overrides.push(lowPrecision("material"))

  return overrides
}

function getMaterialDetailTextureTypes(
  outputs: MaterialDetailOutputs,
): DebugTextureTypeOverride[] {
  return outputs.materialNormal ? [lowPrecision("materialNormal")] : []
}

function lowPrecision(name: string): DebugTextureTypeOverride {
  return { name, type: UnsignedByteType }
}

function selectRuntimePipelineViews(
  views: readonly DebugView[],
  selectedViews: DebugView[],
  activeView: number,
  layout: DebugViewLayout | ResolvedDebugViewLayout,
) {
  if (views.length <= 1 || selectedViews.length !== 1 || isCustomView(selectedViews[0])) {
    return { activePipelineView: 0, pipelineViews: selectedViews }
  }

  const resolvedLayout = isResolvedDebugViewLayout(layout) ? layout : resolveDebugViewLayout(layout)
  if (resolvedLayout.presentation !== "single") {
    return { activePipelineView: 0, pipelineViews: selectedViews }
  }

  const activeSource = getDefaultDebugViewSource(selectedViews[0])
  const group = getReusablePipelineGroup(activeSource)

  if (!group) {
    return { activePipelineView: 0, pipelineViews: selectedViews }
  }

  const pipelineViews = views.filter((view) => {
    if (isCustomView(view)) return false
    return group.has(getDefaultDebugViewSource(view))
  })
  const clampedActiveView = Math.max(0, Math.min(activeView, views.length - 1))
  const active = views[clampedActiveView]
  const activePipelineView = Math.max(0, pipelineViews.indexOf(active))

  return { activePipelineView, pipelineViews }
}

const SCENE_PIPELINE_GROUP = new Set<DebugViewSource>([
  "beauty",
  "normal",
  "depth",
  "albedo",
  "baseColor",
  "emissive",
  "roughness",
  "metalness",
  "metallic",
  "ao",
  "opacity",
  "transparency",
] as const)

const MATERIAL_DETAIL_PIPELINE_GROUP = new Set<DebugViewSource>([
  "materialNormal",
  "normalMap",
] as const)

function getReusablePipelineGroup(source: DebugViewSource) {
  if (SCENE_PIPELINE_GROUP.has(source)) return SCENE_PIPELINE_GROUP
  if (MATERIAL_DETAIL_PIPELINE_GROUP.has(source)) return MATERIAL_DETAIL_PIPELINE_GROUP
  return undefined
}

function isCustomView(view: DebugView | undefined) {
  return Boolean(view?.node)
}

function usesDefaultSource(views: readonly DebugView[], source: DebugViewSource) {
  return views.some((view) => !view.node && getDefaultDebugViewSource(view) === source)
}

function hasMaterialChannels(channels: MaterialDebugChannels) {
  return Boolean(
    channels.roughness ||
    channels.metalness ||
    channels.ao ||
    channels.opacity
  )
}

function hasMaterialDetailOutputs(outputs: MaterialDetailOutputs) {
  return Boolean(outputs.materialNormal)
}
