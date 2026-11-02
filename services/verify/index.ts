import { validSpan } from "../contracts.js"
import type { VerifyInput, VerifyOutput } from "../contracts.js"
// Conservative extractive verifier. It does not claim semantic entailment.
export function verify({
  text,
  sentences,
  words = [],
}: VerifyInput): VerifyOutput {
  return {
    sentences: sentences.map((s) => {
      const supported =
        s.citations.length > 0 &&
        s.citations.every((c) => validSpan(text, c)) &&
        s.citations.some((c) => c.text === s.text)
      return {
        ...s,
        supported,
        needsReview:
          !supported ||
          s.citations.some((c) =>
            words.some(
              (w) => w.needsReview && w.start < c.end && w.end > c.start,
            ),
          ),
        reason: supported
          ? "Exact cited source statement."
          : "Uncited, invalid span or claim differs from cited text. Review required.",
      }
    }),
  }
}
