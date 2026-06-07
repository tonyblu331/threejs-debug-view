export type LayoutMode =
  | "single"
  | "overlay"
  | "split-h"
  | "split-v"
  | "quad"
  | "row"
  | "column"
  | "grid"

export interface DebugViewLayoutOptions {
  paneCount?: number
  slots?: number
  columns?: number
  rows?: number
}

export interface DebugViewLayoutConfig extends DebugViewLayoutOptions {
  mode: LayoutMode
}

export type DebugViewLayout = LayoutMode | DebugViewLayoutConfig

export type LayoutPresentation = "single" | "overlay" | "grid"

export interface ResolvedDebugViewLayout {
  mode: LayoutMode
  presentation: LayoutPresentation
  columns: number
  rows: number
  slots: number
}

export const LAYOUT_INDEX: Record<LayoutMode, number> = {
  single: 0,
  overlay: 1,
  "split-h": 2,
  "split-v": 3,
  quad: 4,
  row: 5,
  column: 6,
  grid: 7,
}

const DEFAULT_LINEAR_SLOTS = 4

export function resolveDebugViewLayout(
  layout: DebugViewLayout = "single",
  options: DebugViewLayoutOptions = {},
): ResolvedDebugViewLayout {
  const config = mergeLayoutOptions(layout, options)

  switch (config.mode) {
    case "single":
      return createResolvedLayout(config.mode, "single", 1, 1)
    case "overlay":
      return createResolvedLayout(config.mode, "overlay", 1, 1, 2)
    case "split-h":
      return createResolvedLayout(config.mode, "grid", 2, 1)
    case "split-v":
      return createResolvedLayout(config.mode, "grid", 1, 2)
    case "quad":
      return createResolvedLayout(config.mode, "grid", 2, 2)
    case "row": {
      const slots = positiveInteger(getPaneCountOption(config), DEFAULT_LINEAR_SLOTS)
      return createResolvedLayout(config.mode, "grid", slots, 1, slots)
    }
    case "column": {
      const slots = positiveInteger(getPaneCountOption(config), DEFAULT_LINEAR_SLOTS)
      return createResolvedLayout(config.mode, "grid", 1, slots, slots)
    }
    case "grid": {
      const columns = positiveInteger(config.columns, 2)
      const rows = positiveInteger(config.rows, 2)
      return createResolvedLayout(config.mode, "grid", columns, rows, getPaneCountOption(config))
    }
  }
}

export function isResolvedDebugViewLayout(
  layout: DebugViewLayout | ResolvedDebugViewLayout,
): layout is ResolvedDebugViewLayout {
  return typeof layout === "object" && "presentation" in layout
}

function mergeLayoutOptions(
  layout: DebugViewLayout,
  options: DebugViewLayoutOptions,
): DebugViewLayoutConfig {
  const definedOptions = getDefinedLayoutOptions(options)

  if (typeof layout === "string") {
    return { mode: layout, ...definedOptions }
  }

  return { ...layout, ...definedOptions }
}

function getDefinedLayoutOptions(options: DebugViewLayoutOptions): DebugViewLayoutOptions {
  const definedOptions: DebugViewLayoutOptions = {}

  if (options.paneCount !== undefined) definedOptions.paneCount = options.paneCount
  if (options.slots !== undefined) definedOptions.slots = options.slots
  if (options.columns !== undefined) definedOptions.columns = options.columns
  if (options.rows !== undefined) definedOptions.rows = options.rows

  return definedOptions
}

function getPaneCountOption(options: DebugViewLayoutOptions): number | undefined {
  return options.paneCount ?? options.slots
}

function createResolvedLayout(
  mode: LayoutMode,
  presentation: LayoutPresentation,
  columns: number,
  rows: number,
  slots = columns * rows,
): ResolvedDebugViewLayout {
  const cellCount = columns * rows

  return {
    mode,
    presentation,
    columns,
    rows,
    slots: Math.min(positiveInteger(slots, cellCount), cellCount),
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.floor(value))
}
