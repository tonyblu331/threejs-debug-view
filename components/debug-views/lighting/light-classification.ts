import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  Light,
  PointLight,
  RectAreaLight,
  SpotLight,
  Vector3,
} from "three"

export type CountableLightType = "point" | "spot" | "rectArea"

export interface CountableLightSnapshot {
  type: CountableLightType
  position: { x: number; y: number; z: number }
  distance: number
  decay: number
  angleCos?: number
  direction?: { x: number; y: number; z: number }
  width?: number
  height?: number
}

export const DEFAULT_MAX_DISPLAY_LIGHTS = 8

export function isCountableLight(light: Light): light is PointLight | SpotLight | RectAreaLight {
  return (
    (light as PointLight).isPointLight === true ||
    (light as SpotLight).isSpotLight === true ||
    (light as RectAreaLight).isRectAreaLight === true
  )
}

export function isExcludedGlobalLight(light: Light) {
  return (
    (light as DirectionalLight).isDirectionalLight === true ||
    (light as AmbientLight).isAmbientLight === true ||
    (light as HemisphereLight).isHemisphereLight === true
  )
}

const positionScratch = new Vector3()
const targetScratch = new Vector3()
const directionScratch = new Vector3()

export function discoverCountableLights(
  root: { traverse: (cb: (obj: unknown) => void) => void },
): Array<PointLight | SpotLight | RectAreaLight> {
  const lights: Array<PointLight | SpotLight | RectAreaLight> = []

  root.traverse((object) => {
    const light = object as Light
    if (!light.isLight || isExcludedGlobalLight(light) || !isCountableLight(light)) {
      return
    }

    lights.push(light)
  })

  return lights
}

export function collectCountableLights(root: { traverse: (cb: (obj: unknown) => void) => void }) {
  const lights: CountableLightSnapshot[] = []

  for (const light of discoverCountableLights(root)) {
    light.getWorldPosition(positionScratch)

    if ((light as PointLight).isPointLight) {
      const point = light as PointLight
      lights.push({
        type: "point",
        position: { x: positionScratch.x, y: positionScratch.y, z: positionScratch.z },
        distance: point.distance,
        decay: point.decay,
      })
      continue
    }

    if ((light as SpotLight).isSpotLight) {
      const spot = light as SpotLight
      spot.target.getWorldPosition(targetScratch)
      directionScratch.copy(targetScratch).sub(positionScratch).normalize()

      lights.push({
        type: "spot",
        position: { x: positionScratch.x, y: positionScratch.y, z: positionScratch.z },
        distance: spot.distance,
        decay: spot.decay,
        angleCos: Math.cos(spot.angle * 0.5),
        direction: { x: directionScratch.x, y: directionScratch.y, z: directionScratch.z },
      })
      continue
    }

    const rect = light as RectAreaLight
    lights.push({
      type: "rectArea",
      position: { x: positionScratch.x, y: positionScratch.y, z: positionScratch.z },
      distance: Math.max(rect.width, rect.height) * 1.5,
      decay: 1,
      width: rect.width,
      height: rect.height,
    })
  }

  return lights
}
