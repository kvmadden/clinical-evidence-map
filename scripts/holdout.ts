// Freezes the held-out set written by a different model from eval/holdout/SPEC.md.
// It validates the authored JSON, writes packets, draft gold and a manifest,
// and records one sha256 for the whole set. It never runs the pipeline.
// Usage: npx tsx scripts/holdout.ts freeze <authored.json>
//        npx tsx scripts/holdout.ts verify
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises"

// HOLDOUT_DIR, HOLDOUT_PREFIX and HOLDOUT_AUTHORS select a later set, such as eval/holdout-v2.
// The defaults are the first held-out set, so its freeze and verify behave exactly as before.
const DIR = process.env.HOLDOUT_DIR ?? "eval/holdout"
const PREFIX = process.env.HOLDOUT_PREFIX ?? "holdout"
const AUTHORS =
  process.env.HOLDOUT_AUTHORS ??
  "Codex (gpt-6.1-sol), codex exec -s read-only, from SPEC.md only"
const RENDER: Record<
  string,
  { group: string; effects: string[]; rotate: number }
> = {
  clean: { group: "clean-render", effects: ["speckle-light"], rotate: 0 },
  "fax-noise": {
    group: "fax-noise",
    effects: ["speckle-heavy", "streaks"],
    rotate: 0,
  },
  choppy: {
    group: "choppy-lines",
    effects: ["speckle-heavy", "streaks", "choppy"],
    rotate: 0,
  },
  smudge: { group: "smudge", effects: ["speckle-light", "smudge"], rotate: 0 },
  "low-contrast": {
    group: "low-contrast",
    effects: ["speckle-light", "low-contrast"],
    rotate: 0,
  },
  "rotate-7": {
    group: "rotation-7deg",
    effects: ["speckle-heavy", "streaks"],
    rotate: 7,
  },
  "turn-180": {
    group: "orientation",
    effects: ["speckle-heavy", "streaks"],
    rotate: 180,
  },
  "turn-90": {
    group: "orientation",
    effects: ["speckle-heavy", "streaks"],
    rotate: 90,
  },
  "turn-270": {
    group: "orientation",
    effects: ["speckle-heavy", "streaks"],
    rotate: 270,
  },
  annotations: {
    group: "annotations",
    effects: ["speckle-heavy", "streaks"],
    rotate: 0,
  },
}
const GROUPS = [
  { id: "clean-render", label: "Clean render" },
  { id: "fax-noise", label: "Simulated fax noise" },
  { id: "choppy-lines", label: "Simulated choppy scan lines" },
  { id: "smudge", label: "Simulated smudges" },
  { id: "low-contrast", label: "Simulated low contrast" },
  { id: "rotation-7deg", label: "Simulated 7-degree rotation" },
  { id: "orientation", label: "Simulated page orientation" },
  {
    id: "annotations",
    label: "Drawn circles, arrows and underlines, no handwriting",
  },
]
const FONTS = ["roboto-mono", "liberation-sans", "dejavu-sans"] as const
const OFFSET_BASIS =
  "Unicode code points, zero-based, end-exclusive, in body after <!-- SOURCE START --> followed by newline. Front matter and delimiter excluded."
const CRITERIA = ["adult", "diagnosis", "lab", "prior", "dose"]

interface Authored {
  packet_id: string
  criteria_id: string
  render: string
  text: string
  variation_notes: string
  authored_by?: string
  labels: {
    criterion_id: string
    status: string
    evidence_lines: string[]
    reason: string
  }[]
}

export async function setHash(dir = DIR) {
  const hash = createHash("sha256")
  for (const sub of ["packets", "gold"])
    for (const f of (await readdir(`${dir}/${sub}`)).sort())
      hash.update(`${sub}/${f}\n`).update(await readFile(`${dir}/${sub}/${f}`))
  hash.update("manifest.json\n").update(await readFile(`${dir}/manifest.json`))
  return hash.digest("hex")
}

async function freeze(path: string) {
  const authored = JSON.parse(await readFile(path, "utf8"))
    .packets as Authored[]
  const problems: string[] = []
  if (authored.length < 20 || authored.length > 30)
    problems.push(`expected 20 to 30 packets, got ${authored.length}`)
  await mkdir(`${DIR}/packets`, { recursive: true })
  await mkdir(`${DIR}/gold`, { recursive: true })
  const manifest = []
  for (const [index, p] of authored.entries()) {
    const id = p.packet_id
    if (!new RegExp(`^${PREFIX}-\\d\\d$`).test(id))
      problems.push(`${id}: bad packet id`)
    const body = p.text.replace(/\r\n/g, "\n").replace(/\n*$/, "\n")
    const lines = body.split("\n").slice(0, -1)
    const starts: number[] = []
    let at = 0
    for (const l of lines) {
      starts.push(at)
      at += Array.from(l).length + 1
    }
    const render = RENDER[p.render]
    if (!render) problems.push(`${id}: unknown render ${p.render}`)
    const ids = p.labels.map((l) => l.criterion_id).sort()
    if (JSON.stringify(ids) !== JSON.stringify([...CRITERIA].sort()))
      problems.push(`${id}: labels must cover the five criteria once`)
    const criterion_evidence = CRITERIA.map((cid) => {
      const label = p.labels.find((l) => l.criterion_id === cid)!
      const spans = (label?.evidence_lines ?? []).map((quote) => {
        const i = lines.indexOf(quote)
        if (i < 0)
          problems.push(
            `${id} ${cid}: evidence line not found exactly: ${quote}`,
          )
        return {
          start: starts[i],
          end: starts[i] + Array.from(quote).length,
          text: quote,
        }
      })
      if (label?.status === "missing" && spans.length)
        problems.push(`${id} ${cid}: missing with evidence lines`)
      if (label && label.status !== "missing" && !spans.length)
        problems.push(`${id} ${cid}: ${label.status} without evidence lines`)
      return {
        criterion_id: cid,
        status: label?.status,
        evidence_spans: spans,
        reason: label?.reason,
        scenario: "held-out",
        reviewed: false,
      }
    })
    const annotations =
      p.render === "annotations"
        ? lines
            .map((l, i) => ({ l, i }))
            .filter(({ l }) => /\d/.test(l))
            .filter(
              (_, k, all) =>
                k === 0 ||
                k === Math.floor(all.length / 2) ||
                k === all.length - 1,
            )
            .map(({ l, i }, k) =>
              k === 0
                ? {
                    kind: "circle",
                    line: i,
                    from: Math.max(0, l.search(/\d/) - 1),
                    to: Math.min(l.length, l.search(/\d/) + 9),
                  }
                : {
                    kind: k === 1 ? "arrow" : "underline",
                    line: i,
                    from: 0,
                    to: l.length,
                  },
            )
        : []
    const gold = {
      schema_version: "2.0",
      packet_id: id,
      fictional: true,
      reviewed: false,
      criteria_id: p.criteria_id,
      source_file: `${DIR}/packets/${id}.md`,
      group: render?.group,
      authored_by:
        p.authored_by ?? "Codex (gpt-6.1-sol) from eval/holdout/SPEC.md only",
      variation_notes: p.variation_notes,
      offset_basis: OFFSET_BASIS,
      entities: [],
      criterion_evidence,
      normalization: {
        status: "not_attempted",
        reason:
          "Held-out labels cover criterion statuses and quoted lines only.",
        reviewed: false,
      },
    }
    const front = [
      "---",
      `packet_id: ${id}`,
      "fictional: true",
      `criteria_id: ${p.criteria_id}`,
      `group: ${render?.group}`,
      "set: held-out",
      "names: all_fictional",
      "identifiers: none",
      "---",
      "",
      "<!-- SOURCE START -->",
      "",
    ].join("\n")
    await writeFile(`${DIR}/packets/${id}.md`, front + body)
    await writeFile(
      `${DIR}/gold/${id}.json`,
      JSON.stringify(gold, null, 2) + "\n",
    )
    manifest.push({
      packet_id: id,
      criteria_id: p.criteria_id,
      group: render?.group,
      tags: [`render:${p.render}`],
      render: {
        font: FONTS[index % 3],
        effects: render?.effects ?? [],
        rotate: render?.rotate ?? 0,
        handwriting: [],
        annotations,
      },
    })
  }
  if (problems.length)
    throw new Error(`Held-out set not frozen:\n${problems.join("\n")}`)
  await writeFile(
    `${DIR}/manifest.json`,
    JSON.stringify(
      {
        fictional: true,
        reviewed: false,
        set: "held-out",
        packet_count: manifest.length,
        groups: GROUPS,
        packets: manifest,
      },
      null,
      2,
    ) + "\n",
  )
  const sha256 = await setHash()
  await writeFile(
    `${DIR}/FREEZE.json`,
    JSON.stringify(
      {
        sha256,
        packets: manifest.length,
        covers: "packets/*, gold/*, manifest.json in sorted order",
        authored_by: AUTHORS,
      },
      null,
      2,
    ) + "\n",
  )
  console.log(`Froze ${manifest.length} held-out packets, sha256 ${sha256}`)
}

const [command, arg] = process.argv.slice(2)
if (import.meta.url === `file://${process.argv[1]}`) {
  if (command === "freeze") await freeze(arg)
  else if (command === "verify") {
    const frozen = JSON.parse(await readFile(`${DIR}/FREEZE.json`, "utf8"))
    const now = await setHash()
    if (now !== frozen.sha256)
      throw new Error(
        `Held-out set changed since it was frozen: ${now} is not ${frozen.sha256}`,
      )
    console.log(`Held-out set matches its frozen sha256 ${now}`)
  } else
    throw new Error(
      "Usage: npx tsx scripts/holdout.ts freeze <authored.json> | verify",
    )
}
