import { Type, type Static } from "../../../schema/typebox.js";
import { validateExact } from "../../../v2/contracts/validation.js";
import {
  CommercialAttemptUsageReceiptSchema,
  commercialAttemptsEqual,
  CommercialRouteAttemptPlanSchema,
  isCanonicalCommercialAttempt,
  validateCommercialRouteAttemptPlan,
  type CommercialAttempt,
  type CommercialAttemptUsageReceipt,
} from "../../commercial-operation/index.js";
import {
  AttemptBudgetSchema,
  BUDGET_RESILIENCE_VERSION,
  BudgetReservationSchema,
  CircuitBreakerPolicySchema,
  CircuitSignalSchema,
  CircuitStateSchema,
  ExecutionBudgetSchema,
  LatencyBudgetSchema,
  MAX_INTEGER_MICROS,
  MAX_SAFE_MILLISECONDS,
  RetryPolicySchema,
  type AttemptBudget,
  type BudgetReservation,
  type BudgetSettlement,
  type CircuitBreakerDecision,
  type CircuitBreakerPolicy,
  type CircuitSignal,
  type CircuitState,
  type ExecutionBudget,
  type FallbackDecision,
  type FallbackReason,
  type LatencyBudget,
  type RetryableFailure,
  type RetryPolicy,
} from "./contracts.js";

const ReferenceSchema = Type.String({
  pattern: "^[a-z][a-z0-9-]*(?::[a-zA-Z0-9._-]+)+$",
  minLength: 3,
  maxLength: 160,
});

const ReserveExecutionInputSchema = Type.Object(
  {
    executionBudget: ExecutionBudgetSchema,
    reservationRef: ReferenceSchema,
    attempts: Type.Array(AttemptBudgetSchema, { maxItems: 2 }),
  },
  { additionalProperties: false },
);

const ReserveCommercialRouteAttemptPlanInputSchema = Type.Object(
  {
    executionBudget: ExecutionBudgetSchema,
    reservationRef: ReferenceSchema,
    routeAttemptPlan: CommercialRouteAttemptPlanSchema,
    eligibilityClassRef: ReferenceSchema,
    failoverBackoffMs: Type.Integer({ minimum: 0, maximum: MAX_SAFE_MILLISECONDS }),
  },
  { additionalProperties: false },
);

const FailureKindSchema = Type.Union([
  Type.Literal("provider-outage"),
  Type.Literal("rate-limit"),
  Type.Literal("confirmed-not-dispatched-transport-failure"),
  Type.Literal("provider-timeout"),
  Type.Literal("provider-rejection"),
  Type.Literal("provider-response-invalid"),
  Type.Literal("provider-response-policy-rejected"),
  Type.Literal("cost-anomaly"),
  Type.Literal("deadline-exhausted"),
]);

export const ResilienceDecisionInputSchema = Type.Object(
  {
    executionBudget: ExecutionBudgetSchema,
    reservation: BudgetReservationSchema,
    latencyBudget: LatencyBudgetSchema,
    retryPolicy: RetryPolicySchema,
    attemptsCompleted: Type.Union([
      Type.Literal(0),
      Type.Literal(1),
      Type.Literal(2),
    ]),
    primaryAttempt: AttemptBudgetSchema,
    failoverAttempt: Type.Union([AttemptBudgetSchema, Type.Null()]),
    failure: Type.Object(
      {
        kind: FailureKindSchema,
        retryAfterMs: Type.Union([
          Type.Integer({ minimum: 0, maximum: MAX_SAFE_MILLISECONDS }),
          Type.Null(),
        ]),
        indeterminatePrimaryReserveHeld: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
    failoverAvailability: Type.Union([
      Type.Literal("eligible"),
      Type.Literal("outage"),
      Type.Literal("rate-limited"),
      Type.Literal("unknown"),
    ]),
    failoverCircuitState: CircuitStateSchema,
  },
  { additionalProperties: false, $id: "TutorV3ResilienceDecisionInput" },
);
export type ResilienceDecisionInput = Static<
  typeof ResilienceDecisionInputSchema
>;

const CircuitEvaluationInputSchema = Type.Object(
  {
    state: CircuitStateSchema,
    policy: CircuitBreakerPolicySchema,
    nowMs: Type.Integer({ minimum: 0, maximum: MAX_SAFE_MILLISECONDS }),
    storageAvailable: Type.Boolean(),
    requestKind: Type.Union([
      Type.Literal("learner-dispatch"),
      Type.Literal("dedicated-probe"),
    ]),
    signal: CircuitSignalSchema,
  },
  { additionalProperties: false },
);

const TRUSTED_INVALID_BUDGET_STOP: FallbackDecision = Object.freeze({
  contractVersion: BUDGET_RESILIENCE_VERSION,
  decision: "fixed-stop",
  reason: "invalid-budget",
  stopCode: "commercial-execution-unavailable",
});

const RETRYABLE_FAILURE_SET = new Set<string>([
  "provider-outage",
  "rate-limit",
  "confirmed-not-dispatched-transport-failure",
  "provider-timeout",
]);

const BREAKER_FAILURE_SIGNALS = new Set<CircuitSignal>([
  "provider-outage",
  "provider-timeout",
  "provider-response-invalid",
  "adapter-permanent-failure",
  "cost-anomaly",
]);

function parseMicros(value: string): bigint | null {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed <= MAX_INTEGER_MICROS ? parsed : null;
  } catch {
    return null;
  }
}

function checkedMicrosSum(values: readonly string[]): bigint | null {
  let total = 0n;
  for (const value of values) {
    const parsed = parseMicros(value);
    if (parsed === null || parsed > MAX_INTEGER_MICROS - total) return null;
    total += parsed;
  }
  return total;
}

function checkedMillisecondsSum(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > MAX_SAFE_MILLISECONDS - total
    ) {
      return null;
    }
    total += value;
  }
  return total;
}

function effectiveCeiling(budget: ExecutionBudget): bigint | null {
  const caps = [
    budget.operationMaximumMicros,
    budget.interactionRemainingMicros,
    budget.householdPeriodRemainingMicros,
    budget.platformPeriodRemainingMicros,
  ].map(parseMicros);
  if (caps.some((cap) => cap === null)) return null;
  return (caps as bigint[]).reduce((minimum, cap) =>
    cap < minimum ? cap : minimum,
  );
}

function reviewedFallback(
  budget: ExecutionBudget,
  reason: FallbackReason,
): FallbackDecision {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    decision: "reviewed-static-fallback",
    reason,
    fallback: { ...budget.reviewedStaticFallback },
  };
}

function isValidAttemptPlan(
  budget: ExecutionBudget,
  attempts: readonly AttemptBudget[],
): boolean {
  if (
    attempts.length === 0 ||
    attempts.length > budget.maximumPhysicalAttempts ||
    attempts.length > 2
  ) {
    return false;
  }
  const primary = attempts[0];
  if (
    !primary ||
    primary.attemptIndex !== 0 ||
    primary.role !== "primary" ||
    primary.logicalOperationRef !== budget.logicalOperationRef ||
    !isCanonicalCommercialAttempt(reservationAttempt(primary)) ||
    !primary.hardConstraintsSatisfied
  ) {
    return false;
  }
  const failover = attempts[1];
  if (!failover) return attempts.length === 1;
  return (
    failover.attemptIndex === 1 &&
    failover.role === "failover" &&
    failover.logicalOperationRef === budget.logicalOperationRef &&
    isCanonicalCommercialAttempt(reservationAttempt(failover)) &&
    failover.physicalAttemptRef !== primary.physicalAttemptRef &&
    failover.routeRef !== primary.routeRef &&
    failover.eligibilityClassRef === primary.eligibilityClassRef &&
    failover.hardConstraintsSatisfied
  );
}

function reservationIsConsistent(
  budget: ExecutionBudget,
  reservation: BudgetReservation,
): boolean {
  if (
    reservation.logicalOperationRef !== budget.logicalOperationRef ||
    reservation.attempts.length > budget.maximumPhysicalAttempts
  ) {
    return false;
  }
  const sum = checkedMicrosSum(
    reservation.attempts.map((attempt) => attempt.reservedCostMicros),
  );
  const declaredTotal = parseMicros(reservation.totalReservedMicros);
  const ceiling = effectiveCeiling(budget);
  if (
    sum === null ||
    declaredTotal === null ||
    ceiling === null ||
    sum !== declaredTotal ||
    sum > ceiling
  ) {
    return false;
  }
  return (
    new Set(reservation.attempts.map((attempt) => attempt.physicalAttemptRef)).size ===
      reservation.attempts.length &&
    (reservation.attempts.length === 1 ||
      reservation.attempts[0]?.routeRef !== reservation.attempts[1]?.routeRef) &&
    reservation.attempts.every(
      (attempt, index) =>
        attempt.attemptIndex === index &&
        attempt.role === (index === 0 ? "primary" : "failover") &&
        attempt.logicalOperationRef === budget.logicalOperationRef &&
        isCanonicalCommercialAttempt(attempt),
    )
  );
}

function reservationAttempt(attempt: AttemptBudget): CommercialAttempt {
  return {
    logicalOperationRef: attempt.logicalOperationRef,
    physicalAttemptRef: attempt.physicalAttemptRef,
    attemptIndex: attempt.attemptIndex,
    role: attempt.role,
    routeRef: attempt.routeRef,
    providerRef: attempt.providerRef,
    modelRef: attempt.modelRef,
    modelRevisionRef: attempt.modelRevisionRef,
    configurationDigest: attempt.configurationDigest,
    capabilityProfileRevisionRef: attempt.capabilityProfileRevisionRef,
    capabilityProfileDigest: attempt.capabilityProfileDigest,
    providerPolicyRevisionRef: attempt.providerPolicyRevisionRef,
    providerPolicyEvidenceRef: attempt.providerPolicyEvidenceRef,
    reservedCostMicros: attempt.reservedCostMicros,
    timeoutMs: attempt.timeoutMs,
  };
}

/** Validates the self-contained reservation snapshot and its exact cost sum. */
export function validateBudgetReservationSnapshot(input: unknown): BudgetReservation | null {
  const validation = validateExact(BudgetReservationSchema, input);
  if (validation.status === "rejected") return null;
  const reservation = validation.value;
  const sum = checkedMicrosSum(
    reservation.attempts.map((attempt) => attempt.reservedCostMicros),
  );
  const declaredTotal = parseMicros(reservation.totalReservedMicros);
  if (
    sum === null ||
    declaredTotal === null ||
    sum !== declaredTotal ||
    new Set(reservation.attempts.map((attempt) => attempt.physicalAttemptRef)).size !==
      reservation.attempts.length ||
    (reservation.attempts.length === 2 &&
      reservation.attempts[0]?.routeRef === reservation.attempts[1]?.routeRef) ||
    !reservation.attempts.every(
      (attempt, index) =>
        attempt.logicalOperationRef === reservation.logicalOperationRef &&
        attempt.attemptIndex === index &&
        attempt.role === (index === 0 ? "primary" : "failover") &&
        isCanonicalCommercialAttempt(attempt),
    )
  ) {
    return null;
  }
  return reservation;
}

/**
 * Reserves the conservative maximum cost of every planned physical attempt.
 * Malformed money is never interpreted as zero and no partial plan is returned.
 */
export function reserveExecutionBudget(input: unknown):
  | BudgetReservation
  | FallbackDecision {
  const validation = validateExact(ReserveExecutionInputSchema, input);
  if (validation.status === "rejected") return TRUSTED_INVALID_BUDGET_STOP;

  const { executionBudget: budget, reservationRef, attempts } = validation.value;
  const ceiling = effectiveCeiling(budget);
  const total = checkedMicrosSum(
    attempts.map((attempt) => attempt.reservedCostMicros),
  );
  if (ceiling === null || total === null || !isValidAttemptPlan(budget, attempts)) {
    if (
      ceiling !== null &&
      total !== null &&
      attempts.length === 0 &&
      (ceiling === 0n || budget.maximumPhysicalAttempts === 0)
    ) {
      return reviewedFallback(budget, "budget-exhausted");
    }
    return TRUSTED_INVALID_BUDGET_STOP;
  }
  if (total > ceiling) return reviewedFallback(budget, "budget-exhausted");

  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    reservationRef,
    logicalOperationRef: budget.logicalOperationRef,
    status: "reserved",
    totalReservedMicros: total.toString(),
    attempts: attempts.map(reservationAttempt),
  };
}

/** Reserves the immutable routing snapshot without re-reading any route catalog. */
export function reserveCommercialRouteAttemptPlan(input: unknown):
  | BudgetReservation
  | FallbackDecision {
  const validation = validateExact(ReserveCommercialRouteAttemptPlanInputSchema, input);
  if (validation.status === "rejected") return TRUSTED_INVALID_BUDGET_STOP;
  const {
    executionBudget,
    reservationRef,
    routeAttemptPlan,
    eligibilityClassRef,
    failoverBackoffMs,
  } = validation.value;
  if (
    validateCommercialRouteAttemptPlan(routeAttemptPlan) === null ||
    routeAttemptPlan.logicalOperationRef !== executionBudget.logicalOperationRef
  ) {
    return TRUSTED_INVALID_BUDGET_STOP;
  }
  const attempts: AttemptBudget[] = routeAttemptPlan.attempts.map((attempt) => ({
    ...attempt,
    contractVersion: BUDGET_RESILIENCE_VERSION,
    eligibilityClassRef,
    hardConstraintsSatisfied: true,
    backoffBeforeMs: attempt.attemptIndex === 0 ? 0 : failoverBackoffMs,
  }));
  return reserveExecutionBudget({ executionBudget, reservationRef, attempts });
}

function usageReceiptMatchesAttempt(
  receipt: CommercialAttemptUsageReceipt,
  reservation: BudgetReservation,
  attempt: CommercialAttempt,
): boolean {
  return (
    receipt.logicalOperationRef === attempt.logicalOperationRef &&
    receipt.physicalAttemptRef === attempt.physicalAttemptRef &&
    receipt.reservationRef === reservation.reservationRef &&
    receipt.routeRef === attempt.routeRef &&
    receipt.attemptIndex === attempt.attemptIndex &&
    receipt.role === attempt.role &&
    receipt.reservedCostMicros === attempt.reservedCostMicros
  );
}

/**
 * Settles every executed physical attempt against its own immutable reserve.
 * Indeterminate timeouts retain that attempt's full reserve; an unused reserve
 * can never compensate for another attempt's overrun.
 */
export function settleBudgetReservation(
  reservationInput: unknown,
  usageReceiptsInput: unknown,
  indeterminateTimeoutAttemptRefsInput: unknown = [],
): BudgetSettlement | null {
  const reservation = validateBudgetReservationSnapshot(reservationInput);
  if (reservation === null) return null;
  const reserved = parseMicros(reservation.totalReservedMicros);
  const attemptSum = checkedMicrosSum(
    reservation.attempts.map((attempt) => attempt.reservedCostMicros),
  );
  if (
    reserved === null ||
    attemptSum === null ||
    reserved !== attemptSum
  ) {
    return null;
  }

  if (
    !Array.isArray(usageReceiptsInput) ||
    usageReceiptsInput.length > reservation.attempts.length ||
    !Array.isArray(indeterminateTimeoutAttemptRefsInput) ||
    indeterminateTimeoutAttemptRefsInput.length > reservation.attempts.length ||
    !indeterminateTimeoutAttemptRefsInput.every((value) => typeof value === "string")
  ) {
    return null;
  }
  const receipts: CommercialAttemptUsageReceipt[] = [];
  for (const receiptInput of usageReceiptsInput) {
    const validation = validateExact(CommercialAttemptUsageReceiptSchema, receiptInput);
    if (validation.status === "rejected") return null;
    receipts.push(validation.value);
  }
  const indeterminateRefs = indeterminateTimeoutAttemptRefsInput as string[];
  const executedRefs = [
    ...receipts.map((receipt) => receipt.physicalAttemptRef),
    ...indeterminateRefs,
  ];
  if (
    executedRefs.length === 0 ||
    new Set(executedRefs).size !== executedRefs.length
  ) {
    return null;
  }

  let knownActual = 0n;
  let consumed = 0n;
  for (const receipt of receipts) {
    const attempt = reservation.attempts.find(
      (candidate) => candidate.physicalAttemptRef === receipt.physicalAttemptRef,
    );
    const actual = parseMicros(receipt.actualCostMicros);
    const attemptReserved = attempt ? parseMicros(attempt.reservedCostMicros) : null;
    if (
      !attempt ||
      actual === null ||
      attemptReserved === null ||
      !usageReceiptMatchesAttempt(receipt, reservation, attempt)
    ) {
      return null;
    }
    if (actual > attemptReserved) {
      return {
        contractVersion: BUDGET_RESILIENCE_VERSION,
        reservationRef: reservation.reservationRef,
        logicalOperationRef: reservation.logicalOperationRef,
        outcome: "rejected-over-reservation",
        actualCostMicros: receipt.actualCostMicros,
        consumedCostMicros: reservation.totalReservedMicros,
        releasedCostMicros: "0",
        accountingGap: true,
        costAnomaly: true,
      };
    }
    knownActual += actual;
    consumed += actual;
  }
  for (const physicalAttemptRef of indeterminateRefs) {
    const attempt = reservation.attempts.find(
      (candidate) => candidate.physicalAttemptRef === physicalAttemptRef,
    );
    const attemptReserved = attempt ? parseMicros(attempt.reservedCostMicros) : null;
    if (!attempt || attemptReserved === null) return null;
    consumed += attemptReserved;
  }
  if (consumed > reserved) {
    return {
      contractVersion: BUDGET_RESILIENCE_VERSION,
      reservationRef: reservation.reservationRef,
      logicalOperationRef: reservation.logicalOperationRef,
      outcome: "rejected-over-reservation",
      actualCostMicros: indeterminateRefs.length === 0 ? knownActual.toString() : null,
      consumedCostMicros: reservation.totalReservedMicros,
      releasedCostMicros: "0",
      accountingGap: true,
      costAnomaly: true,
    };
  }
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    reservationRef: reservation.reservationRef,
    logicalOperationRef: reservation.logicalOperationRef,
    outcome: indeterminateRefs.length === 0 ? "settled" : "indeterminate-hold",
    actualCostMicros: indeterminateRefs.length === 0 ? knownActual.toString() : null,
    consumedCostMicros: consumed.toString(),
    releasedCostMicros: (reserved - consumed).toString(),
    accountingGap: indeterminateRefs.length > 0,
    costAnomaly: false,
  };
}

function failureFallbackReason(
  failure: ResilienceDecisionInput["failure"]["kind"],
): FallbackReason {
  switch (failure) {
    case "provider-outage":
    case "rate-limit":
    case "provider-timeout":
    case "provider-response-invalid":
    case "provider-response-policy-rejected":
    case "cost-anomaly":
    case "deadline-exhausted":
      return failure;
    case "confirmed-not-dispatched-transport-failure":
    case "provider-rejection":
      return "failure-not-retryable";
  }
}

function latencyAllowsAttempt(
  latency: LatencyBudget,
  policy: RetryPolicy,
  attempt: AttemptBudget,
): boolean {
  if (attempt.backoffBeforeMs !== policy.backoffMs) return false;
  const required = checkedMillisecondsSum([
    latency.elapsedMs,
    latency.deterministicReserveMs,
    attempt.backoffBeforeMs,
    attempt.timeoutMs,
  ]);
  return required !== null && required <= latency.endToEndDeadlineMs;
}

/**
 * Chooses one pre-reserved, equally eligible failover or trusted static content.
 * It never returns a same-route retry and never returns a third physical attempt.
 */
export function decideFallback(input: unknown): FallbackDecision {
  const validation = validateExact(ResilienceDecisionInputSchema, input);
  if (validation.status === "rejected") return TRUSTED_INVALID_BUDGET_STOP;
  const decisionInput = validation.value;
  const {
    executionBudget: budget,
    reservation,
    latencyBudget,
    retryPolicy,
    attemptsCompleted,
    primaryAttempt,
    failoverAttempt,
    failure,
  } = decisionInput;
  const reservedPrimary = reservation.attempts[0];

  if (
    !reservationIsConsistent(budget, reservation) ||
    new Set(retryPolicy.retryableFailures).size !==
      retryPolicy.retryableFailures.length ||
    primaryAttempt.attemptIndex !== 0 ||
    primaryAttempt.role !== "primary" ||
    primaryAttempt.logicalOperationRef !== budget.logicalOperationRef ||
    !isCanonicalCommercialAttempt(reservationAttempt(primaryAttempt)) ||
    !reservedPrimary ||
    !commercialAttemptsEqual(reservedPrimary, primaryAttempt)
  ) {
    return TRUSTED_INVALID_BUDGET_STOP;
  }
  if (failure.kind === "deadline-exhausted") {
    return reviewedFallback(budget, "deadline-exhausted");
  }
  if (
    attemptsCompleted >= retryPolicy.maximumPhysicalAttempts ||
    attemptsCompleted >= 2 ||
    retryPolicy.maximumPhysicalAttempts < 2
  ) {
    return reviewedFallback(budget, "retry-exhausted");
  }
  if (
    !RETRYABLE_FAILURE_SET.has(failure.kind) ||
    !retryPolicy.retryableFailures.includes(failure.kind as RetryableFailure)
  ) {
    return reviewedFallback(budget, failureFallbackReason(failure.kind));
  }
  if (failoverAttempt === null) {
    return reviewedFallback(budget, failureFallbackReason(failure.kind));
  }
  if (
    failoverAttempt.attemptIndex !== 1 ||
    failoverAttempt.role !== "failover" ||
    failoverAttempt.logicalOperationRef !== budget.logicalOperationRef ||
    failoverAttempt.physicalAttemptRef === primaryAttempt.physicalAttemptRef ||
    !isCanonicalCommercialAttempt(reservationAttempt(failoverAttempt))
  ) {
    return TRUSTED_INVALID_BUDGET_STOP;
  }
  if (failoverAttempt.routeRef === primaryAttempt.routeRef) {
    return reviewedFallback(budget, "same-route-retry-forbidden");
  }
  if (
    !primaryAttempt.hardConstraintsSatisfied ||
    !failoverAttempt.hardConstraintsSatisfied ||
    failoverAttempt.eligibilityClassRef !== primaryAttempt.eligibilityClassRef
  ) {
    return reviewedFallback(budget, "failover-not-equally-eligible");
  }
  if (decisionInput.failoverAvailability !== "eligible") {
    return reviewedFallback(budget, "failover-unavailable");
  }
  if (decisionInput.failoverCircuitState.state !== "closed") {
    return reviewedFallback(budget, "failover-circuit-not-closed");
  }
  if (
    failure.kind === "provider-timeout" &&
    !failure.indeterminatePrimaryReserveHeld
  ) {
    return reviewedFallback(budget, "failover-not-pre-reserved");
  }
  const reservedFailover = reservation.attempts.find(
    (attempt) => attempt.attemptIndex === 1,
  );
  if (
    !reservedFailover ||
    !commercialAttemptsEqual(reservedFailover, failoverAttempt)
  ) {
    return reviewedFallback(budget, "failover-not-pre-reserved");
  }
  if (!latencyAllowsAttempt(latencyBudget, retryPolicy, failoverAttempt)) {
    return reviewedFallback(budget, "deadline-exhausted");
  }

  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    decision: "commercial-failover",
    reason: failure.kind as RetryableFailure,
    attempt: { ...failoverAttempt },
  };
}

const INVALID_CIRCUIT_STATE: CircuitState = Object.freeze({
  state: "open",
  openedAtMs: 0,
  reopenAtMs: MAX_SAFE_MILLISECONDS,
});

function invalidCircuitDecision(
  reason: "invalid-circuit-input" | "circuit-storage-unavailable",
): CircuitBreakerDecision {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    action: "deny-commercial-route",
    reason,
    nextState: INVALID_CIRCUIT_STATE,
  };
}

function openCircuit(
  nowMs: number,
  policy: CircuitBreakerPolicy,
): CircuitState | null {
  const reopenAtMs = checkedMillisecondsSum([nowMs, policy.openMs]);
  if (reopenAtMs === null) return null;
  return { state: "open", openedAtMs: nowMs, reopenAtMs };
}

function ratioThresholdReached(
  failures: number,
  samples: number,
  policy: CircuitBreakerPolicy,
): boolean {
  return (
    BigInt(failures) * BigInt(policy.failureRatioDenominator) >=
    BigInt(samples) * BigInt(policy.failureRatioNumerator)
  );
}

function closedStateIsValid(state: Extract<CircuitState, { state: "closed" }>): boolean {
  return (
    state.failureCount <= state.sampleCount &&
    state.consecutiveFailureCount <= state.failureCount
  );
}

function evaluateClosedCircuit(
  state: Extract<CircuitState, { state: "closed" }>,
  policy: CircuitBreakerPolicy,
  nowMs: number,
  signal: CircuitSignal,
): CircuitBreakerDecision {
  if (nowMs < state.windowStartedAtMs || !closedStateIsValid(state)) {
    return invalidCircuitDecision("invalid-circuit-input");
  }
  const windowElapsed = nowMs - state.windowStartedAtMs;
  const base =
    windowElapsed >= policy.windowMs
      ? {
          state: "closed" as const,
          windowStartedAtMs: nowMs,
          sampleCount: 0,
          failureCount: 0,
          consecutiveFailureCount: 0,
        }
      : state;

  let nextState: Extract<CircuitState, { state: "closed" }> = { ...base };
  if (signal === "provider-success" || BREAKER_FAILURE_SIGNALS.has(signal)) {
    const sampleCount = checkedMillisecondsSum([base.sampleCount, 1]);
    const failureCount = checkedMillisecondsSum([
      base.failureCount,
      BREAKER_FAILURE_SIGNALS.has(signal) ? 1 : 0,
    ]);
    const consecutiveFailureCount = BREAKER_FAILURE_SIGNALS.has(signal)
      ? checkedMillisecondsSum([base.consecutiveFailureCount, 1])
      : 0;
    if (
      sampleCount === null ||
      failureCount === null ||
      consecutiveFailureCount === null
    ) {
      return invalidCircuitDecision("invalid-circuit-input");
    }
    nextState = {
      state: "closed",
      windowStartedAtMs: base.windowStartedAtMs,
      sampleCount,
      failureCount,
      consecutiveFailureCount,
    };
  }

  const shouldOpen =
    nextState.consecutiveFailureCount >= policy.consecutiveFailureThreshold ||
    (nextState.sampleCount >= policy.minimumSampleCount &&
      ratioThresholdReached(
        nextState.failureCount,
        nextState.sampleCount,
        policy,
      ));
  if (shouldOpen) {
    const opened = openCircuit(nowMs, policy);
    if (opened === null) return invalidCircuitDecision("invalid-circuit-input");
    return {
      contractVersion: BUDGET_RESILIENCE_VERSION,
      action: "deny-commercial-route",
      reason: "circuit-opened-by-threshold",
      nextState: opened,
    };
  }
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    action: "allow-learner-dispatch",
    reason: "circuit-closed",
    nextState,
  };
}

function evaluateHalfOpenCircuit(
  state: Extract<CircuitState, { state: "half-open" }>,
  policy: CircuitBreakerPolicy,
  nowMs: number,
  requestKind: "learner-dispatch" | "dedicated-probe",
  signal: CircuitSignal,
): CircuitBreakerDecision {
  if (requestKind === "learner-dispatch") {
    return {
      contractVersion: BUDGET_RESILIENCE_VERSION,
      action: "deny-commercial-route",
      reason: "circuit-half-open-learner-denied",
      nextState: state,
    };
  }
  if (
    (signal === "provider-success" || BREAKER_FAILURE_SIGNALS.has(signal)) &&
    state.probeLeaseAvailable
  ) {
    return invalidCircuitDecision("invalid-circuit-input");
  }
  if (BREAKER_FAILURE_SIGNALS.has(signal)) {
    const opened = openCircuit(nowMs, policy);
    if (opened === null) return invalidCircuitDecision("invalid-circuit-input");
    return {
      contractVersion: BUDGET_RESILIENCE_VERSION,
      action: "deny-commercial-route",
      reason: "circuit-opened-by-threshold",
      nextState: opened,
    };
  }
  if (signal === "provider-success") {
    const successfulProbeCount = checkedMillisecondsSum([
      state.successfulProbeCount,
      1,
    ]);
    if (successfulProbeCount === null) {
      return invalidCircuitDecision("invalid-circuit-input");
    }
    if (successfulProbeCount >= policy.successfulHalfOpenProbeCount) {
      return {
        contractVersion: BUDGET_RESILIENCE_VERSION,
        action: "deny-commercial-route",
        reason: "circuit-closed-after-probes",
        nextState: {
          state: "closed",
          windowStartedAtMs: nowMs,
          sampleCount: 0,
          failureCount: 0,
          consecutiveFailureCount: 0,
        },
      };
    }
    state = {
      state: "half-open",
      successfulProbeCount,
      probeLeaseAvailable: true,
    };
  }
  if (!state.probeLeaseAvailable) {
    return {
      contractVersion: BUDGET_RESILIENCE_VERSION,
      action: "deny-commercial-route",
      reason: "circuit-half-open-probe-leased",
      nextState: state,
    };
  }
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    action: "allow-dedicated-probe",
    reason: "circuit-half-open-probe-authorized",
    nextState: { ...state, probeLeaseAvailable: false },
  };
}

/** Deterministic integer-threshold circuit transition and access decision. */
export function evaluateCircuitBreaker(input: unknown): CircuitBreakerDecision {
  const validation = validateExact(CircuitEvaluationInputSchema, input);
  if (validation.status === "rejected") {
    return invalidCircuitDecision("invalid-circuit-input");
  }
  const { state, policy, nowMs, storageAvailable, requestKind, signal } =
    validation.value;
  if (
    !storageAvailable ||
    policy.failureRatioNumerator > policy.failureRatioDenominator
  ) {
    return invalidCircuitDecision(
      storageAvailable
        ? "invalid-circuit-input"
        : "circuit-storage-unavailable",
    );
  }
  if (state.state === "closed") {
    return evaluateClosedCircuit(state, policy, nowMs, signal);
  }
  if (state.state === "open") {
    if (state.openedAtMs > state.reopenAtMs || nowMs < state.openedAtMs) {
      return invalidCircuitDecision("invalid-circuit-input");
    }
    if (nowMs < state.reopenAtMs) {
      return {
        contractVersion: BUDGET_RESILIENCE_VERSION,
        action: "deny-commercial-route",
        reason: "circuit-open",
        nextState: state,
      };
    }
    return evaluateHalfOpenCircuit(
      {
        state: "half-open",
        successfulProbeCount: 0,
        probeLeaseAvailable: true,
      },
      policy,
      nowMs,
      requestKind,
      signal,
    );
  }
  return evaluateHalfOpenCircuit(
    state,
    policy,
    nowMs,
    requestKind,
    signal,
  );
}
