import { useMemo } from "react"
import { DebugViewLayer } from "threejs-debug-view/r3f"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
  type DebugView,
} from "threejs-debug-view"
import { getDebugDemoPreset } from "../demo/debug-e2e-presets"

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
  const preset = getDebugDemoPreset()

  return (
    <DebugViewLayer
      views={views}
      viewLabels={VIEW_LABELS}
      initialActiveView={forcedView < 0 ? 0 : forcedView}
      showEnabledControl={false}
      showLabels={preset?.showLabels}
      showLegends={preset?.showLegends}
      showLeva={preset?.showLeva}
      layout={preset?.layout}
      diagonalAngle={preset?.diagonalAngle}
      viewportViews={preset?.viewportViews}
    />
  )
}
