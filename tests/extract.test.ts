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

test("extract contract returns exact Unicode spans and public terminology codes", () => {
  const result = extract({ text: "🩺\n" + text })
  const med = result.entities.find((e) => e.type === "requested_medication")!
  assert.equal(med.value, "semaglutide")
  assert.equal(med.normalization?.code, "1991302")
  assert.equal(med.normalization?.system, "RxNorm")
  for (const e of result.entities)
    assert.equal(
      Array.from("🩺\n" + text)
        .slice(e.source_span.start, e.source_span.end)
        .join(""),
      e.source_span.text,
    )
  assert.equal(
    result.entities.find((e) => e.type === "diagnosis")?.normalization?.code,
    "E11.9",
  )
  assert.ok(result.entities.every((e) => e.reviewed === false))
})
