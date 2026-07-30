import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const build = spawnSync("node", ["scripts/build.mjs"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const root = resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const urlPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const requested = urlPath === "/" ? "/index.html" : urlPath;
    const candidate = normalize(join(root, requested));
    if (!candidate.startsWith(root)) throw new Error("Invalid path");
    const info = await stat(candidate);
    const file = info.isDirectory() ? join(candidate, "index.html") : candidate;
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(4173, "127.0.0.1", () => {
  console.log("Adaptive Tutor prototype: http://127.0.0.1:4173");
});
