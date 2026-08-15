import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { TSchema } from "../../core/schema/typebox.js";
import { Value } from "../../core/schema/value.js";
import { validateExact } from "../../core/v2/contracts/index.js";
import {
  InMemoryWave2ReplayLedger,
  Wave2AdaptiveCompositionRequestSchema,
  Wave2StudyDecisionPacketSchema,
  composeWave2AdaptiveIntelligence,
} from "../../study-engine/tutor-v2/adaptive/index.js";
import { wave2Fixture } from "./wave2-fixtures.js";

function generated(file: string): TSchema {
  return JSON.parse(readFileSync(`json-schema/v2/wave2/${file}`, "utf8")) as TSchema;
}

function assertClosedObjects(value: unknown, path = "schema"): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertClosedObjects(child, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.type === "object") {
    assert.equal(record.additionalProperties, false, path);
  }
  for (const [key, child] of Object.entries(record)) {
    assertClosedObjects(child, `${path}.${key}`);
  }
}

function assertParity(runtime: TSchema, schema: TSchema, value: unknown, accepted: boolean): void {
  assert.equal(validateExact(runtime, value).status === "accepted", accepted, "runtime");
  assert.equal(Value.Check(schema, value), accepted, "generated");
}

test("Wave 2 serialized request has runtime/generated schema parity", () => {
  const request = wave2Fixture();
  const schema = generated("wave2-adaptive-composition-request.schema.json");
  assert.equal(validateExact(Wave2AdaptiveCompositionRequestSchema, request).status, "accepted");
  assert.equal(Value.Check(schema, request), true);
  assert.equal(schema.additionalProperties, false);
  assertClosedObjects(schema);
  const serializedSchema = JSON.stringify(schema);
  for (const required of [
    "currentOpportunityRef",
    "currentOpportunityAssistanceLevel",
    "currentSessionRef",
    "currentInstructionalContextRef",
    "learnerScopeRef",
    "sessionRef",
    "instructionalContextRef",
    "study-tutor-v2.adaptive-capabilities.v2",
    "study-tutor-v2.completed-assessment-review-permission.v1",
    "guardianVisibilityAuthorization",
  ]) assert.equal(serializedSchema.includes(required), true, required);
  for (const forbidden of [
    "rawLearnerTranscript",
    "rawLearnerProse",
    "answerAuthority",
    "officialMastery",
    "nominalGradeMutation",
    "workingLevelMutationRequest",
  ]) assert.equal(serializedSchema.includes(forbidden), false, forbidden);

  const contaminated = { ...request, rawLearnerTranscript: "private" };
  assertParity(Wave2AdaptiveCompositionRequestSchema, schema, contaminated, false);

  const unscopedAdmission = structuredClone(request) as unknown as Record<string, unknown>;
  const metadata = unscopedAdmission.capabilityMetadata as Record<string, unknown>;
  delete metadata.learnerScopeRef;
  assertParity(Wave2AdaptiveCompositionRequestSchema, schema, unscopedAdmission, false);

  const legacyPermission = structuredClone(request) as unknown as Record<string, unknown>;
  const hint = legacyPermission.hintSelection as Record<string, unknown>;
  hint.reviewPermission = { completedAssessmentReviewAllowed: true };
  assertParity(Wave2AdaptiveCompositionRequestSchema, schema, legacyPermission, false);

  const missingMasteryProvenance = structuredClone(request) as unknown as Record<string, unknown>;
  const mastery = missingMasteryProvenance.masteryEvidence as Record<string, unknown>;
  const evidence = mastery.evidence as Record<string, unknown>[];
  delete evidence[0]!.instructionalContextRef;
  assertParity(
    Wave2AdaptiveCompositionRequestSchema,
    schema,
    missingMasteryProvenance,
    false,
  );
});

test("Wave 2 serialized decision has runtime/generated schema parity", async () => {
  const result = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });
  const schema = generated("wave2-study-decision-packet.schema.json");
  assert.equal(validateExact(Wave2StudyDecisionPacketSchema, result).status, "accepted");
  assert.equal(Value.Check(schema, result), true);
  assertClosedObjects(schema);
  const serializedSchema = JSON.stringify(schema);
  for (const required of [
    "decisionProvenance",
    "opportunityRef",
    "effectiveAssistanceLevel",
    "visibilityAuthorization",
    "TutorV2ReviewedAcademicMisconceptionCode",
  ]) assert.equal(serializedSchema.includes(required), true, required);
  assert.equal(serializedSchema.includes("opportunityProvenance"), false);

  const contaminated = { ...result, officialMastery: true };
  assertParity(Wave2StudyDecisionPacketSchema, schema, contaminated, false);

  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision" || result.parentExplanation === null) return;

  const missingDecisionProvenance = structuredClone(result) as unknown as Record<string, unknown>;
  delete missingDecisionProvenance.decisionProvenance;
  assertParity(
    Wave2StudyDecisionPacketSchema,
    schema,
    missingDecisionProvenance,
    false,
  );

  const arbitraryParentCopy = structuredClone(result) as unknown as Record<string, unknown>;
  const parent = arbitraryParentCopy.parentExplanation as Record<string, unknown>;
  const explanation = parent.explanation as Record<string, unknown>;
  explanation.explanation = "Private transcript and answer prose";
  assertParity(Wave2StudyDecisionPacketSchema, schema, arbitraryParentCopy, false);

  for (const code of [
    "free form paragraph about the learner",
    "MATH_LEARNER_LAZY_PERSONALITY_DIAGNOSIS",
    `MATH_${"OVERLONG_".repeat(20)}CODE`,
  ]) {
    const misconceptionPacket = structuredClone(result) as unknown as Record<string, unknown>;
    const misconception = misconceptionPacket.misconception as Record<string, unknown>;
    misconception.academicMisconceptionCode = code;
    assertParity(Wave2StudyDecisionPacketSchema, schema, misconceptionPacket, false);
  }
});
