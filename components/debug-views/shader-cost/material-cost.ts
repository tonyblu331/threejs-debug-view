import {
  Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshMatcapMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  ShaderMaterial,
  Texture,
} from "three"

export interface MaterialCostEntry {
  cost: number
  signature: string
  signals: readonly string[]
}

export interface MaterialCostCache {
  get(material: Material): MaterialCostEntry
  clear(): void
  readonly size: number
}

const MAX_CACHE_SIZE = 1000
const MAX_EXPECTED_COMPLEXITY = 20
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

const TEXTURE_WEIGHTS: Record<string, number> = {
  normalMap: 1.5,
  envMap: 1.5,
  transmissionMap: 1.5,
  map: 1.0,
  roughnessMap: 1.0,
  metalnessMap: 1.0,
  clearcoatMap: 1.0,
  aoMap: 0.5,
  emissiveMap: 0.5,
  alphaMap: 0.5,
}

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

  if (material instanceof MeshBasicMaterial && !hasAnyTexture(material)) {
    const result: MaterialCostEntry = { cost: 0, signature, signals: ["type:basic-unlit"] }
    cache.set(material.uuid, result)
    return result
  }

  const analysis = analyzeDeclarative(material)
  const normalizedCost = Math.min(1, analysis.signalCount / MAX_EXPECTED_COMPLEXITY)
  
  const result: MaterialCostEntry = {
    cost: normalizedCost,
    signature,
    signals: analysis.signals,
  }

  cache.set(material.uuid, result)
  return result
}

function analyzeDeclarative(material: Material) {
  let signalCount = 0
  const signals: string[] = []

  if (material instanceof MeshPhysicalMaterial) {
    signalCount += 4
    signals.push("type:physical-lit", "lighting:pbr", "brdf:physical")
  } else if (material instanceof MeshStandardMaterial) {
    signalCount += 2
    signals.push("type:standard-lit", "lighting:pbr")
  } else if (material instanceof ShaderMaterial) {
    signalCount += 2
    signals.push("type:custom-shader")
    
    const uniformCount = Object.keys(material.uniforms).length
    if (uniformCount > 5) {
      signalCount += 1
      signals.push(`custom-uniforms:${uniformCount}`)
    }
    if (uniformCount > 10) signalCount += 1
  } else if (material instanceof MeshPhongMaterial || material instanceof MeshToonMaterial) {
    signalCount += 1
    signals.push("type:per-pixel-lit")
  } else if (material instanceof MeshLambertMaterial || material instanceof MeshMatcapMaterial) {
    signalCount += 1
    signals.push("type:per-vertex-lit")
  }

  if (material.transparent) {
    signalCount += 2
    signals.push("transparent:true")
  }
  
  const alphaTest = getNumericProperty(material, "alphaTest")
  if (alphaTest > 0) {
    signalCount += 2
    signals.push("alphaTest:active")
  }
  
  const clippingPlanes = getArrayProperty(material, "clippingPlanes")
  if (clippingPlanes.length > 0) {
    signalCount += 1
    signals.push("clipping:active")
  }

  for (const slot of TEXTURE_SLOTS) {
    const texture = getProperty<Texture | undefined>(material, slot)
    if (texture) {
      const baseWeight = TEXTURE_WEIGHTS[slot] ?? 1.0
      const resolutionWeight = getTextureResolutionWeight(texture)
      signalCount += baseWeight * resolutionWeight
      signals.push(`texture:${slot}:w${resolutionWeight}`)
    }
  }

  if (material instanceof MeshPhysicalMaterial) {
    if (material.transmission > 0) {
      signalCount += 2
      signals.push("transmission:active")
    }
    if (material.clearcoat > 0) {
      signalCount += 1
      signals.push("clearcoat:active")
    }
    if (material.iridescence > 0) {
      signalCount += 1
      signals.push("iridescence:active")
    }
    if (material.sheen > 0) {
      signalCount += 1
      signals.push("sheen:active")
    }
  }

  return { signalCount, signals }
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
  if (getNumericProperty(material, "alphaTest") > 0) {
    sig += `:A${getNumericProperty(material, "alphaTest")}`
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

function hasAnyTexture(material: Material): boolean {
  return TEXTURE_SLOTS.some((slot) => Boolean(getProperty(material, slot)))
}

function getProperty<T>(material: Material, property: string): T | undefined {
  return (material as unknown as Record<string, T>)[property]
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
