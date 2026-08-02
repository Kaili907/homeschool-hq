import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_ARTIFACTS = Object.freeze({
  "tutor-core": {
    acceptedFileNames: [
      "manuel-academy-adaptive-tutor-core-v0.2.zip",
      "manuel-academy-adaptive-tutor-core-v0.2 .zip",
    ],
    sha256: "38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276",
  },
  "study-contracts": {
    acceptedFileNames: ["CARD-1-STUDY-CONTRACTS.zip"],
    sha256: "79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41",
  },
  "study-engine": {
    acceptedFileNames: ["manuel-academy-session-2-study-engine.zip"],
    sha256: "979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770",
  },
  reconciliation: {
    acceptedFileNames: ["SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip"],
    sha256: "39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41",
  },
});

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex").toUpperCase();
}

export async function verifyArtifact(kind, filePath) {
  const expected = EXPECTED_ARTIFACTS[kind];
  if (!expected) throw new Error("Unknown authoritative artifact kind.");
  const info = await stat(filePath);
  const fileName = path.basename(filePath);
  const calculatedSha256 = await sha256File(filePath);
  return {
    kind,
    sourcePath: path.resolve(filePath),
    fileName,
    size: info.size,
    calculatedSha256,
    expectedSha256: expected.sha256,
    fileNameAccepted: expected.acceptedFileNames.includes(fileName),
    checksumResult:
      calculatedSha256 === expected.sha256 ? "PASS" : "FAIL",
  };
}

async function walkFiles(root, relative = "") {
  const absolute = path.join(root, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, child)));
    } else {
      files.push(child.split(path.sep).join("/"));
    }
  }
  return files.sort();
}

export async function verifyTutorManifest(tutorRoot) {
  const manifestPath = path.join(tutorRoot, "MANIFEST.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const listed = new Map();
  const failures = [];
  if (
    manifest.package !== "@manuel-academy/adaptive-tutor-core" ||
    manifest.version !== "0.2.0" ||
    manifest.hash_algorithm !== "sha256" ||
    !Array.isArray(manifest.files)
  ) {
    failures.push("manifest-header");
  }
  for (const entry of manifest.files ?? []) {
    if (
      typeof entry?.path !== "string" ||
      typeof entry?.bytes !== "number" ||
      typeof entry?.sha256 !== "string" ||
      entry.path.includes("\\") ||
      entry.path.startsWith("/") ||
      entry.path.split("/").includes("..") ||
      listed.has(entry.path)
    ) {
      failures.push("invalid-manifest-entry");
      continue;
    }
    listed.set(entry.path, entry);
    const absolute = path.join(tutorRoot, ...entry.path.split("/"));
    try {
      const info = await lstat(absolute);
      if (!info.isFile() || info.isSymbolicLink()) {
        failures.push(`non-regular:${entry.path}`);
        continue;
      }
      if (info.size !== entry.bytes) failures.push(`size:${entry.path}`);
      const actual = (await sha256File(absolute)).toLowerCase();
      if (actual !== entry.sha256.toLowerCase()) {
        failures.push(`sha256:${entry.path}`);
      }
    } catch {
      failures.push(`missing:${entry.path}`);
    }
  }
  const actualFiles = await walkFiles(tutorRoot);
  const excluded = new Set(["MANIFEST.json", "docs/file-inventory.md"]);
  const unlisted = actualFiles.filter(
    (entry) => !excluded.has(entry) && !listed.has(entry),
  );
  const totalBytes = [...listed.values()].reduce(
    (sum, entry) => sum + entry.bytes,
    0,
  );
  if (manifest.file_count !== listed.size) failures.push("file-count");
  if (manifest.total_bytes !== totalBytes) failures.push("total-bytes");
  if (unlisted.length > 0) failures.push("unlisted-files");
  return {
    result: failures.length === 0 ? "PASS" : "FAIL",
    package: manifest.package,
    version: manifest.version,
    declaredFileCount: manifest.file_count,
    verifiedFileCount: listed.size,
    declaredTotalBytes: manifest.total_bytes,
    calculatedTotalBytes: totalBytes,
    missingOrMismatchedCount: failures.filter(
      (item) =>
        item.startsWith("missing:") ||
        item.startsWith("size:") ||
        item.startsWith("sha256:") ||
        item.startsWith("non-regular:"),
    ).length,
    unlistedCount: unlisted.length,
    failures,
  };
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Expected --name value argument pairs.");
    }
    values[key.slice(2)] = value;
  }
  return values;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const required = [
    "tutor-zip",
    "study-contracts-zip",
    "study-engine-zip",
    "reconciliation-zip",
    "tutor-root",
  ];
  if (required.some((key) => !args[key])) {
    throw new Error("All four artifact paths and --tutor-root are required.");
  }
  const artifacts = await Promise.all([
    verifyArtifact("tutor-core", args["tutor-zip"]),
    verifyArtifact("study-contracts", args["study-contracts-zip"]),
    verifyArtifact("study-engine", args["study-engine-zip"]),
    verifyArtifact("reconciliation", args["reconciliation-zip"]),
  ]);
  const tutorManifest = await verifyTutorManifest(args["tutor-root"]);
  const result =
    artifacts.every((entry) => entry.checksumResult === "PASS") &&
    tutorManifest.result === "PASS"
      ? "PASS"
      : "FAIL";
  process.stdout.write(
    `${JSON.stringify({ result, artifacts, tutorManifest }, null, 2)}\n`,
  );
  process.exitCode = result === "PASS" ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Source verification failed."}\n`,
    );
    process.exitCode = 1;
  });
}
