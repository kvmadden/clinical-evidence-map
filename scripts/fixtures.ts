// Builds the multi-page fixture from development packet-018, which stays
// unchanged. Synthetic only: the same fictional names, dates and labels,
// with the sections moved onto three fax pages, each stamped with a
// fax-machine page counter. multipage-02 is the same fax with page 2 never
// received. It is a test fixture, not part of either evaluation set.
// Usage: npx tsx scripts/fixtures.ts
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { loadManifest, sourceBody } from "../services/pipeline.js"
import { PAGE_BREAK } from "../services/ocr/pages.js"

export const FIXTURE_DIR = "eval/fixtures/multipage"
const FROM = "packet-018"
const header = (page: number) =>
  `FROM REQUESTING OFFICE FAX P.${String(page).padStart(3, "0")}/003`

interface Span {
  start: number
  end: number
  text: string
}
// Finds each quoted line again in the new body. Every quote in packet-018's
// labels is one whole line, and each appears once.
function relocate(body: string, span: Span): Span {
  const lines = body.split("\n")
  const index = lines.indexOf(span.text)
  if (index < 0 || lines.lastIndexOf(span.text) !== index)
    throw new Error(`Quote is not one unique line: ${span.text}`)
  const start =
    Array.from(lines.slice(0, index).join("\n")).length + (index ? 1 : 0)
  return { start, end: start + Array.from(span.text).length, text: span.text }
}

interface Label {
  criterion_id: string
  status: string
  evidence_spans: Span[]
  reason: string
  scenario: string
}
// Labels for a packet some of whose pages never arrived, under Kevin's rule of
// 3 November 2026: "not documented" may only be answered once the whole
// packet was read. A criterion with nothing on the pages received needs
// review, whatever it was labeled before. A criterion that kept some of its
// evidence is judged again on what arrived, and that judgment must be given.
export function labelOnPagesReceived<L extends Label>(
  label: L,
  onPage: (text: string) => boolean,
  lost: number[],
  judgedAgain: Record<string, Partial<Label>>,
): L {
  if (!lost.length) return label
  const spans = label.evidence_spans.filter((s) => onPage(s.text))
  const pages = `${lost.length > 1 ? "Pages" : "Page"} ${lost.join(" and ")} of 3 ${lost.length > 1 ? "were" : "was"} not received`
  if (!spans.length)
    return {
      ...label,
      status: "needs_review",
      evidence_spans: [],
      reason: `${pages}, and nothing on the pages that were documents this criterion. It may be on the missing page.`,
      scenario: "page-not-received",
    }
  if (spans.length === label.evidence_spans.length) return label
  const judged = judgedAgain[label.criterion_id]
  if (!judged)
    throw new Error(
      `${label.criterion_id} lost evidence with a missing page and has no new judgment`,
    )
  return { ...label, ...judged, evidence_spans: spans }
}
// packet-018's two criteria that keep some evidence when page 2 is missing.
const JUDGED_AGAIN: Record<string, Partial<Label>> = {
  // Kevin's open decision: with a page missing, does a found answer stay
  // found, with the packet marked incomplete, or go to review? Until he
  // decides, it stays found on what arrived.
  dose: {
    status: "evidence_found",
    scenario: "supported",
    reason:
      "The requested dose matches the fictional rule on the pages received. The medication list that disagreed with it was on page 2, which was not received. Whether a found answer stands while a page is missing is Kevin's open decision.",
  },
  lab: {
    reason:
      "Numeric dates on the pages received can be read month first or day first, and the two readings give different results. Nothing on those pages settles the order.",
  },
}

export async function buildFixtures(dir = FIXTURE_DIR) {
  const source = sourceBody(await readFile(`eval/packets/${FROM}.md`, "utf8"))
  const gold = JSON.parse(await readFile(`eval/gold/${FROM}.json`, "utf8"))
  const manifest = await loadManifest()
  const entry = manifest.packets.find((p) => p.packet_id === FROM)!
  const lines = source.replace(/\n$/, "").split("\n")
  const section = (title: string) => {
    const start = lines.indexOf(title)
    const end = lines.indexOf("", start)
    return lines.slice(start, end < 0 ? undefined : end)
  }
  const form = lines.slice(0, lines.indexOf(""))
  const pages = [
    [header(1), ...form],
    [header(2), ...section("MEDICATION HISTORY")],
    [
      header(3),
      ...section("CLINICAL NOTES"),
      "",
      ...section("LABS AND MEASUREMENTS"),
    ],
  ]
  const packets = [
    { id: "multipage-01", received: [1, 2, 3] },
    { id: "multipage-02", received: [1, 3] },
  ]
  await mkdir(`${dir}/packets`, { recursive: true })
  await mkdir(`${dir}/gold`, { recursive: true })
  const entries = []
  for (const { id, received } of packets) {
    const body =
      received.map((n) => pages[n - 1].join("\n")).join(`\n${PAGE_BREAK}\n`) +
      "\n"
    const lost = [1, 2, 3].filter((n) => !received.includes(n))
    const onPage = (text: string) => body.split("\n").includes(text)
    const criteria = gold.criterion_evidence.map((c: Label) => {
      const label = labelOnPagesReceived(c, onPage, lost, JUDGED_AGAIN)
      return {
        ...label,
        evidence_spans: label.evidence_spans.map((s) => relocate(body, s)),
      }
    })
    const entities = gold.entities
      .filter((e: { source_span: Span }) => onPage(e.source_span.text))
      .map((e: { source_span: Span }) => ({
        ...e,
        source_span: relocate(body, e.source_span),
      }))
    const tags = [
      ...entry.tags,
      `pages:${received.length}`,
      ...(lost.length ? ["page-not-received"] : []),
    ]
    const front = [
      "---",
      `packet_id: ${id}`,
      "fictional: true",
      `criteria_id: ${entry.criteria_id}`,
      `group: ${entry.group}`,
      "set: multi-page fixture",
      `built_from: ${FROM}`,
      `pages_received: ${received.join(", ")} of 3`,
      "names: all_fictional",
      "identifiers: none",
      "---",
      "",
      "<!-- SOURCE START -->",
      "",
    ].join("\n")
    await writeFile(`${dir}/packets/${id}.md`, front + body)
    await writeFile(
      `${dir}/gold/${id}.json`,
      JSON.stringify(
        {
          ...gold,
          packet_id: id,
          source_file: `${dir}/packets/${id}.md`,
          built_from: `eval/packets/${FROM}.md`,
          pages: { received, of: 3 },
          tags,
          entities,
          criterion_evidence: criteria,
        },
        null,
        2,
      ) + "\n",
    )
    entries.push({ ...entry, packet_id: id, tags })
  }
  await writeFile(
    `${dir}/manifest.json`,
    JSON.stringify(
      {
        fictional: true,
        reviewed: false,
        set: "multi-page fixture",
        built_from: `eval/packets/${FROM}.md by scripts/fixtures.ts`,
        description:
          "Packet-018 sent as three fax pages, and the same fax with page 2 never received. Test fixtures, not part of either evaluation set.",
        packet_count: entries.length,
        groups: manifest.groups.filter((g) => g.id === entry.group),
        packets: entries,
      },
      null,
      2,
    ) + "\n",
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildFixtures()
  console.log(`Wrote the multi-page fixture to ${FIXTURE_DIR}`)
}
