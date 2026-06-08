import type { Camera } from "three"
import type { DebugView, DebugViewSource } from "./debug-views-tsl/compositor"
import {
  resolveDebugViewLayout,
  type DebugViewLayout,
  type ResolvedDebugViewLayout,
} from "./debug-view-layout"
import {
  getDefaultDebugViewSource,
  selectPipelineViews,
} from "./debug-view-selection"

export type DebugViewportResolutionScale = 1 | 0.5 | 0.25

export interface DebugViewportView {
  view: number | DebugViewSource | DebugView
  label?: string
  camera?: Camera
  resolutionScale?: number
}

export interface DebugViewportCell {
  index: number
  view: DebugView
  camera?: Camera
  resolutionScale: DebugViewportResolutionScale
}

export interface DebugViewportPlan {
  layout: ResolvedDebugViewLayout
  views: DebugView[]
  cells: DebugViewportCell[]
}

export interface DebugViewportPlanOptions {
  views: readonly DebugView[]
  viewportViews?: readonly DebugViewportView[]
  activeView?: number
  layout?: DebugViewLayout | ResolvedDebugViewLayout
}

export function createDebugViewportPlan({
  views,
  viewportViews,
  activeView = 0,
  layout = "single",
}: DebugViewportPlanOptions): DebugViewportPlan {
  const resolvedLayout = isResolvedLayout(layout)
    ? layout
    : resolveDebugViewLayout(layout)

  const plannedViews: Array<Omit<DebugViewportCell, "index">> = viewportViews?.length
    ? viewportViews.slice(0, resolvedLayout.slots).map((viewportView) =>
        resolveViewportView(views, viewportView),
      )
    : selectPipelineViews(views, activeView, resolvedLayout)
        .slice(0, resolvedLayout.slots)
        .map((view) => ({
          view,
          resolutionScale: 1,
        }))

  const cells = plannedViews.map((plannedView, index): DebugViewportCell => ({
    index,
    view: plannedView.view,
    camera: plannedView.camera,
    resolutionScale: normalizeResolutionScale(plannedView.resolutionScale),
  }))

  return {
    layout: resolvedLayout,
    views: cells.map((cell) => cell.view),
    cells,
  }
}

function isResolvedLayout(
  layout: DebugViewLayout | ResolvedDebugViewLayout,
): layout is ResolvedDebugViewLayout {
  return typeof layout === "object" && "presentation" in layout
}

function resolveViewportView(
  views: readonly DebugView[],
  viewportView: DebugViewportView,
): Omit<DebugViewportCell, "index"> {
  const view = resolveDebugViewReference(views, viewportView.view)
  return {
    view: viewportView.label ? { ...view, label: viewportView.label } : view,
    camera: viewportView.camera,
    resolutionScale: normalizeResolutionScale(viewportView.resolutionScale),
  }
}

function resolveDebugViewReference(
  views: readonly DebugView[],
  reference: DebugViewportView["view"],
): DebugView {
  if (typeof reference === "number") {
    return views[clampIndex(reference, views.length)] ?? createMissingView("beauty")
  }

  if (typeof reference === "string") {
    return (
      views.find((view) => getDefaultDebugViewSource(view) === reference) ??
      createMissingView(reference)
    )
  }

  return reference
}

function createMissingView(source: DebugViewSource): DebugView {
  return { label: source, source, mode: "passthrough" }
}

function normalizeResolutionScale(value: number | undefined): DebugViewportResolutionScale {
  if (value === undefined || !Number.isFinite(value)) return 1
  if (value >= 0.75) return 1
  if (value >= 0.375) return 0.5
  return 0.25
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0
  return Math.max(0, Math.min(index, length - 1))
}

export function requiresViewportRuntime(plan: DebugViewportPlan) {
  return plan.cells.some((cell) => cell.camera || cell.resolutionScale !== 1)
}
