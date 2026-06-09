import { describe, expect, it } from "vitest"
import {
  AmbientLight,
  DirectionalLight,
  PointLight,
  Scene,
  SpotLight,
} from "three"
import { createLightComplexityHandle } from "./light-complexity-material"
import {
  collectCountableLights,
  isCountableLight,
  isExcludedGlobalLight,
} from "./light-classification"

describe("light classification", () => {
  it("excludes global lights from counting", () => {
    expect(isExcludedGlobalLight(new DirectionalLight())).toBe(true)
    expect(isExcludedGlobalLight(new AmbientLight())).toBe(true)
    expect(isCountableLight(new PointLight())).toBe(true)
  })

  it("collects point and spot lights from the scene graph", () => {
    const scene = new Scene()
    scene.add(new AmbientLight())
    scene.add(new DirectionalLight())
    scene.add(new PointLight(0xffffff, 1, 4))
    const spot = new SpotLight(0xffffff, 1, 6, Math.PI / 6)
    spot.position.set(0, 2, 0)
    spot.target.position.set(0, 0, -2)
    scene.add(spot)
    scene.add(spot.target)

    const lights = collectCountableLights(scene)
    expect(lights).toHaveLength(2)
    expect(lights[0]?.type).toBe("point")
    expect(lights[1]?.type).toBe("spot")
    expect(lights[1]?.angleCos).toBeCloseTo(Math.cos(Math.PI / 12), 5)
    expect(lights[1]?.direction).toBeDefined()
    const spotSnapshot = lights[1]!
    const toFragment = { x: 0, y: -1, z: -2 }
    const axis = spotSnapshot.direction!
    const dot = toFragment.x * axis.x + toFragment.y * axis.y + toFragment.z * axis.z
    expect(dot).toBeGreaterThan(0)
  })
})

describe("light complexity material", () => {
  it("reuses one material and syncs light uniforms from the scene", () => {
    const scene = new Scene()
    const point = new PointLight(0xffffff, 1, 4)
    point.position.set(1, 2, 3)
    scene.add(point)

    const handle = createLightComplexityHandle()
    const material = handle.material

    handle.syncScene(scene)
    expect(handle.material).toBe(material)

    point.position.set(4, 5, 6)
    expect(handle.syncSceneIfDirty(scene)).toBe(true)
    expect(handle.material).toBe(material)

    expect(handle.syncSceneIfDirty(scene)).toBe(false)
    handle.dispose()
  })
})
