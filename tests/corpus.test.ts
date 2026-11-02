import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { loadManifest, processText, sourceBody } from "../services/pipeline.js"
import { validSpan } from "../services/contracts.js"
test("all 50 draft references and pipeline predictions retain exact source spans", async () => {
  const manifest = await loadManifest()
  assert.equal(manifest.packets.length, 50)
  let count = 0
  for (const entry of manifest.packets) {
    const body = sourceBody(
      await readFile(`eval/packets/${entry.packet_id}.md`, "utf8"),
    )
    const gold = JSON.parse(
      await readFile(`eval/gold/${entry.packet_id}.json`, "utf8"),
    )
    assert.equal(gold.reviewed, false)
    for (const e of gold.entities) {
      assert.ok(validSpan(body, e.source_span))
      count++
    }
    for (const c of gold.criterion_evidence)
      for (const span of c.evidence_spans) {
        assert.ok(validSpan(body, span))
        count++
      }
    const result = processText(body, entry.criteria_id)
    for (const e of result.entities)
      assert.ok(validSpan(result.privacy.text, e.source_span))
    for (const c of result.criteria)
      for (const span of c.evidence_spans)
        assert.ok(validSpan(result.privacy.text, span))
    assert.ok(result.summary.every((s) => s.supported))
  }
  assert.equal(count, 995)
})
