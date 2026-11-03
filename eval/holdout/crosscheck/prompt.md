You are a careful clinical pharmacist reviewer. Label 24 fictional prior-authorization packets against the fictional criteria below. Every person and clinic is invented. Judge only from each page, exactly as the rubric says. Do not use outside policy.

For each packet, give each of its 5 criteria (adult, diagnosis, lab, prior, dose) one status: evidence_found, missing or needs_review. Today's date does not matter: use the dates on the page. For each label give the supporting lines copied exactly from the packet (empty list for missing) and one short reason.

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

## Packets

### holdout-01 (criteria_id glp1-t2d)

```
ENDOCRINE SOAP
Patient: Mira Velden (fictional)
Clinician: Dr. Oren Tavis (fictional)
Request entered: 2026-10-03
Age: 54 years
S: Glucose remains elevated despite regular tablets.
O: Weight stable; hydration adequate.
HbA1c: 8.1% on 2026-09-18
A: T2DM is the indication for this semaglutide request.
P: Semaglutide 0.5mg SQ q7d.
Medication course:
Metformin 1000 mg PO BID, 2026-01-10 through 2026-09-30.
A1c before first tablet: 9.0% on 2026-01-09.
A1c during treatment: 8.4% on 2026-05-12.
Adherence discussed; patient reports taking both daily doses.
Electronic attestation: Oren Tavis (fictional)
```

### holdout-02 (criteria_id glp1-t2d)

```
THERAPY REFERRAL
Written September 22 2026
Re: Jalen Orwick (fictional)
From: Dr. Sera Nollin (fictional)
Jalen is 39 years old and returns for glucose management.
Please authorize semaglutide for type 2 diabetes.
The prescription is 0.5 mg subQ once each week.
Previous treatment was reviewed with the patient.
Metformin 500mg b.i.d. was taken for four months.
It was stopped for an inadequate response.
No pretreatment or on-treatment A1c was supplied for that course.
Current HbA1c is 7.8%, sampled September 15 2026.
The patient prefers an injection to an additional daily tablet.
Teaching will occur at the next visit.
Signed: Sera Nollin (fictional)
```

### holdout-03 (criteria_id glp1-t2d)

```
MEDICATION DESK | REVIEW COPY
Person | Tessa Brindle (fictional)
Writer | Dr. Ivo Merlan (fictional)
Submission | 03-Nov-2026
Years of age | 62
Product | semaglutide
Strength and schedule | not provided
Purpose | weight reduction
Archived problems | type 2 diabetes; knee pain
Chemistry | A1C=7.6% | 20-Oct-2026
Earlier tablets | metopformin 500 mg twice daily
Time on earlier tablets | about five months
Response | glucose remained high
Diet counseling | completed
Return visit | pending
Writer initials | Ivo Merlan (fictional)
```

### holdout-04 (criteria_id glp1-t2d)

```
INJECTION CHECKLIST
Prepared: October 16 2026
Patient: Niko Pellan (fictional)
Prescriber: Dr. Vela Corwin (fictional)
[x] Age confirmed: 28 years
[x] Treating type 2 diabetes with this semaglutide order
[x] Prescription: semaglutide 1 mg SC QW
[ ] A1c attachment: ____
Medication discussion:
[x] Sitagliptin 100 mg QD used for six months
[x] Home glucose log reviewed
[ ] Other oral medication course: ____
[x] Injection teaching requested
[ ] Follow-up appointment: ____
Attested by Vela Corwin (fictional)
```

### holdout-05 (criteria_id glp1-t2d)

```
PRESCRIPTION QUESTIONS
Completed: 2026-09-29
Name? Elia Vossel (fictional)
Author? Dr. Remy Dalven (fictional)
Age? ____
Which injectable? semaglutide
Why now? Possible type 2 diabetes; confirmation pending.
What strength? ____
How often? ____
Recent laboratory result? N/A
Previous glucose medicine? Metformin 500 mg PO nightly.
How long? Six weeks, then discontinued.
Why discontinued? Patient preference.
Before and after A1c? not provided
Author signature: Remy Dalven (fictional)
```

### holdout-06 (criteria_id glp1-t2d)

```
DISPENSING INTAKE
Entry date: 09/10/2026
Patient: Kori Thalen (fictional)
Ordering clinician: Dr. Aven Ruskell (fictional)
Age stated: 17 years
Requested agent: semaglutide
Reason for treatment: appetite suppression
Order directions: 0.25mg SQ q7d
Laboratory slip:
HbA1c 7.4% collected 04/03/2026
Medication exposure:
Glipizide 5 mg QD for eight months
Meals reviewed with patient.
Counseling visit requested.
End of intake.
```

### holdout-07 (criteria_id glp1-t2d)

```
TREATMENT ACCESS FORM
Patient: Dena Marwick (fictional)
Prescriber: Dr. Lior Fenway (fictional)
Request date: 10/03/2026
Age today: 47
Requested indication: type 2 diabetes
Requested drug: semaglutide
Requested sig: 0.5 mg SC every seven days
Reconciled medication list:
Semaglutide 1mg SC weekly, marked active
Metformin intolerance: persistent diarrhea despite dose reduction.
HbA1c 8.3% drawn 09/18/2026
Injection technique reviewed verbally.
Supply quantity: four injections
Signed: Lior Fenway (fictional)
```

### holdout-08 (criteria_id glp1-t2d)

```
FOLLOW-UP PROGRESS
Date of request: 5 November 2026
Patient: Rowan Elist (fictional)
Seen by: Dr. Mina Torven (fictional)
Age 71; pulse 76; seated comfortably.
Assessment: probable T2DM, further diagnostic review planned.
Semaglutide is being sought for the probable T2DM.
Plan: semaglutide 0.5 mg subQ QW.
Treatment record:
Metformin 850mg BID from 1 March through 1 October 2026.
A1c on 28 February 2026: 8.2%.
A1c on 15 June 2026: 6.8%.
Most recent HbA1c: 6.9% on 20 October 2026.
Patient reports taking tablets with food.
Next review will address diagnostic uncertainty.
Signed: Mina Torven (fictional)
```

### holdout-09 (criteria_id biologic-psoriasis)

```
DERMATOLOGY TRANSFER LETTER
Dated 2026-10-21
Patient: Savi Norlen (fictional), age 44
Prescriber: Dr. Eren Calwick (fictional)
I am requesting adalimumab for moderate-to-severe plaque psoriasis.
Plaques interfere with sleep and dressing.
The maintenance prescription is 40mg SC every other week.
Earlier systemic treatment is summarized below.
Methotrexate 15 mg PO weekly, 2026-01-02 to 2026-08-28.
BSA before treatment: 19% on 2026-01-01.
BSA while taking treatment: 14% on 2026-04-20.
Latest skin measurement: BSA 16% on 2026-10-14.
Patient reports no missed weekly doses during that course.
Injection education is planned.
Regards, Eren Calwick (fictional)
```

### holdout-10 (criteria_id biologic-psoriasis)

```
SKIN THERAPY | SUBMISSION
Sent | 18-Sep-2026
Patient | Pella Darsen (fictional)
Clinician | Dr. Neri Valco (fictional)
Age | 36 years
Indication | moderate-to-severe plaque psoriasis
Agent | adalimumab
Maintenance | 40 mg SQ q14d
Previous systemic | methotrexate 10mg PO weekly
Course length | 120 days
Outcome | failed to clear plaques
Starting skin percentage | ____
End-of-course skin percentage | ____
Current examination | BSA 12% on 11-Sep-2026
Teaching | patient requests demonstration
Attestation | Neri Valco (fictional)
```

### holdout-11 (criteria_id biologic-psoriasis)

```
BIOLOGIC QUESTIONS
Date completed? October 8 2026
Patient? Arlo Venset (fictional)
Prescriber? Dr. Tali Orven (fictional)
Age? 59
Medicine sought? adalimumab
Reason? Plaque psoriasis affecting elbows and trunk.
Severity category? not provided
Maintenance directions? ____
Most recent skin estimate? BSA 13% on September 30 2026.
Previous systemic? Methotrexate 12.5mg weekly.
Course dates? July 1 through August 15 2026.
BSA before course? 18% on June 30 2026.
BSA at last tablet? 15% on August 15 2026.
Education preference? Written instructions.
Signed: Tali Orven (fictional)
```

### holdout-12 (criteria_id biologic-psoriasis)

```
SKIN FOLLOW-UP / SOAP
Request: 2026-11-06
Patient: Luma Kestrel (fictional)
Examiner: Dr. Olin Varell (fictional)
Age: 65 years
S: Itching persists despite topical care.
O: Plaques present on limbs; pulse 72.
Surface estimate: ____
A: Moderate-to-severe plaque psoriasis.
This assessment is the reason for requesting adalimumab.
P: Adalimumab maintenance 40 mg subQ every week.
Earlier treatment: clobetasol ointment for five months.
Additional systemic course: N/A
Patient will return for injection instruction.
Signed: Olin Varell (fictional)
```

### holdout-13 (criteria_id biologic-psoriasis)

```
SYSTEMIC MEDICATION CHECK
Submission: 2026-09-24
Patient: Evin Solmar (fictional)
Author: Dr. Rhea Tollen (fictional)
Age: not provided
[x] Drug sought: adalimumab
[x] Intended use: mild plaque psoriasis
[ ] Maintenance amount: ____
[ ] Maintenance interval: ____
[ ] Numeric skin measurement: ____
[x] Methotrexate previously attempted
[x] Stopped because of intolerance
Reason for intolerance: ____
Course details: not provided
Author signature: Rhea Tollen (fictional)
```

### holdout-14 (criteria_id biologic-psoriasis)

```
PHARMACY ENTRY
Order date: 09/10/2026
Patient: Nessa Quillan (fictional)
Ordering professional: Dr. Daro Elwick (fictional)
Age: 16 years
Agent selected: adalimumab
Treatment purpose: hidradenitis suppurativa
Maintenance order: 80mg SQ every other week
Skin worksheet:
BSA 11% measured 04/03/2026
Past therapy:
Doxycycline 100 mg PO BID for four months
Injection supplies discussed.
Delivery preference: collect in person
Entered by Daro Elwick (fictional)
```

### holdout-15 (criteria_id biologic-psoriasis)

```
SPECIALTY ACCESS RECORD
Patient: Bram Ostell (fictional)
Prescriber: Dr. Yara Mendel (fictional)
Request written: 09/10/2026
Received: September 12 2026
Age: 52 years
Reason for adalimumab: moderate-to-severe plaque psoriasis
Prescription maintenance: 40mg SC q14d
Active therapies copied from visit:
Adalimumab 40 mg SC weekly
Methotrexate contraindicated because of cirrhosis.
BSA 17% measured 09/01/2026
Patient requests a teaching appointment.
No loading directions included in this sheet.
Signed: Yara Mendel (fictional)
```

### holdout-16 (criteria_id biologic-psoriasis)

```
CONSULT SUMMARY
Prepared 2 November 2026
Patient: Cira Belven (fictional), 31 years old
Consultant: Dr. Nolen Arvis (fictional)
Requested product: adalimumab
Requested use: psoriatic arthritis
Past problem list: moderate-to-severe plaque psoriasis
Maintenance to dispense: 40 mg subQ Q2W
Systemic history follows.
Methotrexate 20 mg weekly from 2 January to 30 June 2026.
BSA 15% on 1 January 2026, before the course.
BSA 3% on 15 April 2026, while still taking methotrexate.
Current skin examination: BSA 12% on 26 October 2026.
Joint symptoms are the focus of this referral.
Signed: Nolen Arvis (fictional)
```

### holdout-17 (criteria_id pcsk9)

```
LIPID VISIT / SOAP
Request filed: 2026-10-12
Patient: Tovin Rellam (fictional)
Prescriber: Dr. Esme Valden (fictional)
Age: 68 years
S: Taking nightly tablets consistently.
O: LDL-C 96 mg/dL on 2026-10-02.
A: Prior myocardial infarction; evolocumab sought for this ASCVD.
P: Evolocumab 140mg SQ q14d.
Medication course:
Atorvastatin 80 mg nightly from 2026-01-05 through today.
LDL-C before treatment: 162 mg/dL on 2026-01-04.
LDL-C on treatment: 108 mg/dL on 2026-04-15.
Patient demonstrates injection technique with a training device.
Signed: Esme Valden (fictional)
```

### holdout-18 (criteria_id pcsk9)

```
LIPID REFERRAL
Written November 4 2026
Patient: Anya Corlen (fictional), age 57
From: Dr. Venn Solwick (fictional)
Please supply evolocumab for coronary artery disease with a stent.
The directions are 140 mg SC every 2 wks.
The patient continues lipid treatment while awaiting this decision.
Atorvastatin 20 mg QD began January 1 2026 and remains ongoing.
LDL before the first dose: 155 mg/dl on December 30 2025.
LDL during treatment: 112 mg/dl on April 15 2026.
Latest LDL-C: 104 mg/dL on October 27 2026.
No adverse effects were reported with the tablets.
Dietary changes were discussed.
Injection training is requested.
Signed: Venn Solwick (fictional)
```

### holdout-19 (criteria_id pcsk9)

```
LIPID ACCESS | WORKSHEET
Date | 25-Sep-2026
Patient | Milo Kervan (fictional)
Prescriber | Dr. Lysa Ordel (fictional)
Age | 46
Requested drug | evolocumab
Requested purpose | familial hypercholesterolemia
Historical problems | ASCVD
Dose and frequency | not provided
Prior tablets | atorvastatin 40 mg daily
Length of use | not provided
Clinical impression | inadequate lipid response
Current LDL-C | 121 mg/dL on 18-Sep-2026
Counseling | storage instructions discussed
Signature | Lysa Ordel (fictional)
```

### holdout-20 (criteria_id pcsk9)

```
INJECTABLE THERAPY CHECKLIST
Request prepared: 2026-10-28
Patient: Fara Nelwick (fictional)
Clinician: Dr. Cato Virell (fictional)
[x] Age: 73 years
[x] Evolocumab sought for established ASCVD
[x] Known coronary artery disease with prior stent
[x] Order: evolocumab 140mg subQ every four weeks
[ ] LDL-C result attached: ____
Therapy record:
[x] Ezetimibe 10 mg PO QD for seven months
[ ] Additional lipid tablet trial: ____
[x] Patient prefers prefilled injections
[ ] Teaching date: ____
Signed: Cato Virell (fictional)
```

### holdout-21 (criteria_id pcsk9)

```
CARDIOVASCULAR MEDICATION QUESTIONS
Completed: 2026-11-09
Patient? Iren Dovell (fictional)
Prescriber? Dr. Soren Malven (fictional)
Age? N/A
Agent sought? evolocumab
Purpose? Possible ASCVD; evaluation remains open.
Amount per injection? ____
Interval? ____
LDL-C result? not provided
Previous statin? Atorvastatin 40 mg daily for five months.
Why stopped? Statin intolerance.
Symptoms or medical reason? ____
Earlier lipid measurements? not provided
Signed: Soren Malven (fictional)
```

### holdout-22 (criteria_id pcsk9)

```
SPECIALTY DISPENSING INTAKE
Submission date: 09/10/2026
Patient: Veya Rallin (fictional)
Prescriber: Dr. Taren Oswick (fictional)
Age entered: 15 years
Requested drug: evolocumab
Requested indication: familial hypercholesterolemia
Directions: 420 mg SQ monthly
Laboratory enclosure:
LDL-C 148 mg/dL on 04/03/2026
Earlier treatment:
Cholestyramine 4 g PO BID for six months
Storage instructions supplied.
Parent will attend teaching.
Signed: Taren Oswick (fictional)
```

### holdout-23 (criteria_id pcsk9)

```
CARDIAC MEDICATION REVIEW
Request date: 3.10.2026
Patient: Osa Vernell (fictional)
Reviewer: Dr. Elan Darswick (fictional)
Age: 64 years
Purpose: evolocumab for established ASCVD after myocardial infarction
New prescription: evolocumab 140 mg SC Q2W
Medication list brought to visit:
Evolocumab 140 mg SC every four weeks
Statin intolerance: reproducible severe myalgia on atorvastatin.
Symptoms resolved off atorvastatin and recurred after rechallenge.
LDL-C 118 mg/dl measured 23.9.2026
Patient understands refrigerated storage.
Teaching visit requested before first injection.
Signed: Elan Darswick (fictional)
```

### holdout-24 (criteria_id pcsk9)

```
FOLLOW-UP / LIPID PLAN
Request authored: October 30 2026
Patient: Keva Orsett (fictional)
Author: Dr. Rian Bellwick (fictional)
Age 60; pulse 70; no acute distress.
Assessment: suspected atherosclerotic cardiovascular disease.
Evolocumab is requested for the suspected vascular disease.
Plan: evolocumab 140mg subQ every 2 weeks.
Prior regimen:
Atorvastatin 20 mg tablets, two tablets PO QD.
Continuous course: January 2 through September 30 2026.
LDL-C 151 mg/dL on January 1 2026, before treatment.
LDL-C 65 mg/dL on April 15 2026, during treatment.
Latest LDL-C 92 mg/dL on October 20 2026, after stopping tablets.
Further vascular assessment is pending.
Signed: Rian Bellwick (fictional)
```

## Output

Return only JSON Lines, one line per packet, in packet order, nothing before or after:
{"packet_id": "holdout-01", "labels": {"adult": {"status": "...", "lines": ["..."], "reason": "..."}, "diagnosis": {...}, "lab": {...}, "prior": {...}, "dose": {...}}}

Never run terminal commands and do not write or edit files. Your final message must be the 24 JSON Lines themselves and nothing else.
