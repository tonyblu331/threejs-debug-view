import type { DebugViewLayout } from "../../components/debug-views/debug-view-layout"
import type { DebugViewportView } from "../../components/debug-views/debug-viewport-plan"
import {
  SOCIAL_CAPTURE_DIAGONAL_ANGLE,
  SOCIAL_CAPTURE_LAYOUT,
  SOCIAL_CAPTURE_VIEWPORT,
} from "./social-capture-preset"

export interface DebugDemoPreset {
  layout: DebugViewLayout
  viewportViews?: readonly DebugViewportView[]
  diagonalAngle?: number
  showLabels: boolean
  showLegends: boolean
  showLeva: false
}

function readSearchParams(search?: string) {
  const query = search ?? (typeof window !== "undefined" ? window.location.search : "")
  return new URLSearchParams(query)
}

function readE2eMode(search?: string) {
  return readSearchParams(search).get("e2e")
}

export function getSocialCapturePreset(search?: string): DebugDemoPreset | null {
  if (readSearchParams(search).get("capture") !== "social") return null

  return {
    layout: SOCIAL_CAPTURE_LAYOUT,
    viewportViews: SOCIAL_CAPTURE_VIEWPORT,
    diagonalAngle: SOCIAL_CAPTURE_DIAGONAL_ANGLE,
    showLabels: true,
    showLegends: true,
    showLeva: false,
  }
}

export function getDebugE2ePreset(search?: string): DebugDemoPreset | null {
  const mode = readE2eMode(search)
  if (!mode) return null

  if (mode === "viewport-scaled") {
    return {
      layout: "split-h",
      viewportViews: [
        { view: "beauty", label: "Beauty" },
        { view: "normal", label: "Normals", resolutionScale: 0.5 },
      ],
      showLabels: true,
      showLegends: false,
      showLeva: false,
    }
  }

  if (mode === "breakdown-labels-on" || mode === "breakdown-labels-off") {
    return {
      layout: "breakdown",
      viewportViews: [
        { view: "beauty", label: "Beauty" },
        { view: "normal", label: "Normal" },
        { view: "depth", label: "Depth" },
        { view: "albedo", label: "Albedo" },
      ],
      showLabels: mode === "breakdown-labels-on",
      showLegends: true,
      showLeva: false,
    }
  }

  if (mode === "overlap-no-legends") {
    return {
      layout: "single",
      showLabels: false,
      showLegends: false,
      showLeva: false,
    }
  }

  return null
}

export function getDebugDemoPreset(search?: string): DebugDemoPreset | null {
  return getSocialCapturePreset(search) ?? getDebugE2ePreset(search)
}
