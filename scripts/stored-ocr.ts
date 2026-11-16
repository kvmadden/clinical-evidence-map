import { createHash } from "node:crypto"
import type { OcrOutput } from "../services/contracts.js"
import { readCoverage } from "../services/ocr/coverage.js"
import { processText } from "../services/pipeline.js"

export const sha256 = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex")

// The existing deterministic privacy shift for synthetic evaluation packets.
export const shiftFor = (id: string) =>
  36500 +
  (createHash("sha256")
    .update(`clinical-evidence-map:date-shift:${id}`)
    .digest()
    .readUInt32LE(0) %
    3650)

export function decodeStoredOcr(bytes: Buffer, expectedSha256?: string) {
  if (expectedSha256 !== undefined && sha256(bytes) !== expectedSha256)
    throw new Error("Cached OCR SHA-256 mismatch")
  return JSON.parse(bytes.toString("utf8")) as {
    fingerprint?: string
    ocr: OcrOutput
    renderAndOcrMs?: number
  }
}

export function extractStoredOcr(
  ocr: OcrOutput,
  criteriaId: string,
  id: string,
) {
  const coverage = readCoverage(ocr)
  const output = processText(
    ocr.text,
    criteriaId,
    { ...ocr, coverage },
    {
      dateShiftDays: shiftFor(id),
    },
  )
  return { output, coverage }
}
