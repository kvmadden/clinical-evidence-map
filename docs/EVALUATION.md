# Evaluation

**draft, pending pharmacist review**

All 50 packets are development data, with 700 entity labels and 250 criterion labels. No label has pharmacist approval, and no second independent reviewer has checked them. Clinical validation is unscored. The following are draft diagnostics, not clinical accuracy claims. Gold content is unchanged.

## Reproduce

`npm ci` followed by `npm run eval -- --check` rescores all 50 stored OCR outputs against current draft gold and requires an exact match with saved metrics. `npm run eval -- --rebuild` regenerates every fax image, image-only PDF and local OCR output before scoring. `npm run report` regenerates this page. No sibling checkout, estate root or registered host is used.

The services do not read gold or quality expectations. The evaluator uses quality group only for rendering and slices. Source, renderer and quality fingerprints invalidate cached OCR. Font files and dependency versions are bundled or pinned. A clean rebuild downloads the free English Tesseract model on first use. Checked-in OCR artifacts allow rescoring without a download.

## Draft results

| Measure | Result | Count or denominator |
| --- | --- | --- |
| OCR CER | 1.21% | 418 character edits / 34599 reference characters |
| Extraction precision | 98.34% | 356 matched values / 362 predictions |
| Extraction recall | 59.33% | 356 matched values / 600 clinical draft labels |
| Extraction F1 | 74.01% | Type and exact value |
| Value plus exact source quote F1 | 45.32% | 218 quote and value matches |
| Criterion status accuracy | 49.60% | 124 / 250 |
| Status plus exact evidence quotes | 42.80% | 107 / 250 |
| Verifier mutation catch rate | 100.00% | 150 / 150 injected unsupported claims |
| Valid extractive sentences retained | 100.00% | 157 / 157 |
| Local packet latency p50 / p95 | 2.66s / 3.75s | 50 packets on an M1 Max Mac, darwin/arm64, Node v24.14.1 |

The latency includes rendering, OCR and module processing on a shared machine. It excludes first language-model download, browser work and human review. It is not a measured nurse-workflow improvement. Review override rate and hosted comparison remain unmeasured.

## Quality slices

| Group | Packets | OCR CER | Extraction F1 | Criterion statuses correct |
| --- | --- | --- | --- | --- |
| clean | 5 | 0.14% | 79.63% | 11 / 25 |
| skew | 5 | 10.75% | 0.00% | 0 / 25 |
| handwriting | 5 | 0.22% | 69.72% | 10 / 25 |
| missing-lab | 5 | 0.06% | 84.21% | 16 / 25 |
| missing-history | 5 | 0.08% | 79.31% | 15 / 25 |
| conflicting-dates | 5 | 0.05% | 77.19% | 14 / 25 |
| stale-lab | 5 | 0.11% | 79.63% | 13 / 25 |
| unclear-trial | 5 | 0.06% | 86.36% | 15 / 25 |
| conflicting-dose | 5 | 0.06% | 80.73% | 15 / 25 |
| intolerance | 5 | 0.11% | 79.63% | 15 / 25 |

## Scoring rules

CER uses Levenshtein distance after collapsing whitespace runs in the source and OCR text. It is case sensitive. It does not measure layout retention. Clinical extraction matches type and exact JSON value with one-to-one matching. Names and provider labels are intentionally removed before extraction, so 100 identifier labels are excluded from clinical extraction scoring. Dates remain in the clinical denominator, making the privacy loss visible.

Exact evidence quotes are scored separately. Every prediction's offsets must reproduce its quote within redacted OCR text. Gold offsets refer to the original source, so comparing offset integers between these two documents would be invalid. Quote scoring requires exact text, including line breaks, and therefore penalizes OCR wrapping and redaction changes. This is not relaxed substring scoring.

Criterion accuracy matches each of 250 statuses by criterion ID. A separate strict count requires the same supporting quote set. Confidence routing can change a draft evidence_found label to needs_review. This is counted as a mismatch, rather than hidden as a safety success.

The verifier receives three deterministic unsupported mutations per packet: an uncited cure claim, an unrelated claim with a valid citation, and a fabricated span. Its exact-quotation rule rejects all changed claims by construction. The challenge set is small and authored with the implementation. It is not a semantic hallucination benchmark. Cited sentences with low OCR confidence remain citation-supported but carry a separate review flag.

## Baseline and failure analysis

The same services run on source text without OCR, while retaining the same privacy gate. That baseline has extraction F1 82.35% and criterion status accuracy 180/250. It isolates part of the scan-related loss. Both paths lose dates through the upstream identifiers profile. Neither path is an independent holdout or a comparison against manual nurse review.

Open the local Failure gallery for each packet's actual discrepancies. Skewed text can break the label-shaped extraction rules. OCR can confuse A1c with Alc or a handwritten dose with another number. The privacy library removes dates needed for time windows and trial duration. Source line wrapping changes exact quote matches. The app routes uncertainty to review and retains the image for inspection. It does not infer absent documentation or approve coverage.

The brief's extraction recall and criterion accuracy targets are not met. The next evidence-driven work is a reviewed privacy contract for temporal features, OCR deskew and layout handling, and a separately authored holdout after pharmacist adjudication. No clinical outcome, safety, adoption or time-saving claim follows from this set.
