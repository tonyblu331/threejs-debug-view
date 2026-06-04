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
} from "../../components/debug-views/r3f"

const VIEW_LABELS = getDebugViewLabels()
const FORCE_SHADER_COST_VIEW =
  import.meta.env.VITE_DEBUG_VIEW_CAPTURE === "shader-cost" ||
  new URLSearchParams(window.location.search).get("debugView") === "shaderCost"

interface DebugOverlayProps {
  controls: {
    activeView: unknown
    columns: unknown
    enabled: boolean
    layout: unknown
    mode: unknown
    overlayOpacity: unknown
    rows: unknown
    showLabels: boolean
    slots: unknown
  }
  viewLabels?: string[]
}

export function DebugOverlay({ controls, viewLabels = VIEW_LABELS }: DebugOverlayProps) {
  const shaderCostView = viewLabels.indexOf("Estimated Shader Complexity")
  const activeView =
    FORCE_SHADER_COST_VIEW && shaderCostView >= 0
      ? shaderCostView
      : controls.activeView as number

  const views = useMemo(
    (): DebugView[] => [...DEFAULT_DEBUG_VIEWS],
    [],
  )

  return (
    <DebugViews
      views={views}
      mode={controls.mode as DebugViewsMode}
      activeView={activeView}
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
