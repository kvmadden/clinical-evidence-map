import type { Entity, Criterion } from "../services/contracts.js"
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
const entityKey = (e: Entity) => JSON.stringify([e.type, e.value])
export function scoreEntities(predicted: Entity[], gold: Entity[]) {
  // Identifiers are deliberately removed before extraction and excluded from clinical scoring.
  const clinical = (e: Entity) => !["patient_name", "provider"].includes(e.type)
  const p = predicted.filter(clinical),
    g = gold.filter(clinical)
  const remaining = g.map(entityKey)
  let tp = 0,
    exactQuote = 0
  for (const e of p) {
    const index = remaining.indexOf(entityKey(e))
    if (index < 0) continue
    tp++
    remaining[index] = ""
    if (
      g.some(
        (label) =>
          entityKey(label) === entityKey(e) &&
          label.source_span.text === e.source_span.text,
      )
    )
      exactQuote++
  }
  return { tp, predicted: p.length, gold: g.length, exactQuote }
}
export function scoreCriteria(predicted: Criterion[], gold: Criterion[]) {
  let correct = 0,
    supportedSpanCorrect = 0
  for (const g of gold) {
    const p = predicted.find((c) => c.criterion_id === g.criterion_id)
    if (p?.status === g.status) {
      correct++
      if (
        p.evidence_spans.length === g.evidence_spans.length &&
        g.evidence_spans.every((s) =>
          p.evidence_spans.some((t) => t.text === s.text),
        )
      )
        supportedSpanCorrect++
    }
  }
  return { correct, total: gold.length, supportedSpanCorrect }
}
export const f1 = (tp: number, predicted: number, gold: number) => ({
  precision: predicted ? tp / predicted : 0,
  recall: gold ? tp / gold : 0,
  f1: predicted + gold ? (2 * tp) / (predicted + gold) : 0,
  tp,
  predicted,
  gold,
})
