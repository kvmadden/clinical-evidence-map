// Deterministic generator for the synthetic evaluation set.
// Every person, clinic and history is invented. Run with `npm run generate`.
// Gold statuses come from the fictional rules applied to the structured facts
// that this file also writes into the text, never from the pipeline.
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises"
import { createHash } from "node:crypto"

export type Cls = "glp1-t2d" | "biologic-psoriasis" | "pcsk9"
type Status = "evidence_found" | "missing" | "needs_review"
type Style =
  | "iso"
  | "us-slash"
  | "us-short"
  | "day-first"
  | "text-dmy"
  | "text-mdy"
  | "us-hand"
type Conv = "mdy" | "dmy"
type DateValue = string | { readings: [string, string] }

const DAY = 86400000
const ms = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const addDays = (iso: string, n: number) =>
  new Date(ms(iso) + n * DAY).toISOString().slice(0, 10)
const between = (a: string, b: string) => Math.round((ms(b) - ms(a)) / DAY)
const pad = (n: number) => String(n).padStart(2, "0")
const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]
const swap = (iso: string) =>
  `${iso.slice(0, 4)}-${iso.slice(8, 10)}-${iso.slice(5, 7)}`
const ORDER: Partial<Record<Style, Conv>> = {
  "us-slash": "mdy",
  "us-short": "mdy",
  "us-hand": "mdy",
  "day-first": "dmy",
}

class DateTok {
  constructor(
    public iso: string,
    public style: Style,
  ) {}
  get text() {
    const y = this.iso.slice(0, 4),
      m = +this.iso.slice(5, 7),
      d = +this.iso.slice(8, 10)
    switch (this.style) {
      case "iso":
        return this.iso
      case "us-slash":
        return `${pad(m)}/${pad(d)}/${y}`
      case "us-short":
        return `${m}-${d}-${y.slice(2)}`
      case "us-hand":
        return `${m}/${d}/${y.slice(2)}`
      case "day-first":
        return `${pad(d)}/${pad(m)}/${y}`
      case "text-dmy":
        return `${d} ${MON[m - 1]} ${y}`
      case "text-mdy":
        return `${MON[m - 1]} ${d}, ${y}`
    }
  }
  get order() {
    return ORDER[this.style] ?? null
  }
  get ambiguous() {
    const m = +this.iso.slice(5, 7),
      d = +this.iso.slice(8, 10)
    return !!this.order && m <= 12 && d <= 12 && m !== d
  }
  get forced(): Conv | null {
    return this.order && +this.iso.slice(8, 10) > 12 ? this.order : null
  }
  // Calendar readings of the written numbers: [month first, day first].
  get readings(): [string, string] {
    return this.order === "mdy"
      ? [this.iso, swap(this.iso)]
      : [swap(this.iso), this.iso]
  }
}

// ---------- class profiles (fictional rules, real drug names) ----------
interface Dose {
  amount: number
  unit: string
  freq: string
  route: "SC" | "PO"
}
const canonDose = (d: Pick<Dose, "amount" | "unit" | "freq">) =>
  `${d.amount} ${d.unit} ${d.freq}`
interface Profile {
  title: string
  drug: string
  brand: string
  misspelledDrug: string
  dose: Dose
  wrongDose: Dose
  conflictDose: Dose
  condition: string
  conditionTexts: string[]
  misspelledCondition: string
  severity: { text: string; value: string }[]
  other: { text: string; value: string }[]
  unconfirmed: { text: string; value: string }[]
  family: string[]
  assessmentTail: string
  lab: {
    name: string
    unit: string
    names: string[]
    value: number
    below: number | null
    min: number | null
  }
  prior: {
    drug: string
    brand: string
    misspelled: string
    dose: Dose
    sig: string
    baseline: number
    followup: number
    atGoal: number
    goalText: string
    goalMet: (v: number) => boolean
    intolerance: string
    contraindication: string
    wrongClass: { drug: string; dose: Dose }
    lowIntensity?: Dose
    lookalike?: { written: string; drug: string; intended: string }
  }
}
export const PROFILES: Record<Cls, Profile> = {
  "glp1-t2d": {
    title: "GLP-1 for type 2 diabetes",
    drug: "semaglutide",
    brand: "Ozempic",
    misspelledDrug: "semaglutde",
    dose: { amount: 0.5, unit: "mg", freq: "weekly", route: "SC" },
    wrongDose: { amount: 0.5, unit: "mg", freq: "daily", route: "SC" },
    conflictDose: { amount: 1, unit: "mg", freq: "weekly", route: "SC" },
    condition: "type 2 diabetes mellitus",
    conditionTexts: [
      "Type 2 diabetes mellitus",
      "type 2 diabetes",
      "T2DM",
      "type 2 diabetes mellitus (E11.9)",
      "diabetes mellitus type 2",
    ],
    misspelledCondition: "Type 2 diabetis mellitus",
    severity: [],
    other: [
      { text: "obesity, for chronic weight management", value: "obesity" },
      { text: "prediabetes", value: "prediabetes" },
    ],
    unconfirmed: [
      {
        text: "suspected type 2 diabetes, repeat A1c pending",
        value: "type 2 diabetes mellitus",
      },
      { text: "possible type 2 diabetes", value: "type 2 diabetes mellitus" },
    ],
    family: ["type 2 diabetes mellitus"],
    assessmentTail: "above goal on prior therapy",
    lab: {
      name: "A1c",
      unit: "%",
      names: ["A1c", "HbA1c", "Hemoglobin A1c", "A1C"],
      value: 8.6,
      below: null,
      min: null,
    },
    prior: {
      drug: "metformin",
      brand: "Glucophage",
      misspelled: "metfromin",
      dose: { amount: 1000, unit: "mg", freq: "twice daily", route: "PO" },
      sig: "500 mg tablets, 2 tabs PO BID",
      baseline: 9.4,
      followup: 8.9,
      atGoal: 6.8,
      goalText: "below 7.0 %",
      goalMet: (v) => v < 7,
      intolerance: "persistent nausea and diarrhea",
      contraindication: "eGFR 24 mL/min/1.73 m2",
      wrongClass: {
        drug: "glipizide",
        dose: { amount: 5, unit: "mg", freq: "daily", route: "PO" },
      },
    },
  },
  "biologic-psoriasis": {
    title: "Biologic for plaque psoriasis",
    drug: "adalimumab",
    brand: "Humira",
    misspelledDrug: "adalimumb",
    dose: { amount: 40, unit: "mg", freq: "every 2 weeks", route: "SC" },
    wrongDose: { amount: 40, unit: "mg", freq: "weekly", route: "SC" },
    conflictDose: {
      amount: 80,
      unit: "mg",
      freq: "every 2 weeks",
      route: "SC",
    },
    condition: "moderate-to-severe plaque psoriasis",
    conditionTexts: [
      "Moderate-to-severe plaque psoriasis",
      "moderate to severe plaque psoriasis",
      "plaque psoriasis, moderate to severe",
      "severe plaque psoriasis (L40.0)",
    ],
    misspelledCondition: "moderate to severe plaque psoraisis",
    severity: [
      { text: "mild plaque psoriasis", value: "mild plaque psoriasis" },
      { text: "plaque psoriasis", value: "plaque psoriasis" },
    ],
    other: [
      { text: "psoriatic arthritis", value: "psoriatic arthritis" },
      { text: "hidradenitis suppurativa", value: "hidradenitis suppurativa" },
    ],
    unconfirmed: [
      { text: "rash, rule out plaque psoriasis", value: "plaque psoriasis" },
      { text: "possible psoriasis versus eczema", value: "psoriasis" },
    ],
    family: [
      "moderate-to-severe plaque psoriasis",
      "mild plaque psoriasis",
      "plaque psoriasis",
      "psoriasis",
    ],
    assessmentTail: "active on prior therapy",
    lab: {
      name: "BSA",
      unit: "%",
      names: ["Body surface area", "BSA", "BSA involvement"],
      value: 14,
      below: 6,
      min: 10,
    },
    prior: {
      drug: "methotrexate",
      brand: "Trexall",
      misspelled: "methotrexat",
      dose: { amount: 15, unit: "mg", freq: "weekly", route: "PO" },
      sig: "2.5 mg tablets, 6 tabs PO weekly",
      baseline: 18,
      followup: 15,
      atGoal: 2,
      goalText: "3 % or less",
      goalMet: (v) => v <= 3,
      intolerance: "ALT above 3 times the upper limit of normal",
      contraindication: "cirrhosis",
      wrongClass: {
        drug: "apremilast",
        dose: { amount: 30, unit: "mg", freq: "twice daily", route: "PO" },
      },
      lookalike: {
        written: "Trexan",
        drug: "naltrexone",
        intended: "Trexall (methotrexate)",
      },
    },
  },
  pcsk9: {
    title: "PCSK9 inhibitor",
    drug: "evolocumab",
    brand: "Repatha",
    misspelledDrug: "evolocumb",
    dose: { amount: 140, unit: "mg", freq: "every 2 weeks", route: "SC" },
    wrongDose: { amount: 420, unit: "mg", freq: "monthly", route: "SC" },
    conflictDose: { amount: 420, unit: "mg", freq: "monthly", route: "SC" },
    condition: "atherosclerotic cardiovascular disease",
    conditionTexts: [
      "Established atherosclerotic cardiovascular disease",
      "established ASCVD",
      "ASCVD with prior myocardial infarction",
      "coronary artery disease with prior stent",
    ],
    misspelledCondition: "established atherosclerotc cardiovascular disease",
    severity: [],
    other: [
      {
        text: "primary hyperlipidemia, no known ASCVD",
        value: "primary hyperlipidemia",
      },
    ],
    unconfirmed: [
      {
        text: "possible coronary artery disease, stress test pending",
        value: "atherosclerotic cardiovascular disease",
      },
    ],
    family: ["atherosclerotic cardiovascular disease"],
    assessmentTail: "LDL-C above goal",
    lab: {
      name: "LDL-C",
      unit: "mg/dL",
      names: ["LDL-C", "LDL", "LDL cholesterol", "LDL-c"],
      value: 132,
      below: 64,
      min: 70,
    },
    prior: {
      drug: "atorvastatin",
      brand: "Lipitor",
      misspelled: "atorvastatn",
      dose: { amount: 80, unit: "mg", freq: "daily", route: "PO" },
      sig: "80 mg tablet, 1 tab PO daily",
      baseline: 188,
      followup: 128,
      atGoal: 62,
      goalText: "below 70 mg/dL",
      goalMet: (v) => v < 70,
      intolerance: "myalgias with CK 900 U/L",
      contraindication: "decompensated cirrhosis",
      wrongClass: {
        drug: "ezetimibe",
        dose: { amount: 10, unit: "mg", freq: "daily", route: "PO" },
      },
      lowIntensity: { amount: 10, unit: "mg", freq: "daily", route: "PO" },
    },
  },
}

const PINNED_DOSE: Record<Cls, string> = {
  "glp1-t2d": "0.5 mg weekly",
  "biologic-psoriasis": "40 mg every other week",
  pcsk9: "140 mg every 2 weeks",
}

export const RULES: Record<Cls, Record<string, string>> = {
  "glp1-t2d": {
    adult: "Age is at least 18 years.",
    diagnosis:
      "Type 2 diabetes is documented as the reason for this request. A condition found only in a history or problem list, a suspected diagnosis, or a different requested indication does not meet this rule.",
    lab: "An A1c result is documented within 180 days before the request.",
    prior:
      "Metformin at a stated dose for at least 90 days, with an A1c on or before the start and an A1c at least 90 days after the start that is still 7.0% or higher. A documented intolerance or contraindication to metformin, with its reason, also meets this rule.",
    dose: "The requested semaglutide dose is 0.5 mg weekly.",
  },
  "biologic-psoriasis": {
    adult: "Age is at least 18 years.",
    diagnosis:
      "Moderate-to-severe plaque psoriasis is documented as the reason for this request. Psoriasis without that severity, a condition found only in a history or problem list, a suspected diagnosis, or a different requested indication does not meet this rule.",
    lab: "Body surface area involvement is at least 10%, measured within 180 days before the request.",
    prior:
      "Methotrexate at a stated dose for at least 90 days, with body surface area on or before the start and at least 90 days after the start that is still above 3%. A documented intolerance or contraindication to methotrexate, with its reason, also meets this rule.",
    dose: "The requested adalimumab maintenance dose is 40 mg every other week.",
  },
  pcsk9: {
    adult: "Age is at least 18 years.",
    diagnosis:
      "Established atherosclerotic cardiovascular disease is documented as the reason for this request. A condition found only in a history or problem list, a suspected diagnosis, or a different requested indication does not meet this rule.",
    lab: "LDL-C is at least 70 mg/dL, measured within 180 days before the request.",
    prior:
      "A high-intensity statin, atorvastatin 40 or 80 mg or rosuvastatin 20 or 40 mg daily, for at least 90 days, with LDL-C on or before the start and at least 90 days after the start that is still 70 mg/dL or higher. A documented statin intolerance or contraindication, with its reason, also meets this rule.",
    dose: "The requested evolocumab dose is 140 mg every 2 weeks.",
  },
}

// ---------- seeded randomness ----------
function rngFor(id: string) {
  let seed = createHash("sha256")
    .update(`stage-c:${id}`)
    .digest()
    .readUInt32LE(0)
  const next = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(xs: T[]) => xs[Math.floor(next() * xs.length)],
  }
}
type Rng = ReturnType<typeof rngFor>

const FREQ_WORDS: Record<string, string[]> = {
  weekly: [
    "weekly",
    "once weekly",
    "qwk",
    "every 7 days",
    "q7d",
    "once a week",
  ],
  "every 2 weeks": [
    "every 2 weeks",
    "every other week",
    "q2wk",
    "Q14D",
    "every 14 days",
    "EOW",
  ],
  daily: ["daily", "once daily", "qd", "every day"],
  "twice daily": ["twice daily", "BID", "bid", "twice a day", "q12h"],
  monthly: ["monthly", "once monthly", "every month"],
}
const ROUTE_WORDS = {
  SC: ["SC", "subcut", "subcutaneous", "SQ"],
  PO: ["PO", "by mouth", "orally"],
}
type DoseStyle = "plain" | "compact" | "route" | "sig"
function writeDose(d: Dose, style: DoseStyle, rng: Rng, sig?: string) {
  const amount = `${d.amount}`
  if (style === "plain")
    return `${amount} ${d.unit} ${d.freq === "every 2 weeks" ? rng.pick(["every other week", "every 2 weeks"]) : d.freq}`
  if (style === "sig" && sig) return sig
  if (style === "sig" && d.route === "SC")
    return `1 pen (${amount} mg) SC ${rng.pick(FREQ_WORDS[d.freq])}`
  const spaced =
    style === "compact" ? `${amount}${d.unit}` : `${amount} ${d.unit}`
  const route =
    style === "route" || style === "sig"
      ? ` ${rng.pick(ROUTE_WORDS[d.route])}`
      : ""
  return `${spaced}${route} ${rng.pick(FREQ_WORDS[d.freq])}`
}

// ---------- document model ----------
type Part = string | DateTok
interface Hand {
  image: string
  kind: "block" | "fill" | "note"
  box: number[]
  prefix?: string
}
interface Line {
  text: string
  parts: Part[]
  hand?: Hand
}
interface Fact {
  type: string
  value: unknown
  line: number
  tok?: DateTok
  misspelling?: {
    written: string
    intended: string
    pharmacist_accepts: boolean
  }
  handwritten?: boolean
}
interface Meas {
  name: string
  value: number
  unit: string
  tok?: DateTok
  lines: number[]
  role: "labs" | "baseline" | "followup"
}
interface Truth {
  age?: { value: number; line: number }
  ageBlank?: number
  request?: { tok: DateTok; line: number }
  conflict?: { tok: DateTok; line: number }
  header?: DateTok
  indication?: {
    value: string
    certainty: "confirmed" | "unconfirmed"
    line: number
  }
  indicationBlank?: number
  assessment?: {
    value: string
    certainty: "confirmed" | "unconfirmed"
    line: number
  }
  history?: { values: string[]; line: number }
  meas: Meas[]
  labBlank?: number
  requested?: { drug: string; dose?: string; lines: number[] }
  doseBlank?: number
  medList?: { dose: string; line: number }
  prior?: {
    drug: string
    lookalike?: string
    dose?: string
    amount?: number
    start?: DateTok
    stop?: DateTok
    duration?: number
    outcome?: "inadequate response" | "intolerance" | "contraindication"
    reason?: string
    baseline?: Meas
    followup?: Meas
    lines: number[]
  }
  priorBlank?: number
}
class Doc {
  lines: Line[] = []
  facts: Fact[] = []
  t: Truth = { meas: [] }
  add(parts: Part[] | string, hand?: Hand) {
    const p = typeof parts === "string" ? [parts] : parts
    const text = p.map((x) => (typeof x === "string" ? x : x.text)).join("")
    if (Array.from(text).length > 80)
      throw new Error(`Line longer than 80 characters: ${text}`)
    this.lines.push({ text, parts: p, hand })
    return this.lines.length - 1
  }
  fact(type: string, value: unknown, line: number, extra: Partial<Fact> = {}) {
    this.facts.push({ type, value, line, ...extra })
  }
  get dates() {
    return this.lines.flatMap((l) =>
      l.parts.filter((p): p is DateTok => p instanceof DateTok),
    )
  }
}

// ---------- packet plan ----------
export interface Plan {
  n: number
  id: string
  cls: Cls
  group: string
  page: "letter" | "form"
  dateStyle: Style
  ambiguity: "normal" | "header" | "unresolved"
  scenario: Record<"adult" | "diagnosis" | "lab" | "prior" | "dose", string>
  drugName: "generic" | "brand" | "both" | "misspelled"
  doseStyle: DoseStyle
  misspell?: "prior-drug" | "condition" | "requested-drug" | "lab-name"
  header: boolean
  pinned: boolean
  hand?: string
  notes?: string[]
}
export const GROUPS = [
  {
    id: "clean-render",
    label: "Clean render",
    from: 1,
    to: 5,
    render: "Typed page with light speckle. No other effect.",
  },
  {
    id: "rotation-7deg",
    label: "Simulated 7-degree rotation",
    from: 6,
    to: 10,
    render: "Typed page with simulated fax noise, rotated 7 degrees.",
  },
  {
    id: "ai-handwriting",
    label: "AI-drawn handwriting (image model)",
    from: 11,
    to: 15,
    render:
      "Typed page whose medication history is an AI-drawn handwriting image from an image model, not a real person's handwriting, with simulated fax noise.",
  },
  {
    id: "fax-noise",
    label: "Simulated fax noise",
    from: 16,
    to: 23,
    render: "Typed page with seeded speckles and faint horizontal streaks.",
  },
  {
    id: "choppy-lines",
    label: "Simulated choppy scan lines",
    from: 24,
    to: 31,
    render:
      "Typed page with seeded row jitter, dropped lines and dark streaks.",
  },
  {
    id: "smudge",
    label: "Simulated smudges",
    from: 32,
    to: 39,
    render: "Typed page with seeded blurred smudges over the text.",
  },
  {
    id: "low-contrast",
    label: "Simulated low contrast",
    from: 40,
    to: 47,
    render: "Typed page in light gray ink on a gray background.",
  },
  {
    id: "orientation",
    label: "Simulated page orientation",
    from: 48,
    to: 55,
    render:
      "Typed page with simulated fax noise, turned 180, 90 or 270 degrees.",
  },
  {
    id: "mixed-annotations",
    label: "Printed page with AI-drawn notes, circles and arrows",
    from: 56,
    to: 63,
    render:
      "Typed page with AI-drawn handwritten fills and margin notes from an image model, drawn circles and arrows, and simulated fax noise.",
  },
]
const groupOf = (n: number) => GROUPS.find((g) => n >= g.from && n <= g.to)!.id
const CLASSES: Cls[] = ["glp1-t2d", "biologic-psoriasis", "pcsk9"]
const FIRST = [
  "Mira",
  "Tobin",
  "Elva",
  "Nolan",
  "Sera",
  "Arlen",
  "Veda",
  "Corin",
  "Lina",
  "Oren",
]
const LAST = [
  "Brookvale",
  "Ashmere",
  "Fenwick",
  "Dunvale",
  "Reedwell",
  "Calderby",
  "Wrenfield",
]
const PINNED = new Set([1, 2, 6, 7])
const NONE_SUPPORTED = new Set([20, 37, 45])

export function planFor(n: number): Plan {
  const id = `packet-${pad(n).padStart(3, "0")}`
  const cls = CLASSES[(n - 1) % 3]
  const group = groupOf(n)
  const base: Plan = {
    n,
    id,
    cls,
    group,
    page: "letter",
    dateStyle: "iso",
    ambiguity: "normal",
    scenario: {
      adult: "supported",
      diagnosis: "supported",
      lab: "supported",
      prior: "objective",
      dose: "supported",
    },
    drugName: "generic",
    doseStyle: "plain",
    header: false,
    pinned: PINNED.has(n),
  }
  // Packets Kevin reviewed keep the lines he saw for age, lab and dose.
  if (n === 1 || n === 2) return base
  if (n === 6)
    return {
      ...base,
      scenario: { ...base.scenario, diagnosis: "history-only", prior: "bare" },
    }
  if (n === 7)
    return { ...base, scenario: { ...base.scenario, prior: "intolerance" } }
  const special = SPECIAL[n]
  if (special)
    return {
      ...base,
      pinned: n === 11,
      ...special,
      scenario: { ...base.scenario, ...special.scenario } as Plan["scenario"],
    }
  // Regular packets: cycle each axis on its own stride so variations mix.
  const k = REGULAR.indexOf(n)
  const pickCycle = (xs: string[], stride: number, offset = 0) =>
    xs[(k * stride + offset) % xs.length]
  const page = [1, 3].includes(k % 5) ? "form" : "letter"
  const dateStyle = (
    [
      "us-slash",
      "text-dmy",
      "day-first",
      "iso",
      "text-mdy",
      "us-short",
    ] as Style[]
  )[k % 6]
  const scenario = {
    adult: pickCycle(
      [
        "supported",
        "supported",
        "minor",
        "supported",
        "absent",
        "supported",
        "minor",
        "blank",
        "supported",
        "supported",
        "supported",
      ],
      1,
    ),
    diagnosis: pickCycle(
      [
        "supported",
        "history-only",
        "supported",
        "unconfirmed",
        "other-indication",
        "supported",
        "severity",
        "blank",
        "supported",
        "misspelled",
      ],
      3,
      1,
    ),
    lab: pickCycle(
      [
        "supported",
        "stale",
        "below",
        "supported",
        "missing-page",
        "conflict-date",
        "supported",
        "blank",
        "below",
        "supported",
      ],
      7,
      2,
    ),
    prior: pickCycle(
      [
        "objective",
        "bare",
        "intolerance",
        "short",
        "wrong-class",
        "objective",
        "undated",
        "goal-met",
        "contraindication",
        "missing-page",
        "special",
        "objective",
        "bare",
        "intolerance-no-reason",
      ],
      5,
      3,
    ),
    dose: pickCycle(
      [
        "supported",
        "conflict",
        "wrong-frequency",
        "supported",
        "blank",
        "supported",
        "conflict",
        "wrong-frequency",
        "supported",
        "blank",
      ],
      9,
      4,
    ),
  }
  const plan: Plan = {
    ...base,
    page,
    dateStyle,
    scenario,
    drugName: (
      ["generic", "brand", "generic", "both", "generic", "brand"] as const
    )[(k * 7) % 6],
    doseStyle: (
      ["route", "compact", "plain", "sig", "route", "compact"] as DoseStyle[]
    )[(k * 5) % 6],
    header: k % 3 === 2,
  }
  if (NONE_SUPPORTED.has(n))
    plan.scenario = {
      adult: "absent",
      diagnosis: "other-indication",
      lab: "stale",
      prior: "wrong-class",
      dose: "wrong-frequency",
    }
  if (AMBIGUOUS[n]) {
    plan.dateStyle = AMBIGUOUS[n].style
    plan.ambiguity = AMBIGUOUS[n].mode
    plan.header = AMBIGUOUS[n].mode === "header"
    plan.scenario.lab = "supported"
    plan.scenario.prior = "objective"
  }
  if (MISSPELL[n]) {
    plan.misspell = MISSPELL[n]
    if (plan.misspell === "condition") plan.scenario.diagnosis = "misspelled"
    if (
      plan.misspell === "prior-drug" &&
      !["objective", "bare", "short"].includes(plan.scenario.prior)
    )
      plan.scenario.prior = "objective"
    if (plan.misspell === "lab-name") plan.scenario.lab = "supported"
  }
  if (plan.scenario.diagnosis === "misspelled") plan.misspell = "condition"
  if (plan.scenario.prior === "special")
    plan.scenario.prior =
      cls === "biologic-psoriasis"
        ? "lookalike"
        : cls === "pcsk9"
          ? "low-intensity"
          : "objective"
  if (plan.scenario.diagnosis === "severity" && cls !== "biologic-psoriasis")
    plan.scenario.diagnosis = "unconfirmed"
  // The fictional A1c rule has no threshold, so a low value is not a near miss.
  if (plan.scenario.lab === "below" && cls === "glp1-t2d")
    plan.scenario.lab = "stale"
  // A dose conflict needs the medication list, which sits on the history page.
  if (
    plan.scenario.dose === "conflict" &&
    plan.scenario.prior === "missing-page"
  )
    plan.scenario.prior = "bare"
  // A trial with before and after values would document the lab elsewhere, so a
  // missing or blank lab page gets a prior scenario without values.
  if (
    ["missing-page", "blank"].includes(plan.scenario.lab) &&
    ["objective", "goal-met", "short", "lookalike", "low-intensity"].includes(
      plan.scenario.prior,
    )
  )
    plan.scenario.prior = (["bare", "undated", "intolerance"] as const)[k % 3]
  return plan
}
const SPECIAL: Record<
  number,
  Partial<Omit<Plan, "scenario">> & { scenario: Partial<Plan["scenario"]> }
> = {
  11: { hand: "hw-011", scenario: { prior: "objective" } },
  12: {
    hand: "hw-012",
    dateStyle: "us-slash",
    scenario: { diagnosis: "other-indication", prior: "bare" },
  },
  13: {
    hand: "hw-013",
    dateStyle: "text-mdy",
    scenario: { lab: "stale", prior: "intolerance" },
  },
  14: {
    hand: "hw-014",
    dateStyle: "iso",
    scenario: {
      diagnosis: "severity",
      lab: "missing-page",
      prior: "short",
      dose: "conflict",
    },
  },
  15: {
    hand: "hw-015",
    dateStyle: "text-dmy",
    scenario: { adult: "absent", lab: "conflict-date", prior: "objective" },
  },
  56: {
    hand: "note-a3",
    dateStyle: "iso",
    scenario: { diagnosis: "unconfirmed", prior: "intolerance" },
  },
  57: {
    hand: "note-a2",
    dateStyle: "us-slash",
    scenario: { lab: "handwritten", prior: "bare", dose: "wrong-frequency" },
  },
  58: {
    hand: "note-a1",
    page: "form",
    dateStyle: "text-dmy",
    scenario: { adult: "blank", diagnosis: "handwritten", dose: "blank" },
  },
  59: {
    hand: "note-a5",
    notes: ["note-a4"],
    page: "form",
    dateStyle: "us-slash",
    scenario: {
      diagnosis: "history-only",
      lab: "below",
      prior: "blank",
      dose: "handwritten",
    },
  },
  60: {
    hand: "note-b1",
    dateStyle: "iso",
    scenario: { lab: "stale", prior: "intolerance" },
  },
  61: {
    hand: "note-b4",
    notes: ["note-b3"],
    dateStyle: "text-mdy",
    scenario: { lab: "missing-page", prior: "handwritten-bare" },
  },
  62: {
    hand: "note-b2",
    page: "form",
    dateStyle: "iso",
    scenario: { diagnosis: "handwritten", dose: "conflict" },
  },
  63: {
    notes: ["note-b5"],
    dateStyle: "us-slash",
    scenario: { diagnosis: "other-indication", prior: "wrong-class" },
  },
}
const REGULAR = Array.from({ length: 63 }, (_, i) => i + 1).filter(
  (n) => !PINNED.has(n) && !SPECIAL[n],
)
// Day-first and two-digit-year packets whose numeric dates can be read two ways.
const AMBIGUOUS: Record<
  number,
  { style: Style; mode: "header" | "unresolved" }
> = {
  18: { style: "day-first", mode: "unresolved" },
  29: { style: "us-short", mode: "unresolved" },
  41: { style: "day-first", mode: "header" },
  50: { style: "us-short", mode: "header" },
  53: { style: "day-first", mode: "unresolved" },
}
const MISSPELL: Record<number, Plan["misspell"]> = {
  17: "requested-drug",
  22: "prior-drug",
  27: "lab-name",
  33: "prior-drug",
  39: "condition",
  46: "requested-drug",
  35: "prior-drug",
  54: "lab-name",
}

// ---------- text builder ----------
interface HandImage {
  id: string
  transcribed_lines: string[]
  content_box?: number[]
  note_boxes?: number[][]
  line_bands?: number[][]
}
function build(plan: Plan, hand: Record<string, HandImage>) {
  const P = PROFILES[plan.cls]
  const rng = rngFor(plan.id)
  const doc = new Doc()
  const t = doc.t
  const n = plan.n
  const name = `${FIRST[(n - 1) % 10]} ${LAST[Math.floor((n - 1) / 10) % LAST.length]}`
  const s = plan.scenario
  const pinned = plan.pinned
  const style = plan.dateStyle
  const D = (iso: string, st: Style = style) => new DateTok(iso, st)
  // Timeline. Kevin's packets keep the dates he saw.
  const unresolvedLike = plan.ambiguity !== "normal"
  const request =
    pinned || plan.hand || unresolvedLike
      ? "2026-10-01"
      : addDays("2026-10-01", rng.int(-6, 9))
  const visit = unresolvedLike ? "2026-09-03" : addDays(request, -11)
  let labDate = unresolvedLike ? "2026-09-08" : addDays(request, -16)
  if (s.lab === "stale") labDate = addDays(request, -273)
  // Keep trial values out of the lab window unless the lab scenario is supported.
  const early = !["supported", "conflict-date"].includes(s.lab)
  let start = unresolvedLike
    ? "2026-04-01"
    : addDays(request, early ? -330 : -183)
  let stop = addDays(start, 122)
  let baseDate = unresolvedLike ? "2026-03-11" : addDays(start, -7)
  let followDate = unresolvedLike ? "2026-07-06" : addDays(start, 110)
  if (s.prior === "short") {
    stop = addDays(start, 45)
    followDate = addDays(start, 40)
  }
  if (s.prior === "intolerance" || s.prior === "intolerance-no-reason") {
    start = addDays(request, -61)
    stop = addDays(start, 14)
  }
  const add = doc.add.bind(doc)

  const drugWritten = (
    generic: string,
    brand: string,
    mode: Plan["drugName"],
    misspelled?: string,
  ) =>
    mode === "brand"
      ? brand
      : mode === "both"
        ? `${brand} (${generic})`
        : mode === "misspelled" && misspelled
          ? misspelled
          : generic
  const reqDrugMode: Plan["drugName"] =
    plan.misspell === "requested-drug" ? "misspelled" : plan.drugName
  const reqDrugText = drugWritten(
    P.drug,
    P.brand,
    reqDrugMode,
    P.misspelledDrug,
  )
  const reqDose = s.dose === "wrong-frequency" ? P.wrongDose : P.dose
  const reqDoseText = pinned
    ? PINNED_DOSE[plan.cls]
    : writeDose(reqDose, plan.doseStyle, rng)
  const drugMiss =
    reqDrugMode === "misspelled"
      ? {
          written: P.misspelledDrug,
          intended: P.drug,
          pharmacist_accepts: true,
        }
      : undefined

  // ---- fax-style header line (typed, not a real transmission) ----
  if (plan.header) {
    const tok = D(addDays(request, 1), "text-dmy")
    const l = add(["Fax received: ", tok, " 09:14. Page 1 of 1."])
    t.header = tok
    doc.fact("fax_received_date", tok, l, { tok })
  }

  // ---- letter or form ----
  const dxText = () => {
    if (s.diagnosis === "misspelled")
      return {
        text: P.misspelledCondition,
        value: P.condition,
        certainty: "confirmed" as const,
        miss: {
          written: P.misspelledCondition,
          intended: P.condition,
          pharmacist_accepts: true,
        },
      }
    if (s.diagnosis === "severity") {
      const v = rng.pick(
        P.severity.length
          ? P.severity
          : [{ text: P.conditionTexts[0], value: P.condition }],
      )
      return { text: v.text, value: v.value, certainty: "confirmed" as const }
    }
    if (s.diagnosis === "other-indication") {
      const v = rng.pick(P.other)
      return { text: v.text, value: v.value, certainty: "confirmed" as const }
    }
    if (s.diagnosis === "unconfirmed") {
      const v = rng.pick(P.unconfirmed)
      return { text: v.text, value: v.value, certainty: "unconfirmed" as const }
    }
    return {
      text: pinned ? P.conditionTexts[0] : rng.pick(P.conditionTexts),
      value: P.condition,
      certainty: "confirmed" as const,
    }
  }
  const dx = dxText()
  const indicationStated = !["history-only", "absent", "blank"].includes(
    s.diagnosis,
  )
  const handFill = (key: string) => {
    const [sheet, idx] = key.startsWith("note-")
      ? [key[5] === "a" ? "hw-notes-a" : "hw-notes-b", +key.slice(6) - 1]
      : [key, -1]
    const img = hand[sheet]
    return {
      image: sheet,
      box: idx >= 0 ? img.note_boxes![idx] : img.content_box!,
      text: idx >= 0 ? img.transcribed_lines[idx] : "",
      lines: img.transcribed_lines,
    }
  }

  const ageValue = s.adult === "minor" ? 17 : 32 + (n % 29)
  if (plan.page === "letter") {
    add("REQUESTING PROVIDER LETTER")
    const rl = add([
      pinned || rng.next() < 0.6 ? "Request date: " : "Letter date: ",
      D(request),
      ".",
    ])
    t.request = { tok: doc.lines[rl].parts[1] as DateTok, line: rl }
    doc.fact("request_date", t.request.tok, rl, { tok: t.request.tok })
    const pl = add(`Patient: ${name} (fictional).`)
    doc.fact("patient_name", name, pl)
    if (s.adult !== "absent" && s.adult !== "blank") {
      const forms = pinned
        ? [`Age: ${ageValue} years.`]
        : [
            `Age: ${ageValue} years.`,
            `Age: ${ageValue}`,
            `Patient age: ${ageValue} years.`,
            `Age: ${ageValue} yrs`,
          ]
      const al = add(rng.pick(forms))
      t.age = { value: ageValue, line: al }
      doc.fact("age", ageValue, al)
    }
    const fl = add("From: Dr. Rowan Vale, fictional requesting provider.")
    doc.fact("provider", "Dr. Rowan Vale", fl)
    const doseAbsent = s.dose === "blank"
    const reqLine = add(
      doseAbsent
        ? `Request: ${reqDrugText}.`
        : `Request: ${reqDrugText} ${reqDoseText}.`,
    )
    t.requested = {
      drug: P.drug,
      dose: doseAbsent ? undefined : canonDose(reqDose),
      lines: [reqLine],
    }
    doc.fact("requested_medication", P.drug, reqLine, { misspelling: drugMiss })
    if (!doseAbsent) doc.fact("requested_dose", canonDose(reqDose), reqLine)
    if (indicationStated) {
      const label = pinned
        ? "Indication for this request: "
        : rng.pick([
            "Indication for this request: ",
            "Reason for request: ",
            "Requested for: ",
          ])
      const il = add(`${label}${dx.text}.`)
      t.indication = { value: dx.value, certainty: dx.certainty, line: il }
      doc.fact(
        "indication",
        dx.certainty === "confirmed"
          ? dx.value
          : { condition: dx.value, certainty: "unconfirmed" },
        il,
        { misspelling: dx.miss },
      )
      const review = `Please review the enclosed records for ${dx.text}.`
      if (
        s.diagnosis === "supported" &&
        !pinned &&
        rng.next() < 0.5 &&
        review.length <= 80
      )
        add(review)
    }
  } else {
    add("PRIOR AUTHORIZATION REQUEST FORM")
    const rl = add(["Date of request: ", D(request)])
    t.request = { tok: doc.lines[rl].parts[1] as DateTok, line: rl }
    doc.fact("request_date", t.request.tok, rl, { tok: t.request.tok })
    const pl = add(`Patient name: ${name} (fictional)`)
    doc.fact("patient_name", name, pl)
    if (s.adult === "blank") {
      const l = add("Age: ________")
      t.ageBlank = l
      doc.fact("blank_field", "age", l)
    } else if (s.adult !== "absent") {
      const l = add(`Age: ${ageValue}`)
      t.age = { value: ageValue, line: l }
      doc.fact("age", ageValue, l)
    }
    const fl = add("Prescriber: Dr. Rowan Vale (fictional)")
    doc.fact("provider", "Dr. Rowan Vale", fl)
    const ml = add(`Medication requested: ${reqDrugText}`)
    doc.fact("requested_medication", P.drug, ml, { misspelling: drugMiss })
    if (s.dose === "blank") {
      const l = add("Dose and frequency: ________")
      t.doseBlank = l
      t.requested = { drug: P.drug, lines: [ml] }
      doc.fact("blank_field", "dose", l)
    } else if (s.dose === "handwritten") {
      const h = handFill(plan.hand!)
      const l = add(`Dose and frequency: ${h.text}`, {
        image: h.image,
        kind: "fill",
        box: h.box,
        prefix: "Dose and frequency: ",
      })
      t.requested = { drug: P.drug, dose: canonDose(P.dose), lines: [ml, l] }
      doc.fact("requested_dose", canonDose(P.dose), l, { handwritten: true })
    } else {
      const l = add(`Dose and frequency: ${reqDoseText}`)
      t.requested = { drug: P.drug, dose: canonDose(reqDose), lines: [ml, l] }
      doc.fact("requested_dose", canonDose(reqDose), l)
    }
    if (s.diagnosis === "blank") {
      const l = add("Diagnosis for this request: ________")
      t.indicationBlank = l
      doc.fact("blank_field", "diagnosis", l)
    } else if (s.diagnosis === "handwritten") {
      const h = handFill(plan.hand!)
      const l = add(`Diagnosis for this request: ${h.text}`, {
        image: h.image,
        kind: "fill",
        box: h.box,
        prefix: "Diagnosis for this request: ",
      })
      t.indication = { value: P.condition, certainty: "confirmed", line: l }
      doc.fact("indication", P.condition, l, { handwritten: true })
    } else if (indicationStated) {
      const l = add(`Diagnosis for this request: ${dx.text}`)
      t.indication = { value: dx.value, certainty: dx.certainty, line: l }
      doc.fact(
        "indication",
        dx.certainty === "confirmed"
          ? dx.value
          : { condition: dx.value, certainty: "unconfirmed" },
        l,
        { misspelling: dx.miss },
      )
    }
  }

  // ---- clinical notes ----
  add("")
  add("CLINICAL NOTES")
  add(["Visit date: ", D(visit), "."])
  if (
    s.diagnosis === "history-only" ||
    s.diagnosis === "absent" ||
    s.diagnosis === "blank"
  ) {
    add("Assessment: routine follow-up visit.")
  } else if (s.diagnosis === "handwritten") {
    add("Assessment: see request form.")
  } else {
    const full = `Assessment: ${dx.text}, ${P.assessmentTail}.`
    const al = add(
      dx.value === P.condition &&
        dx.certainty === "confirmed" &&
        full.length <= 80
        ? full
        : `Assessment: ${dx.text}.`,
    )
    t.assessment = { value: dx.value, certainty: dx.certainty, line: al }
    doc.fact("assessment", { condition: dx.value, certainty: dx.certainty }, al)
  }
  if (s.diagnosis === "history-only") {
    const hl = add(
      `Past medical history: ${rng.pick(P.conditionTexts)}, hypertension.`,
    )
    t.history = { values: [P.condition, "hypertension"], line: hl }
    doc.fact("history_condition", P.condition, hl)
    doc.fact("history_condition", "hypertension", hl)
  } else if (!pinned && rng.next() < 0.4) {
    const hl = add("Past medical history: hypertension, seasonal allergies.")
    t.history = { values: ["hypertension", "seasonal allergies"], line: hl }
    doc.fact("history_condition", "hypertension", hl)
    doc.fact("history_condition", "seasonal allergies", hl)
  }
  if (s.lab === "conflict-date") {
    const tok = D(addDays(request, -30))
    const cl = add(["Request date recorded in note: ", tok, "."])
    t.conflict = { tok, line: cl }
    doc.fact("conflicting_request_date", tok, cl, { tok })
  }
  if (plan.page === "letter" || rng.next() < 0.5)
    add("The patient reports ongoing symptoms despite prior treatment.")
  for (const key of plan.notes ?? []) {
    const h = handFill(key)
    add(h.text, { image: h.image, kind: "note", box: h.box })
  }
  if (s.lab === "handwritten") {
    const h = handFill(plan.hand!)
    const l = add(h.text, { image: h.image, kind: "note", box: h.box })
    const tok = new DateTok("2026-09-14", "us-hand")
    doc.lines[l].parts = splitDates(h.text, [tok])
    t.meas.push({
      name: P.lab.name,
      value: 141,
      unit: P.lab.unit,
      tok,
      lines: [l],
      role: "labs",
    })
    doc.fact(
      "measurement",
      { name: P.lab.name, value: 141, unit: P.lab.unit },
      l,
      { handwritten: true },
    )
    doc.fact("measurement_date", tok, l, { tok, handwritten: true })
  }

  // ---- labs ----
  const labName =
    plan.misspell === "lab-name"
      ? plan.cls === "pcsk9"
        ? "LDL-c"
        : plan.cls === "glp1-t2d"
          ? "HbA1C"
          : "BSA"
      : pinned
        ? plan.cls === "biologic-psoriasis"
          ? "Body surface area"
          : P.lab.names[0]
        : rng.pick(P.lab.names)
  const labValue =
    s.lab === "below" && P.lab.below !== null ? P.lab.below : P.lab.value
  const labSection = !["missing-page", "handwritten"].includes(s.lab)
  if (labSection) {
    add("")
    add("LABS AND MEASUREMENTS")
    if (s.lab === "blank") {
      const l = add(`${P.lab.names[0]}: ______  Date collected: ______`)
      t.labBlank = l
      doc.fact("blank_field", "lab", l)
    } else if (plan.page === "form" && !pinned) {
      const tok = D(labDate)
      const v = `${labValue}${P.lab.unit === "%" ? " %" : " " + P.lab.unit}`
      const l1 = add(
        `Most recent ${labName === "Body surface area" ? "body surface area" : labName}: ${v}`,
      )
      const l2 = add(["Date collected: ", tok])
      const m: Meas = {
        name: P.lab.name,
        value: labValue,
        unit: P.lab.unit,
        tok,
        lines: [l1, l2],
        role: "labs",
      }
      t.meas.push(m)
      doc.fact(
        "measurement",
        { name: P.lab.name, value: labValue, unit: P.lab.unit },
        l1,
        {
          misspelling:
            plan.misspell === "lab-name"
              ? {
                  written: labName,
                  intended: P.lab.name,
                  pharmacist_accepts: true,
                }
              : undefined,
        },
      )
      doc.fact("measurement_date", tok, l2, { tok })
    } else {
      const tok = D(labDate)
      const unit =
        P.lab.unit === "%"
          ? rng.pick([" %", "%", " percent"])
          : rng.pick([" mg/dL", " mg/dl", " mg/dL"])
      const forms: Part[][] = pinned
        ? [
            [
              `${labName}: ${labValue}${P.lab.unit === "%" ? " %" : " " + P.lab.unit}; collected `,
              tok,
              ".",
            ],
          ]
        : [
            [`${labName}: ${labValue}${unit}; collected `, tok, "."],
            [`${labName} ${labValue}${unit} (drawn `, tok, ")"],
            [`${labName}: ${labValue}${unit}, measured `, tok, "."],
            [`${labName} = ${labValue}${unit} on `, tok],
          ]
      const l = add(rng.pick(forms))
      const m: Meas = {
        name: P.lab.name,
        value: labValue,
        unit: P.lab.unit,
        tok,
        lines: [l],
        role: "labs",
      }
      t.meas.push(m)
      doc.fact(
        "measurement",
        { name: P.lab.name, value: labValue, unit: P.lab.unit },
        l,
        {
          misspelling:
            plan.misspell === "lab-name"
              ? {
                  written: labName,
                  intended: P.lab.name,
                  pharmacist_accepts: true,
                }
              : undefined,
        },
      )
      doc.fact("measurement_date", tok, l, { tok })
    }
  }

  // ---- medication history ----
  const historySection = s.prior !== "missing-page"
  if (historySection) {
    add("")
    add("MEDICATION HISTORY")
    const listDose = s.dose === "conflict" ? P.conflictDose : reqDose
    if (plan.hand && plan.group === "ai-handwriting") {
      // The drawn block replaces the typed list and prior lines.
      const img = hand[plan.hand]
      const lines = img.transcribed_lines
      const first = doc.lines.length
      const ls = lines.map((text, i) =>
        add(
          text,
          i === 0
            ? { image: plan.hand!, kind: "block", box: img.content_box! }
            : { image: plan.hand!, kind: "block", box: [] },
        ),
      )
      handBlockFacts(plan, doc, ls, first)
    } else {
      if (s.dose !== "blank" || plan.page === "letter") {
        const ll = add(
          pinned
            ? `Current requested therapy: ${P.drug} ${PINNED_DOSE[plan.cls]}.`
            : `Current requested therapy: ${reqDrugText} ${writeDose(listDose, plan.doseStyle, rng)}.`,
        )
        t.medList = { dose: canonDose(listDose), line: ll }
        doc.fact("medication_list_dose", canonDose(listDose), ll)
      }
      priorLines(
        plan,
        doc,
        { start, stop, baseDate, followDate, style },
        rng,
        hand,
      )
    }
    add("No other prior therapy records supplied.")
  }
  return { doc, name }
}

// Facts for the five drawn medication-history blocks, written from the
// transcribed image text, not from the prompt.
function handBlockFacts(plan: Plan, doc: Doc, ls: number[], _first: number) {
  const t = doc.t
  const P = PROFILES[plan.cls]
  const H = (iso: string) => new DateTok(iso, "us-hand")
  const fact = (
    type: string,
    value: unknown,
    line: number,
    extra: Partial<Fact> = {},
  ) => doc.fact(type, value, line, { handwritten: true, ...extra })
  const tokAt = (line: number, iso: string, style: Style) => {
    const tok = new DateTok(iso, style)
    if (!doc.lines[line].text.includes(tok.text))
      throw new Error(`Date ${tok.text} not on line ${doc.lines[line].text}`)
    doc.lines[line].parts = splitDates(doc.lines[line].text, [tok])
    return tok
  }
  void H
  switch (plan.hand) {
    case "hw-011": {
      t.medList = { dose: canonDose(P.dose), line: ls[0] }
      fact("medication_list_dose", canonDose(P.dose), ls[0])
      const start = new DateTok("2026-04-01", "us-slash"),
        stop = new DateTok("2026-08-01", "us-slash")
      doc.lines[ls[1]].parts = splitDates(doc.lines[ls[1]].text, [start, stop])
      const b = new DateTok("2026-03-25", "us-slash"),
        f = new DateTok("2026-07-20", "us-slash")
      doc.lines[ls[2]].parts = splitDates(doc.lines[ls[2]].text, [b, f])
      const baseline: Meas = {
        name: "BSA",
        value: 18,
        unit: "%",
        tok: b,
        lines: [ls[2]],
        role: "baseline",
      }
      const followup: Meas = {
        name: "BSA",
        value: 15,
        unit: "%",
        tok: f,
        lines: [ls[2]],
        role: "followup",
      }
      t.meas.push(baseline, followup)
      t.prior = {
        drug: "methotrexate",
        dose: "15 mg weekly",
        amount: 15,
        start,
        stop,
        outcome: "inadequate response",
        baseline,
        followup,
        lines: [ls[1], ls[2]],
      }
      fact("prior_medication", "methotrexate", ls[1])
      fact("prior_dose", "15 mg weekly", ls[1])
      fact("prior_start_date", start, ls[1], { tok: start })
      fact("prior_stop_date", stop, ls[1], { tok: stop })
      fact("prior_baseline", { name: "BSA", value: 18, unit: "%" }, ls[2])
      fact("prior_baseline_date", b, ls[2], { tok: b })
      fact("prior_followup", { name: "BSA", value: 15, unit: "%" }, ls[2])
      fact("prior_followup_date", f, ls[2], { tok: f })
      break
    }
    case "hw-012": {
      t.medList = { dose: canonDose(P.dose), line: ls[0] }
      fact("medication_list_dose", canonDose(P.dose), ls[0])
      const start = tokAt(ls[1], "2026-04-01", "us-hand")
      const stop = new DateTok("2026-08-01", "us-hand")
      doc.lines[ls[1]].parts = splitDates(doc.lines[ls[1]].text, [start, stop])
      t.prior = {
        drug: "atorvastatin",
        dose: "80 mg daily",
        amount: 80,
        start,
        stop,
        outcome: "inadequate response",
        lines: [ls[1], ls[2]],
      }
      fact("prior_medication", "atorvastatin", ls[1])
      fact("prior_dose", "80 mg daily", ls[1])
      fact("prior_start_date", start, ls[1], { tok: start })
      fact("prior_stop_date", stop, ls[1], { tok: stop })
      fact("prior_outcome", "inadequate response", ls[2])
      break
    }
    case "hw-013": {
      t.medList = { dose: canonDose(P.dose), line: ls[0] }
      fact("medication_list_dose", canonDose(P.dose), ls[0])
      const start = new DateTok("2026-08-01", "us-hand"),
        stop = new DateTok("2026-08-15", "us-hand")
      doc.lines[ls[1]].parts = splitDates(doc.lines[ls[1]].text, [start, stop])
      t.prior = {
        drug: "metformin",
        dose: "1000 mg twice daily",
        amount: 1000,
        start,
        stop,
        outcome: "intolerance",
        reason: "persistent nausea and diarrhea",
        lines: [ls[1], ls[2]],
      }
      fact("prior_medication", "metformin", ls[1])
      fact("prior_dose", "1000 mg twice daily", ls[1])
      fact("prior_start_date", start, ls[1], { tok: start })
      fact("prior_stop_date", stop, ls[1], { tok: stop })
      fact("prior_outcome", "intolerance", ls[2])
      fact("prior_reason", "persistent nausea and diarrhea", ls[2])
      break
    }
    case "hw-014": {
      // Handwritten list says weekly. The typed letter says every other week.
      t.medList = { dose: "40 mg weekly", line: ls[0] }
      fact("medication_list_dose", "40 mg weekly", ls[0])
      const stop = new DateTok("2026-05-15", "us-hand")
      doc.lines[ls[1]].parts = splitDates(doc.lines[ls[1]].text, [stop])
      t.prior = {
        drug: "methotrexate",
        dose: "15 mg weekly",
        amount: 15,
        stop,
        duration: 42,
        outcome: "inadequate response",
        lines: [ls[1], ls[2]],
      }
      fact("prior_medication", "methotrexate", ls[1])
      fact("prior_dose", "15 mg weekly", ls[1])
      fact("prior_duration_days", 42, ls[1])
      fact("prior_stop_date", stop, ls[1], { tok: stop })
      fact("prior_outcome", "inadequate response", ls[2])
      break
    }
    case "hw-015": {
      t.medList = { dose: canonDose(P.dose), line: ls[0] }
      fact("medication_list_dose", canonDose(P.dose), ls[0])
      const start = new DateTok("2026-04-01", "us-hand"),
        stop = new DateTok("2026-08-01", "us-hand")
      doc.lines[ls[1]].parts = splitDates(doc.lines[ls[1]].text, [start, stop])
      const b = new DateTok("2026-03-25", "us-hand"),
        f = new DateTok("2026-07-20", "us-hand")
      doc.lines[ls[2]].parts = splitDates(doc.lines[ls[2]].text, [b, f])
      const baseline: Meas = {
        name: "LDL-C",
        value: 168,
        unit: "mg/dL",
        tok: b,
        lines: [ls[2]],
        role: "baseline",
      }
      const followup: Meas = {
        name: "LDL-C",
        value: 132,
        unit: "mg/dL",
        tok: f,
        lines: [ls[2]],
        role: "followup",
      }
      t.meas.push(baseline, followup)
      t.prior = {
        drug: "atorvastatin",
        dose: "80 mg daily",
        amount: 80,
        start,
        stop,
        outcome: "inadequate response",
        baseline,
        followup,
        lines: [ls[1], ls[2]],
      }
      fact("prior_medication", "atorvastatin", ls[1], {
        misspelling: undefined,
      })
      fact("prior_dose", "80 mg daily", ls[1])
      fact("prior_start_date", start, ls[1], { tok: start })
      fact("prior_stop_date", stop, ls[1], { tok: stop })
      fact(
        "prior_baseline",
        { name: "LDL-C", value: 168, unit: "mg/dL" },
        ls[2],
      )
      fact("prior_baseline_date", b, ls[2], { tok: b })
      fact(
        "prior_followup",
        { name: "LDL-C", value: 132, unit: "mg/dL" },
        ls[2],
      )
      fact("prior_followup_date", f, ls[2], { tok: f })
      break
    }
  }
}

function splitDates(text: string, toks: DateTok[]): Part[] {
  const parts: Part[] = []
  let rest = text
  for (const tok of toks) {
    const at = rest.indexOf(tok.text)
    if (at < 0) throw new Error(`Date ${tok.text} missing from ${text}`)
    if (at) parts.push(rest.slice(0, at))
    parts.push(tok)
    rest = rest.slice(at + tok.text.length)
  }
  if (rest) parts.push(rest)
  return parts
}

function priorLines(
  plan: Plan,
  doc: Doc,
  d: {
    start: string
    stop: string
    baseDate: string
    followDate: string
    style: Style
  },
  rng: Rng,
  hand: Record<string, HandImage>,
) {
  const P = PROFILES[plan.cls]
  const R = P.prior
  const t = doc.t
  const s = plan.scenario.prior
  const pinned = plan.pinned
  const add = doc.add.bind(doc)
  const D = (iso: string) => new DateTok(iso, d.style)
  const scen = s
  if (plan.page === "form" && scen === "blank") {
    const l = add("Prior therapies tried: ________")
    t.priorBlank = l
    doc.fact("blank_field", "prior therapy", l)
    return
  }
  if (scen === "blank") return
  const generic = scen === "wrong-class" ? R.wrongClass.drug : R.drug
  const dose =
    scen === "wrong-class"
      ? R.wrongClass.dose
      : scen === "low-intensity"
        ? R.lowIntensity!
        : R.dose
  let written =
    scen === "wrong-class"
      ? generic
      : plan.drugName === "brand" && !pinned && rng.next() < 0.5
        ? R.brand
        : generic
  let miss: Fact["misspelling"]
  if (plan.misspell === "prior-drug") {
    written = R.misspelled
    miss = { written: R.misspelled, intended: R.drug, pharmacist_accepts: true }
  }
  let lookalike: string | undefined
  let drugValue = generic
  if (scen === "lookalike") {
    written = R.lookalike!.written
    drugValue = R.lookalike!.drug
    lookalike = R.lookalike!.intended
    miss = {
      written,
      intended: R.lookalike!.intended,
      pharmacist_accepts: false,
    }
  }
  const doseText = pinned
    ? canonDose(dose)
    : plan.doseStyle === "sig" &&
        scen !== "wrong-class" &&
        scen !== "low-intensity"
      ? R.sig
      : writeDose(
          dose,
          plan.doseStyle === "sig" ? "route" : plan.doseStyle,
          rng,
        )
  if (scen === "handwritten-bare") {
    const h = hand["hw-notes-b"].transcribed_lines[3]
    const l = add(h, {
      image: "hw-notes-b",
      kind: "note",
      box: hand["hw-notes-b"].note_boxes![3],
    })
    t.prior = {
      drug: "metformin",
      dose: "1000 mg twice daily",
      amount: 1000,
      duration: 150,
      lines: [l],
    }
    doc.fact("prior_medication", "metformin", l, { handwritten: true })
    doc.fact("prior_dose", "1000 mg twice daily", l, { handwritten: true })
    doc.fact("prior_duration_days", 150, l, { handwritten: true })
    return
  }
  if (scen === "contraindication") {
    const l = add(
      `${cap(written)} not started: contraindicated due to ${R.contraindication}.`,
    )
    t.prior = {
      drug: drugValue,
      outcome: "contraindication",
      reason: R.contraindication,
      lines: [l],
    }
    doc.fact("prior_medication", drugValue, l, { misspelling: miss })
    doc.fact("prior_outcome", "contraindication", l)
    doc.fact("prior_reason", R.contraindication, l)
    return
  }
  if (scen === "undated") {
    const one = `Prior therapy: ${written} ${doseText}; dates and response not supplied.`
    const lines =
      one.length <= 80
        ? [add(one)]
        : [
            add(`Prior therapy: ${written} ${doseText}.`),
            add("Dates and response not supplied."),
          ]
    const l = lines[0]
    t.prior = {
      drug: drugValue,
      lookalike,
      dose: canonDose(dose),
      amount: dose.amount,
      lines,
    }
    doc.fact("prior_medication", drugValue, l, { misspelling: miss })
    doc.fact("prior_dose", canonDose(dose), l)
    return
  }
  const startTok = D(d.start),
    stopTok = D(d.stop)
  const lines: number[] = []
  let first: number
  if (plan.page === "form" && !pinned) {
    first = add(`Prior therapies tried: ${written} ${doseText}`)
    const dl = add(["Trial dates: ", startTok, " to ", stopTok])
    lines.push(first, dl)
    doc.fact("prior_start_date", startTok, dl, { tok: startTok })
    doc.fact("prior_stop_date", stopTok, dl, { tok: stopTok })
  } else {
    const forms: Part[][] = pinned
      ? [
          [
            `Prior therapy: ${written} ${doseText}; started `,
            startTok,
            "; stopped ",
            stopTok,
            ".",
          ],
        ]
      : [
          [
            `Prior therapy: ${written} ${doseText}; started `,
            startTok,
            "; stopped ",
            stopTok,
            ".",
          ],
          [
            `Prior: ${written} ${doseText} from `,
            startTok,
            " to ",
            stopTok,
            ".",
          ],
          [
            `Previous treatment: ${written} ${doseText}, `,
            startTok,
            " - ",
            stopTok,
            ".",
          ],
        ]
    let parts = rng.pick(forms)
    if (
      Array.from(
        parts.map((p) => (typeof p === "string" ? p : p.text)).join(""),
      ).length > 80
    ) {
      first = add(`Prior therapy: ${written} ${doseText}.`)
      const dl = add([
        "Trial dates: started ",
        startTok,
        "; stopped ",
        stopTok,
        ".",
      ])
      lines.push(first, dl)
      doc.fact("prior_start_date", startTok, dl, { tok: startTok })
      doc.fact("prior_stop_date", stopTok, dl, { tok: stopTok })
    } else {
      first = add(parts)
      lines.push(first)
      doc.fact("prior_start_date", startTok, first, { tok: startTok })
      doc.fact("prior_stop_date", stopTok, first, { tok: stopTok })
    }
    parts = []
  }
  doc.fact("prior_medication", drugValue, first, { misspelling: miss })
  doc.fact("prior_dose", canonDose(dose), first)
  t.prior = {
    drug: drugValue,
    lookalike,
    dose: canonDose(dose),
    amount: dose.amount,
    start: startTok,
    stop: stopTok,
    lines,
  }
  const outcomeLine = (text: string) => {
    const l = add(text)
    lines.push(l)
    return l
  }
  if (scen === "intolerance" || scen === "intolerance-no-reason") {
    if (plan.hand === "note-a3" || plan.hand === "note-b1") {
      const key = plan.hand === "note-a3" ? 2 : 0
      const sheet = plan.hand === "note-a3" ? "hw-notes-a" : "hw-notes-b"
      const l = add(hand[sheet].transcribed_lines[key], {
        image: sheet,
        kind: "note",
        box: hand[sheet].note_boxes![key],
      })
      lines.push(l)
      const reason = plan.hand === "note-a3" ? "ALT 3x ULN" : "myalgias, CK 900"
      t.prior.outcome = "intolerance"
      t.prior.reason = reason
      doc.fact("prior_outcome", "intolerance", l, { handwritten: true })
      doc.fact("prior_reason", reason, l, { handwritten: true })
      return
    }
    const l = outcomeLine(
      scen === "intolerance"
        ? `Stopped for ${R.intolerance}.`
        : "Stopped due to intolerance.",
    )
    t.prior.outcome = "intolerance"
    doc.fact("prior_outcome", "intolerance", l)
    if (scen === "intolerance") {
      t.prior.reason = R.intolerance
      doc.fact("prior_reason", R.intolerance, l)
    }
    return
  }
  if (scen === "bare" || scen === "wrong-class") {
    const l = outcomeLine(
      rng.pick([
        "Inadequate response documented.",
        "Outcome: inadequate response.",
        "No improvement documented.",
      ]),
    )
    t.prior.outcome = "inadequate response"
    doc.fact("prior_outcome", "inadequate response", l)
    return
  }
  // Objective response: values before and after the start date.
  const labName = PROFILES[plan.cls].lab.name
  const unit = PROFILES[plan.cls].lab.unit
  const fmt = (v: number) =>
    `${labName} ${v}${unit === "%" ? " %" : " " + unit}`
  const followValue = scen === "goal-met" ? R.atGoal : R.followup
  const bTok = D(d.baseDate),
    fTok = D(d.followDate)
  const drugShort = written
  const bl = add([
    `Baseline before ${drugShort}: ${fmt(R.baseline)} on `,
    bTok,
    ".",
  ])
  const fl = add([
    `On ${drugShort}: ${fmt(followValue)} on `,
    fTok,
    `; goal ${R.goalText} ${scen === "goal-met" ? "met" : "not met"}.`,
  ])
  lines.push(bl, fl)
  const baseline: Meas = {
    name: labName,
    value: R.baseline,
    unit,
    tok: bTok,
    lines: [bl],
    role: "baseline",
  }
  const followup: Meas = {
    name: labName,
    value: followValue,
    unit,
    tok: fTok,
    lines: [fl],
    role: "followup",
  }
  t.meas.push(baseline, followup)
  t.prior.baseline = baseline
  t.prior.followup = followup
  t.prior.outcome = "inadequate response"
  doc.fact("prior_baseline", { name: labName, value: R.baseline, unit }, bl)
  doc.fact("prior_baseline_date", bTok, bl, { tok: bTok })
  doc.fact("prior_followup", { name: labName, value: followValue, unit }, fl)
  doc.fact("prior_followup_date", fTok, fl, { tok: fTok })
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---------- gold rules ----------
interface Resolution {
  conv: Conv | null
  status: "none" | "forced" | "header" | "unresolved" | "conflict"
}
function resolve(doc: Doc): Resolution {
  const toks = doc.dates
  const amb = toks.filter((t) => t.ambiguous)
  if (!amb.length) return { conv: null, status: "none" }
  const forced = new Set(toks.map((t) => t.forced).filter(Boolean) as Conv[])
  if (forced.size === 1) return { conv: [...forced][0], status: "forced" }
  if (forced.size === 2) return { conv: null, status: "conflict" }
  const header = doc.t.header
  if (header) {
    const ok = (["mdy", "dmy"] as Conv[]).filter((c) =>
      amb.every((t) => ms(t.readings[c === "mdy" ? 0 : 1]) <= ms(header.iso)),
    )
    if (ok.length === 1) return { conv: ok[0], status: "header" }
  }
  return { conv: null, status: "unresolved" }
}
const dateValue = (t: DateTok, r: Resolution): DateValue =>
  !t.ambiguous
    ? t.iso
    : r.conv
      ? t.readings[r.conv === "mdy" ? 0 : 1]
      : { readings: t.readings }

interface Verdict {
  status: Status
  lines: number[]
  reason: string
}
function judge(cls: Cls, doc: Doc, r: Resolution, conv: Conv | null) {
  const P = PROFILES[cls]
  const t = doc.t
  const at = (tok?: DateTok) =>
    !tok
      ? undefined
      : !tok.ambiguous
        ? tok.iso
        : tok.readings[(r.conv ?? conv) === "mdy" ? 0 : 1]
  const out: Record<string, Verdict> = {}
  // adult
  out.adult = t.age
    ? t.age.value >= 18
      ? {
          status: "evidence_found",
          lines: [t.age.line],
          reason: `Age ${t.age.value} is documented.`,
        }
      : {
          status: "needs_review",
          lines: [t.age.line],
          reason: `Documented age ${t.age.value} is below the fictional 18-year rule.`,
        }
    : {
        status: "missing",
        lines: [],
        reason:
          t.ageBlank !== undefined
            ? "The age field is blank."
            : "No age is documented.",
      }
  // diagnosis
  const target = P.condition
  const ind = t.indication
  const histHas = t.history?.values.includes(target)
  if (ind && ind.value === target && ind.certainty === "confirmed") {
    const lines = [ind.line]
    if (
      t.assessment &&
      t.assessment.value === target &&
      t.assessment.certainty === "confirmed"
    )
      lines.push(t.assessment.line)
    out.diagnosis = {
      status: "evidence_found",
      lines,
      reason: `The request names ${target} as its reason.`,
    }
  } else if (
    ind &&
    ind.certainty === "unconfirmed" &&
    P.family.includes(ind.value)
  ) {
    out.diagnosis = {
      status: "needs_review",
      lines: [ind.line, ...(t.assessment ? [t.assessment.line] : [])],
      reason: `${cap(ind.value)} is stated as suspected or possible, not confirmed.`,
    }
  } else if (ind && P.severity.some((x) => x.value === ind.value)) {
    out.diagnosis = {
      status: "needs_review",
      lines: [ind.line, ...(t.assessment ? [t.assessment.line] : [])],
      reason: `The request names ${ind.value} without moderate-to-severe severity.`,
    }
  } else if (ind) {
    out.diagnosis = histHas
      ? {
          status: "needs_review",
          lines: [ind.line, t.history!.line],
          reason: `The request names ${ind.value}. ${cap(target)} appears only in the history.`,
        }
      : {
          status: "missing",
          lines: [],
          reason: `The request names ${ind.value}, not ${target}.`,
        }
  } else if (histHas) {
    out.diagnosis = {
      status: "needs_review",
      lines: [t.history!.line],
      reason: `${cap(target)} appears only in the past medical history. No document names it as the reason for this request.`,
    }
  } else {
    out.diagnosis = {
      status: "missing",
      lines: [],
      reason:
        t.indicationBlank !== undefined
          ? "The diagnosis field is blank."
          : "No diagnosis is documented as the reason for this request.",
    }
  }
  // lab
  const req = at(t.request?.tok)
  const cands = t.meas.filter((m) => m.name === P.lab.name)
  const meets = (v: number) => P.lab.min === null || v >= P.lab.min
  if (!cands.length) {
    out.lab = {
      status: "missing",
      lines: [],
      reason:
        t.labBlank !== undefined
          ? `The ${P.lab.name} field is blank.`
          : `No ${P.lab.name} result is documented.`,
    }
  } else {
    const dated = cands
      .map((m) => ({ m, date: at(m.tok) }))
      .filter((x) => x.date)
      .sort((a, b) => ms(b.date!) - ms(a.date!))
    const ok = dated.filter(
      (x) =>
        req &&
        between(x.date!, req) >= 0 &&
        between(x.date!, req) <= 180 &&
        meets(x.m.value),
    )
    const reqLines = t.request ? [t.request.line] : []
    if (ok.length) {
      const best = ok[0]
      if (t.conflict)
        out.lab = {
          status: "needs_review",
          lines: [...best.m.lines, ...reqLines, t.conflict.line],
          reason:
            "Two different request dates are documented. The 180-day window cannot be confirmed.",
        }
      else
        out.lab = {
          status: "evidence_found",
          lines: [...best.m.lines, ...reqLines],
          reason: `${P.lab.name} ${best.m.value} ${best.m.unit} is ${between(best.date!, req!)} days before the request${P.lab.min === null ? "" : ` and meets the ${P.lab.min} ${P.lab.unit} threshold`}.`,
        }
    } else {
      const latest = dated[0]
      const days = latest && req ? between(latest.date!, req) : null
      const why =
        latest && !meets(latest.m.value)
          ? `${P.lab.name} ${latest.m.value} ${latest.m.unit} is below the ${P.lab.min} ${P.lab.unit} threshold.`
          : days !== null && days < 0
            ? `The ${P.lab.name} date falls after the request date.`
            : `The most recent ${P.lab.name} is ${days} days before the request, outside the 180-day window.`
      out.lab = {
        status: "needs_review",
        lines: [...(latest ? latest.m.lines : []), ...reqLines],
        reason: why,
      }
    }
  }
  // prior
  const pr = t.prior
  const R = P.prior
  if (!pr) {
    out.prior = {
      status: "missing",
      lines: [],
      reason:
        t.priorBlank !== undefined
          ? "The prior therapy field is blank."
          : `No ${R.drug} trial, intolerance or contraindication is documented.`,
    }
  } else if (pr.lookalike) {
    out.prior = {
      status: "needs_review",
      lines: pr.lines,
      reason: `The prior drug is written as a look-alike name for ${pr.lookalike}. A pharmacist would clarify it before accepting it.`,
    }
  } else if (pr.drug !== R.drug) {
    out.prior = {
      status: "missing",
      lines: [],
      reason: `A ${pr.drug} trial is documented. No ${R.drug} trial, intolerance or contraindication is documented.`,
    }
  } else if (
    pr.outcome === "contraindication" ||
    pr.outcome === "intolerance"
  ) {
    out.prior = pr.reason
      ? {
          status: "evidence_found",
          lines: pr.lines,
          reason: `${cap(R.drug)} ${pr.outcome} is documented with its reason: ${pr.reason}.`,
        }
      : {
          status: "needs_review",
          lines: pr.lines,
          reason: `${cap(R.drug)} intolerance is stated without a reason.`,
        }
  } else {
    const startIso = at(pr.start),
      stopIso = at(pr.stop)
    const dur = startIso && stopIso ? between(startIso, stopIso) : pr.duration
    const base = pr.baseline,
      follow = pr.followup
    let fail: string | null = null
    if (dur === undefined)
      fail = `The ${R.drug} trial has no documented dates or duration.`
    else if (!pr.dose) fail = `The ${R.drug} dose is not stated.`
    else if (cls === "pcsk9" && (pr.amount ?? 0) < 40)
      fail = `Atorvastatin ${pr.amount} mg daily is not the 40 or 80 mg dose the fictional rule requires.`
    else if (dur < 90)
      fail = `The ${R.drug} trial lasted ${dur} days, under the 90-day minimum.`
    else if (!base || !follow)
      fail = `A ${dur}-day ${R.drug} trial is documented, but no ${P.lab.name} before and after the trial shows the goal was not met.`
    else {
      const b = at(base.tok),
        f = at(follow.tok)
      if (startIso && b && between(b, startIso) < 0)
        fail = `The baseline ${P.lab.name} is dated after the trial started.`
      else if (startIso && f && between(startIso, f) < 90)
        fail = `The follow-up ${P.lab.name} is less than 90 days after the start.`
      else if (R.goalMet(follow.value))
        fail = `The follow-up ${P.lab.name} ${follow.value} meets the goal, so the trial does not show failure.`
    }
    out.prior = fail
      ? { status: "needs_review", lines: pr.lines, reason: fail }
      : {
          status: "evidence_found",
          lines: pr.lines,
          reason: `A ${dur}-day ${R.drug} trial is documented with ${P.lab.name} ${base!.value} before and ${follow!.value} after, still not at goal.`,
        }
  }
  // dose
  const rq = t.requested
  if (!rq || !rq.dose) {
    out.dose = {
      status: "missing",
      lines: [],
      reason:
        t.doseBlank !== undefined
          ? "The dose field is blank."
          : `No dose is documented for the requested ${P.drug}.`,
    }
  } else if (rq.dose !== canonDose(P.dose)) {
    out.dose = {
      status: "needs_review",
      lines: rq.lines,
      reason: `The request is ${rq.dose}. The fictional rule allows ${canonDose(P.dose)}.`,
    }
  } else if (t.medList && t.medList.dose !== rq.dose) {
    out.dose = {
      status: "needs_review",
      lines: [...rq.lines, t.medList.line],
      reason: `The request says ${rq.dose} but the medication list says ${t.medList.dose}.`,
    }
  } else {
    out.dose = {
      status: "evidence_found",
      lines: rq.lines,
      reason: `The requested ${P.drug} dose ${rq.dose} matches the fictional rule.`,
    }
  }
  return out
}

function goldCriteria(cls: Cls, doc: Doc, r: Resolution) {
  if (r.conv || r.status === "none") return judge(cls, doc, r, r.conv)
  const a = judge(cls, doc, r, "mdy"),
    b = judge(cls, doc, r, "dmy")
  const out: Record<string, Verdict> = {}
  for (const key of Object.keys(a)) {
    if (a[key].status === b[key].status) out[key] = a[key]
    else
      out[key] = {
        status: "needs_review",
        lines: [...new Set([...a[key].lines, ...b[key].lines])],
        reason:
          "Numeric dates on this page can be read month first or day first, and the two readings give different results. Nothing on the page settles the order.",
      }
  }
  return out
}

// ---------- expected status per scenario, as a construction check ----------
const EXPECT: Record<string, Record<string, Status>> = {
  adult: {
    supported: "evidence_found",
    minor: "needs_review",
    absent: "missing",
    blank: "missing",
  },
  diagnosis: {
    supported: "evidence_found",
    misspelled: "evidence_found",
    handwritten: "evidence_found",
    "history-only": "needs_review",
    unconfirmed: "needs_review",
    severity: "needs_review",
    "other-indication": "missing",
    blank: "missing",
    absent: "missing",
  },
  lab: {
    supported: "evidence_found",
    handwritten: "evidence_found",
    stale: "needs_review",
    below: "needs_review",
    "conflict-date": "needs_review",
    "missing-page": "missing",
    blank: "missing",
  },
  prior: {
    objective: "evidence_found",
    intolerance: "evidence_found",
    contraindication: "evidence_found",
    bare: "needs_review",
    short: "needs_review",
    undated: "needs_review",
    "goal-met": "needs_review",
    "intolerance-no-reason": "needs_review",
    lookalike: "needs_review",
    "low-intensity": "needs_review",
    "wrong-class": "missing",
    "missing-page": "missing",
    blank: "missing",
    "handwritten-bare": "needs_review",
  },
  dose: {
    supported: "evidence_found",
    handwritten: "evidence_found",
    conflict: "needs_review",
    "wrong-frequency": "needs_review",
    blank: "missing",
  },
}

// ---------- outputs ----------
const OFFSET_BASIS =
  "Unicode code points, zero-based, end-exclusive, in body after <!-- SOURCE START --> followed by newline. Front matter and delimiter excluded."

export async function generate(root = ".") {
  const hw = JSON.parse(
    await readFile(`${root}/eval/handwriting/handwriting.json`, "utf8"),
  )
  const hand: Record<string, HandImage> = Object.fromEntries(
    hw.images.map((i: HandImage) => [i.id, i]),
  )
  const review = JSON.parse(
    await readFile(`${root}/eval/reviews/2026-11-02-kevin.json`, "utf8"),
  )
  for (const dir of ["packets", "gold"]) {
    await mkdir(`${root}/eval/${dir}`, { recursive: true })
    for (const f of await readdir(`${root}/eval/${dir}`))
      await rm(`${root}/eval/${dir}/${f}`)
  }
  const manifest = []
  const counts: Record<string, number> = {}
  for (let n = 1; n <= 63; n++) {
    const plan = planFor(n)
    const { doc, name } = build(plan, hand)
    const r = resolve(doc)
    if (plan.ambiguity === "unresolved" && r.status !== "unresolved")
      throw new Error(`${plan.id} should stay unresolved, got ${r.status}`)
    if (plan.ambiguity === "header" && r.status !== "header")
      throw new Error(`${plan.id} should resolve by header, got ${r.status}`)
    for (const tok of doc.dates)
      if (
        tok.ambiguous &&
        r.conv &&
        tok.readings[r.conv === "mdy" ? 0 : 1] !== tok.iso
      )
        throw new Error(`${plan.id} resolves ${tok.text} to the wrong reading`)
    const verdicts = goldCriteria(plan.cls, doc, r)
    const scen = { ...plan.scenario }
    for (const [cid, sc] of Object.entries(scen)) {
      const expected = EXPECT[cid][sc]
      const actual = verdicts[cid].status
      if (
        plan.ambiguity === "unresolved" &&
        (cid === "lab" || cid === "prior")
      ) {
        if (actual !== "needs_review")
          throw new Error(
            `${plan.id} ${cid}: ambiguous dates should need review`,
          )
        continue
      }
      if (expected && expected !== actual)
        throw new Error(
          `${plan.id} ${cid} scenario ${sc} expected ${expected}, got ${actual}: ${verdicts[cid].reason}`,
        )
    }
    // Body and offsets
    const body = doc.lines.map((l) => l.text).join("\n") + "\n"
    const starts: number[] = []
    let at = 0
    for (const l of doc.lines) {
      starts.push(at)
      at += Array.from(l.text).length + 1
    }
    const span = (i: number) => ({
      start: starts[i],
      end: starts[i] + Array.from(doc.lines[i].text).length,
      text: doc.lines[i].text,
    })
    const entities = doc.facts.map((f) => ({
      type: f.type,
      value: f.tok ? dateValue(f.tok, r) : f.value,
      source_span: span(f.line),
      ...(f.tok
        ? {
            date: {
              written: f.tok.text,
              format:
                f.tok.style === "us-hand" ? "handwritten-m/d/yy" : f.tok.style,
              ambiguous: f.tok.ambiguous,
              ...(f.tok.ambiguous
                ? { readings: f.tok.readings, resolved_by: r.status }
                : {}),
            },
          }
        : {}),
      ...(f.misspelling ? { misspelling: f.misspelling } : {}),
      ...(f.handwritten ? { handwritten: true } : {}),
      reviewed: false,
    }))
    const criterion_evidence = [
      "adult",
      "diagnosis",
      "lab",
      "prior",
      "dose",
    ].map((cid) => {
      const v = verdicts[cid]
      const uniq = [...new Set(v.lines)]
      return {
        criterion_id: cid,
        status: v.status,
        evidence_spans: v.status === "missing" ? [] : uniq.map(span),
        reason: v.reason,
        scenario:
          plan.ambiguity === "unresolved" && (cid === "lab" || cid === "prior")
            ? "ambiguous-date"
            : scen[cid as keyof typeof scen],
        reviewed: false,
      }
    })
    // Carry Kevin's labels over only where the rule and quoted evidence are unchanged.
    const carried = carryOver(plan, criterion_evidence, review)
    const factsReview = review.packets[plan.id]?.facts
    if (factsReview?.verdict === "agree")
      for (const e of entities) {
        const seen = factsReview.entities.some(
          (o: { type: string; value: unknown; quote: string }) =>
            o.type === e.type &&
            JSON.stringify(o.value) === JSON.stringify(e.value) &&
            o.quote === e.source_span.text,
        )
        if (seen)
          Object.assign(e, {
            reviewed: true,
            review: {
              reviewer: review.reviewer,
              date: review.date,
              verdict: "agree",
              carried_over: true,
              basis: "Type, value and quoted line unchanged since this review.",
            },
          })
      }
    const tags = tagsFor(plan, doc, r, entities)
    const gold = {
      schema_version: "2.0",
      packet_id: plan.id,
      fictional: true,
      reviewed: false,
      criteria_id: plan.cls,
      source_file: `eval/packets/${plan.id}.md`,
      group: plan.group,
      tags,
      date_reading: { status: r.status, order: r.conv },
      offset_basis: OFFSET_BASIS,
      entities,
      criterion_evidence: carried,
      normalization: {
        status: "not_attempted",
        reason:
          "Gold values are canonical strings. No guessed RxNorm or ICD-10 codes.",
        reviewed: false,
      },
    }
    const render = renderPlan(plan, doc)
    const front = [
      "---",
      `packet_id: ${plan.id}`,
      "fictional: true",
      `criteria_id: ${plan.cls}`,
      `group: ${plan.group}`,
      `page_style: ${plan.page}`,
      `date_style: ${plan.dateStyle}`,
      "names: all_fictional",
      "identifiers: none",
      "---",
      "",
      "<!-- SOURCE START -->",
      "",
    ].join("\n")
    await writeFile(`${root}/eval/packets/${plan.id}.md`, front + body)
    await writeFile(
      `${root}/eval/gold/${plan.id}.json`,
      JSON.stringify(gold, null, 2) + "\n",
    )
    manifest.push({
      packet_id: plan.id,
      criteria_id: plan.cls,
      group: plan.group,
      tags,
      render,
    })
    for (const c of carried) counts[c.status] = (counts[c.status] ?? 0) + 1
    void name
  }
  await writeFile(
    `${root}/eval/manifest.json`,
    JSON.stringify(
      {
        fictional: true,
        reviewed: false,
        packet_count: manifest.length,
        generator: "scripts/generate.ts",
        groups: GROUPS.map(({ id, label, render }) => ({ id, label, render })),
        packets: manifest,
      },
      null,
      2,
    ) + "\n",
  )
  for (const cls of CLASSES) {
    const P = PROFILES[cls]
    await writeFile(
      `${root}/eval/criteria/${cls}.json`,
      JSON.stringify(
        {
          schema_version: "2.0",
          id: cls,
          title: P.title,
          fictional: true,
          reviewed: false,
          notice:
            "Fictional exercise criteria. Not a payer policy, prescribing guide, or clinical recommendation. Draft for pharmacist review. Modeled on common documentation patterns, without reproducing a real policy.",
          effective_date: "2026-01-01",
          request_date_rule:
            "Use the provider letter or form request date. Conflicting source dates require review. A numeric date that can be read two ways is settled only by a day above 12 elsewhere on the page or by a later fax-style received date. Otherwise it requires review.",
          logic:
            "All five criteria require evidence. Missing evidence is not a denial. Contradiction, unclear duration, unconfirmed diagnosis, unreadable evidence and ambiguous dates require review.",
          criteria: Object.entries(RULES[cls]).map(([id, text]) => ({
            id,
            text,
            reviewed: false,
          })),
        },
        null,
        2,
      ) + "\n",
    )
  }
  return counts
}

function tagsFor(
  plan: Plan,
  doc: Doc,
  r: Resolution,
  entities: { misspelling?: { pharmacist_accepts: boolean } }[],
) {
  const tags = [
    `page:${plan.page}`,
    `date:${plan.dateStyle}`,
    `date-reading:${r.status}`,
  ]
  if (plan.drugName === "brand" || plan.drugName === "both")
    tags.push("drug-name:brand")
  else tags.push("drug-name:generic")
  tags.push(`dose-format:${plan.pinned ? "plain" : plan.doseStyle}`)
  if (doc.facts.some((f) => f.type === "blank_field")) tags.push("blank-field")
  if (entities.some((e) => e.misspelling?.pharmacist_accepts))
    tags.push("misspelling")
  if (entities.some((e) => e.misspelling && !e.misspelling.pharmacist_accepts))
    tags.push("look-alike-name")
  if (doc.lines.some((l) => l.hand)) tags.push("ai-drawn-handwriting")
  if (plan.header) tags.push("fax-style-header")
  return tags
}

// Placement instructions for the renderer, by source line index.
function renderPlan(plan: Plan, doc: Doc) {
  const rng = rngFor(`${plan.id}:render`)
  const effects: string[] = []
  let rotate = 0
  switch (plan.group) {
    case "clean-render":
      effects.push("speckle-light")
      break
    case "rotation-7deg":
      effects.push("speckle-heavy", "streaks")
      rotate = 7
      break
    case "orientation":
      effects.push("speckle-heavy", "streaks")
      rotate = [180, 180, 180, 180, 90, 90, 270, 270][plan.n - 48]
      break
    case "choppy-lines":
      effects.push("speckle-heavy", "streaks", "choppy")
      break
    case "smudge":
      effects.push("speckle-light", "smudge")
      break
    case "low-contrast":
      effects.push("speckle-light", "low-contrast")
      break
    default:
      effects.push("speckle-heavy", "streaks")
  }
  const handwriting = doc.lines
    .map((l, i) =>
      l.hand && l.hand.box.length
        ? {
            line: i,
            image: l.hand.image,
            kind: l.hand.kind,
            box: l.hand.box,
            prefix: l.hand.prefix,
            lines:
              l.hand.kind === "block"
                ? doc.lines.filter(
                    (x) =>
                      x.hand?.image === l.hand!.image &&
                      x.hand.kind === "block",
                  ).length
                : 1,
          }
        : null,
    )
    .filter(Boolean)
  const annotations: {
    kind: string
    line: number
    from?: number
    to?: number
  }[] = []
  if (plan.group === "mixed-annotations") {
    const targets = doc.lines
      .map((l, i) => ({ l, i }))
      .filter(
        ({ l }) =>
          !l.hand &&
          /\d/.test(l.text) &&
          !/^(Patient|Prescriber|From)/.test(l.text),
      )
    const circle = targets[rng.int(0, targets.length - 1)]
    const m = circle.l.text.search(/\d/)
    annotations.push({
      kind: "circle",
      line: circle.i,
      from: Math.max(0, m - 1),
      to: Math.min(circle.l.text.length, m + 9),
    })
    const arrowTo = targets[rng.int(0, targets.length - 1)]
    annotations.push({ kind: "arrow", line: arrowTo.i })
    const underline = targets[rng.int(0, targets.length - 1)]
    annotations.push({
      kind: "underline",
      line: underline.i,
      from: 0,
      to: underline.l.text.length,
    })
  }
  // Fonts cycle within each group, starting at a different font per group.
  const group = GROUPS.findIndex((g) => g.id === plan.group)
  const font = (["roboto-mono", "liberation-sans", "dejavu-sans"] as const)[
    (plan.n - GROUPS[group].from + group) % 3
  ]
  return { font, effects, rotate, handwriting, annotations }
}

// ---------- Kevin's 2 November labels ----------
interface ReviewRecord {
  reviewer: string
  date: string
  packets: Record<
    string,
    {
      criteria: Record<
        string,
        { status: Status; note?: string; rule: string; quotes: string[] }
      >
      facts?: {
        verdict?: string
        entities: { type: string; value: unknown; quote: string }[]
      }
    }
  >
}
function carryOver(
  plan: Plan,
  criteria: {
    criterion_id: string
    status: Status
    evidence_spans: { text: string }[]
    reason: string
    scenario: string
    reviewed: boolean
  }[],
  review: ReviewRecord,
) {
  const mine = review.packets[plan.id]
  if (!mine) return criteria
  return criteria.map((c) => {
    const k = mine.criteria[c.criterion_id]
    if (!k) return c
    const ruleSame = RULES[plan.cls][c.criterion_id] === k.rule
    const quotes = c.evidence_spans.map((s) => s.text).sort()
    const quotesSame =
      JSON.stringify(quotes) === JSON.stringify([...k.quotes].sort())
    const prior = {
      reviewer: review.reviewer,
      date: review.date,
      status: k.status,
      ...(k.note ? { note: k.note } : {}),
    }
    if (ruleSame && quotesSame && k.status === c.status)
      return {
        ...c,
        reviewed: true,
        review: {
          ...prior,
          carried_over: true,
          basis: "Rule text and quoted evidence unchanged since this review.",
        },
      }
    const why = [
      !ruleSame && "the rule text changed",
      !quotesSame && "the packet text for this criterion changed",
      k.status !== c.status &&
        ruleSame &&
        quotesSame &&
        "the draft status differs from the review",
    ]
      .filter(Boolean)
      .join(" and ")
    return {
      ...c,
      review: {
        ...prior,
        carried_over: false,
        needs_rereview: true,
        basis: `Not carried over because ${why}.`,
      },
    }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const counts = await generate()
  console.log(JSON.stringify(counts))
}
