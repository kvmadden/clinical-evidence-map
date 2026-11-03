import { test } from "node:test"
import assert from "node:assert/strict"
import {
  alignChars,
  alignTokens,
  distance,
  f1,
  scoreEntities,
  summarize,
  unreadSourceLines,
  unshift,
  type LabelResult,
} from "../scripts/metrics.js"
import { readCoverage } from "../services/ocr/coverage.js"
import type { OcrOutput } from "../services/contracts.js"
import { joinPages } from "../services/ocr/pages.js"
import { extract } from "../services/extract/index.js"
import { processText } from "../services/pipeline.js"
import { addDays } from "../services/redact/dates.js"

test("metrics count insertions, substitutions, omissions and duplicate predictions", () => {
  assert.equal(distance("dose", "d0se!"), 2)
  assert.deepEqual(f1(2, 4, 2), {
    precision: 0.5,
    recall: 1,
    f1: 2 / 3,
    tp: 2,
    predicted: 4,
    gold: 2,
  })
  const e = extract({ text: "Age: 33 years." }).entities
  assert.equal(scoreEntities([...e, ...e], e).tp, 1)
})

test("summaries print the always-found baseline and recall for each status", () => {
  const row = (
    gold: LabelResult["gold"],
    predicted: LabelResult["predicted"],
  ): LabelResult => ({
    packet: "p",
    criterion: "c",
    scenario: "s",
    gold,
    predicted,
    quotes: false,
    reviewed: false,
  })
  const s = summarize([
    row("evidence_found", "evidence_found"),
    row("missing", "evidence_found"),
    row("needs_review", "needs_review"),
    row("needs_review", "missing"),
  ])
  assert.equal(s.correct, 2)
  assert.deepEqual(s.alwaysFound, { correct: 1, accuracy: 0.25 })
  assert.equal(s.byStatus.missing.recall, 0)
  assert.equal(s.byStatus.needs_review.recall, 0.5)
  assert.deepEqual(s.falseFound, { count: 1, of: 3 })
  // Label status down, answer across.
  assert.deepEqual(s.confusion, {
    evidence_found: { evidence_found: 1, missing: 0, needs_review: 0 },
    missing: { evidence_found: 1, missing: 0, needs_review: 0 },
    needs_review: { evidence_found: 0, missing: 1, needs_review: 1 },
  })
  // "Not documented" where something is on the page, and what went to a person.
  assert.deepEqual(s.falseMissing, { count: 1, of: 3 })
  assert.deepEqual(s.sentToReview, { count: 1, of: 4 })
  assert.deepEqual(summarize([]).falseMissing, { count: 0, of: 0 })
})

test("the source check finds lines OCR dropped or garbled and says which coverage flagged", () => {
  const map = alignChars(Array.from("abcdef"), Array.from("abXdf"))
  assert.deepEqual([...map], [0, 1, 2, 3, -1, 4])
  const source = [
    "Age: 50\nThe patient reports ongoing symptoms.\nDose: 140 mg\n",
    "Age: ________\nLDL-C 132 mg/dL\n",
  ]
  // Page 1 lost its middle line without a trace. Page 2 read the lab line as
  // low-confidence noise, and the blank field's underscores do not count.
  const ocrPage = (text: string, low: string[] = []) => {
    const words = []
    let at = 0
    for (const w of text.split(/\s+/).filter(Boolean)) {
      const start = text.indexOf(w, at)
      at = start + w.length
      const confidence = low.includes(w) ? 20 : 95
      words.push({
        text: w,
        confidence,
        start,
        end: at,
        needsReview: confidence < 80,
        box: { x: 0, y: 0, width: 1, height: 1 },
      })
    }
    return {
      text,
      words,
      threshold: 80,
      engine: "fixture",
      orientation: { pageRotation: 0, scores: { "0": 9, "180": 1 } },
    }
  }
  const ocr = joinPages(
    [
      ocrPage("Age: 50\nDose: 140 mg\n"),
      ocrPage("Age:\nwxq zzv\n", ["wxq", "zzv"]),
    ],
    ["a.png", "b.png"],
  )
  const check = unreadSourceLines(source, ocr, readCoverage(ocr))
  assert.equal(check.lines, 5)
  assert.deepEqual(
    check.unread.map((u) => [u.page, u.line, u.flagged]),
    [
      [0, 2, false],
      [1, 2, true],
    ],
  )
})

test("evaluation undoes the date shift and lines redacted text up with the raw text", () => {
  assert.equal(unshift(addDays("2026-07-28", 40000), 40000), "2026-07-28")
  assert.deepEqual(
    unshift(
      {
        readings: [addDays("2026-07-28", 40000), addDays("2026-07-29", 40000)],
      },
      40000,
    ),
    { readings: ["2026-07-28", "2026-07-29"] },
  )
  assert.deepEqual(
    alignTokens(
      "Seen by Ann Lee on 2026-10-01.",
      "Seen by [name] on [date-a].",
    ),
    [
      { token: "[name]", original: "Ann Lee" },
      { token: "[date-a]", original: "2026-10-01" },
    ],
  )
})

test("pipeline routes low confidence clinical evidence after identifier removal", () => {
  const text = "Patient: Mira Brookvale (fictional).\nAge: 33 years.\n"
  const start = text.indexOf("33")
  const result = processText(text, "glp1-t2d", {
    text,
    threshold: 80,
    engine: "fixture",
    words: [
      {
        text: "33",
        confidence: 30,
        start,
        end: start + 2,
        needsReview: true,
        box: { x: 1, y: 2, width: 3, height: 4 },
      },
    ],
  })
  assert.equal(result.criteria[0].status, "needs_review")
  assert.ok(result.entities.find((e) => e.type === "age")!.boxes.length)
})

test("the source check lines up whole lines, so a lost line is never hidden by a similar one", () => {
  const ocr = (text: string): OcrOutput => ({
    text,
    words: [],
    threshold: 80,
    engine: "fixture",
  })
  const unread = (source: string, text: string) => {
    const o = ocr(text)
    return unreadSourceLines([source], o, readCoverage(o)).unread.map(
      (u) => u.line,
    )
  }
  // OCR kept the second of two similar lines: the first is the lost one.
  assert.deepEqual(
    unread("LDL-C 132 mg/dL\nLDL-C 140 mg/dL\n", "LDL-C 140 mg/dL\n"),
    [1],
  )
  // One line came back, as close to either source line. Exactly one is lost.
  assert.equal(
    unread(
      "A1c 8.1 % on 2026-09-15\nA1c 9.1 % on 2026-09-15\n",
      "A1c 8.6 % on 2026-09-15\n",
    ).length,
    1,
  )
  // A long line OCR wrapped onto two lines was read, not lost.
  assert.deepEqual(
    unread(
      "Assessment: Established atherosclerotic cardiovascular disease.\nAge: 50\n",
      "Assessment: Established atherosclerotic\ncardiovascular disease.\nAge: 50\n",
    ),
    [],
  )
  // A blank form field counts by its label, not its underscores.
  assert.deepEqual(unread("Age: ________\n", "Age:\n"), [])
})
