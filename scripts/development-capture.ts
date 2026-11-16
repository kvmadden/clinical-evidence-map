import { mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createOcr } from "../services/ocr/index.js"
import { recognizePages, renderPacket } from "../services/ocr/packet.js"
import { sourceBody, type Manifest } from "../services/pipeline.js"
import { sha256 as sha } from "./stored-ocr.js"
import {
  canonicalCaptureTarget,
  captureConfiguration,
  captureRuntime,
  captureSchema,
  moduleCheckout,
  producerTreeDigest,
} from "./development-identity.js"

const [destination, languageFile] = process.argv.slice(2)
if (!destination || !languageFile)
  throw new Error(
    "Provide a new absolute capture directory and an English traineddata file",
  )
const checkout = await moduleCheckout(import.meta.url)
const { repo, revision } = checkout
const producerTreeSha256 = producerTreeDigest(repo, revision)
const target = await canonicalCaptureTarget(repo, destination)
checkout.checkClean()
const fromRepo = (file: string) => readFile(resolve(repo, file))
const manifestBytes = await fromRepo("eval/manifest.json")
const manifest = JSON.parse(manifestBytes.toString("utf8")) as Manifest
const ids = manifest.packets.map((row) => row.packet_id)
if (
  manifest.packet_count !== 63 ||
  ids.length !== 63 ||
  new Set(ids).size !== 63 ||
  ids.some((id) => !/^packet-\d{3}$/.test(id))
)
  throw new Error("Expected 63 unique synthetic development cases")
const inputs = await Promise.all(
  ids.map(async (id) => {
    const bytes = await fromRepo(`eval/packets/${id}.md`)
    return { bytes, body: sourceBody(bytes.toString("utf8")) }
  }),
)
if (inputs.some((input) => !input.body))
  throw new Error("A source packet has no body")
const languageBytes = await readFile(languageFile)
// mkdir without recursive mode refuses to change an existing capture.
await mkdir(target)
if ((await realpath(target)) !== target)
  throw new Error("Capture path changed during directory creation")
await mkdir(`${target}/.cache`)
await mkdir(`${target}/ocr`)
await writeFile(`${target}/.cache/eng.traineddata`, languageBytes, {
  flag: "wx",
})
const producer = {
  revision,
  producerTreeSha256,
  runtime: captureRuntime(),
  language: { name: "eng", sha256: sha(languageBytes) },
  configuration: captureConfiguration,
}
const cases = []
process.chdir(target)
const reader = await createOcr()
try {
  for (const [index, entry] of manifest.packets.entries()) {
    const id = entry.packet_id
    const input = inputs[index]
    const fax = await renderPacket({
      text: input.body,
      packetId: id,
      plan: entry.render,
      outputDir: `${target}/ocr`,
      handwritingDir: `${repo}/eval/handwriting/images`,
    })
    const ocr = await recognizePages(
      reader,
      fax.pages.map((page) => page.image),
    )
    const bytes = Buffer.from(JSON.stringify({ ocr }) + "\n")
    await writeFile(`${target}/ocr/${id}.json`, bytes, { flag: "wx" })
    cases.push({ id, inputSha256: sha(input.bytes), ocrSha256: sha(bytes) })
    console.log(`Captured ${id} (${cases.length}/${ids.length})`)
  }
} finally {
  await reader.close()
}
if (sha(await readFile(".cache/eng.traineddata")) !== producer.language.sha256)
  throw new Error("English traineddata changed during capture")
checkout.checkClean()
if (sha(await fromRepo("eval/manifest.json")) !== sha(manifestBytes))
  throw new Error("Source manifest changed during capture")
for (const entry of cases)
  if (sha(await fromRepo(`eval/packets/${entry.id}.md`)) !== entry.inputSha256)
    throw new Error(`Input changed during capture: ${entry.id}`)
await writeFile(
  `${target}/capture.json`,
  JSON.stringify(
    {
      schema: captureSchema,
      manifestSha256: sha(manifestBytes),
      producer,
      cases,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
)
