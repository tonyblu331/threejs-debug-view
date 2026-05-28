import { float, uniform, vec2 } from "three/tsl"
import type { FloatNode, Vec2Node } from "./node-types"

export interface DebugViewUniforms {
  activeChannel: FloatNode
  splitPosition: FloatNode
  opacity: FloatNode
  viewportSize: Vec2Node
}

export function createDebugViewUniforms(): DebugViewUniforms {
  return {
    activeChannel: uniform(0),
    splitPosition: uniform(0.5),
    opacity: uniform(1),
    viewportSize: uniform(vec2(1, 1)),
  }
}

export function updateDebugViewUniforms(
  uniforms: DebugViewUniforms,
  activeChannel: number,
  splitPosition: number,
  opacity: number,
  width: number,
  height: number,
) {
  uniforms.activeChannel.value = activeChannel
  uniforms.splitPosition.value = splitPosition
  uniforms.opacity.value = opacity
  uniforms.viewportSize.value.set(width, height)
}
