import { useEffect } from "react"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
} from "./debug-view-definitions"
import { DebugViews } from "./debug-views-r3f"
import type { DebugViewsOptions } from "./debug-views-options"
import { mountDebugViewLeva } from "./debug-view-leva"
import { useDebugViewsControls } from "./use-debug-views-controls"
import type { DebugView } from "./debug-views-tsl/compositor"

type DebugViewLayerControlledProps =
  | "activeView"
  | "columns"
  | "diagonalAngle"
  | "enabled"
  | "layout"
  | "overlayOpacity"
  | "paneCount"
  | "rows"
  | "showLabels"
  | "slots"
  | "viewportViews"
  | "views"

export interface DebugViewLayerProps
  extends Omit<DebugViewsOptions, DebugViewLayerControlledProps> {
  views?: readonly DebugView[]
  viewLabels?: string[]
  initialActiveView?: number
  maxLayoutSlots?: number
  maxPaneCount?: number
  showEnabledControl?: boolean
  /** Mount the bundled Leva control panel. Defaults to `true`. */
  showLeva?: boolean
}

export function DebugViewLayer({
  initialActiveView,
  views = DEFAULT_DEBUG_VIEWS,
  viewLabels = getDebugViewLabels(views),
  maxLayoutSlots,
  maxPaneCount,
  showEnabledControl,
  showLeva = true,
  ...props
}: DebugViewLayerProps) {
  const controls = useDebugViewsControls({
    initialActiveView,
    viewLabels,
    maxPaneCount: maxPaneCount ?? maxLayoutSlots,
    showEnabledControl,
  })

  useEffect(() => {
    if (!showLeva) return
    return mountDebugViewLeva()
  }, [showLeva])

  return (
    <DebugViews
      views={views}
      {...controls}
      {...props}
    />
  )
}
