import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
for (const [width, height] of [
  [1440, 900],
  [1024, 768],
  [430, 932],
  [390, 844],
]) {
  for (const theme of ["light", "dark"]) {
    test(`${width} ${theme}: packet review, citations, audit, gallery and AA`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height })
      await page.goto("/")
      if (theme === "dark")
        await page.getByRole("button", { name: "Switch to dark" }).click()
      await expect(
        page.getByRole("heading", { name: "Your review queue" }),
      ).toBeVisible()
      await page.getByRole("button", { name: /Open packet-018/ }).click()
      await expect(
        page.getByRole("heading", { name: "Review the record" }),
      ).toBeVisible()
      await expect(
        page
          .getByText("draft, pending pharmacist review", { exact: true })
          .first(),
      ).toBeVisible()
      await page.getByRole("button", { name: "Show evidence for lab" }).click()
      await expect(page.locator("#source-quote")).not.toHaveText(
        "Select evidence to inspect its source.",
      )
      const identity = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement)
        const quoteMark = getComputedStyle(
          document.querySelector("#source-quote mark")!,
        )
        const ocr = getComputedStyle(document.querySelector(".ocr-text")!)
        const controls = Array.from(
          document.querySelectorAll(
            "button, .nav-actions a, select, textarea, summary",
          ),
        )
        return {
          navy: root.getPropertyValue("--navy").trim(),
          highlight: root.getPropertyValue("--highlight").trim(),
          quoteHighlight: quoteMark.backgroundColor,
          ocrFont: ocr.fontFamily,
          controls: controls
            .filter((control) => control.getClientRects().length > 0)
            .map((control) => {
              const rect = control.getBoundingClientRect()
              return { width: rect.width, height: rect.height }
            }),
        }
      })
      expect(identity.navy).toBe(theme === "dark" ? "#9db7da" : "#1f3a5f")
      expect(identity.highlight).toBe(theme === "dark" ? "#e2c765" : "#f4de84")
      expect(identity.quoteHighlight).toBe(
        theme === "dark" ? "rgb(226, 199, 101)" : "rgb(244, 222, 132)",
      )
      expect(identity.ocrFont).toContain("IBM Plex Mono")
      expect(
        identity.controls.every(
          ({ width, height }) => width >= 44 && height >= 44,
        ),
      ).toBe(true)
      if (width === 1440 && theme === "light") {
        await page.locator("#source-quote").scrollIntoViewIfNeeded()
        await page.screenshot({
          path: "docs/media/evidence-light-1440.png",
          fullPage: false,
        })
      }
      await page.getByLabel("Confidence overlay").check()
      await expect(page.locator("#document-image")).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
      expect(axe.violations).toEqual([])
      await page.locator("#tab-content").evaluate((node) => {
        node.scrollTop = 0
      })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: `docs/media/${theme}-${width}.png`,
        fullPage: false,
      })
      await page.screenshot({
        path: `docs/media/full-${theme}-${width}.png`,
        fullPage: true,
      })
      await page.getByRole("button", { name: "Summary", exact: true }).click()
      await expect(
        page.getByText("Exact cited source statement.").first(),
      ).toBeVisible()
      await page.getByRole("button", { name: "Evidence", exact: true }).click()
      await page
        .getByLabel("Review note")
        .fill(
          "Synthetic test review. Dates can be read two ways and need confirmation.",
        )
      await page.getByRole("button", { name: "Correct", exact: true }).click()
      await expect(page.getByRole("status")).toContainText("Correction saved")
      await page.getByRole("button", { name: "Flag", exact: true }).click()
      await expect(page.getByRole("status")).toContainText("Flag saved")
      await page.getByRole("button", { name: "Accept review" }).click()
      await expect(page.getByRole("status")).toContainText("Acceptance saved")
      await page.reload()
      await page
        .getByRole("button", { name: "Review log", exact: true })
        .click()
      await expect(page.locator("#tab-content")).toContainText(
        "Synthetic test review",
      )
      await page.getByRole("link", { name: "Failure gallery" }).click()
      await expect(
        page.getByRole("heading", { name: "Where the pipeline needs help" }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([])
      await page.screenshot({
        path: `docs/media/gallery-${theme}-${width}.png`,
        fullPage: false,
      })
    })
  }
}
test("keyboard can open a packet and reach review actions", async ({
  page,
}) => {
  await page.goto("/?packet=packet-001")
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused()
  await page.keyboard.press("Enter")
  await page.getByRole("button", { name: "Accept review" }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("status")).toContainText("Acceptance saved")
})
