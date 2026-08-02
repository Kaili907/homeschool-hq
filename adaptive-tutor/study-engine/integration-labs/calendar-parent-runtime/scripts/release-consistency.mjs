import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const labDirectory = resolve(scriptsDirectory, "..");
const studyEngineDirectory = resolve(labDirectory, "..", "..");
const testsDirectory = join(
  studyEngineDirectory,
  "tests",
  "calendar-parent-runtime",
);
const docsDirectory = join(
  studyEngineDirectory,
  "docs",
  "calendar-parent-runtime",
);
const distDirectory = join(labDirectory, "dist");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function normalizedRelative(from, path) {
  return relative(from, path).replaceAll("\\", "/");
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      )
      .map(async (entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesBelow(path) : [path];
      }),
  );
  return nested.flat();
}

async function digestFiles(root, files) {
  const lines = await Promise.all(
    [...files]
      .sort((left, right) => {
        const leftName = normalizedRelative(root, left);
        const rightName = normalizedRelative(root, right);
        return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
      })
      .map(async (path) => {
        const bytes = await readFile(path);
        return `${normalizedRelative(root, path)}:${sha256(bytes)}`;
      }),
  );
  return sha256(lines.join("\n"));
}

const rootSourceFiles = (await readdir(labDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => join(labDirectory, entry.name));
const scriptSourceFiles = await filesBelow(scriptsDirectory);
const testSourceFiles = await filesBelow(testsDirectory);
const releaseSourceFiles = [
  ...rootSourceFiles,
  ...scriptSourceFiles,
  ...testSourceFiles,
];
const sourceTreeDigest = await digestFiles(
  studyEngineDirectory,
  releaseSourceFiles,
);

if (process.argv.includes("--print-source-digest")) {
  process.stdout.write(
    `${JSON.stringify(
      {
        algorithm: "SHA-256",
        ordering: "normalized relative path, ascending Unicode code-point order",
        pathNormalization: "forward slash",
        files: releaseSourceFiles.length,
        sourceTreeDigest,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

const distFiles = await filesBelow(distDirectory);
const bundleDigest = await digestFiles(distDirectory, distFiles);
const bundleFiles = distFiles
  .map((path) => normalizedRelative(distDirectory, path))
  .sort();

const evidence = JSON.parse(
  await readFile(join(docsDirectory, "release-evidence.json"), "utf8"),
);
const packageJson = JSON.parse(
  await readFile(join(labDirectory, "package.json"), "utf8"),
);
const packageLock = JSON.parse(
  await readFile(join(labDirectory, "package-lock.json"), "utf8"),
);
const adapterManifest = JSON.parse(
  await readFile(join(docsDirectory, "canonical-adapter-manifest.json"), "utf8"),
);

invariant(packageJson.version === evidence.version, "package.json version drift.");
invariant(packageLock.version === evidence.version, "package-lock version drift.");
invariant(
  packageLock.packages?.[""]?.version === evidence.version,
  "package-lock root version drift.",
);
invariant(
  adapterManifest.version === evidence.version,
  "adapter-manifest version drift.",
);
invariant(
  packageJson.engines?.node === evidence.nodeEngine,
  "package.json Node engine drift.",
);
invariant(
  packageLock.packages?.[""]?.engines?.node === evidence.nodeEngine,
  "package-lock Node engine drift.",
);
invariant(
  sourceTreeDigest === evidence.sourceTreeDigest,
  `Source-tree digest drift: expected ${evidence.sourceTreeDigest}, got ${sourceTreeDigest}.`,
);
invariant(
  bundleDigest === evidence.bundleDigest,
  `Bundle digest drift: expected ${evidence.bundleDigest}, got ${bundleDigest}.`,
);
invariant(
  JSON.stringify(bundleFiles) === JSON.stringify(evidence.bundleFiles),
  "Bundle file inventory drift.",
);

const reportNames = [
  "validation-report.md",
  "file-manifest.md",
  "SESSION-8-HANDOFF.md",
  "deterministic-build-report.md",
  "clean-extraction-validation-report.md",
  "archive-audit-report.md",
];
const requiredFacts = [
  evidence.version,
  evidence.nodeVersion,
  evidence.nodeEngine,
  evidence.sourceTreeDigest,
  evidence.bundleDigest,
  String(evidence.transformedModules),
  String(evidence.testCount),
  evidence.zipFilename,
];
for (const reportName of reportNames) {
  const report = await readFile(join(docsDirectory, reportName), "utf8");
  for (const fact of requiredFacts) {
    invariant(report.includes(fact), `${reportName} is missing release fact ${fact}.`);
  }
  for (const staleDigest of evidence.rejectedHistoricalBundleDigests) {
    invariant(
      !report.includes(staleDigest),
      `${reportName} contains stale bundle digest ${staleDigest}.`,
    );
  }
}

invariant(
  JSON.stringify(adapterManifest.releaseEvidence) ===
    JSON.stringify({
      sourceTreeDigest: evidence.sourceTreeDigest,
      bundleDigest: evidence.bundleDigest,
      transformedModules: evidence.transformedModules,
      testCount: evidence.testCount,
      zipFilename: evidence.zipFilename,
    }),
  "Adapter-manifest release evidence drift.",
);

process.stdout.write(
  `${JSON.stringify(
    {
      result: "PASS",
      version: evidence.version,
      nodeVersion: evidence.nodeVersion,
      nodeEngine: evidence.nodeEngine,
      releaseSourceFiles: releaseSourceFiles.length,
      sourceTreeDigest,
      bundleFiles,
      bundleDigest,
      transformedModules: evidence.transformedModules,
      testCount: evidence.testCount,
      zipFilename: evidence.zipFilename,
    },
    null,
    2,
  )}\n`,
);
