import type { RenderPlan } from "./index.js"
import type { OcrOutput, OcrPage, Word } from "../contracts.js"

// Packets of several pages. A line holding exactly this marker starts a new
// page. The marker is never drawn, read or quoted.
//
// renderFax in ./index.ts draws one page and stays unchanged, so a one-page
// packet takes the same path as before and keeps its OCR fingerprint. This
// module holds the page arithmetic, with no image or OCR code, so the
// pipeline can use it. ./packet.ts draws and reads the pages.
export const PAGE_BREAK = "<<page>>"

export interface PageSlice {
  // The page's text, ending with a line break unless the packet text did not.
  text: string
  // Index of the page's first line among the packet text's lines, markers
  // counted, which is how render plans number lines.
  first: number
  // How many of the packet text's lines the page holds.
  lines: number
}

export function splitPages(text: string): PageSlice[] {
  const lines = text.split("\n")
  if (!lines.includes(PAGE_BREAK))
    return [{ text, first: 0, lines: lines.length }]
  const pages: PageSlice[] = []
  let first = 0
  for (let i = 0; i <= lines.length; i++) {
    if (i < lines.length && lines[i] !== PAGE_BREAK) continue
    const own = lines.slice(first, i)
    // A page that ends at a marker keeps the line break before the marker.
    const end = i < lines.length && own.length ? "\n" : ""
    pages.push({ text: own.join("\n") + end, first, lines: own.length })
    first = i + 1
  }
  // A marker starts a new page, so one on the first line has no page before
  // it, and one on the last line, before the final line break, starts none.
  // Two markers in a row still leave a deliberately blank page between them.
  if (pages.length > 1 && pages[0].lines === 0) pages.shift()
  const last = pages.at(-1)!
  if (pages.length > 1 && !last.text && lines.slice(last.first).join("") === "")
    pages.pop()
  return pages
}

// The packet text with its marker lines removed: what a perfect reading of
// every page, joined in order, would give.
export const readingText = (text: string) =>
  splitPages(text)
    .map((p) => p.text)
    .join("")

// Moves a render plan's line numbers onto one page. Plans number lines over
// the whole packet text, markers counted.
export function planForPage(plan: RenderPlan, page: PageSlice): RenderPlan {
  const inside = (line: number) =>
    line >= page.first && line < page.first + page.lines
  return {
    ...plan,
    handwriting: plan.handwriting
      .filter((h) => inside(h.line))
      .map((h) => ({ ...h, line: h.line - page.first })),
    annotations: plan.annotations
      .filter((a) => inside(a.line))
      .map((a) => ({ ...a, line: a.line - page.first })),
  }
}

// Every handwriting image and mark must sit on a page line, and a drawn block
// must end on the page it starts on.
export function checkPlan(plan: RenderPlan, pages: PageSlice[]) {
  const pageOf = (line: number) =>
    pages.find((p) => line >= p.first && line < p.first + p.lines)
  for (const h of plan.handwriting) {
    const page = pageOf(h.line)
    if (!page) throw new Error(`Handwriting on line ${h.line} is not on a page`)
    if (h.kind === "block" && h.line + h.lines > page.first + page.lines)
      throw new Error(
        `Handwriting block on line ${h.line} crosses a page break`,
      )
  }
  for (const a of plan.annotations)
    if (!pageOf(a.line))
      throw new Error(`Annotation on line ${a.line} is not on a page`)
}

// Page 1 keeps the packet ID, so its file names and seeded effects match a
// one-page packet. Later pages get their own seed through their own ID.
export const pageImageId = (packetId: string, index: number) =>
  index ? `${packetId}-page-${index + 1}` : packetId

// Joins page reads in order. Each word keeps its page index and its offsets
// move by the length of the pages before it, line breaks added included, so
// a span in the joined text points at the characters it pointed at on its
// own page.
export function joinPages(reads: OcrOutput[], images: string[]): OcrOutput {
  let text = "",
    offset = 0
  const words: Word[] = [],
    pages: OcrPage[] = []
  for (const [page, read] of reads.entries()) {
    for (const word of read.words)
      words.push({
        ...word,
        start: word.start + offset,
        end: word.end + offset,
        page,
      })
    // Every page ends on a line break, so no two pages share a line and
    // page boundaries fall on line starts. OCR reads already end with one.
    const own = read.text.endsWith("\n") ? read.text : `${read.text}\n`
    const length = Array.from(own).length
    pages.push({
      image: images[page],
      readImage: read.readImage ?? images[page],
      width: read.width ?? 0,
      height: read.height ?? 0,
      orientation: read.orientation ?? { pageRotation: 0, scores: {} },
      deskewDegrees: read.deskewDegrees ?? 0,
      start: offset,
      end: offset + length,
    })
    text += own
    offset += length
  }
  return {
    text,
    words,
    threshold: reads[0]?.threshold ?? 80,
    engine: reads[0]?.engine ?? "none",
    pages,
  }
}

// The pages of any OCR output. A one-page output describes its page with its
// top-level fields, so it becomes a single page spanning the whole text.
export function pagesOf(ocr: OcrOutput): OcrPage[] {
  if (ocr.pages?.length) return ocr.pages
  return [
    {
      image: ocr.readImage ?? "",
      readImage: ocr.readImage ?? "",
      width: ocr.width ?? 0,
      height: ocr.height ?? 0,
      orientation: ocr.orientation ?? { pageRotation: 0, scores: {} },
      deskewDegrees: ocr.deskewDegrees ?? 0,
      start: 0,
      end: Array.from(ocr.text).length,
    },
  ]
}
