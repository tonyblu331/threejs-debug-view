import { clamp, floor, float, mix, mod, sub, vec3, vec4 } from "three/tsl"
import type { FloatNode, Vec2Node, Vec3Node, Vec4Node } from "./node-types"

export function visualizeGrayscale(node: FloatNode, scale = float(1), bias = float(0)): Vec4Node {
  const v = clamp(node.mul(scale).add(bias), 0, 1)
  return vec4(v, v, v, 1)
}

export function visualizeNormal(normalNode: Vec3Node): Vec4Node {
  return vec4(normalNode.mul(0.5).add(0.5), 1)
}

export function visualizePosition(positionNode: Vec3Node, scale = float(0.001)): Vec4Node {
  const scaled = positionNode.mul(scale)
  const wrapped = scaled.sub(floor(scaled))
  return vec4(wrapped, 1)
}

export function visualizeUV(uvNode: Vec2Node): Vec4Node {
  return vec4(uvNode.x, uvNode.y, 0, 1)
}

export function visualizeAO(aoNode: FloatNode): Vec4Node {
  const v = clamp(aoNode, 0, 1)
  return vec4(v, v, v, 1)
}

export function visualizeHeatmap(node: FloatNode, scale = float(1), bias = float(0)): Vec4Node {
  const v = clamp(node.mul(scale).add(bias), 0, 1)
  const cold = vec3(0, 0, 1)
  const mid = vec3(0, 1, 0)
  const hot = vec3(1, 0, 0)
  const color = v.lessThan(0.5).select(mix(cold, mid, v.mul(2)), mix(mid, hot, v.mul(2).sub(1)))
  return vec4(color, 1)
}

export function visualizeSplit(
  leftNode: Vec4Node,
  rightNode: Vec4Node,
  splitPos = float(0.5),
  uv: Vec2Node,
): Vec4Node {
  return uv.x.lessThan(splitPos).select(leftNode, rightNode)
}

export function visualizeOverlay(
  baseNode: Vec4Node,
  overlayNode: Vec4Node,
  opacity = float(0.5),
): Vec4Node {
  return mix(baseNode, overlayNode, opacity)
}

export function visualizeDepth(depthNode: FloatNode, near = float(0.1), far = float(100)): Vec4Node {
  const linearDepth = depthNode.mul(far).add(near).mul(sub(1, depthNode))
  const normalized = clamp(linearDepth.sub(near).div(far.sub(near)), 0, 1)
  const inverted = sub(1, normalized)
  return vec4(inverted, inverted, inverted, 1)
}

export function visualizeCheckerboard(uv: Vec2Node, scale = float(8)): Vec4Node {
  const scaled = uv.mul(scale)
  const fx = scaled.x.sub(floor(scaled.x))
  const fy = scaled.y.sub(floor(scaled.y))
  const checker = fx.add(fy).mod(2).lessThan(1).select(float(0.3), float(0.7))
  return vec4(checker, checker, checker, 1)
}

export function visualizeValue(node: FloatNode): Vec4Node {
  const v = clamp(node, 0, 1)
  return vec4(v, v, v, 1)
}

export function visualizeChannels(
  r: FloatNode,
  g: FloatNode,
  b: FloatNode,
  scale = float(1),
): Vec4Node {
  return vec4(
    clamp(r.mul(scale), 0, 1),
    clamp(g.mul(scale), 0, 1),
    clamp(b.mul(scale), 0, 1),
    1,
  )
}
