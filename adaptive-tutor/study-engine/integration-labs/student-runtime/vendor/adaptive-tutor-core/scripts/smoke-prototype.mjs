import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, normalize } from "node:path";

const root = new URL("../dist/", import.meta.url);
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

const server = createServer(async (request, response) => {
  try {
    const requestPath = request.url === "/" ? "/index.html" : request.url ?? "/index.html";
    const relativePath = normalize(requestPath.split("?")[0]).replace(/^[/\\]+/, "");
    const fileUrl = new URL(relativePath, root);
    const filePath = fileUrl.pathname;
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Unable to resolve local server address.");
const base = `http://127.0.0.1:${address.port}`;

try {
  const [indexResponse, scriptResponse, styleResponse] = await Promise.all([
    fetch(`${base}/`),
    fetch(`${base}/prototype/main.js`),
    fetch(`${base}/prototype/styles.css`),
  ]);
  if (![indexResponse, scriptResponse, styleResponse].every((response) => response.ok)) {
    throw new Error("One or more prototype assets did not load.");
  }

  const [index, script, styles] = await Promise.all([
    indexResponse.text(),
    scriptResponse.text(),
    styleResponse.text(),
  ]);

  const assertions = [
    [index.includes("Manuel Academy Adaptive Tutor Core"), "prototype title"],
    [index.includes("./prototype/main.js"), "prototype module reference"],
    [index.includes("./prototype/styles.css"), "prototype stylesheet reference"],
    [script.includes("speechSynthesis"), "browser speech fallback"],
    [script.includes("Jarvis is an AI tutor"), "non-human identity disclosure"],
    [styles.includes("prefers-reduced-motion"), "reduced-motion fallback"],
    [styles.includes("jarvis-orb"), "Jarvis core styling"],
  ];

  const failures = assertions.filter(([passed]) => !passed).map(([, label]) => label);
  if (failures.length > 0) throw new Error(`Missing smoke-test assertions: ${failures.join(", ")}`);

  console.log("Static prototype smoke test: PASS");
  console.log(`Loaded index (${index.length} chars), JavaScript (${script.length} chars), and CSS (${styles.length} chars).`);
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
