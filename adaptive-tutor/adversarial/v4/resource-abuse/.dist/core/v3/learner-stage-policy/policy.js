import { Type } from "../../schema/typebox.js";
import { HintLevelSchema, OpaqueReferenceSchema, } from "../../v2/contracts/primitives.js";
import { validateExact } from "../../v2/contracts/validation.js";
export const InstructionalDensitySchema = Type.Union([
    Type.Literal("sparse"),
    Type.Literal("moderate"),
    Type.Literal("dense"),
]);
export const VisualStepComplexitySchema = Type.Union([
    Type.Literal("none"),
    Type.Literal("single-focus"),
    Type.Literal("linked-elements"),
    Type.Literal("multi-part"),
]);
export const TutorModalitySchema = Type.Union([
    Type.Literal("text"),
    Type.Literal("image"),
    Type.Literal("diagram"),
    Type.Literal("audio"),
    Type.Literal("video"),
]);
export const BreakSuggestionPolicySchema = Type.Union([
    Type.Object({ mode: Type.Literal("disabled") }, { additionalProperties: false }),
    Type.Object({
        mode: Type.Literal("bounded"),
        minimumCompletedTutorTurns: Type.Integer({ minimum: 0, maximum: 100 }),
        minimumTurnsBetweenSuggestions: Type.Integer({ minimum: 1, maximum: 100 }),
        maximumSuggestionsPerSession: Type.Integer({ minimum: 1, maximum: 20 }),
    }, { additionalProperties: false }),
]);
export const MultimodalAllowanceSchema = Type.Object({
    allowedModalities: Type.Array(TutorModalitySchema, { minItems: 1, maxItems: 5 }),
    maximumModalitiesPerResponse: Type.Integer({ minimum: 1, maximum: 5 }),
}, { additionalProperties: false });
export const ParentReviewThresholdSchema = Type.Object({
    thresholdMode: Type.Literal("either-limit"),
    maximumUnresolvedAttempts: Type.Integer({ minimum: 1, maximum: 100 }),
    maximumConsecutiveTutorTurnsWithoutResolution: Type.Integer({
        minimum: 1,
        maximum: 100,
    }),
}, { additionalProperties: false });
export const LearnerStagePolicyBoundsSchema = Type.Object({
    maximumResponseWords: Type.Integer({ minimum: 1, maximum: 1_200 }),
    maximumStepCount: Type.Integer({ minimum: 1, maximum: 32 }),
    maximumHintDepth: HintLevelSchema,
    maximumInstructionalDensity: InstructionalDensitySchema,
    maximumVisualStepComplexity: VisualStepComplexitySchema,
    breakSuggestionPolicy: BreakSuggestionPolicySchema,
    multimodalAllowance: MultimodalAllowanceSchema,
    parentReviewThreshold: ParentReviewThresholdSchema,
}, { additionalProperties: false, $id: "TutorV3LearnerStagePolicyBounds" });
export const LearnerStagePolicyProfileSchema = Type.Object({
    contractVersion: Type.Literal("learner-stage-policy.v1"),
    profileKind: Type.Literal("study-approved-learner-stage-policy"),
    policyProfileRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
    approvalKind: Type.Literal("study-approved"),
    bounds: LearnerStagePolicyBoundsSchema,
}, { additionalProperties: false, $id: "TutorV3LearnerStagePolicyProfile" });
export const TrustedStudyLearnerStageBindingSchema = Type.Object({
    contractVersion: Type.Literal("learner-stage-policy.v1"),
    bindingKind: Type.Literal("trusted-study-learner-stage-binding"),
    bindingSource: Type.Literal("study-runtime"),
    policyProfileRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
}, { additionalProperties: false, $id: "TutorV3TrustedStudyLearnerStageBinding" });
export const ReviewedStaticStageFallbackSchema = Type.Object({
    contractVersion: Type.Literal("learner-stage-policy.v1"),
    fallbackKind: Type.Literal("study-reviewed-static-stage-fallback"),
    staticContentRef: OpaqueReferenceSchema,
    policyRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
}, { additionalProperties: false, $id: "TutorV3ReviewedStaticStageFallback" });
export const BreakSuggestionContextSchema = Type.Object({
    completedTutorTurns: Type.Integer({ minimum: 0, maximum: 10_000 }),
    suggestionsAlreadyMade: Type.Integer({ minimum: 0, maximum: 100 }),
    turnsSinceLastSuggestion: Type.Union([
        Type.Integer({ minimum: 0, maximum: 10_000 }),
        Type.Null(),
    ]),
}, { additionalProperties: false });
export const ParentReviewContextSchema = Type.Object({
    unresolvedAttemptCount: Type.Integer({ minimum: 0, maximum: 10_000 }),
    consecutiveTutorTurnsWithoutResolution: Type.Integer({ minimum: 0, maximum: 10_000 }),
}, { additionalProperties: false });
export const StudyMeasuredTutorTurnSchema = Type.Object({
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
}, { additionalProperties: false, $id: "TutorV3StudyMeasuredTutorTurn" });
const CONSTRAINT_AUTHORITY = Object.freeze({
    policyEffect: "constraint-only",
    studyDecisionRequired: true,
    tutorAuthorityGranted: false,
    providerOverrideAllowed: false,
    parentContactAuthorized: false,
});
const HINT_DEPTH_ORDER = [
    "none",
    "nudge",
    "concept-cue",
    "guided-step",
];
const DENSITY_ORDER = ["sparse", "moderate", "dense"];
const VISUAL_COMPLEXITY_ORDER = [
    "none",
    "single-focus",
    "linked-elements",
    "multi-part",
];
const VISUAL_MODALITIES = new Set(["image", "diagram", "video"]);
function exceeds(value, ceiling, order) {
    return order.indexOf(value) > order.indexOf(ceiling);
}
function hasDuplicates(items) {
    return new Set(items).size !== items.length;
}
function includesVisualModality(modalities) {
    return modalities.some((modality) => VISUAL_MODALITIES.has(modality));
}
function isSemanticallyValidProfile(profile) {
    const allowance = profile.bounds.multimodalAllowance;
    const modalities = allowance.allowedModalities;
    if (hasDuplicates(modalities) ||
        allowance.maximumModalitiesPerResponse > modalities.length) {
        return false;
    }
    const permitsVisuals = includesVisualModality(modalities);
    const hasVisualComplexity = profile.bounds.maximumVisualStepComplexity !== "none";
    return permitsVisuals === hasVisualComplexity;
}
function isSemanticallyValidTurn(turn) {
    if (hasDuplicates(turn.modalitiesUsed))
        return false;
    const usesVisuals = includesVisualModality(turn.modalitiesUsed);
    if (usesVisuals !== (turn.visualStepComplexity !== "none"))
        return false;
    const breakContext = turn.breakContext;
    return breakContext.suggestionsAlreadyMade === 0
        ? breakContext.turnsSinceLastSuggestion === null
        : breakContext.turnsSinceLastSuggestion !== null;
}
function copyProfile(profile) {
    return structuredClone(profile);
}
function copyFallback(fallback) {
    return structuredClone(fallback);
}
function fallbackResolution(fallback, reason) {
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
function parentReviewThresholdReached(profile, turn) {
    const threshold = profile.bounds.parentReviewThreshold;
    const context = turn.parentReviewContext;
    return (context.unresolvedAttemptCount >= threshold.maximumUnresolvedAttempts ||
        context.consecutiveTutorTurnsWithoutResolution >=
            threshold.maximumConsecutiveTutorTurnsWithoutResolution);
}
function addBreakIssues(issues, profile, turn) {
    if (!turn.suggestsBreak)
        return;
    const policy = profile.bounds.breakSuggestionPolicy;
    if (policy.mode === "disabled") {
        issues.push({ code: "BREAK_SUGGESTION_DISABLED" });
        return;
    }
    const context = turn.breakContext;
    if (context.completedTutorTurns < policy.minimumCompletedTutorTurns) {
        issues.push({ code: "BREAK_SUGGESTION_TOO_EARLY" });
    }
    if (context.suggestionsAlreadyMade > 0 &&
        context.turnsSinceLastSuggestion !== null &&
        context.turnsSinceLastSuggestion < policy.minimumTurnsBetweenSuggestions) {
        issues.push({ code: "BREAK_SUGGESTION_COOLDOWN_ACTIVE" });
    }
    if (context.suggestionsAlreadyMade >= policy.maximumSuggestionsPerSession) {
        issues.push({ code: "BREAK_SUGGESTION_LIMIT_REACHED" });
    }
}
function evaluateResolvedPolicy(profile, measuredTurnCandidate) {
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
    const issues = [];
    const add = (condition, code) => {
        if (condition)
            issues.push({ code });
    };
    add(turn.responseWordCount > bounds.maximumResponseWords, "RESPONSE_LENGTH_LIMIT_EXCEEDED");
    add(turn.stepCount > bounds.maximumStepCount, "STEP_COUNT_LIMIT_EXCEEDED");
    add(exceeds(turn.hintDepth, bounds.maximumHintDepth, HINT_DEPTH_ORDER), "HINT_DEPTH_LIMIT_EXCEEDED");
    add(exceeds(turn.instructionalDensity, bounds.maximumInstructionalDensity, DENSITY_ORDER), "INSTRUCTIONAL_DENSITY_LIMIT_EXCEEDED");
    add(exceeds(turn.visualStepComplexity, bounds.maximumVisualStepComplexity, VISUAL_COMPLEXITY_ORDER), "VISUAL_STEP_COMPLEXITY_LIMIT_EXCEEDED");
    const allowedModalities = new Set(bounds.multimodalAllowance.allowedModalities);
    add(turn.modalitiesUsed.some((modality) => !allowedModalities.has(modality)), "MULTIMODALITY_NOT_ALLOWED");
    add(turn.modalitiesUsed.length > bounds.multimodalAllowance.maximumModalitiesPerResponse, "MODALITY_COUNT_LIMIT_EXCEEDED");
    addBreakIssues(issues, profile, turn);
    const reviewThresholdReached = parentReviewThresholdReached(profile, turn);
    add(reviewThresholdReached && !turn.requestsParentReview, "STUDY_PARENT_REVIEW_ROUTE_REQUIRED");
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
export function createLearnerStagePolicyRegistry(profileCandidates, fallbackCandidate) {
    const fallbackValidation = validateExact(ReviewedStaticStageFallbackSchema, fallbackCandidate);
    if (fallbackValidation.status === "rejected") {
        return { status: "rejected", code: "INVALID_STATIC_FALLBACK", profileIndex: null };
    }
    const profilesByRef = new Map();
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
    const resolve = (bindingCandidate) => {
        const validation = validateExact(TrustedStudyLearnerStageBindingSchema, bindingCandidate);
        if (validation.status === "rejected") {
            return fallbackResolution(fallback, "INVALID_LEARNER_STAGE_BINDING");
        }
        const profile = profilesByRef.get(validation.value.policyProfileRef);
        if (!profile) {
            return fallbackResolution(fallback, "UNKNOWN_LEARNER_STAGE_POLICY");
        }
        if (profile.learnerStageRef !== validation.value.learnerStageRef ||
            profile.approvalRef !== validation.value.approvalRef) {
            return fallbackResolution(fallback, "LEARNER_STAGE_POLICY_BINDING_MISMATCH");
        }
        return {
            status: "resolved",
            source: "study-explicit",
            profile: copyProfile(profile),
            authority: CONSTRAINT_AUTHORITY,
        };
    };
    const registry = {
        profileCount: profilesByRef.size,
        resolve,
        evaluate(bindingCandidate, measuredTurnCandidate) {
            const resolution = resolve(bindingCandidate);
            if (resolution.status === "static-fallback")
                return resolution;
            return evaluateResolvedPolicy(resolution.profile, measuredTurnCandidate);
        },
    };
    return { status: "ready", registry };
}
