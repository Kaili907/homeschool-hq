import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  WAVE4_EXECUTABLE_DETECTORS,
  executeDetector,
  validateDetectorCatalog,
} from "./executable-detectors.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

const tutorRoot = process.cwd().endsWith("adaptive-tutor")
  ? process.cwd()
  : resolve("adaptive-tutor");
validateDetectorCatalog();
const results = WAVE4_EXECUTABLE_DETECTORS.map((detector) =>
  executeDetector(detector, tutorRoot)
);
const passed = results.filter((result) => result.status === "PASS").length;
const inconclusive = results.filter((result) => result.status === "VALIDATION_INCONCLUSIVE").length;
const output = {
  resultVersion: 2,
  evidenceKind: "EXECUTABLE_DETECTOR_RESULTS",
  aggregateStatus: inconclusive > 0
    ? "VALIDATION_INCONCLUSIVE"
    : passed === results.length ? "PASS" : "FAIL",
  nonCompensable: true,
  academicQualityCompensationAllowed: false,
  booleanEvidenceAccepted: false,
  hardGateFamilyCount: results.length,
  hardGateFamiliesPassed: passed,
  hardGateFamiliesFailed: results.length - passed,
  wave3HardGatesRemainMandatory: true,
  requiredWave3HardGateFamilyCount: 18,
  results,
};
const directory = resolve(tutorRoot, "tutor-v2-wave4-release");
await mkdir(directory, { recursive: true });
await writeFile(
  resolve(directory, "HARD-GATE-RESULT.json"),
  `${JSON.stringify(canonicalize(output), null, 2)}\n`,
);
process.stdout.write(`${output.aggregateStatus} wave4-executable-hard-gates ${passed}/${results.length}\n`);
if (output.aggregateStatus !== "PASS") process.exitCode = 1;
