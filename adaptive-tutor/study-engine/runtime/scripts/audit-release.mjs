import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const runtimeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const studyEngineRoot = resolve(runtimeRoot, "..");
const adaptiveTutorRoot = resolve(studyEngineRoot, "..");
const releaseRoot = resolve(studyEngineRoot, "release");
const evidencePath = resolve(releaseRoot, "release-evidence.json");
const manifestPath = resolve(releaseRoot, "file-manifest.json");
const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex").toUpperCase();
const normalized = (from, path) => relative(from, path).replaceAll("\\", "/");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function filesBelow(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) result.push(...(await filesBelow(path)));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

async function digestFiles(root, files) {
  const lines = await Promise.all(
    files
      .map((path) => [normalized(root, path), path])
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(async ([name, path]) => `${name}:${sha256(await readFile(path))}`),
  );
  return sha256(lines.join("\n"));
}

const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const packageJson = JSON.parse(
  await readFile(resolve(runtimeRoot, "package.json"), "utf8"),
);
const packageLock = JSON.parse(
  await readFile(resolve(runtimeRoot, "package-lock.json"), "utf8"),
);

invariant(packageJson.version === "1.0.0-rc.1", "Runtime version drift.");
invariant(packageLock.version === packageJson.version, "Lockfile version drift.");
invariant(
  packageLock.packages?.[""]?.version === packageJson.version,
  "Lockfile root version drift.",
);
invariant(
  packageJson.engines?.node === ">=22 <23",
  "Node engine boundary drift.",
);
invariant(
  evidence.manifestDigest === sha256(manifestBytes),
  "Manifest digest drift.",
);
invariant(
  evidence.manifestEntries === manifest.files.length,
  "Manifest entry count drift.",
);
invariant(
  evidence.fileCount === manifest.files.length + 2,
  "Archive file count drift.",
);

for (const entry of manifest.files) {
  invariant(
    typeof entry.path === "string" &&
      entry.path.startsWith("adaptive-tutor/") &&
      !entry.path.includes("\\") &&
      !entry.path.split("/").includes("..") &&
      !entry.path.split("/").includes("node_modules") &&
      !entry.path.toLowerCase().endsWith(".zip"),
    `Unsafe manifest path: ${entry.path}`,
  );
  const path = resolve(
    adaptiveTutorRoot,
    ...entry.path.slice("adaptive-tutor/".length).split("/"),
  );
  const info = await stat(path);
  invariant(info.isFile(), `Manifest target is not a file: ${entry.path}`);
  invariant(info.size === entry.bytes, `Manifest size drift: ${entry.path}`);
  invariant(
    sha256(await readFile(path)) === entry.sha256,
    `Manifest SHA-256 drift: ${entry.path}`,
  );
}

const allFiles = await filesBelow(adaptiveTutorRoot);
const sourceFiles = allFiles.filter((path) => {
  const name = normalized(adaptiveTutorRoot, path);
  const parts = name.split("/");
  return (
    !parts.some((part) =>
      [
        ".git",
        ".vite",
        ".test-dist",
        "__pycache__",
        "coverage",
        "node_modules",
        "playwright-report",
        "test-results",
      ].includes(part),
    ) &&
    !name.endsWith(".zip") &&
    !name.endsWith("/debug.log") &&
    !name.startsWith("study-engine/release/") &&
    !name.startsWith("study-engine/runtime/dist/") &&
    !name.startsWith("study-engine/docs/final-assembly/screenshots/")
  );
});
invariant(
  sourceFiles.length === evidence.sourceTreeFiles,
  "Source-tree file count drift.",
);
invariant(
  (await digestFiles(adaptiveTutorRoot, sourceFiles)) ===
    evidence.sourceTreeDigest,
  "Source-tree digest drift.",
);

const bundleRoot = resolve(runtimeRoot, "dist");
const bundleFiles = await filesBelow(bundleRoot);
invariant(
  JSON.stringify(
    bundleFiles.map((path) => normalized(bundleRoot, path)).sort(),
  ) === JSON.stringify(evidence.bundleFiles),
  "Bundle file inventory drift.",
);
invariant(
  (await digestFiles(bundleRoot, bundleFiles)) === evidence.bundleDigest,
  "Bundle digest drift.",
);

const tracePath = resolve(
  releaseRoot,
  "traces",
  "deterministic-end-to-end.json",
);
const traceSeal = (
  await readFile(
    resolve(releaseRoot, "traces", "deterministic-end-to-end.sha256"),
    "utf8",
  )
).split(/\s+/u)[0];
invariant(
  traceSeal === evidence.traceHashes.canonicalSha256,
  "Canonical trace digest drift.",
);
invariant(
  sha256(await readFile(tracePath)) === evidence.traceHashes.fileSha256,
  "Trace file digest drift.",
);
invariant(
  evidence.testTotals.failed === 0 &&
    evidence.testTotals.nonBrowserPassed === 704 &&
    evidence.browserTotals.axeViolations === 0,
  "Test evidence is not release-acceptable.",
);

console.log(
  JSON.stringify(
    {
      result: "PASS",
      releaseVersion: packageJson.version,
      manifestEntries: manifest.files.length,
      sourceTreeDigest: evidence.sourceTreeDigest,
      bundleDigest: evidence.bundleDigest,
      traceDigest: evidence.traceHashes.canonicalSha256,
    },
    null,
    2,
  ),
);
