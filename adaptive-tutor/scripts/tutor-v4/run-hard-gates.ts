import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CURRENT_WAVE4_GATE_EVIDENCE,
  HARD_GATE_DETECTORS,
  evaluateWave4HardGates,
} from "./evidence.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

const results = evaluateWave4HardGates(CURRENT_WAVE4_GATE_EVIDENCE);
const passed = results.filter((result) => result.status === "PASS").length;
const output = {
  resultVersion: 1,
  aggregateStatus: passed === results.length ? "PASS" : "FAIL",
  nonCompensable: true,
  academicQualityCompensationAllowed: false,
  hardGateFamilyCount: results.length,
  hardGateFamiliesPassed: passed,
  wave3HardGatesRemainMandatory: true,
  requiredWave3HardGateFamilyCount: 18,
  results: results.map((result) => ({
    ...result,
    detector: HARD_GATE_DETECTORS[result.name],
  })),
};
const directory = resolve("tutor-v2-wave4-release");
await mkdir(directory, { recursive: true });
await writeFile(
  resolve(directory, "HARD-GATE-RESULT.json"),
  `${JSON.stringify(canonicalize(output), null, 2)}\n`,
);
process.stdout.write(`${output.aggregateStatus} wave4-hard-gates ${passed}/${results.length}\n`);
if (output.aggregateStatus !== "PASS") process.exitCode = 1;
