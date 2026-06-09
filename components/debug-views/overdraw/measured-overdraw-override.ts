import {
  AddEquation,
  CustomBlending,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OneFactor,
  type Scene,
  type Texture,
} from "three"
import {
  classifyOverdrawMaterial,
  DEFAULT_MAX_DISPLAY_LAYERS,
  overdrawParticipatesInCounter,
  overdrawWritesDepthPrepass,
  type OverdrawMaterialClass,
} from "./overdraw-classification"

export interface MeasuredOverdrawOverride {
  applyDepthPrepass(scene: Scene | Object3D): MeasuredOverdrawRestore
  applyCounter(scene: Scene | Object3D): MeasuredOverdrawRestore
  dispose(): void
}

export interface MeasuredOverdrawRestore {
  restore(): void
  readonly replacements: number
}

type MeshMaterial = Material | Material[]

interface OriginalMaterialEntry {
  mesh: Mesh
  material: MeshMaterial
  visible: boolean
}

const OPAQUE_KEY = "opaque"
const HIDDEN_KEY = "hidden"

export function createMeasuredOverdrawOverride(
  maxDisplayLayers = DEFAULT_MAX_DISPLAY_LAYERS,
): MeasuredOverdrawOverride {
  const depthMaterials = new Map<string, MeshBasicMaterial>()
  const counterMaterials = new Map<string, MeshBasicMaterial>()
  const layerIncrement = 1 / maxDisplayLayers

  return {
    applyDepthPrepass(scene) {
      return applyMeasuredOverride(scene, depthMaterials, (material) => {
        const classification = classifyOverdrawMaterial(material)
        if (!overdrawWritesDepthPrepass(material, classification)) {
          return { material: getHiddenMaterial(depthMaterials), visible: false }
        }

        return {
          material: getDepthPrepassMaterial(material, classification, depthMaterials),
          visible: true,
        }
      })
    },
    applyCounter(scene) {
      return applyMeasuredOverride(scene, counterMaterials, (material) => {
        const classification = classifyOverdrawMaterial(material)
        if (!overdrawParticipatesInCounter(material, classification)) {
          return { material: getHiddenMaterial(counterMaterials), visible: false }
        }

        return {
          material: getCounterMaterial(material, classification, counterMaterials, layerIncrement),
          visible: true,
        }
      })
    },
    dispose() {
      disposeMaterialCache(depthMaterials)
      disposeMaterialCache(counterMaterials)
    },
  }
}

function applyMeasuredOverride(
  scene: Scene | Object3D,
  materials: Map<string, MeshBasicMaterial>,
  replace: (
    material: Material,
  ) => { material: MeshMaterial, visible: boolean },
): MeasuredOverdrawRestore {
  const originals: OriginalMaterialEntry[] = []

  scene.traverse((object) => {
    if (!isMeshWithMaterial(object)) return

    originals.push({
      mesh: object,
      material: object.material,
      visible: object.visible,
    })

    const replacement = replaceMaterial(object.material, materials, replace)
    object.material = replacement.material
    object.visible = replacement.visible
  })

  let restored = false

  return {
    restore() {
      if (restored) return

      for (const entry of originals) {
        entry.mesh.material = entry.material
        entry.mesh.visible = entry.visible
      }

      restored = true
    },
    get replacements() {
      return originals.length
    },
  }
}

function replaceMaterial(
  material: MeshMaterial,
  materials: Map<string, MeshBasicMaterial>,
  replace: (material: Material) => { material: MeshMaterial, visible: boolean },
): { material: MeshMaterial, visible: boolean } {
  if (Array.isArray(material)) {
    let visible = false
    const replacements = material.map((entry) => {
      const result = replace(entry)
      visible ||= result.visible
      return result.material
    })

    return { material: replacements as MeshMaterial, visible }
  }

  return replace(material)
}

function getDepthPrepassMaterial(
  material: Material,
  classification: OverdrawMaterialClass,
  materials: Map<string, MeshBasicMaterial>,
) {
  const alphaMap = getMaterialProperty<Texture | null>(material, "alphaMap")
  const alphaTest = Math.max(getMaterialAlphaTest(material), alphaMap ? 0.001 : 0)
  const key = [
    "depth",
    classification,
    alphaMap?.uuid ?? OPAQUE_KEY,
    alphaTest,
    material.side,
  ].join(":")
  const existing = materials.get(key)
  if (existing) return existing

  const replacement = new MeshBasicMaterial({
    alphaMap,
    alphaTest,
    color: 0x000000,
    colorWrite: false,
    depthTest: true,
    depthWrite: true,
    name: `MeasuredOverdraw:depth:${key}`,
    side: material.side,
    toneMapped: false,
    transparent: classification === "alphaCutout" && alphaTest > 0,
  })

  replacement.alphaHash = getMaterialProperty(material, "alphaHash") === true
  materials.set(key, replacement)
  return replacement
}

function getCounterMaterial(
  material: Material,
  classification: OverdrawMaterialClass,
  materials: Map<string, MeshBasicMaterial>,
  layerIncrement: number,
) {
  const alphaMap = getMaterialProperty<Texture | null>(material, "alphaMap")
  const alphaTest = Math.max(getMaterialAlphaTest(material), alphaMap ? 0.001 : 0)
  const key = [
    "counter",
    classification,
    alphaMap?.uuid ?? OPAQUE_KEY,
    alphaTest,
    material.side,
    layerIncrement,
  ].join(":")
  const existing = materials.get(key)
  if (existing) return existing

  const replacement = new MeshBasicMaterial({
    alphaMap,
    alphaTest,
    blendDst: OneFactor,
    blendDstAlpha: OneFactor,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendSrcAlpha: OneFactor,
    blending: CustomBlending,
    color: 0xffffff,
    depthTest: true,
    depthWrite: false,
    name: `MeasuredOverdraw:counter:${key}`,
    opacity: layerIncrement,
    premultipliedAlpha: true,
    side: material.side,
    toneMapped: false,
    transparent: true,
  })

  replacement.alphaHash = getMaterialProperty(material, "alphaHash") === true
  materials.set(key, replacement)
  return replacement
}

function getHiddenMaterial(materials: Map<string, MeshBasicMaterial>) {
  const existing = materials.get(HIDDEN_KEY)
  if (existing) return existing

  const material = new MeshBasicMaterial({
    color: 0x000000,
    depthTest: false,
    depthWrite: false,
    name: "MeasuredOverdraw:hidden",
    opacity: 0,
    toneMapped: false,
    transparent: true,
  })

  materials.set(HIDDEN_KEY, material)
  return material
}

function disposeMaterialCache(materials: Map<string, MeshBasicMaterial>) {
  for (const material of materials.values()) {
    material.dispose()
  }
  materials.clear()
}

function getMaterialAlphaTest(material: Material) {
  return typeof material.alphaTest === "number" ? material.alphaTest : 0
}

function getMaterialProperty<T>(material: Material, property: string): T | undefined {
  return (material as unknown as Record<string, T>)[property]
}

function isMeshWithMaterial(object: Object3D): object is Mesh {
  return Boolean((object as Mesh).isMesh && (object as Mesh).material)
}
