import { Type } from "../../../schema/typebox.js";
import { CanonicalIntegerMicrosSchema, CommercialAttemptSchema, MAX_CANONICAL_INTEGER_MICROS, } from "../../commercial-operation/index.js";
export const BUDGET_RESILIENCE_VERSION = "study-tutor-v3.budget-resilience.v1";
export const MAX_INTEGER_MICROS = MAX_CANONICAL_INTEGER_MICROS;
export const MAX_SAFE_MILLISECONDS = Number.MAX_SAFE_INTEGER;
export { CanonicalIntegerMicrosSchema };
const ReferenceSchema = Type.String({
    pattern: "^[a-z][a-z0-9-]*(?::[a-zA-Z0-9._-]+)+$",
    minLength: 3,
    maxLength: 160,
});
const MillisecondsSchema = Type.Integer({
    minimum: 0,
    maximum: MAX_SAFE_MILLISECONDS,
});
const PositiveMillisecondsSchema = Type.Integer({
    minimum: 1,
    maximum: MAX_SAFE_MILLISECONDS,
});
const PhysicalAttemptCountSchema = Type.Union([
    Type.Literal(0),
    Type.Literal(1),
    Type.Literal(2),
]);
export const ReviewedStaticFallbackSchema = Type.Object({
    selection: Type.Literal("reviewed-content-by-trusted-study-ref"),
    policyRef: ReferenceSchema,
    reviewedContentRef: ReferenceSchema,
    reviewRef: ReferenceSchema,
}, { additionalProperties: false });
export const ExecutionBudgetSchema = Type.Object({
    contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
    logicalOperationRef: ReferenceSchema,
    currency: Type.Literal("USD"),
    operationMaximumMicros: CanonicalIntegerMicrosSchema,
    interactionRemainingMicros: CanonicalIntegerMicrosSchema,
    householdPeriodRemainingMicros: CanonicalIntegerMicrosSchema,
    platformPeriodRemainingMicros: CanonicalIntegerMicrosSchema,
    maximumPhysicalAttempts: PhysicalAttemptCountSchema,
    reviewedStaticFallback: ReviewedStaticFallbackSchema,
}, { additionalProperties: false, $id: "TutorV3ExecutionBudget" });
export const AttemptBudgetSchema = Type.Composite([
    CommercialAttemptSchema,
    Type.Object({
        contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
        eligibilityClassRef: ReferenceSchema,
        hardConstraintsSatisfied: Type.Boolean(),
        backoffBeforeMs: MillisecondsSchema,
    }, { additionalProperties: false }),
], { additionalProperties: false, $id: "TutorV3AttemptBudget" });
export const BudgetReservationSchema = Type.Object({
    contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
    reservationRef: ReferenceSchema,
    logicalOperationRef: ReferenceSchema,
    status: Type.Literal("reserved"),
    totalReservedMicros: CanonicalIntegerMicrosSchema,
    attempts: Type.Array(CommercialAttemptSchema, { minItems: 1, maxItems: 2 }),
}, { additionalProperties: false, $id: "TutorV3BudgetReservation" });
export const BudgetSettlementSchema = Type.Object({
    contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
    reservationRef: ReferenceSchema,
    logicalOperationRef: ReferenceSchema,
    outcome: Type.Union([
        Type.Literal("settled"),
        Type.Literal("indeterminate-hold"),
        Type.Literal("rejected-over-reservation"),
    ]),
    actualCostMicros: Type.Union([CanonicalIntegerMicrosSchema, Type.Null()]),
    consumedCostMicros: CanonicalIntegerMicrosSchema,
    releasedCostMicros: CanonicalIntegerMicrosSchema,
    accountingGap: Type.Boolean(),
    costAnomaly: Type.Boolean(),
}, { additionalProperties: false, $id: "TutorV3BudgetSettlement" });
export const LatencyBudgetSchema = Type.Object({
    contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
    endToEndDeadlineMs: MillisecondsSchema,
    deterministicReserveMs: MillisecondsSchema,
    elapsedMs: MillisecondsSchema,
}, { additionalProperties: false, $id: "TutorV3LatencyBudget" });
export const RETRYABLE_FAILURES = [
    "provider-outage",
    "rate-limit",
    "confirmed-not-dispatched-transport-failure",
    "provider-timeout",
];
export const TERMINAL_FAILURES = [
    "provider-rejection",
    "provider-response-invalid",
    "provider-response-policy-rejected",
    "cost-anomaly",
    "deadline-exhausted",
];
const RetryableFailureSchema = Type.Union([
    Type.Literal("provider-outage"),
    Type.Literal("rate-limit"),
    Type.Literal("confirmed-not-dispatched-transport-failure"),
    Type.Literal("provider-timeout"),
]);
export const RetryPolicySchema = Type.Object({
    contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
    maximumPhysicalAttempts: PhysicalAttemptCountSchema,
    maximumSameRouteRetries: Type.Literal(0),
    retryableFailures: Type.Array(RetryableFailureSchema, {
        maxItems: RETRYABLE_FAILURES.length,
    }),
    backoffMs: MillisecondsSchema,
    requireFreshAvailability: Type.Literal(true),
    requireEqualHardEligibility: Type.Literal(true),
    requireRemainingDeadlineAndBudget: Type.Literal(true),
    retainFullReserveOnIndeterminateTimeout: Type.Literal(true),
}, { additionalProperties: false, $id: "TutorV3RetryPolicy" });
const CircuitCountsSchema = Type.Object({
    windowStartedAtMs: MillisecondsSchema,
    sampleCount: Type.Integer({ minimum: 0, maximum: MAX_SAFE_MILLISECONDS }),
    failureCount: Type.Integer({ minimum: 0, maximum: MAX_SAFE_MILLISECONDS }),
    consecutiveFailureCount: Type.Integer({
        minimum: 0,
        maximum: MAX_SAFE_MILLISECONDS,
    }),
}, { additionalProperties: false });
export const CircuitStateSchema = Type.Union([
    Type.Composite([
        CircuitCountsSchema,
        Type.Object({ state: Type.Literal("closed") }, { additionalProperties: false }),
    ], { additionalProperties: false }),
    Type.Object({
        state: Type.Literal("open"),
        openedAtMs: MillisecondsSchema,
        reopenAtMs: MillisecondsSchema,
    }, { additionalProperties: false }),
    Type.Object({
        state: Type.Literal("half-open"),
        successfulProbeCount: Type.Integer({
            minimum: 0,
            maximum: MAX_SAFE_MILLISECONDS,
        }),
        probeLeaseAvailable: Type.Boolean(),
    }, { additionalProperties: false }),
], { $id: "TutorV3CircuitState" });
export const CircuitBreakerPolicySchema = Type.Object({
    contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
    windowMs: PositiveMillisecondsSchema,
    minimumSampleCount: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
    failureRatioNumerator: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
    failureRatioDenominator: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
    consecutiveFailureThreshold: Type.Integer({
        minimum: 1,
        maximum: 1_000_000,
    }),
    openMs: PositiveMillisecondsSchema,
    successfulHalfOpenProbeCount: Type.Integer({
        minimum: 1,
        maximum: 1_000_000,
    }),
}, { additionalProperties: false, $id: "TutorV3CircuitBreakerPolicy" });
export const CircuitSignalSchema = Type.Union([
    Type.Literal("none"),
    Type.Literal("provider-success"),
    Type.Literal("provider-outage"),
    Type.Literal("provider-timeout"),
    Type.Literal("provider-response-invalid"),
    Type.Literal("adapter-permanent-failure"),
    Type.Literal("cost-anomaly"),
    Type.Literal("study-policy-rejection"),
    Type.Literal("caller-cancellation"),
    Type.Literal("safety-held"),
]);
export const CircuitBreakerDecisionSchema = Type.Object({
    contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
    action: Type.Union([
        Type.Literal("allow-learner-dispatch"),
        Type.Literal("allow-dedicated-probe"),
        Type.Literal("deny-commercial-route"),
    ]),
    reason: Type.Union([
        Type.Literal("circuit-closed"),
        Type.Literal("circuit-open"),
        Type.Literal("circuit-opened-by-threshold"),
        Type.Literal("circuit-half-open-learner-denied"),
        Type.Literal("circuit-half-open-probe-authorized"),
        Type.Literal("circuit-half-open-probe-leased"),
        Type.Literal("circuit-closed-after-probes"),
        Type.Literal("circuit-storage-unavailable"),
        Type.Literal("invalid-circuit-input"),
    ]),
    nextState: CircuitStateSchema,
}, { additionalProperties: false, $id: "TutorV3CircuitBreakerDecision" });
export const FALLBACK_REASONS = [
    "invalid-budget",
    "budget-exhausted",
    "deadline-exhausted",
    "retry-exhausted",
    "failure-not-retryable",
    "same-route-retry-forbidden",
    "failover-not-equally-eligible",
    "failover-unavailable",
    "failover-circuit-not-closed",
    "failover-not-pre-reserved",
    "provider-outage",
    "rate-limit",
    "provider-timeout",
    "provider-response-invalid",
    "provider-response-policy-rejected",
    "cost-anomaly",
];
const FallbackReasonSchema = Type.Union(FALLBACK_REASONS.map((reason) => Type.Literal(reason)));
export const FallbackDecisionSchema = Type.Union([
    Type.Object({
        contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
        decision: Type.Literal("commercial-failover"),
        reason: RetryableFailureSchema,
        attempt: AttemptBudgetSchema,
    }, { additionalProperties: false }),
    Type.Object({
        contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
        decision: Type.Literal("reviewed-static-fallback"),
        reason: FallbackReasonSchema,
        fallback: ReviewedStaticFallbackSchema,
    }, { additionalProperties: false }),
    Type.Object({
        contractVersion: Type.Literal(BUDGET_RESILIENCE_VERSION),
        decision: Type.Literal("fixed-stop"),
        reason: Type.Literal("invalid-budget"),
        stopCode: Type.Literal("commercial-execution-unavailable"),
    }, { additionalProperties: false }),
], { $id: "TutorV3FallbackDecision" });
