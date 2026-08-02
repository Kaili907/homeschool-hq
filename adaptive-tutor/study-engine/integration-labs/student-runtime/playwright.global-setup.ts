import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { build } from "vite";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

export default async function globalSetup() {
  await build({ configLoader: "runner" });
  const distributionRoot = join(process.cwd(), "dist");
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const relativePath = normalize(decodeURIComponent(pathname)).replace(
      /^([/\\]|\.\.([/\\]|$))+/,
      "",
    );
    let filePath = join(distributionRoot, relativePath || "index.html");
    try {
      if ((await stat(filePath)).isDirectory()) {
        filePath = join(filePath, "index.html");
      }
      await stat(filePath);
    } catch {
      filePath = join(distributionRoot, "index.html");
    }
    response.setHeader(
      "Content-Type",
      contentTypes.get(extname(filePath)) ?? "application/octet-stream",
    );
    createReadStream(filePath).pipe(response);
  });
  await new Promise<void>((resolve) => server.listen(4327, "127.0.0.1", resolve));
  return async () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
}
