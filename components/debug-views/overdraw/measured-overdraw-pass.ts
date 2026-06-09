import { Color, type Camera, type RenderTarget, type Scene } from "three"
import { pass } from "three/tsl"
import type { DebugNode, FloatNode } from "../debug-views-tsl/node-types"
import {
  createMeasuredOverdrawOverride,
  type MeasuredOverdrawOverride,
} from "./measured-overdraw-override"

export interface MeasuredOverdrawPass {
  setResolutionScale(resolutionScale: number): void
  setViewport(x: number, y: number, width: number, height: number): void
  getTextureNode(name?: string): DebugNode
  getViewZNode(name?: string): FloatNode
  renderTarget: RenderTarget
  updateBefore(frame: unknown): unknown
  dispose(): void
}

interface ClearColorCapableRenderer {
  autoClear: boolean
  clear(color?: boolean, depth?: boolean, stencil?: boolean): void
  getClearAlpha?: () => number
  getClearColor?: (target: Color) => Color
  getRenderTarget(): unknown
  opaque: boolean
  render(scene: Scene, camera: Camera): void
  setClearColor(color: number | Color, alpha?: number): void
  setRenderTarget(target: unknown): void
  transparent: boolean
}

interface PassFrame {
  renderer: ClearColorCapableRenderer
}

export function createMeasuredOverdrawPass(
  scene: Scene,
  camera: Camera,
  resolutionScale: number,
  override: MeasuredOverdrawOverride = createMeasuredOverdrawOverride(),
): MeasuredOverdrawPass {
  const counterPass = pass(scene, camera) as unknown as MeasuredOverdrawPass

  counterPass.setResolutionScale(resolutionScale)

  counterPass.updateBefore = (frame: unknown) => {
    const { renderer } = frame as PassFrame
    const currentRenderTarget = renderer.getRenderTarget()
    const currentAutoClear = renderer.autoClear
    const currentTransparent = renderer.transparent
    const currentOpaque = renderer.opaque
    const savedClearColor = new Color()
    const hadClearColor = typeof renderer.getClearColor === "function"
    const savedClearAlpha = hadClearColor ? renderer.getClearAlpha?.() ?? 1 : 1
    if (hadClearColor) {
      renderer.getClearColor!(savedClearColor)
    }

    try {
      renderer.setRenderTarget(counterPass.renderTarget)

      const restorePrepass = override.applyDepthPrepass(scene)

      try {
        renderer.autoClear = true
        renderer.transparent = true
        renderer.opaque = true
        renderer.render(scene, camera)
      } finally {
        restorePrepass.restore()
      }

      const restoreCounter = override.applyCounter(scene)

      try {
        renderer.setClearColor(0x000000, 0)
        renderer.clear(true, false, false)
        renderer.autoClear = false
        renderer.transparent = true
        renderer.opaque = false
        renderer.render(scene, camera)
      } finally {
        restoreCounter.restore()
      }
    } finally {
      if (hadClearColor) {
        renderer.setClearColor(savedClearColor, savedClearAlpha)
      }
      renderer.setRenderTarget(currentRenderTarget)
      renderer.autoClear = currentAutoClear
      renderer.transparent = currentTransparent
      renderer.opaque = currentOpaque
    }

    return undefined
  }

  return counterPass
}
