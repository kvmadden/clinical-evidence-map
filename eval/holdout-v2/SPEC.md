# Held-out packet spec, version 2: realistic mixed packets

This is the complete brief given to each authoring model. It holds the criteria, the labeling rubric, the realism requirements and the page rendering list. It holds no pipeline code, no generator code and no packet from any earlier set.

## Task

Write 12 new synthetic prior-authorization (PA) packets, 4 for each criteria set, and a draft label for each of their 5 criteria. Each packet is what a payer's fax line receives for one request. These packets test whether a document-reading tool handles real-world pages, so make them hard in the ways real packets are hard. Use your own wording, layouts, abbreviations and section orders. Do not copy wording from this brief into packet text except drug, condition and lab names.

## Safety

- Every person is invented. Write each person's name followed by "(fictional)". Use invented prescribers, clinics and pharmacies too, also marked "(fictional)".
- No real clinics, payers, companies, addresses, phone numbers, emails, member numbers, record numbers, dates of birth or real patient details. Write any ID, phone or fax number as a run of X characters, for example "Member ID: XXXXXXXX".
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
- prior: High-intensity statin therapy, atorvastatin 40 or 80 mg daily or rosuvastatin 20 or 40 mg daily, for at least 90 days, with LDL-C on or before the start and at least 90 days after the start that is still 70 mg/dL or higher. A documented statin intolerance or contraindication, with its reason, also meets this rule.
- dose: The requested evolocumab dose is 140 mg every 2 weeks.

## Statuses

- evidence_found: the page supports the rule.
- missing: nothing on the page documents the required item. evidence_lines is empty. A blank field counts as missing.
- needs_review: the page addresses the item, but the evidence conflicts, is stale, is incomplete, falls short of the rule, is unconfirmed, or can be read two ways with different results.

Judge only from the page, as a careful pharmacist reviewer would.

Judge only from the packet, as a careful pharmacist reviewer would.

## Rubric details

- Adult: age 18 or older is evidence_found. A stated age under 18 is needs_review. No age is missing.
- Diagnosis: the class condition must be named as the reason for this request, in the request, the indication field, or a note that ties it to this request. Found only in a history or problem list: needs_review. Suspected, possible or rule out: needs_review. Plaque psoriasis without moderate-to-severe severity, or mild: needs_review. A different requested indication, with the class condition named nowhere: missing. A synonym a pharmacist accepts counts, for example T2DM, coronary artery disease with a stent or prior myocardial infarction for established ASCVD.
- Lab: use the request date. Any qualifying value anywhere on the page counts, including one inside the medication history. Within 180 days before the request and meeting the threshold: evidence_found. Older than 180 days, dated after the request, or below the threshold: needs_review. Two different request dates on the page: needs_review. No value: missing.
- Prior therapy: evidence_found needs the named drug at a stated dose for at least 90 days, from dates or a stated duration, a value on or before the start, and a value at least 90 days after the start that still misses the goal. A documented intolerance or contraindication to the named drug, with its reason, is also evidence_found. For the PCSK9 set the named drug is a high-intensity statin, atorvastatin or rosuvastatin. Needs_review: "inadequate response" or "failed" without before and after values, under 90 days, no dates or duration, a follow-up value already at goal, intolerance without a reason, a name that could be a different drug, or for the PCSK9 set atorvastatin below 40 mg or rosuvastatin below 20 mg. Missing: no trial of the named drug at all, including a trial of a drug from a different class.
- Goals for prior therapy: A1c below 7.0%, body surface area 3% or less, LDL-C below 70 mg/dL. A follow-up value at or past the goal is "at goal".
- Dose: the requested dose matches the rule in any written form, for example "0.5mg SQ q7d" for 0.5 mg weekly: evidence_found. A different dose or frequency: needs_review. The request and a medication list on the page disagree: needs_review. No dose for the requested drug: missing.
- Numeric dates such as 04/05/2026 can be read month first or day first when both numbers are 12 or less. If another numeric date on the page has a day above 12, read the page that way. Otherwise, if a later received date on the page rules out one order because it would put a date after the received date, use the other order. Otherwise the date stays ambiguous, and if the two readings give different statuses for a criterion, label it needs_review.
- evidence_lines: copy each supporting line exactly and completely from the packet text, one entry per line. Use an empty list for missing.

## What each packet must look like

- Pages: 2 to 4 fax pages. Start every page after the first with a line containing exactly <<page>> on its own. That line is a page break, not text. Each page holds at most 44 lines of at most 78 characters.
- A fax header line at the top of each page, in varied styles, for example "10/02/2026 14:31  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/003".
- Mix at least three document types across the pages, chosen from: fax cover sheet, payer PA request form with checkboxes and fill-in fields (some left blank), letter of medical necessity, EHR-printed clinic note (SOAP or narrative) with its header and footer, lab report table with result, flag, reference range and collection date, medication list or medication history table with dose, route, frequency, start, stop and status, pharmacy intake sheet, excerpt of an earlier denial letter, phone or nurse note.
- Notes from people, mixed in: an addendum, a "note to reviewer", a phone-call note ("per call with pt"), a nurse note, and text described as handwritten on the fax, written as a line that starts "Handwritten note:".
- Distractors on most packets: other conditions and drugs, family history that names the requested condition, old values, labs for other conditions, a request for a different drug in an earlier denial, copied-forward text.
- Conflicts and corrections on at least half the packets: the form and the letter disagree on dose or frequency, a value is corrected ("A1c 8.9%, corrected to 7.9%"), two different request dates, a lab dated after the request, a drug stopped and restarted.
- Negation and uncertainty: "denies", "no hx of", "r/o", "possible", "not on a statin", "N/A".
- Varied syntax: abbreviations, brand and generic names, sig codes (QW, q7d, q14d, Q2W, SQ, SC, subQ, PO, BID), units with and without spaces, a few misspellings a pharmacist would still accept, a value split across two lines, aligned columns and "|" tables, "[x]" and "[ ]" checkboxes, question and answer fields.
- Numeric dates in several formats. In at least one packet a numeric date stays ambiguous with nothing on the page to settle it, and in at least one a later received date settles it.
- Status mix across your 60 labels: about 40% evidence_found, 20% missing and 40% needs_review. At least one packet has no criterion with evidence_found, and at least one has every criterion found.
- evidence_lines: copy each supporting line exactly and completely from the packet text, one entry per line. Never use a <<page>> line. Use an empty list for missing.

## Page rendering

Pick one render value per packet and use a mix: clean, fax-noise, choppy, smudge, low-contrast, rotate-7, turn-180, turn-90, turn-270, annotations.

## Output

Return one JSON object and nothing else:
{"packets": [{"packet_id": "<id>", "criteria_id": "glp1-t2d|biologic-psoriasis|pcsk9", "render": "<render>", "text": "<the full packet text with \n line breaks>", "variation_notes": "<one sentence on what makes it hard>", "labels": [{"criterion_id": "adult|diagnosis|lab|prior|dose", "status": "evidence_found|missing|needs_review", "evidence_lines": ["..."], "reason": "<one sentence>"}]}]}
