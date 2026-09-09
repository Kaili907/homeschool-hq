import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { POST_REPAIR_BLOCKER_CLOSURES } from "./evidence.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

const lanes = Object.fromEntries(["W4-03", "W4-05", "W4-06", "W4-08", "W4-10"].map((lane) => {
  const assertions = POST_REPAIR_BLOCKER_CLOSURES.filter((item) => item.lane === lane);
  return [lane, {
    historicalResult: "BASELINE_ADVERSARIAL_FINDING",
    postRepairResult: assertions.every((item) => item.current === "CLOSED") ? "CLOSED" : "OPEN",
    assertionCount: assertions.length,
    closedCount: assertions.filter((item) => item.current === "CLOSED").length,
  }];
}));
const closed = POST_REPAIR_BLOCKER_CLOSURES.filter((item) => item.current === "CLOSED").length;
const output = {
  evidenceVersion: 1,
  aggregateStatus: closed === 38 ? "PASS" : "FAIL",
  expectedHistoricalBlockerCount: 38,
  assertionCount: POST_REPAIR_BLOCKER_CLOSURES.length,
  closedCount: closed,
  historicalEvidenceRewritten: false,
  currentReplayKind: "CONVERGENCE_OWNED_POST_REPAIR_REPLAY",
  lanes,
  assertions: POST_REPAIR_BLOCKER_CLOSURES,
};
const directory = resolve("tutor-v2-wave4-release");
await mkdir(directory, { recursive: true });
await writeFile(
  resolve(directory, "POST-REPAIR-BLOCKER-CLOSURE.json"),
  `${JSON.stringify(canonicalize(output), null, 2)}\n`,
);
process.stdout.write(`${output.aggregateStatus} wave4-blocker-closure ${closed}/${POST_REPAIR_BLOCKER_CLOSURES.length}\n`);
if (output.aggregateStatus !== "PASS") process.exitCode = 1;
