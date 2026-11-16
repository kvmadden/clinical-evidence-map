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

test("a problem-list diagnosis beside a different requested indication is not the request diagnosis", () => {
  const text = [
    "Request date: 2026-10-21. Age: 17 years.",
    "Requested indication: appetite management. Problem list: type 2 diabetes.",
    "Medication requested: semaglutide 0.5 mg SQ weekly.",
  ].join("\n")
  const c = status(text, "diagnosis")
  assert.equal(c.status, "needs_review")
  assert.ok(
    c.evidence_spans.some((span) =>
      /Problem list: type 2 diabetes/.test(span.text),
    ),
  )
  assert.equal(
    status(
      "Request date: 2026-10-21. Age: 17 years.\nIndication for this request: appetite management, problem list: type 2 diabetes.\n",
      "diagnosis",
    ).status,
    "needs_review",
  )
  assert.equal(
    status(
      "Request date: 2026-10-21. Age: 17 years.\nProblem list: hypertension. Requested indication: type 2 diabetes.\n",
      "diagnosis",
    ).status,
    "evidence_found",
  )
  assert.equal(
    status(
      "Request date: 2026-10-21.\nDiagnosis: type 2 diabetes.\n",
      "diagnosis",
    ).status,
    "evidence_found",
  )

  // An explicit indication remains a true positive, including a compound one.
  assert.equal(status(complete, "diagnosis").status, "evidence_found")
  assert.equal(
    status(
      complete.replace(
        "Indication for this request: Type 2 diabetes mellitus.",
        "Indication for this request: Type 2 diabetes mellitus and hypertension.",
      ),
      "diagnosis",
    ).status,
    "evidence_found",
  )
})

test("inline condition fields use the same labels as standalone fields", () => {
  for (const history of ["PMH", "Comorbidities"]) {
    assert.equal(
      status(
        `Requested indication: appetite management. ${history}: type 2 diabetes.`,
        "diagnosis",
      ).status,
      "needs_review",
    )
  }
  assert.equal(
    status(
      "Problem list: hypertension. Requested use: type 2 diabetes.",
      "diagnosis",
    ).status,
    "evidence_found",
  )
})

test("an inline field bounds the diagnosis assertion and its request context", () => {
  for (const field of ["Problem list |", "Problem list (list all):"]) {
    const text = `Requested indication: appetite management. ${field} type 2 diabetes.`
    assert.equal(status(text, "diagnosis").status, "needs_review", text)
  }
  for (const history of [
    "Problem list: no hypertension,",
    "Family history: hypertension.",
  ]) {
    const text = `${history} Requested indication: type 2 diabetes.`
    assert.equal(status(text, "diagnosis").status, "evidence_found", text)
  }
})

test("an empty reason placeholder does not substantiate a metformin intolerance", () => {
  const text = [
    "Request date: 2026-10-22. Age: 59 years.",
    "Reason for the request: type 2 diabetes.",
    "Semaglutide request: 0.5 mg subcutaneous once weekly.",
    "A1c 8.1% collected 2026-10-01.",
    "Prior therapy note: Metformin intolerance recorded. Reason: ____",
  ].join("\n")
  const c = status(text, "prior")
  assert.equal(c.status, "needs_review")
  assert.match(c.reason, /without a reason/i)

  const withReason = text.replace("Reason: ____", "Reason: persistent diarrhea")
  assert.equal(status(withReason, "prior").status, "evidence_found")
  const statedBeforeBlank = text.replace(
    "Metformin intolerance recorded. Reason: ____",
    "Metformin intolerance due to persistent diarrhea. Reason: ____",
  )
  assert.equal(status(statedBeforeBlank, "prior").status, "evidence_found")
  const priorCall = (outcome: string) =>
    status(
      text.replace("Metformin intolerance recorded. Reason: ____", outcome),
      "prior",
    )
  for (const reason of ["____.", "n/a.", "____ Date: CK labs attached."]) {
    const c = priorCall(`Metformin intolerance recorded. Reason: ${reason}`)
    assert.equal(c.status, "needs_review", reason)
  }
  const specific = priorCall(
    "Metformin intolerance due to palpitations. Reason: ____",
  )
  assert.equal(specific.status, "evidence_found")
  assert.match(specific.reason, /palpitations/i)
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
