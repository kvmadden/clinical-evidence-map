import { test } from "node:test"
import assert from "node:assert/strict"
import { processText } from "../services/pipeline.js"
import { parseDose } from "../services/extract/index.js"

// The labeling rubric, read as a careful pharmacist reviewer reads it, plus
// the stage D rules: drug-linked episodes, structured regimens, request and
// received dates, labs, and the high-intensity statin ruling of 2 Nov 2026.

const run = (text: string, criteria = "glp1-t2d") =>
  processText(text, criteria, undefined, { dateShiftDays: 0 })
const status = (text: string, id: string, criteria = "glp1-t2d") =>
  run(text, criteria).criteria.find((c) => c.criterion_id === id)!
const values = (text: string, type: string) =>
  run(text)
    .entities.filter((e) => e.type === type)
    .map((e) => e.value)

test("request date labels and written formats", () => {
  const labels = [
    "Request date",
    "Date of request",
    "Letter date",
    "Date submitted",
    "Submitted",
    "Dated",
    "Written",
    "Prepared",
    "Completed",
    "Form date",
  ]
  const formats = [
    "2026-10-13",
    "10/13/2026",
    "13-Oct-2026",
    "October 13 2026",
    "13 October 2026",
    "Oct 13, 2026",
  ]
  for (const label of labels)
    for (const written of formats)
      assert.deepEqual(
        values(`${label}: ${written}\n`, "request_date"),
        ["2026-10-13"],
        `${label}: ${written}`,
      )
})

test("two different request dates send the 180-day window to review", () => {
  const text =
    "Request date: 2026-10-05\nDate of request: 2026-10-06\nA1c 8.4% on 2026-09-20\n"
  const lab = status(text, "lab")
  assert.equal(lab.status, "needs_review")
  assert.match(lab.reason, /Two different request dates/)
})

test("sig codes and written schedules read as one canonical regimen", () => {
  for (const [written, canonical] of [
    ["0.5 mg QW", "0.5 mg weekly"],
    ["0.5 mg q7d", "0.5 mg weekly"],
    ["0.5 mg every 7 days", "0.5 mg weekly"],
    ["0.5 mg weekly", "0.5 mg weekly"],
    ["40 mg Q2W", "40 mg every 2 weeks"],
    ["40 mg q14d", "40 mg every 2 weeks"],
    ["40 mg every other week", "40 mg every 2 weeks"],
    ["140 mg every 2 wks", "140 mg every 2 weeks"],
    ["40 mg every four weeks", "40 mg every 4 weeks"],
    ["420 mg monthly", "420 mg monthly"],
    ["1000 mg BID", "1000 mg twice daily"],
    ["40 mg nightly", "40 mg daily"],
    ["10 mg daily", "10 mg daily"],
    ["140 mg SQ g2wk", "140 mg every 2 weeks"],
  ])
    assert.equal(parseDose(written)?.canonical, canonical, written)
})

test("a titration counts its final step and agrees with a list at an earlier step", () => {
  const text = [
    "Request date: 2026-10-05",
    "Request: Ozempic 0.25 mg weekly x 4 weeks, then 0.5 mg weekly",
    "Current medications: Ozempic 0.25 mg weekly",
    "",
  ].join("\n")
  assert.deepEqual(values(text, "requested_dose"), ["0.5 mg weekly"])
  assert.equal(status(text, "dose").status, "evidence_found")
})

test("a stated correction supersedes, while an unexplained disagreement goes to review", () => {
  const corrected =
    "Request date: 2026-10-05\nRequest: semaglutide 1 mg weekly\nRequest: semaglutide 0.5 mg weekly; correction replaces prior order\n"
  assert.equal(status(corrected, "dose").status, "evidence_found")
  const conflict =
    "Request date: 2026-10-05\nRequest: semaglutide 0.5 mg weekly\nLetter: please supply semaglutide 1 mg weekly\n"
  const dose = status(conflict, "dose")
  assert.equal(dose.status, "needs_review")
  assert.match(dose.reason, /different doses/)
})

test("labs: OCR name variants, '=' and 'was' forms, ranges and targets", () => {
  const read = (line: string) =>
    values(`Request date: 2026-10-05\n${line}\n`, "measurement").map(
      (v) => (v as { value: number }).value,
    )
  assert.deepEqual(read("HbAlc 8.2% on 2026-09-01"), [8.2])
  assert.deepEqual(read("Alc: 8.2 % (collected 2026-09-01)"), [8.2])
  assert.deepEqual(read("A1C=7.9%, eGFR 82 on 2026-09-01"), [7.9])
  assert.deepEqual(read("Most recent A1c was 7.4% on 2026-09-01"), [7.4])
  assert.deepEqual(read("A1c 8.6 % (ref 4.0-5.6) on 2026-09-15"), [8.6])
  assert.deepEqual(read("A1c target 7.0% on 2026-09-20"), [])
})

test("LDL-C in mmol/L converts, and a lab dated after the request goes to review", () => {
  const converted = status(
    "Request date: 2026-10-05\nLDL-C 3.4 mmol/L on 2026-09-15\n",
    "lab",
    "pcsk9",
  )
  assert.equal(converted.status, "evidence_found")
  assert.match(converted.reason, /131 mg\/dL \(written as 3\.4 mmol\/L\)/)
  const after = status(
    "Request date: 2026-10-05\nA1c 8.1% on 2026-10-20\n",
    "lab",
  )
  assert.equal(after.status, "needs_review")
  assert.match(after.reason, /after the request date/)
})

test("PCSK9 prior: atorvastatin 40 or 80 mg or rosuvastatin 20 or 40 mg daily (Kevin, 2 Nov)", () => {
  const trial = (drug: string) =>
    [
      "Request date: 2026-10-05",
      "MEDICATION HISTORY",
      `Prior therapy: ${drug} daily from 2026-01-06 to 2026-07-06`,
      "Baseline LDL-C 160 mg/dL on 2026-01-05",
      "LDL-C 118 mg/dL on 2026-06-01",
      "",
    ].join("\n")
  for (const drug of [
    "atorvastatin 40 mg",
    "atorvastatin 80 mg",
    "rosuvastatin 20 mg",
    "rosuvastatin 40 mg",
  ])
    assert.equal(
      status(trial(drug), "prior", "pcsk9").status,
      "evidence_found",
      drug,
    )
  for (const drug of [
    "atorvastatin 20 mg",
    "rosuvastatin 10 mg",
    "simvastatin 40 mg",
  ])
    assert.equal(
      status(trial(drug), "prior", "pcsk9").status,
      "needs_review",
      drug,
    )
  // An intolerance to any statin, with its reason, counts.
  const intolerant =
    "Request date: 2026-10-05\nPrior therapy: simvastatin 40 mg daily, stopped for myalgias with CK 900 U/L\n"
  assert.equal(status(intolerant, "prior", "pcsk9").status, "evidence_found")
})

test("prior therapy needs the start: no start date, no 90-day check", () => {
  const text = [
    "Request date: 2026-10-05",
    "MEDICATION HISTORY",
    "Prior therapy: metformin 1000 mg BID for 16 wks",
    "Baseline before metformin: A1c 9.0% on 2026-01-05",
    "On metformin: A1c 8.2% on 2026-06-01",
    "",
  ].join("\n")
  const prior = status(text, "prior")
  assert.equal(prior.status, "needs_review")
  assert.match(prior.reason, /start date is not stated/)
  // A stop date and a stated duration give the start.
  const derived = text.replace("for 16 wks", "x 6 months, stopped 2026-07-06")
  assert.equal(status(derived, "prior").status, "evidence_found")
})

test("assertion context: family, negation both ways, uncertainty and checkboxes", () => {
  const dx = (line: string) =>
    status(`Request date: 2026-10-05\n${line}\n`, "diagnosis").status
  assert.equal(
    dx("Indication: family history of type 2 diabetes; patient has obesity"),
    "missing",
  )
  assert.equal(dx("Indication: type 2 diabetes ruled out"), "needs_review")
  assert.equal(
    dx("Indication: no complications of type 2 diabetes"),
    "evidence_found",
  )
  assert.equal(dx("Indication: ? type 2 diabetes"), "needs_review")
  assert.equal(dx("Diagnosis? Type 2 diabetes mellitus"), "evidence_found")
  assert.equal(dx("Indication: [ ] type 2 diabetes [x] obesity"), "missing")
  assert.equal(dx("Past medical history: type 2 diabetes"), "needs_review")
  assert.equal(
    dx("I am requesting semaglutide for type 2 diabetes."),
    "evidence_found",
  )
})

test("a reason that only names the outcome is not a reason", () => {
  const text = [
    "Request date: 2026-10-05",
    "Previous statin? Atorvastatin 40 mg daily for five months.",
    "Why stopped? Statin intolerance.",
    "Symptoms or medical reason? ____",
    "",
  ].join("\n")
  const prior = status(text, "prior", "pcsk9")
  assert.equal(prior.status, "needs_review")
  assert.match(prior.reason, /without a reason/)
})
