import { expect, test } from "@playwright/test"
import {
  collectRelevantConsoleMessages,
  expectCanvasRenders,
  expectLevaHidden,
  expectViewportPaneLabels,
  expectViewportPaneLabelsHidden,
  waitForDemoOrSkip,
} from "./helpers/debug-demo"

test.describe("debug demo headless flows", () => {
  test("social capture preset shows breakdown labels and shader legend without Leva", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?capture=social")
    await waitForDemoOrSkip(page)

    await expectLevaHidden(page)
    await expectViewportPaneLabels(page, ["Normal", "Complexity", "Albedo", "Depth"])
    await expect(page.getByText("shader complexity", { exact: true })).toBeVisible()
    await expect(page.getByText("low", { exact: true })).toBeVisible()
    await expect(page.getByText("high", { exact: true })).toBeVisible()
    await expectCanvasRenders(page)
    expect(messages).toEqual([])
  })

  test("viewport-scaled preset renders split panes with labels and no Leva", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?e2e=viewport-scaled")
    await waitForDemoOrSkip(page)

    await expectLevaHidden(page)
    await expectViewportPaneLabels(page, ["Beauty", "Normals"])
    await expectCanvasRenders(page)
    expect(messages).toEqual([])
  })

  test("breakdown preset shows viewport labels when showLabels is enabled", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?e2e=breakdown-labels-on")
    await waitForDemoOrSkip(page)

    await expectLevaHidden(page)
    await expectViewportPaneLabels(page, ["Beauty", "Normal", "Depth", "Albedo"])
    await expectCanvasRenders(page)
    expect(messages).toEqual([])
  })

  test("breakdown preset hides viewport labels when showLabels is disabled", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?e2e=breakdown-labels-off")
    await waitForDemoOrSkip(page)

    await expectLevaHidden(page)
    await expectViewportPaneLabelsHidden(page, ["Beauty", "Normal", "Depth", "Albedo"])
    await expectCanvasRenders(page)
    expect(messages).toEqual([])
  })

  test("shader complexity click places a sample marker on the legend ramp", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/")
    await waitForDemoOrSkip(page)

    await page.getByRole("combobox", { name: "View" }).selectOption({ label: "Shader Complexity" })
    await expect(page.getByText("shader complexity", { exact: true })).toBeVisible()

    const canvas = page.locator("canvas")
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()

    await canvas.click({
      position: {
        x: Math.floor(box!.width / 2),
        y: Math.floor(box!.height / 2),
      },
    })

    await expect(page.getByText("shader complexity", { exact: true })).toHaveCount(0)
    await expectCanvasRenders(page)
    expect(messages).toEqual([])
  })

  test("overlap preset hides diagnostic legends when showLegends is disabled", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?scene=overdraw&debugView=overdraw&e2e=overlap-no-legends")
    await waitForDemoOrSkip(page)

    await expectLevaHidden(page)
    await expect(page.getByText("none", { exact: true })).toHaveCount(0)
    await expect(page.getByText("heavy", { exact: true })).toHaveCount(0)
    await expectCanvasRenders(page)
    expect(messages).toEqual([])
  })
})
