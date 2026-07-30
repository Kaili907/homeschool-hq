import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const docsRoot = path.resolve(projectRoot, "../../docs/student-runtime");
const failures = [];

const readText = (file) => readFile(file, "utf8");
const readJson = async (file) => JSON.parse(await readText(file));
const requireMatch = (condition, message) => {
  if (!condition) failures.push(message);
};
const captureNumber = (text, expression, label) => {
  const match = text.match(expression);
  if (!match) {
    failures.push(`missing ${label}`);
    return undefined;
  }
  return Number(match[1]);
};
const sha256 = (text) =>
  createHash("sha256").update(text).digest("hex").toUpperCase();

const packageDocument = await readJson(path.join(projectRoot, "package.json"));
const lockDocument = await readJson(path.join(projectRoot, "package-lock.json"));
const releaseEvidence = await readJson(
  path.join(projectRoot, "release-evidence.json"),
);
const expectedZip = releaseEvidence.zipFilename;
const bridgeVersion = releaseEvidence.bridgeVersion;
const bridgeContractVersion = releaseEvidence.bridgeContractVersion;
const canonicalManifest = await readJson(
  path.join(docsRoot, "canonical-adapter-manifest.json"),
);
const sourceManifest = await readJson(
  path.join(docsRoot, "source-package-manifest.json"),
);
const validation = await readText(path.join(docsRoot, "validation-report.md"));
const handoff = await readText(path.join(docsRoot, "SESSION-7-HANDOFF.md"));
const traceGuide = await readText(path.join(docsRoot, "sample-traces.md"));

requireMatch(
  packageDocument.version === lockDocument.version &&
    packageDocument.version === lockDocument.packages?.[""]?.version &&
    packageDocument.version === releaseEvidence.runtimeVersion &&
    packageDocument.version === canonicalManifest.runtimeVersion &&
    packageDocument.version === sourceManifest.runtimeVersion,
  "package, lockfile, release evidence, canonical manifest, and source manifest runtime versions disagree",
);
requireMatch(
  canonicalManifest.releaseArtifact === expectedZip &&
    sourceManifest.targetArchive === expectedZip,
  "release manifests disagree with the authoritative ZIP filename",
);
for (const evidence of [
  canonicalManifest.releaseEvidence,
  sourceManifest.releaseEvidence,
]) {
  requireMatch(
    evidence?.unitTests === releaseEvidence.unitTests &&
      evidence?.browserTests === releaseEvidence.browserTests &&
      evidence?.transformedModules === releaseEvidence.transformedModules,
    "release manifest totals disagree with authoritative release evidence",
  );
}
const bridgeInput = canonicalManifest.verifiedInputs?.find(
  (entry) => entry.packageName === "@manuel-academy/study-core-bridge",
);
const bridgeAdapter = canonicalManifest.adapters?.find(
  (entry) => entry.id === "@manuel-academy/study-core-bridge",
);
for (const entry of [bridgeInput, bridgeAdapter]) {
  requireMatch(entry?.packageVersion === bridgeVersion || entry?.version === bridgeVersion,
    "canonical manifest bridge version is not 1.0.1");
  requireMatch(
    entry?.bridgeContractVersion === bridgeContractVersion,
    "canonical manifest bridge contract is not 1",
  );
}

const validationUnits = captureNumber(
  validation,
  /(\d+)\s+(?:unit\s+)?tests?,\s*0 failures/i,
  "validation unit-test total",
);
const validationBrowser = captureNumber(
  validation,
  /(?:test:browser[^|\n]*\|\s*)?(\d+)\s+(?:browser\s+)?scenarios?/i,
  "validation browser total",
);
const validationModules = captureNumber(
  validation,
  /(\d+)\s+modules transformed/i,
  "validation module count",
);
for (const [value, label] of [
  [validationUnits, "unit-test total"],
  [validationBrowser, "browser total"],
  [validationModules, "module count"],
]) {
  if (value !== undefined) {
    requireMatch(
      new RegExp(`\\b${value}\\b`, "i").test(handoff),
      `handoff disagrees with validation ${label}`,
    );
  }
}
requireMatch(
  validationUnits === releaseEvidence.unitTests,
  `validation unit-test total is not authoritative ${releaseEvidence.unitTests}`,
);
requireMatch(
  validationBrowser === releaseEvidence.browserTests,
  `validation browser total is not authoritative ${releaseEvidence.browserTests}`,
);
requireMatch(
  validationModules === releaseEvidence.transformedModules,
  `validation module count is not authoritative ${releaseEvidence.transformedModules}`,
);
requireMatch(validation.includes(expectedZip), "validation report has wrong ZIP filename");
requireMatch(handoff.includes(expectedZip), "handoff has wrong ZIP filename");
requireMatch(validation.includes(`0.7.2`) && handoff.includes(`0.7.2`),
  "validation report or handoff omits runtime 0.7.2");
requireMatch(validation.includes(bridgeVersion) && handoff.includes(bridgeVersion),
  "validation report or handoff omits bridge 1.0.1");

for (const filename of [
  "math-water-break.trace.json",
  "reading-save-resume.trace.json",
]) {
  const text = await readText(path.join(docsRoot, "sample-traces", filename));
  const trace = JSON.parse(text);
  const hash = sha256(text);
  requireMatch(validation.includes(hash), `validation hash mismatch for ${filename}`);
  requireMatch(handoff.includes(hash), `handoff hash mismatch for ${filename}`);
  requireMatch(traceGuide.includes(hash), `trace guide hash mismatch for ${filename}`);
  requireMatch(
    canonicalManifest.releaseEvidence?.traceSha256?.[filename] === hash,
    `canonical manifest hash mismatch for ${filename}`,
  );
  const sourceHashKey = filename.startsWith("math")
    ? "mathTraceSha256"
    : "readingTraceSha256";
  requireMatch(
    sourceManifest.releaseEvidence?.[sourceHashKey] === hash,
    `source manifest hash mismatch for ${filename}`,
  );
  requireMatch(!text.includes("student-runtime.session6-bridge.v2"),
    `${filename} contains retired temporary bridge ID`);
  requireMatch(trace.versions?.tutorBoundary === bridgeVersion,
    `${filename} bridge version is not 1.0.1`);
  requireMatch(trace.versions?.bridgeContractVersion === bridgeContractVersion,
    `${filename} bridge contract is not 1`);
  for (const receipt of trace.tutorBoundaryReceipts ?? []) {
    requireMatch(
      receipt.ledgerAccepted === true &&
        receipt.processingOrder?.indexOf("event-ledger-accepted") <
          receipt.processingOrder?.indexOf("minimized-study-projection"),
      `${filename} does not prove ledger acceptance before projection`,
    );
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Release evidence consistent: runtime ${packageDocument.version}, bridge ${bridgeVersion}/contract ${bridgeContractVersion}, ZIP ${expectedZip}.`,
  );
}
