import { useEffect, useMemo } from "react"
import { useControls } from "leva"
import { getDebugViewLabels } from "./debug-view-definitions"
import {
  createPaneAssignmentsKey,
  createViewportViews,
  getVisiblePaneCount,
  isPaneAssignmentLayout,
  usesPaneAssignments,
} from "./debug-views-controls"
import type { DebugViewsControlValues } from "./debug-views-options"

export type { DebugViewsControlValues } from "./debug-views-options"

interface UseDebugViewsControlsOptions {
  viewLabels?: string[]
  maxPaneCount?: number
  initialActiveView?: number
  showEnabledControl?: boolean
}

export function useDebugViewsControls(
  options: UseDebugViewsControlsOptions = {},
): DebugViewsControlValues {
  const {
    viewLabels = getDebugViewLabels(),
    initialActiveView = 0,
    maxPaneCount,
    showEnabledControl = true,
  } = options
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
      ...(showEnabledControl
        ? { enabled: { label: "Enabled", value: true } }
        : {}),
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
          "Split Diagonal": "split-diagonal",
          Breakdown: "breakdown",
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
      diagonalAngle: {
        label: "Diagonal angle",
        value: 25,
        min: -45,
        max: 45,
        step: 1,
        render: (get: (path: string) => unknown) =>
          ["split-diagonal", "breakdown"].includes(String(get("Debug.layout"))),
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
  }, [defaultPaneCount, initialActiveView, paneControlCount, paneLimit, showEnabledControl, viewLabels.length, viewOptions])

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
    ...(controls as DebugViewsControlValues),
    enabled: showEnabledControl ? Boolean(controlValues.enabled) : true,
    viewportViews,
  }
}
