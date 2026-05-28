import type { Node } from "three/webgpu"

export type FloatNode = Node<"float">
export type Vec2Node = Node<"vec2">
export type Vec3Node = Node<"vec3">
export type Vec4Node = Node<"vec4">

export interface DepthSampleNodes {
  rawDepth: FloatNode
  normalizedDepth: FloatNode
  linearDepth: FloatNode
  viewPosition: Vec3Node
  worldPosition: Vec3Node
  sceneSurfaceMask: FloatNode
}
