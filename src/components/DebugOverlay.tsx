import { useMemo } from "react"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
  type DebugView,
  type DebugViewsMode,
  type LayoutMode,
} from "@/components/debug-views"
import {
  DebugViews,
  useDebugViewsControls,
} from "../../components/debug-views/r3f"

const VIEW_LABELS = getDebugViewLabels()

export function DebugOverlay() {
  const controls = useDebugViewsControls({ viewLabels: VIEW_LABELS })

  const views = useMemo(
    (): DebugView[] => [...DEFAULT_DEBUG_VIEWS],
    [],
  )

  return (
    <DebugViews
      views={views}
      mode={controls.mode as DebugViewsMode}
      activeView={controls.activeView as number}
      layout={controls.layout as LayoutMode}
      slots={controls.slots as number}
      columns={controls.columns as number}
      rows={controls.rows as number}
      showLabels={controls.showLabels}
      overlayOpacity={controls.overlayOpacity as number}
      enabled={controls.enabled}
    />
  )
}
