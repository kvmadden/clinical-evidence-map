import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { redact } from "../services/redact/index.js"
import { extract } from "../services/extract/index.js"
import { linkEvidence } from "../services/link-evidence/index.js"
import { verify } from "../services/verify/index.js"
import { appendReview, readReviews } from "../services/audit/index.js"
import { parseTsv, renderFax, createOcr } from "../services/ocr/index.js"

const text =
  "Request date: 2026-10-01.\nAge: 33 years.\nRequest: semaglutide 0.5 mg weekly.\nDiagnosis: Type 2 diabetes mellitus.\nA1c: 8.6 %; collected 2026-09-15.\nCurrent requested therapy: semaglutide 0.5 mg weekly.\nPrior therapy: metformin 1000 mg twice daily; started 2026-04-01; stopped 2026-08-01; inadequate response documented.\n"

test("audit contract appends correction and flag events without overwriting history", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clinical-audit-"))
  try {
    const path = join(dir, "reviews.jsonl")
    const base = {
      packetId: "packet-001",
      action: "accept" as const,
      target: "packet",
      note: "Synthetic review",
    }
    await Promise.all([
      appendReview(path, base),
      appendReview(path, {
        ...base,
        action: "correct",
        note: "Dose needs confirmation",
      }),
    ])
    const before = await readFile(path, "utf8")
    await appendReview(path, { ...base, action: "flag" })
    assert.ok((await readFile(path, "utf8")).startsWith(before))
    const rows = await readReviews(path)
    assert.equal(rows.length, 3)
    assert.equal(rows[1].previousHash, rows[0].hash)
    assert.ok(rows.every((r) => r.reviewed === false))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("audit detects retained-chain tampering and rejects an empty correction", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clinical-audit-integrity-"))
  try {
    const path = join(dir, "audit.jsonl")
    await assert.rejects(
      appendReview(path, {
        packetId: "packet-001",
        action: "correct",
        target: "dose",
        note: "",
      }),
    )
    await appendReview(path, {
      packetId: "packet-001",
      action: "flag",
      target: "dose",
      note: "Check the source",
    })
    const { writeFile } = await import("node:fs/promises")
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace(
        "Check the source",
        "Changed after review",
      ),
    )
    await assert.rejects(readReviews(path), /integrity/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
