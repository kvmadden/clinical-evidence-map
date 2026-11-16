import { readFile, readdir, realpath } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { sourceBody, type Manifest } from "../services/pipeline.js"
import { decodeStoredOcr, extractStoredOcr, sha256 } from "./stored-ocr.js"

import {
  captureConfiguration,
  captureSchema,
  completeRuntime,
  moduleCheckout,
  producerTreeDigest,
} from "./development-identity.js"
const executedCheckout = await moduleCheckout(import.meta.url)
const policy = "whole-extraction-and-coverage/v1"
const disposition = {
  development: { cases: 63, use: "current-development" },
  multipage: { cases: 2, use: "historical-stored-ocr-only" },
  holdout: { cases: 24, use: "historical-stored-ocr-only" },
  "holdout-v2": { cases: 24, use: "historical-stored-ocr-only" },
}
const criteria = ["adult", "diagnosis", "lab", "prior", "dose"]
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value)

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object") {
    const fields = Object.entries(value).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    return `{${fields.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function checkInventory(actual: string[], expected: string[], label: string) {
  const duplicates = actual.filter((id, i) => actual.indexOf(id) !== i)
  const missing = expected.filter((id) => !actual.includes(id))
  const extra = actual.filter((id) => !expected.includes(id))
  check(
    actual.length > 0 && !duplicates.length && !missing.length && !extra.length,
    `${label} inventory mismatch: ${JSON.stringify({ duplicates, missing, extra })}`,
  )
}

interface CaptureCase {
  id: string
  inputSha256: string
  ocrSha256: string
}
interface Capture {
  schema: string
  manifestSha256: string
  producer: {
    revision: string
    producerTreeSha256: string
    runtime: Record<string, unknown>
    language: { name: string; sha256: string }
    configuration: string
  }
  cases: CaptureCase[]
}
interface ExpectedCase extends CaptureCase {
  resultSha256: string
  fields: Record<string, string>
}
interface Expectations {
  policy: string
  policySha256: string
  captureSha256: string
  manifestSha256: string
  extractorRevision: string
  disposition: typeof disposition
  cases: ExpectedCase[]
}
interface Acceptance {
  schema: string
  reviewer: string
  author: string
  decision: string
  reason: string
  priorExpectationSha256: string | null
  expectationsSha256: string
  captureSha256: string
  manifestSha256: string
  extractorRevision: string
  policy: string
  policySha256: string
  cases: { id: string; disposition: "added" | "changed" | "unchanged" }[]
}

export function verifyAcceptance(
  acceptance: Acceptance,
  expected: Expectations,
  expectedBytes: Buffer,
  previous?: { expected: Expectations; bytes: Buffer },
) {
  check(
    acceptance.schema === "clinical-development-acceptance/v1" &&
      acceptance.decision === "accepted" &&
      typeof acceptance.author === "string" &&
      typeof acceptance.reviewer === "string" &&
      acceptance.author.trim() &&
      acceptance.reviewer.trim() &&
      acceptance.reviewer.trim().toLowerCase() !==
        acceptance.author.trim().toLowerCase() &&
      typeof acceptance.reason === "string" &&
      acceptance.reason.trim(),
    "Independent acceptance is missing or malformed",
  )
  check(
    acceptance.expectationsSha256 === sha256(expectedBytes) &&
      acceptance.captureSha256 === expected.captureSha256 &&
      acceptance.manifestSha256 === expected.manifestSha256 &&
      acceptance.extractorRevision === expected.extractorRevision &&
      acceptance.policy === expected.policy &&
      acceptance.policySha256 === expected.policySha256,
    "Acceptance identity mismatch",
  )
  check(
    acceptance.priorExpectationSha256 ===
      (previous ? sha256(previous.bytes) : null),
    "Prior expectation identity mismatch",
  )
  checkInventory(
    acceptance.cases.map((row) => row.id),
    expected.cases.map((row) => row.id),
    "Acceptance",
  )
  if (previous)
    checkInventory(
      previous.expected.cases.map((row) => row.id),
      expected.cases.map((row) => row.id),
      "Prior expectations. Case removal needs a reviewed scope change",
    )
  const prior = new Map(previous?.expected.cases.map((row) => [row.id, row]))
  for (const row of expected.cases) {
    const before = prior.get(row.id)
    const required = !before
      ? "added"
      : canonical(before) === canonical(row)
        ? "unchanged"
        : "changed"
    check(
      acceptance.cases.find((approved) => approved.id === row.id)
        ?.disposition === required,
      `Acceptance disposition mismatch for ${row.id}`,
    )
  }
}

const json = <T>(bytes: Buffer) => JSON.parse(bytes.toString("utf8")) as T

export async function loadVerifiedCases(repo: string, captureDir: string) {
  const manifestBytes = await readFile(resolve(repo, "eval/manifest.json"))
  const manifest = json<Manifest>(manifestBytes)
  check(
    manifest.packet_count === disposition.development.cases &&
      manifest.packets.length === disposition.development.cases,
    "Expected 63 development cases",
  )
  const ids = manifest.packets.map((row) => row.packet_id)
  checkInventory(
    ids,
    Array.from(
      { length: 63 },
      (_, i) => `packet-${String(i + 1).padStart(3, "0")}`,
    ),
    "Development manifest",
  )
  const sourceFiles = await readdir(resolve(repo, "eval/packets"))
  checkInventory(
    sourceFiles.filter((name) => name.endsWith(".md")),
    ids.map((id) => `${id}.md`),
    "Source packet",
  )
  const captureBytes = await readFile(resolve(captureDir, "capture.json"))
  const capture = json<Capture>(captureBytes)
  const p = capture.producer
  check(
    capture.schema === captureSchema &&
      p &&
      /^[a-f0-9]{40}$/.test(p.revision) &&
      digest(p.producerTreeSha256) &&
      p.language?.name === "eng" &&
      digest(p.language.sha256) &&
      completeRuntime(p.runtime) &&
      p.configuration === captureConfiguration,
    "OCR producer receipt is incomplete or incompatible",
  )
  check(
    producerTreeDigest(repo, p.revision) === p.producerTreeSha256,
    "OCR producer tree identity mismatch",
  )
  check(
    capture.manifestSha256 === sha256(manifestBytes),
    "Capture manifest SHA-256 mismatch",
  )
  checkInventory(
    capture.cases.map((row) => row.id),
    ids,
    "OCR receipt",
  )
  const files = await readdir(resolve(captureDir, "ocr"))
  checkInventory(
    files.filter((name) => name.endsWith(".json")),
    ids.map((id) => `${id}.json`),
    "OCR cache",
  )
  const cases = await Promise.all(
    manifest.packets.map(async (row) => {
      const id = row.packet_id
      const receipt = capture.cases.find((entry) => entry.id === id)!
      const [source, ocrBytes] = await Promise.all([
        readFile(resolve(repo, `eval/packets/${id}.md`)),
        readFile(resolve(captureDir, `ocr/${id}.json`)),
      ])
      check(
        digest(receipt.inputSha256) &&
          receipt.inputSha256 === sha256(source) &&
          sourceBody(source.toString("utf8")),
        `Input SHA-256 mismatch or empty source for ${id}`,
      )
      check(digest(receipt.ocrSha256), `Missing OCR identity for ${id}`)
      check(
        sha256(ocrBytes) === receipt.ocrSha256,
        `Cached OCR SHA-256 mismatch for ${id}`,
      )
      const { ocr } = decodeStoredOcr(ocrBytes, receipt.ocrSha256)
      check(
        ocr &&
          typeof ocr.text === "string" &&
          ocr.text.trim() &&
          Array.isArray(ocr.words) &&
          ocr.words.length > 0 &&
          ocr.engine === "tesseract.js 6 / English LSTM" &&
          typeof ocr.threshold === "number",
        `Empty or partial OCR for ${id}`,
      )
      return { receipt, row, ocr }
    }),
  )
  return {
    cases,
    captureSha256: sha256(captureBytes),
    manifestSha256: sha256(manifestBytes),
  }
}

export function caseExpectation(
  receipt: CaptureCase,
  result: ReturnType<typeof extractStoredOcr>,
): ExpectedCase {
  const { output, coverage } = result
  check(
    output &&
      output.reviewed === false &&
      output.privacy?.text?.trim() &&
      output.readerCoverage &&
      output.dateReading &&
      typeof output.notice === "string" &&
      Array.isArray(output.words) &&
      Array.isArray(output.entities) &&
      Array.isArray(output.summary) &&
      typeof output.offsetBasis === "string" &&
      coverage?.pages?.length &&
      Array.isArray(output.criteria),
    `Empty or partial extraction for ${receipt.id}`,
  )
  checkInventory(
    output.criteria.map((row) => row.criterion_id),
    criteria,
    `${receipt.id} criteria`,
  )
  for (const row of output.criteria)
    check(
      ["evidence_found", "needs_review", "missing"].includes(row.status) &&
        typeof row.reason === "string" &&
        row.reason.trim() &&
        Array.isArray(row.evidence_spans),
      `Partial criterion for ${receipt.id}: ${row.criterion_id}`,
    )
  // Compare every extraction field. Evaluation timings are never part of this object.
  const exactOutput = JSON.parse(JSON.stringify(result)) as typeof result
  const fields = Object.fromEntries(
    Object.entries({
      ...exactOutput.output,
      coverage: exactOutput.coverage,
    }).map(([key, value]) => [key, sha256(canonical(value))]),
  )
  return { ...receipt, resultSha256: sha256(canonical(exactOutput)), fields }
}

export function compareCases(actual: ExpectedCase[], expected: ExpectedCase[]) {
  checkInventory(
    actual.map((row) => row.id),
    expected.map((row) => row.id),
    "Compared case",
  )
  return actual.flatMap((row) => {
    const before = expected.find((entry) => entry.id === row.id)!
    if (canonical(row) === canonical(before)) return []
    const keys = new Set([
      ...Object.keys(row.fields),
      ...Object.keys(before.fields),
    ])
    return [
      {
        id: row.id,
        expectedSha256: before.resultSha256,
        actualSha256: row.resultSha256,
        changedFields: [...keys].filter(
          (key) => row.fields[key] !== before.fields[key],
        ),
        inputChanged: row.inputSha256 !== before.inputSha256,
        ocrChanged: row.ocrSha256 !== before.ocrSha256,
      },
    ]
  })
}

export async function runDevelopment(
  captureDir: string,
  review?: { expected: Buffer; accepted: Buffer; prior?: Buffer },
  extract = extractStoredOcr,
) {
  const checkout = executedCheckout
  const { repo, revision } = checkout
  const staged = await loadVerifiedCases(repo, captureDir)
  checkout.checkClean()
  const identities = {
    captureSha256: staged.captureSha256,
    manifestSha256: staged.manifestSha256,
  }
  const policySha256 = sha256(
    canonical(
      await Promise.all(
        [
          "./development-gate.ts",
          "./stored-ocr.ts",
          "./development-identity.ts",
        ].map(async (file) =>
          sha256(await readFile(new URL(file, import.meta.url))),
        ),
      ),
    ),
  )
  const expected = review && json<Expectations>(review.expected)
  if (review && expected) {
    check(
      expected.policy === policy &&
        expected.policySha256 === policySha256 &&
        canonical(expected.disposition) === canonical(disposition) &&
        expected.manifestSha256 === identities.manifestSha256 &&
        expected.captureSha256 === identities.captureSha256,
      "Reviewed policy, manifest or capture identity mismatch",
    )
    checkInventory(
      expected.cases.map((row) => row.id),
      staged.cases.map((row) => row.row.packet_id),
      "Expectations",
    )
    verifyAcceptance(
      json<Acceptance>(review.accepted),
      expected,
      review.expected,
      review.prior
        ? { expected: json<Expectations>(review.prior), bytes: review.prior }
        : undefined,
    )
    for (const { receipt } of staged.cases) {
      const row = expected.cases.find((row) => row.id === receipt.id)!
      check(
        row.inputSha256 === receipt.inputSha256 &&
          row.ocrSha256 === receipt.ocrSha256 &&
          digest(row.resultSha256),
        `Expected input, OCR or result identity mismatch for ${receipt.id}`,
      )
    }
  }
  // All inputs, cache bytes and approval are checked before coverage or extraction.
  const reviewEvidence: {
    id: string
    result: ReturnType<typeof extractStoredOcr>
  }[] = []
  const cases = staged.cases.map(({ receipt, row, ocr }) => {
    const result = extract(ocr, row.criteria_id, receipt.id)
    if (!expected) reviewEvidence.push({ id: receipt.id, result })
    return caseExpectation(receipt, result)
  })
  const verifiedAgain = await loadVerifiedCases(repo, captureDir)
  checkout.checkClean()
  check(
    verifiedAgain.captureSha256 === identities.captureSha256 &&
      verifiedAgain.manifestSha256 === identities.manifestSha256,
    "Capture or manifest changed during evaluation",
  )
  const proposal = {
    policy,
    policySha256,
    ...identities,
    disposition,
    extractorRevision: revision,
    cases,
  }
  if (!expected)
    return { status: "proposal-only" as const, proposal, reviewEvidence }
  const differences = compareCases(cases, expected.cases)
  return {
    status: differences.length ? ("failed" as const) : ("passed" as const),
    extractorRevision: revision,
    ...identities,
    policy,
    policySha256,
    disposition,
    expectationsSha256: sha256(review!.expected),
    acceptanceSha256: sha256(review!.accepted),
    coverage: {
      compared: cases.length,
      required: disposition.development.cases,
    },
    cases: cases.map(({ id, inputSha256, ocrSha256, resultSha256 }) => ({
      id,
      inputSha256,
      ocrSha256,
      resultSha256,
    })),
    differences,
  }
}

if (
  process.argv[1] &&
  (await realpath(process.argv[1])) ===
    (await realpath(fileURLToPath(import.meta.url)))
) {
  const [mode, dir, expected, accepted, prior] = process.argv.slice(2)
  if (
    !dir ||
    (mode === "check" && (!expected || !accepted)) ||
    (mode === "propose" && (expected || accepted || prior)) ||
    !["check", "propose"].includes(mode)
  )
    throw new Error(
      "Use propose CAPTURE_DIR or check CAPTURE_DIR EXPECTATIONS ACCEPTANCE [PRIOR_EXPECTATIONS]",
    )
  const report = await runDevelopment(
    dir,
    mode === "check"
      ? {
          expected: await readFile(expected),
          accepted: await readFile(accepted),
          prior: prior ? await readFile(prior) : undefined,
        }
      : undefined,
  )
  console.log(JSON.stringify(report, null, 2))
  if (report.status === "failed") process.exitCode = 1
}
