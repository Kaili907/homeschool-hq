import assert from "node:assert/strict";
import test from "node:test";
import {
  TUTOR_V2_ACTION_COMPATIBILITY_ID,
  TUTOR_V2_ACTION_SCHEMA_VERSION,
  TUTOR_V2_COMPATIBILITY_ID,
  TUTOR_V2_CONTRACT_VERSION,
  ProviderContextSchema,
  validateExact,
} from "../../../core/v2/contracts/index.js";
import {
  minimizeProviderContext,
  validateMinimizedProviderContext,
} from "./provider-context.js";

const digest = `sha256:${"a".repeat(64)}`;

const studyAuthorityContext = {
  contractVersion: TUTOR_V2_CONTRACT_VERSION,
  actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
  compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
  actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
  contextKind: "study-authority",
  interactionRef: "interaction:privacy-001",
  invocationBindingRef: "invocation:privacy-001",
  authorizationRef: "authorization:study-server",
  authorizationRevision: 1,
  safetyClearanceRef: "safety:privacy-001",
  policyRefs: {
    authorityPolicyRef: "policy:authority-v1",
    assessmentPolicyRef: "policy:assessment-v1",
    answerPolicyRef: "policy:answer-v1",
    safetyPolicyRef: "policy:safety-v1",
    privacyPolicyRef: "policy:privacy-v1",
  },
  instructionContext: {
    contextKind: "tutor-instruction",
    subjectRef: "subject:mathematics",
    conceptRef: "concept:fractions",
    workingLevelInstructionRef: "working-level:fraction-foundations",
    learnerStageRef: "learner-stage:middle-childhood",
    learnerSafeItem: {
      itemRef: "item:fraction-parts",
      itemKind: "short-response",
      learnerSafeContent: "How many equal parts are shown?",
    },
    assessmentPhase: "instruction-or-practice",
    approvedEvidenceSummary: {
      summaryRef: "evidence:approved-summary",
      evidenceCode: "needs-fraction-support",
      attemptCount: 1,
      assistanceLevel: "light-hint",
      observationRefs: ["observation:partition-confusion"],
    },
    allowedActions: ["explain", "hint", "ask-check"],
    hintCeiling: "concept-cue",
    safetyConstraints: {
      safetyMode: "standard",
      mayContinueAcademicFlow: true,
      learnerSafeLanguageRequired: true,
      disallowedContentCodes: ["final-graded-answer"],
    },
    groundingReferences: [
      {
        groundingRef: "grounding:fraction-model",
        kind: "curriculum-excerpt",
        contentDigest: digest,
        learnerSafeContent: "A fraction names equal parts of a whole.",
      },
    ],
  },
  issuedAt: "2026-08-13T20:00:00.000Z",
  expiresAt: "2026-08-13T20:05:00.000Z",
} as const;

const minimalPolicy = {
  workingLevel: "omit",
  learnerAttempt: { mode: "omit" },
  agePolicy: { mode: "omit" },
} as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function minimalInput(): Record<string, unknown> {
  return {
    studyAuthorityContext: clone(studyAuthorityContext),
    disclosurePolicy: clone(minimalPolicy),
  };
}

function acceptedMinimalContext(): Record<string, unknown> {
  const result = minimizeProviderContext(minimalInput());
  assert.equal(result.status, "accepted");
  return clone(result.value) as Record<string, unknown>;
}

test("minimal allowed provider context passes and omits Study authority", () => {
  const first = minimizeProviderContext(minimalInput());
  const second = minimizeProviderContext(minimalInput());
  assert.equal(first.status, "accepted");
  assert.equal(second.status, "accepted");
  assert.deepEqual(first, second);
  if (first.status !== "accepted") return;

  assert.deepEqual(Object.keys(first.value), [
    "contractVersion",
    "actionSchemaVersion",
    "compatibilityId",
    "actionCompatibilityId",
    "contextKind",
    "interactionRef",
    "instruction",
  ]);
  assert.equal("authorizationRef" in first.value, false);
  assert.equal("workingLevelInstructionRef" in first.value.instruction, false);
  assert.equal("currentLearnerAttempt" in first.value.instruction, false);
  assert.equal(validateExact(ProviderContextSchema, first.value).status, "accepted");
});

test("direct learner authority identifier is rejected", () => {
  const candidate = acceptedMinimalContext();
  candidate.learnerId = "learner:direct-authority-id";
  assert.equal(validateMinimizedProviderContext(candidate).status, "rejected");
});

test("household data is rejected", () => {
  const candidate = acceptedMinimalContext();
  candidate.household = { address: "private" };
  assert.equal(validateMinimizedProviderContext(candidate).status, "rejected");
});

test("PIN is rejected", () => {
  const candidate = minimalInput();
  candidate.rawPin = "1234";
  assert.equal(minimizeProviderContext(candidate).status, "rejected");
});

test("credential material is rejected", () => {
  const candidate = acceptedMinimalContext();
  candidate.serviceRoleCredential = "secret";
  assert.equal(validateMinimizedProviderContext(candidate).status, "rejected");
});

test("answer-key locator is rejected", () => {
  const candidate = acceptedMinimalContext();
  const instruction = candidate.instruction as Record<string, unknown>;
  instruction.answerKeyPath = "/private/answer-key.json";
  assert.equal(validateMinimizedProviderContext(candidate).status, "rejected");
});

test("raw transcript is rejected", () => {
  const candidate = acceptedMinimalContext();
  candidate.tutorTranscript = [{ role: "learner", content: "private" }];
  assert.equal(validateMinimizedProviderContext(candidate).status, "rejected");
});

test("adult private note is rejected", () => {
  const candidate = acceptedMinimalContext();
  candidate.adultPrivateNote = "Do not disclose.";
  assert.equal(validateMinimizedProviderContext(candidate).status, "rejected");
});

test("sibling data is rejected", () => {
  const candidate = acceptedMinimalContext();
  candidate.siblings = [{ learnerRef: "learner:sibling" }];
  assert.equal(validateMinimizedProviderContext(candidate).status, "rejected");
});

test("unknown sensitive fields fail closed before projection", () => {
  const candidate = minimalInput();
  const authority = candidate.studyAuthorityContext as Record<string, unknown>;
  authority.unreviewedSensitiveProfile = { arbitrary: true };
  const result = minimizeProviderContext(candidate);
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.equal(result.code, "PROVIDER_CONTEXT_PRIVACY_REJECTED");
});

test("ephemeral attempt passes only when policy permits it", () => {
  const forbidden = minimalInput();
  forbidden.disclosurePolicy = {
    ...minimalPolicy,
    learnerAttempt: {
      mode: "omit",
      attempt: {
        itemRef: "item:fraction-parts",
        responseFormat: "short-response",
        learnerResponse: "four",
      },
    },
  };
  assert.equal(minimizeProviderContext(forbidden).status, "rejected");

  const permitted = minimalInput();
  permitted.disclosurePolicy = {
    ...minimalPolicy,
    learnerAttempt: {
      mode: "permit-current-attempt",
      policyPermissionRef: "policy-permission:attempt-001",
      attempt: {
        itemRef: "item:fraction-parts",
        responseFormat: "short-response",
        learnerResponse: "four",
      },
    },
  };
  const result = minimizeProviderContext(permitted);
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.deepEqual(result.value.instruction.currentLearnerAttempt, {
    itemRef: "item:fraction-parts",
    responseFormat: "short-response",
    learnerResponse: "four",
    policyPermissionRef: "policy-permission:attempt-001",
    persistenceAllowed: false,
  });
});

test("attempt must be bound to the current learner-safe item", () => {
  const candidate = minimalInput();
  candidate.disclosurePolicy = {
    ...minimalPolicy,
    learnerAttempt: {
      mode: "permit-current-attempt",
      policyPermissionRef: "policy-permission:attempt-002",
      attempt: {
        itemRef: "item:different-item",
        responseFormat: "short-response",
        learnerResponse: "four",
      },
    },
  };
  assert.equal(minimizeProviderContext(candidate).status, "rejected");
});

test("working-level and age-policy data require explicit inclusion", () => {
  const candidate = minimalInput();
  candidate.disclosurePolicy = {
    ...minimalPolicy,
    workingLevel: "include",
    agePolicy: {
      mode: "include",
      parameters: {
        agePolicyRef: "age-policy:middle-childhood-v1",
        learnerStageRef: "learner-stage:middle-childhood",
        responseStyleCode: "concrete-brief",
        maximumResponseWords: 120,
      },
    },
  };
  const result = minimizeProviderContext(candidate);
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(
    result.value.instruction.workingLevelInstructionRef,
    "working-level:fraction-foundations",
  );
  assert.equal(result.value.instruction.agePolicyParameters?.maximumResponseWords, 120);
});
