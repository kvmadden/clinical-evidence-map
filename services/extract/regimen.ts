// Dose regimens for one drug mention: amount, unit, route and the frequency
// nearest the amount, with titration steps ("0.25 mg weekly x 4 weeks, then
// 0.5 mg weekly"), loading doses ("80 mg once, then 40 mg every other week"),
// alternatives ("140 mg every 2 weeks or 420 mg monthly"), strengths
// ("2 mg/1.5 mL pen") and tablet counts. Unsafe decimals (".5 mg", "0,5 mg")
// are flagged for a person to confirm, never silently read.
import { FREQUENCIES, ROUTES, NUMBER, numberWord } from "./lexicon.js"

export interface Step {
  amount: number
  unit: "mg"
  written: string
  frequency: string | null
  route: string | null
  once: boolean
  // Code unit offsets of the amount and frequency within the parsed text.
  amountAt: [number, number]
  frequencyAt: [number, number] | null
  durationDays: number | null
}
export interface Regimen {
  steps: Step[]
  final: Step | null
  ambiguous: boolean
  leadingDecimal: boolean
  decimalComma: boolean
  // An amount was written but no frequency was found for it.
  incomplete: boolean
}

const show = (n: number) => String(Math.round(n * 1000) / 1000)
export const canonicalDose = (s: Step) =>
  s.frequency ? `${show(s.amount)} mg ${s.frequency}` : null

interface Hit {
  canonical: string
  start: number
  end: number
}
export function frequencies(text: string): Hit[] {
  const hits: Hit[] = []
  for (const f of FREQUENCIES) {
    const g = new RegExp(
      f.pattern.source,
      f.pattern.flags.includes("g") ? f.pattern.flags : f.pattern.flags + "g",
    )
    for (const m of text.matchAll(g))
      hits.push({
        canonical: f.canonical,
        start: m.index!,
        end: m.index! + m[0].length,
      })
  }
  // Drop matches inside a longer match ("daily" inside "twice daily").
  return hits
    .filter(
      (h) =>
        !hits.some(
          (o) =>
            o !== h &&
            o.start <= h.start &&
            o.end >= h.end &&
            o.end - o.start > h.end - h.start,
        ),
    )
    .sort((a, b) => a.start - b.start)
}

// An amount right after "digit:" ("8:5 mg") is a misread, never a dose.
const AMOUNT =
  /(?<![\w.,]|\d:)((?:\d{1,3}(?:,\d{3})+|\d+)(?:[.,]\d+)?|\.\d+)\s*(mg|mcg|µg|ug|milligrams?|micrograms?)\b/gi
const TABLETS_A = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*mg\\s+tab(?:let)?s?\\b,?\\s*(${NUMBER})\\s+tab(?:let)?s?\\b`,
  "i",
)
const TABLETS_B = new RegExp(
  `\\b(${NUMBER})\\s+tab(?:let)?s?\\s*\\(\\s*(\\d+(?:\\.\\d+)?)\\s*mg(?:\\s+each)?\\s*\\)`,
  "i",
)
// Words that mark a part of the line as a past regimen, not the request.
const HISTORICAL_ASIDE =
  /\((?:[^()]*\b(?:previously|formerly|was|prior|titrated\s+(?:up\s+)?from|increased\s+from|up\s+from|from|started\s+at|old\s+dose)\b[^()]*)\)/gi

function duration(text: string): number | null {
  const m =
    text.match(
      new RegExp(
        `\\b(?:x|for|over|times)\\s*(${NUMBER})\\s*(wks?|weeks?|mos?|months?|days?|d)\\b`,
        "i",
      ),
    ) ??
    text.match(
      new RegExp(
        `(?<!every\\s{1,3})(?<!q\\s?)\\b(${NUMBER})\\s*(wks?|weeks?|mos?|months?)\\b`,
        "i",
      ),
    )
  if (!m) return null
  const n = numberWord(m[1])
  if (n === undefined) return null
  const u = m[2].toLowerCase()
  return n * (u.startsWith("w") ? 7 : u.startsWith("m") ? 30 : 1)
}

export function parseRegimen(raw: string): Regimen {
  // Blank out historical asides, keeping offsets.
  const text = raw.replace(HISTORICAL_ASIDE, (m) => " ".repeat(m.length))
  const leadingDecimal = /(?<![\d])\.\d+\s*(?:mg|mcg)\b/i.test(text)
  const decimalComma = /(?<![\d,])\d,\d{1,2}\s*(?:mg|mcg)\b/i.test(text)
  // Split into steps at "then", arrows and "followed by".
  const cuts = [0]
  for (const m of text.matchAll(
    /,?\s*\b(?:then|followed\s+by|thereafter|after\s+that)\b|→|->/gi,
  ))
    cuts.push(m.index!)
  cuts.push(text.length)
  const steps: Step[] = []
  let ambiguous = false
  let incomplete = false
  for (let k = 0; k + 1 < cuts.length; k++) {
    const from = cuts[k],
      to = cuts[k + 1]
    const part = text.slice(from, to)
    const amounts: {
      value: number
      start: number
      end: number
      strength: boolean
      preferred: boolean
    }[] = []
    const tabsA = part.match(TABLETS_A)
    const tabsB = part.match(TABLETS_B)
    if (tabsA) {
      const n = numberWord(tabsA[2])
      if (n !== undefined)
        amounts.push({
          value: Number(tabsA[1]) * n,
          start: tabsA.index!,
          end: tabsA.index! + tabsA[0].length,
          strength: false,
          preferred: true,
        })
    } else if (tabsB) {
      const n = numberWord(tabsB[1])
      if (n !== undefined)
        amounts.push({
          value: n * Number(tabsB[2]),
          start: tabsB.index!,
          end: tabsB.index! + tabsB[0].length,
          strength: false,
          preferred: true,
        })
    }
    if (!amounts.length)
      for (const m of part.matchAll(AMOUNT)) {
        let written = m[1]
        // A decimal comma is read as a decimal point and flagged; a thousands
        // comma ("1,000 mg") is read as thousands.
        if (/^\d+,\d{1,2}$/.test(written)) written = written.replace(",", ".")
        else written = written.replace(/,/g, "")
        let value = Number(written.startsWith(".") ? `0${written}` : written)
        if (/^(?:mcg|µg|ug|micrograms?)$/i.test(m[2])) value = value / 1000
        const end = m.index! + m[0].length
        const strength =
          /^\s*\/\s*(?:\d+(?:\.\d+)?\s*)?(?:m?l|ml|kg|m2|actuation)\b/i.test(
            part.slice(end),
          )
        const before = part.slice(Math.max(0, m.index! - 24), m.index!)
        const preferred =
          /\b(?:inject|injects|take|takes|give|administer|dose\s+of|dose:?|then)\s*$/i.test(
            before,
          ) || /\b\d+\s+(?:pen|syringe|injection)s?\s*\(\s*$/i.test(before)
        amounts.push({ value, start: m.index!, end, strength, preferred })
      }
    if (!amounts.length) continue
    const doses = amounts.filter((a) => !a.strength)
    const pool = doses.length ? doses : amounts
    const chosen = pool.find((a) => a.preferred) ?? pool[0]
    const distinct = new Set(pool.map((a) => a.value))
    if (distinct.size > 1 && /\bor\b/i.test(part)) ambiguous = true
    const freqs = frequencies(part)
    // The frequency nearest after the amount, before the next amount; else the
    // nearest one before it.
    const nextAmount =
      pool.find((a) => a.start > chosen.start)?.start ?? part.length
    const freq =
      freqs.find((f) => f.start >= chosen.end && f.start < nextAmount) ??
      [...freqs].reverse().find((f) => f.end <= chosen.start) ??
      null
    if (distinct.size > 1 && freqs.length > 1 && /\bor\b/i.test(part))
      ambiguous = true
    const route = ROUTES.find((r) => r.pattern.test(part))?.canonical ?? null
    const step: Step = {
      amount: chosen.value,
      unit: "mg",
      written: part.slice(chosen.start, chosen.end),
      frequency: freq && freq.canonical !== "once" ? freq.canonical : null,
      route,
      once: freq?.canonical === "once",
      amountAt: [from + chosen.start, from + chosen.end],
      frequencyAt: freq ? [from + freq.start, from + freq.end] : null,
      durationDays: duration(part),
    }
    if (!step.frequency && !step.once) incomplete = true
    steps.push(step)
  }
  const maintenance = [...steps].reverse().find((s) => s.frequency) ?? null
  if (steps.length && !maintenance) incomplete = true
  return {
    steps,
    final: maintenance,
    ambiguous,
    leadingDecimal,
    decimalComma,
    incomplete: incomplete && !maintenance,
  }
}

// The canonical dose string for a written regimen, or null when no amount
// and frequency are both present. Kept for callers of the earlier API.
export function parseDose(text: string) {
  const r = parseRegimen(text)
  if (!r.final) return null
  return { canonical: canonicalDose(r.final)!, amount: r.final.amount }
}
