import { redactText } from "layered-pii-redaction"
import type { RedactInput, RedactOutput } from "../contracts.js"
// Never loads the operator's private people map. All traffic stays local.
export function redact({ text }: RedactInput): RedactOutput {
  const result = redactText(text, {
    profile: "identifiers",
    peopleMap: { people: [], safe: [] },
  })
  return {
    text: result.text,
    blocked: result.blocked,
    hits: result.hits,
    offsetBasis: "redacted Unicode code points",
  }
}
