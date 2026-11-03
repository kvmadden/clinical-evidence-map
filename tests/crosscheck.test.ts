import { test } from "node:test"
import assert from "node:assert/strict"
import { crosscheck } from "../scripts/crosscheck.mjs"

test("three blind relabels reproduce the stated agreement with the frozen held-out labels", async () => {
  const result = await crosscheck()
  assert.equal(result.packets, 24)
  assert.equal(result.labels, 120)
  assert.deepEqual(result.agree, { "claude-opus-5.5": 120, "gemini-4-argon": 120, "grok-4.7": 119 })
  assert.equal(result.unanimous, 119)
  assert.deepEqual(result.disputes, [
    {
      packet: "holdout-15",
      criterion: "lab",
      frozen: "evidence_found",
      relabels: { "claude-opus-5.5": "evidence_found", "gemini-4-argon": "evidence_found", "grok-4.7": "needs_review" },
    },
  ])
})
