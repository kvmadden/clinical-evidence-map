import sharp from "sharp"
import PDFDocument from "pdfkit"
import { createWorker } from "tesseract.js"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { create } from "fontkit"
import type { OcrOutput, Word } from "../contracts.js"
export interface FaxInput {
  text: string
  packetId: string
  quality: string
  outputDir: string
}
export interface FaxOutput {
  image: string
  pdf: string
  width: number
  height: number
}
export async function renderFax({
  text,
  packetId,
  quality,
  outputDir,
}: FaxInput): Promise<FaxOutput> {
  await mkdir(outputDir, { recursive: true })
  const normal = create(
    await readFile(
      fileURLToPath(new URL("../../assets/RobotoMono.ttf", import.meta.url)),
    ),
  )
  const handwriting = create(
    await readFile(
      fileURLToPath(new URL("../../assets/Kalam-Regular.ttf", import.meta.url)),
    ),
  )
  const wrapped = text
    .split("\n")
    .flatMap(
      (line) =>
        line.match(/.{1,82}(?:\s|$)|.{1,82}/g)?.map((s) => s.trimEnd()) ?? [""],
    )
  let medicationHistory = false
  const paths = wrapped
    .map((line, index) => {
      if (line === "MEDICATION HISTORY") medicationHistory = true
      const font =
        quality === "handwriting" && medicationHistory ? handwriting : normal
      const size = quality === "handwriting" && medicationHistory ? 30 : 24
      const scale = size / font.unitsPerEm
      const run = font.layout(line)
      let cursor = 100
      return run.glyphs
        .map((glyph, i) => {
          const position = run.positions[i]
          const path = `<path d="${glyph.path.toSVG()}" transform="translate(${cursor + position.xOffset * scale},${180 + index * 40 - position.yOffset * scale}) scale(${scale},${-scale})"/>`
          cursor += position.xAdvance * scale
          return path
        })
        .join("")
    })
    .join("")
  let image = await sharp(
    Buffer.from(
      `<svg width="1700" height="2200"><rect width="1700" height="2200" fill="#faf9f4"/><g fill="#171717">${paths}</g></svg>`,
    ),
  )
    .png()
    .toBuffer()
  // Seeded speckles and faded horizontal fax streaks, never random eval drift.
  let seed = Array.from(packetId).reduce((n, c) => n + c.charCodeAt(0), 17)
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const dots = Array.from(
    { length: quality === "clean" ? 100 : 650 },
    () =>
      `<circle cx="${Math.floor(rand() * 1700)}" cy="${Math.floor(rand() * 2200)}" r="${1 + rand()}" fill="#777" opacity=".2"/>`,
  ).join("")
  const streaks = Array.from(
    { length: 5 },
    () =>
      `<rect x="0" y="${Math.floor(rand() * 2200)}" width="1700" height="2" fill="#777" opacity=".08"/>`,
  ).join("")
  image = await sharp(image)
    .composite([
      {
        input: Buffer.from(
          `<svg width="1700" height="2200">${dots}${streaks}</svg>`,
        ),
      },
    ])
    .png()
    .toBuffer()
  if (quality === "skew")
    image = await sharp(image)
      .rotate(7, { background: "#eee" })
      .resize(1700, 2200, { fit: "contain", background: "#eee" })
      .png()
      .toBuffer()
  const imagePath = join(outputDir, `${packetId}.png`),
    pdfPath = join(outputDir, `${packetId}.pdf`)
  await writeFile(imagePath, image)
  const pdf = new PDFDocument({
    size: [612, 792],
    margin: 0,
    info: { Title: `${packetId} synthetic fax` },
  })
  const chunks: Buffer[] = []
  const finished = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (chunk) => chunks.push(chunk))
    pdf.on("end", () => resolve(Buffer.concat(chunks)))
    pdf.on("error", reject)
  })
  pdf.image(image, 0, 0, { width: 612, height: 792 })
  pdf.end()
  await writeFile(pdfPath, await finished)
  return { image: imagePath, pdf: pdfPath, width: 1700, height: 2200 }
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
  return {
    async recognize(image: string, threshold = 80): Promise<OcrOutput> {
      const result = await worker.recognize(image, {}, { tsv: true })
      return parseTsv(result.data.tsv ?? "", threshold)
    },
    close: () => worker.terminate(),
  }
}
