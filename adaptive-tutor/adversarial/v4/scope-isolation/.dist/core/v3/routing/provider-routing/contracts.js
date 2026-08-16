import { Type } from "../../../schema/typebox.js";
import { OpaqueReferenceSchema } from "../../../v2/contracts/primitives.js";
import { CommercialRouteAttemptPlanSchema, CanonicalIntegerMicrosSchema, ImmutableDigestSchema, } from "../../commercial-operation/index.js";
export const PROVIDER_CAPABILITY_PROFILE_VERSION = "study-tutor-v2.provider-capability-profile.v2";
export const MODEL_CAPABILITY_PROFILE_VERSION = "study-tutor-v2.model-capability-profile.v2";
export const ROUTING_REQUEST_VERSION = "study-tutor-v2.routing-request.v2";
export const ROUTING_DECISION_VERSION = "study-tutor-v2.routing-decision.v2";
export const PROVIDER_AVAILABILITY_STATE_VERSION = "study-tutor-v2.provider-availability-state.v2";
export const ACTION_FAMILIES = [
    "EXPLANATION",
    "HINT",
    "GUIDING_QUESTION",
    "GROUNDED_EXAMPLE",
    "PREREQUISITE_RECOMMENDATION",
    "PARENT_SAFE_DRAFT",
];
export const SUBJECT_CAPABILITIES = [
    "NUMERICAL_REASONING",
    "SYMBOLIC_REASONING",
    "PROSE_EXPLANATION",
    "SOURCE_GROUNDED_ANALYSIS",
    "SPATIAL_VISUAL_INTERPRETATION",
    "MULTILINGUAL_EXPLANATION",
];
export const LEARNER_STAGES = [
    "EARLY_ELEMENTARY",
    "UPPER_ELEMENTARY",
    "MIDDLE_GRADES",
    "SECONDARY",
];
export const SAFETY_REQUIREMENTS = ["MINOR_STANDARD", "MINOR_HEIGHTENED"];
export const MULTIMODAL_REQUIREMENTS = ["TEXT_ONLY", "REVIEWED_IMAGE"];
export const REVIEWED_CONTENT_REQUIREMENTS = [
    "NOT_REQUIRED",
    "PROVIDER_REVIEWED_GROUNDING_REQUIRED",
    "STATIC_REVIEWED_ONLY",
];
export const PROVIDER_CLASSES = [
    "STANDARD",
    "ZERO_RETENTION",
    "REGION_PINNED",
];
export const MODEL_CLASSES = [
    "FAST_TEXT",
    "BALANCED_TEXT",
    "REASONING_TEXT",
    "BALANCED_MULTIMODAL",
];
export const PROFILE_LIFECYCLES = ["ACTIVE", "DISABLED", "RETIRED"];
export const PROVIDER_AVAILABILITY_CODES = [
    "AVAILABLE",
    "DEGRADED",
    "OUTAGE",
    "MAINTENANCE",
    "DISABLED",
    "UNKNOWN",
];
export const ROUTING_REASON_CODES = [
    "INVALID_ROUTING_CONTRACT",
    "STUDY_PERMISSION_MISMATCH",
    "STATIC_REVIEWED_ONLY",
    "PROVIDER_MODEL_BINDING_MISMATCH",
    "CAPABILITY_MISMATCH",
    "LEARNER_STAGE_MISMATCH",
    "CONTEXT_SIZE_MISMATCH",
    "SAFETY_MISMATCH",
    "MULTIMODAL_MISMATCH",
    "REVIEWED_CONTENT_MISMATCH",
    "PROVIDER_POLICY_INELIGIBLE",
    "PROVIDER_UNAVAILABLE",
    "COST_CEILING_EXCEEDED",
    "LATENCY_CEILING_EXCEEDED",
    "PRIMARY_ROUTE_SELECTED",
    "FALLBACK_ROUTE_SELECTED",
    "NO_ELIGIBLE_PROVIDER_ROUTE",
];
function literals(values) {
    return Type.Union(values.map((value) => Type.Literal(value)));
}
const SafeNonNegativeIntegerSchema = Type.Integer({
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
});
const PositiveIntegerSchema = Type.Integer({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
});
const ActionFamilySchema = literals(ACTION_FAMILIES);
const SubjectCapabilitySchema = literals(SUBJECT_CAPABILITIES);
const LearnerStageSchema = literals(LEARNER_STAGES);
const SafetyRequirementSchema = literals(SAFETY_REQUIREMENTS);
const MultimodalRequirementSchema = literals(MULTIMODAL_REQUIREMENTS);
const ReviewedContentRequirementSchema = literals(REVIEWED_CONTENT_REQUIREMENTS);
const ProviderClassSchema = literals(PROVIDER_CLASSES);
const ModelClassSchema = literals(MODEL_CLASSES);
const ProfileLifecycleSchema = literals(PROFILE_LIFECYCLES);
const ProviderAvailabilityCodeSchema = literals(PROVIDER_AVAILABILITY_CODES);
const RoutingReasonCodeSchema = literals(ROUTING_REASON_CODES);
export const ProviderCapabilityProfileSchema = Type.Object({
    profileVersion: Type.Literal(PROVIDER_CAPABILITY_PROFILE_VERSION),
    providerRef: OpaqueReferenceSchema,
    providerClass: ProviderClassSchema,
    lifecycle: ProfileLifecycleSchema,
    modelRefs: Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 32 }),
    minimumTimeoutMs: PositiveIntegerSchema,
    maximumTimeoutMs: PositiveIntegerSchema,
}, { additionalProperties: false, $id: "TutorV2ProviderCapabilityProfile" });
export const ModelCapabilityProfileSchema = Type.Object({
    profileVersion: Type.Literal(MODEL_CAPABILITY_PROFILE_VERSION),
    modelRef: OpaqueReferenceSchema,
    modelRevisionRef: OpaqueReferenceSchema,
    configurationDigest: ImmutableDigestSchema,
    capabilityProfileRevisionRef: OpaqueReferenceSchema,
    capabilityProfileDigest: ImmutableDigestSchema,
    modelClass: ModelClassSchema,
    providerRef: OpaqueReferenceSchema,
    routeRef: OpaqueReferenceSchema,
    lifecycle: ProfileLifecycleSchema,
    actionFamilies: Type.Array(ActionFamilySchema, { minItems: 1, maxItems: 6 }),
    subjectCapabilities: Type.Array(SubjectCapabilitySchema, { minItems: 1, maxItems: 6 }),
    learnerStages: Type.Array(LearnerStageSchema, { minItems: 1, maxItems: 4 }),
    safetyCapabilities: Type.Array(SafetyRequirementSchema, { minItems: 1, maxItems: 2 }),
    multimodalCapabilities: Type.Array(MultimodalRequirementSchema, {
        minItems: 1,
        maxItems: 2,
    }),
    reviewedContentSupport: Type.Union([
        Type.Literal("NONE"),
        Type.Literal("PROVIDED_REVIEWED_GROUNDING"),
    ]),
    maximumContextTokens: PositiveIntegerSchema,
    maximumOutputTokens: PositiveIntegerSchema,
    estimatedLatencyMs: PositiveIntegerSchema,
    attemptTimeoutMs: PositiveIntegerSchema,
    worstCaseCostMicros: CanonicalIntegerMicrosSchema,
}, { additionalProperties: false, $id: "TutorV2ModelCapabilityProfile" });
export const ProviderAvailabilityStateSchema = Type.Object({
    stateVersion: Type.Literal(PROVIDER_AVAILABILITY_STATE_VERSION),
    availabilityRef: OpaqueReferenceSchema,
    providerRef: OpaqueReferenceSchema,
    modelRef: OpaqueReferenceSchema,
    modelRevisionRef: OpaqueReferenceSchema,
    state: ProviderAvailabilityCodeSchema,
}, { additionalProperties: false, $id: "TutorV2ProviderAvailabilityState" });
export const StudyPermissionBoundarySchema = Type.Object({
    permissionRef: OpaqueReferenceSchema,
    authorizedActionFamily: ActionFamilySchema,
    routingMayWidenPermissions: Type.Literal(false),
    routingMayChangeMastery: Type.Literal(false),
    routingMayChangeGrade: Type.Literal(false),
    routingMayChangeWorkingLevel: Type.Literal(false),
    routingMayChangeCurriculum: Type.Literal(false),
}, { additionalProperties: false });
export const RoutingRequestSchema = Type.Object({
    requestVersion: Type.Literal(ROUTING_REQUEST_VERSION),
    requestRef: OpaqueReferenceSchema,
    routePlanRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    physicalAttemptRefs: Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 2 }),
    actionFamily: ActionFamilySchema,
    subjectCapability: SubjectCapabilitySchema,
    learnerStage: LearnerStageSchema,
    contextSizeRequirement: Type.Object({
        inputTokens: SafeNonNegativeIntegerSchema,
        requiredOutputTokens: PositiveIntegerSchema,
    }, { additionalProperties: false }),
    safetyRequirement: SafetyRequirementSchema,
    latencyCeilingMs: PositiveIntegerSchema,
    costCeilingMicros: CanonicalIntegerMicrosSchema,
    reviewedContentRequirement: ReviewedContentRequirementSchema,
    multimodalRequirement: MultimodalRequirementSchema,
    providerAvailability: Type.Array(ProviderAvailabilityStateSchema, {
        minItems: 1,
        maxItems: 64,
    }),
    studyPermissionBoundary: StudyPermissionBoundarySchema,
    staticFallbackPolicyRef: OpaqueReferenceSchema,
}, { additionalProperties: false, $id: "TutorV2RoutingRequest" });
const RoutingAuthorityBoundarySchema = Type.Object({
    scope: Type.Literal("ROUTING_ONLY"),
    permissionRef: OpaqueReferenceSchema,
    actionFamily: ActionFamilySchema,
    permissionsWidened: Type.Literal(false),
    masteryChanged: Type.Literal(false),
    gradeChanged: Type.Literal(false),
    workingLevelChanged: Type.Literal(false),
    curriculumChanged: Type.Literal(false),
}, { additionalProperties: false });
const DecisionCommonProperties = {
    decisionVersion: Type.Literal(ROUTING_DECISION_VERSION),
    requestRef: OpaqueReferenceSchema,
    retryCount: Type.Literal(0),
    staticFallbackPolicyRef: OpaqueReferenceSchema,
    authorityBoundary: RoutingAuthorityBoundarySchema,
    reasonCodes: Type.Array(RoutingReasonCodeSchema, { minItems: 1, maxItems: 17 }),
};
const SelectedRoutingDecisionSchema = Type.Object({
    ...DecisionCommonProperties,
    status: Type.Literal("ROUTE_SELECTED"),
    routeAttemptPlan: CommercialRouteAttemptPlanSchema,
    reservedCostMicros: CanonicalIntegerMicrosSchema,
    staticReviewedFallbackRequirement: Type.Literal("REQUIRED_ON_ROUTE_FAILURE"),
}, { additionalProperties: false });
const NoEligibleRoutingDecisionSchema = Type.Object({
    ...DecisionCommonProperties,
    status: Type.Literal("NO_ELIGIBLE_PROVIDER_ROUTE"),
    providerClass: Type.Null(),
    providerRef: Type.Null(),
    modelClass: Type.Null(),
    modelRef: Type.Null(),
    routeRef: Type.Null(),
    maxOutputTokens: Type.Literal(0),
    timeoutMs: Type.Literal(0),
    fallbackProviderClass: Type.Null(),
    fallbackProviderRef: Type.Null(),
    fallbackModelClass: Type.Null(),
    fallbackModelRef: Type.Null(),
    fallbackRouteRef: Type.Null(),
    fallbackMaxOutputTokens: Type.Literal(0),
    fallbackTimeoutMs: Type.Literal(0),
    reservedCostMicros: Type.Literal("0"),
    staticReviewedFallbackRequirement: Type.Literal("REQUIRED_IMMEDIATELY"),
}, { additionalProperties: false });
export const RoutingDecisionSchema = Type.Union([SelectedRoutingDecisionSchema, NoEligibleRoutingDecisionSchema], { $id: "TutorV2RoutingDecision" });
