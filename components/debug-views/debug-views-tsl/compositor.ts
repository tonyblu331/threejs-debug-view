import { float, mix, vec2, vec4, viewportUV } from "three/tsl"
import type { FloatNode, Vec2Node, Vec4Node } from "./node-types"
import type { DebugViewUniforms } from "./uniforms"
import {
  visualizeGrayscale,
  visualizeNormal,
  visualizePosition,
  visualizeUV,
  visualizeAO,
  visualizeHeatmap,
  visualizeDepth,
  visualizeValue,
} from "./visualize"

export type VisualizationType =
  | "grayscale"
  | "normal"
  | "position"
  | "uv"
  | "ao"
  | "heatmap"
  | "depth"
  | "value"
  | "passthrough"

export interface DebugChannel {
  node: any
  visualization: VisualizationType
  label?: string
  scale?: number
  bias?: number
}

export interface CompositorConfig {
  channels: DebugChannel[]
  layout?: "single" | "split-h" | "split-v" | "quad" | "overlay"
  uniforms: DebugViewUniforms
}

function applyVisualization(channel: DebugChannel): Vec4Node {
  const { node, visualization, scale, bias } = channel
  const s = scale !== undefined ? float(scale) : undefined
  const b = bias !== undefined ? float(bias) : undefined

  switch (visualization) {
    case "grayscale":
      return visualizeGrayscale(node, s, b)
    case "normal":
      return visualizeNormal(node)
    case "position":
      return visualizePosition(node, s)
    case "uv":
      return visualizeUV(node)
    case "ao":
      return visualizeAO(node)
    case "heatmap":
      return visualizeHeatmap(node, s, b)
    case "depth":
      return visualizeDepth(node, s, b)
    case "value":
      return visualizeValue(node)
    case "passthrough":
    default:
      return node
  }
}

function splitHorizontal(
  left: Vec4Node,
  right: Vec4Node,
  splitPos: FloatNode,
  uv: Vec2Node,
): Vec4Node {
  return uv.x.lessThan(splitPos).select(left, right)
}

function splitVertical(
  top: Vec4Node,
  bottom: Vec4Node,
  splitPos: FloatNode,
  uv: Vec2Node,
): Vec4Node {
  return uv.y.lessThan(splitPos).select(top, bottom)
}

function quadLayout(
  tl: Vec4Node,
  tr: Vec4Node,
  bl: Vec4Node,
  br: Vec4Node,
  uv: Vec2Node,
): Vec4Node {
  const half = float(0.5)
  const isLeft = uv.x.lessThan(half)
  const isTop = uv.y.greaterThan(half)

  return isTop.select(
    isLeft.select(tl, tr),
    isLeft.select(bl, br),
  )
}

export function createCompositorNode(config: CompositorConfig): Vec4Node {
  const { channels, layout = "single", uniforms } = config
  const uv = viewportUV

  if (channels.length === 0) {
    return vec4(0, 0, 0, 1)
  }

  const visualized = channels.map(applyVisualization)

  switch (layout) {
    case "single": {
      const idx = uniforms.activeChannel
      let result = visualized[0]
      for (let i = 1; i < visualized.length; i++) {
        result = idx.greaterThan(float(i - 0.5)).select(visualized[i], result)
      }
      return result
    }

    case "split-h": {
      const left = visualized[0] ?? vec4(0, 0, 0, 1)
      const right = visualized[1] ?? visualized[0] ?? vec4(0, 0, 0, 1)
      return splitHorizontal(left, right, uniforms.splitPosition, uv)
    }

    case "split-v": {
      const top = visualized[0] ?? vec4(0, 0, 0, 1)
      const bottom = visualized[1] ?? visualized[0] ?? vec4(0, 0, 0, 1)
      return splitVertical(top, bottom, uniforms.splitPosition, uv)
    }

    case "quad": {
      const tl = visualized[0] ?? vec4(0, 0, 0, 1)
      const tr = visualized[1] ?? tl
      const bl = visualized[2] ?? tl
      const br = visualized[3] ?? tr
      return quadLayout(tl, tr, bl, br, uv)
    }

    case "overlay": {
      const base = visualized[0] ?? vec4(0, 0, 0, 1)
      const overlay = visualized[1] ?? visualized[0] ?? vec4(1, 0, 1, 1)
      return mix(base, overlay, uniforms.opacity)
    }

    default:
      return visualized[0]
  }
}
