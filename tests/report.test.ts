import { test } from "node:test"
import assert from "node:assert/strict"
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildReport } from "../scripts/report.mjs"

test("the evaluation page matches the saved results it is built from", async () => {
  assert.equal(
    await buildReport(),
    await readFile("docs/EVALUATION.md", "utf8"),
  )
})

// Stand-ins built from the first held-out set's saved files, in temporary
// folders. The real second held-out set's folder is never opened here.
async function standIn() {
  const root = await mkdtemp(join(tmpdir(), "clinical-report-"))
  for (const part of [
    "manifest.json",
    "FREEZE.json",
    "ROLE.json",
    "packets",
    "gold",
    "results",
  ])
    await cp(`eval/holdout/${part}`, join(root, part), { recursive: true })
  return root
}

test("the first held-out set keeps its blind score, and a later score is a development result", async () => {
  const page = await buildReport()
  assert.match(
    page,
    /First held-out set, 24 packets, blind score before the rules change/,
  )
  assert.match(
    page,
    /\*\*From 3 November 2026 the first held-out set is development data\.\*\*/,
  )
  // The blind score never moves, whatever the development numbers do.
  assert.match(
    page,
    /Criterion statuses correct \| [^|]+ \| 37 \/ 120 \(30\.8%\) \|/,
  )
  // After a rules change the same packets score differently. The blind score
  // stays as it was, and the new one gets its own column.
  const heldRoot = await standIn()
  try {
    const file = join(heldRoot, "results/metrics.json")
    const later = JSON.parse(await readFile(file, "utf8"))
    later.draftDiagnostics.criteria.correct = 52
    await writeFile(file, JSON.stringify(later))
    const changed = await buildReport({ heldRoot })
    assert.match(changed, /First held-out set now, a development result/)
    assert.match(
      changed,
      /Criterion statuses correct \| [^|]+ \| 37 \/ 120 \(30\.8%\) \| 52 \/ 120 \(43\.3%\) \|/,
    )
    assert.match(
      changed,
      /Its latest score, a development result, is 52 \/ 120 \(43\.3%\), shown in its own column/,
    )
  } finally {
    await rm(heldRoot, { recursive: true, force: true })
  }
})

test("a second held-out set appears once it exists, and the page says when it does not", async () => {
  const absent = await mkdtemp(join(tmpdir(), "clinical-report-absent-"))
  try {
    assert.match(
      await buildReport({ v2Root: join(absent, "set") }),
      /A second held-out set is being written blind by other model families\./,
    )
  } finally {
    await rm(absent, { recursive: true, force: true })
  }
  const v2Root = await standIn()
  try {
    // A stand-in that has been scored once and has no role change.
    await rm(join(v2Root, "ROLE.json"))
    const page = await buildReport({ v2Root })
    assert.match(page, /\| Second held-out set, 24 packets, blind score \|/)
    assert.match(
      page,
      /### Second held-out set by group and criterion, blind score/,
    )
    assert.match(
      page,
      /The second held-out set has 24 packets, frozen under sha256/,
    )
    assert.match(page, /first scored on 2 November 2026 at 735ea32/)
    assert.doesNotMatch(page, /It has not run/)
  } finally {
    await rm(v2Root, { recursive: true, force: true })
  }
})

test("a first-score record that no longer matches its set is never shown as blind", async () => {
  const heldRoot = await standIn()
  try {
    // Labels changed and the freeze rewritten to match: a different set.
    const gold = join(heldRoot, "gold/holdout-01.json")
    await writeFile(
      gold,
      (await readFile(gold, "utf8")).replace("Age", "Pt age"),
    )
    const frozen = JSON.parse(
      await readFile(join(heldRoot, "FREEZE.json"), "utf8"),
    )
    frozen.sha256 = "0".repeat(64)
    await writeFile(join(heldRoot, "FREEZE.json"), JSON.stringify(frozen))
    const page = await buildReport({ heldRoot })
    assert.doesNotMatch(page, /blind score before the rules change \|/)
    assert.match(
      page,
      /First held-out set, 24 packets, latest score, a development result/,
    )
    assert.match(page, /The first held-out set has no valid blind score here/)
    assert.match(page, /In its latest run, a development result,/)
  } finally {
    await rm(heldRoot, { recursive: true, force: true })
  }
})
