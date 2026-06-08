import { float, vec4, screenUV, mix } from "three/tsl"
import type { DebugNode, FloatNode, Vec4Node } from "./node-types"
import type { DebugViewUniforms } from "./uniforms"
import { visualizeDepth, visualizeHeatmap, visualizeNormal } from "./visualize"
import {
  isResolvedDebugViewLayout,
  LAYOUT_INDEX,
  resolveDebugViewLayout,
  type DebugViewLayout,
  type ResolvedDebugViewLayout,
} from "../debug-view-layout"

export type ViewMode = "passthrough" | "normal" | "depth" | "heatmap"
export type DebugViewSource =
  | "beauty"
  | "normal"
  | "materialNormal"
  | "normalMap"
  | "depth"
  | "albedo"
  | "baseColor"
  | "roughness"
  | "metalness"
  | "metallic"
  | "opacity"
  | "transparency"
  | "ao"
  | "emissive"
  | "wireframe"
  | "lightingOnly"
  | "reflectionOnly"
  | "overdraw"
  | "shaderCost"

export interface DebugView {
  id?: string
  label: string
  node?: DebugNode
  mode?: ViewMode
  source?: DebugViewSource
  scale?: number
  bias?: number
}

export interface ViewCompositorConfig {
  views: DebugView[]
  uniforms: DebugViewUniforms
  layout?: DebugViewLayout | ResolvedDebugViewLayout
}

export function createViewCompositor(config: ViewCompositorConfig): Vec4Node {
  const { views, uniforms, layout } = config
  const count = views.length

  if (count === 0) return vec4(0, 0, 0, 1)

  const visualized = views.map((v) => applyMode(v))

  if (layout) {
    return selectLayout(layout, visualized, uniforms)
  }

  const single  = selectSingle(visualized, uniforms.activeView)
  const overlay = blendOverlay(visualized, uniforms.overlayOpacity)
  const splitH  = selectByGrid(visualized, uniforms.viewCount, 2, 1)
  const splitV  = selectByGrid(visualized, uniforms.viewCount, 1, 2)
  const quad    = selectByGrid(visualized, uniforms.viewCount, 2, 2)
  const grid    = selectByGrid(
    visualized,
    uniforms.viewCount,
    uniforms.gridColumns,
    uniforms.gridRows,
  )

  const isSingle  = uniforms.layout.equal(float(LAYOUT_INDEX.single))
  const isOverlay = uniforms.layout.equal(float(LAYOUT_INDEX.overlay))
  const isSplitH  = uniforms.layout.equal(float(LAYOUT_INDEX["split-h"]))
  const isSplitV  = uniforms.layout.equal(float(LAYOUT_INDEX["split-v"]))
  const isQuad    = uniforms.layout.equal(float(LAYOUT_INDEX.quad))

  return isSingle.select(single,
         isOverlay.select(overlay,
         isSplitH.select(splitH,
         isSplitV.select(splitV,
         isQuad.select(quad,
         grid)))))
}

function selectLayout(
  layout: DebugViewLayout | ResolvedDebugViewLayout,
  views: Vec4Node[],
  uniforms: DebugViewUniforms,
): Vec4Node {
  const resolvedLayout = isResolvedDebugViewLayout(layout) ? layout : resolveDebugViewLayout(layout)

  switch (resolvedLayout.presentation) {
    case "single":
      return selectSingle(views, uniforms.activeView)
    case "overlay":
      return blendOverlay(views, uniforms.overlayOpacity)
    case "diagonal":
      return selectByDiagonal(views, uniforms.diagonalSlope)
    case "grid":
      return selectByGrid(views, uniforms.viewCount, resolvedLayout.columns, resolvedLayout.rows)
  }
}

function selectSingle(views: Vec4Node[], activeView: DebugViewUniforms["activeView"]): Vec4Node {
  let result = views[0]
  for (let i = 1; i < views.length; i++) {
    result = activeView.greaterThan(float(i - 0.5)).select(views[i], result)
  }
  return result
}

function blendOverlay(views: Vec4Node[], opacity: DebugViewUniforms["overlayOpacity"]): Vec4Node {
  if (views.length === 1) return views[0]

  let result = views[0]
  for (let i = 1; i < views.length; i++) {
    result = mix(result, views[i], opacity)
  }
  return result
}

function selectByDiagonal(
  views: Vec4Node[],
  slope: DebugViewUniforms["diagonalSlope"],
): Vec4Node {
  if (views.length === 1) return views[0]

  const uv = screenUV
  const boundary = uv.x.sub(float(0.5)).add(uv.y.sub(float(0.5)).mul(slope))
  const divider = boundary.abs().lessThan(float(0.003))
  const split = boundary.greaterThanEqual(float(0))
  const result = split.select(views[1], views[0])

  return divider.select(vec4(0.12, 0.12, 0.12, 1), result)
}

function selectByGrid(
  views: Vec4Node[],
  viewCount: DebugViewUniforms["viewCount"],
  cols: GridAxis,
  rows: GridAxis,
): Vec4Node {
  const uv = screenUV
  const fCols = toGridAxisNode(cols)
  const fRows = toGridAxisNode(rows)

  const col = uv.x.mul(fCols).floor()
  const row = fRows.sub(float(1)).sub(uv.y.mul(fRows).floor())
  const cellIdx = row.mul(fCols).add(col)

  const lineWidth = float(0.003)
  const edgeX = uv.x.mul(fCols).fract()
  const edgeY = uv.y.mul(fRows).fract()
  const isGridLine = edgeX.lessThan(lineWidth)
    .or(edgeY.lessThan(lineWidth))

  let result: Vec4Node = views[0]
  for (let i = 1; i < views.length; i++) {
    result = cellIdx.equal(float(i)).select(views[i], result)
  }

  result = cellIdx.greaterThanEqual(viewCount).select(views[0], result)

  result = isGridLine.select(vec4(0.12, 0.12, 0.12, 1), result)

  return result
}

type GridAxis = number | DebugViewUniforms["gridColumns"] | DebugViewUniforms["gridRows"]

function toGridAxisNode(value: GridAxis) {
  return typeof value === "number" ? float(value) : value
}

function applyMode(view: DebugView): Vec4Node {
  const { node, mode = "passthrough", scale, bias } = view

  if (!node) {
    return vec4(0, 0, 0, 1)
  }

  switch (mode) {
    case "normal":
      return visualizeNormal(node as Vec4Node)
    case "depth":
      return visualizeDepth(
        node as FloatNode,
        scale !== undefined ? float(scale) : undefined,
        bias !== undefined ? float(bias) : undefined,
      )
    case "heatmap":
      return visualizeHeatmap(
        node as FloatNode,
        scale !== undefined ? float(scale) : undefined,
        bias !== undefined ? float(bias) : undefined,
      )
    case "passthrough":
    default:
      return node as Vec4Node
  }
}
