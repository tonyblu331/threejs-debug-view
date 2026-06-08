import type { DebugViewLayout } from "./debug-view-layout"
import type { DebugViewportLabels } from "./debug-viewport-labels"
import type { DebugViewportView } from "./debug-viewport-plan"
import type { DebugView } from "./debug-views-tsl/compositor"

export interface DebugViewsOptions {
  views: readonly DebugView[]
  viewportViews?: DebugViewportView[]
  activeView?: number
  layout?: DebugViewLayout
  paneCount?: number
  columns?: number
  rows?: number
  diagonalAngle?: number
  maxDiagonalAngle?: number
  showLabels?: boolean
  viewportLabels?: DebugViewportLabels
  overlayOpacity?: number
  enabled?: boolean
}

export type DebugViewsControlValues = Required<
  Pick<
    DebugViewsOptions,
    | "activeView"
    | "columns"
    | "diagonalAngle"
    | "enabled"
    | "layout"
    | "overlayOpacity"
    | "paneCount"
    | "rows"
    | "showLabels"
  >
> &
  Pick<DebugViewsOptions, "viewportViews">
