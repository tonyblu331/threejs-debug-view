import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
} from "./debug-view-definitions"
import { DebugViews, type DebugViewsProps } from "./debug-views-post"
import {
  useDebugViewsControls,
  type DebugViewsControlValues,
} from "./use-debug-views-controls"
import type { DebugView } from "./debug-views-tsl/compositor"

type DebugViewLayerControlledProps =
  | "activeView"
  | "columns"
  | "enabled"
  | "layout"
  | "mode"
  | "overlayOpacity"
  | "paneCount"
  | "rows"
  | "showLabels"
  | "slots"
  | "viewportViews"
  | "views"

export interface DebugViewLayerProps
  extends Omit<DebugViewsProps, DebugViewLayerControlledProps> {
  views?: readonly DebugView[]
  viewLabels?: string[]
  initialActiveView?: number
  maxLayoutSlots?: number
}

export function DebugViewLayer({
  initialActiveView,
  views = DEFAULT_DEBUG_VIEWS,
  viewLabels = getDebugViewLabels(views),
  maxLayoutSlots,
  ...props
}: DebugViewLayerProps) {
  const controls = useDebugViewsControls({
    initialActiveView,
    viewLabels,
    maxLayoutSlots,
  }) as DebugViewsControlValues

  return (
    <DebugViews
      views={views}
      {...controls}
      {...props}
    />
  )
}
