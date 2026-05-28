import type { Node } from "three/webgpu"

export type FloatNode = Node<"float">
export type Vec2Node = Node<"vec2">
export type Vec3Node = Node<"vec3">
export type Vec4Node = Node<"vec4">

export type AnyNode = FloatNode | Vec2Node | Vec3Node | Vec4Node

export type DebugChannelName = string

export type VisualizationMode = "grayscale" | "rgb" | "heatmap" | "split" | "overlay"

export interface DebugChannel {
  name: DebugChannelName
  node: AnyNode
  mode?: VisualizationMode
  label?: string
  scale?: number
  bias?: number
}

export interface DebugViewConfig {
  channels: DebugChannel[]
  layout?: "single" | "split-h" | "split-v" | "quad" | "overlay"
  activeChannel?: number
  showLabels?: boolean
  opacity?: number
}

export interface ScenePassNodes {
  color: Vec4Node
  depth: FloatNode
  normal?: Vec3Node
  position?: Vec3Node
  ao?: FloatNode
  uv?: Vec2Node
}
