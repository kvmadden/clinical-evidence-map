export const DRAFT = "draft, pending pharmacist review"
export interface Span {
  start: number
  end: number
  text: string
}
export interface Normalization {
  system: "RxNorm" | "ICD-10-CM"
  code: string
  display: string
}
export type DateEntityValue = string | { readings: [string, string] }
export type EntityValue =
  | string
  | number
  | { name: string; value: number; unit: string }
  | { condition: string; certainty: "confirmed" | "unconfirmed" }
  | { readings: [string, string] }
export interface Match {
  // How the written words were matched to the canonical value.
  kind: "exact" | "brand" | "abbreviation" | "spelling-variant" | "look-alike"
  written: string
  confidence: number
}
export interface Entity {
  id: string
  type: string
  value: EntityValue
  source_span: Span
  normalization?: Normalization
  match?: Match
  // Ids of entities read together with this one, such as a value's date.
  related?: string[]
  // Every physical line the entity rests on, when a value wraps onto the next
  // line or a table cell binds to its header. source_span is the first.
  spans?: Span[]
  // Code point range of the words the decision used (the number, the date
  // token, the drug or condition name). The OCR confidence gate looks here.
  value_span?: { start: number; end: number }
  // Code point range of the name a value belongs to, such as the lab name
  // before a result. The OCR confidence gate looks here too.
  name_span?: { start: number; end: number }
  // Treatment episode this entity belongs to, for drug-linked prior therapy.
  episode?: number
  // How the reader understood the mention: assertion context, checkbox
  // state, drug, outcome type. Never used for scoring values.
  attrs?: Record<string, string | number | boolean>
  reviewed: false
}
export interface Word {
  text: string
  confidence: number
  box: { x: number; y: number; width: number; height: number }
  start: number
  end: number
  needsReview: boolean
  // Zero-based page the word was read on, in the order pages were received.
  // Absent on a one-page packet, where every word is on page 0. The box is in
  // that page's read image.
  page?: number
}
export interface OcrInput {
  image: string
  threshold?: number
}
// One page of a packet of several pages, as OCR read it.
export interface OcrPage {
  // File name of the page image as received.
  image: string
  // File name of the straightened copy the words and boxes refer to.
  readImage: string
  width: number
  height: number
  orientation: { pageRotation: number; scores: Record<string, number> }
  deskewDegrees: number
  // Code-point range of this page's text in OcrOutput.text, final line break included.
  start: number
  end: number
}
export interface OcrOutput {
  // For several pages, every page's text in the order received, joined as is.
  text: string
  words: Word[]
  threshold: number
  engine: string
  // Clockwise turn the page arrived with, chosen from quick reads of each candidate.
  orientation?: { pageRotation: number; scores: Record<string, number> }
  // Small skew corrected before reading, in degrees.
  deskewDegrees?: number
  // File name of the straightened image the words and boxes refer to.
  readImage?: string
  width?: number
  height?: number
  // Present only for a packet of more than one page. Each page keeps its own
  // image, turn, skew and size here, and the five page fields above are left out.
  pages?: OcrPage[]
  // What arrived and what could be read. Built from the OCR output alone by
  // services/ocr/coverage.ts, so it is the same in evaluation and in use.
  coverage?: Coverage
}
// A run of consecutive OCR lines on one page, numbered from 1 on that page.
export interface LineRun {
  from: number
  to: number
  // Code-point range of the run in OcrOutput.text, from the first line's
  // start to the last line's end, line break excluded.
  start: number
  end: number
  words: number
  // Words in the run below the OCR review threshold.
  lowWords: number
}
// A page counter printed on the page, in a fax header or a footer, as read.
export interface PageCounter {
  // The counter as OCR read it, such as "P.002/003" or "Page 2 of 3".
  text: string
  // Line on the page it was read from, numbered from 1.
  line: number
  page: number
  // Total pages the counter states, or null when it gives only the page number.
  of: number | null
}
export interface PageCoverage {
  // Zero-based position in the order the pages were received.
  index: number
  counter?: PageCounter
  lines: number
  words: number
  // The turn and skew undone before reading. handled is true when the quick
  // reads chose the turn by a clear margin, at least twice the next best.
  orientation: { pageRotation: number; deskewDegrees: number; handled: boolean }
  // Word confidence on the page, 0 to 100. Null when OCR found no words.
  meanConfidence: number | null
  minConfidence: number | null
  // Runs of lines that hold at least one word below the review threshold.
  lowConfidenceLines: LineRun[]
  // Runs of lines where every word is below it: OCR saw text there but could
  // not read any of it with confidence. Each run sits inside a run above.
  unreadableLines: LineRun[]
}
// Whether the whole packet arrived and was read. "Not documented" is only a
// fair answer when it did. This record is passed to the reading rules with
// the OCR output, and a missing, unreadable or out-of-order page blocks
// every "not documented" answer. Missing pages come from page counters only: a gap
// in the page numbers, or a stated total that does not match the pages
// received. A packet without counters gives no count to check against.
export interface Coverage {
  threshold: number
  pagesReceived: number
  // Total the counters state. Null when no page states one, or when they disagree.
  pagesExpected: number | null
  // Page numbers the counters account for that were not received.
  missingPages: number[]
  // How many pages are missing, including any whose number cannot be told
  // because a received page carries no readable counter.
  missingCount: number
  // Page numbers received more than once, and totals that disagree. When
  // totals disagree, pagesExpected is null and only gaps below the highest
  // page number read are named missing.
  duplicatePages: number[]
  conflictingTotals: number[]
  // True when the counters say the pages arrived in another order. The text
  // is still joined in the order received.
  outOfOrder: boolean
  // True when no page is missing, the counters agree, the pages are in order
  // and every page's turn was handled. Low-confidence lines do not change it.
  // They are listed per page for the reader to weigh against the evidence it
  // needs.
  complete: boolean
  pages: PageCoverage[]
}
// One reason the reader cannot claim that an item is absent.
export interface Blocker {
  kind:
    | "missing-page"
    | "pages-out-of-order"
    | "unreadable-page"
    | "low-confidence-line"
    | "unparsed-mention"
    | "unbound-outcome"
    | "redacted-clinical-word"
    | "unreadable-date"
  line?: number
  page?: number
  // What the blocker is about: a condition family (t2dm, psoriasis, ascvd),
  // a drug group (metformin, methotrexate, statin) or a requested drug
  // (semaglutide, adalimumab, evolocumab). Absent means every criteria set.
  scope?: string
  // Also stops an "evidence found" answer: the unread line could disagree
  // with the evidence, such as a medication-list dose that could not be read.
  blocksFound?: boolean
  message: string
}
export type CriterionId = "adult" | "diagnosis" | "lab" | "prior" | "dose"
// A clinical mention the reader understood but did not turn into evidence,
// such as a negated, family, hypothetical or untied condition, or a date of
// birth. The linker uses these to tell "not documented" apart from
// "mentioned, but not as evidence".
export interface Mention {
  criterion: CriterionId
  scope?: string
  line: number
  kind: string
  value?: string
  // The line the mention is on, so an answer can cite it.
  span?: Span
}
// The reader's account of the page: per criterion, the lines that mention it
// but could not be turned into facts, and page-level blockers.
export interface ReaderCoverage {
  lines: number
  pages: number
  blockers: Record<CriterionId, Blocker[]>
  mentions?: Mention[]
  // Set when the page reader sent a coverage record. False when a page is
  // missing, out of order, unaccounted for or unreadable. Found answers stay
  // found on an incomplete packet, and the packet is marked here.
  complete?: boolean
  // What makes the packet incomplete, in plain words.
  incomplete?: string[]
}
export interface RedactInput {
  text: string
  // Whole days added to every recognized date. Omit it to remove dates.
  dateShiftDays?: number
}
export interface DateMention {
  // Token that replaced the written date in the redacted text, like [date-b].
  token: string
  // Shifted ISO readings. Two readings mean month first, then day first.
  readings: string[]
  // ymd and text are unambiguous. mdy and dmy were settled by a number above 12.
  order: "ymd" | "text" | "mdy" | "dmy" | "same" | "ambiguous"
  // "month" when only a month and year were written, read as the first day.
  precision?: "day" | "month"
}
export interface RedactOutput {
  text: string
  blocked: boolean
  hits: unknown[]
  offsetBasis: "redacted Unicode code points"
  dateHandling: "shifted" | "removed"
  dates: DateMention[]
  // Lines where the privacy step removed a word that the clinical vocabulary
  // knows (a drug, condition, lab or form word). The word itself is not kept.
  removedClinical?: { line: number; category: string }[]
}
export interface ExtractInput {
  text: string
  dates?: DateMention[]
  // Zero-based line indexes with low OCR confidence words.
  lowConfidenceLines?: number[]
  // The low-confidence words themselves, by line, so a line can be judged
  // mostly unreadable or ruled irrelevant to a criterion.
  lowConfidenceWords?: { line: number; text: string }[]
  // First line of each page after the first, when pages were joined without
  // a page-break line.
  pageStartLines?: number[]
  removedClinical?: { line: number; category: string }[]
}
export interface DateReading {
  // How ambiguous numeric dates were read for this packet.
  status: "none" | "forced" | "header" | "unresolved" | "conflict"
  order: "mdy" | "dmy" | null
}
export interface ExtractOutput {
  entities: Entity[]
  offsetBasis: "Unicode code points"
  dateReading: DateReading
  coverage?: ReaderCoverage
}
export type Status = "evidence_found" | "missing" | "needs_review"
export interface Criterion {
  criterion_id: string
  status: Status
  evidence_spans: Span[]
  reason: string
  // What kept the reader from claiming absence or a clean match, if anything.
  blocked_by?: string[]
  reviewed: false
}
export interface LinkInput {
  text: string
  entities: Entity[]
  criteriaId: string
  words?: Word[]
  coverage?: ReaderCoverage
}
export interface LinkOutput {
  criteria: Criterion[]
}
export interface Sentence {
  text: string
  citations: Span[]
}
export interface VerifyInput {
  words?: Word[]
  text: string
  sentences: Sentence[]
}
export interface VerifyOutput {
  sentences: (Sentence & {
    supported: boolean
    needsReview: boolean
    reason: string
  })[]
}
export interface ReviewInput {
  packetId: string
  action: "accept" | "correct" | "flag"
  target: string
  note: string
}
export interface ReviewEvent extends ReviewInput {
  id: string
  timestamp: string
  previousHash: string
  hash: string
  reviewed: false
}
export function slice(text: string, start: number, end: number) {
  return Array.from(text).slice(start, end).join("")
}
export function validSpan(text: string, span: Span) {
  return (
    span.start >= 0 &&
    span.end > span.start &&
    slice(text, span.start, span.end) === span.text
  )
}
