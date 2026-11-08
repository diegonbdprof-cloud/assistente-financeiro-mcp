import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const port = 4173;
const prefix = "/assistente-financeiro-mcp";
const root = path.resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.includes("\0") || pathname.includes("..")) {
    res.writeHead(400);
    res.end("bad path");
    return;
  }
  if (pathname === prefix) {
    res.writeHead(302, { Location: `${prefix}/` });
    res.end();
    return;
  }
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  let rel = pathname.slice(prefix.length + 1);
  if (rel === "") rel = "index.html";
  const file = path.resolve(root, rel);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(400);
    res.end("bad path");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1");
