# Synthetic packet generator spec

## Purpose and boundaries

This is the generation contract for the evaluation set. It describes test data, not a clinical workflow. Every person, clinic and history is invented. The files hold no dates of birth, addresses, contact details, member numbers, medical record numbers or real patient records. Drug, condition and lab names are real terms used in fictional examples. The rules are fictional exercise criteria, not a payer policy.

`scripts/generate.ts` writes the whole set deterministically. `npm run generate` rebuilds it, and a test checks that the rebuild matches every checked-in file byte for byte.

## Outputs

- `criteria/<class>.json`: three fictional criteria sets with five rules each.
- `packets/packet-NNN.md`: 63 source texts with front matter.
- `gold/packet-NNN.json`: one draft label file per packet, with entities, criterion labels, the scenario behind each label, variation tags and how numeric dates read.
- `manifest.json`: packet IDs, criteria sets, groups, tags and the render plan for each page.
- `handwriting/handwriting.json`: provenance and transcription for every AI-drawn handwriting image.

## How gold is made

Each packet starts as a set of structured facts: an age, a request date, a stated indication, measurements with dates, a prior trial with its dates, dose and values, and so on. The generator writes those facts into text in a chosen format, then applies the fictional rules to the facts to get each criterion's status. The pipeline never sees the facts. It reads the page.

Each criterion label records the scenario it was built from, such as `history-only` or `bare`. The generator checks that every scenario produces the status its design intends and stops if one does not.

## Rules, as of this version

| Class | Diagnosis | Lab | Prior therapy | Dose |
| --- | --- | --- | --- | --- |
| GLP-1, type 2 diabetes | Type 2 diabetes named as the reason for this request | Any A1c within 180 days before the request | Metformin at a stated dose for at least 90 days, with an A1c on or before the start and an A1c at least 90 days after the start that is still 7.0% or higher | Semaglutide 0.5 mg weekly |
| Biologic, plaque psoriasis | Moderate-to-severe plaque psoriasis named as the reason | Body surface area at least 10% within 180 days | Methotrexate at a stated dose for at least 90 days, with body surface area before and after that is still above 3% | Adalimumab 40 mg every other week |
| PCSK9 inhibitor | Established atherosclerotic cardiovascular disease named as the reason | LDL-C at least 70 mg/dL within 180 days | Atorvastatin 40 or 80 mg daily for at least 90 days, with LDL-C before and after that is still 70 mg/dL or higher | Evolocumab 140 mg every 2 weeks |

Every class also needs age 18 or older. For prior therapy, a documented intolerance or contraindication with its reason also meets the rule. A diagnosis found only in a history or problem list, or stated as suspected, needs review. A different requested indication, with the class condition named nowhere, is not documented. The full rule text is in each criteria file.

## Statuses

- `evidence_found`: the page supports the fictional rule.
- `missing`: nothing on the page documents the required item. The evidence list is empty. Shown as "not documented".
- `needs_review`: the page addresses the item, but the evidence conflicts, is stale, is incomplete, falls short of the rule, or can be read two ways. Cite what is there.

Neither status is a denial. The tool never approves or denies coverage.

## Scenarios

| Criterion | Scenarios and the status each produces |
| --- | --- |
| Adult | supported (found), minor age 17 (review), age absent (not documented), age field blank (not documented) |
| Diagnosis | named as the reason (found), misspelled but valid (found), handwritten on the form (found), history only (review), suspected or possible (review), psoriasis without moderate-to-severe severity (review), different indication (not documented), field blank (not documented) |
| Lab | in window and threshold (found), handwritten note (found), outside 180 days (review), below threshold (review), two request dates (review), lab page missing (not documented), field blank (not documented) |
| Prior therapy | drug, dose, at least 90 days and values that miss the goal (found), intolerance with reason (found), contraindication with reason (found), bare "inadequate response" (review), under 90 days (review), no dates (review), follow-up already at goal (review), intolerance without a reason (review), look-alike drug name (review), atorvastatin 10 mg (review), wrong drug class (not documented), history page missing or field blank (not documented) |
| Dose | matches the rule in any format (found), handwritten on the form (found), letter and medication list differ (review), wrong frequency or regimen (review), dose absent or blank (not documented) |

A numeric date that can be read month first or day first is a scenario of its own. Five packets write every date with both numbers at 12 or less. In two of them a typed fax-style received date rules out one reading. In three nothing does, and the lab and prior therapy labels need review because the two readings give different answers.

## Format variation

- **Dates:** 2026-10-01, 10/01/2026, 10-1-26, day-first 01/10/2026, 1 Oct 2026 and Oct 1, 2026, plus handwritten 4/1/26. A day above 12 anywhere on the page settles the order for the page.
- **Drugs:** generic, brand, brand with generic in parentheses, and one-letter misspellings a pharmacist would accept, such as "atorvastatn" and "metfromin". One packet writes "Trexan", a real naltrexone brand one letter from "Trexall". A pharmacist would clarify that, not accept it.
- **Doses:** "140 mg" and "140mg", routes SC, subcut, subcutaneous, SQ and PO, frequencies such as q2wk, Q14D, EOW, every other week, BID, qd and q7d, and sigs such as "500 mg tablets, 2 tabs PO BID".
- **Layout:** a provider letter, or a prior authorization form with labeled fields. Blank fields are drawn as underscores.
- **Conditions:** full names, abbreviations such as T2DM and ASCVD, synonyms such as coronary artery disease with prior stent, and misspellings such as "psoraisis".
- **Labs:** A1c, HbA1c, Hemoglobin A1c, BSA, body surface area, LDL-C, LDL and LDL-c, with "collected", "drawn", "measured" or "on".

Each packet's tags list its variations so results break out by them.

## Groups and page rendering

Pages are typed in one of three bundled fonts, cycling within each group: Roboto Mono, Liberation Sans and DejaVu Sans. Each page is then changed as its group says. Nothing is printed, faxed or scanned. All randomness is seeded by packet ID.

| Group | Packets | Effect |
| --- | --- | --- |
| Clean render | 001 to 005 | Light speckle only |
| Simulated 7-degree rotation | 006 to 010 | Simulated fax noise, page rotated 7 degrees |
| AI-drawn handwriting (image model) | 011 to 015 | Medication history replaced by an AI-drawn handwriting image, simulated fax noise |
| Simulated fax noise | 016 to 023 | 650 seeded speckles and five faint horizontal streaks |
| Simulated choppy scan lines | 024 to 031 | Fax noise plus shifted row bands, dropped white lines and dark lines |
| Simulated smudges | 032 to 039 | Light speckle plus blurred gray smudges and a toner streak |
| Simulated low contrast | 040 to 047 | Gray ink on gray paper, contrast compressed, slight blur |
| Simulated page orientation | 048 to 055 | Fax noise, page turned 180 degrees (four), 90 degrees (two) or 270 degrees (two) |
| Printed page with AI-drawn notes, circles and arrows | 056 to 063 | Typed page, AI-drawn handwritten fills and margin notes, drawn circles, arrows and underlines, fax noise |

## AI-drawn handwriting

Seven images came from Codex's built-in image generation on 2 November 2026, one at a time, with no retries. Five are medication-history blocks in different hands, one of them deliberately hard to read. Two are sheets of five short notes each, cut apart along blank rows. The record in `handwriting/handwriting.json` holds each prompt, the tool and model, the date, the original file's sha256, the stored grayscale copy's sha256, and the crop boxes.

Gold text follows what each image shows. Every image was read character by character and cross-checked with Tesseract. One image drew an arrow character where the prompt asked for "->", so its gold uses the arrow. This is AI-drawn handwriting, not a real person's handwriting.

### Adding Kevin's own handwriting later

Three to five photos of Kevin's handwriting can join as a separate group labeled as his:

1. Write short lines on plain white paper in black pen, using only fictional content, such as "Repatha 140 mg SC q2wk" or "A1c 8.9 % on 7/20/26". Photograph each flat in even light.
2. Save the photos under `eval/handwriting/images/kevin-01.png` and so on, as grayscale PNG.
3. Add an entry per photo to `handwriting/handwriting.json` with `"tool": "Photo of Kevin Madden's handwriting"`, the date, the sha256, the lines as written, and a content box.
4. Add a group such as `kevin-handwriting`, labeled "Kevin's handwriting (photos)", to `GROUPS` in the generator, and plan its packets like the AI-drawn group, using the photo lines as the source text.
5. Run `npm run generate` and `npm run eval -- --rebuild`, then report that group separately from the AI-drawn one.

## Offsets

Read the Markdown as UTF-8 and remove everything through `<!-- SOURCE START -->` and the newline after it. Offsets count Unicode code points in the rest, start inclusive and end exclusive, and every span satisfies `body[start:end] == text`. Spans are whole lines. Lines are at most 80 characters, so the renderer never wraps them.

## Checks

The generator stops if a scenario gives an unintended status, if an ambiguous-date packet resolves differently than designed, or if a resolved reading disagrees with the true date. Tests check exact spans, the label balance, Kevin's carry-over, and that a rebuild reproduces every file. These checks confirm construction, not clinical correctness.

Keep this set for development and review practice. Results on it are development results. The held-out set in `eval/holdout` was written by a different model from `eval/holdout/SPEC.md` alone and was the test of whether the rules generalize until 3 November 2026. It is frozen by sha256 in `eval/holdout/FREEZE.json`. From 3 November the reading rules are being changed after seeing it, so it is development data, and its one blind score is kept in `eval/holdout/results/first-score.json`. A second held-out set, written blind, takes its place. Rules must not be tuned against a held-out set.
