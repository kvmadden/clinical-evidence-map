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

test("OCR contract parses boxes and routes every word below threshold", () => {
  const tsv =
    "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t20\t30\t40\t10\t41.2\tdose\n5\t1\t1\t1\t1\t2\t70\t30\t30\t10\t97\tweekly\n"
  const result = parseTsv(tsv, 80)
  assert.equal(result.words[0].needsReview, true)
  assert.equal(result.words[1].needsReview, false)
  assert.deepEqual(result.words[0].box, { x: 20, y: 30, width: 40, height: 10 })
})

test("OCR renders real fax PDF and image then recognizes words locally", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clinical-ocr-"))
  const ocr = await createOcr()
  try {
    const fax = await renderFax({
      text,
      packetId: "fixture",
      quality: "clean",
      outputDir: dir,
    })
    assert.equal((await readFile(fax.pdf)).subarray(0, 4).toString(), "%PDF")
    const result = await ocr.recognize(fax.image)
    assert.match(result.text, /semaglutide/i)
    assert.ok(result.words.length > 20)
    assert.ok(
      result.words.every((w) => w.confidence >= 0 && w.confidence <= 100),
    )
  } finally {
    await ocr.close()
    await rm(dir, { recursive: true, force: true })
  }
})
