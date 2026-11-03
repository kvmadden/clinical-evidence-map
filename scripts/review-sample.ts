// Writes a label review sample in the review page's data.json format, plus
// page images. Usage: npx tsx scripts/review-sample.ts <output-dir>
// The draft status stays in each criterion so the page can hide it and show
// it after the reviewer answers. Kevin's earlier labels are marked.
import { mkdir, readFile, writeFile, access } from "node:fs/promises"
import { join } from "node:path"
import sharp from "sharp"
import { loadManifest, sourceBody } from "../services/pipeline.js"

const out = process.argv[2]
if (!out)
  throw new Error("Usage: npx tsx scripts/review-sample.ts <output-dir>")
const manifest = await loadManifest()
const criteriaFiles = Object.fromEntries(
  await Promise.all(
    ["glp1-t2d", "biologic-psoriasis", "pcsk9"].map(async (id) => [
      id,
      JSON.parse(await readFile(`eval/criteria/${id}.json`, "utf8")),
    ]),
  ),
)
const firstTwo = manifest.groups.flatMap((g) =>
  manifest.packets
    .filter((p) => p.group === g.id)
    .slice(0, 2)
    .map((p) => p.packet_id),
)
const drawn = manifest.packets
  .filter((p) => p.tags.includes("ai-drawn-handwriting"))
  .map((p) => p.packet_id)
const ids = manifest.packets
  .map((p) => p.packet_id)
  .filter((id) => firstTwo.includes(id) || drawn.includes(id))
await mkdir(join(out, "fax"), { recursive: true })
const packets = []
const carried: string[] = [],
  rereview: string[] = []
for (const id of ids) {
  const entry = manifest.packets.find((p) => p.packet_id === id)!
  const body = sourceBody(await readFile(`eval/packets/${id}.md`, "utf8"))
  const gold = JSON.parse(await readFile(`eval/gold/${id}.json`, "utf8"))
  const policy = criteriaFiles[entry.criteria_id]
  const group = manifest.groups.find((g) => g.id === entry.group)!
  packets.push({
    id,
    group: group.label,
    group_id: entry.group,
    set: policy.title,
    tags: entry.tags,
    source: body,
    criteria: gold.criterion_evidence.map(
      (c: {
        criterion_id: string
        status: string
        evidence_spans: { start: number; end: number }[]
        reason: string
        scenario: string
        review?: {
          status: string
          note?: string
          carried_over: boolean
          basis: string
        }
      }) => {
        const state = !c.review
          ? "new"
          : c.review.carried_over
            ? "carried_over"
            : "rereview"
        if (state === "carried_over") carried.push(`${id}:${c.criterion_id}`)
        if (state === "rereview") rereview.push(`${id}:${c.criterion_id}`)
        return {
          id: c.criterion_id,
          rule: policy.criteria.find(
            (r: { id: string }) => r.id === c.criterion_id,
          ).text,
          status: c.status,
          spans: c.evidence_spans.map((s) => [s.start, s.end]),
          reason: c.reason,
          scenario: c.scenario,
          review_state: state,
          ...(c.review
            ? {
                kevin: {
                  status: c.review.status,
                  ...(c.review.note ? { note: c.review.note } : {}),
                  basis: c.review.basis,
                },
              }
            : {}),
        }
      },
    ),
    entities: gold.entities.map(
      (e: {
        type: string
        value: unknown
        source_span: { start: number; end: number }
        handwritten?: boolean
        misspelling?: unknown
        reviewed?: boolean
      }) => ({
        type: e.type,
        value: e.value,
        span: [e.source_span.start, e.source_span.end],
        ...(e.handwritten ? { handwritten: true } : {}),
        ...(e.misspelling ? { misspelling: e.misspelling } : {}),
        ...(e.reviewed ? { kevin_reviewed: true } : {}),
      }),
    ),
  })
  // Show the page as OCR read it: turned the right way up and straightened.
  const artifact = JSON.parse(
    await readFile(`eval/artifacts/${id}.json`, "utf8"),
  )
  const read = `eval/artifacts/${artifact.ocr.readImage ?? `${id}.png`}`
  await access(read)
  await sharp(read)
    .resize({ width: 1100 })
    .webp({ quality: 80 })
    .toFile(join(out, "fax", `${id}.webp`))
}
const data = {
  sample:
    "The first two packets in each of the nine groups, plus every packet with AI-drawn handwriting. Draft statuses are included so the page can hide them until you answer.",
  generated_from:
    "clinical-evidence-map-dev, branch claude/stage-c-honest-eval",
  carried_over: carried,
  rereview,
  packets,
}
await writeFile(join(out, "data.json"), JSON.stringify(data))
console.log(
  `${packets.length} packets, ${packets.length * 5} criterion labels, ${carried.length} carried over, ${rereview.length} to re-review`,
)
