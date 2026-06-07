import type { Camera } from "three"
import type { DebugNode } from "./debug-views-tsl/node-types"
import type { DebugView } from "./debug-views-tsl/compositor"
import { getDefaultDebugViewSource, getResolvedDebugViewMode } from "./debug-view-selection"
import type {
  DebugViewportCell,
  DebugViewportPlan,
  DebugViewportResolutionScale,
} from "./debug-viewport-plan"

export interface DebugViewportRenderPassPlan {
  key: string
  view: DebugView
  camera?: Camera
  resolutionScale: DebugViewportResolutionScale
}

export interface DebugViewportRenderGraphCell extends DebugViewportCell {
  passIndex: number
}

export interface DebugViewportRenderGraphPlan {
  passes: DebugViewportRenderPassPlan[]
  cells: DebugViewportRenderGraphCell[]
}

export function createDebugViewportRenderGraphPlan(
  plan: DebugViewportPlan,
): DebugViewportRenderGraphPlan {
  const passes = plan.cells.map((cell): DebugViewportRenderPassPlan => ({
    key: createRenderPassKey(cell),
    view: cell.view,
    camera: cell.camera,
    resolutionScale: cell.resolutionScale,
  }))

  const cells = plan.cells.map((cell, index): DebugViewportRenderGraphCell => {
    return { ...cell, passIndex: index }
  })

  return { passes, cells }
}

const customNodeKeys = new WeakMap<DebugNode, number>()
let nextCustomNodeKey = 0

function createRenderPassKey(cell: DebugViewportCell) {
  const source = getDefaultDebugViewSource(cell.view)
  const mode = getResolvedDebugViewMode(cell.view)
  const identity = cell.view.id
    ? `id:${cell.view.id}`
    : cell.view.node
      ? `node:${getCustomNodeKey(cell.view.node)}`
      : "default"
  const camera = cell.camera ? `camera:${cell.camera.uuid}` : "camera:default"
  return [
    `cell:${cell.index}`,
    source,
    mode,
    identity,
    camera,
    cell.resolutionScale,
    cell.view.scale ?? "scale:default",
    cell.view.bias ?? "bias:default",
  ].join("|")
}

function getCustomNodeKey(node: DebugNode) {
  let key = customNodeKeys.get(node)
  if (key === undefined) {
    key = nextCustomNodeKey
    nextCustomNodeKey += 1
    customNodeKeys.set(node, key)
  }

  return key
}
