import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { processText } from "../services/pipeline.js"

// Development data: the shared battery and the probes from the four
// evaluation reports. Passing them shows the reader does what it was built to
// do. They are not a held-out measure.
const { probes } = JSON.parse(
  readFileSync(new URL("./fixtures/dev-probes.json", import.meta.url), "utf8"),
) as {
  probes: {
    id: string
    source: string
    criteria: string
    criterion: string
    expected: string
    note: string
    text: string
  }[]
}

for (const source of [...new Set(probes.map((p) => p.source))])
  test(`development probes from ${source}`, async (t) => {
    for (const p of probes.filter((x) => x.source === source))
      await t.test(
        `${p.id}: ${p.criteria} ${p.criterion} is ${p.expected}`,
        () => {
          const out = processText(p.text, p.criteria, undefined, {
            dateShiftDays: 0,
          })
          const c = out.criteria.find((x) => x.criterion_id === p.criterion)!
          assert.equal(c.status, p.expected, `${p.note}\n${c.reason}`)
        },
      )
  })

test("the probe set keeps its size and its sources", () => {
  const by = (s: string) => probes.filter((p) => p.source === s).length
  assert.equal(probes.length, 249)
  assert.equal(by("battery"), 54)
  assert.equal(by("claude"), 105)
  assert.equal(by("gpt"), 48)
  assert.equal(by("grok"), 42)
  assert.equal(new Set(probes.map((p) => p.id)).size, probes.length)
})
