import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const labDirectory = resolve(scriptsDirectory, "..");
const distDirectory = join(labDirectory, "dist");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesBelow(path) : [path];
      }),
  );
  return nested.flat();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

const packageJson = JSON.parse(
  await readFile(join(labDirectory, "package.json"), "utf8"),
);
const packageLock = JSON.parse(
  await readFile(join(labDirectory, "package-lock.json"), "utf8"),
);

invariant(
  typeof packageJson.devDependencies?.["@types/node"] === "string",
  "@types/node must be an explicit lab devDependency.",
);
invariant(
  typeof packageLock.packages?.["node_modules/@types/node"]?.version ===
    "string",
  "package-lock.json must resolve @types/node.",
);
invariant(
  typeof packageJson.devDependencies?.["playwright-core"] === "string",
  "playwright-core must be explicit for reproducible browser audits.",
);
for (const dependency of ["typescript", "vite", "vitest"]) {
  invariant(
    typeof packageJson.devDependencies?.[dependency] === "string",
    `${dependency} must be an explicit lab devDependency.`,
  );
  invariant(
    typeof packageLock.packages?.[`node_modules/${dependency}`]?.version ===
      "string",
    `package-lock.json must resolve ${dependency}.`,
  );
}
invariant(
  packageJson.engines?.node === ">=24",
  "The tested Node runtime floor must remain explicit.",
);

invariant(
  (await stat(join(distDirectory, "index.html"))).isFile(),
  "Run the browser-safe Vite build before the Node audit.",
);

const builtFiles = await filesBelow(distDirectory);
const browserJavaScript = builtFiles.filter((path) => path.endsWith(".js"));
invariant(browserJavaScript.length > 0, "The build must contain browser JavaScript.");

const forbiddenBrowserPatterns = [
  { label: "Node builtin import", pattern: /\b(?:from|import)\s*\(?["']node:/ },
  { label: "CommonJS require", pattern: /\brequire\s*\(/ },
  { label: "process runtime", pattern: /\bprocess\.(?:env|cwd|argv)\b/ },
  { label: "Node Buffer", pattern: /\bBuffer\.(?:from|alloc)\b/ },
  { label: "__dirname", pattern: /\b__dirname\b/ },
];

for (const path of browserJavaScript) {
  const source = await readFile(path, "utf8");
  for (const { label, pattern } of forbiddenBrowserPatterns) {
    invariant(
      !pattern.test(source),
      `${label} leaked into browser bundle ${relative(labDirectory, path)}.`,
    );
  }
}

const firstDigest = sha256(
  (
    await Promise.all(
      builtFiles.map(async (path) => {
        const bytes = await readFile(path);
        return `${relative(distDirectory, path)}:${sha256(bytes)}`;
      }),
    )
  ).join("\n"),
);
const secondDigest = sha256(
  (
    await Promise.all(
      builtFiles.map(async (path) => {
        const bytes = await readFile(path);
        return `${relative(distDirectory, path)}:${sha256(bytes)}`;
      }),
    )
  ).join("\n"),
);

invariant(firstDigest === secondDigest, "Repeated bundle digest was not stable.");

const result = {
  result: "PASS",
  node: process.version,
  typesNode: packageLock.packages["node_modules/@types/node"].version,
  typescript: packageLock.packages["node_modules/typescript"].version,
  vite: packageLock.packages["node_modules/vite"].version,
  vitest: packageLock.packages["node_modules/vitest"].version,
  browserFilesAudited: builtFiles.length,
  browserJavaScriptFilesAudited: browserJavaScript.length,
  deterministicBundleDigest: firstDigest,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
