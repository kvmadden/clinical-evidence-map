import { test } from "node:test"
import assert from "node:assert/strict"
import { processText } from "../services/pipeline.js"
import { extract } from "../services/extract/index.js"
import { linkEvidence } from "../services/link-evidence/index.js"
import { redact } from "../services/redact/index.js"
import type { Coverage, OcrOutput } from "../services/contracts.js"

// Rule one, from Kevin: "not documented" is a claim about the whole packet.
// It holds only when every page arrived and was readable, every line was
// understood or ruled irrelevant, and nothing mentions the item, or when the
// field is shown blank. Otherwise the answer is needs_review and names what
// blocked the read.

const base = [
  "Request date: 2026-10-01.",
  "Patient: Mira Brookvale (fictional).",
  "Age: 33 years.",
  "Request: semaglutide 0.5 mg weekly.",
  "Indication for this request: Type 2 diabetes mellitus.",
  "MEDICATION HISTORY",
  "Prior therapy: metformin 1000 mg twice daily.",
  "Trial dates: started 2026-04-01; stopped 2026-08-01.",
  "Baseline before metformin: A1c 9.4 % on 2026-03-25.",
  "On metformin: A1c 8.9 % on 2026-07-20; goal below 7.0 % not met.",
  "",
].join("\n")

// An OCR record for a typed page: every word read well unless listed. The
// coverage record has the shape services/ocr/coverage.ts builds.
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
const missingPage: Partial<Coverage> = {
  pagesExpected: 2,
  missingPages: [2],
  missingCount: 1,
  complete: false,
}
const run = (text: string, ocr?: OcrOutput, criteria = "glp1-t2d") =>
  processText(text, criteria, ocr, { dateShiftDays: 0 })
const one = (out: ReturnType<typeof run>, id: string) =>
  out.criteria.find((c) => c.criterion_id === id)!

test("an item nothing mentions is not documented", () => {
  const out = run(base.replace("Age: 33 years.\n", ""))
  assert.equal(one(out, "adult").status, "missing")
  assert.equal(one(out, "lab").status, "evidence_found")
})

test("a line that mentions the item but cannot be read blocks not documented", () => {
  const out = run(base.replace("Age: 33 years.", "Age: see intake sheet"))
  const adult = one(out, "adult")
  assert.equal(adult.status, "needs_review")
  assert.match(adult.reason, /cannot be called not documented/)
  assert.ok(adult.blocked_by?.some((b) => b.includes("Age: see intake sheet")))
})

test("a page that did not arrive blocks every not-documented answer", () => {
  const text = base.replace("Age: 33 years.\n", "")
  const out = run(text, ocrOf(text, [], missingPage))
  const adult = one(out, "adult")
  assert.equal(adult.status, "needs_review")
  assert.match(adult.reason, /Page 2 of the packet did not arrive/)
  // Found answers stand: the evidence was read.
  assert.equal(one(out, "diagnosis").status, "evidence_found")
  // A missing page whose number cannot be told, and totals that disagree.
  const unnamed = run(
    text,
    ocrOf(text, [], { pagesExpected: 3, missingCount: 2, missingPages: [] }),
  )
  assert.match(one(unnamed, "adult").reason, /Only 1 of 3 pages arrived/)
  const totals = run(text, ocrOf(text, [], { conflictingTotals: [2, 3] }))
  assert.match(one(totals, "adult").reason, /page counters disagree/)
})

test("a page that could not be read blocks every not-documented answer", () => {
  const text = base.replace("Age: 33 years.\n", "")
  const record = ocrOf(text, [], {})
  record.coverage!.pages.push({
    index: 1,
    lines: 30,
    words: 0,
    orientation: { pageRotation: 0, deskewDegrees: 0, handled: false },
    meanConfidence: null,
    minConfidence: null,
    lowConfidenceLines: [],
    unreadableLines: [],
  })
  const out = run(text, record)
  assert.equal(one(out, "adult").status, "needs_review")
  assert.match(one(out, "adult").reason, /Page 2 could not be read/)
})

test("a blank field answers for that field only, never for a missing page", () => {
  // Changed in the 3 Nov review round: the age could be on the missing page.
  const text = base.replace("Age: 33 years.", "Age: ________")
  const out = run(text, ocrOf(text, [], missingPage))
  const adult = one(out, "adult")
  assert.equal(adult.status, "needs_review")
  assert.match(
    adult.reason,
    /^The age field is blank\. This cannot be called not documented/,
  )
  assert.ok(adult.blocked_by?.some((b) => /Page 2/.test(b)))
  // With every page received and read, the blank field answers for itself.
  const read = one(run(text, ocrOf(text, [], {})), "adult")
  assert.equal(read.status, "missing")
  assert.equal(read.reason, "The age field is blank.")
})

test("a mostly unreadable line blocks every criterion, a mostly read one is ruled out", () => {
  const garbled = base.replace("Age: 33 years.\n", "") + "Xqv zrt pplw\n"
  const blocked = run(garbled, ocrOf(garbled, ["Xqv", "zrt", "pplw"]))
  assert.equal(one(blocked, "adult").status, "needs_review")
  assert.match(one(blocked, "adult").reason, /Low OCR confidence/)
  const readable =
    base.replace("Age: 33 years.\n", "") + "Visit date: 2026-09-20.\n"
  const ruled = run(readable, ocrOf(readable, ["Visit"]))
  assert.equal(one(ruled, "adult").status, "missing")
})

test("a misread line blocks only the criteria whose words it resembles", () => {
  // "Aqe" is a misread "Age": it blocks the age answer, not the diagnosis.
  const text =
    base
      .replace("Age: 33 years.\n", "")
      .replace("Indication for this request: Type 2 diabetes mellitus.\n", "") +
    "Aqe yeers sixty\n"
  const out = run(text, ocrOf(text, ["Aqe", "yeers", "sixty"]))
  assert.equal(one(out, "adult").status, "needs_review")
  assert.equal(one(out, "diagnosis").status, "missing")
})

test("a clinical word the privacy step removed routes its criteria to review", () => {
  // The prior course names its drug once, and that word was removed.
  const text = base
    .replace(/Baseline[^\n]*\n|On metformin[^\n]*\n/g, "")
    .replace(
      "Prior therapy: metformin 1000 mg twice daily.",
      "Prior therapy: [name] 1000 mg twice daily.",
    )
  const privacy = redact({ text, dateShiftDays: 0 })
  const lines = privacy.text.split("\n")
  const line = lines.findIndex((l) => l.startsWith("Prior therapy"))
  const extracted = extract({
    text: privacy.text,
    dates: privacy.dates,
    removedClinical: [{ line, category: "drug" }],
  })
  const prior = linkEvidence({
    text: privacy.text,
    entities: extracted.entities,
    criteriaId: "glp1-t2d",
    coverage: extracted.coverage,
  }).criteria.find((c) => c.criterion_id === "prior")!
  assert.equal(prior.status, "needs_review")
  assert.match(prior.reason, /privacy step removed a drug word/)
})

test("an outcome bound to one drug never counts for another", () => {
  const trial = [
    "Request date: 2026-10-01.",
    "Request: semaglutide 0.5 mg weekly.",
    "MEDICATION HISTORY",
    "Prior therapy: metformin 1000 mg twice daily from 2026-01-02 to 2026-02-01.",
    "",
    "OTHER TABLETS",
    "Glipizide 5 mg daily from 2026-02-02 to 2026-04-01.",
    "Stopped for persistent nausea.",
    "",
  ].join("\n")
  const prior = one(run(trial), "prior")
  assert.equal(prior.status, "needs_review")
  assert.match(prior.reason, /metformin trial lasted 30 days/)
  // The same stop line under the metformin course is a metformin intolerance.
  const bound = trial.replace(
    "Prior therapy: metformin 1000 mg twice daily from 2026-01-02 to 2026-02-01.\n",
    "Prior therapy: metformin 1000 mg twice daily from 2026-01-02 to 2026-02-01.\nStopped for persistent nausea.\n",
  )
  assert.equal(one(run(bound), "prior").status, "evidence_found")
})

test("an outcome that names no drug counts for none and blocks not documented", () => {
  const text = [
    "Request date: 2026-10-01.",
    "Request: semaglutide 0.5 mg weekly.",
    "Stopped for persistent nausea.",
    "",
  ].join("\n")
  const prior = one(run(text), "prior")
  assert.equal(prior.status, "needs_review")
  assert.match(prior.reason, /could not be tied to a drug/)
})

test("stopping for an inadequate response is not an intolerance", () => {
  const text = base
    .replace(/Baseline[^\n]*\n|On metformin[^\n]*\n/g, "")
    .replace(
      "stopped 2026-08-01.",
      "stopped 2026-08-01.\nStopped for an inadequate response.",
    )
  const out = run(text)
  const outcome = out.entities.find((e) => e.type === "prior_outcome")!
  assert.equal(outcome.value, "inadequate response")
  const prior = one(out, "prior")
  assert.equal(prior.status, "needs_review")
  assert.match(prior.reason, /no A1c before and after the trial/)
})

test("a medication-list dose that cannot be read stops a found dose answer", () => {
  const text = base.replace(
    "MEDICATION HISTORY",
    "Current medications: Ozempic 0.5 mg (frequency illegible)\nMEDICATION HISTORY",
  )
  const dose = one(run(text), "dose")
  assert.equal(dose.status, "needs_review")
  assert.match(dose.reason, /could disagree could not be read/)
})

test("the coverage record travels with the result", () => {
  const out = run(base.replace("Age: 33 years.", "Age: see intake sheet"))
  assert.ok(out.readerCoverage)
  assert.equal(out.readerCoverage!.blockers.adult[0].kind, "unparsed-mention")
  assert.equal(out.readerCoverage!.lines, base.split("\n").length)
})

test("pages joined without a break line keep their own date order", () => {
  const first = "Request date: 2026-10-01.\nVisit date: 20/09/2026.\n"
  const text = first + "A1c: 8.6 %; collected 08/09/2026.\n"
  const split = Array.from(first).length
  const pages = [0, 1].map((k) => ({
    image: `p${k}.png`,
    readImage: `p${k}.read.png`,
    width: 1,
    height: 1,
    orientation: { pageRotation: 0, scores: {} },
    deskewDegrees: 0,
    start: k ? split : 0,
    end: k ? Array.from(text).length : split,
  }))
  const joined = run(text, { ...ocrOf(text), pages })
  // The day above 12 on page one does not settle page two's date.
  assert.equal(joined.dateReading.status, "unresolved")
  assert.equal(run(text, ocrOf(text)).dateReading.status, "forced")
})

test("pages out of order block not documented and mark the packet incomplete", () => {
  const text = base.replace("Age: 33 years.\n", "")
  const out = run(text, ocrOf(text, [], { outOfOrder: true, complete: false }))
  const adult = one(out, "adult")
  assert.equal(adult.status, "needs_review")
  assert.match(adult.reason, /arrived out of order/)
  // A found answer stays found. The packet carries the mark.
  assert.equal(one(out, "diagnosis").status, "evidence_found")
  assert.equal(out.readerCoverage!.complete, false)
  assert.ok(out.readerCoverage!.incomplete!.some((m) => /out of order/.test(m)))
})

test("a page counts as unreadable only when most of its lines held no confident word", () => {
  const text = base.replace("Age: 33 years.\n", "")
  const lines = text.split("\n").length
  const run_ = (from: number, to: number) => ({
    from,
    to,
    start: 0,
    end: 1,
    words: 3,
    lowWords: 3,
  })
  const some = ocrOf(text, [], {})
  some.coverage!.pages[0].lowConfidenceLines = [run_(2, 3)]
  some.coverage!.pages[0].unreadableLines = [run_(2, 3)]
  const fine = run(text, some)
  assert.equal(one(fine, "adult").status, "missing")
  assert.equal(fine.readerCoverage!.complete, true)
  const most = ocrOf(text, [], {})
  most.coverage!.pages[0].unreadableLines = [run_(1, Math.ceil(lines / 2))]
  const blocked = run(text, most)
  assert.equal(one(blocked, "adult").status, "needs_review")
  assert.match(one(blocked, "adult").reason, /Page 1 could not be read/)
  assert.equal(blocked.readerCoverage!.complete, false)
})
