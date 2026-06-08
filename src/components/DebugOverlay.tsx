import { useMemo } from "react"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
  type DebugView,
} from "@/components/debug-views"
import {
  DebugViewLayer,
} from "../../components/debug-views/r3f"

const VIEW_LABELS = getDebugViewLabels()
export function DebugOverlay({ debugViewSource }: { debugViewSource?: string | null }) {
  const views = useMemo(
    (): DebugView[] => [...DEFAULT_DEBUG_VIEWS],
    [],
  )
  const forcedDebugView = import.meta.env.VITE_DEBUG_VIEW_CAPTURE || debugViewSource
  const forcedView = forcedDebugView
    ? views.findIndex((view) => view.source === forcedDebugView)
    : -1

  return (
    <DebugViewLayer
      views={views}
      viewLabels={VIEW_LABELS}
      initialActiveView={forcedView < 0 ? 0 : forcedView}
      showEnabledControl={false}
    />
  )
}
