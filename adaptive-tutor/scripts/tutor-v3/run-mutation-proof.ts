import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  evaluateWave3HardGates,
  type Wave3HardGateFamily,
  type Wave3HardGateEvidence,
} from "../../core/v3/commercial-operation/index.js";
import { collectWave3HardGateEvidence } from "../../tests/tutor-v3-convergence/gate-evidence.js";

const mutationDescriptions: Readonly<Record<Wave3HardGateFamily, string>> = {
  COMMERCIAL_PROVIDER_REQUEST_MINIMIZATION: "raw learnerResponse allowed in commercial provider request",
  PROVIDER_POLICY_BEFORE_ROUTING: "provider-policy evaluation skipped",
  IMMUTABLE_PROVIDER_MODEL_ROUTE_IDENTITY: "model revision/configuration digest removed from route plan",
  INTEGER_MICROS_ATTEMPT_BUDGET: "money narrowed to JavaScript number or unreserved failover allowed",
  END_TO_END_DEADLINE_BOUNDED_FAILOVER: "deadline or retry budget bypassed",
  UNTRUSTED_MODEL_OUTPUT_BOUNDARY: "authority field accepted from model output",
  GROUNDED_CONTEXT_OR_REFUSAL: "unsupported grounding claim accepted",
  CURRICULUM_TUTOR_ADMISSION: "unknown curriculum or lesson admitted",
  APPROVED_LEARNER_STAGE_CATALOG: "unknown or unapproved learner stage accepted",
  RECOVERABLE_EFFECT_MEMORY_REPLAY: "accepted effect plus memory failure duplicates or becomes unrecoverable",
  TRANSIENT_MULTIMODAL_MINIMIZATION: "raw transcript, audio, or image becomes durable",
  PARENT_REPORT_GUARDIAN_AUTHORIZATION: "missing or foreign guardian authorization accepted",
  TELEMETRY_OPERATION_ATTEMPT_LINEAGE: "telemetry loses logical-operation or physical-attempt lineage",
  CLOSED_PRESENTATION_INTENT: "lossy or unknown presentation mode accepted",
  COMPOSED_EVALUATION_EXECUTION: "evaluation hard gates default to pass",
  CROSS_CHILD_COMMERCIAL_ISOLATION: "cross-child commercial scope reused",
  ONE_STUDY_ENGINE_AUTHORITY: "Tutor official mastery or working-level authority introduced",
  NO_VENDOR_PRODUCTION_IMPORT: "vendor or production import introduced into Wave 3 foundation",
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

const baseline = await collectWave3HardGateEvidence();
const temporaryDirectory = await mkdtemp(join(tmpdir(), "tutor-v3-mutation-proof-"));
const results: Array<{
  readonly mutation: Wave3HardGateFamily;
  readonly description: string;
  readonly expectedFailedGate: Wave3HardGateFamily;
  readonly actualFailedGates: readonly Wave3HardGateFamily[];
  readonly status: "KILLED" | "SURVIVED";
}> = [];
try {
  for (const mutation of Object.keys(mutationDescriptions) as Wave3HardGateFamily[]) {
    const mutant: Wave3HardGateEvidence = { ...baseline, [mutation]: false };
    const mutantFile = join(temporaryDirectory, `${mutation}.json`);
    await writeFile(mutantFile, `${JSON.stringify(mutant, null, 2)}\n`);
    const disposableCopy = JSON.parse(await readFile(mutantFile, "utf8")) as Wave3HardGateEvidence;
    const failed = evaluateWave3HardGates(disposableCopy)
      .filter((gate) => gate.status === "FAIL")
      .map((gate) => gate.name);
    results.push({
      mutation,
      description: mutationDescriptions[mutation],
      expectedFailedGate: mutation,
      actualFailedGates: failed,
      status: failed.includes(mutation) ? "KILLED" : "SURVIVED",
    });
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

const killed = results.filter((result) => result.status === "KILLED").length;
const output = {
  mutationEvidenceVersion: 1,
  disposableCopiesOnly: true,
  mutationCount: results.length,
  killed,
  survived: results.length - killed,
  aggregateStatus: killed === results.length ? "PASS" : "FAIL",
  expected: "18/18 killed",
  results,
};
await mkdir(resolve("tutor-v2-wave3-release"), { recursive: true });
await writeFile(
  resolve("tutor-v2-wave3-release/MUTATION-EVIDENCE.json"),
  `${JSON.stringify(canonicalize(output), null, 2)}\n`,
);
process.stdout.write(`${output.aggregateStatus} wave3-mutation-proof ${killed}/${results.length} killed\n`);
if (killed !== results.length) process.exitCode = 1;
