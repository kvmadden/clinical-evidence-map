import { test, expect } from "@playwright/test"
import { processText } from "../../services/pipeline.js"
import { renderFax } from "../../services/ocr/index.js"

// Feed freshly computed synthetic output through the existing review screen.
// The API interception keeps the frozen evaluation artifacts unchanged.
for (const [width, height] of [
  [1440, 900],
  [430, 932],
  [390, 844],
]) {
  test(`${width}: inline dates and prior course render with source citations`, async ({
    page,
  }) => {
    const text = [
      "Fictional request | Request date 2026-10-20 | P.001/001",
      "Age: 66 years",
      "Indication: established ASCVD.",
      "Request: evolocumab 140 mg every 2 weeks.",
      "LAB AND PRIOR THERAPY",
      "LDL-C 156 mg/dL collected 2026-05-01.",
      "Atorvastatin 80 mg daily started 2026-05-02. Taking continuously.",
      "LDL-C 94 mg/dL collected 2026-09-07.",
    ].join("\n")
    const output = processText(text, "pcsk9", undefined, { dateShiftDays: 0 })
    const fax = await renderFax({
      text,
      packetId: `inline-${width}`,
      outputDir: ".runtime/inline-ui",
      plan: { effects: [], rotate: 0, handwriting: [], annotations: [] },
    })
    await page.route("**/api/packets/packet-018", async (route) => {
      const response = await route.fetch()
      const original = await response.json()
      await route.fulfill({
        json: {
          ...original,
          ...output,
          ocr: {
            text,
            words: [],
            threshold: 80,
            engine: "synthetic",
            readImage: "inline.png",
            width: fax.width,
            height: fax.height,
          },
          words: [],
          artifactBase: "/inline-artifact/",
        },
      })
    })
    await page.route("**/inline-artifact/inline.png", (route) =>
      route.fulfill({ path: fax.image }),
    )
    await page.setViewportSize({ width, height })
    await page.goto("/")
    await page.getByRole("button", { name: /Open packet-018/ }).click()
    for (const id of ["lab", "prior"]) {
      const card = page
        .locator(".criterion-card")
        .filter({
          has: page.getByRole("button", { name: `Show evidence for ${id}` }),
        })
      await expect(card).toHaveAttribute("data-status", "evidence_found")
      await card.getByRole("button").click()
      await expect(page.locator("#source-quote")).toContainText(
        id === "lab" ? "Request date" : "Atorvastatin",
      )
    }
    await expect(page.locator("#document-image")).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `test-results/inline-course-${width}.png`,
      fullPage: true,
    })
  })
}
