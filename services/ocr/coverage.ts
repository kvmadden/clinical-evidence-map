import type {
  Coverage,
  LineRun,
  OcrOutput,
  PageCounter,
  PageCoverage,
} from "../contracts.js"
import { pagesOf } from "./pages.js"

// Page counters live in fax headers and footers, so only the first and last
// few lines of each page are searched.
const EDGE_LINES = 3
// Digits as OCR tends to read them on a fax header: O for 0, l, I or | for 1.
const N = "([0-9OoIl|]{1,3})"
// A fax machine's own words, matched as whole words.
const FAX_WORD = /\b(?:fax|from|sent|received)\b|\bto:/i
// What a fax header carries besides its counter: a clock time, a date or a
// phone number.
const HEADER_FIELD =
  /\b\d{1,2}:\d{2}\b|\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{3}[-.\s]\d{3,4}\b/i
// A word before the counter that makes it a pointer to another page.
const REFERENCE = /\b(?:on|see|to|at|from|in|per|refer|continued|cont)\.?\s*$/i
// Each form, and the line it may sit on. "alone" means the counter is the
// whole line. "fax" means a fax word is on the line. "header" means a fax word
// and a time, date or phone number. "end" means nothing but punctuation
// follows the counter. "padded" means both numbers are written with three
// digits, as fax machines print them.
const FORMS: { re: RegExp; ok: (place: Place) => boolean }[] = [
  // P.002/003, P. 2/3, P2/3, with a capital P
  {
    re: new RegExp(`\\bP\\.?\\s?${N}\\s?/\\s?${N}(?![0-9/])`, "g"),
    ok: (p) => p.alone || p.fax || p.padded,
  },
  // pg 2/3, Page 2/3, Page 2 of 3, Pg. 2 of 3
  {
    re: new RegExp(
      `\\b(?:page|pg)\\.?\\s*${N}\\s*(?:/|of)\\s*${N}(?![0-9/])`,
      "gi",
    ),
    ok: (p) => p.alone || p.end || p.header,
  },
  // 2 of 3, alone on the line or ending a fax header
  {
    re: new RegExp(`(?<![\\w/.])${N}\\s+of\\s+${N}(?![\\w/])`, "gi"),
    ok: (p) => p.alone || (p.end && p.header),
  },
  // P.002, Page 2 or pg 2, with no total
  {
    re: new RegExp(`\\bP\\.\\s?${N}\\b(?!\\s*(?:/|of\\b))`, "g"),
    ok: (p) => p.alone || p.fax,
  },
  {
    re: new RegExp(`\\b(?:page|pg)\\.?\\s*${N}\\b(?!\\s*(?:/|of\\b))`, "gi"),
    ok: (p) => p.alone || p.fax,
  },
]
interface Place {
  alone: boolean
  fax: boolean
  header: boolean
  end: boolean
  padded: boolean
}
// A prior-authorization fax runs to a few dozen pages at most.
const MOST_PAGES = 50
const number = (s: string | undefined) =>
  s === undefined
    ? null
    : Number(s.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1"))

// Every page counter on one line, in the order written. A counter must sit
// where fax machines and footers put one, and its numbers must make sense:
// page 8 of 3, a total above 50 or a pointer such as "continued on page 2 of
// 3" is not a counter.
export function readCounters(line: string): Omit<PageCounter, "line">[] {
  const fax = FAX_WORD.test(line)
  const header = fax && HEADER_FIELD.test(line)
  const found: (Omit<PageCounter, "line"> & { at: number })[] = []
  for (const form of FORMS)
    for (const m of line.matchAll(form.re)) {
      const at = m.index!,
        text = m[0]
      if (!/\d/.test(text) || REFERENCE.test(line.slice(0, at))) continue
      if (
        found.some((f) => at < f.at + f.text.length && f.at < at + text.length)
      )
        continue
      const rest = line.slice(at + text.length)
      const place = {
        alone: !/[A-Za-z0-9]/.test(line.slice(0, at) + rest),
        fax,
        header,
        end: !/[A-Za-z0-9]/.test(rest),
        padded: m[2] !== undefined && m[1].length === 3 && m[2].length === 3,
      }
      if (!form.ok(place)) continue
      const page = number(m[1])!,
        of = number(m[2])
      if (page < 1 || page > MOST_PAGES) continue
      if (of !== null && (of < 1 || of > MOST_PAGES || page > of)) continue
      found.push({ text: text.trim(), page, of, at })
    }
  return found.sort((a, b) => a.at - b.at).map(({ at, ...c }) => c)
}
export const readCounter = (line: string) => readCounters(line)[0] ?? null

// Line start offsets, in code points, for the part of the text a page covers.
function pageLines(points: string[], start: number, end: number) {
  const lines: { start: number; end: number; text: string }[] = []
  let at = start
  for (let i = start; i < end; i++)
    if (points[i] === "\n") {
      lines.push({ start: at, end: i, text: points.slice(at, i).join("") })
      at = i + 1
    }
  if (at < end)
    lines.push({ start: at, end, text: points.slice(at, end).join("") })
  return lines
}

export function readCoverage(ocr: OcrOutput): Coverage {
  const points = Array.from(ocr.text)
  const pages = pagesOf(ocr).map((page, index) => {
    const lines = pageLines(points, page.start, page.end)
    const words = ocr.words.filter((w) =>
      ocr.pages ? (w.page ?? 0) === index : true,
    )
    // Words per line, by where each word starts.
    const perLine = lines.map(() => ({ words: 0, low: 0 }))
    let line = 0
    if (lines.length)
      for (const w of [...words].sort((a, b) => a.start - b.start)) {
        while (line < lines.length - 1 && w.start > lines[line].end) line++
        perLine[line].words++
        // The same flag the pipeline routes evidence to review on.
        if (w.needsReview) perLine[line].low++
      }
    // Consecutive lines that pass a test, as runs numbered from 1.
    const runs = (keep: (c: { words: number; low: number }) => boolean) => {
      const found: LineRun[] = []
      perLine.forEach((counts, i) => {
        if (!keep(counts)) return
        const last = found.at(-1)
        if (last && last.to === i) {
          last.to = i + 1
          last.end = lines[i].end
          last.words += counts.words
          last.lowWords += counts.low
        } else
          found.push({
            from: i + 1,
            to: i + 1,
            start: lines[i].start,
            end: lines[i].end,
            words: counts.words,
            lowWords: counts.low,
          })
      })
      return found
    }
    const nonEmpty = lines
      .map((l, i) => ({ text: l.text, line: i + 1 }))
      .filter((l) => l.text.trim())
    const edges =
      nonEmpty.length <= EDGE_LINES * 2
        ? nonEmpty
        : [
            ...nonEmpty.slice(0, EDGE_LINES),
            ...nonEmpty.slice(-EDGE_LINES).reverse(),
          ]
    // Every counter on the page's edge lines, header lines first.
    const candidates: PageCounter[] = edges.flatMap((edge) =>
      readCounters(edge.text).map((c) => ({ ...c, line: edge.line })),
    )
    const scores = Object.values(page.orientation.scores).sort((a, b) => b - a)
    const handled =
      scores.length > 0 && scores[0] > 0 && scores[0] >= 2 * (scores[1] ?? 0)
    const confidences = words.map((w) => w.confidence)
    return {
      index,
      candidates,
      lines: lines.length,
      words: words.length,
      orientation: {
        pageRotation: page.orientation.pageRotation,
        deskewDegrees: page.deskewDegrees,
        handled,
      },
      meanConfidence: confidences.length
        ? confidences.reduce((n, c) => n + c, 0) / confidences.length
        : null,
      minConfidence: confidences.length ? Math.min(...confidences) : null,
      lowConfidenceLines: runs((c) => c.low > 0),
      unreadableLines: runs((c) => c.low > 0 && c.low === c.words),
    }
  })
  // Where a page carries more than one counter, such as a fax header and the
  // document's own footer, keep the one whose total most pages agree on.
  const votes = new Map<number, number>()
  for (const page of pages)
    for (const total of new Set(page.candidates.map((c) => c.of)))
      if (total !== null) votes.set(total, (votes.get(total) ?? 0) + 1)
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1])
  const agreed =
    ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1])
      ? ranked[0][0]
      : null
  const chosen: PageCoverage[] = pages.map(({ candidates, ...page }) => {
    const counter =
      candidates.find((c) => agreed !== null && c.of === agreed) ??
      candidates[0]
    return counter ? { ...page, counter } : page
  })
  return { threshold: ocr.threshold, ...countPages(chosen), pages: chosen }
}

// Missing pages from the counters alone: a gap in the page numbers, or a
// stated total the pages received fall short of. When the totals disagree,
// only gaps below the highest page number read are named.
export function countPages(
  pages: Pick<PageCoverage, "counter" | "orientation">[],
) {
  const received = pages.length
  const numbers = pages.flatMap((p) => (p.counter ? [p.counter.page] : []))
  const totals = pages.flatMap((p) => (p.counter?.of ? [p.counter.of] : []))
  const distinct = [...new Set(totals)].sort((a, b) => a - b)
  const conflictingTotals = distinct.length > 1 ? distinct : []
  const pagesExpected = distinct.length === 1 ? distinct[0] : null
  const seen = new Set<number>(),
    duplicates = new Set<number>()
  for (const n of numbers) (seen.has(n) ? duplicates : seen).add(n)
  const unnumbered = received - numbers.length
  // Without one agreed total, page numbers still show gaps up to the highest
  // one read.
  const last = pagesExpected ?? (seen.size ? Math.max(...seen) : 0)
  const unseen = Array.from({ length: last }, (_, i) => i + 1).filter(
    (n) => !seen.has(n),
  )
  // A page without a readable counter may be any one of the unseen numbers.
  const missingCount = Math.max(
    0,
    pagesExpected !== null
      ? pagesExpected - (seen.size + unnumbered)
      : unseen.length - unnumbered,
  )
  // Only name the missing pages when every received page carries a number.
  const missingPages = unnumbered === 0 ? unseen : []
  // Pages that arrived in a different order than their counters say.
  const outOfOrder = numbers.some((n, i) => i > 0 && n <= numbers[i - 1])
  return {
    pagesReceived: received,
    pagesExpected,
    missingPages,
    missingCount: Math.max(missingCount, missingPages.length),
    duplicatePages: [...duplicates].sort((a, b) => a - b),
    conflictingTotals,
    outOfOrder,
    complete:
      missingCount === 0 &&
      missingPages.length === 0 &&
      duplicates.size === 0 &&
      conflictingTotals.length === 0 &&
      !outOfOrder &&
      pages.every((p) => p.orientation.handled),
  }
}
