import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TSchema } from "../../core/schema/typebox.js";
import {
  GroundingAssessmentSchema,
  TUTOR_ACTION_KINDS,
  TUTOR_V2_ACTION_COMPATIBILITY_ID,
  TUTOR_V2_ACTION_SCHEMA_VERSION,
  TUTOR_V2_COMPATIBILITY_ID,
  TUTOR_V2_CONTRACT_VERSION,
  StudyAuthorityContextSchema,
  ProviderContextSchema,
  TutorActionProposalSchema,
  TutorActionSchema,
  TutorBudgetRoutingContextSchema,
  TutorFailureOutcomeSchema,
  TutorRefusalOutcomeSchema,
  TutorRequestSchema,
  TutorResponseEnvelopeSchema,
  TutorSafetyStopOutcomeSchema,
  TutorShortTermStateSchema,
  TutorStaticFallbackOutcomeSchema,
  TutorTelemetryEnvelopeSchema,
  TutorValidationResultSchema,
} from "../../core/v2/contracts/index.js";
import {
  ReviewedStaticFallbackSchema,
  TUTOR_V2_BRIDGE_EVENT_VERSION,
  TUTOR_V2_BRIDGE_VERSION,
  TutorInvocationPermissionSchema,
  TutorV2BridgeEvidenceContextSchema,
  TutorV2BridgeInvocationSchema,
  TutorV2BridgeMemoryAccessSchema,
} from "../../study-engine/bridges/tutor-v2/contracts.js";
import { ProviderExecutionRequestSchema } from "../../core/v2/providers/ports/contracts.js";
import {
  DurableTutorEvidenceSchema,
} from "../../study-engine/tutor-v2/evidence/index.js";
import {
  MinimizedProviderContextSchema,
} from "../../study-engine/tutor-v2/privacy/index.js";

interface SchemaArtifact {
  readonly file: string;
  readonly title: string;
  readonly source: string;
  readonly schema: TSchema;
}

const artifacts: readonly SchemaArtifact[] = [
  { file: "tutor-action.schema.json", title: "Tutor V2 Action", source: "core/v2/contracts/actions.ts#TutorActionSchema", schema: TutorActionSchema },
  { file: "study-authority-context.schema.json", title: "Tutor V2 Study Authority Context", source: "core/v2/contracts/context.ts#StudyAuthorityContextSchema", schema: StudyAuthorityContextSchema },
  { file: "provider-context.schema.json", title: "Tutor V2 Provider Context", source: "core/v2/contracts/context.ts#ProviderContextSchema", schema: ProviderContextSchema },
  { file: "tutor-budget-routing-context.schema.json", title: "Tutor V2 Budget Routing Context", source: "core/v2/contracts/operations.ts#TutorBudgetRoutingContextSchema", schema: TutorBudgetRoutingContextSchema },
  { file: "tutor-short-term-state.schema.json", title: "Tutor V2 Short-Term State", source: "core/v2/contracts/operations.ts#TutorShortTermStateSchema", schema: TutorShortTermStateSchema },
  { file: "tutor-telemetry-envelope.schema.json", title: "Tutor V2 Telemetry Envelope", source: "core/v2/contracts/operations.ts#TutorTelemetryEnvelopeSchema", schema: TutorTelemetryEnvelopeSchema },
  { file: "grounding-assessment.schema.json", title: "Tutor V2 Grounding Assessment", source: "core/v2/contracts/grounding.ts#GroundingAssessmentSchema", schema: GroundingAssessmentSchema },
  { file: "tutor-request.schema.json", title: "Tutor V2 Request", source: "core/v2/contracts/request-response.ts#TutorRequestSchema", schema: TutorRequestSchema },
  { file: "tutor-action-proposal.schema.json", title: "Tutor V2 Action Proposal", source: "core/v2/contracts/request-response.ts#TutorActionProposalSchema", schema: TutorActionProposalSchema },
  { file: "tutor-failure-outcome.schema.json", title: "Tutor V2 Failure Outcome", source: "core/v2/contracts/request-response.ts#TutorFailureOutcomeSchema", schema: TutorFailureOutcomeSchema },
  { file: "tutor-refusal-outcome.schema.json", title: "Tutor V2 Refusal Outcome", source: "core/v2/contracts/request-response.ts#TutorRefusalOutcomeSchema", schema: TutorRefusalOutcomeSchema },
  { file: "tutor-static-fallback-outcome.schema.json", title: "Tutor V2 Static Fallback Outcome", source: "core/v2/contracts/request-response.ts#TutorStaticFallbackOutcomeSchema", schema: TutorStaticFallbackOutcomeSchema },
  { file: "tutor-safety-stop-outcome.schema.json", title: "Tutor V2 Safety Stop Outcome", source: "core/v2/contracts/request-response.ts#TutorSafetyStopOutcomeSchema", schema: TutorSafetyStopOutcomeSchema },
  { file: "tutor-response-envelope.schema.json", title: "Tutor V2 Response Envelope", source: "core/v2/contracts/request-response.ts#TutorResponseEnvelopeSchema", schema: TutorResponseEnvelopeSchema },
  { file: "tutor-validation-result.schema.json", title: "Tutor V2 Validation Result", source: "core/v2/contracts/request-response.ts#TutorValidationResultSchema", schema: TutorValidationResultSchema },
  { file: "minimized-provider-context.schema.json", title: "Tutor V2 Minimized Provider Context", source: "study-engine/tutor-v2/privacy/provider-context.ts#MinimizedProviderContextSchema", schema: MinimizedProviderContextSchema },
  { file: "provider-execution-request.schema.json", title: "Tutor V2 Provider Execution Request", source: "core/v2/providers/ports/contracts.ts#ProviderExecutionRequestSchema", schema: ProviderExecutionRequestSchema },
  { file: "durable-tutor-evidence.schema.json", title: "Tutor V2 Durable Evidence", source: "study-engine/tutor-v2/evidence/tutor-evidence.ts#DurableTutorEvidenceSchema", schema: DurableTutorEvidenceSchema },
  { file: "bridge-invocation-permission.schema.json", title: "Study Tutor V2 Invocation Permission", source: "study-engine/bridges/tutor-v2/contracts.ts#TutorInvocationPermissionSchema", schema: TutorInvocationPermissionSchema },
  { file: "bridge-memory-access.schema.json", title: "Study Tutor V2 Bridge Memory Access", source: "study-engine/bridges/tutor-v2/contracts.ts#TutorV2BridgeMemoryAccessSchema", schema: TutorV2BridgeMemoryAccessSchema },
  { file: "bridge-evidence-context.schema.json", title: "Study Tutor V2 Bridge Evidence Context", source: "study-engine/bridges/tutor-v2/contracts.ts#TutorV2BridgeEvidenceContextSchema", schema: TutorV2BridgeEvidenceContextSchema },
  { file: "reviewed-static-fallback.schema.json", title: "Study Tutor V2 Reviewed Static Fallback", source: "study-engine/bridges/tutor-v2/contracts.ts#ReviewedStaticFallbackSchema", schema: ReviewedStaticFallbackSchema },
  { file: "tutor-v2-bridge-invocation.schema.json", title: "Study Tutor V2 Bridge Invocation", source: "study-engine/bridges/tutor-v2/contracts.ts#TutorV2BridgeInvocationSchema", schema: TutorV2BridgeInvocationSchema },
] as const;

const outputDirectory = resolve("json-schema/v2");
const checkOnly = process.argv.includes("--check");

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function serialize(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const outputs = new Map<string, string>();
for (const artifact of artifacts) {
  outputs.set(artifact.file, serialize({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: artifact.title,
    ...artifact.schema,
  }));
}

const inventory = artifacts.map((artifact) => {
  const content = outputs.get(artifact.file);
  if (content === undefined) throw new Error(`Missing generated content for ${artifact.file}`);
  return { file: artifact.file, source: artifact.source, sha256: sha256(content) };
});
outputs.set("SCHEMA-INVENTORY.json", serialize({
  schemaInventoryVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 1 Foundation",
  contractVersion: TUTOR_V2_CONTRACT_VERSION,
  actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
  compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
  actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
  bridgeVersion: TUTOR_V2_BRIDGE_VERSION,
  bridgeEventVersion: TUTOR_V2_BRIDGE_EVENT_VERSION,
  tutorActions: TUTOR_ACTION_KINDS,
  generatedSchemaCount: artifacts.length,
  schemas: inventory,
}));

if (checkOnly) {
  const actualFiles = (await readdir(outputDirectory)).sort();
  const expectedFiles = [...outputs.keys()].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Generated schema inventory differs: expected ${expectedFiles.join(", ")}; found ${actualFiles.join(", ")}`);
  }
  for (const [file, expected] of outputs) {
    const actual = await readFile(resolve(outputDirectory, file), "utf8");
    if (actual !== expected) throw new Error(`Generated schema drift detected: ${file}`);
  }
  process.stdout.write(`PASS schema-check ${artifacts.length} schemas + inventory\n`);
} else {
  await mkdir(outputDirectory, { recursive: true });
  for (const [file, content] of outputs) await writeFile(resolve(outputDirectory, file), content, "utf8");
  process.stdout.write(`PASS schema-generation ${artifacts.length} schemas + inventory\n`);
}
