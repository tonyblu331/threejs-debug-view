import {
  type PointLight,
  type RectAreaLight,
  type SpotLight,
  Vector3,
} from "three"
import { createSceneGraphRescanScheduler } from "../shared/scene-graph-cache"
import {
  DEFAULT_MAX_DISPLAY_LIGHTS,
  discoverCountableLights,
  type CountableLightSnapshot,
} from "./light-classification"

const LIGHT_TYPE_POINT = 0
const LIGHT_TYPE_SPOT = 1
const LIGHT_TYPE_RECT = 2

export interface LightComplexitySlotUniforms {
  position: { value: { set: (x: number, y: number, z: number) => void } }
  range: { value: number }
  lightType: { value: number }
  direction: { value: { set: (x: number, y: number, z: number) => void } }
  angleCos: { value: number }
  rectRange: { value: number }
}

interface TrackedLight {
  light: PointLight | SpotLight | RectAreaLight
  target: SpotLight["target"] | null
}

interface SlotFingerprint {
  active: boolean
  px: number
  py: number
  pz: number
  range: number
  lightType: number
  dx: number
  dy: number
  dz: number
  angleCos: number
  rectRange: number
}

const positionScratch = new Vector3()
const targetScratch = new Vector3()
const directionScratch = new Vector3()

export interface LightComplexitySync {
  syncScene: (root: { traverse: (cb: (obj: unknown) => void) => void }) => void
  syncSceneIfDirty: (root: { traverse: (cb: (obj: unknown) => void) => void }) => boolean
  syncLights: (lights: readonly CountableLightSnapshot[]) => void
  invalidateScene: () => void
  dispose: () => void
}

export function createLightComplexitySync(
  slots: readonly LightComplexitySlotUniforms[],
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
): LightComplexitySync {
  const fingerprints: SlotFingerprint[] = Array.from({ length: maxDisplayLights }, createEmptyFingerprint)
  let trackedLights: TrackedLight[] = []
  const scheduler = createSceneGraphRescanScheduler()

  const syncScene = (root: { traverse: (cb: (obj: unknown) => void) => void }) => {
    rescanTrackedLights(root)
    writeAllSlots(slots, trackedLights, fingerprints)
  }

  const syncSceneIfDirty = (root: { traverse: (cb: (obj: unknown) => void) => void }) => {
    if (shouldRescan(root)) {
      rescanTrackedLights(root)
      writeAllSlots(slots, trackedLights, fingerprints)
      return true
    }

    let dirty = false

    for (let index = 0; index < maxDisplayLights; index += 1) {
      const tracked = trackedLights[index]
      if (!tracked || tracked.light.parent == null) {
        if (fingerprints[index]!.active) {
          dirty = true
        }
        continue
      }

      if (fingerprintChanged(tracked, fingerprints[index]!)) {
        dirty = true
      }
    }

    if (!dirty) {
      return false
    }

    writeAllSlots(slots, trackedLights, fingerprints)
    return true
  }

  const syncLights = (lights: readonly CountableLightSnapshot[]) => {
    trackedLights = []
    scheduler.invalidate()

    for (let index = 0; index < maxDisplayLights; index += 1) {
      const light = lights[index]
      const fingerprint = fingerprints[index]!

      if (!light) {
        clearFingerprint(fingerprint)
        clearSlot(slots[index]!)
        continue
      }

      writeSnapshotToSlot(slots[index]!, light)
      writeSnapshotToFingerprint(fingerprint, light)
    }
  }

  return {
    syncScene,
    syncSceneIfDirty,
    syncLights,
    invalidateScene() {
      trackedLights = []
      scheduler.invalidate()
      for (const fingerprint of fingerprints) {
        clearFingerprint(fingerprint)
      }
    },
    dispose() {
      trackedLights = []
      scheduler.dispose()
    },
  }

  function shouldRescan(_root: { traverse: (cb: (obj: unknown) => void) => void }) {
    return scheduler.shouldRescan(trackedLights.map((tracked) => ({ parent: tracked.light.parent })))
  }

  function rescanTrackedLights(root: { traverse: (cb: (obj: unknown) => void) => void }) {
    trackedLights = discoverCountableLights(root)
      .slice(0, maxDisplayLights)
      .map((light) => ({
        light,
        target: (light as SpotLight).isSpotLight ? (light as SpotLight).target : null,
      }))
    scheduler.markRescanned()
  }
}

function writeAllSlots(
  slots: readonly LightComplexitySlotUniforms[],
  trackedLights: readonly TrackedLight[],
  fingerprints: SlotFingerprint[],
) {
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]!
    const fingerprint = fingerprints[index]!
    const tracked = trackedLights[index]

    if (!tracked || tracked.light.parent == null) {
      clearFingerprint(fingerprint)
      clearSlot(slot)
      continue
    }

    writeTrackedLightToSlot(slot, tracked)
    writeTrackedLightToFingerprint(tracked, fingerprint)
  }
}

function fingerprintChanged(tracked: TrackedLight, fingerprint: SlotFingerprint) {
  writeTrackedLightToFingerprint(tracked, probeFingerprint)
  return !fingerprintsEqual(probeFingerprint, fingerprint)
}

function fingerprintsEqual(a: SlotFingerprint, b: SlotFingerprint) {
  return (
    a.active === b.active
    && a.px === b.px
    && a.py === b.py
    && a.pz === b.pz
    && a.range === b.range
    && a.lightType === b.lightType
    && a.dx === b.dx
    && a.dy === b.dy
    && a.dz === b.dz
    && a.angleCos === b.angleCos
    && a.rectRange === b.rectRange
  )
}

function writeTrackedLightToSlot(slot: LightComplexitySlotUniforms, tracked: TrackedLight) {
  const light = tracked.light

  light.getWorldPosition(positionScratch)
  slot.position.value.set(positionScratch.x, positionScratch.y, positionScratch.z)

  if ((light as PointLight).isPointLight) {
    const point = light as PointLight
    slot.lightType.value = LIGHT_TYPE_POINT
    slot.range.value = point.distance > 0 ? point.distance : 1_000
    slot.angleCos.value = -1
    slot.rectRange.value = 0
    return
  }

  if ((light as SpotLight).isSpotLight) {
    const spot = light as SpotLight
    tracked.target?.getWorldPosition(targetScratch)
    directionScratch.copy(targetScratch).sub(positionScratch).normalize()

    slot.lightType.value = LIGHT_TYPE_SPOT
    slot.range.value = spot.distance > 0 ? spot.distance : 1_000
    slot.direction.value.set(directionScratch.x, directionScratch.y, directionScratch.z)
    slot.angleCos.value = Math.cos(spot.angle * 0.5)
    slot.rectRange.value = 0
    return
  }

  const rect = light as RectAreaLight
  slot.lightType.value = LIGHT_TYPE_RECT
  slot.range.value = Math.max(rect.width, rect.height) * 1.5
  slot.rectRange.value = Math.max(rect.width, rect.height) * 1.5
  slot.angleCos.value = -1
}

function writeTrackedLightToFingerprint(tracked: TrackedLight, fingerprint: SlotFingerprint) {
  const light = tracked.light

  light.getWorldPosition(positionScratch)
  fingerprint.active = true
  fingerprint.px = positionScratch.x
  fingerprint.py = positionScratch.y
  fingerprint.pz = positionScratch.z

  if ((light as PointLight).isPointLight) {
    const point = light as PointLight
    fingerprint.lightType = LIGHT_TYPE_POINT
    fingerprint.range = point.distance > 0 ? point.distance : 1_000
    fingerprint.dx = 0
    fingerprint.dy = 0
    fingerprint.dz = -1
    fingerprint.angleCos = -1
    fingerprint.rectRange = 0
    return
  }

  if ((light as SpotLight).isSpotLight) {
    const spot = light as SpotLight
    tracked.target?.getWorldPosition(targetScratch)
    directionScratch.copy(targetScratch).sub(positionScratch).normalize()

    fingerprint.lightType = LIGHT_TYPE_SPOT
    fingerprint.range = spot.distance > 0 ? spot.distance : 1_000
    fingerprint.dx = directionScratch.x
    fingerprint.dy = directionScratch.y
    fingerprint.dz = directionScratch.z
    fingerprint.angleCos = Math.cos(spot.angle * 0.5)
    fingerprint.rectRange = 0
    return
  }

  const rect = light as RectAreaLight
  const rectRange = Math.max(rect.width, rect.height) * 1.5
  fingerprint.lightType = LIGHT_TYPE_RECT
  fingerprint.range = rectRange
  fingerprint.dx = 0
  fingerprint.dy = 0
  fingerprint.dz = -1
  fingerprint.angleCos = -1
  fingerprint.rectRange = rectRange
}

function writeSnapshotToSlot(slot: LightComplexitySlotUniforms, light: CountableLightSnapshot) {
  slot.position.value.set(light.position.x, light.position.y, light.position.z)
  slot.range.value = light.distance > 0 ? light.distance : 1_000

  if (light.type === "spot" && light.direction && light.angleCos != null) {
    slot.lightType.value = LIGHT_TYPE_SPOT
    slot.direction.value.set(light.direction.x, light.direction.y, light.direction.z)
    slot.angleCos.value = light.angleCos
    slot.rectRange.value = 0
    return
  }

  if (light.type === "rectArea" && light.width && light.height) {
    slot.lightType.value = LIGHT_TYPE_RECT
    slot.rectRange.value = Math.max(light.width, light.height) * 1.5
    slot.angleCos.value = -1
    return
  }

  slot.lightType.value = LIGHT_TYPE_POINT
  slot.angleCos.value = -1
  slot.rectRange.value = 0
}

function writeSnapshotToFingerprint(fingerprint: SlotFingerprint, light: CountableLightSnapshot) {
  fingerprint.active = true
  fingerprint.px = light.position.x
  fingerprint.py = light.position.y
  fingerprint.pz = light.position.z
  fingerprint.range = light.distance > 0 ? light.distance : 1_000

  if (light.type === "spot" && light.direction && light.angleCos != null) {
    fingerprint.lightType = LIGHT_TYPE_SPOT
    fingerprint.dx = light.direction.x
    fingerprint.dy = light.direction.y
    fingerprint.dz = light.direction.z
    fingerprint.angleCos = light.angleCos
    fingerprint.rectRange = 0
    return
  }

  if (light.type === "rectArea" && light.width && light.height) {
    fingerprint.lightType = LIGHT_TYPE_RECT
    fingerprint.rectRange = Math.max(light.width, light.height) * 1.5
    fingerprint.dx = 0
    fingerprint.dy = 0
    fingerprint.dz = -1
    fingerprint.angleCos = -1
    return
  }

  fingerprint.lightType = LIGHT_TYPE_POINT
  fingerprint.dx = 0
  fingerprint.dy = 0
  fingerprint.dz = -1
  fingerprint.angleCos = -1
  fingerprint.rectRange = 0
}

function clearSlot(slot: LightComplexitySlotUniforms) {
  slot.range.value = 0
}

function clearFingerprint(fingerprint: SlotFingerprint) {
  fingerprint.active = false
  fingerprint.px = 0
  fingerprint.py = 0
  fingerprint.pz = 0
  fingerprint.range = 0
  fingerprint.lightType = LIGHT_TYPE_POINT
  fingerprint.dx = 0
  fingerprint.dy = 0
  fingerprint.dz = -1
  fingerprint.angleCos = -1
  fingerprint.rectRange = 0
}

function createEmptyFingerprint(): SlotFingerprint {
  return {
    active: false,
    px: 0,
    py: 0,
    pz: 0,
    range: 0,
    lightType: LIGHT_TYPE_POINT,
    dx: 0,
    dy: 0,
    dz: -1,
    angleCos: -1,
    rectRange: 0,
  }
}

const probeFingerprint = createEmptyFingerprint()
