import { mrt, normalView, output, type WebGPURenderer } from "three/webgpu"
import { pass, viewportUV, getViewPosition, cameraProjectionMatrixInverse, cameraWorldMatrix, vec4 } from "three/tsl"
import type { Camera, Scene } from "three"
import type { FloatNode, Vec3Node, Vec4Node } from "./node-types"

export interface ScenePassData {
  color: Vec4Node
  depth: FloatNode
  normal: Vec3Node
  viewPosition: Vec3Node
  worldPosition: Vec3Node
  uv: any
  scenePass: any
}

export function createScenePass(scene: Scene, camera: Camera): ScenePassData {
  const scenePass = pass(scene, camera)

  scenePass.setMRT(
    mrt({
      output,
      normal: normalView,
    }),
  )

  const color = scenePass.getTextureNode("output") as Vec4Node
  const depth = scenePass.getTextureNode("depth") as FloatNode
  const normal = scenePass.getTextureNode("normal") as Vec3Node

  const viewPosition = getViewPosition(viewportUV, depth, cameraProjectionMatrixInverse)
  const worldPosition = cameraWorldMatrix.mul(vec4(viewPosition, 1)).xyz

  return {
    color,
    depth,
    normal,
    viewPosition,
    worldPosition,
    uv: viewportUV,
    scenePass,
  }
}
