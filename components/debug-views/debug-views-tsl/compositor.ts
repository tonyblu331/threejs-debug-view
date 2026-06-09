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
  | "overdrawVisual"
  | "lightComplexity"
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
  const splitH  = selectByGrid(visualized, uniforms.viewCount, 2, 1, uniforms)
  const splitV  = selectByGrid(visualized, uniforms.viewCount, 1, 2, uniforms)
  const splitDiagonal = selectByDiagonal(visualized, uniforms.diagonalSlope, uniforms)
  const breakdown = selectByDiagonalBands(visualized, uniforms.diagonalSlope, uniforms)
  const quad    = selectByGrid(visualized, uniforms.viewCount, 2, 2, uniforms)
  const grid    = selectByGrid(
    visualized,
    uniforms.viewCount,
    uniforms.gridColumns,
    uniforms.gridRows,
    uniforms,
  )

  const isSingle  = uniforms.layout.equal(float(LAYOUT_INDEX.single))
  const isOverlay = uniforms.layout.equal(float(LAYOUT_INDEX.overlay))
  const isSplitH  = uniforms.layout.equal(float(LAYOUT_INDEX["split-h"]))
  const isSplitV  = uniforms.layout.equal(float(LAYOUT_INDEX["split-v"]))
  const isSplitDiagonal = uniforms.layout.equal(float(LAYOUT_INDEX["split-diagonal"]))
  const isBreakdown = uniforms.layout.equal(float(LAYOUT_INDEX.breakdown))
  const isQuad    = uniforms.layout.equal(float(LAYOUT_INDEX.quad))

  return isSingle.select(single,
         isOverlay.select(overlay,
         isSplitH.select(splitH,
         isSplitV.select(splitV,
         isSplitDiagonal.select(splitDiagonal,
         isBreakdown.select(breakdown,
         isQuad.select(quad,
         grid)))))))
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
      return selectByDiagonal(views, uniforms.diagonalSlope, uniforms)
    case "breakdown":
      return selectByDiagonalBands(views, uniforms.diagonalSlope, uniforms)
    case "grid":
      return selectByGrid(views, uniforms.viewCount, resolvedLayout.columns, resolvedLayout.rows, uniforms)
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
  uniforms: DebugViewUniforms,
): Vec4Node {
  if (views.length === 1) return views[0]

  const uv = screenUV
  const boundary = uv.x.sub(float(0.5)).add(uv.y.sub(float(0.5)).mul(slope))
  const split = boundary.greaterThanEqual(float(0))
  const result = split.select(views[1], views[0])

  return applyDivider(boundary.abs(), result, uniforms)
}

function selectByDiagonalBands(
  views: Vec4Node[],
  slope: DebugViewUniforms["diagonalSlope"],
  uniforms: DebugViewUniforms,
): Vec4Node {
  const uv = screenUV
  const projected = uv.x.add(uv.y.sub(float(0.5)).mul(slope))
  const distance = projected.sub(float(0.25)).abs()
    .min(projected.sub(float(0.5)).abs())
    .min(projected.sub(float(0.75)).abs())

  let result = views[0]
  for (let i = 1; i < Math.min(views.length, 4); i++) {
    result = projected.greaterThan(float(i / 4)).select(views[i], result)
  }

  return applyDivider(distance, result, uniforms)
}

function selectByGrid(
  views: Vec4Node[],
  viewCount: DebugViewUniforms["viewCount"],
  cols: GridAxis,
  rows: GridAxis,
  uniforms: DebugViewUniforms,
): Vec4Node {
  const uv = screenUV
  const fCols = toGridAxisNode(cols)
  const fRows = toGridAxisNode(rows)

  const col = uv.x.mul(fCols).floor()
  const row = fRows.sub(float(1)).sub(uv.y.mul(fRows).floor())
  const cellIdx = row.mul(fCols).add(col)

  const edgeX = uv.x.mul(fCols).fract()
  const edgeY = uv.y.mul(fRows).fract()
  const distance = edgeX.min(edgeY)

  let result: Vec4Node = views[0]
  for (let i = 1; i < views.length; i++) {
    result = cellIdx.equal(float(i)).select(views[i], result)
  }

  result = cellIdx.greaterThanEqual(viewCount).select(views[0], result)

  return applyDivider(distance, result, uniforms)
}

type GridAxis = number | DebugViewUniforms["gridColumns"] | DebugViewUniforms["gridRows"]

function applyDivider(
  distance: FloatNode,
  content: Vec4Node,
  uniforms: DebugViewUniforms,
): Vec4Node {
  const lineWidth = uniforms.dividerLineWidth
  const onDivider = distance.lessThan(lineWidth)
  const edgeMix = distance.div(lineWidth).clamp(0, 1).pow(float(0.55))
  const dividerColor = mix(uniforms.dividerCoreColor, uniforms.dividerEdgeColor, edgeMix)
  return onDivider.select(dividerColor, content)
}

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
