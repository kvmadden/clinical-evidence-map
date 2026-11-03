import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { evaluate } from "../scripts/evaluate.js"
import { setHash } from "../scripts/holdout.js"
import { BLIND, DEVELOPMENT, readFirstScore } from "../scripts/records.mjs"
import { loadManifest } from "../services/pipeline.js"
import type { OcrOutput } from "../services/contracts.js"

// A stand-in blind set of one development packet, frozen and committed in a
// temporary git repository of its own. The real second held-out set is never
// opened here.
const ID = "packet-001"
const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.invalid", ...args],
    { cwd, encoding: "utf8" },
  )
async function blindSet(extra: Record<string, string> = {}) {
  const root = await mkdtemp(join(tmpdir(), "clinical-blind-"))
  const manifest = await loadManifest()
  const entry = manifest.packets.find((p) => p.packet_id === ID)!
  for (const sub of ["packets", "gold", "artifacts"])
    await mkdir(join(root, sub))
  await cp(`eval/packets/${ID}.md`, join(root, `packets/${ID}.md`))
  await cp(`eval/gold/${ID}.json`, join(root, `gold/${ID}.json`))
  for (const ext of ["json", "png", "pdf"])
    await cp(
      `eval/artifacts/${ID}.${ext}`,
      join(root, `artifacts/${ID}.${ext}`),
    )
  await writeFile(
    join(root, "manifest.json"),
    JSON.stringify(
      {
        packet_count: 1,
        groups: manifest.groups.filter((g) => g.id === entry.group),
        packets: [entry],
      },
      null,
      2,
    ) + "\n",
  )
  await writeFile(
    join(root, "FREEZE.json"),
    JSON.stringify({ sha256: await setHash(root) }) + "\n",
  )
  for (const [file, text] of Object.entries(extra)) {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(join(root, file), text)
  }
  git(root, "init", "-q")
  git(root, "add", ".")
  git(root, "commit", "-q", "-m", "freeze")
  return root
}
// A reader that returns the development packet's stored OCR, as tesseract
// would read the page, and counts its reads.
async function reader() {
  const ocr = JSON.parse(await readFile(`eval/artifacts/${ID}.json`, "utf8"))
    .ocr as OcrOutput
  let reads = 0
  return {
    reads: () => reads,
    recognize: async (image: string) => {
      reads++
      return { ...ocr, readImage: basename(image) }
    },
    close: async () => {},
  }
}
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"))
const sha256 = async (file: string) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex")

test("a blind first run reads every page again instead of trusting stored OCR", async () => {
  const root = await blindSet()
  try {
    // Stored OCR swapped for something better, its fingerprint left intact.
    const cacheFile = join(root, `artifacts/${ID}.json`)
    const cache = await json(cacheFile)
    cache.ocr.text = "TAMPERED\n"
    await writeFile(cacheFile, JSON.stringify(cache, null, 2) + "\n")
    const read = await reader()
    const first = await evaluate("holdout", { root, reader: read })
    assert.equal(read.reads(), 1)
    assert.notEqual((await json(cacheFile)).ocr.text, "TAMPERED\n")
    assert.equal(first!.run.class, BLIND)
    const { record, valid } = await readFirstScore(root)
    assert.equal(valid, true)
    assert.deepEqual(record.metrics, first)
    assert.equal(
      record.identity.artifacts[`artifacts/${ID}.json`],
      await sha256(cacheFile),
    )
    assert.deepEqual(await json(join(root, "results/metrics.json")), first)
    assert.equal(existsSync(join(root, "results/first-run.claim.json")), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("later runs are development results, bound to the set the first score was of", async () => {
  const root = await blindSet()
  try {
    const first = await evaluate("holdout", { root, reader: await reader() })
    const record = await readFile(
      join(root, "results/first-score.json"),
      "utf8",
    )
    const later = await evaluate("holdout", { root })
    assert.equal(later!.run.class, DEVELOPMENT)
    assert.deepEqual({ ...later, run: first!.run }, first)
    assert.equal(
      await readFile(join(root, "results/first-score.json"), "utf8"),
      record,
    )
    assert.deepEqual(await evaluate("holdout", { root, check: true }), later)
    // A saved development score that differs from the blind one cannot pass
    // for it. With the same numbers it would be an exact copy of the record.
    const saved = await json(join(root, "results/metrics.json"))
    saved.run.class = BLIND
    saved.draftDiagnostics.criteria.correct += 1
    await writeFile(join(root, "results/metrics.json"), JSON.stringify(saved))
    await assert.rejects(
      evaluate("holdout", { root, check: true }),
      /claims a blind first run/,
    )
    // Changed labels under a freeze rewritten to match are a different set.
    const gold = join(root, `gold/${ID}.json`)
    await writeFile(
      gold,
      (await readFile(gold, "utf8")).replace("Age", "Pt age"),
    )
    await writeFile(
      join(root, "FREEZE.json"),
      JSON.stringify({ sha256: await setHash(root) }) + "\n",
    )
    await assert.rejects(evaluate("holdout", { root }), /different set/)
    await assert.rejects(
      evaluate("holdout", { root, check: true }),
      /different set/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("the first score is claimed and written once, and an interrupted run resumes only at its own commit", async () => {
  const root = await blindSet()
  try {
    const claim = join(root, "results/first-run.claim.json")
    await mkdir(join(root, "results"))
    await writeFile(claim, JSON.stringify({ commit: "0000000" }))
    await assert.rejects(evaluate("holdout", { root }), /interrupted/)
    await assert.rejects(
      evaluate("holdout", { root, recover: true }),
      /different commit/,
    )
    const head = git(root, "rev-parse", "--short", "HEAD").trim()
    await writeFile(claim, JSON.stringify({ commit: head }))
    const recovered = await evaluate("holdout", {
      root,
      recover: true,
      reader: await reader(),
    })
    assert.equal(recovered!.run.class, BLIND)
    assert.equal(existsSync(claim), false)
    // Once committed, losing both result files cannot mint a new first score.
    git(root, "add", ".")
    git(root, "commit", "-q", "-m", "first score")
    await rm(join(root, "results"), { recursive: true })
    await assert.rejects(evaluate("holdout", { root }), /Restore it from git/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
  // Two runs at once: only one may claim the first score.
  const raced = await blindSet()
  try {
    const runs = await Promise.allSettled([
      evaluate("holdout", { root: raced, reader: await reader() }),
      evaluate("holdout", { root: raced, reader: await reader() }),
    ])
    assert.deepEqual(runs.map((r) => r.status).sort(), [
      "fulfilled",
      "rejected",
    ])
    assert.equal((await readFirstScore(raced)).valid, true)
  } finally {
    await rm(raced, { recursive: true, force: true })
  }
})

test("a planted record, a development role or an unscored set never yields a blind score", async () => {
  // A first-score record that was not made for this set.
  const planted = await blindSet({
    "results/first-score.json": JSON.stringify({
      runClass: BLIND,
      identity: { frozenSha256: "0".repeat(64), files: {} },
      metrics: { run: { class: BLIND } },
    }),
  })
  try {
    await assert.rejects(
      evaluate("holdout", { root: planted }),
      /different set/,
    )
  } finally {
    await rm(planted, { recursive: true, force: true })
  }
  // A set already marked development data gets development runs only.
  const demoted = await blindSet({
    "ROLE.json": JSON.stringify({ role: "development", since: "2026-11-03" }),
  })
  try {
    const run = await evaluate("holdout", { root: demoted })
    assert.equal(run!.run.class, DEVELOPMENT)
    assert.equal(existsSync(join(demoted, "results/first-score.json")), false)
  } finally {
    await rm(demoted, { recursive: true, force: true })
  }
  // Checking a frozen set that was never scored still checks its freeze.
  const unscored = await blindSet()
  try {
    assert.equal(
      await evaluate("holdout-v2", { root: unscored, check: true }),
      null,
    )
    const gold = join(unscored, `gold/${ID}.json`)
    await writeFile(
      gold,
      (await readFile(gold, "utf8")).replace("Age", "Pt age"),
    )
    await assert.rejects(
      evaluate("holdout-v2", { root: unscored, check: true }),
      /changed since it was frozen/,
    )
  } finally {
    await rm(unscored, { recursive: true, force: true })
  }
})

test("a blind first run needs the freeze and the code committed first", async () => {
  const root = await blindSet({ "code.ts": "export const rule = 1\n" })
  try {
    // No freeze at all.
    await rm(join(root, "FREEZE.json"))
    await assert.rejects(evaluate("holdout", { root }), /no FREEZE.json/)
    git(root, "checkout", "--", "FREEZE.json")
    // A freeze rewritten but not committed.
    await writeFile(
      join(root, "FREEZE.json"),
      JSON.stringify({ sha256: await setHash(root) }, null, 2) + "\n",
    )
    await assert.rejects(evaluate("holdout", { root }), /Commit .*FREEZE.json/)
    git(root, "checkout", "--", "FREEZE.json")
    // Code changed after the last commit: the record could not name it.
    await writeFile(join(root, "code.ts"), "export const rule = 2\n")
    await assert.rejects(evaluate("holdout", { root }), /Commit the code/)
    git(root, "checkout", "--", "code.ts")
    assert.equal(
      (await evaluate("holdout", { root, reader: await reader() }))!.run.class,
      BLIND,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
