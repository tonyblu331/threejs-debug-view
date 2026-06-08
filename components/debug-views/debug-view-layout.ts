export type LayoutMode =
  | "single"
  | "overlay"
  | "split-h"
  | "split-v"
  | "split-diagonal"
  | "breakdown"
  | "quad"
  | "row"
  | "column"
  | "grid"

export interface DebugViewLayoutOptions {
  paneCount?: number
  slots?: number
  columns?: number
  rows?: number
  diagonalAngle?: number
  maxDiagonalAngle?: number
}

export interface DebugViewLayoutConfig extends DebugViewLayoutOptions {
  mode: LayoutMode
}

export type DebugViewLayout = LayoutMode | DebugViewLayoutConfig

export type LayoutPresentation = "single" | "overlay" | "grid" | "diagonal" | "breakdown"

export interface ResolvedDebugViewLayout {
  mode: LayoutMode
  presentation: LayoutPresentation
  columns: number
  rows: number
  slots: number
  diagonalAngle: number
}

export const LAYOUT_INDEX: Record<LayoutMode, number> = {
  single: 0,
  overlay: 1,
  "split-h": 2,
  "split-v": 3,
  "split-diagonal": 4,
  breakdown: 5,
  quad: 6,
  row: 7,
  column: 8,
  grid: 9,
}

const DEFAULT_LINEAR_SLOTS = 4
const DEFAULT_DIAGONAL_ANGLE = 24
const DEFAULT_BREAKDOWN_ANGLE = 25
const DEFAULT_MAX_DIAGONAL_ANGLE = 45
const HARD_MAX_DIAGONAL_ANGLE = 85

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
    case "split-diagonal":
      return createResolvedLayout(
        config.mode,
        "diagonal",
        2,
        1,
        2,
        normalizeDiagonalAngle(config.diagonalAngle, config.maxDiagonalAngle),
      )
    case "breakdown":
      return createResolvedLayout(
        config.mode,
        "breakdown",
        4,
        1,
        4,
        normalizeDiagonalAngle(
          config.diagonalAngle ?? DEFAULT_BREAKDOWN_ANGLE,
          config.maxDiagonalAngle,
        ),
      )
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
  if (options.diagonalAngle !== undefined) definedOptions.diagonalAngle = options.diagonalAngle
  if (options.maxDiagonalAngle !== undefined) definedOptions.maxDiagonalAngle = options.maxDiagonalAngle

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
  diagonalAngle = 0,
): ResolvedDebugViewLayout {
  const cellCount = columns * rows

  return {
    mode,
    presentation,
    columns,
    rows,
    slots: Math.min(positiveInteger(slots, cellCount), cellCount),
    diagonalAngle,
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.floor(value))
}

function normalizeDiagonalAngle(
  angle = DEFAULT_DIAGONAL_ANGLE,
  maxAngle = DEFAULT_MAX_DIAGONAL_ANGLE,
) {
  const safeMax = Math.min(
    HARD_MAX_DIAGONAL_ANGLE,
    Math.max(0, Math.abs(finiteNumber(maxAngle, DEFAULT_MAX_DIAGONAL_ANGLE))),
  )
  const safeAngle = finiteNumber(angle, DEFAULT_DIAGONAL_ANGLE)

  return Math.max(-safeMax, Math.min(safeAngle, safeMax))
}

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback
}
