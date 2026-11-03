# Second held-out set: run plan

Written and committed on 3 November 2026, before any reading rule ran on this set. This file is not covered by the freeze, and it changes nothing in packets, gold or the manifest.

## What runs

- **The set.** This folder, frozen under the sha256 in [FREEZE.json](FREEZE.json) (`11e33eb2…8047d`), committed in 5694663. `scripts/holdout.ts` on the reader branch computes the same hash.
- **The code.** The stage D reader (kvmadden/clinical-evidence-map-dev#5) with the pages work (#4) merged in, after its last review round. Its commit is recorded in `results/first-score.json`.
- **One command, once.** `npm run eval -- --set holdout-v2`. The script refuses to run unless the freeze and the code are committed. It claims the set with a create-only first-score record, and it reads every page again instead of trusting stored OCR. Any later run is development data.

## What gets reported, whatever it shows

- Criterion statuses right, of 120, with the always-"found" baseline (49 of 120) beside it, for the OCR run and for the source-text run.
- False "not documented": a missing answer where the label is evidence found or needs review.
- False "evidence found": a found answer where the label is missing or needs review.
- Needs-review answers, and how many of them the labels also send to review.
- Each of these per criterion, per author (Grok wrote packets 01 to 12, Gemini 13 to 24) and per page condition.
- Quotes that reproduce from the redacted page.

## Choices fixed before the run

These are the reader's defaults. Kevin may change any of them later. A change made after seeing this set's results makes the set development data for that rule.

1. A missing or out-of-order page blocks "not documented". A found answer stays found, with the packet marked incomplete.
2. A trial with a stated duration but no start date goes to review, unless a stop date gives the start.
3. Psoriasis severity is never inferred from BSA or PASI.
4. "Methotrexate stopped for pregnancy planning" counts as a contraindication, with its reason.
5. An approximate age goes to review.
6. Needs review covers both "does not meet" and "uncertain".

## Who saw what

- Grok 4.7 and Gemini 3.8 Flash wrote the packets from SPEC.md alone. All four families (Claude, GPT, Gemini and Grok) relabeled them blind, and Claude adjudicated four disputed labels. None of those sessions changed the reading rules.
- The Claude agents that wrote the reading rules never read this folder.
- All four families also reviewed the tool in other sessions, and their probes became development tests. No review session had this set. That is family overlap, not data overlap, and it is disclosed here.
