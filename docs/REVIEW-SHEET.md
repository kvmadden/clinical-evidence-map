# Kevin’s label review

All labels start unreviewed. This is a draft review queue, not a completed sign-off.

## Review order

1. Read the five rules in each criteria file. Correct the fictional rule wording before checking packets against it.
2. Review one complete packet per class: 001 (GLP-1), 002 (biologic), 003 (PCSK9). Check the source alongside the gold JSON.
3. Work through the quality groups below. Repeated text should make checks faster, but check each packet.
4. Sort `eval/manifest.json` by criteria_id for a final class pass. Confirm that repeated labels mean the same thing across groups.

For each packet, check entity values and quoted spans first. Then check all five criterion statuses, including empty evidence lists for missing records. Check date arithmetic, units, treatment duration and conflicting statements. The intentionally wrong dose must stay flagged. Scan-quality plans describe later work. They are not OCR findings.

Set each checked entity and criterion’s `reviewed` field to true only after you accept or correct it. Check the normalization deferral too. Set the top-level flag last. A checkbox below tracks progress and does not replace the JSON flags. If you change source text, recalculate offsets before signing off.

## Criteria

- [ ] [GLP-1](../eval/criteria/glp1-t2d.json): diagnosis, lab window, prior therapy and dose
- [ ] [Biologic](../eval/criteria/biologic-psoriasis.json): severity, body surface area, prior therapy and maintenance dose
- [ ] [PCSK9](../eval/criteria/pcsk9.json): diagnosis, LDL-C window, prior therapy and dose

Set each criterion’s reviewed flag and the file’s reviewed flag after checking its wording. These remain fictional rules.

## clean

- [ ] packet-001 · glp1-t2d · [source](../eval/packets/packet-001.md) · [labels](../eval/gold/packet-001.json)
- [ ] packet-002 · biologic-psoriasis · [source](../eval/packets/packet-002.md) · [labels](../eval/gold/packet-002.json)
- [ ] packet-003 · pcsk9 · [source](../eval/packets/packet-003.md) · [labels](../eval/gold/packet-003.json)
- [ ] packet-004 · glp1-t2d · [source](../eval/packets/packet-004.md) · [labels](../eval/gold/packet-004.json)
- [ ] packet-005 · biologic-psoriasis · [source](../eval/packets/packet-005.md) · [labels](../eval/gold/packet-005.json)

## skew

- [ ] packet-006 · pcsk9 · [source](../eval/packets/packet-006.md) · [labels](../eval/gold/packet-006.json)
- [ ] packet-007 · glp1-t2d · [source](../eval/packets/packet-007.md) · [labels](../eval/gold/packet-007.json)
- [ ] packet-008 · biologic-psoriasis · [source](../eval/packets/packet-008.md) · [labels](../eval/gold/packet-008.json)
- [ ] packet-009 · pcsk9 · [source](../eval/packets/packet-009.md) · [labels](../eval/gold/packet-009.json)
- [ ] packet-010 · glp1-t2d · [source](../eval/packets/packet-010.md) · [labels](../eval/gold/packet-010.json)

## handwriting

- [ ] packet-011 · biologic-psoriasis · [source](../eval/packets/packet-011.md) · [labels](../eval/gold/packet-011.json)
- [ ] packet-012 · pcsk9 · [source](../eval/packets/packet-012.md) · [labels](../eval/gold/packet-012.json)
- [ ] packet-013 · glp1-t2d · [source](../eval/packets/packet-013.md) · [labels](../eval/gold/packet-013.json)
- [ ] packet-014 · biologic-psoriasis · [source](../eval/packets/packet-014.md) · [labels](../eval/gold/packet-014.json)
- [ ] packet-015 · pcsk9 · [source](../eval/packets/packet-015.md) · [labels](../eval/gold/packet-015.json)

## missing-lab

- [ ] packet-016 · glp1-t2d · [source](../eval/packets/packet-016.md) · [labels](../eval/gold/packet-016.json)
- [ ] packet-017 · biologic-psoriasis · [source](../eval/packets/packet-017.md) · [labels](../eval/gold/packet-017.json)
- [ ] packet-018 · pcsk9 · [source](../eval/packets/packet-018.md) · [labels](../eval/gold/packet-018.json)
- [ ] packet-019 · glp1-t2d · [source](../eval/packets/packet-019.md) · [labels](../eval/gold/packet-019.json)
- [ ] packet-020 · biologic-psoriasis · [source](../eval/packets/packet-020.md) · [labels](../eval/gold/packet-020.json)

## missing-history

- [ ] packet-021 · pcsk9 · [source](../eval/packets/packet-021.md) · [labels](../eval/gold/packet-021.json)
- [ ] packet-022 · glp1-t2d · [source](../eval/packets/packet-022.md) · [labels](../eval/gold/packet-022.json)
- [ ] packet-023 · biologic-psoriasis · [source](../eval/packets/packet-023.md) · [labels](../eval/gold/packet-023.json)
- [ ] packet-024 · pcsk9 · [source](../eval/packets/packet-024.md) · [labels](../eval/gold/packet-024.json)
- [ ] packet-025 · glp1-t2d · [source](../eval/packets/packet-025.md) · [labels](../eval/gold/packet-025.json)

## conflicting-dates

- [ ] packet-026 · biologic-psoriasis · [source](../eval/packets/packet-026.md) · [labels](../eval/gold/packet-026.json)
- [ ] packet-027 · pcsk9 · [source](../eval/packets/packet-027.md) · [labels](../eval/gold/packet-027.json)
- [ ] packet-028 · glp1-t2d · [source](../eval/packets/packet-028.md) · [labels](../eval/gold/packet-028.json)
- [ ] packet-029 · biologic-psoriasis · [source](../eval/packets/packet-029.md) · [labels](../eval/gold/packet-029.json)
- [ ] packet-030 · pcsk9 · [source](../eval/packets/packet-030.md) · [labels](../eval/gold/packet-030.json)

## stale-lab

- [ ] packet-031 · glp1-t2d · [source](../eval/packets/packet-031.md) · [labels](../eval/gold/packet-031.json)
- [ ] packet-032 · biologic-psoriasis · [source](../eval/packets/packet-032.md) · [labels](../eval/gold/packet-032.json)
- [ ] packet-033 · pcsk9 · [source](../eval/packets/packet-033.md) · [labels](../eval/gold/packet-033.json)
- [ ] packet-034 · glp1-t2d · [source](../eval/packets/packet-034.md) · [labels](../eval/gold/packet-034.json)
- [ ] packet-035 · biologic-psoriasis · [source](../eval/packets/packet-035.md) · [labels](../eval/gold/packet-035.json)

## unclear-trial

- [ ] packet-036 · pcsk9 · [source](../eval/packets/packet-036.md) · [labels](../eval/gold/packet-036.json)
- [ ] packet-037 · glp1-t2d · [source](../eval/packets/packet-037.md) · [labels](../eval/gold/packet-037.json)
- [ ] packet-038 · biologic-psoriasis · [source](../eval/packets/packet-038.md) · [labels](../eval/gold/packet-038.json)
- [ ] packet-039 · pcsk9 · [source](../eval/packets/packet-039.md) · [labels](../eval/gold/packet-039.json)
- [ ] packet-040 · glp1-t2d · [source](../eval/packets/packet-040.md) · [labels](../eval/gold/packet-040.json)

## conflicting-dose

- [ ] packet-041 · biologic-psoriasis · [source](../eval/packets/packet-041.md) · [labels](../eval/gold/packet-041.json)
- [ ] packet-042 · pcsk9 · [source](../eval/packets/packet-042.md) · [labels](../eval/gold/packet-042.json)
- [ ] packet-043 · glp1-t2d · [source](../eval/packets/packet-043.md) · [labels](../eval/gold/packet-043.json)
- [ ] packet-044 · biologic-psoriasis · [source](../eval/packets/packet-044.md) · [labels](../eval/gold/packet-044.json)
- [ ] packet-045 · pcsk9 · [source](../eval/packets/packet-045.md) · [labels](../eval/gold/packet-045.json)

## intolerance

- [ ] packet-046 · glp1-t2d · [source](../eval/packets/packet-046.md) · [labels](../eval/gold/packet-046.json)
- [ ] packet-047 · biologic-psoriasis · [source](../eval/packets/packet-047.md) · [labels](../eval/gold/packet-047.json)
- [ ] packet-048 · pcsk9 · [source](../eval/packets/packet-048.md) · [labels](../eval/gold/packet-048.json)
- [ ] packet-049 · glp1-t2d · [source](../eval/packets/packet-049.md) · [labels](../eval/gold/packet-049.json)
- [ ] packet-050 · biologic-psoriasis · [source](../eval/packets/packet-050.md) · [labels](../eval/gold/packet-050.json)

## Correction log

Record disagreements here before changing the gold files. Add rows as needed.

| Packet or criteria file | Entity or criterion | Old → corrected label and reason | Reviewer | Date |
| --- | --- | --- | --- | --- |
| Pending | | | | |

## Final check

- [ ] Every criteria rule has been reviewed.
- [ ] Every packet’s entities and all five criterion results have been reviewed.
- [ ] Exact spans still match the source text after corrections.
- [ ] Contradictions remain visible in the extracted entities.
- [ ] Missing documentation is not described as a clinical failure or denial.
- [ ] The reviewed version is recorded in a local commit before evaluation.

Reviewer: __________  Date: __________  Reviewed commit: __________
