// Assertion context for a clinical mention inside one line of text: who it
// is about, whether it is negated or uncertain, whether it is historical,
// hypothetical, declined or corrected. Scope is the sentence around the
// mention. A negation at the head of a comma list reaches every item of the
// list when "or", "nor" or "and" closes it. When nothing closes the list the
// scope is unclear, and the reader sends the mention to review instead of
// guessing. Who a mention is about is read within its own clause, from a
// relation word before it or right after it.
import { CONTEXT } from "./lexicon.js"

export interface Assertion {
  negated: boolean
  uncertain: boolean
  family: boolean
  historical: boolean
  noLongerCurrent: boolean
  hypothetical: boolean
  declined: boolean
  corrected: boolean
  // A negation earlier in an open list may or may not cover this mention.
  scopeUnclear: boolean
}

// Sentence bounds around [start, end): semicolons, exclamation marks and
// periods that are not decimal points. A period is a decimal point only with
// a digit on both sides, so "Mother is 54. Patient is 16" is two sentences.
const isStop = (text: string, k: number) => {
  const c = text[k]
  if (c === ";" || c === "!") return true
  return (
    c === "." && !(/\d/.test(text[k - 1] ?? "") && /\d/.test(text[k + 1] ?? ""))
  )
}
function sentenceBounds(text: string, start: number, end: number) {
  let s = 0
  for (let k = start - 1; k >= 0; k--)
    if (isStop(text, k)) {
      s = k + 1
      break
    }
  let e = text.length
  for (let k = end; k < text.length; k++)
    if (isStop(text, k)) {
      e = k
      break
    }
  return [s, e] as const
}

// Words that open a negated list: "No obesity, type 2 diabetes or ...".
const NEG_TRIGGER =
  /\b(?:no|denies|denied|deny|without|negative\s+for|never|not|absence\s+of|free\s+of|rules?\s+out|ruled\s+out)\b/i
// Words that start a new clause, so a list does not run through them.
const CLAUSE_WORD =
  /\b(?:but|however|although|though|whereas|while|except|yet|has|have|had|is|are|was|were|reports?|states?|presents?|requests?|requesting|patient)\b/i
// A clause break inside a sentence: a contrast word, or a comma or colon
// before a new subject.
const CLAUSE_BREAK =
  /[,:]\s*(?=(?:this|the\s+patient|patient|he|she|they|we)\b)|\b(?:but|however|although|though|whereas|while)\b/gi
// A relation word right after the mention: "type 2 diabetes in his mother",
// "T2DM (mother)", "A1c 8%, father".
export const RELATION_AFTER =
  /^\s*(?:[,(-]\s*)?(?:(?:in|of|for|from|per|by|is)\s+)?(?:(?:his|her|their|the\s+patient'?s|patient'?s|a|the)\s+)?(?:mother|mom|father|dad|sister|brother|sibling|parents?|grandmother|grandfather|grandparents?|aunt|uncle|cousin|son|daughter|maternal|paternal)\b/i

export function assertion(
  text: string,
  start: number,
  end: number,
  context: { label?: string; sectionRole?: string } = {},
): Assertion {
  const [s, e] = sentenceBounds(text, start, end)
  const before = text.slice(s, start)
  const after = text.slice(end, e)
  const segments = before.split(",")
  const last = segments.at(-1) ?? ""
  const pseudo = CONTEXT.pseudoNegation.test(last)
  let negatedBefore = !pseudo && CONTEXT.negatedBefore.test(last)
  let scopeUnclear = false
  if (
    !negatedBefore &&
    !pseudo &&
    segments.length > 1 &&
    !CLAUSE_WORD.test(last)
  ) {
    // Walk back over list items to a negation that heads the list.
    for (let k = segments.length - 2; k >= 0; k--) {
      const seg = segments[k]
      const trigger = seg.match(NEG_TRIGGER)
      if (trigger && !CONTEXT.pseudoNegation.test(seg)) {
        // A new clause after the negation word ends its reach.
        if (CLAUSE_WORD.test(seg.slice(trigger.index! + trigger[0].length)))
          break
        const closed =
          /^\s*(?:or|nor|and)\b/i.test(last) ||
          /^[^.;]*?(?:,\s*|\s)(?:or|nor|and)\s+\w/i.test(after)
        if (closed) negatedBefore = true
        else scopeUnclear = true
        break
      }
      // A list item is short and starts no new clause.
      if (seg.trim().split(/\s+/).length > 5 || CLAUSE_WORD.test(seg)) break
    }
  }
  const negated = negatedBefore || CONTEXT.negatedAfter.test(after)
  const uncertain =
    CONTEXT.uncertainBefore.test(last) ||
    CONTEXT.uncertainAfter.test(after) ||
    /^\s*\?/.test(after) ||
    /\?\s*$/.test(last)
  const label = context.label ?? ""
  // Family is read within the mention's own clause, so "Although his mother
  // has psoriasis, this request is for plaque psoriasis" keeps the second
  // mention the patient's.
  let clauseStart = 0
  for (const m of before.matchAll(CLAUSE_BREAK))
    clauseStart = m.index! + m[0].length
  const clause = before.slice(clauseStart)
  const family =
    CONTEXT.family.test(clause) ||
    RELATION_AFTER.test(after) ||
    /\bfamily\b|\bfhx?\b/i.test(label) ||
    context.sectionRole === "family"
  const historical = CONTEXT.historical.test(last)
  const noLongerCurrent =
    CONTEXT.noLongerCurrent.test(after) || CONTEXT.noLongerCurrent.test(last)
  const hypothetical =
    CONTEXT.hypothetical.test(last) || CONTEXT.hypotheticalAfter.test(after)
  const declined = CONTEXT.declined.test(after) || CONTEXT.declined.test(last)
  const corrected = CONTEXT.corrected.test(text)
  return {
    negated,
    uncertain,
    family,
    historical,
    noLongerCurrent,
    hypothetical,
    declined,
    corrected,
    scopeUnclear: scopeUnclear && !negated,
  }
}
