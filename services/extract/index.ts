// The reader. It builds a layout-aware model of the page (document.ts), then
// reads request and received dates, ages, conditions with their assertion
// context, labs with their dates, the requested regimen, medication-list
// doses and drug-linked treatment episodes. It also keeps a coverage ledger:
// every line that mentions a criterion's concepts but could not be read
// becomes a blocker, so the linker never says "not documented" about
// something the page mentions.
import { readFileSync } from "node:fs"
import type {
  Blocker,
  CriterionId,
  DateMention,
  DateReading,
  Entity,
  EntityValue,
  ExtractInput,
  ExtractOutput,
  Match,
  Mention,
  Normalization,
  ReaderCoverage,
  Span,
} from "../contracts.js"
import {
  CLINICAL_WORDS,
  CONDITIONS,
  DRUGS,
  LABS,
  LOOK_ALIKES,
  NUMBER,
  OUTCOMES,
  numberWord,
  type DrugEntry,
  type LabEntry,
} from "./lexicon.js"
import {
  buildDocument,
  isBlankValue,
  lineText,
  roleOf,
  type DocLine,
} from "./document.js"
import { assertion, RELATION_AFTER, type Assertion } from "./context.js"
import { parseRegimen, canonicalDose, type Regimen } from "./regimen.js"
export { parseDose, parseRegimen } from "./regimen.js"
export { buildDocument } from "./document.js"

const terminology = JSON.parse(
  readFileSync(new URL("./terminology.json", import.meta.url), "utf8"),
) as Record<string, Normalization>

// Optimal string alignment distance. A swap of two neighbors counts as one edit.
export function osa(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)),
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

interface Alias {
  generic: string
  kind: Match["kind"]
  drug: DrugEntry
}
const ALIASES = new Map<string, Alias>()
for (const drug of DRUGS) {
  ALIASES.set(drug.generic.toLowerCase(), {
    generic: drug.generic,
    kind: "exact",
    drug,
  })
  for (const b of drug.brands)
    ALIASES.set(b.toLowerCase(), { generic: drug.generic, kind: "brand", drug })
  for (const a of drug.abbreviations)
    ALIASES.set(a.toLowerCase(), {
      generic: drug.generic,
      kind: "abbreviation",
      drug,
    })
}
const MULTIWORD = [...ALIASES.keys()].filter((k) => k.includes(" "))
// Drug classes these requests are for. A bare regimen line for one of these
// drugs, outside a history or medication list, is the request.
const REQUESTABLE = new Set(["glp1", "tnf", "pcsk9"])

export interface DrugHit {
  generic: string
  match: Match
  index: number
  end: number
  resembles?: string
  drug: DrugEntry
}
// Exact names, brands and abbreviations first. A word one edit from a single
// known name (two edits for ten or more letters) is a spelling variant with
// lower confidence. A name that is itself a known look-alike is never accepted.
export function findDrugs(text: string): DrugHit[] {
  const hits: DrugHit[] = []
  for (const alias of MULTIWORD)
    for (const m of text.matchAll(new RegExp(`\\b${alias}\\b`, "gi"))) {
      const info = ALIASES.get(alias)!
      hits.push({
        generic: info.generic,
        match: { kind: info.kind, written: m[0], confidence: 1 },
        index: m.index!,
        end: m.index! + m[0].length,
        drug: info.drug,
      })
    }
  for (const m of text.matchAll(/[A-Za-z][A-Za-z]+/g)) {
    const written = m[0]
    const index = m.index!,
      end = index + written.length
    if (hits.some((h) => h.index <= index && h.end >= end)) continue
    const w = written.toLowerCase()
    const exact = ALIASES.get(w)
    if (exact) {
      const resembles = LOOK_ALIKES[w]
      hits.push(
        resembles
          ? {
              generic: exact.generic,
              match: { kind: "look-alike", written, confidence: 0.5 },
              index,
              end,
              resembles: ALIASES.get(resembles)?.generic ?? resembles,
              drug: exact.drug,
            }
          : {
              generic: exact.generic,
              match: { kind: exact.kind, written, confidence: 1 },
              index,
              end,
              drug: exact.drug,
            },
      )
      continue
    }
    if (w.length < 6 || CLINICAL_WORDS.includes(w)) continue
    let best: Alias | null = null
    let bestDistance = 99,
      tie = false
    for (const [alias, info] of ALIASES) {
      if (alias.length < 6 || alias.includes(" ")) continue
      const distance = osa(w, alias)
      if (distance < bestDistance) {
        best = info
        bestDistance = distance
        tie = false
      } else if (
        distance === bestDistance &&
        best &&
        info.generic !== best.generic
      )
        tie = true
    }
    if (best && !tie && bestDistance <= (w.length >= 10 ? 2 : 1))
      hits.push({
        generic: best.generic,
        match: {
          kind: "spelling-variant",
          written,
          confidence: bestDistance === 1 ? 0.9 : 0.75,
        },
        index,
        end,
        drug: best.drug,
      })
  }
  return hits.sort((a, b) => a.index - b.index)
}

// Corrects one-edit misspellings of condition words of seven or more letters,
// keeping a map from corrected offsets back to the written text.
function correctWords(text: string) {
  let out = ""
  const map: number[] = []
  const corrections: { start: number; end: number; written: string }[] = []
  let last = 0
  for (const m of text.matchAll(/[A-Za-z]{7,}/g)) {
    const word = m[0]
    const w = word.toLowerCase()
    if (CLINICAL_WORDS.includes(w)) continue
    const near = CLINICAL_WORDS.filter((c) => c.length >= 7 && osa(w, c) === 1)
    if (near.length !== 1) continue
    for (let k = last; k < m.index!; k++) {
      map.push(k)
      out += text[k]
    }
    const start = m.index!,
      end = start + word.length
    const replacement = near[0]
    for (let k = 0; k < replacement.length; k++)
      map.push(start + Math.min(k, word.length - 1))
    out += replacement
    corrections.push({ start, end, written: word })
    last = end
  }
  for (let k = last; k < text.length; k++) {
    map.push(k)
    out += text[k]
  }
  map.push(text.length)
  return { text: out, map, corrections }
}

// Words that tie a line to a criterion even when OCR misreads a letter or two.
const TOPIC_WORDS: Record<CriterionId, string[]> = {
  adult: ["age", "aged", "years", "year-old", "dob", "birth", "born"],
  diagnosis: [
    "diabetes",
    "diabetic",
    "mellitus",
    "psoriasis",
    "plaque",
    "severe",
    "moderate",
    "ascvd",
    "atherosclerotic",
    "cardiovascular",
    "coronary",
    "artery",
    "myocardial",
    "infarction",
    "stent",
    "stroke",
    "angina",
    "indication",
    "diagnosis",
    "condition",
    "assessment",
    "impression",
  ],
  lab: [
    "a1c",
    "hba1c",
    "hemoglobin",
    "glycated",
    "bsa",
    "surface",
    "ldl",
    "cholesterol",
    "lipid",
    "percent",
    "collected",
    "labs",
  ],
  prior: [
    "metformin",
    "glucophage",
    "methotrexate",
    "trexall",
    "otrexup",
    "mtx",
    "statin",
    "atorvastatin",
    "rosuvastatin",
    "simvastatin",
    "pravastatin",
    "lipitor",
    "crestor",
    "prior",
    "previous",
    "tried",
    "trial",
    "stopped",
    "started",
    "intolerance",
    "intolerant",
    "contraindicated",
    "failed",
    "response",
    "therapy",
    "therapies",
    "discontinued",
    "nausea",
    "myalgias",
  ],
  dose: [
    "semaglutide",
    "ozempic",
    "wegovy",
    "rybelsus",
    "adalimumab",
    "humira",
    "evolocumab",
    "repatha",
    "dose",
    "dosage",
    "weekly",
    "monthly",
    "every",
    "weeks",
    "frequency",
    "strength",
    "inject",
    "injection",
    "directions",
    "maintenance",
  ],
}
const ocrFold = (w: string) =>
  w
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[1|!]/g, "l")
    .replace(/5/g, "s")
    .replace(/8/g, "b")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/[^a-z-]/g, "")
const FOLDED = Object.fromEntries(
  Object.entries(TOPIC_WORDS).map(([c, ws]) => [c, ws.map(ocrFold)]),
) as Record<CriterionId, string[]>
export function topicsOf(text: string) {
  const topics = new Set<CriterionId>()
  if (/\d\s*(?:mg|mcg)\b(?!\s*\/\s*d[lL])/i.test(text)) {
    topics.add("dose")
    topics.add("prior")
  }
  const tokens = text
    .split(/[^A-Za-z0-9|!-]+/)
    .map(ocrFold)
    .filter((t) => t.length >= 3)
  for (const [c, words] of Object.entries(FOLDED) as [CriterionId, string[]][])
    for (const t of tokens) {
      const limit = t.length <= 4 ? 0 : t.length <= 7 ? 1 : 2
      if (
        words.some(
          (w) => Math.abs(w.length - t.length) <= limit && osa(t, w) <= limit,
        )
      ) {
        topics.add(c)
        break
      }
    }
  return topics
}

export interface ConditionHit {
  value: string
  family?: string
  index: number
  end: number
  // Written words corrected inside this mention.
  corrected: string[]
  certainty: "confirmed" | "unconfirmed"
  negated: boolean
  icd?: string
}
const ICD = /\b([A-Z]\d{2}(?:\.\d{1,4})?)\b/g
const global = (re: RegExp) =>
  new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")
export function findConditions(raw: string): ConditionHit[] {
  const { text, map, corrections } = correctWords(raw)
  const hits: ConditionHit[] = []
  const taken: [number, number][] = []
  for (const c of CONDITIONS) {
    // Every pattern of one condition, overlapping matches merged into the
    // widest span, so "moderate-to-severe plaque psoriasis" is one mention
    // whichever pattern matched first.
    const spans: [number, number][] = []
    for (const p of c.patterns)
      for (const m of text.matchAll(global(p)))
        spans.push([m.index!, m.index! + m[0].length])
    spans.sort((x, y) => x[0] - y[0])
    const merged: [number, number][] = []
    for (const sp of spans) {
      const last = merged.at(-1)
      if (last && sp[0] < last[1]) last[1] = Math.max(last[1], sp[1])
      else merged.push([...sp])
    }
    for (const [ms, me] of merged) {
      const start = map[ms],
        end = map[me - 1] + 1
      if (taken.some(([a, b]) => a < end && start < b)) continue
      taken.push([start, end])
      const a = assertion(text, ms, me)
      hits.push({
        value: c.value,
        family: c.family,
        index: start,
        end,
        corrected: corrections
          .filter((k) => k.start >= start && k.end <= end)
          .map((k) => k.written),
        negated: a.negated,
        certainty: a.uncertain ? "unconfirmed" : "confirmed",
      })
    }
  }
  for (const m of raw.matchAll(ICD)) {
    const code = m[1]
    const c = CONDITIONS.find((k) => k.icd?.test(code))
    if (!c) continue
    const start = m.index!,
      end = start + m[0].length
    if (taken.some(([a, b]) => a < end && start < b)) continue
    taken.push([start, end])
    const a = assertion(raw, start, end)
    hits.push({
      value: c.value,
      family: c.family,
      index: start,
      end,
      corrected: [],
      negated: a.negated,
      certainty: a.uncertain ? "unconfirmed" : "confirmed",
      icd: code,
    })
  }
  return hits.sort((a, b) => a.index - b.index)
}

const TOKEN = /\[date-[a-z]+\]/g
const number = (s: string) => Number(s.replace(/,/g, ""))
const tokensIn = (s: string) =>
  [...s.matchAll(TOKEN)].map((m) => ({ token: m[0], index: m.index! }))

// Words that open a request statement in prose, or tie a condition to it.
const REQUEST_VERB =
  /\b(?:request(?:s|ing|ed)?|authori[sz]e|authori[sz]ation\s+for|please\s+(?:supply|approve|cover|authori[sz]e)|supply|sought|seeking|being\s+sought|prescription\s+is|directions\s+are|maintenance\s+prescription|order(?:ed)?|start(?:ing)?|initiat(?:e|ing)|prescrib(?:e|ing))\b/i
const TIED_FOR =
  /\b(?:request(?:s|ing|ed)?|authori[sz]e|supply|sought|seeking|approve|cover|order(?:ed)?|prescrib(?:e|ed|ing)|start(?:ing)?|initiat(?:e|ing))\b[^.;]*?\bfor\s+(?:[\w'-]+\s+){0,3}$/i
const TIED_PHRASE =
  /\b(?:indication|reason)\s+for\s+(?:this|the)\s+(?:request|order|prescription|medication|therapy|drug)\b|\bis\s+the\s+(?:indication|reason)\b|\bfor\s+this\s+(?:request|order)\b|\breason\s+for\s+(?:this\s+)?request\b|\bbeing\s+treated\s+with\s+this\b/i
const THIS_ASSESSMENT =
  /\bthis\s+(?:assessment|diagnosis|condition|impression)\s+is\s+the\s+(?:reason|indication)\b/i
const QUESTION_TIED =
  /\b(?:indication|reason|diagnosis|condition)\b[^?]*\b(?:request|order|prescription|this\s+(?:medication|drug|therapy))\b/i
const NEGATED_REQUEST =
  /\b(?:not\s+requested|old\s+order|prior\s+order|previous\s+order|discontinue(?:d)?\s+this|do\s+not\s+(?:dispense|fill)|cancel(?:led|ed)?|void(?:ed)?|entered\s+in\s+error|strike|struck)\b/i
const CORRECTION =
  /\b(?:correct(?:ion|ed)(?:\s+to)?|replaces?\s+(?:the\s+)?(?:prior|previous|earlier)\s+(?:order|request|dose)|supersed(?:es|ed)|amended|updated\s+to|changed\s+to)\b/i

const AGE_PROSE: RegExp[] = [
  /\b(\d{1,3})[- ](?:years?|yrs?)[- ]old\b/gi,
  /\b(\d{1,3})\s*(?:y\/o|y\.o\.?|yo\b|yr\s+old)/gi,
  /\b(\d{1,3})\s+years?\s+of\s+age\b/gi,
  /\bage[ds]?\s*[:=]?\s*(\d{1,3})\b(?!\s*(?:at|when|by|of\s+(?:onset|diagnosis))\b)/gi,
]
const LAB_VALUE =
  /([<>≤≥]=?)?\s*(\d+(?:\.\d+)?)\s*(%|percent|mg\s*\/\s*d[lL]|mmol\s*\/\s*mol|mmol\s*\/\s*[lL])?/g
// A lab result that is not a usable value.
const INVALID_LAB =
  /\b(?:hemoly[sz]ed|haemoly[sz]ed|invalid|cancel+ed|insufficient\s+(?:sample|specimen|quantity)|qns|clotted|not\s+(?:done|performed|resulted|collected)|pending|redraw|to\s+be\s+(?:drawn|repeated))\b/i
// Another analyte after a value ends the value list of the lab before it
// ("A1C=7.9%, eGFR 82").
const OTHER_ANALYTE =
  /[,;]\s*(?:e?gfr|creatinine|cr|glucose|fbg|fpg|hdl|triglycerides?|tg|tsh|alt|ast|bun|potassium|sodium|bmi|weight|wt|bp|pasi|crp|esr|wbc|plt|platelets|total\s+cholesterol|tc|non-hdl|apob|ck|cpk|insulin|uacr|acr|microalbumin|iga)\b/i
// Efficacy statements that compare a value with a goal. They describe the
// values, so they are kept on the episode and never stand in for them.
const GOAL =
  /\b(?:not\s+at\s+goal|above\s+goal|(?:goal|target)[^.;]{0,30}not\s+(?:met|reached|achieved)|remained\s+(?:high|elevated|above)|still\s+(?:high|elevated|above))\b/i
// A lab the rule measures, said to be still high.
const GOAL_LAB_HIGH =
  /\b(?:(?:elevated|high|higher|rising|uncontrolled|persistent(?:ly)?\s+(?:high|elevated)|still\s+(?:high|elevated))\s+(?:a1c|hba1c|hemoglobin\s+a1c|glucose|blood\s+sugars?|sugars?|ldl(?:-c)?|ldl\s+cholesterol|cholesterol|lipids?|bsa|body\s+surface\s+area)|(?:a1c|hba1c|glucose|sugars?|ldl(?:-c)?|cholesterol|lipids?|bsa)\s+(?:(?:remained|stayed|still|was|were|is|kept)\s+)?(?:high|elevated|uncontrolled|above\s+goal|not\s+at\s+goal|rising))\b/i
// Words that say a dose is written but could not be read.
const DOSE_UNREAD =
  /\b(?:illegible|unreadable|unclear|cannot\s+be\s+read|can'?t\s+read|smudged|obscured)\b|\?\?/i
// Words that make a drug line history, not a request.
const HISTORY_WORDS =
  /\b(?:failed|stopped|discontinu\w*|previously|prior|tried|was|were|history|intoleran\w*|ago|in\s+20\d\d|last\s+(?:year|month)|before|used\s+to)\b/i
const NOT_TRIED =
  /^\s*[:,-]?\s*(?:was\s+)?(?:not\s+(?:tried|taken|used|given)|never\s+(?:tried|taken|used|started|given)|none)\b/i
const ATTRIBUTE =
  /\[date-[a-z]+\]|\[date\]|\d+(?:\.\d+)?\s*(?:mg|mcg)\b|\b(?:trial|course|dose|dosage|sig|frequency|started|start|began|begun|since|stopped|discontinu\w*|d\/c|ended|end|completed|duration|length|how\s+long|why|outcome|response|result|reason|before|after|baseline|during|while|on\s+treatment|on\s+therapy|at\s+last|follow-?up|intoleran\w*|contraindicat\w*|failed|failure|inadequate|improv\w*|worse|goal|tolerat\w*|side\s+effects?|symptoms|myalgi\w*|nausea|diarrh\w*|weeks?|months?|days?|wks?|mos?|it\s+was|this\s+was|that\s+course|the\s+course)\b/i
const STOP_ATTACH = /^\s*(?:current|latest|most\s+recent|today|recent)\b/i
const STOP_ROLES = [
  "age",
  "indication",
  "request",
  "requestDate",
  "receivedDate",
  "medications",
  "history",
  "family",
  "assessment",
]

interface CondMention {
  line: DocLine
  value: string
  family?: string
  role: "request" | "assessment" | "history" | "family" | "note"
  a: Assertion
  checked?: string
  start: number
  end: number
  tied: boolean
  corrected: string[]
  // The mention sits where the request states its reason.
  inRequest: boolean
}
interface LabValue {
  line: DocLine
  lab: LabEntry
  value: number
  unit: string
  comparator?: string
  valueAt: [number, number]
  token?: string
  tokenLine?: DocLine
  role: "result" | "baseline" | "followup" | "target" | "invalid"
  converted?: string
  badUnit?: boolean
  episode?: number
  // Code unit range of the lab name the value belongs to.
  nameAt?: [number, number]
}
interface DrugAt {
  line: DocLine
  hit: DrugHit
  // Code unit range of this drug's part of the line's full text.
  from: number
  to: number
}
interface Episode {
  id: number
  drug: DrugAt
  lines: DocLine[]
  status: string
}

const findLabs = (s: string) => {
  const out: { lab: LabEntry; index: number; end: number }[] = []
  for (const lab of LABS)
    for (const m of s.matchAll(global(lab.pattern)))
      if (
        !out.some((o) => o.index < m.index! + m[0].length && m.index! < o.end)
      )
        out.push({ lab, index: m.index!, end: m.index! + m[0].length })
  return out.sort((a, b) => a.index - b.index)
}
const convert = (lab: LabEntry, value: number, unit: string | undefined) => {
  const u = (unit ?? "").replace(/\s+/g, "").toLowerCase()
  if (lab.name === "LDL-C" && u === "mmol/l")
    return { value: Math.round(value * 38.67), converted: `${value} mmol/L` }
  if (lab.name === "A1c" && u === "mmol/mol")
    return {
      value: Math.round((value / 10.929 + 2.15) * 10) / 10,
      converted: `${value} mmol/mol`,
    }
  if (lab.name === "A1c" && u.startsWith("mg")) return { value, badUnit: true }
  if (lab.name === "LDL-C" && (u === "%" || u === "percent"))
    return { value, badUnit: true }
  // A body surface area written as a fraction ("0.15") is not a percentage.
  if (lab.name === "BSA" && !u && value > 0 && value < 1)
    return { value, badUnit: true }
  return { value }
}
// The sentence around [start, end) in one line.
function sentenceOf(t: string, start: number, end: number) {
  let s = 0,
    e = t.length
  const stop = (k: number) =>
    /[;!?]/.test(t[k]) ||
    (t[k] === "." && !(/\d/.test(t[k - 1] ?? "") && /\d/.test(t[k + 1] ?? "")))
  for (let k = start - 1; k >= 0; k--)
    if (stop(k)) {
      s = k + 1
      break
    }
  for (let k = end; k < t.length; k++)
    if (stop(k)) {
      e = k
      break
    }
  return t.slice(s, e)
}

export function extract({
  text,
  dates = [],
  lowConfidenceLines = [],
  lowConfidenceWords,
  removedClinical = [],
  pageStartLines = [],
}: ExtractInput): ExtractOutput {
  const doc = buildDocument(text, pageStartLines)
  const byToken = new Map(dates.map((d) => [d.token, d]))
  const entities: Entity[] = []
  const lineOf = new Map<Entity, number>()
  // A value and the date read with it. Ids are assigned after sorting.
  const relatedOf = new Map<Entity, Entity>()
  const dated: { entity: Entity; mention: DateMention; page: number }[] = []
  const lineSpan = (l: DocLine): Span => ({
    start: l.start,
    end: l.start + Array.from(l.text).length,
    text: l.text,
  })
  // Code point position, in the whole text, of a code unit offset in a
  // line's full text (the line plus any lines joined onto it).
  const at = (l: DocLine, cu: number) => {
    const own = l.text.trimEnd().length
    if (!l.joined || cu <= own)
      return (
        l.start +
        Array.from(l.text.slice(0, Math.min(cu, l.text.length))).length
      )
    let rest = cu - own - 1
    for (const j of l.joined) {
      const n = doc[j]
      const lead = n.text.length - n.text.trimStart().length
      const body = n.text.trim()
      if (rest <= body.length)
        return (
          n.start + Array.from(n.text.slice(0, lead + Math.max(0, rest))).length
        )
      rest -= body.length + 1
    }
    const last = doc[l.joined.at(-1)!]
    return last.start + Array.from(last.text).length
  }
  const add = (
    l: DocLine,
    type: string,
    value: EntityValue,
    extra: Partial<Entity> & { valueAt?: [number, number] } = {},
  ) => {
    const { valueAt, ...rest } = extra
    const code = typeof value === "string" ? terminology[value] : undefined
    const entity: Entity = {
      id: "",
      type,
      value,
      source_span: lineSpan(l),
      ...(l.joined
        ? { spans: [lineSpan(l), ...l.joined.map((j) => lineSpan(doc[j]))] }
        : {}),
      ...(code ? { normalization: code } : {}),
      ...(valueAt
        ? { value_span: { start: at(l, valueAt[0]), end: at(l, valueAt[1]) } }
        : {}),
      ...rest,
      reviewed: false,
    }
    entities.push(entity)
    lineOf.set(entity, l.i)
    return entity
  }
  const addDate = (
    l: DocLine,
    type: string,
    token: string,
    extra: Partial<Entity> = {},
  ) => {
    const mention = byToken.get(token)
    if (!mention) return null
    const t = lineText(l)
    const k = t.indexOf(token)
    const attrs = {
      ...(extra.attrs ?? {}),
      ...(mention.precision === "month" ? { precision: "month" } : {}),
    }
    const entity = add(l, type, mention.readings[0], {
      ...extra,
      ...(k >= 0 ? { valueAt: [k, k + token.length] as [number, number] } : {}),
      ...(Object.keys(attrs).length ? { attrs } : {}),
    })
    dated.push({ entity, mention, page: l.page })
    return entity
  }
  const quote = (l: DocLine) => `"${lineText(l).trim()}"`

  // Ledger for the whole-packet coverage rule.
  const criteria: CriterionId[] = ["adult", "diagnosis", "lab", "prior", "dose"]
  const understood: Record<CriterionId, Set<number>> = {
    adult: new Set(),
    diagnosis: new Set(),
    lab: new Set(),
    prior: new Set(),
    dose: new Set(),
  }
  const blockers: Record<CriterionId, Blocker[]> = {
    adult: [],
    diagnosis: [],
    lab: [],
    prior: [],
    dose: [],
  }
  const block = (c: CriterionId, b: Blocker) => {
    if (
      !blockers[c].some(
        (x) => x.kind === b.kind && x.line === b.line && x.scope === b.scope,
      )
    )
      blockers[c].push(b)
  }
  const mentions: Mention[] = []
  const used = new Set<number>()
  const content = doc.filter((l) =>
    ["field", "prose", "table-row"].includes(l.kind),
  )

  // ---------- request and received dates ----------
  const requestDates: { line: DocLine; token: string; label: string }[] = []
  const receivedDates: { line: DocLine; token: string }[] = []
  const bareDates: { line: DocLine; token: string; label: string }[] = []
  for (const l of content) {
    const t = lineText(l)
    const value = l.value ?? t
    const first = tokensIn(value)[0]?.token
    if (l.kind === "field" && first) {
      const onlyDate =
        /^\s*[,.;:|]*\s*\[date-[a-z]+\]\s*[.,;]?\s*(?:\d{1,2}:\d{2}.*)?$/.test(
          value,
        )
      if (
        l.role === "requestDate" ||
        (onlyDate && /\brequest/i.test(l.label ?? ""))
      )
        requestDates.push({ line: l, token: first, label: l.label ?? "" })
      else if (l.role === "receivedDate")
        receivedDates.push({ line: l, token: first })
      else if (l.role === "bareDate" && onlyDate)
        bareDates.push({ line: l, token: first, label: l.label ?? "" })
      continue
    }
    const prose =
      t.match(
        /^\s*(written|dated|prepared|submitted|sent|filed|authored|entered|completed|signed)\s*:?\s*(?:on\s+)?(\[date-[a-z]+\])/i,
      ) ??
      t.match(
        /\b(letter|request|form|submission)\s+(?:is\s+|was\s+)?(?:dated|written|submitted|prepared|signed)\s+(?:on\s+)?(\[date-[a-z]+\])/i,
      )
    if (prose) requestDates.push({ line: l, token: prose[2], label: prose[1] })
    const rec = t.match(
      /^\s*(?:fax\s+)?received\s*:?\s*(?:on\s+)?(\[date-[a-z]+\])/i,
    )
    if (rec) receivedDates.push({ line: l, token: rec[1] })
  }
  if (!requestDates.length) requestDates.push(...bareDates)
  const seenRequest: string[] = []
  for (const r of requestDates) {
    const reading = byToken.get(r.token)?.readings.join("|") ?? r.token
    used.add(r.line.i)
    if (seenRequest.includes(reading)) continue
    const conflict = seenRequest.length > 0
    seenRequest.push(reading)
    addDate(
      r.line,
      conflict ? "conflicting_request_date" : "request_date",
      r.token,
      { attrs: { label: r.label } },
    )
  }
  for (const r of receivedDates) {
    addDate(r.line, "fax_received_date", r.token)
    used.add(r.line.i)
  }

  // ---------- numeric date order ----------
  // Per page: a day above 12 settles the order, unless the fax received date
  // shows that order puts a date after receipt, which is a conflict. With no
  // day above 12, the received date can rule one order out. Anything else
  // keeps both readings for the linker to test.
  const pageOf = new Map<string, number>()
  for (const l of doc)
    for (const t of tokensIn(l.text)) pageOf.set(t.token, l.page)
  const present = dates.filter((d) => pageOf.has(d.token))
  const pages = [...new Set(present.map((d) => pageOf.get(d.token)!))]
  const header = dated.find(
    (d) =>
      d.entity.type === "fax_received_date" && d.mention.readings.length === 1,
  )
  const orders = new Map<number, DateReading>()
  for (const p of pages) {
    const here = present.filter((d) => pageOf.get(d.token) === p)
    const ambiguous = here.filter((m) => m.order === "ambiguous")
    let reading: DateReading = { status: "none", order: null }
    if (ambiguous.length) {
      const forced = new Set(
        here
          .filter((m) => m.order === "mdy" || m.order === "dmy")
          .map((m) => m.order as "mdy" | "dmy"),
      )
      const fitsHeader = (o: "mdy" | "dmy") =>
        !header ||
        ambiguous.every(
          (m) => m.readings[o === "mdy" ? 0 : 1] <= header.mention.readings[0],
        )
      if (forced.size === 1) {
        const o = [...forced][0]
        reading = fitsHeader(o)
          ? { status: "forced", order: o }
          : { status: "conflict", order: null }
      } else if (forced.size === 2)
        reading = { status: "conflict", order: null }
      else {
        const fits = header ? (["mdy", "dmy"] as const).filter(fitsHeader) : []
        reading =
          fits.length === 1
            ? { status: "header", order: fits[0] }
            : { status: "unresolved", order: null }
      }
    }
    orders.set(p, reading)
    if (reading.status === "conflict")
      for (const c of ["lab", "prior"] as CriterionId[])
        block(c, {
          kind: "unreadable-date",
          page: p,
          message:
            "Numeric dates on this page disagree on month-first or day-first order.",
        })
  }
  // The readings of a date token after the page order is applied.
  const readingsOf = (token: string): string[] => {
    const m = byToken.get(token)
    if (!m) return []
    if (m.order !== "ambiguous") return m.readings.slice(0, 1)
    const o = orders.get(pageOf.get(token) ?? 1)?.order
    return o ? [m.readings[o === "mdy" ? 0 : 1]] : m.readings.slice(0, 2)
  }

  // ---------- ages ----------
  const ages = new Set<string>()
  const addAge = (
    l: DocLine,
    value: number | "over 89",
    valueAt: [number, number],
    attrs: Record<string, string | number | boolean> = {},
  ) => {
    understood.adult.add(l.i)
    const key = String(value)
    if (ages.has(key)) return
    ages.add(key)
    add(l, "age", value, {
      valueAt,
      ...(value === "over 89"
        ? { attrs: { ...attrs, overEightyNine: true } }
        : Object.keys(attrs).length
          ? { attrs }
          : {}),
    })
  }
  for (const l of content) {
    const t = lineText(l)
    if (l.kind === "field" && l.role === "age") {
      const off = l.valueOffset ?? 0
      const v = t.slice(off)
      if (/^\s*\[age\]/.test(v)) {
        const k = t.indexOf("[age]", off)
        addAge(l, "over 89", [k, k + 5])
        continue
      }
      const corrected = v.match(
        /\b(?:corrected|amended|updated)\s+to\s+(\d{1,3})\b/i,
      )
      const approx = v.match(
        /\b(?:approx(?:imately)?\.?|about|around|~|estimated|roughly)\s*(\d{1,3})\b/i,
      )
      const n = v.match(/^\s*(\d{1,3})(?:\s*(months?|mos?\b|weeks?|wks?))?/i)
      if (corrected) {
        const k =
          off + corrected.index! + corrected[0].lastIndexOf(corrected[1])
        addAge(l, number(corrected[1]), [k, k + corrected[1].length], {
          corrected: true,
        })
        continue
      }
      if (approx) {
        const k = off + approx.index! + approx[0].lastIndexOf(approx[1])
        addAge(l, number(approx[1]), [k, k + approx[1].length], {
          approximate: true,
        })
        continue
      }
      if (n) {
        const k = off + v.indexOf(n[1])
        const months = !!n[2] && /^m/i.test(n[2])
        const weeks = !!n[2] && /^w/i.test(n[2])
        addAge(
          l,
          months ? Math.floor(number(n[1]) / 12) : weeks ? 0 : number(n[1]),
          [k, k + n[1].length],
          months || weeks ? { unit: months ? "months" : "weeks" } : {},
        )
        continue
      }
      if (isBlankValue(v)) {
        add(l, "blank_field", "age")
        understood.adult.add(l.i)
        continue
      }
    }
    if (l.kind === "table-row")
      for (const c of l.cells ?? [])
        if (c.header === "age") {
          const m = c.text.match(/^(\d{1,3})\b/)
          if (m) addAge(l, number(m[1]), [c.offset, c.offset + m[1].length])
        }
    if (/\[age\]/.test(t)) {
      const k = t.indexOf("[age]")
      if (!assertion(t, k, k + 5).family) addAge(l, "over 89", [k, k + 5])
      else understood.adult.add(l.i)
    }
    for (const re of AGE_PROSE)
      for (const m of t.matchAll(re)) {
        const k = m.index! + m[0].indexOf(m[1])
        const n = number(m[1])
        if (n > 125) continue
        const a = assertion(t, k, k + m[1].length)
        // "Mother is 54" and "54-year-old mother" are a relative's age.
        if (a.family || RELATION_AFTER.test(t.slice(m.index! + m[0].length))) {
          understood.adult.add(l.i)
          mentions.push({
            criterion: "adult",
            line: l.i,
            kind: "family",
            span: lineSpan(l),
          })
          continue
        }
        // "diagnosed at age 12" and "since age 40" are not the current age.
        if (
          /\b(?:at|since|from|by|until|before|after|onset|diagnosed)\s+(?:the\s+)?(?:age\s*)?$/i.test(
            t.slice(0, m.index!),
          )
        )
          continue
        addAge(l, n, [k, k + m[1].length])
      }
  }

  // ---------- conditions ----------
  const conds: CondMention[] = []
  let lastAssessment: number | null = null
  for (const l of content) {
    const t = lineText(l)
    const valueStart = l.kind === "field" ? (l.valueOffset ?? 0) : 0
    const groupRole = l.section.fieldRole
    if (
      l.kind === "field" &&
      ["indication", "history", "assessment"].includes(l.role ?? "") &&
      isBlankValue(t.slice(valueStart))
    ) {
      if (l.role === "indication") add(l, "blank_field", "diagnosis")
      understood.diagnosis.add(l.i)
      continue
    }
    if (THIS_ASSESSMENT.test(t) && lastAssessment !== null) {
      for (const c of conds) if (c.line.i === lastAssessment) c.tied = true
      understood.diagnosis.add(l.i)
    }
    const pieces: { text: string; offset: number; checked?: string }[] = l
      .options?.length
      ? l.options.map((o) => ({
          text: o.text,
          offset: o.offset,
          checked: o.checked,
        }))
      : [{ text: t.slice(valueStart), offset: valueStart, checked: l.checked }]
    const questionTied =
      !!l.label && l.label !== "Q:" && QUESTION_TIED.test(l.label)
    for (const piece of pieces)
      for (const h of findConditions(piece.text)) {
        const start = piece.offset + h.index,
          end = piece.offset + h.end
        const valueOnly =
          l.kind === "field" ? " ".repeat(valueStart) + t.slice(valueStart) : t
        const a = assertion(valueOnly, start, end, {
          label: l.label,
          sectionRole: l.section.role,
        })
        let role: CondMention["role"] = "note"
        // Whether the mention sits where the request states its reason,
        // whoever it turns out to be about.
        const requestField =
          l.role === "indication" ||
          questionTied ||
          (groupRole === "indication" && !l.role)
        if (a.family || l.role === "family" || l.section.role === "family")
          role = "family"
        else if (requestField) role = "request"
        else if (l.role === "assessment" || l.soap === "A") role = "assessment"
        else if (
          l.role === "history" ||
          l.section.role === "problems" ||
          groupRole === "history"
        )
          role = "history"
        const sentence = sentenceOf(t, start, end)
        const before = t.slice(0, start)
        const tied =
          role === "request" ||
          TIED_PHRASE.test(sentence) ||
          TIED_FOR.test(before) ||
          (piece.checked === "checked" && REQUEST_VERB.test(t))
        const unchecked =
          piece.checked === "unchecked" ||
          (l.checked === "unchecked" && !l.options?.length)
        conds.push({
          line: l,
          value: h.value,
          family: h.family,
          role: role === "note" && tied ? "request" : role,
          a: unchecked ? { ...a, negated: true } : a,
          checked: piece.checked,
          start,
          end,
          tied: tied && role !== "family",
          corrected: h.corrected,
          inRequest:
            requestField ||
            TIED_PHRASE.test(sentence) ||
            TIED_FOR.test(before) ||
            (piece.checked === "checked" && REQUEST_VERB.test(t)),
        })
        understood.diagnosis.add(l.i)
      }
    if (l.role === "assessment" && conds.some((c) => c.line === l))
      lastAssessment = l.i
  }
  const emitted = new Set<string>()
  for (const c of conds) {
    const attrs: Record<string, string | boolean> = {}
    if (c.a.historical) attrs.historical = true
    if (c.a.noLongerCurrent) attrs.noLongerCurrent = true
    if (c.a.corrected) attrs.corrected = true
    if (c.checked) attrs.checked = c.checked
    if (c.family) attrs.family = c.family
    const match: Match | undefined = c.corrected.length
      ? {
          kind: "spelling-variant",
          written: c.corrected.join(" "),
          confidence: 0.9,
        }
      : undefined
    const extra = {
      valueAt: [c.start, c.end] as [number, number],
      ...(Object.keys(attrs).length ? { attrs } : {}),
      ...(match ? { match } : {}),
    }
    const once = (key: string) => {
      if (emitted.has(key)) return false
      emitted.add(key)
      return true
    }
    const note = (kind: string) =>
      mentions.push({
        criterion: "diagnosis",
        scope: c.family,
        line: c.line.i,
        kind,
        value: c.value,
        span: lineSpan(c.line),
      })
    // In the request's own fields, anything about the condition other than
    // a clean statement of it goes to review: a relative's condition, a box
    // whose mark could not be read, an unchecked option, a negation whose
    // reach is unclear, or a hypothetical.
    if (c.role === "family") {
      note(c.inRequest ? "family-request" : "family")
      continue
    }
    if (c.checked === "unclear" && (c.inRequest || c.tied)) {
      note("unclear-request")
      continue
    }
    if (c.a.hypothetical && !c.tied) {
      note("hypothetical")
      continue
    }
    if (c.checked === "unchecked") {
      note(c.inRequest ? "unchecked-request" : "unchecked")
      continue
    }
    if (c.role === "request" || c.tied) {
      if (c.a.negated) note("negated-request")
      else if (c.a.hypothetical) note("hypothetical-request")
      else if (c.a.scopeUnclear) note("scope-unclear-request")
      else if (once(`i:${c.value}:${c.a.uncertain}`))
        add(
          c.line,
          "indication",
          c.a.uncertain
            ? { condition: c.value, certainty: "unconfirmed" }
            : c.value,
          extra,
        )
      continue
    }
    if (c.a.negated) {
      note("negated")
      continue
    }
    if (c.a.scopeUnclear) {
      note("scope-unclear")
      continue
    }
    if (c.role === "assessment") {
      if (once(`a:${c.value}:${c.a.uncertain}`))
        add(
          c.line,
          "assessment",
          {
            condition: c.value,
            certainty: c.a.uncertain ? "unconfirmed" : "confirmed",
          },
          extra,
        )
      continue
    }
    if (c.role === "history") {
      if (once(`h:${c.value}:${c.a.uncertain}`))
        add(
          c.line,
          "history_condition",
          c.a.uncertain
            ? { condition: c.value, certainty: "unconfirmed" }
            : c.value,
          extra,
        )
      continue
    }
    note(c.a.uncertain ? "uncertain" : "asserted-untied")
  }

  // ---------- labs ----------
  const labValues: LabValue[] = []
  const labLines = new Set<number>()
  for (const l of content) {
    const t = lineText(l)
    // Table rows bound to a header.
    if (l.kind === "table-row" && l.cells) {
      const cell = (re: RegExp) =>
        l.cells!.find((c) => c.header && re.test(c.header))
      const testCell = l.cells.find(
        (c) =>
          findLabs(c.text).length &&
          (!c.header ||
            /test|lab|analyte|name|component|measure/.test(c.header)),
      )
      const resultCell = cell(/^(?:result|value|level|reading)s?\b/)
      const dateCell = cell(
        /date|collected|drawn|resulted|reported|obtained|when/,
      )
      const labColumns = l.cells.filter(
        (c) => c.header && findLabs(c.header).length && /\d/.test(c.text),
      )
      // A row about a relative, or in a family history table, is not the
      // patient's result.
      const relativeRow =
        l.section.role === "family" ||
        l.role === "family" ||
        l.cells.some((c) =>
          /^(?:mother|father|sister|brother|sibling|parent|son|daughter|aunt|uncle|grand\w*)$/i.test(
            c.text,
          ),
        )
      if ((testCell && resultCell) || (!testCell && labColumns.length))
        if (relativeRow) {
          labLines.add(l.i)
          understood.lab.add(l.i)
          mentions.push({
            criterion: "lab",
            scope: findLabs(testCell?.text ?? labColumns[0].header!)[0].lab
              .name,
            line: l.i,
            kind: "family",
            span: lineSpan(l),
          })
          continue
        }
      if (!testCell && labColumns.length) {
        labLines.add(l.i)
        understood.lab.add(l.i)
        for (const c of labColumns) {
          const lab = findLabs(c.header!)[0].lab
          const m = c.text.match(
            /^([<>≤≥]=?)?\s*(\d+(?:\.\d+)?)\s*(%|percent|mg\s*\/\s*d[lL]|mmol\s*\/\s*mol|mmol\s*\/\s*[lL])?/,
          )
          if (!m) continue
          const conv = convert(lab, Number(m[2]), m[3])
          const k = c.offset + c.text.indexOf(m[2])
          const h = c.header!
          labValues.push({
            line: l,
            lab,
            value: conv.value,
            unit: lab.unit,
            comparator: m[1],
            valueAt: [k, k + m[2].length],
            token: tokensIn(c.text)[0]?.token,
            role: conv.badUnit
              ? "invalid"
              : /\b(?:before|baseline|pre|start|initial)\b/i.test(h)
                ? "baseline"
                : /\b(?:after|follow-?up|post|end|on\s+(?:therapy|treatment))\b/i.test(
                      h,
                    )
                  ? "followup"
                  : "result",
            converted: conv.converted,
            badUnit: conv.badUnit,
          })
        }
        continue
      }
      if (testCell && resultCell) {
        const lab = findLabs(testCell.text)[0].lab
        labLines.add(l.i)
        understood.lab.add(l.i)
        const m = resultCell.text.match(
          /^([<>≤≥]=?)?\s*(\d+(?:\.\d+)?)\s*(%|percent|mg\s*\/\s*d[lL]|mmol\s*\/\s*mol|mmol\s*\/\s*[lL])?/,
        )
        const unitCell = cell(/^units?$/)
        if (m && !INVALID_LAB.test(resultCell.text)) {
          const c = convert(lab, Number(m[2]), m[3] ?? unitCell?.text)
          const k = resultCell.offset + resultCell.text.indexOf(m[2])
          labValues.push({
            line: l,
            lab,
            value: c.value,
            unit: lab.unit,
            comparator: m[1],
            valueAt: [k, k + m[2].length],
            token: dateCell
              ? tokensIn(dateCell.text)[0]?.token
              : tokensIn(t)[0]?.token,
            role: c.badUnit ? "invalid" : "result",
            converted: c.converted,
            badUnit: c.badUnit,
            nameAt: [testCell.offset, testCell.offset + testCell.text.length],
          })
        } else
          block("lab", {
            kind: "unparsed-mention",
            line: l.i,
            page: l.page,
            scope: lab.name,
            message: `A ${lab.name} row has no usable result: ${quote(l)}`,
          })
        continue
      }
    }
    const labs = findLabs(t)
    if (!labs.length) continue
    labLines.add(l.i)
    const dateTokens = tokensIn(t)
    const invalid = INVALID_LAB.test(t)
    const before0 = labValues.length
    labs.forEach((hit, n) => {
      const nextLab = labs[n + 1]?.index ?? t.length
      const otherAnalyte = t.slice(hit.end, nextLab).search(OTHER_ANALYTE)
      const segEnd = otherAnalyte >= 0 ? hit.end + otherAnalyte + 1 : nextLab
      const seg = t.slice(hit.end, segEnd)
      const found: LabValue[] = []
      for (const m of seg.matchAll(LAB_VALUE)) {
        const raw = m[2]
        const k = hit.end + m.index! + m[0].indexOf(raw)
        const before = t.slice(hit.end, k)
        const after = t.slice(k + raw.length, k + raw.length + 14)
        // Skip numbers that are not this lab's result.
        if (/^\s*[-–]\s*\d/.test(after) && !m[3]) continue
        if (/\d\s*[-–]\s*$/.test(before)) continue
        if (
          /\b(?:ref(?:erence)?|range|normal|nl|ULN|LLN)\b[^\d]*$/i.test(before)
        )
          continue
        if (
          /^\s*(?:mg\b(?!\s*\/)|mcg|units?\b|u\/l|years?|yrs?|days?|weeks?|wks?|months?|mos?\b|tabs?|tablets?|pens?|ml\b|x\b|times)/i.test(
            after,
          )
        )
          continue
        if (/\[date-[a-z]*$|\[$/.test(before)) continue
        if (/^\s*[a-z]\]/.test(after)) continue
        const target =
          /\b(?:goal|target|aim|less\s+than\s+goal|treat\s+to)\b[^\d;,]*$/i.test(
            before,
          )
        const c = convert(hit.lab, Number(raw), m[3])
        found.push({
          line: l,
          lab: hit.lab,
          value: c.value,
          unit: hit.lab.unit,
          comparator: m[1],
          valueAt: [k, k + raw.length],
          role: target ? "target" : invalid || c.badUnit ? "invalid" : "result",
          converted: c.converted,
          badUnit: c.badUnit,
        })
      }
      // A date after a value belongs to it until the next value. Otherwise the
      // date before the lab name on the same line, a single date elsewhere in
      // its part of the line, or the next line's "Date collected" date.
      const results = found.filter((f) => f.role !== "target")
      results.forEach((f, k) => {
        const nextValue = results[k + 1]?.valueAt[0] ?? segEnd
        const own = dateTokens.find(
          (d) => d.index > f.valueAt[1] && d.index < nextValue,
        )
        if (own) f.token = own.token
      })
      const unowned = results.filter((f) => !f.token)
      if (unowned.length === 1) {
        const owned = new Set(results.map((f) => f.token).filter(Boolean))
        const before = dateTokens
          .filter((d) => d.index < hit.index && !owned.has(d.token))
          .at(-1)
        const inSeg = dateTokens.filter(
          (d) => d.index > hit.end && d.index < segEnd && !owned.has(d.token),
        )
        const candidate = before ?? (inSeg.length === 1 ? inSeg[0] : undefined)
        if (candidate) unowned[0].token = candidate.token
        else {
          const next = doc.slice(l.i + 1).find((x) => x.kind !== "continuation")
          const m = next?.text
            .trim()
            .match(
              /^(?:date\s+)?(?:collected|drawn|obtained|resulted|measured)(?:\s+on|\s+date)?\s*:?\s*(\[date-[a-z]+\])/i,
            )
          if (next && m) {
            unowned[0].token = m[1]
            unowned[0].tokenLine = next
            used.add(next.i)
            understood.lab.add(next.i)
          }
        }
      }
      for (const f of found) f.nameAt = [hit.index, hit.end]
      // A relative's result never stands for the patient's.
      const subject = assertion(t, hit.index, hit.end, {
        label: l.label,
        sectionRole: l.section.role,
      })
      if (subject.family && found.length) {
        mentions.push({
          criterion: "lab",
          scope: hit.lab.name,
          line: l.i,
          kind: "family",
          span: lineSpan(l),
        })
        understood.lab.add(l.i)
        return
      }
      labValues.push(...found)
    })
    if (labValues.length > before0) understood.lab.add(l.i)
    else {
      const v = l.kind === "field" ? (l.value ?? "") : t.slice(labs[0].end)
      // "A1c: Date collected:" is a blank form field whose underscores the
      // scan lost: the value is only the next label.
      const labelOnly =
        /^\s*(?:date\s*collected|collected|date|result|value)\s*:?\s*[_.\s]*$/i.test(
          v,
        )
      const blankish =
        /^\s*_{2,}/.test(v) ||
        isBlankValue(v) ||
        labelOnly ||
        /^\s*[:=-]?\s*(?:not\s+(?:provided|attached|available|done|documented|on\s+file)|n\/a|none|blank)\b/i.test(
          v,
        )
      if (blankish) {
        if (
          l.kind === "field" &&
          (l.role === "labs" || /^\s*_{2,}/.test(v) || labelOnly)
        )
          add(l, "blank_field", "lab")
        understood.lab.add(l.i)
      } else if (
        /\b(?:see\s+attached|attached|enclosed|see\s+enclosed|on\s+separate\s+(?:page|sheet))\b/i.test(
          t,
        ) &&
        !/\d/.test(t.replace(TOKEN, "")) &&
        l.checked !== "unchecked"
      ) {
        block("lab", {
          kind: "missing-page",
          line: l.i,
          page: l.page,
          scope: labs[0].lab.name,
          message: `The ${labs[0].lab.name} result is said to be attached, but no attached result was read: ${quote(l)}`,
        })
        understood.lab.add(l.i)
      } else if (
        !/\d/.test(t.replace(TOKEN, "")) &&
        /\b(?:above|below|at|not\s+at|near|over|under)\s+(?:goal|target)\b|\b(?:elevated|high|uncontrolled|improved|worsening|rising)\b/i.test(
          sentenceOf(t, labs[0].index, labs[0].end),
        )
      ) {
        // "LDL-C above goal" says something about a result kept elsewhere.
        understood.lab.add(l.i)
        mentions.push({
          criterion: "lab",
          scope: labs[0].lab.name,
          line: l.i,
          kind: "qualitative",
        })
      } else if (INVALID_LAB.test(sentenceOf(t, labs[0].index, labs[0].end))) {
        // "repeat A1c pending": the line says there is no result yet.
        understood.lab.add(l.i)
        mentions.push({
          criterion: "lab",
          scope: labs[0].lab.name,
          line: l.i,
          kind: "pending",
        })
      }
    }
  }

  // ---------- drugs ----------
  const drugsByLine = new Map<number, DrugAt[]>()
  for (const l of doc) {
    if (!["field", "prose", "table-row", "heading"].includes(l.kind)) continue
    const t = lineText(l)
    const all = findDrugs(t)
    if (!all.length) continue
    const hits = all.filter(
      (h, k) => k === 0 || all[k - 1].generic !== h.generic,
    )
    drugsByLine.set(
      l.i,
      hits.map((h, k) => ({
        line: l,
        hit: h,
        from: h.index,
        to: hits[k + 1]?.index ?? t.length,
      })),
    )
  }
  const isRequestContext = (l: DocLine) =>
    ["request", "dose", "amountOnly", "frequencyOnly"].includes(l.role ?? "") ||
    l.soap === "P"
  const isListContext = (l: DocLine) =>
    l.role === "medications" || (l.section.role === "medications" && !l.role)
  const isPriorContext = (l: DocLine) =>
    l.role === "prior" ||
    l.role === "allergies" ||
    (["history", "allergies"].includes(l.section.role) &&
      !["medications", "request", "dose"].includes(l.role ?? ""))
  // Request statements: request and dose fields, request sentences, checked
  // order items and bare regimen lines for a requestable drug.
  const requestLines: {
    line: DocLine
    drug?: DrugAt
    text: string
    offset: number
    source: string
  }[] = []
  for (const l of content) {
    const t = lineText(l)
    const ds = drugsByLine.get(l.i) ?? []
    if (l.checked === "unchecked" && !l.options?.length) continue
    if (isRequestContext(l) && !isListContext(l)) {
      const valueOffset = l.valueOffset ?? 0
      const req = ds.filter((d) => d.hit.index >= valueOffset)
      if (req.length)
        for (const d of req)
          requestLines.push({
            line: l,
            drug: d,
            text: t.slice(d.from, d.to),
            offset: d.from,
            source: l.label ?? "",
          })
      else
        requestLines.push({
          line: l,
          text: t.slice(valueOffset),
          offset: valueOffset,
          source: l.label ?? "",
        })
      continue
    }
    if (isListContext(l) || isPriorContext(l)) continue
    for (const d of ds) {
      if (!REQUESTABLE.has(d.hit.drug.drugClass)) continue
      const option = l.options?.find(
        (o) =>
          d.hit.index >= o.offset && d.hit.index < o.offset + o.text.length + 1,
      )
      if (option && option.checked === "unchecked") continue
      const sentence = sentenceOf(t, d.hit.index, d.hit.end)
      // "Semaglutide 0.5 mg weekly failed after 3 months" tells history: a
      // line that starts with the drug is the request only when it does not.
      const history =
        HISTORY_WORDS.test(sentence) && !REQUEST_VERB.test(sentence)
      if (
        REQUEST_VERB.test(sentence) ||
        (d.hit.index - (l.valueOffset ?? 0) < 4 && !history) ||
        option?.checked === "checked" ||
        l.checked === "checked"
      )
        requestLines.push({
          line: l,
          drug: d,
          text: t.slice(d.from, d.to),
          offset: d.from,
          source: "prose",
        })
    }
    // "The directions are 140 mg SC every 2 wks." names no drug.
    if (
      !ds.length &&
      !l.role &&
      /\b(?:prescription|directions|sig|maintenance|requested\s+dose|dose\s+requested)\b/i.test(
        t,
      ) &&
      /\d\s*(?:mg|mcg)\b/i.test(t)
    )
      requestLines.push({ line: l, text: t, offset: 0, source: "prose" })
  }
  const requested =
    requestLines.find(
      (r) => r.drug && REQUESTABLE.has(r.drug.hit.drug.drugClass),
    )?.drug?.hit.generic ??
    requestLines.find((r) => r.drug)?.drug?.hit.generic ??
    null

  // ---------- treatment episodes ----------
  const episodes: Episode[] = []
  const lineEpisodes = new Map<number, Episode[]>()
  const belongs = (i: number, ep: Episode) => {
    const list = lineEpisodes.get(i) ?? []
    if (!list.includes(ep)) list.push(ep)
    lineEpisodes.set(i, list)
  }
  const priorSeed = (l: DocLine, d: DrugAt) => {
    if (d.hit.generic === requested) return false
    if (REQUESTABLE.has(d.hit.drug.drugClass) && !isPriorContext(l))
      return false
    if (isRequestContext(l) && !isPriorContext(l)) return false
    if (l.kind === "heading" && l.section.role === "medications") return false
    return true
  }
  for (const l of doc) {
    const ds = (drugsByLine.get(l.i) ?? []).filter((d) => priorSeed(l, d))
    const present = lineEpisodes.get(l.i) ?? []
    const fresh = ds.filter(
      (d, k) =>
        !present.some((e) => e.drug.hit.generic === d.hit.generic) &&
        ds.findIndex((x) => x.hit.generic === d.hit.generic) === k,
    )
    if (!fresh.length) continue
    const lt = lineText(l)
    const created = fresh.map((d) => {
      // A value or outcome line naming a drug whose course was described just
      // above continues that course.
      const near = episodes
        .filter(
          (e) =>
            e.drug.hit.generic === d.hit.generic &&
            e.lines.at(-1)!.page === l.page &&
            e.lines[0].section === l.section &&
            l.i - e.lines.at(-1)!.i <= 3,
        )
        .at(-1)
      if (
        near &&
        fresh.length === 1 &&
        l.role !== "prior" &&
        (findLabs(lt).length || classifyOutcome(lt))
      ) {
        near.lines.push(l)
        belongs(l.i, near)
        return near
      }
      const ep: Episode = { id: 0, drug: d, lines: [l], status: "tried" }
      episodes.push(ep)
      belongs(l.i, ep)
      return ep
    })
    // Following lines that describe the same course. A line that names one
    // drug joins that drug's course; a line that names none joins only when
    // the seed line named a single drug.
    const seedIsBlock = l.kind === "heading" || l.section.role === "history"
    for (let j = l.i + 1; j < doc.length; j++) {
      const n = doc[j]
      if (n.kind === "continuation") continue
      if (!["field", "prose", "table-row"].includes(n.kind)) break
      if (n.page !== l.page) break
      const named = [
        ...new Set((drugsByLine.get(n.i) ?? []).map((x) => x.hit.generic)),
      ]
      const target =
        named.length === 0
          ? created.length === 1
            ? created[0]
            : undefined
          : named.length === 1
            ? created.find((e) => e.drug.hit.generic === named[0])
            : undefined
      if (!target) break
      if (n.role && STOP_ROLES.includes(n.role)) break
      if (
        n.role === "dose" &&
        !(
          seedIsBlock &&
          !/request|maintenance|sig|directions|order/i.test(n.label ?? "")
        )
      )
        break
      const nt = lineText(n)
      if (STOP_ATTACH.test(n.label ?? nt)) break
      if (!ATTRIBUTE.test(nt) && !findLabs(nt).length) break
      target.lines.push(n)
      belongs(n.i, target)
    }
  }
  let episodeNo = 0
  for (const ep of episodes) {
    ep.id = ++episodeNo
    const first = ep.lines[0]
    const ft = lineText(first)
    const generic = ep.drug.hit.generic
    const seg = ft.slice(ep.drug.from, ep.drug.to)
    const single = (drugsByLine.get(first.i) ?? []).length === 1
    const a = assertion(ft, ep.drug.hit.index, ep.drug.hit.end, {
      label: first.label,
      sectionRole: first.section.role,
    })
    const option = first.options?.find(
      (o) =>
        ep.drug.hit.index >= o.offset &&
        ep.drug.hit.index < o.offset + o.text.length + 1,
    )
    const checked = option?.checked ?? first.checked
    const firstDrugAt = (drugsByLine.get(first.i) ?? [])[0]?.hit.index ?? 0
    const textOf = (l: DocLine) =>
      l === first ? (single ? ft : ft.slice(0, firstDrugAt) + seg) : lineText(l)
    const outcomes = ep.lines
      .map((l) => ({ l, o: classifyOutcome(textOf(l)) }))
      .filter((x) => x.o)
    const allergyContext =
      first.role === "allergies" || first.section.role === "allergies"
    let stated = outcomes.find((x) => !x.o!.goal)
    if (!stated && allergyContext) {
      const rest = seg
        .slice(ep.drug.hit.end - ep.drug.from)
        .replace(/^[\s:,(–—-]+|[\s.,;)]+$/g, "")
      stated = {
        l: first,
        o: {
          type: "intolerance",
          category: "adverse",
          ...(rest && /[a-z]{3,}/i.test(rest) ? { reason: rest } : {}),
        },
      }
    }
    const goal = outcomes.find((x) => x.o!.goal)
    // A question about the drug answered "no" documents that it was not
    // tried: "Q: Has metformin been tried? A: No", "Tried metformin? No".
    const answer = (() => {
      if (first.label === "Q:") {
        const next = doc.slice(first.i + 1).find((n) => n.kind !== "blank")
        if (next?.kind === "field" && next.label === first.value)
          return next.value ?? ""
        return null
      }
      if (
        first.kind === "field" &&
        /\?$/.test(first.label ?? "") &&
        ep.drug.hit.index < (first.valueOffset ?? 0)
      )
        return first.value ?? ""
      return null
    })()
    const answeredNo =
      answer !== null &&
      /^\s*(?:no|none|never|not\s+tried|n\/a|not\s+applicable)\b/i.test(answer)
    let status = "tried"
    if (checked === "unchecked") status = "unchecked"
    else if (checked === "unclear") status = "unclear-box"
    else if (answeredNo) status = "negated"
    else if (stated?.o?.type === "contraindication") status = "contraindicated"
    else if (stated && stated.l === first) status = "tried"
    else if (a.negated || NOT_TRIED.test(ft.slice(ep.drug.hit.end)))
      status = "negated"
    else if (a.declined || /\b(?:declined|refused)\b/i.test(seg))
      status = "declined"
    else if (
      a.hypothetical ||
      /\b(?:planned|plan\s+to|will\s+(?:start|begin|try)|if\s+(?:a1c|ldl|bsa))\b/i.test(
        seg,
      )
    )
      status = "planned"
    else if (a.family) status = "family"
    else if (
      isListContext(first) ||
      /\b(?:currently\s+taking|still\s+taking|continues?|continuing|remains?\s+on)\b/i.test(
        seg,
      )
    )
      status = "current"
    ep.status = status
    const attrs: Record<string, string | number | boolean> = {
      status,
      drugClass: ep.drug.hit.drug.drugClass,
    }
    if (goal) attrs.goalNotMet = true
    add(first, "prior_medication", generic, {
      episode: ep.id,
      match: ep.drug.hit.resembles
        ? {
            ...ep.drug.hit.match,
            written: `${ep.drug.hit.match.written} (resembles ${ep.drug.hit.resembles})`,
          }
        : ep.drug.hit.match,
      valueAt: [ep.drug.hit.index, ep.drug.hit.end],
      attrs,
    })
    for (const l of ep.lines) {
      used.add(l.i)
      understood.prior.add(l.i)
    }
    // Regimen: the drug's own part of the line, a dose cell in a table row,
    // or a dose line attached to the course.
    let reg: Regimen = parseRegimen(seg)
    let regLine = first,
      regOffset = ep.drug.from
    if (first.kind === "table-row" && first.cells) {
      const doseCell = first.cells.find(
        (c) =>
          c.header && /dose|strength|sig|regimen|directions/.test(c.header),
      )
      if (doseCell) {
        reg = parseRegimen(doseCell.text)
        regOffset = doseCell.offset
      }
    }
    if (!reg.final)
      for (const l of ep.lines.slice(1)) {
        const lt = lineText(l)
        const off = l.kind === "field" ? (l.valueOffset ?? 0) : 0
        const r = parseRegimen(lt.slice(off))
        if (r.final) {
          reg = r
          regLine = l
          regOffset = off
          break
        }
      }
    if (reg.final)
      add(regLine, "prior_dose", canonicalDose(reg.final)!, {
        episode: ep.id,
        valueAt: [
          regOffset + reg.final.amountAt[0],
          regOffset + (reg.final.frequencyAt?.[1] ?? reg.final.amountAt[1]),
        ],
        attrs: {
          amount: reg.final.amount,
          frequency: reg.final.frequency ?? "",
          ...(reg.steps.length > 1 ? { steps: reg.steps.length } : {}),
        },
      })
    // Dates, durations and ongoing status across the course.
    let start: string | null = null,
      stop: string | null = null,
      ongoing = false,
      days: number | null = null
    let startLine = first,
      stopLine = first
    let openStart = false
    if (first.kind === "table-row" && first.cells) {
      const sc = first.cells.find(
        (c) => c.header && /^(?:start|began|from)/.test(c.header),
      )
      const ec = first.cells.find(
        (c) => c.header && /^(?:stop|end|to\b|until)/.test(c.header),
      )
      const s1 = sc && tokensIn(sc.text)[0]?.token
      const e1 = ec && tokensIn(ec.text)[0]?.token
      if (s1) start = s1
      if (e1) stop = e1
      if (ec && /\b(?:ongoing|present|current|now|today)\b/i.test(ec.text))
        ongoing = true
      const dc = first.cells.find(
        (c) => c.header && /duration|length|how\s+long/.test(c.header),
      )
      if (dc) days = episodeDuration(dc.text)
    }
    for (const l of ep.lines) {
      const t =
        l === first
          ? ft.slice(single ? 0 : ep.drug.from, single ? ft.length : ep.drug.to)
          : lineText(l)
      const toks = tokensIn(t)
      const startM = t.match(
        /\b(?:started|start(?:ed)?\s+(?:date|on)|start|began|begun|initiated|since|from)\s*:?\s*(?:on\s+)?(\[date-[a-z]+\])/i,
      )
      const stopM = t.match(
        /\b(?:stopped|discontinued|d\/c'?d|ended|end\s+date|stop(?:ped)?\s+(?:date|on)|stop|end)\s*:?\s*(?:on\s+)?(\[date-[a-z]+\])/i,
      )
      const range = t.match(
        /(\[date-[a-z]+\])\s*(?:-|–|—|to|through|thru|until)\s*(\[date-[a-z]+\])/i,
      )
      const open = t.match(
        /(\[date-[a-z]+\])\s*(?:-|–|—|to|through|thru|until)\s*(?:today|present|now|current(?:ly)?|ongoing|the\s+present)\b/i,
      )
      if (range && !start && !stop) {
        start = range[1]
        stop = range[2]
        startLine = stopLine = l
      }
      if (open && !start) {
        start = open[1]
        ongoing = true
        startLine = l
      }
      if (startM && !start) {
        start = startM[1]
        startLine = l
        if (/^(?:since|from)\b/i.test(startM[0])) openStart = true
      }
      if (stopM && !stop && stopM[1] !== start) {
        stop = stopM[1]
        stopLine = l
      }
      if (
        !start &&
        !stop &&
        toks.length === 2 &&
        /\b(?:trial|course|treatment|therapy)\s+dates?\b|\bdates?\s*:/i.test(t)
      ) {
        start = toks[0].token
        stop = toks[1].token
        startLine = stopLine = l
      }
      if (
        /\b(?:through|to|until)\s+(?:today|present|now)\b|\b(?:remains?\s+ongoing|ongoing|still\s+taking|currently\s+taking|continues|continuing|remains?\s+on)\b/i.test(
          t,
        )
      )
        ongoing = true
      if (days === null) days = episodeDuration(t)
    }
    if (start) addDate(startLine, "prior_start_date", start, { episode: ep.id })
    if (stop) addDate(stopLine, "prior_stop_date", stop, { episode: ep.id })
    if (openStart && !stop) ongoing = true
    if (ongoing && !stop) attrs.ongoing = true
    if (days !== null)
      add(first, "prior_duration_days", days, { episode: ep.id })
    if (stated) {
      const o = stated.o!
      add(stated.l, "prior_outcome", o.type, {
        episode: ep.id,
        attrs: {
          category: o.category,
          ...(o.blank ? { reasonBlank: true } : {}),
        },
      })
      if (o.reason) add(stated.l, "prior_reason", o.reason, { episode: ep.id })
    }
    const courseWords =
      /\b(?:tried|took|taking|taken|on|started|used|trial|course|failed|stopped|discontinued|since|for\s+\d|x\s*\d|weeks?|months?|therapy|treated|tolerated)\b/i
    // Values on the course's own lines, with their wording.
    const mine = labValues.filter(
      (v) =>
        (v.line !== first && ep.lines.includes(v.line)) ||
        (v.line === first &&
          (single ||
            (v.valueAt[0] >= ep.drug.from && v.valueAt[0] < ep.drug.to))),
    )
    for (const v of mine) {
      const lt = lineText(v.line)
      const others = mine.filter((x) => x.line === v.line && x !== v)
      const nextStart =
        others
          .map((x) => x.valueAt[0])
          .filter((s) => s > v.valueAt[1])
          .sort((x, y) => x - y)[0] ?? lt.length
      const prevEnd =
        others
          .map((x) => x.valueAt[1])
          .filter((s) => s < v.valueAt[0])
          .sort((x, y) => y - x)[0] ?? 0
      const before = lt.slice(prevEnd, v.valueAt[0])
      const after = lt.slice(
        v.valueAt[1],
        Math.min(nextStart, v.valueAt[1] + 40),
      )
      const baseline =
        /\b(?:baseline|before|prior\s+to|pre-?treatment|pretreatment|starting|at\s+start|initial(?:ly)?|pre-)\b/i
      const followupWords =
        /\b(?:during|while|at\s+last|after|follow-?up|end-of-course|end\s+of\s+(?:trial|course|therapy)|repeat|recheck|post-?treatment|later|subsequent(?:ly)?)\b|\bon\s+(?:[a-z]+\s+){0,2}?(?:therapy|treatment|it|this|that)\b/i
      // "On metfromin:" names the drug as written, spelling variants included.
      const onDrug = (s: string) =>
        [
          ...s.matchAll(
            /\bon\s+(?:(?:the|max|maximum|full)\s+(?:dose\s+)?)?([A-Za-z][A-Za-z-]+)/gi,
          ),
        ].some((m) => findDrugs(m[1]).length > 0)
      const followup = {
        test: (s: string) => followupWords.test(s) || onDrug(s),
      }
      if (v.role !== "result") {
        v.episode = ep.id
        continue
      }
      const label = v.line.label ?? ""
      if (baseline.test(before) || baseline.test(label)) v.role = "baseline"
      else if (followup.test(before) || followup.test(label))
        v.role = "followup"
      else if (
        /^\s*(?:%|percent|mg\/dl)?\s*(?:\(\s*\[date-[a-z]+\]\s*\))?\s*(?:at\s+)?(?:baseline|before|prior|pre)\b/i.test(
          after,
        )
      )
        v.role = "baseline"
      else if (
        /^\s*(?:%|percent|mg\/dl)?\s*(?:\(\s*\[date-[a-z]+\]\s*\))?\s*(?:at\s+)?(?:after|on\s+(?:therapy|treatment)|follow-?up|during)\b/i.test(
          after,
        )
      )
        v.role = "followup"
      else if (start && v.token) {
        // No wording: the course's start date decides, by the rule's own
        // terms (on or before the start, or after it), when both readings agree.
        const sr = readingsOf(start),
          vr = readingsOf(v.token)
        const sides = [0, 1]
          .filter((k) => sr[k] ?? sr[0])
          .map((k) =>
            (vr[k] ?? vr[0]) <= (sr[k] ?? sr[0]) ? "baseline" : "followup",
          )
        if (sides.length && sides.every((x) => x === sides[0]))
          v.role = sides[0] as "baseline" | "followup"
      }
      v.episode = ep.id
    }
    // A drug named with nothing about a course is a mention, not a trial.
    if (
      status === "tried" &&
      !reg.final &&
      !start &&
      !stop &&
      days === null &&
      !stated &&
      !goal &&
      !mine.length &&
      !ep.lines.some((l) => courseWords.test(l === first ? seg : lineText(l)))
    ) {
      ep.status = "mention"
      attrs.status = "mention"
    }
  }
  // Two dated values of one lab on one course line, with no role words: the
  // earlier is the baseline and the later the follow-up, whatever the order.
  for (const ep of episodes) {
    const vals = labValues.filter(
      (v) => v.episode === ep.id && v.role === "result" && v.token,
    )
    const byLine = new Map<number, LabValue[]>()
    for (const v of vals)
      byLine.set(v.line.i, [...(byLine.get(v.line.i) ?? []), v])
    for (const list of byLine.values()) {
      if (list.length !== 2 || list[0].lab !== list[1].lab) continue
      const [x, y] = list
      const xs = readingsOf(x.token!),
        ys = readingsOf(y.token!)
      // Both readings must agree on which value came first.
      const firstX = [0, 1].map((k) => (xs[k] ?? xs[0]) < (ys[k] ?? ys[0]))
      const firstY = [0, 1].map((k) => (ys[k] ?? ys[0]) < (xs[k] ?? xs[0]))
      if (!firstX.every(Boolean) && !firstY.every(Boolean)) continue
      const rx = xs[0],
        ry = ys[0]
      if (rx < ry) {
        x.role = "baseline"
        y.role = "followup"
      } else {
        y.role = "baseline"
        x.role = "followup"
      }
    }
  }
  for (const v of labValues) {
    if (v.role === "target") continue
    if (v.role === "invalid") {
      block("lab", {
        kind: "unparsed-mention",
        line: v.line.i,
        page: v.line.page,
        scope: v.lab.name,
        message: v.badUnit
          ? `A ${v.lab.name} value is written in a unit the rule cannot use: ${quote(v.line)}`
          : `A ${v.lab.name} result is marked invalid or pending: ${quote(v.line)}`,
      })
      continue
    }
    const attrs: Record<string, string | number | boolean> = {}
    if (v.comparator) attrs.comparator = v.comparator
    if (v.converted) attrs.converted = v.converted
    const type =
      v.role === "baseline"
        ? "prior_baseline"
        : v.role === "followup"
          ? "prior_followup"
          : "measurement"
    const e = add(
      v.line,
      type,
      { name: v.lab.name, value: v.value, unit: v.unit },
      {
        valueAt: v.valueAt,
        ...(v.nameAt
          ? {
              name_span: {
                start: at(v.line, v.nameAt[0]),
                end: at(v.line, v.nameAt[1]),
              },
            }
          : {}),
        ...(v.episode ? { episode: v.episode } : {}),
        ...(Object.keys(attrs).length ? { attrs } : {}),
      },
    )
    if (v.token) {
      const de = addDate(
        v.tokenLine ?? v.line,
        type === "measurement" ? "measurement_date" : `${type}_date`,
        v.token,
        v.episode ? { episode: v.episode } : {},
      )
      if (de) relatedOf.set(e, de)
    } else if (/\[date\](?!-)/.test(lineText(v.line))) {
      block("lab", {
        kind: "unreadable-date",
        line: v.line.i,
        page: v.line.page,
        scope: v.lab.name,
        message: `The date of a ${v.lab.name} result could not be read: ${quote(v.line)}`,
      })
      if (v.episode)
        block("prior", {
          kind: "unreadable-date",
          line: v.line.i,
          page: v.line.page,
          message: `A date in a treatment course could not be read: ${quote(v.line)}`,
        })
    }
  }

  // ---------- requested regimen ----------
  const blankDose = (l: DocLine) => {
    add(l, "blank_field", "dose")
    understood.dose.add(l.i)
  }
  const amountFields = requestLines.filter((r) => r.line.role === "amountOnly")
  const frequencyFields = requestLines.filter(
    (r) => r.line.role === "frequencyOnly",
  )
  const emitRequestedDose = (
    l: DocLine,
    reg: Regimen,
    offset: number,
    drug: string | null,
    source: string,
  ) => {
    const t = lineText(l)
    const final = reg.final
    if (final) {
      add(l, "requested_dose", canonicalDose(final)!, {
        valueAt: [
          offset + final.amountAt[0],
          offset + (final.frequencyAt?.[1] ?? final.amountAt[1]),
        ],
        attrs: {
          ...(drug ? { drug } : { drugUnknown: true }),
          amount: final.amount,
          ...(reg.steps.length > 1
            ? {
                steps: reg.steps.length,
                stepDoses: reg.steps
                  .map((s) => canonicalDose(s) ?? `${s.amount} mg once`)
                  .join("|"),
              }
            : {}),
          ...(reg.ambiguous ? { ambiguous: true } : {}),
          ...(reg.leadingDecimal ? { leadingDecimal: true } : {}),
          ...(reg.decimalComma ? { decimalComma: true } : {}),
          ...(NEGATED_REQUEST.test(t) && !CORRECTION.test(t)
            ? { negated: true }
            : {}),
          ...(CORRECTION.test(t) ? { corrected: true } : {}),
          ...(final.route ? { route: final.route } : {}),
          // A box whose mark could not be read: the order may not be chosen.
          ...(l.checked === "unclear" ? { unclearBox: true } : {}),
          source,
        },
      })
      return
    }
    const rest = t.slice(offset)
    // "Dose: illegible" and "sig unreadable" name a dose that could not be read.
    if (
      reg.steps.length ||
      /\d/.test(rest.replace(TOKEN, "")) ||
      /\b(?:weekly|daily|monthly|every|q\.?\s?\d|bid|qw)\b/i.test(rest) ||
      DOSE_UNREAD.test(rest)
    )
      block("dose", {
        kind: "unparsed-mention",
        line: l.i,
        page: l.page,
        scope: drug ?? undefined,
        message: reg.steps.length
          ? `A dose is written without a readable frequency: ${quote(l)}`
          : `A dose line could not be read: ${quote(l)}`,
      })
  }
  const requestedMeds = new Map<string, Entity>()
  for (const r of requestLines) {
    const l = r.line
    if (l.role === "amountOnly" || l.role === "frequencyOnly") continue
    if (lineEpisodes.has(l.i) && !(r.drug && r.drug.hit.generic === requested))
      continue
    if (
      r.drug &&
      !REQUESTABLE.has(r.drug.hit.drug.drugClass) &&
      r.drug.hit.generic !== requested
    )
      continue
    const t = lineText(l)
    if (!r.drug && used.has(l.i) && !/\d\s*(?:mg|mcg)\b/i.test(r.text)) continue
    understood.dose.add(l.i)
    if (r.drug) {
      const negated = NEGATED_REQUEST.test(t) && !CORRECTION.test(t)
      const prior = requestedMeds.get(r.drug.hit.generic)
      if (!prior || (prior.attrs?.negated && !negated)) {
        if (prior) entities.splice(entities.indexOf(prior), 1)
        requestedMeds.set(
          r.drug.hit.generic,
          add(l, "requested_medication", r.drug.hit.generic, {
            match: r.drug.hit.match,
            valueAt: [r.drug.hit.index, r.drug.hit.end],
            attrs: {
              product: r.drug.hit.match.written.toLowerCase(),
              ...(negated ? { negated: true } : {}),
              source: r.source,
            },
          }),
        )
      }
    }
    if (!r.drug && isBlankValue(r.text)) {
      if (l.role === "dose") blankDose(l)
      continue
    }
    emitRequestedDose(
      l,
      parseRegimen(r.text),
      r.offset,
      r.drug?.hit.generic ?? requested,
      r.source,
    )
  }
  // "What strength? ____" with "How often? ____": one dose over two fields.
  if (amountFields.length || frequencyFields.length) {
    const a = amountFields[0],
      f = frequencyFields[0]
    const aText = a ? a.text : ""
    const fText = f ? f.text : ""
    for (const x of [a, f]) if (x) understood.dose.add(x.line.i)
    if ((!a || isBlankValue(aText)) && (!f || isBlankValue(fText)))
      blankDose((a ?? f)!.line)
    else if (a && !isBlankValue(aText)) {
      const joined = `${aText} ${fText}`
      const reg = parseRegimen(joined)
      if (
        reg.final &&
        reg.final.frequencyAt &&
        reg.final.frequencyAt[0] > aText.length
      ) {
        // The frequency came from the second field: cite both lines.
        const e = add(a.line, "requested_dose", canonicalDose(reg.final)!, {
          valueAt: [
            a.offset + reg.final.amountAt[0],
            a.offset + reg.final.amountAt[1],
          ],
          attrs: {
            ...(requested ? { drug: requested } : { drugUnknown: true }),
            amount: reg.final.amount,
            source: `${a.source} + ${f?.source ?? ""}`,
          },
        })
        if (f) e.spans = [lineSpan(a.line), lineSpan(f.line)]
      } else
        emitRequestedDose(
          a.line,
          parseRegimen(aText),
          a.offset,
          requested,
          a.source,
        )
    } else if (f)
      emitRequestedDose(
        f.line,
        parseRegimen(fText),
        f.offset,
        requested,
        f.source,
      )
  }
  // Medication lists: the requested drug's listed regimen. A bare regimen line
  // for the requested drug inside a medication history is its current entry.
  const listLike = (l: DocLine) =>
    isListContext(l) ||
    (l.section.role === "history" &&
      !l.role &&
      !lineEpisodes.has(l.i) &&
      (drugsByLine.get(l.i) ?? []).some(
        (d) =>
          d.hit.generic === requested && d.hit.index - (l.valueOffset ?? 0) < 4,
      ) &&
      !REQUEST_VERB.test(lineText(l)))
  for (const l of content) {
    if (!listLike(l)) continue
    const t = lineText(l)
    for (const d of drugsByLine.get(l.i) ?? []) {
      if (!REQUESTABLE.has(d.hit.drug.drugClass) && d.hit.generic !== requested)
        continue
      understood.dose.add(l.i)
      const part = t.slice(d.from, d.to)
      const reg = parseRegimen(part)
      // A list entry that names the drug with no dose words has nothing to read.
      const doseLike =
        /\d/.test(part.slice(d.hit.end - d.from).replace(TOKEN, "")) ||
        /\b(?:weekly|daily|monthly|every|q\.?\s?\d|bid|qw|once|twice)\b/i.test(
          part,
        )
      if (!reg.final && !doseLike) continue
      if (reg.final)
        add(l, "medication_list_dose", canonicalDose(reg.final)!, {
          valueAt: [
            d.from + reg.final.amountAt[0],
            d.from + (reg.final.frequencyAt?.[1] ?? reg.final.amountAt[1]),
          ],
          attrs: { drug: d.hit.generic, amount: reg.final.amount },
        })
      else
        block("dose", {
          kind: "unparsed-mention",
          line: l.i,
          page: l.page,
          scope: d.hit.generic,
          blocksFound: true,
          message: `The medication list names ${d.hit.generic} but its dose could not be read: ${quote(l)}`,
        })
    }
  }

  // ---------- blank prior fields and unbound outcomes ----------
  for (const l of content) {
    const t = lineText(l)
    if (
      /\bno\s+(?:other|further|additional|more)\s+(?:prior\s+)?(?:therapy|treatment|medication|drug)?\s*(?:therapy\s+)?(?:records?|history|trials?|information|documentation)\s+(?:was\s+|were\s+)?(?:supplied|provided|available|attached|documented|enclosed|received)\b/i.test(
        t,
      )
    ) {
      understood.prior.add(l.i)
      mentions.push({ criterion: "prior", line: l.i, kind: "no-more-records" })
      continue
    }
    if (
      l.kind === "field" &&
      l.role === "prior" &&
      !lineEpisodes.has(l.i) &&
      isBlankValue(t.slice(l.valueOffset ?? 0))
    ) {
      add(l, "blank_field", "prior therapy")
      understood.prior.add(l.i)
      continue
    }
    if (lineEpisodes.has(l.i)) continue
    if (l.role === "allergies" || l.section.role === "allergies") continue
    if ((drugsByLine.get(l.i) ?? []).length) continue
    const o = classifyOutcome(t)
    if (!o) continue
    understood.prior.add(l.i)
    // An outcome that names no drug cannot count for any drug.
    if (!o.goal) {
      add(l, "prior_outcome", o.type, {
        attrs: { category: o.category, unbound: true },
      })
      if (o.reason)
        add(l, "prior_reason", o.reason, { attrs: { unbound: true } })
    }
    block("prior", {
      kind: "unbound-outcome",
      line: l.i,
      page: l.page,
      message: `An outcome statement could not be tied to a drug: ${quote(l)}`,
    })
  }

  // ---------- coverage: lines that mention a criterion but were not read ----------
  const MENTION: Record<CriterionId, { scope?: string; re: RegExp }[]> = {
    adult: [
      {
        re: /\b(?:age[ds]?|y\/o|y\.o\.|yo|yrs?\s+old|years?\s+old|year-old|years?\s+of\s+age|dob|d\.o\.b\.?|date\s+of\s+birth|birth\s*date)\b|\[age\]/i,
      },
    ],
    diagnosis: [
      {
        scope: "t2dm",
        re: /\b(?:diabet\w*|t2d\w*|dm\s*(?:2|ii)?|e11(?:\.\d+)?|niddm)\b/i,
      },
      { scope: "psoriasis", re: /\b(?:psoria\w*|pso|l40(?:\.\d+)?)\b/i },
      {
        scope: "ascvd",
        re: /\b(?:ascvd|atheroscl\w*|coronary|cad|chd|myocardial|infarct\w*|n?stemi|stent\w*|pci|cabg|stroke|tia|pad|angina|revasculari\w*|i2[0-5](?:\.\d+)?|i63|i70)\b|\bMI\b/i,
      },
    ],
    lab: [
      {
        scope: "A1c",
        re: /\b(?:hb|hgb)\s?a\S{0,2}c\b|\ba[1lI|]c\b|\bglyc\w+\s+h\w*globin/i,
      },
      {
        scope: "BSA",
        re: /\bbsa\b|body\s+surface|%\s*bsa|skin\s+(?:percentage|estimate|measurement)/i,
      },
      { scope: "LDL-C", re: /\bldl\w*|lipid\s+panel|low[- ]density/i },
    ],
    prior: [
      {
        scope: "metformin",
        re: /\bmet\w{0,3}f\w{0,2}rm\w{0,3}\b|\bglucophage\b/i,
      },
      {
        scope: "methotrexate",
        re: /\bmeth\w{0,3}trex\w*|\bmtx\b|\btrexall\b|\botrexup\b|\brasuvo\b/i,
      },
      {
        scope: "statin",
        re: /\b\w*vastat\w*|\bstatins?\b|\blipitor\b|\bcrestor\b|\bzocor\b/i,
      },
    ],
    dose: [
      {
        scope: "semaglutide",
        re: /\b(?:sema\w*|ozem\w*|wegov\w*|rybels\w*)\b/i,
      },
      {
        scope: "adalimumab",
        re: /\b(?:adalim\w*|humir\w*|hadlima|hyrimoz|cyltezo|amjevita|yusimry)\b/i,
      },
      { scope: "evolocumab", re: /\b(?:evoloc\w*|repath\w*)\b/i },
    ],
  }
  const MESSAGE: Record<CriterionId, (scope?: string) => string> = {
    adult: () => "A line mentions age but no age could be read",
    diagnosis: () =>
      "A line mentions the condition but could not be read as a diagnosis",
    lab: (s) => `A line names ${s} but no result could be read`,
    prior: (s) =>
      `A line names ${s} but could not be read as a treatment course`,
    dose: (s) => `A line names ${s} with a dose that could not be read`,
  }
  // A form field shown blank answers for itself: "Numeric skin measurement: ____".
  const BLANK_NAME: Record<CriterionId, string> = {
    adult: "age",
    diagnosis: "diagnosis",
    lab: "lab",
    prior: "prior therapy",
    dose: "dose",
  }
  for (const l of content) {
    if (l.kind !== "field" || !l.label) continue
    const v = lineText(l).slice(l.valueOffset ?? 0)
    if (!isBlankValue(v) && !/^\s*_{2,}/.test(v)) continue
    for (const c of criteria) {
      if (understood[c].has(l.i)) continue
      if (!MENTION[c].some(({ re }) => re.test(l.label!))) continue
      understood[c].add(l.i)
      if (
        !entities.some(
          (e) => e.type === "blank_field" && e.value === BLANK_NAME[c],
        )
      )
        add(l, "blank_field", BLANK_NAME[c])
    }
  }
  const scanned = doc.filter((l) =>
    ["field", "prose", "table-row", "heading", "table-header"].includes(l.kind),
  )
  for (const l of scanned) {
    const t = lineText(l)
    for (const c of criteria) {
      if (understood[c].has(l.i)) continue
      for (const { scope, re } of MENTION[c]) {
        if (!re.test(t)) continue
        if (l.kind === "heading" || l.kind === "table-header") {
          // A heading such as "A1C RESULTS" is read through the lines under
          // it. When none of them was read for this criterion, the heading
          // still says the item may be there.
          if (c === "prior" && lineEpisodes.has(l.i)) continue
          const under = doc.filter(
            (x) =>
              x.i > l.i &&
              x.page === l.page &&
              (x.section.line === l.i ||
                (l.kind === "table-header" && x.kind === "table-row")),
          )
          if (under.some((x) => understood[c].has(x.i))) continue
        }
        if (
          c === "dose" &&
          !/\d/.test(t.replace(TOKEN, "")) &&
          !/\b(?:weekly|daily|monthly|every|q\.?\s?\d|bid|qw|dose|dosage|sig|strength|directions|frequency)\b/i.test(
            t,
          ) &&
          !DOSE_UNREAD.test(t)
        )
          continue
        if (c === "prior" && used.has(l.i)) continue
        if (c === "lab" && used.has(l.i) && !labLines.has(l.i)) continue
        if (
          c === "diagnosis" &&
          mentions.some(
            (m) => m.line === l.i && (m.scope === scope || !m.scope),
          )
        )
          continue
        block(c, {
          kind: "unparsed-mention",
          line: l.i,
          page: l.page,
          scope,
          message: `${MESSAGE[c](scope)}: ${quote(l)}`,
        })
      }
    }
  }
  // Low OCR confidence on a line the reader did not understand. The line
  // blocks the criteria whose words it resembles, even misread. A line that
  // resembles none is ruled irrelevant when most of its words were read with
  // good confidence, and blocks every criterion when most were not.
  const entityLines = new Set(lineOf.values())
  const hasEntity = (i: number) => entityLines.has(i)
  const lowWords = new Map<number, string[]>()
  for (const w of lowConfidenceWords ?? [])
    if (/[A-Za-z0-9]/.test(w.text))
      lowWords.set(w.line, [...(lowWords.get(w.line) ?? []), w.text])
  for (const i of new Set(lowConfidenceLines)) {
    const l = doc[i]
    if (!l || ["blank", "page-break"].includes(l.kind)) continue
    const t = lineText(l)
    // A heading's own words, without a scanned box such as "[ 1" before them.
    const own = l.kind === "heading" ? (l.label ?? t) : t
    if ((l.kind === "heading" || l.kind === "table-header") && !/\d/.test(own))
      continue
    if (criteria.every((c) => understood[c].has(i))) continue
    // Only punctuation was unsure: the words themselves were read.
    if (lowConfidenceWords && !lowWords.has(i)) continue
    const read = criteria.some((c) => understood[c].has(i)) || hasEntity(i)
    const topics = read ? new Set<CriterionId>() : topicsOf(t)
    for (const c of criteria)
      for (const { re } of MENTION[c]) if (re.test(t)) topics.add(c)
    const tokens = t.split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x))
    const low = lowWords.get(i)
    const unreadable = !low || low.length * 2 >= Math.max(1, tokens.length)
    // "Request prepared tes 103": the label is read and says what the line is.
    // The readable label, after scan specks such as "~~" before it.
    const bare = t.replace(/^[\s~‘’`´^°•·_—–-]+/, "")
    const head = bare.trim().split(/\s+/).slice(0, 3)
    const labelled =
      [3, 2, 1].some((n) => {
        const r = roleOf(head.slice(0, n).join(" "))
        return (
          !!r &&
          ["requestDate", "receivedDate", "bareDate", "social"].includes(r)
        )
      }) ||
      /^\s*(?:patient|pt|name|prescriber|clinician|provider|physician|from|to|signed|seen\s+by|consultant|writer|visit|fax|page|phone|address)\b/i.test(
        bare,
      )
    if (!topics.size && labelled) continue
    // A line the reader understood blocks only the criteria it names outright.
    const targets = topics.size
      ? [...topics]
      : unreadable && !read
        ? criteria
        : []
    const listSection = ["medications", "history"].includes(l.section.role)
    for (const c of targets) {
      if (understood[c].has(i)) continue
      block(c, {
        kind: "low-confidence-line",
        line: i,
        page: l.page,
        ...(c === "dose" && listSection ? { blocksFound: true } : {}),
        message: `Low OCR confidence on a line that could not be read: ${quote(l)}`,
      })
    }
  }
  for (const r of removedClinical) {
    const l = doc[r.line]
    if (!l) continue
    const targets: CriterionId[] =
      r.category === "drug"
        ? ["prior", "dose"]
        : r.category === "condition"
          ? ["diagnosis"]
          : r.category === "lab"
            ? ["lab"]
            : criteria
    for (const c of targets)
      block(c, {
        kind: "redacted-clinical-word",
        line: r.line,
        page: l.page,
        message: `The privacy step removed a ${r.category} word on this line: ${quote(l)}`,
      })
  }

  for (const { entity, mention, page } of dated) {
    if (mention.order !== "ambiguous") continue
    const reading = orders.get(page) ?? { status: "none", order: null }
    entity.value = reading.order
      ? mention.readings[reading.order === "mdy" ? 0 : 1]
      : { readings: [mention.readings[0], mention.readings[1]] }
  }
  const all = [...orders.values()].filter((r) => r.status !== "none")
  const dateReading: DateReading = all.find((r) => r.status === "conflict") ??
    all.find((r) => r.status === "unresolved") ??
    all[0] ?? { status: "none", order: null }

  // ---------- line order and ids ----------
  const order = entities
    .map((e, k) => ({ e, k, line: lineOf.get(e) ?? 0 }))
    .sort((x, y) => x.line - y.line || x.k - y.k)
  const ids = new Map<Entity, string>()
  order.forEach(({ e }, k) => ids.set(e, `e${k + 1}`))
  for (const { e } of order) {
    e.id = ids.get(e)!
    const r = relatedOf.get(e)
    if (r) e.related = [ids.get(r)!]
    else delete e.related
  }
  const coverage: ReaderCoverage = {
    lines: doc.length,
    pages: doc.at(-1)?.page ?? 1,
    blockers,
    mentions,
  }
  return {
    entities: order.map(({ e }) => e),
    offsetBasis: "Unicode code points",
    dateReading,
    coverage,
  }
}
// Duration of a course from words: "x 6 months", "for four months",
// "Six weeks", "about five months", "120 days", "for 16 wks".
export function episodeDuration(text: string): number | null {
  const unit = "(wks?|weeks?|mos?|months?|days?|d|yrs?|years?)"
  const m =
    text.match(new RegExp(`\\bx\\s*(${NUMBER})\\s*${unit}\\b`, "i")) ??
    text.match(
      new RegExp(
        `\\b(?:for|over|about|approximately|around|~|duration\\s*:?|lasted|length\\s*:?)\\s*(${NUMBER})\\s*${unit}\\b`,
        "i",
      ),
    ) ??
    text.match(
      new RegExp(
        `(?<!every\\s{1,3})(?<!q\\s?)(?<![\\d/.-])\\b(${NUMBER})\\s+${unit}\\b(?!\\s*(?:ago|before|after|later|earlier|prior))`,
        "i",
      ),
    )
  if (!m) return null
  const n = numberWord(m[1])
  if (n === undefined) return null
  const u = m[2].toLowerCase()
  return Math.round(
    n *
      (u.startsWith("w")
        ? 7
        : u.startsWith("m")
          ? 30
          : u.startsWith("y")
            ? 365
            : 1),
  )
}

export interface Outcome {
  type: "contraindication" | "intolerance" | "inadequate response" | "stopped"
  category: string
  reason?: string
  blank?: boolean
  // A comparison with a goal ("goal below 7.0 % not met"), not a stated outcome.
  goal?: boolean
}
// Outcome of a course from one line of text. Negated outcomes ("not
// contraindicated", "contraindications: none") are not outcomes. Stopping for
// an inadequate response is not an intolerance.
export function classifyOutcome(t: string): Outcome | null {
  const clean = (r: string | undefined) => {
    if (!r) return undefined
    let s = r.trim().replace(/^[(\s]+|[)\s.;,]+$/g, "")
    // "stopped MTX - ALT 3x ULN": drop the drug name before the reason.
    const d = findDrugs(s)[0]
    if (d && d.index === 0) s = s.slice(d.end).replace(/^\s*[-–—:,]\s*/, "")
    // "myalgias with CK elevation on atorvastatin and rosuvastatin": the drug
    // names close the reason, they are not part of it.
    const later = findDrugs(s)
    if (later.length && later[0].index > 0) {
      const leftover = later.reduce(
        (acc, x) => acc.replace(x.match.written, " "),
        s.slice(later[0].index),
      )
      if (/^[\s,.;&]*(?:(?:and|or)[\s,.;&]*)*$/i.test(leftover))
        s = s
          .slice(0, later[0].index)
          .replace(/[\s,]+(?:on|to|with|from|of|for|and|or)?\s*$/i, "")
          .trim()
    }
    return s || undefined
  }
  // The reason after an outcome word: a label's value first ("Intolerance:
  // GI upset"), then a causal phrase ("due to", "for"), then "with" or "after".
  const reasonAfter = (m: RegExpMatchArray) => {
    const rest = t.slice(m.index! + m[0].length)
    const label = rest.match(/^\s*[:?–—-]\s*(.+?)\s*\.?\s*$/)
    if (label) return clean(label[1])
    const causal = rest.match(
      /\b(?:due\s+to|because\s+of|secondary\s+to|for|from)\s+(.+?)\s*\.?\s*$/i,
    )
    if (causal) return clean(causal[1])
    const weak = rest.match(/\b(?:with|after)\s+(.+?)\s*\.?\s*$/i)
    if (weak) return clean(weak[1])
    const r = rest.match(/^\s*,?\s*(.+?)\s*\.?\s*$/)
    return clean(r?.[1])
  }
  const notBefore = (m: RegExpMatchArray) =>
    /\b(?:not|no|without|never|denies)\s+(?:\w+\s+){0,2}$/i.test(
      t.slice(0, m.index!),
    )
  const none = (r?: string) =>
    !!r &&
    /^(?:none|no|n\/a|nil|not\s+applicable|denied|denies|nkda|unknown)\b/i.test(
      r,
    )
  const contra = t.match(OUTCOMES.contraindication)
  // "not contraindicated due to renal function" negates the outcome and gives
  // a reason for it in one breath: a person has to read it.
  if (
    contra &&
    notBefore(contra) &&
    /^\s*(?:due\s+to|because\s+of|secondary\s+to)\s+\S/i.test(
      t.slice(contra.index! + contra[0].length),
    )
  )
    return {
      type: "contraindication",
      category: "unclear",
      reason: reasonAfter(contra),
    }
  if (contra && !notBefore(contra)) {
    let reason = reasonAfter(contra)
    if (none(reason)) return null
    const blank = !!reason && /^_+$/.test(reason)
    if (blank) reason = undefined
    if (!reason && OUTCOMES.adverse.test(t))
      reason = t.match(OUTCOMES.adverse)![0]
    return {
      type: "contraindication",
      category: "contraindication",
      reason,
      ...(blank ? { blank } : {}),
    }
  }
  const stopped = t.match(OUTCOMES.stopped)
  const intol = t.match(OUTCOMES.intolerance)
  // Goal comparisons are blanked first, so "above goal" is never read as a
  // stated inadequate response.
  const goal = t.match(GOAL)
  const efficacy = t
    .replace(global(GOAL), (m) => " ".repeat(m.length))
    .match(OUTCOMES.efficacy)
  if (stopped && !notBefore(stopped)) {
    const reason = reasonAfter(stopped)
    if (
      reason &&
      !/^(?:\[date|on\s+\[date)/i.test(reason) &&
      !/^_+$/.test(reason)
    ) {
      // "Statin intolerance" names the outcome, not its reason.
      if (/^(?:an?\s+)?(?:\w+\s+)?intoleran\w*$/i.test(reason))
        return { type: "intolerance", category: "adverse" }
      // A goal lab still high is lack of effect: "elevated LDL", "A1c
      // remained high". An elevated liver enzyme or CK stays adverse.
      if (
        OUTCOMES.efficacy.test(reason) ||
        GOAL.test(reason) ||
        GOAL_LAB_HIGH.test(reason)
      )
        return { type: "inadequate response", category: "efficacy" }
      if (/\bpregnan\w*|conception|breast-?feeding|lactation/i.test(reason))
        return {
          type: "contraindication",
          category: "contraindication",
          reason,
        }
      if (OUTCOMES.nonClinical.test(reason) && !OUTCOMES.adverse.test(reason))
        return { type: "stopped", category: "non-clinical", reason }
      if (OUTCOMES.adverse.test(reason) || intol)
        return { type: "intolerance", category: "adverse", reason }
      return { type: "stopped", category: "unclear", reason }
    }
  }
  if (intol && !notBefore(intol)) {
    let reason = reasonAfter(intol)
    if (none(reason)) return null
    const blank = !!reason && /^_+$/.test(reason)
    if (blank) reason = undefined
    if (reason && /^(?:to|of)\s+\S+$/i.test(reason)) reason = undefined
    if (reason) reason = reason.replace(/^(?:to|of)\s+\S+\s*[-–—:,]\s*/i, "")
    if (
      reason &&
      /^(?:to|of)\s+/i.test(reason) &&
      findDrugs(reason).length &&
      !OUTCOMES.adverse.test(reason)
    )
      reason = undefined
    if (reason && !OUTCOMES.adverse.test(reason) && !/[a-z]{4,}/i.test(reason))
      reason = undefined
    return {
      type: "intolerance",
      category: "adverse",
      reason,
      ...(blank ? { blank } : {}),
    }
  }
  if (efficacy && !notBefore(efficacy))
    return { type: "inadequate response", category: "efficacy" }
  if (goal)
    return { type: "inadequate response", category: "efficacy", goal: true }
  if (stopped && !notBefore(stopped)) {
    if (OUTCOMES.nonClinical.test(t))
      return { type: "stopped", category: "non-clinical" }
  }
  return null
}
