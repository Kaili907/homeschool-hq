import assert from "node:assert/strict";
import test from "node:test";
import { COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION } from "../../commercial-operation/index.js";
import {
  BUDGET_RESILIENCE_VERSION,
  MAX_INTEGER_MICROS,
  decideFallback,
  evaluateCircuitBreaker,
  reserveExecutionBudget,
  reserveCommercialRouteAttemptPlan,
  settleBudgetReservation,
  type AttemptBudget,
  type BudgetReservation,
  type CircuitBreakerPolicy,
  type CircuitState,
  type ExecutionBudget,
  type LatencyBudget,
  type ResilienceDecisionInput,
  type RetryPolicy,
} from "./index.js";

const CONFIG_DIGEST = `sha256:${"a".repeat(64)}`;
const PROFILE_DIGEST = `sha256:${"b".repeat(64)}`;

function executionBudget(
  maximumMicros = "300",
  maximumPhysicalAttempts: 0 | 1 | 2 = 2,
): ExecutionBudget {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    logicalOperationRef: "operation:budget-resilience-001",
    currency: "USD",
    operationMaximumMicros: maximumMicros,
    interactionRemainingMicros: maximumMicros,
    householdPeriodRemainingMicros: maximumMicros,
    platformPeriodRemainingMicros: maximumMicros,
    maximumPhysicalAttempts,
    reviewedStaticFallback: {
      selection: "reviewed-content-by-trusted-study-ref",
      policyRef: "fallback-policy:reviewed-v1",
      reviewedContentRef: "reviewed-content:budget-exhausted-v1",
      reviewRef: "review:budget-exhausted-v1",
    },
  };
}

function attempt(
  attemptIndex: 0 | 1,
  overrides: Partial<AttemptBudget> = {},
): AttemptBudget {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    logicalOperationRef: "operation:budget-resilience-001",
    physicalAttemptRef: `physical-attempt:budget-resilience-00${attemptIndex + 1}`,
    attemptIndex,
    role: attemptIndex === 0 ? "primary" : "failover",
    routeRef:
      attemptIndex === 0
        ? "route:commercial-primary-v1"
        : "route:commercial-failover-v1",
    providerRef: attemptIndex === 0 ? "provider:primary-v1" : "provider:failover-v1",
    modelRef: attemptIndex === 0 ? "model:primary" : "model:failover",
    modelRevisionRef:
      attemptIndex === 0 ? "model-revision:primary-v1" : "model-revision:failover-v1",
    configurationDigest: CONFIG_DIGEST,
    capabilityProfileRevisionRef: "capability-profile:minor-heightened-v1",
    capabilityProfileDigest: PROFILE_DIGEST,
    providerPolicyRevisionRef: "provider-policy-revision:minor-v1",
    providerPolicyEvidenceRef:
      attemptIndex === 0
        ? "provider-policy-evidence:primary-v1"
        : "provider-policy-evidence:failover-v1",
    eligibilityClassRef: "eligibility:minor-heightened-us-reviewed-v1",
    hardConstraintsSatisfied: true,
    reservedCostMicros: "100",
    timeoutMs: 300,
    backoffBeforeMs: attemptIndex === 0 ? 0 : 50,
    ...overrides,
  };
}

function reserve(
  budget = executionBudget(),
  attempts: readonly AttemptBudget[] = [attempt(0), attempt(1)],
): BudgetReservation {
  const result = reserveExecutionBudget({
    executionBudget: budget,
    reservationRef: "reservation:budget-resilience-001",
    attempts,
  });
  assert.ok("status" in result);
  return result;
}

function retryPolicy(): RetryPolicy {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    maximumPhysicalAttempts: 2,
    maximumSameRouteRetries: 0,
    retryableFailures: [
      "provider-outage",
      "rate-limit",
      "confirmed-not-dispatched-transport-failure",
      "provider-timeout",
    ],
    backoffMs: 50,
    requireFreshAvailability: true,
    requireEqualHardEligibility: true,
    requireRemainingDeadlineAndBudget: true,
    retainFullReserveOnIndeterminateTimeout: true,
  };
}

function latencyBudget(endToEndDeadlineMs = 500): LatencyBudget {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    endToEndDeadlineMs,
    deterministicReserveMs: 50,
    elapsedMs: 100,
  };
}

function closedCircuit(): CircuitState {
  return {
    state: "closed",
    windowStartedAtMs: 0,
    sampleCount: 0,
    failureCount: 0,
    consecutiveFailureCount: 0,
  };
}

function decisionInput(
  overrides: Partial<ResilienceDecisionInput> = {},
): ResilienceDecisionInput {
  const budget = executionBudget();
  return {
    executionBudget: budget,
    reservation: reserve(budget),
    latencyBudget: latencyBudget(),
    retryPolicy: retryPolicy(),
    attemptsCompleted: 1,
    primaryAttempt: attempt(0),
    failoverAttempt: attempt(1),
    failure: {
      kind: "provider-timeout",
      retryAfterMs: null,
      indeterminatePrimaryReserveHeld: true,
    },
    failoverAvailability: "eligible",
    failoverCircuitState: closedCircuit(),
    ...overrides,
  };
}

function breakerPolicy(): CircuitBreakerPolicy {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    windowMs: 1_000,
    minimumSampleCount: 2,
    failureRatioNumerator: 1,
    failureRatioDenominator: 2,
    consecutiveFailureThreshold: 3,
    openMs: 100,
    successfulHalfOpenProbeCount: 1,
  };
}

test("rejects negative, decimal, unsafe, and overflowing IntegerMicros", () => {
  for (const invalid of [
    "-1",
    "1.0",
    "01",
    (MAX_INTEGER_MICROS + 1n).toString(),
  ]) {
    const result = reserveExecutionBudget({
      executionBudget: executionBudget(invalid),
      reservationRef: "reservation:invalid-money",
      attempts: [attempt(0)],
    });
    assert.ok("decision" in result);
    assert.equal(result.decision, "fixed-stop");
    assert.equal(result.reason, "invalid-budget");
  }

  const overflow = reserveExecutionBudget({
    executionBudget: executionBudget(MAX_INTEGER_MICROS.toString()),
    reservationRef: "reservation:sum-overflow",
    attempts: [
      attempt(0, { reservedCostMicros: MAX_INTEGER_MICROS.toString() }),
      attempt(1, { reservedCostMicros: "1" }),
    ],
  });
  assert.ok("decision" in overflow);
  assert.equal(overflow.decision, "fixed-stop");
  assert.equal(overflow.reason, "invalid-budget");
});

test("uses exact integer cost ceilings and the smallest remaining cap", () => {
  const exact = reserve(executionBudget("200"));
  assert.equal(exact.totalReservedMicros, "200");

  const budget = executionBudget("500");
  budget.interactionRemainingMicros = "199";
  const over = reserveExecutionBudget({
    executionBudget: budget,
    reservationRef: "reservation:one-micro-over",
    attempts: [attempt(0), attempt(1)],
  });
  assert.ok("decision" in over);
  assert.equal(over.decision, "reviewed-static-fallback");
  assert.equal(over.reason, "budget-exhausted");
});

test("reserves an immutable route attempt plan without a catalog re-read", () => {
  const original = reserve();
  const result = reserveCommercialRouteAttemptPlan({
    executionBudget: executionBudget(),
    reservationRef: "reservation:route-plan-snapshot",
    routeAttemptPlan: {
      contractVersion: COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION,
      routePlanRef: "route-plan:budget-resilience-001",
      logicalOperationRef: original.logicalOperationRef,
      attempts: original.attempts,
      totalReservedCostMicros: original.totalReservedMicros,
    },
    eligibilityClassRef: "eligibility:minor-heightened-us-reviewed-v1",
    failoverBackoffMs: 50,
  });
  assert.ok("status" in result);
  assert.deepEqual(result.attempts, original.attempts);
  assert.equal(result.totalReservedMicros, original.totalReservedMicros);
});

test("rejects negative and unsafe integer millisecond values", () => {
  const negativeTimeout = reserveExecutionBudget({
    executionBudget: executionBudget(),
    reservationRef: "reservation:negative-time",
    attempts: [attempt(0, { timeoutMs: -1 })],
  });
  assert.ok("decision" in negativeTimeout);
  assert.equal(negativeTimeout.decision, "fixed-stop");

  const input = decisionInput();
  input.latencyBudget.elapsedMs = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(decideFallback(input).decision, "fixed-stop");
});

test("admits the exact deadline boundary and rejects one millisecond over", () => {
  const exact = decideFallback(decisionInput());
  assert.equal(exact.decision, "commercial-failover");

  const over = decideFallback(
    decisionInput({ latencyBudget: latencyBudget(499) }),
  );
  assert.equal(over.decision, "reviewed-static-fallback");
  assert.equal(over.reason, "deadline-exhausted");
});

test("never retries after attempt exhaustion or outside the physical bound", () => {
  const exhausted = decideFallback(decisionInput({ attemptsCompleted: 2 }));
  assert.equal(exhausted.decision, "reviewed-static-fallback");
  assert.equal(exhausted.reason, "retry-exhausted");

  const invalidPolicy = retryPolicy() as unknown as Record<string, unknown>;
  invalidPolicy.maximumPhysicalAttempts = 3;
  const invalid = decisionInput();
  invalid.retryPolicy = invalidPolicy as unknown as RetryPolicy;
  assert.equal(decideFallback(invalid).decision, "fixed-stop");
});

test("rate limit fails over once without sleeping on the limited route", () => {
  const input = decisionInput({ attemptsCompleted: 0 });
  input.failure = {
    kind: "rate-limit",
    retryAfterMs: Number.MAX_SAFE_INTEGER,
    indeterminatePrimaryReserveHeld: false,
  };
  const decision = decideFallback(input);
  assert.equal(decision.decision, "commercial-failover");
  assert.equal(decision.reason, "rate-limit");
  if (decision.decision === "commercial-failover") {
    assert.equal(decision.attempt.attemptIndex, 1);
  }
});

test("provider timeout retains its full reservation before failover", () => {
  const reservation = reserve();
  assert.deepEqual(
    settleBudgetReservation(reservation, "indeterminate-hold", null),
    {
      contractVersion: BUDGET_RESILIENCE_VERSION,
      reservationRef: reservation.reservationRef,
      logicalOperationRef: reservation.logicalOperationRef,
      outcome: "indeterminate-hold",
      actualCostMicros: null,
      consumedCostMicros: "200",
      releasedCostMicros: "0",
      accountingGap: true,
      costAnomaly: false,
    },
  );

  const unsafe = decisionInput();
  unsafe.failure.indeterminatePrimaryReserveHeld = false;
  const fallback = decideFallback(unsafe);
  assert.equal(fallback.decision, "reviewed-static-fallback");
  assert.equal(fallback.reason, "failover-not-pre-reserved");
});

test("provider outage fails over only to an equally eligible route", () => {
  const eligible = decisionInput({ attemptsCompleted: 0 });
  eligible.failure = {
    kind: "provider-outage",
    retryAfterMs: null,
    indeterminatePrimaryReserveHeld: false,
  };
  assert.equal(decideFallback(eligible).decision, "commercial-failover");

  const weaker = decisionInput({ attemptsCompleted: 0 });
  weaker.failure = eligible.failure;
  assert.ok(weaker.failoverAttempt);
  weaker.failoverAttempt.eligibilityClassRef = "eligibility:weaker-policy-v1";
  const fallback = decideFallback(weaker);
  assert.equal(fallback.decision, "reviewed-static-fallback");
  assert.equal(fallback.reason, "failover-not-equally-eligible");

  const downgraded = decisionInput({ attemptsCompleted: 0 });
  downgraded.failure = eligible.failure;
  assert.ok(downgraded.failoverAttempt);
  downgraded.failoverAttempt.hardConstraintsSatisfied = false;
  const hardConstraintFallback = decideFallback(downgraded);
  assert.equal(hardConstraintFallback.decision, "reviewed-static-fallback");
  assert.equal(
    hardConstraintFallback.reason,
    "failover-not-equally-eligible",
  );
});

test("forbids same-route retries even for retryable failures", () => {
  const input = decisionInput();
  assert.ok(input.failoverAttempt);
  input.failoverAttempt.routeRef = input.primaryAttempt.routeRef;
  const fallback = decideFallback(input);
  assert.equal(fallback.decision, "reviewed-static-fallback");
  assert.equal(fallback.reason, "same-route-retry-forbidden");
});

test("terminal provider and Study policy failures do not retry", () => {
  for (const kind of [
    "provider-response-invalid",
    "provider-response-policy-rejected",
  ] as const) {
    const input = decisionInput();
    input.failure.kind = kind;
    const fallback = decideFallback(input);
    assert.equal(fallback.decision, "reviewed-static-fallback");
    assert.equal(fallback.reason, kind);
  }
});

test("circuit closed uses exact integer ratio thresholds deterministically", () => {
  const input = {
    state: {
      state: "closed",
      windowStartedAtMs: 0,
      sampleCount: 1,
      failureCount: 0,
      consecutiveFailureCount: 0,
    },
    policy: breakerPolicy(),
    nowMs: 10,
    storageAvailable: true,
    requestKind: "learner-dispatch",
    signal: "provider-outage",
  };
  const first = evaluateCircuitBreaker(input);
  const second = evaluateCircuitBreaker(structuredClone(input));
  assert.deepEqual(first, second);
  assert.equal(first.action, "deny-commercial-route");
  assert.equal(first.reason, "circuit-opened-by-threshold");
  assert.equal(first.nextState.state, "open");
});

test("circuit open never admits learner traffic before its boundary", () => {
  const decision = evaluateCircuitBreaker({
    state: { state: "open", openedAtMs: 10, reopenAtMs: 110 },
    policy: breakerPolicy(),
    nowMs: 109,
    storageAvailable: true,
    requestKind: "learner-dispatch",
    signal: "none",
  });
  assert.equal(decision.action, "deny-commercial-route");
  assert.equal(decision.reason, "circuit-open");
  assert.equal(decision.nextState.state, "open");
});

test("circuit half-open admits one dedicated probe and never a learner probe", () => {
  const open = { state: "open", openedAtMs: 10, reopenAtMs: 110 } as const;
  const learner = evaluateCircuitBreaker({
    state: open,
    policy: breakerPolicy(),
    nowMs: 110,
    storageAvailable: true,
    requestKind: "learner-dispatch",
    signal: "none",
  });
  assert.equal(learner.reason, "circuit-half-open-learner-denied");
  assert.equal(learner.nextState.state, "half-open");

  const probe = evaluateCircuitBreaker({
    state: learner.nextState,
    policy: breakerPolicy(),
    nowMs: 110,
    storageAvailable: true,
    requestKind: "dedicated-probe",
    signal: "none",
  });
  assert.equal(probe.action, "allow-dedicated-probe");
  assert.equal(probe.reason, "circuit-half-open-probe-authorized");

  const secondProbe = evaluateCircuitBreaker({
    state: probe.nextState,
    policy: breakerPolicy(),
    nowMs: 110,
    storageAvailable: true,
    requestKind: "dedicated-probe",
    signal: "none",
  });
  assert.equal(secondProbe.action, "deny-commercial-route");
  assert.equal(secondProbe.reason, "circuit-half-open-probe-leased");

  const learnerCannotReportProbeSuccess = evaluateCircuitBreaker({
    state: probe.nextState,
    policy: breakerPolicy(),
    nowMs: 110,
    storageAvailable: true,
    requestKind: "learner-dispatch",
    signal: "provider-success",
  });
  assert.equal(
    learnerCannotReportProbeSuccess.reason,
    "circuit-half-open-learner-denied",
  );
  assert.equal(learnerCannotReportProbeSuccess.nextState.state, "half-open");
});

test("circuit closes only after the configured successful probe", () => {
  const decision = evaluateCircuitBreaker({
    state: {
      state: "half-open",
      successfulProbeCount: 0,
      probeLeaseAvailable: false,
    },
    policy: breakerPolicy(),
    nowMs: 120,
    storageAvailable: true,
    requestKind: "dedicated-probe",
    signal: "provider-success",
  });
  assert.equal(decision.reason, "circuit-closed-after-probes");
  assert.equal(decision.nextState.state, "closed");
});

test("failover requires an immutable pre-reserved cost slot", () => {
  const budget = executionBudget();
  const input = decisionInput({
    executionBudget: budget,
    reservation: reserve(budget, [attempt(0)]),
  });
  const fallback = decideFallback(input);
  assert.equal(fallback.decision, "reviewed-static-fallback");
  assert.equal(fallback.reason, "failover-not-pre-reserved");
});

test("reservation rejects duplicate physical attempt references", () => {
  const primary = attempt(0);
  const failover = attempt(1, { physicalAttemptRef: primary.physicalAttemptRef });
  const result = reserveExecutionBudget({
    executionBudget: executionBudget(),
    reservationRef: "reservation:duplicate-physical-attempt",
    attempts: [primary, failover],
  });
  assert.ok("decision" in result);
  assert.equal(result.decision, "fixed-stop");
});

test("cost over reservation becomes an anomaly without fabricated release", () => {
  const settlement = settleBudgetReservation(reserve(), "settled", "201");
  assert.ok(settlement);
  assert.equal(settlement.outcome, "rejected-over-reservation");
  assert.equal(settlement.costAnomaly, true);
  assert.equal(settlement.releasedCostMicros, "0");

  const inconsistent = structuredClone(reserve());
  inconsistent.totalReservedMicros = "199";
  assert.equal(settleBudgetReservation(inconsistent, "settled", "100"), null);
});

test("budget exhaustion selects only the trusted reviewed static fallback", () => {
  const exhausted = reserveExecutionBudget({
    executionBudget: executionBudget("199"),
    reservationRef: "reservation:budget-exhausted",
    attempts: [attempt(0), attempt(1)],
  });
  assert.deepEqual(exhausted, {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    decision: "reviewed-static-fallback",
    reason: "budget-exhausted",
    fallback: executionBudget("199").reviewedStaticFallback,
  });

  const noAttempts = reserveExecutionBudget({
    executionBudget: executionBudget("300", 0),
    reservationRef: "reservation:no-attempt-budget",
    attempts: [],
  });
  assert.ok("decision" in noAttempts);
  assert.equal(noAttempts.decision, "reviewed-static-fallback");
  assert.equal(noAttempts.reason, "budget-exhausted");

  const hostile = {
    executionBudget: {
      ...executionBudget("199"),
      reviewedStaticFallback: {
        ...executionBudget("199").reviewedStaticFallback,
        attackerContentRef: "reviewed-content:attacker-selected",
      },
    },
    reservationRef: "reservation:hostile-fallback",
    attempts: [attempt(0), attempt(1)],
  };
  const stopped = reserveExecutionBudget(hostile);
  assert.ok("decision" in stopped);
  assert.equal(stopped.decision, "fixed-stop");
  assert.equal(JSON.stringify(stopped).includes("attacker-selected"), false);
});

test("open failover circuits and unavailable breaker storage fail closed", () => {
  const input = decisionInput({
    failoverCircuitState: { state: "open", openedAtMs: 0, reopenAtMs: 100 },
  });
  const fallback = decideFallback(input);
  assert.equal(fallback.reason, "failover-circuit-not-closed");

  const breaker = evaluateCircuitBreaker({
    state: closedCircuit(),
    policy: breakerPolicy(),
    nowMs: 0,
    storageAvailable: false,
    requestKind: "learner-dispatch",
    signal: "none",
  });
  assert.equal(breaker.action, "deny-commercial-route");
  assert.equal(breaker.reason, "circuit-storage-unavailable");
});
