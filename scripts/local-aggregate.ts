import { execFileSync, spawnSync } from "node:child_process"
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, isAbsolute, join, relative, sep } from "node:path"
import { sha256 } from "./stored-ocr.js"
import { moduleCheckout } from "./development-identity.js"

const historicalLock =
  "ba82261655252d02a3c68f5ee5186e16440b45d8cd63f0285ae1e98855592b80"
const historical = [
  {
    label: "stage-c",
    revision: "735ea324b2474c021d34bbc575a11abe0537892f",
    recovery: "9d2087b575918c2f3f664a5ab64cac5c97b3a8af",
    set: "holdout",
    root: "eval/holdout",
    count: 24,
  },
  {
    label: "stage-d-dev",
    revision: "5da0e8494af549159dffb004f4f9f726b59543e4",
    recovery: null,
    set: "development",
    root: "eval",
    count: 63,
  },
  {
    label: "stage-d-holdout",
    revision: "5da0e8494af549159dffb004f4f9f726b59543e4",
    recovery: null,
    set: "holdout",
    root: "eval/holdout",
    count: 24,
  },
  {
    label: "stage-d-multipage",
    revision: "5da0e8494af549159dffb004f4f9f726b59543e4",
    recovery: null,
    set: "multipage",
    root: "eval/fixtures/multipage",
    count: 2,
  },
  {
    label: "stage-d-blind2",
    revision: "869777f4e69ec764993d4376bda415d25311e45c",
    recovery: "10d67f080a3e2fd666e7013f50d43c13c448b04f",
    set: "holdout-v2",
    root: "eval/holdout-v2",
    count: 24,
  },
] as const

interface PinnedFile {
  path: string
  sha256: string
}
interface Config {
  schema: string
  revision: string
  reportsParent: string
  archiveRepo: string
  historicalNode: string
  capture: PinnedFile
  expectations: PinnedFile
  acceptance: PinnedFile
  traineddata: PinnedFile
  inventories: Record<string, PinnedFile>
}

const requireValue = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}

function canonicalPath(path: string) {
  if (typeof path !== "string" || !isAbsolute(path))
    throw new Error("Provision an absolute path")
  return realpathSync(path)
}

function childOf(parent: string, child: string) {
  const path = relative(parent, child)
  return (
    !path ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  )
}

function checkedFile(file: PinnedFile, label: string) {
  requireValue(
    file && /^[a-f0-9]{64}$/.test(file.sha256),
    `Missing pinned identity: ${label}`,
  )
  const path = canonicalPath(file.path)
  const bytes = readFileSync(path)
  requireValue(
    bytes.length && sha256(bytes) === file.sha256,
    `SHA-256 mismatch: ${label}`,
  )
  return { path, bytes }
}

const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !key.startsWith("GIT_") &&
      !["HOLDOUT_DIR", "HOLDOUT_PREFIX", "NODE_OPTIONS"].includes(key),
  ),
)
const gitEnv = { ...env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" }
const captureOutput = (
  exe: string,
  args: string[],
  cwd: string,
  runtimeEnv = env,
) =>
  execFileSync(exe, args, { cwd, env: runtimeEnv, maxBuffer: 64 * 1024 * 1024 })
const git = (repo: string, ...args: string[]) =>
  captureOutput("git", args, repo, gitEnv)
const output = (bytes: Buffer) => bytes.toString("utf8").trim()

function entries(archive: string, revision: string) {
  requireValue(
    output(git(archive, "rev-parse", `${revision}^{commit}`)) === revision,
    "Historical commit identity mismatch",
  )
  return new Map(
    output(git(archive, "ls-tree", "-rz", revision))
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const match = /^100(?:644|755) blob ([a-f0-9]{40})\t([^\n]+)$/.exec(row)
        if (!match) throw new Error("Unsupported historical Git entry")
        return [match[2], match[1]]
      }),
  )
}

function inventory(bytes: Buffer, root: string) {
  const files = new Map<string, string>()
  for (const row of output(bytes).split("\n")) {
    const m = /^([a-f0-9]{64})  ([A-Za-z0-9._/-]+)$/.exec(row)
    if (
      !m ||
      !m[2].startsWith(root + "/") ||
      m[2].split("/").some((part) => !part || part === "." || part === "..") ||
      files.has(m[2])
    )
      throw new Error("Invalid or duplicate historical inventory path")
    files.set(m[2], m[1])
  }
  return files
}

const passFields = (
  report: {
    status: string
    coverage: { compared: number; required: number }
    cases: { id: string }[]
    differences: unknown[]
    extractorRevision: string
  },
  revision: string,
) =>
  report.status === "passed" &&
  report.extractorRevision === revision &&
  report.coverage.compared === 63 &&
  report.coverage.required === 63 &&
  report.cases.length === 63 &&
  new Set(report.cases.map((row) => row.id)).size === 63 &&
  report.differences.length === 0

function mainArgs() {
  if (process.argv.length !== 3)
    throw new Error("Use gate:local -- /absolute/runner-config.json")
  const file = canonicalPath(process.argv[2])
  return JSON.parse(readFileSync(file, "utf8")) as Config
}

const checkout = await moduleCheckout(import.meta.url)
checkout.checkClean()
const cfg = mainArgs()
requireValue(
  cfg.schema === "clinical-local-aggregate/v1" &&
    cfg.revision === checkout.revision,
  "Config is for a different aggregate revision",
)
const archive = canonicalPath(cfg.archiveRepo)
const parent = canonicalPath(cfg.reportsParent)
requireValue(
  !childOf(checkout.repo, parent) && !childOf(archive, parent),
  "Reports and copies must be outside both source repositories",
)
process.umask(0o077)
const run = mkdtempSync(join(parent, "clinical-local-gate-"))
chmodSync(run, 0o700)
console.log(`Aggregate report: ${run}`)
const status: Record<string, number> = {}

function stage<T>(name: string, action: (log: string) => T): T {
  const log = join(run, name + ".log")
  writeFileSync(log, "", { flag: "wx" })
  let code = 1
  try {
    const value = action(log)
    code = 0
    return value
  } catch (error) {
    appendFileSync(log, `${error instanceof Error ? error.message : error}\n`)
    if (error instanceof StageExit) code = error.code
    throw error
  } finally {
    status[name] = code
    writeFileSync(join(run, name + ".exit"), String(code) + "\n", {
      flag: "wx",
    })
    console.log(`${name}: exit ${code}`)
  }
}

class StageExit extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message)
  }
}

function command(
  log: string,
  exe: string,
  args: string[],
  cwd: string,
  childEnv = env,
) {
  const fd = openSync(log, "a")
  try {
    const child = spawnSync(exe, args, {
      cwd,
      env: childEnv,
      stdio: ["ignore", fd, fd],
    })
    if (child.error) throw child.error
    if (child.status !== 0)
      throw new StageExit(
        child.status ?? 1,
        `${exe} failed (signal ${child.signal ?? "none"})`,
      )
  } finally {
    closeSync(fd)
  }
}

function clone(source: string, revision: string, target: string) {
  git(
    source,
    "-c",
    "core.hooksPath=/dev/null",
    "clone",
    "--local",
    "--shared",
    "--no-checkout",
    "--quiet",
    source,
    target,
  )
  git(
    target,
    "-c",
    "core.hooksPath=/dev/null",
    "checkout",
    "--quiet",
    "--detach",
    revision,
  )
  requireValue(
    output(git(target, "rev-parse", "HEAD")) === revision &&
      !output(git(target, "status", "--porcelain")),
    "Staged checkout does not match its requested revision",
  )
  appendFileSync(join(target, ".git/info/exclude"), "\n/node_modules\n")
  symlinkSync(
    join(checkout.repo, "node_modules"),
    join(target, "node_modules"),
    "dir",
  )
}

try {
  const prerequisites = stage("preflight", (log) => {
    const capture = checkedFile(cfg.capture, "capture receipt")
    requireValue(
      capture.path === join(dirname(capture.path), "capture.json"),
      "Capture must point to the canonical capture.json",
    )
    const expectations = checkedFile(cfg.expectations, "expectations")
    const acceptance = checkedFile(cfg.acceptance, "independent acceptance")
    requireValue(
      statSync(acceptance.path).uid === process.getuid?.() &&
        (statSync(acceptance.path).mode & 0o077) === 0,
      "Acceptance must be owner-only",
    )
    const traineddata = checkedFile(cfg.traineddata, "local traineddata")
    const receipt = JSON.parse(output(capture.bytes))
    requireValue(
      receipt.producer.language.sha256 === cfg.traineddata.sha256,
      "Capture traineddata identity mismatch",
    )
    requireValue(
      receipt.manifestSha256 ===
        sha256(readFileSync(join(checkout.repo, "eval/manifest.json"))),
      "Capture source manifest identity mismatch",
    )
    requireValue(
      receipt.cases.length === 63 &&
        new Set(receipt.cases.map((row: { id: string }) => row.id)).size === 63,
      "Capture must contain 63 distinct cases",
    )
    for (const [i, row] of receipt.cases.entries()) {
      requireValue(
        row.id === `packet-${String(i + 1).padStart(3, "0")}`,
        "Unexpected capture case inventory",
      )
      checkedFile(
        {
          path: join(checkout.repo, "eval/packets", row.id + ".md"),
          sha256: row.inputSha256,
        },
        row.id + " input",
      )
      checkedFile(
        {
          path: join(dirname(capture.path), "ocr", row.id + ".json"),
          sha256: row.ocrSha256,
        },
        row.id + " OCR",
      )
    }
    requireValue(
      existsSync(join(checkout.repo, "node_modules/tsx/dist/loader.mjs")),
      "Install the reviewed lockfile before running the local gate",
    )
    requireValue(
      sha256(readFileSync(join(checkout.repo, "package-lock.json"))) ===
        historicalLock,
      "Dependency lock differs from the reviewed historical lock",
    )
    const historicalNode = canonicalPath(cfg.historicalNode)
    const runtime = output(
      captureOutput(
        historicalNode,
        [
          "-e",
          "const {versions}=require('sharp'); console.log([process.version,process.platform,process.arch,versions.sharp,versions.vips].join(' '))",
        ],
        checkout.repo,
      ),
    )
    requireValue(
      runtime === "v24.14.1 darwin arm64 0.34.5 8.17.3",
      `Historical runtime mismatch: ${runtime}`,
    )
    const trees = new Map<string, Map<string, string>>()
    function tree(revision: string) {
      if (!trees.has(revision)) trees.set(revision, entries(archive, revision))
      return trees.get(revision)!
    }
    const blobHashes = new Map<string, string>()
    function assertBlob(blob: string, expected: string, filename: string) {
      if (!blobHashes.has(blob))
        blobHashes.set(blob, sha256(git(archive, "cat-file", "blob", blob)))
      requireValue(
        blobHashes.get(blob) === expected,
        `Historical SHA-256 mismatch: ${filename}`,
      )
    }
    const plans = historical.map((item) => {
      const base = tree(item.revision)
      requireValue(
        base.has("scripts/evaluate.ts"),
        `Historical evaluator missing: ${item.label}`,
      )
      assertBlob(
        base.get("package-lock.json")!,
        historicalLock,
        "package-lock.json",
      )
      const recovery = item.recovery ? tree(item.recovery) : undefined
      const files = inventory(
        checkedFile(cfg.inventories[item.label], item.label + " inventory")
          .bytes,
        item.root,
      )
      const restored = new Map<string, string>()
      for (const [file, hash] of files) {
        const blob = base.get(file) ?? recovery?.get(file)
        requireValue(blob, `Missing archived artifact: ${item.label} ${file}`)
        if (!base.has(file)) {
          const allow =
            file.startsWith(item.root + "/artifacts/") ||
            (item.label === "stage-d-blind2" &&
              file.startsWith(item.root + "/results/"))
          requireValue(allow, `Unexpected recovery path: ${file}`)
          restored.set(file, blob!)
        }
        assertBlob(blob!, hash, file)
      }
      const manifestFile = item.root + "/manifest.json"
      const metricFile = item.root + "/results/metrics.json"
      requireValue(
        files.has(manifestFile) && files.has(metricFile),
        "Historical manifest or metrics missing",
      )
      if (item.set === "holdout" || item.set === "holdout-v2")
        requireValue(
          files.has(item.root + "/FREEZE.json"),
          "Historical freeze absent",
        )
      if (item.label === "stage-d-blind2")
        requireValue(
          files.has(item.root + "/results/first-score.json"),
          "Historical first score absent",
        )
      const manifest = JSON.parse(
        output(git(archive, "cat-file", "blob", base.get(manifestFile)!)),
      )
      const ids: string[] = manifest.packets.map(
        (row: { packet_id: string }) => row.packet_id,
      )
      requireValue(
        ids.length === item.count &&
          new Set(ids).size === item.count &&
          ids.every((id) => /^[a-z]+[a-z0-9-]*-\d+$/.test(id)),
        "Historical coverage mismatch",
      )
      for (const id of ids)
        for (const [dir, ext] of [
          ["packets", "md"],
          ["gold", "json"],
          ["artifacts", "json"],
          ["results", "json"],
        ])
          requireValue(
            files.has(`${item.root}/${dir}/${id}.${ext}`),
            `Missing historical case artifact: ${id} ${dir}`,
          )
      appendFileSync(
        log,
        `${item.label}: ${ids.length} cases, ${files.size} archived file hashes verified\n`,
      )
      return { ...item, files, restored, ids }
    })
    appendFileSync(
      log,
      `63 current inputs and OCR files verified. Historical runtime: ${runtime}\n`,
    )
    return {
      capture,
      expectations,
      acceptance,
      traineddata,
      historicalNode,
      plans,
    }
  })
  const candidate = join(run, "candidate")
  stage("stage-candidate", () => {
    clone(checkout.repo, checkout.revision, candidate)
    mkdirSync(join(candidate, ".cache"))
    writeFileSync(
      join(candidate, ".cache/eng.traineddata"),
      prerequisites.traineddata.bytes,
      { flag: "wx" },
    )
  })
  const currentEnv = {
    ...env,
    PATH: dirname(process.execPath) + ":" + env.PATH,
  }
  stage("development", (log) => {
    const expectationPath = join(run, "expectations.json")
    const approvalPath = join(run, "acceptance.json")
    writeFileSync(expectationPath, prerequisites.expectations.bytes, {
      flag: "wx",
    })
    writeFileSync(approvalPath, prerequisites.acceptance.bytes, { flag: "wx" })
    command(
      log,
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/development-gate.ts",
        "check",
        dirname(prerequisites.capture.path),
        expectationPath,
        approvalPath,
      ],
      candidate,
      currentEnv,
    )
    const report = JSON.parse(readFileSync(log, "utf8"))
    requireValue(
      passFields(report, checkout.revision) &&
        report.captureSha256 === cfg.capture.sha256 &&
        report.expectationsSha256 === cfg.expectations.sha256 &&
        report.acceptanceSha256 === cfg.acceptance.sha256,
      "Approved development coverage or identity did not pass",
    )
  })
  for (const plan of prerequisites.plans) {
    stage(plan.label, (log) => {
      const root = join(run, plan.label)
      clone(archive, plan.revision, root)
      for (const [file, blob] of plan.restored) {
        const bytes = git(archive, "cat-file", "blob", blob)
        requireValue(
          sha256(bytes) === plan.files.get(file),
          `Recovery bytes changed: ${file}`,
        )
        const path = join(root, file)
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, bytes, { flag: "wx" })
      }
      const verify = () => {
        for (const [file, digest] of plan.files)
          requireValue(
            sha256(readFileSync(join(root, file))) === digest,
            `Staged evidence changed: ${file}`,
          )
      }
      verify()
      try {
        command(
          log,
          prerequisites.historicalNode,
          [
            "--import",
            "tsx",
            "scripts/evaluate.ts",
            "--set",
            plan.set,
            "--check",
          ],
          root,
        )
        const replay = readFileSync(log, "utf8")
        const ids = [...replay.matchAll(/^([a-z][a-z0-9-]+-\d+): CER /gm)].map(
          (m) => m[1],
        )
        requireValue(
          ids.length === plan.count &&
            new Set(ids).size === plan.count &&
            plan.ids.every((id) => ids.includes(id)) &&
            replay.includes(
              `metrics reproduced exactly from ${plan.count} OCR artifacts`,
            ),
          `Historical command did not reproduce all ${plan.count} cases`,
        )
      } finally {
        verify()
      }
    })
  }
  for (const set of ["holdout", "holdout-v2"])
    stage(`freeze-${set}`, (log) =>
      command(
        log,
        process.execPath,
        ["--import", "tsx", "scripts/holdout.ts", "verify"],
        candidate,
        { ...currentEnv, HOLDOUT_DIR: `eval/${set}` },
      ),
    )
  stage("typecheck", (log) =>
    command(log, "npm", ["run", "typecheck"], candidate, currentEnv),
  )
  stage("unit", (log) => command(log, "npm", ["test"], candidate, currentEnv))
  stage("ui", (log) => {
    const active = output(captureOutput("ps", ["-Ao", "comm"], candidate))
    if (/(?:^|\/)(?:xcodebuild|xctest|devicectl|ios-deploy)\s*$/m.test(active))
      throw new StageExit(75, "UI deferred while native testing has the host")
    command(log, "npm", ["run", "test:ui"], candidate, currentEnv)
    const tests = JSON.parse(
      readFileSync(join(candidate, "test-results/ui.json"), "utf8"),
    ).stats
    requireValue(
      tests.expected === 21 &&
        tests.unexpected === 0 &&
        tests.skipped === 0 &&
        tests.flaky === 0,
      "UI did not pass all 21 expected browser tests",
    )
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  checkout.checkClean()
  writeFileSync(
    join(run, "stages.json"),
    JSON.stringify({ revision: checkout.revision, status }, null, 2) + "\n",
    { flag: "wx" },
  )
}
