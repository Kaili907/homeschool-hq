import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  evaluateWave3HardGates,
} from "../../core/v3/commercial-operation/index.js";
import { collectWave3HardGateEvidence } from "../../tests/tutor-v3-convergence/gate-evidence.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

const evidence = await collectWave3HardGateEvidence();
const hardGateFamilies = evaluateWave3HardGates(evidence);
const failed = hardGateFamilies.filter((gate) => gate.status !== "PASS");
const output = {
  resultVersion: 1,
  hardGateFamilyCount: hardGateFamilies.length,
  hardGateFamiliesPassed: hardGateFamilies.length - failed.length,
  aggregateStatus: failed.length === 0 ? "PASS" : "FAIL",
  nonCompensable: true,
  evidence,
  hardGateFamilies,
};
const outputDirectory = resolve("tutor-v2-wave3-release");
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "HARD-GATE-RESULT.json"), `${JSON.stringify(canonicalize(output), null, 2)}\n`);
process.stdout.write(`${output.aggregateStatus} wave3-hard-gates ${output.hardGateFamiliesPassed}/${output.hardGateFamilyCount}\n`);
if (failed.length > 0) process.exitCode = 1;
