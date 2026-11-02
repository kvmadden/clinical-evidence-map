import { readFile } from "node:fs/promises"
import { redact } from "./redact/index.js"
import { extract } from "./extract/index.js"
import { linkEvidence } from "./link-evidence/index.js"
import { verify } from "./verify/index.js"
import type { OcrOutput, Span, Word } from "./contracts.js"
import { DRAFT } from "./contracts.js"
export const sourceBody = (markdown: string) =>
  markdown.split("<!-- SOURCE START -->\n")[1]
export async function loadManifest() {
  return JSON.parse(await readFile("eval/manifest.json", "utf8")) as {
    packets: { packet_id: string; criteria_id: string; quality_group: string }[]
  }
}
export function processText(text: string, criteriaId: string, ocr?: OcrOutput) {
  const privacy = redact({ text })
  if (privacy.blocked) throw new Error("Privacy gate blocked this packet")
  const extracted = extract({ text: privacy.text })
  // Map unchanged clinical words into the redacted coordinate basis. Removed names
  // are never attributed to clinical spans. Raw OCR remains a separate local view.
  const words: Word[] = []
  if (ocr) {
    let cursor = 0
    for (const word of ocr.words) {
      const position = privacy.text.indexOf(word.text, cursor)
      if (position < 0) continue
      const start = Array.from(privacy.text.slice(0, position)).length
      words.push({ ...word, start, end: start + Array.from(word.text).length })
      cursor = position + word.text.length
    }
  }
  const linked = linkEvidence({
    text: privacy.text,
    entities: extracted.entities,
    criteriaId,
    words,
  })
  const seen = new Set<string>()
  const sentences = extracted.entities
    .filter((e) =>
      [
        "diagnosis",
        "requested_medication",
        "measurement",
        "prior_medication",
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
