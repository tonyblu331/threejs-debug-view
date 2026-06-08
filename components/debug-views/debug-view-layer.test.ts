import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const moduleDir = dirname(fileURLToPath(import.meta.url))

describe("debug view layer batteries-included surface", () => {
  it("exports DebugViewLeva from the r3f entrypoint", () => {
    const source = readFileSync(resolve(moduleDir, "r3f.ts"), "utf8")

    expect(source).toContain("DebugViewLeva")
    expect(source).toContain("DebugViewLayer")
    expect(source).toContain("useDebugViewsControls")
  })

  it("mounts the bundled Leva panel from DebugViewLayer by default", () => {
    const source = readFileSync(resolve(moduleDir, "debug-view-layer.tsx"), "utf8")

    expect(source).toContain("showLeva = true")
    expect(source).toContain("mountDebugViewLeva()")
    expect(source).toContain("useDebugViewsControls")
    expect(source).toContain("<DebugViews")
    expect(source).toContain("debug-views-r3f")
  })

  it("keeps showEnabledControl wired through controls", () => {
    const source = readFileSync(resolve(moduleDir, "debug-view-layer.tsx"), "utf8")

    expect(source).toContain("showEnabledControl")
  })
})
