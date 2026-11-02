import { appendFile, readFile, mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { createHash, randomUUID } from "node:crypto"
import type { ReviewInput, ReviewEvent } from "../contracts.js"
const queues = new Map<string, Promise<unknown>>()
const hash = (value: object) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex")
export async function readReviews(path: string): Promise<ReviewEvent[]> {
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return []
    throw e
  }
  const rows: ReviewEvent[] = raw.trim()
    ? raw
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : []
  let previous = "genesis"
  for (const { hash: digest, ...event } of rows) {
    if (event.previousHash !== previous || hash(event) !== digest)
      throw new Error("Audit integrity check failed")
    previous = digest
  }
  return rows
}
export async function appendReview(
  path: string,
  input: ReviewInput,
): Promise<ReviewEvent> {
  if (
    !["accept", "correct", "flag"].includes(input.action) ||
    !input.packetId ||
    !input.target ||
    typeof input.note !== "string" ||
    (input.action !== "accept" && !input.note.trim())
  )
    throw new Error("Review action and correction or flag note required")
  const pending = (queues.get(path) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await mkdir(dirname(path), { recursive: true })
      const previous = (await readReviews(path)).at(-1)
      const event = {
        ...input,
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        previousHash: previous?.hash ?? "genesis",
        reviewed: false as const,
      }
      const row = { ...event, hash: hash(event) }
      await appendFile(path, JSON.stringify(row) + "\n", { mode: 0o600 })
      return row
    })
  queues.set(path, pending)
  try {
    return await pending
  } finally {
    if (queues.get(path) === pending) queues.delete(path)
  }
}
