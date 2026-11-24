import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join } from "node:path"

const root = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" }

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost")
    const file = join(root, decodeURIComponent(url.pathname))
    const data = await readFile(file)
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end("not found")
  }
}).listen(8399, "127.0.0.1", () => console.log("serving on http://127.0.0.1:8399"))
