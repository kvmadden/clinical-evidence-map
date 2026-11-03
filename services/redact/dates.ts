// Date recognition for the privacy step. It runs before the pinned library and
// replaces every date it can read with a token. Dates it cannot read are left
// for the library, which removes them. Original dates never pass through.
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}
const MONTH = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)[a-z]*\\.?"
export type DateOrder = "ymd" | "text" | "mdy" | "dmy" | "same" | "ambiguous"
export interface FoundDate {
  start: number
  end: number
  written: string
  // Calendar readings before any shift. Two readings mean month first, then day first.
  readings: string[]
  order: DateOrder
  // "month" when only a month and year were written. The reading is the 1st.
  precision?: "day" | "month"
}
const pad = (n: number) => String(n).padStart(2, "0")
function valid(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y))
const monthNumber = (name: string) => {
  const n = name.toLowerCase()
  return MONTHS[n.slice(0, n.startsWith("sept") ? 4 : 3)]
}

const PATTERNS: {
  re: RegExp
  read: (
    m: RegExpExecArray,
  ) => Omit<FoundDate, "start" | "end" | "written"> | null
}[] = [
  {
    re: /(?<![\d/-]|\d\.)(\d{4})-(\d{1,2})-(\d{1,2})(?![\d/-]|\.\d)/g,
    read: (m) =>
      valid(+m[1], +m[2], +m[3])
        ? { readings: [iso(+m[1], +m[2], +m[3])], order: "ymd" }
        : null,
  },
  {
    re: /(?<![\d/-]|\d\.)(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?![\d/-]|\.\d)/g,
    read: (m) => {
      const a = +m[1],
        b = +m[3],
        y = year(m[4])
      const mdy = valid(y, a, b) ? iso(y, a, b) : null
      const dmy = valid(y, b, a) ? iso(y, b, a) : null
      if (mdy && dmy)
        return a === b
          ? { readings: [mdy], order: "same" }
          : { readings: [mdy, dmy], order: "ambiguous" }
      if (mdy) return { readings: [mdy], order: "mdy" }
      if (dmy) return { readings: [dmy], order: "dmy" }
      return null
    },
  },
  {
    // 1 Oct 2026, 1st October 2026, 03-Oct-2026, 03.Oct.2026, 3-Oct-26
    re: new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+|[-./])${MONTH}(?:,?\\s+|[-./])(\\d{4}|\\d{2})\\b`,
      "gi",
    ),
    read: (m) => {
      const month = monthNumber(m[2])
      const y = year(m[3])
      return valid(y, month, +m[1])
        ? { readings: [iso(y, month, +m[1])], order: "text" }
        : null
    },
  },
  {
    // Oct 1, 2026, October 1 2026, Oct-01-2026
    re: new RegExp(
      `\\b${MONTH}(?:\\s+|-)(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+|-)(\\d{4})\\b`,
      "gi",
    ),
    read: (m) => {
      const month = monthNumber(m[1])
      return valid(+m[3], month, +m[2])
        ? { readings: [iso(+m[3], month, +m[2])], order: "text" }
        : null
    },
  },
  {
    // Month and year only: September 2026, Sept 2026, 09/2026. Read as the 1st.
    re: new RegExp(
      `\\b(?:${MONTH}\\s+(\\d{4})|(0?[1-9]|1[0-2])\\/((?:19|20)\\d{2}))\\b(?![/.-]\\d)`,
      "gi",
    ),
    read: (m) => {
      const month = m[1] ? monthNumber(m[1]) : +m[3]
      const y = m[1] ? +m[2] : +m[4]
      return valid(y, month, 1)
        ? { readings: [iso(y, month, 1)], order: "text", precision: "month" }
        : null
    },
  },
]

// A day and month with no year, joined by a range word to a full date, takes
// the year of the full date: "from 2 January to 30 June 2026". If its month
// falls after the full date's month, it is the year before.
const PARTIAL_DAY_MONTH = new RegExp(
  `\\b(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}|${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?)(?![\\w,]*\\s*,?\\s*\\d{4})`,
  "gi",
)
const RANGE_WORD = /^\s*(?:to|through|thru|until|till|-|–|—)\s*$/i
function rangeStarts(text: string, found: FoundDate[]): FoundDate[] {
  const extra: FoundDate[] = []
  PARTIAL_DAY_MONTH.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PARTIAL_DAY_MONTH.exec(text))) {
    const start = m.index,
      end = m.index + m[0].length
    if (found.some((f) => f.start < end && start < f.end)) continue
    const next = found
      .filter((f) => f.start >= end && f.precision !== "month")
      .sort((a, b) => a.start - b.start)[0]
    if (!next || !RANGE_WORD.test(text.slice(end, next.start))) continue
    if (next.readings.length !== 1) continue
    const day = +(m[1] ?? m[4])
    const month = monthNumber(m[2] ?? m[3])
    const [ey, em, ed] = next.readings[0].split("-").map(Number)
    const y = month < em || (month === em && day <= ed) ? ey : ey - 1
    if (!valid(y, month, day)) continue
    extra.push({
      start,
      end,
      written: m[0],
      readings: [iso(y, month, day)],
      order: "text",
    })
  }
  return extra
}

// Month and day with no year, in a dated context. These cannot be shifted
// safely, so they are removed outright.
const PARTIAL =
  /\b(faxed|sent|received|seen|dated|drawn|collected|on)\s+(\d{1,2})\/(\d{1,2})(?![\d/])/gi

export function findDates(text: string): FoundDate[] {
  const found: FoundDate[] = []
  for (const { re, read } of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const r = read(m)
      if (!r) continue
      const start = m.index,
        end = m.index + m[0].length
      if (found.some((f) => f.start < end && start < f.end)) continue
      found.push({ start, end, written: m[0], ...r })
    }
  }
  found.push(...rangeStarts(text, found))
  return found.sort((a, b) => a.start - b.start)
}

// Date-like strings that no pattern above could read: they must not pass the
// privacy step as written, and the reader must say the date was unreadable.
export const RESIDUAL_DATE = new RegExp(
  `\\b\\d{1,2}[-./]${MONTH}[-./]\\d{2,4}\\b|\\b${MONTH}[-./]\\d{1,2}[-./]\\d{2,4}\\b|\\b\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}\\b|\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b`,
  "gi",
)

export function partialDates(text: string) {
  return [...text.matchAll(PARTIAL)].map((m) => {
    const offset = m.index! + m[0].length - (m[2].length + 1 + m[3].length)
    return { start: offset, end: m.index! + m[0].length }
  })
}

export const addDays = (isoDate: string, days: number) =>
  new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10)

// Tokens use letters only, like the pinned library, so no tier re-matches them.
export function tokenName(index: number) {
  let n = index,
    s = ""
  do {
    s = String.fromCharCode(97 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `[date-${s}]`
}
