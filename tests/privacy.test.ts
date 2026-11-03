import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { redact } from "../services/redact/index.js"
import { clinicalCategory } from "../services/extract/lexicon.js"
import { sourceBody } from "../services/pipeline.js"

// Every development packet and every packet of the first held-out set (now
// development data), in both the source text and the cached OCR text. A name
// needs name-like context to be removed, so clinical and form words stay, and
// no fictional name word or written date survives.
const sets = ["eval", "eval/holdout"]
const packets = sets.flatMap((dir) =>
  readdirSync(`${dir}/packets`)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const id = f.replace(".md", "")
      const body = sourceBody(readFileSync(`${dir}/packets/${f}`, "utf8"))
      const ocr = JSON.parse(
        readFileSync(`${dir}/artifacts/${id}.json`, "utf8"),
      ).ocr.text as string
      const gold = JSON.parse(readFileSync(`${dir}/gold/${id}.json`, "utf8"))
      return { id, body, ocr, gold }
    }),
)
const DATE =
  /\b\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*-\d{2,4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2},? \d{4}\b|\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/

test("the packet sets are all here", () => {
  assert.equal(packets.length, 87)
})

test("no fictional name word or written date survives, in source or OCR text", () => {
  const leaks: string[] = []
  for (const p of packets) {
    const names = new Set<string>()
    for (const m of p.body.matchAll(
      /((?:[A-Z][A-Za-z'-]+\.?\s+){1,3})\(fictional\)/g,
    ))
      for (const w of m[1].split(/[^A-Za-z]+/))
        if (w.length > 2 && w !== "Dr") names.add(w)
    for (const e of p.gold.entities ?? [])
      if (["patient_name", "provider"].includes(e.type))
        for (const w of String(e.value).split(/[^A-Za-z]+/))
          if (w.length > 2 && w !== "Dr") names.add(w)
    for (const [kind, text] of [
      ["source", p.body],
      ["ocr", p.ocr],
    ] as const) {
      const out = redact({ text, dateShiftDays: 0 }).text
      for (const w of names)
        if (new RegExp(`\\b${w}\\b`).test(out))
          leaks.push(`${p.id} ${kind}: ${w}`)
      const date = out.match(DATE)
      if (date) leaks.push(`${p.id} ${kind}: date ${date[0]}`)
    }
  }
  assert.deepEqual(leaks, [])
})

test("clinical and form words in the source text are never removed as names", () => {
  // Whole alphanumeric words, so "T2DM" is checked as one word, and form
  // words such as "Request" count as much as drug and condition names.
  const removed: string[] = []
  for (const p of packets) {
    const out = redact({ text: p.body, dateShiftDays: 0 }).text.split("\n")
    p.body.split("\n").forEach((line, i) => {
      for (const w of line.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) ?? []) {
        if (!/[A-Za-z]/.test(w)) continue
        // Month names go with the dates they are part of.
        if (
          /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*$/i.test(
            w,
          )
        )
          continue
        const category = clinicalCategory(w)
        if (!category) continue
        const word = new RegExp(
          `(?<![A-Za-z0-9])${w.replace(/[-']/g, "\\$&")}(?![A-Za-z0-9])`,
        )
        if (!word.test(out[i] ?? ""))
          removed.push(`${p.id}: ${w} (${category})`)
      }
    })
  }
  assert.deepEqual(removed, [])
})

test("clinical abbreviations and form words are never names, wherever they sit", () => {
  for (const word of [
    "CAD",
    "ASCVD",
    "MI",
    "CHD",
    "PCI",
    "CABG",
    "PAD",
    "TIA",
    "STEMI",
    "T2DM",
    "HTN",
    "Request",
    "Order",
    "Prescription",
    "Treating",
    "Intended",
  ]) {
    for (const text of [
      `Re: ${word}\nIndication: ${word}\n`,
      `${word}, MI\nNote: ${word} again\n`,
      `Patient: Riley Moss (fictional)\n${word}\n`,
    ]) {
      const out = redact({ text, dateShiftDays: 0 }).text
      const kept = (
        out.match(new RegExp(`(?<![A-Za-z0-9])${word}(?![A-Za-z0-9])`, "g")) ??
        []
      ).length
      const written = (
        text.match(new RegExp(`(?<![A-Za-z0-9])${word}(?![A-Za-z0-9])`, "g")) ??
        []
      ).length
      assert.equal(kept, written, `${word} in ${JSON.stringify(out)}`)
    }
  }
})

test("the privacy step keeps every line break, so line numbers carry over", () => {
  for (const p of packets)
    for (const text of [p.body, p.ocr])
      assert.equal(
        redact({ text, dateShiftDays: 0 }).text.split("\n").length,
        text.split("\n").length,
        p.id,
      )
})
