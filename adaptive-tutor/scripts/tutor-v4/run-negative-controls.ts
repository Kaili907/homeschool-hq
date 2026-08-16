import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { negativeControlEvidence } from "./evidence.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

const controls = negativeControlEvidence();
const detected = controls.filter((control) => control.status === "DETECTED").length;
const output = {
  evidenceVersion: 1,
  aggregateStatus: detected === controls.length ? "PASS" : "FAIL",
  requiredControlCount: 13,
  controlCount: controls.length,
  detected,
  survived: controls.length - detected,
  disposableSemanticMutationsOnly: true,
  compilerFailureAloneCountsAsDetection: false,
  controls,
};
const directory = resolve("tutor-v2-wave4-release");
await mkdir(directory, { recursive: true });
await writeFile(
  resolve(directory, "NEGATIVE-CONTROL-EVIDENCE.json"),
  `${JSON.stringify(canonicalize(output), null, 2)}\n`,
);
process.stdout.write(`${output.aggregateStatus} wave4-negative-controls ${detected}/${controls.length}\n`);
if (output.aggregateStatus !== "PASS") process.exitCode = 1;
