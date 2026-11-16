# Synthetic development regression

The development command checks 63 synthetic cases against independently accepted case outputs. The two multipage fixtures and both 24-case holdouts remain historical evidence. The historical commands and their saved outputs retain their original reproduction contract.

Capture new OCR in a fresh directory outside the repository. Provide an English traineddata file as an explicit input. The version 2 receipt records the full Node, operating system, architecture and Sharp version map, the OCR producer tree including the capture module, and the traineddata, manifest, source and OCR identities. Both commands use the clean canonical checkout that contains the executed module, regardless of the working directory. The capture destination must have an existing parent outside that checkout after resolving symlinks. A fresh capture does not establish the traineddata identity of any historical run.

```sh
node --import "$PWD/node_modules/tsx/dist/loader.mjs" scripts/development-capture.ts /absolute/fresh-capture-dir /absolute/eng.traineddata
npm run --silent eval:development -- propose /absolute/fresh-capture-dir
npm run --silent eval:development -- check /absolute/fresh-capture-dir /absolute/expectations.json /absolute/acceptance.json
```

The proposal command prints a `proposal-only` report. Save its `proposal` object as the candidate expectations JSON. The `reviewEvidence` array contains the full extraction and page coverage for inspection. Independent review must compare case evidence and record approval for the exact bytes before the check can pass. Record the reviewer, author, decision, reason, prior expectation SHA-256 or null for the first baseline, the proposed expectation SHA-256, capture SHA-256, manifest SHA-256, extractor revision, policy name, policy SHA-256 and the disposition of each case. Keep the capture, expectations and approval in private evaluation custody. A later check takes the prior expectation file as its final argument when an approval names a prior baseline.

The checker compares the full extraction and page coverage for each case. Object keys are ordered deterministically and arrays keep their original order. Timings are outside the extraction. The report includes every case identity and identifies which output fields changed. Required cases cannot be skipped. Neither command writes expectations or acceptance records. Missing, partial or unapproved data blocks the check.

## Local aggregate proof

Run the separate entry point from a clean candidate checkout with dependencies installed from the reviewed lockfile.

```sh
npm run gate:local -- /absolute/private/runner-config.json
```

The owner-provisioned JSON uses schema `clinical-local-aggregate/v1` and takes the full candidate `revision`, `reportsParent`, `archiveRepo` and `historicalNode`. Provision four verified file entries named `capture`, `expectations`, `acceptance` and `traineddata`, each with an absolute `path` and exact `sha256`. The capture path points to its existing `capture.json` beside the OCR directory. The approval file must be owner-only. Provision the five original SHA-256 inventory receipts under `inventories`, with keys `stage-c`, `stage-d-dev`, `stage-d-holdout`, `stage-d-multipage` and `stage-d-blind2`. Each receipt is similarly pinned by path and SHA-256.

The runner verifies these identities and original archived blobs, then makes disposable local checkouts and records each stage in an owner-only report directory. It checks the approved development baseline, all five original-revision stored-OCR runs, both freezes, typecheck, unit tests and UI. The historical runtime is the reviewed Node 24.14.1 on darwin arm64 with Sharp 0.34.5 and libvips 8.17.3. The current runtime should be the supported Node binary used for the current suite. Only stored historical OCR is replayed. The UI stage needs loopback port 4178 available and defers when native device tests are active. An unavailable prerequisite or failed stage exits nonzero. The usual package commands remain available independently.
