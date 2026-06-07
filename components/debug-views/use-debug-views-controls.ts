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
    | "mode"
    | "overlayOpacity"
    | "rows"
    | "showLabels"
    | "slots"
    | "viewportViews"
  >
>

interface UseDebugViewsControlsOptions {
  viewLabels?: string[]
  maxLayoutSlots?: number
  initialActiveView?: number
}

export function useDebugViewsControls(options: UseDebugViewsControlsOptions = {}) {
  const { viewLabels = getDebugViewLabels(), initialActiveView = 0, maxLayoutSlots } = options
  const slotLimit = Math.max(1, maxLayoutSlots ?? viewLabels.length)
  const defaultSlots = Math.min(4, slotLimit)
  const paneControlCount = Math.min(8, slotLimit)

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
          get("Debug.mode") === "viewport" && index < getVisiblePaneCount(get),
      }
    }

    return {
      enabled: { label: "Enabled", value: true },
      showLabels: { label: "Viewport labels", value: true },
      mode: {
        label: "Mode",
        value: "compose",
        options: {
          Compose: "compose",
          Viewport: "viewport",
        },
      },
      activeView: {
        label: "View",
        value: Math.max(0, Math.min(initialActiveView, viewLabels.length - 1)),
        options: viewOptions,
        render: (get: (path: string) => unknown) => get("Debug.mode") === "compose",
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
      slots: {
        label: "Panes",
        value: defaultSlots,
        min: 1,
        max: slotLimit,
        step: 1,
        render: (get: (path: string) => unknown) => ["row", "column", "grid"].includes(String(get("Debug.layout"))),
      },
      columns: {
        label: "Columns",
        value: 2,
        min: 1,
        max: slotLimit,
        step: 1,
        render: (get: (path: string) => unknown) => get("Debug.layout") === "grid",
      },
      rows: {
        label: "Rows",
        value: 2,
        min: 1,
        max: slotLimit,
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
  }, [defaultSlots, initialActiveView, paneControlCount, slotLimit, viewLabels.length, viewOptions])

  useEffect(() => {
    setControls({ activeView: Math.max(0, Math.min(initialActiveView, viewLabels.length - 1)) })
  }, [initialActiveView, setControls, viewLabels.length])

  const controlValues = controls as Record<string, unknown>
  const viewportViews: DebugViewportView[] = []
  for (let index = 0; index < paneControlCount; index++) {
    const value = controlValues[`pane${index + 1}`]
    viewportViews.push({ view: typeof value === "number" ? value : index })
  }

  return {
    ...controls,
    viewportViews,
  }
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
      const slots = Number(get("Debug.slots"))
      return Number.isFinite(slots) ? Math.max(1, Math.floor(slots)) : 4
    }
    default:
      return 1
  }
}
