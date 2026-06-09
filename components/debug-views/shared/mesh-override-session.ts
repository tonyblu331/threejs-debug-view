import type { Object3D, Scene } from "three"
import {
  createSceneGraphRescanScheduler,
  type SceneGraphRescanScheduler,
} from "./scene-graph-cache"

export interface MeshOverrideSession<TEntry extends MeshOverrideSessionEntry> {
  prepare: (scene: Scene | Object3D) => void
  apply: (scene: Scene | Object3D) => MeshOverrideRestore
  invalidate: () => void
  dispose: () => void
}

export interface MeshOverrideRestore {
  restore: () => void
  readonly replacements: number
}

export interface MeshOverrideSessionEntry {
  parent: unknown | null
}

type SceneRoot = Scene | Object3D

export function createMeshOverrideSession<TEntry extends MeshOverrideSessionEntry>(options: {
  rebuild: (scene: SceneRoot) => TEntry[]
  applyEntry: (entry: TEntry) => void
  restoreEntry: (entry: TEntry) => void
  refreshEntry?: (entry: TEntry) => void
  scheduler?: SceneGraphRescanScheduler
}): MeshOverrideSession<TEntry> {
  const scheduler = options.scheduler ?? createSceneGraphRescanScheduler()
  let entries: TEntry[] = []
  let restored = true

  const rebuild = (scene: SceneRoot) => {
    entries = options.rebuild(scene)
    scheduler.markRescanned()
  }

  const prepare = (scene: SceneRoot) => {
    rebuild(scene)
  }

  const apply = (scene: SceneRoot): MeshOverrideRestore => {
    if (scheduler.shouldRescan(entries)) {
      rebuild(scene)
    } else if (options.refreshEntry) {
      for (const entry of entries) {
        options.refreshEntry(entry)
      }
    }

    for (const entry of entries) {
      options.applyEntry(entry)
    }

    restored = false

    return {
      restore() {
        if (restored) return

        for (const entry of entries) {
          options.restoreEntry(entry)
        }

        restored = true
      },
      get replacements() {
        return entries.length
      },
    }
  }

  return {
    prepare,
    apply,
    invalidate: scheduler.invalidate,
    dispose() {
      entries = []
      scheduler.dispose()
    },
  }
}
