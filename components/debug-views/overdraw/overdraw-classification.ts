import type { Material } from "three"

export type OverdrawMaterialClass =
  | "opaqueSolid"
  | "alphaCutout"
  | "transparentContributor"

export const DEFAULT_MAX_DISPLAY_LAYERS = 16

export function classifyOverdrawMaterial(material: Material): OverdrawMaterialClass {
  const transparent = material.transparent === true
  const alphaTest = getMaterialAlphaTest(material) > 0
  const alphaMap = getMaterialProperty<unknown>(material, "alphaMap") != null
  const alphaHash = getMaterialProperty(material, "alphaHash") === true
  const opacity = getMaterialOpacity(material)

  if (!transparent && !alphaTest && !alphaMap && !alphaHash && opacity >= 1) {
    return "opaqueSolid"
  }

  if (alphaTest || alphaMap || alphaHash) {
    return "alphaCutout"
  }

  return "transparentContributor"
}

export function overdrawWritesDepthPrepass(
  material: Material,
  classification: OverdrawMaterialClass,
): boolean {
  if (classification === "opaqueSolid") {
    return true
  }

  if (classification === "alphaCutout") {
    return !(material.transparent === true && material.depthWrite === false)
  }

  return false
}

export function overdrawParticipatesInCounter(
  material: Material,
  classification: OverdrawMaterialClass,
): boolean {
  if (classification === "opaqueSolid") {
    return false
  }

  if (classification === "transparentContributor") {
    return true
  }

  return (
    material.transparent === true ||
    material.depthWrite === false ||
    getMaterialAlphaTest(material) > 0 ||
    getMaterialProperty(material, "alphaMap") != null ||
    getMaterialProperty(material, "alphaHash") === true
  )
}

export function normalizeLayerCount(count: number, maxDisplayLayers = DEFAULT_MAX_DISPLAY_LAYERS) {
  return Math.min(Math.max(count, 0), maxDisplayLayers) / maxDisplayLayers
}

export function denormalizeLayerCount(
  normalized: number,
  maxDisplayLayers = DEFAULT_MAX_DISPLAY_LAYERS,
) {
  return Math.round(normalized * maxDisplayLayers)
}

function getMaterialOpacity(material: Material) {
  return typeof material.opacity === "number" ? material.opacity : 1
}

function getMaterialAlphaTest(material: Material) {
  return typeof material.alphaTest === "number" ? material.alphaTest : 0
}

function getMaterialProperty<T>(material: Material, property: string): T | undefined {
  return (material as unknown as Record<string, T>)[property]
}
