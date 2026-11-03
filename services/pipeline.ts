import { readFile } from "node:fs/promises"
import { redact } from "./redact/index.js"
import { extract } from "./extract/index.js"
import { linkEvidence } from "./link-evidence/index.js"
import { verify } from "./verify/index.js"
import { readCoverage } from "./ocr/coverage.js"
import type {
  Blocker,
  CriterionId,
  OcrOutput,
  OcrPage,
  Span,
  Word,
} from "./contracts.js"
import { DRAFT } from "./contracts.js"
export const sourceBody = (markdown: string) =>
  markdown.split("<!-- SOURCE START -->\n")[1]
export interface ManifestPacket {
  packet_id: string
  criteria_id: string
  group: string
  tags: string[]
  render: {
    font?: "roboto-mono" | "liberation-sans" | "dejavu-sans"
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
}
export interface Manifest {
  packet_count: number
  groups: { id: string; label: string; render: string }[]
  packets: ManifestPacket[]
}
export async function loadManifest(path = "eval/manifest.json") {
  return JSON.parse(await readFile(path, "utf8")) as Manifest
}
export interface ProcessOptions {
  // Whole days added to every date by the privacy step. Omit to remove dates.
  dateShiftDays?: number
}
export function processText(
  text: string,
  criteriaId: string,
  ocr?: OcrOutput,
  options: ProcessOptions = {},
) {
  const privacy = redact({ text, dateShiftDays: options.dateShiftDays })
  if (privacy.blocked) throw new Error("Privacy gate blocked this packet")
  // Map unchanged clinical words into the redacted coordinate basis. Removed names
  // and dates are never attributed to clinical spans. Raw OCR stays a separate local view.
  const words: Word[] = []
  // Lines (zero-based, in the redacted text) that hold a low-confidence word.
  const lowConfidenceLines = new Set<number>()
  const lowConfidenceWords: { line: number; text: string }[] = []
  if (ocr) {
    let cursor = 0
    for (const word of ocr.words) {
      const position = privacy.text.indexOf(word.text, cursor)
      if (position < 0) continue
      const start = Array.from(privacy.text.slice(0, position)).length
      words.push({ ...word, start, end: start + Array.from(word.text).length })
      cursor = position + word.text.length
    }
    // Lines of low-confidence words, found in the raw text. The privacy step
    // keeps line breaks, so the line numbers hold for the redacted text too,
    // and a garbled word it removed as a name still counts as unreadable.
    // The removed word's text never leaves this function.
    const rawStarts = [0]
    for (let k = 0; k < text.length; k++)
      if (text[k] === "\n") rawStarts.push(k + 1)
    const rawLine = (position: number) => {
      let lo = 0,
        hi = rawStarts.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (rawStarts[mid] <= position) lo = mid
        else hi = mid - 1
      }
      return lo
    }
    const lines = privacy.text.split("\n")
    let rawCursor = 0
    for (const word of ocr.words) {
      const position = text.indexOf(word.text, rawCursor)
      if (position < 0) continue
      rawCursor = position + word.text.length
      if (!word.needsReview) continue
      const line = rawLine(position)
      lowConfidenceLines.add(line)
      lowConfidenceWords.push({
        line,
        text: (lines[line] ?? "").includes(word.text) ? word.text : "[removed]",
      })
    }
  }
  // The page reader's coverage record, built from the OCR output by
  // services/ocr/coverage.ts. Its ranges are code points in the OCR text, so
  // they apply only when that is the text being read here.
  // The coverage record: the page reader's own, or built here from the OCR
  // output, or for plain text from the page counters written in it. Text has
  // no word confidence, so only the counters count there.
  const textOnly = !ocr
  const record = ocr
    ? (ocr.coverage ?? readCoverage(ocr))
    : readCoverage({
        text,
        words: [],
        threshold: 80,
        engine: "text",
        ...(textPages(text).length > 1 ? { pages: textPages(text) } : {}),
      })
  const sameText = textOnly || ocr.text === text
  const lineStartsCp = [0]
  {
    let cp = 0
    for (const ch of text) {
      cp++
      if (ch === "\n") lineStartsCp.push(cp)
    }
  }
  const lineAtCp = (offset: number) => {
    let lo = 0,
      hi = lineStartsCp.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStartsCp[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  if (record && sameText)
    for (const page of record.pages)
      for (const run of page.lowConfidenceLines)
        for (let i = lineAtCp(run.start); i <= lineAtCp(run.end); i++)
          lowConfidenceLines.add(i)
  // Where each received page starts, as a line of the text.
  const pageStartLines =
    ocr?.pages && sameText
      ? ocr.pages.map((p) => lineAtCp(p.start)).filter((i) => i > 0)
      : undefined
  const extracted = extract({
    text: privacy.text,
    dates: privacy.dates,
    lowConfidenceLines: [...lowConfidenceLines].sort((a, b) => a - b),
    lowConfidenceWords,
    removedClinical: privacy.removedClinical,
    ...(pageStartLines?.length ? { pageStartLines } : {}),
  })
  // Pages that did not arrive or could not be read block every "not
  // documented" answer: the item could be on that page.
  const coverage = extracted.coverage
  if (coverage && record) {
    const pageBlockers: Blocker[] = []
    for (const p of [...new Set(record.missingPages)])
      pageBlockers.push({
        kind: "missing-page",
        page: p,
        message: `Page ${p} of the packet did not arrive.`,
      })
    const unnamed = record.missingCount - new Set(record.missingPages).size
    if (unnamed > 0)
      pageBlockers.push({
        kind: "missing-page",
        message:
          record.pagesExpected !== null
            ? `Only ${record.pagesReceived} of ${record.pagesExpected} pages arrived.`
            : `${unnamed} more ${unnamed === 1 ? "page is" : "pages are"} missing by the page counters.`,
      })
    if (record.conflictingTotals.length)
      pageBlockers.push({
        kind: "missing-page",
        message: `The page counters disagree on the total (${record.conflictingTotals.join(" and ")}), so a missing page cannot be ruled out.`,
      })
    // Pages joined out of their counted order can split a table or a course
    // across the join, so a reading of absence is not safe.
    if (record.outOfOrder)
      pageBlockers.push({
        kind: "pages-out-of-order",
        message:
          "The page counters say the pages arrived out of order, so the text is not in its written order.",
      })
    // A page OCR found no words on, or where most lines held no word read
    // with confidence. Pages with only some low-confidence lines are read line
    // by line instead. Plain text has no confidence to judge.
    for (const page of textOnly ? [] : record.pages) {
      const unreadLines = page.unreadableLines.reduce(
        (n, r) => n + (r.to - r.from + 1),
        0,
      )
      const unreadable =
        page.words === 0 ||
        page.meanConfidence === null ||
        (page.lines > 0 && unreadLines * 2 >= page.lines)
      if (unreadable)
        pageBlockers.push({
          kind: "unreadable-page",
          page: page.index + 1,
          message: `Page ${page.index + 1} could not be read with confidence.`,
        })
    }
    for (const id of Object.keys(coverage.blockers) as CriterionId[])
      coverage.blockers[id].unshift(...pageBlockers)
    // Found answers stay found. The packet is marked incomplete instead. A
    // turn the page reader could not settle by a clear margin is noted too.
    const notes = pageBlockers.map((b) => b.message)
    for (const page of textOnly ? [] : record.pages)
      if (!page.orientation.handled)
        notes.push(
          `The turn of page ${page.index + 1} was not settled by a clear margin.`,
        )
    coverage.complete =
      (textOnly || record.complete) && pageBlockers.length === 0
    if (notes.length) coverage.incomplete = [...new Set(notes)]
  }
  const linked = linkEvidence({
    text: privacy.text,
    entities: extracted.entities,
    criteriaId,
    words,
    coverage,
  })
  const seen = new Set<string>()
  const sentences = extracted.entities
    .filter((e) =>
      [
        "indication",
        "requested_medication",
        "measurement",
        "prior_medication",
        "prior_outcome",
      ].includes(e.type),
    )
    .filter((e) => {
      if (seen.has(e.source_span.text)) return false
      seen.add(e.source_span.text)
      return true
    })
    .map((e) => ({ text: e.source_span.text, citations: [e.source_span] }))
  const summary = verify({ text: privacy.text, sentences, words })
  const boxesFor = (span: Span) =>
    words
      .filter((w) => w.start < span.end && w.end > span.start)
      .map((w) => w.box)
  return {
    notice: DRAFT,
    reviewed: false,
    privacy,
    dateReading: extracted.dateReading,
    // What the reader could and could not read, per criterion. Named apart
    // from the page reader's coverage record, which a result also carries.
    readerCoverage: extracted.coverage,
    entities: extracted.entities.map((e) => ({
      ...e,
      boxes: boxesFor(e.source_span),
    })),
    criteria: linked.criteria,
    summary: summary.sentences,
    words,
    offsetBasis: privacy.offsetBasis,
  }
}

// Pages of plain text, split at lines holding only <<page>> or a form feed,
// as code point ranges. The break line ends the page before it.
function textPages(text: string): OcrPage[] {
  const pages: OcrPage[] = []
  let start = 0,
    at = 0
  for (const line of text.split("\n")) {
    const length = Array.from(line).length + 1
    at += length
    if (/^\s*(?:<<page>>|\f+)\s*$/i.test(line)) {
      pages.push(page(start, at))
      start = at
    }
  }
  pages.push(page(start, Array.from(text).length))
  return pages.filter((p) => p.end > p.start)
}
const page = (start: number, end: number): OcrPage => ({
  image: "",
  readImage: "",
  width: 0,
  height: 0,
  orientation: { pageRotation: 0, scores: {} },
  deskewDegrees: 0,
  start,
  end,
})
