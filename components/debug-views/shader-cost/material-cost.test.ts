import { afterEach, describe, expect, it } from "vitest"
import {
  BackSide,
  DataTexture,
  DoubleSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshMatcapMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  ShaderMaterial,
} from "three"
import {
  clearMaterialComplexityCache,
  extractMaterialCostFeatures,
  getMaterialComplexity,
  getMaterialComplexityCacheSize,
  getMaterialCostSignature,
  predictMaterialCost,
  scoreMaterialCost,
} from "./material-cost"

describe("material complexity scoring", () => {
  afterEach(() => {
    clearMaterialComplexityCache()
  })

  it("returns zero cost for untextured basic materials", () => {
    const result = getMaterialComplexity(new MeshBasicMaterial())
    expect(result.cost).toBe(0)
    expect(result.signals).toContain("type:basic-unlit")
  })

  it("does not zero out risky basic material render states", () => {
    const result = getMaterialComplexity(
      new MeshBasicMaterial({
        opacity: 0.5,
        transparent: true,
      }),
    )

    expect(result.cost).toBeGreaterThan(0)
    expect(result.features?.transparencyMode).toBe("transparent")
  })

  it("does not zero out alpha-hashed basic materials", () => {
    const material = new MeshBasicMaterial()
    material.alphaHash = true

    const result = getMaterialComplexity(material)

    expect(result.cost).toBeGreaterThan(0)
    expect(result.features?.transparencyMode).toBe("alphaTest")
    expect(result.features?.discardRisk).toBe(1)
  })

  it("scores advanced PBR features higher than basic features", () => {
    const cheap = new MeshStandardMaterial({ map: new DataTexture() })
    const expensive = new MeshPhysicalMaterial({
      transmission: 1,
      clearcoat: 1,
      transparent: true,
    })

    const cheapResult = getMaterialComplexity(cheap)
    const expensiveResult = getMaterialComplexity(expensive)

    expect(expensiveResult.cost).toBeGreaterThan(cheapResult.cost)
    expect(expensiveResult.features).toMatchObject({
      physicalLobes: 2,
      transparencyMode: "transparent",
    })
    expect(expensiveResult.signals).toContain("physical-lobes:2")
    expect(expensiveResult.signals).toContain("transparency:transparent")
  })

  it("enforces material hierarchy costs", () => {
    const basic = getMaterialComplexity(new MeshBasicMaterial()).cost
    const standard = getMaterialComplexity(new MeshStandardMaterial()).cost
    const physical = getMaterialComplexity(new MeshPhysicalMaterial()).cost

    expect(basic).toBeLessThan(standard)
    expect(standard).toBeLessThan(physical)
  })

  it("classifies built-in lit families above unlit basic", () => {
    const basic = getMaterialComplexity(new MeshBasicMaterial()).cost

    expect(getMaterialComplexity(new MeshLambertMaterial()).cost).toBeGreaterThan(basic)
    expect(getMaterialComplexity(new MeshPhongMaterial()).cost).toBeGreaterThan(basic)
    expect(getMaterialComplexity(new MeshToonMaterial()).cost).toBeGreaterThan(basic)
    expect(getMaterialComplexity(new MeshMatcapMaterial()).cost).toBeGreaterThan(basic)
  })

  it("scores glass-like physical materials higher than plain physical", () => {
    const plainPhysical = getMaterialComplexity(new MeshPhysicalMaterial()).cost
    const glass = getMaterialComplexity(
      new MeshPhysicalMaterial({
        alphaMap: new DataTexture(),
        clearcoat: 1,
        transparent: true,
        transmission: 1,
      }),
    ).cost

    expect(glass).toBeGreaterThan(plainPhysical)
    expect(glass).toBeLessThanOrEqual(1)
  })

  it("invalidates cache when physical feature toggles change", () => {
    const material = new MeshPhysicalMaterial()
    const first = getMaterialComplexity(material)

    material.sheen = 1

    const second = getMaterialComplexity(material)

    expect(second.signature).not.toBe(first.signature)
    expect(second.cost).toBeGreaterThan(first.cost)
  })

  it("invalidates cache when material signature changes", () => {
    const material = new MeshStandardMaterial()
    const first = getMaterialComplexity(material)

    material.normalMap = new DataTexture()
    material.needsUpdate = true

    const second = getMaterialComplexity(material)

    expect(getMaterialComplexityCacheSize()).toBe(1)
    expect(second.signature).not.toBe(first.signature)
    expect(second.cost).toBeGreaterThan(first.cost)
  })

  it("extracts structured features separately from prediction", () => {
    const material = new MeshPhysicalMaterial({
      clearcoat: 1,
      normalMap: new DataTexture(),
      transmission: 1,
      transparent: true,
    })

    const features = extractMaterialCostFeatures(material)

    expect(features.materialFamily).toBe("physical")
    expect(features.physicalLobes).toBe(2)
    expect(features.textureSlots).toBe(1)
    expect(features.dependentTextureRisk).toBe(1)
    expect(features.transparencyMode).toBe("transparent")
    expect(predictMaterialCost(features)).toBeGreaterThan(0)
  })

  it("classifies node materials when Three node flags are present", () => {
    const material = new MeshStandardMaterial() as MeshStandardMaterial & {
      isNodeMaterial: true
    }
    material.isNodeMaterial = true

    const result = getMaterialComplexity(material)

    expect(result.features?.materialFamily).toBe("node")
    expect(result.signals).toContain("type:node-material")
  })

  it("invalidates cache when texture resolution changes", () => {
    const texture = { image: { width: 256, height: 256 } } as any
    const material = new MeshStandardMaterial({ map: texture })
    const first = getMaterialComplexity(material)

    texture.image.width = 2048
    texture.image.height = 2048

    const second = getMaterialComplexity(material)

    expect(second.signature).not.toBe(first.signature)
    expect(second.cost).toBeGreaterThan(first.cost)
  })

  it("invalidates cache when custom shader uniform count changes", () => {
    const material = new ShaderMaterial({
      uniforms: { time: { value: 0 } },
    })
    const first = getMaterialComplexity(material)

    material.uniforms = {
      u1: { value: 0 }, u2: { value: 0 }, u3: { value: 0 },
      u4: { value: 0 }, u5: { value: 0 }, u6: { value: 0 },
    }

    const second = getMaterialComplexity(material)

    expect(second.signature).not.toBe(first.signature)
    expect(second.cost).toBeGreaterThan(first.cost)
  })

  it("maintains stable signatures for unchanged materials", () => {
    const material = new MeshStandardMaterial()
    expect(getMaterialComplexity(material).signature).toBe(
      getMaterialComplexity(material).signature,
    )
  })

  it("updates signatures for render state changes", () => {
    const material = new MeshStandardMaterial({ side: BackSide })
    const first = getMaterialComplexity(material).signature

    material.side = DoubleSide
    expect(getMaterialComplexity(material).signature).not.toBe(first)
  })

  it("updates signatures for alpha hash changes", () => {
    const material = new MeshBasicMaterial()
    const first = getMaterialCostSignature(material)

    material.alphaHash = true

    expect(getMaterialCostSignature(material)).not.toBe(first)
  })

  it("evicts oldest entries when cache exceeds maximum size", () => {
    const MAX_CACHE_SIZE = 1000
    const materials = Array.from({ length: MAX_CACHE_SIZE + 10 }, () => new MeshStandardMaterial())

    materials.forEach((m) => getMaterialComplexity(m))
    expect(getMaterialComplexityCacheSize()).toBeLessThanOrEqual(MAX_CACHE_SIZE)
  })

  it("maintains backward compatibility with legacy API", () => {
    const material = new MeshPhysicalMaterial({ transmission: 1 })
    expect(scoreMaterialCost(material)).toBe(getMaterialComplexity(material).cost)
  })

  it("weights high-resolution textures higher than low-resolution", () => {
    const lowResMat = new MeshStandardMaterial({
      map: { image: { width: 256 } } as any,
    })
    const highResMat = new MeshStandardMaterial({
      map: { image: { width: 2048 } } as any,
    })

    expect(getMaterialComplexity(highResMat).cost).toBeGreaterThan(
      getMaterialComplexity(lowResMat).cost,
    )
  })

  it("infers custom shader complexity from uniform count", () => {
    const simpleShader = new ShaderMaterial({
      uniforms: { time: { value: 0 } },
    })
    const complexShader = new ShaderMaterial({
      uniforms: {
        u1: { value: 0 }, u2: { value: 0 }, u3: { value: 0 },
        u4: { value: 0 }, u5: { value: 0 }, u6: { value: 0 },
        u7: { value: 0 }, u8: { value: 0 }, u9: { value: 0 },
        u10: { value: 0 }, u11: { value: 0 },
      },
    })

    const simpleCost = getMaterialComplexity(simpleShader).cost
    const complexCost = getMaterialComplexity(complexShader).cost

    expect(complexCost).toBeGreaterThan(simpleCost)
    expect(getMaterialComplexity(complexShader).signals.some((s) => s.startsWith("custom-uniforms:"))).toBe(true)
  })
})
