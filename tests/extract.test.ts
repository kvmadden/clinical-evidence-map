import { test } from "node:test"
import assert from "node:assert/strict"
import { redact } from "../services/redact/index.js"
import { extract, findDrugs, parseDose } from "../services/extract/index.js"

const run = (text: string) => {
  const privacy = redact({ text, dateShiftDays: 0 })
  return extract({ text: privacy.text, dates: privacy.dates })
}
const values = (text: string, type: string) =>
  run(text)
    .entities.filter((e) => e.type === type)
    .map((e) => e.value)

test("extract keeps exact Unicode spans and public terminology codes", () => {
  const text =
    "🩺\nRequest: semaglutide 0.5 mg weekly.\nIndication for this request: Type 2 diabetes mellitus.\n"
  const result = extract({ text })
  const med = result.entities.find((e) => e.type === "requested_medication")!
  assert.equal(med.value, "semaglutide")
  assert.equal(med.normalization?.code, "1991302")
  for (const e of result.entities)
    assert.equal(
      Array.from(text).slice(e.source_span.start, e.source_span.end).join(""),
      e.source_span.text,
    )
  assert.equal(
    result.entities.find((e) => e.type === "indication")?.normalization?.code,
    "E11.9",
  )
  assert.ok(result.entities.every((e) => e.reviewed === false))
})

test("doses in compact, route, frequency-code and tablet-count forms normalize to one value", () => {
  for (const [written, canonical] of [
    ["140mg SC q2wk", "140 mg every 2 weeks"],
    ["140 mg subcut Q14D", "140 mg every 2 weeks"],
    ["40 mg subcutaneous every other week", "40 mg every 2 weeks"],
    ["40mg every 14 days", "40 mg every 2 weeks"],
    ["0.5 mg SQ q7d", "0.5 mg weekly"],
    ["1 pen (140 mg) SC every 2 weeks", "140 mg every 2 weeks"],
    ["1000mg BID", "1000 mg twice daily"],
    ["500 mg tablets, 2 tabs PO BID", "1000 mg twice daily"],
    ["2.5 mg tablets, 6 tabs PO weekly", "15 mg weekly"],
    ["80 mg tablet, 1 tab PO daily", "80 mg daily"],
    ["420 mg once monthly", "420 mg monthly"],
  ])
    assert.equal(parseDose(written)?.canonical, canonical, written)
  assert.equal(parseDose("140 mg"), null)
})

test("brand, generic, abbreviation, spelling variant and look-alike names are told apart", () => {
  const kinds = (s: string) =>
    findDrugs(s).map((d) => [d.generic, d.match.kind, d.match.confidence])
  assert.deepEqual(kinds("Repatha (evolocumab)"), [
    ["evolocumab", "brand", 1],
    ["evolocumab", "exact", 1],
  ])
  assert.deepEqual(kinds("MTX"), [["methotrexate", "abbreviation", 1]])
  assert.deepEqual(kinds("atorvastatn 80mg"), [
    ["atorvastatin", "spelling-variant", 0.9],
  ])
  assert.deepEqual(kinds("metfromin"), [["metformin", "spelling-variant", 0.9]])
  assert.deepEqual(kinds("Trexan 15 mg weekly"), [
    ["naltrexone", "look-alike", 0.5],
  ])
  assert.deepEqual(kinds("Keppra"), [])
})

test("dates in every format resolve by a day above 12 and stay two readings otherwise", () => {
  const resolved = run(
    "Request date: 01/10/2026.\nVisit date: 20/09/2026.\nA1c: 8.6 %; collected 15/09/2026.\n",
  )
  assert.equal(resolved.dateReading.status, "forced")
  assert.deepEqual(
    resolved.entities.find((e) => e.type === "request_date")?.value,
    "2026-10-01",
  )
  const open = run(
    "Request date: 01/10/2026.\nA1c: 8.6 %; collected 08/09/2026.\n",
  )
  assert.equal(open.dateReading.status, "unresolved")
  assert.deepEqual(
    open.entities.find((e) => e.type === "request_date")?.value,
    { readings: ["2026-01-10", "2026-10-01"] },
  )
  const header = run(
    "Fax received: 2 Oct 2026 09:14.\nRequest date: 01/10/2026.\nBaseline before metformin: A1c 9.4 % on 11/03/2026.\n",
  )
  assert.equal(header.dateReading.status, "header")
  assert.equal(header.dateReading.order, "dmy")
  assert.deepEqual(
    values(
      "Request date: Oct 1, 2026.\nA1C = 8.6 % on 15 Sep 2026\n",
      "measurement_date",
    ),
    ["2026-09-15"],
  )
})

test("blank form fields read as blank, never as found", () => {
  const r = run(
    "Age: ________\nDose and frequency: ________\nDiagnosis for this request: ________\nA1c: ______  Date collected: ______\nPrior therapies tried: ________\n",
  )
  assert.deepEqual(
    r.entities.map((e) => [e.type, e.value]),
    [
      ["blank_field", "age"],
      ["blank_field", "dose"],
      ["blank_field", "diagnosis"],
      ["blank_field", "lab"],
      ["blank_field", "prior therapy"],
    ],
  )
})

test("diagnoses keep certainty and negation and correct one-letter misspellings", () => {
  assert.deepEqual(
    values(
      "Indication for this request: suspected type 2 diabetes, repeat A1c pending.",
      "indication",
    ),
    [{ condition: "type 2 diabetes mellitus", certainty: "unconfirmed" }],
  )
  assert.deepEqual(
    values(
      "Reason for request: primary hyperlipidemia, no known ASCVD.",
      "indication",
    ),
    ["primary hyperlipidemia"],
  )
  assert.deepEqual(
    values(
      "Diagnosis for this request: Dx: mod-severe plaque psoriasis",
      "indication",
    ),
    ["moderate-to-severe plaque psoriasis"],
  )
  const misspelled = run(
    "Indication for this request: moderate to severe plaque psoraisis.",
  ).entities[0]
  assert.equal(misspelled.value, "moderate-to-severe plaque psoriasis")
  assert.equal(misspelled.match?.kind, "spelling-variant")
  assert.deepEqual(
    values(
      "Past medical history: ASCVD with prior myocardial infarction, hypertension.",
      "history_condition",
    ),
    ["atherosclerotic cardiovascular disease", "hypertension"],
  )
})

test("prior therapy reads dates, durations, values, intolerance and contraindication", () => {
  const objective = run(
    "MEDICATION HISTORY\nPrior therapy: metformin 1000 mg twice daily.\nTrial dates: started 2026-04-01; stopped 2026-08-01.\nBaseline before metformin: A1c 9.4 % on 2026-03-25.\nOn metformin: A1c 8.9 % on 2026-07-20; goal below 7.0 % not met.\n",
  )
  assert.deepEqual(
    objective.entities.map((e) => [e.type, e.value]),
    [
      ["prior_medication", "metformin"],
      ["prior_dose", "1000 mg twice daily"],
      ["prior_start_date", "2026-04-01"],
      ["prior_stop_date", "2026-08-01"],
      ["prior_baseline", { name: "A1c", value: 9.4, unit: "%" }],
      ["prior_baseline_date", "2026-03-25"],
      ["prior_followup", { name: "A1c", value: 8.9, unit: "%" }],
      ["prior_followup_date", "2026-07-20"],
    ],
  )
  assert.deepEqual(
    values(
      "MEDICATION HISTORY\nMTX 15 mg weekly x 6 wks, stopped 5/15/26\n",
      "prior_duration_days",
    ),
    [42],
  )
  assert.deepEqual(
    values("Stopped for persistent nausea and diarrhea.", "prior_reason"),
    ["persistent nausea and diarrhea"],
  )
  assert.deepEqual(values("Stopped due to intolerance.", "prior_reason"), [])
  assert.deepEqual(
    values(
      "Metformin not started: contraindicated due to eGFR 24 mL/min/1.73 m2.",
      "prior_outcome",
    ),
    ["contraindication"],
  )
})
