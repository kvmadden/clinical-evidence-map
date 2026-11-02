# Clinical evidence map

## User and decision
A utilization-management nurse has a faxed prior-authorization packet and a set of coverage criteria. The question is simple: what in this packet supports each criterion, and what still needs review? The tool should take the nurse straight to the source. The nurse makes the decision.

## Workflow
In Stage B, a fax PDF goes through OCR with word confidence, a redaction check, and extraction of diagnoses, medications, doses, labs and prior treatment. Each finding keeps its source span. The evidence map shows support or a gap for every criterion. A verifier flags unsupported summary sentences. The nurse accepts or corrects findings, with every action logged. A small care-management summary will reuse the redaction and extraction services.

Stage A supplies the test material: three fictional criteria sets, 50 synthetic packet texts and draft labels. Kevin reviews the labels before they can serve as an evaluation reference. Scan effects are plans for later rendering, not completed OCR tests.

## Success metrics and targets
These are proposed Stage B gates, not measured results. Report counts and denominators with every rate. Score extraction and linking against Kevin-reviewed labels only.

| Measure | Target |
| --- | --- |
| Exact entity value and source-span precision / recall | At least 95% / 90% |
| Correct criterion status and supporting spans | At least 90% of criterion instances |
| Missing or conflicting evidence sent for review | 100% of labeled cases |
| Unsupported summary sentences that escape the verifier | Zero in the evaluated set |
| Seeded identifier strings removed by the privacy gate | 100% of a separate synthetic identifier test set |
| OCR word error rate on rendered packets | At most 5% clean, 15% degraded |
| Low-confidence OCR words sent for review | 100% below the declared threshold |
| Nurse corrections to proposed findings | At most 20% of reviewed findings |
| Packet processing latency | p95 at most 30 seconds on the named test machine |
| Find evidence for all five criteria | Median at most 2 minutes and 25% faster than manual review in a paired exercise |

## Non-goals
No automated approval or denial. No real patient data, real payer policies, clinical validation claims, production deployment or model training. Stage A does not build the pipeline or UI.

## Risks and limits
The labels are drafts, not clinical truth. Repeated templates can make scores look better than they are. Source text cannot test OCR or redaction performance. Scan quality, conflicting records and treatment history need separate failure counts. Fifty synthetic packets cannot establish clinical safety or predict nurse performance. No performance target has been tested.

## What changes with real data
Real data would require approved access, a defined use and retention policy, privacy and security review, and a reviewed policy version for each request. We would need representative documents, independent clinical adjudication, and testing across sites and scan quality. We would revisit every target and require evidence before any clinical use.

## Stage B implementation status

The local review workspace, six reusable services, care-management CLI and 50-packet draft evaluation are implemented. [Evaluation](EVALUATION.md) distinguishes measured development diagnostics from clinical validation. No labels have pharmacist approval. Extraction and criterion targets are not met. Timing evidence is limited by the upstream library's date redaction, and skew exposes OCR and extraction failures. Workflow-time and override targets remain unmeasured.
