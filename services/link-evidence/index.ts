import type {
  LinkInput,
  LinkOutput,
  Entity,
  Criterion,
  Span,
} from "../contracts.js"
const rules: Record<
  string,
  {
    diagnosis: string
    measurement: string
    min: number
    prior: string
    medication: string
    dose: string
  }
> = {
  "glp1-t2d": {
    diagnosis: "Type 2 diabetes mellitus",
    measurement: "A1c",
    min: 0,
    prior: "metformin",
    medication: "semaglutide",
    dose: "0.5 mg weekly",
  },
  "biologic-psoriasis": {
    diagnosis: "Moderate-to-severe plaque psoriasis",
    measurement: "Body surface area",
    min: 10,
    prior: "methotrexate",
    medication: "adalimumab",
    dose: "40 mg every other week",
  },
  pcsk9: {
    diagnosis: "Established atherosclerotic cardiovascular disease",
    measurement: "LDL-C",
    min: 70,
    prior: "atorvastatin",
    medication: "evolocumab",
    dose: "140 mg every 2 weeks",
  },
}
export function linkEvidence({
  entities,
  criteriaId,
  words = [],
}: LinkInput): LinkOutput {
  const rule = rules[criteriaId]
  if (!rule) throw new Error("Unknown fictional criteria set")
  const get = (type: string) => entities.find((e) => e.type === type)
  const spans = (...es: (Entity | undefined)[]) =>
    es.filter(Boolean).map((e) => e!.source_span)
  const criteria: Criterion[] = []
  const add = (id: string, es: Span[], ok: boolean, reason: string) => {
    const uncertain = es.some((s) =>
      words.some((w) => w.needsReview && w.start < s.end && w.end > s.start),
    )
    criteria.push({
      criterion_id: id,
      status: !es.length
        ? "missing"
        : ok && !uncertain
          ? "evidence_found"
          : "needs_review",
      evidence_spans: es,
      reason: !es.length
        ? "Required documentation not found."
        : uncertain
          ? "Low confidence OCR overlaps this evidence. Check the image."
          : reason,
      reviewed: false,
    })
  }
  const age = get("age")
  add(
    "adult",
    spans(age),
    Number(age?.value) >= 18,
    "Check documented age against the fictional adult rule.",
  )
  const diagnosis = get("diagnosis")
  add(
    "diagnosis",
    spans(diagnosis),
    diagnosis?.value === rule.diagnosis,
    "Diagnosis must match the fictional rule. Negation is not positive evidence.",
  )
  const lab = get("measurement"),
    date = get("measurement_date"),
    request = get("request_date"),
    conflict = get("conflicting_request_date")
  const elapsed =
    (Date.parse(String(request?.value)) - Date.parse(String(date?.value))) /
    86400000
  const value = lab?.value
  const labOk =
    typeof value === "object" &&
    value.name === rule.measurement &&
    value.value >= rule.min &&
    elapsed >= 0 &&
    elapsed <= 180 &&
    !conflict
  add(
    "lab",
    lab ? spans(lab, request, conflict) : [],
    labOk,
    "Check value and a 180-day window. Conflicting dates require review.",
  )
  const prior = get("prior_medication"),
    outcome = get("prior_outcome")
  const days =
    (Date.parse(String(get("prior_stop_date")?.value)) -
      Date.parse(String(get("prior_start_date")?.value))) /
    86400000
  const priorOk =
    prior?.value === rule.prior &&
    (outcome?.value === "intolerance" ||
      (days >= 90 && outcome?.value === "inadequate response"))
  add(
    "prior",
    spans(prior),
    priorOk,
    "A 90-day trial with response or documented intolerance is required.",
  )
  const dose = get("requested_dose"),
    listed = get("medication_list_dose"),
    med = get("requested_medication")
  add(
    "dose",
    spans(dose, ...(listed && listed.value !== dose?.value ? [listed] : [])),
    dose?.value === rule.dose &&
      med?.value === rule.medication &&
      (!listed || listed.value === dose.value),
    "Compare requested dose with the medication history. Resolve contradictions.",
  )
  return { criteria }
}
