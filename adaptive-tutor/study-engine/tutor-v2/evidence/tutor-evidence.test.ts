import assert from "node:assert/strict";
import test from "node:test";
import {
  projectTutorEvidence,
  validateTutorEvidenceForPersistence,
} from "./tutor-evidence.js";

const baseProjectionInput = {
  evidenceRef: "tutor-evidence:privacy-001",
  interactionRef: "interaction:privacy-001",
  observedAt: "2026-08-13T20:01:00.000Z",
  tutorActionType: "ask-check",
  hintLevelUsed: "none",
  guidedInstructionUsed: false,
  reteachRequired: false,
  learnerResponseOutcome: "correct",
  prerequisiteReview: { status: "not-recommended" },
  groundingReferenceIds: ["grounding:fraction-model"],
  policyOutcome: "action-approved",
  policyReasonCode: "instructional-action-approved",
  providerOutcomeClass: "action-proposed",
  fallbackUsed: false,
  interventionCount: 0,
  currentConceptRef: "concept:fractions",
  currentSkillRef: "skill:identify-equal-parts",
} as const;

function project(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const result = projectTutorEvidence({
    ...structuredClone(baseProjectionInput),
    ...overrides,
  });
  assert.equal(result.status, "accepted");
  return structuredClone(result.value) as unknown as Record<string, unknown>;
}

test("projects independent evidence", () => {
  const evidence = project();
  assert.equal(evidence.assistanceLevel, "independent");
  assert.equal(evidence.evidenceCharacteristic, "INDEPENDENT");
});

test("projects light-hint evidence", () => {
  const evidence = project({ hintLevelUsed: "concept-cue" });
  assert.equal(evidence.assistanceLevel, "light-hint");
  assert.equal(evidence.evidenceCharacteristic, "LIGHT_HINT");
});

test("projects guided evidence and does not treat assisted correctness as independent", () => {
  const evidence = project({
    hintLevelUsed: "guided-step",
    guidedInstructionUsed: false,
    learnerResponseOutcome: "correct",
  });
  assert.equal(evidence.assistanceLevel, "guided");
  assert.equal(evidence.evidenceCharacteristic, "GUIDED");
  assert.equal(evidence.guidedInstructionUsed, true);
  assert.equal(evidence.learnerResponseOutcome, "correct");
});

test("projects reteach-required evidence with highest precedence", () => {
  const evidence = project({
    hintLevelUsed: "guided-step",
    guidedInstructionUsed: true,
    reteachRequired: true,
    learnerResponseOutcome: "incorrect",
  });
  assert.equal(evidence.assistanceLevel, "reteach-required");
  assert.equal(evidence.evidenceCharacteristic, "RETEACH_REQUIRED");
});

test("rejects internally inconsistent assistance claims", () => {
  const evidence = project();
  evidence.assistanceLevel = "independent";
  evidence.evidenceCharacteristic = "INDEPENDENT";
  evidence.hintLevelUsed = "guided-step";
  evidence.guidedInstructionUsed = true;
  assert.equal(validateTutorEvidenceForPersistence(evidence).status, "rejected");
});

test("raw transcript persistence is rejected", () => {
  const evidence = project();
  evidence.tutorTranscript = [{ role: "learner", content: "private" }];
  assert.equal(validateTutorEvidenceForPersistence(evidence).status, "rejected");
});

test("raw provider prompt, response, and audio persistence are rejected", () => {
  for (const contamination of [
    { rawProviderPrompt: "Full provider prompt" },
    { rawProviderResponse: "Full provider response" },
    { rawAudio: "base64-private-audio" },
  ]) {
    const evidence = project();
    Object.assign(evidence, contamination);
    assert.equal(validateTutorEvidenceForPersistence(evidence).status, "rejected");
  }
});

test("raw learner attempt is not copied into durable evidence", () => {
  const contaminated = {
    ...structuredClone(baseProjectionInput),
    learnerAttempt: "four",
  };
  assert.equal(projectTutorEvidence(contaminated).status, "rejected");
  assert.equal("learnerAttempt" in project(), false);
});

test("emotional, personality, and diagnostic labels are rejected", () => {
  for (const contamination of [
    { emotionalLabel: "anxious" },
    { personalityJudgment: "unmotivated" },
    { psychologicalProfile: { label: "private" } },
    { diagnosticInference: "condition" },
    { privateChildNote: "arbitrary note" },
  ]) {
    const evidence = project();
    Object.assign(evidence, contamination);
    assert.equal(validateTutorEvidenceForPersistence(evidence).status, "rejected");
  }
});

test("credential contamination is rejected", () => {
  for (const contamination of [
    { authBearer: "secret" },
    { learnerCredential: "secret" },
    { serviceRoleKey: "secret" },
  ]) {
    const evidence = project();
    Object.assign(evidence, contamination);
    assert.equal(validateTutorEvidenceForPersistence(evidence).status, "rejected");
  }
});

test("mastery authority fields are not accepted", () => {
  for (const contamination of [
    { mastered: true },
    { masteryStatus: "mastered" },
    { declareMastery: true },
    { masteryScore: 1 },
  ]) {
    const evidence = project();
    Object.assign(evidence, contamination);
    assert.equal(validateTutorEvidenceForPersistence(evidence).status, "rejected");
  }
});

test("working-level mutation fields are not accepted", () => {
  for (const contamination of [
    { workingLevel: "grade-9" },
    { nextWorkingLevel: "grade-10" },
    { mutateWorkingLevel: true },
  ]) {
    const evidence = project();
    Object.assign(evidence, contamination);
    assert.equal(validateTutorEvidenceForPersistence(evidence).status, "rejected");
  }
});

test("durable evidence preserves assigned prerequisite references without notes", () => {
  const evidence = project({
    prerequisiteReview: {
      status: "assigned",
      prerequisiteConceptRefs: ["concept:equal-parts"],
      assignmentRef: "assignment:prerequisite-001",
    },
    interventionCount: 2,
  });
  assert.deepEqual(evidence.prerequisiteReview, {
    status: "assigned",
    prerequisiteConceptRefs: ["concept:equal-parts"],
    assignmentRef: "assignment:prerequisite-001",
  });
  assert.equal(evidence.interventionCount, 2);
});
