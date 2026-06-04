import {
  FrontSide,
  Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshMatcapMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NormalBlending,
  ShaderMaterial,
  Texture,
} from "three"

export interface MaterialCostEntry {
  cost: number
  features?: ShaderCostFeatures
  signature: string
  signals: readonly string[]
}

export type MaterialFamily =
  | "basic"
  | "lambert"
  | "matcap"
  | "node"
  | "phong"
  | "physical"
  | "shader"
  | "standard"
  | "toon"
  | "unknown"

export type TransparencyMode = "opaque" | "alphaTest" | "transparent"

export interface ShaderCostFeatures {
  materialFamily: MaterialFamily
  textureSlots: number
  weightedTexelLoad: number
  dependentTextureRisk: number
  transparencyMode: TransparencyMode
  physicalLobes: number
  branchRisk: number
  discardRisk: number
  renderStateRisk: number
  customUniforms: number
}

export interface MaterialCostCache {
  get(material: Material): MaterialCostEntry
  clear(): void
  readonly size: number
}

const MAX_CACHE_SIZE = 1000
const REFERENCE_HIGH_COST = 18
const DEFAULT_TEXTURE_DIMENSION = 1024

const TEXTURE_SLOTS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "envMap",
  "clearcoatMap",
  "transmissionMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
] as const

class BoundedCache {
  private map = new Map<string, MaterialCostEntry>()

  get(key: string): MaterialCostEntry | undefined {
    return this.map.get(key)
  }

  set(key: string, value: MaterialCostEntry) {
    if (this.map.size >= MAX_CACHE_SIZE) {
      const firstKey = this.map.keys().next().value
      if (firstKey) this.map.delete(firstKey)
    }
    this.map.set(key, value)
  }

  clear() {
    this.map.clear()
  }

  get size() {
    return this.map.size
  }
}

const cache = new BoundedCache()

export function getMaterialComplexity(material: Material): MaterialCostEntry {
  const signature = buildSignature(material)
  const cached = cache.get(material.uuid)
  
  if (cached && cached.signature === signature) {
    return cached
  }

  if (isZeroCostBasicMaterial(material)) {
    const features = extractMaterialCostFeatures(material)
    const result: MaterialCostEntry = {
      cost: 0,
      features,
      signature,
      signals: createMaterialCostSignals(features),
    }
    cache.set(material.uuid, result)
    return result
  }

  const features = extractMaterialCostFeatures(material)

  const result: MaterialCostEntry = {
    cost: predictMaterialCost(features),
    features,
    signature,
    signals: createMaterialCostSignals(features),
  }

  cache.set(material.uuid, result)
  return result
}

export function extractMaterialCostFeatures(material: Material): ShaderCostFeatures {
  const materialFamily = getMaterialFamily(material)
  const transparencyMode = getTransparencyMode(material)
  const physicalLobes = getPhysicalLobeCount(material)
  const customUniforms = material instanceof ShaderMaterial
    ? Object.keys(material.uniforms).length
    : 0
  const textureProfile = getTextureProfile(material)

  return {
    materialFamily,
    textureSlots: textureProfile.slots,
    weightedTexelLoad: textureProfile.weightedTexelLoad,
    dependentTextureRisk: textureProfile.dependentTextureRisk,
    transparencyMode,
    physicalLobes,
    branchRisk: getBranchRisk(material, transparencyMode, customUniforms),
    discardRisk: transparencyMode === "alphaTest" ? 1 : 0,
    renderStateRisk: getRenderStateRisk(material),
    customUniforms,
  }
}

export function predictMaterialCost(features: ShaderCostFeatures): number {
  if (
    features.materialFamily === "basic" &&
    features.textureSlots === 0 &&
    features.transparencyMode === "opaque" &&
    features.renderStateRisk === 0
  ) {
    return 0
  }

  const programCost =
    getFamilyCost(features.materialFamily) +
    getTextureCost(features) +
    features.physicalLobes * 1.15 +
    features.branchRisk * 1.25 +
    features.discardRisk * 1.75 +
    features.renderStateRisk * 0.85 +
    Math.min(2, features.customUniforms / 8)

  return clamp01(Math.log1p(programCost) / Math.log1p(REFERENCE_HIGH_COST))
}

function getMaterialFamily(material: Material): MaterialFamily {
  if (isNodeMaterial(material)) return "node"
  if (material instanceof MeshPhysicalMaterial) return "physical"
  if (material instanceof MeshStandardMaterial) return "standard"
  if (material instanceof ShaderMaterial) return "shader"
  if (material instanceof MeshPhongMaterial) return "phong"
  if (material instanceof MeshToonMaterial) return "toon"
  if (material instanceof MeshLambertMaterial) return "lambert"
  if (material instanceof MeshMatcapMaterial) return "matcap"
  if (material instanceof MeshBasicMaterial) return "basic"
  return "unknown"
}

function getFamilyCost(family: MaterialFamily): number {
  switch (family) {
    case "basic":
      return 0.3
    case "lambert":
    case "matcap":
      return 1.2
    case "phong":
    case "toon":
      return 1.8
    case "standard":
      return 2.6
    case "physical":
      return 4.2
    case "node":
      return 2.8
    case "shader":
      return 2.4
    case "unknown":
      return 1.4
  }
}

function getTransparencyMode(material: Material): TransparencyMode {
  if (material.transparent) return "transparent"
  return getNumericProperty(material, "alphaTest") > 0 || getBooleanProperty(material, "alphaHash")
    ? "alphaTest"
    : "opaque"
}

function getPhysicalLobeCount(material: Material): number {
  if (!(material instanceof MeshPhysicalMaterial)) return 0

  let lobes = 0
  if (material.transmission > 0) lobes += 1
  if (material.clearcoat > 0) lobes += 1
  if (material.iridescence > 0) lobes += 1
  if (material.sheen > 0) lobes += 1
  return lobes
}

function getTextureProfile(material: Material) {
  let slots = 0
  let weightedTexelLoad = 0
  let dependentTextureRisk = 0

  for (const slot of TEXTURE_SLOTS) {
    const texture = getProperty<Texture | undefined>(material, slot)
    if (!texture) continue

    slots += 1
    const resolutionWeight = getTextureResolutionWeight(texture)
    weightedTexelLoad += getTextureSlotCost(slot) * resolutionWeight
    dependentTextureRisk += getDependentTextureRisk(slot)
  }

  return { dependentTextureRisk, slots, weightedTexelLoad }
}

function getTextureCost(features: ShaderCostFeatures): number {
  return features.weightedTexelLoad + features.dependentTextureRisk * 0.8
}

function getTextureSlotCost(slot: string): number {
  if (slot === "normalMap" || slot === "envMap" || slot === "transmissionMap") return 1.5
  if (slot === "aoMap" || slot === "emissiveMap" || slot === "alphaMap") return 0.55
  return 1
}

function getDependentTextureRisk(slot: string): number {
  return slot === "normalMap" || slot === "transmissionMap" ? 1 : 0
}

function getBranchRisk(
  material: Material,
  transparencyMode: TransparencyMode,
  customUniforms: number,
): number {
  let risk = 0
  if (transparencyMode !== "opaque") risk += 1
  if (getArrayProperty(material, "clippingPlanes").length > 0) risk += 1
  if (customUniforms > 5) risk += 1
  if (customUniforms > 10) risk += 1
  return risk
}

function getRenderStateRisk(material: Material): number {
  let risk = 0
  if (getArrayProperty(material, "clippingPlanes").length > 0) risk += 1
  if (material.side !== FrontSide) risk += 0.5
  if (material.blending !== NormalBlending) risk += 0.5
  return risk
}

function isZeroCostBasicMaterial(material: Material): material is MeshBasicMaterial {
  if (!(material instanceof MeshBasicMaterial)) return false

  const features = extractMaterialCostFeatures(material)
  return (
    features.textureSlots === 0 &&
    features.transparencyMode === "opaque" &&
    features.branchRisk === 0 &&
    features.discardRisk === 0 &&
    features.renderStateRisk === 0
  )
}

function isNodeMaterial(material: Material): boolean {
  const flags = material as unknown as Record<string, unknown>
  return flags.isNodeMaterial === true || flags.isMeshStandardNodeMaterial === true
}

function createMaterialCostSignals(features: ShaderCostFeatures): string[] {
  const signals: string[] = [`family:${features.materialFamily}`]

  if (features.materialFamily === "basic" && features.textureSlots === 0) {
    signals.push("type:basic-unlit")
  }

  if (features.materialFamily === "physical") {
    signals.push("lighting:pbr", "brdf:physical")
  } else if (features.materialFamily === "standard") {
    signals.push("lighting:pbr")
  } else if (features.materialFamily === "shader") {
    signals.push("type:custom-shader")
  } else if (features.materialFamily === "node") {
    signals.push("type:node-material")
  }

  if (features.textureSlots > 0) signals.push(`textures:${features.textureSlots}`)
  if (features.weightedTexelLoad > 0) {
    signals.push(`weighted-texel-load:${roundSignal(features.weightedTexelLoad)}`)
  }
  if (features.dependentTextureRisk > 0) {
    signals.push(`dependent-texture-risk:${features.dependentTextureRisk}`)
  }
  if (features.transparencyMode !== "opaque") {
    signals.push(`transparency:${features.transparencyMode}`)
  }
  if (features.physicalLobes > 0) signals.push(`physical-lobes:${features.physicalLobes}`)
  if (features.branchRisk > 0) signals.push(`branch-risk:${features.branchRisk}`)
  if (features.discardRisk > 0) signals.push("discard-risk:alpha-test")
  if (features.renderStateRisk > 0) {
    signals.push(`render-state-risk:${roundSignal(features.renderStateRisk)}`)
  }
  if (features.customUniforms > 0) signals.push(`custom-uniforms:${features.customUniforms}`)

  return signals
}

function getTextureResolutionWeight(texture: Texture): number {
  const { width, height } = getTextureDimensions(texture)
  const maxDimension = Math.max(width, height)
  const texelCount = width * height

  if (maxDimension >= 2048 || texelCount >= 2048 * 2048) return 1.5
  if (maxDimension >= 1024 || texelCount >= 1024 * 1024) return 1.25
  if (maxDimension <= 256 && texelCount <= 256 * 256) return 0.75
  return 1.0
}

function buildSignature(material: Material): string {
  let sig = `${material.type}:${material.uuid}:${material.side}:${material.blending}`
  
  if (material.transparent) sig += ":T"
  if (getBooleanProperty(material, "alphaHash")) sig += ":H"
  if (getNumericProperty(material, "alphaTest") > 0) {
    sig += `:A${getNumericProperty(material, "alphaTest")}`
  }
  if (getArrayProperty(material, "clippingPlanes").length > 0) {
    sig += `:C${getArrayProperty(material, "clippingPlanes").length}`
  }
  
  for (const slot of TEXTURE_SLOTS) {
    const texture = getProperty<Texture | undefined>(material, slot)
    if (texture) {
      const { width, height } = getTextureDimensions(texture)
      sig += `:${slot}:${width}x${height}`
    }
  }
  
  if (material instanceof MeshPhysicalMaterial) {
    if (material.transmission > 0) sig += ":TX"
    if (material.clearcoat > 0) sig += ":CC"
    if (material.iridescence > 0) sig += ":IR"
    if (material.sheen > 0) sig += ":SH"
  }

  if (material instanceof ShaderMaterial) {
    sig += `:U${Object.keys(material.uniforms).length}`
  }
  
  return sig
}

function getTextureDimensions(texture: Texture) {
  const image = texture.image as Partial<{ width: number; height: number }> | undefined
  const sourceData = texture.source?.data as Partial<{ width: number; height: number }> | undefined
  const width = getPositiveDimension(image?.width ?? sourceData?.width)
  const height = getPositiveDimension(image?.height ?? sourceData?.height)

  return { width, height }
}

function getPositiveDimension(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_TEXTURE_DIMENSION
}

function getProperty<T>(material: Material, property: string): T | undefined {
  return (material as unknown as Record<string, T>)[property]
}

function getBooleanProperty(material: Material, property: string): boolean {
  return getProperty<boolean>(material, property) === true
}

function getNumericProperty(material: Material, property: string): number {
  const value = getProperty<number>(material, property)
  return typeof value === "number" ? value : 0
}

function getArrayProperty<T>(material: Material, property: string): T[] {
  const value = getProperty<T[]>(material, property)
  return Array.isArray(value) ? value : []
}

export function clearMaterialComplexityCache(): void {
  cache.clear()
}

export function getMaterialComplexityCacheSize(): number {
  return cache.size
}

export function scoreMaterialCost(material: Material): number {
  return getMaterialComplexity(material).cost
}

export function getMaterialCostSignature(material: Material): string {
  return buildSignature(material)
}

export function createMaterialCostCache(): MaterialCostCache {
  return {
    get(material: Material) {
      return getMaterialComplexity(material)
    },
    clear() {
      clearMaterialComplexityCache()
    },
    get size() {
      return getMaterialComplexityCacheSize()
    },
  }
}

function roundSignal(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "")
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
