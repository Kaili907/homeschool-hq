import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { WAVE3_SERIALIZED_SCHEMA_ARTIFACTS } from "../../scripts/tutor-v3/generate-schemas.js";
import type { TSchema } from "../../core/schema/typebox.js";
import { Value } from "../../core/schema/value.js";

const tutorRoot = process.cwd().endsWith("adaptive-tutor")
  ? process.cwd()
  : resolve("adaptive-tutor");

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "static")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

function assertClosed(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertClosed(child, `${path}/${index}`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.type === "object") assert.equal(record.additionalProperties, false, path);
  for (const [key, child] of Object.entries(record)) assertClosed(child, `${path}/${key}`);
}

function generatedSchema(file: string): TSchema {
  return JSON.parse(readFileSync(
    resolve(tutorRoot, "json-schema/v3/wave3", file),
    "utf8",
  )) as TSchema;
}

function runtimeSchema(file: string): TSchema {
  const artifact = WAVE3_SERIALIZED_SCHEMA_ARTIFACTS.find(
    (candidate) => candidate.file === file,
  );
  assert.ok(artifact, `missing runtime artifact ${file}`);
  return artifact.schema;
}

function without(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = structuredClone(value);
  delete copy[key];
  return copy;
}

function assertRuntimeGeneratedResult(
  runtime: TSchema,
  generated: TSchema,
  candidate: unknown,
  expected: boolean,
  attack: string,
): void {
  assert.equal(Value.Check(runtime, candidate), expected, `${attack}: runtime`);
  assert.equal(Value.Check(generated, candidate), expected, `${attack}: generated`);
}

const scope = {
  scopeKind: "trusted-study-instructional-memory-scope",
  learnerScopeRef: "learner:child-a",
  sessionRef: "session:math-a",
  contextRef: "context:fractions-a",
  opportunityRef: "opportunity:practice-a",
};

const memoryDelta = {
  deltaKind: "bounded-instructional-memory-delta",
  commercialExecutionScopeRef: "commercial-scope:hint-a",
  householdScopeRef: "household-scope:family-a",
  logicalOperationRef: "logical-operation:hint-a",
  sourceEventRef: "study-event:hint-a-accepted",
  conceptRef: "concept:fractions",
  curriculumReleaseRef: "family-pilot-r1",
  curriculumPackageRef: "curriculum-package:family-pilot-r1",
  curriculumCourseRef: "ma-g5-mathematics",
  curriculumSubjectRef: "mathematics",
  curriculumUnitRef: "ma-g5-mathematics-u01",
  curriculumLessonRef: "ma-g5-mathematics-u01-l01",
  memoryDeltaRef: "memory-delta:hint-a",
  memoryRef: "memory:fractions-a",
  scope,
  expectedPriorRevisionRef: null,
  expectedPriorDigest: null,
  operations: [
    { operationKind: "add", field: "conceptRefs", value: "concept:fractions" },
  ],
  resultingRevisionRef: "memory-revision:hint-a",
  resultingDigest: `memory-digest:${"b".repeat(64)}`,
  persistenceAllowed: false,
  officialMasteryAuthority: false,
  studyMutationAllowed: false,
  gradeMutationAllowed: false,
  placementMutationAllowed: false,
  curriculumMutationAllowed: false,
};

const durableMultimodalEvidence = {
  contractVersion: "3.0.0-foundation.1",
  envelope: "durable-multimodal-evidence",
  evidenceRef: "evidence:multimodal-001",
  sessionRef: "session:math-a",
  interactionRef: "interaction:practice-a",
  turnRef: "turn:hint-a",
  mode: "reviewed-diagram",
  outcome: "demonstrated",
  assistanceLevel: "light-hint",
  observedAt: "2026-08-15T18:00:00.000Z",
  captionRef: "caption:hint-a",
  captionAvailability: "available",
  transcriptPersisted: false,
  rawMediaPersisted: false,
  reviewedVisual: {
    visualRef: "visual:fractions-a",
    reviewRef: "review:fractions-a",
    contentDigest: `sha256:${"a".repeat(64)}`,
    visualKind: "diagram",
    reviewStatus: "approved",
  },
  visualStep: {
    visualStepRef: "visual-step:fractions-a-1",
    stepIndex: 1,
  },
};

const minimizedAcceptedStudyEffectEvent = {
  eventKind: "minimized-study-effect-accepted",
  commercialExecutionScopeRef: memoryDelta.commercialExecutionScopeRef,
  householdScopeRef: memoryDelta.householdScopeRef,
  logicalOperationRef: "logical-operation:hint-a",
  sourceEventRef: "study-event:hint-a-accepted",
  effectRef: "study-effect:show-hint-a",
  effectDigest: `sha256:${"c".repeat(64)}`,
  conceptRef: memoryDelta.conceptRef,
  curriculumReleaseRef: memoryDelta.curriculumReleaseRef,
  curriculumPackageRef: memoryDelta.curriculumPackageRef,
  curriculumCourseRef: memoryDelta.curriculumCourseRef,
  curriculumSubjectRef: memoryDelta.curriculumSubjectRef,
  curriculumUnitRef: memoryDelta.curriculumUnitRef,
  curriculumLessonRef: memoryDelta.curriculumLessonRef,
  scope,
  memoryDelta,
  rawTranscriptIncluded: false,
  officialMasteryAuthority: false,
  gradeAuthority: false,
  placementAuthority: false,
  curriculumAuthority: false,
};

test("all ten generated serialized schemas exactly match runtime schemas and are recursively closed", () => {
  assert.equal(WAVE3_SERIALIZED_SCHEMA_ARTIFACTS.length, 10);
  assert.deepEqual(WAVE3_SERIALIZED_SCHEMA_ARTIFACTS.map(({ file }) => file), [
    "study-commercial-tutor-invocation.schema.json",
    "bounded-commercial-provider-request.schema.json",
    "bounded-commercial-provider-response.schema.json",
    "study-commercial-tutor-advisory.schema.json",
    "study-commercial-effect-receipt.schema.json",
    "commercial-operation-telemetry-event.schema.json",
    "parent-report.schema.json",
    "instructional-memory-delta.schema.json",
    "durable-multimodal-evidence.schema.json",
    "minimized-accepted-study-effect-event.schema.json",
  ]);
  for (const artifact of WAVE3_SERIALIZED_SCHEMA_ARTIFACTS) {
    const generated = generatedSchema(artifact.file) as Record<string, unknown>;
    delete generated.$schema;
    delete generated.title;
    assert.deepEqual(canonicalize(generated), canonicalize(artifact.schema), artifact.file);
    assertClosed(generated, artifact.file);
  }
});

test("schema inventory records ten serialized schemas and zero internal-port schemas", () => {
  const inventory = JSON.parse(readFileSync(
    resolve(tutorRoot, "json-schema/v3/wave3/SCHEMA-INVENTORY.json"),
    "utf8",
  )) as { generatedSchemaCount: number; internalPortSchemasGenerated: number };
  assert.deepEqual(inventory, {
    ...inventory,
    generatedSchemaCount: 10,
    internalPortSchemasGenerated: 0,
  });
});

test("boundary inventory identifies exactly ten durable schemas and classifies every non-boundary", () => {
  const inventory = JSON.parse(readFileSync(
    resolve(tutorRoot, "../docs/study-tutor-v2/wave3/SERIALIZED-BOUNDARY-INVENTORY.json"),
    "utf8",
  )) as {
    serializedSchemaCount: number;
    internalPortSchemaCount: number;
    contracts: Array<{
      name: string;
      classification: string;
      schemaGenerated: boolean;
      reason?: string;
    }>;
  };
  const serialized = inventory.contracts.filter(
    ({ classification }) => classification === "SERIALIZED_BOUNDARY",
  );
  assert.equal(inventory.serializedSchemaCount, 10);
  assert.equal(inventory.internalPortSchemaCount, 0);
  assert.equal(serialized.length, 10);
  assert.deepEqual(
    serialized.map(({ name }) => name),
    [
      "StudyCommercialTutorInvocation",
      "BoundedCommercialProviderRequest",
      "BoundedCommercialProviderResponse",
      "StudyCommercialTutorAdvisory",
      "StudyCommercialEffectReceipt",
      "CommercialOperationTelemetryEvent",
      "ParentReport",
      "InstructionalMemoryDelta",
      "DurableMultimodalEvidence",
      "MinimizedAcceptedStudyEffectEvent",
    ],
  );
  for (const contract of inventory.contracts) {
    assert.ok(contract.reason && contract.reason.length > 0, contract.name);
    if (contract.classification === "SERIALIZED_BOUNDARY") {
      assert.equal(contract.schemaGenerated, true, contract.name);
    } else {
      assert.ok([
        "TRUSTED_INTERNAL_CONTRACT",
        "EPHEMERAL_TRANSIENT",
        "FUTURE_PRODUCTION_BOUNDARY",
      ].includes(contract.classification), contract.name);
      assert.equal(contract.schemaGenerated, false, contract.name);
    }
  }
});

test("durable multimodal evidence has runtime/generated parity for valid and adversarial objects", () => {
  const runtime = runtimeSchema("durable-multimodal-evidence.schema.json");
  const generated = generatedSchema("durable-multimodal-evidence.schema.json");
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    durableMultimodalEvidence,
    true,
    "representative valid durable evidence",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    { ...durableMultimodalEvidence, unknownField: "smuggled" },
    false,
    "unknown field",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    {
      ...durableMultimodalEvidence,
      reviewedVisual: {
        ...durableMultimodalEvidence.reviewedVisual,
        rawImageBytes: "base64:image",
      },
    },
    false,
    "nested unknown field",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    without(durableMultimodalEvidence, "evidenceRef"),
    false,
    "missing required field",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    { ...durableMultimodalEvidence, sessionRef: "malformed-ref" },
    false,
    "malformed reference",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    { ...durableMultimodalEvidence, gradeAuthority: false },
    false,
    "authority-looking field",
  );

  for (const [field, payload] of Object.entries({
    rawAudio: "base64:audio",
    rawImageBytes: "base64:image",
    video: "base64:video",
    rawTranscript: "verbatim learner transcript",
    biometricIdentity: "learner identity",
    emotionInference: "frustrated",
    personalityInference: "introverted",
    diagnosticInference: "diagnosis",
  })) {
    assertRuntimeGeneratedResult(
      runtime,
      generated,
      { ...durableMultimodalEvidence, [field]: payload },
      false,
      `prohibited multimodal field ${field}`,
    );
  }
});

test("minimized accepted Study effect has runtime/generated parity and rejects raw or authoritative data", () => {
  const runtime = runtimeSchema("minimized-accepted-study-effect-event.schema.json");
  const generated = generatedSchema("minimized-accepted-study-effect-event.schema.json");
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    minimizedAcceptedStudyEffectEvent,
    true,
    "representative valid accepted effect",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    { ...minimizedAcceptedStudyEffectEvent, unknownField: "smuggled" },
    false,
    "unknown field",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    {
      ...minimizedAcceptedStudyEffectEvent,
      memoryDelta: { ...memoryDelta, learnerAnswer: "verbatim learner answer" },
    },
    false,
    "nested unknown field",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    without(minimizedAcceptedStudyEffectEvent, "effectDigest"),
    false,
    "missing required field",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    { ...minimizedAcceptedStudyEffectEvent, effectRef: "malformed-ref" },
    false,
    "malformed reference",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    { ...minimizedAcceptedStudyEffectEvent, officialMasteryAuthority: true },
    false,
    "authority widening",
  );
  assertRuntimeGeneratedResult(
    runtime,
    generated,
    { ...minimizedAcceptedStudyEffectEvent, studyAuthority: "expanded" },
    false,
    "Study authority-looking field",
  );

  for (const [field, payload] of Object.entries({
    rawProviderResponse: { output: "unminimized" },
    tutorTranscript: "verbatim tutor prose",
    learnerAnswer: "verbatim learner answer",
  })) {
    assertRuntimeGeneratedResult(
      runtime,
      generated,
      { ...minimizedAcceptedStudyEffectEvent, [field]: payload },
      false,
      `prohibited recovery field ${field}`,
    );
  }
});
