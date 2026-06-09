import { describe, expect, it, vi } from "vitest"
import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from "three"
import { createOverdrawOverride } from "../overdraw/overdraw-override"
import { createShaderCostOverride } from "../shader-cost/cost-override"

describe("mesh override session", () => {
  it("reuses cached mesh entries across apply calls for overdraw", () => {
    const scene = new Scene()
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ transparent: true, opacity: 0.5 }))
    scene.add(mesh)

    const override = createOverdrawOverride()
    override.prepare(scene)

    const traverse = vi.spyOn(scene, "traverse")
    traverse.mockClear()

    const first = override.apply(scene)
    first.restore()

    expect(traverse).not.toHaveBeenCalled()

    const second = override.apply(scene)
    second.restore()

    expect(traverse).not.toHaveBeenCalled()
    traverse.mockRestore()
    override.dispose()
  })

  it("reuses cached mesh entries across apply calls for shader cost", () => {
    const scene = new Scene()
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    scene.add(mesh)

    const override = createShaderCostOverride({ bucketCount: 4 })
    override.prepare(scene)

    const traverse = vi.spyOn(scene, "traverse")
    traverse.mockClear()

    const first = override.apply(scene)
    first.restore()

    expect(traverse).not.toHaveBeenCalled()

    const second = override.apply(scene)
    second.restore()

    expect(traverse).not.toHaveBeenCalled()
    traverse.mockRestore()
    override.dispose()
  })
})
