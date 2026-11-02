import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"
import { createOcr, renderFax } from "../services/ocr/index.js"
import { loadManifest, processText, sourceBody } from "../services/pipeline.js"
import { verify } from "../services/verify/index.js"
import { DRAFT } from "../services/contracts.js"
import {
  distance,
  normalizedText,
  scoreEntities,
  scoreCriteria,
  f1,
} from "./metrics.js"
const check = process.argv.includes("--check"),
  rebuild = process.argv.includes("--rebuild")
const manifest = await loadManifest()
const artifactDir = "eval/artifacts"
await mkdir(artifactDir, { recursive: true })
await mkdir("eval/results", { recursive: true })
const renderer = await readFile("services/ocr/index.ts", "utf8")
let worker: Awaited<ReturnType<typeof createOcr>> | undefined
const packets: {
  quality_group: string
  scores: {
    entities: ReturnType<typeof scoreEntities>
    criteria: ReturnType<typeof scoreCriteria>
    edits: number
    chars: number
  }
  latency: { renderAndOcrMs: number; serviceMs: number }
}[] = []
const totals = {
  tp: 0,
  predicted: 0,
  gold: 0,
  exactQuote: 0,
  criteriaCorrect: 0,
  criteriaTotal: 0,
  criteriaSpans: 0,
  edits: 0,
  chars: 0,
  caught: 0,
  injected: 0,
  supported: 0,
  acceptedSupported: 0,
  reviewedEntities: 0,
  reviewedCriteria: 0,
}
const sourceTotals = {
  tp: 0,
  predicted: 0,
  gold: 0,
  exactQuote: 0,
  correct: 0,
  total: 0,
  supportedSpanCorrect: 0,
}
try {
  for (const entry of manifest.packets) {
    const id = entry.packet_id
    const body = sourceBody(await readFile(`eval/packets/${id}.md`, "utf8"))
    const gold = JSON.parse(await readFile(`eval/gold/${id}.json`, "utf8"))
    const fingerprint = createHash("sha256")
      .update(body + renderer + entry.quality_group)
      .digest("hex")
    const cacheFile = `${artifactDir}/${id}.json`
    let cache
    try {
      cache = JSON.parse(await readFile(cacheFile, "utf8"))
    } catch {}
    if (rebuild || cache?.fingerprint !== fingerprint) {
      if (check)
        throw new Error(
          `Missing or stale OCR artifact for ${id}. Run npm run eval -- --rebuild`,
        )
      worker ??= await createOcr()
      const start = performance.now()
      const fax = await renderFax({
        text: body,
        packetId: id,
        quality: entry.quality_group,
        outputDir: artifactDir,
      })
      const ocr = await worker.recognize(fax.image)
      cache = { fingerprint, ocr, renderAndOcrMs: performance.now() - start }
      await writeFile(cacheFile, JSON.stringify(cache, null, 2) + "\n")
    }
    const start = performance.now()
    const output = processText(cache.ocr.text, entry.criteria_id, cache.ocr)
    const serviceMs = performance.now() - start
    const sourceOutput = processText(body, entry.criteria_id)
    const g = gold.entities
    const entityScore = scoreEntities(output.entities, g)
    const sourceScore = scoreEntities(sourceOutput.entities, g)
    const criteriaScore = scoreCriteria(
      output.criteria,
      gold.criterion_evidence,
    )
    const sourceCriteria = scoreCriteria(
      sourceOutput.criteria,
      gold.criterion_evidence,
    )
    for (const key of ["tp", "predicted", "gold", "exactQuote"] as const) {
      totals[key] += entityScore[key]
      sourceTotals[key] += sourceScore[key]
    }
    for (const key of ["correct", "total", "supportedSpanCorrect"] as const)
      sourceTotals[key] += sourceCriteria[key]
    totals.criteriaCorrect += criteriaScore.correct
    totals.criteriaTotal += criteriaScore.total
    totals.criteriaSpans += criteriaScore.supportedSpanCorrect
    const reference = normalizedText(body),
      hypothesis = normalizedText(cache.ocr.text)
    const edits = distance(reference, hypothesis),
      chars = Array.from(reference).length
    totals.edits += edits
    totals.chars += chars
    const citation = output.entities[0]?.source_span
    const challenges = [
      { text: "The patient is cured.", citations: [] },
      {
        text: "All fictional criteria are satisfied.",
        citations: citation ? [citation] : [],
      },
      {
        text: "Invented laboratory result.",
        citations: [{ start: 99999, end: 100000, text: "x" }],
      },
    ]
    const challengeResult = verify({
      text: output.privacy.text,
      sentences: challenges,
    })
    const caught = challengeResult.sentences.filter((s) => !s.supported).length
    totals.caught += caught
    totals.injected += challenges.length
    totals.supported += output.summary.length
    totals.acceptedSupported += output.summary.filter((s) => s.supported).length
    totals.reviewedEntities += g.filter(
      (e: { reviewed: boolean }) => e.reviewed,
    ).length
    totals.reviewedCriteria += gold.criterion_evidence.filter(
      (c: { reviewed: boolean }) => c.reviewed,
    ).length
    const failures = []
    if (
      entityScore.tp !== entityScore.gold ||
      entityScore.tp !== entityScore.predicted
    )
      failures.push("Extraction value mismatch")
    if (entityScore.exactQuote !== entityScore.tp)
      failures.push("Evidence quote differs from draft reference")
    for (const expected of gold.criterion_evidence) {
      const actual = output.criteria.find(
        (c) => c.criterion_id === expected.criterion_id,
      )
      if (actual?.status !== expected.status)
        failures.push(
          `${expected.criterion_id}: draft ${expected.status}, pipeline ${actual?.status}`,
        )
    }
    if (edits) failures.push(`${edits} OCR character edits`)
    const packet = {
      ...entry,
      ...output,
      ocr: cache.ocr,
      scores: {
        entities: entityScore,
        criteria: criteriaScore,
        cer: edits / chars,
        edits,
        chars,
        verifier: { caught, injected: challenges.length },
      },
      failures,
      latency: { renderAndOcrMs: cache.renderAndOcrMs, serviceMs },
    }
    packets.push(packet)
    if (!check)
      await writeFile(
        `eval/results/${id}.json`,
        JSON.stringify(packet, null, 2) + "\n",
      )
    console.log(
      `${id}: CER ${((100 * edits) / chars).toFixed(1)}%, entities ${entityScore.tp}/${entityScore.gold}, criteria ${criteriaScore.correct}/5`,
    )
  }
} finally {
  await worker?.close()
}
const metrics = {
  notice: DRAFT,
  packets: packets.length,
  heldOut: false,
  clinicalValidation: {
    status: "pending pharmacist review",
    reviewedEntities: totals.reviewedEntities,
    reviewedCriteria: totals.reviewedCriteria,
    scoredClinicalRate: null,
  },
  draftDiagnostics: {
    ocr: {
      cer: totals.edits / totals.chars,
      edits: totals.edits,
      referenceCharacters: totals.chars,
      whitespace: "collapsed runs, case sensitive",
    },
    extraction: {
      ...f1(totals.tp, totals.predicted, totals.gold),
      exactEvidenceQuoteMatches: totals.exactQuote,
      quoteAndValueF1: f1(totals.exactQuote, totals.predicted, totals.gold).f1,
      offsetBasis:
        "predictions reference redacted OCR, gold references original source. Exact source quote scored separately from offsets",
    },
    criteria: {
      accuracy: totals.criteriaCorrect / totals.criteriaTotal,
      correct: totals.criteriaCorrect,
      total: totals.criteriaTotal,
      statusAndExactQuotesCorrect: totals.criteriaSpans,
    },
    verifier: {
      catchRate: totals.caught / totals.injected,
      caught: totals.caught,
      injected: totals.injected,
      acceptedSupported: totals.acceptedSupported,
      supported: totals.supported,
      challengeType:
        "three deterministic unsupported mutations per packet, not semantic validation",
    },
    sourceTextBaseline: {
      extraction: f1(
        sourceTotals.tp,
        sourceTotals.predicted,
        sourceTotals.gold,
      ),
      exactQuote: sourceTotals.exactQuote,
      criteriaCorrect: sourceTotals.correct,
      criteriaTotal: sourceTotals.total,
    },
  },
  slices: [...new Set(manifest.packets.map((p) => p.quality_group))].map(
    (group) => {
      const rows = packets.filter((p) => p.quality_group === group)
      const tp = rows.reduce((n, p) => n + p.scores.entities.tp, 0),
        predicted = rows.reduce((n, p) => n + p.scores.entities.predicted, 0),
        gold = rows.reduce((n, p) => n + p.scores.entities.gold, 0)
      return {
        group,
        packets: rows.length,
        cer:
          rows.reduce((n, p) => n + p.scores.edits, 0) /
          rows.reduce((n, p) => n + p.scores.chars, 0),
        extraction: f1(tp, predicted, gold),
        criteriaCorrect: rows.reduce(
          (n, p) => n + p.scores.criteria.correct,
          0,
        ),
        criteriaTotal: rows.length * 5,
      }
    },
  ),
  reviewerOverrideRate: {
    value: null,
    reason:
      "No observed nurse study. Scripted UI actions are not workflow evidence.",
  },
  hostedComparison: {
    value: null,
    reason: "Local only. No paid API or external document transfer.",
  },
}
const metricsFile = "eval/results/metrics.json"
if (check) {
  const saved = JSON.parse(await readFile(metricsFile, "utf8"))
  if (JSON.stringify(saved) !== JSON.stringify(metrics))
    throw new Error("Saved evaluation does not reproduce")
  console.log(
    "Saved metrics reproduced exactly from 50 OCR artifacts and untouched draft gold",
  )
} else {
  await writeFile(metricsFile, JSON.stringify(metrics, null, 2) + "\n")
  const times = packets
    .map((p) => p.latency.renderAndOcrMs + p.latency.serviceMs)
    .sort((a, b) => a - b)
  await writeFile(
    "eval/results/latency.json",
    JSON.stringify(
      {
        machine: `${process.platform}/${process.arch}`,
        node: process.version,
        engine: "tesseract.js 6.0.1, one warm English worker",
        packets: times.length,
        p50Ms: times[Math.ceil(times.length * 0.5) - 1],
        p95Ms: times[Math.ceil(times.length * 0.95) - 1],
        excludes:
          "first worker language download, browser time and human review",
      },
      null,
      2,
    ) + "\n",
  )
  console.log(JSON.stringify(metrics.draftDiagnostics, null, 2))
}
