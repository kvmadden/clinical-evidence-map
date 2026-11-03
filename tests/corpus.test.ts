import { test } from "node:test"
import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadManifest, processText, sourceBody } from "../services/pipeline.js"
import { validSpan } from "../services/contracts.js"
import { generate } from "../scripts/generate.js"
import { setHash } from "../scripts/holdout.js"

test("every draft reference and pipeline prediction keeps an exact source span", async () => {
  const manifest = await loadManifest()
  assert.equal(manifest.packets.length, 63)
  for (const entry of manifest.packets) {
    const body = sourceBody(
      await readFile(`eval/packets/${entry.packet_id}.md`, "utf8"),
    )
    const gold = JSON.parse(
      await readFile(`eval/gold/${entry.packet_id}.json`, "utf8"),
    )
    assert.equal(gold.reviewed, false)
    for (const e of gold.entities)
      assert.ok(validSpan(body, e.source_span), `${entry.packet_id} ${e.type}`)
    for (const c of gold.criterion_evidence) {
      if (c.status === "missing") assert.equal(c.evidence_spans.length, 0)
      for (const span of c.evidence_spans) assert.ok(validSpan(body, span))
      // A label counts as reviewed only when carried over from a recorded review.
      assert.equal(c.reviewed, c.review?.carried_over === true)
    }
    const result = processText(body, entry.criteria_id, undefined, {
      dateShiftDays: 40000,
    })
    for (const e of result.entities)
      assert.ok(validSpan(result.privacy.text, e.source_span))
    for (const c of result.criteria)
      for (const span of c.evidence_spans)
        assert.ok(validSpan(result.privacy.text, span))
    assert.ok(result.summary.every((s) => s.supported))
  }
})

test("labels are balanced so an always-found answer scores near half, not 88%", async () => {
  const manifest = await loadManifest()
  const counts: Record<string, number> = {
    evidence_found: 0,
    missing: 0,
    needs_review: 0,
  }
  const unsupported: number[] = []
  for (const entry of manifest.packets) {
    const gold = JSON.parse(
      await readFile(`eval/gold/${entry.packet_id}.json`, "utf8"),
    )
    for (const c of gold.criterion_evidence) counts[c.status]++
    unsupported.push(
      gold.criterion_evidence.filter(
        (c: { status: string }) => c.status !== "evidence_found",
      ).length,
    )
  }
  const total = counts.evidence_found + counts.missing + counts.needs_review
  assert.equal(total, 315)
  assert.ok(counts.evidence_found / total < 0.6)
  assert.ok(counts.missing / total > 0.15 && counts.needs_review / total > 0.25)
  assert.ok(unsupported.filter((n) => n >= 2).length > 30)
  assert.equal(unsupported.filter((n) => n === 5).length, 3)
})

test("the generator reproduces every checked-in packet, label, criteria file and manifest", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clinical-generate-"))
  try {
    await mkdir(join(dir, "eval/handwriting"), { recursive: true })
    await mkdir(join(dir, "eval/reviews"), { recursive: true })
    await mkdir(join(dir, "eval/criteria"), { recursive: true })
    await cp(
      "eval/handwriting/handwriting.json",
      join(dir, "eval/handwriting/handwriting.json"),
    )
    await cp(
      "eval/reviews/2026-11-02-kevin.json",
      join(dir, "eval/reviews/2026-11-02-kevin.json"),
    )
    await generate(dir)
    for (const sub of ["packets", "gold", "criteria"])
      for (const f of await readdir(`eval/${sub}`))
        assert.equal(
          await readFile(join(dir, "eval", sub, f), "utf8"),
          await readFile(`eval/${sub}/${f}`, "utf8"),
          `${sub}/${f}`,
        )
    assert.equal(
      await readFile(join(dir, "eval/manifest.json"), "utf8"),
      await readFile("eval/manifest.json", "utf8"),
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("Kevin's labels carry over only where the rule and quoted evidence are unchanged", async () => {
  const carried: string[] = [],
    rereview: string[] = []
  for (const id of [
    "packet-001",
    "packet-002",
    "packet-006",
    "packet-007",
    "packet-011",
  ]) {
    const gold = JSON.parse(await readFile(`eval/gold/${id}.json`, "utf8"))
    for (const c of gold.criterion_evidence)
      if (c.review)
        (c.review.carried_over ? carried : rereview).push(
          `${id}:${c.criterion_id}`,
        )
  }
  assert.deepEqual(carried.sort(), [
    "packet-001:adult",
    "packet-001:dose",
    "packet-001:lab",
    "packet-002:adult",
    "packet-002:dose",
    "packet-002:lab",
    "packet-006:adult",
    "packet-006:dose",
    "packet-006:lab",
    "packet-007:adult",
    "packet-007:dose",
    "packet-007:lab",
    "packet-011:adult",
  ])
  assert.deepEqual(rereview.sort(), [
    "packet-001:diagnosis",
    "packet-001:prior",
    "packet-002:diagnosis",
    "packet-002:prior",
    "packet-006:diagnosis",
    "packet-006:prior",
    "packet-007:diagnosis",
    "packet-007:prior",
  ])
})

test("the held-out set still matches the sha256 recorded when it was frozen", async () => {
  const frozen = JSON.parse(await readFile("eval/holdout/FREEZE.json", "utf8"))
  assert.equal(await setHash(), frozen.sha256)
  const manifest = await loadManifest("eval/holdout/manifest.json")
  assert.equal(manifest.packets.length, 24)
  for (const entry of manifest.packets) {
    const body = sourceBody(
      await readFile(`eval/holdout/packets/${entry.packet_id}.md`, "utf8"),
    )
    const gold = JSON.parse(
      await readFile(`eval/holdout/gold/${entry.packet_id}.json`, "utf8"),
    )
    assert.equal(gold.criterion_evidence.length, 5)
    for (const c of gold.criterion_evidence)
      for (const span of c.evidence_spans) assert.ok(validSpan(body, span))
  }
})
