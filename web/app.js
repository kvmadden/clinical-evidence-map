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
function statusTag(status) {
  return el(
    "span",
    `badge ${status}`,
    status === "evidence_found"
      ? "Evidence found"
      : status === "missing"
        ? "Missing"
        : "Needs review",
  )
}
async function queue() {
  const manifest = await fetchJson("/api/packets")
  main.replaceChildren(
    heading(
      "NURSE REVIEW WORKSPACE / 01",
      "Your review queue",
      "Trace each finding to the fax. Resolve gaps and contradictions before recording your review.",
    ),
  )
  const context = append(
    el("div", "context-strip"),
    el("span", "", "50 synthetic packets"),
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
      `Open ${packet.packet_id} ${pretty(packet.quality_group)}`,
    )
    append(
      row,
      el("span", "packet-number", String(index + 1).padStart(2, "0")),
      append(
        el("span", "packet-name"),
        el("strong", "", packet.packet_id),
        el("span", "small", pretty(packet.criteria_id)),
      ),
      el("span", "quality", pretty(packet.quality_group)),
      el(
        "span",
        "badge needs_review",
        packet.lastAction
          ? `${pretty(packet.lastAction)} recorded`
          : "Awaiting review",
      ),
      el("span", "arrow", "↗"),
    )
    list.append(row)
  }
  main.append(list)
}
async function packet(id) {
  const data = await fetchJson(`/api/packets/${id}`)
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
    el("span", "", pretty(data.quality_group)),
    draft(),
  )
  main.append(strip)
  const steps = el("div", "steps")
  for (const [i, name] of [
    "Fax received",
    "Evidence prepared",
    "Nurse review",
  ].entries())
    steps.append(
      append(
        el("div", i === 2 ? "step current" : "step"),
        el("span", "", String(i + 1).padStart(2, "0")),
        el("strong", "", name),
      ),
    )
  main.append(steps)
  const workspace = el("div", "review-grid")
  const doc = el("section", "document panel")
  doc.setAttribute("aria-label", "Source document")
  const docHeading = append(
    el("div", "panel-heading"),
    el("h2", "", "Source document"),
    el("span", "small", "1 page · synthetic fax"),
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
  const pdfLink = el("a", "pdf-link", "Open fax PDF ↗")
  pdfLink.href = `/eval/artifacts/${id}.pdf`
  pdfLink.target = "_blank"
  pdfLink.rel = "noopener"
  const imageWrap = el("div", "image-wrap")
  const image = el("img")
  image.id = "document-image"
  image.src = `/eval/artifacts/${id}.png`
  image.alt = `Synthetic fax for ${id}. Accessible redacted OCR text follows below.`
  image.width = 1700
  image.height = 2200
  const overlays = el("div", "overlays")
  overlays.setAttribute("aria-hidden", "true")
  const selected = el("div", "overlays")
  selected.setAttribute("aria-hidden", "true")
  const box = (bounds, cls) => {
    const b = el("span", cls)
    b.style.left = `${bounds.x / 17}%`
    b.style.top = `${bounds.y / 22}%`
    b.style.width = `${bounds.width / 17}%`
    b.style.height = `${bounds.height / 22}%`
    return b
  }
  for (const word of data.ocr.words.filter((w) => w.needsReview))
    overlays.append(box(word.box, "confidence-box"))
  overlays.hidden = true
  input.onchange = () => {
    overlays.hidden = !input.checked
  }
  append(imageWrap, image, overlays, selected)
  const quote = el("blockquote", "", "Select evidence to inspect its source.")
  quote.id = "source-quote"
  quote.tabIndex = -1
  const sourceMeta = el(
    "p",
    "small",
    "Exact source spans use the redacted OCR text below.",
  )
  const ocrDetails = el("details")
  const ocrSummary = el(
    "summary",
    "",
    `Redacted OCR text · ${data.ocr.words.filter((w) => w.needsReview).length} words need review`,
  )
  const ocrText = el("pre", "ocr-text", data.privacy.text)
  append(ocrDetails, ocrSummary, ocrText)
  const confidenceDetails = el("details")
  confidenceDetails.append(el("summary", "", "Inspect word confidence"))
  const confidenceWords = el("div", "confidence-words")
  for (const word of data.ocr.words) {
    const item = button(
      `${word.text} · ${word.confidence.toFixed(1)}%`,
      () => {
        selected.replaceChildren(box(word.box, "source-box"))
        quote.textContent = `OCR word: ${word.text}. Confidence: ${word.confidence.toFixed(1)}%. ${word.needsReview ? "Review the image." : "Above the review threshold."}`
        quote.focus({ preventScroll: true })
      },
      word.needsReview ? "quiet uncertain-word" : "quiet",
    )
    confidenceWords.append(item)
  }
  confidenceDetails.append(confidenceWords)

  append(
    doc,
    docHeading,
    append(el("div", "document-tools"), overlayToggle, pdfLink),
    imageWrap,
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
    option(
      e.id,
      `${pretty(e.type)}: ${typeof e.value === "object" ? e.value.name : e.value}`,
    ),
  )
  function inspect(spans, target) {
    quote.replaceChildren(...spans.map((s) => el("p", "", s.text)))
    if (!spans.length)
      quote.textContent =
        "No source span found. Request the missing documentation."
    selected.replaceChildren()
    const spanRanges = spans.flatMap((s) =>
      data.words
        .filter((w) => w.start < s.end && w.end > s.start)
        .map((w) => w.box),
    )
    spanRanges.forEach((b) => selected.append(box(b, "source-box")))
    ocrText.replaceChildren()
    let cursor = 0
    const unique = [...new Map(spans.map((s) => [s.start, s])).values()].sort(
      (a, b) => a.start - b.start,
    )
    const points = Array.from(data.privacy.text)
    for (const span of unique) {
      if (span.start < cursor) continue
      ocrText.append(
        document.createTextNode(points.slice(cursor, span.start).join("")),
        el("mark", "", span.text),
      )
      cursor = span.end
    }
    ocrText.append(document.createTextNode(points.slice(cursor).join("")))
    selectTarget.value = target || "packet"
    quote.focus({ preventScroll: true })
    if (window.innerWidth < 900)
      quote.scrollIntoView({ block: "center", behavior: "instant" })
  }
  function renderEvidence() {
    const cards = el("div", "criteria-cards")
    for (const criterion of data.criteria) {
      const card = el("article", "criterion-card")
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
      const value =
        typeof e.value === "object"
          ? `${e.value.name} ${e.value.value} ${e.value.unit}`
          : String(e.value)
      append(row, el("span", "small", pretty(e.type)), el("strong", "", value))
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
      "The upstream privacy gate removes dates. Timing rules need review. Names and dates in the image are fictional.",
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
  const [metrics, failures] = await Promise.all([
    fetchJson("/api/metrics"),
    fetchJson("/api/failures"),
  ])
  main.replaceChildren(
    heading(
      "EVALUATION / 50 DEVELOPMENT PACKETS",
      "Where the pipeline needs help",
      "Repeatable draft diagnostics. These templates are development data, with no independent holdout or clinical validation.",
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
      "Criterion status accuracy",
      percent(d.criteria.accuracy),
      `${d.criteria.correct} / ${d.criteria.total} draft statuses`,
    ),
    metric(
      "Verifier mutation catch rate",
      percent(d.verifier.catchRate),
      `${d.verifier.caught} / ${d.verifier.injected} injected claims`,
    ),
  )
  main.append(
    grid,
    el(
      "p",
      "privacy-note",
      "No pharmacist-reviewed labels yet. The verifier rejects text that differs from an exact citation. Its mutation score does not measure clinical correctness.",
    ),
  )
  const filterLabel = el("label", "", "Quality group")
  filterLabel.htmlFor = "quality-filter"
  const select = el("select")
  select.id = "quality-filter"
  for (const group of ["all", ...metrics.slices.map((s) => s.group)]) {
    const option = el("option", "", pretty(group))
    option.value = group
    select.append(option)
  }
  const rows = el("div", "failure-grid")
  function render() {
    rows.replaceChildren()
    for (const p of failures.filter(
      (p) => select.value === "all" || p.quality_group === select.value,
    )) {
      const card = append(
        el("article", "failure-card panel"),
        append(
          el("div", "card-top"),
          el("h2", "", p.packet_id),
          el("span", "badge", pretty(p.quality_group)),
        ),
      )
      const list = el("ul")
      for (const f of p.failures) list.append(el("li", "", f))
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
