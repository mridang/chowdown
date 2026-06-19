// Tiny static HTTPS server for local dev.
// Serves the project over TLS so the origin matches production
// (https://chowdown.dev.mrida.ng). Run: node server.mjs
//
// Defaults to port 443 (run with sudo). The dev domain resolves to 127.0.0.1
// (loopback), so https://chowdown.dev.mrida.ng reaches this server. For a
// no-sudo run, set PORT=8443 (origin then needs the :8443 suffix in Google).
// Certs come from mkcert (see README).

import { createServer } from "node:https";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 443;
const HOST = "chowdown.dev.mrida.ng";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".cook": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const cert = await readFile(join(ROOT, "certs", `${HOST}.pem`));
const key = await readFile(join(ROOT, "certs", `${HOST}-key.pem`));

createServer({ cert, key }, (req, res) => {
  // Resolve the URL path safely within ROOT.
  const urlPath = decodeURIComponent(new URL(req.url, `https://${HOST}`).pathname);
  let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  if (rel.endsWith("/")) rel += "index.html";
  if (rel === "/") rel = "/index.html";
  const filePath = join(ROOT, rel);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  const type = TYPES[extname(filePath)] || "application/octet-stream";
  const stream = createReadStream(filePath);
  stream.on("open", () => {
    res.writeHead(200, { "content-type": type });
    stream.pipe(res);
  });
  stream.on("error", () => {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  });
}).listen(PORT, () => {
  const suffix = PORT === 443 ? "" : `:${PORT}`;
  console.log(`chowdown serving https://${HOST}${suffix}`);
});
