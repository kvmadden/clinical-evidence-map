// Compares the frozen held-out labels, which Codex wrote from eval/holdout/SPEC.md, with blind
// relabels by three other model families. Each was given only the spec's criteria, statuses and
// rubric plus the 24 packet texts (eval/holdout/crosscheck/prompt.md), never the frozen labels.
// It reads saved files only and changes nothing.
// Usage: node scripts/crosscheck.mjs
import { readFile, readdir } from "node:fs/promises"

const DIR = "eval/holdout"
export const RELABELERS = ["claude-opus-5.5", "gemini-4-argon", "grok-4.7"]
const CRITERIA = ["adult", "diagnosis", "lab", "prior", "dose"]

export async function crosscheck() {
  const frozen = new Map()
  for (const file of (await readdir(`${DIR}/gold`)).sort()) {
    const gold = JSON.parse(await readFile(`${DIR}/gold/${file}`, "utf8"))
    frozen.set(gold.packet_id, Object.fromEntries(gold.criterion_evidence.map((c) => [c.criterion_id, c.status])))
  }
  const relabels = {}
  for (const name of RELABELERS) {
    const lines = (await readFile(`${DIR}/crosscheck/${name}.jsonl`, "utf8")).trim().split("\n")
    relabels[name] = new Map(lines.map((line) => {
      const row = JSON.parse(line)
      return [row.packet_id, row.labels]
    }))
  }
  const agree = Object.fromEntries(RELABELERS.map((name) => [name, 0]))
  const disputes = []
  let labels = 0
  for (const [packet, statuses] of frozen) {
    for (const criterion of CRITERIA) {
      labels++
      const frozenStatus = statuses[criterion]
      const theirs = Object.fromEntries(RELABELERS.map((name) => [name, relabels[name].get(packet)?.[criterion]?.status]))
      for (const name of RELABELERS) if (theirs[name] === frozenStatus) agree[name]++
      if (RELABELERS.some((name) => theirs[name] !== frozenStatus)) disputes.push({ packet, criterion, frozen: frozenStatus, relabels: theirs })
    }
  }
  return { packets: frozen.size, labels, agree, unanimous: labels - disputes.length, disputes }
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(await crosscheck(), null, 2))
