import { Type, type Static } from "../../schema/typebox.js";
import { OpaqueReferenceSchema } from "../../v2/contracts/primitives.js";

export const COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION =
  "study-tutor-v3.commercial-route-attempt-plan.v1" as const;

/** Signed 64-bit positive range shared by routing, reservations, and telemetry. */
export const MAX_CANONICAL_INTEGER_MICROS = 9_223_372_036_854_775_807n;

export const CanonicalIntegerMicrosSchema = Type.String({
  pattern: "^(0|[1-9][0-9]*)$",
  minLength: 1,
  maxLength: 19,
});
export type CanonicalIntegerMicros = Static<typeof CanonicalIntegerMicrosSchema>;

export const ImmutableDigestSchema = Type.String({
  pattern: "^sha256:[a-f0-9]{64}$",
  minLength: 71,
  maxLength: 71,
});

export const CommercialAttemptSchema = Type.Object(
  {
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
  },
  { additionalProperties: false, $id: "TutorV3CommercialAttempt" },
);
export type CommercialAttempt = Static<typeof CommercialAttemptSchema>;

export const CommercialRouteAttemptPlanSchema = Type.Object(
  {
    contractVersion: Type.Literal(COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION),
    routePlanRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    attempts: Type.Array(CommercialAttemptSchema, { minItems: 1, maxItems: 2 }),
    totalReservedCostMicros: CanonicalIntegerMicrosSchema,
  },
  { additionalProperties: false, $id: "TutorV3CommercialRouteAttemptPlan" },
);
export type CommercialRouteAttemptPlan = Static<
  typeof CommercialRouteAttemptPlanSchema
>;
