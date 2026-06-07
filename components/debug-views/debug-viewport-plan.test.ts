import { describe, expect, it } from "vitest"
import { float } from "three/tsl"
import { DEFAULT_DEBUG_VIEWS } from "./debug-view-definitions"
import { createCustomDebugView } from "./custom-debug-view"
import { createDebugViewportPlan } from "./debug-viewport-plan"
import { createDebugViewportRenderGraphPlan } from "./debug-render-graph-plan"

describe("debug viewport plan", () => {
  it("keeps explicit viewport assignments in presentation order", () => {
    const plan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [
        { view: "beauty", label: "Beauty main" },
        { view: "lightingOnly", label: "Lighting" },
        { view: "normal", resolutionScale: 0.5 },
      ],
      layout: { mode: "row", slots: 3 },
    })

    expect(plan.layout).toMatchObject({ columns: 3, rows: 1, slots: 3 })
    expect(plan.views.map((view) => view.source)).toEqual(["beauty", "lightingOnly", "normal"])
    expect(plan.views.map((view) => view.label)).toEqual(["Beauty main", "Lighting", "Normal"])
    expect(plan.cells.map((cell) => cell.resolutionScale)).toEqual([1, 1, 0.5])
  })

  it("creates one render pass per viewport cell", () => {
    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [
        { view: "beauty", label: "A" },
        { view: "beauty", label: "B" },
        { view: "normal", label: "N" },
      ],
      layout: { mode: "row", slots: 3 },
    })

    const graph = createDebugViewportRenderGraphPlan(viewportPlan)

    expect(graph.passes.map((pass) => pass.view.source)).toEqual(["beauty", "beauty", "normal"])
    expect(graph.cells.map((cell) => cell.passIndex)).toEqual([0, 1, 2])
  })

  it("falls back to visible layout views when viewport assignments are omitted", () => {
    const plan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      activeView: 5,
      layout: "single",
    })

    expect(plan.views.map((view) => view.source)).toEqual(["emissive"])
  })

  it("clamps fallback viewport views to the resolved topology", () => {
    const plan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      activeView: 1,
      layout: "overlay",
    })

    expect(plan.layout).toMatchObject({ columns: 1, rows: 1, slots: 1 })
    expect(plan.cells).toHaveLength(1)
    expect(plan.views.map((view) => view.source)).toEqual(["beauty"])
  })

  it("quantizes viewport resolution scales for predictable render target reuse", () => {
    const plan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [
        { view: "beauty", resolutionScale: 0.8 },
        { view: "normal", resolutionScale: 0.4 },
        { view: "roughness", resolutionScale: 0.1 },
      ],
      layout: { mode: "row", slots: 3 },
    })

    expect(plan.cells.map((cell) => cell.resolutionScale)).toEqual([1, 0.5, 0.25])
  })

  it("does not create viewport cells beyond the resolved topology", () => {
    const plan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [{ view: "beauty" }, { view: "normal" }],
      layout: "overlay",
    })

    expect(plan.layout).toMatchObject({ columns: 1, rows: 1, slots: 1 })
    expect(plan.cells).toHaveLength(1)
    expect(plan.views.map((view) => view.source)).toEqual(["beauty"])
  })

  it("keeps resolution scale in render signatures", () => {
    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [
        { view: "normal", resolutionScale: 1 },
        { view: "normal", resolutionScale: 0.5 },
      ],
      layout: { mode: "row", slots: 2 },
    })

    const graph = createDebugViewportRenderGraphPlan(viewportPlan)

    expect(graph.passes.map((pass) => pass.resolutionScale)).toEqual([1, 0.5])
    expect(graph.cells.map((cell) => cell.passIndex)).toEqual([0, 1])
  })

  it("keeps depth visualization scale and bias in render signatures", () => {
    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [
        { view: { label: "Depth near", source: "depth", mode: "depth", scale: 1 } },
        { view: { label: "Depth far", source: "depth", mode: "depth", scale: 10 } },
        { view: { label: "Depth biased", source: "depth", mode: "depth", scale: 1, bias: 0.1 } },
      ],
      layout: { mode: "row", slots: 3 },
    })

    const graph = createDebugViewportRenderGraphPlan(viewportPlan)

    expect(graph.passes).toHaveLength(3)
    expect(graph.cells.map((cell) => cell.passIndex)).toEqual([0, 1, 2])
  })

  it("keeps repeated custom node identities in separate viewport passes", () => {
    const node = float(1)
    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [
        { view: { label: "Custom A", node, mode: "depth" } },
        { view: { label: "Custom B", node, mode: "depth" } },
      ],
      layout: { mode: "row", slots: 2 },
    })

    const graph = createDebugViewportRenderGraphPlan(viewportPlan)

    expect(graph.passes).toHaveLength(2)
    expect(graph.cells.map((cell) => cell.passIndex)).toEqual([0, 1])
  })

  it("keeps stable custom debug view ids in separate viewport passes", () => {
    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [
        {
          view: createCustomDebugView({
            id: "shader:fresnel",
            label: "Fresnel A",
            node: float(1),
            mode: "depth",
          }),
        },
        {
          view: createCustomDebugView({
            id: "shader:fresnel",
            label: "Fresnel B",
            node: float(1),
            mode: "depth",
          }),
        },
      ],
      layout: { mode: "row", slots: 2 },
    })

    const graph = createDebugViewportRenderGraphPlan(viewportPlan)

    expect(graph.passes).toHaveLength(2)
    expect(graph.passes[0]?.view.id).toBe("shader:fresnel")
    expect(graph.passes[1]?.view.id).toBe("shader:fresnel")
    expect(graph.cells.map((cell) => cell.passIndex)).toEqual([0, 1])
  })
})
