import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { PerspectiveCamera, Scene, Vector2, Vector4 } from "three"
import { DEFAULT_DEBUG_VIEWS } from "./debug-view-definitions"
import { createDebugViewportRenderGraphPlan } from "./debug-render-graph-plan"
import { createDebugViewportPlan } from "./debug-viewport-plan"
import { toDebugViewportPixels } from "./debug-viewport-presenter"
import { createDebugViewUniforms } from "./debug-views-tsl/uniforms"

const mockCreateDebugViewportRects = vi.hoisted(() => vi.fn())

vi.mock("./debug-viewport-presenter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./debug-viewport-presenter")>()
  return {
    ...actual,
    createDebugViewportRects: mockCreateDebugViewportRects,
  }
})

const {
  mockPipelineRender,
  mockRuntimeDispose,
  mockSetViewport,
  createDebugPipelineRuntime,
} = vi.hoisted(() => {
  const mockPipelineRender = vi.fn()
  const mockRuntimeDispose = vi.fn()
  const mockSetViewport = vi.fn()
  const createDebugPipelineRuntime = vi.fn(() => ({
    pipeline: { render: mockPipelineRender },
    setViewport: mockSetViewport,
    dispose: mockRuntimeDispose,
  }))

  return {
    mockPipelineRender,
    mockRuntimeDispose,
    mockSetViewport,
    createDebugPipelineRuntime,
  }
})

vi.mock("./debug-pipeline-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./debug-pipeline-runtime")>()
  return {
    ...actual,
    createDebugPipelineRuntime,
  }
})

import { createDebugViewportRenderer } from "./debug-viewport-renderer"

type ViewportRendererGl = {
  getSize: (target: Vector2) => void
  getScissorTest: () => boolean
  getViewport: (target: Vector4) => Vector4
  getScissor: (target: Vector4) => Vector4
  setScissorTest: (value: boolean) => void
  setViewport: (...args: [number, number, number, number] | [Vector4]) => void
  setScissor: (...args: [number, number, number, number] | [Vector4]) => void
  clear: (color: boolean, depth: boolean, stencil: boolean) => void
}

describe("createDebugViewportRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateDebugViewportRects.mockImplementation((plan) => {
      const { columns, rows } = plan.layout
      const width = 1 / columns
      const height = 1 / rows

      return plan.cells.map((cell: { index: number }) => {
        const columnIndex = cell.index % columns
        const rowIndex = Math.floor(cell.index / columns)

        return {
          index: cell.index,
          css: { column: columnIndex + 1, row: rowIndex + 1 },
          scissor: {
            x: columnIndex * width,
            y: 1 - (rowIndex + 1) * height,
            width,
            height,
          },
        }
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("clears the canvas, renders every viewport cell, and restores gl state", () => {
    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [{ view: "beauty" }, { view: "normal", resolutionScale: 0.5 }],
      layout: "split-h",
    })
    const viewportGraph = createDebugViewportRenderGraphPlan(viewportPlan)
    const scene = new Scene()
    const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 100)
    const originalAspect = camera.aspect
    const previousViewport = new Vector4(10, 20, 800, 600)
    const previousScissor = new Vector4(30, 40, 400, 300)
    const rendererSize = new Vector2(1280, 720)

    const gl: ViewportRendererGl = {
      getSize: vi.fn((target) => {
        target.copy(rendererSize)
      }),
      getScissorTest: vi.fn(() => true),
      getViewport: vi.fn((target) => target.copy(previousViewport)),
      getScissor: vi.fn((target) => target.copy(previousScissor)),
      setScissorTest: vi.fn(),
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      clear: vi.fn(),
    }

    const renderer = createDebugViewportRenderer({
      gl: gl as never,
      scene,
      defaultCamera: camera,
      viewportPlan,
      viewportGraph,
      uniforms: createDebugViewUniforms(),
    })

    renderer.render()

    const cellCount = viewportGraph.cells.length

    expect(gl.clear).toHaveBeenCalledWith(true, true, false)
    expect(gl.setViewport).toHaveBeenCalledWith(0, 0, rendererSize.x, rendererSize.y)
    expect(gl.setScissorTest).toHaveBeenCalledWith(false)
    expect(gl.setScissorTest).toHaveBeenCalledWith(true)
    expect(createDebugPipelineRuntime).toHaveBeenCalledTimes(viewportGraph.passes.length)
    expect(mockPipelineRender).toHaveBeenCalledTimes(cellCount)
    expect(mockSetViewport).toHaveBeenCalledTimes(cellCount)
    expect(createDebugPipelineRuntime).toHaveBeenNthCalledWith(
      2,
      scene,
      camera,
      expect.any(Object),
      expect.objectContaining({ mode: "single" }),
      gl,
      expect.any(Object),
      0.5,
    )

    const firstCellRect = toDebugViewportPixels(
      mockCreateDebugViewportRects.mock.results[0]!.value[0]!.scissor,
      rendererSize,
    )
    expect(gl.setViewport).toHaveBeenCalledWith(
      firstCellRect.x,
      firstCellRect.y,
      firstCellRect.width,
      firstCellRect.height,
    )
    expect(gl.setScissor).toHaveBeenCalledWith(
      firstCellRect.x,
      firstCellRect.y,
      firstCellRect.width,
      firstCellRect.height,
    )

    expect(gl.setViewport).toHaveBeenLastCalledWith(previousViewport)
    expect(gl.setScissor).toHaveBeenLastCalledWith(previousScissor)
    expect(gl.setScissorTest).toHaveBeenLastCalledWith(true)
    expect(camera.aspect).toBe(originalAspect)

    renderer.dispose()
    expect(mockRuntimeDispose).toHaveBeenCalledTimes(viewportGraph.passes.length)
  })

  it("restores gl state when pipeline render throws", () => {
    mockPipelineRender.mockImplementationOnce(() => {
      throw new Error("render failed")
    })

    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [{ view: "beauty" }, { view: "normal", resolutionScale: 0.5 }],
      layout: "split-h",
    })
    const viewportGraph = createDebugViewportRenderGraphPlan(viewportPlan)
    const previousViewport = new Vector4(10, 20, 800, 600)
    const previousScissor = new Vector4(30, 40, 400, 300)
    const rendererSize = new Vector2(1280, 720)

    const gl: ViewportRendererGl = {
      getSize: vi.fn((target) => target.copy(rendererSize)),
      getScissorTest: vi.fn(() => true),
      getViewport: vi.fn((target) => target.copy(previousViewport)),
      getScissor: vi.fn((target) => target.copy(previousScissor)),
      setScissorTest: vi.fn(),
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      clear: vi.fn(),
    }

    const renderer = createDebugViewportRenderer({
      gl: gl as never,
      scene: new Scene(),
      defaultCamera: new PerspectiveCamera(60, 16 / 9, 0.1, 100),
      viewportPlan,
      viewportGraph,
      uniforms: createDebugViewUniforms(),
    })

    expect(() => renderer.render()).toThrow("render failed")
    expect(gl.setViewport).toHaveBeenLastCalledWith(previousViewport)
    expect(gl.setScissor).toHaveBeenLastCalledWith(previousScissor)
    expect(gl.setScissorTest).toHaveBeenLastCalledWith(true)
  })

  it("computes viewport rects once when the renderer is created", () => {
    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [{ view: "beauty" }, { view: "normal", resolutionScale: 0.5 }],
      layout: "split-h",
    })
    const viewportGraph = createDebugViewportRenderGraphPlan(viewportPlan)
    const gl: ViewportRendererGl = {
      getSize: vi.fn((target) => target.set(1280, 720)),
      getScissorTest: vi.fn(() => false),
      getViewport: vi.fn((target) => target.set(0, 0, 1280, 720)),
      getScissor: vi.fn((target) => target.set(0, 0, 1280, 720)),
      setScissorTest: vi.fn(),
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      clear: vi.fn(),
    }

    const renderer = createDebugViewportRenderer({
      gl: gl as never,
      scene: new Scene(),
      defaultCamera: new PerspectiveCamera(60, 16 / 9, 0.1, 100),
      viewportPlan,
      viewportGraph,
      uniforms: createDebugViewUniforms(),
    })

    renderer.render()
    renderer.render()

    expect(mockCreateDebugViewportRects).toHaveBeenCalledTimes(1)
    expect(mockCreateDebugViewportRects).toHaveBeenCalledWith(viewportPlan)
  })

  it("applies overlayOpacity to per-pane uniforms", () => {
    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [{ view: "beauty", resolutionScale: 0.5 }],
      layout: "single",
    })
    const viewportGraph = createDebugViewportRenderGraphPlan(viewportPlan)
    const uniforms = createDebugViewUniforms()
    const gl: ViewportRendererGl = {
      getSize: vi.fn((target) => target.set(1280, 720)),
      getScissorTest: vi.fn(() => false),
      getViewport: vi.fn((target) => target.set(0, 0, 1280, 720)),
      getScissor: vi.fn((target) => target.set(0, 0, 1280, 720)),
      setScissorTest: vi.fn(),
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      clear: vi.fn(),
    }

    const renderer = createDebugViewportRenderer({
      gl: gl as never,
      scene: new Scene(),
      defaultCamera: new PerspectiveCamera(60, 16 / 9, 0.1, 100),
      viewportPlan,
      viewportGraph,
      uniforms,
      overlayOpacity: 0.42,
    })

    renderer.render()

    expect(uniforms.overlayOpacity.value).toBe(0.42)
  })

  it("warns once in dev when a render-graph cell has no rect or pass runtime", () => {
    const viewportPlan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [{ view: "beauty" }, { view: "normal", resolutionScale: 0.5 }],
      layout: "split-h",
    })
    const viewportGraph = createDebugViewportRenderGraphPlan(viewportPlan)
    viewportGraph.cells.push({
      ...viewportPlan.cells[0]!,
      index: 99,
      passIndex: 99,
    })

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const gl: ViewportRendererGl = {
      getSize: vi.fn((target) => target.set(1280, 720)),
      getScissorTest: vi.fn(() => false),
      getViewport: vi.fn((target) => target.set(0, 0, 1280, 720)),
      getScissor: vi.fn((target) => target.set(0, 0, 1280, 720)),
      setScissorTest: vi.fn(),
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      clear: vi.fn(),
    }

    const renderer = createDebugViewportRenderer({
      gl: gl as never,
      scene: new Scene(),
      defaultCamera: new PerspectiveCamera(60, 16 / 9, 0.1, 100),
      viewportPlan,
      viewportGraph,
      uniforms: createDebugViewUniforms(),
    })

    renderer.render()
    renderer.render()

    const validCellCount = viewportPlan.cells.length

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain("Skipping viewport cell")
    expect(mockPipelineRender).toHaveBeenCalledTimes(validCellCount * 2)
  })
})
