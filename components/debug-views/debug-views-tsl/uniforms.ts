import { uniform } from "three/tsl"
import {
  LAYOUT_INDEX,
  resolveDebugViewLayout,
  type DebugViewLayout,
} from "../debug-view-layout"

export type { DebugViewLayout, LayoutMode } from "../debug-view-layout"

export function createDebugViewUniforms() {
  return {
    activeView: uniform(0),
    layout: uniform(0),
    viewCount: uniform(3),
    gridColumns: uniform(2),
    gridRows: uniform(2),
    diagonalSlope: uniform(0),
    overlayOpacity: uniform(0.35),
  }
}

export type DebugViewUniforms = ReturnType<typeof createDebugViewUniforms>

export function updateDebugViewUniforms(
  uniforms: DebugViewUniforms,
  activeView: number,
  layout: DebugViewLayout = "single",
  viewCount: number = 1,
  overlayOpacity: number = 0.35,
) {
  const resolvedLayout = resolveDebugViewLayout(layout)
  const safeViewCount = Math.max(1, viewCount)

  uniforms.activeView.value = Math.max(0, Math.min(activeView, safeViewCount - 1))
  uniforms.layout.value = LAYOUT_INDEX[resolvedLayout.mode]
  uniforms.viewCount.value = safeViewCount
  uniforms.gridColumns.value = resolvedLayout.columns
  uniforms.gridRows.value = resolvedLayout.rows
  uniforms.diagonalSlope.value = Math.tan(resolvedLayout.diagonalAngle * Math.PI / 180)
  uniforms.overlayOpacity.value = Math.max(0, Math.min(overlayOpacity, 1))
}
