import { describe, expect, it, vi } from "vitest"
import { PointLight, Scene } from "three"
import { createLightComplexityHandle } from "./light-complexity-material"

describe("light complexity sync", () => {
  it("skips uniform writes when tracked lights are unchanged", () => {
    const scene = new Scene()
    const point = new PointLight(0xffffff, 1, 4)
    point.position.set(1, 2, 3)
    scene.add(point)

    const handle = createLightComplexityHandle()
    handle.syncScene(scene)

    const root = {
      traverse: vi.fn((callback: (obj: unknown) => void) => scene.traverse(callback)),
    }

    expect(handle.syncSceneIfDirty(root)).toBe(false)
    expect(root.traverse).not.toHaveBeenCalled()

    point.position.set(4, 5, 6)
    expect(handle.syncSceneIfDirty(root)).toBe(true)

    handle.dispose()
  })

  it("rescans the scene graph on a timer to pick up added lights", () => {
    const scene = new Scene()
    const first = new PointLight(0xffffff, 1, 4)
    scene.add(first)

    const handle = createLightComplexityHandle()
    handle.syncScene(scene)

    const second = new PointLight(0xffffff, 1, 3)
    scene.add(second)

    for (let frame = 0; frame < 30; frame += 1) {
      expect(handle.syncSceneIfDirty(scene)).toBe(false)
    }

    expect(handle.syncSceneIfDirty(scene)).toBe(true)
    handle.dispose()
  })
})
