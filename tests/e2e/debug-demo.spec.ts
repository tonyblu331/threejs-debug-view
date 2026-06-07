import { expect, test, type Page } from "@playwright/test"

const allowedConsoleWarningPatterns = [
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/,
  /The powerPreference option is currently ignored when calling requestAdapter\(\) on Windows/,
  /WebGPU adapter is required for this demo e2e flow/,
]

test.describe("debug demo controls", () => {
  test("keeps browser history and Leva view in sync", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/?scene=overdraw&debugView=overdraw")
    await waitForDemoOrSkip(page)
    await expect(page).toHaveURL(/scene=overdraw/)
    await expect(page).toHaveURL(/debugView=overdraw/)
    await expect(getSceneTab(page, "Overlap")).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Overlap")

    await getSceneTab(page, "Main").click()
    await expect(page).toHaveURL(/\/$/)
    await waitForDemoOrSkip(page)
    await expect(getSceneTab(page, "Main")).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Beauty")

    await page.goBack()
    await expect(page).toHaveURL(/scene=overdraw/)
    await waitForDemoOrSkip(page)
    await expect(getSceneTab(page, "Overlap")).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Overlap")

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
    await expectSelectedOption(page, "View", "Overlap")
    await expect(page.getByText("pixel overlap", { exact: true })).toBeVisible()

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

    await page.getByRole("combobox", { name: "View" }).selectOption({ label: "Estimated Shader Complexity" })
    await expect(page.getByText("estimated shader complexity sample", { exact: true })).toBeVisible()
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
})

function collectRelevantConsoleMessages(page: Page) {
  const messages: string[] = []

  page.on("console", (message) => {
    const text = message.text()
    if (
      (message.type() === "error" || message.type() === "warning") &&
      !allowedConsoleWarningPatterns.some((pattern) => pattern.test(text))
    ) {
      messages.push(text)
    }
  })

  return messages
}

async function waitForDemoOrSkip(page: Page) {
  await page.waitForFunction(() => {
    const text = document.body.textContent ?? ""
    const hasTerminalBackend = text.includes("native WebGPU") || text.includes("WebGPU required")
    const hasSceneTabs = Array.from(document.querySelectorAll('[role="tab"]'))
      .some((element) => {
        const rect = element.getBoundingClientRect()
        return element.textContent?.trim() === "Overlap" && rect.width > 0 && rect.height > 0
      })

    return hasTerminalBackend && (text.includes("WebGPU required") || hasSceneTabs)
  })

  if (await page.getByText("WebGPU required", { exact: true }).isVisible()) {
    if (process.env.CI) {
      throw new Error("WebGPU adapter is required for debug demo e2e coverage in CI.")
    }

    test.skip(true, "WebGPU adapter is required for this demo e2e flow.")
  }
}

function getSceneTab(page: Page, name: string) {
  return page.locator('button[role="tab"]').filter({ hasText: name })
}

async function expectSelectedOption(page: Page, label: string, option: string) {
  const selectedIndex = await page.getByRole("combobox", { name: label }).evaluate((select, expected) => {
      const element = select as HTMLSelectElement
      return Array.from(element.options).findIndex((item) => item.label === expected)
    }, option)

  expect(selectedIndex, `${label} option ${option} should exist`).toBeGreaterThanOrEqual(0)
  await expect(page.getByRole("combobox", { name: label })).toHaveJSProperty("selectedIndex", selectedIndex)
}
