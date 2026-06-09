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

export function collectCountableLights(root: { traverse: (cb: (obj: unknown) => void) => void }) {
  const lights: CountableLightSnapshot[] = []

  root.traverse((object) => {
    const light = object as Light
    if (!light.isLight || isExcludedGlobalLight(light) || !isCountableLight(light)) {
      return
    }

    light.updateWorldMatrix(true, false)
    const position = new Vector3()
    light.getWorldPosition(position)

    if ((light as PointLight).isPointLight) {
      const point = light as PointLight
      lights.push({
        type: "point",
        position: { x: position.x, y: position.y, z: position.z },
        distance: point.distance,
        decay: point.decay,
      })
      return
    }

    if ((light as SpotLight).isSpotLight) {
      const spot = light as SpotLight
      const target = new Vector3()
      spot.target.getWorldPosition(target)
      const direction = target.clone().sub(position).normalize()

      lights.push({
        type: "spot",
        position: { x: position.x, y: position.y, z: position.z },
        distance: spot.distance,
        decay: spot.decay,
        angleCos: Math.cos(spot.angle * 0.5),
        direction: { x: direction.x, y: direction.y, z: direction.z },
      })
      return
    }

    const rect = light as RectAreaLight
    lights.push({
      type: "rectArea",
      position: { x: position.x, y: position.y, z: position.z },
      distance: Math.max(rect.width, rect.height) * 1.5,
      decay: 1,
      width: rect.width,
      height: rect.height,
    })
  })

  return lights
}
