import type { DebugViewsMode, LayoutMode } from "@/components/debug-views"

export interface DebugControlValues {
  activeView: number
  columns: number
  enabled: boolean
  layout: LayoutMode
  mode: DebugViewsMode
  overlayOpacity: number
  rows: number
  showLabels: boolean
  slots: number
}

export const DEFAULT_DEBUG_CONTROLS: DebugControlValues = {
  activeView: 0,
  columns: 2,
  enabled: true,
  layout: "single",
  mode: "compose",
  overlayOpacity: 0.35,
  rows: 2,
  showLabels: true,
  slots: 4,
}
