import { describe, expect, it } from "vitest"
import { getDebugDemoPreset, getDebugE2ePreset, getSocialCapturePreset } from "./debug-e2e-presets"

describe("debug e2e presets", () => {
  it("returns social capture preset from capture=social", () => {
    const preset = getSocialCapturePreset()
    expect(preset).toBeNull()

    const fromQuery = getDebugDemoPreset("?capture=social")
    expect(fromQuery?.layout).toBe("breakdown")
    expect(fromQuery?.showLeva).toBe(false)
    expect(fromQuery?.viewportViews?.map((view) => view.view)).toEqual([
      "normal",
      "shaderCost",
      "albedo",
      "depth",
    ])
  })

  it("returns viewport-scaled preset from e2e=viewport-scaled", () => {
    const preset = getDebugE2ePreset("?e2e=viewport-scaled")
    expect(preset?.layout).toBe("split-h")
    expect(preset?.showLeva).toBe(false)
    expect(preset?.viewportViews).toEqual([
      { view: "beauty", label: "Beauty" },
      { view: "normal", label: "Normals", resolutionScale: 0.5 },
    ])
  })

  it("returns breakdown label visibility presets", () => {
    expect(getDebugE2ePreset("?e2e=breakdown-labels-on")?.showLabels).toBe(true)
    expect(getDebugE2ePreset("?e2e=breakdown-labels-off")?.showLabels).toBe(false)
    expect(getDebugE2ePreset("?e2e=overlap-no-legends")?.showLegends).toBe(false)
  })

  it("prefers social capture over e2e query params", () => {
    const preset = getDebugDemoPreset("?capture=social&e2e=viewport-scaled")
    expect(preset?.layout).toBe("breakdown")
  })
})
