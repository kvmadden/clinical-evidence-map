import { readFileSync } from "node:fs"
import { redactText } from "layered-pii-redaction"
import type { DateMention, RedactInput, RedactOutput } from "../contracts.js"
import {
  addDays,
  findDates,
  partialDates,
  RESIDUAL_DATE,
  tokenName,
} from "./dates.js"
import { clinicalCategory } from "../extract/lexicon.js"

// Clinical words the library's unknown-name heuristic would otherwise hide,
// for example "Type" in "records for Type 2 diabetes mellitus".
const vocabulary = JSON.parse(
  readFileSync(new URL("./clinical-vocabulary.json", import.meta.url), "utf8"),
) as { words: string[] }
export const CLINICAL_SAFE_WORDS: readonly string[] = vocabulary.words

const LINE_GUARD = "⁣"
const CAPITAL = /^[A-Z][a-z]{1,20}$/
const WORD = /\b[A-Z][a-z]{1,20}(?:[-'][A-Z][a-z]{1,20})?\b/g

// A capitalized word is a name only with name-like context: a person field
// (Patient:, Prescriber:, Signed:), an honorific or credential, the synthetic
// "(fictional)" marker, a relation word, a signature line, or a sentence that
// makes it the subject of a person predicate ("Jalen is 39 years old"). Every
// other capitalized word is kept, so "[x] Treating", "Prescription:",
// "Intended use" and "Sitagliptin" survive. Once a word is known to be a name
// in this packet, every occurrence is removed.
const PERSON_FIELD =
  /^(?:\s*(?:\[[ xX✓]?\]|[-*•])\s*)?(?:patient(?:'s)?(?:\s+name)?|pt(?:\s+name)?|name|re|member|insured|subscriber|from|to|attn|attention|prescriber|prescribing\s+(?:clinician|provider|physician)|provider|physician|clinician|doctor|author|signed|signature|author\s+signature|e-?signed(?:\s+by)?|electronically\s+signed\s+by|attested\s+by|attestation|entered\s+by|prepared\s+by|completed\s+by|reviewed\s+by|reviewer|consultant|examiner|seen\s+by|ordering\s+(?:clinician|professional|provider|physician)|referring\s+(?:clinician|provider|physician)|writer(?:\s+initials)?|person|caregiver|contact|nurse|pharmacist|cc)\s*(?:[:|?=]|\s-\s)\s*(.+)$/i
const BY_PHRASE =
  /\b(?:attested|entered|prepared|completed|signed|reviewed|dictated|written|seen|transcribed)\s+by\s*:?\s+(.+)$/i
const CLOSING =
  /^\s*(?:regards|sincerely|thank\s+you|thanks|respectfully|best)\s*,\s*(.+)$/i
const HONORIFIC =
  /\b(?:Dr|Mr|Mrs|Ms|Mx|Miss|Prof)\.?\s+((?:[A-Z][A-Za-z'-]+\.?\s*){1,3})/g
const CREDENTIAL =
  /\b([A-Z][a-z'-]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z'-]+),?\s+(?:MD|M\.D\.|DO|NP|PA-C|PA|RN|PharmD|RPh|APRN|CNP|FNP|DNP)\b/g
const FICTIONAL = /((?:\b[A-Z][A-Za-z'-]*\.?\s+){1,4})\(fictional\)/g
const RELATION =
  /\b(?:husband|wife|son|daughter|mother|father|sister|brother|partner|caregiver|spouse|guardian)\s*[:,(]?\s+([A-Z][a-z]{1,24})\b/g
const PREDICATE =
  /(?:^|[.!?;]\s+)([A-Z][a-z]{2,20})\s+(?:is\s+(?:a|an)\s+\d{1,3}[- ]?(?:year|yr)|is\s+\d{1,3}\s+(?:years?|yrs?)\b|reports\b|states\b|presents\b|returns\b|was\s+seen\b|called\b|has\s+been\b|is\s+here\b)/g
const ALL_CAPS_NAME =
  /^(?:\s*(?:patient|name|pt)\s*[:|]\s*)?([A-Z]{2,}(?:[-'][A-Z]{2,})?)\s*,\s*([A-Z]{2,})(?:\s+[A-Z])?\b/
const NOT_NAMES = new Set(
  [
    "Patient",
    "Pt",
    "She",
    "He",
    "They",
    "This",
    "That",
    "It",
    "The",
    "Her",
    "His",
    "Our",
    "Mother",
    "Father",
    "Today",
    "Request",
    "Fictional",
    "Dr",
    "Mr",
    "Mrs",
    "Ms",
    "Mx",
    "Miss",
    "Prof",
    "MD",
    "DO",
    "NP",
    "PA",
    "RN",
  ].map((w) => w.toLowerCase()),
)
const isVocabulary = (word: string) =>
  NOT_NAMES.has(word.toLowerCase()) || clinicalCategory(word) !== null

// Name-shaped words at the start of a captured value, stopping at the first
// lowercase word, digit, bracket or punctuation that ends a name.
// Words that can follow a person label without being a name.
const NOT_A_NAME_VALUE = new Set(
  "see attached on file unknown none the a an not provided same as above below per chart record pending refer to list form fax sheet page enclosed illegible and or of for with in by self patient".split(
    " ",
  ),
)
// Name-shaped words at the start of a captured value, stopping at the first
// word that ends a name. In an explicit person field a lowercase name counts
// too, because faxes and OCR lose capitals: "Patient: mira brookvale".
function nameWords(value: string, personField = false) {
  const out: string[] = []
  const allCaps = value.match(
    /^\s*([A-Z]{2,}(?:[-'][A-Z]{2,})?)\s*,\s*([A-Z]{2,})\b/,
  )
  if (allCaps) return [allCaps[1], allCaps[2]]
  for (const raw of value
    .replace(/\b(?:Dr|Mr|Mrs|Ms|Mx|Miss|Prof)\.?\s+/gi, "")
    .split(/\s+/)) {
    const w = raw.replace(/[.,;:]+$/, "")
    const shaped = personField
      ? /^[A-Za-z][A-Za-z'-]*$/.test(w) &&
        !NOT_A_NAME_VALUE.has(w.toLowerCase())
      : /^[A-Z][A-Za-z'-]*$/.test(w)
    if (!shaped || (personField && isVocabulary(w))) break
    if (w.length > 1) out.push(w)
    if (/[,;]$/.test(raw) || out.length >= 4) break
  }
  return out
}

export function detectNames(text: string) {
  const names = new Set<string>()
  const add = (w: string) => {
    const clean = w.replace(/[.,;:]+$/, "")
    if (clean.length < 2) return
    if (/^[A-Z]\.?$/.test(clean)) return
    if (isVocabulary(clean)) return
    names.add(clean)
  }
  // Pipe tables: the cells under a name column are names. A header row such
  // as "Name | Age | Sex" is never itself a name field.
  let nameColumn = -1
  for (const line of text.split("\n")) {
    const cells = line.split("|").map((c) => c.trim())
    if (cells.length >= 3) {
      const header = cells.findIndex((c) =>
        /^(?:patient(?:\s+name)?|name|pt(?:\s+name)?|member|prescriber|provider|clinician|physician|signed\s+by|author)$/i.test(
          c,
        ),
      )
      if (
        header >= 0 &&
        cells.every((c) => !c || /^[A-Za-z][A-Za-z /()-]{0,30}$/.test(c))
      ) {
        nameColumn = header
        continue
      }
      if (nameColumn >= 0 && cells[nameColumn])
        nameWords(cells[nameColumn], true).forEach(add)
    } else nameColumn = -1
    const field = cells.length >= 3 ? null : line.match(PERSON_FIELD)
    if (field) nameWords(field[1], true).forEach(add)
    const by = line.match(BY_PHRASE)
    if (by) nameWords(by[1]).forEach(add)
    const closing = line.match(CLOSING)
    if (closing) nameWords(closing[1]).forEach(add)
    const caps = line.match(ALL_CAPS_NAME)
    if (caps) [caps[1], caps[2]].forEach(add)
    for (const m of line.matchAll(HONORIFIC)) nameWords(m[1]).forEach(add)
    for (const m of line.matchAll(CREDENTIAL)) nameWords(m[1]).forEach(add)
    for (const m of line.matchAll(FICTIONAL)) nameWords(m[1]).forEach(add)
    for (const m of line.matchAll(RELATION)) add(m[1])
    for (const m of line.matchAll(PREDICATE)) add(m[1])
    // A line that is only two or three capitalized words, optionally with a
    // credential, is a signature unless the words are clinical or form words.
    const sig = line
      .trim()
      .match(
        /^([A-Z][a-z'-]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z'-]+){1,2})(?:,?\s+(?:MD|DO|NP|PA-C|PA|RN|PharmD|RPh))?\.?$/,
      )
    if (sig && !sig[1].split(/\s+/).some(isVocabulary))
      sig[1].split(/\s+/).forEach(add)
  }
  return names
}

// Finds capitalized word pairs split by a line break that the library's own
// two-word rule would treat as a name, using the text before redaction.
function splitNamePairs(
  text: string,
  options: Parameters<typeof redactText>[1],
) {
  const lines = text.split("\n")
  const pairs: { line: number; first: string; second: string }[] = []
  for (let i = 0; i + 1 < lines.length; i++) {
    const first = lines[i].match(/([A-Z][a-z]{1,20})\s*$/)?.[1]
    const second = lines[i + 1].match(/^\s*([A-Z][a-z]{1,20})\b/)?.[1]
    if (!first || !second || !CAPITAL.test(first) || !CAPITAL.test(second))
      continue
    // Form and clinical words, field labels ("Sex: F") and table cells are
    // never half of a name pair.
    if (isVocabulary(first) || isVocabulary(second)) continue
    if (new RegExp(`^\\s*${second}\\s*[:|]`).test(lines[i + 1])) continue
    if (/\|\s*[A-Za-z]+\s*$/.test(lines[i])) continue
    const pair = `${first} ${second}`
    if (redactText(pair, options).text !== pair)
      pairs.push({ line: i, first, second })
  }
  return pairs
}
function redactSplitNames(
  text: string,
  pairs: ReturnType<typeof splitNamePairs>,
) {
  const lines = text.split("\n")
  for (const { line, first, second } of pairs) {
    lines[line] = lines[line].replace(new RegExp(`${first}(\\s*)$`), "[name]$1")
    lines[line + 1] = lines[line + 1].replace(
      new RegExp(`^(\\s*)${second}\\b`),
      "$1[name]",
    )
  }
  return lines.join("\n")
}

// Pairs each [token] in the redacted text with the text it replaced. The
// privacy step only replaces substrings, so the literal text between tokens
// anchors the match. Returns null if the texts do not line up.
const TOKEN = /\[(?:date-[a-z]+|[a-z]+(?:-[a-z]+)*)\]/g
function replacedText(before: string, after: string) {
  const tokens = [...after.matchAll(TOKEN)]
  const parts = after.split(TOKEN)
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = before.match(
    new RegExp(`^${parts.map(escape).join("([\\s\\S]*?)")}$`),
  )
  if (!match) return null
  return tokens.map((t, i) => ({
    token: t[0],
    index: t.index!,
    original: match[i + 1],
  }))
}

// Never loads the operator's private people map. All traffic stays local.
// With dateShiftDays, each date the step can read becomes a numbered token and
// a shifted reading in `dates`, so intervals survive and the original date does
// not. Without it, dates are removed, as the library does on its own.
export function redact({ text, dateShiftDays }: RedactInput): RedactOutput {
  const shift = Number.isInteger(dateShiftDays) ? dateShiftDays! : null
  const dates: DateMention[] = []
  let prepared = ""
  let cursor = 0
  for (const found of findDates(text)) {
    prepared += text.slice(cursor, found.start)
    if (shift === null) prepared += "[date]"
    else {
      const token = tokenName(dates.length)
      dates.push({
        token,
        readings: found.readings.map((r) => addDays(r, shift)),
        order: found.order,
        ...(found.precision === "month" ? { precision: "month" as const } : {}),
      })
      prepared += token
    }
    cursor = found.end
  }
  prepared += text.slice(cursor)
  // Month and day without a year cannot be shifted reliably, so remove them.
  for (const p of partialDates(prepared).reverse())
    prepared = prepared.slice(0, p.start) + "[date]" + prepared.slice(p.end)
  const names = detectNames(prepared)
  const lowerNames = new Set([...names].map((n) => n.toLowerCase()))
  const safe = new Set(CLINICAL_SAFE_WORDS)
  for (const m of prepared.matchAll(WORD))
    for (const part of [m[0], ...m[0].split(/[-']/)])
      if (part && !lowerNames.has(part.toLowerCase())) safe.add(part)
  const options = {
    profile: "identifiers" as const,
    peopleMap: {
      people: [...names].map((name) => ({ name })) as never[],
      safe: [...safe],
    },
  }
  // The library's two-word name rule can match across a line break and joins
  // the words with a space, merging two lines. An invisible separator before
  // each break keeps its rules on one line. Name pairs split across a break are
  // then checked with the same library rule, one pair at a time.
  const split = splitNamePairs(prepared, options)
  const result = redactText(
    prepared.replaceAll("\n", `${LINE_GUARD}\n`),
    options,
  )
  if (result.blocked)
    return {
      text: result.text,
      blocked: true,
      hits: result.hits,
      offsetBasis: "redacted Unicode code points",
      dateHandling: shift === null ? "removed" : "shifted",
      dates: [],
    }
  let redacted = redactSplitNames(
    result.text.replaceAll(`${LINE_GUARD}\n`, "\n"),
    split,
  )
  // Any date-like string still written out was unreadable to the date step:
  // remove it so no original date passes, and let the reader name the line.
  redacted = redacted.replace(RESIDUAL_DATE, "[date]")
  const removedClinical: { line: number; category: string }[] = []
  for (const r of replacedText(prepared, redacted) ?? []) {
    if (r.token !== "[name]") continue
    for (const word of r.original.split(/[^A-Za-z]+/)) {
      const category = clinicalCategory(word)
      if (!category) continue
      const line = redacted.slice(0, r.index).split("\n").length - 1
      removedClinical.push({ line, category })
      break
    }
  }
  return {
    text: redacted,
    blocked: false,
    hits: result.hits,
    offsetBasis: "redacted Unicode code points",
    dateHandling: shift === null ? "removed" : "shifted",
    dates,
    ...(removedClinical.length ? { removedClinical } : {}),
  }
}
