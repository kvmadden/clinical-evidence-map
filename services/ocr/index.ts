import sharp from "sharp"
import PDFDocument from "pdfkit"
import { createWorker } from "tesseract.js"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { basename, dirname, join } from "node:path"
import { create } from "fontkit"
import type { OcrOutput, Word } from "../contracts.js"

// Typed fonts vary by packet so one glyph shape does not decide a whole
// class of OCR errors. Roboto Mono draws a slashed zero, the others do not.
export const FONTS = {
  "roboto-mono": { file: "RobotoMono.ttf", size: 24 },
  "liberation-sans": { file: "LiberationSans-Regular.ttf", size: 26 },
  "dejavu-sans": { file: "DejaVuSans.ttf", size: 24 },
} as const
export type FontId = keyof typeof FONTS
export interface RenderPlan {
  font?: FontId
  effects: string[]
  rotate: number
  handwriting: {
    line: number
    image: string
    kind: string
    box: number[]
    prefix?: string
    lines: number
  }[]
  annotations: { kind: string; line: number; from?: number; to?: number }[]
}
export interface FaxInput {
  text: string
  packetId: string
  plan: RenderPlan
  outputDir: string
  handwritingDir?: string
}
export interface FaxOutput {
  image: string
  pdf: string
  width: number
  height: number
}
const W = 1700,
  H = 2200,
  LEFT = 100,
  TOP = 150,
  ROW = 40

// Seeded so every rebuild draws the same page.
function seeded(id: string) {
  let seed = Array.from(id).reduce(
    (n, c) => (n * 31 + c.charCodeAt(0)) >>> 0,
    17,
  )
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

// Renders a typed page from source text, composites AI-drawn handwriting
// images where the plan says, draws annotation marks, then applies seeded
// degradation. Nothing here was printed, faxed or scanned.
export async function renderFax({
  text,
  packetId,
  plan,
  outputDir,
  handwritingDir = "eval/handwriting/images",
}: FaxInput): Promise<FaxOutput> {
  await mkdir(outputDir, { recursive: true })
  const face = FONTS[plan.font ?? "roboto-mono"]
  const font = create(
    await readFile(
      fileURLToPath(new URL(`../../assets/${face.file}`, import.meta.url)),
    ),
  )
  const scale = face.size / font.unitsPerEm
  const advance = (s: string) =>
    font.layout(s).positions.reduce((n, p) => n + p.xAdvance * scale, 0)
  const lowContrast = plan.effects.includes("low-contrast")
  const lines = text.replace(/\n$/, "").split("\n")
  // Wrap typed lines wider than the page at word boundaries.
  const wrap = (line: string) => {
    if (advance(line) <= W - LEFT * 2) return [line]
    const out: string[] = []
    let current = ""
    for (const word of line.split(" ")) {
      const next = current ? `${current} ${word}` : word
      if (current && advance(next) > W - LEFT * 2) {
        out.push(current)
        current = word
      } else current = next
    }
    return [...out, current]
  }
  const byLine = new Map(plan.handwriting.map((h) => [h.line, h]))
  const blockLines = new Set<number>()
  for (const h of plan.handwriting)
    if (h.kind === "block")
      for (let i = 1; i < h.lines; i++) blockLines.add(h.line + i)

  const crops: { input: Buffer; left: number; top: number }[] = []
  const rows: { y: number; baseline: number; width: number }[] = []
  let paths = ""
  let y = TOP
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const hand = byLine.get(i)
    if (blockLines.has(i)) {
      rows.push({ y, baseline: y, width: 0 })
      continue
    }
    if (hand) {
      const source = join(handwritingDir, `${hand.image}.png`)
      const [x0, y0, x1, y1] = hand.box
      const target = hand.kind === "block" ? hand.lines * 72 : 56
      const prefixWidth =
        hand.kind === "fill" && hand.prefix ? advance(hand.prefix) : 0
      const maxWidth =
        W - LEFT * 2 - prefixWidth - (hand.kind === "note" ? 60 : 0)
      const k = Math.min(target / (y1 - y0), maxWidth / (x1 - x0))
      const width = Math.round((x1 - x0) * k),
        height = Math.round((y1 - y0) * k)
      const input = await sharp(source)
        .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
        // Lift the scanned paper tone to white so only the ink lands on the page.
        .linear(1.25, -50)
        .resize(width, height)
        .png()
        .toBuffer()
      if (hand.kind === "fill" && hand.prefix)
        paths += typed(hand.prefix, y + 26)
      const left = Math.round(
        LEFT +
          prefixWidth +
          (hand.kind === "note" ? 60 : hand.kind === "fill" ? 12 : 0),
      )
      crops.push({ input, left, top: Math.round(y) })
      rows.push({ y, baseline: y + height - 10, width: left - LEFT + width })
      y += height + 14
      continue
    }
    const parts = wrap(line)
    rows.push({ y, baseline: y + 26, width: advance(parts[0]) })
    for (const part of parts) {
      paths += typed(part, y + 26)
      y += ROW
    }
  }
  function typed(s: string, baseline: number) {
    const run = font.layout(s)
    let cursor = LEFT
    return run.glyphs
      .map((glyph, i) => {
        const p = run.positions[i]
        const path = `<path d="${glyph.path.toSVG()}" transform="translate(${cursor + p.xOffset * scale},${baseline - p.yOffset * scale}) scale(${scale},${-scale})"/>`
        cursor += p.xAdvance * scale
        return path
      })
      .join("")
  }
  const paper = lowContrast ? "#dad7cf" : "#faf9f4"
  const ink = lowContrast ? "#8d8d8d" : "#171717"
  let image = await sharp(
    Buffer.from(
      `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${paper}"/><g fill="${ink}">${paths}</g></svg>`,
    ),
  )
    .png()
    .toBuffer()
  if (crops.length)
    image = await sharp(image)
      .composite(crops.map((c) => ({ ...c, blend: "multiply" as const })))
      .png()
      .toBuffer()

  const rand = seeded(packetId)
  const overlay: string[] = []
  // Annotation marks drawn as a person would: wobbly circles, arrows, underlines.
  const pen = "#1f2b55"
  const charX = (n: number, line: string) => LEFT + advance(line.slice(0, n))
  for (const a of plan.annotations) {
    const row = rows[a.line]
    if (!row) continue
    const line = lines[a.line]
    if (a.kind === "circle") {
      const x0 = charX(a.from ?? 0, line) - 14,
        x1 = charX(a.to ?? line.length, line) + 14
      const cx = (x0 + x1) / 2,
        cy = row.baseline - 8,
        rx = (x1 - x0) / 2,
        ry = 28
      const pts = Array.from({ length: 26 }, (_, i) => {
        const t = (i / 24) * Math.PI * 2 + 0.3
        const wobble = 1 + (rand() - 0.5) * 0.08
        return `${(cx + Math.cos(t) * rx * wobble).toFixed(1)},${(cy + Math.sin(t) * ry * wobble).toFixed(1)}`
      })
      overlay.push(
        `<polyline points="${pts.join(" ")}" fill="none" stroke="${pen}" stroke-width="3" stroke-linejoin="round"/>`,
      )
    }
    if (a.kind === "arrow") {
      const x1 = Math.min(LEFT + row.width + 24, W - 220),
        y1 = row.baseline - 8
      const x0 = Math.min(x1 + 260, W - 40),
        y0 = y1 - 70
      overlay.push(
        `<path d="M${x0},${y0} Q${(x0 + x1) / 2 + 20},${y0 + 10} ${x1},${y1}" fill="none" stroke="${pen}" stroke-width="3"/>`,
        `<path d="M${x1},${y1} l18,-4 M${x1},${y1} l8,-16" fill="none" stroke="${pen}" stroke-width="3"/>`,
      )
    }
    if (a.kind === "underline") {
      const x1 = charX(a.to ?? line.length, line)
      overlay.push(
        `<path d="M${LEFT - 4},${row.baseline + 8} Q${(LEFT + x1) / 2},${row.baseline + 13} ${x1 + 6},${row.baseline + 6}" fill="none" stroke="${pen}" stroke-width="3"/>`,
      )
    }
  }
  // Seeded speckles and faint horizontal streaks, never random eval drift.
  const speckles = plan.effects.includes("speckle-heavy")
    ? 650
    : plan.effects.includes("speckle-light")
      ? 100
      : 0
  for (let i = 0; i < speckles; i++)
    overlay.push(
      `<circle cx="${Math.floor(rand() * W)}" cy="${Math.floor(rand() * H)}" r="${1 + rand()}" fill="#777" opacity=".2"/>`,
    )
  if (plan.effects.includes("streaks"))
    for (let i = 0; i < 5; i++)
      overlay.push(
        `<rect x="0" y="${Math.floor(rand() * H)}" width="${W}" height="2" fill="#777" opacity=".08"/>`,
      )
  if (plan.effects.includes("smudge")) {
    overlay.push(
      `<defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter></defs>`,
    )
    for (let i = 0; i < 7; i++) {
      const row = rows[Math.floor(rand() * rows.length)]
      overlay.push(
        `<ellipse cx="${LEFT + 80 + rand() * 900}" cy="${row.baseline - 8}" rx="${70 + rand() * 140}" ry="${18 + rand() * 26}" fill="#3a3a3a" opacity="${(0.22 + rand() * 0.2).toFixed(2)}" filter="url(#blur)" transform="rotate(${(rand() * 16 - 8).toFixed(1)} ${LEFT + 500} ${row.baseline})"/>`,
      )
    }
    overlay.push(
      `<path d="M${200 + rand() * 600},0 L${300 + rand() * 600},${H}" stroke="#555" stroke-width="22" opacity=".12" filter="url(#blur)"/>`,
    )
  }
  if (overlay.length)
    image = await sharp(image)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${W}" height="${H}">${overlay.join("")}</svg>`,
          ),
        },
      ])
      .png()
      .toBuffer()
  if (plan.effects.includes("choppy")) image = await choppy(image, rand)
  if (lowContrast)
    image = await sharp(image).linear(0.55, 105).blur(0.6).png().toBuffer()
  let width = W,
    height = H
  if (plan.rotate === 7)
    image = await sharp(image)
      .rotate(7, { background: "#eee" })
      .resize(W, H, { fit: "contain", background: "#eee" })
      .png()
      .toBuffer()
  else if (plan.rotate) {
    image = await sharp(image).rotate(plan.rotate).png().toBuffer()
    if (plan.rotate % 180) [width, height] = [H, W]
  }
  const imagePath = join(outputDir, `${packetId}.png`),
    pdfPath = join(outputDir, `${packetId}.pdf`)
  await writeFile(imagePath, image)
  const landscape = width > height
  const pdf = new PDFDocument({
    size: landscape ? [792, 612] : [612, 792],
    margin: 0,
    info: { Title: `${packetId} synthetic fax-style page` },
  })
  const chunks: Buffer[] = []
  const finished = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (chunk) => chunks.push(chunk))
    pdf.on("end", () => resolve(Buffer.concat(chunks)))
    pdf.on("error", reject)
  })
  pdf.image(
    image,
    0,
    0,
    landscape ? { width: 792, height: 612 } : { width: 612, height: 792 },
  )
  pdf.end()
  await writeFile(pdfPath, await finished)
  return { image: imagePath, pdf: pdfPath, width, height }
}

// Seeded scan-line damage: shifted row bands, dropped white lines and dark lines.
async function choppy(image: Buffer, rand: () => number) {
  const { data, info } = await sharp(image)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const row = width * channels
  for (let b = 0; b < 9; b++) {
    const top = Math.floor(rand() * (height - 12)),
      tall = 2 + Math.floor(rand() * 6),
      shift = Math.round((rand() - 0.5) * 18)
    for (let y = top; y < top + tall; y++) {
      const line = Buffer.from(data.subarray(y * row, (y + 1) * row))
      for (let x = 0; x < width; x++) {
        const from = Math.min(width - 1, Math.max(0, x - shift))
        line.copy(
          data,
          y * row + x * channels,
          from * channels,
          from * channels + channels,
        )
      }
    }
  }
  for (let b = 0; b < 7; b++) {
    const top = Math.floor(rand() * height),
      tall = 1 + Math.floor(rand() * 2),
      dark = rand() < 0.4
    for (let y = top; y < Math.min(height, top + tall); y++)
      for (let x = 0; x < width; x++)
        for (let c = 0; c < Math.min(3, channels); c++)
          data[y * row + x * channels + c] = dark ? 60 : 250
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
}

export function parseTsv(tsv: string, threshold = 80): OcrOutput {
  const words: Word[] = []
  let text = "",
    previousLine = ""
  for (const row of tsv.trim().split("\n").slice(1)) {
    const cells = row.split("\t")
    if (cells[0] !== "5" || !cells[11]?.trim()) continue
    const line = cells.slice(1, 5).join(":")
    text += !text ? "" : line === previousLine ? " " : "\n"
    const start = Array.from(text).length
    const value = cells.slice(11).join("\t").trim()
    text += value
    const confidence = Math.max(0, Math.min(100, Number(cells[10])))
    words.push({
      text: value,
      confidence,
      box: {
        x: Number(cells[6]),
        y: Number(cells[7]),
        width: Number(cells[8]),
        height: Number(cells[9]),
      },
      start,
      end: Array.from(text).length,
      needsReview: confidence < threshold,
    })
    previousLine = line
  }
  return {
    text: text + "\n",
    words,
    threshold,
    engine: "tesseract.js 6 / English LSTM",
  }
}

// Projection-profile skew estimate on a small, contrast-stretched, binarized
// copy. Returns the rotation in degrees that makes text rows most distinct,
// and 0 unless another angle is clearly better.
export async function estimateSkew(image: Buffer) {
  const small = await sharp(image)
    .greyscale()
    .normalise()
    .resize({ width: 500 })
    .threshold(150)
    .png()
    .toBuffer()
  const score = async (a: number) => {
    const { data, info } = await sharp(small)
      .rotate(a, { background: "#ffffff" })
      .raw()
      .toBuffer({ resolveWithObject: true })
    const sums: number[] = []
    for (let y = 0; y < info.height; y++) {
      let dark = 0
      for (let x = 0; x < info.width; x++)
        if (data[(y * info.width + x) * info.channels] < 128) dark++
      sums.push(dark)
    }
    const mean = sums.reduce((n, s) => n + s, 0) / sums.length
    return sums.reduce((n, s) => n + (s - mean) ** 2, 0) / sums.length
  }
  let best = 0,
    bestScore = await score(0)
  for (let a = -10; a <= 10; a += 0.5) {
    if (a === 0) continue
    const s = await score(a)
    if (s > bestScore * 1.05) {
      bestScore = s
      best = a
    }
  }
  return best
}

export async function createOcr() {
  await mkdir(".cache", { recursive: true })
  const worker = await createWorker("eng", 1, {
    cachePath: ".cache",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
  })
  await worker.setParameters({
    preserve_interword_spaces: "0",
    user_defined_dpi: "200",
  })
  // Confidence-weighted word count from a quick half-size read.
  const quickScore = async (buffer: Buffer) => {
    const result = await worker.recognize(buffer, {}, { tsv: true })
    return parseTsv(result.data.tsv ?? "")
      .words.filter((w) => w.confidence >= 50 && /[A-Za-z]{3}/.test(w.text))
      .reduce((n, w) => n + w.confidence, 0)
  }
  return {
    // Detects page orientation and small skew, writes the straightened copy it
    // read next to the source image, then reads words with boxes and confidence.
    async recognize(image: string, threshold = 80): Promise<OcrOutput> {
      const original = await readFile(image)
      const meta = await sharp(original).metadata()
      const candidates =
        (meta.width ?? 0) > (meta.height ?? 0) ? [90, 270] : [0, 180]
      const scores: Record<string, number> = {}
      for (const turn of candidates)
        scores[turn] = await quickScore(
          await sharp(original)
            .rotate(turn)
            .resize({
              width: Math.round(Math.min(meta.width!, meta.height!) / 2),
            })
            .png()
            .toBuffer(),
        )
      const turn = candidates.reduce((a, b) => (scores[b] > scores[a] ? b : a))
      let read = turn
        ? await sharp(original).rotate(turn).png().toBuffer()
        : original
      const skew = await estimateSkew(read)
      if (Math.abs(skew) >= 1)
        read = await sharp(read)
          .rotate(skew, { background: "#eeeeee" })
          .png()
          .toBuffer()
      const changed = turn !== 0 || Math.abs(skew) >= 1
      const readImage = changed
        ? join(dirname(image), basename(image).replace(/\.png$/, ".read.png"))
        : image
      if (changed) await writeFile(readImage, read)
      const size = await sharp(read).metadata()
      const result = await worker.recognize(read, {}, { tsv: true })
      return {
        ...parseTsv(result.data.tsv ?? "", threshold),
        orientation: { pageRotation: (360 - turn) % 360, scores },
        deskewDegrees: Math.abs(skew) >= 1 ? skew : 0,
        readImage: basename(readImage),
        width: size.width ?? 0,
        height: size.height ?? 0,
      }
    },
    close: () => worker.terminate(),
  }
}
