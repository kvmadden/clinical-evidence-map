# Held-out packet spec

This is the complete brief given to the authoring model. It holds the criteria, the labeling rubric, the format axes and the page degradation list. It holds no generator or pipeline code and no example packets from the development set.

## Task

Write 24 new synthetic one-page prior-authorization packets and a draft label for each of their 5 criteria. Write 8 packets for each criteria set. These packets test whether a document-reading tool generalizes, so use your own phrasings, layouts, abbreviations and section orders. Do not copy any wording from this brief into packet text except drug, condition and lab names.

## Safety

- Every person is invented. Write each person's name followed by "(fictional)". Use invented prescribers too.
- No real clinics, payers, companies, addresses, phone numbers, emails, member numbers, record numbers, dates of birth or real patient details.
- Do not quote any real payer policy.

## Fictional criteria

Each packet requests one drug and is judged against one criteria set. The adult rule is the same for all three sets.

### GLP-1 for type 2 diabetes (criteria_id glp1-t2d)

- adult: Age is at least 18 years.
- diagnosis: Type 2 diabetes is documented as the reason for this request. A condition found only in a history or problem list, a suspected diagnosis, or a different requested indication does not meet this rule.
- lab: An A1c result is documented within 180 days before the request.
- prior: Metformin at a stated dose for at least 90 days, with an A1c on or before the start and an A1c at least 90 days after the start that is still 7.0% or higher. A documented intolerance or contraindication to metformin, with its reason, also meets this rule.
- dose: The requested semaglutide dose is 0.5 mg weekly.

### Biologic for plaque psoriasis (criteria_id biologic-psoriasis)

- adult: Age is at least 18 years.
- diagnosis: Moderate-to-severe plaque psoriasis is documented as the reason for this request. Psoriasis without that severity, a condition found only in a history or problem list, a suspected diagnosis, or a different requested indication does not meet this rule.
- lab: Body surface area involvement is at least 10%, measured within 180 days before the request.
- prior: Methotrexate at a stated dose for at least 90 days, with body surface area on or before the start and at least 90 days after the start that is still above 3%. A documented intolerance or contraindication to methotrexate, with its reason, also meets this rule.
- dose: The requested adalimumab maintenance dose is 40 mg every other week.

### PCSK9 inhibitor (criteria_id pcsk9)

- adult: Age is at least 18 years.
- diagnosis: Established atherosclerotic cardiovascular disease is documented as the reason for this request. A condition found only in a history or problem list, a suspected diagnosis, or a different requested indication does not meet this rule.
- lab: LDL-C is at least 70 mg/dL, measured within 180 days before the request.
- prior: Atorvastatin 40 or 80 mg daily for at least 90 days, with LDL-C on or before the start and at least 90 days after the start that is still 70 mg/dL or higher. A documented statin intolerance or contraindication, with its reason, also meets this rule.
- dose: The requested evolocumab dose is 140 mg every 2 weeks.

## Statuses

- evidence_found: the page supports the rule.
- missing: nothing on the page documents the required item. evidence_lines is empty. A blank field counts as missing.
- needs_review: the page addresses the item, but the evidence conflicts, is stale, is incomplete, falls short of the rule, is unconfirmed, or can be read two ways with different results.

Judge only from the page, as a careful pharmacist reviewer would.

## Rubric details

- Adult: age 18 or older is evidence_found. A stated age under 18 is needs_review. No age is missing.
- Diagnosis: the class condition must be named as the reason for this request, in the request, the indication field, or a note that ties it to this request. Found only in a history or problem list: needs_review. Suspected, possible or rule out: needs_review. Plaque psoriasis without moderate-to-severe severity, or mild: needs_review. A different requested indication, with the class condition named nowhere: missing. A synonym a pharmacist accepts counts, for example T2DM, coronary artery disease with a stent or prior myocardial infarction for established ASCVD.
- Lab: use the request date. Any qualifying value anywhere on the page counts, including one inside the medication history. Within 180 days before the request and meeting the threshold: evidence_found. Older than 180 days, dated after the request, or below the threshold: needs_review. Two different request dates on the page: needs_review. No value: missing.
- Prior therapy: evidence_found needs the named drug at a stated dose for at least 90 days, from dates or a stated duration, a value on or before the start, and a value at least 90 days after the start that still misses the goal. A documented intolerance or contraindication to the named drug, with its reason, is also evidence_found. Needs_review: "inadequate response" or "failed" without before and after values, under 90 days, no dates or duration, a follow-up value already at goal, intolerance without a reason, a name that could be a different drug, or for the PCSK9 set atorvastatin below 40 mg. Missing: no trial of the named drug at all, including a trial of a drug from a different class.
- Goals for prior therapy: A1c below 7.0%, body surface area 3% or less, LDL-C below 70 mg/dL. A follow-up value at or past the goal is "at goal".
- Dose: the requested dose matches the rule in any written form, for example "0.5mg SQ q7d" for 0.5 mg weekly: evidence_found. A different dose or frequency: needs_review. The request and a medication list on the page disagree: needs_review. No dose for the requested drug: missing.
- Numeric dates such as 04/05/2026 can be read month first or day first when both numbers are 12 or less. If another numeric date on the page has a day above 12, read the page that way. Otherwise, if a later received date on the page rules out one order because it would put a date after the received date, use the other order. Otherwise the date stays ambiguous, and if the two readings give different statuses for a criterion, label it needs_review.
- evidence_lines: copy each supporting line exactly and completely from the packet text, one entry per line. Use an empty list for missing.

## Format axes to vary

- Layouts: SOAP note, referral letter in paragraphs, table-like rows with "|" separators, checkbox lines such as "[x] tried", question and answer forms, pharmacy intake sheet, insurer-style request form, progress note with vitals. Use at least six different layouts.
- Section order: change it. Put medication history before labs in some packets. Leave out sections in some.
- Labels and headings: vary them, for example "Pt age", "Dx", "ICD-10", "Rx requested", "Sig", "Med trials", "Hx", "Plan".
- Dates: many formats, for example 2026-10-03, 10/3/2026, 3.10.2026, 03-Oct-2026, October 3 2026 and 10/03/26. Requests fall between September and November 2026. Include at least three packets whose numeric dates stay ambiguous with nothing on the page to settle them, and at least two that a day above 12 or a received date settles.
- Drug names: generic, brand and common abbreviations. Doses with and without a space, routes such as SC, SQ, subQ and PO, and frequency codes such as QW, q7d, Q2W, q14d, every 2 wks, BID, b.i.d., QD and nightly. Some sigs with tablet counts.
- A few misspellings a pharmacist would still accept. At most one look-alike drug name.
- Blank fields written as underscores, "N/A" or "not provided".
- Lab names and units in varied forms, for example HbA1c, A1C=, LDL, LDL-C, mg/dl, BSA, %BSA.
- Gaps must be common. Across all 120 labels aim for about half evidence_found, about a fifth missing and the rest needs_review. At least two packets have no criterion with evidence_found. Most packets have one to three criteria without evidence_found.
- Each line at most 78 characters. 15 to 40 lines per packet.

## Page rendering

The pages will be drawn later by a separate program. Pick one render value per packet and use a mix:

- clean: typed page, light speckle
- fax-noise: speckles and faint horizontal streaks
- choppy: shifted row bands, dropped white lines and dark lines
- smudge: blurred gray smudges and a toner streak
- low-contrast: gray ink on gray paper
- rotate-7: page rotated 7 degrees
- turn-180, turn-90, turn-270: page turned
- annotations: drawn circles, arrows and underlines over the typed text

## Output

Return one JSON object that matches the schema, with packet_id values holdout-01 to holdout-24, and nothing else.
