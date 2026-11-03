# Stage D reader

The reading rules were rebuilt in stage D: the privacy step, the document model, extraction, evidence linking and `processText` inside. `processText` keeps its signature. This page says what changed, why, and what the numbers do and do not show.

**Synthetic only. Labels are drafts, pending pharmacist review.** Every number below is a development result. The first held-out set became development data on 3 November 2026, when these rules started changing after seeing it. The headline number comes from the second held-out set, written blind and frozen before its first run, which nobody who changed these rules read. On its one blind run, on 3 November 2026, these rules got 85 of 120 statuses correct, against 49 for always answering "found". See [the evaluation](EVALUATION.md).

## Rule one: "not documented" is a claim about the whole packet

Kevin's rule: answer "not documented" only after every page arrived, every page was readable, every line was understood or ruled irrelevant, and nothing mentions the item. A field shown blank also answers for itself. Otherwise the answer is needs review, and the reason names what blocked the read.

The reader keeps a ledger for this. Each line it does not turn into evidence is checked against each criterion's words, such as "age", "A1c" or "metformin", including common OCR misreads such as "Alc". A line that mentions a criterion and was not read becomes a blocker for that criterion. A line with low-confidence OCR words blocks the criteria whose words it resembles. If it resembles none, it is ruled irrelevant when most of its words were read with good confidence, and it blocks every criterion when most were not. A readable label that is not about any criterion, such as "Request prepared" or "Visit date", rules its line out. Pages that the page reader's coverage record says did not arrive, could not be read, or that the page counters cannot account for block every "not documented" answer. A clinical word the privacy step removed blocks the criteria it belongs to. An outcome such as "Stopped for nausea" that names no drug blocks the prior-therapy answer.

Blockers only stop "not documented". They do not stop "evidence found", with one exception: a medication-list line for the requested drug whose dose could not be read, or an unreadable line in a medication history, stops a found dose answer, because it could list a different dose.

The coverage record is the one `services/ocr/coverage.ts` builds from the OCR output. A page the counters say did not arrive, a total the counters disagree on, pages out of order, and a page with no words or with most of its lines read below the review threshold each block every "not documented" answer. A found answer stands on an incomplete packet, and the reader's coverage says so in `complete` and `incomplete`.

## What else changed

- **A layout-aware document model** (`services/extract/document.ts`). Lines become headings, key-value fields with ":", "|", "?", "=" or " - ", table rows bound to their header, for pipe tables and aligned columns, checkbox items with their state, question and answer pairs, SOAP parts and prose. A value that wraps onto the next line is joined to its field, and both lines stay citable. A line holding only `<<page>>` or a form feed is a page break, never text. Scanned boxes read as "[ 1" or "[]1" are still boxes.
- **Assertion context** (`services/extract/context.ts`). Every condition mention carries who it is about, negation before and after the term, uncertainty, history, hypothetical wording, checked or unchecked state and the role of its section. A condition is the reason for this request only when the request field, a checked request item, a request sentence or a back-reference such as "This assessment is the reason for this request" ties it there.
- **Drug-linked treatment episodes.** Each prior drug mention opens a course, and the lines that follow join it while they describe it. A line that names one drug joins that drug's course. Dates, durations, values and outcomes belong to their course, so a side effect of one drug never counts for another. "Stopped for an inadequate response" is an efficacy outcome, not an intolerance. A goal comparison such as "goal below 7.0 % not met" describes the values and never stands in for them. A drug named with nothing about a course, such as "Metformin is not contraindicated", is a mention, not a trial.
- **Structured regimens** (`services/extract/regimen.ts`). Amounts, units, routes and sig codes such as QW, q7d, every 7 days, Q2W, q14d, every other week, every 2 wks, every four weeks, monthly, BID, nightly and daily read into one canonical form. Titrations keep every step and count the final one. A medication list at an earlier titration step agrees with the request. A stated correction supersedes. Request statements that disagree send the dose to review with both quotes. A dose with no leading zero, a decimal comma, an offer of two doses, or an amount that is not a marketed dose goes to review.
- **Request and received dates.** More labels and written forms, such as "Submitted", "Prepared", "13-Oct-2026", "October 13 2026" and "13 October 2026". Two different request dates send the lab window to review, as the rubric says. The numeric date order is settled page by page, and a fax received date applies to the whole packet. A date OCR could not read becomes `[date]` and blocks what it dated.
- **Labs.** Table rows, "=" and "was" forms, OCR names such as HbAlc and Alc, values bound to their own dates, reference ranges and goals never read as results, another analyte ending the value list, LDL-C in mmol/L converted, A1c in mmol/mol converted, and pending, hemolyzed or "see attached" results kept as blockers instead of values.
- **Privacy.** A name now needs name-like context: a patient, prescriber or signature field, an honorific, a credential, a "(fictional)" marker, a relation word or a name column in a table. Clinical and form words are never names. A split name across a line break is still caught, but a form word or a field label is never half of one.
- **PCSK9 prior therapy.** Kevin's ruling of 2 November 2026: a high-intensity statin counts, which is atorvastatin 40 or 80 mg or rosuvastatin 20 or 40 mg daily. A documented intolerance or contraindication to any statin, with its reason, counts. The rule text in `scripts/generate.ts` and `eval/criteria/pcsk9.json` now says so. `eval/holdout/SPEC.md` is unchanged, because it is the brief the first held-out set was written from. No packet in either set uses rosuvastatin, so no saved score depends on the change.

## Review round, 3 November 2026

GPT 6.1 Sol and Grok 4.7 reviewed the reader on synthetic probes and raised 21 distinct findings, one of them raised by both. Every finding but the rosuvastatin ruling is a test in `tests/review-round.test.ts`, with the reviewer's text and at least two variants. The 19 tests for the findings that held up all failed on the code before the fixes. The test for the refuted finding passed before and after. The reader now fails safe in each case:

- A negation at the head of a comma list covers its items when "or", "nor" or "and" closes the list. When nothing closes it, whether the negation reaches an item cannot be told, and the item goes to review.
- Who a mention is about is read within its own clause, from a relation word before it or right after it. A relative's lab result or age never counts for the patient, and goes to review when it is the only one. An indication written as past history goes to review.
- In the request's own fields, a relative's condition, a possibility, an unchecked option, a box whose mark could not be read, or a negation of unclear reach goes to review. An unchecked or ruled-out condition beside another named indication stays not documented, because the request then names something else.
- A value written as a bound, such as "<70" or "<= 80", is judged as a bound, for the lab threshold and for whether a trial missed its goal.
- A trial needs readable dates on its baseline and follow-up values, and nothing in the course dated after the request. Stopping for a high A1c or LDL is lack of effect, not intolerance. A question about the drug answered "No" documents that no trial was made. A planned or declined course is still no trial, as the spec says, so it can be not documented.
- A line that starts with the requested drug and tells history, such as "Semaglutide 0.5 mg weekly failed after 3 months", is not the request. A dose written as illegible blocks "not documented". The OCR gate looks at the drug name and the lab name as well as the value.
- A capitalized lab label alone on its line owns the value on the next line, and a capitalized line can finish an open diagnosis.
- A blank field answers only for itself. A missing or unreadable page, or another unread line about the item, still blocks "not documented".
- When no coverage record is passed, `processText` builds one from the OCR output, or for plain text from the page counters written in it.
- A person field removes a lowercase name. Clinical abbreviations such as CAD, MI and T2DM are never names.

Two findings were not taken as defects. A strength on a line for another recognized drug, such as lisinopril, already did not block dose or prior, and the test shows it. A strength beside a drug name OCR garbled beyond recognition still blocks both, because the name may be the step drug. The same finding was right that the docs contradicted each other, and they now match the code. The other is rosuvastatin, which stays counted by Kevin's ruling of 2 November. The first held-out set's spec names atorvastatin only, so the second held-out set's spec has to say which rule its labels follow.

## Decisions

These are decisions 27 to 33 in [the decision log](DECISIONS.md), after the pages work's 22 to 26.

27. "Not documented" needs the whole packet read. A blocker names the line or page that stopped it, and a field shown blank answers for itself unless another line mentions the item and could not be read. A missing, unreadable or out-of-order page blocks every "not documented" answer. A found answer stands, and the packet is marked incomplete.
28. A low-confidence line blocks only the criteria whose words it resembles. A line resembling none is ruled irrelevant when most of its words were read with good confidence.
29. Prior therapy is read as drug-linked courses. An outcome with no drug counts for no drug.
30. The rule counts 90 days from the start to the follow-up value. With no start date, and no stop date and duration to give one, that cannot be checked, so the answer is needs review. A follow-up value with no wording is placed by its date against the start.
31. Severity is never inferred from a measure. "Plaque psoriasis, BSA 15%" without a stated moderate-to-severe severity needs review.
32. An approximate age needs review. An age removed by the privacy step as over 89 is an adult age.
33. When the reader cannot tell scope, subject or date, it answers needs review and names why, never found or not documented on a guess. A blank field answers only for itself.

## Before and after

All counts are criterion statuses against the draft labels. "False not documented" counts answers of not documented where the label is evidence found or needs review. "False found" counts answers of evidence found where the label is not.

Development set, 63 packets, OCR run. Development results before and after.

| Criterion | Before | After | False not documented, before to after | False found, before to after |
| --- | --- | --- | --- | --- |
| All | 264 / 315 | 266 / 315 | 12 to 0 | 3 to 0 |
| Adult | 60 / 63 | 59 / 63 | 3 to 0 | 0 to 0 |
| Diagnosis | 61 / 63 | 59 / 63 | 1 to 0 | 0 to 0 |
| Lab | 51 / 63 | 53 / 63 | 2 to 0 | 0 to 0 |
| Prior | 46 / 63 | 48 / 63 | 4 to 0 | 0 to 0 |
| Dose | 46 / 63 | 47 / 63 | 2 to 0 | 3 to 0 |

The always-found baseline is 164 / 315. Label status against answer, after, for all 315: of 164 found labels, 124 found and 40 review. Of 57 not documented labels, 48 not documented and 9 review. Of 94 review labels, 94 review. Before: of 164 found labels, 121 found, 7 not documented and 36 review. Of 57 not documented labels, 57 not documented. Of 94 review labels, 3 found, 5 not documented and 86 review.

First held-out set, 24 packets, OCR run. The before column is its one blind score, from 2 November. The after column is a development result, because these rules were changed after seeing these packets.

| Criterion | Before, blind | After, development | False not documented, before to after | False found, before to after |
| --- | --- | --- | --- | --- |
| All | 37 / 120 | 110 / 120 | 71 to 0 | 1 to 0 |
| Adult | 11 / 24 | 24 / 24 | 13 to 0 | 0 to 0 |
| Diagnosis | 3 / 24 | 24 / 24 | 21 to 0 | 0 to 0 |
| Lab | 9 / 24 | 19 / 24 | 4 to 0 | 0 to 0 |
| Prior | 8 / 24 | 24 / 24 | 15 to 0 | 1 to 0 |
| Dose | 6 / 24 | 19 / 24 | 18 to 0 | 0 to 0 |

The always-found baseline is 60 / 120. After, of 60 found labels, 51 found and 9 review. Of 24 not documented labels, 23 not documented and 1 review. Of 36 review labels, 36 review.

Multi-page fixture, development text built from packet-018: 9 of 10 statuses after, with the pages work's coverage record. With page 2 never received, prior therapy goes to review and names the missing page, where the stage C rules answered "not documented". The one disagreement is the dose on that packet, labeled found on the pages received, which goes to review because OCR read "q2wk" with low confidence.

Source text with no OCR: development 315 / 315 before and after. First held-out set 40 / 120 blind before and 120 / 120 after, a development result.

Development probes, 249 in all: the 54 shared battery probes and the probes from the Claude, GPT and Grok evaluation reports, kept in `tests/fixtures/dev-probes.json`. The stage C reader passes 58 of 249, with 52 false found and 106 false not documented. This reader passes 249 of 249. Five expectations were adjudicated again in the review round of 3 November, all toward review, and the reader before that round passes 244 of 249 against them. They were written and adjudicated while it was built, so this shows it does what it was built to do, not that it generalizes. Where an expectation was changed from the report that wrote it, the probe's note says so.

Extraction on the development OCR run: precision 871 / 901 and recall 871 / 951, against 854 / 880 and 854 / 951 before. Over-redaction on OCR text, as `[name]` tokens with no word of a fictional name: development 6 before and 0 after, first held-out set 18 before and 0 after. No fictional name word or written date survives in the source or OCR text of any of the 87 packets, and no clinical word in the source text is removed, by `tests/privacy.test.ts`.

## What the review answers cost

Every remaining disagreement on both sets is an answer of needs review. On the development OCR run, 40 found labels went to review: 17 because a word the answer rests on was read with low OCR confidence, 14 because OCR misread a date, a dose or a value, 6 because the line holding the item could not be read at all, and 3 because a medication-list line that could disagree could not be read. 9 not documented labels went to review under rule one, because an unread line or page could hold the item. On the first held-out set, 9 found labels went to review, 4 on low-confidence words and 5 on OCR misreads, and 1 not documented label under rule one. These are the price of never claiming absence, or a clean match, that the packet does not show.

## Limits

- The relevance check for low-confidence lines is a word-similarity heuristic. It can rule out a line that holds the item in words it does not know, and it can block on a line that is only boilerplate.
- The fuzzy request-date labels, the scanned-box forms and the OCR sig codes such as "g2wk" are small fixed lists.
- Multi-page reading is tested only on the two fixtures built from one development packet. A missing page is noticed only when the pages carry a counter.
- The probes and both packet sets are development data. None of these numbers is a measure of generalization.
