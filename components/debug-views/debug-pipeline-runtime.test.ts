import { describe, expect, it } from "vitest"
import { DEFAULT_DEBUG_VIEWS } from "./debug-view-definitions"
import { createDebugRenderPlan } from "./debug-render-plan"
import { resolveDebugViewLayout } from "./debug-view-layout"
import {
  createDebugPipelineRuntimeKey,
  SINGLE_VIEW_LAYOUT,
} from "./debug-pipeline-runtime"

describe("debug pipeline runtime", () => {
  it("changes runtime keys when layout changes", () => {
    const layout = resolveDebugViewLayout("single")
    const overlayLayout = resolveDebugViewLayout("overlay")
    const plan = createDebugRenderPlan(DEFAULT_DEBUG_VIEWS, 0, layout)
    const overlayPlan = createDebugRenderPlan(DEFAULT_DEBUG_VIEWS, 0, overlayLayout)

    const keySingle = createDebugPipelineRuntimeKey(plan, layout)
    const keyOverlay = createDebugPipelineRuntimeKey(overlayPlan, overlayLayout)

    expect(keySingle).not.toBe(keyOverlay)
    expect(createDebugPipelineRuntimeKey(plan, layout)).toBe(keySingle)
  })

  it("exports a single-view layout constant for headless runtimes", () => {
    expect(SINGLE_VIEW_LAYOUT).toMatchObject({
      mode: "single",
      columns: 1,
      rows: 1,
      slots: 1,
    })
  })
})
