import type { DebugView, DebugViewSource, ViewMode } from "./debug-views-tsl/compositor"
import {
  isResolvedDebugViewLayout,
  resolveDebugViewLayout,
  type DebugViewLayout,
  type ResolvedDebugViewLayout,
} from "./debug-view-layout"

export function getDefaultDebugViewSource(view: DebugView): DebugViewSource {
  if (view.source) return view.source
  if (view.mode === "normal") return "normal"
  if (view.mode === "depth") return "depth"
  return "beauty"
}

export function getResolvedDebugViewMode(view: DebugView): ViewMode {
  const mode = view.mode ?? "passthrough"
  if (view.node) return mode

  switch (getDefaultDebugViewSource(view)) {
    case "normal":
    case "materialNormal":
    case "normalMap":
      return "passthrough"
    default:
      return mode
  }
}

export function selectPipelineViews(
  views: readonly DebugView[],
  activeView: number,
  layout: DebugViewLayout | ResolvedDebugViewLayout,
): DebugView[] {
  if (views.length === 0) return []

  const resolvedLayout = isResolvedDebugViewLayout(layout) ? layout : resolveDebugViewLayout(layout)
  const active = views[clampIndex(activeView, views.length)]

  switch (resolvedLayout.presentation) {
    case "single":
      return [active]
    case "overlay":
      return selectOverlayViews(views, active)
    case "diagonal":
      return views.slice(0, Math.min(2, resolvedLayout.slots))
    case "grid":
      return views.slice(0, resolvedLayout.slots)
  }
}

function selectOverlayViews(views: readonly DebugView[], active: DebugView) {
  const beauty = views.find((view) => getDefaultDebugViewSource(view) === "beauty") ?? views[0]
  return beauty === active ? [beauty] : [beauty, active]
}

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(index, length - 1))
}
