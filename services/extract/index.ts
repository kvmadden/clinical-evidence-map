import { readFileSync } from "node:fs"
import type {
  ExtractInput,
  ExtractOutput,
  Entity,
  Normalization,
} from "../contracts.js"
const terminology = JSON.parse(
  readFileSync(new URL("./terminology.json", import.meta.url), "utf8"),
) as Record<string, Normalization>
// Exact observed lines are retained. Unknown or negated concepts stay unnormalized.
export function extract({ text }: ExtractInput): ExtractOutput {
  const entities: Entity[] = []
  let offset = 0
  const lines = text.split("\n")
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index]
    while (
      line.startsWith("Prior therapy:") &&
      !line.endsWith(".") &&
      index + 1 < lines.length &&
      lines[index + 1] &&
      !/^[A-Z][A-Za-z ]+:/.test(lines[index + 1])
    )
      line += "\n" + lines[++index]
    const start = offset
    offset += Array.from(line).length + 1
    const add = (type: string, value: Entity["value"]) => {
      entities.push({
        id: `e${entities.length + 1}`,
        type,
        value,
        source_span: {
          start,
          end: start + Array.from(line).length,
          text: line,
        },
        ...(typeof value === "string" && terminology[value]
          ? { normalization: terminology[value] }
          : {}),
        reviewed: false,
      })
    }
    let m: RegExpMatchArray | null
    if ((m = line.match(/^Patient: (.+?) \(fictional\)\.$/))) {
      if (!m[1].includes("[")) add("patient_name", m[1])
    }
    if ((m = line.match(/^Age: (\d+) years\.$/))) add("age", Number(m[1]))
    if ((m = line.match(/^Request date: (\d{4}-\d\d-\d\d)\.$/)))
      add("request_date", m[1])
    if (
      (m = line.match(/^Request date recorded in note: (\d{4}-\d\d-\d\d)\.$/))
    )
      add("conflicting_request_date", m[1])
    if ((m = line.match(/^From: (.+?), fictional requesting provider\.$/))) {
      if (!m[1].includes("[")) add("provider", m[1])
    }
    if ((m = line.match(/^Request: ([a-z]+) (.+?)\.$/))) {
      add("requested_medication", m[1])
      add("requested_dose", m[2])
    }
    if ((m = line.match(/^Diagnosis: (.+?)\.$/))) add("diagnosis", m[1])
    if (
      (m = line.match(
        /^(A1c|Body surface area|LDL-C): ([\d.]+) (%|mg\/dL); collected (\d{4}-\d\d-\d\d|\[date\])\.$/,
      ))
    ) {
      add("measurement", { name: m[1], value: Number(m[2]), unit: m[3] })
      if (m[4] !== "[date]") add("measurement_date", m[4])
    }
    if ((m = line.match(/^Current requested therapy: [a-z]+ (.+?)\.$/)))
      add("medication_list_dose", m[1])
    if ((m = line.match(/^Prior therapy: ([a-z]+) (.+?);/s))) {
      add("prior_medication", m[1])
      add("prior_dose", m[2])
      const startDate = line.match(/started (\d{4}-\d\d-\d\d)/)
      const stopDate = line.match(/stopped (\d{4}-\d\d-\d\d)/)
      if (startDate) add("prior_start_date", startDate[1])
      if (stopDate) add("prior_stop_date", stopDate[1])
      if (/inadequate response documented/.test(line))
        add("prior_outcome", "inadequate response")
      else if (/persistent nausea/.test(line))
        add("prior_outcome", "intolerance")
    }
  }
  return { entities, offsetBasis: "Unicode code points" }
}
