import type { DebugViewLayout } from "./debug-view-layout"
import type { DebugViewportView } from "./debug-viewport-plan"

const PANE_ASSIGNMENT_LAYOUTS: DebugViewLayout[] = [
  "split-h",
  "split-v",
  "split-diagonal",
  "breakdown",
  "quad",
  "row",
  "column",
  "grid",
]

export function isPaneAssignmentLayout(layout: unknown) {
  return PANE_ASSIGNMENT_LAYOUTS.includes(String(layout) as DebugViewLayout)
}

export function getVisiblePaneCountForLayout(
  layout: unknown,
  paneCount: unknown,
) {
  switch (String(layout)) {
    case "single":
      return 1
    case "overlay":
    case "split-h":
    case "split-v":
    case "split-diagonal":
      return 2
    case "breakdown":
    case "quad":
      return 4
    case "row":
    case "column":
    case "grid": {
      const count = Number(paneCount)
      return Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 4
    }
    default:
      return 1
  }
}

export function getVisiblePaneCount(get: (path: string) => unknown) {
  return getVisiblePaneCountForLayout(
    get("Debug.layout"),
    get("Debug.paneCount"),
  )
}

export function createViewportViews(
  controlValues: Record<string, unknown>,
  paneControlCount: number,
): DebugViewportView[] {
  const viewportViews: DebugViewportView[] = []

  for (let index = 0; index < paneControlCount; index++) {
    const value = controlValues[`pane${index + 1}`]
    viewportViews.push({ view: typeof value === "number" ? value : index })
  }

  return viewportViews
}

export function createPaneAssignmentsKey(
  controlValues: Record<string, unknown>,
  paneControlCount: number,
) {
  const assignments: string[] = []

  for (let index = 0; index < paneControlCount; index++) {
    assignments.push(String(controlValues[`pane${index + 1}`]))
  }

  return assignments.join("|")
}

export function usesPaneAssignments(get: (path: string) => unknown) {
  return isPaneAssignmentLayout(get("Debug.layout"))
}
