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

test("link contract checks values, dates, duration, contradiction and missing evidence", () => {
  const run = (body: string) =>
    linkEvidence({
      text: body,
      entities: extract({ text: body }).entities,
      criteriaId: "glp1-t2d",
    }).criteria
  assert.ok(run(text).every((c) => c.status === "evidence_found"))
  assert.equal(
    run(text.replace(/A1c:.*\n/, "")).find((c) => c.criterion_id === "lab")
      ?.status,
    "missing",
  )
  assert.equal(
    run(text.replace("2026-09-15", "2026-01-01")).find(
      (c) => c.criterion_id === "lab",
    )?.status,
    "needs_review",
  )
  assert.equal(
    run(
      text.replace(
        "Current requested therapy: semaglutide 0.5 mg weekly.",
        "Current requested therapy: semaglutide 999 mg daily.",
      ),
    ).find((c) => c.criterion_id === "dose")?.status,
    "needs_review",
  )
  assert.equal(
    run(text.replace("Age: 33", "Age: 12")).find(
      (c) => c.criterion_id === "adult",
    )?.status,
    "needs_review",
  )
  assert.equal(
    run(text.replace("started 2026-04-01", "started 2026-07-25")).find(
      (c) => c.criterion_id === "prior",
    )?.status,
    "needs_review",
  )
  assert.equal(
    run(text + "Request date recorded in note: 2026-09-01.").find(
      (c) => c.criterion_id === "lab",
    )?.status,
    "needs_review",
  )
  assert.equal(
    run(
      text.replace(
        "Diagnosis: Type 2 diabetes mellitus.",
        "Diagnosis: No Type 2 diabetes mellitus.",
      ),
    ).find((c) => c.criterion_id === "diagnosis")?.status,
    "needs_review",
  )
})
