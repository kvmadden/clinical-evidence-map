const $ = (selector) => document.querySelector(selector)
const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
const append = (parent, ...children) => {
  parent.append(...children)
  return parent
}
const button = (text, action, className = "quiet") => {
  const node = el("button", className, text)
  node.addEventListener("click", action)
  return node
}
const fetchJson = async (url, options) => {
  const res = await fetch(url, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Request failed")
  return data
}
const notice = "draft, pending pharmacist review"
const pretty = (value) => value.replaceAll("_", " ").replaceAll("-", " ")
let groupLabels = {}
const groupName = (id) => groupLabels[id] || pretty(id)
const DATE_TYPES = new Set([
  "request_date",
  "conflicting_request_date",
  "fax_received_date",
  "measurement_date",
  "prior_start_date",
  "prior_stop_date",
  "prior_baseline_date",
  "prior_followup_date",
])
// Dates on screen come from the privacy step, shifted by a per-packet offset.
function showValue(e) {
  const v = e.value
  if (v && typeof v === "object") {
    if ("readings" in v)
      return `two readings: ${v.readings[0]} or ${v.readings[1]} (shifted)`
    if ("condition" in v)
      return `${v.condition}${v.certainty === "unconfirmed" ? " (unconfirmed)" : ""}`
    return `${v.name} ${v.value} ${v.unit}`
  }
  return DATE_TYPES.has(e.type) ? `${v} (shifted)` : String(v)
}
const percent = (n) => `${(100 * n).toFixed(1)}%`
let theme = localStorage.getItem("clinical-theme") || "light"
function setTheme() {
  document.documentElement.dataset.theme = theme
  $("#theme").textContent = theme === "light" ? "Dark mode" : "Light mode"
  $("#theme").setAttribute(
    "aria-label",
    `Switch to ${theme === "light" ? "dark" : "light"}`,
  )
}
setTheme()
$("#theme").onclick = () => {
  theme = theme === "light" ? "dark" : "light"
  localStorage.setItem("clinical-theme", theme)
  setTheme()
}
const main = $("#workspace")
function heading(eyebrow, title, description) {
  const header = el("header", "page-header")
  append(
    header,
    el("p", "eyebrow", eyebrow),
    el("h1", "", title),
    el("p", "intro", description),
  )
  return header
}
function draft() {
  return el("p", "draft", notice)
}
function metric(label, value, detail) {
  return append(
    el("div", "metric"),
    el("p", "small", label),
    el("strong", "", value),
    el("p", "small", detail),
  )
}
// A status is a plain word. The card beside it carries the margin mark.
const STATUS = {
  evidence_found: "Found",
  missing: "Not documented",
  needs_review: "Needs review",
}
function statusTag(status) {
  return el(
    "span",
    `badge status status-${status}`,
    STATUS[status] ?? pretty(status),
  )
}
const list = (numbers) =>
  numbers.length < 2
    ? String(numbers[0])
    : `${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}`
// Plain words for what arrived, from the coverage built from the OCR output.
function coverageText(c) {
  const total = c.pagesExpected
  const parts = []
  if (c.missingPages.length)
    parts.push(
      `${c.missingPages.length > 1 ? "Pages" : "Page"} ${list(c.missingPages)}${total ? ` of ${total}` : ""} ${c.missingPages.length > 1 ? "were" : "was"} not received.`,
    )
  else if (c.missingCount)
    parts.push(
      `${c.missingCount} page${c.missingCount > 1 ? "s" : ""}${total ? ` of ${total}` : ""} did not arrive, and the page counters do not show which.`,
    )
  if (c.duplicatePages.length)
    parts.push(
      `${c.duplicatePages.length > 1 ? "Pages" : "Page"} ${list(c.duplicatePages)} arrived more than once.`,
    )
  if (c.conflictingTotals.length)
    parts.push(
      `The page counters disagree on the total: ${list(c.conflictingTotals)}.`,
    )
  if (c.outOfOrder)
    parts.push(
      "The pages arrived in a different order than their counters give, and are shown as received.",
    )
  const unsure = c.pages
    .filter((p) => !p.orientation.handled)
    .map((p) => p.index + 1)
  if (unsure.length)
    parts.push(
      `OCR could not tell for sure which way up page ${list(unsure)} was.`,
    )
  if (!parts.length)
    parts.push(
      total
        ? `All ${total} pages received, as the page counters say.`
        : `${c.pagesReceived} pages received. No page counter gives a total to check.`,
    )
  return parts.join(" ")
}
async function queue() {
  const manifest = await fetchJson("/api/packets")
  groupLabels = Object.fromEntries(manifest.groups.map((g) => [g.id, g.label]))
  main.replaceChildren(
    heading(
      "NURSE REVIEW WORKSPACE / 01",
      "Your review queue",
      "Trace each finding to the fax. Resolve gaps and contradictions before recording your review.",
    ),
  )
  const context = append(
    el("div", "context-strip"),
    el("span", "", `${manifest.packets.length} synthetic packets`),
    el("span", "", "3 fictional criteria sets"),
    el("span", "", "No automated coverage decisions"),
  )
  main.append(context)
  const toolbar = el("div", "list-heading")
  append(toolbar, el("h2", "", "Packets awaiting review"), draft())
  main.append(toolbar)
  const list = el("div", "packet-list")
  for (const [index, packet] of manifest.packets.entries()) {
    const row = button(
      "",
      () => {
        location.href = `/?packet=${packet.packet_id}`
      },
      "packet-row",
    )
    row.setAttribute(
      "aria-label",
      `Open ${packet.packet_id} ${groupName(packet.group)}`,
    )
    append(
      row,
      el("span", "packet-number", String(index + 1).padStart(2, "0")),
      append(
        el("span", "packet-name"),
        el("strong", "", packet.packet_id),
        el("span", "small", pretty(packet.criteria_id)),
      ),
      el("span", "quality", groupName(packet.group)),
      el(
        "span",
        "badge review-state",
        packet.lastAction
          ? `${pretty(packet.lastAction)} recorded`
          : "Awaiting review",
      ),
      el("span", "arrow", "↗"),
    )
    list.append(row)
  }
  main.append(list)
  if (!manifest.examples?.length) return
  // Packets of several pages, built from development packet-018. They are
  // test fixtures, not part of either evaluation set.
  const examples = el("section", "examples")
  examples.setAttribute("aria-labelledby", "examples-heading")
  const title = el("h2", "", "Multi-page examples")
  title.id = "examples-heading"
  append(
    examples,
    append(
      el("div", "list-heading"),
      title,
      el("p", "small", manifest.examplesNote ?? ""),
    ),
  )
  const rows = el("div", "packet-list")
  for (const [index, packet] of manifest.examples.entries()) {
    const received = packet.tags
      .find((t) => t.startsWith("pages:"))
      ?.slice("pages:".length)
    const row = button(
      "",
      () => {
        location.href = `/?packet=${packet.packet_id}`
      },
      "packet-row",
    )
    row.setAttribute(
      "aria-label",
      `Open ${packet.packet_id}, ${packet.tags.includes("page-not-received") ? "a page missing" : "every page received"}`,
    )
    append(
      row,
      el("span", "packet-number", String(index + 1).padStart(2, "0")),
      append(
        el("span", "packet-name"),
        el("strong", "", packet.packet_id),
        el("span", "small", pretty(packet.criteria_id)),
      ),
      el(
        "span",
        "quality",
        packet.tags.includes("page-not-received")
          ? `${received} pages received, a page missing`
          : `${received} pages`,
      ),
      el(
        "span",
        "badge review-state",
        packet.lastAction
          ? `${pretty(packet.lastAction)} recorded`
          : "Awaiting review",
      ),
      el("span", "arrow", "↗"),
    )
    rows.append(row)
  }
  examples.append(rows)
  main.append(examples)
}
async function packet(id) {
  const data = await fetchJson(`/api/packets/${id}`)
  groupLabels = { [data.group]: data.groupLabel }
  const back = el("a", "back", "← All packets")
  back.href = "/"
  main.replaceChildren(
    back,
    heading(
      `NURSE REVIEW WORKSPACE / ${id.toUpperCase()}`,
      "Review the record",
      "Evidence for the fictional criteria, with the source always in reach.",
    ),
  )
  const strip = el("div", "context-strip")
  append(
    strip,
    el("span", "", data.policy.title),
    el("span", "", groupName(data.group)),
    ...(data.example
      ? [el("span", "", "Multi-page example, not in either evaluation set")]
      : []),
    draft(),
  )
  main.append(strip)
  const steps = el("div", "steps")
  for (const [i, name] of [
    "Packet received",
    "Evidence prepared",
    "Nurse review",
  ].entries())
    steps.append(
      append(
        el("div", i === 2 ? "step current" : "step done"),
        el("span", "", String(i + 1).padStart(2, "0")),
        el("strong", "", name),
      ),
    )
  main.append(steps)
  const workspace = el("div", "review-grid")
  const doc = el("section", "document panel")
  doc.setAttribute("aria-label", "Source document")
  const base = data.artifactBase || "/eval/artifacts/"
  // A packet of several pages lists each page. A one-page packet describes
  // its page with the OCR output's own fields.
  const pages = data.ocr.pages?.length
    ? data.ocr.pages
    : [
        {
          readImage: data.ocr.readImage || `${id}.png`,
          width: data.ocr.width,
          height: data.ocr.height,
          orientation: data.ocr.orientation,
          deskewDegrees: data.ocr.deskewDegrees,
          start: 0,
          end: Array.from(data.ocr.text).length,
        },
      ]
  const multi = pages.length > 1
  // A word's page, or the page its position in the text falls on when the
  // pipeline's word list carries no page number.
  const pageOf = (word) => word.page ?? pageAt(word.start)
  const coverage = data.coverage
  // Where each page starts in the redacted text. Redaction keeps every line
  // break, so a page starts on the same line there as in the OCR text.
  const points = Array.from(data.privacy.text)
  const ocrPoints = Array.from(data.ocr.text)
  const lineStarts = [0]
  points.forEach((c, i) => {
    if (c === "\n") lineStarts.push(i + 1)
  })
  const pageStarts = pages.map((p) => {
    const line = ocrPoints.slice(0, p.start).filter((c) => c === "\n").length
    return lineStarts[Math.min(line, lineStarts.length - 1)]
  })
  const pageAt = (offset) =>
    pageStarts.reduce((k, start, i) => (offset >= start ? i : k), 0)
  const docHeading = append(
    el("div", "panel-heading"),
    el("h2", "", "Source document"),
    el(
      "span",
      "small",
      multi
        ? `${pages.length} pages · synthetic fax-style page images`
        : "1 page · synthetic fax-style page image",
    ),
  )
  const overlayToggle = el("label", "toggle")
  const input = el("input")
  input.type = "checkbox"
  input.setAttribute("aria-label", "Confidence overlay")
  append(
    overlayToggle,
    input,
    el("span", "", `Confidence overlay · below ${data.ocr.threshold}%`),
  )
  const pdfLink = el(
    "a",
    "pdf-link",
    multi ? "Open packet PDF ↗" : "Open page PDF ↗",
  )
  pdfLink.href = `${base}${id}.pdf`
  pdfLink.target = "_blank"
  pdfLink.rel = "noopener"
  // One image per page, each with its own confidence and evidence layers.
  // Boxes are placed in that page's read image.
  const views = pages.map((page, index) => {
    const W = page.width || 1700,
      H = page.height || 2200
    const wrap = el("div", "image-wrap")
    const image = el("img")
    if (index === 0) image.id = "document-image"
    // Show the page as OCR read it, after any turn or straightening.
    image.src = `${base}${page.readImage}`
    image.alt = multi
      ? `Synthetic fax-style page ${index + 1} of ${pages.length} for ${id}, as read by OCR. Accessible redacted OCR text follows below.`
      : `Synthetic fax-style page image for ${id}, as read by OCR. Accessible redacted OCR text follows below.`
    image.width = W
    image.height = H
    const overlays = el("div", "overlays")
    overlays.setAttribute("aria-hidden", "true")
    const selected = el("div", "overlays")
    selected.setAttribute("aria-hidden", "true")
    const box = (bounds, cls) => {
      const b = el("span", cls)
      b.style.left = `${(100 * bounds.x) / W}%`
      b.style.top = `${(100 * bounds.y) / H}%`
      b.style.width = `${(100 * bounds.width) / W}%`
      b.style.height = `${(100 * bounds.height) / H}%`
      return b
    }
    for (const word of data.ocr.words.filter(
      (w) => w.needsReview && pageOf(w) === index,
    ))
      overlays.append(box(word.box, "confidence-box"))
    overlays.hidden = true
    append(wrap, image, overlays, selected)
    return { wrap, overlays, selected, box, figure: wrap }
  })
  input.onchange = () => {
    for (const v of views) v.overlays.hidden = !input.checked
  }
  let stack = views[0].wrap
  if (multi) {
    stack = el("div", "pages")
    stack.tabIndex = 0
    stack.setAttribute("role", "region")
    stack.setAttribute("aria-label", `Packet pages, ${pages.length} in order`)
    views.forEach((view, index) => {
      // Pages are numbered as received. A page's own counter follows.
      const facts = [
        `${coverage?.complete === false ? "Received page" : "Page"} ${index + 1} of ${pages.length}`,
      ]
      const counter = coverage?.pages[index]?.counter
      if (counter) facts.push(`marked ${counter.text}`)
      const turned = pages[index].orientation?.pageRotation
      if (turned) facts.push(`turned ${turned} degrees, read upright`)
      const low = coverage?.pages[index]?.lowConfidenceLines ?? []
      const lowLines = low.reduce((n, r) => n + r.to - r.from + 1, 0)
      if (lowLines)
        facts.push(
          `${lowLines} line${lowLines > 1 ? "s" : ""} below ${data.ocr.threshold}%`,
        )
      view.figure = append(
        el("figure", "page"),
        el("figcaption", "small", facts.join(" · ")),
        view.wrap,
      )
      stack.append(view.figure)
    })
  }
  const quote = el("blockquote", "", "Select evidence to inspect its source.")
  quote.id = "source-quote"
  quote.tabIndex = -1
  const sourceMeta = el(
    "p",
    "small",
    [
      "Exact source spans use the redacted OCR text below.",
      ...pages.map((page, index) => {
        const where = multi ? `page ${index + 1}` : "the page"
        return [
          page.orientation?.pageRotation
            ? `OCR found ${where} turned ${page.orientation.pageRotation} degrees and read it the right way up.`
            : "",
          page.deskewDegrees
            ? `OCR straightened ${where} by ${Math.abs(page.deskewDegrees)} degrees.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      }),
    ]
      .filter(Boolean)
      .join(" "),
  )
  const ocrDetails = el("details")
  const ocrSummary = el(
    "summary",
    "",
    `Redacted OCR text · ${data.ocr.words.filter((w) => w.needsReview).length} words need review`,
  )
  const ocrText = el("pre", "ocr-text")
  // The text box scrolls, so keyboard users must be able to reach it.
  ocrText.tabIndex = 0
  ocrText.setAttribute("aria-label", "Redacted OCR text")
  // The redacted text, page by page, with any selected spans marked.
  function renderText(spans) {
    ocrText.replaceChildren()
    const unique = [...new Map(spans.map((s) => [s.start, s])).values()].sort(
      (a, b) => a.start - b.start,
    )
    const bounds = [...pageStarts, points.length]
    for (let k = 0; k < pages.length; k++) {
      const from = bounds[k],
        to = bounds[k + 1]
      if (multi)
        ocrText.append(
          el("span", "page-label", `Page ${k + 1} of ${pages.length}`),
        )
      let cursor = from
      for (const span of unique) {
        const start = Math.max(span.start, from),
          end = Math.min(span.end, to)
        if (end <= start || start < cursor) continue
        ocrText.append(
          document.createTextNode(points.slice(cursor, start).join("")),
          el("mark", "", points.slice(start, end).join("")),
        )
        cursor = end
      }
      ocrText.append(document.createTextNode(points.slice(cursor, to).join("")))
    }
  }
  renderText([])
  append(ocrDetails, ocrSummary, ocrText)
  // Brings a highlighted box into view inside the page list.
  const reveal = (view, box) => {
    if (!multi || !box) return
    const top =
      box.getBoundingClientRect().top -
      stack.getBoundingClientRect().top +
      stack.scrollTop
    stack.scrollTop = Math.max(0, top - stack.clientHeight / 3)
  }
  const confidenceDetails = el("details")
  confidenceDetails.append(el("summary", "", "Inspect word confidence"))
  const confidenceWords = el("div", "confidence-words")
  for (const word of data.ocr.words) {
    const where = multi ? ` · page ${pageOf(word) + 1}` : ""
    const item = button(
      `${word.text} · ${word.confidence.toFixed(1)}%${where}`,
      () => {
        for (const v of views) v.selected.replaceChildren()
        const view = views[pageOf(word)]
        const b = view.box(word.box, "source-box")
        view.selected.append(b)
        reveal(view, b)
        quote.textContent = `OCR word${multi ? ` on page ${pageOf(word) + 1}` : ""}: ${word.text}. Confidence: ${word.confidence.toFixed(1)}%. ${word.needsReview ? "Review the image." : "Above the review threshold."}`
        quote.focus({ preventScroll: true })
      },
      word.needsReview ? "quiet uncertain-word" : "quiet",
    )
    confidenceWords.append(item)
  }
  confidenceDetails.append(confidenceWords)
  // What arrived, from the coverage the pipeline received with the OCR output.
  const coverageNote = coverage
    ? el(
        "p",
        coverage.complete ? "coverage-note" : "coverage-note warning",
        coverageText(coverage),
      )
    : null

  append(
    doc,
    docHeading,
    ...(coverageNote ? [coverageNote] : []),
    append(el("div", "document-tools"), overlayToggle, pdfLink),
    stack,
    quote,
    sourceMeta,
    ocrDetails,
    confidenceDetails,
  )
  const inspector = el("section", "inspector panel")
  inspector.setAttribute("aria-label", "Evidence inspector")
  const count = data.criteria.filter(
    (c) => c.status === "evidence_found",
  ).length
  append(
    inspector,
    append(
      el("div", "panel-heading"),
      el("h2", "", "Evidence inspector"),
      el("span", "badge", `${count} of 5 found`),
    ),
  )
  const tabs = el("div", "tabs")
  tabs.setAttribute("aria-label", "Inspector views")
  const content = el("div", "tab-content")
  content.id = "tab-content"
  const selectTarget = el("select")
  selectTarget.id = "review-target"
  const option = (value, label) => {
    const o = el("option", "", label)
    o.value = value
    selectTarget.append(o)
  }
  option("packet", "Whole packet")
  data.criteria.forEach((c) =>
    option(c.criterion_id, `Criterion: ${c.criterion_id}`),
  )
  data.entities.forEach((e) =>
    option(e.id, `${pretty(e.type)}: ${showValue(e)}`),
  )
  function inspect(spans, target) {
    // Each quoted span under highlighter, after its page on a long packet.
    quote.replaceChildren(
      ...spans.map((s) =>
        append(
          el("p"),
          ...(multi
            ? [el("span", "page-ref", `Page ${pageAt(s.start) + 1} · `)]
            : []),
          el("mark", "", s.text),
        ),
      ),
    )
    if (!spans.length)
      quote.textContent =
        "No source span found. Request the missing documentation."
    for (const v of views) v.selected.replaceChildren()
    let first = null
    for (const s of spans)
      for (const w of data.words.filter(
        (w) => w.start < s.end && w.end > s.start,
      )) {
        const view = views[pageOf(w)]
        const b = view.box(w.box, "source-box")
        view.selected.append(b)
        first ??= { view, b }
      }
    renderText(spans)
    selectTarget.value = target || "packet"
    quote.focus({ preventScroll: true })
    reveal(first?.view, first?.b)
    if (window.innerWidth < 900)
      quote.scrollIntoView({ block: "center", behavior: "instant" })
  }
  function renderEvidence() {
    const cards = el("div", "criteria-cards")
    for (const criterion of data.criteria) {
      const card = el("article", "criterion-card")
      card.dataset.status = criterion.status
      const policy = data.policy.criteria.find(
        (c) => c.id === criterion.criterion_id,
      )
      append(
        card,
        append(
          el("div", "card-top"),
          el("h3", "", pretty(criterion.criterion_id)),
          statusTag(criterion.status),
        ),
        el("p", "criterion-text", policy.text),
        el("p", "small", criterion.reason),
      )
      const source = button(
        criterion.evidence_spans.length
          ? `Inspect ${criterion.evidence_spans.length} source span${criterion.evidence_spans.length > 1 ? "s" : ""} ↗`
          : "Inspect missing evidence ↗",
        () => inspect(criterion.evidence_spans, criterion.criterion_id),
        "source-link",
      )
      source.setAttribute(
        "aria-label",
        `Show evidence for ${criterion.criterion_id}`,
      )
      card.append(source)
      cards.append(card)
    }
    const entities = el("details", "entities")
    entities.open = true
    entities.append(
      el("summary", "", `Extracted findings · ${data.entities.length}`),
    )
    for (const e of data.entities) {
      const row = button("", () => inspect([e.source_span], e.id), "entity-row")
      append(
        row,
        el("span", "small", pretty(e.type)),
        el("strong", "", showValue(e)),
      )
      if (e.match && e.match.kind !== "exact")
        row.append(
          el("span", "code", `${pretty(e.match.kind)}: ${e.match.written}`),
        )
      if (e.normalization)
        row.append(
          el(
            "span",
            "code",
            `${e.normalization.system} ${e.normalization.code}`,
          ),
        )
      entities.append(row)
    }
    content.replaceChildren(cards, entities)
  }
  function renderSummary() {
    content.replaceChildren(
      el("h3", "", "Cited summary"),
      draft(),
      el(
        "p",
        "small",
        "Every sentence is an exact source statement. This verifier checks citations and exact text, with no semantic inference.",
      ),
    )
    for (const [index, sentence] of data.summary.entries()) {
      const card = append(
        el("article", "criterion-card"),
        el("p", "", sentence.text),
        el(
          "p",
          sentence.supported ? "verified small" : "flagged small",
          sentence.reason,
        ),
      )
      card.append(
        button(
          `Source [${index + 1}]${sentence.needsReview ? " · review OCR" : ""} ↗`,
          () => inspect(sentence.citations),
          "source-link",
        ),
      )
      content.append(card)
    }
    if (!data.summary.length)
      content.append(
        el(
          "p",
          "",
          "No clinical statements extracted. Review the source document.",
        ),
      )
  }
  async function renderLog() {
    content.replaceChildren(el("p", "small", "Loading review log…"))
    try {
      const rows = await fetchJson(`/api/packets/${id}/reviews`)
      content.replaceChildren(
        el("h3", "", "Append-only review history"),
        el(
          "p",
          "small",
          "Local prototype reviewer. Actions do not approve coverage or mark pharmacist labels reviewed.",
        ),
      )
      if (!rows.length)
        content.append(el("p", "", "No review actions recorded yet."))
      for (const row of rows.toReversed())
        content.append(
          append(
            el("article", "criterion-card"),
            el("strong", "", `${pretty(row.action)} · ${row.target}`),
            el("p", "", row.note || "Accepted for this synthetic review."),
            el("p", "small", new Date(row.timestamp).toLocaleString()),
            el("p", "code", `Event ${row.hash.slice(0, 12)}`),
          ),
        )
    } catch (error) {
      content.replaceChildren(el("p", "error", error.message))
    }
  }
  const renderers = {
    Evidence: renderEvidence,
    Summary: renderSummary,
    "Review log": renderLog,
  }
  for (const [name, render] of Object.entries(renderers)) {
    const tab = button(
      name,
      () => {
        tabs
          .querySelectorAll("button")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === tab)))
        render()
      },
      "tab",
    )
    tab.setAttribute("aria-pressed", String(name === "Evidence"))
    tabs.append(tab)
  }
  append(inspector, tabs, content)
  renderEvidence()
  append(workspace, doc, inspector)
  main.append(workspace)
  const limits = append(
    el("div", "privacy-note"),
    el("strong", "", "Privacy affects evidence."),
    el(
      "span",
      "",
      "Names are removed. Every date the privacy step can read is shifted by a per-packet number of days, so intervals still work and real dates do not appear in findings. Names and dates in the image are fictional.",
    ),
  )
  main.append(limits)
  const review = el("section", "review-actions panel")
  review.setAttribute("aria-label", "Record review")
  const fields = el("div", "review-fields")
  const targetLabel = el("label", "", "Review target")
  targetLabel.htmlFor = selectTarget.id
  const noteLabel = el("label", "", "Review note")
  noteLabel.htmlFor = "review-note"
  const note = el("textarea")
  note.id = "review-note"
  note.placeholder = "Record a correction or explain what needs follow-up."
  note.rows = 2
  append(
    fields,
    append(el("div"), targetLabel, selectTarget),
    append(el("div"), noteLabel, note),
  )
  const actions = el("div", "action-buttons")
  const status = el("p", "save-status")
  status.setAttribute("role", "status")
  let busy = false
  for (const [label, action] of [
    ["Accept review", "accept"],
    ["Correct", "correct"],
    ["Flag", "flag"],
  ]) {
    const b = button(
      label,
      async () => {
        if (busy) return
        if (action !== "accept" && !note.value.trim()) {
          status.textContent = "Add a review note for a correction or flag."
          note.focus()
          return
        }
        busy = true
        actions.querySelectorAll("button").forEach((button) => {
          button.disabled = true
        })
        try {
          await fetchJson(`/api/packets/${id}/reviews`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              target: selectTarget.value,
              note: note.value,
            }),
          })
          status.textContent = `${action === "accept" ? "Acceptance" : action === "correct" ? "Correction" : "Flag"} saved to the append-only review log.`
          if (
            tabs
              .querySelector("button:last-child")
              .getAttribute("aria-pressed") === "true"
          )
            await renderLog()
        } catch (error) {
          status.textContent = error.message
        } finally {
          busy = false
          actions.querySelectorAll("button").forEach((button) => {
            button.disabled = false
          })
        }
      },
      action === "accept" ? "primary" : "quiet",
    )
    actions.append(b)
  }
  append(
    review,
    append(
      el("div", "review-heading"),
      el("h2", "", "Record your review"),
      draft(),
    ),
    fields,
    actions,
    status,
  )
  main.append(review)
}
async function gallery() {
  const [metrics, heldOut, failures] = await Promise.all([
    fetchJson("/api/metrics"),
    fetchJson("/api/heldout"),
    fetchJson("/api/failures"),
  ])
  main.replaceChildren(
    heading(
      `EVALUATION / ${metrics.packets} DEVELOPMENT PACKETS`,
      "Where the pipeline needs help",
      "Repeatable draft diagnostics on synthetic fax-style page images. These packets are development data. Each held-out set written by a different model shows its one blind score, taken before any rule changed after seeing it. There is no clinical validation.",
    ),
  )
  main.append(draft())
  const d = metrics.draftDiagnostics
  const grid = append(
    el("div", "metrics"),
    metric(
      "OCR character error rate",
      percent(d.ocr.cer),
      `${d.ocr.edits} edits / ${d.ocr.referenceCharacters} characters`,
    ),
    metric(
      "Clinical extraction F1",
      percent(d.extraction.f1),
      `${d.extraction.tp} matches / ${d.extraction.gold} draft entities`,
    ),
    metric(
      "Development status accuracy",
      percent(d.criteria.accuracy),
      `${d.criteria.correct} / ${d.criteria.total} draft statuses. Always answering found: ${d.criteria.alwaysFound.correct} / ${d.criteria.total}`,
    ),
    metric(
      "Evidence found, confirmed",
      percent(d.criteria.byStatus.evidence_found.recall),
      `${d.criteria.byStatus.evidence_found.hit} / ${d.criteria.byStatus.evidence_found.gold} labels. The rest went to review`,
    ),
    metric(
      "Said found when not",
      `${d.criteria.falseFound.count} / ${d.criteria.falseFound.of}`,
      "labels that are not evidence found",
    ),
    metric(
      "Not documented, caught",
      percent(d.criteria.byStatus.missing.recall),
      `${d.criteria.byStatus.missing.hit} / ${d.criteria.byStatus.missing.gold} labels`,
    ),
    metric(
      "Needs review, caught",
      percent(d.criteria.byStatus.needs_review.recall),
      `${d.criteria.byStatus.needs_review.hit} / ${d.criteria.byStatus.needs_review.gold} labels`,
    ),
    // A held-out score counts only once, and only from a valid first-score
    // record. Every later score on the same packets is a development result.
    ...heldOut.map((set) => {
      const first = set.first
      const scored = (s) =>
        `${s.correct} / ${s.total} on ${set.packets} packets written by a different model`
      if (!first)
        return metric(
          `${set.label}, no blind score`,
          percent(set.now.accuracy),
          `${scored(set.now)}, a development result. No valid blind record: ${set.firstMissing}.`,
        )
      return metric(
        set.role === "development"
          ? `${set.label}, before the rules change`
          : `${set.label} status accuracy`,
        percent(first.accuracy),
        [
          `${scored(first)}, scored once. Always answering found: ${first.alwaysFound.correct} / ${first.total}.`,
          set.role === "development"
            ? `Development data since ${new Date(`${set.since}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}.`
            : "",
          set.nowClass === "development"
            ? `Latest score ${set.now.correct} / ${set.now.total}, a development result.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
    }),
  )
  main.append(
    grid,
    el(
      "p",
      "privacy-note",
      `Development results on ${metrics.packets} generated packets. ${metrics.clinicalValidation.reviewedCriteria} of ${d.criteria.total} criterion labels carry a pharmacist review. The rest are drafts. The verifier caught ${d.verifier.caught} of ${d.verifier.injected} injected unsupported claims, by construction of its exact-quote rule, which does not measure clinical correctness.`,
    ),
  )
  groupLabels = Object.fromEntries(
    metrics.slices.group.map((g) => [g.value, g.label]),
  )
  const filterLabel = el("label", "", "Group")
  filterLabel.htmlFor = "quality-filter"
  const select = el("select")
  select.id = "quality-filter"
  for (const group of ["all", ...metrics.slices.group.map((s) => s.value)]) {
    const option = el(
      "option",
      "",
      group === "all" ? "All groups" : groupName(group),
    )
    option.value = group
    select.append(option)
  }
  const rows = el("div", "failure-grid")
  function render() {
    rows.replaceChildren()
    for (const p of failures.filter(
      (p) => select.value === "all" || p.group === select.value,
    )) {
      const card = append(
        el("article", "failure-card panel"),
        append(
          el("div", "card-top"),
          el("h2", "", p.packet_id),
          el("span", "badge", groupName(p.group)),
        ),
      )
      const list = el("ul")
      for (const f of p.failures) list.append(el("li", "miss", f))
      if (!p.failures.length)
        list.append(
          el(
            "li",
            "",
            "No mismatch against draft reference. This is not clinical validation.",
          ),
        )
      const link = el("a", "source-link", "Open packet ↗")
      link.href = `/?packet=${p.packet_id}`
      append(card, list, link)
      rows.append(card)
    }
  }
  select.onchange = render
  main.append(append(el("div", "filter"), filterLabel, select), rows)
  render()
}
try {
  const params = new URLSearchParams(location.search)
  if (params.get("view") === "failures") await gallery()
  else if (params.get("packet")) await packet(params.get("packet"))
  else await queue()
} catch (error) {
  main.replaceChildren(
    heading(
      "WORKSPACE UNAVAILABLE",
      "The packet could not be loaded",
      error.message,
    ),
    el(
      "p",
      "",
      "Run npm run eval to prepare the synthetic artifacts, then reload.",
    ),
  )
  const retry = button("Reload workspace", () => location.reload())
  main.append(retry)
}
