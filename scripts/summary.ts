import { readFile } from "node:fs/promises"
import { redact } from "../services/redact/index.js"
import { extract } from "../services/extract/index.js"
import { sourceBody } from "../services/pipeline.js"
import { readingText } from "../services/ocr/pages.js"
const path = process.argv[2]
if (!path) {
  console.error("Usage: npm run summary -- eval/packets/packet-001.md")
  process.exit(1)
}
const raw = await readFile(path, "utf8")
// Page markers are never quoted, so a packet of several pages reads as its
// pages joined in order.
const privacy = redact({
  text: readingText(
    raw.includes("<!-- SOURCE START -->") ? sourceBody(raw) : raw,
  ),
})
if (privacy.blocked) {
  console.error("Privacy gate blocked this input")
  process.exit(2)
}
const entities = extract({ text: privacy.text }).entities
console.log(
  JSON.stringify(
    {
      consumer: "care-management summary",
      notice: "draft, pending pharmacist review",
      offsetBasis: privacy.offsetBasis,
      entities: entities.filter((e) =>
        [
          "diagnosis",
          "requested_medication",
          "requested_dose",
          "prior_medication",
          "measurement",
        ].includes(e.type),
      ),
    },
    null,
    2,
  ),
)
