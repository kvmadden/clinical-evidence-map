# First five decisions

These decisions set Stage A's scope. They can change when Kevin reviews the material.

## 1. Keep the nurse responsible for the decision
The output answers whether a packet contains evidence for each criterion. It does not decide coverage. Missing documentation and contradictory documentation both need a person, but they are different problems and keep different labels.

## 2. Write fictional criteria for three drug classes
Use a GLP-1 for type 2 diabetes, a biologic for plaque psoriasis, and a PCSK9 inhibitor. Each set has five criteria, including a time window and a prior-treatment requirement. This covers several kinds of evidence without claiming to reproduce a payer policy. The thresholds are invented exercise rules. No public policy was copied or checked. These files need Kevin's review too.

## 3. Start with 50 source texts and a declared quality plan
Make five packets in each of ten quality groups. Keep text available so Kevin can inspect labels without OCR errors getting in the way. Skew and handwriting-like fonts are future rendering instructions. Missing pages and conflicting records are already present in the text. This separates intended source evidence from later OCR output.

## 4. Require exact source spans and leave every label unreviewed
Every extracted entity and criterion result has a reviewed flag set to false. Offsets point to the body of the source file, using a documented convention. Kevin can check the quoted text and correct a label without guessing where it came from. No terminology codes are invented. External normalization waits for Stage B.

## 5. Treat this set as a draft reference, not proof of performance
The 50 packets share templates. Review them by quality group and then by drug class. After corrections, freeze a version before running evaluations. Stage B must report errors and denominators, keep template families together when splitting data, and use a separately authored holdout before making broader claims. A score from this set alone will not establish clinical safety.

## Stage B decisions

6. Use local OCR and deterministic template rules first. Keep every predicted span tied to redacted OCR text. No paid model or network document transfer is needed for the workflow.
7. Reuse the current pii-redaction-gate identifiers profile as a pinned library. It strips dates, so temporal criteria must remain unresolved. Do not bypass that privacy boundary to improve a demonstration score.
8. Make verification conservative and extractive. Distinguish valid citations from low OCR confidence. Exact quotation support is not medical correctness.
9. Keep review actions as append-only annotations. A correction records the target and explanation without changing source material or Kevin's draft gold labels.
10. Ship repeatable draft diagnostics and a failure gallery. With zero reviewed labels, no clinical performance rate is released. Do not count scripted UI interactions as a nurse study.

## Stage C decisions

11. Name every group by the effect actually applied. Say "fax-style page image" for pages made on this computer, "scan" only for scanned paper and "faxed" only for faxed paper. The handwriting groups say "AI-drawn handwriting (image model)" because an image model drew it.
12. Build the set from structured facts with a checked-in generator, and write gold by applying the rules to those facts. Gold text for drawn handwriting follows the image, not the prompt.
13. Make gaps common. About half the labels are evidence found, so answering "found" every time scores about half. Report recall for not documented and needs review separately, beside that always-found baseline.
14. Diagnosis must be named as the reason for this request. A condition found only in a history or problem list, or stated as suspected, needs review. A different requested indication, with the class condition named nowhere, is not documented. Kevin can move either line.
15. Prior therapy needs objective evidence: the drug, a dose, at least 90 days, and a value on or before the start plus a value at least 90 days in that still misses the goal. A documented intolerance or contraindication with its reason also counts. A bare "inadequate response" needs review, with the reason stated. A trial in the wrong drug class is not documented. A look-alike drug name needs review.
16. Shift dates instead of removing them, through a separate date channel, so interval rules can run without real dates. Never guess an ambiguous day and month. A day above 12 or a later received date can settle the order. Otherwise keep both readings and route the criterion to review when they disagree. This replaces the date part of decision 7. Real dates still never reach extraction.
17. Pass a reviewed list of clinical words to the privacy library's safe-word option, and keep its name rule from joining lines. Measure over-redaction on every run.
18. Detect page orientation and straighten small skew before OCR, and show the reviewer the page as OCR read it.
19. Keep a pharmacist label only where the rule text and the quoted evidence are both unchanged. Otherwise keep the old answer and note in the gold file and ask for a fresh look.
20. Keep a held-out set that the rules have never seen. A different model writes it from a written spec alone, the set is frozen and hashed before the pipeline runs on it, and it runs once. Development numbers are called development results. Any rule change after the held-out run needs a fresh held-out set.
21. Vary the typed font across packets. Roboto Mono's slashed zero reads as 8 often enough to decide a whole class of errors, so a third of pages use it, a third Liberation Sans and a third DejaVu Sans.

## Stage D decisions, pages and honest scoring

22. A line holding only `<<page>>` starts a new page. A marker on the first or last line starts no blank page. Draw each page with the unchanged one-page renderer, page 1 under the packet's own seed and later pages under their own, and read each page on its own. Join the page texts in order, each ending on a line break, and keep a page number on every word, so the pipeline's offsets and quotes point into the joined text. Gold offsets count the marker lines, as the packet is written. Scoring compares quote text, so both line up. Leave `services/ocr/index.ts` alone, so a one-page packet takes the same path and keeps its OCR fingerprint.
23. Give the reading rules a coverage record built from the OCR output alone: pages received, page counters and the page numbers they say are missing, whether each page's turn was settled, word confidence per page and the lines below the review threshold. Kevin's rule of 3 November: "not documented" may only be answered once the whole packet was read. Anything that compares OCR with the source text stays in the evaluation and never reaches the pipeline, because production has no source text. The pages work records the coverage and passes it to the reading rules, which use it from decision 27 on.
24. From 3 November 2026 the first held-out set is development data, because the reading rules are being changed after seeing it. Keep its blind score of 37 of 120 as the score before the change, in `eval/holdout/results/first-score.json`, and report any later score on it as a development result.
25. Score a held-out set only while its files match the sha256 frozen before its first run. The first run needs the freeze, its files and the tracked code committed, claims the set with an exclusive create, reads every page again, and writes its record once with the freeze and the sha256 of every frozen and OCR file it used. Every later run must match the record and is a development result. A set marked development data never gets a blind score, and a committed record that goes missing must be restored from git. These checks catch mistakes and silent changes. They cannot prove nobody ran the pipeline on the set some other way first.
26. Report the error in the other direction too: how often the tool says "not documented" where the label is found or needs review, beside the share of criteria sent to review, label status against answer and counts per criterion, for the OCR run and the source-text run.

## Stage D decisions, reading rules

27. "Not documented" needs the whole packet read: every page received, every page readable, every line understood or ruled irrelevant, and nothing mentioning the item. A blocker names the line or page that stopped it. A field shown blank answers for itself, unless another line mentions the item and could not be read. A page that did not arrive, could not be read or arrived out of order blocks every "not documented" answer. A found answer stands, and the packet is marked incomplete. Kevin can move that line.
28. A low-confidence line blocks only the criteria whose words it resembles, even misread. A line resembling none is ruled irrelevant when most of its words were read with good confidence, and blocks every criterion when most were not.
29. Prior therapy is read as drug-linked courses. An outcome belongs to the drug it was written about, and an outcome with no drug counts for no drug. Stopping for an inadequate response is not an intolerance.
30. The rule counts 90 days from the start to the follow-up value. With no start date, and no stop date and duration to give one, that cannot be checked, so the answer is needs review. A follow-up value with no wording is placed by its date against the start.
31. Severity is never inferred from a measure. "Plaque psoriasis, BSA 15%" without a stated moderate-to-severe severity needs review.
32. An approximate age needs review. An age removed by the privacy step as over 89 is an adult age.
33. When the reader cannot tell scope, subject or date, it answers needs review and names why, never found or not documented on a guess. A blank field answers only for itself: a missing or unreadable page, or another unread line about the item, still blocks "not documented". This came from the review round of 3 November 2026 and sends a little more to review.
