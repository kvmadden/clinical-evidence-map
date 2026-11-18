# Public portfolio evaluation aggregate

`portfolio-aggregate.json` contains the synthetic evaluation figures cleared by prior publication in the Clinical Evidence Map case. It includes the archived Stage D run and development results, the comparison and routing totals, and the demo queue counts. Draft reference labels remain provisional.

Run `node scripts/portfolio-aggregate.mjs` to regenerate the portable JSON from a clean public checkout. Use `--check` to verify the cleared file digest, the archived figures and the relationships between the published totals. A later release needs a new cleared digest. The case uses these counts to build its tables and chart labels.

The Stage D archive is recorded at revision `53b96fd`. The routing totals are the aggregate already displayed from the development run at `3e9ce28`. The portfolio revision in the JSON records the exact previously published snapshot used for clearance. The aggregate contains no evaluation rows, packet text, source quotations or identifiers. The original scored artifacts remain in their existing custody.
