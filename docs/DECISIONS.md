# First five decisions

These decisions set Stage A's scope. They can change when Kevin reviews the material.

## 1. Keep the nurse responsible for the decision
The output answers whether a packet contains evidence for each criterion. It does not decide coverage. Missing documentation and contradictory documentation both need a person, but they are different problems and keep different labels.

## 2. Write fictional criteria for three drug classes
Use a GLP-1 for type 2 diabetes, a biologic for plaque psoriasis, and a PCSK9 inhibitor. Each set has five criteria, including a time window and a prior-treatment requirement. This covers several kinds of evidence without claiming to reproduce a payer policy. The thresholds are invented exercise rules. No public policy was copied or checked. These files need Kevin's review too.

## 3. Start with 50 source texts and a declared quality plan
Make five packets in each of ten quality groups. Keep text available so Kevin can inspect labels without OCR errors getting in the way. Skew and handwriting-like fonts are future rendering instructions. Missing pages and conflicting records are already present in the text. This separates intended source evidence from later OCR output.

## 4. Require exact source spans and leave every label unreviewed
Every extracted entity and criterion result has a reviewed flag set to false. Offsets point to the body of the source file, using a documented convention. Kevin can check the quoted text and correct a label without guessing where it came from. No terminology codes are invented. External normalization waits for Stage B.

## 5. Treat this set as a draft reference, not proof of performance
The 50 packets share templates. Review them by quality group and then by drug class. After corrections, freeze a version before running evaluations. Stage B must report errors and denominators, keep template families together when splitting data, and use a separately authored holdout before making broader claims. A score from this set alone will not establish clinical safety.

## Stage B decisions

6. Use local OCR and deterministic template rules first. Keep every predicted span tied to redacted OCR text. No paid model or network document transfer is needed for the workflow.
7. Reuse the current pii-redaction-gate identifiers profile as a pinned library. It strips dates, so temporal criteria must remain unresolved. Do not bypass that privacy boundary to improve a demonstration score.
8. Make verification conservative and extractive. Distinguish valid citations from low OCR confidence. Exact quotation support is not medical correctness.
9. Keep review actions as append-only annotations. A correction records the target and explanation without changing source material or Kevin's draft gold labels.
10. Ship repeatable draft diagnostics and a failure gallery. With zero reviewed labels, no clinical performance rate is released. Do not count scripted UI interactions as a nurse study.
