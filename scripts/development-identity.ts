import { execFileSync } from "node:child_process"
import { realpath } from "node:fs/promises"
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { sha256 } from "./stored-ocr.js"

export const captureSchema = "clinical-development-ocr/v2"
export const captureConfiguration =
  "repository createOcr and renderPacket defaults"

const producerPaths = [
  "scripts/development-capture.ts",
  "scripts/development-identity.ts",
  "scripts/stored-ocr.ts",
  "services",
  "assets",
  "eval/handwriting",
  "package-lock.json",
]

function git(repo: string, ...args: string[]) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  )
  return execFileSync("git", args, { cwd: repo, encoding: "utf8", env }).trim()
}

// The executed module lives directly under the Git root's scripts directory.
export async function moduleCheckout(moduleUrl: string) {
  const modulePath = await realpath(fileURLToPath(moduleUrl))
  const repo = dirname(dirname(modulePath))
  if ((await realpath(git(repo, "rev-parse", "--show-toplevel"))) !== repo)
    throw new Error("Development module is outside its canonical checkout")
  const moduleFile = relative(repo, modulePath)
  git(repo, "ls-files", "--error-unmatch", "--", moduleFile)
  const revision = git(repo, "rev-parse", "HEAD")
  return {
    repo,
    revision,
    checkClean() {
      if (
        git(repo, "rev-parse", "HEAD") !== revision ||
        git(repo, "status", "--porcelain", "--untracked-files=all")
      )
        throw new Error(
          "Development module checkout must remain clean at the executed revision",
        )
    },
  }
}

export function producerTreeDigest(repo: string, revision: string) {
  if (!/^[a-f0-9]{40}$/.test(revision))
    throw new Error("Invalid OCR producer revision")
  const entries = git(repo, "ls-tree", "-r", revision, "--", ...producerPaths)
  if (
    !entries
      .split("\n")
      .some((entry) => entry.endsWith("\tscripts/development-capture.ts"))
  )
    throw new Error("OCR producer tree is missing its capture module")
  return sha256(entries)
}

export function captureRuntime() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    sharp: sharp.versions,
  }
}

export function completeRuntime(
  runtime: unknown,
): runtime is ReturnType<typeof captureRuntime> {
  if (!runtime || typeof runtime !== "object") return false
  const {
    node,
    platform,
    arch,
    sharp: versions,
  } = runtime as Partial<ReturnType<typeof captureRuntime>>
  const supportedPlatforms = [
    "aix",
    "darwin",
    "freebsd",
    "linux",
    "openbsd",
    "sunos",
    "win32",
  ]
  const supportedArch = [
    "arm",
    "arm64",
    "ia32",
    "loong64",
    "mips",
    "mipsel",
    "ppc",
    "ppc64",
    "riscv64",
    "s390x",
    "x64",
  ]
  return (
    typeof node === "string" &&
    /^v\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(node) &&
    typeof platform === "string" &&
    supportedPlatforms.includes(platform) &&
    typeof arch === "string" &&
    supportedArch.includes(arch) &&
    versions !== null &&
    typeof versions === "object" &&
    !Array.isArray(versions) &&
    [versions.sharp, versions.vips].every(
      (value) =>
        typeof value === "string" &&
        /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value),
    ) &&
    Object.entries(versions).every(
      ([name, value]) =>
        name.length > 0 && typeof value === "string" && value.trim().length > 0,
    )
  )
}

export async function canonicalCaptureTarget(
  repo: string,
  destination: string,
) {
  if (!isAbsolute(destination)) throw new Error("Capture path must be absolute")
  const requested = resolve(destination)
  const parent = await realpath(dirname(requested))
  const target = resolve(parent, basename(requested))
  const rel = relative(repo, target)
  if (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  )
    throw new Error("The capture must be outside the canonical repository")
  return target
}
