import { Type } from "../../schema/typebox.js";
import { HintLevelSchema, OpaqueReferenceSchema, } from "../../v2/contracts/primitives.js";
import { validateExact } from "../../v2/contracts/validation.js";
import { BreakSuggestionPolicySchema, InstructionalDensitySchema, MultimodalAllowanceSchema, ParentReviewThresholdSchema, ReviewedStaticStageFallbackSchema, VisualStepComplexitySchema, createLearnerStagePolicyRegistry, } from "./policy.js";
export const LEARNER_STAGE_CATALOG_VERSION = "study-tutor-v2.learner-stage-catalog.v1";
export const LEARNER_STAGE_POLICY_REVISION_REF = "policy-revision:study-learner-stage-foundation-v1";
export const LEARNER_STAGE_CATALOG_APPROVAL_REF = "approval:study-learner-stage-foundation-v1";
export const LEARNER_STAGE_CATALOG_BINDING_VERSION = "study-tutor-v2.learner-stage-catalog-binding.v1";
export const SUPPORTED_LEARNER_STAGE_REFS = [
    "learner-stage:early-elementary",
    "learner-stage:upper-elementary",
    "learner-stage:middle-grades",
    "learner-stage:secondary",
];
// These literals intentionally mirror W3-01's broad routing-stage contract. The
// catalog owns only the reviewed mapping; it does not own provider routing.
export const LEARNER_ROUTING_STAGE_CLASSES = [
    "EARLY_ELEMENTARY",
    "UPPER_ELEMENTARY",
    "MIDDLE_GRADES",
    "SECONDARY",
];
const SupportedLearnerStageRefSchema = Type.Union([
    Type.Literal("learner-stage:early-elementary"),
    Type.Literal("learner-stage:upper-elementary"),
    Type.Literal("learner-stage:middle-grades"),
    Type.Literal("learner-stage:secondary"),
]);
const LearnerRoutingStageClassSchema = Type.Union([
    Type.Literal("EARLY_ELEMENTARY"),
    Type.Literal("UPPER_ELEMENTARY"),
    Type.Literal("MIDDLE_GRADES"),
    Type.Literal("SECONDARY"),
]);
export const ApprovedLearnerStageCatalogProfileSchema = Type.Object({
    catalogVersion: Type.Literal(LEARNER_STAGE_CATALOG_VERSION),
    profileRef: OpaqueReferenceSchema,
    policyRevisionRef: OpaqueReferenceSchema,
    learnerStageRef: SupportedLearnerStageRefSchema,
    approvalRef: OpaqueReferenceSchema,
    maximumResponseWords: Type.Integer({ minimum: 1, maximum: 1_200 }),
    maximumStepCount: Type.Integer({ minimum: 1, maximum: 32 }),
    maximumHintDepth: HintLevelSchema,
    maximumInstructionalDensity: InstructionalDensitySchema,
    maximumVisualStepComplexity: VisualStepComplexitySchema,
    breakPolicy: BreakSuggestionPolicySchema,
    multimodalAllowance: MultimodalAllowanceSchema,
    adultReviewThreshold: ParentReviewThresholdSchema,
}, { additionalProperties: false, $id: "TutorV3ApprovedLearnerStageCatalogProfile" });
export const ApprovedLearnerStageRoutingMappingSchema = Type.Object({
    catalogVersion: Type.Literal(LEARNER_STAGE_CATALOG_VERSION),
    policyRevisionRef: OpaqueReferenceSchema,
    learnerStageRef: SupportedLearnerStageRefSchema,
    routingStageClass: LearnerRoutingStageClassSchema,
}, { additionalProperties: false, $id: "TutorV3ApprovedLearnerStageRoutingMapping" });
export const TrustedStudyLearnerStageCatalogBindingSchema = Type.Object({
    contractVersion: Type.Literal(LEARNER_STAGE_CATALOG_BINDING_VERSION),
    bindingKind: Type.Literal("trusted-study-learner-stage-catalog-binding"),
    bindingSource: Type.Literal("study-runtime"),
    catalogVersion: Type.String({ minLength: 1, maxLength: 160 }),
    policyRevisionRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
}, { additionalProperties: false, $id: "TutorV3TrustedStudyLearnerStageCatalogBinding" });
const CONSTRAINT_AUTHORITY = Object.freeze({
    policyEffect: "constraint-only",
    studyDecisionRequired: true,
    tutorAuthorityGranted: false,
    providerOverrideAllowed: false,
    parentContactAuthorized: false,
});
const REVIEWED_UNKNOWN_STAGE_FALLBACK = Object.freeze({
    contractVersion: "learner-stage-policy.v1",
    fallbackKind: "study-reviewed-static-stage-fallback",
    staticContentRef: "content:study-stage-unknown-static-v1",
    policyRef: "policy:study-stage-unknown-fallback-v1",
    approvalRef: LEARNER_STAGE_CATALOG_APPROVAL_REF,
});
function deepFreeze(value) {
    if (typeof value !== "object" || value === null || Object.isFrozen(value))
        return value;
    for (const nested of Object.values(value)) {
        deepFreeze(nested);
    }
    return Object.freeze(value);
}
function clone(value) {
    return structuredClone(value);
}
const PROFILE_METADATA = {
    catalogVersion: LEARNER_STAGE_CATALOG_VERSION,
    policyRevisionRef: LEARNER_STAGE_POLICY_REVISION_REF,
    approvalRef: LEARNER_STAGE_CATALOG_APPROVAL_REF,
};
const APPROVED_PROFILES = deepFreeze([
    {
        ...PROFILE_METADATA,
        profileRef: "stage-profile:early-elementary-v1",
        learnerStageRef: "learner-stage:early-elementary",
        maximumResponseWords: 60,
        maximumStepCount: 2,
        maximumHintDepth: "nudge",
        maximumInstructionalDensity: "sparse",
        maximumVisualStepComplexity: "single-focus",
        breakPolicy: {
            mode: "bounded",
            minimumCompletedTutorTurns: 4,
            minimumTurnsBetweenSuggestions: 3,
            maximumSuggestionsPerSession: 1,
        },
        multimodalAllowance: {
            allowedModalities: ["text", "image"],
            maximumModalitiesPerResponse: 2,
        },
        adultReviewThreshold: {
            thresholdMode: "either-limit",
            maximumUnresolvedAttempts: 3,
            maximumConsecutiveTutorTurnsWithoutResolution: 5,
        },
    },
    {
        ...PROFILE_METADATA,
        profileRef: "stage-profile:upper-elementary-v1",
        learnerStageRef: "learner-stage:upper-elementary",
        maximumResponseWords: 90,
        maximumStepCount: 3,
        maximumHintDepth: "concept-cue",
        maximumInstructionalDensity: "moderate",
        maximumVisualStepComplexity: "linked-elements",
        breakPolicy: {
            mode: "bounded",
            minimumCompletedTutorTurns: 4,
            minimumTurnsBetweenSuggestions: 3,
            maximumSuggestionsPerSession: 2,
        },
        multimodalAllowance: {
            allowedModalities: ["text", "image", "diagram", "audio"],
            maximumModalitiesPerResponse: 3,
        },
        adultReviewThreshold: {
            thresholdMode: "either-limit",
            maximumUnresolvedAttempts: 4,
            maximumConsecutiveTutorTurnsWithoutResolution: 6,
        },
    },
    {
        ...PROFILE_METADATA,
        profileRef: "stage-profile:middle-grades-v1",
        learnerStageRef: "learner-stage:middle-grades",
        maximumResponseWords: 120,
        maximumStepCount: 4,
        maximumHintDepth: "concept-cue",
        maximumInstructionalDensity: "moderate",
        maximumVisualStepComplexity: "linked-elements",
        breakPolicy: {
            mode: "bounded",
            minimumCompletedTutorTurns: 3,
            minimumTurnsBetweenSuggestions: 2,
            maximumSuggestionsPerSession: 2,
        },
        multimodalAllowance: {
            allowedModalities: ["text", "image", "diagram", "audio"],
            maximumModalitiesPerResponse: 3,
        },
        adultReviewThreshold: {
            thresholdMode: "either-limit",
            maximumUnresolvedAttempts: 5,
            maximumConsecutiveTutorTurnsWithoutResolution: 8,
        },
    },
    {
        ...PROFILE_METADATA,
        profileRef: "stage-profile:secondary-v1",
        learnerStageRef: "learner-stage:secondary",
        maximumResponseWords: 240,
        maximumStepCount: 8,
        maximumHintDepth: "guided-step",
        maximumInstructionalDensity: "dense",
        maximumVisualStepComplexity: "multi-part",
        breakPolicy: {
            mode: "bounded",
            minimumCompletedTutorTurns: 2,
            minimumTurnsBetweenSuggestions: 1,
            maximumSuggestionsPerSession: 3,
        },
        multimodalAllowance: {
            allowedModalities: ["text", "image", "diagram", "audio", "video"],
            maximumModalitiesPerResponse: 5,
        },
        adultReviewThreshold: {
            thresholdMode: "either-limit",
            maximumUnresolvedAttempts: 8,
            maximumConsecutiveTutorTurnsWithoutResolution: 12,
        },
    },
]);
export const APPROVED_LEARNER_STAGE_ROUTING_MAPPING = deepFreeze([
    {
        catalogVersion: LEARNER_STAGE_CATALOG_VERSION,
        policyRevisionRef: LEARNER_STAGE_POLICY_REVISION_REF,
        learnerStageRef: "learner-stage:early-elementary",
        routingStageClass: "EARLY_ELEMENTARY",
    },
    {
        catalogVersion: LEARNER_STAGE_CATALOG_VERSION,
        policyRevisionRef: LEARNER_STAGE_POLICY_REVISION_REF,
        learnerStageRef: "learner-stage:upper-elementary",
        routingStageClass: "UPPER_ELEMENTARY",
    },
    {
        catalogVersion: LEARNER_STAGE_CATALOG_VERSION,
        policyRevisionRef: LEARNER_STAGE_POLICY_REVISION_REF,
        learnerStageRef: "learner-stage:middle-grades",
        routingStageClass: "MIDDLE_GRADES",
    },
    {
        catalogVersion: LEARNER_STAGE_CATALOG_VERSION,
        policyRevisionRef: LEARNER_STAGE_POLICY_REVISION_REF,
        learnerStageRef: "learner-stage:secondary",
        routingStageClass: "SECONDARY",
    },
]);
export function listApprovedLearnerStageCatalogProfiles() {
    return clone(APPROVED_PROFILES);
}
export function getReviewedUnknownLearnerStageFallback() {
    return clone(REVIEWED_UNKNOWN_STAGE_FALLBACK);
}
function profileFingerprint(profile) {
    return JSON.stringify({
        catalogVersion: profile.catalogVersion,
        profileRef: profile.profileRef,
        policyRevisionRef: profile.policyRevisionRef,
        learnerStageRef: profile.learnerStageRef,
        approvalRef: profile.approvalRef,
        maximumResponseWords: profile.maximumResponseWords,
        maximumStepCount: profile.maximumStepCount,
        maximumHintDepth: profile.maximumHintDepth,
        maximumInstructionalDensity: profile.maximumInstructionalDensity,
        maximumVisualStepComplexity: profile.maximumVisualStepComplexity,
        breakPolicy: profile.breakPolicy.mode === "disabled"
            ? { mode: "disabled" }
            : {
                mode: "bounded",
                minimumCompletedTutorTurns: profile.breakPolicy.minimumCompletedTutorTurns,
                minimumTurnsBetweenSuggestions: profile.breakPolicy.minimumTurnsBetweenSuggestions,
                maximumSuggestionsPerSession: profile.breakPolicy.maximumSuggestionsPerSession,
            },
        multimodalAllowance: {
            allowedModalities: profile.multimodalAllowance.allowedModalities,
            maximumModalitiesPerResponse: profile.multimodalAllowance.maximumModalitiesPerResponse,
        },
        adultReviewThreshold: {
            thresholdMode: profile.adultReviewThreshold.thresholdMode,
            maximumUnresolvedAttempts: profile.adultReviewThreshold.maximumUnresolvedAttempts,
            maximumConsecutiveTutorTurnsWithoutResolution: profile.adultReviewThreshold.maximumConsecutiveTutorTurnsWithoutResolution,
        },
    });
}
export function validateApprovedLearnerStageCatalogProfile(candidate) {
    const validation = validateExact(ApprovedLearnerStageCatalogProfileSchema, candidate);
    if (validation.status === "rejected")
        return false;
    const canonical = APPROVED_PROFILES.find((profile) => profile.learnerStageRef === validation.value.learnerStageRef);
    return (canonical !== undefined &&
        profileFingerprint(validation.value) === profileFingerprint(canonical) &&
        validation.value.policyRevisionRef === LEARNER_STAGE_POLICY_REVISION_REF &&
        validation.value.approvalRef === LEARNER_STAGE_CATALOG_APPROVAL_REF &&
        createLearnerStagePolicyRegistry([toPolicyProfile(validation.value)], REVIEWED_UNKNOWN_STAGE_FALLBACK).status === "ready");
}
export function validateApprovedLearnerStageRoutingMapping(candidate) {
    const validation = validateExact(ApprovedLearnerStageRoutingMappingSchema, candidate);
    if (validation.status === "rejected")
        return false;
    return APPROVED_LEARNER_STAGE_ROUTING_MAPPING.some((mapping) => mapping.catalogVersion === validation.value.catalogVersion &&
        mapping.policyRevisionRef === validation.value.policyRevisionRef &&
        mapping.learnerStageRef === validation.value.learnerStageRef &&
        mapping.routingStageClass === validation.value.routingStageClass);
}
function toPolicyProfile(profile) {
    return {
        contractVersion: "learner-stage-policy.v1",
        profileKind: "study-approved-learner-stage-policy",
        policyProfileRef: profile.profileRef,
        learnerStageRef: profile.learnerStageRef,
        approvalRef: profile.approvalRef,
        approvalKind: "study-approved",
        bounds: {
            maximumResponseWords: profile.maximumResponseWords,
            maximumStepCount: profile.maximumStepCount,
            maximumHintDepth: profile.maximumHintDepth,
            maximumInstructionalDensity: profile.maximumInstructionalDensity,
            maximumVisualStepComplexity: profile.maximumVisualStepComplexity,
            breakSuggestionPolicy: clone(profile.breakPolicy),
            multimodalAllowance: clone(profile.multimodalAllowance),
            parentReviewThreshold: clone(profile.adultReviewThreshold),
        },
    };
}
function fallbackResolution(reason) {
    return {
        status: "static-fallback",
        reason,
        fallback: getReviewedUnknownLearnerStageFallback(),
        adaptiveTutorAllowed: false,
        providerInvocationAllowed: false,
        tutorMayProceed: false,
        authority: CONSTRAINT_AUTHORITY,
    };
}
/**
 * Constructs the commercial catalog from committed constants only. This API
 * intentionally accepts no profile or fallback candidates.
 */
export function createCommercialLearnerStagePolicyCatalog() {
    const profiles = listApprovedLearnerStageCatalogProfiles();
    const uniqueProfileRefs = new Set(profiles.map((profile) => profile.profileRef));
    const uniqueStageRefs = new Set(profiles.map((profile) => profile.learnerStageRef));
    const completeProfiles = SUPPORTED_LEARNER_STAGE_REFS.every((stageRef) => uniqueStageRefs.has(stageRef));
    if (!profiles.every(validateApprovedLearnerStageCatalogProfile) ||
        profiles.length !== SUPPORTED_LEARNER_STAGE_REFS.length ||
        uniqueProfileRefs.size !== profiles.length ||
        uniqueStageRefs.size !== profiles.length ||
        !completeProfiles) {
        throw new Error("invalid committed learner-stage catalog");
    }
    const uniqueRoutingStages = new Set(APPROVED_LEARNER_STAGE_ROUTING_MAPPING.map((mapping) => mapping.learnerStageRef));
    if (!APPROVED_LEARNER_STAGE_ROUTING_MAPPING.every(validateApprovedLearnerStageRoutingMapping) ||
        APPROVED_LEARNER_STAGE_ROUTING_MAPPING.length !== SUPPORTED_LEARNER_STAGE_REFS.length ||
        uniqueRoutingStages.size !== SUPPORTED_LEARNER_STAGE_REFS.length ||
        !SUPPORTED_LEARNER_STAGE_REFS.every((stageRef) => uniqueRoutingStages.has(stageRef))) {
        throw new Error("invalid committed learner-stage routing mapping");
    }
    const policyProfiles = profiles.map(toPolicyProfile);
    const policyCreation = createLearnerStagePolicyRegistry(policyProfiles, REVIEWED_UNKNOWN_STAGE_FALLBACK);
    if (policyCreation.status !== "ready") {
        throw new Error(`invalid committed learner-stage policy registry: ${policyCreation.code}`);
    }
    const profilesByStage = new Map(profiles.map((profile) => [profile.learnerStageRef, profile]));
    const routingByStage = new Map(APPROVED_LEARNER_STAGE_ROUTING_MAPPING.map((mapping) => [
        mapping.learnerStageRef,
        mapping.routingStageClass,
    ]));
    const resolve = (bindingCandidate) => {
        const validation = validateExact(TrustedStudyLearnerStageCatalogBindingSchema, bindingCandidate);
        if (validation.status === "rejected") {
            return fallbackResolution("INVALID_LEARNER_STAGE_CATALOG_BINDING");
        }
        const binding = validation.value;
        if (binding.catalogVersion !== LEARNER_STAGE_CATALOG_VERSION) {
            return fallbackResolution("LEARNER_STAGE_CATALOG_VERSION_MISMATCH");
        }
        if (binding.policyRevisionRef !== LEARNER_STAGE_POLICY_REVISION_REF) {
            return fallbackResolution("LEARNER_STAGE_POLICY_REVISION_MISMATCH");
        }
        const profile = profilesByStage.get(binding.learnerStageRef);
        const routingStageClass = routingByStage.get(binding.learnerStageRef);
        if (!profile || !routingStageClass) {
            return fallbackResolution("UNKNOWN_LEARNER_STAGE");
        }
        const policyResolution = policyCreation.registry.resolve({
            contractVersion: "learner-stage-policy.v1",
            bindingKind: "trusted-study-learner-stage-binding",
            bindingSource: "study-runtime",
            policyProfileRef: profile.profileRef,
            learnerStageRef: profile.learnerStageRef,
            approvalRef: profile.approvalRef,
        });
        if (policyResolution.status !== "resolved") {
            throw new Error("committed learner-stage catalog failed internal policy resolution");
        }
        return {
            status: "resolved",
            source: "study-canonical-catalog",
            profile: clone(profile),
            routingStageClass,
            policyProfile: policyResolution.profile,
            authority: policyResolution.authority,
        };
    };
    return Object.freeze({
        catalogVersion: LEARNER_STAGE_CATALOG_VERSION,
        policyRevisionRef: LEARNER_STAGE_POLICY_REVISION_REF,
        profileCount: profiles.length,
        listProfiles: listApprovedLearnerStageCatalogProfiles,
        resolve,
        evaluate(bindingCandidate, measuredTurnCandidate) {
            const resolution = resolve(bindingCandidate);
            if (resolution.status === "static-fallback")
                return resolution;
            const evaluation = policyCreation.registry.evaluate({
                contractVersion: "learner-stage-policy.v1",
                bindingKind: "trusted-study-learner-stage-binding",
                bindingSource: "study-runtime",
                policyProfileRef: resolution.profile.profileRef,
                learnerStageRef: resolution.profile.learnerStageRef,
                approvalRef: resolution.profile.approvalRef,
            }, measuredTurnCandidate);
            return {
                status: "evaluated",
                source: "study-canonical-catalog",
                catalogVersion: LEARNER_STAGE_CATALOG_VERSION,
                profileRef: resolution.profile.profileRef,
                policyRevisionRef: resolution.profile.policyRevisionRef,
                learnerStageRef: resolution.profile.learnerStageRef,
                routingStageClass: resolution.routingStageClass,
                evaluation,
            };
        },
    });
}
// Validate the fallback through the same exact schema used by W3-11.
if (validateExact(ReviewedStaticStageFallbackSchema, REVIEWED_UNKNOWN_STAGE_FALLBACK).status !==
    "accepted") {
    throw new Error("invalid committed learner-stage static fallback");
}
