import { Type, type Static } from "../../schema/typebox.js";
import {
  HintLevelSchema,
  OpaqueReferenceSchema,
  type HintLevel,
} from "../../v2/contracts/primitives.js";
import { validateExact } from "../../v2/contracts/validation.js";

export const InstructionalDensitySchema = Type.Union([
  Type.Literal("sparse"),
  Type.Literal("moderate"),
  Type.Literal("dense"),
]);
export type InstructionalDensity = Static<typeof InstructionalDensitySchema>;

export const VisualStepComplexitySchema = Type.Union([
  Type.Literal("none"),
  Type.Literal("single-focus"),
  Type.Literal("linked-elements"),
  Type.Literal("multi-part"),
]);
export type VisualStepComplexity = Static<typeof VisualStepComplexitySchema>;

export const TutorModalitySchema = Type.Union([
  Type.Literal("text"),
  Type.Literal("image"),
  Type.Literal("diagram"),
  Type.Literal("audio"),
  Type.Literal("video"),
]);
export type TutorModality = Static<typeof TutorModalitySchema>;

export const BreakSuggestionPolicySchema = Type.Union([
  Type.Object(
    { mode: Type.Literal("disabled") },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      mode: Type.Literal("bounded"),
      minimumCompletedTutorTurns: Type.Integer({ minimum: 0, maximum: 100 }),
      minimumTurnsBetweenSuggestions: Type.Integer({ minimum: 1, maximum: 100 }),
      maximumSuggestionsPerSession: Type.Integer({ minimum: 1, maximum: 20 }),
    },
    { additionalProperties: false },
  ),
]);
export type BreakSuggestionPolicy = Static<typeof BreakSuggestionPolicySchema>;

export const MultimodalAllowanceSchema = Type.Object(
  {
    allowedModalities: Type.Array(TutorModalitySchema, { minItems: 1, maxItems: 5 }),
    maximumModalitiesPerResponse: Type.Integer({ minimum: 1, maximum: 5 }),
  },
  { additionalProperties: false },
);
export type MultimodalAllowance = Static<typeof MultimodalAllowanceSchema>;

export const ParentReviewThresholdSchema = Type.Object(
  {
    thresholdMode: Type.Literal("either-limit"),
    maximumUnresolvedAttempts: Type.Integer({ minimum: 1, maximum: 100 }),
    maximumConsecutiveTutorTurnsWithoutResolution: Type.Integer({
      minimum: 1,
      maximum: 100,
    }),
  },
  { additionalProperties: false },
);
export type ParentReviewThreshold = Static<typeof ParentReviewThresholdSchema>;

export const LearnerStagePolicyBoundsSchema = Type.Object(
  {
    maximumResponseWords: Type.Integer({ minimum: 1, maximum: 1_200 }),
    maximumStepCount: Type.Integer({ minimum: 1, maximum: 32 }),
    maximumHintDepth: HintLevelSchema,
    maximumInstructionalDensity: InstructionalDensitySchema,
    maximumVisualStepComplexity: VisualStepComplexitySchema,
    breakSuggestionPolicy: BreakSuggestionPolicySchema,
    multimodalAllowance: MultimodalAllowanceSchema,
    parentReviewThreshold: ParentReviewThresholdSchema,
  },
  { additionalProperties: false, $id: "TutorV3LearnerStagePolicyBounds" },
);
export type LearnerStagePolicyBounds = Static<typeof LearnerStagePolicyBoundsSchema>;

export const LearnerStagePolicyProfileSchema = Type.Object(
  {
    contractVersion: Type.Literal("learner-stage-policy.v1"),
    profileKind: Type.Literal("study-approved-learner-stage-policy"),
    policyProfileRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
    approvalKind: Type.Literal("study-approved"),
    bounds: LearnerStagePolicyBoundsSchema,
  },
  { additionalProperties: false, $id: "TutorV3LearnerStagePolicyProfile" },
);
export type LearnerStagePolicyProfile = Static<typeof LearnerStagePolicyProfileSchema>;

export const TrustedStudyLearnerStageBindingSchema = Type.Object(
  {
    contractVersion: Type.Literal("learner-stage-policy.v1"),
    bindingKind: Type.Literal("trusted-study-learner-stage-binding"),
    bindingSource: Type.Literal("study-runtime"),
    policyProfileRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV3TrustedStudyLearnerStageBinding" },
);
export type TrustedStudyLearnerStageBinding = Static<
  typeof TrustedStudyLearnerStageBindingSchema
>;

export const ReviewedStaticStageFallbackSchema = Type.Object(
  {
    contractVersion: Type.Literal("learner-stage-policy.v1"),
    fallbackKind: Type.Literal("study-reviewed-static-stage-fallback"),
    staticContentRef: OpaqueReferenceSchema,
    policyRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV3ReviewedStaticStageFallback" },
);
export type ReviewedStaticStageFallback = Static<typeof ReviewedStaticStageFallbackSchema>;

export const BreakSuggestionContextSchema = Type.Object(
  {
    completedTutorTurns: Type.Integer({ minimum: 0, maximum: 10_000 }),
    suggestionsAlreadyMade: Type.Integer({ minimum: 0, maximum: 100 }),
    turnsSinceLastSuggestion: Type.Union([
      Type.Integer({ minimum: 0, maximum: 10_000 }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);
export type BreakSuggestionContext = Static<typeof BreakSuggestionContextSchema>;

export const ParentReviewContextSchema = Type.Object(
  {
    unresolvedAttemptCount: Type.Integer({ minimum: 0, maximum: 10_000 }),
    consecutiveTutorTurnsWithoutResolution: Type.Integer({ minimum: 0, maximum: 10_000 }),
  },
  { additionalProperties: false },
);
export type ParentReviewContext = Static<typeof ParentReviewContextSchema>;

export const StudyMeasuredTutorTurnSchema = Type.Object(
  {
    measurementKind: Type.Literal("study-measured-tutor-turn"),
    responseWordCount: Type.Integer({ minimum: 0, maximum: 10_000 }),
    stepCount: Type.Integer({ minimum: 0, maximum: 1_000 }),
    hintDepth: HintLevelSchema,
    instructionalDensity: InstructionalDensitySchema,
    visualStepComplexity: VisualStepComplexitySchema,
    modalitiesUsed: Type.Array(TutorModalitySchema, { minItems: 1, maxItems: 5 }),
    suggestsBreak: Type.Boolean(),
    requestsParentReview: Type.Boolean(),
    breakContext: BreakSuggestionContextSchema,
    parentReviewContext: ParentReviewContextSchema,
  },
  { additionalProperties: false, $id: "TutorV3StudyMeasuredTutorTurn" },
);
export type StudyMeasuredTutorTurn = Static<typeof StudyMeasuredTutorTurnSchema>;

export type LearnerStagePolicyRegistryCreation =
  | { readonly status: "ready"; readonly registry: LearnerStagePolicyRegistry }
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_STATIC_FALLBACK"
        | "INVALID_LEARNER_STAGE_POLICY_PROFILE"
        | "DUPLICATE_LEARNER_STAGE_POLICY_PROFILE";
      readonly profileIndex: number | null;
    };

export type LearnerStageFallbackReason =
  | "INVALID_LEARNER_STAGE_BINDING"
  | "UNKNOWN_LEARNER_STAGE_POLICY"
  | "LEARNER_STAGE_POLICY_BINDING_MISMATCH";

export interface LearnerStageConstraintAuthority {
  readonly policyEffect: "constraint-only";
  readonly studyDecisionRequired: true;
  readonly tutorAuthorityGranted: false;
  readonly providerOverrideAllowed: false;
  readonly parentContactAuthorized: false;
}

export type LearnerStagePolicyResolution =
  | {
      readonly status: "resolved";
      readonly source: "study-explicit";
      readonly profile: LearnerStagePolicyProfile;
      readonly authority: LearnerStageConstraintAuthority;
    }
  | {
      readonly status: "static-fallback";
      readonly reason: LearnerStageFallbackReason;
      readonly fallback: ReviewedStaticStageFallback;
      readonly adaptiveTutorAllowed: false;
      readonly providerInvocationAllowed: false;
      readonly tutorMayProceed: false;
      readonly authority: LearnerStageConstraintAuthority;
    };

export type LearnerStagePolicyIssueCode =
  | "INVALID_STUDY_MEASURED_TURN"
  | "RESPONSE_LENGTH_LIMIT_EXCEEDED"
  | "STEP_COUNT_LIMIT_EXCEEDED"
  | "HINT_DEPTH_LIMIT_EXCEEDED"
  | "INSTRUCTIONAL_DENSITY_LIMIT_EXCEEDED"
  | "VISUAL_STEP_COMPLEXITY_LIMIT_EXCEEDED"
  | "MULTIMODALITY_NOT_ALLOWED"
  | "MODALITY_COUNT_LIMIT_EXCEEDED"
  | "BREAK_SUGGESTION_DISABLED"
  | "BREAK_SUGGESTION_TOO_EARLY"
  | "BREAK_SUGGESTION_COOLDOWN_ACTIVE"
  | "BREAK_SUGGESTION_LIMIT_REACHED"
  | "STUDY_PARENT_REVIEW_ROUTE_REQUIRED";

export interface LearnerStagePolicyIssue {
  readonly code: LearnerStagePolicyIssueCode;
}

export type LearnerStagePolicyEvaluation =
  | {
      readonly status: "allowed";
      readonly source: "study-explicit";
      readonly policyProfileRef: string;
      readonly learnerStageRef: string;
      readonly issues: readonly [];
      readonly parentReviewThresholdReached: boolean;
      readonly authority: LearnerStageConstraintAuthority;
    }
  | {
      readonly status: "rejected";
      readonly source: "study-explicit";
      readonly policyProfileRef: string;
      readonly learnerStageRef: string;
      readonly issues: readonly LearnerStagePolicyIssue[];
      readonly parentReviewThresholdReached: boolean;
      readonly tutorMayProceed: false;
      readonly authority: LearnerStageConstraintAuthority;
    }
  | Extract<LearnerStagePolicyResolution, { readonly status: "static-fallback" }>;

export interface LearnerStagePolicyRegistry {
  readonly profileCount: number;
  resolve(bindingCandidate: unknown): LearnerStagePolicyResolution;
  evaluate(
    bindingCandidate: unknown,
    measuredTurnCandidate: unknown,
  ): LearnerStagePolicyEvaluation;
}

const CONSTRAINT_AUTHORITY: LearnerStageConstraintAuthority = Object.freeze({
  policyEffect: "constraint-only",
  studyDecisionRequired: true,
  tutorAuthorityGranted: false,
  providerOverrideAllowed: false,
  parentContactAuthorized: false,
});

const HINT_DEPTH_ORDER: readonly HintLevel[] = [
  "none",
  "nudge",
  "concept-cue",
  "guided-step",
];
const DENSITY_ORDER: readonly InstructionalDensity[] = ["sparse", "moderate", "dense"];
const VISUAL_COMPLEXITY_ORDER: readonly VisualStepComplexity[] = [
  "none",
  "single-focus",
  "linked-elements",
  "multi-part",
];
const VISUAL_MODALITIES = new Set<TutorModality>(["image", "diagram", "video"]);

function exceeds<T extends string>(value: T, ceiling: T, order: readonly T[]): boolean {
  return order.indexOf(value) > order.indexOf(ceiling);
}

function hasDuplicates<T>(items: readonly T[]): boolean {
  return new Set(items).size !== items.length;
}

function includesVisualModality(modalities: readonly TutorModality[]): boolean {
  return modalities.some((modality) => VISUAL_MODALITIES.has(modality));
}

function isSemanticallyValidProfile(profile: LearnerStagePolicyProfile): boolean {
  const allowance = profile.bounds.multimodalAllowance;
  const modalities = allowance.allowedModalities;
  if (
    hasDuplicates(modalities) ||
    allowance.maximumModalitiesPerResponse > modalities.length
  ) {
    return false;
  }

  const permitsVisuals = includesVisualModality(modalities);
  const hasVisualComplexity = profile.bounds.maximumVisualStepComplexity !== "none";
  return permitsVisuals === hasVisualComplexity;
}

function isSemanticallyValidTurn(turn: StudyMeasuredTutorTurn): boolean {
  if (hasDuplicates(turn.modalitiesUsed)) return false;
  const usesVisuals = includesVisualModality(turn.modalitiesUsed);
  if (usesVisuals !== (turn.visualStepComplexity !== "none")) return false;

  const breakContext = turn.breakContext;
  return breakContext.suggestionsAlreadyMade === 0
    ? breakContext.turnsSinceLastSuggestion === null
    : breakContext.turnsSinceLastSuggestion !== null;
}

function copyProfile(profile: LearnerStagePolicyProfile): LearnerStagePolicyProfile {
  return structuredClone(profile);
}

function copyFallback(fallback: ReviewedStaticStageFallback): ReviewedStaticStageFallback {
  return structuredClone(fallback);
}

function fallbackResolution(
  fallback: ReviewedStaticStageFallback,
  reason: LearnerStageFallbackReason,
): Extract<LearnerStagePolicyResolution, { readonly status: "static-fallback" }> {
  return {
    status: "static-fallback",
    reason,
    fallback: copyFallback(fallback),
    adaptiveTutorAllowed: false,
    providerInvocationAllowed: false,
    tutorMayProceed: false,
    authority: CONSTRAINT_AUTHORITY,
  };
}

function parentReviewThresholdReached(
  profile: LearnerStagePolicyProfile,
  turn: StudyMeasuredTutorTurn,
): boolean {
  const threshold = profile.bounds.parentReviewThreshold;
  const context = turn.parentReviewContext;
  return (
    context.unresolvedAttemptCount >= threshold.maximumUnresolvedAttempts ||
    context.consecutiveTutorTurnsWithoutResolution >=
      threshold.maximumConsecutiveTutorTurnsWithoutResolution
  );
}

function addBreakIssues(
  issues: LearnerStagePolicyIssue[],
  profile: LearnerStagePolicyProfile,
  turn: StudyMeasuredTutorTurn,
): void {
  if (!turn.suggestsBreak) return;

  const policy = profile.bounds.breakSuggestionPolicy;
  if (policy.mode === "disabled") {
    issues.push({ code: "BREAK_SUGGESTION_DISABLED" });
    return;
  }

  const context = turn.breakContext;
  if (context.completedTutorTurns < policy.minimumCompletedTutorTurns) {
    issues.push({ code: "BREAK_SUGGESTION_TOO_EARLY" });
  }
  if (
    context.suggestionsAlreadyMade > 0 &&
    context.turnsSinceLastSuggestion !== null &&
    context.turnsSinceLastSuggestion < policy.minimumTurnsBetweenSuggestions
  ) {
    issues.push({ code: "BREAK_SUGGESTION_COOLDOWN_ACTIVE" });
  }
  if (context.suggestionsAlreadyMade >= policy.maximumSuggestionsPerSession) {
    issues.push({ code: "BREAK_SUGGESTION_LIMIT_REACHED" });
  }
}

function evaluateResolvedPolicy(
  profile: LearnerStagePolicyProfile,
  measuredTurnCandidate: unknown,
): Exclude<LearnerStagePolicyEvaluation, { readonly status: "static-fallback" }> {
  const validation = validateExact(StudyMeasuredTutorTurnSchema, measuredTurnCandidate);
  if (validation.status === "rejected" || !isSemanticallyValidTurn(validation.value)) {
    return {
      status: "rejected",
      source: "study-explicit",
      policyProfileRef: profile.policyProfileRef,
      learnerStageRef: profile.learnerStageRef,
      issues: [{ code: "INVALID_STUDY_MEASURED_TURN" }],
      parentReviewThresholdReached: false,
      tutorMayProceed: false,
      authority: CONSTRAINT_AUTHORITY,
    };
  }

  const turn = validation.value;
  const bounds = profile.bounds;
  const issues: LearnerStagePolicyIssue[] = [];
  const add = (condition: boolean, code: LearnerStagePolicyIssueCode): void => {
    if (condition) issues.push({ code });
  };

  add(
    turn.responseWordCount > bounds.maximumResponseWords,
    "RESPONSE_LENGTH_LIMIT_EXCEEDED",
  );
  add(turn.stepCount > bounds.maximumStepCount, "STEP_COUNT_LIMIT_EXCEEDED");
  add(
    exceeds(turn.hintDepth, bounds.maximumHintDepth, HINT_DEPTH_ORDER),
    "HINT_DEPTH_LIMIT_EXCEEDED",
  );
  add(
    exceeds(
      turn.instructionalDensity,
      bounds.maximumInstructionalDensity,
      DENSITY_ORDER,
    ),
    "INSTRUCTIONAL_DENSITY_LIMIT_EXCEEDED",
  );
  add(
    exceeds(
      turn.visualStepComplexity,
      bounds.maximumVisualStepComplexity,
      VISUAL_COMPLEXITY_ORDER,
    ),
    "VISUAL_STEP_COMPLEXITY_LIMIT_EXCEEDED",
  );

  const allowedModalities = new Set(bounds.multimodalAllowance.allowedModalities);
  add(
    turn.modalitiesUsed.some((modality) => !allowedModalities.has(modality)),
    "MULTIMODALITY_NOT_ALLOWED",
  );
  add(
    turn.modalitiesUsed.length > bounds.multimodalAllowance.maximumModalitiesPerResponse,
    "MODALITY_COUNT_LIMIT_EXCEEDED",
  );
  addBreakIssues(issues, profile, turn);

  const reviewThresholdReached = parentReviewThresholdReached(profile, turn);
  add(
    reviewThresholdReached && !turn.requestsParentReview,
    "STUDY_PARENT_REVIEW_ROUTE_REQUIRED",
  );

  return issues.length === 0
    ? {
        status: "allowed",
        source: "study-explicit",
        policyProfileRef: profile.policyProfileRef,
        learnerStageRef: profile.learnerStageRef,
        issues: [],
        parentReviewThresholdReached: reviewThresholdReached,
        authority: CONSTRAINT_AUTHORITY,
      }
    : {
        status: "rejected",
        source: "study-explicit",
        policyProfileRef: profile.policyProfileRef,
        learnerStageRef: profile.learnerStageRef,
        issues,
        parentReviewThresholdReached: reviewThresholdReached,
        tutorMayProceed: false,
        authority: CONSTRAINT_AUTHORITY,
      };
}

export function createLearnerStagePolicyRegistry(
  profileCandidates: readonly unknown[],
  fallbackCandidate: unknown,
): LearnerStagePolicyRegistryCreation {
  const fallbackValidation = validateExact(ReviewedStaticStageFallbackSchema, fallbackCandidate);
  if (fallbackValidation.status === "rejected") {
    return { status: "rejected", code: "INVALID_STATIC_FALLBACK", profileIndex: null };
  }

  const profilesByRef = new Map<string, LearnerStagePolicyProfile>();
  for (const [profileIndex, profileCandidate] of profileCandidates.entries()) {
    const validation = validateExact(LearnerStagePolicyProfileSchema, profileCandidate);
    if (validation.status === "rejected" || !isSemanticallyValidProfile(validation.value)) {
      return {
        status: "rejected",
        code: "INVALID_LEARNER_STAGE_POLICY_PROFILE",
        profileIndex,
      };
    }
    if (profilesByRef.has(validation.value.policyProfileRef)) {
      return {
        status: "rejected",
        code: "DUPLICATE_LEARNER_STAGE_POLICY_PROFILE",
        profileIndex,
      };
    }
    profilesByRef.set(validation.value.policyProfileRef, copyProfile(validation.value));
  }

  const fallback = copyFallback(fallbackValidation.value);
  const resolve = (bindingCandidate: unknown): LearnerStagePolicyResolution => {
    const validation = validateExact(TrustedStudyLearnerStageBindingSchema, bindingCandidate);
    if (validation.status === "rejected") {
      return fallbackResolution(fallback, "INVALID_LEARNER_STAGE_BINDING");
    }

    const profile = profilesByRef.get(validation.value.policyProfileRef);
    if (!profile) {
      return fallbackResolution(fallback, "UNKNOWN_LEARNER_STAGE_POLICY");
    }
    if (
      profile.learnerStageRef !== validation.value.learnerStageRef ||
      profile.approvalRef !== validation.value.approvalRef
    ) {
      return fallbackResolution(fallback, "LEARNER_STAGE_POLICY_BINDING_MISMATCH");
    }

    return {
      status: "resolved",
      source: "study-explicit",
      profile: copyProfile(profile),
      authority: CONSTRAINT_AUTHORITY,
    };
  };
  const registry: LearnerStagePolicyRegistry = {
    profileCount: profilesByRef.size,
    resolve,
    evaluate(
      bindingCandidate: unknown,
      measuredTurnCandidate: unknown,
    ): LearnerStagePolicyEvaluation {
      const resolution = resolve(bindingCandidate);
      if (resolution.status === "static-fallback") return resolution;
      return evaluateResolvedPolicy(resolution.profile, measuredTurnCandidate);
    },
  };

  return { status: "ready", registry };
}
