import { test } from "node:test"
import assert from "node:assert/strict"
import { processText } from "../services/pipeline.js"

const run = (text: string, rules = "glp1-t2d") =>
  processText(text, rules, undefined, { dateShiftDays: 0 })
const criterion = (text: string, id: string, rules = "glp1-t2d") =>
  run(text, rules).criteria.find((c) => c.criterion_id === id)!

test("inline request dates retain their own label and citation", () => {
  for (const header of [
    "Request date: 2026-10-20.",
    "Request date 2026-10-20. Age: 47 years.",
    "Age: 47 years. Request date 2026-10-20.",
    "Fictional request | Request date 2026-10-20 | P.001/001",
    "Lab date: 2026-01-01. Request date: 2026-10-20.",
    "Age: 47 years. Date of request: 2026-10-20.",
    "Submissian |, 2026-10-20",
  ]) {
    const out = run(header + "\nA1c 7.6% on 2026-10-09.\n")
    const lab = out.criteria.find((c) => c.criterion_id === "lab")!
    assert.equal(lab.status, "evidence_found", header)
    assert.match(lab.reason, /11 days/, header)
    assert.ok(out.entities.some((e) => e.type === "request_date"))
  }
})

test("inline conflicting request dates remain reviewable", () => {
  const text =
    "Age: 47 years. Request date 2026-10-20. Request date 2026-10-22.\nA1c 7.6% on 2026-10-09.\n"
  assert.equal(criterion(text, "lab").status, "needs_review")
  assert.ok(
    run(text).entities.some((e) => e.type === "conflicting_request_date"),
  )
  for (const dates of [
    "Request date: 2026-10-20. Date of request: 2026-10-22.",
    "Date of request: 2026-10-22. Request date: 2026-10-20.",
  ]) {
    const mixed = "Age: 47 years. " + dates + "\nA1c 7.6% on 2026-10-09.\n"
    assert.equal(criterion(mixed, "lab").status, "needs_review")
    assert.ok(
      run(mixed).entities.some((e) => e.type === "conflicting_request_date"),
    )
  }
})

test("negated continuation and early endpoints never extend a course to the request", () => {
  for (const continuation of [
    "Not still taking.",
    "Not taking continuously.",
    "Possibly taking continuously.",
    "Still taking?",
    "Still taking as of 2026-05-20.",
    "Taking continuously as of 2026-05-20.",
    "Course continued as of 2026-05-20.",
    "Course continued until 2026-05-20.",
    "Taking continuously until 2026-05-20.",
    "Still taking glipizide.",
    "Still taking. Not still taking.",
    "Taking continuously. Not taking continuously.",
    "Taking continuously.\nNot taking continuously.",
    "Course continued.\nNot still taking.",
    "Course continued, but not through the request date.",
  ]) {
    const out = run(
      [
        "Request date: 2026-10-20.",
        "MEDICATION HISTORY",
        "A1c 8.1% on 2026-05-05. Metformin 1000 mg twice daily started 2026-05-06.",
        continuation,
        "A1c 7.6% on 2026-09-20.",
      ].join("\n"),
    )
    assert.notEqual(
      out.criteria.find((c) => c.criterion_id === "prior")!.status,
      "evidence_found",
      continuation,
    )
    assert.ok(
      !out.entities.find(
        (e) => e.type === "prior_medication" && e.value === "metformin",
      )?.attrs?.ongoing,
      continuation,
    )
  }
})

test("historical request dates cannot date the current request", () => {
  for (const prefix of ["Previous", "Prior", "Cancelled"]) {
    const text = `${prefix} request date: 2026-10-20.\nA1c 7.6% on 2026-10-09.\n`
    assert.equal(criterion(text, "lab").status, "needs_review", prefix)
  }
})

test("unsuitable therapy needs an affirmed drug-specific reason", () => {
  assert.equal(
    criterion(
      "Methotrexate unsuitable due to documented liver disease.",
      "prior",
      "biologic-psoriasis",
    ).status,
    "evidence_found",
  )
  for (const text of [
    "Methotrexate unsuitable.",
    "Methotrexate unsuitable due to ____.",
    "Methotrexate possibly unsuitable due to liver disease.",
    "Methotrexate not unsuitable due to liver disease.",
    "Mother's methotrexate unsuitable due to liver disease.",
  ])
    assert.notEqual(
      criterion(text, "prior", "biologic-psoriasis").status,
      "evidence_found",
      text,
    )
})

test("a sole history course can use its immediately preceding dated baseline", () => {
  const text = [
    "Request date: 2026-10-20.",
    "LAB AND PRIOR THERAPY",
    "LDL-C 156 mg/dL collected 2026-05-01.",
    "Atorvastatin 80 mg daily started 2026-05-02. Taking continuously.",
    "LDL-C 94 mg/dL collected 2026-09-07.",
  ].join("\n")
  assert.equal(criterion(text, "prior", "pcsk9").status, "evidence_found")
  for (const changed of [
    text.replace("2026-05-01", "2026-05-03"),
    text.replace("Atorvastatin", "<<page>>\nAtorvastatin"),
    text.replace("Atorvastatin", "OTHER HISTORY\nAtorvastatin"),
    text.replace("LDL-C 156", "HDL-C 156"),
    text.replace("LDL-C 156", "On rosuvastatin: LDL-C 156"),
  ])
    assert.notEqual(
      criterion(changed, "prior", "pcsk9").status,
      "evidence_found",
      changed,
    )
})

test("a blank inline request date cannot borrow a lab date", () => {
  const text =
    "Age: 47 years. Request date: ____. Lab date: 2026-10-20.\nA1c 7.6% on 2026-10-09.\n"
  assert.equal(criterion(text, "lab").status, "needs_review")
  assert.equal(
    run(text).entities.filter((e) => e.type === "request_date").length,
    0,
  )
  for (const label of ["Request date", "Date of request"]) {
    const blank = `${label}: ____. Lab date: 2026-10-20.\nA1c 7.6% on 2026-10-09.\n`
    assert.equal(criterion(blank, "lab").status, "needs_review")
    assert.equal(
      run(blank).entities.filter((e) => e.type === "request_date").length,
      0,
    )
  }
})

test("explicit continuous prior courses carry their start date through the request", () => {
  for (const continuation of [
    "Taking continuously.",
    "Course continued.",
    "Still taking.",
  ]) {
    const text = [
      "Request date: 2026-10-20.",
      "MEDICATION HISTORY",
      "A1c 8.1% on 2026-05-05. Metformin 1000 mg twice daily started 2026-05-06.",
      continuation,
      "A1c 7.6% on 2026-09-20.",
    ].join("\n")
    assert.equal(
      criterion(text, "prior").status,
      "evidence_found",
      continuation,
    )
    assert.notEqual(
      criterion(text.replace(continuation, ""), "prior").status,
      "evidence_found",
    )
    assert.notEqual(
      criterion(text.replace(continuation, "Stopped 2026-05-20."), "prior")
        .status,
      "evidence_found",
    )
  }
})
