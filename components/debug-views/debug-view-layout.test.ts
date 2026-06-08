import { describe, expect, it } from "vitest"
import { resolveDebugViewLayout } from "./debug-view-layout"
import { DEFAULT_DEBUG_VIEWS } from "./debug-view-definitions"
import { selectPipelineViews } from "./debug-view-selection"

describe("debug view layout", () => {
  it("resolves row layouts from a slot count", () => {
    expect(resolveDebugViewLayout("row", { slots: 4 })).toMatchObject({
      mode: "row",
      presentation: "grid",
      columns: 4,
      rows: 1,
      slots: 4,
    })

    expect(resolveDebugViewLayout("row", { slots: 3 })).toMatchObject({
      columns: 3,
      rows: 1,
      slots: 3,
    })
  })

  it("supports paneCount as the public alias for layout slots", () => {
    expect(resolveDebugViewLayout("row", { paneCount: 4 })).toMatchObject({
      mode: "row",
      presentation: "grid",
      columns: 4,
      rows: 1,
      slots: 4,
    })

    expect(resolveDebugViewLayout("column", { paneCount: 3 })).toMatchObject({
      mode: "column",
      presentation: "grid",
      columns: 1,
      rows: 3,
      slots: 3,
    })

    expect(resolveDebugViewLayout("row", { paneCount: 4, slots: 2 })).toMatchObject({
      columns: 4,
      rows: 1,
      slots: 4,
    })

    expect(resolveDebugViewLayout({ mode: "row", slots: 2 }, { paneCount: 4 })).toMatchObject({
      columns: 4,
      rows: 1,
      slots: 4,
    })
  })

  it("keeps slots as a compatibility alias", () => {
    expect(resolveDebugViewLayout("grid", { columns: 3, rows: 2, slots: 4 })).toMatchObject({
      mode: "grid",
      presentation: "grid",
      columns: 3,
      rows: 2,
      slots: 4,
    })
  })

  it("does not let undefined prop options erase layout config values", () => {
    expect(
      resolveDebugViewLayout(
        { mode: "row", slots: 3 },
        { slots: undefined, columns: undefined, rows: undefined },
      ),
    ).toMatchObject({
      columns: 3,
      rows: 1,
      slots: 3,
    })
  })

  it("resolves column and explicit grid layouts", () => {
    expect(resolveDebugViewLayout("column", { slots: 3 })).toMatchObject({
      mode: "column",
      presentation: "grid",
      columns: 1,
      rows: 3,
      slots: 3,
    })

    expect(resolveDebugViewLayout("grid", { columns: 4, rows: 1 })).toMatchObject({
      mode: "grid",
      presentation: "grid",
      columns: 4,
      rows: 1,
      slots: 4,
    })
  })

  it("keeps legacy presets as resolved topologies", () => {
    expect(resolveDebugViewLayout("split-h")).toMatchObject({ columns: 2, rows: 1, slots: 2 })
    expect(resolveDebugViewLayout("split-v")).toMatchObject({ columns: 1, rows: 2, slots: 2 })
    expect(resolveDebugViewLayout("split-diagonal")).toMatchObject({
      presentation: "diagonal",
      columns: 2,
      rows: 1,
      slots: 2,
      diagonalAngle: 24,
    })
    expect(resolveDebugViewLayout("breakdown")).toMatchObject({
      presentation: "breakdown",
      columns: 4,
      rows: 1,
      slots: 4,
      diagonalAngle: 25,
    })
    expect(resolveDebugViewLayout("quad")).toMatchObject({ columns: 2, rows: 2, slots: 4 })
  })

  it("clamps diagonal split angle to a safe default max unless overridden", () => {
    expect(resolveDebugViewLayout("split-diagonal", { diagonalAngle: 80 })).toMatchObject({
      diagonalAngle: 45,
    })

    expect(
      resolveDebugViewLayout("split-diagonal", { diagonalAngle: 80, maxDiagonalAngle: 60 }),
    ).toMatchObject({
      diagonalAngle: 60,
    })
  })

  it("clamps slots to the resolved topology cell count", () => {
    expect(resolveDebugViewLayout("overlay")).toMatchObject({
      columns: 1,
      rows: 1,
      slots: 1,
    })

    expect(resolveDebugViewLayout("grid", { columns: 3, rows: 2, slots: 99 })).toMatchObject({
      columns: 3,
      rows: 2,
      slots: 6,
    })
  })

  it("selects only the visible slot budget for row layouts", () => {
    expect(
      selectPipelineViews(DEFAULT_DEBUG_VIEWS, 0, { mode: "row", slots: 4 }).map(
        (view) => view.source,
      ),
    ).toEqual(["beauty", "normal", "depth", "albedo"])
  })

  it("selects two views for diagonal split layouts", () => {
    expect(
      selectPipelineViews(DEFAULT_DEBUG_VIEWS, 0, "split-diagonal").map(
        (view) => view.source,
      ),
    ).toEqual(["beauty", "normal"])
  })

  it("selects four views for breakdown layouts", () => {
    expect(
      selectPipelineViews(DEFAULT_DEBUG_VIEWS, 0, "breakdown").map(
        (view) => view.source,
      ),
    ).toEqual(["beauty", "normal", "depth", "albedo"])
  })
})
