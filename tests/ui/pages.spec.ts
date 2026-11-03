import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
const aa = async (page: Page) =>
  (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations

for (const [width, height] of [
  [1440, 900],
  [430, 932],
  [390, 844],
]) {
  for (const theme of ["light", "dark"]) {
    test(`${width} ${theme}: every page in order, with overlays and evidence on its own page`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height })
      await page.goto("/")
      if (theme === "dark")
        await page.getByRole("button", { name: "Switch to dark" }).click()
      await expect(
        page.getByRole("heading", { name: "Multi-page examples" }),
      ).toBeVisible()
      await page
        .getByRole("button", { name: "Open multipage-01, every page received" })
        .click()
      await expect(
        page.getByRole("heading", { name: "Review the record" }),
      ).toBeVisible()
      await expect(
        page.getByText("3 pages · synthetic fax-style page images"),
      ).toBeVisible()
      await expect(
        page.getByText("All 3 pages received, as the page counters say."),
      ).toBeVisible()
      const figures = page.locator(".pages figure")
      await expect(figures).toHaveCount(3)
      for (const n of [1, 2, 3]) {
        await expect(figures.nth(n - 1).locator("figcaption")).toContainText(
          `Page ${n} of 3 · marked P.00${n}/003`,
        )
        await expect(figures.nth(n - 1).locator("img")).toHaveAttribute(
          "alt",
          new RegExp(`page ${n} of 3 for multipage-01`),
        )
      }
      // The confidence overlay covers every page, each word on its own page.
      await page.getByLabel("Confidence overlay").check()
      await expect(
        figures.nth(0).locator(".confidence-box").first(),
      ).toBeVisible()
      // Prior therapy is all on page 2, so its highlights are there and only there.
      await page
        .getByRole("button", { name: "Show evidence for prior" })
        .click()
      await expect(page.locator("#source-quote")).toContainText(
        "Page 2 · Prior therapies tried: atorvastatin 80 mg by mouth once daily",
      )
      const boxes = (n: number) => figures.nth(n).locator(".source-box")
      await expect(boxes(1).first()).toBeAttached()
      expect(await boxes(0).count()).toBe(0)
      expect(await boxes(2).count()).toBe(0)
      // The page list scrolls to the first highlight.
      expect(
        await page.evaluate(() => {
          const stack = document.querySelector(".pages")!
          const box = stack
            .querySelector(".source-box")!
            .getBoundingClientRect()
          const view = stack.getBoundingClientRect()
          return box.top >= view.top && box.bottom <= view.bottom
        }),
      ).toBe(true)
      // The lab rule quotes lines from all three pages.
      await page.getByRole("button", { name: "Show evidence for lab" }).click()
      for (const n of [0, 1, 2]) await expect(boxes(n).first()).toBeAttached()
      await page.getByText(/Redacted OCR text/).click()
      await expect(page.locator(".ocr-text .page-label")).toHaveText([
        "Page 1 of 3",
        "Page 2 of 3",
        "Page 3 of 3",
      ])
      await expect(page.locator(".ocr-text mark").first()).toBeVisible()
      expect(await noOverflow(page)).toBe(true)
      expect(await aa(page)).toEqual([])
      await page.evaluate(() => window.scrollTo(0, 0))
      if (theme === "light")
        await page.screenshot({
          path: `docs/media/pages-${theme}-${width}.png`,
          fullPage: false,
        })
      // Review actions work on a multi-page packet as on any other.
      await page.getByRole("button", { name: "Accept review" }).click()
      await expect(page.getByRole("status")).toContainText("Acceptance saved")
    })
  }
}

test("a fax with page 2 never received says so before anything else", async ({
  page,
}) => {
  await page.goto("/?packet=multipage-02")
  const warning = page.locator(".coverage-note.warning")
  await expect(warning).toHaveText("Page 2 of 3 was not received.")
  const figures = page.locator(".pages figure")
  await expect(figures).toHaveCount(2)
  await expect(figures.nth(1).locator("figcaption")).toContainText(
    "Received page 2 of 2 · marked P.003/003",
  )
  expect(await noOverflow(page)).toBe(true)
  expect(await aa(page)).toEqual([])
})

test("a one-page packet keeps its single page view", async ({ page }) => {
  await page.goto("/?packet=packet-018")
  await expect(page.locator("#document-image")).toBeVisible()
  await expect(page.locator(".pages")).toHaveCount(0)
  await expect(page.locator(".coverage-note")).toHaveCount(0)
  await expect(
    page.getByText("1 page · synthetic fax-style page image"),
  ).toBeVisible()
})

test("evidence boxes land on their span's page even when the pipeline's words carry no page", async ({
  page,
}) => {
  // The reading rules may rebuild their word list without page numbers.
  await page.route("**/api/packets/multipage-01", async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    data.words = data.words.map(
      ({ page: _, ...word }: { page?: number }) => word,
    )
    await route.fulfill({ response, json: data })
  })
  await page.goto("/?packet=multipage-01")
  await page.getByRole("button", { name: "Show evidence for prior" }).click()
  const boxes = (n: number) =>
    page.locator(".pages figure").nth(n).locator(".source-box")
  await expect(boxes(1).first()).toBeAttached()
  expect(await boxes(0).count()).toBe(0)
  expect(await boxes(2).count()).toBe(0)
})
