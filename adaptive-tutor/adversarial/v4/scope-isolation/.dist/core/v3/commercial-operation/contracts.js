import { Type } from "../../schema/typebox.js";
import { OpaqueReferenceSchema } from "../../v2/contracts/primitives.js";
export const COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION = "study-tutor-v3.commercial-route-attempt-plan.v1";
export const COMMERCIAL_ATTEMPT_USAGE_RECEIPT_VERSION = "study-tutor-v3.commercial-attempt-usage-receipt.v1";
export const COMMERCIAL_EXECUTION_SCOPE_VERSION = "study-tutor-v3.commercial-execution-scope.v1";
/** Signed 64-bit positive range shared by routing, reservations, and telemetry. */
export const MAX_CANONICAL_INTEGER_MICROS = 9223372036854775807n;
export const CanonicalIntegerMicrosSchema = Type.String({
    pattern: "^(0|[1-9][0-9]*)$",
    minLength: 1,
    maxLength: 19,
});
export const ImmutableDigestSchema = Type.String({
    pattern: "^sha256:[a-f0-9]{64}$",
    minLength: 71,
    maxLength: 71,
});
const BoundedLineageIdentifierSchema = Type.String({
    minLength: 1,
    maxLength: 160,
    pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
});
/**
 * The single Study-issued authority scope for one commercial operation. It
 * binds learner/session lineage and the caller-owned execution identities that
 * routing is allowed to use; downstream objects carry its opaque scopeRef.
 */
export const CommercialExecutionScopeSchema = Type.Object({
    scopeVersion: Type.Literal(COMMERCIAL_EXECUTION_SCOPE_VERSION),
    scopeKind: Type.Literal("trusted-study-commercial-execution-scope"),
    issuedBy: Type.Literal("study-engine"),
    scopeRef: OpaqueReferenceSchema,
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    interactionRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    curriculumReleaseRef: BoundedLineageIdentifierSchema,
    curriculumPackageRef: OpaqueReferenceSchema,
    curriculumCourseRef: BoundedLineageIdentifierSchema,
    curriculumSubjectRef: BoundedLineageIdentifierSchema,
    curriculumUnitRef: BoundedLineageIdentifierSchema,
    curriculumLessonRef: BoundedLineageIdentifierSchema,
    conceptRef: OpaqueReferenceSchema,
    opportunityRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    presentationRef: OpaqueReferenceSchema,
    routingRequestRef: OpaqueReferenceSchema,
    routePlanRef: OpaqueReferenceSchema,
    reservationRef: OpaqueReferenceSchema,
    physicalAttemptRefs: Type.Array(OpaqueReferenceSchema, {
        minItems: 1,
        maxItems: 2,
        uniqueItems: true,
    }),
    allowedRouteRefs: Type.Array(OpaqueReferenceSchema, {
        minItems: 1,
        maxItems: 64,
        uniqueItems: true,
    }),
    telemetryEventRefs: Type.Array(OpaqueReferenceSchema, {
        minItems: 1,
        maxItems: 2,
        uniqueItems: true,
    }),
}, { additionalProperties: false, $id: "TutorV3CommercialExecutionScope" });
export const CommercialAttemptSchema = Type.Object({
    commercialScopeRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    physicalAttemptRef: OpaqueReferenceSchema,
    attemptIndex: Type.Union([Type.Literal(0), Type.Literal(1)]),
    role: Type.Union([Type.Literal("primary"), Type.Literal("failover")]),
    routeRef: OpaqueReferenceSchema,
    providerRef: OpaqueReferenceSchema,
    modelRef: OpaqueReferenceSchema,
    modelRevisionRef: OpaqueReferenceSchema,
    configurationDigest: ImmutableDigestSchema,
    capabilityProfileRevisionRef: OpaqueReferenceSchema,
    capabilityProfileDigest: ImmutableDigestSchema,
    providerPolicyRevisionRef: OpaqueReferenceSchema,
    providerPolicyEvidenceRef: OpaqueReferenceSchema,
    reservedCostMicros: CanonicalIntegerMicrosSchema,
    timeoutMs: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
}, { additionalProperties: false, $id: "TutorV3CommercialAttempt" });
/** Trusted transport settlement identity for one physical provider execution. */
export const CommercialAttemptUsageReceiptSchema = Type.Object({
    contractVersion: Type.Literal(COMMERCIAL_ATTEMPT_USAGE_RECEIPT_VERSION),
    receiptKind: Type.Literal("commercial-attempt-usage-receipt"),
    commercialScopeRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    physicalAttemptRef: OpaqueReferenceSchema,
    reservationRef: OpaqueReferenceSchema,
    routeRef: OpaqueReferenceSchema,
    providerRef: OpaqueReferenceSchema,
    modelRef: OpaqueReferenceSchema,
    modelRevisionRef: OpaqueReferenceSchema,
    configurationDigest: ImmutableDigestSchema,
    capabilityProfileRevisionRef: OpaqueReferenceSchema,
    capabilityProfileDigest: ImmutableDigestSchema,
    providerPolicyRevisionRef: OpaqueReferenceSchema,
    providerPolicyEvidenceRef: OpaqueReferenceSchema,
    attemptIndex: Type.Union([Type.Literal(0), Type.Literal(1)]),
    role: Type.Union([Type.Literal("primary"), Type.Literal("failover")]),
    reservedCostMicros: CanonicalIntegerMicrosSchema,
    actualCostMicros: CanonicalIntegerMicrosSchema,
}, { additionalProperties: false, $id: "TutorV3CommercialAttemptUsageReceipt" });
export const CommercialRouteAttemptPlanSchema = Type.Object({
    contractVersion: Type.Literal(COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION),
    routePlanRef: OpaqueReferenceSchema,
    commercialScopeRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    attempts: Type.Array(CommercialAttemptSchema, { minItems: 1, maxItems: 2 }),
    totalReservedCostMicros: CanonicalIntegerMicrosSchema,
}, { additionalProperties: false, $id: "TutorV3CommercialRouteAttemptPlan" });
