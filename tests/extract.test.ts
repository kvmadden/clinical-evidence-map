import { test } from "node:test"
import assert from "node:assert/strict"
import { redact } from "../services/redact/index.js"
import { extract, findDrugs, parseDose } from "../services/extract/index.js"
import { processText } from "../services/pipeline.js"

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

test("a preceding specimen collection header dates only its adjacent lab result", () => {
  const base = (header: string, result = "LDL-C: 128 mg/dL") =>
    `Request date: 2026-10-01.\nAge: 50 years.\nIndication: Established ASCVD.\nRequest: evolocumab 140 mg every 2 weeks.\nLAB REPORT\n${header}\n${result}\n`
  const measurementDate = (text: string) =>
    run(text).entities.find((e) => e.type === "measurement_date")
  const labStatus = (text: string) =>
    processText(text, "pcsk9", undefined, { dateShiftDays: 0 }).criteria.find(
      (criterion) => criterion.criterion_id === "lab",
    )?.status
  const followingHeader = (body: string) =>
    `Request date: 2026-10-01.\nAge: 50 years.\nIndication: Established ASCVD.\nRequest: evolocumab 140 mg every 2 weeks.\nLAB REPORT\n${body}`

  for (const header of [
    "Date collected: 2026-09-15",
    "Collection date: 2026-09-15",
    "Specimen collected: 2026-09-15",
    "Sample collected: 2026-09-15",
    "Date drawn: 2026-09-15",
  ]) {
    const date = measurementDate(base(header))
    assert.equal(date?.value, "2026-09-15", header)
    assert.equal(
      date?.source_span.text,
      header.replace("2026-09-15", "[date-b]"),
      header,
    )
  }

  const indentedPreceding = measurementDate(
    base("  Date collected: 2026-09-15"),
  )
  assert.equal(indentedPreceding?.value, "2026-09-15")
  assert.equal(
    indentedPreceding?.source_span.text,
    "  Date collected: [date-b]",
  )
  const indentedFollowing = measurementDate(
    followingHeader("LDL-C: 128 mg/dL\n  Date collected: 2026-09-15\n"),
  )
  assert.equal(indentedFollowing?.value, "2026-09-15")
  assert.equal(
    indentedFollowing?.source_span.text,
    "  Date collected: [date-b]",
  )
  assert.equal(
    labStatus(
      base(
        "Date collected: 2026-09-15",
        "LDL-C: 128 mg/dL\n  Date collected: 2026-08-15",
      ),
    ),
    "needs_review",
    "an indented conflicting following header must remain visible",
  )
  for (const prefix of ["", "Date "]) {
    for (const verb of [
      "collected",
      "drawn",
      "obtained",
      "resulted",
      "measured",
    ]) {
      for (const suffix of ["", " on", " date"]) {
        const label = `${prefix}${verb}${suffix}`
        const date = measurementDate(
          followingHeader(`LDL-C: 128 mg/dL\n${label}: 2026-09-15\n`),
        )
        assert.equal(date?.value, "2026-09-15", label)
        assert.equal(date?.source_span.text, `${label}: [date-b]`, label)
      }
    }
  }

  const explicitResultDate = measurementDate(
    base("Date collected: 2026-09-15", "LDL-C: 128 mg/dL on 2026-09-16"),
  )
  assert.equal(explicitResultDate?.value, "2026-09-16")
  assert.match(
    explicitResultDate?.source_span.text ?? "",
    /LDL-C: 128 mg\/dL on \[date-/,
  )
  const explicitResultWithConflictingHeaders = measurementDate(
    base(
      "Date collected: 2026-09-15",
      "LDL-C: 128 mg/dL on 2026-09-16\nDate collected: 2026-08-15",
    ),
  )
  assert.equal(explicitResultWithConflictingHeaders?.value, "2026-09-16")

  assert.equal(
    labStatus(
      base(
        "Date collected: 2026-09-15",
        "LDL-C: 128 mg/dL\nDate collected: 2026-08-15",
      ),
    ),
    "needs_review",
    "different preceding and following collection dates must conflict",
  )
  assert.equal(
    labStatus(
      base(
        "Date collected: 2026-09-15",
        "LDL-C: 128 mg/dL\nDate collected: 2026-08-15 (fasting)",
      ),
    ),
    "needs_review",
    "an annotated following collection date must still conflict with a different preceding date",
  )
  assert.equal(
    labStatus(
      followingHeader(
        "LDL-C: 128 mg/dL\nDate collected: 2026-09-15; repeat collected: 2026-08-15\n",
      ),
    ),
    "needs_review",
    "a following collection line with multiple dates must not supply its first date",
  )
  assert.equal(
    labStatus(
      base(
        "Date collected: 2026-09-15",
        "LDL-C: 128 mg/dL\nDate collected: 2026-09-15; repeat collected: 2026-08-15",
      ),
    ),
    "needs_review",
    "an unusable following collection header blocks fallback to a valid preceding date",
  )
  const annotatedFollowing = measurementDate(
    followingHeader("LDL-C: 128 mg/dL\nDate collected: 2026-09-15 (fasting)\n"),
  )
  assert.equal(annotatedFollowing?.value, "2026-09-15")
  assert.equal(
    annotatedFollowing?.source_span.text,
    "Date collected: [date-b] (fasting)",
  )
  assert.equal(
    labStatus(
      followingHeader(
        "LDL-C: 128 mg/dL\nDate collected: 2026-09-15 (fasting)\n",
      ),
    ),
    "evidence_found",
    "a single annotated following collection date remains valid",
  )
  assert.equal(
    labStatus(
      base("Date collected: 2026-09-15", "LDL-C: 128 mg/dL. A1c: 8.5%"),
    ),
    "needs_review",
    "a preceding header must not date one result among multiple analytes",
  )
  assert.equal(
    labStatus(
      base("Date collected: 2026-09-15", "LDL-C: 128 mg/dL, repeat 130 mg/dL"),
    ),
    "needs_review",
    "a preceding header must not date a line with multiple results",
  )
  const sameDateHeaders = measurementDate(
    base(
      "Date collected: 2026-09-15",
      "LDL-C: 128 mg/dL\nDate collected: 2026-09-15",
    ),
  )
  assert.equal(sameDateHeaders?.value, "2026-09-15")
  assert.equal(sameDateHeaders?.source_span.text, "Date collected: [date-c]")
  assert.equal(
    labStatus(
      base(
        "Date collected: 2026-09-15",
        "LDL-C: 128 mg/dL\nDate collected: 2026-09-15",
      ),
    ),
    "evidence_found",
    "matching collection headers retain the normal association",
  )
  for (const body of [
    "LDL-C: 128 mg/dL\n<<page>>\nDate collected: 2026-09-15\n",
    "LDL-C: 128 mg/dL\nHISTORY\nDate collected: 2026-09-15\n",
    "LDL-C: 128 mg/dL\nDate collected: 2026-09-15 (mother)\n",
  ])
    assert.equal(labStatus(followingHeader(body)), "needs_review", body)

  for (const header of [
    "Report received: 2026-09-15",
    "Request date: 2026-09-15",
    "Printed: 2026-09-15",
    "Collection date: 2026-09-15; report date: 2026-09-16",
    "Specimen collected for mother: 2026-09-15",
  ])
    assert.equal(measurementDate(base(header)), undefined, header)
  for (const header of [
    "Report received: 2026-09-15",
    "Collection date: 2026-09-15; report date: 2026-09-16",
    "Date collected: 39/39/2026",
  ]) {
    const result = processText(base(header), "pcsk9", undefined, {
      dateShiftDays: 0,
    })
    assert.equal(
      result.criteria.find((criterion) => criterion.criterion_id === "lab")
        ?.status,
      "needs_review",
      header,
    )
  }
  assert.equal(
    measurementDate(
      base("Date collected: 2026-09-15", "LDL-C for mother: 128 mg/dL"),
    ),
    undefined,
    "a patient's collection header must not date a family member's result",
  )

  assert.equal(
    measurementDate(
      `Request date: 2026-10-01.\nAge: 50 years.\nIndication: Established ASCVD.\nRequest: evolocumab 140 mg every 2 weeks.\nLAB REPORT\nDate collected: 2026-09-15\n<<page>>\nLDL-C: 128 mg/dL\n`,
    ),
    undefined,
    "a collection date must not cross a page break",
  )
  assert.equal(
    measurementDate(
      `Request date: 2026-10-01.\nAge: 50 years.\nIndication: Established ASCVD.\nRequest: evolocumab 140 mg every 2 weeks.\nLAB REPORT\nDate collected: 2026-09-15\nHISTORY\nLDL-C: 128 mg/dL\n`,
    ),
    undefined,
    "a collection date must not cross a section boundary",
  )

  const headerLabels = [
    "Date collected",
    "Collection date",
    "Specimen collected",
    "Sample collected",
    "Date drawn",
  ]
  for (const preceding of headerLabels) {
    for (const following of headerLabels) {
      for (const state of [
        "same",
        "different",
        "multiple",
        "ambiguousPreceding",
      ] as const) {
        const followingDate =
          state === "different" ? "2026-08-15" : "2026-09-15"
        const body =
          `${preceding}: 2026-09-15` +
          (state === "ambiguousPreceding"
            ? "; repeat collected: 2026-08-15"
            : "") +
          `\nLDL-C: 128 mg/dL\n` +
          `${following}: ${followingDate}` +
          (state === "multiple" ? "; repeat collected: 2026-08-15" : "")
        assert.equal(
          labStatus(base("", body)),
          state === "same" ? "evidence_found" : "needs_review",
          `${preceding} before and ${following} after with ${state} dates`,
        )
      }
    }
  }
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
