# Evaluation

**draft, pending pharmacist review**

The development set has 63 synthetic packets and 315 criterion labels, built by the same generator the pipeline rules were written against, so its numbers are development results. The first held-out set has 24 packets and 120 criterion labels written by a different model from a written spec, frozen before the pipeline ever ran on it, and scored once, on 2 November 2026. From 3 November 2026 it is development data, because the reading rules are being changed after seeing it. 13 development labels carry Kevin's pharmacist review from 2 November 2026, carried over because their rule and quoted evidence did not change. Every other label is a draft. No second independent reviewer has checked them. These are diagnostics, not clinical accuracy claims.

## Development and held-out results

| Measure | Development, 63 packets | First held-out set, 24 packets, blind score before the rules change | First held-out set now, a development result | Second held-out set, 24 packets, blind score |
| --- | --- | --- | --- | --- |
| Every finding points to its source: extracted values, evidence links and summary citations whose quote reproduces from the redacted page | 1622 / 1622 (100.0%) | 98 / 98 (100.0%) | 532 / 532 (100.0%) | 783 / 783 (100.0%) |
| Criterion statuses correct | 266 / 315 (84.4%) | 37 / 120 (30.8%) | 110 / 120 (91.7%) | 85 / 120 (70.8%) |
| Always answering "found" | 164 / 315 (52.1%) | 60 / 120 (50.0%) | 60 / 120 (50.0%) | 49 / 120 (40.8%) |
| Evidence found, confirmed | 124 / 164 (75.6%) | 9 / 60 (15.0%) | 51 / 60 (85.0%) | 35 / 49 (71.4%) |
| Not documented, caught | 48 / 57 (84.2%) | 24 / 24 (100.0%) | 23 / 24 (95.8%) | 8 / 24 (33.3%) |
| Needs review, caught | 94 / 94 (100.0%) | 4 / 36 (11.1%) | 36 / 36 (100.0%) | 42 / 47 (89.4%) |
| Said "found" where the label is not | 0 / 151 | 1 / 60 | 0 / 60 | 4 / 71 |
| Said "not documented" where the label is found or needs review | 0 / 258 (0.0%) | 71 / 96 (74.0%) | 0 / 96 (0.0%) | 1 / 96 (1.0%) |
| Sent to review | 143 / 315 (45.4%) | 15 / 120 (12.5%) | 46 / 120 (38.3%) | 72 / 120 (60.0%) |
| Answers given: found, not documented, needs review | 124, 48, 143 of 315 | 10, 95, 15 of 120 | 51, 23, 46 of 120 | 39, 9, 72 of 120 |
| Status and exact quotes correct | 225 / 315 (71.4%) | 34 / 120 (28.3%) | 66 / 120 (55.0%) | 19 / 120 (15.8%) |
| Same services on source text, statuses correct | 315 / 315 (100.0%) | 40 / 120 (33.3%) | 120 / 120 (100.0%) | 83 / 120 (69.2%) |
| Same services on source text, said "not documented" where the label is found or needs review | 0 / 258 (0.0%) | 68 / 96 (70.8%) | 0 / 96 (0.0%) | 0 / 96 (0.0%) |
| OCR character error rate | 641 / 47227 (1.4%) | 143 / 13189 (1.1%) | 143 / 13189 (1.1%) | 3993 / 53714 (7.4%) |
| Page orientation read correctly | 63 / 63 (100.0%) | 24 / 24 (100.0%) | 24 / 24 (100.0%) | 61 / 61 (100.0%) |
| Clinical words hidden as [name], source text | 0 of 252 tokens | 13 of 84 tokens | 0 of 143 tokens | 137 of 646 tokens |

**From 3 November 2026 the first held-out set is development data.** The reading rules are being changed after seeing it, so it can no longer show how the rules carry to layouts they were not written for. Its 37 of 120 stays on this page as the score before that change. It is kept in `eval/holdout/results/first-score.json`, whose record names the freeze and the sha256 of every frozen file and stored OCR file it was computed from. Any later score on it is a development result. Its latest score, a development result, is 110 / 120 (91.7%), shown in its own column. The next headline number needs a held-out set the changed rules have never seen.

The first held-out set was the honest test of the rules until 3 November 2026. Codex (gpt-6.1-sol, read-only, no commands run) wrote it from [the spec](../eval/holdout/SPEC.md) alone: the criteria, the rubric, the format axes and the degradation list. It saw no generator, pipeline code or development packet. `scripts/holdout.ts` checked every quoted line and froze the packets, labels and manifest under sha256 `3680490ee5f93ae64a9f6f809fbf0d0c1eb4b369751bff9efaf25cbf58a766f7` before the first run. `npx tsx scripts/holdout.ts verify` recomputes it. Held-out labels cover criterion statuses and quoted lines, not entities, and include no handwriting. No pharmacist has reviewed them yet. Three other model families, Claude, Gemini and Grok, relabeled all 120 blind from the same rubric and the packet text. Their statuses match 119 of 120 on every relabel, and the one disagreement is a model reading a received date as a second request date. [The cross-check](../eval/holdout/crosscheck/README.md) shows the labels follow the rubric. It does not show the rubric is clinically right.

In its blind run, with the stage C reading rules, the pipeline answered "not documented" for 95 of 120 labels. It caught every not-documented label only because it said "not documented" whenever it could not parse a layout it had not seen: 71 of the 96 labels marked evidence found or needs review got that answer. It confirmed 9 of 60 documented criteria and scored below the always-"found" baseline. The same services on the held-out source text, with no OCR at all, got 40 of 120 right. The development score reflected how well the rules fit the generator's templates, not how well they read new documents.

The second held-out set has 24 packets, frozen under sha256 `11e33eb217e828c7de7c4cb13572f61dbb60f3c4668597fe2fdef44ec0e8047d` before its first run and first scored on 3 November 2026 at 869777f. Its blind score is 85 / 120 (70.8%) statuses correct, against 49 / 120 (40.8%) for always answering "found".

### Every "found" answer where the label is not

| Set | Packet | Group | Criterion | Draft label says | Pipeline said |
| --- | --- | --- | --- | --- | --- |
| Second held-out set | holdout2-10 | Drawn circles, arrows and underlines, no handwriting | adult | The cover says 17 years and the clinic note says 71 years, and those two ages lead to different results. | Age 71 is documented. |
| Second held-out set | holdout2-16 | Simulated smudges | prior | Metformin intolerance is asserted without documenting any clinical reason or specific adverse event. | Metformin contraindication is documented with its reason: reason not provided in chart. |
| Second held-out set | holdout2-23 | Simulated page orientation | lab | There are two conflicting request dates on the page (08/10/2026 and 10/15/2026). | LDL-C 142 mg/dL is 44 days before the request and meets the 70 mg/dL threshold. |
| Second held-out set | holdout2-24 | Simulated page orientation | prior | The rosuvastatin trial duration is only 45 days, which is less than the required 90 days. | Atorvastatin intolerance is documented with its reason: severe calf cramping. After a statin holiday, she was restarted on. |

Before the stage D reader there were 3 such answers on the development set, each a medication list line that conflicted with the request but could not be parsed: AI-drawn handwriting OCR could not read, "qwk" read as "gw" on a choppy page, and "every other week" read as "every choses" beside drawn marks. In the first held-out set's blind run there was 1, "stopped for an inadequate response" read as an intolerance with a reason. The reader now sends the dose to review when a medication list line for the requested drug cannot be read, and reads stopping for an inadequate response as an efficacy outcome. Both fixes were made after seeing these sets, so they show on development data only. A result on a set the fixes were not written against is the one that will count.

### Label status against answer

Rows are the draft label, columns are the answer, so the diagonal is right. The source-text run uses the same services on the packet text with no OCR.

**Development, 63 packets.** Each row is a draft label status, each column what the tool answered.

| Label | OCR: found | OCR: not documented | OCR: needs review | Source text: found | Source text: not documented | Source text: needs review | Labels |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Evidence found | 124 | 0 | 40 | 164 | 0 | 0 | 164 |
| Not documented | 0 | 48 | 9 | 0 | 57 | 0 | 57 |
| Needs review | 0 | 0 | 94 | 0 | 0 | 94 | 94 |
| Answers | 124 | 48 | 143 | 164 | 57 | 94 | 315 |

**First held-out set, 24 packets, blind score before the rules change.** Each row is a draft label status, each column what the tool answered.

| Label | OCR: found | OCR: not documented | OCR: needs review | Source text: found | Source text: not documented | Source text: needs review | Labels |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Evidence found | 9 | 40 | 11 | 11 | 38 | 11 | 60 |
| Not documented | 0 | 24 | 0 | 0 | 24 | 0 | 24 |
| Needs review | 1 | 31 | 4 | 1 | 30 | 5 | 36 |
| Answers | 10 | 95 | 15 | 12 | 92 | 16 | 120 |

**First held-out set now, a development result.** Each row is a draft label status, each column what the tool answered.

| Label | OCR: found | OCR: not documented | OCR: needs review | Source text: found | Source text: not documented | Source text: needs review | Labels |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Evidence found | 51 | 0 | 9 | 60 | 0 | 0 | 60 |
| Not documented | 0 | 23 | 1 | 0 | 24 | 0 | 24 |
| Needs review | 0 | 0 | 36 | 0 | 0 | 36 | 36 |
| Answers | 51 | 23 | 46 | 60 | 24 | 36 | 120 |

**Second held-out set, 24 packets, blind score.** Each row is a draft label status, each column what the tool answered.

| Label | OCR: found | OCR: not documented | OCR: needs review | Source text: found | Source text: not documented | Source text: needs review | Labels |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Evidence found | 35 | 0 | 14 | 40 | 0 | 9 | 49 |
| Not documented | 0 | 8 | 16 | 0 | 0 | 24 | 24 |
| Needs review | 4 | 1 | 42 | 4 | 0 | 43 | 47 |
| Answers | 39 | 9 | 72 | 44 | 0 | 76 | 120 |

### By criterion

**Development, 63 packets.**

| Criterion | Labels: found, not documented, review | Answers: found, not documented, review | Statuses correct | Said "not documented" where found or review | Sent to review | Source text correct | Source text said "not documented" where found or review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| adult | 43, 13, 7 | 40, 12, 11 | 59 / 63 (93.7%) | 0 / 50 | 11 / 63 | 63 / 63 (100.0%) | 0 / 50 |
| diagnosis | 31, 15, 17 | 30, 12, 21 | 59 / 63 (93.7%) | 0 / 48 | 21 / 63 | 63 / 63 (100.0%) | 0 / 48 |
| lab | 32, 10, 21 | 24, 8, 31 | 53 / 63 (84.1%) | 0 / 53 | 31 / 63 | 63 / 63 (100.0%) | 0 / 53 |
| prior | 27, 10, 26 | 14, 8, 41 | 48 / 63 (76.2%) | 0 / 53 | 41 / 63 | 63 / 63 (100.0%) | 0 / 53 |
| dose | 31, 9, 23 | 16, 8, 39 | 47 / 63 (74.6%) | 0 / 54 | 39 / 63 | 63 / 63 (100.0%) | 0 / 54 |

**First held-out set, 24 packets, blind score before the rules change.**

| Criterion | Labels: found, not documented, review | Answers: found, not documented, review | Statuses correct | Said "not documented" where found or review | Sent to review | Source text correct | Source text said "not documented" where found or review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| adult | 18, 3, 3 | 7, 16, 1 | 11 / 24 (45.8%) | 13 / 21 | 1 / 24 | 11 / 24 (45.8%) | 13 / 21 |
| diagnosis | 12, 3, 9 | 0, 24, 0 | 3 / 24 (12.5%) | 21 / 21 | 0 / 24 | 3 / 24 (12.5%) | 21 / 21 |
| lab | 15, 6, 3 | 1, 10, 13 | 9 / 24 (37.5%) | 4 / 18 | 13 / 24 | 12 / 24 (50.0%) | 1 / 18 |
| prior | 6, 6, 12 | 2, 21, 1 | 8 / 24 (33.3%) | 15 / 18 | 1 / 24 | 8 / 24 (33.3%) | 15 / 18 |
| dose | 9, 6, 9 | 0, 24, 0 | 6 / 24 (25.0%) | 18 / 18 | 0 / 24 | 6 / 24 (25.0%) | 18 / 18 |

**First held-out set now, a development result.**

| Criterion | Labels: found, not documented, review | Answers: found, not documented, review | Statuses correct | Said "not documented" where found or review | Sent to review | Source text correct | Source text said "not documented" where found or review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| adult | 18, 3, 3 | 18, 3, 3 | 24 / 24 (100.0%) | 0 / 21 | 3 / 24 | 24 / 24 (100.0%) | 0 / 21 |
| diagnosis | 12, 3, 9 | 12, 3, 9 | 24 / 24 (100.0%) | 0 / 21 | 9 / 24 | 24 / 24 (100.0%) | 0 / 21 |
| lab | 15, 6, 3 | 10, 6, 8 | 19 / 24 (79.2%) | 0 / 18 | 8 / 24 | 24 / 24 (100.0%) | 0 / 18 |
| prior | 6, 6, 12 | 6, 6, 12 | 24 / 24 (100.0%) | 0 / 18 | 12 / 24 | 24 / 24 (100.0%) | 0 / 18 |
| dose | 9, 6, 9 | 5, 5, 14 | 19 / 24 (79.2%) | 0 / 18 | 14 / 24 | 24 / 24 (100.0%) | 0 / 18 |

**Second held-out set, 24 packets, blind score.**

| Criterion | Labels: found, not documented, review | Answers: found, not documented, review | Statuses correct | Said "not documented" where found or review | Sent to review | Source text correct | Source text said "not documented" where found or review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| adult | 14, 5, 5 | 15, 4, 5 | 22 / 24 (91.7%) | 0 / 19 | 5 / 24 | 18 / 24 (75.0%) | 0 / 19 |
| diagnosis | 11, 2, 11 | 11, 3, 10 | 23 / 24 (95.8%) | 1 / 22 | 10 / 24 | 22 / 24 (91.7%) | 0 / 22 |
| lab | 11, 4, 9 | 6, 0, 18 | 13 / 24 (54.2%) | 0 / 20 | 18 / 24 | 13 / 24 (54.2%) | 0 / 20 |
| prior | 6, 6, 12 | 7, 1, 16 | 16 / 24 (66.7%) | 0 / 18 | 16 / 24 | 15 / 24 (62.5%) | 0 / 18 |
| dose | 7, 7, 10 | 0, 1, 23 | 11 / 24 (45.8%) | 0 / 17 | 23 / 24 | 15 / 24 (62.5%) | 0 / 17 |

### First held-out set by group and criterion, blind score

| Slice | Packets | OCR CER | Extraction F1 | Statuses correct | Always "found" | Not documented caught | Needs review caught | Said found when not |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Clean render | 3 | 0.7% | not labeled | 5 / 15 (33.3%) | 7 / 15 (46.7%) | 4 / 4 (100.0%) | 0 / 4 (0.0%) | 0 / 8 |
| Simulated fax noise | 3 | 0.5% | not labeled | 6 / 15 (40.0%) | 6 / 15 (40.0%) | 4 / 4 (100.0%) | 1 / 5 (20.0%) | 1 / 9 |
| Simulated choppy scan lines | 2 | 4.4% | not labeled | 5 / 10 (50.0%) | 2 / 10 (20.0%) | 4 / 4 (100.0%) | 1 / 4 (25.0%) | 0 / 8 |
| Simulated smudges | 3 | 0.2% | not labeled | 8 / 15 (53.3%) | 6 / 15 (40.0%) | 4 / 4 (100.0%) | 2 / 5 (40.0%) | 0 / 9 |
| Simulated low contrast | 3 | 0.8% | not labeled | 6 / 15 (40.0%) | 7 / 15 (46.7%) | 3 / 3 (100.0%) | 0 / 5 (0.0%) | 0 / 8 |
| Simulated 7-degree rotation | 2 | 0.5% | not labeled | 2 / 10 (20.0%) | 3 / 10 (30.0%) | 2 / 2 (100.0%) | 0 / 5 (0.0%) | 0 / 7 |
| Simulated page orientation | 6 | 0.1% | not labeled | 2 / 30 (6.7%) | 24 / 30 (80.0%) | 1 / 1 (100.0%) | 0 / 5 (0.0%) | 0 / 6 |
| Drawn circles, arrows and underlines, no handwriting | 2 | 4.9% | not labeled | 3 / 10 (30.0%) | 5 / 10 (50.0%) | 2 / 2 (100.0%) | 0 / 3 (0.0%) | 0 / 5 |
| adult |  |  |  | 11 / 24 (45.8%) | 18 / 24 (75.0%) | 3 / 3 (100.0%) | 1 / 3 (33.3%) | 0 / 6 |
| diagnosis |  |  |  | 3 / 24 (12.5%) | 12 / 24 (50.0%) | 3 / 3 (100.0%) | 0 / 9 (0.0%) | 0 / 12 |
| lab |  |  |  | 9 / 24 (37.5%) | 15 / 24 (62.5%) | 6 / 6 (100.0%) | 2 / 3 (66.7%) | 0 / 9 |
| prior |  |  |  | 8 / 24 (33.3%) | 6 / 24 (25.0%) | 6 / 6 (100.0%) | 1 / 12 (8.3%) | 1 / 18 |
| dose |  |  |  | 6 / 24 (25.0%) | 9 / 24 (37.5%) | 6 / 6 (100.0%) | 0 / 9 (0.0%) | 0 / 15 |

### First held-out set by criterion now, a development result

| Slice | Packets | OCR CER | Extraction F1 | Statuses correct | Always "found" | Not documented caught | Needs review caught | Said found when not |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adult |  |  |  | 24 / 24 (100.0%) | 18 / 24 (75.0%) | 3 / 3 (100.0%) | 3 / 3 (100.0%) | 0 / 6 |
| diagnosis |  |  |  | 24 / 24 (100.0%) | 12 / 24 (50.0%) | 3 / 3 (100.0%) | 9 / 9 (100.0%) | 0 / 12 |
| lab |  |  |  | 19 / 24 (79.2%) | 15 / 24 (62.5%) | 6 / 6 (100.0%) | 3 / 3 (100.0%) | 0 / 9 |
| prior |  |  |  | 24 / 24 (100.0%) | 6 / 24 (25.0%) | 6 / 6 (100.0%) | 12 / 12 (100.0%) | 0 / 18 |
| dose |  |  |  | 19 / 24 (79.2%) | 9 / 24 (37.5%) | 5 / 6 (83.3%) | 9 / 9 (100.0%) | 0 / 15 |

### Second held-out set by group and criterion, blind score

| Slice | Packets | OCR CER | Extraction F1 | Statuses correct | Always "found" | Not documented caught | Needs review caught | Said found when not |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Clean render | 4 | 6.0% | not labeled | 16 / 20 (80.0%) | 16 / 20 (80.0%) | 1 / 1 (100.0%) | 3 / 3 (100.0%) | 0 / 4 |
| Simulated fax noise | 4 | 8.7% | not labeled | 15 / 20 (75.0%) | 3 / 20 (15.0%) | 1 / 4 (25.0%) | 12 / 13 (92.3%) | 0 / 17 |
| Simulated choppy scan lines | 2 | 10.8% | not labeled | 6 / 10 (60.0%) | 3 / 10 (30.0%) | 0 / 3 (0.0%) | 4 / 4 (100.0%) | 0 / 7 |
| Simulated smudges | 2 | 7.0% | not labeled | 7 / 10 (70.0%) | 3 / 10 (30.0%) | 1 / 2 (50.0%) | 4 / 5 (80.0%) | 1 / 7 |
| Simulated low contrast | 2 | 5.5% | not labeled | 6 / 10 (60.0%) | 1 / 10 (10.0%) | 1 / 4 (25.0%) | 5 / 5 (100.0%) | 0 / 9 |
| Simulated 7-degree rotation | 2 | 6.9% | not labeled | 9 / 10 (90.0%) | 5 / 10 (50.0%) | 0 / 1 (0.0%) | 4 / 4 (100.0%) | 0 / 5 |
| Simulated page orientation | 6 | 7.6% | not labeled | 19 / 30 (63.3%) | 13 / 30 (43.3%) | 3 / 8 (37.5%) | 7 / 9 (77.8%) | 2 / 17 |
| Drawn circles, arrows and underlines, no handwriting | 2 | 6.9% | not labeled | 7 / 10 (70.0%) | 5 / 10 (50.0%) | 1 / 1 (100.0%) | 3 / 4 (75.0%) | 1 / 5 |
| adult |  |  |  | 22 / 24 (91.7%) | 14 / 24 (58.3%) | 4 / 5 (80.0%) | 4 / 5 (80.0%) | 1 / 10 |
| diagnosis |  |  |  | 23 / 24 (95.8%) | 11 / 24 (45.8%) | 2 / 2 (100.0%) | 10 / 11 (90.9%) | 0 / 13 |
| lab |  |  |  | 13 / 24 (54.2%) | 11 / 24 (45.8%) | 0 / 4 (0.0%) | 8 / 9 (88.9%) | 1 / 13 |
| prior |  |  |  | 16 / 24 (66.7%) | 6 / 24 (25.0%) | 1 / 6 (16.7%) | 10 / 12 (83.3%) | 2 / 18 |
| dose |  |  |  | 11 / 24 (45.8%) | 7 / 24 (29.2%) | 1 / 7 (14.3%) | 10 / 10 (100.0%) | 0 / 17 |

## What arrived and what OCR could read

Each packet now gets a coverage record, built from the OCR output alone so it is the same in evaluation and in use: pages received, page counters read where fax machines and footers put them, which pages the counters say are missing, whether the pages arrived in order, whether each page's turn was chosen by a clear margin, word confidence per page, and the runs of lines with a word below the review threshold. The record is passed to the reading rules with the OCR text, and they use it. A page that did not arrive, could not be read, or arrived out of order blocks every "not documented" answer, which goes to review and names the page. A found answer stands, and the packet is marked incomplete.

| Measure | Development | First held-out set | Second held-out set | Multi-page fixture |
| --- | --- | --- | --- | --- |
| Pages received | 63 in 63 packets | 24 in 24 packets | 61 in 24 packets | 5 in 2 packets |
| Packets with a page counter read | 16 of 63 | 0 of 24 | 23 of 24 | 2 of 2 |
| Packets with a page missing, a counter conflict or a turn not settled | 0 of 63 | 0 of 24 | 0 of 24 | 1 of 2: multipage-02 |
| Pages missing, as the counters say | 0 | 0 | 0 | 1 |
| Pages whose turn was chosen by a clear margin | 63 / 63 (100.0%) | 24 / 24 (100.0%) | 61 / 61 (100.0%) | 5 / 5 (100.0%) |
| OCR lines with a word below 80% confidence, the review threshold | 150 / 1219 (12.3%) | 51 / 366 (13.9%) | 195 / 1105 (17.6%) | 2 / 44 (4.5%) |
| OCR lines where every word is below that threshold | 25 / 1219 (2.1%) | 3 / 366 (0.8%) | 9 / 1105 (0.8%) | 0 / 44 (0.0%) |
| Source lines OCR did not give back, evaluation only | 4 / 1216 (0.3%) | 0 / 366 (0.0%) | 51 / 1155 (4.4%) | 0 / 44 (0.0%) |
| Of those, places the coverage already marks as low confidence | 3 of 4 | 0 of 0 | 1 of 51 | 0 of 0 |

The last two rows compare OCR with the source text, which only an evaluation has, so they never reach the pipeline. A source line counts as not given back when fewer than a quarter of its visible characters come back from OCR unchanged and in order. They are:

- Development: packet-012 page 1 line 18: Repatha 140mg SC q2wk
- Development: packet-029 page 1 line 13, not flagged: The patient reports ongoing symptoms despite prior treatment.
- Development: packet-057 page 1 line 4: Age: 60 yrs
- Development: packet-059 page 1 line 4: Age: 33
- Second held-out set: holdout2-03 page 2 line 4, not flagged: DOS: 08/19/2026 Dr. Ivo Trent (fictional)
- Second held-out set: holdout2-13 page 1 line 2, not flagged: ======================================================================
- Second held-out set: holdout2-13 page 1 line 8, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-13 page 2 line 5, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-14 page 1 line 7, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-14 page 2 line 4, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-14 page 2 line 8, not flagged: ----------------------|--------|-------|------|-------------------
- Second held-out set: holdout2-14 page 2 line 11, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-14 page 2 line 14, not flagged: -----------------|---------|-------|------------|------------|--------
- Second held-out set: holdout2-14 page 2 line 18, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-15 page 1 line 4, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-15 page 1 line 9, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-15 page 2 line 6, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-15 page 2 line 21, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-16 page 1 line 2, not flagged: ======================================================================
- Second held-out set: holdout2-16 page 1 line 8, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-16 page 2 line 5, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-16 page 2 line 11, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-17 page 1 line 7, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-17 page 1 line 11, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-17 page 1 line 21, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-17 page 2 line 5, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-18 page 1 line 6, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-18 page 2 line 4, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-18 page 2 line 12, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-19 page 1 line 6, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-19 page 2 line 5, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-19 page 2 line 9: ----------------|---------------------|----------|----------
- Second held-out set: holdout2-19 page 2 line 13, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-20 page 1 line 6, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-20 page 2 line 5, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-20 page 2 line 13, not flagged: ---------------|--------|-------|------|-------------------
- Second held-out set: holdout2-20 page 2 line 18, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-21 page 1 line 8, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-21 page 1 line 12, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-21 page 2 line 6, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-21 page 2 line 9, not flagged: ---------------------|---------|-------|-----------|------------|--------
- Second held-out set: holdout2-21 page 2 line 14, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-22 page 1 line 7, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-22 page 1 line 11, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-22 page 2 line 5, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-22 page 2 line 13, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-23 page 1 line 6, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-23 page 2 line 4, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-23 page 2 line 8, not flagged: -------------------|-------|-------|------|----------------
- Second held-out set: holdout2-23 page 2 line 13, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-24 page 1 line 7, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-24 page 2 line 5, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-24 page 2 line 8, not flagged: ----------------|-------|-------|------------|------------|-----------
- Second held-out set: holdout2-24 page 2 line 12, not flagged: ----------------------------------------------------------------------
- Second held-out set: holdout2-24 page 2 line 18, not flagged: ----------------------------------------------------------------------

51 of the 55 left no low-confidence word to mark the place, so the coverage record cannot warn about those. Coverage can only describe what OCR returned.

## Multi-page check

Packet-018 sent as three fax pages, and the same fax with page 2 never received. Test fixtures, not part of either evaluation set. The two packets are development text, so these are development results. A line holding only `<<page>>` starts a new page in the packet text. Each page is drawn with the same page size, effects and font, with its own seeded noise, and OCR reads each page on its own. The page texts are joined in order, every word keeps its page number, and quotes and offsets point into the joined text, so the same checks apply as for one page.

| Packet | Pages received | Page counters read | Pages reported missing | OCR CER | Statuses correct | Mismatches |
| --- | --- | --- | --- | --- | --- | --- |
| multipage-01 | 3 of 3 | P.001/003, P.002/003, P.003/003 | none | 0.0% | 5 / 5 | none |
| multipage-02 | 2 of 3 | P.001/003, P.003/003 | 2 | 0.0% | 4 / 5 | dose: label evidence found, answered needs review |

The labels on the second packet follow Kevin's rule of 3 November 2026: "not documented" may only be answered once the whole packet was read. With page 2 missing, a criterion with nothing on the pages received needs review. The coverage record reports page 2 of 3 as missing, and the reading rules use it: prior therapy is answered needs review, with the reason "No high-intensity statin trial, intolerance or contraindication is documented. This cannot be called not documented, because part of the packet could not be read. Page 2 of the packet did not arrive." The dose label stays evidence found on the pages received, although the medication list that disagreed with it was on the missing page. The pipeline answered the dose needs review: "Low confidence OCR overlaps the words this answer rests on. Check the image." Whether a found answer should stand while a page is missing, with the packet marked incomplete, or go to review is Kevin's open decision. For now it stands, and the packet is marked incomplete. Every quote in the fixture results reproduces from the redacted text: 58 / 58 (100.0%).

## What this measures, and what it does not

Every page is a fax-style page image made on this computer. Nothing was printed, faxed or scanned. Each group is named by the effect actually applied:

- **Clean render.** Typed page with light speckle. No other effect.
- **Simulated 7-degree rotation.** Typed page with simulated fax noise, rotated 7 degrees.
- **AI-drawn handwriting (image model).** Typed page whose medication history is an AI-drawn handwriting image from an image model, not a real person's handwriting, with simulated fax noise.
- **Simulated fax noise.** Typed page with seeded speckles and faint horizontal streaks.
- **Simulated choppy scan lines.** Typed page with seeded row jitter, dropped lines and dark streaks.
- **Simulated smudges.** Typed page with seeded blurred smudges over the text.
- **Simulated low contrast.** Typed page in light gray ink on a gray background.
- **Simulated page orientation.** Typed page with simulated fax noise, turned 180, 90 or 270 degrees.
- **Printed page with AI-drawn notes, circles and arrows.** Typed page with AI-drawn handwritten fills and margin notes from an image model, drawn circles and arrows, and simulated fax noise.

The handwriting in two groups is AI-drawn handwriting from an image model, not a real person's handwriting. Its provenance, prompts and checksums are in [the handwriting record](../eval/handwriting/handwriting.json). The gold text for each drawn line follows what the image shows.

## Reproduce

`npm ci` followed by `npm run eval -- --check` rescores all 63 stored OCR outputs against the current labels and requires an exact match with the saved metrics. `npm run eval:holdout -- --check` does the same for the first held-out set after checking its freeze and its first-score record, and `npm run eval -- --set multipage --check` for the multi-page fixture. `npm run eval -- --set holdout-v2` scores the second held-out set once it exists. A held-out set is scored only while its files match its frozen sha256. Its first run needs the freeze, the files it covers and the tracked code committed, claims the set with an exclusive create, reads every page again instead of trusting stored OCR, and writes `results/first-score.json` once with the freeze and the sha256 of every frozen and OCR file it used. Every later run must match that record and is saved as a development result. An interrupted first run resumes only with `--recover` at the same commit, and a record lost after it was committed has to be restored from git. These checks catch mistakes and silent changes in this repository. They cannot show that nobody ran the pipeline on a set some other way before its first run. `npm run generate` rebuilds every packet, label, criteria file and the manifest from `scripts/generate.ts`. `npx tsx scripts/fixtures.ts` rebuilds the multi-page fixture from packet-018. `npm run eval -- --rebuild` redraws every page image and PDF and reruns local OCR. `npm run report` regenerates this page.

## Label balance

| Set | Evidence found | Not documented | Needs review | Always answering "found" scores |
| --- | --- | --- | --- | --- |
| 2b4d487 | 220 / 250 (88.0%) | 10 / 250 (4.0%) | 20 / 250 (8.0%) | 220 / 250 (88.0%) |
| Now | 164 / 315 (52.1%) | 57 / 315 (18.1%) | 94 / 315 (29.8%) | 164 / 315 (52.1%) |

Gaps are now common. Most packets have two or three criteria without full support, and three packets have none supported. Near misses include a diagnosis found only in the history, a suspected diagnosis, a different requested indication, a trial too short or in the wrong drug class, a bare "inadequate response" without values, a follow-up value already at goal, a lab outside the window or below threshold, conflicting request dates, a dose or frequency outside the rule, and blank form fields.

## Development results beside 2b4d487

| Measure | 2b4d487 | Now |
| --- | --- | --- |
| Criterion statuses correct | 124 / 250 (49.6%) | 266 / 315 (84.4%) |
| Always answering "found" | 220 / 250 (88.0%) | 164 / 315 (52.1%) |
| Evidence found, caught | 97 / 220 (44.1%) | 124 / 164 (75.6%) |
| Not documented, caught | 10 / 10 (100.0%) | 48 / 57 (84.2%) |
| Needs review, caught | 17 / 20 (85.0%) | 94 / 94 (100.0%) |
| Said "found" where the label is not | 0 / 30 | 0 / 151 |
| Status and exact quotes correct | 107 / 250 (42.8%) | 225 / 315 (71.4%) |
| Extraction precision | 356 / 362 (98.3%) | 871 / 901 (96.7%) |
| Extraction recall | 356 / 600 (59.3%) | 871 / 951 (91.6%) |
| Extraction F1 | 74.0% | 94.1% |
| Value and exact quote matches | 218 / 600 | 788 / 951 |
| OCR character error rate | 418 / 34599 (1.2%) | 641 / 47227 (1.4%) |
| Page orientation read correctly | not measured | 63 / 63 (100.0%), turned pages 8 / 8 |
| Letters with the condition hidden as [name] | 48 / 50 | 0 letters |
| Clinical words hidden as [name], OCR text | not measured | 0 of 252 [name] tokens |
| Clinical words hidden as [name], source text | not measured | 0 of 252 [name] tokens |
| Dates | all removed | 335 shifted, 10 removed |
| Verifier mutations caught | 150 / 150 (100.0%) | 189 / 189 (100.0%) |
| Source text baseline, statuses correct | 180 / 250 (72.0%) | 315 / 315 (100.0%) |
| Local packet latency p50 / p95 | 2.66s / 3.75s | 4.34s / 5.24s |

The two sets are not the same test. 2b4d487 had 50 packets with one problem at most each. The development set has 63 packets, harder rules for diagnosis and prior therapy, varied formats, new page effects and three typed fonts. Read each number against the always-"found" baseline beside it, not against the old ones.

## Reviewed and draft labels

| Labels | Statuses correct | Always "found" | Not documented caught | Needs review caught |
| --- | --- | --- | --- | --- |
| Pharmacist reviewed, carried over | 12 / 13 (92.3%) | 13 / 13 (100.0%) | none | none |
| Draft | 254 / 302 (84.1%) | 151 / 302 (50.0%) | 48 / 57 (84.2%) | 94 / 94 (100.0%) |

The 13 reviewed labels are all adult, lab and dose labels Kevin marked evidence found. Eight more of his labels, on diagnosis and prior therapy, need a fresh look because both the rule and the packet text changed. His earlier answers and notes stay in the gold files.

## Development results by group

| Slice | Packets | OCR CER | Extraction F1 | Statuses correct | Always "found" | Not documented caught | Needs review caught | Said found when not |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Clean render | 5 | 0.2% | 98.0% | 22 / 25 (88.0%) | 16 / 25 (64.0%) | 3 / 3 (100.0%) | 6 / 6 (100.0%) | 0 / 9 |
| Simulated 7-degree rotation | 5 | 0.6% | 97.7% | 24 / 25 (96.0%) | 15 / 25 (60.0%) | 5 / 5 (100.0%) | 5 / 5 (100.0%) | 0 / 10 |
| AI-drawn handwriting (image model) | 5 | 4.6% | 82.1% | 17 / 25 (68.0%) | 16 / 25 (64.0%) | 0 / 3 (0.0%) | 6 / 6 (100.0%) | 0 / 9 |
| Simulated fax noise | 8 | 0.1% | 97.1% | 36 / 40 (90.0%) | 17 / 40 (42.5%) | 7 / 7 (100.0%) | 16 / 16 (100.0%) | 0 / 23 |
| Simulated choppy scan lines | 8 | 3.6% | 94.6% | 34 / 40 (85.0%) | 19 / 40 (47.5%) | 6 / 8 (75.0%) | 13 / 13 (100.0%) | 0 / 21 |
| Simulated smudges | 8 | 0.4% | 96.6% | 35 / 40 (87.5%) | 17 / 40 (42.5%) | 9 / 9 (100.0%) | 14 / 14 (100.0%) | 0 / 23 |
| Simulated low contrast | 8 | 0.1% | 96.1% | 37 / 40 (92.5%) | 19 / 40 (47.5%) | 9 / 9 (100.0%) | 12 / 12 (100.0%) | 0 / 21 |
| Simulated page orientation | 8 | 0.3% | 93.1% | 38 / 40 (95.0%) | 19 / 40 (47.5%) | 7 / 7 (100.0%) | 14 / 14 (100.0%) | 0 / 21 |
| Printed page with AI-drawn notes, circles and arrows | 8 | 2.8% | 89.0% | 23 / 40 (57.5%) | 26 / 40 (65.0%) | 2 / 6 (33.3%) | 8 / 8 (100.0%) | 0 / 14 |

At 2b4d487 the groups mixed page effects and content problems:

| 2b4d487 group | Packets | OCR CER | Extraction F1 | Statuses correct | Always "found" |
| --- | --- | --- | --- | --- | --- |
| Clean render (was clean) | 5 | 0.1% | 79.6% | 11 / 25 (44.0%) | 25 / 25 (100.0%) |
| Simulated 7-degree rotation (was skew) | 5 | 10.8% | 0.0% | 0 / 25 (0.0%) | 25 / 25 (100.0%) |
| Handwriting font, Kalam (was handwriting) | 5 | 0.2% | 69.7% | 10 / 25 (40.0%) | 25 / 25 (100.0%) |
| Missing lab page | 5 | 0.1% | 84.2% | 16 / 25 (64.0%) | 20 / 25 (80.0%) |
| Missing medication history page | 5 | 0.1% | 79.3% | 15 / 25 (60.0%) | 20 / 25 (80.0%) |
| Conflicting request dates | 5 | 0.1% | 77.2% | 14 / 25 (56.0%) | 20 / 25 (80.0%) |
| Measurement outside 180 days | 5 | 0.1% | 79.6% | 13 / 25 (52.0%) | 20 / 25 (80.0%) |
| Prior trial without dates or response | 5 | 0.1% | 86.4% | 15 / 25 (60.0%) | 20 / 25 (80.0%) |
| Conflicting dose | 5 | 0.1% | 80.7% | 15 / 25 (60.0%) | 20 / 25 (80.0%) |
| Intolerance documented | 5 | 0.1% | 79.6% | 15 / 25 (60.0%) | 25 / 25 (100.0%) |

## Development results by format and variation

| Slice | Packets | OCR CER | Extraction F1 | Statuses correct | Always "found" | Not documented caught | Needs review caught | Said found when not |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Has AI-drawn handwriting | 13 | 3.5% | 86.4% | 40 / 65 (61.5%) | 42 / 65 (64.6%) | 2 / 9 (22.2%) | 14 / 14 (100.0%) | 0 / 23 |
| Has a blank form field | 7 | 3.4% | 95.9% | 30 / 35 (85.7%) | 11 / 35 (31.4%) | 12 / 14 (85.7%) | 10 / 10 (100.0%) | 0 / 24 |
| Ambiguous dates settled by a day above 12 | 29 | 1.0% | 94.8% | 119 / 145 (82.1%) | 74 / 145 (51.0%) | 22 / 27 (81.5%) | 44 / 44 (100.0%) | 0 / 71 |
| Ambiguous dates settled by the received date | 2 | 0.1% | 83.3% | 8 / 10 (80.0%) | 6 / 10 (60.0%) | 3 / 3 (100.0%) | 1 / 1 (100.0%) | 0 / 4 |
| No ambiguous numeric date | 29 | 1.5% | 95.1% | 125 / 145 (86.2%) | 77 / 145 (53.1%) | 23 / 27 (85.2%) | 41 / 41 (100.0%) | 0 / 68 |
| Ambiguous dates nothing settles | 3 | 4.1% | 87.9% | 14 / 15 (93.3%) | 7 / 15 (46.7%) | none | 8 / 8 (100.0%) | 0 / 8 |
| Dates day first, as 01/10/2026 | 10 | 0.3% | 96.0% | 47 / 50 (94.0%) | 25 / 50 (50.0%) | 7 / 7 (100.0%) | 18 / 18 (100.0%) | 0 / 25 |
| Dates as 2026-10-01 | 17 | 1.7% | 94.0% | 68 / 85 (80.0%) | 55 / 85 (64.7%) | 9 / 12 (75.0%) | 18 / 18 (100.0%) | 0 / 30 |
| Dates as 1 Oct 2026 | 7 | 1.9% | 92.3% | 30 / 35 (85.7%) | 15 / 35 (42.9%) | 7 / 8 (87.5%) | 12 / 12 (100.0%) | 0 / 20 |
| Dates as Oct 1, 2026 | 8 | 0.8% | 97.3% | 37 / 40 (92.5%) | 19 / 40 (47.5%) | 7 / 8 (87.5%) | 13 / 13 (100.0%) | 0 / 21 |
| Dates as 10-1-26 | 9 | 1.8% | 92.6% | 40 / 45 (88.9%) | 23 / 45 (51.1%) | 11 / 11 (100.0%) | 11 / 11 (100.0%) | 0 / 22 |
| Dates as 10/01/2026 | 12 | 1.5% | 92.4% | 44 / 60 (73.3%) | 27 / 60 (45.0%) | 7 / 11 (63.6%) | 22 / 22 (100.0%) | 0 / 33 |
| Dose with no space, as 140mg | 15 | 1.2% | 96.2% | 71 / 75 (94.7%) | 36 / 75 (48.0%) | 15 / 15 (100.0%) | 24 / 24 (100.0%) | 0 / 39 |
| Dose written as in the rule | 24 | 2.0% | 90.6% | 90 / 120 (75.0%) | 74 / 120 (61.7%) | 11 / 18 (61.1%) | 28 / 28 (100.0%) | 0 / 46 |
| Dose with route and frequency codes | 16 | 0.4% | 96.9% | 72 / 80 (90.0%) | 35 / 80 (43.8%) | 13 / 13 (100.0%) | 32 / 32 (100.0%) | 0 / 45 |
| Dose as a sig, as 2 tabs PO BID | 8 | 1.5% | 93.8% | 33 / 40 (82.5%) | 19 / 40 (47.5%) | 9 / 11 (81.8%) | 10 / 10 (100.0%) | 0 / 21 |
| Drug written as brand name | 23 | 1.4% | 95.4% | 104 / 115 (90.4%) | 55 / 115 (47.8%) | 24 / 26 (92.3%) | 34 / 34 (100.0%) | 0 / 60 |
| Drug written as generic name | 40 | 1.4% | 93.3% | 162 / 200 (81.0%) | 109 / 200 (54.5%) | 24 / 31 (77.4%) | 60 / 60 (100.0%) | 0 / 91 |
| Has a typed fax-style header line | 16 | 0.4% | 95.8% | 73 / 80 (91.3%) | 41 / 80 (51.3%) | 18 / 18 (100.0%) | 21 / 21 (100.0%) | 0 / 39 |
| Has a look-alike drug name | 1 | 0.0% | 100.0% | 5 / 5 (100.0%) | 1 / 5 (20.0%) | 1 / 1 (100.0%) | 3 / 3 (100.0%) | 0 / 4 |
| Has a misspelling a pharmacist would accept | 11 | 0.6% | 94.4% | 46 / 55 (83.6%) | 28 / 55 (50.9%) | 11 / 11 (100.0%) | 16 / 16 (100.0%) | 0 / 27 |
| Form layout with fields | 21 | 1.1% | 93.4% | 87 / 105 (82.9%) | 61 / 105 (58.1%) | 13 / 15 (86.7%) | 29 / 29 (100.0%) | 0 / 44 |
| Letter layout | 42 | 1.5% | 94.4% | 179 / 210 (85.2%) | 103 / 210 (49.0%) | 35 / 42 (83.3%) | 65 / 65 (100.0%) | 0 / 107 |

In 31 of 34 packets with an ambiguous numeric date, the pipeline settled the order the same way the label does, or kept both readings where the label does. Spelling variants a pharmacist would accept were matched 11 of 11 times. Look-alike names a pharmacist would not accept were accepted anyway 0 of 1 times.

## Development results by criterion and scenario

| Slice | Packets | OCR CER | Extraction F1 | Statuses correct | Always "found" | Not documented caught | Needs review caught | Said found when not |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adult |  |  |  | 59 / 63 (93.7%) | 43 / 63 (68.3%) | 12 / 13 (92.3%) | 7 / 7 (100.0%) | 0 / 20 |
| diagnosis |  |  |  | 59 / 63 (93.7%) | 31 / 63 (49.2%) | 12 / 15 (80.0%) | 17 / 17 (100.0%) | 0 / 32 |
| lab |  |  |  | 53 / 63 (84.1%) | 32 / 63 (50.8%) | 8 / 10 (80.0%) | 21 / 21 (100.0%) | 0 / 31 |
| prior |  |  |  | 48 / 63 (76.2%) | 27 / 63 (42.9%) | 8 / 10 (80.0%) | 26 / 26 (100.0%) | 0 / 36 |
| dose |  |  |  | 47 / 63 (74.6%) | 31 / 63 (49.2%) | 8 / 9 (88.9%) | 23 / 23 (100.0%) | 0 / 32 |

| Criterion | Scenario | Label | Statuses correct |
| --- | --- | --- | --- |
| adult | absent | missing | 7 / 8 (87.5%) |
| adult | blank | missing | 5 / 5 (100.0%) |
| adult | minor | needs review | 7 / 7 (100.0%) |
| adult | supported | evidence found | 40 / 43 (93.0%) |
| diagnosis | blank | missing | 5 / 5 (100.0%) |
| diagnosis | handwritten | evidence found | 1 / 2 (50.0%) |
| diagnosis | history only | needs review | 6 / 6 (100.0%) |
| diagnosis | misspelled | evidence found | 5 / 5 (100.0%) |
| diagnosis | other indication | missing | 7 / 10 (70.0%) |
| diagnosis | severity | needs review | 2 / 2 (100.0%) |
| diagnosis | supported | evidence found | 24 / 24 (100.0%) |
| diagnosis | unconfirmed | needs review | 9 / 9 (100.0%) |
| dose | blank | missing | 8 / 9 (88.9%) |
| dose | conflict | needs review | 11 / 11 (100.0%) |
| dose | handwritten | evidence found | 0 / 1 (0.0%) |
| dose | supported | evidence found | 16 / 30 (53.3%) |
| dose | wrong frequency | needs review | 12 / 12 (100.0%) |
| lab | ambiguous date | needs review | 3 / 3 (100.0%) |
| lab | below | needs review | 5 / 5 (100.0%) |
| lab | blank | missing | 4 / 4 (100.0%) |
| lab | conflict date | needs review | 4 / 4 (100.0%) |
| lab | handwritten | evidence found | 0 / 1 (0.0%) |
| lab | missing page | missing | 4 / 6 (66.7%) |
| lab | stale | needs review | 9 / 9 (100.0%) |
| lab | supported | evidence found | 24 / 31 (77.4%) |
| prior | ambiguous date | needs review | 3 / 3 (100.0%) |
| prior | bare | needs review | 9 / 9 (100.0%) |
| prior | blank | missing | 0 / 1 (0.0%) |
| prior | contraindication | evidence found | 3 / 3 (100.0%) |
| prior | handwritten bare | needs review | 1 / 1 (100.0%) |
| prior | intolerance | evidence found | 4 / 8 (50.0%) |
| prior | intolerance no reason | needs review | 4 / 4 (100.0%) |
| prior | lookalike | needs review | 1 / 1 (100.0%) |
| prior | missing page | missing | 2 / 2 (100.0%) |
| prior | objective | evidence found | 7 / 16 (43.8%) |
| prior | short | needs review | 5 / 5 (100.0%) |
| prior | undated | needs review | 3 / 3 (100.0%) |
| prior | wrong class | missing | 6 / 7 (85.7%) |

## Scoring rules

Criterion accuracy compares each of the 315 statuses by criterion ID. "Always found" is the score of a tool that answers "evidence found" every time. Recall is reported separately for not documented and needs review. "Said found when not" counts labels that are not evidence found where the pipeline said evidence found. That is the error that could let a gap pass. "Said not documented where the label is found or needs review" counts the opposite error, the one that would send a nurse to ask for documentation the packet already holds, or close a question a person needed to see. "Sent to review" counts every needs-review answer over all labels, the share of the work handed to a person. A strict count also requires the same quoted lines.

CER uses Levenshtein distance after collapsing whitespace runs, case sensitive, on the text before redaction. For a packet of several pages the page texts are joined in order, on both the OCR side and the source side, with the page markers left out. Orientation is scored page by page. Extraction matches type and exact canonical value one to one. Names are removed before extraction and excluded. The privacy step shifts dates by a per-packet number of days, so the evaluator undoes the shift before comparing date values, and restores the written date before comparing quotes. The shift comes from the packet ID so runs reproduce. That makes it not secret, which is fine for synthetic data and wrong for real data.

The verifier receives three deterministic unsupported mutations per packet. Its exact-quotation rule rejects them by construction. It is not a semantic hallucination benchmark.

## Source text baseline

The same services run on the source text without OCR. Development statuses correct: 315 / 315 (100.0%), extraction F1 99.9%. The extraction rules and the generator were written together, so this shows the rules cover the generator's phrasings, nothing more. On the first held-out set's source text, in its blind run, the same services got 40 / 120 (33.3%) statuses right, which is the measure of how far the rules generalized before any page effect.

## Limits

The labels are drafts except for 13 carried-over reviews. The development numbers come from one generator. The first held-out set is small, 24 packets from one other model, with no confidence interval, no handwriting and no pharmacist-reviewed labels, though a blind relabel by three other model families matches 119 of 120, and from 3 November 2026 it is development data. There is no nurse study. Typed pages use three fonts: Roboto Mono, whose slashed zero OCR sometimes reads as 8, Liberation Sans and DejaVu Sans. Other fonts, real fax transmission and real handwriting are untested. Packets of several pages are tested on two fixture packets built from one development packet, not on a held-out set. Page counters are read only in their common forms, and a packet without one gives no count to check against, so a page missing from it goes unnoticed. The fictional rules are Kevin's to adjust. From stage D the fictional PCSK9 rule accepts a high-intensity statin trial, atorvastatin 40 or 80 mg or rosuvastatin 20 or 40 mg daily, by Kevin's ruling of 2 November 2026. No development or held-out packet mentions rosuvastatin, so no score here depends on it. No clinical outcome, safety, adoption or time-saving claim follows from these sets.
