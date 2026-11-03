You are a careful clinical pharmacist reviewer. Label 24 fictional prior-authorization packets against the fictional criteria below. Every person and organization is invented. Judge only from each packet, exactly as the rubric says. Do not use outside policy. A line containing only <<page>> is a page break, not text.

For each packet, give each of its 5 criteria (adult, diagnosis, lab, prior, dose) one status: evidence_found, missing or needs_review, the supporting lines copied exactly from the packet (empty list for missing) and one short reason.

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

## Packets

### holdout2-01 (criteria_id glp1-t2d)

```
10/02/2026  8:14 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/003
FAX COVER SHEET
To: Pharmacy Review Desk, Northwind Benefit Plan (fictional)
From: Harborlight Clinic (fictional)
Re: Prior auth, semaglutide, Mara Ellison (fictional)
Pages incl cover: 3 Urgency: standard
Member ID: XXXXXXXX Group: XXXXXXXX
Request date: 10/02/2026
Note to reviewer: chart excerpt and lab page follow.
--- PA REQUEST FORM (page 1 of 2) ---
Patient: Mara Ellison (fictional) Age: 62 years
Sex: F Weight: 91 kg Prescriber NPI: XXXXXXXX
Prescriber: Dr. Owen Pell (fictional)
Clinic: Harborlight Clinic (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug requested: semaglutide
Sig requested: 0.5 mg subQ q7d
Indication for this request: Type 2 diabetes
[x] New start [ ] Continuation [ ] Dose change
ICD notes (free text): E11.9 type 2 diabetes mellitus
Prior diabetes therapy tried? [x] yes [ ] no
Agent: metformin Dose: 1000 mg PO BID
Start: 01/06/2026 Stop: ongoing Status: current
A1c at or before start: 8.6% on 12/18/2025
Latest A1c: 7.8% on 06/22/2026
Contraindication to metformin? [ ] yes [x] no
Pharmacy: Quill Pharmacy (fictional)
NCPDP: XXXXXXXX
Handwritten note: pt prefers Sunday injections.
<<page>>
10/02/2026  8:14 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/003
HARBORLIGHT CLINIC (fictional) -- EHR NOTE
Patient: Mara Ellison (fictional) MRN: XXXXXXXX
Visit: 10/02/2026 Author: Dr. Owen Pell (fictional)
Location: Harborlight Clinic (fictional)
SUBJECTIVE
Follow-up for glucose control. Denies hypoglycemia.
Mother had type 2 diabetes; sister has hypothyriodism.
She is not pregnant. No hx of pancreatitis.
OBJECTIVE
Meds reconciled this visit (see list). Feet intact.
ASSESSMENT
1. Type 2 diabetes mellitus, A1c still above goal.
2. Hypertension. 3. Hypothyroidism, stable.
PLAN
Continue metformin. Start semaglutide 0.5 mg subQ q7d
for type 2 diabetes. PA submitted today, 10/02/2026.
Nurse note: taught pen use; pt repeated the steps.
Addendum 10/02/2026 Dr. Owen Pell (fictional):
Goal discussed as A1c under 7%. She agrees.
--- MEDICATION LIST (printed 10/02/2026) ---
Drug | Dose | Route | Freq | Start | Stop | Status
metformin | 1000 mg | PO | BID | 01/06/2026 | ongoing | current
lisinopril | 20 mg | PO | daily | 03/14/2024 | ongoing | current
levothyroxine | 75 mcg | PO | daily | 11/02/2019 | ongoing | current
atorvastatin | 20 mg | PO | QHS | 06/01/2024 | ongoing | current
semaglutide | 0.5 mg | subQ | q7d | pending | n/a | requested
Footer: Harborlight Clinic (fictional) MRN XXXXXXXX
Confidential. Page 2 of 3. End of EHR extract.
<<page>>
10/02/2026  8:14 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.003/003
QUILL LAB SERVICES (fictional) -- RESULT TABLE
Patient: Mara Ellison (fictional) MRN: XXXXXXXX
Ordering: Dr. Owen Pell (fictional)
Specimen lab report. Not a new request.
Test | Result | Flag | Ref range | Collected
A1c | 7.8% | H | 4.0-5.6% | 06/22/2026
A1c | 8.6% | H | 4.0-5.6% | 12/18/2025
TSH | 2.1 mIU/L | n/a | 0.4-4.5 | 06/22/2026
Creatinine | 0.9 mg/dL | n/a | 0.6-1.1 | 06/22/2026
eGFR | 78 mL/min | n/a | >60 | 06/22/2026
Comment: sample acceptable, no hemolysis.
Per call with pt on 09/28/2026: no missed metformin
doses this summer. Still taking 1000 mg PO BID.
Copied-forward annual note: flu shot due, eye exam
overdue, dental referral open. Ignore for this PA.
End of transmission. 3 pages. Harborlight Clinic (fictional)
```

### holdout2-02 (criteria_id glp1-t2d)

```
11/10/2026  9:10 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/003
FAX COVER -- BRAMBLE FAMILY PRACTICE (fictional)
To: Benefit Review, Cedar Span Plan (fictional)
From: Bramble Family Practice (fictional)
Re: semaglutide PA, Jules Kenner (fictional)
Member ID: XXXXXXXX Request date: 07/02/2026
Fax received: 11/10/2026 Pages: 3
Note to reviewer: weight-loss PA, see problem list.
------ REQUEST FORM ------
Patient: Jules Kenner (fictional)
Age: 17 years Sex: F
Prescriber: Dr. Nina Voss (fictional)
Clinic: Bramble Family Practice (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug: semaglutide
Requested sig: 1 mg SC weekly
Indication: chronic weight management
[x] New therapy [ ] Renewal
Allergies: N/A
A1c field: see attached lab
Pharmacy: Lampwick Pharmacy (fictional)
Handwritten note: mom is on the line with Jules (fictional).
Per call with pt: wants the higher weekly dose.
<<page>>
11/10/2026  9:10 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/003
BRAMBLE FAMILY PRACTICE (fictional) EHR PRINT
Patient: Jules Kenner (fictional) MRN: XXXXXXXX
Visit date: 03/04/2026
Author: Dr. Nina Voss (fictional)
SUBJECTIVE
Here for weight. Denies type 1 diabetes.
No hx of pancreatitis. Possible prediabetes was
mentioned last year and was not confirmed.
OBJECTIVE
BMI 34. Meds: glipizide 5 mg PO daily.
ASSESSMENT / PROBLEM LIST
1. Obesity, reason for today's semaglutide request
2. T2DM
3. Acne, mild
PLAN
Submit PA for semaglutide 1 mg SC weekly for
chronic weight management. Dietitian referral.
Glipizide start 06/05/2026, still current.
No stop date. Copied forward from last refill.
Footer: Bramble Family Practice (fictional)
MRN XXXXXXXX. Page 2 of 3.
<<page>>
11/10/2026  9:10 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.003/003
LAMPWICK LAB (fictional) RESULT
Patient: Jules Kenner (fictional) MRN: XXXXXXXX
Test | Result | Flag | Ref | Collected
A1c | 8.4% | H | 4.0-5.6% | 12/01/2025
TSH | 1.8 | n/a | 0.4-4.5 | 12/01/2025
Comment: fasting glucose 108 on the same draw.
No other A1c is on file at this lab.
------ PHARMACY INTAKE ------
Site: Lampwick Pharmacy (fictional)
Drug asked: semaglutide 1 mg SC weekly
Days supply: four weeks DAW: 0
Other meds on profile:
glipizide 5 mg PO daily
adapalene 0.1% topical QHS
End of fax. 3 pages. Bramble Family Practice (fictional)
```

### holdout2-03 (criteria_id glp1-t2d)

```
08/19/2026  10:05 AM  FROM: XXXXXXXXXX  TO: PA  P.001/003
COVER SHEET PINE HOLLOW OFFICE (fictional)
To: PA Desk, Grayheron Fund (fictional)
From: Pine Hollow Office (fictional)
Re: semaglutide, Sol Mercer (fictional)
Member ID: XXXXXXXX
Request date: 08/19/2026
Pages: 3
---- PA FORM ----
Patient: Sol Mercer (fictional)
Age: 48 years Sex: M
Prescriber: Dr. Ivo Trent (fictional)
Site: Pine Hollow Office (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Medication requested: semaglutide
Dose: ______ Frequency: ______
Route: ______
Indication: possible type 2 diabetes
[ ] Confirmed [x] Unconfirmed
Metformin: 500 mg PO BID
Start: 06/01/2026 Stop: 07/01/2026
Restart: 07/20/2026 Stop: ______
Response: inadequate response
Baseline A1c: ______
Follow-up A1c: ______
Pharmacy: Silt Apothecary (fictional)
[ ] Urgent [x] Routine
Allergies: N/A
<<page>>
08/19/2026  10:05 AM  FROM: XXXXXXXXXX  TO: PA  P.002/003
PINE HOLLOW OFFICE (fictional) SOAP NOTE
Patient: Sol Mercer (fictional) MRN: XXXXXXXX
DOS: 08/19/2026 Dr. Ivo Trent (fictional)
S: Fatigue. Denies polyuria. No hx of DKA.
O: BP 138 over 84. Weight 88 kg. Lungs clear.
A: Hyperglycemia. r/o type 2 diabetes.
   Also obesity and fatty liver on problem list.
P: Hold confirmation. Metformin was stopped and
   restarted; still short of a full course.
   Ask payer about semaglutide. Dose not chosen.
Addendum 08/19/2026, Dr. Ivo Trent (fictional):
Do not list a dose until titration is decided.
Copied-forward: colonoscopy due, tetanus due.
Nurse note: vial teaching deferred, no dose yet.
Footer MRN XXXXXXXX Pine Hollow Office (fictional)
<<page>>
08/19/2026  10:05 AM  FROM: XXXXXXXXXX  TO: PA  P.003/003
SILT APOTHECARY (fictional) INTAKE SHEET
Patient: Sol Mercer (fictional)
Member ID: XXXXXXXX
Product: semaglutide injection
Sig: (blank) Qty: (blank)
Prior agent on profile:
metformin 500 mg tablet BID
First fill 06/01/2026, last fill 07/01/2026,
then a new fill 07/20/2026. Gaps on profile.
Other meds: atorvastatin 10 mg QHS, vitamin D.
------ EARLIER DENIAL EXCERPT ------
Date of that denial: 04/22/2026
Drug denied: dulaglutide 0.75 mg weekly
This excerpt is an old file. It is not the
current semaglutide request.
End. Pine Hollow Office (fictional). 3 pages.
```

### holdout2-04 (criteria_id glp1-t2d)

```
03/20/2026  2:47 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/003
FAX COVER RED MAPLE ENDO (fictional)
To: Review Unit, Lowfern Benefits (fictional)
From: Red Maple Endo (fictional)
Re: semaglutide, Ada Quill (fictional)
Member ID: XXXXXXXX Pages: 3
Request date: 03/20/2026
---- FORM ----
Patient: Ada Quill (fictional) Age: 54 years
Prescriber: Dr. Leah Soto (fictional)
Clinic: Red Maple Endo (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug: semaglutide (Ozempic)
Requested dose: 1 mg SQ QW
Indication: Type 2 diabetes
[x] Continuation of orals [ ] Insulin now
Metformin dose: 1000 mg PO BID
Start date: 01/10/2025 Still taking: [x] yes
A1c before metformin: 9.1% (12/15/2024)
Pharmacy: Cobble Pharmacy (fictional)
Handwritten note: please rush, travel next month.
<<page>>
03/20/2026  2:47 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/003
LETTER OF MEDICAL NECESSITY
Red Maple Endo (fictional)
Dr. Leah Soto (fictional)
Re: Ada Quill (fictional), Member ID XXXXXXXX
I request semaglutide 1 mg SQ weekly for Type 2
diabetes. She has taken metformin 1000 mg PO BID
since 01/10/2025 without a stop.
A1c was 9.1% on 12/15/2024, before metformin.
On 06/18/2025 the lab read A1c 8.9%, corrected
to 7.9%. That remains above our 7% goal.
Family history: father with type 2 diabetes.
Also followed for hypothyriodism and gout.
Per call with pt on 03/18/2026: no GI stop, she
still swallows metformin twice a day.
Please approve the 1 mg weekly dose.
Signed Dr. Leah Soto (fictional) 03/20/2026
<<page>>
03/20/2026  2:47 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.003/003
COBBLE LAB (fictional) REPORT
Patient: Ada Quill (fictional) MRN: XXXXXXXX
Test | Result | Flag | Range | Collected
A1c | 9.1% | H | 4.0-5.6% | 12/15/2024
A1c | 7.9% | H | 4.0-5.6% | 06/18/2025
Note: original 8.9% corrected to 7.9% that day.
TSH | 3.4 | n/a | 0.4-4.5 | 06/18/2025
Urate | 7.2 mg/dL | H | 3.5-7.0 | 06/18/2025
No A1c collected after 06/18/2025.
---- DENIAL EXCERPT (prior file) ----
Denied 11/02/2025. Drug: dulaglutide 0.75 mg QW.
Different product. Not this semaglutide request.
End of fax. Red Maple Endo (fictional).
```

### holdout2-05 (criteria_id biologic-psoriasis)

```
09/22/2026  11:05 AM  FROM: XXXXXXXXXX  TO: PA  P.001/003
COVER FERN DERM CLINIC (fictional)
To: Specialty PA, Holm Plan (fictional)
From: Fern Derm Clinic (fictional)
Re: adalimumab, Rio Sanchez (fictional)
Member ID: XXXXXXXX
Request date: 09/22/2026
---- PA FORM ----
Patient: Rio Sanchez (fictional)
Age: ______ Sex: F
Prescriber: Dr. Pam Okada (fictional)
Clinic: Fern Derm Clinic (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug: adalimumab (Humira)
Dose requested: 40 mg SC every week
Indication: mild plaque psoriasis
BSA percent: ______
Methotrexate: 15 mg PO weekly
Dates used: not recorded
Outcome: failed
[x] New start [ ] Reauth
Pharmacy: Wick Pharmacy (fictional)
Note to reviewer: photos were not faxed.
Allergies: N/A
<<page>>
09/22/2026  11:05 AM  FROM: XXXXXXXXXX  TO: PA  P.002/003
FERN DERM CLINIC (fictional) NOTE
Patient: Rio Sanchez (fictional) MRN: XXXXXXXX
Visit: 09/22/2026 Dr. Pam Okada (fictional)
S: Itchy plaques on elbows. Denies joint pain.
   No hx of psoriatic arthritis.
O: Few thin plaques. Severity described as mild.
   Body surface area field left empty.
A: Mild plaque psoriasis.
   Problem list also: eczema, seasonal alergies.
P: Start adalimumab 40 mg SC weekly.
   Methotrexate 15 mg weekly previously failed.
   Length of that trial was not charted.
Nurse note: pt declined photos today.
Family history: mother has psoriasis.
Footer Fern Derm Clinic (fictional) MRN XXXXXXXX
<<page>>
09/22/2026  11:05 AM  FROM: XXXXXXXXXX  TO: PA  P.003/003
WICK PHARMACY (fictional) INTAKE
Patient: Rio Sanchez (fictional)
Fill request: adalimumab 40 mg weekly
Other profile meds:
methotrexate 15 mg PO weekly status: inactive
betamethasone ointment BID status: current
cetirizine 10 mg daily status: current
---- DENIAL EXCERPT ----
On 01/28/2026 a request for secukinumab was
denied. That drug is not the current request.
Copied-forward reminder: eye exam overdue.
Handwritten note: scale is mostly on the elbows.
End of fax. 3 pages. Fern Derm Clinic (fictional)
```

### holdout2-06 (criteria_id biologic-psoriasis)

```
05/08/2026  9:05 AM  FROM: XXXXXXXXXX  TO: PA UNIT  P.001/003
COVER YARROW SKIN OFFICE (fictional)
To: PA Unit, Smallstone Plan (fictional)
From: Yarrow Skin Office (fictional)
Re: adalimumab, Noa Pellam (fictional)
Member ID: XXXXXXXX Pages: 3
Request date: 07/04/2026
Fax received: 05/08/2026
---- PA FORM ----
Patient: Noa Pellam (fictional)
Age: 41 years Sex: F
Prescriber: Dr. Seth Amar (fictional)
Clinic: Yarrow Skin Office (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug requested: adalimumab
Dose: ______ Frequency: ______
Indication: moderate-to-severe plaque psoriasis
BSA: 14% Measured: 03/02/2026
Methotrexate 15 mg PO QW
Start 01/02/2026 stop 01/11/2026
Restart 02/01/2026 stop 02/03/2026
Reason stopped: not stated
Pharmacy: Nettle Pharmacy (fictional)
<<page>>
05/08/2026  9:05 AM  FROM: XXXXXXXXXX  TO: PA UNIT  P.002/003
YARROW SKIN OFFICE (fictional) EHR NOTE
Patient: Noa Pellam (fictional) MRN: XXXXXXXX
Encounter: 07/04/2026
Author: Dr. Seth Amar (fictional)
S: Plaques persist. Denies fever. No joint pain.
O: Body surface area involvement 14% on 03/02/2026.
A: Moderate-to-severe plaque psoriasis, this request.
P: Request adalimumab. Maintenance dose not chosen
   on this draft. Do not infer a dose.
   Methotrexate 15 mg PO QW was stopped 01/11/2026
   and restarted 02/01/2026 through 02/03/2026.
Addendum 07/04/2026 Dr. Seth Amar (fictional):
Duration of methotrexate was under three months.
Handwritten note: elbows and scalp are the worst.
Footer Yarrow Skin Office (fictional) page 2 of 3
<<page>>
05/08/2026  9:05 AM  FROM: XXXXXXXXXX  TO: PA UNIT  P.003/003
NETTLE PHARMACY (fictional) MED LIST
Patient: Noa Pellam (fictional)
Drug | Dose | Route | Freq | Start | Stop | Status
methotrexate | 15 mg | PO | QW | 01/02/2026 | 01/11/2026 | stopped
methotrexate | 15 mg | PO | QW | 02/01/2026 | 02/03/2026 | stopped
triamcinolone 0.1% ointment status: current
adalimumab | no dose | SC | blank | pending | requested
Per call with pt 07/04/2026: she is home now.
Copied-forward: flu shot deferred.
End. 3 pages. Yarrow Skin Office (fictional)
```

### holdout2-07 (criteria_id biologic-psoriasis)

```
08/19/2026  3:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/003
COVER LOOMIS DERM (fictional)
To: Biologic PA, Northcap Plan (fictional)
From: Loomis Derm (fictional)
Re: adalimumab, Teo Brant (fictional)
Member ID: XXXXXXXX Pages: 3
---- PA FORM ----
Patient: Teo Brant (fictional) Age: 15 years
Prescriber: Dr. Uma Shah (fictional)
Clinic: Loomis Derm (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug: adalimumab
Sig: 40 mg SC Q2W
Indication: moderate-to-severe plaque psoriasis
Request date: 08/19/2026
Prior systemic: apremilast 30 mg PO BID
Phototherapy: narrowband UVB last winter
BSA today: see measures page
[x] New start
Pharmacy: Kiln Pharmacy (fictional)
<<page>>
08/19/2026  3:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/003
LETTER OF MEDICAL NECESSITY
Loomis Derm (fictional)
Dr. Uma Shah (fictional)
Re: Teo Brant (fictional) Member ID XXXXXXXX
Request date: 02/11/2026
Please approve adalimumab 40 mg every other week
for moderate-to-severe plaque psoriasis.
The form cover shows a different request date.
I am not correcting either date in this letter.
Apremilast 30 mg PO BID was tried for acne only,
not as a psoriasis failure with measures.
Per call with pt: itching is worse at night.
Denies joint swelling. No hx of uveitis.
Family history: father with psoriasis.
Signed Dr. Uma Shah (fictional)
<<page>>
08/19/2026  3:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.003/003
LOOMIS DERM (fictional) MEASURES
Patient: Teo Brant (fictional) MRN: XXXXXXXX
Measure | Value | Flag | Range | Date
BSA involvement | 16% | H | n/a | 07/28/2026
CBC | within ref | n/a | n/a | 07/28/2026
Nurse note: BSA estimated with the palm method.
Problem list: acne, mild seborrhea.
Copied-forward: sports physical form unsigned.
Handwritten note: rash spares the face.
---- OLD DENIAL EXCERPT ----
Denied 12/14/2025 for secukinumab 300 mg.
Not the drug on today's adalimumab request.
End. Loomis Derm (fictional). 3 pages.
```

### holdout2-08 (criteria_id biologic-psoriasis)

```
09/25/2026  4:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/003
COVER HOLLIS OFFICE (fictional)
To: Specialty Review, Birch Fund (fictional)
From: Hollis Office (fictional)
Re: adalimumab, Wynn Calder (fictional)
Member ID: XXXXXXXX
Request date: 09/25/2026
---- PA FORM ----
Patient: Wynn Calder (fictional) Age: 39 years
Prescriber: Dr. Nedal Ruiz (fictional)
Clinic: Hollis Office (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug: adalimumab
Sig on form: 40 mg subQ Q2W
Indication: hidradenitis suppurativa
BSA involvement: 15% on 08/14/2026
Prior: methotrexate, outcome failed
MTX dose: unknown MTX dates: unknown
[x] New start
Pharmacy: Cinder Pharmacy (fictional)
Nurse note: form signed in the room today.
<<page>>
09/25/2026  4:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/003
LETTER OF MEDICAL NECESSITY
Hollis Office (fictional)
Dr. Nedal Ruiz (fictional)
Re: Wynn Calder (fictional) Member XXXXXXXX
Request date: 09/25/2026
Please authorize adalimumab 40 mg every week
for hidradenitis suppurativa. Drains continue.
The attached form lists a different frequency.
I am leaving both frequencies on this fax.
Methotrexate was failed. No dose and no dates
were written in the outside records I hold.
Body surface area involvement remains 15%.
Measured 08/14/2026. No earlier BSA is filed.
Denies fever. No hx of bowel disease.
Signed Dr. Nedal Ruiz (fictional)
<<page>>
09/25/2026  4:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.003/003
HOLLIS OFFICE (fictional) CLINIC NOTE
Patient: Wynn Calder (fictional) MRN: XXXXXXXX
Visit: 09/25/2026 Dr. Nedal Ruiz (fictional)
S: Painful nodules in the axillae and groin.
O: BSA involvement 15%, unchanged from 08/14/2026.
A: Hidradenitis suppurativa, reason for request.
P: Adalimumab. See form and letter; they disagree
   on weekly versus every other week.
Med list:
doxycycline 100 mg PO BID status: current
adalimumab pending, two sigs on this fax
Copied-forward: tetanus booster due.
Handwritten note: odor worse in summer.
End. Hollis Office (fictional). 3 pages.
```

### holdout2-09 (criteria_id pcsk9)

```
10/16/2026  8:05 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/003
COVER RIDGE HEART CLINIC (fictional)
To: Cardiology PA, Ironwharf Plan (fictional)
From: Ridge Heart Clinic (fictional)
Re: evolocumab, Ellis Dumar (fictional)
Member ID: XXXXXXXX Pages: 3
Request date: 10/16/2026
---- PA FORM ----
Patient: Ellis Dumar (fictional) Age: 66 years
Prescriber: Dr. Cara Nguyen (fictional)
Clinic: Ridge Heart Clinic (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug requested: evolocumab
Dose: ______ Frequency: ______
Indication: severe hyperlipidemia
Problem list: CAD s/p stent (2019); HTN
Statin line: atorvastatin contraindicated
Reason: rhabdomyolysis, hospitalized 2024
Currently not on a statin.
LDL-C: ______
Pharmacy: Moor Pharmacy (fictional)
[x] New start [ ] Continuation
<<page>>
10/16/2026  8:05 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/003
RIDGE HEART CLINIC (fictional) SOAP
Patient: Ellis Dumar (fictional) MRN: XXXXXXXX
Visit: 10/16/2026 Dr. Cara Nguyen (fictional)
S: Here for cholesterol medicine. Denies chest
   pain this month. Sleeps well.
O: BP 142 over 80. Lungs clear. LDL not collected.
A: Severe hyperlipidemia, reason for this request.
   Problem list copied forward: CAD s/p stent,
   hypertension, seasonal rhinitis.
P: Request evolocumab. Dose still not selected.
   Do not substitute a dose from another chart.
Addendum 10/16/2026 Dr. Cara Nguyen (fictional):
Atorvastatin stays contraindicated. Reason remains
rhabdomyolysis from the 2024 admission.
Note to reviewer: lipid numbers are not in this fax.
<<page>>
10/16/2026  8:05 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.003/003
MOOR PHARMACY (fictional) INTAKE
Patient: Ellis Dumar (fictional)
Asked for: evolocumab
Sig: (blank) Qty: (blank)
Profile: not on a statin.
ezetimibe 10 mg PO daily status: current
metoprolol 25 mg PO BID status: current
---- LAB STUB (not lipids) ----
Test | Result | Flag | Range | Collected
A1c | 6.1% | n/a | 4.0-5.6% | 09/02/2026
This A1c is unrelated. LDL-C was not drawn.
---- DENIAL EXCERPT ----
Denied 05/19/2026. Drug: icosapent ethyl.
Different product, not evolocumab.
Handwritten note: bring the hospital summary.
End. Ridge Heart Clinic (fictional). 3 pages.
```

### holdout2-10 (criteria_id pcsk9)

```
09/30/2026  1:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/004
FAX COVER SLOPE LIPID CLINIC (fictional)
To: PA Dept, Copperline Plan (fictional)
From: Slope Lipid Clinic (fictional)
Re: evolocumab, Ari Mendel (fictional)
Member ID: XXXXXXXX
Request date: 09/30/2026
Pages: 4 Urgency: routine
Age on this cover: 17 years
Note to reviewer: clinic note lists another age.
Handwritten note: confirm which age is true.
Allergies: N/A
Pharmacy: Flint Pharmacy (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
<<page>>
09/30/2026  1:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/004
PA REQUEST FORM SLOPE LIPID CLINIC (fictional)
Patient: Ari Mendel (fictional)
Prescriber: Dr. Joan Ibek (fictional)
Clinic: Slope Lipid Clinic (fictional)
Drug: evolocumab (Repatha)
Sig: 140 mg SC q14d
Indication: familial hypercholesterolemia
[x] New start [ ] Renewal
Atorvastatin: 20 mg PO daily
Start: 01/15/2026 Stop: ongoing
LDL before start: 148 mg/dL on 01/08/2026
Latest LDL-C: 104 mg/dL on 08/21/2026
Other therapy: ezetimibe 10 mg PO daily
[ ] Statin intolerance box unchecked
<<page>>
09/30/2026  1:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.003/004
FLINT LAB (fictional) RESULT TABLE
Patient: Ari Mendel (fictional) MRN: XXXXXXXX
Test | Result | Flag | Range | Collected
LDL-C | 148 mg/dL | H | <100 | 01/08/2026
LDL-C | 104 mg/dL | H | <100 | 08/21/2026
HDL | 46 mg/dL | n/a | >40 | 08/21/2026
TG | 160 mg/dL | n/a | <150 | 08/21/2026
Comment: 01/08/2026 lipid is an older draw.
Family: mother has high cholesterol.
Collected by Flint Lab (fictional).
<<page>>
09/30/2026  1:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.004/004
SLOPE LIPID CLINIC (fictional) NOTE
Patient: Ari Mendel (fictional) MRN: XXXXXXXX
This is a 71-year-old seen 09/30/2026.
Author: Dr. Joan Ibek (fictional)
S: Wants help with familial hypercholesterolemia.
   Denies muscle pain on the current pill.
O: See lab table. Exam unremarkable.
A: Familial hypercholesterolemia, reason today.
P: Continue atorvastatin 20 mg PO daily.
   Start evolocumab 140 mg SC every 2 weeks.
Per call with pt: no missed evening pills.
Copied-forward: eye exam last year was normal.
End of fax. 4 pages. Slope Lipid Clinic (fictional)
```

### holdout2-11 (criteria_id pcsk9)

```
05/18/2026  9:05 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/003
COVER KEEL CARDIOLOGY (fictional)
To: PA Desk, Westmarrow Plan (fictional)
From: Keel Cardiology (fictional)
Re: evolocumab, Samir Holt (fictional)
Member ID: XXXXXXXX Pages: 3
Request date: 05/18/2026
---- PA FORM ----
Patient: Samir Holt (fictional) Age: 59 years
Prescriber: Dr. Lila Cho (fictional)
Clinic: Keel Cardiology (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug: evolocumab
Form sig: 140 mg SC every 2 weeks
Indication: established atherosclerotic
cardiovascular disease, prior myocardial
infarction, reason for this request
[x] New start
Pharmacy: Drift Pharmacy (fictional)
<<page>>
05/18/2026  9:05 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/003
KEEL CARDIOLOGY (fictional) EHR NOTE
Patient: Samir Holt (fictional) MRN: XXXXXXXX
Visit: 05/18/2026 Dr. Lila Cho (fictional)
S: Follow-up after myocardial infarction.
   Denies current chest pain.
O: Lungs clear. See labs below.
A: Established atherosclerotic cardiovascular
   disease. This visit's request is for that.
P: Evolocumab ordered. Nurse note: pen teaching
   booked, sig taken from the PA form.
---- LAB REPORT ----
Test | Result | Flag | Range | Collected
LDL-C | 98 mg/dL | H | <100 | 06/02/2026
LDL-C | 164 mg/dL | H | <100 | 11/20/2024
Comment: 06/02/2026 draw is after the request.
The 11/20/2024 draw is an old baseline.
<<page>>
05/18/2026  9:05 AM  FROM: XXXXXXXXXX  TO: PA DEPT  P.003/003
DRIFT PHARMACY (fictional) MED LIST
Patient: Samir Holt (fictional)
Drug | Dose | Route | Freq | Start | Status
ezetimibe | 10 mg | PO | daily | 02/02/2025 | current
metoprolol | 50 mg | PO | daily | 11/20/2024 | current
aspirin | 81 mg | PO | daily | 11/20/2024 | current
evolocumab | 420 mg | SC | monthly | pending | requested
Handwritten note: patient asked about monthly.
End. Keel Cardiology (fictional). 3 pages.
```

### holdout2-12 (criteria_id pcsk9)

```
10/28/2026  2:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/003
COVER MARL CLINIC (fictional)
To: Lipid PA, Stoneharbor Plan (fictional)
From: Marl Clinic (fictional)
Re: evolocumab, Juni Park (fictional)
Member ID: XXXXXXXX Pages: 3
Request date: 10/28/2026
---- PA FORM ----
Patient: Juni Park (fictional) Age: 16 years
Prescriber: Dr. Omar Velez (fictional)
Clinic: Marl Clinic (fictional)
Phone: XXXXXXXXXX Fax: XXXXXXXXXX
Drug: evolocumab
Sig: 140 mg subQ Q2W
Indication: hypercholesterolemia
[x] New start
Atorvastatin 10 mg PO daily
Start 02/01/2026 stop 04/01/2026
Restarted 04/20/2026, still taking
Pharmacy: Briar Pharmacy (fictional)
<<page>>
10/28/2026  2:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/003
MARL CLINIC (fictional) EHR NOTE
Patient: Juni Park (fictional) MRN: XXXXXXXX
Visit: 10/28/2026 Dr. Omar Velez (fictional)
S: Mother wants cholesterol treatment.
   Family history: father died of a myocardial
   infarction. Patient denies chest pain.
O: Exam benign. Labs on the next page.
A: Hypercholesterolemia is the reason for this
   evolocumab request.
PROBLEM LIST (copied forward, not reassessed)
1. Coronary artery disease
2. Hypertension
P: Continue atorvastatin 10 mg PO daily.
   Evolocumab 140 mg subQ every 2 weeks.
Addendum 10/28/2026 Dr. Omar Velez (fictional):
Pill was stopped in April and restarted; dose
has stayed 10 mg daily the whole time.
<<page>>
10/28/2026  2:05 PM  FROM: XXXXXXXXXX  TO: PA DEPT  P.003/003
BRIAR LAB (fictional) REPORT
Patient: Juni Park (fictional) MRN: XXXXXXXX
Test | Result | Flag | Range | Collected
LDL-C | 160 mg/dL | H | <100 | 01/20/2026
LDL-C | 91 mg/dL | H | <100 | 09/04/2026
HDL | 52 mg/dL | n/a | >40 | 09/04/2026
Comment: 01/20/2026 is before atorvastatin.
Handwritten note: mom says cholestrerol is high.
Per call with pt: still taking the 10 mg pill.
Copied-forward: dental cleaning overdue.
End. Marl Clinic (fictional). 3 pages.
```

### holdout2-13 (criteria_id glp1-t2d)

```
10/14/2026 09:12  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
======================================================================
PRIOR AUTHORIZATION FAX TRANSMISSION - URGENT REVIEW REQUESTED
Summit Internal Med (fictional) | Tel: XXXXXXXXXX | Fax: XXXXXXXXXX
Date: 10/14/2026 | Total Pages: 2 | Attention: Pharmacy PA Department
Patient: Harlan Jenks (fictional) | DOB: XX/XX/XXXX (Age: 52)
Member ID: XXXXXXXX | Group: XXXXXXXX | Dr. Brenda Vance, MD (fictional)
----------------------------------------------------------------------
MEDICATION REQUEST FORM - GLP-1 RECEPTOR AGONIST
Requested Drug: Ozempic (semaglutide)
Requested Dose & Sig: 0.5 mg SQ weekly
Quantity: 1 pen (2 mL) per 28 days | Refills: 3
Indication / Reason for Request: [x] Type 2 Diabetes Mellitus  [ ] Other
ICD-10 Code: E11.9 (Type 2 diabetes mellitus without complications)
Current HbA1c: 8.8% (collected 09/18/2026)
Prior Metformin Trial:
  - Metformin 1000 mg PO BID from 03/10/2026 to present (>6 months)
  - Pre-treatment A1c: 9.2% (03/02/2026)
  - Post-treatment A1c: 8.8% (09/18/2026) - persistent hyperglycemia
Note to reviewer: Metformin 1000 mg BID failed to achieve glycemic goal.
Prescriber Signature: Dr. Brenda Vance, MD (fictional)  Date: 10/14/2026
<<page>>
10/14/2026 09:12  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
Summit Internal Med (fictional) - OUTPATIENT PROGRESS NOTE
Patient: Harlan Jenks (fictional) | Age: 52 | Sex: M | Date: 09/18/2026
Provider: Dr. Brenda Vance, MD (fictional) | MRN: XXXXXXXX
----------------------------------------------------------------------
SUBJECTIVE: 52yo male with type 2 diabetes mellitus returns for follow-up.
Reports taking metformin 1000 mg twice daily with meals consistently.
Denies hypoglycemic episodes. Denies gastrointestinal side effects.
Home blood glucose logs run 160-220 mg/dL fasting.
CURRENT MEDICATIONS:
1. Metformin 1000 mg oral tablet, 1 tab PO BID with meals (start 03/10/2026)
2. Lisinopril 20 mg PO daily
3. Atorvastatin 20 mg PO daily
OBJECTIVE:
BP: 128/78 | HR: 72 | Wt: 218 lbs | BMI: 31.4 kg/m2
LAB RESULTS (Summit Labs (fictional), collected 09/18/2026):
  Hemoglobin A1c: 8.8 %  [HIGH]  (Ref: 4.0 - 5.6 %)
  Fasting Glucose: 174 mg/dL  [HIGH]  (Ref: 70 - 99 mg/dL)
ASSESSMENT & PLAN:
1. Type 2 diabetes mellitus, uncontrolled on oral monotherapy.
   - HbA1c remains elevated at 8.8% despite >6 months of metformin.
   - Pre-metformin baseline A1c was 9.2% on 03/02/2026.
   - Initiate Ozempic (semaglutide) 0.5 mg SQ weekly for glycemic control.
   - Continue metformin 1000 mg PO BID.
Electronically signed: Dr. Brenda Vance, MD (fictional) 09/18/2026 15:30
```

### holdout2-14 (criteria_id glp1-t2d)

```
11/22/2026 14:02  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
NORTHRIDGE ENDOCRINE ASSOCIATES (fictional) | FAX: XXXXXXXXXX
PRIOR AUTHORIZATION DRUG REQUEST FORM
Request Date: 11/12/2026 | Member ID: XXXXXXXX | Group #: XXXXXXXX
Patient Name: Arthur Pendelton (fictional) | Age: 58 | Sex: M
Prescriber: Dr. Robert K. Lang, MD (fictional) | NPI: XXXXXXXXXX
----------------------------------------------------------------------
DRUG REQUEST INFORMATION
Drug Name Requested: Ozempic (semaglutide subcutaneous solution)
Requested Dose: 1.0 mg weekly SQ
Directions for Use: Inject 1.0 mg subcutaneously once every 7 days
Primary Diagnosis for this Request: Suspected T2D, r/o type 2 diabetes
ICD-10 Code: R73.03 (Prediabetes)
Relevant Lab: HbA1c drawn 11/20/2026, see attached lab report
Metformin Status: Patient never prescribed metformin; started on SU
Clinical Rationale: Patient requires GLP-1 therapy for elevated sugars
Prescriber Signature: Dr. Robert K. Lang, MD (fictional)  11/12/2026
<<page>>
11/22/2026 14:02  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
NORTHRIDGE ENDOCRINE ASSOCIATES (fictional) | CLINICAL ATTACHMENTS
Patient: Arthur Pendelton (fictional) | Age: 58 | MRN: XXXXXXXX
----------------------------------------------------------------------
LAB REPORT - QUILLMOOR DIAGNOSTICS (fictional)
Specimen ID: XXXXXXXX | Collected: 11/20/2026 08:30 | Reported: 11/21/2026
Test Name             | Result | Units | Flag | Reference Interval
----------------------|--------|-------|------|-------------------
Hemoglobin A1c        | 8.1    | %     | H    | 4.8 - 5.6
Estimated Avg Glucose | 186    | mg/dL | H    | 70 - 126
----------------------------------------------------------------------
MEDICATION DISPENSE & ORDER HISTORY
Drug Name        | Dose    | Freq  | Start Date | Stop Date  | Status
-----------------|---------|-------|------------|------------|--------
Glimepiride      | 2 mg    | Daily | 05/01/2026 | 11/10/2026 | Stopped
Lisinopril       | 10 mg   | Daily | 01/15/2025 | Current    | Active
Omeprazole       | 20 mg   | Daily | 03/22/2025 | Current    | Active
----------------------------------------------------------------------
Nurse note: Per call with pt, pt states glimepiride causes afternoon
shakiness; pt confirms no hx of metformin use. Chart reviewed by
Nurse: Clara Higgins, RN (fictional) 11/12/2026.
```

### holdout2-15 (criteria_id glp1-t2d)

```
08/18/2026 10:14  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
VALLEY PEDIATRIC & ADOLESCENT SPECIALTY CENTER (fictional)
500 Xxxxxxxx Way, Xxxxx, XX XXXXX | Tel: XXXXXXXXXX | Fax: XXXXXXXXXX
----------------------------------------------------------------------
PRIOR AUTHORIZATION REQUEST & LETTER OF MEDICAL NECESSITY
Date of Request: 08/18/2026 | Member ID: XXXXXXXX | Group: XXXXXXXX
Patient Name: Lior Gallant (fictional) | Age: 17 years old
Prescriber: Dr. Evelyn Reed, MD (fictional) | Specialty: Endocrinology
----------------------------------------------------------------------
RE: Request for Ozempic (semaglutide)
Indication: Type 2 Diabetes Mellitus (ICD-10: E11.69)
Requested Dose: [ BLANK ] | Frequency: once weekly
Dear Reviewer,
I am writing to request prior authorization for Ozempic for Lior Gallant
(fictional), a 17-year-old patient under my care for type 2 diabetes.
Liam was initiated on metformin 1000 mg PO BID on 02/10/2026 with baseline
HbA1c of 9.4%. After 4 months of compliant therapy, repeat HbA1c on
06/15/2026 decreased to 6.7%. However, due to recent erratic fasting
glucose levels and concern for weight gain, we are requesting Ozempic.
Most recent clinic HbA1c was collected on 07/28/2026 (see clinic note).
Sincerely,
Dr. Evelyn Reed, MD (fictional)
<<page>>
08/18/2026 10:14  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
VALLEY PEDIATRIC & ADOLESCENT SPECIALTY CENTER (fictional)
CLINIC PROGRESS NOTE - ENDOCRINOLOGY
Patient: Lior Gallant (fictional) | Age: 17 | MRN: XXXXXXXX
Date of Visit: 07/28/2026 | Provider: Dr. Evelyn Reed, MD (fictional)
----------------------------------------------------------------------
DIAGNOSIS: Type 2 diabetes mellitus without acute complications (E11.9).
HISTORY OF PRESENT ILLNESS:
17yo male with established type 2 diabetes mellitus returns for follow-up.
Patient completed 4-month course of metformin 1000 mg BID (02/10/2026 to
06/15/2026). Baseline A1c was 9.4% (02/05/2026). Follow-up A1c was 6.7% on
06/15/2026, achieving goal. Metformin was discontinued due to patient
preference. Fasting blood glucoses have since rebounded.
LAB RESULTS - IN-CLINIC TESTING (07/28/2026):
HbA1c was initially transcribed as 8.9%, corrected to 8.4% per repeat run.
Result: Hemoglobin A1c 8.4% (Collected: 07/28/2026).
Glucose: 168 mg/dL.
MEDICATION ORDER:
Drug: Semaglutide (Ozempic) | Sig: SubQ weekly | Dispense: 1 pen
Note: Dose field left blank pending insurance approval and titration plan.
----------------------------------------------------------------------
Addendum: Dr. Evelyn Reed, MD (fictional) 07/28/2026 16:15 - A1c
transcription corrected in laboratory interface; verified 8.4%.
```

### holdout2-16 (criteria_id glp1-t2d)

```
09/05/2026 11:23  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
======================================================================
CLEARVIEW METABOLIC HEALTH (fictional) | FAX TRANSMISSION
TO: Prior Authorization Unit | FAX: XXXXXXXXXX
FROM: Dr. Samuel Park, MD (fictional) | CLINIC PHONE: XXXXXXXXXX
DATE: 09/05/2026 | TOTAL PAGES: 2
PATIENT: Beatrice Holloway (fictional) | ID: XXXXXXXX | GRP: XXXXXXXX
----------------------------------------------------------------------
PRIOR AUTHORIZATION REQUEST FORM - INCRETIN THERAPY
Requested Drug: Ozempic (semaglutide)
Requested Sig: 0.5 mg subcutaneously once weekly
Reason for Request / Requested Indication:
  [ ] Type 2 Diabetes Mellitus
  [x] Morbid Obesity with Metabolic Syndrome (BMI 38.2)
Past Medical History:
  - Essential hypertension (I10)
  - Type 2 diabetes mellitus (E11.9) - per past records
  - Dyslipidemia (E78.5)
Prior Therapies Tried:
  - Metformin: Patient intolerant to metformin (no reason documented)
  - Lifestyle modification and dietary counseling x 6 months
Handwritten note: Reviewer please check prior metformin intolerance.
Provider Signature: Dr. Samuel Park, MD (fictional) 09/05/2026
<<page>>
09/05/2026 11:23  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
OAKRIDGE SPECIALTY PHARMACY (fictional) | RX INTAKE & TRIAGE SHEET
Patient: Beatrice Holloway (fictional) | Rx#: XXXXXXXX | Date: 09/04/2026
Prescriber: Dr. Samuel Park, MD (fictional) | NPI: XXXXXXXXXX
----------------------------------------------------------------------
PRESCRIPTION DETAILS AS TRANSMITTED:
Rx Item: Semaglutide 2 mg/3 mL (Ozempic) pen injector
Directions: Inject 0.25 mg SQ once weekly for 4 weeks then re-evaluate
Quantity: 1 pen (3 mL) | Refills: 0 | Days Supply: 28
Prescriber Diagnosis Stated on Rx: Obesity (E66.01)
----------------------------------------------------------------------
CLINICAL INTAKE NOTES (Recorded by Pharmacy Staff, Oakridge (fictional)):
- Intake call with clinic: Confirmed patient cannot tolerate metformin.
  Specific adverse event or contraindication reason not provided in chart.
- No HbA1c lab result found in medical records transferred to pharmacy.
- Current weight: 236 lbs. Height: 66 in.
- Prescriber office confirms request is for weight reduction therapy.
Intake Pharmacist: Karen Price, PharmD (fictional) 09/04/2026
```

### holdout2-17 (criteria_id biologic-psoriasis)

```
06/22/2026 15:40  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
DERMATOLOGY ASSOCIATES OF THE VALLEY (fictional) | FAX: XXXXXXXXXX
BIOLOGIC PRIOR AUTHORIZATION FORM - PSORIASIS
Date: 06/22/2026 | Member ID: XXXXXXXX | Group: XXXXXXXX
Patient: Raylan Cheung (fictional) | DOB: XX/XX/XXXX (Age: 45) | Sex: M
Prescriber: Dr. Teresa Gomez, MD (fictional) | NPI: XXXXXXXXXX
----------------------------------------------------------------------
REQUESTED MEDICATION:
Medication: Humira (adalimumab) 40 mg/0.8 mL Pen
Requested Maintenance Dose: 40 mg SQ every other week (q14d)
----------------------------------------------------------------------
CLINICAL INFORMATION:
Requested Indication: Moderate-to-severe plaque psoriasis (L40.0)
Current Body Surface Area (BSA) Involved: 16% (measured 05/28/2026)
Affected Areas: Extensor surfaces of elbows, knees, scalp, back
Prior Systemic Therapy:
- Methotrexate 15 mg PO weekly from 01/10/2026 to 05/10/2026 (16 weeks)
  * Baseline BSA: 20% on 01/05/2026
  * Post-treatment BSA: 2.0% on 05/10/2026 (achieved clearance)
Handwritten note: Please note patient flare after tapering steroids.
----------------------------------------------------------------------
EXCERPT OF EARLIER DENIAL LETTER (Ref # XXXXXXXX, dated 03/15/2026):
"Coverage for Skyrizi was denied: Step therapy requires trial of adalimumab
prior to consideration of preferred interleukin inhibitors."
Prescriber Signature: Dr. Teresa Gomez, MD (fictional) 06/22/2026
<<page>>
06/22/2026 15:40  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
DERMATOLOGY ASSOCIATES OF THE VALLEY (fictional) - ENCOUNTER NOTE
Patient: Raylan Cheung (fictional) | Age: 45 | MRN: XXXXXXXX
Encounter Date: 05/28/2026 | Provider: Dr. Teresa Gomez, MD (fictional)
----------------------------------------------------------------------
REASON FOR VISIT: Severe flare of moderate-to-severe plaque psoriasis.
HISTORY: 45yo male with long-standing moderate-to-severe plaque psoriasis.
Patient was on oral methotrexate 15 mg weekly which cleared plaques
down to BSA 2.0% as of 05/10/2026. Medication held due to transaminitis.
Since stopping, patient has experienced a rapid rebound of plaques.
PHYSICAL EXAMINATION (05/28/2026):
Skin: Well-demarcated erythematous plaques with thick silvery scale
on elbows, knees, back, and scalp. Total BSA involvement is 16%.
ASSESSMENT & PLAN:
1. Moderate-to-severe plaque psoriasis - recurrent flaring.
   - Prescribe Humira (adalimumab) 40 mg subcutaneous injection weekly.
   - Submit PA for adalimumab maintenance.
Dr. Teresa Gomez, MD (fictional) - Signed electronically 05/28/2026
```

### holdout2-18 (criteria_id biologic-psoriasis)

```
10/18/2026 13:10  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
METRO DERMATOLOGY CENTER (fictional) | FAX COVER & PA TRANSMISSION
DATE: 10/18/2026 | TO: PRIOR AUTH REVIEW UNIT | FAX: XXXXXXXXXX
PATIENT: Cynthia Alvarez (fictional) | MEMBER ID: XXXXXXXX
PRESCRIBER: Dr. Nathan Cross, MD (fictional) | NPI: XXXXXXXXXX
----------------------------------------------------------------------
SPECIALTY MEDICATION PRIOR AUTHORIZATION FORM
Request Date: 10/18/2026
Medication Requested: Humira (adalimumab)
Dose & Administration: 40 mg SC every other week (q14d)
Indication for Therapy: Chronic plaque psoriasis, mild to localized
ICD-10: L40.0 (Psoriasis vulgaris)
Clinical Documentation of Involvement:
  - Body Surface Area (BSA): 11% (Exam Date: 02/20/2026)
Previous Medications Tried:
  - Betamethasone dipropionate 0.05% ointment BID x 12 weeks
  - Calcipotriene 0.005% cream daily x 8 weeks
  - Systemic methotrexate: None. Patient has never taken methotrexate.
Note to reviewer: Patient failed topicals and requests biologic therapy.
Prescriber Signature: Dr. Nathan Cross, MD (fictional) 10/18/2026
<<page>>
10/18/2026 13:10  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
METRO DERMATOLOGY CENTER (fictional) | TELEPHONE & ENCOUNTER NOTE
Patient: Cynthia Alvarez (fictional) | MRN: XXXXXXXX | Date: 10/18/2026
----------------------------------------------------------------------
CLINICAL ENCOUNTER SUMMARY (Visit Date: 02/20/2026):
History: Patient seen for follow-up of chronic plaque psoriasis.
Lesions localized mainly to elbows and shins. Denies joint pain.
Physical Exam (02/20/2026):
Erythematous scaly patches on bilateral knees and elbows.
Documented Body Surface Area: 11% involvement.
Plan from 02/20/2026: Continue topical regimens. Re-evaluate in fall.
----------------------------------------------------------------------
NURSE TELEPHONE NOTE (10/17/2026 14:20):
Nurse note: Per call with pt, pt reports frustration with topical creams
and wishes to start systemic biologic. Chart reviewed: no hx of
methotrexate or other oral immunosuppressive therapy documented.
Message relayed to Dr. Nathan Cross, MD (fictional). PA form generated.
Nurse: Amanda Bell, RN (fictional) 10/17/2026
```

### holdout2-19 (criteria_id biologic-psoriasis)

```
11/10/2026 08:45  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
LAKESIDE CLINICAL DERMATOLOGY (fictional) | LETTER OF MEDICAL NECESSITY
DATE: 11/10/2026 | TO: Prior Authorization Department | FAX: XXXXXXXXXX
PATIENT: Gregory Vance (fictional) | DOB: XX/XX/XXXX (Age: 39)
MEMBER ID: XXXXXXXX | PRESCRIBER: Dr. Allison Hayes, MD (fictional)
----------------------------------------------------------------------
RE: Prior Authorization for Humira (adalimumab)
Indication: Moderate-to-severe plaque psoriasis (ICD-10 L40.0)
Requested Regimen: Adalimumab 80 mg SQ every 2 weeks
Dear Reviewer,
I am requesting coverage of Humira 80 mg every 2 weeks for Gregory Vance
(fictional), a 39-year-old male with moderate-to-severe plaque psoriasis.
The patient previously tried and failed methotrexate with inadequate
response, but chart details regarding exact start dates and BSA scores
from the outside clinic were unavailable at the time of transfer.
Most recent clinical assessment documented body surface area of 12%.
Note to reviewer: Requesting higher maintenance dose of 80 mg due to BMI.
Sincerely,
Dr. Allison Hayes, MD (fictional) | NPI: XXXXXXXXXX
<<page>>
11/10/2026 08:45  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
LAKESIDE CLINICAL DERMATOLOGY (fictional) | EHR PROGRESS NOTE & LABS
Patient: Gregory Vance (fictional) | Age: 39 | MRN: XXXXXXXX
Date: 11/10/2026 | Provider: Dr. Allison Hayes, MD (fictional)
----------------------------------------------------------------------
ASSESSMENT: Moderate-to-severe plaque psoriasis, active flaring.
CLINICAL EVALUATION RECORD:
Evaluation Date | Parameter           | Finding  | Threshold
----------------|---------------------|----------|----------
05/06/2026      | Body Surface Area   | 12%      | >= 10%
05/06/2026      | Plaque Morphology   | Thick    | Scaling
11/10/2026      | TB QuantiFERON Gold | Negative | Negative
----------------------------------------------------------------------
MEDICATION TRIAL SUMMARY:
1. Methotrexate: Chart notes "failed methotrexate due to lack of efficacy".
   No specific dosage, baseline BSA, or follow-up BSA recorded.
2. Topical clobetasol 0.05% cream: Minimal temporary improvement.
PLAN:
Start adalimumab 80 mg subcutaneous injection every 2 weeks.
Dr. Allison Hayes, MD (fictional) 11/10/2026 09:15
```

### holdout2-20 (criteria_id biologic-psoriasis)

```
07/15/2026 12:05  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
WESTSIDE RHEUMATOLOGY & DERMATOLOGY (fictional) | PA SUBMISSION
DATE OF FAX: 07/15/2026 | TO: Prior Authorization Unit | FAX: XXXXXXXXXX
Patient Name: Douglas Miller (fictional) | Age: 51 | Gender: M
Member ID: XXXXXXXX | Group: XXXXXXXX | Dr. Karen West, MD (fictional)
----------------------------------------------------------------------
PA DRUG REQUEST FORM - BIOLOGIC IMMUNOMODULATOR
Requested Drug: Humira (adalimumab)
Requested Maintenance Dose: [                      ]  Frequency: [    ]
Primary Indication for this Request:
  [x] Psoriatic Arthritis with peripheral joint involvement (L40.50)
  [ ] Moderate-to-severe Plaque Psoriasis (L40.0)
Relevant Skin Involvement:
  - Chronic plaque psoriasis noted in history, mild skin plaques
  - BSA involved: 14% (Evaluated 06/08/2026)
Contraindications to Conventional DMARDs:
  - Methotrexate is strictly contraindicated due to biopsy-proven
    non-alcoholic cirrhosis and severe hepatic impairment (ALT 180 U/L).
Note to reviewer: Patient requires biologic therapy due to liver disease.
Prescriber Signature: Dr. Karen West, MD (fictional)  Date: 07/15/2026
<<page>>
07/15/2026 12:05  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
WESTSIDE RHEUMATOLOGY & DERMATOLOGY (fictional) | CLINICAL NOTE & LABS
Patient: Douglas Miller (fictional) | Age: 51 | MRN: XXXXXXXX
Visit Date: 06/08/2026 | Provider: Dr. Karen West, MD (fictional)
----------------------------------------------------------------------
CLINICAL ASSESSMENT: Psoriatic arthritis with peripheral joint disease.
Past Medical History: Plaque psoriasis, NASH cirrhosis with hypertension.
DERMATOLOGIC EXAM (06/08/2026):
Scattered erythematous scaly plaques on bilateral upper and lower limbs.
Calculated total body surface area (BSA) involvement: 14%.
LAB PANEL - LIVER FUNCTION & INFLAMMATORY (Collected 06/08/2026):
Test           | Result | Units | Flag | Reference Interval
---------------|--------|-------|------|-------------------
ALT (SGPT)     | 180    | U/L   | HIGH | 7 - 56
AST (SGOT)     | 165    | U/L   | HIGH | 10 - 40
Total Bilirubin| 2.4    | mg/dL | HIGH | 0.2 - 1.2
Albumin        | 3.1    | g/dL  | LOW  | 3.5 - 5.0
----------------------------------------------------------------------
Addendum: Dr. Karen West, MD (fictional) 07/15/2026 11:30 - Confirmed
hepatology consultation records reviewed; oral methotrexate contraindicated
due to advanced cirrhosis and elevated transaminases.
```

### holdout2-21 (criteria_id pcsk9)

```
10/24/2026 11:15  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
CARDIOVASCULAR SPECIALISTS OF NORTH TEXAS (fictional)
1200 Xxxxxxxx Blvd, Xxxxx, XX XXXXX | Tel: XXXXXXXXXX | Fax: XXXXXXXXXX
PRIOR AUTHORIZATION TRANSMISSION - PCSK9 INHIBITOR
Date: 10/24/2026 | Member ID: XXXXXXXX | Group ID: XXXXXXXX
Patient: Walter Fitzgerald (fictional) | Age: 64 | Gender: Male
Prescriber: Dr. Kenneth Sterling, MD (fictional) | NPI: XXXXXXXXXX
----------------------------------------------------------------------
MEDICATION REQUEST:
Requested Drug: Repatha (evolocumab) SureClick autoinjector
Requested Regimen: 140 mg subcutaneously every 2 weeks (q14d)
----------------------------------------------------------------------
CLINICAL INDICATION & HISTORY:
Indication: Established ASCVD (history of STEMI with DES to LAD in 2024)
ICD-10 Code: I25.10 (Atherosclerotic heart disease of native artery)
Lipid Panel Results (Drawn 09/25/2026):
  - Total Cholesterol: 210 mg/dL
  - LDL-C: 128 mg/dL (Goal < 70 mg/dL for secondary prevention)
  - HDL-C: 42 mg/dL | Triglycerides: 200 mg/dL
Prior Statin Trial:
  - Atorvastatin 80 mg daily PO taken from 03/15/2026 to present (>6 mos)
  - Pre-treatment LDL-C: 182 mg/dL (03/01/2026)
  - On-treatment follow-up LDL-C: 128 mg/dL (09/25/2026) (misses goal)
Note to reviewer: Patient remains at very high cardiovascular risk.
Signature: Dr. Kenneth Sterling, MD (fictional) 10/24/2026
<<page>>
10/24/2026 11:15  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
CARDIOVASCULAR SPECIALISTS OF NORTH TEXAS (fictional)
PATIENT MEDICATION PROFILE & CLINICAL SUMMARY
Patient: Walter Fitzgerald (fictional) | Age: 64 | MRN: XXXXXXXX
Date: 10/24/2026 | Attending: Dr. Kenneth Sterling, MD (fictional)
----------------------------------------------------------------------
ACTIVE MEDICATION ORDERS:
Medication Name      | Dose    | Route | Frequency | Start Date | Status
---------------------|---------|-------|-----------|------------|--------
Atorvastatin calcium | 80 mg   | Oral  | Daily     | 03/15/2026 | Active
Aspirin EC           | 81 mg   | Oral  | Daily     | 01/10/2024 | Active
Metoprolol succinate | 50 mg   | Oral  | Daily     | 01/10/2024 | Active
Evolocumab (Repatha) | 420 mg  | SubQ  | Monthly   | 10/24/2026 | Pending
----------------------------------------------------------------------
CLINICAL PROGRESS NOTE EXCERPT (09/25/2026):
Assessment: Established atherosclerotic cardiovascular disease with prior
myocardial infarction and percutaneous coronary intervention.
Hyperlipidemia not adequately controlled on high-intensity statin
(atorvastatin 80 mg daily x 6 months). LDL-C remains elevated at
128 mg/dL. Recommending addition of PCSK9 inhibitor therapy.
```

### holdout2-22 (criteria_id pcsk9)

```
05/14/2026 16:30  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
PREMIER CARDIOLOGY GROUP (fictional) | FAX: XXXXXXXXXX
PRIOR AUTHORIZATION REQUEST - PCSK9 INHIBITOR
Date: 05/14/2026 | Member ID: XXXXXXXX | Group: XXXXXXXX
Patient Name: Gordie Benning (fictional) | Sex: M
Prescriber: Dr. Patricia Neal, MD (fictional) | NPI: XXXXXXXXXX
----------------------------------------------------------------------
MEDICATION DETAILS:
Drug Requested: Repatha (evolocumab)
Requested Dose: [                      ]  Frequency: [               ]
----------------------------------------------------------------------
CLINICAL INDICATION:
Requested Indication: Primary Hypercholesterolemia (ICD-10: E78.00)
Problem List:
  1. Atherosclerotic heart disease (I25.10) - diagnosed 2021
  2. Essential hypertension (I10)
Most Recent Lipid Panel (Lab Date: 04/20/2026):
  - Total Cholesterol: 140 mg/dL
  - LDL-C: 62 mg/dL
  - HDL-C: 48 mg/dL | Triglycerides: 150 mg/dL
Statin Regimen:
  - Atorvastatin 20 mg PO daily from 11/01/2025 to present (>5 months)
Handwritten note: Reviewer please note patient cannot take high statin.
Prescriber Signature: Dr. Patricia Neal, MD (fictional) 05/14/2026
<<page>>
05/14/2026 16:30  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
PREMIER CARDIOLOGY GROUP (fictional) | ENCOUNTER NOTE & PRIOR DENIAL
Patient: Gordie Benning (fictional) | MRN: XXXXXXXX | Date: 04/20/2026
Attending: Dr. Patricia Neal, MD (fictional)
----------------------------------------------------------------------
HISTORY & ASSESSMENT:
Patient presents for routine lipid evaluation. Denies chest pain.
Currently taking atorvastatin 20 mg daily. High-intensity statin
(40-80 mg) not prescribed due to patient concern regarding myalgias.
Lab review from today shows LDL-C is 62 mg/dL.
PLAN:
Request Repatha for additional LDL lowering. Maintain atorvastatin 20 mg.
----------------------------------------------------------------------
EXCERPT OF PRIOR PAYER DETERMINATION (Dated 01/18/2026):
"Denial Notice: Prior authorization for Praluent 75 mg was denied due to
lack of trial of high-intensity statin therapy (atorvastatin 40-80 mg or
rosuvastatin 20-40 mg daily)."
```

### holdout2-23 (criteria_id pcsk9)

```
10/15/2026 14:22  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
UNIVERSITY CARDIOLOGY CLINIC (fictional) | FAX COVER SHEET
DATE: 08/10/2026 | TO: PRIOR AUTH DEPARTMENT | FAX: XXXXXXXXXX
PATIENT: Leon Sarno (fictional) | DOB: XX/XX/XXXX (Age: 62) | M
MEMBER ID: XXXXXXXX | PRESCRIBER: Dr. Miriam Vance, MD (fictional)
----------------------------------------------------------------------
PRIOR AUTHORIZATION REQUEST FORM - PCSK9 INHIBITORS
Official Request Date: 10/15/2026
Medication Requested: Repatha (evolocumab)
Dose & Route: 140 mg SC every 2 weeks
Diagnosis / Reason for Request:
  Suspected ASCVD, rule out coronary artery disease (R94.31)
Clinical Documentation:
  - Patient experiencing exertional dyspnea, stress test equivocal
  - Recent LDL-C: 142 mg/dL (Collected 09/01/2026)
Prior Statin Therapy:
  - Statin trial: NONE. Patient not on a statin.
  - Non-statin trial: Ezetimibe 10 mg daily x 6 months
Prescriber Signature: Dr. Miriam Vance, MD (fictional) 10/15/2026
<<page>>
10/15/2026 14:22  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
UNIVERSITY CARDIOLOGY CLINIC (fictional) | LABORATORY REPORT & NOTES
Patient: Leon Sarno (fictional) | Age: 62 | MRN: XXXXXXXX
----------------------------------------------------------------------
LAB PANEL: COMPREHENSIVE LIPID PROFILE
Lab Order Date: 09/01/2026 | Performing Lab: Uplands Health (fictional)
Test Component     | Value | Units | Flag | Reference Range
-------------------|-------|-------|------|----------------
Cholesterol, Total | 234   | mg/dL | HIGH | 100 - 199
Triglycerides      | 188   | mg/dL | HIGH | 0 - 149
HDL Cholesterol    | 39    | mg/dL | LOW  | > 40
LDL-Cholesterol    | 142   | mg/dL | HIGH | < 100
----------------------------------------------------------------------
Nurse note: Patient clarified no statin taken due to personal aversion
to statins. Chart review confirms no prescription history for
atorvastatin or rosuvastatin. Only ezetimibe 10 mg was dispensed.
Nurse: Jason Miller, RN (fictional) 10/15/2026
```

### holdout2-24 (criteria_id pcsk9)

```
07/20/2026 15:50  FROM: XXXXXXXXXX  TO: PA DEPT  P.001/002
VASCULAR & CARDIOLOGY HEALTH PARTNERS (fictional)
LETTER OF MEDICAL NECESSITY - PRIOR AUTHORIZATION REQUEST
Date: 07/20/2026 | To: Payer PA Review Team | Fax: XXXXXXXXXX
Patient: Dara Pruett (fictional) | Member ID: XXXXXXXX
Prescriber: Dr. Brian Holt, MD (fictional) | NPI: XXXXXXXXXX
----------------------------------------------------------------------
RE: Request for Evolocumab (Repatha)
Indication: Established ASCVD - severe peripheral artery disease status post
left femoral-popliteal bypass graft (ICD-10: I70.212).
Requested Regimen: Repatha SubQ injection - Dose: [      ] Freq: [      ]
Dear Reviewer,
I am requesting authorization for Repatha for Dara Pruett (fictional),
who has established atherosclerotic cardiovascular disease manifest as
symptomatic peripheral arterial disease requiring bypass surgery.
Patient previously took atorvastatin 40 mg daily but discontinued due to
severe calf cramping. After a statin holiday, she was restarted on
rosuvastatin 20 mg daily 45 days ago (started 06/05/2026).
Pre-treatment LDL-C on 05/20/2026 was 130 mg/dL.
Sincerely,
Dr. Brian Holt, MD (fictional) 07/20/2026
<<page>>
07/20/2026 15:50  FROM: XXXXXXXXXX  TO: PA DEPT  P.002/002
VASCULAR & CARDIOLOGY HEALTH PARTNERS (fictional) | EHR RECORD
Patient: Dara Pruett (fictional) | MRN: XXXXXXXX | Date: 07/20/2026
Provider: Dr. Brian Holt, MD (fictional)
----------------------------------------------------------------------
MEDICATION PROFILE:
Drug Name       | Dose  | Freq  | Start Date | Stop Date  | Indication
----------------|-------|-------|------------|------------|-----------
Rosuvastatin    | 20 mg | Daily | 06/05/2026 | Active     | ASCVD
Clopidogrel     | 75 mg | Daily | 03/12/2025 | Active     | PAD
Cilostazol      | 100 mg| BID   | 04/10/2025 | Active     | Claudication
----------------------------------------------------------------------
CLINICAL LABS & PROGRESS NOTE:
Specimen collected 07/10/2026.
LDL-C was initially reported as 84 mg/dL, corrected to 68 mg/dL
per direct beta-quantification analysis (Ref range: < 70 mg/dL).
Triglycerides: 280 mg/dL | HDL-C: 44 mg/dL
----------------------------------------------------------------------
Addendum: Dr. Brian Holt, MD (fictional) 07/20/2026 14:10 - LDL calculation
corrected following ultracentrifugation; true LDL-C is 68 mg/dL.
Rosuvastatin 20 mg tolerated for 45 days to date; continuation ordered.
```

## Output

Return only JSON Lines, one line per packet, in packet order, nothing before or after:
{"packet_id": "holdout2-01", "labels": {"adult": {"status": "...", "lines": ["..."], "reason": "..."}, "diagnosis": {...}, "lab": {...}, "prior": {...}, "dose": {...}}}

Never run terminal commands and do not write or edit files. Your final message must be the 24 JSON Lines themselves and nothing else.
