// TSL Nodes — use these to build custom debug pipelines
export {
  visualizeGrayscale,
  visualizeNormal,
  visualizePosition,
  visualizeUV,
  visualizeAO,
  visualizeHeatmap,
  visualizeSplit,
  visualizeOverlay,
  visualizeDepth,
  visualizeCheckerboard,
  visualizeValue,
  visualizeChannels,
} from "./debug-views-tsl/visualize"

export { createCompositorNode, type DebugChannel, type CompositorConfig, type VisualizationType } from "./debug-views-tsl/compositor"

export {
  createDebugViewUniforms,
  updateDebugViewUniforms,
  type DebugViewUniforms,
} from "./debug-views-tsl/uniforms"

export type { FloatNode, Vec2Node, Vec3Node, Vec4Node } from "./debug-views-tsl/node-types"

// Scene Pass Helper — extracts color, depth, normal, position from a scene
export { createScenePass, type ScenePassData } from "./debug-views-tsl/scene-pass"

// R3F Component — drop-in for React Three Fiber scenes
export { DebugViews, type DebugViewsProps } from "./debug-views-post"

// Leva Controls — interactive GUI for debugging
export { useDebugViewsControls } from "./use-debug-views-controls"
