# Stage A file checks

Checked November 1, 2026, before clinical review.

| Check | Result |
| --- | --- |
| Source and gold files paired by packet ID | 50 of 50 |
| Fictional criteria sets | 3, with 5 rules each |
| Class distribution | 17 GLP-1, 17 biologic, 16 PCSK9 |
| Quality groups | 10, with 5 packets each |
| Extracted entity labels | 700 |
| Exact source spans checked against source body | 995 of 995 match |
| Criterion labels reference the assigned rule set | 250 of 250 |
| Criterion statuses | 220 evidence_found, 10 missing, 20 needs_review |
| Missing criteria have empty evidence lists | 10 of 10 |
| Draft reviewed flags | All false |
| Banned phrases in generated Markdown | None found |

These checks used Python's standard library to parse every JSON file, compare source substrings with span text, count the groups, and verify the draft flags. Sample conflicting-date and conflicting-dose files were also inspected. The checks confirm file consistency. They do not confirm clinical correctness, reviewer agreement, OCR accuracy, redaction performance or any product target. Kevin's review remains pending.
