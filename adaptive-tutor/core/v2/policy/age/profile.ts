import { Type, type Static } from "../../../schema/typebox.js";
import { OpaqueReferenceSchema } from "../../contracts/primitives.js";
import { validateExact } from "../../contracts/validation.js";

export const AbstractionLevelSchema = Type.Union([
  Type.Literal("concrete"),
  Type.Literal("representational"),
  Type.Literal("conceptual"),
  Type.Literal("formal"),
]);
export type AbstractionLevel = Static<typeof AbstractionLevelSchema>;

export const StepGranularitySchema = Type.Union([
  Type.Literal("micro-step"),
  Type.Literal("small-step"),
  Type.Literal("multi-step"),
  Type.Literal("synthesis"),
]);
export type StepGranularity = Static<typeof StepGranularitySchema>;

export const ConcreteExamplePreferenceSchema = Type.Union([
  Type.Literal("required"),
  Type.Literal("preferred"),
  Type.Literal("situational"),
]);
export type ConcreteExamplePreference = Static<typeof ConcreteExamplePreferenceSchema>;

export const IndependentReasoningExpectationSchema = Type.Union([
  Type.Literal("guided"),
  Type.Literal("scaffolded"),
  Type.Literal("mixed"),
  Type.Literal("independent"),
]);
export type IndependentReasoningExpectation = Static<
  typeof IndependentReasoningExpectationSchema
>;

export const SocraticQuestioningLevelSchema = Type.Union([
  Type.Literal("minimal"),
  Type.Literal("guided"),
  Type.Literal("moderate"),
  Type.Literal("high"),
]);
export type SocraticQuestioningLevel = Static<typeof SocraticQuestioningLevelSchema>;

export const VocabularyComplexitySchema = Type.Union([
  Type.Literal("foundational"),
  Type.Literal("developing"),
  Type.Literal("academic"),
  Type.Literal("advanced"),
]);
export type VocabularyComplexity = Static<typeof VocabularyComplexitySchema>;

export const ExplanationDensitySchema = Type.Union([
  Type.Literal("sparse"),
  Type.Literal("moderate"),
  Type.Literal("dense"),
]);
export type ExplanationDensity = Static<typeof ExplanationDensitySchema>;

export const RecommendedTurnLengthSchema = Type.Object(
  {
    minimumWords: Type.Integer({ minimum: 1, maximum: 1200 }),
    maximumWords: Type.Integer({ minimum: 1, maximum: 1200 }),
  },
  { additionalProperties: false },
);

export const AgeAwareTutorPolicyDimensionsSchema = Type.Object(
  {
    maximumConceptsIntroducedPerTurn: Type.Integer({ minimum: 1, maximum: 8 }),
    recommendedTurnLengthWords: RecommendedTurnLengthSchema,
    maximumStepsPerTurn: Type.Integer({ minimum: 1, maximum: 16 }),
    abstractionLevel: AbstractionLevelSchema,
    stepGranularity: StepGranularitySchema,
    comprehensionCheckFrequencyTurns: Type.Integer({ minimum: 1, maximum: 12 }),
    concreteExamplePreference: ConcreteExamplePreferenceSchema,
    independentReasoningExpectation: IndependentReasoningExpectationSchema,
    socraticQuestioningLevel: SocraticQuestioningLevelSchema,
    vocabularyComplexity: VocabularyComplexitySchema,
    allowableExplanationDensity: ExplanationDensitySchema,
    maximumHintEscalationsBeforeRecheck: Type.Integer({ minimum: 0, maximum: 8 }),
  },
  { additionalProperties: false, $id: "TutorV2AgePolicyDimensions" },
);
export type AgeAwareTutorPolicyDimensions = Static<
  typeof AgeAwareTutorPolicyDimensionsSchema
>;

export const AgeAwareTutorPolicyProfileSchema = Type.Object(
  {
    profileKind: Type.Literal("approved-learning-stage-policy"),
    policyProfileRef: OpaqueReferenceSchema,
    learningStageRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
    approvalKind: Type.Literal("study-approved"),
    dimensions: AgeAwareTutorPolicyDimensionsSchema,
  },
  { additionalProperties: false, $id: "TutorV2AgePolicyProfile" },
);
export type AgeAwareTutorPolicyProfile = Static<typeof AgeAwareTutorPolicyProfileSchema>;

export const TrustedStudyAgePolicyBindingSchema = Type.Object(
  {
    bindingKind: Type.Literal("trusted-study-age-policy-binding"),
    policyProfileRef: OpaqueReferenceSchema,
    learningStageRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV2TrustedStudyAgePolicyBinding" },
);
export type TrustedStudyAgePolicyBinding = Static<typeof TrustedStudyAgePolicyBindingSchema>;

export const TutorTurnPolicyPlanSchema = Type.Object(
  {
    introducedConceptRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 16 }),
    estimatedTutorWordCount: Type.Integer({ minimum: 0, maximum: 5000 }),
    plannedStepCount: Type.Integer({ minimum: 0, maximum: 24 }),
    abstractionLevel: AbstractionLevelSchema,
    stepGranularity: StepGranularitySchema,
    turnsSinceComprehensionCheck: Type.Integer({ minimum: 0, maximum: 24 }),
    includesComprehensionCheck: Type.Boolean(),
    includesConcreteExample: Type.Boolean(),
    independentReasoningExpectation: IndependentReasoningExpectationSchema,
    socraticQuestioningLevel: SocraticQuestioningLevelSchema,
    vocabularyComplexity: VocabularyComplexitySchema,
    explanationDensity: ExplanationDensitySchema,
    hintEscalationsSinceRecheck: Type.Integer({ minimum: 0, maximum: 24 }),
  },
  { additionalProperties: false, $id: "TutorV2TurnPolicyPlan" },
);
export type TutorTurnPolicyPlan = Static<typeof TutorTurnPolicyPlanSchema>;

export type AgePolicyRegistryCreationResult =
  | { readonly status: "ready"; readonly registry: ApprovedAgePolicyRegistry }
  | {
      readonly status: "rejected";
      readonly code: "INVALID_AGE_POLICY_PROFILE" | "DUPLICATE_AGE_POLICY_PROFILE";
      readonly profileIndex: number | null;
    };

export type AgePolicyResolution =
  | { readonly status: "resolved"; readonly profile: AgeAwareTutorPolicyProfile }
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_AGE_POLICY_BINDING"
        | "UNSUPPORTED_AGE_POLICY_PROFILE"
        | "AGE_POLICY_BINDING_MISMATCH";
      readonly tutorMayProceed: false;
    };

export interface ApprovedAgePolicyRegistry {
  readonly profileCount: number;
  resolve(binding: unknown): AgePolicyResolution;
}

export interface TutorTurnPolicyIssue {
  readonly code:
    | "INVALID_POLICY_PROFILE"
    | "INVALID_TUTOR_TURN_PLAN"
    | "CONCEPT_LIMIT_EXCEEDED"
    | "TURN_LENGTH_EXCEEDED"
    | "STEP_LIMIT_EXCEEDED"
    | "ABSTRACTION_LIMIT_EXCEEDED"
    | "STEP_GRANULARITY_EXCEEDED"
    | "COMPREHENSION_CHECK_REQUIRED"
    | "CONCRETE_EXAMPLE_REQUIRED"
    | "INDEPENDENCE_EXPECTATION_EXCEEDED"
    | "SOCRATIC_LEVEL_EXCEEDED"
    | "VOCABULARY_COMPLEXITY_EXCEEDED"
    | "EXPLANATION_DENSITY_EXCEEDED"
    | "HINT_RECHECK_REQUIRED";
}

export type TutorTurnPolicyEvaluation =
  | { readonly status: "allowed"; readonly issues: readonly [] }
  | {
      readonly status: "rejected";
      readonly tutorMayProceed: false;
      readonly issues: readonly TutorTurnPolicyIssue[];
    };

const ABSTRACTION_ORDER: readonly AbstractionLevel[] = [
  "concrete",
  "representational",
  "conceptual",
  "formal",
];
const STEP_GRANULARITY_ORDER: readonly StepGranularity[] = [
  "micro-step",
  "small-step",
  "multi-step",
  "synthesis",
];
const INDEPENDENCE_ORDER: readonly IndependentReasoningExpectation[] = [
  "guided",
  "scaffolded",
  "mixed",
  "independent",
];
const SOCRATIC_ORDER: readonly SocraticQuestioningLevel[] = [
  "minimal",
  "guided",
  "moderate",
  "high",
];
const VOCABULARY_ORDER: readonly VocabularyComplexity[] = [
  "foundational",
  "developing",
  "academic",
  "advanced",
];
const DENSITY_ORDER: readonly ExplanationDensity[] = ["sparse", "moderate", "dense"];

function isSemanticallyValidProfile(profile: AgeAwareTutorPolicyProfile): boolean {
  const length = profile.dimensions.recommendedTurnLengthWords;
  return length.minimumWords <= length.maximumWords;
}

function exceeds<T extends string>(value: T, ceiling: T, order: readonly T[]): boolean {
  return order.indexOf(value) > order.indexOf(ceiling);
}

function copyProfile(profile: AgeAwareTutorPolicyProfile): AgeAwareTutorPolicyProfile {
  return structuredClone(profile);
}

export function createApprovedAgePolicyRegistry(
  profiles: readonly unknown[],
): AgePolicyRegistryCreationResult {
  const byRef = new Map<string, AgeAwareTutorPolicyProfile>();

  for (const [profileIndex, candidate] of profiles.entries()) {
    const validation = validateExact(AgeAwareTutorPolicyProfileSchema, candidate);
    if (validation.status === "rejected" || !isSemanticallyValidProfile(validation.value)) {
      return { status: "rejected", code: "INVALID_AGE_POLICY_PROFILE", profileIndex };
    }
    if (byRef.has(validation.value.policyProfileRef)) {
      return { status: "rejected", code: "DUPLICATE_AGE_POLICY_PROFILE", profileIndex };
    }
    byRef.set(validation.value.policyProfileRef, copyProfile(validation.value));
  }

  const registry: ApprovedAgePolicyRegistry = {
    profileCount: byRef.size,
    resolve(binding: unknown): AgePolicyResolution {
      const validation = validateExact(TrustedStudyAgePolicyBindingSchema, binding);
      if (validation.status === "rejected") {
        return {
          status: "rejected",
          code: "INVALID_AGE_POLICY_BINDING",
          tutorMayProceed: false,
        };
      }

      const profile = byRef.get(validation.value.policyProfileRef);
      if (!profile) {
        return {
          status: "rejected",
          code: "UNSUPPORTED_AGE_POLICY_PROFILE",
          tutorMayProceed: false,
        };
      }
      if (
        profile.learningStageRef !== validation.value.learningStageRef ||
        profile.approvalRef !== validation.value.approvalRef
      ) {
        return {
          status: "rejected",
          code: "AGE_POLICY_BINDING_MISMATCH",
          tutorMayProceed: false,
        };
      }
      return { status: "resolved", profile: copyProfile(profile) };
    },
  };
  return { status: "ready", registry };
}

export function evaluateTutorTurnAgainstAgePolicy(
  profileCandidate: unknown,
  planCandidate: unknown,
): TutorTurnPolicyEvaluation {
  const profileValidation = validateExact(AgeAwareTutorPolicyProfileSchema, profileCandidate);
  if (
    profileValidation.status === "rejected" ||
    !isSemanticallyValidProfile(profileValidation.value)
  ) {
    return {
      status: "rejected",
      tutorMayProceed: false,
      issues: [{ code: "INVALID_POLICY_PROFILE" }],
    };
  }
  const planValidation = validateExact(TutorTurnPolicyPlanSchema, planCandidate);
  if (planValidation.status === "rejected") {
    return {
      status: "rejected",
      tutorMayProceed: false,
      issues: [{ code: "INVALID_TUTOR_TURN_PLAN" }],
    };
  }

  const policy = profileValidation.value.dimensions;
  const plan = planValidation.value;
  const issues: TutorTurnPolicyIssue[] = [];
  const add = (condition: boolean, code: TutorTurnPolicyIssue["code"]): void => {
    if (condition) issues.push({ code });
  };

  add(
    plan.introducedConceptRefs.length > policy.maximumConceptsIntroducedPerTurn,
    "CONCEPT_LIMIT_EXCEEDED",
  );
  add(
    plan.estimatedTutorWordCount > policy.recommendedTurnLengthWords.maximumWords,
    "TURN_LENGTH_EXCEEDED",
  );
  add(plan.plannedStepCount > policy.maximumStepsPerTurn, "STEP_LIMIT_EXCEEDED");
  add(
    exceeds(plan.abstractionLevel, policy.abstractionLevel, ABSTRACTION_ORDER),
    "ABSTRACTION_LIMIT_EXCEEDED",
  );
  add(
    exceeds(plan.stepGranularity, policy.stepGranularity, STEP_GRANULARITY_ORDER),
    "STEP_GRANULARITY_EXCEEDED",
  );
  add(
    plan.turnsSinceComprehensionCheck + 1 >= policy.comprehensionCheckFrequencyTurns &&
      !plan.includesComprehensionCheck,
    "COMPREHENSION_CHECK_REQUIRED",
  );
  add(
    policy.concreteExamplePreference === "required" && !plan.includesConcreteExample,
    "CONCRETE_EXAMPLE_REQUIRED",
  );
  add(
    exceeds(
      plan.independentReasoningExpectation,
      policy.independentReasoningExpectation,
      INDEPENDENCE_ORDER,
    ),
    "INDEPENDENCE_EXPECTATION_EXCEEDED",
  );
  add(
    exceeds(plan.socraticQuestioningLevel, policy.socraticQuestioningLevel, SOCRATIC_ORDER),
    "SOCRATIC_LEVEL_EXCEEDED",
  );
  add(
    exceeds(plan.vocabularyComplexity, policy.vocabularyComplexity, VOCABULARY_ORDER),
    "VOCABULARY_COMPLEXITY_EXCEEDED",
  );
  add(
    exceeds(plan.explanationDensity, policy.allowableExplanationDensity, DENSITY_ORDER),
    "EXPLANATION_DENSITY_EXCEEDED",
  );
  add(
    plan.hintEscalationsSinceRecheck > policy.maximumHintEscalationsBeforeRecheck &&
      !plan.includesComprehensionCheck,
    "HINT_RECHECK_REQUIRED",
  );

  return issues.length === 0
    ? { status: "allowed", issues: [] }
    : { status: "rejected", tutorMayProceed: false, issues };
}
