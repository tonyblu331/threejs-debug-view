import { useMemo } from "react"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
  type DebugView,
} from "@/components/debug-views"
import {
  DebugViews,
} from "../../components/debug-views/r3f"
import type { DebugControlValues } from "./debug-control-values"

const VIEW_LABELS = getDebugViewLabels()
const FORCE_SHADER_COST_VIEW =
  import.meta.env.VITE_DEBUG_VIEW_CAPTURE === "shader-cost" ||
  new URLSearchParams(window.location.search).get("debugView") === "shaderCost"

interface DebugOverlayProps {
  controls: DebugControlValues
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
      mode={controls.mode}
      activeView={activeView}
      layout={controls.layout}
      slots={controls.slots}
      columns={controls.columns}
      rows={controls.rows}
      showLabels={controls.showLabels}
      overlayOpacity={controls.overlayOpacity}
      enabled={controls.enabled}
    />
  )
}
