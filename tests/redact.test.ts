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

test("redact contract removes seeded identifiers and preserves clinical content", () => {
  const result = redact({
    text: "Patient: Mira Brookvale. Email: mira@example.test.\nDiagnosis: Type 2 diabetes mellitus.",
  })
  assert.equal(result.blocked, false)
  assert.ok(!result.text.includes("mira@example.test"))
  assert.ok(!result.text.includes("Mira Brookvale"))
  assert.match(result.text, /Type 2 diabetes mellitus/)
  assert.equal(result.offsetBasis, "redacted Unicode code points")
})
