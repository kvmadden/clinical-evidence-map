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
export interface Entity {
  id: string
  type: string
  value: string | number | { name: string; value: number; unit: string }
  source_span: Span
  normalization?: Normalization
  reviewed: false
}
export interface Word {
  text: string
  confidence: number
  box: { x: number; y: number; width: number; height: number }
  start: number
  end: number
  needsReview: boolean
}
export interface OcrInput {
  image: string
  threshold?: number
}
export interface OcrOutput {
  text: string
  words: Word[]
  threshold: number
  engine: string
}
export interface RedactInput {
  text: string
}
export interface RedactOutput {
  text: string
  blocked: boolean
  hits: unknown[]
  offsetBasis: "redacted Unicode code points"
}
export interface ExtractInput {
  text: string
}
export interface ExtractOutput {
  entities: Entity[]
  offsetBasis: "Unicode code points"
}
export type Status = "evidence_found" | "missing" | "needs_review"
export interface Criterion {
  criterion_id: string
  status: Status
  evidence_spans: Span[]
  reason: string
  reviewed: false
}
export interface LinkInput {
  text: string
  entities: Entity[]
  criteriaId: string
  words?: Word[]
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
