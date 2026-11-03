import { test } from "node:test"
import assert from "node:assert/strict"
import { redact } from "../services/redact/index.js"
import { findDates } from "../services/redact/dates.js"

test("redact removes seeded identifiers and keeps clinical words the old step hid", () => {
  const result = redact({
    text: [
      "Patient: Mira Brookvale (fictional). Email: mira@example.test.",
      "From: Dr. Rowan Vale, fictional requesting provider.",
      "Please review the enclosed records for Type 2 diabetes mellitus.",
      "Please review the enclosed records for Moderate-to-severe plaque psoriasis.",
      "Please review the enclosed records for Established atherosclerotic cardiovascular disease.",
      "On Lipitor: LDL-C 128 mg/dL.",
    ].join("\n"),
  })
  assert.equal(result.blocked, false)
  for (const secret of [
    "mira@example.test",
    "Mira",
    "Brookvale",
    "Rowan",
    "Vale",
  ])
    assert.ok(!result.text.includes(secret), secret)
  assert.match(result.text, /records for Type 2 diabetes mellitus/)
  assert.match(result.text, /records for Moderate-to-severe plaque psoriasis/)
  assert.match(result.text, /records for Established atherosclerotic/)
  assert.match(result.text, /On Lipitor:/)
  assert.ok(!/records for \[name\]/.test(result.text))
  assert.equal(result.offsetBasis, "redacted Unicode code points")
})

test("redact keeps line breaks where a capitalized word ends one line and starts the next", () => {
  const text =
    "Medication requested: Humira\nDose and frequency: 40 mg q2wk\nPatient: Mira\nBrookvale (fictional)."
  const result = redact({ text })
  assert.equal(result.text.split("\n").length, 4)
  assert.match(result.text, /^Medication requested: Humira\nDose and frequency/)
  assert.ok(!result.text.includes("Mira") && !result.text.includes("Brookvale"))
})

test("date shift keeps intervals, hides every original date and never guesses an ambiguous order", () => {
  const text =
    "Request date: 2026-10-01.\nCollected 15/09/2026.\nStarted 01/04/2026; stopped Aug 1, 2026.\nfaxed 10/2 - see attached"
  const shifted = redact({ text, dateShiftDays: 40000 })
  assert.equal(shifted.dateHandling, "shifted")
  for (const d of [
    "2026-10-01",
    "15/09/2026",
    "01/04/2026",
    "Aug 1, 2026",
    "10/2",
  ])
    assert.ok(!shifted.text.includes(d), d)
  const [request, collected, started, stopped] = shifted.dates
  assert.equal(request.order, "ymd")
  assert.equal(collected.order, "dmy")
  assert.equal(started.order, "ambiguous")
  assert.equal(started.readings.length, 2)
  const days = (a: string, b: string) =>
    (Date.parse(b) - Date.parse(a)) / 86400000
  assert.equal(days(collected.readings[0], request.readings[0]), 16)
  // Day first, as the 15/09 date shows, the trial ran 122 days.
  assert.equal(days(started.readings[1], stopped.readings[0]), 122)
  assert.match(shifted.text, /faxed \[date\]/)
  const removed = redact({ text })
  assert.equal(removed.dateHandling, "removed")
  assert.equal(removed.dates.length, 0)
  assert.ok(!/\d{4}-\d\d-\d\d/.test(removed.text))
})

test("date finder reads every format in the set and rejects impossible dates", () => {
  const found = findDates(
    "2026-10-01, 10/01/2026, 10-1-26, 01/10/2026, 1 Oct 2026, Oct 1, 2026, 9/14/26, 31/31/2026, 2026-02-30",
  )
  assert.deepEqual(
    found.map((f) => [f.written, f.order, f.readings]),
    [
      ["2026-10-01", "ymd", ["2026-10-01"]],
      ["10/01/2026", "ambiguous", ["2026-10-01", "2026-01-10"]],
      ["10-1-26", "ambiguous", ["2026-10-01", "2026-01-10"]],
      ["01/10/2026", "ambiguous", ["2026-01-10", "2026-10-01"]],
      ["1 Oct 2026", "text", ["2026-10-01"]],
      ["Oct 1, 2026", "text", ["2026-10-01"]],
      ["9/14/26", "mdy", ["2026-09-14"]],
    ],
  )
})
