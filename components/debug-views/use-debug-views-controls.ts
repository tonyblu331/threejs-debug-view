import { useEffect, useMemo } from "react"
import { useControls } from "leva"
import { getDebugViewLabels } from "./debug-view-definitions"
import type { DebugViewsProps } from "./debug-views-post"
import type { DebugViewportView } from "./debug-viewport-plan"

export type DebugViewsControlValues = Required<
  Pick<
    DebugViewsProps,
    | "activeView"
    | "columns"
    | "enabled"
    | "layout"
    | "overlayOpacity"
    | "paneCount"
    | "rows"
    | "showLabels"
    | "viewportViews"
  >
>

interface UseDebugViewsControlsOptions {
  viewLabels?: string[]
  maxPaneCount?: number
  initialActiveView?: number
}

export function useDebugViewsControls(options: UseDebugViewsControlsOptions = {}) {
  const { viewLabels = getDebugViewLabels(), initialActiveView = 0, maxPaneCount } = options
  const paneLimit = Math.max(1, maxPaneCount ?? viewLabels.length)
  const defaultPaneCount = Math.min(4, paneLimit)
  const paneControlCount = Math.min(8, paneLimit)

  const viewOptions = useMemo(() => {
    const options: Record<string, number> = {}
    for (let i = 0; i < viewLabels.length; i++) {
      options[viewLabels[i]] = i
    }
    return options
  }, [viewLabels])

  const [controls, setControls] = useControls("Debug", () => {
    const paneControls: Record<string, unknown> = {}
    for (let index = 0; index < paneControlCount; index++) {
      paneControls[`pane${index + 1}`] = {
        label: `Pane ${index + 1}`,
        value: Math.min(index, viewLabels.length - 1),
        options: viewOptions,
        render: (get: (path: string) => unknown) =>
          usesPaneAssignments(get) && index < getVisiblePaneCount(get),
      }
    }

    return {
      enabled: { label: "Enabled", value: true },
      showLabels: { label: "Viewport labels", value: true },
      activeView: {
        label: "View",
        value: Math.max(0, Math.min(initialActiveView, viewLabels.length - 1)),
        options: viewOptions,
        render: (get: (path: string) => unknown) => !usesPaneAssignments(get),
      },
      layout: {
        label: "Layout",
        value: "single",
        options: {
          Single: "single",
          Overlay: "overlay",
          "Split H": "split-h",
          "Split V": "split-v",
          Quad: "quad",
          Row: "row",
          Column: "column",
          Grid: "grid",
        },
      },
      paneCount: {
        label: "Panes",
        value: defaultPaneCount,
        min: 1,
        max: paneLimit,
        step: 1,
        render: (get: (path: string) => unknown) => ["row", "column", "grid"].includes(String(get("Debug.layout"))),
      },
      columns: {
        label: "Columns",
        value: 2,
        min: 1,
        max: paneLimit,
        step: 1,
        render: (get: (path: string) => unknown) => get("Debug.layout") === "grid",
      },
      rows: {
        label: "Rows",
        value: 2,
        min: 1,
        max: paneLimit,
        step: 1,
        render: (get: (path: string) => unknown) => get("Debug.layout") === "grid",
      },
      overlayOpacity: {
        label: "Blend opacity",
        value: 0.35,
        min: 0,
        max: 1,
        step: 0.01,
        render: (get: (path: string) => unknown) => get("Debug.layout") === "overlay",
      },
      ...paneControls,
    }
  }, [defaultPaneCount, initialActiveView, paneControlCount, paneLimit, viewLabels.length, viewOptions])

  useEffect(() => {
    setControls({ activeView: Math.max(0, Math.min(initialActiveView, viewLabels.length - 1)) })
  }, [initialActiveView, setControls, viewLabels.length])

  const controlValues = controls as Record<string, unknown>
  const paneAssignmentsKey = createPaneAssignmentsKey(controlValues, paneControlCount)
  const viewportViews = useMemo(
    () => isPaneAssignmentLayout(controlValues.layout)
      ? createViewportViews(controlValues, paneControlCount)
      : undefined,
    [controlValues.layout, paneAssignmentsKey, paneControlCount],
  )

  return {
    ...controls,
    viewportViews,
  }
}

function createViewportViews(
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

function createPaneAssignmentsKey(
  controlValues: Record<string, unknown>,
  paneControlCount: number,
) {
  const assignments: string[] = []

  for (let index = 0; index < paneControlCount; index++) {
    assignments.push(String(controlValues[`pane${index + 1}`]))
  }

  return assignments.join("|")
}

function usesPaneAssignments(get: (path: string) => unknown) {
  return isPaneAssignmentLayout(get("Debug.layout"))
}

function isPaneAssignmentLayout(layout: unknown) {
  return ["split-h", "split-v", "quad", "row", "column", "grid"].includes(String(layout))
}

function getVisiblePaneCount(get: (path: string) => unknown) {
  const layout = String(get("Debug.layout"))

  switch (layout) {
    case "single":
      return 1
    case "overlay":
    case "split-h":
    case "split-v":
      return 2
    case "quad":
      return 4
    case "row":
    case "column":
    case "grid": {
      const paneCount = Number(get("Debug.paneCount"))
      return Number.isFinite(paneCount) ? Math.max(1, Math.floor(paneCount)) : 4
    }
    default:
      return 1
  }
}
