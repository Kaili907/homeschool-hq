import { Type, type Static } from "../../schema/typebox.js";
import {
  CanonicalIntegerMicrosSchema,
  CommercialAttemptSchema,
  ImmutableDigestSchema,
  type CommercialAttempt,
} from "../commercial-operation/index.js";
import {
  BudgetReservationSchema,
  type BudgetReservation,
} from "../routing/budget-resilience/index.js";

export const TUTOR_COMMERCIAL_TELEMETRY_CONTRACT_VERSION = "3.1.0" as const;

export const TELEMETRY_ACTION_FAMILIES = [
  "explanation",
  "hint",
  "knowledge-check",
  "example",
  "reteach",
  "prerequisite",
  "break",
  "escalation",
  "lesson-return",
  "other",
  "none",
] as const;
export type TelemetryActionFamily = (typeof TELEMETRY_ACTION_FAMILIES)[number];

export const TELEMETRY_ROUTE_CLASSES = [
  "local",
  "hosted-standard",
  "hosted-premium",
  "fallback",
  "unknown",
] as const;
export type TelemetryRouteClass = (typeof TELEMETRY_ROUTE_CLASSES)[number];

export const TELEMETRY_CACHE_CLASSES = [
  "hit",
  "miss",
  "bypass",
  "not-applicable",
  "unknown",
] as const;
export type TelemetryCacheClass = (typeof TELEMETRY_CACHE_CLASSES)[number];

export const TELEMETRY_FALLBACK_CLASSES = [
  "none",
  "reviewed-static",
  "alternate-provider",
  "reduced-capability",
  "blocked",
  "unknown",
] as const;
export type TelemetryFallbackClass = (typeof TELEMETRY_FALLBACK_CLASSES)[number];

export const TELEMETRY_FAILURE_REASON_CODES = [
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "MALFORMED_RESPONSE",
  "POLICY_REJECTION",
  "SAFETY_STOP",
  "BUDGET_EXCEEDED",
  "CANCELLED",
  "INTERNAL_ERROR",
  "UNKNOWN_FAILURE",
] as const;
export type TelemetryFailureReasonCode = (typeof TELEMETRY_FAILURE_REASON_CODES)[number];
export type TelemetryReasonCode = "COMPLETED" | TelemetryFailureReasonCode;

const OpaqueReferenceSchema = Type.String({
  minLength: 3,
  maxLength: 160,
  pattern: "^[a-z][a-z0-9-]{1,31}:[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$",
});

const SafeCounterSchema = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });

const TelemetryActionFamilySchema = Type.Union([
  Type.Literal("explanation"),
  Type.Literal("hint"),
  Type.Literal("knowledge-check"),
  Type.Literal("example"),
  Type.Literal("reteach"),
  Type.Literal("prerequisite"),
  Type.Literal("break"),
  Type.Literal("escalation"),
  Type.Literal("lesson-return"),
  Type.Literal("other"),
  Type.Literal("none"),
]);

const TelemetryRouteClassSchema = Type.Union([
  Type.Literal("local"),
  Type.Literal("hosted-standard"),
  Type.Literal("hosted-premium"),
  Type.Literal("fallback"),
  Type.Literal("unknown"),
]);

const TelemetryCacheClassSchema = Type.Union([
  Type.Literal("hit"),
  Type.Literal("miss"),
  Type.Literal("bypass"),
  Type.Literal("not-applicable"),
  Type.Literal("unknown"),
]);

const TelemetryFallbackClassSchema = Type.Union([
  Type.Literal("none"),
  Type.Literal("reviewed-static"),
  Type.Literal("alternate-provider"),
  Type.Literal("reduced-capability"),
  Type.Literal("blocked"),
  Type.Literal("unknown"),
]);

const TelemetryReasonCodeSchema = Type.Union([
  Type.Literal("COMPLETED"),
  Type.Literal("PROVIDER_UNAVAILABLE"),
  Type.Literal("PROVIDER_TIMEOUT"),
  Type.Literal("MALFORMED_RESPONSE"),
  Type.Literal("POLICY_REJECTION"),
  Type.Literal("SAFETY_STOP"),
  Type.Literal("BUDGET_EXCEEDED"),
  Type.Literal("CANCELLED"),
  Type.Literal("INTERNAL_ERROR"),
  Type.Literal("UNKNOWN_FAILURE"),
]);

/**
 * Commercial operations evidence only. This envelope cannot instruct Tutor or
 * authorize a Study decision or mutation.
 */
export const TutorCommercialTelemetryEventSchema = Type.Object(
  {
    contractVersion: Type.Literal(TUTOR_COMMERCIAL_TELEMETRY_CONTRACT_VERSION),
    eventKind: Type.Literal("tutor-commercial-operation"),
    eventRef: OpaqueReferenceSchema,
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
    actionFamily: TelemetryActionFamilySchema,
    routeClass: TelemetryRouteClassSchema,
    inputTokenCount: SafeCounterSchema,
    outputTokenCount: SafeCounterSchema,
    latencyMs: SafeCounterSchema,
    costMicros: CanonicalIntegerMicrosSchema,
    cacheClass: TelemetryCacheClassSchema,
    fallbackClass: TelemetryFallbackClassSchema,
    outcome: Type.Union([Type.Literal("success"), Type.Literal("failure")]),
    reasonCode: TelemetryReasonCodeSchema,
    authorityScope: Type.Literal("commercial-operations-only"),
    instructionalUseAllowed: Type.Literal(false),
    studyAuthority: Type.Literal(false),
    studyMutationAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorCommercialTelemetryEventV3" },
);
export type TutorCommercialTelemetryEvent = Static<typeof TutorCommercialTelemetryEventSchema>;

/**
 * Provider-neutral source shape. Real execution results may contain additional
 * fields; the projector reads only these operational properties.
 */
export interface TutorExecutionResultTelemetrySource {
  readonly status: "success" | "failure";
  readonly eventRef: string;
  readonly actionFamily?: string;
  readonly routeClass?: string;
  readonly metrics: {
    readonly inputTokenCount: number;
    readonly outputTokenCount: number;
    readonly latencyMs: number;
    readonly costMicros: string;
  };
  readonly cacheClass?: string;
  readonly fallbackClass?: string;
  readonly reasonCode?: string;
}

export const CommercialTelemetryLineageSchema = Type.Object(
  {
    attempt: CommercialAttemptSchema,
    reservation: BudgetReservationSchema,
  },
  { additionalProperties: false, $id: "TutorCommercialTelemetryLineageV3" },
);
export interface CommercialTelemetryLineage {
  readonly attempt: CommercialAttempt;
  readonly reservation: BudgetReservation;
}

export type TelemetryProjectionRejectionCode =
  | "INVALID_EXECUTION_RESULT"
  | "INVALID_COMMERCIAL_LINEAGE"
  | "INVALID_OPERATIONAL_REFERENCE"
  | "INVALID_NUMERIC_METRIC";

export type TelemetryProjectionResult =
  | {
      readonly status: "projected";
      readonly event: TutorCommercialTelemetryEvent;
    }
  | {
      readonly status: "rejected";
      readonly reasonCode: TelemetryProjectionRejectionCode;
    };
