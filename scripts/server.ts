import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { loadManifest } from "../services/pipeline.js"
import { appendReview, readReviews } from "../services/audit/index.js"
const value = (key: string, fallback: string) =>
  process.argv.includes(key)
    ? process.argv[process.argv.indexOf(key) + 1]
    : fallback
const port = Number(value("--port", "4178"))
const auditPath = value("--audit", ".runtime/reviews.jsonl")
const manifest = await loadManifest()
const ids = new Set(manifest.packets.map((p) => p.packet_id))
const json = (
  res: import("node:http").ServerResponse,
  code: number,
  data: unknown,
) => {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(data))
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`)
    const path = url.pathname
    if (req.method === "GET" && path === "/api/packets") {
      const reviews = await readReviews(auditPath)
      return json(res, 200, {
        ...manifest,
        packets: manifest.packets.map((p) => ({
          ...p,
          lastAction:
            reviews.filter((r) => r.packetId === p.packet_id).at(-1)?.action ??
            null,
        })),
      })
    }
    if (req.method === "GET" && path === "/api/metrics")
      return json(
        res,
        200,
        JSON.parse(await readFile("eval/results/metrics.json", "utf8")),
      )
    if (req.method === "GET" && path === "/api/failures") {
      const rows = await Promise.all(
        manifest.packets.map(async (p) => {
          const result = JSON.parse(
            await readFile(`eval/results/${p.packet_id}.json`, "utf8"),
          )
          return { ...p, failures: result.failures, scores: result.scores }
        }),
      )
      return json(res, 200, rows)
    }
    const match = path.match(/^\/api\/packets\/(packet-\d{3})(\/reviews)?$/)
    if (match && ids.has(match[1])) {
      const packetId = match[1]
      if (req.method === "GET") {
        if (match[2])
          return json(
            res,
            200,
            (await readReviews(auditPath)).filter(
              (r) => r.packetId === packetId,
            ),
          )
        const result = JSON.parse(
          await readFile(`eval/results/${packetId}.json`, "utf8"),
        )
        const criteria = JSON.parse(
          await readFile(`eval/criteria/${result.criteria_id}.json`, "utf8"),
        )
        return json(res, 200, { ...result, policy: criteria })
      }
      if (req.method === "POST" && match[2]) {
        if (
          req.headers.origin &&
          req.headers.origin !== `http://127.0.0.1:${port}`
        )
          return json(res, 403, { error: "Local review origin required" })
        let body = ""
        for await (const chunk of req) {
          body += chunk
          if (body.length > 16000)
            return json(res, 413, { error: "Review note too long" })
        }
        const input = JSON.parse(body)
        if (typeof input.target !== "string" || typeof input.note !== "string")
          return json(res, 400, { error: "Target and note required" })
        const result = JSON.parse(
          await readFile(`eval/results/${packetId}.json`, "utf8"),
        )
        const targets = [
          "packet",
          ...result.entities.map((e: { id: string }) => e.id),
          ...result.criteria.map(
            (c: { criterion_id: string }) => c.criterion_id,
          ),
        ]
        if (!targets.includes(input.target))
          return json(res, 400, { error: "Unknown review target" })
        return json(
          res,
          201,
          await appendReview(auditPath, {
            packetId,
            action: input.action,
            target: input.target,
            note: input.note,
          }),
        )
      }
    }
    if (req.method !== "GET")
      return json(res, 405, { error: "Method not allowed" })
    const file =
      path === "/"
        ? "web/index.html"
        : path.startsWith("/eval/artifacts/")
          ? path.slice(1)
          : `web${path}`
    const full = resolve(file)
    const allowed = [resolve("web") + sep, resolve("eval/artifacts") + sep]
    if (!allowed.some((root) => full.startsWith(root)))
      return json(res, 404, { error: "Not found" })
    const data = await readFile(full)
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".pdf": "application/pdf",
    }
    res.writeHead(200, {
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'",
    })
    res.end(data)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 400
    json(res, code, {
      error:
        code === 404
          ? "Packet artifacts missing. Run npm run eval first."
          : "Review could not be saved. Check the action and include a correction or flag note.",
    })
  }
})
server.listen(port, "127.0.0.1", () =>
  console.log(`Synthetic review workspace at http://127.0.0.1:${port}`),
)
