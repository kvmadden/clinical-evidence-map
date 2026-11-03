# Kevin's label review

Most labels are drafts. 13 criterion labels carry Kevin's 2 November 2026 review because their rule and quoted evidence did not change. This sheet tracks progress. The JSON flags are authoritative.

## Review order

1. Read the five rules in each criteria file. The diagnosis and prior therapy rules changed after the 2 November notes. Correct the fictional rule wording before checking packets against it.
2. Re-review the eight labels listed under "Carried over and re-review" below.
3. Work through the groups. The review page shows the first two packets in each group plus every packet with AI-drawn handwriting.
4. For each packet, check the entity values and quoted lines, then all five criterion statuses. Empty evidence lists mean not documented. Check date order, intervals, units, trial length, baseline and follow-up values, and conflicting statements.

Set a label's `reviewed` field to true only after you accept or correct it. Set the packet flag last. If source text changes, rerun `npm run generate` so offsets stay exact.

## Criteria

- [ ] [GLP-1](../eval/criteria/glp1-t2d.json): diagnosis as the reason, A1c window, metformin trial with values, dose
- [ ] [Biologic](../eval/criteria/biologic-psoriasis.json): moderate-to-severe diagnosis as the reason, body surface area, methotrexate trial with values, maintenance dose
- [ ] [PCSK9](../eval/criteria/pcsk9.json): ASCVD as the reason, LDL-C window, high-intensity statin trial with values (atorvastatin 40 or 80 mg or rosuvastatin 20 or 40 mg daily, by the 2 November ruling), dose

## Clean render

Typed page with light speckle. No other effect.

- [ ] packet-001 · GLP-1 · [source](../eval/packets/packet-001.md) · [labels](../eval/gold/packet-001.json)
- [ ] packet-002 · Biologic · [source](../eval/packets/packet-002.md) · [labels](../eval/gold/packet-002.json)
- [ ] packet-003 · PCSK9 · [source](../eval/packets/packet-003.md) · [labels](../eval/gold/packet-003.json)
- [ ] packet-004 · GLP-1 · [source](../eval/packets/packet-004.md) · [labels](../eval/gold/packet-004.json)
- [ ] packet-005 · Biologic · [source](../eval/packets/packet-005.md) · [labels](../eval/gold/packet-005.json)

## Simulated 7-degree rotation

Typed page with simulated fax noise, rotated 7 degrees.

- [ ] packet-006 · PCSK9 · [source](../eval/packets/packet-006.md) · [labels](../eval/gold/packet-006.json)
- [ ] packet-007 · GLP-1 · [source](../eval/packets/packet-007.md) · [labels](../eval/gold/packet-007.json)
- [ ] packet-008 · Biologic · [source](../eval/packets/packet-008.md) · [labels](../eval/gold/packet-008.json)
- [ ] packet-009 · PCSK9 · [source](../eval/packets/packet-009.md) · [labels](../eval/gold/packet-009.json)
- [ ] packet-010 · GLP-1 · [source](../eval/packets/packet-010.md) · [labels](../eval/gold/packet-010.json)

## AI-drawn handwriting (image model)

Typed page whose medication history is an AI-drawn handwriting image from an image model, not a real person's handwriting, with simulated fax noise.

- [ ] packet-011 · Biologic · [source](../eval/packets/packet-011.md) · [labels](../eval/gold/packet-011.json)
- [ ] packet-012 · PCSK9 · [source](../eval/packets/packet-012.md) · [labels](../eval/gold/packet-012.json)
- [ ] packet-013 · GLP-1 · [source](../eval/packets/packet-013.md) · [labels](../eval/gold/packet-013.json)
- [ ] packet-014 · Biologic · [source](../eval/packets/packet-014.md) · [labels](../eval/gold/packet-014.json)
- [ ] packet-015 · PCSK9 · [source](../eval/packets/packet-015.md) · [labels](../eval/gold/packet-015.json)

## Simulated fax noise

Typed page with seeded speckles and faint horizontal streaks.

- [ ] packet-016 · GLP-1 · [source](../eval/packets/packet-016.md) · [labels](../eval/gold/packet-016.json)
- [ ] packet-017 · Biologic · [source](../eval/packets/packet-017.md) · [labels](../eval/gold/packet-017.json)
- [ ] packet-018 · PCSK9 · [source](../eval/packets/packet-018.md) · [labels](../eval/gold/packet-018.json)
- [ ] packet-019 · GLP-1 · [source](../eval/packets/packet-019.md) · [labels](../eval/gold/packet-019.json)
- [ ] packet-020 · Biologic · [source](../eval/packets/packet-020.md) · [labels](../eval/gold/packet-020.json)
- [ ] packet-021 · PCSK9 · [source](../eval/packets/packet-021.md) · [labels](../eval/gold/packet-021.json)
- [ ] packet-022 · GLP-1 · [source](../eval/packets/packet-022.md) · [labels](../eval/gold/packet-022.json)
- [ ] packet-023 · Biologic · [source](../eval/packets/packet-023.md) · [labels](../eval/gold/packet-023.json)

## Simulated choppy scan lines

Typed page with seeded row jitter, dropped lines and dark streaks.

- [ ] packet-024 · PCSK9 · [source](../eval/packets/packet-024.md) · [labels](../eval/gold/packet-024.json)
- [ ] packet-025 · GLP-1 · [source](../eval/packets/packet-025.md) · [labels](../eval/gold/packet-025.json)
- [ ] packet-026 · Biologic · [source](../eval/packets/packet-026.md) · [labels](../eval/gold/packet-026.json)
- [ ] packet-027 · PCSK9 · [source](../eval/packets/packet-027.md) · [labels](../eval/gold/packet-027.json)
- [ ] packet-028 · GLP-1 · [source](../eval/packets/packet-028.md) · [labels](../eval/gold/packet-028.json)
- [ ] packet-029 · Biologic · [source](../eval/packets/packet-029.md) · [labels](../eval/gold/packet-029.json)
- [ ] packet-030 · PCSK9 · [source](../eval/packets/packet-030.md) · [labels](../eval/gold/packet-030.json)
- [ ] packet-031 · GLP-1 · [source](../eval/packets/packet-031.md) · [labels](../eval/gold/packet-031.json)

## Simulated smudges

Typed page with seeded blurred smudges over the text.

- [ ] packet-032 · Biologic · [source](../eval/packets/packet-032.md) · [labels](../eval/gold/packet-032.json)
- [ ] packet-033 · PCSK9 · [source](../eval/packets/packet-033.md) · [labels](../eval/gold/packet-033.json)
- [ ] packet-034 · GLP-1 · [source](../eval/packets/packet-034.md) · [labels](../eval/gold/packet-034.json)
- [ ] packet-035 · Biologic · [source](../eval/packets/packet-035.md) · [labels](../eval/gold/packet-035.json)
- [ ] packet-036 · PCSK9 · [source](../eval/packets/packet-036.md) · [labels](../eval/gold/packet-036.json)
- [ ] packet-037 · GLP-1 · [source](../eval/packets/packet-037.md) · [labels](../eval/gold/packet-037.json)
- [ ] packet-038 · Biologic · [source](../eval/packets/packet-038.md) · [labels](../eval/gold/packet-038.json)
- [ ] packet-039 · PCSK9 · [source](../eval/packets/packet-039.md) · [labels](../eval/gold/packet-039.json)

## Simulated low contrast

Typed page in light gray ink on a gray background.

- [ ] packet-040 · GLP-1 · [source](../eval/packets/packet-040.md) · [labels](../eval/gold/packet-040.json)
- [ ] packet-041 · Biologic · [source](../eval/packets/packet-041.md) · [labels](../eval/gold/packet-041.json)
- [ ] packet-042 · PCSK9 · [source](../eval/packets/packet-042.md) · [labels](../eval/gold/packet-042.json)
- [ ] packet-043 · GLP-1 · [source](../eval/packets/packet-043.md) · [labels](../eval/gold/packet-043.json)
- [ ] packet-044 · Biologic · [source](../eval/packets/packet-044.md) · [labels](../eval/gold/packet-044.json)
- [ ] packet-045 · PCSK9 · [source](../eval/packets/packet-045.md) · [labels](../eval/gold/packet-045.json)
- [ ] packet-046 · GLP-1 · [source](../eval/packets/packet-046.md) · [labels](../eval/gold/packet-046.json)
- [ ] packet-047 · Biologic · [source](../eval/packets/packet-047.md) · [labels](../eval/gold/packet-047.json)

## Simulated page orientation

Typed page with simulated fax noise, turned 180, 90 or 270 degrees.

- [ ] packet-048 · PCSK9 · [source](../eval/packets/packet-048.md) · [labels](../eval/gold/packet-048.json)
- [ ] packet-049 · GLP-1 · [source](../eval/packets/packet-049.md) · [labels](../eval/gold/packet-049.json)
- [ ] packet-050 · Biologic · [source](../eval/packets/packet-050.md) · [labels](../eval/gold/packet-050.json)
- [ ] packet-051 · PCSK9 · [source](../eval/packets/packet-051.md) · [labels](../eval/gold/packet-051.json)
- [ ] packet-052 · GLP-1 · [source](../eval/packets/packet-052.md) · [labels](../eval/gold/packet-052.json)
- [ ] packet-053 · Biologic · [source](../eval/packets/packet-053.md) · [labels](../eval/gold/packet-053.json)
- [ ] packet-054 · PCSK9 · [source](../eval/packets/packet-054.md) · [labels](../eval/gold/packet-054.json)
- [ ] packet-055 · GLP-1 · [source](../eval/packets/packet-055.md) · [labels](../eval/gold/packet-055.json)

## Printed page with AI-drawn notes, circles and arrows

Typed page with AI-drawn handwritten fills and margin notes from an image model, drawn circles and arrows, and simulated fax noise.

- [ ] packet-056 · Biologic · [source](../eval/packets/packet-056.md) · [labels](../eval/gold/packet-056.json)
- [ ] packet-057 · PCSK9 · [source](../eval/packets/packet-057.md) · [labels](../eval/gold/packet-057.json)
- [ ] packet-058 · GLP-1 · [source](../eval/packets/packet-058.md) · [labels](../eval/gold/packet-058.json)
- [ ] packet-059 · Biologic · [source](../eval/packets/packet-059.md) · [labels](../eval/gold/packet-059.json)
- [ ] packet-060 · PCSK9 · [source](../eval/packets/packet-060.md) · [labels](../eval/gold/packet-060.json)
- [ ] packet-061 · GLP-1 · [source](../eval/packets/packet-061.md) · [labels](../eval/gold/packet-061.json)
- [ ] packet-062 · Biologic · [source](../eval/packets/packet-062.md) · [labels](../eval/gold/packet-062.json)
- [ ] packet-063 · PCSK9 · [source](../eval/packets/packet-063.md) · [labels](../eval/gold/packet-063.json)

## Carried over and re-review

| Packet | Criterion | 2 November answer | Now | Why |
| --- | --- | --- | --- | --- |
| packet-001 | adult | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-001 | diagnosis | needs review | Re-review, draft evidence found | Not carried over because the rule text changed and the packet text for this criterion changed |
| packet-001 | lab | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-001 | prior | needs review | Re-review, draft evidence found | Not carried over because the rule text changed and the packet text for this criterion changed |
| packet-001 | dose | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-002 | adult | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-002 | diagnosis | evidence found | Re-review, draft evidence found | Not carried over because the rule text changed and the packet text for this criterion changed |
| packet-002 | lab | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-002 | prior | evidence found | Re-review, draft evidence found | Not carried over because the rule text changed and the packet text for this criterion changed |
| packet-002 | dose | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-006 | adult | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-006 | diagnosis | evidence found | Re-review, draft needs review | Not carried over because the rule text changed and the packet text for this criterion changed |
| packet-006 | lab | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-006 | prior | evidence found | Re-review, draft needs review | Not carried over because the rule text changed and the packet text for this criterion changed |
| packet-006 | dose | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-007 | adult | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-007 | diagnosis | evidence found | Re-review, draft evidence found | Not carried over because the rule text changed and the packet text for this criterion changed |
| packet-007 | lab | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-007 | prior | evidence found | Re-review, draft evidence found | Not carried over because the rule text changed and the packet text for this criterion changed |
| packet-007 | dose | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |
| packet-011 | adult | evidence found | Reviewed, carried over, draft evidence found | Rule text and quoted evidence unchanged since this review |

Kevin's notes from 2 November are kept in each re-review label's `review.note` and in `eval/reviews/2026-11-02-kevin.json`. The diagnosis rule now asks for the condition as the reason for this request. The prior therapy rule now asks for values before and after the trial.

## Correction log

Record disagreements here before changing the gold files. Add rows as needed.

| Packet or criteria file | Entity or criterion | Old to corrected label and reason | Reviewer | Date |
| --- | --- | --- | --- | --- |
| Pending | | | | |

## Final check

- [ ] Every criteria rule has been reviewed.
- [ ] Every packet's entities and all five criterion results have been reviewed.
- [ ] Exact spans still match the source text after corrections.
- [ ] Contradictions remain visible in the extracted entities.
- [ ] Missing documentation is not described as a clinical failure or denial.
- [ ] The reviewed version is recorded in a local commit before evaluation.

Reviewer: __________  Date: __________  Reviewed commit: __________
