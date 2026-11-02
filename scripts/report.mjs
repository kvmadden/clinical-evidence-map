import { readFile, writeFile } from "node:fs/promises"
const metrics = JSON.parse(await readFile("eval/results/metrics.json", "utf8"))
const latency = JSON.parse(await readFile("eval/results/latency.json", "utf8"))
const d = metrics.draftDiagnostics
const pct = (n) => `${(100 * n).toFixed(2)}%`
const output = `# Evaluation

**draft, pending pharmacist review**

All 50 packets are development data, with 700 entity labels and 250 criterion labels. No label has pharmacist approval. Clinical validation is unscored. The following are draft diagnostics, not clinical accuracy claims. Gold content is unchanged.

## Reproduce

\`npm ci\` followed by \`npm run eval -- --check\` rescores all 50 stored OCR outputs against current draft gold and requires an exact match with saved metrics. \`npm run eval -- --rebuild\` regenerates every fax image, image-only PDF and local OCR output before scoring. \`npm run report\` regenerates this page. No sibling checkout, estate root or registered host is used.

The services do not read gold or quality expectations. The evaluator uses quality group only for rendering and slices. Source, renderer and quality fingerprints invalidate cached OCR. Font files and dependency versions are bundled or pinned. A clean rebuild downloads the free English Tesseract model on first use. Checked-in OCR artifacts allow rescoring without a download.

## Draft results

| Measure | Result | Count or denominator |
| --- | --- | --- |
| OCR CER | ${pct(d.ocr.cer)} | ${d.ocr.edits} character edits / ${d.ocr.referenceCharacters} reference characters |
| Extraction precision | ${pct(d.extraction.precision)} | ${d.extraction.tp} matched values / ${d.extraction.predicted} predictions |
| Extraction recall | ${pct(d.extraction.recall)} | ${d.extraction.tp} matched values / ${d.extraction.gold} clinical draft labels |
| Extraction F1 | ${pct(d.extraction.f1)} | Type and exact value |
| Value plus exact source quote F1 | ${pct(d.extraction.quoteAndValueF1)} | ${d.extraction.exactEvidenceQuoteMatches} quote and value matches |
| Criterion status accuracy | ${pct(d.criteria.accuracy)} | ${d.criteria.correct} / ${d.criteria.total} |
| Status plus exact evidence quotes | ${pct(d.criteria.statusAndExactQuotesCorrect / d.criteria.total)} | ${d.criteria.statusAndExactQuotesCorrect} / ${d.criteria.total} |
| Verifier mutation catch rate | ${pct(d.verifier.catchRate)} | ${d.verifier.caught} / ${d.verifier.injected} injected unsupported claims |
| Valid extractive sentences retained | ${pct(d.verifier.acceptedSupported / d.verifier.supported)} | ${d.verifier.acceptedSupported} / ${d.verifier.supported} |
| Local packet latency p50 / p95 | ${(latency.p50Ms / 1000).toFixed(2)}s / ${(latency.p95Ms / 1000).toFixed(2)}s | 50 packets on an M1 Max Mac, ${latency.machine}, Node ${latency.node} |

The latency includes rendering, OCR and module processing on a shared machine. It excludes first language-model download, browser work and human review. It is not a measured nurse-workflow improvement. Review override rate and hosted comparison remain unmeasured.

## Quality slices

| Group | Packets | OCR CER | Extraction F1 | Criterion statuses correct |
| --- | --- | --- | --- | --- |
${metrics.slices.map((s) => `| ${s.group} | ${s.packets} | ${pct(s.cer)} | ${pct(s.extraction.f1)} | ${s.criteriaCorrect} / ${s.criteriaTotal} |`).join("\n")}

## Scoring rules

CER uses Levenshtein distance after collapsing whitespace runs in the source and OCR text. It is case sensitive. It does not measure layout retention. Clinical extraction matches type and exact JSON value with one-to-one matching. Names and provider labels are intentionally removed before extraction, so 100 identifier labels are excluded from clinical extraction scoring. Dates remain in the clinical denominator, making the privacy loss visible.

Exact evidence quotes are scored separately. Every prediction's offsets must reproduce its quote within redacted OCR text. Gold offsets refer to the original source, so comparing offset integers between these two documents would be invalid. Quote scoring requires exact text, including line breaks, and therefore penalizes OCR wrapping and redaction changes. This is not relaxed substring scoring.

Criterion accuracy matches each of 250 statuses by criterion ID. A separate strict count requires the same supporting quote set. Confidence routing can change a draft evidence_found label to needs_review. This is counted as a mismatch, rather than hidden as a safety success.

The verifier receives three deterministic unsupported mutations per packet: an uncited cure claim, an unrelated claim with a valid citation, and a fabricated span. Its exact-quotation rule rejects all changed claims by construction. The challenge set is small and authored with the implementation. It is not a semantic hallucination benchmark. Cited sentences with low OCR confidence remain citation-supported but carry a separate review flag.

## Baseline and failure analysis

The same services run on source text without OCR, while retaining the same privacy gate. That baseline has extraction F1 ${pct(d.sourceTextBaseline.extraction.f1)} and criterion status accuracy ${d.sourceTextBaseline.criteriaCorrect}/${d.sourceTextBaseline.criteriaTotal}. It isolates part of the scan-related loss. Both paths lose dates through the upstream identifiers profile. Neither path is an independent holdout or a comparison against manual nurse review.

Open the local Failure gallery for each packet's actual discrepancies. Skewed text can break the label-shaped extraction rules. OCR can confuse A1c with Alc or a handwritten dose with another number. The privacy library removes dates needed for time windows and trial duration. Source line wrapping changes exact quote matches. The app routes uncertainty to review and retains the image for inspection. It does not infer absent documentation or approve coverage.

The brief's extraction recall and criterion accuracy targets are not met. The next evidence-driven work is a reviewed privacy contract for temporal features, OCR deskew and layout handling, and a separately authored holdout after pharmacist adjudication. No clinical outcome, safety, adoption or time-saving claim follows from this set.
`
await writeFile("docs/EVALUATION.md", output)
