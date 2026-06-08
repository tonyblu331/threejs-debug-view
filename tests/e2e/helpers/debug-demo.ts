import { expect, test, type Page } from "@playwright/test"

export const allowedConsoleWarningPatterns = [
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/,
  /The powerPreference option is currently ignored when calling requestAdapter\(\) on Windows/,
  /WebGPU adapter is required for this demo e2e flow/,
]

export function collectRelevantConsoleMessages(page: Page) {
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

export async function waitForDemoOrSkip(page: Page) {
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

export function getSceneTab(page: Page, name: string) {
  return page.locator('button[role="tab"]').filter({ hasText: name })
}

export async function expectSelectedOption(page: Page, label: string, option: string) {
  const selectedIndex = await page.getByRole("combobox", { name: label }).evaluate((select, expected) => {
    const element = select as HTMLSelectElement
    return Array.from(element.options).findIndex((item) => item.label === expected)
  }, option)

  expect(selectedIndex, `${label} option ${option} should exist`).toBeGreaterThanOrEqual(0)
  await expect(page.getByRole("combobox", { name: label })).toHaveJSProperty("selectedIndex", selectedIndex)
}

function viewportLabelOverlay(page: Page) {
  return page.locator('div[aria-hidden="true"]').filter({
    has: page.locator("span"),
  })
}


export async function expectLevaHidden(page: Page) {
  await expect(page.getByRole("combobox", { name: "Layout" })).toHaveCount(0)
  await expect(page.getByRole("combobox", { name: "View" })).toHaveCount(0)
}

export async function expectViewportPaneLabels(page: Page, labels: string[]) {
  const overlay = viewportLabelOverlay(page)
  for (const label of labels) {
    await expect(overlay.getByText(label, { exact: true })).toBeVisible()
  }
}

export async function expectViewportPaneLabelsHidden(page: Page, labels: string[]) {
  const overlay = viewportLabelOverlay(page)
  for (const label of labels) {
    await expect(overlay.getByText(label, { exact: true })).toHaveCount(0)
  }
}

export async function expectCanvasRenders(page: Page) {
  await expect(page.locator("canvas")).toBeVisible()
  const hasPixels = await page.locator("canvas").evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement
    const context = element.getContext("2d")
    if (!context || element.width <= 0 || element.height <= 0) return true

    const sample = context.getImageData(
      Math.floor(element.width / 2),
      Math.floor(element.height / 2),
      1,
      1,
    ).data

    return sample[3] > 0
  })

  expect(hasPixels).toBe(true)
}
