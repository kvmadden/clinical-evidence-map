import { chromium } from "@playwright/test"
import gifenc from "gifenc"
const { GIFEncoder, quantize, applyPalette } = gifenc
import sharp from "sharp"
import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const dir = await mkdtemp(join(tmpdir(), "clinical-media-"))
const server = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "scripts/server.ts",
    "--port",
    "4179",
    "--audit",
    join(dir, "audit.jsonl"),
  ],
  { stdio: ["ignore", "pipe", "inherit"] },
)
let browser
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve)
    server.once("error", reject)
    server.once("exit", (code) => reject(new Error(`Server exited ${code}`)))
  })
  browser = await chromium.launch({
    headless: process.argv.includes("--headless"),
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  })
  const gif = GIFEncoder()
  const frame = async () => {
    const image = await page.screenshot()
    const rgba = await sharp(image)
      .resize(960, 600)
      .ensureAlpha()
      .raw()
      .toBuffer()
    const palette = quantize(rgba, 256)
    gif.writeFrame(applyPalette(rgba, palette), 960, 600, {
      palette,
      delay: 1800,
    })
  }
  await page.goto("http://127.0.0.1:4179")
  await page.getByRole("heading", { name: "Your review queue" }).waitFor()
  await frame()
  await page.goto("http://127.0.0.1:4179/?packet=packet-018")
  await page.getByRole("heading", { name: "Review the record" }).waitFor()
  await frame()
  await page.getByLabel("Confidence overlay").check()
  await page.getByRole("button", { name: "Show evidence for lab" }).click()
  await page.locator(".review-grid").scrollIntoViewIfNeeded()
  await frame()
  await page.getByRole("button", { name: "Summary", exact: true }).click()
  await frame()
  await page.getByLabel("Review target").selectOption("dose")
  await page
    .getByLabel("Review note")
    .fill(
      "Synthetic review: the request and medication list disagree. Confirm the dose before proceeding.",
    )
  await page.getByRole("button", { name: "Correct", exact: true }).click()
  await page
    .getByRole("status")
    .filter({ hasText: "Correction saved" })
    .waitFor()
  await frame()
  await page.getByRole("button", { name: "Review log", exact: true }).click()
  await page.getByText("Append-only review history", { exact: true }).waitFor()
  await page.locator(".inspector").scrollIntoViewIfNeeded()
  await frame()
  gif.finish()
  await writeFile("docs/media/review-flow.gif", gif.bytes())
} finally {
  await browser?.close()
  server.kill("SIGTERM")
  await new Promise((resolve) => server.once("exit", resolve))
  await rm(dir, { recursive: true, force: true })
}
