import PDFDocument from "pdfkit"
import sharp from "sharp"
import { rm, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { renderFax } from "./index.js"
import type { FaxInput, FaxOutput } from "./index.js"
import type { OcrOutput } from "../contracts.js"
import {
  checkPlan,
  joinPages,
  pageImageId,
  planForPage,
  splitPages,
} from "./pages.js"

// Draws a packet one page at a time with renderFax and reads it back one page
// at a time. A packet with no page marker takes exactly the one-page path.
export interface PacketRender {
  pages: FaxOutput[]
  // One PDF holding every page in order.
  pdf: string
}

export async function renderPacket(input: FaxInput): Promise<PacketRender> {
  const slices = splitPages(input.text)
  if (slices.length === 1) {
    const page = await renderFax(input)
    return { pages: [page], pdf: page.pdf }
  }
  checkPlan(input.plan, slices)
  const pages: FaxOutput[] = []
  for (const [index, slice] of slices.entries())
    pages.push(
      await renderFax({
        ...input,
        text: slice.text,
        packetId: pageImageId(input.packetId, index),
        plan: planForPage(input.plan, slice),
      }),
    )
  // renderFax writes a PDF for each page. Keep one PDF for the packet.
  for (const page of pages.slice(1)) await rm(page.pdf, { force: true })
  const pdf = join(input.outputDir, `${input.packetId}.pdf`)
  await writeFile(pdf, await bindPages(pages, input.packetId))
  return { pages: pages.map((p) => ({ ...p, pdf })), pdf }
}

// A fixed creation date keeps the PDF bytes the same on every rebuild.
const PDF_DATE = new Date("2026-11-03T00:00:00Z")
async function bindPages(pages: FaxOutput[], packetId: string) {
  const pdf = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    info: {
      Title: `${packetId} synthetic fax-style pages`,
      CreationDate: PDF_DATE,
    },
  })
  const chunks: Buffer[] = []
  const finished = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (chunk) => chunks.push(chunk))
    pdf.on("end", () => resolve(Buffer.concat(chunks)))
    pdf.on("error", reject)
  })
  for (const page of pages) {
    const landscape = page.width > page.height
    const size: [number, number] = landscape ? [792, 612] : [612, 792]
    pdf.addPage({ size, margin: 0 })
    // Pages are opaque, so their alpha channel carries nothing. Without it
    // PDFKit writes each image in page order instead of when it finishes
    // decoding, which keeps the bytes the same from one rebuild to the next.
    const opaque = await sharp(page.image).removeAlpha().png().toBuffer()
    pdf.image(opaque, 0, 0, { width: size[0], height: size[1] })
  }
  pdf.end()
  return finished
}

export interface PageReader {
  recognize(image: string, threshold?: number): Promise<OcrOutput>
}

// Reads each page in order. One page comes back exactly as the reader gave it.
export async function recognizePages(
  reader: PageReader,
  images: string[],
  threshold = 80,
): Promise<OcrOutput> {
  if (images.length === 1) return reader.recognize(images[0], threshold)
  const reads: OcrOutput[] = []
  for (const image of images)
    reads.push(await reader.recognize(image, threshold))
  return joinPages(
    reads,
    images.map((i) => basename(i)),
  )
}
