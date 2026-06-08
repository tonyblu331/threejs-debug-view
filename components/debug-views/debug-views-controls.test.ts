import { describe, expect, it } from "vitest"
import {
  createPaneAssignmentsKey,
  createViewportViews,
  getVisiblePaneCountForLayout,
  isPaneAssignmentLayout,
} from "./debug-views-controls"

describe("debug views controls", () => {
  it("detects pane-assignment layouts", () => {
    expect(isPaneAssignmentLayout("single")).toBe(false)
    expect(isPaneAssignmentLayout("overlay")).toBe(false)
    expect(isPaneAssignmentLayout("split-h")).toBe(true)
    expect(isPaneAssignmentLayout("breakdown")).toBe(true)
    expect(isPaneAssignmentLayout("grid")).toBe(true)
  })

  it("returns visible pane counts per layout", () => {
    expect(getVisiblePaneCountForLayout("single", 4)).toBe(1)
    expect(getVisiblePaneCountForLayout("overlay", 4)).toBe(2)
    expect(getVisiblePaneCountForLayout("breakdown", 4)).toBe(4)
    expect(getVisiblePaneCountForLayout("grid", 3)).toBe(3)
    expect(getVisiblePaneCountForLayout("grid", undefined)).toBe(4)
  })

  it("builds viewport views from pane control values", () => {
    const values = {
      pane1: 2,
      pane2: 0,
      pane3: "ignored",
    }

    expect(createViewportViews(values, 2)).toEqual([
      { view: 2 },
      { view: 0 },
    ])
  })

  it("creates stable pane assignment keys", () => {
    expect(createPaneAssignmentsKey({ pane1: 1, pane2: 3 }, 2)).toBe("1|3")
    expect(createPaneAssignmentsKey({ pane1: 1, pane2: 3, pane3: 0 }, 3)).toBe("1|3|0")
  })
})
