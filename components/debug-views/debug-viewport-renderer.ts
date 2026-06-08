import { PerspectiveCamera, Vector2, Vector4, type Camera, type Scene } from "three"
import type { WebGPURenderer } from "three/webgpu"
import type { DebugDividerStyle } from "./debug-divider-style"
import { createDebugRenderPlan } from "./debug-render-plan"
import {
  createDebugPipelineRuntime,
  SINGLE_VIEW_LAYOUT,
} from "./debug-pipeline-runtime"
import type { DebugViewportPlan } from "./debug-viewport-plan"
import type { DebugViewportRenderGraphPlan } from "./debug-render-graph-plan"
import {
  createDebugViewportRects,
  toDebugViewportPixels,
} from "./debug-viewport-presenter"
import { updateDebugViewUniforms, type DebugViewUniforms } from "./debug-views-tsl/uniforms"

const IS_DEV = Boolean(import.meta.env?.DEV)

export interface DebugViewportRenderer {
  render: () => void
  dispose: () => void
}

export interface CreateDebugViewportRendererOptions {
  gl: WebGPURenderer
  scene: Scene
  defaultCamera: Camera
  viewportPlan: DebugViewportPlan
  viewportGraph: DebugViewportRenderGraphPlan
  uniforms: DebugViewUniforms
  /**
   * Per-pane compositor opacity. Defaults to `1` because each cell is an
   * independent single-view pass blitted into a scissor rect (not an overlay blend).
   */
  overlayOpacity?: number
  /** Divider uniforms for parity with `updateDebugViewUniforms`; ignored by single-view passes. */
  dividerStyle?: DebugDividerStyle
}

export function createDebugViewportRenderer({
  gl,
  scene,
  defaultCamera,
  viewportPlan,
  viewportGraph,
  uniforms,
  overlayOpacity = 1,
  dividerStyle,
}: CreateDebugViewportRendererOptions): DebugViewportRenderer {
  const viewportRects = createDebugViewportRects(viewportPlan)
  const passRuntimes = viewportGraph.passes.map((graphPass) => {
    const passPlan = createDebugRenderPlan([graphPass.view], 0, SINGLE_VIEW_LAYOUT)
    const camera = graphPass.camera ?? defaultCamera

    return {
      camera,
      runtime: createDebugPipelineRuntime(
        scene,
        camera,
        passPlan,
        SINGLE_VIEW_LAYOUT,
        gl,
        uniforms,
        graphPass.resolutionScale,
      ),
    }
  })
  const rendererSize = new Vector2()
  const previousViewport = new Vector4()
  const previousScissor = new Vector4()
  const cameraAspects = new Map<PerspectiveCamera, number>()

  return {
    render: () => {
      gl.getSize(rendererSize)
      const previousScissorTest = gl.getScissorTest()
      gl.getViewport(previousViewport)
      gl.getScissor(previousScissor)
      gl.setScissorTest(false)
      gl.setViewport(0, 0, rendererSize.x, rendererSize.y)
      gl.clear(true, true, false)
      gl.setScissorTest(true)

      try {
        for (const cell of viewportGraph.cells) {
          const rect = viewportRects[cell.index]
          const passRuntime = passRuntimes[cell.passIndex]
          if (!rect || !passRuntime) {
            warnMissingViewportCell(
              viewportGraph,
              cell.index,
              cell.passIndex,
              Boolean(rect),
              Boolean(passRuntime),
            )
            continue
          }

          const viewportRect = toDebugViewportPixels(rect.scissor, rendererSize)
          gl.setViewport(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height)
          gl.setScissor(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height)
          passRuntime.runtime.setViewport(
            0,
            0,
            viewportRect.width,
            viewportRect.height,
          )
          setCameraAspectForViewport(
            passRuntime.camera,
            viewportRect.width,
            viewportRect.height,
            cameraAspects,
          )
          updateDebugViewUniforms(
            uniforms,
            0,
            SINGLE_VIEW_LAYOUT,
            1,
            overlayOpacity,
            dividerStyle,
          )
          passRuntime.runtime.pipeline.render()
        }
      } finally {
        restoreCameraAspects(cameraAspects)
        gl.setViewport(previousViewport)
        gl.setScissor(previousScissor)
        gl.setScissorTest(previousScissorTest)
      }
    },
    dispose: () => {
      for (const passRuntime of passRuntimes) {
        passRuntime.runtime.dispose()
      }
    },
  }
}

function setCameraAspectForViewport(
  camera: Camera,
  width: number,
  height: number,
  previousAspects: Map<PerspectiveCamera, number>,
) {
  if (!(camera instanceof PerspectiveCamera) || height <= 0) return

  if (!previousAspects.has(camera)) {
    previousAspects.set(camera, camera.aspect)
  }

  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function restoreCameraAspects(previousAspects: Map<PerspectiveCamera, number>) {
  for (const [camera, aspect] of previousAspects) {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }

  previousAspects.clear()
}

const warnedMissingViewportCells = new Set<string>()

function warnMissingViewportCell(
  viewportGraph: DebugViewportRenderGraphPlan,
  cellIndex: number,
  passIndex: number,
  hasRect: boolean,
  hasPassRuntime: boolean,
) {
  if (!IS_DEV) return

  const key = `${cellIndex}:${passIndex}`
  if (warnedMissingViewportCells.has(key)) return
  warnedMissingViewportCells.add(key)

  console.warn(
    "[threejs-debug-view] Skipping viewport cell: render graph cell does not match rects or pass runtimes.",
    {
      cellIndex,
      passIndex,
      cellCount: viewportGraph.cells.length,
      passCount: viewportGraph.passes.length,
      hasRect,
      hasPassRuntime,
    },
  )
}
