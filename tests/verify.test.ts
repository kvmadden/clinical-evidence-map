import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { redact } from "../services/redact/index.js"
import { extract } from "../services/extract/index.js"
import { linkEvidence } from "../services/link-evidence/index.js"
import { verify } from "../services/verify/index.js"
import { appendReview, readReviews } from "../services/audit/index.js"
import { parseTsv, renderFax, createOcr } from "../services/ocr/index.js"

const text =
  "Request date: 2026-10-01.\nAge: 33 years.\nRequest: semaglutide 0.5 mg weekly.\nDiagnosis: Type 2 diabetes mellitus.\nA1c: 8.6 %; collected 2026-09-15.\nCurrent requested therapy: semaglutide 0.5 mg weekly.\nPrior therapy: metformin 1000 mg twice daily; started 2026-04-01; stopped 2026-08-01; inadequate response documented.\n"

test("verify contract rejects uncited, fabricated and unrelated cited claims", () => {
  const span = extract({ text }).entities.find(
    (e) => e.type === "requested_medication",
  )!.source_span
  const result = verify({
    text,
    sentences: [
      { text: span.text, citations: [span] },
      { text: "The patient is cured.", citations: [] },
      { text: "The patient is cured.", citations: [span] },
      { text: span.text, citations: [{ ...span, start: 999 }] },
    ],
  })
  assert.deepEqual(
    result.sentences.map((s) => s.supported),
    [true, false, false, false],
  )
})

test("verifier routes low confidence cited words to review without losing citation support", () => {
  const span = extract({ text }).entities.find(
    (e) => e.type === "requested_medication",
  )!.source_span
  const result = verify({
    text,
    sentences: [{ text: span.text, citations: [span] }],
    words: [
      {
        text: "0.5",
        confidence: 42,
        start: span.start + 10,
        end: span.start + 13,
        needsReview: true,
        box: { x: 1, y: 2, width: 3, height: 4 },
      },
    ],
  })
  assert.equal(result.sentences[0].supported, true)
  assert.equal(result.sentences[0].needsReview, true)
})
