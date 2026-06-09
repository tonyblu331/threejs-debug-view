import { NodeMaterial } from "three/webgpu"
import { float, Fn, length, positionWorld, uniform, vec3, vec4 } from "three/tsl"
import { DEFAULT_MAX_DISPLAY_LIGHTS } from "./light-classification"
import { createLightComplexitySync } from "./light-complexity-sync"
import type { CountableLightSnapshot } from "./light-classification"

const LIGHT_TYPE_POINT = 0
const LIGHT_TYPE_SPOT = 1
const LIGHT_TYPE_RECT = 2

export interface LightComplexityHandle {
  material: NodeMaterial
  syncScene: (root: { traverse: (cb: (obj: unknown) => void) => void }) => void
  syncSceneIfDirty: (root: { traverse: (cb: (obj: unknown) => void) => void }) => boolean
  syncLights: (lights: readonly CountableLightSnapshot[]) => void
  invalidateScene: () => void
  dispose: () => void
}

export function createLightComplexityHandle(
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
): LightComplexityHandle {
  const material = new NodeMaterial()
  material.fog = false
  material.lights = false
  material.toneMapped = false
  material.depthTest = true
  material.depthWrite = true

  const slots = Array.from({ length: maxDisplayLights }, () => ({
    position: uniform(vec3(0, 0, 0)),
    range: uniform(float(0)),
    lightType: uniform(float(LIGHT_TYPE_POINT)),
    direction: uniform(vec3(0, 0, -1)),
    angleCos: uniform(float(-1)),
    rectRange: uniform(float(0)),
  }))

  material.colorNode = Fn(() => {
    const worldPosition = positionWorld
    const count = float(0).toVar("lightComplexityCount")

    for (const slot of slots) {
      const toLight = slot.position.sub(worldPosition)
      const distance = length(toLight)
      const inRange = distance.lessThanEqual(slot.range)
      const active = slot.range.greaterThan(float(0))

      const pointContrib = inRange.select(float(1), float(0))

      const lightVector = toLight.normalize().negate()
      const coneMatch = lightVector.dot(slot.direction).greaterThanEqual(slot.angleCos)
      const spotContrib = inRange.and(coneMatch).select(float(1), float(0))

      const rectMatch = distance.lessThanEqual(slot.rectRange)
      const rectContrib = rectMatch.select(float(1), float(0))

      const isPoint = slot.lightType.equal(float(LIGHT_TYPE_POINT))
      const isSpot = slot.lightType.equal(float(LIGHT_TYPE_SPOT))
      const contrib = isPoint.select(
        pointContrib,
        isSpot.select(spotContrib, rectContrib),
      )

      count.addAssign(active.select(contrib, float(0)))
    }

    return vec4(count.div(float(maxDisplayLights)), float(0), float(0), float(1))
  })()

  const sync = createLightComplexitySync(
    slots as Parameters<typeof createLightComplexitySync>[0],
    maxDisplayLights,
  )

  return {
    material,
    syncScene: sync.syncScene,
    syncSceneIfDirty: sync.syncSceneIfDirty,
    syncLights: sync.syncLights,
    invalidateScene: sync.invalidateScene,
    dispose() {
      sync.dispose()
      material.dispose()
    },
  }
}

export function createLightComplexityMaterial(
  lights: readonly CountableLightSnapshot[],
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
) {
  const handle = createLightComplexityHandle(maxDisplayLights)
  handle.syncLights(lights.slice(0, maxDisplayLights))
  return handle.material
}

export function createLightComplexityMaterialFromScene(
  scene: { traverse: (cb: (obj: unknown) => void) => void },
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
) {
  const handle = createLightComplexityHandle(maxDisplayLights)
  handle.syncScene(scene)
  return handle.material
}
