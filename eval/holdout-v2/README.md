# Held-out set, version 2: realistic mixed packets

24 synthetic prior-authorization packets of two to four fax pages, written blind from [SPEC.md](SPEC.md) by two model families that neither wrote the first held-out set nor changed the reading rules: Grok 4.7 wrote holdout2-01 to 12 and Gemini 3.8 Flash wrote holdout2-13 to 24. Each mixes fax cover sheets, payer forms with checkboxes and blank fields, letters, SOAP notes, lab report tables, medication tables and staff notes, with distractors, negation, corrections and conflicts. A line containing only `<<page>>` is a page break. The PCSK9 prior-therapy rule here accepts rosuvastatin 20 or 40 mg as well as atorvastatin 40 or 80 mg.

## How the labels were made
- Each author drafted labels for its own packets.
- Claude Opus 5.5, GPT 6.1 Sol, Gemini 3.8 Flash and Grok 4.7 relabeled all 24 packets blind, from the rubric and the packet text only ([relabels/prompt.md](relabels/prompt.md), answers in [relabels/](relabels/)). All four match the author on 116 of 120 labels.
- Four labels were disputed. Claude adjudicated them against the rubric before any pipeline ran on the set: one changed (holdout2-24 lab, to evidence_found) and three stayed needs_review. Every vote and reason is in [adjudication-record.json](adjudication-record.json).
- Before freezing, eight names that belonged to a real company, a real health system or famous people were replaced with invented ones ([safety-edits.json](safety-edits.json)), and one quoted line that had a stray line break inside the JSON was repaired to the packet's line ([gemini-repairs.json](gemini-repairs.json)). No other text changed.
- Final mix: 49 evidence found, 47 needs review, 24 missing. No pharmacist has reviewed these labels yet.

## Frozen
`scripts/holdout.ts` froze packets, gold and manifest under the sha256 in [FREEZE.json](FREEZE.json) before the reading rules changed for this set ever ran on it. Verify with:

    HOLDOUT_DIR=eval/holdout-v2 HOLDOUT_PREFIX=holdout2 npx tsx scripts/holdout.ts verify

The builders who change the reading rules were told never to read this folder. The set was scored once.

## Blind run
The stage D reader ran on this set once, on 3 November 2026 at 869777f, by the [run plan](RUN-PLAN.md) committed before it. [results/first-score.json](results/first-score.json) holds that score and binds the freeze and every scored file by sha256. Any later run is development data. `npm run eval:holdout-v2 -- --check` confirms the saved score reproduces from the stored OCR. The labels are still drafts that no pharmacist has reviewed.

What the run plan said would be reported:

- Criterion statuses correct: 85 of 120 from the page images and 83 of 120 from the source text, against 49 of 120 for always answering "found". The source text gives almost the same score, so most misses come from the rules, not the reading.
- False "not documented", a missing answer where the label is evidence found or needs review: 1 of 96 from the page images, 0 of 96 from the source text.
- False "evidence found", a found answer where the label is missing or needs review: 4 of 71 from both. All five errors from the page images are on labels that say needs review.
- Needs-review answers: 72 of 120 from the page images, 42 of them on labels that also say needs review, and 76 of 120 from the source text, 43 of them on such labels. The labels send 47 to review.
- Per criterion, statuses correct from the page images: adult 22 of 24, diagnosis 23 of 24, lab 13 of 24, prior 16 of 24, dose 11 of 24.
- Per author, from the page images:

| Packets | Statuses correct | Always "found" | False "not documented" | False "evidence found" | Sent to review |
| --- | --- | --- | --- | --- | --- |
| Grok 4.7, holdout2-01 to 12 | 45 / 60 | 24 / 60 | 1 / 48 | 1 / 36 | 35 / 60 |
| Gemini 3.8 Flash, holdout2-13 to 24 | 40 / 60 | 25 / 60 | 0 / 48 | 3 / 35 | 37 / 60 |
| All 24 | 85 / 120 | 49 / 120 | 1 / 96 | 4 / 71 | 72 / 120 |

- Per page condition and per criterion in full, with every wrong "found" and its reason: see [the evaluation](../../docs/EVALUATION.md).
- Quotes that reproduce from the redacted page: 783 of 783.
