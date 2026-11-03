# Blind relabel of the held-out set

The 120 held-out labels were written by Codex (gpt-6.1-sol) from `eval/holdout/SPEC.md` alone, and nobody had checked them. To check them before a pharmacist spot-check, three other model families labeled the same 24 packets without seeing those labels.

## Method

- Input, identical for all three: `prompt.md`. It holds the spec's criteria, statuses and rubric word for word, and the source text of the 24 packets with their front matter removed. It leaves out the spec's authoring task, format axes, render list and output schema, and it holds no frozen label.
- Relabelers, run on 3 Nov 2026, one run each, no retries:
  - `claude-opus-5.5.jsonl`: Claude Opus 5.5 (High), through Antigravity.
  - `gemini-4-argon.jsonl`: Gemini 4 Argon (High), through Antigravity.
  - `grok-4.7.jsonl`: Grok 4.7, through the grok CLI with terminal commands denied.
- Each file holds that model's answer, one JSON line per packet. The JSON is re-serialized one packet per line, with no change to its content. Grok's answer came as a stream, and its text events are joined.
- `node scripts/crosscheck.mjs` compares the statuses with the frozen labels. `tests/crosscheck.test.ts` checks that the numbers below reproduce.
- The frozen set itself is unchanged. `eval/holdout/FREEZE.json` covers packets, gold and manifest, and this folder sits outside it.

## Result

| Relabeler | Statuses that match the frozen label |
| --- | --- |
| Claude Opus 5.5 | 120 of 120 |
| Gemini 4 Argon | 120 of 120 |
| Grok 4.7 | 119 of 120 |
| All three | 119 of 120 |

The one disagreement is holdout-15, lab. The page says "Request written: 09/10/2026" and "Received: September 12 2026". Grok called the received date a second request date and chose needs_review. The rubric uses a received date only to settle whether a numeric date reads month first or day first. Here it rules out a day-first request on 9 October, so the BSA of 17% on 1 September is 9 days before the request, and evidence_found stands. The other two relabelers gave that reason.

## What this does and does not show

- It shows the frozen labels follow the written rubric. Four models from four families read the rubric the same way on 119 of 120 labels.
- It does not show the rubric is clinically right. All four read the same rules. A pharmacist still has to judge the rules and a sample of the labels before the labels are called reviewed.
- The held-out score is unchanged: no label was edited, and no rule changed.
