import assert from "node:assert/strict";
import test from "node:test";
import {
  createApprovedAgePolicyRegistry,
  evaluateTutorTurnAgainstAgePolicy,
  type AgeAwareTutorPolicyProfile,
  type TutorTurnPolicyPlan,
} from "./index.js";

const youngerProfile = {
  profileKind: "approved-learning-stage-policy",
  policyProfileRef: "age-policy:foundational-concrete-v1",
  learningStageRef: "learning-stage:foundational-concrete",
  approvalRef: "study-approval:age-policy-set-v1",
  approvalKind: "study-approved",
  dimensions: {
    maximumConceptsIntroducedPerTurn: 1,
    recommendedTurnLengthWords: { minimumWords: 12, maximumWords: 70 },
    maximumStepsPerTurn: 2,
    abstractionLevel: "representational",
    stepGranularity: "small-step",
    comprehensionCheckFrequencyTurns: 1,
    concreteExamplePreference: "required",
    independentReasoningExpectation: "scaffolded",
    socraticQuestioningLevel: "guided",
    vocabularyComplexity: "developing",
    allowableExplanationDensity: "sparse",
    maximumHintEscalationsBeforeRecheck: 1,
  },
} as const satisfies AgeAwareTutorPolicyProfile;

const olderProfile = {
  profileKind: "approved-learning-stage-policy",
  policyProfileRef: "age-policy:abstract-independent-v1",
  learningStageRef: "learning-stage:abstract-independent",
  approvalRef: "study-approval:age-policy-set-v1",
  approvalKind: "study-approved",
  dimensions: {
    maximumConceptsIntroducedPerTurn: 3,
    recommendedTurnLengthWords: { minimumWords: 30, maximumWords: 240 },
    maximumStepsPerTurn: 6,
    abstractionLevel: "formal",
    stepGranularity: "synthesis",
    comprehensionCheckFrequencyTurns: 4,
    concreteExamplePreference: "situational",
    independentReasoningExpectation: "independent",
    socraticQuestioningLevel: "high",
    vocabularyComplexity: "advanced",
    allowableExplanationDensity: "dense",
    maximumHintEscalationsBeforeRecheck: 3,
  },
} as const satisfies AgeAwareTutorPolicyProfile;

const policyCompliantPlan = {
  introducedConceptRefs: ["concept:equal-parts"],
  estimatedTutorWordCount: 60,
  plannedStepCount: 2,
  abstractionLevel: "representational",
  stepGranularity: "small-step",
  turnsSinceComprehensionCheck: 0,
  includesComprehensionCheck: true,
  includesConcreteExample: true,
  independentReasoningExpectation: "scaffolded",
  socraticQuestioningLevel: "guided",
  vocabularyComplexity: "developing",
  explanationDensity: "sparse",
  hintEscalationsSinceRecheck: 1,
} as const satisfies TutorTurnPolicyPlan;

test("younger-stage profiles enforce smaller turn and step limits", () => {
  assert.ok(
    youngerProfile.dimensions.recommendedTurnLengthWords.maximumWords <
      olderProfile.dimensions.recommendedTurnLengthWords.maximumWords,
  );
  assert.ok(
    youngerProfile.dimensions.maximumStepsPerTurn < olderProfile.dimensions.maximumStepsPerTurn,
  );

  const longerPlan = {
    ...policyCompliantPlan,
    estimatedTutorWordCount: 120,
    plannedStepCount: 4,
    includesComprehensionCheck: true,
  };
  const youngerResult = evaluateTutorTurnAgainstAgePolicy(youngerProfile, longerPlan);
  const olderResult = evaluateTutorTurnAgainstAgePolicy(olderProfile, longerPlan);
  assert.equal(youngerResult.status, "rejected");
  assert.deepEqual(
    youngerResult.issues.map((issue) => issue.code),
    ["TURN_LENGTH_EXCEEDED", "STEP_LIMIT_EXCEEDED"],
  );
  assert.equal(olderResult.status, "allowed");
});

test("older-stage profiles permit greater abstraction without a separate Tutor engine", () => {
  const formalPlan = {
    ...policyCompliantPlan,
    abstractionLevel: "formal",
    stepGranularity: "synthesis",
    independentReasoningExpectation: "independent",
    socraticQuestioningLevel: "high",
    vocabularyComplexity: "advanced",
    explanationDensity: "dense",
  } as const;
  assert.equal(evaluateTutorTurnAgainstAgePolicy(youngerProfile, formalPlan).status, "rejected");
  assert.equal(evaluateTutorTurnAgainstAgePolicy(olderProfile, formalPlan).status, "allowed");
});

test("rejects invalid profiles including inconsistent recommended length bounds", () => {
  const invalid = structuredClone(youngerProfile) as Record<string, unknown>;
  const dimensions = invalid.dimensions as Record<string, unknown>;
  dimensions.recommendedTurnLengthWords = { minimumWords: 100, maximumWords: 50 };
  const result = createApprovedAgePolicyRegistry([invalid]);
  assert.deepEqual(result, {
    status: "rejected",
    code: "INVALID_AGE_POLICY_PROFILE",
    profileIndex: 0,
  });
});

test("unsupported or mismatched Study policy bindings fail closed", () => {
  const creation = createApprovedAgePolicyRegistry([youngerProfile, olderProfile]);
  assert.equal(creation.status, "ready");
  if (creation.status !== "ready") return;

  assert.deepEqual(
    creation.registry.resolve({
      bindingKind: "trusted-study-age-policy-binding",
      policyProfileRef: "age-policy:not-installed",
      learningStageRef: "learning-stage:future-stage",
      approvalRef: "study-approval:future-set",
    }),
    {
      status: "rejected",
      code: "UNSUPPORTED_AGE_POLICY_PROFILE",
      tutorMayProceed: false,
    },
  );
  assert.deepEqual(
    creation.registry.resolve({
      bindingKind: "trusted-study-age-policy-binding",
      policyProfileRef: youngerProfile.policyProfileRef,
      learningStageRef: olderProfile.learningStageRef,
      approvalRef: youngerProfile.approvalRef,
    }),
    {
      status: "rejected",
      code: "AGE_POLICY_BINDING_MISMATCH",
      tutorMayProceed: false,
    },
  );
});

test("resolves only the exact Study-approved stage binding and returns a defensive copy", () => {
  const creation = createApprovedAgePolicyRegistry([youngerProfile]);
  assert.equal(creation.status, "ready");
  if (creation.status !== "ready") return;

  const result = creation.registry.resolve({
    bindingKind: "trusted-study-age-policy-binding",
    policyProfileRef: youngerProfile.policyProfileRef,
    learningStageRef: youngerProfile.learningStageRef,
    approvalRef: youngerProfile.approvalRef,
  });
  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.deepEqual(result.profile, youngerProfile);
  assert.notEqual(result.profile, youngerProfile);
});

test("policy selection has no grade or private-age inference surface", () => {
  const creation = createApprovedAgePolicyRegistry([youngerProfile]);
  assert.equal(creation.status, "ready");
  if (creation.status !== "ready") return;

  for (const privateField of [
    { grade: 3 },
    { birthDate: "2017-01-01" },
    { chronologicalAge: 9 },
    { studentId: "student:private" },
  ]) {
    const result = creation.registry.resolve({
      bindingKind: "trusted-study-age-policy-binding",
      policyProfileRef: youngerProfile.policyProfileRef,
      learningStageRef: youngerProfile.learningStageRef,
      approvalRef: youngerProfile.approvalRef,
      ...privateField,
    });
    assert.deepEqual(result, {
      status: "rejected",
      code: "INVALID_AGE_POLICY_BINDING",
      tutorMayProceed: false,
    });
  }
});

test("all explicit policy dimensions participate in turn enforcement", () => {
  const result = evaluateTutorTurnAgainstAgePolicy(youngerProfile, {
    ...policyCompliantPlan,
    introducedConceptRefs: ["concept:a", "concept:b"],
    abstractionLevel: "formal",
    stepGranularity: "synthesis",
    includesComprehensionCheck: false,
    includesConcreteExample: false,
    independentReasoningExpectation: "independent",
    socraticQuestioningLevel: "high",
    vocabularyComplexity: "advanced",
    explanationDensity: "dense",
    hintEscalationsSinceRecheck: 2,
  });
  assert.equal(result.status, "rejected");
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    [
      "CONCEPT_LIMIT_EXCEEDED",
      "ABSTRACTION_LIMIT_EXCEEDED",
      "STEP_GRANULARITY_EXCEEDED",
      "COMPREHENSION_CHECK_REQUIRED",
      "CONCRETE_EXAMPLE_REQUIRED",
      "INDEPENDENCE_EXPECTATION_EXCEEDED",
      "SOCRATIC_LEVEL_EXCEEDED",
      "VOCABULARY_COMPLEXITY_EXCEEDED",
      "EXPLANATION_DENSITY_EXCEEDED",
      "HINT_RECHECK_REQUIRED",
    ],
  );
});
