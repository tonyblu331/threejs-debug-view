import { useEffect, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { RenderPipeline, mrt, normalView, output, type WebGPURenderer } from "three/webgpu"
import { pass } from "three/tsl"
import {
  createCompositorNode,
  type DebugChannel,
  type VisualizationType,
} from "./debug-views-nodes"
import { createDebugViewUniforms, updateDebugViewUniforms, type DebugViewUniforms } from "./debug-views-nodes"

export interface DebugViewsProps {
  channels: DebugChannel[]
  layout?: "single" | "split-h" | "split-v" | "quad" | "overlay"
  activeChannel?: number
  splitPosition?: number
  opacity?: number
  enabled?: boolean
  useMRT?: boolean
}

export function DebugViews({
  channels,
  layout = "single",
  activeChannel = 0,
  splitPosition = 0.5,
  opacity = 1,
  enabled = true,
  useMRT = false,
}: DebugViewsProps) {
  const { camera, gl, scene } = useThree()

  const uniforms = useMemo(() => createDebugViewUniforms(), [])

  const renderPipeline = useMemo(() => {
    if (!enabled) return null

    const scenePass = pass(scene, camera)

    if (useMRT) {
      scenePass.setMRT(
        mrt({
          output,
          normal: normalView,
        }),
      )
    }

    const outputNode = createCompositorNode({
      channels,
      layout,
      uniforms,
    })

    return new RenderPipeline(gl as unknown as WebGPURenderer, outputNode)
  }, [camera, gl, scene, channels, layout, uniforms, enabled, useMRT])

  useEffect(() => {
    return () => renderPipeline?.dispose()
  }, [renderPipeline])

  useFrame(() => {
    if (!renderPipeline) return

    updateDebugViewUniforms(
      uniforms,
      activeChannel,
      splitPosition,
      opacity,
      gl.domElement.width,
      gl.domElement.height,
    )

    renderPipeline.render()
  }, 1)

  return null
}
