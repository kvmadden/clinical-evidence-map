import { test } from "node:test"
import assert from "node:assert/strict"
import { redact } from "../services/redact/index.js"
import { extract } from "../services/extract/index.js"
import { linkEvidence } from "../services/link-evidence/index.js"

const complete = [
  "Request date: 2026-10-01.",
  "Age: 33 years.",
  "Request: semaglutide 0.5 mg weekly.",
  "Indication for this request: Type 2 diabetes mellitus.",
  "A1c: 8.6 %; collected 2026-09-15.",
  "MEDICATION HISTORY",
  "Current requested therapy: semaglutide 0.5 mg weekly.",
  "Prior therapy: metformin 1000 mg twice daily.",
  "Trial dates: started 2026-04-01; stopped 2026-08-01.",
  "Baseline before metformin: A1c 9.4 % on 2026-03-25.",
  "On metformin: A1c 8.9 % on 2026-07-20; goal below 7.0 % not met.",
  "",
].join("\n")
const status = (text: string, id: string, criteriaId = "glp1-t2d") => {
  const privacy = redact({ text, dateShiftDays: 40000 })
  const { entities } = extract({ text: privacy.text, dates: privacy.dates })
  return linkEvidence({
    text: privacy.text,
    entities,
    criteriaId,
  }).criteria.find((c) => c.criterion_id === id)!
}

test("a complete packet with objective prior evidence meets every fictional rule", () => {
  for (const id of ["adult", "diagnosis", "lab", "prior", "dose"])
    assert.equal(status(complete, id).status, "evidence_found", id)
})

test("a bare inadequate response needs review and says why", () => {
  const bare = complete
    .replace("Baseline before metformin: A1c 9.4 % on 2026-03-25.\n", "")
    .replace(
      "On metformin: A1c 8.9 % on 2026-07-20; goal below 7.0 % not met.\n",
      "Inadequate response documented.\n",
    )
  const c = status(bare, "prior")
  assert.equal(c.status, "needs_review")
  assert.match(c.reason, /no A1c before and after the trial/)
})

test("prior therapy near misses route to review or count as not documented", () => {
  assert.equal(
    status(
      complete.replace("stopped 2026-08-01", "stopped 2026-05-15"),
      "prior",
    ).status,
    "needs_review",
  )
  assert.equal(
    status(complete.replace("A1c 8.9 %", "A1c 6.8 %"), "prior").status,
    "needs_review",
  )
  assert.equal(
    status(complete.replaceAll("metformin", "glipizide"), "prior").status,
    "missing",
  )
  const intolerant = complete.replace(
    /Baseline[^\n]*\n|On metformin[^\n]*\n/g,
    "",
  )
  assert.equal(
    status(
      intolerant + "Stopped for persistent nausea and diarrhea.\n",
      "prior",
    ).status,
    "evidence_found",
  )
  assert.equal(
    status(intolerant + "Stopped due to intolerance.\n", "prior").status,
    "needs_review",
  )
})

test("diagnosis must be the reason for this request", () => {
  const without = complete.replace(
    "Indication for this request: Type 2 diabetes mellitus.\n",
    "",
  )
  assert.equal(
    status(
      without +
        "Past medical history: Type 2 diabetes mellitus, hypertension.\n",
      "diagnosis",
    ).status,
    "needs_review",
  )
  assert.equal(
    status(
      complete.replace(
        "Type 2 diabetes mellitus.",
        "obesity, for chronic weight management.",
      ),
      "diagnosis",
    ).status,
    "missing",
  )
  assert.equal(
    status(
      complete.replace(
        "Type 2 diabetes mellitus.",
        "possible type 2 diabetes.",
      ),
      "diagnosis",
    ).status,
    "needs_review",
  )
  assert.equal(
    status(without + "Diagnosis for this request: ________\n", "diagnosis")
      .reason,
    "The diagnosis field is blank.",
  )
})

test("lab, dose and age near misses", () => {
  // The A1c after 90 days of metformin is itself within 180 days, so drop it here.
  const labOnly = complete.replace(/Baseline[^\n]*\n|On metformin[^\n]*\n/g, "")
  assert.equal(
    status(labOnly.replace("2026-09-15", "2026-01-01"), "lab").status,
    "needs_review",
  )
  assert.equal(
    status(complete.replace("2026-09-15", "2026-01-01"), "lab").status,
    "evidence_found",
  )
  assert.equal(
    status(complete + "Request date recorded in note: 2026-09-01.\n", "lab")
      .status,
    "needs_review",
  )
  assert.equal(
    status(
      complete.replace(
        "Request: semaglutide 0.5 mg weekly.",
        "Request: semaglutide 0.5 mg daily.",
      ),
      "dose",
    ).status,
    "needs_review",
  )
  assert.equal(
    status(
      complete.replace(
        "Current requested therapy: semaglutide 0.5 mg weekly.",
        "Current requested therapy: semaglutide 1 mg weekly.",
      ),
      "dose",
    ).status,
    "needs_review",
  )
  assert.equal(
    status(
      complete.replace(
        "Request: semaglutide 0.5 mg weekly.",
        "Request: Ozempic 0.5mg SC qwk.",
      ),
      "dose",
    ).status,
    "evidence_found",
  )
  assert.equal(
    status(complete.replace("Age: 33", "Age: 17"), "adult").status,
    "needs_review",
  )
  assert.equal(
    status(complete.replace("Age: 33 years.\n", ""), "adult").status,
    "missing",
  )
})

test("ambiguous dates that change the answer need review and keep both readings", () => {
  const dayFirst = complete
    .replace("2026-10-01", "01/10/2026")
    .replace("2026-09-15", "08/09/2026")
    .replace("2026-04-01", "01/04/2026")
    .replace("2026-08-01", "01/08/2026")
    .replace("2026-03-25", "11/03/2026")
    .replace("2026-07-20", "06/07/2026")
  for (const id of ["lab", "prior"]) {
    const c = status(dayFirst, id)
    assert.equal(c.status, "needs_review", id)
    assert.match(c.reason, /month first or day first/)
  }
  // A received date settles the order: month first would put a date after it.
  assert.equal(
    status("Fax received: 2 Oct 2026 09:14.\n" + dayFirst, "prior").status,
    "evidence_found",
  )
})

test("a low-confidence spelling variant or OCR word routes found evidence to review", () => {
  const privacy = redact({ text: complete, dateShiftDays: 0 })
  const { entities } = extract({ text: privacy.text, dates: privacy.dates })
  const span = entities.find((e) => e.type === "age")!.source_span
  const words = [
    {
      text: "33",
      confidence: 30,
      start: span.start + 5,
      end: span.start + 7,
      needsReview: true,
      box: { x: 1, y: 2, width: 3, height: 4 },
    },
  ]
  assert.equal(
    linkEvidence({
      text: privacy.text,
      entities,
      criteriaId: "glp1-t2d",
      words,
    }).criteria[0].status,
    "needs_review",
  )
})
