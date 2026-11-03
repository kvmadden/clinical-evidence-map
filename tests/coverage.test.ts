import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import {
  countPages,
  readCounter,
  readCoverage,
} from "../services/ocr/coverage.js"
import { joinPages } from "../services/ocr/pages.js"
import type { OcrOutput } from "../services/contracts.js"

// A page read the way OCR returns one: each word on its own line position,
// with a confidence. Lines are given as [word, confidence][] per line.
function page(
  lines: [string, number][][],
  scores: Record<string, number> = { "0": 900, "180": 40 },
): OcrOutput {
  let text = ""
  const words: OcrOutput["words"] = []
  for (const line of lines) {
    line.forEach(([word, confidence], i) => {
      if (i) text += " "
      const start = Array.from(text).length
      text += word
      words.push({
        text: word,
        confidence,
        start,
        end: start + Array.from(word).length,
        needsReview: confidence < 80,
        box: { x: 10 * i, y: 40 * words.length, width: 9, height: 20 },
      })
    })
    text += "\n"
  }
  return {
    text,
    words,
    threshold: 80,
    engine: "fixture",
    readImage: "page.png",
    width: 1700,
    height: 2200,
    orientation: { pageRotation: 0, scores },
    deskewDegrees: 0,
  }
}
const typed = (s: string) =>
  s.split(" ").map((w) => [w, 95] as [string, number])

test("page counters are read in their common fax header and footer forms", () => {
  const read = (s: string) => {
    const c = readCounter(s)
    return c && [c.page, c.of]
  }
  assert.deepEqual(read("FROM REQUESTING OFFICE FAX P.002/003"), [2, 3])
  assert.deepEqual(read("Page 2 of 3"), [2, 3])
  assert.deepEqual(read("PAGE 02 OF 03"), [2, 3])
  assert.deepEqual(read("pg 2/3"), [2, 3])
  assert.deepEqual(read("Pg. 2 of 3"), [2, 3])
  assert.deepEqual(read("2 of 3"), [2, 3])
  assert.deepEqual(read("- 2 of 3 -"), [2, 3])
  assert.deepEqual(read("Sent 10:42 from clinic fax 2 of 3"), [2, 3])
  assert.equal(readCounter("Sent 10:42 from clinic fax 2 of 3")!.text, "2 of 3")
  assert.deepEqual(
    read("Fax received: 28 Sep 2026 09:14. Page 1 of 1."),
    [1, 1],
  )
  // OCR often reads a zero as O and a one as l.
  assert.deepEqual(read("P.0O2/0O3"), [2, 3])
  assert.deepEqual(read("Page l of 3"), [1, 3])
  // Something that only looks like a counter does not hide a real one.
  assert.deepEqual(read("Sig: 1 tab p.o. daily. Fax P.002/003"), [2, 3])
  assert.deepEqual(read("Fax from clinic. P.002"), [2, null])
  assert.equal(readCounter("Sig: 1 tab p.o. daily. P.002"), null)
  assert.equal(readCounter("p.o. route, see P.002"), null)
  // A page number with no total.
  assert.deepEqual(read("P.002"), [2, null])
  assert.deepEqual(read("Page 3"), [3, null])
  // Numbers that make no sense are not counters, and neither is clinical text.
  for (const s of [
    "P.881/883",
    "Page 4 of 3",
    "Continued on page 2",
    "Took 2 of 3 doses",
    "BP 130/80",
    "Sig: 1 tab PO 2/3",
    "Prior therapies tried: atorvastatin 80 mg by mouth once daily",
    "Trial dates: 01/04/2026 to 01/08/2026",
  ])
    assert.equal(readCounter(s), null, s)
})

test("a fax with P.001/003 and P.003/003 but no page 2 reports page 2 missing", () => {
  const ocr = joinPages(
    [
      page([typed("FROM REQUESTING OFFICE FAX P.001/003"), typed("Age: 50")]),
      page([
        typed("FROM REQUESTING OFFICE FAX P.003/003"),
        typed("Most recent LDL-C: 132 mg/dL"),
      ]),
    ],
    ["a.png", "b.png"],
  )
  const coverage = readCoverage(ocr)
  assert.equal(coverage.pagesReceived, 2)
  assert.equal(coverage.pagesExpected, 3)
  assert.deepEqual(coverage.missingPages, [2])
  assert.equal(coverage.missingCount, 1)
  assert.equal(coverage.complete, false)
  assert.deepEqual(
    coverage.pages.map((p) => [
      p.counter?.page,
      p.counter?.of,
      p.counter?.line,
    ]),
    [
      [1, 3, 1],
      [3, 3, 1],
    ],
  )
  // A footer counts as well as a header.
  const footer = readCoverage(
    joinPages(
      [
        page([typed("Assessment: stable."), typed("Page 1 of 2")]),
        page([typed("Plan: continue."), typed("Page 2 of 2")]),
      ],
      ["a.png", "b.png"],
    ),
  )
  assert.equal(footer.complete, true)
  assert.deepEqual(footer.missingPages, [])
})

test("page counts catch gaps, short totals, repeats and disagreements", () => {
  const counted = (...counters: ([number, number | null] | null)[]) =>
    countPages(
      counters.map((c) => ({
        ...(c ? { counter: { text: "", line: 1, page: c[0], of: c[1] } } : {}),
        orientation: { pageRotation: 0, deskewDegrees: 0, handled: true },
      })),
    )
  const pick = (c: ReturnType<typeof counted>) => [
    c.pagesExpected,
    c.missingPages,
    c.missingCount,
    c.complete,
  ]
  assert.deepEqual(pick(counted([1, 3], [2, 3], [3, 3])), [3, [], 0, true])
  assert.deepEqual(pick(counted([1, 1])), [1, [], 0, true])
  // No counter anywhere gives nothing to check against.
  assert.deepEqual(pick(counted(null, null)), [null, [], 0, true])
  // A page without a readable counter can be the one in the gap.
  assert.deepEqual(pick(counted([1, 3], null, [3, 3])), [3, [], 0, true])
  // Two of three received, one unnumbered: one page is missing, but which is unknown.
  assert.deepEqual(pick(counted([1, 3], null)), [3, [], 1, false])
  // Page numbers without totals still show a gap.
  assert.deepEqual(pick(counted([1, null], [3, null])), [null, [2], 1, false])
  // Only page 2 arrived, so page 1 is missing.
  assert.deepEqual(pick(counted([2, null])), [null, [1], 1, false])
  const repeated = counted([1, 2], [1, 2])
  assert.deepEqual(repeated.duplicatePages, [1])
  assert.deepEqual(pick(repeated), [2, [2], 1, false])
  const clash = counted([1, 3], [2, 4])
  assert.deepEqual(clash.conflictingTotals, [3, 4])
  assert.equal(clash.complete, false)
  // A cover sheet with no counter on top of a complete count is not a gap.
  assert.deepEqual(pick(counted(null, [1, 2], [2, 2])), [2, [], 0, true])
})

test("coverage gives each page's confidence, low lines and unreadable runs", () => {
  const ocr = joinPages(
    [
      page([
        typed("PRIOR AUTHORIZATION REQUEST FORM"),
        [
          ["Age:", 96],
          ["5O", 41],
        ],
        typed("Dose and frequency: 140 mg SQ q2wk"),
      ]),
      page(
        [
          typed("MEDICATION HISTORY"),
          [
            ["qwk", 30],
            ["rnq", 22],
          ],
          [["l4O", 35]],
          typed("No other prior therapy records supplied."),
        ],
        { "0": 500, "180": 300 },
      ),
    ],
    ["a.png", "b.png"],
  )
  const coverage = readCoverage(ocr)
  const [first, second] = coverage.pages
  assert.equal(first.lines, 3)
  assert.equal(first.words, 13)
  assert.equal(first.minConfidence, 41)
  assert.deepEqual(first.lowConfidenceLines, [
    { from: 2, to: 2, start: 33, end: 40, words: 2, lowWords: 1 },
  ])
  assert.deepEqual(first.unreadableLines, [])
  assert.deepEqual(
    second.lowConfidenceLines.map((r) => [r.from, r.to, r.words, r.lowWords]),
    [[2, 3, 3, 3]],
  )
  assert.deepEqual(
    second.unreadableLines.map((r) => [r.from, r.to]),
    [[2, 3]],
  )
  // Offsets point at the lines themselves in the joined text.
  const points = Array.from(ocr.text)
  const run = second.unreadableLines[0]
  assert.equal(points.slice(run.start, run.end).join(""), "qwk rnq\nl4O")
  // The second page's turn was chosen by too small a margin to trust.
  assert.equal(first.orientation.handled, true)
  assert.equal(second.orientation.handled, false)
  assert.equal(coverage.complete, false)
})

test("every stored development and held-out page reads as complete", async () => {
  let counters = 0
  for (const dir of ["eval/artifacts", "eval/holdout/artifacts"])
    for (const f of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
      const ocr = JSON.parse(await readFile(`${dir}/${f}`, "utf8")).ocr
      const coverage = readCoverage(ocr)
      assert.equal(coverage.complete, true, f)
      assert.equal(coverage.pagesReceived, 1)
      assert.deepEqual(coverage.missingPages, [])
      if (coverage.pages[0].counter) {
        counters++
        assert.deepEqual(
          [coverage.pages[0].counter.page, coverage.pages[0].counter.of],
          [1, 1],
        )
      }
    }
  // The 16 typed fax-style headers that say "Page 1 of 1".
  assert.equal(counters, 16)
})

test("the rendered fixture with page 2 never received is read as missing page 2", async () => {
  const read = async (id: string) =>
    readCoverage(
      JSON.parse(
        await readFile(`eval/fixtures/multipage/artifacts/${id}.json`, "utf8"),
      ).ocr,
    )
  const whole = await read("multipage-01")
  assert.deepEqual(
    [whole.pagesReceived, whole.pagesExpected, whole.complete],
    [3, 3, true],
  )
  const gap = await read("multipage-02")
  assert.deepEqual(
    [gap.pagesReceived, gap.pagesExpected, gap.missingPages, gap.complete],
    [2, 3, [2], false],
  )
  assert.deepEqual(
    gap.pages.map((p) => p.counter?.text),
    ["P.001/003", "P.003/003"],
  )
})

test("clinical and cross-reference text never reads as a page counter", () => {
  for (const s of [
    "page 2 of 3 criteria",
    "Meets page 2 of 3 criteria",
    "See page 2 of 3 criteria",
    "Continued on page 2 of 3",
    "Consent obtained. 2 of 3.",
    "Updated p. 2/11",
    "Updated P. 2/11",
    "Recheck at 10:30. Meets 2 of 3.",
    "Fax request: failed 2 of 3",
    "Results from outside lab, page 2 of 3 reviewed",
    "Consented 10:30 2 of 3",
  ])
    assert.equal(readCounter(s), null, s)
  // A real counter on the same line as a false one is still read.
  assert.deepEqual(readCounter("Meets page 2 of 3 criteria. P.001/003"), {
    text: "P.001/003",
    page: 1,
    of: 3,
  })
  // Footers and fax headers still count.
  assert.deepEqual(readCounter("Confidential. Page 2 of 3")?.page, 2)
  assert.deepEqual(
    readCounter("10/01/2026 09:14 FROM CLINIC P.001/003 FAX")?.of,
    3,
  )
})

test("counters that agree across pages win, and pages out of order are not complete", () => {
  const pages = (heads: string[][]) =>
    readCoverage(
      joinPages(
        heads.map((lines) => page(lines.map(typed))),
        heads.map((_, i) => `${i}.png`),
      ),
    )
  // Page 2 and 3 also carry the document's own footer counter, read first.
  const mixed = pages([
    ["FAX FROM CLINIC P.001/003", "Cover sheet"],
    ["Page 1 of 2", "Assessment: stable.", "FAX FROM CLINIC P.002/003"],
    ["Page 2 of 2", "Plan: continue.", "FAX FROM CLINIC P.003/003"],
  ])
  assert.deepEqual(
    mixed.pages.map((p) => p.counter?.text),
    ["P.001/003", "P.002/003", "P.003/003"],
  )
  assert.equal(mixed.complete, true)
  const shuffled = pages([
    ["FAX P.003/003", "Plan."],
    ["FAX P.001/003", "Request."],
    ["FAX P.002/003", "Notes."],
  ])
  assert.deepEqual(
    [shuffled.outOfOrder, shuffled.complete, shuffled.missingPages],
    [true, false, []],
  )
})

test("disagreeing totals never name missing pages from the larger total", () => {
  const counted = (...counters: [number, number | null][]) =>
    countPages(
      counters.map(([page, of]) => ({
        counter: { text: "", line: 1, page, of },
        orientation: { pageRotation: 0, deskewDegrees: 0, handled: true },
      })),
    )
  const clash = counted([1, 2], [1, 9])
  assert.deepEqual(
    [
      clash.pagesExpected,
      clash.missingPages,
      clash.conflictingTotals,
      clash.complete,
    ],
    [null, [], [2, 9], false],
  )
  // A gap between numbers that were read is missing whatever the total.
  const gap = counted([1, 4], [3, 5])
  assert.deepEqual([gap.missingPages, gap.complete], [[2], false])
})
