// A held-out set's identity and the record of its first, blind score. Plain
// JavaScript so the evaluation, the report and the server judge a record the
// same way.
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"

// How a saved score came about. Only the first scoring run of a frozen set,
// before anyone changed a rule after seeing it, is blind. Every other run is
// a development result.
export const BLIND = "blind first run"
export const DEVELOPMENT = "development"

const sha256 = (data) => createHash("sha256").update(data).digest("hex")

// Each frozen file by its own sha256. Unlike one hash over the files run
// together, no two different sets of files can give the same list.
export async function frozenFiles(root) {
  const files = {}
  for (const sub of ["packets", "gold"])
    for (const f of (await readdir(`${root}/${sub}`)).sort())
      files[`${sub}/${f}`] = sha256(await readFile(`${root}/${sub}/${f}`))
  files["manifest.json"] = sha256(await readFile(`${root}/manifest.json`))
  return files
}

// The stored OCR each score was computed from.
export async function artifactFiles(root, ids) {
  const files = {}
  for (const id of ids)
    files[`artifacts/${id}.json`] = sha256(
      await readFile(`${root}/artifacts/${id}.json`),
    )
  return files
}

// Reads results/first-score.json and says whether it is a valid blind score
// for the set as it stands now: a blind first run, made under the freeze in
// FREEZE.json, over exactly the frozen files there now. A set whose freeze or
// files changed after its first score is a new set, and the old score does
// not describe it.
export async function readFirstScore(root) {
  const file = `${root}/results/first-score.json`
  if (!existsSync(file))
    return {
      record: null,
      valid: false,
      reason: "it has no first-score record",
    }
  let record
  try {
    record = JSON.parse(await readFile(file, "utf8"))
  } catch {
    return {
      record: null,
      valid: false,
      reason: "its first-score record does not parse",
    }
  }
  const invalid = (reason) => ({ record, valid: false, reason })
  if (record.runClass !== BLIND || record.metrics?.run?.class !== BLIND)
    return invalid("its first-score record is not of a blind first run")
  if (!existsSync(`${root}/FREEZE.json`))
    return invalid("it has no FREEZE.json")
  const frozen = JSON.parse(await readFile(`${root}/FREEZE.json`, "utf8"))
  if (record.identity?.frozenSha256 !== frozen.sha256)
    return invalid(
      "its FREEZE.json is not the freeze it was first scored under, so it is a different set",
    )
  let files
  try {
    files = await frozenFiles(root)
  } catch {
    return invalid("its frozen files cannot be read")
  }
  if (JSON.stringify(files) !== JSON.stringify(record.identity.files))
    return invalid("its frozen files changed after the first score")
  return { record, valid: true, reason: null }
}
