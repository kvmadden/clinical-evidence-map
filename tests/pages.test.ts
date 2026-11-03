import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import {
  PAGE_BREAK,
  checkPlan,
  joinPages,
  pagesOf,
  planForPage,
  readingText,
  splitPages,
} from "../services/ocr/pages.js"
import { renderPacket } from "../services/ocr/packet.js"
import { loadManifest, sourceBody } from "../services/pipeline.js"
import type { OcrOutput } from "../services/contracts.js"

const plan = { effects: [], rotate: 0, handwriting: [], annotations: [] }

test("text without a page marker is one page, returned unchanged", async () => {
  for (const root of ["eval", "eval/holdout"]) {
    const manifest = await loadManifest(`${root}/manifest.json`)
    for (const entry of manifest.packets) {
      const body = sourceBody(
        await readFile(`${root}/packets/${entry.packet_id}.md`, "utf8"),
      )
      const pages = splitPages(body)
      assert.equal(pages.length, 1)
      assert.equal(pages[0].text, body)
      assert.equal(readingText(body), body)
    }
  }
})

test("page markers split pages, are never kept, and plans move onto their page", () => {
  const text = `A\nB\n${PAGE_BREAK}\nC\nD\n${PAGE_BREAK}\nE\n`
  assert.deepEqual(splitPages(text), [
    { text: "A\nB\n", first: 0, lines: 2 },
    { text: "C\nD\n", first: 3, lines: 2 },
    { text: "E\n", first: 6, lines: 2 },
  ])
  assert.equal(readingText(text), "A\nB\nC\nD\nE\n")
  // Markers side by side give an empty page, never marker text.
  assert.deepEqual(
    splitPages(`${PAGE_BREAK}\nA\n${PAGE_BREAK}\n${PAGE_BREAK}\nB`).map(
      (p) => p.text,
    ),
    ["A\n", "", "B"],
  )
  assert.equal(readingText(`A\n${PAGE_BREAK}\n`), "A\n")
  // A line that only contains the marker among other words is ordinary text.
  assert.equal(splitPages(`see ${PAGE_BREAK} here\n`).length, 1)
  const pages = splitPages(text)
  const marked = {
    ...plan,
    handwriting: [
      { line: 4, image: "x", kind: "fill", box: [0, 0, 1, 1], lines: 1 },
    ],
    annotations: [{ kind: "circle", line: 6 }],
  }
  checkPlan(marked, pages)
  assert.deepEqual(planForPage(marked, pages[1]).handwriting[0].line, 1)
  assert.deepEqual(planForPage(marked, pages[2]).annotations, [
    { kind: "circle", line: 0 },
  ])
  assert.deepEqual(planForPage(marked, pages[0]).annotations, [])
  assert.throws(
    () =>
      checkPlan({ ...plan, annotations: [{ kind: "arrow", line: 2 }] }, pages),
    /not on a page/,
  )
  assert.throws(
    () =>
      checkPlan(
        {
          ...plan,
          handwriting: [
            { line: 3, image: "x", kind: "block", box: [0, 0, 1, 1], lines: 3 },
          ],
        },
        pages,
      ),
    /crosses a page break/,
  )
})

test("joined page reads keep every word's page and quote", () => {
  const read = (text: string, words: [string, number][]): OcrOutput => {
    let at = 0
    return {
      text,
      threshold: 80,
      engine: "fixture",
      readImage: "p.png",
      width: 100,
      height: 200,
      orientation: { pageRotation: 0, scores: { "0": 9, "180": 1 } },
      deskewDegrees: 0,
      words: words.map(([w, confidence]) => {
        const start = Array.from(text).indexOf(w[0], at)
        at = start + Array.from(w).length
        return {
          text: w,
          confidence,
          start,
          end: at,
          needsReview: confidence < 80,
          box: { x: 1, y: 2, width: 3, height: 4 },
        }
      }),
    }
  }
  const joined = joinPages(
    [
      read("Age: 50\n", [
        ["Age:", 96],
        ["50", 91],
      ]),
      read("Café dose\nLDL-C 132\n", [
        ["Café", 70],
        ["dose", 95],
        ["LDL-C", 93],
        ["132", 40],
      ]),
    ],
    ["a.png", "b.png"],
  )
  const points = Array.from(joined.text)
  assert.equal(joined.text, "Age: 50\nCafé dose\nLDL-C 132\n")
  for (const w of joined.words)
    assert.equal(points.slice(w.start, w.end).join(""), w.text)
  assert.deepEqual(
    joined.words.map((w) => w.page),
    [0, 0, 1, 1, 1, 1],
  )
  assert.deepEqual(
    joined.pages!.map((p) => [p.image, p.start, p.end]),
    [
      ["a.png", 0, 8],
      ["b.png", 8, 28],
    ],
  )
  assert.equal(joined.readImage, undefined)
  assert.equal(pagesOf(joined).length, 2)
  // A one-page read is its own single page.
  const single = read("Age: 50\n", [["Age:", 96]])
  assert.deepEqual(pagesOf(single)[0].start, 0)
  assert.deepEqual(pagesOf(single)[0].end, 8)
})

test("one-page packets render the same pixels as their checked-in pages", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clinical-pages-"))
  try {
    const manifest = await loadManifest()
    // Plain noise, a drawn handwriting block and a 90-degree turn.
    for (const id of ["packet-018", "packet-014", "packet-053"]) {
      const entry = manifest.packets.find((p) => p.packet_id === id)!
      const body = sourceBody(await readFile(`eval/packets/${id}.md`, "utf8"))
      const out = await renderPacket({
        text: body,
        packetId: id,
        plan: entry.render,
        outputDir: dir,
      })
      assert.equal(out.pages.length, 1)
      const [now, then] = await Promise.all(
        [out.pages[0].image, `eval/artifacts/${id}.png`].map((f) =>
          sharp(f).raw().toBuffer(),
        ),
      )
      assert.ok(now.equals(then), id)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("a packet of three pages renders three same-size pages into one steady PDF", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clinical-pages-"))
  try {
    const manifest = await loadManifest("eval/fixtures/multipage/manifest.json")
    const entry = manifest.packets[0]
    const body = sourceBody(
      await readFile(
        `eval/fixtures/multipage/packets/${entry.packet_id}.md`,
        "utf8",
      ),
    )
    const first = await renderPacket({
      text: body,
      packetId: entry.packet_id,
      plan: entry.render,
      outputDir: dir,
    })
    const pdf = await readFile(first.pdf)
    assert.equal(first.pages.length, 3)
    assert.ok(first.pages.every((p) => p.width === 1700 && p.height === 2200))
    assert.equal(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length, 3)
    // Only the packet PDF is left, never one per page.
    assert.deepEqual(
      (await readdir(dir)).filter((f) => f.endsWith(".pdf")),
      [`${entry.packet_id}.pdf`],
    )
    // A rebuild writes the same bytes as the checked-in pages and PDF.
    const saved = `eval/fixtures/multipage/artifacts`
    assert.ok(pdf.equals(await readFile(`${saved}/${entry.packet_id}.pdf`)))
    for (const page of first.pages)
      assert.ok(
        (await readFile(page.image)).equals(
          await readFile(`${saved}/${page.image.split("/").at(-1)}`),
        ),
      )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("each page draws its own seeded noise with the same plan and size", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clinical-pages-"))
  try {
    const page = "Age: 50\nDose and frequency: 140 mg SQ q2wk\n"
    const noisy = { ...plan, effects: ["speckle-heavy", "streaks"] }
    const out = await renderPacket({
      text: `${page}${PAGE_BREAK}\n${page}`,
      packetId: "seeded",
      plan: noisy,
      outputDir: dir,
    })
    const [a, b] = await Promise.all(
      out.pages.map((p) => sharp(p.image).raw().toBuffer()),
    )
    assert.equal(a.length, b.length)
    assert.ok(!a.equals(b))
    // Page 1 is drawn exactly as the same text would be on its own.
    const alone = await renderPacket({
      text: page,
      packetId: "seeded",
      plan: noisy,
      outputDir: join(dir, "alone"),
    })
    assert.ok(a.equals(await sharp(alone.pages[0].image).raw().toBuffer()))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("the care-management summary reads a packet of several pages without its markers", async () => {
  const run = (file: string) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        ["--import", "tsx", "scripts/summary.ts", file],
        { encoding: "utf8" },
      ),
    )
  const pages = run("eval/fixtures/multipage/packets/multipage-01.md")
  const single = run("eval/packets/packet-018.md")
  assert.ok(pages.entities.length > 0)
  for (const e of pages.entities)
    assert.ok(!e.source_span.text.includes(PAGE_BREAK))
  // The same facts come out of the three pages as out of the one page.
  const facts = (r: { entities: { type: string; value: unknown }[] }) =>
    r.entities.map((e) => JSON.stringify([e.type, e.value])).sort()
  assert.deepEqual(facts(pages), facts(single))
})

test("a marker on the first or last line starts no blank page, one between pages does", () => {
  assert.deepEqual(
    splitPages(`Alpha\n${PAGE_BREAK}\n`).map((p) => p.text),
    ["Alpha\n"],
  )
  assert.deepEqual(
    splitPages(`${PAGE_BREAK}\nA\n${PAGE_BREAK}\nB\n${PAGE_BREAK}\n`).map(
      (p) => [p.text, p.first],
    ),
    [
      ["A\n", 1],
      ["B\n", 3],
    ],
  )
  // Two markers in a row still mean a deliberately blank page between them.
  assert.deepEqual(
    splitPages(`A\n${PAGE_BREAK}\n${PAGE_BREAK}\nB\n`).map((p) => p.text),
    ["A\n", "", "B\n"],
  )
})

test("page reads always join on a line boundary, with offsets that count it", () => {
  const read = (text: string, word: string): OcrOutput => {
    const start = Array.from(text).indexOf(word[0])
    return {
      text,
      threshold: 80,
      engine: "fixture",
      words: [
        {
          text: word,
          confidence: 95,
          start,
          end: start + Array.from(word).length,
          needsReview: false,
          box: { x: 1, y: 2, width: 3, height: 4 },
        },
      ],
    }
  }
  // A reader that drops the final line break must not fuse two pages' lines.
  const joined = joinPages(
    [read("Age: 50", "50"), read("LDL-C 132", "132"), read("", "")].slice(0, 2),
    ["a.png", "b.png"],
  )
  assert.equal(joined.text, "Age: 50\nLDL-C 132\n")
  assert.deepEqual(
    joined.pages!.map((p) => [p.start, p.end]),
    [
      [0, 8],
      [8, 18],
    ],
  )
  const points = Array.from(joined.text)
  for (const w of joined.words)
    assert.equal(points.slice(w.start, w.end).join(""), w.text)
  // An empty page still takes a line of its own.
  const blank = joinPages(
    [read("Age: 50\n", "50"), { ...read("", ""), words: [] }],
    ["a.png", "b.png"],
  )
  assert.equal(blank.text, "Age: 50\n\n")
  assert.deepEqual(blank.pages![1], { ...blank.pages![1], start: 8, end: 9 })
})
