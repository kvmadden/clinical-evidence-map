import { test } from "node:test"
import assert from "node:assert/strict"
import { distance, f1, scoreEntities } from "../scripts/metrics.js"
import { extract } from "../services/extract/index.js"
import { processText } from "../services/pipeline.js"
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
