import { expect, test, type Page } from "@playwright/test"

const relevantConsolePattern =
  /THREE\.Clock|WebGPUTimestampQueryPool|change in the order of Hooks|Should have a queue|Cannot read properties of undefined/

test.describe("debug demo controls", () => {
  test("keeps overlap route, browser history, and Leva view in sync", async ({ page }) => {
    const messages = collectRelevantConsoleMessages(page)

    await page.goto("/")
    await waitForDemoOrSkip(page)

    await page.getByRole("tab", { name: "Overlap" }).click()
    await expect(page).toHaveURL(/scene=overdraw/)
    await expect(page).toHaveURL(/debugView=overdraw/)
    await expect(page.getByRole("tab", { name: "Overlap" })).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Overlap")

    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("tab", { name: "Main" })).toHaveAttribute("aria-selected", "true")

    await page.goForward()
    await expect(page).toHaveURL(/scene=overdraw/)
    await expect(page.getByRole("tab", { name: "Overlap" })).toHaveAttribute("aria-selected", "true")
    await expectSelectedOption(page, "View", "Overlap")
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

    await page.getByRole("combobox", { name: "Mode" }).selectOption({ label: "Viewport" })
    await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: "Quad" })

    await expect(page.getByRole("combobox", { name: "Pane 1" })).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Pane 4" })).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Pane 5" })).toHaveCount(0)
    await expect(page.getByText("Blend opacity", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Rows", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Columns", { exact: true })).toHaveCount(0)
    expect(messages).toEqual([])
  })
})

function collectRelevantConsoleMessages(page: Page) {
  const messages: string[] = []

  page.on("console", (message) => {
    const text = message.text()
    if ((message.type() === "error" || message.type() === "warning") && relevantConsolePattern.test(text)) {
      messages.push(text)
    }
  })

  return messages
}

async function waitForDemoOrSkip(page: Page) {
  await page.waitForFunction(() => {
    const text = document.body.textContent ?? ""
    return text.includes("Overlap") || text.includes("WebGPU required")
  })

  if (await page.getByText("WebGPU required", { exact: true }).isVisible()) {
    test.skip(true, "WebGPU adapter is required for this demo e2e flow.")
  }
}

async function expectSelectedOption(page: Page, label: string, option: string) {
  await expect(page.getByRole("combobox", { name: label })).toHaveJSProperty("selectedIndex", await page
    .getByRole("combobox", { name: label })
    .evaluate((select, expected) => {
      const element = select as HTMLSelectElement
      return Array.from(element.options).findIndex((item) => item.label === expected)
    }, option))
}
