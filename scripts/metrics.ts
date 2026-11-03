import type {
  Coverage,
  Criterion,
  Entity,
  OcrOutput,
} from "../services/contracts.js"
import { pagesOf } from "../services/ocr/pages.js"
export function distance(a: string, b: string) {
  const aa = Array.from(a),
    bb = Array.from(b)
  let previous = Array.from({ length: bb.length + 1 }, (_, i) => i)
  for (let i = 1; i <= aa.length; i++) {
    const row = [i]
    for (let j = 1; j <= bb.length; j++)
      row[j] = Math.min(
        row[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(aa[i - 1] !== bb[j - 1]),
      )
    previous = row
  }
  return previous[bb.length]
}
export const normalizedText = (text: string) => text.replace(/\s+/g, " ").trim()

export const DATE_TYPES = new Set([
  "request_date",
  "conflicting_request_date",
  "fax_received_date",
  "measurement_date",
  "prior_start_date",
  "prior_stop_date",
  "prior_baseline_date",
  "prior_followup_date",
])
const shiftIso = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10)
// Undo the privacy step's per-packet date shift so values compare with gold.
export function unshift(value: unknown, days: number): unknown {
  if (typeof value === "string" && /^\d{4}-\d\d-\d\d$/.test(value))
    return shiftIso(value, -days)
  if (value && typeof value === "object" && "readings" in value)
    return {
      readings: (value as { readings: string[] }).readings.map((r) =>
        shiftIso(r, -days),
      ),
    }
  return value
}

// Pairs each [token] in redacted text with the raw text it replaced. The
// privacy step only replaces substrings, so the literal text between tokens
// anchors the match. Returns null if the texts do not line up.
const TOKEN = /\[(?:date-[a-z]+|[a-z]+(?:-[a-z]+)*)\]/g
export function alignTokens(raw: string, redacted: string) {
  const tokens = redacted.match(TOKEN) ?? []
  const parts = redacted.split(TOKEN)
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = raw.match(
    new RegExp(`^${parts.map(escape).join("([\\s\\S]*?)")}$`),
  )
  if (!match) return null
  return tokens.map((token, i) => ({ token, original: match[i + 1] }))
}
export function restoreDates(
  text: string,
  pairs: { token: string; original: string }[] | null,
) {
  if (!pairs) return text
  return text.replace(
    /\[date-[a-z]+\]/g,
    (t) => pairs.find((p) => p.token === t)?.original ?? t,
  )
}

const IDENTIFIER_TYPES = ["patient_name", "provider"]
const keyOf = (type: string, value: unknown) => JSON.stringify([type, value])
type GoldEntity = {
  type: string
  value: unknown
  source_span: { text: string }
  reviewed?: boolean
}
export function scoreEntities(
  predicted: Entity[],
  gold: GoldEntity[],
  options: {
    shift?: number
    pairs?: { token: string; original: string }[] | null
  } = {},
) {
  // Identifiers are deliberately removed before extraction and excluded from clinical scoring.
  const p = predicted.filter((e) => !IDENTIFIER_TYPES.includes(e.type))
  const g = gold.filter((e) => !IDENTIFIER_TYPES.includes(e.type))
  const remaining = g.map((e) => keyOf(e.type, e.value))
  let tp = 0,
    exactQuote = 0
  for (const e of p) {
    const value = DATE_TYPES.has(e.type)
      ? unshift(e.value, options.shift ?? 0)
      : e.value
    const key = keyOf(e.type, value)
    const index = remaining.indexOf(key)
    if (index < 0) continue
    tp++
    remaining[index] = ""
    const quote = restoreDates(e.source_span.text, options.pairs ?? null)
    if (
      g.some(
        (label) =>
          keyOf(label.type, label.value) === key &&
          label.source_span.text === quote,
      )
    )
      exactQuote++
  }
  return { tp, predicted: p.length, gold: g.length, exactQuote }
}
// True when the pipeline produced this gold entity's type and value.
export function found(predicted: Entity[], gold: GoldEntity, shift = 0) {
  return predicted.some(
    (e) =>
      e.type === gold.type &&
      JSON.stringify(
        DATE_TYPES.has(e.type) ? unshift(e.value, shift) : e.value,
      ) === JSON.stringify(gold.value),
  )
}

export type Status = "evidence_found" | "missing" | "needs_review"
export interface LabelResult {
  packet: string
  criterion: string
  scenario: string
  gold: Status
  predicted: Status
  quotes: boolean
  reviewed: boolean
}
type GoldCriterion = {
  criterion_id: string
  status: Status
  evidence_spans: { text: string }[]
  scenario: string
  reviewed: boolean
}
export function scoreCriteria(
  packet: string,
  predicted: Criterion[],
  gold: GoldCriterion[],
  pairs: { token: string; original: string }[] | null = null,
): LabelResult[] {
  return gold.map((g) => {
    const p = predicted.find((c) => c.criterion_id === g.criterion_id)
    const want = g.evidence_spans.map((s) => s.text).sort()
    const got = (p?.evidence_spans ?? [])
      .map((s) => restoreDates(s.text, pairs))
      .sort()
    return {
      packet,
      criterion: g.criterion_id,
      scenario: g.scenario,
      gold: g.status,
      predicted: (p?.status ?? "missing") as Status,
      quotes:
        p?.status === g.status && JSON.stringify(want) === JSON.stringify(got),
      reviewed: g.reviewed,
    }
  })
}

const STATUSES: Status[] = ["evidence_found", "missing", "needs_review"]
// Accuracy beside the always-"evidence found" baseline, recall and precision
// for each status, and how often the tool said "found" when the label did not.
export function summarize(rows: LabelResult[]) {
  const total = rows.length
  const correct = rows.filter((r) => r.predicted === r.gold).length
  const yes = rows.filter((r) => r.gold === "evidence_found").length
  const byStatus = Object.fromEntries(
    STATUSES.map((s) => {
      const gold = rows.filter((r) => r.gold === s).length
      const predicted = rows.filter((r) => r.predicted === s).length
      const hit = rows.filter((r) => r.gold === s && r.predicted === s).length
      return [
        s,
        {
          gold,
          predicted,
          hit,
          recall: gold ? hit / gold : null,
          precision: predicted ? hit / predicted : null,
        },
      ]
    }),
  ) as Record<
    Status,
    {
      gold: number
      predicted: number
      hit: number
      recall: number | null
      precision: number | null
    }
  >
  const notFound = rows.filter((r) => r.gold !== "evidence_found")
  return {
    total,
    correct,
    accuracy: total ? correct / total : null,
    alwaysFound: { correct: yes, accuracy: total ? yes / total : null },
    byStatus,
    falseFound: {
      count: notFound.filter((r) => r.predicted === "evidence_found").length,
      of: notFound.length,
    },
    statusAndQuotes: rows.filter((r) => r.quotes).length,
    // Label status, then answer.
    confusion: Object.fromEntries(
      STATUSES.map((g) => [
        g,
        Object.fromEntries(
          STATUSES.map((p) => [
            p,
            rows.filter((r) => r.gold === g && r.predicted === p).length,
          ]),
        ),
      ]),
    ) as Record<Status, Record<Status, number>>,
    // "Not documented" where the label is evidence found or needs review: the
    // answer that would tell a nurse to request something already on the page.
    falseMissing: {
      count: rows.filter(
        (r) => r.gold !== "missing" && r.predicted === "missing",
      ).length,
      of: rows.filter((r) => r.gold !== "missing").length,
    },
    // How many criteria the tool hands to a person to decide.
    sentToReview: {
      count: rows.filter((r) => r.predicted === "needs_review").length,
      of: total,
    },
  }
}

// Evaluation only. Lines up two texts character by character with the fewest
// edits and returns, for each character of a, the index in b it lines up
// with, or -1 where a's character was dropped.
export function alignChars(a: string[], b: string[]) {
  const width = b.length + 1
  // 0 keeps or swaps a character, 1 drops one from a, 2 adds one from b.
  const step = new Uint8Array((a.length + 1) * width)
  let previous = new Uint32Array(width),
    row = new Uint32Array(width)
  for (let j = 0; j <= b.length; j++) {
    previous[j] = j
    step[j] = 2
  }
  for (let i = 1; i <= a.length; i++) {
    row[0] = i
    step[i * width] = 1
    for (let j = 1; j <= b.length; j++) {
      let best = previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
        move = 0
      if (previous[j] + 1 < best) {
        best = previous[j] + 1
        move = 1
      }
      if (row[j - 1] + 1 < best) {
        best = row[j - 1] + 1
        move = 2
      }
      row[j] = best
      step[i * width + j] = move
    }
    ;[previous, row] = [row, previous]
  }
  const map = new Int32Array(a.length).fill(-1)
  let i = a.length,
    j = b.length
  while (i > 0 || j > 0) {
    const move = i === 0 ? 2 : j === 0 ? 1 : step[i * width + j]
    if (move === 0) map[--i] = --j
    else if (move === 1) i--
    else j--
  }
  return map
}

export interface UnreadLine {
  // Zero-based page, and the line on that page as written, numbered from 1.
  page: number
  line: number
  text: string
  // Whether the OCR coverage already marks the place as low confidence.
  flagged: boolean
}
// Evaluation only. Lines up the page's source lines with its OCR lines first,
// whole line against whole line, with the fewest character edits. A source
// line may match one OCR line or two, for a line OCR wrapped, or none. Then a
// source line counts as unread when fewer than a quarter of its visible
// characters, underscores of blank fields aside, come back from the OCR
// line it matched as the same character in the same order. Matching whole
// lines first means a lost line cannot borrow the characters of a similar
// line that survived. Production has no source text, so none of this is ever
// passed to the pipeline. flagged says whether the coverage the pipeline does
// get, from the OCR output alone, marks that place as low confidence. An
// unflagged line vanished without a trace.
export function unreadSourceLines(
  sourcePages: string[],
  ocr: OcrOutput,
  coverage: Coverage,
) {
  const points = Array.from(ocr.text)
  const unread: UnreadLine[] = []
  let lines = 0
  const visibleOf = (s: string) => Array.from(s).filter((c) => !/[\s_]/.test(c))
  for (const [page, layout] of pagesOf(ocr).entries()) {
    const runs = coverage.pages[page]?.lowConfidenceLines ?? []
    // OCR lines on this page, with where each starts in the joined text.
    const read: { text: string; start: number }[] = []
    let at = layout.start
    for (const line of points
      .slice(layout.start, layout.end)
      .join("")
      .split("\n")) {
      if (line.trim()) read.push({ text: line, start: at })
      at += Array.from(line).length + 1
    }
    const written = (sourcePages[page] ?? "")
      .split("\n")
      .map((text, index) => ({ text, line: index + 1 }))
      .filter((l) => visibleOf(l.text).length)
    lines += written.length
    // Cost of matching source line i to OCR lines a up to b, joined.
    const joined = (a: number, b: number) =>
      read
        .slice(a, b + 1)
        .map((r) => r.text)
        .join(" ")
    const cost = (i: number, a: number, b: number) =>
      distance(
        visibleOf(written[i].text).join(""),
        visibleOf(joined(a, b)).join(""),
      )
    const n = written.length,
      m = read.length
    const best = Array.from({ length: n + 1 }, () =>
      new Array(m + 1).fill(Infinity),
    )
    const step = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(""))
    best[0][0] = 0
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= m; j++) {
        const here = best[i][j]
        if (here === Infinity) continue
        const offer = (ii: number, jj: number, value: number, move: string) => {
          if (value < best[ii][jj]) {
            best[ii][jj] = value
            step[ii][jj] = move
          }
        }
        if (i < n)
          offer(i + 1, j, here + visibleOf(written[i].text).length, "lost")
        if (j < m)
          offer(i, j + 1, here + visibleOf(read[j].text).length, "extra")
        if (i < n && j < m) offer(i + 1, j + 1, here + cost(i, j, j), "one")
        if (i < n && j + 1 < m)
          offer(i + 1, j + 2, here + cost(i, j, j + 1), "two")
      }
    // Walk back to find which OCR lines each source line matched.
    const matched: number[][] = written.map(() => [])
    let i = n,
      j = m
    while (i > 0 || j > 0) {
      const move = step[i][j]
      if (move === "lost") i--
      else if (move === "extra") j--
      else {
        const width = move === "two" ? 2 : 1
        matched[i - 1] = Array.from({ length: width }, (_, k) => j - width + k)
        i--
        j -= width
      }
    }
    for (const [k, line] of written.entries()) {
      const source = visibleOf(line.text)
      const target = matched[k].length
        ? visibleOf(joined(matched[k][0], matched[k].at(-1)!))
        : []
      const map = alignChars(source, target)
      const same = source.filter(
        (c, x) => map[x] >= 0 && target[map[x]] === c,
      ).length
      const flagged = matched[k].some((r) =>
        runs.some(
          (run) =>
            read[r].start < run.end &&
            run.start < read[r].start + Array.from(read[r].text).length,
        ),
      )
      if (same / source.length < 0.25)
        unread.push({ page, line: line.line, text: line.text, flagged })
    }
  }
  return { lines, unread }
}

export const f1 = (tp: number, predicted: number, gold: number) => ({
  precision: predicted ? tp / predicted : 0,
  recall: gold ? tp / gold : 0,
  f1: predicted + gold ? (2 * tp) / (predicted + gold) : 0,
  tp,
  predicted,
  gold,
})
