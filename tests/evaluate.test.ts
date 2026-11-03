import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { evaluate } from "../scripts/evaluate.js"
import { SETS } from "../scripts/sets.mjs"

test("a set that is not written yet is skipped and its folder never made", async () => {
  // The second held-out set's own folder is never opened here. A path that
  // does not exist stands in for it.
  assert.equal(SETS["holdout-v2"].root, "eval/holdout-v2")
  const root = join(await mkdtemp(join(tmpdir(), "clinical-absent-")), "set")
  try {
    assert.equal(await evaluate("holdout-v2", { root }), null)
    assert.equal(await evaluate("holdout-v2", { root, check: true }), null)
    assert.equal(existsSync(root), false)
    await assert.rejects(evaluate("no-such-set"), /Unknown set/)
  } finally {
    await rm(join(root, ".."), { recursive: true, force: true })
  }
})

test("a stale page cache names the set to rebuild", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinical-stale-"))
  try {
    for (const part of [
      "manifest.json",
      "packets",
      "gold",
      "artifacts",
      "results",
    ])
      await cp(`eval/fixtures/multipage/${part}`, join(root, part), {
        recursive: true,
      })
    // Any change to a page's text makes its stored OCR stale.
    const packet = join(root, "packets/multipage-01.md")
    await writeFile(
      packet,
      (await readFile(packet, "utf8")).replace("Age: 50", "Age: 51"),
    )
    await assert.rejects(
      evaluate("multipage", { root, check: true }),
      /stale OCR artifact for multipage-01\. Run npm run eval -- --set multipage --rebuild/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
