import { describe, expect, it } from "vitest"
import { createSceneGraphRescanScheduler } from "./scene-graph-cache"

describe("scene graph rescan scheduler", () => {
  it("rescans after the interval elapses", () => {
    const scheduler = createSceneGraphRescanScheduler(3)
    const tracked = [{ parent: {} }]

    scheduler.markRescanned()
    expect(scheduler.shouldRescan(tracked)).toBe(false)
    expect(scheduler.shouldRescan(tracked)).toBe(false)
    expect(scheduler.shouldRescan(tracked)).toBe(false)
    expect(scheduler.shouldRescan(tracked)).toBe(true)
  })

  it("forces a rescan when tracked nodes detach", () => {
    const scheduler = createSceneGraphRescanScheduler(30)
    const tracked = [{ parent: {} }]

    scheduler.markRescanned()
    expect(scheduler.shouldRescan([{ parent: null }])).toBe(true)
  })
})
