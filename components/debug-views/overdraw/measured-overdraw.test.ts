import { describe, expect, it } from "vitest"
import {
  BoxGeometry,
  DataTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  UnsignedByteType,
} from "three"
import {
  classifyOverdrawMaterial,
  denormalizeLayerCount,
  normalizeLayerCount,
  overdrawParticipatesInCounter,
  overdrawWritesDepthPrepass,
} from "./overdraw-classification"
import { createMeasuredOverdrawOverride } from "./measured-overdraw-override"

describe("overdraw classification", () => {
  it("classifies opaque cliff materials as opaqueSolid", () => {
    const material = new MeshStandardMaterial({ roughness: 0.8 })
    expect(classifyOverdrawMaterial(material)).toBe("opaqueSolid")
    expect(overdrawWritesDepthPrepass(material, "opaqueSolid")).toBe(true)
    expect(overdrawParticipatesInCounter(material, "opaqueSolid")).toBe(false)
  })

  it("classifies foliage cards as alphaCutout contributors", () => {
    const alphaMap = new DataTexture(new Uint8Array([255, 255, 255, 128]), 1, 1, RGBAFormat, UnsignedByteType)
    alphaMap.needsUpdate = true
    const material = new MeshStandardMaterial({
      alphaMap,
      alphaTest: 0.035,
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    })

    const classification = classifyOverdrawMaterial(material)
    expect(classification).toBe("alphaCutout")
    expect(overdrawWritesDepthPrepass(material, classification)).toBe(false)
    expect(overdrawParticipatesInCounter(material, classification)).toBe(true)
  })

  it("counts alphaHash-only foliage as a counter contributor", () => {
    const material = new MeshStandardMaterial({ alphaHash: true })
    const classification = classifyOverdrawMaterial(material)
    expect(classification).toBe("alphaCutout")
    expect(overdrawParticipatesInCounter(material, classification)).toBe(true)
  })

  it("classifies stacked glass as transparentContributor", () => {
    const material = new MeshStandardMaterial({ transparent: true, opacity: 0.35 })
    const classification = classifyOverdrawMaterial(material)
    expect(classification).toBe("transparentContributor")
    expect(overdrawWritesDepthPrepass(material, classification)).toBe(false)
    expect(overdrawParticipatesInCounter(material, classification)).toBe(true)
  })

  it("normalizes and denormalizes layer counts", () => {
    expect(normalizeLayerCount(4)).toBeCloseTo(0.25)
    expect(denormalizeLayerCount(0.25)).toBe(4)
    expect(denormalizeLayerCount(1)).toBe(16)
  })
})

describe("measured overdraw override fixtures", () => {
  function createStackedQuadsScene(layerCount: number) {
    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 5
    camera.lookAt(0, 0, 0)

    for (let index = 0; index < layerCount; index++) {
      const material = new MeshBasicMaterial({
        opacity: 0.5,
        transparent: true,
      })
      const mesh = new Mesh(new PlaneGeometry(2, 2), material)
      mesh.position.z = -index * 0.01
      scene.add(mesh)
    }

    return { scene, camera }
  }

  it("hides opaque blockers from counter pass", () => {
    const scene = new Scene()
    const blocker = new Mesh(
      new BoxGeometry(2, 2, 0.2),
      new MeshStandardMaterial(),
    )
    const foliage = new Mesh(
      new PlaneGeometry(2, 2),
      new MeshStandardMaterial({ transparent: true, opacity: 0.5 }),
    )
    foliage.position.z = 0.2

    scene.add(blocker, foliage)
    const override = createMeasuredOverdrawOverride()

    const counterRestore = override.applyCounter(scene)
    expect(blocker.visible).toBe(false)
    expect(foliage.visible).toBe(true)

    counterRestore.restore()

    const prepassRestore = override.applyDepthPrepass(scene)
    expect(blocker.visible).toBe(true)
    const blockerMaterial = blocker.material as unknown as MeshBasicMaterial
    expect(blockerMaterial.colorWrite).toBe(false)
    prepassRestore.restore()
    override.dispose()
  })

  it("expects stacked transparent quads to participate in counter pass", () => {
    const { scene } = createStackedQuadsScene(4)
    const override = createMeasuredOverdrawOverride()
    const restore = override.applyCounter(scene)

    const visibleMeshes = scene.children.filter((child) => (child as Mesh).visible)
    expect(visibleMeshes).toHaveLength(4)
    for (const mesh of visibleMeshes) {
      const material = (mesh as Mesh).material as MeshBasicMaterial
      expect(material.transparent).toBe(true)
      expect(material.depthTest).toBe(true)
      expect(material.depthWrite).toBe(false)
    }

    restore.restore()
    override.dispose()
  })
})
