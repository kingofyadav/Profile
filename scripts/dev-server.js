"use strict";

const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || process.env.DEV_PORT || 3000);
const ROOT = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico":  "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".txt":  "text/plain; charset=utf-8",
  ".xml":  "application/xml",
  ".webmanifest": "application/manifest+json",
};

function resolve(pathname) {
  // strip query string
  pathname = pathname.split("?")[0];

  // cleanUrls — try .html extension
  const candidates = [
    path.join(ROOT, pathname),
    path.join(ROOT, pathname + ".html"),
    path.join(ROOT, pathname, "index.html"),
  ];

  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) return candidate;
    } catch {}
  }
  return null;
}

const server = http.createServer((req, res) => {
  const parsed   = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(parsed.pathname || "/");

  const filePath = resolve(pathname) || resolve("/404");
  const status   = filePath && filePath.includes("404") ? 404 : filePath ? 200 : 404;

  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
    return;
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(status, {
      "Content-Type":  mime,
      "Cache-Control": "no-store",
      "X-Dev-Server":  "1",
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("500 Internal Error: " + err.message);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Dev server running`);
  console.log(`  Local   → http://localhost:${PORT}`);
  console.log(`  Network → http://0.0.0.0:${PORT}`);
  console.log(`\n  Static files served from: ${ROOT}`);
  console.log(`  API routes: run 'npm run dev:api' in a second terminal`);
  console.log(`  Tunnel:     run 'npm run tunnel' to expose via ngrok\n`);
});

server.on("error", err => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  Port ${PORT} is already in use. Kill the process or set DEV_PORT=XXXX\n`);
    process.exit(1);
  }
  throw err;
});
