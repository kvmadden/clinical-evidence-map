import { rm } from "node:fs/promises"
export default async function teardown() {
  await rm(".runtime/ui-tests.jsonl", { force: true })
}
