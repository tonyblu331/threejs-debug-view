import { describe, expect, it } from "vitest"
import { decodeHeatmapCost, encodeHeatmapCost } from "./heatmap-decode"

describe("heatmap decode", () => {
  it("round-trips encoded heatmap costs in the yellow-to-red range", () => {
    for (const cost of [0.5, 0.75, 0.95, 1]) {
      const [r, g, b] = encodeHeatmapCost(cost)
      expect(decodeHeatmapCost(r, g, b)).toBeCloseTo(cost, 1)
    }
  })

  it("maps flat green-region colors to low cost", () => {
    const [r, g, b] = encodeHeatmapCost(0.05)
    expect(decodeHeatmapCost(r, g, b)).toBeGreaterThan(0)
    expect(decodeHeatmapCost(r, g, b)).toBeLessThan(0.26)
  })

  it("returns zero for black pixels", () => {
    expect(decodeHeatmapCost(0, 0, 0)).toBe(0)
  })
})
