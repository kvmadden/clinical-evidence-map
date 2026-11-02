# Synthetic packet generator spec

## Purpose and boundaries
This is the Stage A generation contract and record of how this set was made. It describes test data, not a clinical workflow implementation. All people and clinical histories are invented. The files contain no dates of birth, addresses, contact details, member numbers, medical record numbers or actual patient records. Packet IDs are exercise file keys. Drug names are real terms used in fictional examples.

## Outputs
- `criteria/<class>.json`: three fictional criteria sets, five criteria each.
- `packets/packet-NNN.md`: 50 UTF-8 source texts with YAML front matter.
- `gold/packet-NNN.json`: one draft label file per source.
- `manifest.json`: packet IDs, criteria IDs and quality groups.

The texts were produced by a deterministic template expansion for this stage. No application or executable generator is checked in. Reconstruct the set using the rules below if needed. The checked-in texts and labels are the review record.

## Construction rules
Number packets 001 through 050. Assign classes by `(packet_number - 1) modulo 3`: GLP-1, biologic, PCSK9, in that order. This produces 17, 17 and 16 packets. Assign the ten groups below in consecutive blocks of five.

A letter dated October 1, 2026 requests the class's named drug and dose. A September 20 note states the diagnosis. A September 15 measurement records A1c 8.6%, body surface area 14%, or LDL-C 132 mg/dL. The medication history records metformin 1000 mg twice daily, methotrexate 15 mg weekly, or atorvastatin 80 mg daily, respectively, from April 1 to August 1 with inadequate response. This is a 122-day interval. The examples do not claim that these details alone would be adequate in practice.

Each complete packet has a provider letter, clinical notes, a lab/measurement section and medication history. Missing-page groups deliberately omit one section. Psoriasis body surface area is a clinical measurement, not a laboratory assay, and is named accordingly in the section heading.

For number `n`, age is `32 + n modulo 29`. Select a first name by `(n - 1) modulo 10` from Mira, Tobin, Elva, Nolan, Sera, Arlen, Veda, Corin, Lina, Oren. Select a surname by integer division `(n - 1) / 10` from Brookvale, Ashmere, Fenwick, Dunvale, Reedwell. The provider is Dr. Rowan Vale. These names are invented, and any resemblance to a real person is accidental.

| Group | Packets | Source change or future rendering plan | Draft expectation |
| --- | --- | --- | --- |
| clean | 001–005 | Complete text | Five supported criteria |
| skew | 006–010 | Later rotate rendered pages 7 degrees | Five supported criteria in source |
| handwriting | 011–015 | Later render medication history with a handwriting-like font | Five supported criteria in source |
| missing-lab | 016–020 | Omit lab/measurement page | Measurement criterion missing |
| missing-history | 021–025 | Omit medication history page | Prior-treatment criterion missing |
| conflicting-dates | 026–030 | Note says request September 1, letter October 1 | Measurement timing needs review |
| stale-lab | 031–035 | Measurement dated January 1 | Measurement outside window, needs review |
| unclear-trial | 036–040 | Remove treatment dates and outcome | Prior treatment needs review |
| conflicting-dose | 041–045 | Medication list says 999 mg daily | Dose needs review |
| intolerance | 046–050 | August 1–15 trial stopped for persistent nausea | Fictional intolerance alternative supported |

The impossible dose is an intentional contradiction, not a dosing suggestion. The September 15 measurement follows the conflicting September 1 request date, so the conflict affects the window rule. All numerical measurement values otherwise meet the invented thresholds. Future cases should add below-threshold values, pediatric requests, uncertain diagnoses, multi-drug lists, longer packets, duplicated pages, and class-specific safety documentation. This set does not cover those cases.

## Label contract
Each entity has a type, a value, one exact `source_span`, and `reviewed: false`. Values may be strings, numbers or measurement objects. Several entity labels can cite the same full source line. Spans are supporting phrases, not necessarily the smallest token interval. Extracted dates and doses retain contradictory statements as separate entities. Normalization is explicitly not attempted.

Each criterion has `criterion_id`, `status`, `evidence_spans`, `reason`, and `reviewed: false`. Allowed status values:

- `evidence_found`: the supplied source supports the fictional rule.
- `missing`: no source evidence for the required item is supplied. The span list is empty.
- `needs_review`: evidence is conflicting, stale or incomplete. Cite the available evidence. This is not an automatic negative coverage decision.

For this set all criteria are required. An intolerance statement is an alternative within the prior-treatment rule. No real policy exclusions or clinical appropriateness claims are implied. Whole-packet disposition is deliberately absent.

## Offsets and review changes
Read the Markdown file as UTF-8. Remove everything through the literal `<!-- SOURCE START -->` and the single following newline. Offsets count Unicode code points in the remaining body, start inclusive and end exclusive. Every span must satisfy `body[start:end] == text`. Front matter is excluded. Newlines count. The final newline is part of the body.

Edit a source only if the intended evidence is wrong. Then recalculate every affected span before marking labels reviewed. Record label corrections and reviewer/date in the review sheet. The per-label flag is authoritative. Set the packet-level flag only when all entities and all criterion labels have been reviewed, including the normalization deferral. Criteria files need their own review.

## Checks before evaluation
Require exactly 50 paired files, unique packet IDs, three known criteria IDs, all five criterion labels per packet, and exact span matches. All draft reviewed flags must be false on initial delivery. Count the quality groups and class totals. Expected totals: 250 criterion labels, 220 evidence_found, 10 missing, 20 needs_review. These counts check construction, not label correctness.

Keep this first set for development and reviewer practice. Do not randomly split nearly identical packets into training and test sets. Build a separately authored holdout after the clinical review. Actual PDFs, word boxes, OCR confidence, redaction tests, normalized concepts and evaluation results belong to Stage B.
