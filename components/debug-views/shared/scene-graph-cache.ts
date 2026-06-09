export const DEFAULT_SCENE_GRAPH_RESCAN_FRAMES = 30

export interface SceneGraphRescanScheduler {
  invalidate: () => void
  shouldRescan: (tracked: readonly { parent: unknown | null }[]) => boolean
  markRescanned: () => void
  dispose: () => void
}

export function createSceneGraphRescanScheduler(
  interval = DEFAULT_SCENE_GRAPH_RESCAN_FRAMES,
): SceneGraphRescanScheduler {
  let framesUntilRescan = 0

  return {
    invalidate() {
      framesUntilRescan = 0
    },
    shouldRescan(tracked) {
      if (tracked.length === 0) {
        return true
      }

      if (framesUntilRescan <= 0) {
        return true
      }

      framesUntilRescan -= 1

      for (const entry of tracked) {
        if (entry.parent == null) {
          return true
        }
      }

      return false
    },
    markRescanned() {
      framesUntilRescan = interval
    },
    dispose() {
      framesUntilRescan = 0
    },
  }
}
