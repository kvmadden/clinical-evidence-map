import { readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { crosscheck } from "./crosscheck.mjs"
import { SETS } from "./sets.mjs"
import { BLIND, readFirstScore } from "./records.mjs"
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"))
// Optional files, such as the second held-out set's, are read only once they exist.
const maybe = async (file) => (existsSync(file) ? readJson(file) : null)
// Builds docs/EVALUATION.md from saved results only. The roots exist so a
// test can point at stand-in sets. The second held-out set is read from
// v2Root only when it exists there.
export async function buildReport({
  heldRoot = SETS.holdout.root,
  v2Root = SETS["holdout-v2"].root,
} = {}) {
  const metrics = await readJson("eval/results/metrics.json")
  const latency = await readJson("eval/results/latency.json")
  const prev = await readJson("eval/results/previous-2b4d487.json")
  const manifest = await readJson("eval/manifest.json")
  const held = await readJson(`${heldRoot}/results/metrics.json`)
  const frozen = await readJson(`${heldRoot}/FREEZE.json`)
  const cross = await crosscheck()
  // The first held-out set's one blind score, kept apart from any later
  // score. It counts only if its record is valid for the set as it stands.
  // Otherwise every score shown for the set is a development result.
  const firstStatus = await readFirstScore(heldRoot)
  const blind = firstStatus.valid
  const firstRecord = blind ? firstStatus.record : null
  const first = blind ? firstRecord.metrics : held
  const role = await maybe(`${heldRoot}/ROLE.json`)
  const sameScore = (a, b) =>
    JSON.stringify([
      a.draftDiagnostics.criteria,
      a.draftDiagnostics.sourceTextBaseline.criteria,
    ]) ===
    JSON.stringify([
      b.draftDiagnostics.criteria,
      b.draftDiagnostics.sourceTextBaseline.criteria,
    ])
  const heldChanged = blind && !sameScore(first, held)
  const heldLater = held.run?.class !== BLIND
  // The second held-out set, written blind by other model families. Read only
  // once it exists.
  const v2Now = await maybe(`${v2Root}/results/metrics.json`)
  const v2Status = v2Now ? await readFirstScore(v2Root) : null
  const v2Blind = Boolean(v2Status?.valid)
  const v2Record = v2Blind ? v2Status.record : null
  const v2 = v2Blind ? v2Record.metrics : v2Now
  const v2Role = v2Now ? await maybe(`${v2Root}/ROLE.json`) : null
  const v2Changed = v2Blind && !sameScore(v2, v2Now)
  const fixtureRoot = SETS.multipage.root
  const fixture = await maybe(`${fixtureRoot}/results/metrics.json`)

  const hd = first.draftDiagnostics
  const hc = hd.criteria
  const d = metrics.draftDiagnostics
  const c = d.criteria
  const pct = (n, of) => (of ? `${((100 * n) / of).toFixed(1)}%` : "n/a")
  const frac = (n, of) => `${n} / ${of} (${pct(n, of)})`
  const recall = (s, status) =>
    frac(s.byStatus[status].hit, s.byStatus[status].gold)
  const total = c.total
  const counts = c.byStatus
  const pc = prev.criteria
  const row = (cells) => `| ${cells.join(" | ")} |`
  const dayMonth = (iso) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
  const sliceRows = (slices, name) =>
    slices
      .filter((s) => s.criteria.total)
      .map((s) =>
        row([
          name(s),
          s.packets ?? "",
          s.ocr ? pct(s.ocr.edits, s.ocr.referenceCharacters) : "",
          s.extraction
            ? s.extraction.gold
              ? pct(
                  2 * s.extraction.tp,
                  s.extraction.predicted + s.extraction.gold,
                )
              : "not labeled"
            : "",
          frac(s.criteria.correct, s.criteria.total),
          frac(s.criteria.alwaysFound.correct, s.criteria.total),
          s.criteria.byStatus.missing.gold
            ? frac(
                s.criteria.byStatus.missing.hit,
                s.criteria.byStatus.missing.gold,
              )
            : "none",
          s.criteria.byStatus.needs_review.gold
            ? frac(
                s.criteria.byStatus.needs_review.hit,
                s.criteria.byStatus.needs_review.gold,
              )
            : "none",
          `${s.criteria.falseFound.count} / ${s.criteria.falseFound.of}`,
        ]),
      )
      .join("\n")
  const HEAD = `| Slice | Packets | OCR CER | Extraction F1 | Statuses correct | Always "found" | Not documented caught | Needs review caught | Said found when not |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |`
  const tagName = {
    "page:letter": "Letter layout",
    "page:form": "Form layout with fields",
    "date:iso": "Dates as 2026-10-01",
    "date:us-slash": "Dates as 10/01/2026",
    "date:us-short": "Dates as 10-1-26",
    "date:day-first": "Dates day first, as 01/10/2026",
    "date:text-dmy": "Dates as 1 Oct 2026",
    "date:text-mdy": "Dates as Oct 1, 2026",
    "date-reading:none": "No ambiguous numeric date",
    "date-reading:forced": "Ambiguous dates settled by a day above 12",
    "date-reading:header": "Ambiguous dates settled by the received date",
    "date-reading:unresolved": "Ambiguous dates nothing settles",
    "drug-name:generic": "Drug written as generic name",
    "drug-name:brand": "Drug written as brand name",
    "dose-format:plain": "Dose written as in the rule",
    "dose-format:compact": "Dose with no space, as 140mg",
    "dose-format:route": "Dose with route and frequency codes",
    "dose-format:sig": "Dose as a sig, as 2 tabs PO BID",
    "blank-field": "Has a blank form field",
    misspelling: "Has a misspelling a pharmacist would accept",
    "look-alike-name": "Has a look-alike drug name",
    "ai-drawn-handwriting": "Has AI-drawn handwriting",
    "fax-style-header": "Has a typed fax-style header line",
  }
  const prevSlices = prev.slices
    .map((s) =>
      row([
        s.label,
        s.packets,
        pct(s.cer, 1),
        pct(s.extractionF1, 1),
        frac(s.criteria.correct, s.criteria.total),
        frac(s.criteria.alwaysFound, s.criteria.total),
      ]),
    )
    .join("\n")
  const scen = metrics.slices.scenario
    .map((s) => {
      const [criterion, scenario] = s.value.split(":")
      const g = Object.entries(s.criteria.byStatus).find(([, v]) => v.gold)?.[0]
      return row([
        criterion,
        scenario.replaceAll("-", " "),
        g ? g.replace("_", " ") : "",
        frac(s.criteria.correct, s.criteria.total),
      ])
    })
    .join("\n")
  const o = d.privacy.overRedaction

  // The sets side by side. A held-out set shows its first score. A later score
  // on the same packets is a development result and gets its own column.
  const firstLabel = !blind
    ? `First held-out set, ${first.packets} packets, latest score, a development result`
    : role?.role === "development"
      ? `First held-out set, ${first.packets} packets, blind score before the rules change`
      : `First held-out set, ${first.packets} packets, blind score`
  const columns = [
    { head: `Development, ${metrics.packets} packets`, m: metrics },
    { head: firstLabel, m: first },
    ...(heldChanged
      ? [{ head: "First held-out set now, a development result", m: held }]
      : []),
    ...(v2
      ? [
          {
            head: !v2Blind
              ? `Second held-out set, ${v2.packets} packets, latest score, a development result`
              : v2Role?.role === "development"
                ? `Second held-out set, ${v2.packets} packets, blind score before the rules change`
                : `Second held-out set, ${v2.packets} packets, blind score`,
            m: v2,
          },
        ]
      : []),
    ...(v2Changed
      ? [{ head: "Second held-out set now, a development result", m: v2Now }]
      : []),
  ]
  const measure = (name, cell) =>
    row([name, ...columns.map(({ m }) => cell(m.draftDiagnostics, m))])
  const quotesOf = (dd) =>
    dd.quotes ? frac(dd.quotes.reproduced, dd.quotes.total) : "not counted"
  const mainTable = [
    row(["Measure", ...columns.map((col) => col.head)]),
    row(["---", ...columns.map(() => "---")]),
    measure(
      "Every finding points to its source: extracted values, evidence links and summary citations whose quote reproduces from the redacted page",
      quotesOf,
    ),
    measure("Criterion statuses correct", (dd) =>
      frac(dd.criteria.correct, dd.criteria.total),
    ),
    measure('Always answering "found"', (dd) =>
      frac(dd.criteria.alwaysFound.correct, dd.criteria.total),
    ),
    measure("Evidence found, confirmed", (dd) =>
      recall(dd.criteria, "evidence_found"),
    ),
    measure("Not documented, caught", (dd) => recall(dd.criteria, "missing")),
    measure("Needs review, caught", (dd) =>
      recall(dd.criteria, "needs_review"),
    ),
    measure(
      'Said "found" where the label is not',
      (dd) => `${dd.criteria.falseFound.count} / ${dd.criteria.falseFound.of}`,
    ),
    measure(
      'Said "not documented" where the label is found or needs review',
      (dd) => frac(dd.criteria.falseMissing.count, dd.criteria.falseMissing.of),
    ),
    measure("Sent to review", (dd) =>
      frac(dd.criteria.sentToReview.count, dd.criteria.sentToReview.of),
    ),
    measure(
      "Answers given: found, not documented, needs review",
      (dd) =>
        `${dd.criteria.byStatus.evidence_found.predicted}, ${dd.criteria.byStatus.missing.predicted}, ${dd.criteria.byStatus.needs_review.predicted} of ${dd.criteria.total}`,
    ),
    measure("Status and exact quotes correct", (dd) =>
      frac(dd.criteria.statusAndQuotes, dd.criteria.total),
    ),
    measure("Same services on source text, statuses correct", (dd) =>
      frac(
        dd.sourceTextBaseline.criteria.correct,
        dd.sourceTextBaseline.criteria.total,
      ),
    ),
    measure(
      'Same services on source text, said "not documented" where the label is found or needs review',
      (dd) =>
        frac(
          dd.sourceTextBaseline.criteria.falseMissing.count,
          dd.sourceTextBaseline.criteria.falseMissing.of,
        ),
    ),
    measure("OCR character error rate", (dd) =>
      frac(dd.ocr.edits, dd.ocr.referenceCharacters),
    ),
    measure("Page orientation read correctly", (dd) =>
      frac(dd.ocr.orientation.correct, dd.ocr.orientation.total),
    ),
    measure(
      "Clinical words hidden as [name], source text",
      (dd) =>
        `${dd.privacy.overRedaction.source.overRedacted} of ${dd.privacy.overRedaction.source.nameTokens} tokens`,
    ),
  ].join("\n")

  // Label status down, answer across, for the OCR run and the source-text run.
  const STATUS = [
    ["evidence_found", "Evidence found"],
    ["missing", "Not documented"],
    ["needs_review", "Needs review"],
  ]
  const STATUS_WORDS = {
    evidence_found: "evidence found",
    missing: "not documented",
    needs_review: "needs review",
  }
  const confusionTable = (title, dd) => {
    const ocr = dd.criteria.confusion,
      src = dd.sourceTextBaseline.criteria.confusion
    const answers = (cm) =>
      STATUS.map(([a]) => STATUS.reduce((n, [l]) => n + cm[l][a], 0))
    return [
      `**${title}.** Each row is a draft label status, each column what the tool answered.`,
      "",
      "| Label | OCR: found | OCR: not documented | OCR: needs review | Source text: found | Source text: not documented | Source text: needs review | Labels |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...STATUS.map(([l, name]) =>
        row([
          name,
          ...STATUS.map(([a]) => ocr[l][a]),
          ...STATUS.map(([a]) => src[l][a]),
          dd.criteria.byStatus[l].gold,
        ]),
      ),
      row(["Answers", ...answers(ocr), ...answers(src), dd.criteria.total]),
    ].join("\n")
  }
  const confusionTables = columns
    .map((col) => confusionTable(col.head, col.m.draftDiagnostics))
    .join("\n\n")

  // Counts per criterion, for each set: labels, answers, and the two runs.
  const criterionTable = (title, m) => {
    const src = Object.fromEntries(
      m.draftDiagnostics.sourceTextBaseline.criterion.map((s) => [
        s.value,
        s.criteria,
      ]),
    )
    const three = (s, key) =>
      STATUS.map(([status]) => s.byStatus[status][key]).join(", ")
    return [
      `**${title}.**`,
      "",
      '| Criterion | Labels: found, not documented, review | Answers: found, not documented, review | Statuses correct | Said "not documented" where found or review | Sent to review | Source text correct | Source text said "not documented" where found or review |',
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...m.slices.criterion.map((s) =>
        row([
          s.value,
          three(s.criteria, "gold"),
          three(s.criteria, "predicted"),
          frac(s.criteria.correct, s.criteria.total),
          `${s.criteria.falseMissing.count} / ${s.criteria.falseMissing.of}`,
          `${s.criteria.sentToReview.count} / ${s.criteria.sentToReview.of}`,
          frac(src[s.value].correct, src[s.value].total),
          `${src[s.value].falseMissing.count} / ${src[s.value].falseMissing.of}`,
        ]),
      ),
    ].join("\n")
  }
  const criterionTables = columns
    .map((col) => criterionTable(col.head, col.m))
    .join("\n\n")

  // List each label where the pipeline said found and the draft label did not.
  const falseFound = []
  const sets = [
    ["Development", "eval", manifest.packets.map((p) => p.packet_id)],
    [
      heldChanged ? "First held-out set, latest score" : "First held-out set",
      heldRoot,
      (await readJson(`${heldRoot}/manifest.json`)).packets.map(
        (p) => p.packet_id,
      ),
    ],
    ...(v2Now
      ? [
          [
            "Second held-out set",
            v2Root,
            (await readJson(`${v2Root}/manifest.json`)).packets.map(
              (p) => p.packet_id,
            ),
          ],
        ]
      : []),
  ]
  for (const [set, dir, ids] of sets) {
    for (const id of ids) {
      const r = await readJson(`${dir}/results/${id}.json`)
      const g = await readJson(`${dir}/gold/${id}.json`)
      for (const label of g.criterion_evidence) {
        const p = r.criteria.find((x) => x.criterion_id === label.criterion_id)
        if (p.status === "evidence_found" && label.status !== "evidence_found")
          falseFound.push(
            `| ${set} | ${id} | ${r.groupLabel ?? r.group} | ${label.criterion_id} | ${label.reason} | ${p.reason} |`,
          )
      }
    }
  }
  // Before the stage D reader, 3 development answers and 1 in the first
  // held-out set's blind run said "found" where the label did not. The
  // history stays on the page whether or not the current results have any.
  const falseFoundHistory = `Before the stage D reader there were 3 such answers on the development set, each a medication list line that conflicted with the request but could not be parsed: AI-drawn handwriting OCR could not read, "qwk" read as "gw" on a choppy page, and "every other week" read as "every choses" beside drawn marks. In the first held-out set's blind run there was 1, "stopped for an inadequate response" read as an intolerance with a reason. The reader now sends the dose to review when a medication list line for the requested drug cannot be read, and reads stopping for an inadequate response as an efficacy outcome. Both fixes were made after seeing these sets, so they show on development data only. A result on a set the fixes were not written against is the one that will count.`
  const falseFoundRows = falseFound.length
    ? `| Set | Packet | Group | Criterion | Draft label says | Pipeline said |
| --- | --- | --- | --- | --- | --- |
${falseFound.join("\n")}

${falseFoundHistory}`
    : `None in the current results.

${falseFoundHistory}`

  // What arrived and what OCR could read, for each set that was scored.
  const coverageSets = [
    ["Development", metrics],
    ["First held-out set", held],
    ...(v2Now ? [["Second held-out set", v2Now]] : []),
    ...(fixture ? [["Multi-page fixture", fixture]] : []),
  ]
  const cov = (m) => m.draftDiagnostics.coverage
  const coverageRow = (name, cell) =>
    row([name, ...coverageSets.map(([, m]) => cell(cov(m), m))])
  const coverageTable = [
    row(["Measure", ...coverageSets.map(([name]) => name)]),
    row(["---", ...coverageSets.map(() => "---")]),
    coverageRow(
      "Pages received",
      (v, m) => `${v.pagesReceived} in ${m.packets} packets`,
    ),
    coverageRow(
      "Packets with a page counter read",
      (v, m) => `${v.packetsWithPageCounter} of ${m.packets}`,
    ),
    coverageRow(
      "Packets with a page missing, a counter conflict or a turn not settled",
      (v, m) =>
        `${v.incompletePackets.length} of ${m.packets}${v.incompletePackets.length ? `: ${v.incompletePackets.join(", ")}` : ""}`,
    ),
    coverageRow("Pages missing, as the counters say", (v) => v.pagesMissing),
    coverageRow("Pages whose turn was chosen by a clear margin", (v) =>
      frac(v.orientationHandled.pages, v.orientationHandled.of),
    ),
    coverageRow(
      "OCR lines with a word below 80% confidence, the review threshold",
      (v) =>
        frac(
          v.ocrLinesWithLowConfidenceWord.lines,
          v.ocrLinesWithLowConfidenceWord.of,
        ),
    ),
    coverageRow("OCR lines where every word is below that threshold", (v) =>
      frac(v.ocrLinesUnreadable.lines, v.ocrLinesUnreadable.of),
    ),
    coverageRow("Source lines OCR did not give back, evaluation only", (v) =>
      frac(v.unreadSourceLines.lines, v.unreadSourceLines.of),
    ),
    coverageRow(
      "Of those, places the coverage already marks as low confidence",
      (v) =>
        `${v.unreadSourceLines.flaggedByCoverage} of ${v.unreadSourceLines.lines}`,
    ),
  ].join("\n")
  const unread = coverageSets.flatMap(([name, m]) =>
    cov(m).unreadSourceLines.examples.map((e) => `- ${name}: ${e}`),
  )
  const silent = coverageSets.reduce(
    (n, [, m]) =>
      n +
      cov(m).unreadSourceLines.lines -
      cov(m).unreadSourceLines.flaggedByCoverage,
    0,
  )

  // The multi-page fixture, packet by packet.
  let fixtureSection = ""
  if (fixture) {
    const fixtureManifest = await readJson(`${fixtureRoot}/manifest.json`)
    const fixtureRows = []
    // The second packet's prior and dose answers, for the paragraph below.
    let lostPage = { prior: "", priorReason: "", dose: "", doseReason: "" }
    for (const p of fixtureManifest.packets) {
      const r = await readJson(`${fixtureRoot}/results/${p.packet_id}.json`)
      const g = await readJson(`${fixtureRoot}/gold/${p.packet_id}.json`)
      const cv = r.coverage
      const mismatches = g.criterion_evidence
        .map((label) => {
          const answer = r.criteria.find(
            (x) => x.criterion_id === label.criterion_id,
          )
          if (cv.missingPages.length && label.criterion_id === "prior") {
            lostPage.prior = STATUS_WORDS[answer.status]
            lostPage.priorReason = answer.reason
          }
          if (cv.missingPages.length && label.criterion_id === "dose") {
            lostPage.dose = STATUS_WORDS[answer.status]
            lostPage.doseReason = answer.reason
          }
          return answer.status === label.status
            ? null
            : `${label.criterion_id}: label ${STATUS_WORDS[label.status]}, answered ${STATUS_WORDS[answer.status]}`
        })
        .filter(Boolean)
      fixtureRows.push(
        row([
          p.packet_id,
          `${cv.pagesReceived} of ${cv.pagesExpected ?? "unstated"}`,
          cv.pages.map((page) => page.counter?.text ?? "none").join(", "),
          cv.missingPages.length ? cv.missingPages.join(", ") : "none",
          pct(r.scores.edits, r.scores.chars),
          `${r.scores.criteria.correct} / ${r.scores.criteria.total}`,
          mismatches.length ? mismatches.join(". ") : "none",
        ]),
      )
    }
    fixtureSection = `## Multi-page check

${fixtureManifest.description} The two packets are development text, so these are development results. A line holding only \`<<page>>\` starts a new page in the packet text. Each page is drawn with the same page size, effects and font, with its own seeded noise, and OCR reads each page on its own. The page texts are joined in order, every word keeps its page number, and quotes and offsets point into the joined text, so the same checks apply as for one page.

| Packet | Pages received | Page counters read | Pages reported missing | OCR CER | Statuses correct | Mismatches |
| --- | --- | --- | --- | --- | --- | --- |
${fixtureRows.join("\n")}

The labels on the second packet follow Kevin's rule of 3 November 2026: "not documented" may only be answered once the whole packet was read. With page 2 missing, a criterion with nothing on the pages received needs review. The coverage record reports page 2 of 3 as missing, and the reading rules use it: prior therapy is answered ${lostPage.prior}, with the reason "${lostPage.priorReason}" The dose label stays evidence found on the pages received, although the medication list that disagreed with it was on the missing page. The pipeline answered the dose ${lostPage.dose}: "${lostPage.doseReason}" Whether a found answer should stand while a page is missing, with the packet marked incomplete, or go to review is Kevin's open decision. For now it stands, and the packet is marked incomplete. Every quote in the fixture results reproduces from the redacted text: ${frac(fixture.draftDiagnostics.quotes.reproduced, fixture.draftDiagnostics.quotes.total)}.
`
  }

  const sb = d.sourceTextBaseline.criteria
  const heldNow = held.draftDiagnostics.criteria
  const v2Paragraph = !v2Now
    ? `A second held-out set is being written blind by other model families. \`npm run eval -- --set holdout-v2\` scores it once its packets, labels and freeze are committed. Its first run reads every page again, is recorded once with the freeze and every file it covers, and every later run is a development result. It has not run, so this page has no result for it yet.`
    : !v2Blind
      ? `The second held-out set has been scored, but it has no valid blind score here: ${v2Status.reason}. Every score on it shown on this page is a development result.`
      : `The second held-out set has ${v2.packets} packets, frozen under sha256 \`${v2Record.identity.frozenSha256}\` before its first run and first scored on ${dayMonth(v2Record.scoredOn)} at ${v2Record.commit}. Its blind score is ${frac(v2.draftDiagnostics.criteria.correct, v2.draftDiagnostics.criteria.total)} statuses correct, against ${frac(v2.draftDiagnostics.criteria.alwaysFound.correct, v2.draftDiagnostics.criteria.total)} for always answering "found".${v2Now.run?.class !== BLIND ? ` Its latest score, a development result, is ${frac(v2Now.draftDiagnostics.criteria.correct, v2Now.draftDiagnostics.criteria.total)}${v2Changed ? ", shown in its own column." : ", the same as the blind score."}` : ""}${v2Role?.role === "development" ? ` From ${dayMonth(v2Role.since)} it is development data. ${v2Role.reason}` : ""}`
  const roleParagraph = !blind
    ? `**The first held-out set has no valid blind score here: ${firstStatus.reason}.** Every score on it shown on this page is a development result.`
    : role?.role === "development"
      ? `**From ${dayMonth(role.since)} the first held-out set is development data.** The reading rules are being changed after seeing it, so it can no longer show how the rules carry to layouts they were not written for. Its ${hc.correct} of ${hc.total} stays on this page as the score before that change. It is kept in \`eval/holdout/results/first-score.json\`, whose record names the freeze and the sha256 of every frozen file and stored OCR file it was computed from. Any later score on it is a development result.${heldLater ? ` Its latest score, a development result, is ${frac(heldNow.correct, heldNow.total)}${heldChanged ? ", shown in its own column." : ", the same as the blind score."}` : ""} The next headline number needs a held-out set the changed rules have never seen.`
      : ""
  const output = `# Evaluation

**draft, pending pharmacist review**

The development set has ${metrics.packets} synthetic packets and ${total} criterion labels, built by the same generator the pipeline rules were written against, so its numbers are development results. The first held-out set has ${first.packets} packets and ${hc.total} criterion labels written by a different model from a written spec, frozen before the pipeline ever ran on it, and scored once${blind ? `, on ${dayMonth(firstRecord.scoredOn)}` : ", though no valid record of that first score is here"}.${role?.role === "development" ? ` From ${dayMonth(role.since)} it is development data, because the reading rules are being changed after seeing it.` : ""} ${metrics.clinicalValidation.reviewedCriteria} development labels carry Kevin's pharmacist review from 2 November 2026, carried over because their rule and quoted evidence did not change. Every other label is a draft. No second independent reviewer has checked them. These are diagnostics, not clinical accuracy claims.

## Development and held-out results

${mainTable}

${roleParagraph}

The first held-out set was the honest test of the rules until 3 November 2026. Codex (gpt-6.1-sol, read-only, no commands run) wrote it from [the spec](../eval/holdout/SPEC.md) alone: the criteria, the rubric, the format axes and the degradation list. It saw no generator, pipeline code or development packet. \`scripts/holdout.ts\` checked every quoted line and froze the packets, labels and manifest under sha256 \`${frozen.sha256}\` before the first run. \`npx tsx scripts/holdout.ts verify\` recomputes it. Held-out labels cover criterion statuses and quoted lines, not entities, and include no handwriting. No pharmacist has reviewed them yet. Three other model families, Claude, Gemini and Grok, relabeled all ${hc.total} blind from the same rubric and the packet text. Their statuses match ${cross.unanimous} of ${cross.labels} on every relabel, and the one disagreement is a model reading a received date as a second request date. [The cross-check](../eval/holdout/crosscheck/README.md) shows the labels follow the rubric. It does not show the rubric is clinically right.

${
  blind
    ? `In its blind run, with the stage C reading rules, the pipeline answered "not documented" for ${hc.byStatus.missing.predicted} of ${hc.total} labels. It caught every not-documented label only because it said "not documented" whenever it could not parse a layout it had not seen: ${hc.falseMissing.count} of the ${hc.falseMissing.of} labels marked evidence found or needs review got that answer. It confirmed ${hc.byStatus.evidence_found.hit} of ${hc.byStatus.evidence_found.gold} documented criteria and scored below the always-"found" baseline. The same services on the held-out source text, with no OCR at all, got ${hd.sourceTextBaseline.criteria.correct} of ${hd.sourceTextBaseline.criteria.total} right. The development score reflected how well the rules fit the generator's templates, not how well they read new documents.`
    : `In its latest run, a development result, the pipeline answered "not documented" for ${hc.byStatus.missing.predicted} of ${hc.total} labels, and for ${hc.falseMissing.count} of the ${hc.falseMissing.of} labels marked evidence found or needs review. It confirmed ${hc.byStatus.evidence_found.hit} of ${hc.byStatus.evidence_found.gold} documented criteria. The same services on the held-out source text, with no OCR at all, get ${hd.sourceTextBaseline.criteria.correct} of ${hd.sourceTextBaseline.criteria.total} right.`
}

${v2Paragraph}

### Every "found" answer where the label is not

${falseFoundRows}

### Label status against answer

Rows are the draft label, columns are the answer, so the diagonal is right. The source-text run uses the same services on the packet text with no OCR.

${confusionTables}

### By criterion

${criterionTables}

### First held-out set by group and criterion, blind score

${HEAD}
${sliceRows(
  first.slices.group.filter((g) => g.packets),
  (s) => s.label,
)}
${sliceRows(
  first.slices.criterion.map((s) => ({ ...s, packets: "" })),
  (s) => s.value,
)}
${
  heldChanged
    ? `
### First held-out set by criterion now, a development result

${HEAD}
${sliceRows(
  held.slices.criterion.map((s) => ({ ...s, packets: "" })),
  (s) => s.value,
)}
`
    : ""
}${
    v2
      ? `
### Second held-out set by group and criterion${v2Record ? ", blind score" : ""}

${HEAD}
${sliceRows(
  v2.slices.group.filter((g) => g.packets),
  (s) => s.label,
)}
${sliceRows(
  v2.slices.criterion.map((s) => ({ ...s, packets: "" })),
  (s) => s.value,
)}
`
      : ""
  }
## What arrived and what OCR could read

Each packet now gets a coverage record, built from the OCR output alone so it is the same in evaluation and in use: pages received, page counters read where fax machines and footers put them, which pages the counters say are missing, whether the pages arrived in order, whether each page's turn was chosen by a clear margin, word confidence per page, and the runs of lines with a word below the review threshold. The record is passed to the reading rules with the OCR text, and they use it. A page that did not arrive, could not be read, or arrived out of order blocks every "not documented" answer, which goes to review and names the page. A found answer stands, and the packet is marked incomplete.

${coverageTable}

The last two rows compare OCR with the source text, which only an evaluation has, so they never reach the pipeline. A source line counts as not given back when fewer than a quarter of its visible characters come back from OCR unchanged and in order. ${unread.length ? `They are:\n\n${unread.join("\n")}\n\n${silent ? `${silent} of the ${unread.length} left no low-confidence word to mark the place, so the coverage record cannot warn about ${silent > 1 ? "those" : "that one"}. Coverage can only describe what OCR returned.` : "Each sits where the coverage record already marks low confidence."}` : "There are none."}

${fixtureSection}
## What this measures, and what it does not

Every page is a fax-style page image made on this computer. Nothing was printed, faxed or scanned. Each group is named by the effect actually applied:

${manifest.groups.map((g) => `- **${g.label}.** ${g.render}`).join("\n")}

The handwriting in two groups is AI-drawn handwriting from an image model, not a real person's handwriting. Its provenance, prompts and checksums are in [the handwriting record](../eval/handwriting/handwriting.json). The gold text for each drawn line follows what the image shows.

## Reproduce

\`npm ci\` followed by \`npm run eval -- --check\` rescores all ${metrics.packets} stored OCR outputs against the current labels and requires an exact match with the saved metrics. \`npm run eval:holdout -- --check\` does the same for the first held-out set after checking its freeze and its first-score record, and \`npm run eval -- --set multipage --check\` for the multi-page fixture. \`npm run eval -- --set holdout-v2\` scores the second held-out set once it exists. A held-out set is scored only while its files match its frozen sha256. Its first run needs the freeze, the files it covers and the tracked code committed, claims the set with an exclusive create, reads every page again instead of trusting stored OCR, and writes \`results/first-score.json\` once with the freeze and the sha256 of every frozen and OCR file it used. Every later run must match that record and is saved as a development result. An interrupted first run resumes only with \`--recover\` at the same commit, and a record lost after it was committed has to be restored from git. These checks catch mistakes and silent changes in this repository. They cannot show that nobody ran the pipeline on a set some other way before its first run. \`npm run generate\` rebuilds every packet, label, criteria file and the manifest from \`scripts/generate.ts\`. \`npx tsx scripts/fixtures.ts\` rebuilds the multi-page fixture from packet-018. \`npm run eval -- --rebuild\` redraws every page image and PDF and reruns local OCR. \`npm run report\` regenerates this page.

## Label balance

| Set | Evidence found | Not documented | Needs review | Always answering "found" scores |
| --- | --- | --- | --- | --- |
| 2b4d487 | ${frac(prev.labels.evidence_found, prev.labels.criteria)} | ${frac(prev.labels.missing, prev.labels.criteria)} | ${frac(prev.labels.needs_review, prev.labels.criteria)} | ${frac(pc.alwaysFound, pc.total)} |
| Now | ${frac(counts.evidence_found.gold, total)} | ${frac(counts.missing.gold, total)} | ${frac(counts.needs_review.gold, total)} | ${frac(c.alwaysFound.correct, total)} |

Gaps are now common. Most packets have two or three criteria without full support, and three packets have none supported. Near misses include a diagnosis found only in the history, a suspected diagnosis, a different requested indication, a trial too short or in the wrong drug class, a bare "inadequate response" without values, a follow-up value already at goal, a lab outside the window or below threshold, conflicting request dates, a dose or frequency outside the rule, and blank form fields.

## Development results beside 2b4d487

| Measure | 2b4d487 | Now |
| --- | --- | --- |
| Criterion statuses correct | ${frac(pc.correct, pc.total)} | ${frac(c.correct, total)} |
| Always answering "found" | ${frac(pc.alwaysFound, pc.total)} | ${frac(c.alwaysFound.correct, total)} |
| Evidence found, caught | ${frac(pc.byStatus.evidence_found.hit, pc.byStatus.evidence_found.gold)} | ${recall(c, "evidence_found")} |
| Not documented, caught | ${frac(pc.byStatus.missing.hit, pc.byStatus.missing.gold)} | ${recall(c, "missing")} |
| Needs review, caught | ${frac(pc.byStatus.needs_review.hit, pc.byStatus.needs_review.gold)} | ${recall(c, "needs_review")} |
| Said "found" where the label is not | ${pc.falseFound.count} / ${pc.falseFound.of} | ${c.falseFound.count} / ${c.falseFound.of} |
| Status and exact quotes correct | ${frac(pc.statusAndQuotes, pc.total)} | ${frac(c.statusAndQuotes, total)} |
| Extraction precision | ${frac(prev.extraction.tp, prev.extraction.predicted)} | ${frac(d.extraction.tp, d.extraction.predicted)} |
| Extraction recall | ${frac(prev.extraction.tp, prev.extraction.gold)} | ${frac(d.extraction.tp, d.extraction.gold)} |
| Extraction F1 | ${pct(prev.extraction.f1, 1)} | ${pct(d.extraction.f1, 1)} |
| Value and exact quote matches | ${prev.extraction.exactQuote} / ${prev.extraction.gold} | ${d.extraction.exactEvidenceQuoteMatches} / ${d.extraction.gold} |
| OCR character error rate | ${frac(prev.ocr.edits, prev.ocr.chars)} | ${frac(d.ocr.edits, d.ocr.referenceCharacters)} |
| Page orientation read correctly | not measured | ${frac(d.ocr.orientation.correct, d.ocr.orientation.total)}, turned pages ${d.ocr.orientation.turnedCorrect} / ${d.ocr.orientation.turnedPages} |
| Letters with the condition hidden as [name] | ${prev.privacy.lettersWithConditionHiddenOcr} / ${prev.privacy.letters} | ${o.ocr.conditionHidden} letters |
| Clinical words hidden as [name], OCR text | not measured | ${o.ocr.overRedacted} of ${o.ocr.nameTokens} [name] tokens |
| Clinical words hidden as [name], source text | not measured | ${o.source.overRedacted} of ${o.source.nameTokens} [name] tokens |
| Dates | all removed | ${d.privacy.dateTokens} shifted, ${d.privacy.datesRemovedWithoutShift} removed |
| Verifier mutations caught | ${frac(prev.verifier.caught, prev.verifier.injected)} | ${frac(d.verifier.caught, d.verifier.injected)} |
| Source text baseline, statuses correct | ${frac(prev.sourceTextBaseline.criteriaCorrect, prev.sourceTextBaseline.criteriaTotal)} | ${frac(sb.correct, sb.total)} |
| Local packet latency p50 / p95 | 2.66s / 3.75s | ${(latency.p50Ms / 1000).toFixed(2)}s / ${(latency.p95Ms / 1000).toFixed(2)}s |

The two sets are not the same test. 2b4d487 had 50 packets with one problem at most each. The development set has ${metrics.packets} packets, harder rules for diagnosis and prior therapy, varied formats, new page effects and three typed fonts. Read each number against the always-"found" baseline beside it, not against the old ones.

## Reviewed and draft labels

| Labels | Statuses correct | Always "found" | Not documented caught | Needs review caught |
| --- | --- | --- | --- | --- |
| Pharmacist reviewed, carried over | ${frac(d.criteriaReviewed.correct, d.criteriaReviewed.total)} | ${frac(d.criteriaReviewed.alwaysFound.correct, d.criteriaReviewed.total)} | ${d.criteriaReviewed.byStatus.missing.gold ? recall(d.criteriaReviewed, "missing") : "none"} | ${d.criteriaReviewed.byStatus.needs_review.gold ? recall(d.criteriaReviewed, "needs_review") : "none"} |
| Draft | ${frac(d.criteriaDraft.correct, d.criteriaDraft.total)} | ${frac(d.criteriaDraft.alwaysFound.correct, d.criteriaDraft.total)} | ${recall(d.criteriaDraft, "missing")} | ${recall(d.criteriaDraft, "needs_review")} |

The ${d.criteriaReviewed.total} reviewed labels are all adult, lab and dose labels Kevin marked evidence found. Eight more of his labels, on diagnosis and prior therapy, need a fresh look because both the rule and the packet text changed. His earlier answers and notes stay in the gold files.

## Development results by group

${HEAD}
${sliceRows(metrics.slices.group, (s) => s.label)}

At 2b4d487 the groups mixed page effects and content problems:

| 2b4d487 group | Packets | OCR CER | Extraction F1 | Statuses correct | Always "found" |
| --- | --- | --- | --- | --- | --- |
${prevSlices}

## Development results by format and variation

${HEAD}
${sliceRows(metrics.slices.tag, (s) => tagName[s.value] ?? s.value)}

In ${d.dateReading.ambiguousSame} of ${d.dateReading.ambiguousPackets} packets with an ambiguous numeric date, the pipeline settled the order the same way the label does, or kept both readings where the label does. Spelling variants a pharmacist would accept were matched ${d.spelling.accepted.matched} of ${d.spelling.accepted.total} times. Look-alike names a pharmacist would not accept were accepted anyway ${d.spelling.notAccepted.acceptedAnyway} of ${d.spelling.notAccepted.total} times.

## Development results by criterion and scenario

${HEAD}
${sliceRows(
  metrics.slices.criterion.map((s) => ({ ...s, packets: "" })),
  (s) => s.value,
)}

| Criterion | Scenario | Label | Statuses correct |
| --- | --- | --- | --- |
${scen}

## Scoring rules

Criterion accuracy compares each of the ${total} statuses by criterion ID. "Always found" is the score of a tool that answers "evidence found" every time. Recall is reported separately for not documented and needs review. "Said found when not" counts labels that are not evidence found where the pipeline said evidence found. That is the error that could let a gap pass. "Said not documented where the label is found or needs review" counts the opposite error, the one that would send a nurse to ask for documentation the packet already holds, or close a question a person needed to see. "Sent to review" counts every needs-review answer over all labels, the share of the work handed to a person. A strict count also requires the same quoted lines.

CER uses Levenshtein distance after collapsing whitespace runs, case sensitive, on the text before redaction. For a packet of several pages the page texts are joined in order, on both the OCR side and the source side, with the page markers left out. Orientation is scored page by page. Extraction matches type and exact canonical value one to one. Names are removed before extraction and excluded. The privacy step shifts dates by a per-packet number of days, so the evaluator undoes the shift before comparing date values, and restores the written date before comparing quotes. The shift comes from the packet ID so runs reproduce. That makes it not secret, which is fine for synthetic data and wrong for real data.

The verifier receives three deterministic unsupported mutations per packet. Its exact-quotation rule rejects them by construction. It is not a semantic hallucination benchmark.

## Source text baseline

The same services run on the source text without OCR. Development statuses correct: ${frac(sb.correct, sb.total)}, extraction F1 ${pct(d.sourceTextBaseline.extraction.f1, 1)}. The extraction rules and the generator were written together, so this shows the rules cover the generator's phrasings, nothing more. On the first held-out set's source text, in its blind run, the same services got ${frac(hd.sourceTextBaseline.criteria.correct, hd.sourceTextBaseline.criteria.total)} statuses right, which is the measure of how far the rules generalized before any page effect.

## Limits

The labels are drafts except for ${metrics.clinicalValidation.reviewedCriteria} carried-over reviews. The development numbers come from one generator. The first held-out set is small, ${first.packets} packets from one other model, with no confidence interval, no handwriting and no pharmacist-reviewed labels, though a blind relabel by three other model families matches ${cross.unanimous} of ${cross.labels}${role?.role === "development" ? `, and from ${dayMonth(role.since)} it is development data` : ""}. There is no nurse study. Typed pages use three fonts: Roboto Mono, whose slashed zero OCR sometimes reads as 8, Liberation Sans and DejaVu Sans. Other fonts, real fax transmission and real handwriting are untested. Packets of several pages are tested on two fixture packets built from one development packet, not on a held-out set. Page counters are read only in their common forms, and a packet without one gives no count to check against, so a page missing from it goes unnoticed. The fictional rules are Kevin's to adjust. From stage D the fictional PCSK9 rule accepts a high-intensity statin trial, atorvastatin 40 or 80 mg or rosuvastatin 20 or 40 mg daily, by Kevin's ruling of 2 November 2026. No development or held-out packet mentions rosuvastatin, so no score here depends on it. No clinical outcome, safety, adoption or time-saving claim follows from these sets.
`
  return output
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  await writeFile("docs/EVALUATION.md", await buildReport())
