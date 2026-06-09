import { NodeMaterial } from "three/webgpu"
import { float, Fn, length, positionWorld, uniform, vec3, vec4 } from "three/tsl"
import {
  collectCountableLights,
  DEFAULT_MAX_DISPLAY_LIGHTS,
  type CountableLightSnapshot,
} from "./light-classification"

export function createLightComplexityMaterial(
  lights: readonly CountableLightSnapshot[],
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
) {
  const material = new NodeMaterial()
  material.fog = false
  material.lights = false
  material.toneMapped = false
  material.depthTest = true
  material.depthWrite = true

  const activeLights = lights.slice(0, maxDisplayLights)
  const lightNodes = activeLights.map((light) => ({
    light,
    position: uniform(vec3(light.position.x, light.position.y, light.position.z)),
    range: uniform(float(light.distance > 0 ? light.distance : 1_000)),
    direction:
      light.type === "spot" && light.direction
        ? uniform(vec3(light.direction.x, light.direction.y, light.direction.z))
        : undefined,
    angleCos:
      light.type === "spot" && light.angleCos != null
        ? uniform(float(light.angleCos))
        : undefined,
    rectRange:
      light.type === "rectArea" && light.width && light.height
        ? uniform(float(Math.max(light.width, light.height) * 1.5))
        : undefined,
  }))

  material.colorNode = Fn(() => {
    const worldPosition = positionWorld
    const count = float(0).toVar("lightComplexityCount")

    for (const node of lightNodes) {
      const toLight = node.position.sub(worldPosition)
      const distance = length(toLight)
      const inRange = distance.lessThanEqual(node.range)

      if (node.light.type === "spot" && node.direction && node.angleCos) {
        const lightVector = toLight.normalize().negate()
        const coneMatch = lightVector.dot(node.direction).greaterThanEqual(node.angleCos)
        count.addAssign(inRange.and(coneMatch).select(float(1), float(0)))
        continue
      }

      if (node.light.type === "rectArea" && node.rectRange) {
        const rectMatch = distance.lessThanEqual(node.rectRange)
        count.addAssign(rectMatch.select(float(1), float(0)))
        continue
      }

      count.addAssign(inRange.select(float(1), float(0)))
    }

    return vec4(count.div(float(maxDisplayLights)), float(0), float(0), float(1))
  })()

  return material
}

export function createLightComplexityMaterialFromScene(
  scene: { traverse: (cb: (obj: unknown) => void) => void },
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
) {
  return createLightComplexityMaterial(collectCountableLights(scene), maxDisplayLights)
}
