import { Type } from "../../../schema/typebox.js";
import { OpaqueReferenceSchema } from "../../../v2/contracts/primitives.js";

export const PROVIDER_CAPABILITY_PROFILE_VERSION =
  "study-tutor-v2.provider-capability-profile.v1" as const;
export const MODEL_CAPABILITY_PROFILE_VERSION =
  "study-tutor-v2.model-capability-profile.v1" as const;
export const ROUTING_REQUEST_VERSION = "study-tutor-v2.routing-request.v1" as const;
export const ROUTING_DECISION_VERSION = "study-tutor-v2.routing-decision.v1" as const;
export const PROVIDER_AVAILABILITY_STATE_VERSION =
  "study-tutor-v2.provider-availability-state.v1" as const;

export const ACTION_FAMILIES = [
  "EXPLANATION",
  "HINT",
  "GUIDING_QUESTION",
  "GROUNDED_EXAMPLE",
  "PREREQUISITE_RECOMMENDATION",
  "PARENT_SAFE_DRAFT",
] as const;
export type ActionFamily = (typeof ACTION_FAMILIES)[number];

export const SUBJECT_CAPABILITIES = [
  "NUMERICAL_REASONING",
  "SYMBOLIC_REASONING",
  "PROSE_EXPLANATION",
  "SOURCE_GROUNDED_ANALYSIS",
  "SPATIAL_VISUAL_INTERPRETATION",
  "MULTILINGUAL_EXPLANATION",
] as const;
export type SubjectCapability = (typeof SUBJECT_CAPABILITIES)[number];

export const LEARNER_STAGES = [
  "EARLY_ELEMENTARY",
  "UPPER_ELEMENTARY",
  "MIDDLE_GRADES",
  "SECONDARY",
] as const;
export type LearnerStage = (typeof LEARNER_STAGES)[number];

export const SAFETY_REQUIREMENTS = ["MINOR_STANDARD", "MINOR_HEIGHTENED"] as const;
export type SafetyRequirement = (typeof SAFETY_REQUIREMENTS)[number];

export const MULTIMODAL_REQUIREMENTS = ["TEXT_ONLY", "REVIEWED_IMAGE"] as const;
export type MultimodalRequirement = (typeof MULTIMODAL_REQUIREMENTS)[number];

export const REVIEWED_CONTENT_REQUIREMENTS = [
  "NOT_REQUIRED",
  "PROVIDER_REVIEWED_GROUNDING_REQUIRED",
  "STATIC_REVIEWED_ONLY",
] as const;
export type ReviewedContentRequirement = (typeof REVIEWED_CONTENT_REQUIREMENTS)[number];

export const PROVIDER_CLASSES = [
  "STANDARD",
  "ZERO_RETENTION",
  "REGION_PINNED",
] as const;
export type ProviderClass = (typeof PROVIDER_CLASSES)[number];

export const MODEL_CLASSES = [
  "FAST_TEXT",
  "BALANCED_TEXT",
  "REASONING_TEXT",
  "BALANCED_MULTIMODAL",
] as const;
export type ModelClass = (typeof MODEL_CLASSES)[number];

export const PROFILE_LIFECYCLES = ["ACTIVE", "DISABLED", "RETIRED"] as const;
export type ProfileLifecycle = (typeof PROFILE_LIFECYCLES)[number];

export const PROVIDER_AVAILABILITY_CODES = [
  "AVAILABLE",
  "DEGRADED",
  "OUTAGE",
  "MAINTENANCE",
  "DISABLED",
  "UNKNOWN",
] as const;
export type ProviderAvailabilityCode = (typeof PROVIDER_AVAILABILITY_CODES)[number];

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
] as const;
export type RoutingReasonCode = (typeof ROUTING_REASON_CODES)[number];

export interface ProviderCapabilityProfile {
  readonly profileVersion: typeof PROVIDER_CAPABILITY_PROFILE_VERSION;
  readonly providerRef: string;
  readonly providerClass: ProviderClass;
  readonly lifecycle: ProfileLifecycle;
  readonly providerPolicyEligibilityRefs: readonly string[];
  readonly modelRefs: readonly string[];
  readonly minimumTimeoutMs: number;
  readonly maximumTimeoutMs: number;
}

export interface ModelCapabilityProfile {
  readonly profileVersion: typeof MODEL_CAPABILITY_PROFILE_VERSION;
  readonly modelRef: string;
  readonly modelClass: ModelClass;
  readonly providerRef: string;
  readonly routeRef: string;
  readonly lifecycle: ProfileLifecycle;
  readonly actionFamilies: readonly ActionFamily[];
  readonly subjectCapabilities: readonly SubjectCapability[];
  readonly learnerStages: readonly LearnerStage[];
  readonly safetyCapabilities: readonly SafetyRequirement[];
  readonly multimodalCapabilities: readonly MultimodalRequirement[];
  readonly reviewedContentSupport: "NONE" | "PROVIDED_REVIEWED_GROUNDING";
  readonly maximumContextTokens: number;
  readonly maximumOutputTokens: number;
  readonly estimatedLatencyMs: number;
  readonly attemptTimeoutMs: number;
  readonly worstCaseCostMicros: string;
}

export interface ProviderAvailabilityState {
  readonly stateVersion: typeof PROVIDER_AVAILABILITY_STATE_VERSION;
  readonly availabilityRef: string;
  readonly providerRef: string;
  readonly modelRef: string;
  readonly state: ProviderAvailabilityCode;
}

export interface StudyPermissionBoundary {
  readonly permissionRef: string;
  readonly authorizedActionFamily: ActionFamily;
  readonly routingMayWidenPermissions: false;
  readonly routingMayChangeMastery: false;
  readonly routingMayChangeGrade: false;
  readonly routingMayChangeWorkingLevel: false;
  readonly routingMayChangeCurriculum: false;
}

export interface RoutingRequest {
  readonly requestVersion: typeof ROUTING_REQUEST_VERSION;
  readonly requestRef: string;
  readonly actionFamily: ActionFamily;
  readonly subjectCapability: SubjectCapability;
  readonly learnerStage: LearnerStage;
  readonly contextSizeRequirement: {
    readonly inputTokens: number;
    readonly requiredOutputTokens: number;
  };
  readonly safetyRequirement: SafetyRequirement;
  readonly latencyCeilingMs: number;
  readonly costCeilingMicros: string;
  readonly reviewedContentRequirement: ReviewedContentRequirement;
  readonly multimodalRequirement: MultimodalRequirement;
  readonly providerAvailability: readonly ProviderAvailabilityState[];
  readonly providerPolicyEligibilityRef: string;
  readonly studyPermissionBoundary: StudyPermissionBoundary;
  readonly staticFallbackPolicyRef: string;
}

export interface RoutingAuthorityBoundary {
  readonly scope: "ROUTING_ONLY";
  readonly permissionRef: string;
  readonly actionFamily: ActionFamily;
  readonly permissionsWidened: false;
  readonly masteryChanged: false;
  readonly gradeChanged: false;
  readonly workingLevelChanged: false;
  readonly curriculumChanged: false;
}

interface RoutingDecisionBase {
  readonly decisionVersion: typeof ROUTING_DECISION_VERSION;
  readonly requestRef: string;
  readonly retryCount: 0;
  readonly staticFallbackPolicyRef: string;
  readonly authorityBoundary: RoutingAuthorityBoundary;
  readonly reasonCodes: readonly RoutingReasonCode[];
}

export interface SelectedRoutingDecision extends RoutingDecisionBase {
  readonly status: "ROUTE_SELECTED";
  readonly providerClass: ProviderClass;
  readonly providerRef: string;
  readonly modelClass: ModelClass;
  readonly modelRef: string;
  readonly routeRef: string;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  readonly fallbackProviderClass: ProviderClass | null;
  readonly fallbackProviderRef: string | null;
  readonly fallbackModelClass: ModelClass | null;
  readonly fallbackModelRef: string | null;
  readonly fallbackRouteRef: string | null;
  readonly fallbackMaxOutputTokens: number;
  readonly fallbackTimeoutMs: number;
  readonly reservedCostMicros: string;
  readonly staticReviewedFallbackRequirement: "REQUIRED_ON_ROUTE_FAILURE";
}

export interface NoEligibleRoutingDecision extends RoutingDecisionBase {
  readonly status: "NO_ELIGIBLE_PROVIDER_ROUTE";
  readonly providerClass: null;
  readonly providerRef: null;
  readonly modelClass: null;
  readonly modelRef: null;
  readonly routeRef: null;
  readonly maxOutputTokens: 0;
  readonly timeoutMs: 0;
  readonly fallbackProviderClass: null;
  readonly fallbackProviderRef: null;
  readonly fallbackModelClass: null;
  readonly fallbackModelRef: null;
  readonly fallbackRouteRef: null;
  readonly fallbackMaxOutputTokens: 0;
  readonly fallbackTimeoutMs: 0;
  readonly reservedCostMicros: "0";
  readonly staticReviewedFallbackRequirement: "REQUIRED_IMMEDIATELY";
}

export type RoutingDecision = SelectedRoutingDecision | NoEligibleRoutingDecision;

function literals(values: readonly string[]) {
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
const CanonicalIntegerMicrosSchema = Type.String({
  minLength: 1,
  maxLength: 30,
  pattern: "^(0|[1-9][0-9]*)$",
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

export const ProviderCapabilityProfileSchema = Type.Object(
  {
    profileVersion: Type.Literal(PROVIDER_CAPABILITY_PROFILE_VERSION),
    providerRef: OpaqueReferenceSchema,
    providerClass: ProviderClassSchema,
    lifecycle: ProfileLifecycleSchema,
    providerPolicyEligibilityRefs: Type.Array(OpaqueReferenceSchema, {
      minItems: 1,
      maxItems: 16,
    }),
    modelRefs: Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 32 }),
    minimumTimeoutMs: PositiveIntegerSchema,
    maximumTimeoutMs: PositiveIntegerSchema,
  },
  { additionalProperties: false, $id: "TutorV2ProviderCapabilityProfile" },
);

export const ModelCapabilityProfileSchema = Type.Object(
  {
    profileVersion: Type.Literal(MODEL_CAPABILITY_PROFILE_VERSION),
    modelRef: OpaqueReferenceSchema,
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
  },
  { additionalProperties: false, $id: "TutorV2ModelCapabilityProfile" },
);

export const ProviderAvailabilityStateSchema = Type.Object(
  {
    stateVersion: Type.Literal(PROVIDER_AVAILABILITY_STATE_VERSION),
    availabilityRef: OpaqueReferenceSchema,
    providerRef: OpaqueReferenceSchema,
    modelRef: OpaqueReferenceSchema,
    state: ProviderAvailabilityCodeSchema,
  },
  { additionalProperties: false, $id: "TutorV2ProviderAvailabilityState" },
);

export const StudyPermissionBoundarySchema = Type.Object(
  {
    permissionRef: OpaqueReferenceSchema,
    authorizedActionFamily: ActionFamilySchema,
    routingMayWidenPermissions: Type.Literal(false),
    routingMayChangeMastery: Type.Literal(false),
    routingMayChangeGrade: Type.Literal(false),
    routingMayChangeWorkingLevel: Type.Literal(false),
    routingMayChangeCurriculum: Type.Literal(false),
  },
  { additionalProperties: false },
);

export const RoutingRequestSchema = Type.Object(
  {
    requestVersion: Type.Literal(ROUTING_REQUEST_VERSION),
    requestRef: OpaqueReferenceSchema,
    actionFamily: ActionFamilySchema,
    subjectCapability: SubjectCapabilitySchema,
    learnerStage: LearnerStageSchema,
    contextSizeRequirement: Type.Object(
      {
        inputTokens: SafeNonNegativeIntegerSchema,
        requiredOutputTokens: PositiveIntegerSchema,
      },
      { additionalProperties: false },
    ),
    safetyRequirement: SafetyRequirementSchema,
    latencyCeilingMs: PositiveIntegerSchema,
    costCeilingMicros: CanonicalIntegerMicrosSchema,
    reviewedContentRequirement: ReviewedContentRequirementSchema,
    multimodalRequirement: MultimodalRequirementSchema,
    providerAvailability: Type.Array(ProviderAvailabilityStateSchema, {
      minItems: 1,
      maxItems: 64,
    }),
    providerPolicyEligibilityRef: OpaqueReferenceSchema,
    studyPermissionBoundary: StudyPermissionBoundarySchema,
    staticFallbackPolicyRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV2RoutingRequest" },
);

const RoutingAuthorityBoundarySchema = Type.Object(
  {
    scope: Type.Literal("ROUTING_ONLY"),
    permissionRef: OpaqueReferenceSchema,
    actionFamily: ActionFamilySchema,
    permissionsWidened: Type.Literal(false),
    masteryChanged: Type.Literal(false),
    gradeChanged: Type.Literal(false),
    workingLevelChanged: Type.Literal(false),
    curriculumChanged: Type.Literal(false),
  },
  { additionalProperties: false },
);

const DecisionCommonProperties = {
  decisionVersion: Type.Literal(ROUTING_DECISION_VERSION),
  requestRef: OpaqueReferenceSchema,
  retryCount: Type.Literal(0),
  staticFallbackPolicyRef: OpaqueReferenceSchema,
  authorityBoundary: RoutingAuthorityBoundarySchema,
  reasonCodes: Type.Array(RoutingReasonCodeSchema, { minItems: 1, maxItems: 17 }),
} as const;

const SelectedRoutingDecisionSchema = Type.Object(
  {
    ...DecisionCommonProperties,
    status: Type.Literal("ROUTE_SELECTED"),
    providerClass: ProviderClassSchema,
    providerRef: OpaqueReferenceSchema,
    modelClass: ModelClassSchema,
    modelRef: OpaqueReferenceSchema,
    routeRef: OpaqueReferenceSchema,
    maxOutputTokens: PositiveIntegerSchema,
    timeoutMs: PositiveIntegerSchema,
    fallbackProviderClass: Type.Union([ProviderClassSchema, Type.Null()]),
    fallbackProviderRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
    fallbackModelClass: Type.Union([ModelClassSchema, Type.Null()]),
    fallbackModelRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
    fallbackRouteRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
    fallbackMaxOutputTokens: SafeNonNegativeIntegerSchema,
    fallbackTimeoutMs: SafeNonNegativeIntegerSchema,
    reservedCostMicros: CanonicalIntegerMicrosSchema,
    staticReviewedFallbackRequirement: Type.Literal("REQUIRED_ON_ROUTE_FAILURE"),
  },
  { additionalProperties: false },
);

const NoEligibleRoutingDecisionSchema = Type.Object(
  {
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
  },
  { additionalProperties: false },
);

export const RoutingDecisionSchema = Type.Union(
  [SelectedRoutingDecisionSchema, NoEligibleRoutingDecisionSchema],
  { $id: "TutorV2RoutingDecision" },
);
