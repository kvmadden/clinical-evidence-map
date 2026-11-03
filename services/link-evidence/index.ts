import type {
  Blocker,
  Criterion,
  CriterionId,
  Entity,
  LinkInput,
  LinkOutput,
  Mention,
  ReaderCoverage,
  Span,
  Status,
  Word,
} from "../contracts.js"
import { DRUGS, STATINS } from "../extract/lexicon.js"

// Fictional rules. Kept separate from the generator's gold rules on purpose:
// the gold is written from known facts, this reads extracted entities.
interface Rule {
  // What each criterion's blockers are about, as the reader scopes them.
  scope: Record<"diagnosis" | "lab" | "prior" | "dose", string>
  diagnosis: string
  family: string
  // Conditions of the same family that do not meet the rule, and why.
  nearMiss: Record<string, string>
  measurement: string
  unit: string
  min: number | null
  // The goal, as a threshold: the follow-up still misses it at or above the
  // value when inclusive, above it when not.
  goal: { value: number; inclusive: boolean }
  // Drugs whose trial counts, with the amounts and frequency that qualify.
  trial: Record<string, { amounts?: number[]; frequency?: string }>
  // Drugs whose documented intolerance or contraindication counts.
  intolerance: string[]
  priorLabel: string
  medication: string
  dose: string
}
const rules: Record<string, Rule> = {
  "glp1-t2d": {
    scope: {
      diagnosis: "t2dm",
      lab: "A1c",
      prior: "metformin",
      dose: "semaglutide",
    },
    diagnosis: "type 2 diabetes mellitus",
    family: "t2dm",
    nearMiss: {
      "diabetes, type not stated":
        "The request names diabetes without stating the type.",
    },
    measurement: "A1c",
    unit: "%",
    min: null,
    goal: { value: 7, inclusive: true },
    trial: { metformin: {} },
    intolerance: ["metformin"],
    priorLabel: "metformin",
    medication: "semaglutide",
    dose: "0.5 mg weekly",
  },
  "biologic-psoriasis": {
    scope: {
      diagnosis: "psoriasis",
      lab: "BSA",
      prior: "methotrexate",
      dose: "adalimumab",
    },
    diagnosis: "moderate-to-severe plaque psoriasis",
    family: "psoriasis",
    nearMiss: {
      "mild plaque psoriasis":
        "The request names mild plaque psoriasis, not moderate-to-severe.",
      "plaque psoriasis":
        "The request names plaque psoriasis without moderate-to-severe severity.",
      psoriasis:
        "The request names psoriasis without moderate-to-severe plaque severity.",
    },
    measurement: "BSA",
    unit: "%",
    min: 10,
    goal: { value: 3, inclusive: false },
    trial: { methotrexate: {} },
    intolerance: ["methotrexate"],
    priorLabel: "methotrexate",
    medication: "adalimumab",
    dose: "40 mg every 2 weeks",
  },
  // Kevin's ruling of 2 Nov 2026: a high-intensity statin counts, which is
  // atorvastatin 40 or 80 mg or rosuvastatin 20 or 40 mg daily. A documented
  // intolerance or contraindication to any statin counts.
  pcsk9: {
    scope: {
      diagnosis: "ascvd",
      lab: "LDL-C",
      prior: "statin",
      dose: "evolocumab",
    },
    diagnosis: "atherosclerotic cardiovascular disease",
    family: "ascvd",
    nearMiss: {},
    measurement: "LDL-C",
    unit: "mg/dL",
    min: 70,
    goal: { value: 70, inclusive: true },
    trial: {
      atorvastatin: { amounts: [40, 80], frequency: "daily" },
      rosuvastatin: { amounts: [20, 40], frequency: "daily" },
    },
    intolerance: STATINS,
    priorLabel: "high-intensity statin",
    medication: "evolocumab",
    dose: "140 mg every 2 weeks",
  },
}
const DAY = 86400000
const days = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const show = (n: number) => String(Math.round(n * 1000) / 1000)
const quoteOf = (e: Entity) => `"${e.source_span.text.trim()}"`
const MARKETED = new Map(DRUGS.map((d) => [d.generic, d.doses ?? []]))

interface Verdict {
  status: Status
  evidence: Entity[]
  reason: string
  // Entities whose words the decision rests on, for the OCR gate.
  decision?: Entity[]
  // Lines cited from mentions the reader understood but did not use.
  spans?: Span[]
  // What kept the answer from being found or not documented.
  blockedBy?: string[]
}
const verdict = (
  status: Status,
  evidence: Entity[],
  reason: string,
  decision?: Entity[],
): Verdict => ({ status, evidence, reason, ...(decision ? { decision } : {}) })

// A value written as a bound: "<70" is an upper bound, ">= 70" a lower one.
type Bound = { kind: "upper" | "lower"; strict: boolean } | null
const boundOf = (e: Entity): Bound => {
  const c = String(e.attrs?.comparator ?? "")
  if (/[<≤]/.test(c)) return { kind: "upper", strict: c === "<" }
  if (/[>≥]/.test(c)) return { kind: "lower", strict: c === ">" }
  return null
}
// Whether every value a bound allows is at or above a threshold (true),
// whether none is (false), or neither (null): a bound cannot settle it.
function atLeast(
  v: number,
  bound: Bound,
  threshold: number,
  inclusive: boolean,
) {
  const passes = (x: number) => (inclusive ? x >= threshold : x > threshold)
  if (!bound) return passes(v)
  if (bound.kind === "lower")
    return passes(v) || (bound.strict && v >= threshold) ? true : null
  // An upper bound: every allowed value is at most v, or below it when strict.
  const highest = bound.strict ? v - 1e-9 : v
  return passes(highest) ? null : false
}
const UNREADABLE_DATE = /\[date\](?!-)/

type Reading = 0 | 1
interface Dates {
  date: (e?: Entity) => string | undefined
  relatedDate: (e?: Entity) => string | undefined
  withDate: (e: Entity) => Entity[]
}

function judge(
  rule: Rule,
  entities: Entity[],
  reading: Reading,
  mentions: Mention[],
): Record<CriterionId, Verdict> {
  const all = (type: string) => entities.filter((e) => e.type === type)
  const get = (type: string) => all(type)[0]
  const byId = new Map(entities.map((e) => [e.id, e]))
  // A date value is a shifted ISO date, or two readings when the order is unknown.
  const date = (e?: Entity) =>
    !e
      ? undefined
      : typeof e.value === "string"
        ? e.value
        : typeof e.value === "object" && e.value && "readings" in e.value
          ? e.value.readings[reading]
          : undefined
  const relatedOf = (e?: Entity) =>
    e?.related?.map((id) => byId.get(id)).find(Boolean)
  const relatedDate = (e?: Entity) => date(relatedOf(e))
  const withDate = (e: Entity) => {
    const d = relatedOf(e)
    return d ? [e, d] : [e]
  }
  const blank = (field: string) =>
    all("blank_field").find((e) => e.value === field)
  const out = {} as Record<CriterionId, Verdict>

  const request = get("request_date")
  const conflicts = all("conflicting_request_date")
  const req = date(request)

  // ---------- adult ----------
  const ages = all("age")
  const corrected = ages.filter((a) => a.attrs?.corrected)
  const current = corrected.length ? corrected : ages
  const distinct = [...new Set(current.map((a) => String(a.value)))]
  const familyAges = mentions.filter(
    (m) => m.criterion === "adult" && m.kind === "family",
  )
  if (!ages.length)
    out.adult = familyAges.length
      ? {
          ...verdict(
            "needs_review",
            [],
            "The only age on the page belongs to a family member, not the patient.",
          ),
          spans: familyAges.flatMap((m) => (m.span ? [m.span] : [])),
          blockedBy: ["A family member's age is on the page."],
        }
      : verdict(
          "missing",
          [],
          blank("age") ? "The age field is blank." : "No age is documented.",
        )
  else if (distinct.length > 1)
    out.adult = verdict(
      "needs_review",
      current,
      `Two different ages are documented: ${current.map(quoteOf).join(" and ")}.`,
    )
  else {
    const age = current[0]
    if (age.value === "over 89")
      out.adult = verdict(
        "evidence_found",
        [age],
        "The age is over 89 and was removed by the privacy step, so the patient is an adult.",
        [age],
      )
    else if (age.attrs?.unit)
      out.adult = verdict(
        "needs_review",
        [age],
        `The age is written in ${age.attrs.unit}. Check the page.`,
      )
    else if (Number(age.value) < 18)
      out.adult = verdict(
        "needs_review",
        [age],
        `Documented age ${age.value} is below the fictional 18-year rule.`,
      )
    else if (age.attrs?.approximate)
      out.adult = verdict(
        "needs_review",
        [age],
        `The age is given only as approximately ${age.value}. Check the page.`,
      )
    else
      out.adult = verdict(
        "evidence_found",
        [age],
        `Age ${age.value} is documented.`,
        [age],
      )
  }

  // ---------- diagnosis ----------
  type Cond = { condition: string; certainty: string }
  const condition = (e: Entity): Cond =>
    typeof e.value === "string"
      ? { condition: e.value, certainty: "confirmed" }
      : (e.value as Cond)
  const inds = all("indication")
  const target = inds.filter((e) => condition(e).condition === rule.diagnosis)
  const targetConfirmed = target.filter(
    (e) => condition(e).certainty === "confirmed",
  )
  const familyInds = inds.filter(
    (e) =>
      e.attrs?.family === rule.family &&
      condition(e).condition !== rule.diagnosis,
  )
  const assessment = all("assessment").filter(
    (e) => condition(e).condition === rule.diagnosis,
  )
  const history = all("history_condition").filter(
    (e) => condition(e).condition === rule.diagnosis,
  )
  const untied = mentions.filter(
    (m) =>
      m.criterion === "diagnosis" &&
      m.value === rule.diagnosis &&
      ["asserted-untied", "uncertain"].includes(m.kind),
  )
  // In the request's own fields: mentions a person must read (a possibility,
  // a box whose mark could not be read, a negation of unclear reach) and
  // mentions that say no (negated, unchecked, a relative's condition).
  const requestMentions = (kinds: string[]) =>
    mentions.filter(
      (m) =>
        m.criterion === "diagnosis" &&
        m.scope === rule.family &&
        kinds.includes(m.kind),
    )
  const unsureRequest = requestMentions([
    "hypothetical-request",
    "unclear-request",
    "scope-unclear-request",
  ])
  const noRequest = requestMentions([
    "negated-request",
    "unchecked-request",
    "family-request",
  ])
  const HOW: Record<string, string> = {
    "hypothetical-request": "only as a possibility",
    "unclear-request": "beside a box whose mark could not be read",
    "scope-unclear-request": "in a list where a negation may cover it",
    "negated-request": "only to rule it out",
    "unchecked-request": "only as an option that is not checked",
    "family-request": "only for a family member",
  }
  const mentionVerdict = (ms: Mention[]): Verdict => ({
    ...verdict(
      "needs_review",
      [],
      `The request mentions ${rule.diagnosis} ${HOW[ms[0].kind]}. Check the page.`,
    ),
    spans: ms.flatMap((m) => (m.span ? [m.span] : [])),
    blockedBy: ms.map(
      (m) => `The request mentions ${rule.diagnosis} ${HOW[m.kind]}.`,
    ),
  })
  const elsewhere = [...assessment, ...history]
  const retraction = inds.find(
    (e) =>
      e.attrs?.corrected &&
      e.attrs?.family === rule.family &&
      !targetConfirmed.some((t) => t.source_span.start === e.source_span.start),
  )
  if (targetConfirmed.length && retraction)
    out.diagnosis = verdict(
      "needs_review",
      [targetConfirmed[0], retraction],
      `The request names ${rule.diagnosis}, but another entry says the diagnosis entry is incorrect: ${quoteOf(retraction)}.`,
    )
  else if (targetConfirmed.length) {
    const ind = targetConfirmed[0]
    out.diagnosis = ind.attrs?.noLongerCurrent
      ? verdict(
          "needs_review",
          [ind],
          `The request names ${rule.diagnosis}, but the same line says it is resolved or in remission.`,
        )
      : ind.attrs?.historical
        ? verdict(
            "needs_review",
            [ind],
            `The request names ${rule.diagnosis} only as history. Check that it is the current reason for this request.`,
          )
        : verdict(
            "evidence_found",
            [
              ind,
              ...assessment
                .filter((e) => condition(e).certainty === "confirmed")
                .slice(0, 1),
            ],
            `The request names ${rule.diagnosis} as its reason.`,
            [ind],
          )
  } else if (target.length)
    out.diagnosis = verdict(
      "needs_review",
      [target[0], ...elsewhere.slice(0, 1)],
      `${cap(rule.diagnosis)} is stated as suspected or possible, not confirmed.`,
    )
  else if (unsureRequest.length) out.diagnosis = mentionVerdict(unsureRequest)
  else if (familyInds.length) {
    const ind = familyInds[0]
    const c = condition(ind)
    out.diagnosis = verdict(
      "needs_review",
      [ind, ...elsewhere.slice(0, 1)],
      c.certainty === "unconfirmed"
        ? `${cap(c.condition)} is stated as suspected or possible, not confirmed.`
        : (rule.nearMiss[c.condition] ??
            `The request names ${c.condition}, which does not meet the ${rule.diagnosis} rule.`),
    )
  } else if (inds.length) {
    const listed = [...new Set(inds.map((e) => condition(e).condition))].join(
      " and ",
    )
    out.diagnosis = elsewhere.length
      ? verdict(
          "needs_review",
          [inds[0], elsewhere[0]],
          `The request names ${listed}. ${cap(rule.diagnosis)} appears elsewhere in the record, not as the reason for this request.`,
        )
      : verdict(
          "missing",
          [],
          `The request names ${listed}, not ${rule.diagnosis}.`,
        )
  } else if (elsewhere.length || untied.length)
    out.diagnosis = verdict(
      "needs_review",
      elsewhere.slice(0, 1),
      `${cap(rule.diagnosis)} appears in the record, but no document names it as the reason for this request.`,
    )
  else if (noRequest.length) out.diagnosis = mentionVerdict(noRequest)
  else
    out.diagnosis = verdict(
      "missing",
      [],
      blank("diagnosis")
        ? "The diagnosis field is blank."
        : "No diagnosis is documented as the reason for this request.",
    )

  // ---------- lab ----------
  const values = [
    ...all("measurement"),
    ...all("prior_baseline"),
    ...all("prior_followup"),
  ].filter((e) => (e.value as { name: string }).name === rule.measurement)
  const num = (e: Entity) => (e.value as { value: number }).value
  // True when the value meets the threshold, false when it is below it, and
  // null when it is written only as a bound that cannot settle it.
  const meetsOf = (e: Entity): boolean | null =>
    rule.min === null ? true : atLeast(num(e), boundOf(e), rule.min, true)
  const meets = (e: Entity) => meetsOf(e) === true
  // Days from a value's date to the request date. A month-only date gives
  // the range from its last to its first possible day.
  const gaps = (e: Entity): [number, number] | null => {
    const d = relatedDate(e)
    if (!d || !req) return null
    const g = days(d, req)
    return relatedOf(e)?.attrs?.precision === "month" ? [g - 30, g] : [g, g]
  }
  const inWindow = (g: [number, number]) => g[0] >= 0 && g[1] <= 180
  const maybeInWindow = (g: [number, number]) => g[1] >= 0 && g[0] <= 180
  const unitNote = (e: Entity) =>
    e.attrs?.converted ? ` (written as ${e.attrs.converted})` : ""
  const familyLabs = mentions.filter(
    (m) =>
      m.criterion === "lab" &&
      m.kind === "family" &&
      m.scope === rule.measurement,
  )
  if (!values.length)
    out.lab = familyLabs.length
      ? {
          ...verdict(
            "needs_review",
            [],
            `The only ${rule.measurement} result on the page belongs to a family member, not the patient.`,
          ),
          spans: familyLabs.flatMap((m) => (m.span ? [m.span] : [])),
          blockedBy: [
            `A family member's ${rule.measurement} result is on the page.`,
          ],
        }
      : verdict(
          "missing",
          [],
          blank("lab")
            ? `The ${rule.measurement} field is blank.`
            : `No ${rule.measurement} result is documented.`,
        )
  else {
    const dated = values
      .map((e) => ({ e, d: relatedDate(e), g: gaps(e) }))
      .sort((a, b) => (b.d ?? "").localeCompare(a.d ?? ""))
    const ok = dated.filter((x) => x.g && inWindow(x.g) && meets(x.e))
    const unsure = dated.filter(
      (x) => x.g && !inWindow(x.g) && maybeInWindow(x.g) && meets(x.e),
    )
    if (ok.length) {
      const best = ok[0]
      // The rubric: conflicting source dates require review.
      out.lab = conflicts.length
        ? verdict(
            "needs_review",
            [...withDate(best.e), request!, ...conflicts],
            "Two different request dates are documented. The 180-day window cannot be confirmed.",
          )
        : verdict(
            "evidence_found",
            [...withDate(best.e), request!],
            `${rule.measurement} ${show(num(best.e))} ${rule.unit}${unitNote(best.e)} is ${best.g![1]} days before the request${rule.min === null ? "" : ` and meets the ${rule.min} ${rule.unit} threshold`}.`,
            withDate(best.e),
          )
    } else if (unsure.length)
      out.lab = verdict(
        "needs_review",
        [...withDate(unsure[0].e), ...(request ? [request] : [])],
        `The ${rule.measurement} date gives only a month, so the 180-day window cannot be confirmed.`,
      )
    else if (dated.some((x) => !x.d && meets(x.e)))
      out.lab = verdict(
        "needs_review",
        [
          ...withDate(dated.find((x) => !x.d && meets(x.e))!.e),
          ...(request ? [request] : []),
        ],
        `A ${rule.measurement} value${rule.min === null ? "" : " that meets the threshold"} has no readable date, so the 180-day window cannot be checked.`,
      )
    else {
      const latest = dated[0]
      out.lab = verdict(
        "needs_review",
        [...withDate(latest.e), ...(request ? [request] : [])],
        meetsOf(latest.e) === null
          ? `${rule.measurement} is written only as a bound, ${latest.e.attrs?.comparator ?? ""} ${show(num(latest.e))} ${rule.unit}, which cannot show the ${rule.min} ${rule.unit} threshold is met.`
          : !meets(latest.e)
            ? `${rule.measurement} ${latest.e.attrs?.comparator ?? ""}${show(num(latest.e))} ${rule.unit} is below the ${rule.min} ${rule.unit} threshold.`
            : latest.g === null
              ? `The ${rule.measurement} date or the request date could not be read. Check the page.`
              : latest.g[1] < 0
                ? `The ${rule.measurement} date falls after the request date.`
                : `The most recent ${rule.measurement} is ${latest.g[1]} days before the request, outside the 180-day window.`,
      )
    }
  }

  out.prior = judgePrior(
    rule,
    entities,
    { date, relatedDate, withDate },
    req,
    blank,
  )

  // ---------- dose ----------
  const meds = all("requested_medication")
  const med = meds.find((m) => !m.attrs?.negated) ?? meds[0]
  const doseOf = (e: Entity) => String(e.value)
  const forDrug = (e: Entity) =>
    !!e.attrs?.drugUnknown || !e.attrs?.drug || e.attrs.drug === rule.medication
  const requestedAll = all("requested_dose").filter(forDrug)
  const live = requestedAll.filter((e) => !e.attrs?.negated)
  const correctedDoses = live.filter((e) => e.attrs?.corrected)
  const stated = correctedDoses.length ? [correctedDoses.at(-1)!] : live
  const distinctDoses = [...new Set(stated.map(doseOf))]
  const list = all("medication_list_dose").filter(
    (e) => !e.attrs?.drug || e.attrs.drug === rule.medication,
  )
  if (med && med.value !== rule.medication)
    out.dose = verdict(
      "needs_review",
      [med, ...stated.slice(0, 1)],
      `The request is for ${med.value}, not ${rule.medication}.`,
    )
  else if (!stated.length)
    out.dose = requestedAll.length
      ? verdict(
          "needs_review",
          requestedAll,
          `The only ${rule.medication} dose on the page is marked as an old or cancelled order: ${quoteOf(requestedAll[0])}.`,
        )
      : verdict(
          "missing",
          [],
          blank("dose")
            ? "The dose field is blank."
            : `No dose is documented for the requested ${rule.medication}.`,
        )
  else if (!med)
    out.dose = verdict(
      "needs_review",
      stated,
      `A dose is written, but no requested drug is named: ${quoteOf(stated[0])}.`,
    )
  else if (distinctDoses.length > 1)
    out.dose = verdict(
      "needs_review",
      [...(med ? [med] : []), ...stated],
      `The request gives different doses: ${stated.map((e) => `${doseOf(e)} in ${quoteOf(e)}`).join(" and ")}.`,
    )
  else {
    const requested = stated[0]
    const amount = Number(
      requested.attrs?.amount ?? String(requested.value).split(" ")[0],
    )
    const marketed = MARKETED.get(rule.medication) ?? []
    const steps = String(requested.attrs?.stepDoses ?? "")
      .split("|")
      .filter(Boolean)
    const differs = list.find(
      (e) => doseOf(e) !== doseOf(requested) && !steps.includes(doseOf(e)),
    )
    const evidence = [...(med ? [med] : []), requested]
    if (requested.attrs?.unclearBox)
      out.dose = {
        ...verdict(
          "needs_review",
          evidence,
          `The box beside the order could not be read as checked or unchecked: ${quoteOf(requested)}.`,
        ),
        blockedBy: ["The mark in the box beside the order could not be read."],
      }
    else if (requested.attrs?.leadingDecimal || requested.attrs?.decimalComma)
      out.dose = verdict(
        "needs_review",
        evidence,
        `The dose in ${quoteOf(requested)} is written with ${requested.attrs?.leadingDecimal ? "no leading zero" : "a decimal comma"}. Confirm the amount.`,
      )
    else if (requested.attrs?.ambiguous)
      out.dose = verdict(
        "needs_review",
        evidence,
        `The request offers more than one dose: ${quoteOf(requested)}.`,
      )
    else if (marketed.length && !marketed.includes(amount))
      out.dose = verdict(
        "needs_review",
        evidence,
        `${show(amount)} mg is not a marketed ${rule.medication} dose. Check the page for a misread.`,
      )
    else if (doseOf(requested) !== rule.dose)
      out.dose = verdict(
        "needs_review",
        evidence,
        `The request is ${doseOf(requested)}. The fictional rule allows ${rule.dose}.`,
      )
    else if (differs)
      out.dose = verdict(
        "needs_review",
        [...evidence, differs],
        marketed.length &&
          !marketed.includes(
            Number(
              differs.attrs?.amount ?? String(differs.value).split(" ")[0],
            ),
          )
          ? `The request says ${doseOf(requested)}. The medication list says ${doseOf(differs)}, which is not a marketed dose and may be a misread. Check the image.`
          : `The request says ${doseOf(requested)} but the medication list says ${doseOf(differs)}.`,
      )
    else
      out.dose = verdict(
        "evidence_found",
        evidence,
        `The requested ${rule.medication} dose ${doseOf(requested)} matches the fictional rule.`,
        // The answer rests on the drug name as well as the dose.
        [...(med ? [med] : []), requested],
      )
  }
  return out
}

// Prior therapy, read as drug-linked treatment episodes. A side effect of one
// drug never counts for another, and an outcome that names no drug counts for
// none. Stopping for an inadequate response is not an intolerance.
function judgePrior(
  rule: Rule,
  entities: Entity[],
  { date, relatedDate, withDate }: Dates,
  req: string | undefined,
  blank: (field: string) => Entity | undefined,
): Verdict {
  const episodes = new Map<number, Entity[]>()
  for (const e of entities)
    if (e.episode)
      episodes.set(e.episode, [...(episodes.get(e.episode) ?? []), e])
  const accepted = new Set([...Object.keys(rule.trial), ...rule.intolerance])
  const INACTIVE = [
    "negated",
    "declined",
    "planned",
    "unchecked",
    "family",
    "mention",
  ]
  const reads: { stage: number; v: Verdict }[] = []
  const lookAlikes: Entity[] = []
  const others: Entity[] = []
  const inactive: Entity[] = []
  for (const parts of episodes.values()) {
    const med = parts.find((e) => e.type === "prior_medication")
    if (!med) continue
    const drug = String(med.value)
    if (med.match?.kind === "look-alike") {
      lookAlikes.push(med)
      continue
    }
    if (!accepted.has(drug)) {
      others.push(med)
      continue
    }
    if (med.attrs?.status === "unclear-box") {
      reads.push({
        stage: 0.5,
        v: {
          ...verdict(
            "needs_review",
            parts,
            `The box beside ${drug} could not be read as checked or unchecked: ${quoteOf(med)}.`,
          ),
          blockedBy: [`The mark in the box beside ${drug} could not be read.`],
        },
      })
      continue
    }
    if (INACTIVE.includes(String(med.attrs?.status ?? "tried"))) {
      inactive.push(med)
      continue
    }
    const one = (type: string) => parts.find((e) => e.type === type)
    const outcome = one("prior_outcome")
    const reason = one("prior_reason")
    const D = cap(drug)
    if (outcome?.attrs?.category === "unclear") {
      reads.push({
        stage: 8,
        v: verdict(
          "needs_review",
          parts,
          `The ${drug} statement is unclear: ${quoteOf(outcome)}.`,
        ),
      })
      continue
    }
    if (
      outcome &&
      (outcome.value === "intolerance" ||
        outcome.value === "contraindication") &&
      rule.intolerance.includes(drug)
    ) {
      reads.push(
        reason
          ? {
              stage: 9,
              v: verdict(
                "evidence_found",
                parts,
                `${D} ${outcome.value} is documented with its reason: ${reason.value}.`,
                [med, outcome, reason],
              ),
            }
          : {
              stage: 8,
              v: verdict(
                "needs_review",
                parts,
                `${D} ${outcome.value} is stated without a reason.`,
              ),
            },
      )
      continue
    }
    const trial = rule.trial[drug]
    if (!trial) {
      reads.push({
        stage: 0,
        v: verdict(
          "needs_review",
          parts,
          `A ${drug} course is documented. For ${drug} only an intolerance or contraindication counts, and none is stated.`,
        ),
      })
      continue
    }
    const fail = (stage: number, why: string, blockedBy?: string[]) =>
      reads.push({
        stage,
        v: {
          ...verdict("needs_review", parts, why),
          ...(blockedBy ? { blockedBy } : {}),
        },
      })
    const stop = date(one("prior_stop_date"))
    const stated = one("prior_duration_days")?.value as number | undefined
    let start = date(one("prior_start_date"))
    // A stop date and a stated duration give the start.
    if (!start && stop && stated !== undefined)
      start = new Date(Date.parse(stop) - stated * DAY)
        .toISOString()
        .slice(0, 10)
    const ongoing = !!med.attrs?.ongoing && !stop
    const duration =
      start && stop
        ? days(start, stop)
        : stated !== undefined
          ? stated
          : start && ongoing && req
            ? days(start, req)
            : undefined
    const dose = one("prior_dose")
    const amount = Number(
      dose?.attrs?.amount ?? String(dose?.value ?? "").split(" ")[0],
    )
    const frequency = String(
      dose?.attrs?.frequency ??
        String(dose?.value ?? "").split(" mg ")[1] ??
        "",
    )
    const bases = parts.filter((e) => e.type === "prior_baseline")
    const base = bases.find((b) => relatedDate(b)) ?? bases[0]
    const follows = parts.filter((e) => e.type === "prior_followup")
    const follow =
      follows.find((f) => {
        const fd = relatedDate(f)
        return !!fd && (!start || days(start, fd) >= 90)
      }) ??
      follows.find((f) => relatedDate(f)) ??
      follows[0]
    const baseDate = relatedDate(base),
      followDate = relatedDate(follow)
    const num = (e: Entity) => (e.value as { value: number }).value
    // A value whose date is missing or unreadable cannot be placed against
    // the start, so it cannot prove the trial.
    const dateProblem = (e: Entity | undefined, what: string) =>
      !e || relatedDate(e)
        ? null
        : UNREADABLE_DATE.test(e.source_span.text)
          ? `The ${what} ${rule.measurement} date could not be read: ${quoteOf(e)}`
          : `The ${what} ${rule.measurement} has no readable date: ${quoteOf(e)}`
    const undatedBase = dateProblem(base, "baseline")
    const undatedFollow = dateProblem(follow, "follow-up")
    // Anything dated after the request is not prior failure.
    const afterRequest =
      !!req && [start, stop, baseDate, followDate].some((d) => !!d && d > req)
    const stillMisses = follow
      ? atLeast(
          num(follow),
          boundOf(follow),
          rule.goal.value,
          rule.goal.inclusive,
        )
      : null
    if (duration === undefined)
      fail(1, `The ${drug} trial has no readable dates or duration.`)
    else if (duration < 0)
      fail(1, `The ${drug} trial dates run backward. Check the page.`)
    else if (!dose) fail(2, `The ${drug} dose is not stated.`)
    else if (trial.amounts && !trial.amounts.includes(amount))
      fail(
        3,
        `${D} ${dose.value} is not a dose the fictional rule counts (${trial.amounts.join(" or ")} mg ${trial.frequency}).`,
      )
    else if (trial.frequency && frequency && frequency !== trial.frequency)
      fail(
        3,
        `${D} ${dose.value} is not ${trial.frequency}, as the fictional rule requires.`,
      )
    else if (duration < 90)
      fail(
        4,
        `The ${drug} trial lasted ${duration} days, under the 90-day minimum.`,
      )
    else if (!base || !follow)
      fail(
        5,
        `A ${duration}-day ${drug} trial is documented, but no ${rule.measurement} before and after the trial shows the goal was not met.`,
      )
    else if (undatedBase || undatedFollow)
      fail(
        6,
        `${undatedFollow ?? undatedBase} So the trial's timing cannot be checked.`,
        [undatedFollow, undatedBase].filter((x): x is string => !!x),
      )
    else if (!start)
      fail(
        6,
        `The ${drug} start date is not stated, so the rule's 90 days from start to follow-up cannot be checked.`,
      )
    else if (afterRequest)
      fail(
        6,
        `Part of the ${drug} course or its values is dated after the request, so it cannot show failure before the request. Check the dates.`,
      )
    else if (start && baseDate && days(baseDate, start) < 0)
      fail(
        6,
        `The baseline ${rule.measurement} is dated after the trial started.`,
      )
    else if (start && followDate && days(start, followDate) < 90)
      fail(
        6,
        `The follow-up ${rule.measurement} is less than 90 days after the start.`,
      )
    else if (stillMisses === false)
      fail(
        7,
        `The follow-up ${rule.measurement} meets the goal, so the trial does not show failure.`,
      )
    else if (stillMisses === null)
      fail(
        7,
        `The follow-up ${rule.measurement} is written only as a bound, ${follow.attrs?.comparator ?? ""} ${show(num(follow))}, which cannot show the goal was missed.`,
      )
    else
      reads.push({
        stage: 10,
        v: verdict(
          "evidence_found",
          parts,
          `A ${duration}-day ${drug} trial is documented with ${rule.measurement} ${show(num(base))} before and ${show(num(follow))} after, still not at goal.`,
          [med, dose!, ...withDate(base), ...withDate(follow)],
        ),
      })
  }
  const best = reads.sort((a, b) => b.stage - a.stage)[0]
  if (best) return best.v
  if (lookAlikes.length) {
    const m = lookAlikes[0]
    return verdict(
      "needs_review",
      [m],
      `${m.match!.written} is a look-alike drug name. Clarify the drug before accepting it.`,
    )
  }
  if (inactive.length) {
    const m = inactive[0]
    const s = String(m.attrs?.status)
    const what =
      s === "negated"
        ? "was not tried"
        : s === "declined"
          ? "was declined"
          : s === "planned"
            ? "is only planned"
            : s === "unchecked"
              ? "is listed but not checked"
              : s === "mention"
                ? "is named, but no course of it is described"
                : "is mentioned for a family member"
    return verdict(
      "missing",
      [],
      `The record says ${m.value} ${what}. No ${rule.priorLabel} trial, intolerance or contraindication is documented.`,
    )
  }
  if (others.length)
    return verdict(
      "missing",
      [],
      `A ${[...new Set(others.map((m) => m.value))].join(" and ")} course is documented. No ${rule.priorLabel} trial, intolerance or contraindication is documented.`,
    )
  return verdict(
    "missing",
    [],
    blank("prior therapy")
      ? "The prior therapy field is blank."
      : `No ${rule.priorLabel} trial, intolerance or contraindication is documented.`,
  )
}

// Blockers that stop a "not documented" answer for this criterion. A field
// shown blank answers only for itself: a missing or unreadable page, or
// another line about the item that could not be read, still blocks.
function blockersFor(
  rule: Rule,
  id: CriterionId,
  coverage: ReaderCoverage | undefined,
): Blocker[] {
  const scope = id === "adult" ? undefined : rule.scope[id]
  return (coverage?.blockers?.[id] ?? []).filter((b) => {
    if (b.scope && scope && b.scope !== scope) {
      // The statin scope covers every statin by name.
      if (!(scope === "statin" && STATINS.includes(b.scope))) return false
    }
    return true
  })
}

export function linkEvidence({
  entities,
  criteriaId,
  words = [],
  coverage,
}: LinkInput): LinkOutput {
  const rule = rules[criteriaId]
  if (!rule) throw new Error("Unknown fictional criteria set")
  const mentions = coverage?.mentions ?? []
  const twoReadings = entities.some(
    (e) =>
      typeof e.value === "object" && e.value !== null && "readings" in e.value,
  )
  const first = judge(rule, entities, 0, mentions)
  const second = twoReadings ? judge(rule, entities, 1, mentions) : first
  const criteria: Criterion[] = []
  for (const id of [
    "adult",
    "diagnosis",
    "lab",
    "prior",
    "dose",
  ] as CriterionId[]) {
    let v = first[id]
    if (second[id].status !== v.status)
      v = {
        status: "needs_review",
        evidence: [...new Set([...v.evidence, ...second[id].evidence])],
        reason:
          "Numeric dates on this page can be read month first or day first, and the two readings give different results. Both readings are kept. Check the page.",
      }
    else if (second[id].reason !== v.reason)
      v = {
        ...v,
        evidence: [...new Set([...v.evidence, ...second[id].evidence])],
        reason: `Numeric dates on this page can be read two ways. Read month first: ${v.reason} Read day first: ${second[id].reason}`,
      }
    let status = v.status
    let reason = v.reason
    let blockedBy: string[] | undefined = v.blockedBy
    // Whole-packet coverage: "not documented" only when nothing blocks it.
    if (status === "missing") {
      const blocks = blockersFor(rule, id, coverage)
      if (blocks.length) {
        status = "needs_review"
        blockedBy = blocks.map((b) => b.message)
        reason = `${v.reason} This cannot be called not documented, because ${blocks.length === 1 ? "part of the packet" : `${blocks.length} parts of the packet`} could not be read. ${blocks[0].message}${blocks.length > 1 ? ` (and ${blocks.length - 1} more)` : ""}`
      }
    }
    if (status === "evidence_found") {
      // An unread line that could disagree with the evidence, such as a
      // medication-list dose that could not be read.
      const disagree = blockersFor(rule, id, coverage).filter(
        (b) => b.blocksFound,
      )
      if (disagree.length) {
        status = "needs_review"
        blockedBy = disagree.map((b) => b.message)
        reason = `${v.reason} But a line that could disagree could not be read. ${disagree[0].message}`
      }
    }
    if (status === "evidence_found") {
      // The OCR gate looks at the words the decision used, not whole lines.
      const decision = v.decision ?? v.evidence
      const low = (r: { start: number; end: number }) =>
        words.some(
          (w: Word) => w.needsReview && w.start < r.end && w.end > r.start,
        )
      // The value, and the name it belongs to: the drug or the lab.
      const uncertain = decision.some(
        (e) =>
          low(e.value_span ?? e.source_span) ||
          (!!e.name_span && low(e.name_span)),
      )
      const weakMatch = decision.some((e) => (e.match?.confidence ?? 1) < 0.8)
      if (uncertain || weakMatch) {
        status = "needs_review"
        reason = uncertain
          ? "Low confidence OCR overlaps the words this answer rests on. Check the image."
          : "A drug or condition name matched only as a distant spelling variant. Check the page."
      }
    }
    const spans: Span[] = [
      ...new Map(
        [
          ...v.evidence.flatMap((e) => e.spans ?? [e.source_span]),
          ...(v.spans ?? []),
        ].map((s) => [s.start, s]),
      ).values(),
    ].sort((a, b) => a.start - b.start)
    criteria.push({
      criterion_id: id,
      status,
      evidence_spans: status === "missing" ? [] : spans,
      reason,
      ...(blockedBy ? { blocked_by: blockedBy } : {}),
      reviewed: false,
    })
  }
  return { criteria }
}
