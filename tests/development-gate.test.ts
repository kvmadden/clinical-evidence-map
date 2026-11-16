import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import {
  copyFile,
  cp,
  mkdir,
  lstat,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import type * as Gate from "../scripts/development-gate.js"
import {
  captureConfiguration,
  captureRuntime,
  captureSchema,
  producerTreeDigest,
} from "../scripts/development-identity.js"
import { sha256, type extractStoredOcr } from "../scripts/stored-ocr.js"

const bytes = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n")
const allIds = Array.from(
  { length: 63 },
  (_, i) => `packet-${String(i + 1).padStart(3, "0")}`,
)
const [first, second] = allIds

async function fixture() {
  const scratch = await mkdtemp(join(tmpdir(), "clinical-development-gate-"))
  const root = join(scratch, "repo")
  const dir = join(scratch, "capture")
  const parent = fileURLToPath(new URL("../", import.meta.url))
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  for (const sub of ["eval/packets", "scripts"])
    await mkdir(join(root, sub), { recursive: true })
  await mkdir(join(dir, "ocr"), { recursive: true })
  await cp(join(parent, "services"), join(root, "services"), {
    recursive: true,
  })
  for (const file of [
    "development-gate.ts",
    "development-identity.ts",
    "development-capture.ts",
    "stored-ocr.ts",
  ])
    await copyFile(join(parent, "scripts", file), join(root, "scripts", file))
  await copyFile(join(parent, "package.json"), join(root, "package.json"))
  await writeFile(join(root, ".gitignore"), "node_modules\n")
  await symlink(join(parent, "node_modules"), join(root, "node_modules"), "dir")
  const manifest = bytes({
    packet_count: 63,
    groups: [],
    packets: allIds.map((packet_id) => ({
      packet_id,
      criteria_id: "pcsk9",
      render: {},
    })),
  })
  await writeFile(join(root, "eval/manifest.json"), manifest)
  const cases = await Promise.all(
    allIds.map(async (id) => {
      const text = id === first ? "Age: 46 years." : "Age: ____."
      const source = Buffer.concat([
        Buffer.from("<!-- SOURCE START -->\n"),
        Buffer.from(text),
      ])
      const ocr = bytes({
        fingerprint: "same-legacy-fingerprint",
        ocr: {
          text,
          engine: "tesseract.js 6 / English LSTM",
          threshold: 80,
          orientation: { pageRotation: 0, scores: {} },
          width: 100,
          height: 100,
          words: [
            {
              text: "Age:",
              start: 0,
              end: 4,
              confidence: 95,
              box: { x: 0, y: 0, width: 20, height: 10 },
            },
          ],
        },
      })
      await writeFile(join(root, "eval/packets", id + ".md"), source)
      await writeFile(join(dir, "ocr", id + ".json"), ocr)
      return { id, inputSha256: sha256(source), ocrSha256: sha256(ocr) }
    }),
  )
  git("init", "-q")
  git("add", ".gitignore", "package.json", "scripts", "services", "eval")
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-qm",
    "Fixture producer",
  )
  const revision = git("rev-parse", "HEAD")
  const capture = {
    schema: captureSchema,
    manifestSha256: sha256(manifest),
    producer: {
      revision,
      producerTreeSha256: producerTreeDigest(root, revision),
      runtime: captureRuntime(),
      language: { name: "eng", sha256: sha256("fixture only") },
      configuration: captureConfiguration,
    },
    cases,
  }
  const receipt = join(dir, "capture.json")
  await writeFile(receipt, bytes(capture))
  const gateUrl = pathToFileURL(join(root, "scripts/development-gate.ts")).href
  const ocrUrl = pathToFileURL(join(root, "scripts/stored-ocr.ts")).href
  const { runDevelopment } = (await import(gateUrl)) as typeof Gate
  const { extractStoredOcr } = (await import(
    ocrUrl
  )) as typeof import("../scripts/stored-ocr.js")
  return {
    scratch,
    root,
    dir,
    receipt,
    capture,
    revision,
    runDevelopment,
    extractStoredOcr,
  }
}

test("modified input, swapped OCR with the same fingerprint and bad receipt never reach extraction", async () => {
  const f = await fixture()
  const { runDevelopment, extractStoredOcr } = f
  try {
    let calls = 0
    const extract: typeof extractStoredOcr = (...args) => {
      calls++
      return extractStoredOcr(...args)
    }
    const source = join(f.root, "eval/packets", first + ".md")
    const originalSource = await readFile(source)
    await writeFile(
      source,
      Buffer.concat([originalSource, Buffer.from(" change")]),
    )
    await assert.rejects(
      runDevelopment(f.dir, undefined, extract),
      /Input SHA-256 mismatch/,
    )
    await writeFile(source, originalSource)
    const artifact = join(f.dir, "ocr", first + ".json")
    const originalOcr = await readFile(artifact)
    await copyFile(join(f.dir, "ocr", second + ".json"), artifact)
    await assert.rejects(
      runDevelopment(f.dir, undefined, extract),
      /Cached OCR SHA-256 mismatch/,
    )
    const altered = JSON.parse(originalOcr.toString())
    altered.ocr.words[0].box.width++
    await writeFile(artifact, bytes(altered))
    await assert.rejects(
      runDevelopment(f.dir, undefined, extract),
      /Cached OCR SHA-256 mismatch/,
    )
    await writeFile(artifact, originalOcr)
    await writeFile(
      f.receipt,
      bytes({
        ...f.capture,
        producer: { ...f.capture.producer, language: null },
      }),
    )
    await assert.rejects(
      runDevelopment(f.dir, undefined, extract),
      /producer receipt/,
    )
    await writeFile(
      f.receipt,
      bytes({
        ...f.capture,
        producer: {
          ...f.capture.producer,
          configuration: "incompatible",
        },
      }),
    )
    await assert.rejects(
      runDevelopment(f.dir, undefined, extract),
      /producer receipt/,
    )
    const runtime = f.capture.producer.runtime
    for (const bad of [
      { ...runtime, node: "" },
      { ...runtime, platform: "" },
      { ...runtime, arch: "" },
      { ...runtime, sharp: {} },
      { ...runtime, sharp: { ...runtime.sharp, vips: "" } },
    ]) {
      await writeFile(
        f.receipt,
        bytes({
          ...f.capture,
          producer: { ...f.capture.producer, runtime: bad },
        }),
      )
      await assert.rejects(
        runDevelopment(f.dir, undefined, extract),
        /producer receipt/,
      )
    }
    for (const bad of [
      [],
      f.capture.cases.slice(1),
      [...f.capture.cases, f.capture.cases[0]],
    ]) {
      await writeFile(f.receipt, bytes({ ...f.capture, cases: bad }))
      await assert.rejects(
        runDevelopment(f.dir, undefined, extract),
        /inventory mismatch/,
      )
    }
    await writeFile(f.receipt, bytes(f.capture))
    await rm(artifact)
    await assert.rejects(
      runDevelopment(f.dir, undefined, extract),
      /OCR cache inventory mismatch/,
    )
    assert.equal(calls, 0)
  } finally {
    await rm(f.scratch, { recursive: true, force: true })
  }
})

test("unchanged replay needs exact acceptance and equal-total case changes fail individually", async () => {
  const f = await fixture()
  const { runDevelopment, extractStoredOcr } = f
  try {
    const result = await runDevelopment(f.dir)
    assert.equal(result.status, "proposal-only")
    assert.equal(result.proposal?.extractorRevision, f.revision)
    const proposed = result.proposal!
    const expected = bytes(proposed)
    // Synthetic acceptance for this test only. The real baseline requires an independent review.
    const acceptance = {
      schema: "clinical-development-acceptance/v1",
      author: "Fixture builder",
      reviewer: "Fixture reviewer",
      reason: "Exercise the exact acceptance contract",
      decision: "accepted",
      priorExpectationSha256: null,
      expectationsSha256: sha256(expected),
      captureSha256: proposed.captureSha256,
      manifestSha256: proposed.manifestSha256,
      extractorRevision: proposed.extractorRevision,
      policy: proposed.policy,
      policySha256: proposed.policySha256,
      cases: allIds.map((id) => ({ id, disposition: "added" })),
    }
    const reviewed = { expected, accepted: bytes(acceptance) }
    const unchanged = await runDevelopment(f.dir, reviewed)
    assert.equal(unchanged.status, "passed")
    assert.deepEqual(unchanged.coverage, { compared: 63, required: 63 })
    let unexpectedCalls = 0
    const mustNotExtract: typeof extractStoredOcr = (...args) => {
      unexpectedCalls++
      return extractStoredOcr(...args)
    }
    await assert.rejects(
      runDevelopment(
        f.dir,
        {
          ...reviewed,
          accepted: bytes({ ...acceptance, reviewer: acceptance.author }),
        },
        mustNotExtract,
      ),
      /Independent acceptance/,
    )
    await assert.rejects(
      runDevelopment(
        f.dir,
        {
          ...reviewed,
          expected: Buffer.concat([expected, Buffer.from(" ")]),
        },
        mustNotExtract,
      ),
      /Acceptance identity mismatch/,
    )
    await assert.rejects(
      runDevelopment(
        f.dir,
        {
          ...reviewed,
          accepted: bytes({ ...acceptance, cases: acceptance.cases.slice(1) }),
        },
        mustNotExtract,
      ),
      /Acceptance inventory mismatch/,
    )
    assert.equal(unexpectedCalls, 0)
    const outcomes = new Map<
      string,
      ReturnType<
        typeof extractStoredOcr
      >["output"]["criteria"][number]["status"]
    >()
    const swap: typeof extractStoredOcr = (...args) => {
      const actual = extractStoredOcr(...args)
      const [, , id] = args
      const adult = actual.output.criteria.find(
        (c) => c.criterion_id === "adult",
      )!
      if (id === first || id === second) {
        outcomes.set(id, adult.status)
        adult.status = id === first ? "missing" : "evidence_found"
      }
      return actual
    }
    const changed = await runDevelopment(f.dir, reviewed, swap)
    assert.equal(outcomes.get(first), "evidence_found")
    assert.equal(outcomes.get(second), "missing")
    assert.equal(changed.status, "failed")
    assert.deepEqual(
      changed.differences?.map((d) => [d.id, d.changedFields]),
      [
        [first, ["criteria"]],
        [second, ["criteria"]],
      ],
    )
    await assert.rejects(
      runDevelopment(f.dir, reviewed, (...args) => {
        const actual = extractStoredOcr(...args)
        actual.output.criteria.pop()
        return actual
      }),
      /criteria inventory mismatch/,
    )
    const artifact = join(f.dir, "ocr", first + ".json")
    const approvedBytes = await readFile(artifact)
    await assert.rejects(
      runDevelopment(f.dir, reviewed, (...args) => {
        if (args[2] === first) {
          // The extraction uses the verified snapshot while the final identity check detects the disk change.
          execFileSync(process.execPath, [
            "-e",
            "require('node:fs').appendFileSync(process.argv[1], ' ')",
            artifact,
          ])
        }
        return extractStoredOcr(...args)
      }),
      /Cached OCR SHA-256 mismatch/,
    )
    assert.equal((await readFile(artifact)).length, approvedBytes.length + 1)
    assert.deepEqual(await readFile(f.receipt), bytes(f.capture))
  } finally {
    await rm(f.scratch, { recursive: true, force: true })
  }
})

test("CLI identity follows the loaded checkout and capture rejects a symlink into it", async () => {
  const f = await fixture()
  try {
    const decoy = join(f.scratch, "decoy")
    await mkdir(decoy)
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: decoy, encoding: "utf8" }).trim()
    git("init", "-q")
    git(
      "-c",
      "user.name=Decoy",
      "-c",
      "user.email=decoy@example.test",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "--allow-empty",
      "-qm",
      "Unrelated checkout",
    )
    assert.notEqual(git("rev-parse", "HEAD"), f.revision)
    const loader = fileURLToPath(
      new URL("../node_modules/tsx/dist/loader.mjs", import.meta.url),
    )
    const invoke = (file: string, ...args: string[]) =>
      spawnSync(process.execPath, ["--import", loader, file, ...args], {
        cwd: decoy,
        encoding: "utf8",
        maxBuffer: 10_000_000,
        env: {
          ...process.env,
          GIT_DIR: join(decoy, ".git"),
          GIT_WORK_TREE: decoy,
        },
      })
    const gate = join(f.scratch, "gate-link.ts")
    await symlink(join(f.root, "scripts/development-gate.ts"), gate)
    const proposal = invoke(gate, "propose", f.dir)
    assert.equal(proposal.status, 0, proposal.stderr)
    const result = JSON.parse(proposal.stdout)
    assert.equal(result.status, "proposal-only")
    assert.equal(result.proposal.extractorRevision, f.revision)
    assert.equal(result.proposal.cases.length, 63)

    const intoRepo = join(decoy, "repo-link")
    await symlink(join(f.root, "eval"), intoRepo, "dir")
    const capture = join(f.root, "scripts/development-capture.ts")
    const refused = invoke(
      capture,
      join(intoRepo, "new-capture"),
      join(decoy, "no-language"),
    )
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /outside the canonical repository/)
    await assert.rejects(lstat(join(f.root, "eval", "new-capture")), {
      code: "ENOENT",
    })

    const module = join(f.root, "scripts/development-gate.ts")
    await writeFile(
      module,
      Buffer.concat([
        await readFile(module),
        Buffer.from("\n// Uncommitted fixture change\n"),
      ]),
    )
    const dirty = invoke(gate, "propose", f.dir)
    assert.equal(dirty.status, 1)
    assert.match(dirty.stderr, /checkout must remain clean/)
    execFileSync("git", ["restore", "--", "scripts/development-gate.ts"], {
      cwd: f.root,
    })
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "--allow-empty",
        "-qm",
        "Advance the fixture checkout",
      ],
      { cwd: f.root },
    )
    await assert.rejects(f.runDevelopment(f.dir), /checkout must remain clean/)
  } finally {
    await rm(f.scratch, { recursive: true, force: true })
  }
})
