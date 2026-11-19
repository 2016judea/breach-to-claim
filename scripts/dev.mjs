// Local server for driving the site: static public/ plus the two functions, like Vercel.
// node scripts/dev.mjs [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const port = Number(process.argv[2]) || 4321;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
process.env.BTC_NO_ANALYTICS = "1";
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/mcp" || u.pathname.startsWith("/api/")) {
    const name = u.pathname === "/mcp" ? "mcp" : u.pathname.slice(5);
    req.query = Object.fromEntries(u.searchParams);
    return (await import(`../api/${name}.js`)).default(req, res);
  }
  let f = path.join(root, decodeURIComponent(u.pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("content-type", types[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log("http://localhost:" + port));
