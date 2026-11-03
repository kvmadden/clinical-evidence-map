import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"
import { performance } from "node:perf_hooks"
import { createOcr } from "../services/ocr/index.js"
import { recognizePages, renderPacket } from "../services/ocr/packet.js"
import { pagesOf, splitPages } from "../services/ocr/pages.js"
import { readCoverage } from "../services/ocr/coverage.js"
import { loadManifest, processText, sourceBody } from "../services/pipeline.js"
import { verify } from "../services/verify/index.js"
import { DRAFT } from "../services/contracts.js"
import {
  alignTokens,
  distance,
  f1,
  found,
  normalizedText,
  scoreCriteria,
  scoreEntities,
  summarize,
  unreadSourceLines,
  type LabelResult,
  type UnreadLine,
} from "./metrics.js"
import { setHash } from "./holdout.js"
import { setNamed } from "./sets.mjs"
import {
  BLIND,
  DEVELOPMENT,
  artifactFiles,
  frozenFiles,
  readFirstScore,
} from "./records.mjs"
import type { PageReader } from "../services/ocr/packet.js"

// Per-packet date shift used by the privacy step during evaluation. It is
// derived from the packet ID so runs reproduce, which also means it is not
// secret. A deployment would draw a random shift and keep it apart from text.
export const shiftFor = (id: string) =>
  36500 +
  (createHash("sha256")
    .update(`clinical-evidence-map:date-shift:${id}`)
    .digest()
    .readUInt32LE(0) %
    3650)

// A held-out set is checked against the sha256 in its FREEZE.json, over
// packets/*, gold/* and manifest.json, before every run.
export async function verifyFreeze(root: string) {
  if (!existsSync(`${root}/FREEZE.json`))
    throw new Error(
      `${root} has no FREEZE.json. Freeze the set and commit its sha256 before its first run.`,
    )
  const frozen = JSON.parse(await readFile(`${root}/FREEZE.json`, "utf8"))
  const now = await setHash(root)
  if (now !== frozen.sha256)
    throw new Error(
      `${root} changed since it was frozen: ${now} is not ${frozen.sha256}`,
    )
  return frozen.sha256 as string
}

const git = (root: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
const gitHead = (root: string) => {
  try {
    return git(root, "rev-parse", "--short", "HEAD").trim()
  } catch {
    return null
  }
}
// Before a blind first run: the freeze and the files it covers are committed
// and unchanged, and so is every other tracked file outside this set's
// results and stored OCR, so the commit recorded with the score is the code
// that made it. What this cannot show is that nobody ran the pipeline on the
// set some other way, or changed a rule after seeing it, before this run.
function assertReadyForBlindRun(root: string) {
  const locked = ["FREEZE.json", "manifest.json", "packets", "gold"]
  try {
    git(root, "ls-files", "--error-unmatch", ...locked)
    if (git(root, "status", "--porcelain", "--", ...locked).trim())
      throw new Error()
  } catch {
    throw new Error(
      `Commit ${root}/FREEZE.json with the packets, labels and manifest it covers before the set's first scoring run.`,
    )
  }
  const prefix = git(root, "rev-parse", "--show-prefix").trim()
  const changed = git(root, "status", "--porcelain", "--untracked-files=no")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter(
      (path) =>
        !path.startsWith(`${prefix}results/`) &&
        !path.startsWith(`${prefix}artifacts/`),
    )
  if (changed.length)
    throw new Error(
      `Commit the code before a blind first run, so its record names the code that made it. Changed: ${changed.join(", ")}`,
    )
}
// Whether git history holds a saved score for this set, even if the files
// are gone from the folder now.
function scoredInHistory(root: string) {
  try {
    return git(
      root,
      "log",
      "--format=%h",
      "-n",
      "1",
      "--",
      "results/first-score.json",
      "results/metrics.json",
    ).trim()
  } catch {
    return ""
  }
}

interface PacketScore {
  id: string
  criteriaId: string
  group: string
  tags: string[]
  labels: LabelResult[]
  sourceLabels: LabelResult[]
  entities: ReturnType<typeof scoreEntities>
  sourceEntities: ReturnType<typeof scoreEntities>
  edits: number
  chars: number
  latency: { renderAndOcrMs: number; serviceMs: number }
}

export async function evaluate(
  name: string,
  options: {
    check?: boolean
    rebuild?: boolean
    root?: string
    // Finish a blind first run that was interrupted, at the same commit.
    recover?: boolean
    // Reads page images. Tests pass their own. Otherwise local OCR is used.
    reader?: PageReader & { close?: () => Promise<unknown> }
  } = {},
) {
  const set = setNamed(name)
  const { check = false, rebuild = false, recover = false } = options
  const root = options.root ?? set.root
  // A set that is not written yet is skipped before anything touches its folder.
  if (!existsSync(`${root}/manifest.json`)) {
    if (set.optional) {
      console.log(
        `${set.label}: ${root}/manifest.json does not exist yet, so there is nothing to score.`,
      )
      return null
    }
    throw new Error(`${root}/manifest.json not found`)
  }
  const resultDir = `${root}/results`
  const metricsFile = `${resultDir}/metrics.json`
  const firstScoreFile = `${resultDir}/first-score.json`
  const claimFile = `${resultDir}/first-run.claim.json`
  // A held-out set is checked against its freeze before anything else, and
  // against the identity its first score was recorded under, if it has one.
  let frozenSha256: string | null = null
  let firstRun = false,
    resuming = false
  if (set.heldOut) {
    if (set.optional && check && !existsSync(`${root}/FREEZE.json`)) {
      console.log(`${set.label}: not frozen yet, so there is nothing to check.`)
      return null
    }
    frozenSha256 = await verifyFreeze(root)
    const first = await readFirstScore(root)
    if (existsSync(firstScoreFile) && !first.valid)
      throw new Error(
        `${set.label} cannot be scored: ${first.reason}. A set that changed after its first score is a new set. Give it a new folder and a new freeze.`,
      )
    if (check && !existsSync(metricsFile)) {
      if (existsSync(firstScoreFile))
        throw new Error(
          `${set.label} was scored, but ${metricsFile} is missing. Restore it from git.`,
        )
      console.log(
        `${set.label}: frozen and not scored yet, so there is nothing to check.`,
      )
      return null
    }
    const role = existsSync(`${root}/ROLE.json`)
      ? JSON.parse(await readFile(`${root}/ROLE.json`, "utf8")).role
      : "held-out"
    if (!check && !existsSync(firstScoreFile)) {
      const history = scoredInHistory(root)
      if (history)
        throw new Error(
          `${set.label} has a score in git history at ${history}, but ${firstScoreFile} is missing. Restore it from git. A new first score cannot be made.`,
        )
      if (existsSync(claimFile)) {
        const claim = JSON.parse(await readFile(claimFile, "utf8"))
        if (!recover)
          throw new Error(
            `A blind first run of ${set.label} is in progress, or was interrupted (${claimFile}). Rerun with --recover to finish it at the same commit.`,
          )
        if (claim.commit !== gitHead(root))
          throw new Error(
            `The interrupted first run of ${set.label} started at a different commit, ${claim.commit}. A blind score cannot be finished under other code.`,
          )
        firstRun = resuming = true
      } else firstRun = role !== "development" && !existsSync(metricsFile)
    }
    if (firstRun) {
      assertReadyForBlindRun(root)
      await mkdir(resultDir, { recursive: true })
      // Claimed with an exclusive create, so a second run started at the same
      // time stops here instead of scoring too.
      if (!resuming)
        try {
          await writeFile(
            claimFile,
            JSON.stringify({
              commit: gitHead(root),
              started: new Date().toISOString(),
            }),
            { flag: "wx" },
          )
        } catch {
          throw new Error(
            `A blind first run of ${set.label} is already in progress (${claimFile}).`,
          )
        }
    } else if (!check)
      console.log(
        `${set.label}: this run is a development result, and its saved metrics say so.`,
      )
  }
  const runClass = firstRun ? BLIND : DEVELOPMENT
  const manifest = await loadManifest(`${root}/manifest.json`)
  const artifactDir = `${root}/artifacts`
  await mkdir(artifactDir, { recursive: true })
  await mkdir(resultDir, { recursive: true })
  const renderer = await readFile("services/ocr/index.ts", "utf8")
  // Packets of several pages also depend on the page code. One-page packets
  // never run it, so their fingerprints stay what they were.
  const pageCode =
    (await readFile("services/ocr/pages.ts", "utf8")) +
    (await readFile("services/ocr/packet.ts", "utf8"))
  const handwriting = await readFile(
    "eval/handwriting/handwriting.json",
    "utf8",
  )
  const groupLabel = Object.fromEntries(
    manifest.groups.map((g) => [g.id, g.label]),
  )
  let worker: (PageReader & { close?: () => Promise<unknown> }) | undefined

  const rows: PacketScore[] = []
  const bucket = () => ({
    nameTokens: 0,
    overRedacted: 0,
    conditionHidden: 0,
    aligned: 0,
    examples: [] as string[],
  })
  const privacy = {
    ocr: bucket(),
    source: bucket(),
    dateTokens: 0,
    datesRemoved: 0,
  }
  const orientation = { correct: 0, total: 0, turnedPages: 0, turnedCorrect: 0 }
  const spelling = {
    accepted: { total: 0, matched: 0 },
    notAccepted: { total: 0, acceptedAnyway: 0 },
  }
  const dateReading = {
    packets: 0,
    sameStatus: 0,
    ambiguousPackets: 0,
    ambiguousSame: 0,
  }
  const verifier = {
    caught: 0,
    injected: 0,
    supported: 0,
    acceptedSupported: 0,
  }
  // Every quote the pipeline gives, checked against the redacted text it points into.
  const quotes = { reproduced: 0, total: 0 }
  // What arrived and could be read, from the OCR output alone, plus the
  // evaluation-only count of source lines OCR did not give back.
  const coverage = {
    pages: 0,
    multiPagePackets: 0,
    packetsWithCounter: 0,
    incompletePackets: [] as string[],
    missingPages: 0,
    orientationHandled: 0,
    ocrLines: 0,
    linesWithLowWord: 0,
    linesAllLow: 0,
    sourceLines: 0,
    unread: [] as (UnreadLine & { packet: string })[],
  }
  let reviewedEntities = 0

  function overRedaction(
    pairs: { token: string; original: string }[] | null,
    redacted: string,
    identifiers: string[],
    b: ReturnType<typeof bucket>,
  ) {
    if (pairs) b.aligned++
    b.conditionHidden += (redacted.match(/records for \[name\]/g) ?? []).length
    for (const p of pairs ?? []) {
      if (p.token !== "[name]") continue
      b.nameTokens++
      const words = p.original.split(/[^A-Za-z]+/).filter(Boolean)
      if (!words.some((w) => identifiers.includes(w))) {
        b.overRedacted++
        if (b.examples.length < 12) b.examples.push(p.original.trim())
      }
    }
  }

  try {
    for (const entry of manifest.packets) {
      const id = entry.packet_id
      const body = sourceBody(
        await readFile(`${root}/packets/${id}.md`, "utf8"),
      )
      const gold = JSON.parse(await readFile(`${root}/gold/${id}.json`, "utf8"))
      // Page texts as written, with the page markers taken out. For a packet
      // without markers this is the body itself.
      const pageTexts = splitPages(body).map((p) => p.text)
      const reading = pageTexts.join("")
      const multi = pageTexts.length > 1
      const fingerprint = createHash("sha256")
        .update(
          body +
            renderer +
            JSON.stringify(entry.render) +
            handwriting +
            (multi ? pageCode : ""),
        )
        .digest("hex")
      const cacheFile = `${artifactDir}/${id}.json`
      let cache
      try {
        cache = JSON.parse(await readFile(cacheFile, "utf8"))
      } catch {}
      // A blind first run reads every page again, so its score never rests
      // on stored OCR that could have been edited.
      if (rebuild || firstRun || cache?.fingerprint !== fingerprint) {
        if (check)
          throw new Error(
            `Missing or stale OCR artifact for ${id}. Run npm run eval -- --set ${name} --rebuild`,
          )
        worker ??= options.reader ?? (await createOcr())
        const start = performance.now()
        const fax = await renderPacket({
          text: body,
          packetId: id,
          plan: entry.render,
          outputDir: artifactDir,
        })
        const ocr = await recognizePages(
          worker,
          fax.pages.map((p) => p.image),
        )
        cache = { fingerprint, ocr, renderAndOcrMs: performance.now() - start }
        await writeFile(cacheFile, JSON.stringify(cache, null, 2) + "\n")
      }
      // Coverage travels with the OCR output into the pipeline. It is built
      // from the OCR output alone, never from the source text.
      const packetCoverage = readCoverage(cache.ocr)
      const shift = shiftFor(id)
      const start = performance.now()
      const output = processText(
        cache.ocr.text,
        entry.criteria_id,
        { ...cache.ocr, coverage: packetCoverage },
        { dateShiftDays: shift },
      )
      const serviceMs = performance.now() - start
      const sourceOutput = processText(reading, entry.criteria_id, undefined, {
        dateShiftDays: shift,
      })
      const ocrPairs = alignTokens(cache.ocr.text, output.privacy.text)
      const sourcePairs = alignTokens(reading, sourceOutput.privacy.text)
      // Fictional names: labeled entities, or the words before each "(fictional)".
      const identifiers: string[] = [
        ...gold.entities
          .filter((e: { type: string }) =>
            ["patient_name", "provider"].includes(e.type),
          )
          .flatMap((e: { value: string }) =>
            e.value.split(/[^A-Za-z]+/).filter(Boolean),
          ),
        ...[
          ...body.matchAll(/((?:[A-Z][A-Za-z'-]+\.?\s+){1,3})\(fictional\)/g),
        ].flatMap((m) => m[1].split(/[^A-Za-z]+/).filter(Boolean)),
      ]
      overRedaction(ocrPairs, output.privacy.text, identifiers, privacy.ocr)
      overRedaction(
        sourcePairs,
        sourceOutput.privacy.text,
        identifiers,
        privacy.source,
      )
      privacy.dateTokens += output.privacy.dates.length
      privacy.datesRemoved += (
        output.privacy.text.match(/\[date\]/g) ?? []
      ).length
      const entities = scoreEntities(output.entities, gold.entities, {
        shift,
        pairs: ocrPairs,
      })
      const sourceEntities = scoreEntities(
        sourceOutput.entities,
        gold.entities,
        {
          shift,
          pairs: sourcePairs,
        },
      )
      const labels = scoreCriteria(
        id,
        output.criteria,
        gold.criterion_evidence,
        ocrPairs,
      )
      const sourceLabels = scoreCriteria(
        id,
        sourceOutput.criteria,
        gold.criterion_evidence,
        sourcePairs,
      )
      const reference = normalizedText(reading),
        hypothesis = normalizedText(cache.ocr.text)
      const edits = distance(reference, hypothesis),
        chars = Array.from(reference).length
      // Orientation, page by page: 90, 180 and 270 are page turns. The
      // 7-degree group is skew.
      const expectedTurn = [90, 180, 270].includes(entry.render.rotate)
        ? entry.render.rotate
        : 0
      const turns = pagesOf(cache.ocr).map((p) => p.orientation.pageRotation)
      for (const detected of turns) {
        orientation.total++
        if (detected === expectedTurn) orientation.correct++
        if (expectedTurn) {
          orientation.turnedPages++
          if (detected === expectedTurn) orientation.turnedCorrect++
        }
      }
      const sourceCheck = unreadSourceLines(
        pageTexts,
        cache.ocr,
        packetCoverage,
      )
      coverage.pages += packetCoverage.pagesReceived
      if (multi) coverage.multiPagePackets++
      if (packetCoverage.pages.some((p) => p.counter))
        coverage.packetsWithCounter++
      if (!packetCoverage.complete) coverage.incompletePackets.push(id)
      coverage.missingPages += packetCoverage.missingCount
      for (const page of packetCoverage.pages) {
        if (page.orientation.handled) coverage.orientationHandled++
        coverage.ocrLines += page.lines
        for (const run of page.lowConfidenceLines)
          coverage.linesWithLowWord += run.to - run.from + 1
        for (const run of page.unreadableLines)
          coverage.linesAllLow += run.to - run.from + 1
      }
      coverage.sourceLines += sourceCheck.lines
      coverage.unread.push(
        ...sourceCheck.unread.map((u) => ({ packet: id, ...u })),
      )
      for (const e of gold.entities) {
        if (e.reviewed) reviewedEntities++
        if (!e.misspelling) continue
        if (e.misspelling.pharmacist_accepts) {
          spelling.accepted.total++
          if (found(output.entities, e, shift)) spelling.accepted.matched++
        } else {
          spelling.notAccepted.total++
          // Accepting the look-alike means reading it as the drug it resembles.
          if (
            output.entities.some(
              (p) =>
                p.type === e.type &&
                p.match?.kind !== "look-alike" &&
                p.value === "methotrexate",
            )
          )
            spelling.notAccepted.acceptedAnyway++
        }
      }
      if (gold.date_reading) dateReading.packets++
      if (
        gold.date_reading &&
        output.dateReading.status === gold.date_reading.status
      )
        dateReading.sameStatus++
      if (gold.date_reading && gold.date_reading.status !== "none") {
        dateReading.ambiguousPackets++
        if (output.dateReading.status === gold.date_reading.status)
          dateReading.ambiguousSame++
      }
      const citation = output.entities[0]?.source_span
      const challenges = [
        { text: "The patient is cured.", citations: [] },
        {
          text: "All fictional criteria are satisfied.",
          citations: citation ? [citation] : [],
        },
        {
          text: "Invented laboratory result.",
          citations: [{ start: 99999, end: 100000, text: "x" }],
        },
      ]
      const challenged = verify({
        text: output.privacy.text,
        sentences: challenges,
      })
      const caught = challenged.sentences.filter((s) => !s.supported).length
      verifier.caught += caught
      verifier.injected += challenges.length
      verifier.supported += output.summary.length
      verifier.acceptedSupported += output.summary.filter(
        (s) => s.supported,
      ).length
      const redacted = Array.from(output.privacy.text)
      for (const q of [
        ...output.entities.map((e) => e.source_span),
        ...output.criteria.flatMap((c) => c.evidence_spans),
        ...output.summary.flatMap((s) => s.citations),
      ]) {
        quotes.total++
        if (redacted.slice(q.start, q.end).join("") === q.text)
          quotes.reproduced++
      }
      const failures: string[] = []
      for (const l of labels)
        if (l.predicted !== l.gold)
          failures.push(
            `${l.criterion} (${l.scenario}): draft ${l.gold}, pipeline ${l.predicted}`,
          )
      if (
        gold.entities.length &&
        (entities.tp !== entities.gold || entities.tp !== entities.predicted)
      )
        failures.push(
          `Extraction: ${entities.tp} of ${entities.gold} draft values found, ${entities.predicted - entities.tp} extra`,
        )
      if (edits) failures.push(`${edits} OCR character edits`)
      turns.forEach((detected, page) => {
        if (expectedTurn !== detected)
          failures.push(
            `${multi ? `Page ${page + 1} orientation` : "Orientation"}: page turned ${expectedTurn} degrees, read as ${detected}`,
          )
      })
      const latency = { renderAndOcrMs: cache.renderAndOcrMs, serviceMs }
      // Coverage goes into the saved result when there is something to show:
      // several pages, or a packet that did not fully arrive. One-page
      // packets that arrived whole keep their earlier result unchanged.
      const shown =
        multi || !packetCoverage.complete
          ? { coverage: packetCoverage, sourceCheck }
          : {}
      const packet = {
        ...entry,
        groupLabel: groupLabel[entry.group],
        ...output,
        ocr: cache.ocr,
        ...shown,
        scores: {
          entities,
          criteria: {
            correct: labels.filter((l) => l.predicted === l.gold).length,
            total: labels.length,
          },
          cer: edits / chars,
          edits,
          chars,
          verifier: { caught, injected: challenges.length },
        },
        failures,
        latency,
      }
      rows.push({
        id,
        criteriaId: entry.criteria_id,
        group: entry.group,
        tags: entry.tags,
        labels,
        sourceLabels,
        entities,
        sourceEntities,
        edits,
        chars,
        latency,
      })
      if (!check)
        await writeFile(
          `${resultDir}/${id}.json`,
          JSON.stringify(packet, null, 2) + "\n",
        )
      const missing = packetCoverage.missingPages.length
        ? `, pages not received ${packetCoverage.missingPages.join(", ")}`
        : ""
      console.log(
        `${id}: CER ${((100 * edits) / chars).toFixed(1)}%, entities ${entities.tp}/${entities.gold}, criteria ${packet.scores.criteria.correct}/5${missing}`,
      )
    }
  } finally {
    if (!options.reader) await worker?.close?.()
  }

  const labelsOf = (rs: PacketScore[]) => rs.flatMap((r) => r.labels)
  const extractionOf = (
    rs: PacketScore[],
    key: "entities" | "sourceEntities" = "entities",
  ) => {
    const tp = rs.reduce((n, r) => n + r[key].tp, 0),
      predicted = rs.reduce((n, r) => n + r[key].predicted, 0),
      goldCount = rs.reduce((n, r) => n + r[key].gold, 0)
    return {
      ...f1(tp, predicted, goldCount),
      exactEvidenceQuoteMatches: rs.reduce((n, r) => n + r[key].exactQuote, 0),
    }
  }
  const cerOf = (rs: PacketScore[]) => {
    const edits = rs.reduce((n, r) => n + r.edits, 0),
      chars = rs.reduce((n, r) => n + r.chars, 0)
    return { cer: chars ? edits / chars : 0, edits, referenceCharacters: chars }
  }
  const slice = (key: string, value: string, rs: PacketScore[]) => ({
    key,
    value,
    packets: rs.length,
    ocr: cerOf(rs),
    extraction: extractionOf(rs),
    criteria: summarize(labelsOf(rs)),
  })
  const allLabels = labelsOf(rows)
  const sourceLabels = rows.flatMap((r) => r.sourceLabels)
  const tags = [...new Set(rows.flatMap((r) => r.tags))].sort()
  const scenarios = [
    ...new Set(allLabels.map((l) => `${l.criterion}:${l.scenario}`)),
  ].sort()
  const CRITERIA = ["adult", "diagnosis", "lab", "prior", "dose"]
  const metrics = {
    notice: DRAFT,
    set:
      name === "multipage"
        ? "multi-page fixture"
        : set.heldOut
          ? "held-out"
          : "development",
    packets: rows.length,
    heldOut: set.heldOut,
    // How this score came about, and which frozen set it is of. Only the
    // first scoring run of a frozen held-out set is blind.
    run: { class: runClass as string, set: name, frozenSha256 },
    clinicalValidation: {
      status: "pending pharmacist review",
      reviewedCriteria: allLabels.filter((l) => l.reviewed).length,
      reviewedEntities,
      scoredClinicalRate: null,
    },
    draftDiagnostics: {
      ocr: {
        ...cerOf(rows),
        whitespace: "collapsed runs, case sensitive",
        orientation,
      },
      privacy: {
        dateHandling: "shifted by a per-packet number of days, intervals kept",
        dateTokens: privacy.dateTokens,
        datesRemovedWithoutShift: privacy.datesRemoved,
        overRedaction: {
          definition:
            "[name] tokens whose original text holds no word of the packet's fictional patient or provider name",
          ocr: privacy.ocr,
          source: privacy.source,
        },
      },
      extraction: {
        ...extractionOf(rows),
        offsetBasis:
          "predictions reference redacted OCR, gold references original source. Dates are unshifted and date tokens restored before quotes are compared",
      },
      criteria: summarize(allLabels),
      criteriaReviewed: summarize(allLabels.filter((l) => l.reviewed)),
      criteriaDraft: summarize(allLabels.filter((l) => !l.reviewed)),
      spelling,
      dateReading,
      verifier: {
        catchRate: verifier.caught / verifier.injected,
        ...verifier,
        challengeType:
          "three deterministic unsupported mutations per packet, not semantic validation",
      },
      sourceTextBaseline: {
        extraction: extractionOf(rows, "sourceEntities"),
        criteria: summarize(sourceLabels),
        criterion: CRITERIA.map((c) => ({
          key: "criterion",
          value: c,
          criteria: summarize(sourceLabels.filter((l) => l.criterion === c)),
        })),
      },
      coverage: {
        definition:
          "Pages, page counters, turns and low-confidence lines come from the OCR output alone and go into the pipeline. Unread source lines compare OCR with the source text, so they are an evaluation measure only and never reach the pipeline.",
        pagesReceived: coverage.pages,
        multiPagePackets: coverage.multiPagePackets,
        packetsWithPageCounter: coverage.packetsWithCounter,
        incompletePackets: coverage.incompletePackets,
        pagesMissing: coverage.missingPages,
        orientationHandled: {
          pages: coverage.orientationHandled,
          of: coverage.pages,
        },
        ocrLinesWithLowConfidenceWord: {
          lines: coverage.linesWithLowWord,
          of: coverage.ocrLines,
        },
        ocrLinesUnreadable: {
          lines: coverage.linesAllLow,
          of: coverage.ocrLines,
        },
        unreadSourceLines: {
          definition:
            "source lines with visible text, matched whole line to whole line with the OCR lines, of which fewer than a quarter of the characters come back from the matched OCR line unchanged and in order",
          lines: coverage.unread.length,
          of: coverage.sourceLines,
          flaggedByCoverage: coverage.unread.filter((u) => u.flagged).length,
          examples: coverage.unread.map(
            (u) =>
              `${u.packet} page ${u.page + 1} line ${u.line}${u.flagged ? "" : ", not flagged"}: ${u.text}`,
          ),
        },
      },
      // Extracted values, evidence links and summary citations whose quote
      // reproduces from the redacted text at its offsets.
      quotes,
    },
    slices: {
      group: manifest.groups.map((g) => ({
        ...slice(
          "group",
          g.id,
          rows.filter((r) => r.group === g.id),
        ),
        label: g.label,
      })),
      class: ["glp1-t2d", "biologic-psoriasis", "pcsk9"].map((c) =>
        slice(
          "class",
          c,
          rows.filter((r) => r.criteriaId === c),
        ),
      ),
      tag: tags.map((t) =>
        slice(
          "tag",
          t,
          rows.filter((r) => r.tags.includes(t)),
        ),
      ),
      criterion: CRITERIA.map((c) => ({
        key: "criterion",
        value: c,
        criteria: summarize(allLabels.filter((l) => l.criterion === c)),
      })),
      scenario: scenarios.map((s) => ({
        key: "scenario",
        value: s,
        criteria: summarize(
          allLabels.filter((l) => `${l.criterion}:${l.scenario}` === s),
        ),
      })),
    },
    reviewerOverrideRate: {
      value: null,
      reason:
        "No observed nurse study. Scripted UI actions are not workflow evidence.",
    },
    hostedComparison: {
      value: null,
      reason: "Local only. No paid API or external document transfer.",
    },
  }
  if (check) {
    const saved = JSON.parse(await readFile(metricsFile, "utf8"))
    // Saved metrics may call themselves blind only if they are the set's
    // first-score record, made in the same run.
    if (saved.run?.class === BLIND) {
      const first = await readFirstScore(root)
      if (
        !first.valid ||
        JSON.stringify(first.record.metrics) !== JSON.stringify(saved)
      )
        throw new Error(
          `${metricsFile} claims a blind first run, but it is not the set's first-score record.`,
        )
    } else if (saved.run?.class !== DEVELOPMENT)
      throw new Error(
        `${metricsFile} does not say how its score came about. Score the set again.`,
      )
    metrics.run.class = saved.run.class
    if (JSON.stringify(saved) !== JSON.stringify(metrics))
      throw new Error(
        `Saved ${set.label.toLowerCase()} evaluation does not reproduce`,
      )
    console.log(
      `Saved ${metrics.set} metrics reproduced exactly from ${rows.length} OCR artifacts and the current draft gold`,
    )
    return metrics
  }
  // A blind first score is written before anything else, with an exclusive
  // create, so it exists once and is never rewritten. It names the frozen
  // files and the stored OCR it was computed from, each by its own sha256.
  if (firstRun) {
    await writeFile(
      firstScoreFile,
      JSON.stringify(
        {
          note: "The first and only blind score of this set. Any later score is a development result.",
          set: name,
          runClass: BLIND,
          scoredOn: new Date().toISOString().slice(0, 10),
          commit: gitHead(root),
          identity: {
            frozenSha256,
            files: await frozenFiles(root),
            artifacts: await artifactFiles(
              root,
              manifest.packets.map((p) => p.packet_id),
            ),
          },
          metrics,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    )
  }
  await writeFile(metricsFile, JSON.stringify(metrics, null, 2) + "\n")
  if (firstRun) await rm(claimFile, { force: true })
  const times = rows
    .map((r) => r.latency.renderAndOcrMs + r.latency.serviceMs)
    .sort((a, b) => a - b)
  await writeFile(
    `${resultDir}/latency.json`,
    JSON.stringify(
      {
        machine: `${process.platform}/${process.arch}`,
        node: process.version,
        engine:
          "tesseract.js 6.0.1, one warm English worker, two quick orientation reads per page",
        packets: times.length,
        p50Ms: times[Math.ceil(times.length * 0.5) - 1],
        p95Ms: times[Math.ceil(times.length * 0.95) - 1],
        excludes:
          "first worker language download, browser time and human review",
      },
      null,
      2,
    ) + "\n",
  )
  const c = metrics.draftDiagnostics.criteria
  console.log(
    JSON.stringify(
      {
        criteria: `${c.correct}/${c.total}`,
        alwaysFound: `${c.alwaysFound.correct}/${c.total}`,
        byStatus: c.byStatus,
        falseFound: c.falseFound,
        falseMissing: c.falseMissing,
        sentToReview: c.sentToReview,
        extraction: metrics.draftDiagnostics.extraction,
        ocr: metrics.draftDiagnostics.ocr,
        privacy: metrics.draftDiagnostics.privacy,
      },
      null,
      2,
    ),
  )
  return metrics
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv
  const name = argv.includes("--set")
    ? argv[argv.indexOf("--set") + 1]
    : "development"
  await evaluate(name, {
    check: argv.includes("--check"),
    rebuild: argv.includes("--rebuild"),
    recover: argv.includes("--recover"),
  })
}
