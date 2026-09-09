import assert from "node:assert/strict";
import test from "node:test";
import {
  createLearnerStagePolicyRegistry,
  type LearnerStagePolicyProfile,
  type ReviewedStaticStageFallback,
  type StudyMeasuredTutorTurn,
  type TrustedStudyLearnerStageBinding,
} from "./index.js";

const fallback = {
  contractVersion: "learner-stage-policy.v1",
  fallbackKind: "study-reviewed-static-stage-fallback",
  staticContentRef: "content:stage-policy-static-v1",
  policyRef: "policy:stage-fallback-v1",
  approvalRef: "approval:stage-fallback-v1",
} as const satisfies ReviewedStaticStageFallback;

const boundedProfile = {
  contractVersion: "learner-stage-policy.v1",
  profileKind: "study-approved-learner-stage-policy",
  policyProfileRef: "stage-policy:study-foundation-v1",
  learnerStageRef: "learner-stage:study-foundation",
  approvalRef: "approval:stage-policy-set-v1",
  approvalKind: "study-approved",
  bounds: {
    maximumResponseWords: 60,
    maximumStepCount: 2,
    maximumHintDepth: "nudge",
    maximumInstructionalDensity: "sparse",
    maximumVisualStepComplexity: "single-focus",
    breakSuggestionPolicy: {
      mode: "bounded",
      minimumCompletedTutorTurns: 4,
      minimumTurnsBetweenSuggestions: 3,
      maximumSuggestionsPerSession: 1,
    },
    multimodalAllowance: {
      allowedModalities: ["text", "image"],
      maximumModalitiesPerResponse: 2,
    },
    parentReviewThreshold: {
      thresholdMode: "either-limit",
      maximumUnresolvedAttempts: 3,
      maximumConsecutiveTutorTurnsWithoutResolution: 5,
    },
  },
} as const satisfies LearnerStagePolicyProfile;

const transitionalProfile = {
  contractVersion: "learner-stage-policy.v1",
  profileKind: "study-approved-learner-stage-policy",
  policyProfileRef: "stage-policy:study-bridge-v1",
  learnerStageRef: "learner-stage:study-bridge",
  approvalRef: "approval:stage-policy-set-v1",
  approvalKind: "study-approved",
  bounds: {
    maximumResponseWords: 120,
    maximumStepCount: 4,
    maximumHintDepth: "concept-cue",
    maximumInstructionalDensity: "moderate",
    maximumVisualStepComplexity: "linked-elements",
    breakSuggestionPolicy: {
      mode: "bounded",
      minimumCompletedTutorTurns: 3,
      minimumTurnsBetweenSuggestions: 2,
      maximumSuggestionsPerSession: 2,
    },
    multimodalAllowance: {
      allowedModalities: ["text", "image", "diagram", "audio"],
      maximumModalitiesPerResponse: 3,
    },
    parentReviewThreshold: {
      thresholdMode: "either-limit",
      maximumUnresolvedAttempts: 5,
      maximumConsecutiveTutorTurnsWithoutResolution: 8,
    },
  },
} as const satisfies LearnerStagePolicyProfile;

const expansiveProfile = {
  contractVersion: "learner-stage-policy.v1",
  profileKind: "study-approved-learner-stage-policy",
  policyProfileRef: "stage-policy:study-extended-v1",
  learnerStageRef: "learner-stage:study-extended",
  approvalRef: "approval:stage-policy-set-v1",
  approvalKind: "study-approved",
  bounds: {
    maximumResponseWords: 240,
    maximumStepCount: 8,
    maximumHintDepth: "guided-step",
    maximumInstructionalDensity: "dense",
    maximumVisualStepComplexity: "multi-part",
    breakSuggestionPolicy: {
      mode: "bounded",
      minimumCompletedTutorTurns: 2,
      minimumTurnsBetweenSuggestions: 1,
      maximumSuggestionsPerSession: 3,
    },
    multimodalAllowance: {
      allowedModalities: ["text", "image", "diagram", "audio", "video"],
      maximumModalitiesPerResponse: 5,
    },
    parentReviewThreshold: {
      thresholdMode: "either-limit",
      maximumUnresolvedAttempts: 8,
      maximumConsecutiveTutorTurnsWithoutResolution: 12,
    },
  },
} as const satisfies LearnerStagePolicyProfile;

const compliantTurn = {
  measurementKind: "study-measured-tutor-turn",
  responseWordCount: 50,
  stepCount: 2,
  hintDepth: "nudge",
  instructionalDensity: "sparse",
  visualStepComplexity: "single-focus",
  modalitiesUsed: ["text", "image"],
  suggestsBreak: false,
  requestsParentReview: false,
  breakContext: {
    completedTutorTurns: 2,
    suggestionsAlreadyMade: 0,
    turnsSinceLastSuggestion: null,
  },
  parentReviewContext: {
    unresolvedAttemptCount: 1,
    consecutiveTutorTurnsWithoutResolution: 1,
  },
} as const satisfies StudyMeasuredTutorTurn;

function bindingFor(profile: LearnerStagePolicyProfile): TrustedStudyLearnerStageBinding {
  return {
    contractVersion: "learner-stage-policy.v1",
    bindingKind: "trusted-study-learner-stage-binding",
    bindingSource: "study-runtime",
    policyProfileRef: profile.policyProfileRef,
    learnerStageRef: profile.learnerStageRef,
    approvalRef: profile.approvalRef,
  };
}

function createRegistry(
  profiles: readonly unknown[] = [boundedProfile, transitionalProfile, expansiveProfile],
) {
  const creation = createLearnerStagePolicyRegistry(profiles, fallback);
  assert.equal(creation.status, "ready");
  if (creation.status !== "ready") throw new Error("registry creation failed");
  return creation.registry;
}

test("resolves representative explicit Study stage profiles without selecting a stage", () => {
  const registry = createRegistry();
  assert.equal(registry.profileCount, 3);

  for (const profile of [boundedProfile, transitionalProfile, expansiveProfile]) {
    const resolution = registry.resolve(bindingFor(profile));
    assert.equal(resolution.status, "resolved");
    if (resolution.status !== "resolved") continue;
    assert.deepEqual(resolution.profile, profile);
    assert.equal(resolution.source, "study-explicit");
    assert.deepEqual(resolution.authority, {
      policyEffect: "constraint-only",
      studyDecisionRequired: true,
      tutorAuthorityGranted: false,
      providerOverrideAllowed: false,
      parentContactAuthorized: false,
    });
  }
});

test("representative profiles apply different explicit bounds deterministically", () => {
  const registry = createRegistry();
  const largerTurn = {
    ...compliantTurn,
    responseWordCount: 180,
    stepCount: 6,
    hintDepth: "guided-step",
    instructionalDensity: "dense",
    visualStepComplexity: "multi-part",
    modalitiesUsed: ["text", "diagram"],
  } as const satisfies StudyMeasuredTutorTurn;

  assert.equal(registry.evaluate(bindingFor(boundedProfile), largerTurn).status, "rejected");
  assert.equal(registry.evaluate(bindingFor(transitionalProfile), largerTurn).status, "rejected");
  assert.equal(registry.evaluate(bindingFor(expansiveProfile), largerTurn).status, "allowed");
});

test("enforces every learner-stage dimension in a stable issue order", () => {
  const result = createRegistry().evaluate(bindingFor(boundedProfile), {
    ...compliantTurn,
    responseWordCount: 61,
    stepCount: 3,
    hintDepth: "concept-cue",
    instructionalDensity: "moderate",
    visualStepComplexity: "linked-elements",
    modalitiesUsed: ["text", "diagram", "audio"],
    suggestsBreak: true,
    breakContext: {
      completedTutorTurns: 2,
      suggestionsAlreadyMade: 1,
      turnsSinceLastSuggestion: 1,
    },
    parentReviewContext: {
      unresolvedAttemptCount: 3,
      consecutiveTutorTurnsWithoutResolution: 2,
    },
  });

  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    [
      "RESPONSE_LENGTH_LIMIT_EXCEEDED",
      "STEP_COUNT_LIMIT_EXCEEDED",
      "HINT_DEPTH_LIMIT_EXCEEDED",
      "INSTRUCTIONAL_DENSITY_LIMIT_EXCEEDED",
      "VISUAL_STEP_COMPLEXITY_LIMIT_EXCEEDED",
      "MULTIMODALITY_NOT_ALLOWED",
      "MODALITY_COUNT_LIMIT_EXCEEDED",
      "BREAK_SUGGESTION_TOO_EARLY",
      "BREAK_SUGGESTION_COOLDOWN_ACTIVE",
      "BREAK_SUGGESTION_LIMIT_REACHED",
      "STUDY_PARENT_REVIEW_ROUTE_REQUIRED",
    ],
  );
  assert.equal(result.parentReviewThresholdReached, true);
  assert.equal(result.tutorMayProceed, false);
});

test("allows a turn exactly at all inclusive upper bounds", () => {
  const result = createRegistry().evaluate(bindingFor(boundedProfile), compliantTurn);
  assert.equal(result.status, "allowed");
  if (result.status !== "allowed") return;
  assert.deepEqual(result.issues, []);
  assert.equal(result.parentReviewThresholdReached, false);
});

test("break suggestions obey disabled, early, cooldown, count, and eligible states", () => {
  const disabledProfile = structuredClone(boundedProfile) as LearnerStagePolicyProfile;
  disabledProfile.bounds.breakSuggestionPolicy = { mode: "disabled" };
  const registry = createRegistry([disabledProfile]);
  const binding = bindingFor(disabledProfile);

  const disabled = registry.evaluate(binding, { ...compliantTurn, suggestsBreak: true });
  assert.equal(disabled.status, "rejected");
  if (disabled.status === "rejected") {
    assert.deepEqual(disabled.issues, [{ code: "BREAK_SUGGESTION_DISABLED" }]);
  }

  const boundedRegistry = createRegistry([boundedProfile]);
  const eligible = boundedRegistry.evaluate(bindingFor(boundedProfile), {
    ...compliantTurn,
    suggestsBreak: true,
    breakContext: {
      completedTutorTurns: 7,
      suggestionsAlreadyMade: 0,
      turnsSinceLastSuggestion: null,
    },
  });
  assert.equal(eligible.status, "allowed");
});

test("parent-review thresholds require only a Study route and grant no contact authority", () => {
  const registry = createRegistry([boundedProfile]);
  const atThreshold = {
    ...compliantTurn,
    requestsParentReview: true,
    parentReviewContext: {
      unresolvedAttemptCount: 0,
      consecutiveTutorTurnsWithoutResolution: 5,
    },
  } as const satisfies StudyMeasuredTutorTurn;
  const result = registry.evaluate(bindingFor(boundedProfile), atThreshold);

  assert.equal(result.status, "allowed");
  if (result.status !== "allowed") return;
  assert.equal(result.parentReviewThresholdReached, true);
  assert.equal(result.authority.studyDecisionRequired, true);
  assert.equal(result.authority.parentContactAuthorized, false);
  assert.equal(result.authority.tutorAuthorityGranted, false);
});

test("unknown, malformed, and mismatched stage bindings use reviewed static fallback", () => {
  const registry = createRegistry([boundedProfile]);
  const unknown = registry.resolve({
    ...bindingFor(boundedProfile),
    policyProfileRef: "stage-policy:not-installed",
  });
  const malformed = registry.resolve({
    ...bindingFor(boundedProfile),
    bindingSource: "provider",
  });
  const mismatched = registry.resolve({
    ...bindingFor(boundedProfile),
    learnerStageRef: transitionalProfile.learnerStageRef,
  });

  assert.equal(unknown.status, "static-fallback");
  assert.equal(malformed.status, "static-fallback");
  assert.equal(mismatched.status, "static-fallback");
  if (
    unknown.status !== "static-fallback" ||
    malformed.status !== "static-fallback" ||
    mismatched.status !== "static-fallback"
  ) {
    return;
  }
  assert.equal(unknown.reason, "UNKNOWN_LEARNER_STAGE_POLICY");
  assert.equal(malformed.reason, "INVALID_LEARNER_STAGE_BINDING");
  assert.equal(mismatched.reason, "LEARNER_STAGE_POLICY_BINDING_MISMATCH");
  for (const result of [unknown, malformed, mismatched]) {
    assert.deepEqual(result.fallback, fallback);
    assert.equal(result.adaptiveTutorAllowed, false);
    assert.equal(result.providerInvocationAllowed, false);
    assert.equal(result.tutorMayProceed, false);
  }
});

test("invalid binding fields cannot become learner-stage inference inputs", () => {
  const registry = createRegistry([boundedProfile]);
  const inferenceFields = [
    { chronologicalAge: 9 },
    { grade: 3 },
    { learnerProse: "I need easy words" },
    { observedBehavior: "hesitated" },
    { voiceDescription: "young sounding" },
    { appearanceDescription: "looks older" },
    { emotion: "anxious" },
    { personality: "shy" },
    { diagnosis: "unsupported label" },
  ];

  for (const extra of inferenceFields) {
    const result = registry.resolve({ ...bindingFor(boundedProfile), ...extra });
    assert.equal(result.status, "static-fallback");
    if (result.status === "static-fallback") {
      assert.equal(result.reason, "INVALID_LEARNER_STAGE_BINDING");
    }
  }
});

test("provider/model policy override fields fail closed instead of changing bounds", () => {
  const registry = createRegistry([boundedProfile]);
  const bindingOverride = registry.evaluate(
    {
      ...bindingFor(boundedProfile),
      providerPolicyOverrideRef: expansiveProfile.policyProfileRef,
    },
    compliantTurn,
  );
  assert.equal(bindingOverride.status, "static-fallback");

  const turnOverride = registry.evaluate(bindingFor(boundedProfile), {
    ...compliantTurn,
    providerMaximumResponseWords: 10_000,
  });
  assert.equal(turnOverride.status, "rejected");
  if (turnOverride.status === "rejected") {
    assert.deepEqual(turnOverride.issues, [{ code: "INVALID_STUDY_MEASURED_TURN" }]);
  }
});

test("rejects incoherent or duplicate profiles and an invalid fallback", () => {
  const duplicate = createLearnerStagePolicyRegistry(
    [boundedProfile, structuredClone(boundedProfile)],
    fallback,
  );
  assert.deepEqual(duplicate, {
    status: "rejected",
    code: "DUPLICATE_LEARNER_STAGE_POLICY_PROFILE",
    profileIndex: 1,
  });

  const incoherent = structuredClone(boundedProfile) as LearnerStagePolicyProfile;
  incoherent.bounds.multimodalAllowance.allowedModalities = ["text", "text"];
  assert.deepEqual(createLearnerStagePolicyRegistry([incoherent], fallback), {
    status: "rejected",
    code: "INVALID_LEARNER_STAGE_POLICY_PROFILE",
    profileIndex: 0,
  });

  const visualMismatch = structuredClone(boundedProfile) as LearnerStagePolicyProfile;
  visualMismatch.bounds.multimodalAllowance = {
    allowedModalities: ["text"],
    maximumModalitiesPerResponse: 1,
  };
  assert.deepEqual(createLearnerStagePolicyRegistry([visualMismatch], fallback), {
    status: "rejected",
    code: "INVALID_LEARNER_STAGE_POLICY_PROFILE",
    profileIndex: 0,
  });

  assert.deepEqual(
    createLearnerStagePolicyRegistry([boundedProfile], {
      ...fallback,
      learnerFacingCopy: "unreviewed fallback",
    }),
    { status: "rejected", code: "INVALID_STATIC_FALLBACK", profileIndex: null },
  );
});

test("rejects semantically inconsistent Study turn measurements", () => {
  const registry = createRegistry([boundedProfile]);
  const cases = [
    {
      ...compliantTurn,
      modalitiesUsed: ["text", "image", "image"],
    },
    {
      ...compliantTurn,
      modalitiesUsed: ["text"],
      visualStepComplexity: "single-focus",
    },
    {
      ...compliantTurn,
      breakContext: {
        completedTutorTurns: 2,
        suggestionsAlreadyMade: 1,
        turnsSinceLastSuggestion: null,
      },
    },
  ];

  for (const candidate of cases) {
    const result = registry.evaluate(bindingFor(boundedProfile), candidate);
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.deepEqual(result.issues, [{ code: "INVALID_STUDY_MEASURED_TURN" }]);
    }
  }
});

test("resolution and evaluation are replay-stable and do not mutate caller inputs", () => {
  const profiles = structuredClone([boundedProfile]);
  const fallbackInput = structuredClone(fallback);
  const binding = bindingFor(boundedProfile);
  const turn = structuredClone(compliantTurn);
  const before = structuredClone({ profiles, fallbackInput, binding, turn });
  const creation = createLearnerStagePolicyRegistry(profiles, fallbackInput);
  assert.equal(creation.status, "ready");
  if (creation.status !== "ready") return;
  const registry = creation.registry;

  const first = registry.evaluate(binding, turn);
  const second = registry.evaluate(binding, turn);
  assert.deepEqual(first, second);
  assert.deepEqual({ profiles, fallbackInput, binding, turn }, before);

  const resolution = registry.resolve(binding);
  assert.equal(resolution.status, "resolved");
  if (resolution.status !== "resolved") return;
  resolution.profile.bounds.maximumResponseWords = 1;
  const fresh = registry.resolve(binding);
  assert.equal(fresh.status, "resolved");
  if (fresh.status === "resolved") {
    assert.equal(fresh.profile.bounds.maximumResponseWords, 60);
  }
});
