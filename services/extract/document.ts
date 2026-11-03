// A layout-aware model of the page, built before any clinical rule runs.
// Lines become headings, key-value fields (":", "|", "?", "=" or " - "), table
// rows bound to their header, checkbox items with their checked state,
// question and answer pairs, SOAP parts and prose. Lines that hold only
// <<page>> or a form feed are page breaks, never text. A value that wraps onto
// the next line is joined to its field, and both lines stay citable.
import { LABELS, SECTION_ROLES, LABS, CONDITIONS } from "./lexicon.js"

export type Checked = "checked" | "unchecked" | "unclear"
export interface Cell {
  text: string
  // Code unit offset of the cell text within the line.
  offset: number
  header?: string
}
export interface Option {
  text: string
  offset: number
  checked: Checked
}
export interface Section {
  heading: string
  role: string
  line: number
  // Role of the field label when a field with an empty value heads a list.
  fieldRole?: string
}
export interface DocLine {
  i: number
  page: number
  // Code point offset of the line start in the whole text.
  start: number
  text: string
  kind:
    | "blank"
    | "page-break"
    | "heading"
    | "field"
    | "table-header"
    | "table-row"
    | "prose"
    | "continuation"
  label?: string
  // Key of LABELS that the label matched, if any.
  role?: string
  value?: string
  // Code unit offset of the value within the line.
  valueOffset?: number
  checked?: Checked
  options?: Option[]
  cells?: Cell[]
  soap?: "S" | "O" | "A" | "P"
  section: Section
  // Lines joined onto this one because its value wrapped.
  joined?: number[]
  // Text of this line plus any joined lines, separated by a space.
  fullText?: string
}

const BOX = /(\[\s*[xX✓✔*]?\s*\]|☒|☐|☑|\(\s*[xX✓]?\s*\))(?=\s|$|[A-Za-z])/g
const boxState = (box: string): Checked =>
  /[xX✓✔☒☑*]/.test(box)
    ? "checked"
    : /^\[\s*\]$|^☐$|^\(\s*\)$/.test(box)
      ? "unchecked"
      : "unclear"
const BLANK_VALUE =
  /^[\s_.\-–—]*$|^(?:n\/?a|none(?:\s+(?:given|listed|provided|reported))?|not\s+(?:provided|documented|available|given|listed|recorded|reported|stated|supplied)|unknown|blank|tbd)\.?$/i
export const isBlankValue = (v: string) => BLANK_VALUE.test(v.trim())

// Request-date labels OCR often misreads by a letter ("Submissian").
const FUZZY_REQUEST_DATE = [
  "submission",
  "submitted",
  "date of request",
  "request date",
  "letter date",
  "prepared",
  "completed",
]
const editDistance = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)),
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
  return d[a.length][b.length]
}
export function roleOf(label: string) {
  const exact = exactRole(label)
  if (exact) return exact
  const l = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z ]+/g, "")
    .replace(/\s+/g, " ")
  if (l.length >= 8 && FUZZY_REQUEST_DATE.some((w) => editDistance(l, w) <= 1))
    return "requestDate"
  return undefined
}
function exactRole(label: string) {
  const l = label
    .trim()
    .replace(/^[\s\-*•]+/, "")
    .replace(/[\s.:?|=]+$/, "")
    // "Diagnosis (check one)" and "Prior therapy (list all)" keep their role.
    .replace(
      /\s*\((?:check|select|mark|tick|circle|list|choose|if\s+any)[^)]*\)$/i,
      "",
    )
    .replace(/\s+/g, " ")
  for (const [role, re] of Object.entries(LABELS)) if (re.test(l)) return role
  // Labels that name a lab ("HbA1c", "A1c attachment", "LDL-C result attached")
  if (LABS.some((lab) => lab.pattern.test(l))) return "labs"
  return undefined
}
export const sectionRole = (heading: string) =>
  SECTION_ROLES.find((s) => s.pattern.test(heading))?.role ?? "unknown"

// A label is short, starts with a letter and reads like a field name.
const LABEL_TEXT = /^[A-Za-z%][A-Za-z0-9%/'().,&\- ]{0,44}$/
const isLabel = (s: string) => {
  const t = s.trim()
  if (!LABEL_TEXT.test(t)) return false
  if (t.split(/\s+/).length > 7) return false
  if (/\d{3,}/.test(t)) return false
  return true
}
const isHeading = (t: string) => {
  const s = t.trim()
  if (!s || s.length > 60) return false
  const letters = s.replace(/[^A-Za-z]/g, "")
  if (letters.length < 3) return false
  return (
    letters === letters.toUpperCase() &&
    !/\d\s*(?:mg|%)/i.test(s) &&
    !/[:=?]\s*\S/.test(s)
  )
}

function splitCells(line: string, sep: RegExp) {
  const cells: Cell[] = []
  const g = new RegExp(sep.source, "g")
  let last = 0
  for (const m of line.matchAll(g)) {
    if (m[0].length === 0) continue
    const part = line.slice(last, m.index)
    const lead = part.length - part.trimStart().length
    cells.push({ text: part.trim(), offset: last + lead })
    last = m.index! + m[0].length
  }
  const part = line.slice(last)
  cells.push({
    text: part.trim(),
    offset: last + (part.length - part.trimStart().length),
  })
  return cells
}
const headerLike = (cells: Cell[]) =>
  cells.filter((c) => c.text).length >= 2 &&
  cells.every(
    (c) =>
      !c.text ||
      (/^[A-Za-z%][A-Za-z0-9%/()\- ]{0,30}$/.test(c.text) &&
        !/\b\d+(?:\.\d+)?\s*(?:mg|%|mcg)\b/i.test(c.text)),
  ) &&
  !cells.some((c) => /\[(?:date|name)/.test(c.text))

function options(t: string, boxes: RegExpMatchArray[]) {
  return boxes.map((b, k) => {
    const from = b.index! + b[0].length
    const to = k + 1 < boxes.length ? boxes[k + 1].index! : t.length
    const seg = t.slice(from, to)
    const ws = seg.length - seg.trimStart().length
    return { text: seg.trim(), offset: from + ws, checked: boxState(b[1]) }
  })
}

type Draft = Omit<DocLine, "section">
function classify(raw: string[], pageStarts: Set<number>) {
  const lines: Draft[] = []
  let offset = 0,
    page = 1
  let header: Cell[] | null = null
  let headerPipe = false
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i]
    // Pages joined without a break line start where the page reader says.
    if (pageStarts.has(i)) {
      page++
      header = null
    }
    const start = offset
    offset += Array.from(t).length + 1
    const base = { i, page, start, text: t }
    if (/^\s*(?:<<page>>|\f+)\s*$/i.test(t)) {
      lines.push({ ...base, kind: "page-break" })
      page++
      header = null
      continue
    }
    if (!t.trim()) {
      lines.push({ ...base, kind: "blank" })
      header = null
      continue
    }
    const boxes = [...t.matchAll(BOX)]
    const lead = t.match(/^\s*/)![0].length
    let body = t,
      bodyOffset = 0,
      checked: Checked | undefined,
      opts: Option[] | undefined
    // A scanned box often reads as "[ 1", "[1" or "[]1": a box whose mark
    // cannot be seen, then the label.
    const ocrBox =
      t.match(/^\s*\[\]\s?[1|](?=[A-Za-z])/) ??
      t.match(/^\s*\[\s*[1lIJ|]\s+(?=[A-Za-z%])/)
    // Scan specks before a label, such as "~ " or "‘", are not text.
    const speck = t.match(/^\s*[~‘’`´^°•·]+\s*(?=[A-Za-z])/)
    if (speck && !ocrBox) {
      bodyOffset = speck[0].length
      body = t.slice(bodyOffset)
    } else if (ocrBox) {
      checked = /\[\]/.test(ocrBox[0]) ? "unchecked" : "unclear"
      bodyOffset = ocrBox[0].length
      body = t.slice(bodyOffset)
    } else if (boxes.length && boxes[0].index === lead) {
      checked = boxState(boxes[0][1])
      if (boxes.length > 1) opts = options(t, boxes)
      bodyOffset = boxes[0].index! + boxes[0][0].length
      bodyOffset +=
        t.slice(bodyOffset).length - t.slice(bodyOffset).trimStart().length
      body = t.slice(bodyOffset)
    } else if (boxes.length) opts = options(t, boxes)
    // Pipe tables and pipe fields.
    const pipe = body.includes("|") ? splitCells(body, /\s*\|\s*/) : null
    if (pipe) pipe.forEach((c) => (c.offset += bodyOffset))
    if (pipe && pipe.length >= 3) {
      if (headerLike(pipe) && !(header && headerPipe)) {
        header = pipe
        headerPipe = true
        lines.push({ ...base, kind: "table-header", cells: pipe, checked })
        continue
      }
      if (header && headerPipe) {
        pipe.forEach((c, k) => (c.header = header![k]?.text?.toLowerCase()))
        lines.push({ ...base, kind: "table-row", cells: pipe, checked })
        continue
      }
      if (isLabel(pipe[0].text)) {
        lines.push({
          ...base,
          kind: "field",
          label: pipe[0].text,
          role: roleOf(pipe[0].text),
          value: t.slice(pipe[1].offset).trim(),
          valueOffset: pipe[1].offset,
          cells: pipe,
          checked,
        })
        continue
      }
      lines.push({ ...base, kind: "table-row", cells: pipe, checked })
      continue
    }
    // Aligned columns: three or more cells split by runs of two or more spaces.
    if (!pipe && /\S\s{2,}\S/.test(body)) {
      const inner = body.length - body.trimStart().length
      const spaced = splitCells(body.trim(), /\s{2,}/)
      spaced.forEach((c) => (c.offset += bodyOffset + inner))
      if (spaced.length >= 3) {
        if (headerLike(spaced) && !(header && !headerPipe)) {
          header = spaced
          headerPipe = false
          lines.push({ ...base, kind: "table-header", cells: spaced, checked })
          continue
        }
        if (header && !headerPipe && spaced.length >= header.length - 1) {
          spaced.forEach((c, k) => (c.header = header![k]?.text?.toLowerCase()))
          lines.push({ ...base, kind: "table-row", cells: spaced, checked })
          continue
        }
      }
    }
    header = null
    if (pipe && pipe.length === 2 && isLabel(pipe[0].text)) {
      if (isHeading(body) && !roleOf(pipe[0].text)) {
        lines.push({ ...base, kind: "heading", label: body.trim() })
        continue
      }
      lines.push({
        ...base,
        kind: "field",
        label: pipe[0].text,
        role: roleOf(pipe[0].text),
        value: pipe[1].text,
        valueOffset: pipe[1].offset,
        checked,
      })
      continue
    }
    // SOAP parts and question-answer pairs.
    const soap = body.match(/^([SOAP])\s*:\s*(.*)$/)
    if (soap) {
      const prev = lines.filter((l) => l.kind !== "blank").at(-1)
      const valueOffset = bodyOffset + body.length - soap[2].length
      if (soap[1] === "A" && prev?.label === "Q:") {
        const question = prev.value ?? ""
        lines.push({
          ...base,
          kind: "field",
          label: question,
          role: roleOf(question),
          value: soap[2],
          valueOffset,
          checked,
        })
        continue
      }
      lines.push({
        ...base,
        kind: "field",
        label: soap[1],
        role:
          soap[1] === "A" ? "assessment" : soap[1] === "P" ? "dose" : undefined,
        soap: soap[1] as DocLine["soap"],
        value: soap[2],
        valueOffset,
        checked,
      })
      continue
    }
    const q = body.match(/^Q\s*:\s*(.+)$/)
    if (q) {
      lines.push({
        ...base,
        kind: "field",
        label: "Q:",
        value: q[1],
        valueOffset: bodyOffset + body.length - q[1].length,
      })
      continue
    }
    // Key-value fields. The separator is ":", "?", "=" or " - ", never a time.
    const field = body.match(
      /^([A-Za-z%][^:?=]{0,44}?)\s*(:(?!\d{2}\b)|\?|=|\s-\s)\s*(.*)$/,
    )
    if (field && isLabel(field[1])) {
      const label = field[1].trim()
      const value = field[3]
      lines.push({
        ...base,
        kind: "field",
        label: field[2] === "?" ? `${label}?` : label,
        role: roleOf(label),
        value,
        valueOffset: bodyOffset + body.length - value.length,
        checked,
        options: opts,
      })
      continue
    }
    if (isHeading(body)) {
      lines.push({ ...base, kind: "heading", label: body.trim() })
      continue
    }
    // "Systemic history follows." and "...summarized below." open a section.
    const intro = body.match(
      /^(.{3,60}?)\s+(?:follows|is\s+summari[sz]ed\s+below|are\s+summari[sz]ed\s+below)\s*[.:]?\s*$/i,
    )
    if (intro) {
      lines.push({ ...base, kind: "heading", label: intro[1] })
      continue
    }
    lines.push({
      ...base,
      kind: "prose",
      value: body,
      valueOffset: bodyOffset,
      checked,
      options: opts,
    })
  }
  return lines
}

export function buildDocument(
  text: string,
  pageStartLines: number[] = [],
): DocLine[] {
  const starts = new Set(pageStartLines)
  const drafts = classify(text.split("\n"), starts)
  // A capitalized lab, age or drug name alone on its line owns the value on
  // the line under it: "LDL-C" over "142 mg/dL on [date-a]".
  for (let k = 0; k < drafts.length; k++) {
    const d = drafts[k]
    if (d.kind !== "heading") continue
    const name = d.text.trim().replace(/[\s:]+$/, "")
    if (name.split(/\s+/).length > 3) continue
    const next = drafts[k + 1]
    if (!next || next.page !== d.page || !VALUE_START.test(next.text)) continue
    const role = roleOf(name)
    if (!role || !["labs", "age"].includes(role)) continue
    d.kind = "field"
    d.label = name
    d.role = role
    d.value = ""
    d.valueOffset = d.text.length
  }
  // A field with an empty value followed by item lines heads a list, such as
  // "Diagnosis for this request:" over checkbox options, or "Prior regimen:".
  for (let k = 0; k < drafts.length; k++) {
    const d = drafts[k]
    if (d.kind !== "field" || (d.value ?? "").trim() || d.soap) continue
    const next = drafts.slice(k + 1).find((n) => n.kind !== "blank")
    // A lab or age label whose value is on the next line keeps its value.
    if (
      d.role &&
      ["labs", "age"].includes(d.role) &&
      next &&
      VALUE_START.test(next.text)
    )
      continue
    if (next && ["prose", "table-header", "table-row"].includes(next.kind)) {
      d.kind = "heading"
    } else if (!d.role && next?.kind !== "field") d.kind = "heading"
    else if (!d.role) d.kind = "heading"
  }
  const lines: DocLine[] = []
  let section: Section = { heading: "", role: "unknown", line: -1 }
  for (const d of drafts) {
    if (d.kind === "page-break" || starts.has(d.i))
      section = { heading: "", role: "unknown", line: d.i }
    if (d.kind === "heading") {
      const heading = d.label ?? d.text.trim()
      const fieldRole = d.role
      const role =
        fieldRole === "prior"
          ? "history"
          : fieldRole === "medications"
            ? "medications"
            : fieldRole === "labs"
              ? "labs"
              : fieldRole === "history"
                ? "problems"
                : fieldRole === "family"
                  ? "family"
                  : fieldRole === "allergies"
                    ? "allergies"
                    : fieldRole === "indication"
                      ? "request"
                      : sectionRole(heading)
      section = { heading, role, line: d.i, fieldRole }
    }
    lines.push({ ...d, section })
  }
  joinWrapped(lines)
  return lines
}

// A line that starts with a value, such as "142 mg/dL" or "<70".
const VALUE_START = /^\s*[<>≤≥]?\s*\d/
// Field roles whose value can wrap onto a capitalized next line.
const WRAPPING_ROLES = [
  "indication",
  "history",
  "assessment",
  "request",
  "dose",
  "labs",
  "prior",
]
// Terms that can be split across a line break, such as "hemoglobin / A1c".
const SPLIT_TERMS = [
  ...LABS.map((l) => l.pattern),
  ...CONDITIONS.flatMap((c) => c.patterns),
].map(
  (re) =>
    new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"),
)
function joinWrapped(lines: DocLine[]) {
  for (let k = 0; k < lines.length; k++) {
    const a = lines[k]
    if (!["field", "prose"].includes(a.kind)) continue
    let prev = (a.value ?? "").trim() ? a.value! : a.text
    for (let j = k + 1; j < lines.length; j++) {
      const b = lines[j]
      if (b.page !== a.page) break
      const before = prev.trimEnd()
      const next = b.text.trim()
      if (!before || /[.;:!?)]$/.test(before)) break
      const joined = `${before} ${next}`
      // A capitalized line can still be the rest of an open value:
      // "Indication: type 2" over "DIABETES", or "established" over "ASCVD".
      const termHeading =
        b.kind === "heading" &&
        !/[:|]/.test(next) &&
        (a.kind === "prose" || WRAPPING_ROLES.includes(a.role ?? "")) &&
        SPLIT_TERMS.some((re) => {
          re.lastIndex = 0
          return [...joined.matchAll(re)].some(
            (m) => m.index! + m[0].length > before.length,
          )
        })
      if (b.kind !== "prose" && !termHeading) break
      const lowerStart = /^[a-z]/.test(next)
      const valueStart = /^[<>≤≥]?\d/.test(next)
      const spansTerm = SPLIT_TERMS.some((re) => {
        for (const m of joined.matchAll(re)) {
          const at = m.index!
          if (at < before.length && at + m[0].length > before.length + 1)
            return true
        }
        return false
      })
      const shortLabel =
        valueStart &&
        (a.kind === "prose"
          ? before.split(/\s+/).length <= 4
          : !(a.value ?? "").trim())
      if (!(lowerStart || spansTerm || shortLabel || termHeading)) break
      b.kind = "continuation"
      a.joined = [...(a.joined ?? []), b.i]
      a.fullText = `${(a.fullText ?? a.text).trimEnd()} ${next}`
      prev = next
    }
  }
}

// The text a rule should read for a line: the line and any wrapped lines.
export const lineText = (l: DocLine) => l.fullText ?? l.text
