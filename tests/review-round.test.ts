import { test } from "node:test"
import assert from "node:assert/strict"
import { processText } from "../services/pipeline.js"
import { redact } from "../services/redact/index.js"
import type { Coverage, OcrOutput } from "../services/contracts.js"

// The review round of 3 November 2026 on PR #5, from GPT 6.1 Sol and Grok
// 4.7. Each finding is tested with the reviewer's exact text and at least two
// variants written here, so a fix covers the pattern and not one sentence.
// When the reader cannot tell scope, subject or date, the answer is
// needs_review, never evidence_found or missing on a guess.

const RD = "Request date: 2026-10-05\n"
function ocrOf(
  text: string,
  low: string[] = [],
  coverage?: Partial<Coverage>,
): OcrOutput {
  const words = [...text.matchAll(/\S+/g)].map((m) => ({
    text: m[0],
    confidence: low.includes(m[0]) ? 30 : 96,
    needsReview: low.includes(m[0]),
    start: m.index!,
    end: m.index! + m[0].length,
    box: { x: 0, y: 0, width: 1, height: 1 },
  }))
  const page = {
    index: 0,
    lines: text.split("\n").length,
    words: words.length,
    orientation: { pageRotation: 0, deskewDegrees: 0, handled: true },
    meanConfidence: 96,
    minConfidence: 30,
    lowConfidenceLines: [],
    unreadableLines: [],
  }
  const record: Coverage = {
    threshold: 80,
    pagesReceived: 1,
    pagesExpected: null,
    missingPages: [],
    missingCount: 0,
    duplicatePages: [],
    conflictingTotals: [],
    outOfOrder: false,
    complete: true,
    pages: [page],
    ...coverage,
  }
  return {
    text,
    words,
    threshold: 80,
    engine: "fixture",
    ...(coverage ? { coverage: record } : {}),
  }
}
const run = (text: string, criteria = "glp1-t2d", ocr?: OcrOutput) =>
  processText(text, criteria, ocr, { dateShiftDays: 0 })
const one = (
  text: string,
  id: string,
  criteria = "glp1-t2d",
  ocr?: OcrOutput,
) => run(text, criteria, ocr).criteria.find((c) => c.criterion_id === id)!
const status = (
  text: string,
  id: string,
  criteria = "glp1-t2d",
  ocr?: OcrOutput,
) => one(text, id, criteria, ocr).status

test("GPT 1: negation reaches every item of a comma list", () => {
  for (const line of [
    "Indication: No obesity, type 2 diabetes or hypertension.",
    "Indication: no hypertension, T2DM, or obesity",
    "Reason for request: denies asthma, type 2 diabetes and obesity",
  ])
    assert.equal(status(RD + line + "\n", "diagnosis"), "needs_review", line)
  assert.equal(
    status(
      RD + "Indication: obesity, type 2 diabetes and hypertension\n",
      "diagnosis",
    ),
    "evidence_found",
  )
})

test("GPT 2: a family member's lab never satisfies the patient's lab rule", () => {
  for (const [text, criteria] of [
    [
      "Request date: 2026-10-01\nFAMILY HISTORY\nMother has A1c 8% on 2026-09-01\n",
      "glp1-t2d",
    ],
    [RD + "Family history: mother, A1c 8.4% on 2026-09-01\n", "glp1-t2d"],
    [RD + "His brother's LDL-C was 190 mg/dL on 2026-09-01.\n", "pcsk9"],
  ]) {
    const lab = one(text, "lab", criteria)
    assert.equal(lab.status, "needs_review", text)
    assert.match(lab.reason, /family member/, text)
  }
  assert.equal(
    status(RD + "A1c 8.4% on 2026-09-01. Mother has type 2 diabetes.\n", "lab"),
    "evidence_found",
  )
})

test("GPT 3: an unreadable or missing follow-up date cannot prove a trial", () => {
  const trial =
    "Request date: 2026-10-01\nPrior therapy: metformin 1000 mg twice daily from 2026-01-01 to 2026-05-01\n"
  for (const [rest, named] of [
    [
      "Baseline A1c 9% on 2026-01-01\nFollow-up A1c 8% on 2026-99-99\n",
      /could not be read/,
    ],
    ["Baseline A1c 9% on 2026-01-01\nFollow-up A1c 8%\n", /no readable date/],
    [
      "Baseline A1c 9% on 2026-13-45\nFollow-up A1c 8% on 2026-04-15\n",
      /could not be read/,
    ],
  ] as const) {
    const prior = one(trial + rest, "prior")
    assert.equal(prior.status, "needs_review", rest)
    assert.ok(
      prior.blocked_by?.some((b) => named.test(b)),
      `${rest}\n${prior.reason}`,
    )
  }
})

test("GPT 4: a course or follow-up dated after the request is not prior failure", () => {
  for (const text of [
    "Request date: 2026-06-01\nPrior therapy: metformin 1000 mg twice daily from 2026-01-01 to 2026-10-01\nBaseline A1c 9% on 2026-01-01\nFollow-up A1c 8% on 2026-09-01\n",
    "Request date: 2026-06-01\nPrior therapy: metformin 1000 mg twice daily from 2026-01-01 to 2026-05-01\nBaseline A1c 9% on 2026-01-01\nFollow-up A1c 8% on 2026-07-01\n",
    "Request date: 2026-06-01\nPrior therapy: metformin 1000 mg twice daily from 2026-01-01 to 2026-10-01\nBaseline A1c 9% on 2026-01-01\nFollow-up A1c 8% on 2026-05-01\n",
  ]) {
    const prior = one(text, "prior")
    assert.equal(prior.status, "needs_review", text)
    assert.match(prior.reason, /after the request/, text)
  }
})

test("GPT 5: a diagnosis wrapped onto a capitalized line is still read", () => {
  for (const [text, criteria] of [
    ["Indication: type 2\nDIABETES\n", "glp1-t2d"],
    [
      "Diagnosis for this request: moderate to severe plaque\nPSORIASIS\n",
      "biologic-psoriasis",
    ],
    ["Indication: established\nASCVD\n", "pcsk9"],
  ]) {
    const dx = one(RD + text, "diagnosis", criteria)
    assert.equal(dx.status, "evidence_found", text)
    assert.equal(dx.evidence_spans.length, 2, text)
  }
})

test("GPT 6: a question answered no documents that no trial was made", () => {
  for (const text of [
    "Q: Has metformin been tried?\nA: No\n",
    "Q: Prior metformin?\nA: none\n",
    "Has the patient tried metformin? No\n",
  ])
    assert.equal(status(RD + text, "prior"), "missing", text)
  assert.equal(
    status(
      RD +
        "Q: Has metformin been tried?\nA: Yes, 1000 mg BID from 2026-01-02 to 2026-02-01\n",
      "prior",
    ),
    "needs_review",
  )
})

test("GPT 7 and Grok 9: a blank field answers only when nothing else blocks", () => {
  const gpt = RD + "Age: ____\nAqe sixty\n"
  const adult = one(gpt, "adult", "glp1-t2d", ocrOf(gpt, ["Aqe"]))
  assert.equal(adult.status, "needs_review")
  assert.ok(adult.blocked_by?.some((b) => b.includes("Aqe sixty")))
  const grok = RD + "Age: ________\nyeers seventeen\n"
  assert.equal(
    status(
      grok,
      "adult",
      "glp1-t2d",
      ocrOf(grok, ["yeers", "seventeen"], {
        missingPages: [2],
        missingCount: 1,
        pagesExpected: 2,
        complete: false,
      }),
    ),
    "needs_review",
  )
  const dose = RD + "Request: semaglutide\nDose and frequency: ________\n"
  assert.equal(
    status(
      dose,
      "dose",
      "glp1-t2d",
      ocrOf(dose, [], {
        missingPages: [2],
        missingCount: 1,
        pagesExpected: 2,
        complete: false,
      }),
    ),
    "needs_review",
  )
  const lab = RD + "A1c: ________\n"
  const unreadable = ocrOf(lab, [], {})
  unreadable.coverage!.pages.push({
    index: 1,
    lines: 20,
    words: 0,
    orientation: { pageRotation: 0, deskewDegrees: 0, handled: true },
    meanConfidence: null,
    minConfidence: null,
    lowConfidenceLines: [],
    unreadableLines: [],
  })
  assert.equal(status(lab, "lab", "glp1-t2d", unreadable), "needs_review")
  // With every page read, a blank field still answers for itself.
  assert.equal(
    one(RD + "Age: ________\n", "adult").reason,
    "The age field is blank.",
  )
})

test("GPT 8: page counters in the text are checked even with no coverage record", () => {
  const gpt = "Page 1 of 2\nRequest: semaglutide 0.5 mg weekly\n"
  for (const id of ["adult", "diagnosis", "lab", "prior"]) {
    const c = one(gpt, id)
    assert.equal(c.status, "needs_review", id)
    assert.ok(
      c.blocked_by?.some((b) => /Page 2/.test(b)),
      id,
    )
  }
  const ocrText = RD + "Request: semaglutide 0.5 mg weekly\nP.001/002\n"
  assert.equal(
    status(ocrText, "adult", "glp1-t2d", ocrOf(ocrText)),
    "needs_review",
  )
  const pages =
    "Page 1 of 3\n" +
    RD +
    "<<page>>\nRequest: semaglutide 0.5 mg weekly\nPage 3 of 3\n"
  assert.equal(status(pages, "adult"), "needs_review")
  assert.equal(status("Page 1 of 1\n" + RD, "adult"), "missing")
})

test("GPT 9: a lowercase name in a person field is removed", () => {
  for (const [text, gone] of [
    ["Patient: mira brookvale\n", ["mira", "brookvale"]],
    ["Prescriber: dr. rowan vale\n", ["rowan", "vale"]],
    ["Name: riley moss\n", ["riley", "moss"]],
  ] as const) {
    const out = redact({ text, dateShiftDays: 0 }).text
    for (const w of gone)
      assert.ok(!out.toLowerCase().includes(w), `${w} in ${out}`)
  }
  for (const text of ["Patient: see attached\n", "Patient: n/a\n"])
    assert.equal(redact({ text, dateShiftDays: 0 }).text, text)
})

test("Grok 1: a bound is a bound, not a point value", () => {
  const statin = (follow: string) =>
    RD +
    "Indication: coronary artery disease with a stent\nPrior therapy: atorvastatin 40 mg daily from 2026-01-06 to 2026-07-06\nLDL-C 160 mg/dL on 2026-01-05\n" +
    follow
  assert.equal(
    status(
      statin("Follow-up LDL-C <70 mg/dL on 2026-06-01\n"),
      "prior",
      "pcsk9",
    ),
    "needs_review",
  )
  assert.equal(
    status(
      statin("Follow-up LDL-C ≤ 75 mg/dL on 2026-06-01\n"),
      "prior",
      "pcsk9",
    ),
    "needs_review",
  )
  assert.equal(
    status(
      statin("Follow-up LDL-C >= 70 mg/dL on 2026-06-01\n"),
      "prior",
      "pcsk9",
    ),
    "evidence_found",
  )
  const metformin =
    RD +
    "Prior therapy: metformin 1000 mg BID from 2026-01-06 to 2026-07-06\nBaseline A1c 9% on 2026-01-05\nFollow-up A1c <7.0% on 2026-06-01\n"
  assert.equal(status(metformin, "prior"), "needs_review")
  assert.equal(
    status(RD + "LDL-C ≤ 80 mg/dL on 2026-09-01\n", "lab", "pcsk9"),
    "needs_review",
  )
  assert.equal(
    status(RD + "LDL-C >= 70 mg/dL on 2026-09-01\n", "lab", "pcsk9"),
    "evidence_found",
  )
  assert.equal(
    status(RD + "BSA ≥ 10% on 2026-09-01\n", "lab", "biologic-psoriasis"),
    "evidence_found",
  )
  assert.equal(
    status(RD + "BSA ≤ 15% on 2026-09-01\n", "lab", "biologic-psoriasis"),
    "needs_review",
  )
})

test("Grok 2: stopping for a high goal lab is lack of effect, not intolerance", () => {
  for (const [text, criteria] of [
    [
      RD +
        "Prior therapy: atorvastatin 40 mg daily from 2026-06-01 to 2026-07-01\nStopped for elevated LDL.\n",
      "pcsk9",
    ],
    [
      RD +
        "Prior therapy: metformin 1000 mg BID from 2026-06-01 to 2026-07-01\nStopped for elevated A1c.\n",
      "glp1-t2d",
    ],
    [
      RD +
        "Prior therapy: atorvastatin 80 mg daily from 2026-06-01 to 2026-07-01\nDiscontinued because LDL-C remained high.\n",
      "pcsk9",
    ],
  ])
    assert.equal(status(text, "prior", criteria), "needs_review", text)
  assert.equal(
    status(
      RD +
        "Prior therapy: atorvastatin 40 mg daily from 2026-06-01 to 2026-07-01\nStopped for elevated liver enzymes, ALT 3x ULN.\n",
      "prior",
      "pcsk9",
    ),
    "evidence_found",
  )
})

test("Grok 3: whose condition, lab or age it is, on either side and within one clause", () => {
  assert.equal(
    status(RD + "Indication: type 2 diabetes in his mother\n", "diagnosis"),
    "needs_review",
  )
  assert.equal(
    status(RD + "Indication: T2DM (mother)\n", "diagnosis"),
    "needs_review",
  )
  for (const text of [
    "54-year-old mother. No other age recorded.\n",
    "Mother is 54 years old.\n",
  ]) {
    const adult = one(RD + text, "adult")
    assert.equal(adult.status, "needs_review", text)
  }
  assert.equal(
    status(
      RD +
        "Although his mother has psoriasis, this request is for moderate-to-severe plaque psoriasis.\n",
      "diagnosis",
      "biologic-psoriasis",
    ),
    "evidence_found",
  )
})

test("Grok 4: a box whose mark could not be read never confirms anything", () => {
  assert.equal(
    status(
      RD + "Diagnosis for this request:\n[ 1 Type 2 diabetes mellitus\n",
      "diagnosis",
    ),
    "needs_review",
  )
  assert.equal(
    status(
      RD +
        "Diagnosis for this request:\n[ | Moderate-to-severe plaque psoriasis\n",
      "diagnosis",
      "biologic-psoriasis",
    ),
    "needs_review",
  )
  assert.equal(
    status(RD + "Order:\n[ l Ozempic 0.5 mg weekly\n", "dose"),
    "needs_review",
  )
})

test("Grok 5: a line that starts with the drug is not the request when it tells history", () => {
  for (const text of [
    "Semaglutide 0.5 mg weekly failed after 3 months.\nPlease approve coverage.\n",
    "Ozempic 0.5 mg weekly previously, stopped for nausea.\n",
    "Semaglutide 0.5 mg weekly was tried in 2025.\n",
  ])
    assert.equal(status(RD + text, "dose"), "needs_review", text)
})

test("Grok 6: the OCR gate covers the drug name and the lab name", () => {
  const humira = RD + "Request: Humira 40 mg every other week\n"
  assert.equal(
    status(humira, "dose", "biologic-psoriasis", ocrOf(humira, ["Humira"])),
    "needs_review",
  )
  const ozempic = RD + "Request: Ozempic 0.5 mg weekly\n"
  assert.equal(
    status(ozempic, "dose", "glp1-t2d", ocrOf(ozempic, ["Ozempic"])),
    "needs_review",
  )
  const ldl = RD + "LDL-C 132 mg/dL on 2026-09-01\n"
  assert.equal(
    status(ldl, "lab", "pcsk9", ocrOf(ldl, ["LDL-C"])),
    "needs_review",
  )
})

test("Grok 7: a capitalized lab label on its own line owns the value under it", () => {
  for (const [text, criteria] of [
    ["LDL-C\n142 mg/dL on 2026-09-01\n", "pcsk9"],
    ["HBA1C\n8.2 % on 2026-09-01\n", "glp1-t2d"],
    ["BSA\n14% on 2026-09-01\n", "biologic-psoriasis"],
  ])
    assert.equal(status(RD + text, "lab", criteria), "evidence_found", text)
  // A heading that names the lab and owns no readable value blocks "missing".
  assert.equal(
    status(RD + "A1C RESULTS\nsee scanned sheet\n", "lab"),
    "needs_review",
  )
})

test("Grok 8: a request field that discusses the condition is never not documented", () => {
  for (const text of [
    "Indication: type 2 diabetes, if confirmed\n",
    "Indication: family history of type 2 diabetes\n",
    "Reason for request: to prevent type 2 diabetes\n",
    "Diagnosis: [ ] Type 2 diabetes mellitus\n",
  ])
    assert.equal(status(RD + text, "diagnosis"), "needs_review", text)
  // Another indication chosen and the condition left unchecked, or ruled out,
  // is an explicit answer: the request names something else.
  for (const text of [
    "Indication: [ ] type 2 diabetes [x] obesity\n",
    "Reason for request: obesity, no type 2 diabetes\n",
  ])
    assert.equal(status(RD + text, "diagnosis"), "missing", text)
})

test("Grok 10: a dose that is named but unreadable blocks not documented", () => {
  for (const text of [
    "Semaglutide dose illegible on the request line.\n",
    "Request: semaglutide\nDose: illegible\n",
    "Request: Ozempic, sig unreadable\n",
  ])
    assert.equal(status(RD + text, "dose"), "needs_review", text)
})

test("Grok 11: clinical abbreviations are never removed as names", () => {
  for (const [text, keep, criteria] of [
    [
      "Re: CAD\nIndication: CAD with prior MI\nAge: 62\n",
      ["CAD", "MI"],
      "pcsk9",
    ],
    ["CAD, MI\nIndication: CAD with prior MI\n", ["CAD", "MI"], "pcsk9"],
    ["Re: T2DM\nIndication: T2DM\n", ["T2DM"], "glp1-t2d"],
  ] as const) {
    const out = redact({ text: RD + text, dateShiftDays: 0 }).text
    for (const w of keep)
      assert.ok(new RegExp(`\\b${w}\\b`).test(out), `${w} in ${out}`)
    assert.equal(
      status(RD + text, "diagnosis", criteria),
      "evidence_found",
      text,
    )
  }
})

test("Grok 13: a strength on a line for another drug does not block dose or prior", () => {
  for (const [line, low] of [
    ["Lisinopril 10 mg daily", "daily"],
    ["Metoprolol 25 mg BID", "BID"],
  ]) {
    const text = RD + line + "\n"
    const ocr = ocrOf(text, [low])
    assert.equal(status(text, "prior", "glp1-t2d", ocr), "missing", line)
    assert.equal(status(text, "dose", "glp1-t2d", ocr), "missing", line)
  }
  // A garbled step drug name still blocks.
  const garbled = RD + "Metfornim 1000 mg BID\n"
  assert.equal(
    status(garbled, "prior", "glp1-t2d", ocrOf(garbled, ["Metfornim"])),
    "needs_review",
  )
})
