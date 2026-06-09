import { expect, test } from "@playwright/test"
import {
  collectRelevantConsoleMessages,
  expectSelectedOption,
  getSceneTab,
  waitForDemoOrSkip,
} from "./helpers/debug-demo"

test.describe("debug demo controls", () => {
  test("keeps browser history and Leva view in sync", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?scene=overdraw&debugView=overdraw")
    await waitForDemoOrSkip(page)
    await expect(page).toHaveURL(/scene=overdraw/)
    await expect(page).toHaveURL(/debugView=overdraw/)
    await expect(getSceneTab(page, "Overlap")).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Measured Overlap")

    await getSceneTab(page, "Main").click()
    await expect(page).toHaveURL(/\/$/)
    await waitForDemoOrSkip(page)
    await expect(getSceneTab(page, "Main")).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Beauty")

    await page.goBack()
    await expect(page).toHaveURL(/scene=overdraw/)
    await waitForDemoOrSkip(page)
    await expect(getSceneTab(page, "Overlap")).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Measured Overlap")

    await page.goForward()
    await expect(page).toHaveURL(/\/$/)
    await waitForDemoOrSkip(page)
    await expect(getSceneTab(page, "Main")).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Beauty")
    expect(messages).toEqual([])
  })

  test("direct overlap URLs initialize the demo without stale Leva state", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?scene=overdraw&debugView=overdraw")
    await waitForDemoOrSkip(page)

    await expect(getSceneTab(page, "Overlap")).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Measured Overlap")
    await expect(page.getByText("0 layers", { exact: true })).toBeVisible()
    await expect(page.getByText("8+ layers", { exact: true })).toBeVisible()

    await getSceneTab(page, "Main").click()
    await expect(page).not.toHaveURL(/debugView=/)
    await expect(page).not.toHaveURL(/scene=/)
    await expectSelectedOption(page, "View", "Beauty")
    expect(messages).toEqual([])
  })

  test("shows only active layout controls and separates shader cost from timing", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?scene=overdraw&debugView=overdraw")
    await waitForDemoOrSkip(page)

    await page.getByRole("combobox", { name: "View" }).selectOption({ label: "Shader Complexity" })
    await expect(page.getByText("shader complexity", { exact: true })).toBeVisible()
    await expect(page.getByText("Enabled", { exact: true })).toHaveCount(0)
    await expect(page.getByText("timestamp query", { exact: true })).toHaveCount(0)
    await expect(page.getByText("GPU pass", { exact: true })).toHaveCount(0)
    await expect(page.getByText("scan", { exact: true })).toHaveCount(0)
    await expect(page.getByRole("combobox", { name: "Mode" })).toHaveCount(0)

    await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: "Quad" })

    await expect(page.getByRole("combobox", { name: "View" })).toHaveCount(0)
    await expect(page.getByRole("combobox", { name: "Pane 1" })).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Pane 4" })).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Pane 5" })).toHaveCount(0)
    await expect(page.getByText("Blend opacity", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Rows", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Columns", { exact: true })).toHaveCount(0)
    expect(messages).toEqual([])
  })

  test("only exposes controls that apply to the selected layout", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?scene=overdraw&debugView=overdraw")
    await waitForDemoOrSkip(page)

    await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: "Overlay" })
    await expect(page.getByText("Blend opacity", { exact: true })).toBeVisible()
    await expect(page.getByText("Rows", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Columns", { exact: true })).toHaveCount(0)

    await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: "Grid" })
    await expect(page.getByText("Blend opacity", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Rows", { exact: true })).toBeVisible()
    await expect(page.getByText("Columns", { exact: true })).toBeVisible()
    await expect(page.getByText("Panes", { exact: true })).toBeVisible()

    await expect(page.getByRole("combobox", { name: "Mode" })).toHaveCount(0)
    await expect(page.getByRole("combobox", { name: "View" })).toHaveCount(0)
    await expect(page.getByRole("combobox", { name: "Pane 1" })).toBeVisible()
    expect(messages).toEqual([])
  })

  test("exposes diagonal split controls without falling back to mode switching", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?scene=overdraw&debugView=overdraw")
    await waitForDemoOrSkip(page)

    await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: "Split Diagonal" })

    await expect(page.getByRole("combobox", { name: "Mode" })).toHaveCount(0)
    await expect(page.getByRole("combobox", { name: "View" })).toHaveCount(0)
    await expect(page.getByRole("combobox", { name: "Pane 1" })).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Pane 2" })).toBeVisible()
    await expect(page.getByText("Diagonal angle", { exact: true })).toBeVisible()
    await expect(page.getByText("Rows", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Columns", { exact: true })).toHaveCount(0)
    expect(messages).toEqual([])
  })

  test("exposes four-pane breakdown controls", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?scene=overdraw&debugView=overdraw")
    await waitForDemoOrSkip(page)

    await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: "Breakdown" })

    await expect(page.getByRole("combobox", { name: "Mode" })).toHaveCount(0)
    await expect(page.getByRole("combobox", { name: "View" })).toHaveCount(0)
    await expect(page.getByRole("combobox", { name: "Pane 1" })).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Pane 4" })).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Pane 5" })).toHaveCount(0)
    await expect(page.getByText("Diagonal angle", { exact: true })).toBeVisible()
    expect(messages).toEqual([])
  })

  test("smokes scene tabs across every layout preset", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/")
    await waitForDemoOrSkip(page)

    for (const tab of ["Main", "Overlap", "Lights"]) {
      await getSceneTab(page, tab).click()
      await expect(getSceneTab(page, tab)).toHaveAttribute("aria-selected", "true")

      for (const layout of [
        "Single",
        "Overlay",
        "Split H",
        "Split V",
        "Split Diagonal",
        "Breakdown",
        "Quad",
        "Row",
        "Column",
        "Grid",
      ]) {
        await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: layout })
        await expectSelectedOption(page, "Layout", layout)
        await expect(page.locator("canvas")).toBeVisible()
      }
    }

    await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: "Grid" })
    await expect(page.getByText("Rows", { exact: true })).toBeVisible()
    await expect(page.getByText("Columns", { exact: true })).toBeVisible()
    await expect(page.getByText("Panes", { exact: true })).toBeVisible()

    await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: "Breakdown" })
    await expect(page.getByRole("combobox", { name: "Pane 4" })).toBeVisible()
    await expect(page.getByText("Diagonal angle", { exact: true })).toBeVisible()

    expect(messages).toEqual([])
  })

  test("lights scene initializes estimated light overlap view", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?scene=lights&debugView=lightComplexity")
    await waitForDemoOrSkip(page)

    await expect(page).toHaveURL(/scene=lights/)
    await expect(page).toHaveURL(/debugView=lightComplexity/)
    await expect(getSceneTab(page, "Lights")).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Estimated Light Overlap")
    await expect(page.getByText("0 lights", { exact: true })).toBeVisible()
    await expect(page.getByText("8+ lights", { exact: true })).toBeVisible()
    expect(messages).toEqual([])
  })
})
