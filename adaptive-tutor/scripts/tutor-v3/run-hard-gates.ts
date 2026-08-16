import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  evaluateWave3HardGates,
} from "../../core/v3/commercial-operation/index.js";
import { collectWave3HardGateEvidence } from "../../tests/tutor-v3-convergence/gate-evidence.js";
import { MUTATIONS } from "./mutations/catalog.js";

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
const tutorRoot = process.cwd().endsWith("adaptive-tutor")
  ? process.cwd()
  : resolve("adaptive-tutor");
const repoRoot = resolve(tutorRoot, "..");
const hardGateAdequacy = await Promise.all(hardGateFamilies.map(async (gate) => {
  const mutation = MUTATIONS.find((candidate) => candidate.family === gate.name);
  const sourceInvariantPresent = mutation !== undefined && (await Promise.all(
    mutation.rewrites.map(async (rewrite) => {
      const sourcePath = resolve(repoRoot, rewrite.sourcePath);
      if (rewrite.before === null) {
        try {
          await access(sourcePath);
          return false;
        } catch {
          return true;
        }
      }
      try {
        return (await readFile(sourcePath, "utf8")).includes(rewrite.before);
      } catch {
        return false;
      }
    }),
  )).every(Boolean);
  const adequate = gate.status === "PASS" &&
    mutation !== undefined &&
    mutation.expectedFailedGate === gate.name &&
    mutation.expectedFailingTests.length > 0 &&
    sourceInvariantPresent;
  return {
    name: gate.name,
    status: adequate ? "ADEQUATE" : "INADEQUATE",
    sourceInvariant: mutation?.invariant ?? null,
    sourceInvariantPresent,
    permanentDetector: mutation === undefined ? null : {
      testFile: mutation.focusedTestFile,
      testNames: mutation.expectedFailingTests,
    },
    mutationDetector: mutation === undefined ? null : {
      mutationId: mutation.mutationId,
      method: mutation.method,
      expectedFailedGate: mutation.expectedFailedGate,
    },
  };
}));
const inadequate = hardGateAdequacy.filter((gate) => gate.status !== "ADEQUATE");
const output = {
  resultVersion: 1,
  hardGateFamilyCount: hardGateFamilies.length,
  hardGateFamiliesPassed: hardGateFamilies.length - failed.length,
  hardGateAdequacyFamilyCount: hardGateAdequacy.length,
  hardGateAdequacyFamiliesPassed: hardGateAdequacy.length - inadequate.length,
  hardGateAdequacyAggregateStatus: inadequate.length === 0 ? "PASS" : "FAIL",
  aggregateStatus: failed.length === 0 && inadequate.length === 0 ? "PASS" : "FAIL",
  nonCompensable: true,
  evidence,
  hardGateFamilies,
  hardGateAdequacy,
};
const outputDirectory = resolve("tutor-v2-wave3-release");
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "HARD-GATE-RESULT.json"), `${JSON.stringify(canonicalize(output), null, 2)}\n`);
process.stdout.write(`${output.aggregateStatus} wave3-hard-gates ${output.hardGateFamiliesPassed}/${output.hardGateFamilyCount}\n`);
if (failed.length > 0) process.exitCode = 1;
