# Clinical evidence map

**The hard question:** when a nurse opens a faxed prior-authorization packet, does every finding the tool shows point to the exact words on the page, and does it say "review this" instead of guessing when it cannot tell?

**Short answer:** partly. The stage D reader's one blind score, on a second held-out set of 24 packets that Grok and Gemini wrote from a written spec and that was frozen before the run, is 85 of 120 criterion statuses correct, against 49 of 120 for always answering "found". That beats the baseline but falls short of the brief's 90% target. It said "not documented" where the label is found or needs review once in 96, and "evidence found" where the label is not 4 times in 71, all five on labels that say needs review. The cost is review time: it sent 72 of 120 answers to review, where the labels send 47. The stage D rules were rebuilt after an earlier failure. On the first held-out set, written by a different model, the stage C rules scored 37 of 120, below the always-found baseline of 60 of 120. The main failure was answering "not documented" when they could not read a layout: 71 of the 96 criteria labeled evidence found or needs review got that answer. The rebuilt rules answer "not documented" only when the whole packet was read and nothing on it mentions the item, and otherwise say what blocked the read. On the 63 development packets they answer 266 of 315 statuses correctly, against 164 for always answering "found", and send 143 of 315 to review. On the first held-out set, development data since 3 November 2026, they answer 110 of 120, but that rise was made by looking at those packets.

**Synthetic only. Labels are drafts, pending pharmacist review.** 13 of the 315 development labels carry Kevin's pharmacist review from 2 November 2026. No second independent reviewer has checked them. This is an inspectable working prototype. It makes no coverage decision and claims no clinical validation or time saving.

![Nurse review workspace in light mode](docs/media/light-1440.png)

## What changed in this version

The earlier set said it measured more than it did, and the labels were too easy. This version fixes that:

- **Pages are named for what they are.** Every page is a fax-style page image made on this computer. None was printed, faxed or scanned. Groups are named by the effect applied, such as "Simulated 7-degree rotation" or "Simulated low contrast".
- **Handwriting is drawn, not a font.** Two groups use AI-drawn handwriting from an image model in place of a handwriting font. It is not a real person's handwriting. Gold text follows what each image shows.
- **Gaps are common.** About half the labels are evidence found, against 88% before. Near misses include a diagnosis found only in the history, a trial too short or in the wrong drug class, a bare "inadequate response", a lab outside the window, and dose or date conflicts.
- **Formats vary.** Six date formats including day first, brand and generic names, "140mg" and "140 mg", q2wk, Q14D and every other week, sigs such as "2 tabs PO BID", blank form fields and misspellings a pharmacist would accept.
- **Kevin's review notes are rules now.** The diagnosis must be the reason for this request, not just present somewhere. Prior therapy needs a dose, at least 90 days, and values before and after that miss the goal, or an intolerance or contraindication with its reason.
- **The privacy step no longer hides the development set's clinical words, and dates are shifted, not dropped.** At the earlier revision "[name] 2 diabetes" appeared in 48 of 50 letters. Now no clinical word in the development source text is hidden, and every date keeps its interval to the others. Before stage D the held-out source text lost 13 of 84 name tokens to words such as "Prescription" and "Sitagliptin". Since stage D a name needs name-like context, and it loses none of 143.
- **A first held-out set tested generalization.** Codex wrote 24 packets from a written spec alone, without the generator, the pipeline or any development packet. The set was frozen by sha256 and committed before the pipeline first ran on it, and it ran once. From 3 November 2026 it is development data, and its blind score is kept apart in `eval/holdout/results/first-score.json`.
- **A second held-out set gave the stage D reader its one blind score.** Grok 4.7 wrote holdout2-01 to 12 and Gemini 3.8 Flash wrote holdout2-13 to 24, from a written spec alone, as packets of two to four fax pages. Four model families relabeled every packet blind, and the set was frozen by sha256 before the reader first ran on it. It ran once, on 3 November 2026, by [a plan committed beforehand](eval/holdout-v2/RUN-PLAN.md): 85 of 120 statuses correct, against 49 for always answering "found". The score is kept in `eval/holdout-v2/results/first-score.json`, and any later run is development data.
- **Packets can run to several pages.** A line holding only `<<page>>` in the packet text starts a new page. Each page is drawn and read on its own, the page texts are joined in order, and every quote still points to its exact line. The review shows every page in order with its number. Two fixture packets built from packet-018 test it, one with page 2 never received.
- **The reader is told what arrived.** A coverage record built from the OCR output alone is passed to the reading rules with the text: pages received, fax page counters such as "P.002/003", missing page numbers, pages out of order, whether each page's turn was settled, word confidence per page and the lines that fell below the review threshold. The reading rules use it: a page that did not arrive, could not be read or arrived out of order blocks every "not documented" answer, and a found answer stands with the packet marked incomplete.
- **More honest measures.** The evaluation now reports how often the tool says "not documented" where the label is found or needs review, the share of criteria sent to review, label status against answer for every set, and per-criterion counts, for the OCR run and the source-text run.
- **Held-out scores are locked.** A held-out set is scored only while its files match the sha256 frozen before its first run. That first run needs the freeze, its files and the tracked code committed, reads every page again instead of trusting stored OCR, and writes its score once, with the sha256 of every frozen and OCR file it used. Every later run must match that record and is saved as a development result. These checks catch mistakes and silent changes in this repository. They cannot show that nobody ran the pipeline on a set some other way first.
- **Typed fonts vary.** A third of pages use Roboto Mono, whose slashed zero OCR often reads as 8, and the rest use Liberation Sans or DejaVu Sans.

## What it does

A utilization-management nurse opens a faxed packet. The tool turns the page the right way up, straightens it and reads it with OCR. It removes names it finds in name-like places, such as a patient or prescriber field, a signature, an honorific or a "(fictional)" marker, so a bare name in running text can survive. It shifts dates and removes date strings it cannot read. It extracts diagnoses with who they are about and whether they are negated or uncertain, medications, doses, labs and prior therapy as drug-linked courses, and shows which source lines support each of five fictional criteria. A date that could be month first or day first is never guessed. It answers "not documented" only when the whole packet was read and nothing on it mentions the item, and otherwise says what it could not read. Every finding links back to its line on the page. The nurse accepts, corrects or flags each one, and every action goes into a local append-only, hash-chained log. The nurse makes the decision.

## Reading rules, stage D

The reading rules were rebuilt after the first held-out run, so every score from this change on is a development result, except the one blind run on the second held-out set. On the 63 development packets the tool now answers 266 of 315 statuses correctly, against 264 before and 164 for always answering "found". It no longer says "not documented" where the label is found or needs review, 0 of 258 against 12, and no longer says "evidence found" where the label is not, 0 of 151 against 3. Every remaining disagreement is an answer of needs review, most from words OCR read with low confidence. On the first held-out set, development data since 3 November, it answers 110 of 120, against its one blind score of 37 of 120 before the change. That rise was made by looking at those packets, so it says nothing about new layouts. The second held-out set, which nobody who changed the rules had opened, gives the number that does: 85 of 120 on its one blind run, against 49 for always answering "found". On the two multi-page fixtures it answers 9 of 10: with page 2 never received, prior therapy goes to review and names the missing page.

The reader is built to fail safe, and that costs review time. When it cannot tell whose result a value is, how far a negation reaches, what a box says, or when a value was taken, it answers needs review and says why, never "found" or "not documented" on a guess. GPT and Grok probed it on 3 November and raised 21 distinct findings. 19 held up in whole or in part, most of them places where it still guessed, and each is now a test. After the fixes it sends 143 of 315 development answers to review, against 142 before that round, and 46 of 120 on the first held-out set, against 43. The fixes change few answers here because these packets rarely use the patterns the reviewers found. Packets that do will send more to review. See [the stage D reader](docs/STAGE-D-READER.md) for the rules, the per-criterion counts, the review round and what the review answers cost.

## How we test it

| Question | Development, 63 packets | First held-out set, 24 packets, blind score before the rules change | First held-out set now, a development result | Second held-out set, 24 packets, blind score | Limit |
| --- | --- | --- | --- | --- | --- |
| Does it beat answering "found" every time? | 266 / 315 vs 164 / 315 | 37 / 120 vs 60 / 120 | 110 / 120 vs 60 / 120 | 85 / 120 vs 49 / 120 | Held-out sets are small and their labels are unreviewed |
| Does it say "found" only when it should? | 0 / 151 non-found labels called found | 1 / 60 | 0 / 60 | 4 / 71 | Each case is listed in the evaluation |
| Does it catch what is not documented? | 48 / 57, the other 9 sent to review | 24 / 24, but it answered "not documented" 95 of 120 times | 23 / 24 | 8 / 24, the other 16 sent to review | High recall in the first blind run came from failing to read |
| Does it say "not documented" only when nothing is there? | 0 / 258 documented or review labels called not documented | 71 / 96 | 0 / 96 | 1 / 96 | The error that sends a nurse to request what the packet already holds |
| Does it catch what needs review? | 94 / 94 | 4 / 36 | 36 / 36 | 42 / 47 | |
| Does it confirm good documentation? | 124 / 164 | 9 / 60 | 51 / 60 | 35 / 49 | Low-confidence OCR words and misreads send the rest to review |
| How much goes to review? | 143 / 315 | 15 / 120 | 46 / 120 | 72 / 120 | The cost of never guessing |
| Do the rules work without OCR? | 315 / 315 on source text | 40 / 120 on source text | 120 / 120 on source text | 83 / 120 on source text | Development rules fit the packets they were built on |
| Does it pull out the clinical facts? | Precision 871 / 901, recall 871 / 951 | Not labeled | Not labeled | Not labeled | Values must match exactly after the date shift is undone |
| Can OCR read the page? | 1.4% CER (641 / 47227), orientation 63 / 63 | 1.1% CER (143 / 13189), orientation 24 / 24 | The same pages | 7.4% CER (3993 / 53714), orientation 61 / 61 | Simulated effects and AI-drawn handwriting, not real faxes |
| Does the verifier catch unsupported summary sentences? | 189 / 189 | 72 / 72 | 72 / 72 | 72 / 72 | Exact-quote rule, so it catches these by construction |

Results break out by group, date format, layout, drug name, dose format, blank fields, misspellings, handwriting and scenario in [the evaluation](docs/EVALUATION.md), with the earlier revision's numbers beside the development results, label status against answer for each set, counts per criterion, and what arrived and what OCR could read.

## Follow one packet

Open `packet-018`, a form with simulated fax noise whose dates are all written day first with both numbers at 12 or less. Nothing on the page settles the order, so the lab window and the trial length each have two readings. Select the lab criterion to see both, and the reason the tool gives for sending it to review. The dose criterion shows the letter and the medication list disagreeing. Then open `packet-058` to see a diagnosis handwritten into a blank form field, two other fields left blank, and drawn circles and arrows.

Below the queue, open `multipage-01`, packet-018 sent as three fax pages. Each page shows with its number and its own fax counter, and the lab criterion highlights lines on all three. Then open `multipage-02`, the same fax with page 2 never received. The document panel says so before anything else.

The queue holds 63 packets across nine groups and three fictional drug-class criteria sets. The failure gallery lists every mismatch against the draft labels for every packet.

## Limits

This is a single-user prototype on synthetic templates. It does not prove clinical accuracy, safety, nurse time saved or performance on real faxes. The extraction rules and the generator were written together, so the pipeline reproduces every development label on the source text, and the first held-out set showed how little of that carries to new layouts. The second held-out set is one blind run of only 24 packets from two other models, with no confidence interval, and its labels are drafts no pharmacist has reviewed. Packets of several pages are tested only on two fixtures built from one development packet. A missing page is noticed only when the pages carry a counter. The page effects are simulated, the handwriting is AI-drawn and the typed fonts are three bundled fonts. One of them draws a slashed zero that OCR sometimes reads as 8. Exact quotation checks catch fabricated citations but cannot tell whether a quoted statement is true. From stage D the fictional PCSK9 rule accepts a high-intensity statin trial, atorvastatin 40 or 80 mg or rosuvastatin 20 or 40 mg daily, by Kevin's ruling of 2 November 2026. No development or first held-out packet uses rosuvastatin. The first held-out set's spec still names atorvastatin only and is left as it was frozen. The second held-out set was labeled under the rule the reader uses, and three of its packets use rosuvastatin.

The app has no authentication, multi-user isolation, validated de-identification or externally anchored audit storage. During evaluation the date shift comes from the packet ID, so it is not secret. Raw images and OCR contain fictional names. Do not enter real data. See the full [limits and retention notes](docs/HOW-BUILT.md#limits).

Kevin designed the workflow and the synthetic label set and reviews the draft labels as the pharmacist on the project. AI coding tools assisted with implementation, and an image model drew the handwriting. See [how it was built](docs/HOW-BUILT.md).

## Run locally

Requires Node 22 or newer and a free English OCR model download on first rebuild. No API key, account or paid service is used. The redaction library is installed from a pinned commit of its public repository.

```sh
npm ci
npm run eval -- --check
npm start
```

`npm start` prints the review workspace's local address. Open it in a browser. The checked-in page images, PDFs and OCR outputs let you inspect and rescore the demonstration immediately. `npm run generate` rebuilds the packets and labels. `npm run eval -- --rebuild` redraws all 63 pages and reruns local OCR, which takes several minutes. `npm run eval:holdout-v2 -- --check` confirms that the second held-out set's saved blind score reproduces from its stored OCR. Any other run on that set is saved as a development result.

A second consumer, a care-management summary, reuses the same redaction and extraction modules:

```sh
npm run summary -- eval/packets/packet-001.md
```

## What is reusable

| Service | Input | Output |
| --- | --- | --- |
| OCR | Synthetic page images, one per page | Orientation, deskew, text, per-word confidence, boxes, page number and review routing, plus a coverage record of the pages received and the lines read below the review threshold |
| Redact | Text | Redacted text with names in name-like places removed and dates shifted to tokens, or a blocked result |
| Extract | Redacted text, date channel and low-confidence lines | Medications, doses, diagnoses with assertion context, measurements and prior therapy as drug-linked courses, with exact source spans and match confidence, plus a ledger of the lines it could not read |
| Link evidence | Entities, fictional criteria ID and the coverage ledger | Found, not documented or needs-review status with supporting spans and a reason. Not documented only when nothing blocks that claim |
| Verify | Summary sentences and citations | Exact-citation support or a review flag for each sentence |
| Audit | Review action, target and note | Append-only, hash-chained local event |

[Typed contracts](services/contracts.ts), [workflow and build decisions](docs/HOW-BUILT.md), [the generator spec](eval/GENERATOR-SPEC.md), [terminology sources](docs/TERMINOLOGY.md) and [evaluation method and results](docs/EVALUATION.md) make the boundaries inspectable.

## Verify the build

```sh
npx playwright install chromium
npm run gate
```

The gate typechecks the services, runs the unit tests including a byte-for-byte rebuild of the packet set, reproduces saved metrics, and exercises review actions, persistence, keyboard access, overflow and WCAG AA checks at 1440×900, 430×932 and 390×844 in light and dark. `npm run media` records the review GIF in a visible local browser.
