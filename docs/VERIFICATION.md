# Verification

How to check this build yourself, and what a fresh install of this snapshot gave on 2 November 2026.

| Command | What it checks | Result |
| --- | --- | --- |
| `npm ci` | Pinned dependencies install, including the redaction library from its public repository | Installed |
| `npm run typecheck` | The six service contracts and their implementations type-check | Exit 0 |
| `npm test` | Service contracts and source-span provenance | 12 of 12 pass |
| `npm run eval -- --check` | Rescores all 50 stored OCR outputs against the draft labels and requires an exact match with the saved metrics | Reproduced exactly |
| `npm run test:ui` | Review actions, persistence, keyboard access, overflow and WCAG AA checks at 1440×900, 430×932 and 390×844, light and dark | 7 of 7 pass |
| `npm run format:check` | Code style | Clean |

`npm run gate` runs the first five in order. Node 24.14.1 on macOS. No account, API key or paid service is used beyond installing packages.

The labels are drafts pending pharmacist review. [The evaluation](EVALUATION.md) says what the numbers show and what they do not.
