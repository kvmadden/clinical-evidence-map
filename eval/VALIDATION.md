# File checks

Checked November 2, 2026, after generating the set with `npm run generate`. `tests/corpus.test.ts` repeats these checks on every test run.

| Check | Result |
| --- | --- |
| Source and gold files paired by packet ID | 63 of 63 |
| Fictional criteria sets | 3, with 5 rules each |
| Class distribution | 21 GLP-1, 21 biologic, 21 PCSK9 |
| Groups | 9, with 5, 5, 5, 8, 8, 8, 8, 8, 8 packets in manifest order |
| Extracted entity labels | 1077 |
| Exact source spans checked against source body | 1580 of 1580 match |
| Criterion labels | 315: 164 evidence_found, 57 missing, 94 needs_review |
| Missing criteria have empty evidence lists | 57 of 57 |
| Reviewed flags | 13 criterion labels and 33 entity labels carried over from Kevin's 2 November review, all others false |
| Generator rebuild reproduces every checked-in packet, label, criteria file and manifest | Yes, byte for byte |
| Every scenario produces its designed status | Yes, the generator stops otherwise |

## Held-out set

| Check | Result |
| --- | --- |
| Packets written by Codex from `eval/holdout/SPEC.md` alone | 24, 8 per criteria set |
| Criterion labels | 120: 60 evidence_found, 24 missing, 36 needs_review |
| Quoted evidence lines found exactly in the packet text | All, checked by `scripts/holdout.ts freeze` |
| Missing labels with an empty evidence list | All |
| Frozen sha256 over packets, labels and manifest | `3680490ee5f93ae64a9f6f809fbf0d0c1eb4b369751bff9efaf25cbf58a766f7` |
| Commit that froze the set before the first run | a8dcab6 |

`npx tsx scripts/holdout.ts verify` and a unit test recompute the sha256 on every run, and `scripts/evaluate.ts` checks it before scoring or rescoring the set. The set was scored once, on 2 November 2026 at 735ea32, before any rule changed. From 3 November 2026 it is development data (`eval/holdout/ROLE.json`), and that blind score is kept in `eval/holdout/results/first-score.json`.

These checks confirm file consistency and construction. They do not confirm clinical correctness, reviewer agreement, OCR accuracy, redaction performance or any product target. Kevin's review of the draft labels remains pending.
