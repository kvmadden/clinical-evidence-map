import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildFixtures,
  FIXTURE_DIR,
  labelOnPagesReceived,
} from "../scripts/fixtures.js"
import { loadManifest, sourceBody } from "../services/pipeline.js"
import { readingText, splitPages } from "../services/ocr/pages.js"
import { validSpan } from "../services/contracts.js"

test("the multi-page fixture rebuilds byte for byte from packet-018", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clinical-fixture-"))
  try {
    await buildFixtures(dir)
    for (const sub of ["packets", "gold"])
      for (const f of await readdir(`${FIXTURE_DIR}/${sub}`))
        assert.equal(
          (await readFile(join(dir, sub, f), "utf8")).replaceAll(
            dir,
            FIXTURE_DIR,
          ),
          await readFile(`${FIXTURE_DIR}/${sub}/${f}`, "utf8"),
          `${sub}/${f}`,
        )
    assert.equal(
      await readFile(join(dir, "manifest.json"), "utf8"),
      await readFile(`${FIXTURE_DIR}/manifest.json`, "utf8"),
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("fixture labels quote whole lines that sit on the pages received", async () => {
  const original = sourceBody(
    await readFile("eval/packets/packet-018.md", "utf8"),
  )
  const manifest = await loadManifest(`${FIXTURE_DIR}/manifest.json`)
  const pages: Record<string, number> = {}
  for (const entry of manifest.packets) {
    const body = sourceBody(
      await readFile(`${FIXTURE_DIR}/packets/${entry.packet_id}.md`, "utf8"),
    )
    const gold = JSON.parse(
      await readFile(`${FIXTURE_DIR}/gold/${entry.packet_id}.json`, "utf8"),
    )
    pages[entry.packet_id] = splitPages(body).length
    // Offsets count the marker lines, as the body is written.
    for (const e of gold.entities) assert.ok(validSpan(body, e.source_span))
    for (const c of gold.criterion_evidence)
      for (const span of c.evidence_spans) {
        assert.ok(validSpan(body, span), `${entry.packet_id} ${c.criterion_id}`)
        assert.ok(readingText(body).split("\n").includes(span.text))
      }
    // Every line is packet-018's, apart from the fax header on each page.
    for (const line of readingText(body).split("\n"))
      assert.ok(
        line.startsWith("FROM REQUESTING OFFICE FAX P.") ||
          original.split("\n").includes(line),
        line,
      )
  }
  assert.deepEqual(pages, { "multipage-01": 3, "multipage-02": 2 })
  // With page 2 missing, nothing may be called not documented.
  const gap = JSON.parse(
    await readFile(`${FIXTURE_DIR}/gold/multipage-02.json`, "utf8"),
  )
  assert.ok(
    gap.criterion_evidence.every(
      (c: { status: string }) => c.status !== "missing",
    ),
  )
})

test("with a page missing, nothing is labeled not documented, whatever it was before", () => {
  const onPage = (text: string) => text !== "Prior therapy: metformin 500 mg"
  const label = (criterion_id: string, status: string, quotes: string[]) => ({
    criterion_id,
    status,
    evidence_spans: quotes.map((text) => ({ start: 0, end: 1, text })),
    reason: "",
    scenario: "x",
    reviewed: false,
  })
  // Already not documented in the one-page packet, and a page is now missing.
  const was = label("lab", "missing", [])
  const now = labelOnPagesReceived(was, onPage, [2], {})
  assert.equal(now.status, "needs_review")
  assert.match(now.reason, /Page 2 of 3 was not received/)
  // All its evidence was on the missing page.
  assert.equal(
    labelOnPagesReceived(
      label("prior", "evidence_found", ["Prior therapy: metformin 500 mg"]),
      onPage,
      [2],
      {},
    ).status,
    "needs_review",
  )
  // Every page arrived: nothing changes.
  assert.deepEqual(labelOnPagesReceived(was, onPage, [], {}), was)
  // Some evidence lost and no rule given for judging what is left: refuse.
  assert.throws(() =>
    labelOnPagesReceived(
      label("dose", "needs_review", [
        "Age: 50",
        "Prior therapy: metformin 500 mg",
      ]),
      onPage,
      [2],
      {},
    ),
  )
})
