import assert from "node:assert/strict";
import test from "node:test";
import {
  executeCommercialTutorInvocation,
} from "../../../core/v3/commercial-operation/orchestrate.js";
import {
  createTrustedProviderProfileRegistry,
  type ProviderEligibilityRequirements,
  type TrustedProviderProfile,
} from "../../../core/v3/provider-policy/index.js";
import {
  BUDGET_RESILIENCE_VERSION,
  MAX_INTEGER_MICROS,
  decideFallback,
  reserveExecutionBudget,
  type AttemptBudget,
  type BudgetReservation,
  type ExecutionBudget,
  type ResilienceDecisionInput,
} from "../../../core/v3/routing/budget-resilience/index.js";
import {
  MODEL_CAPABILITY_PROFILE_VERSION,
  PROVIDER_AVAILABILITY_STATE_VERSION,
  PROVIDER_CAPABILITY_PROFILE_VERSION,
  ROUTING_REQUEST_VERSION,
  createEligibleRouteCatalog,
  routeProviderModel,
  type ModelCapabilityProfile,
  type ProviderAvailabilityState,
  type ProviderCapabilityProfile,
  type RoutingRequest,
} from "../../../core/v3/routing/provider-routing/index.js";
import {
  ScriptedCommercialTransport,
  executionInput,
  successfulProviderResponse,
} from "../../../tests/tutor-v3-convergence/fixtures.js";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const INT64_MAX = MAX_INTEGER_MICROS.toString();
const CONFIG_DIGEST = `sha256:${"a".repeat(64)}`;
const PROFILE_DIGEST = `sha256:${"b".repeat(64)}`;

function suffix(index: number): string {
  return `p${index.toString().padStart(4, "0")}`;
}

function provider(
  index = 0,
  overrides: Partial<ProviderCapabilityProfile> = {},
): ProviderCapabilityProfile {
  const id = suffix(index);
  return {
    profileVersion: PROVIDER_CAPABILITY_PROFILE_VERSION,
    providerRef: `provider-profile:${id}`,
    providerClass: "ZERO_RETENTION",
    lifecycle: "ACTIVE",
    modelRefs: [`model-profile:${id}`],
    minimumTimeoutMs: 1,
    maximumTimeoutMs: 100,
    ...overrides,
  };
}

function model(
  index = 0,
  overrides: Partial<ModelCapabilityProfile> = {},
): ModelCapabilityProfile {
  const id = suffix(index);
  return {
    profileVersion: MODEL_CAPABILITY_PROFILE_VERSION,
    modelRef: `model-profile:${id}`,
    modelRevisionRef: `model-revision:${id}`,
    configurationDigest: CONFIG_DIGEST,
    capabilityProfileRevisionRef: `capability-profile:${id}`,
    capabilityProfileDigest: PROFILE_DIGEST,
    modelClass: "BALANCED_TEXT",
    providerRef: `provider-profile:${id}`,
    routeRef: `route-profile:${id}`,
    lifecycle: "ACTIVE",
    actionFamilies: ["HINT"],
    subjectCapabilities: ["SYMBOLIC_REASONING"],
    learnerStages: ["MIDDLE_GRADES"],
    safetyCapabilities: ["MINOR_HEIGHTENED"],
    multimodalCapabilities: ["TEXT_ONLY"],
    reviewedContentSupport: "PROVIDED_REVIEWED_GROUNDING",
    maximumContextTokens: 1_000,
    maximumOutputTokens: 100,
    estimatedLatencyMs: 10,
    attemptTimeoutMs: 10,
    worstCaseCostMicros: "1",
    ...overrides,
  };
}

function policyProfile(index = 0, eligible = true): TrustedProviderProfile {
  const id = suffix(index);
  return {
    providerRef: `provider-profile:${id}`,
    trainingUse: eligible ? "prohibited" : "allowed",
    retention: { class: "none", maximumDurationHours: 0 },
    minorDataEligibility: "supported",
    dataResidency: { approvedRegions: ["us-east"] },
    dataDeletionCapability: "supported",
    multimodalEligibility: "approved",
    contractPolicyRevision: "provider-policy-revision:resource-r1",
    policyEvidenceRef: `provider-policy-evidence:${id}`,
    policyEvidenceValidUntil: "2027-01-01T00:00:00.000Z",
    status: "active",
  };
}

function policyRequirement(index = 0): ProviderEligibilityRequirements {
  return {
    providerRef: `provider-profile:${suffix(index)}`,
    allowedRetentionClasses: ["none"],
    maximumRetentionHours: 0,
    requiredRegion: "us-east",
    modality: "text",
    requiredContractPolicyRevision: "provider-policy-revision:resource-r1",
    evaluatedAt: "2026-08-15T16:00:00.000Z",
  };
}

function availability(index = 0): ProviderAvailabilityState {
  const id = suffix(index);
  return {
    stateVersion: PROVIDER_AVAILABILITY_STATE_VERSION,
    availabilityRef: `availability:${id}`,
    providerRef: `provider-profile:${id}`,
    modelRef: `model-profile:${id}`,
    modelRevisionRef: `model-revision:${id}`,
    state: "AVAILABLE",
  };
}

function catalog(
  providers: readonly ProviderCapabilityProfile[],
  models: readonly ModelCapabilityProfile[],
  profiles: readonly TrustedProviderProfile[] = providers.map((_, index) => policyProfile(index)),
  requirements: readonly ProviderEligibilityRequirements[] = providers.map((_, index) => policyRequirement(index)),
) {
  return createEligibleRouteCatalog({
    providerProfiles: providers,
    modelProfiles: models,
    providerPolicyRegistry: createTrustedProviderProfileRegistry(profiles),
    providerPolicyRequirements: requirements,
  });
}

function routingRequest(overrides: Partial<RoutingRequest> = {}): RoutingRequest {
  return {
    requestVersion: ROUTING_REQUEST_VERSION,
    requestRef: "routing-request:resource-abuse",
    routePlanRef: "route-plan:resource-abuse",
    logicalOperationRef: "logical-operation:resource-abuse",
    physicalAttemptRefs: [
      "physical-attempt:resource-primary",
      "physical-attempt:resource-failover",
    ],
    actionFamily: "HINT",
    subjectCapability: "SYMBOLIC_REASONING",
    learnerStage: "MIDDLE_GRADES",
    contextSizeRequirement: { inputTokens: 0, requiredOutputTokens: 1 },
    safetyRequirement: "MINOR_HEIGHTENED",
    latencyCeilingMs: 100,
    costCeilingMicros: "2",
    reviewedContentRequirement: "PROVIDER_REVIEWED_GROUNDING_REQUIRED",
    multimodalRequirement: "TEXT_ONLY",
    providerAvailability: [availability()],
    studyPermissionBoundary: {
      permissionRef: "study-permission:resource-abuse",
      authorizedActionFamily: "HINT",
      routingMayWidenPermissions: false,
      routingMayChangeMastery: false,
      routingMayChangeGrade: false,
      routingMayChangeWorkingLevel: false,
      routingMayChangeCurriculum: false,
    },
    staticFallbackPolicyRef: "fallback-policy:resource-abuse",
    ...overrides,
  };
}

function executionBudget(
  ceiling = "2",
  maximumPhysicalAttempts: 0 | 1 | 2 = 2,
): ExecutionBudget {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    logicalOperationRef: "logical-operation:resource-abuse",
    currency: "USD",
    operationMaximumMicros: ceiling,
    interactionRemainingMicros: ceiling,
    householdPeriodRemainingMicros: ceiling,
    platformPeriodRemainingMicros: ceiling,
    maximumPhysicalAttempts,
    reviewedStaticFallback: {
      selection: "reviewed-content-by-trusted-study-ref",
      policyRef: "fallback-policy:resource-abuse",
      reviewedContentRef: "reviewed-content:resource-abuse",
      reviewRef: "review:resource-abuse",
    },
  };
}

function attempt(
  attemptIndex: 0 | 1,
  overrides: Partial<AttemptBudget> = {},
): AttemptBudget {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    logicalOperationRef: "logical-operation:resource-abuse",
    physicalAttemptRef: `physical-attempt:resource-${attemptIndex}`,
    attemptIndex,
    role: attemptIndex === 0 ? "primary" : "failover",
    routeRef: `route-profile:resource-${attemptIndex}`,
    providerRef: `provider-profile:resource-${attemptIndex}`,
    modelRef: `model-profile:resource-${attemptIndex}`,
    modelRevisionRef: `model-revision:resource-${attemptIndex}`,
    configurationDigest: CONFIG_DIGEST,
    capabilityProfileRevisionRef: `capability-profile:resource-${attemptIndex}`,
    capabilityProfileDigest: PROFILE_DIGEST,
    providerPolicyRevisionRef: "provider-policy-revision:resource-r1",
    providerPolicyEvidenceRef: `provider-policy-evidence:resource-${attemptIndex}`,
    eligibilityClassRef: "eligibility:resource-abuse",
    hardConstraintsSatisfied: true,
    reservedCostMicros: "1",
    timeoutMs: 300,
    backoffBeforeMs: attemptIndex === 0 ? 0 : 50,
    ...overrides,
  };
}

function reservation(): BudgetReservation {
  const value = reserveExecutionBudget({
    executionBudget: executionBudget(),
    reservationRef: "reservation:resource-abuse",
    attempts: [attempt(0), attempt(1)],
  });
  assert.ok("status" in value);
  return value;
}

function fallbackInput(overrides: Partial<ResilienceDecisionInput> = {}): ResilienceDecisionInput {
  return {
    executionBudget: executionBudget(),
    reservation: reservation(),
    latencyBudget: {
      contractVersion: BUDGET_RESILIENCE_VERSION,
      endToEndDeadlineMs: 500,
      deterministicReserveMs: 50,
      elapsedMs: 100,
    },
    retryPolicy: {
      contractVersion: BUDGET_RESILIENCE_VERSION,
      maximumPhysicalAttempts: 2,
      maximumSameRouteRetries: 0,
      retryableFailures: ["provider-timeout"],
      backoffMs: 50,
      requireFreshAvailability: true,
      requireEqualHardEligibility: true,
      requireRemainingDeadlineAndBudget: true,
      retainFullReserveOnIndeterminateTimeout: true,
    },
    attemptsCompleted: 1,
    primaryAttempt: attempt(0),
    failoverAttempt: attempt(1),
    failure: {
      kind: "provider-timeout",
      retryAfterMs: null,
      indeterminatePrimaryReserveHeld: true,
    },
    failoverAvailability: "eligible",
    failoverCircuitState: {
      state: "closed",
      windowStartedAtMs: 0,
      sampleCount: 0,
      failureCount: 0,
      consecutiveFailureCount: 0,
    },
    ...overrides,
  };
}

test("cost grammar and signed-int64 arithmetic fail closed", () => {
  const valid = [
    "0",
    "1",
    MAX_SAFE.toString(),
    (BigInt(MAX_SAFE) + 1n).toString(),
    (MAX_INTEGER_MICROS - 1n).toString(),
    INT64_MAX,
  ];
  for (const micros of valid) {
    const result = reserveExecutionBudget({
      executionBudget: executionBudget(micros, 1),
      reservationRef: `reservation:valid-${micros}`,
      attempts: [attempt(0, { reservedCostMicros: micros })],
    });
    assert.ok("status" in result, micros);
    assert.equal(result.totalReservedMicros, micros);
  }

  for (const micros of [
    (MAX_INTEGER_MICROS + 1n).toString(),
    "01",
    "-1",
    "1.0",
    "1e3",
  ]) {
    const result = reserveExecutionBudget({
      executionBudget: executionBudget(micros, 1),
      reservationRef: "reservation:invalid-money",
      attempts: [attempt(0, { reservedCostMicros: micros })],
    });
    assert.deepEqual(
      ["decision" in result ? result.decision : null, "reason" in result ? result.reason : null],
      ["fixed-stop", "invalid-budget"],
      micros,
    );
  }

  const overflow = reserveExecutionBudget({
    executionBudget: executionBudget(INT64_MAX),
    reservationRef: "reservation:sum-overflow",
    attempts: [
      attempt(0, { reservedCostMicros: INT64_MAX }),
      attempt(1, { reservedCostMicros: "1" }),
    ],
  });
  assert.equal("decision" in overflow ? overflow.decision : null, "fixed-stop");
});

test("latency boundaries, unsafe integers, overflow, and consumed backoff fail deterministically", () => {
  const below = fallbackInput();
  below.latencyBudget.endToEndDeadlineMs = 499;
  assert.equal(decideFallback(below).reason, "deadline-exhausted");

  const exact = fallbackInput();
  exact.latencyBudget.endToEndDeadlineMs = 500;
  assert.equal(decideFallback(exact).decision, "commercial-failover");

  const above = fallbackInput();
  above.latencyBudget.endToEndDeadlineMs = 501;
  assert.equal(decideFallback(above).decision, "commercial-failover");

  const zero = fallbackInput();
  zero.latencyBudget.endToEndDeadlineMs = 0;
  assert.equal(decideFallback(zero).reason, "deadline-exhausted");

  const veryLarge = fallbackInput();
  veryLarge.latencyBudget.elapsedMs = MAX_SAFE;
  veryLarge.latencyBudget.endToEndDeadlineMs = MAX_SAFE;
  assert.equal(decideFallback(veryLarge).reason, "deadline-exhausted");

  const unsafe = fallbackInput();
  unsafe.latencyBudget.elapsedMs = MAX_SAFE + 1;
  assert.equal(decideFallback(unsafe).decision, "fixed-stop");

  const backoffConsumesWindow = fallbackInput();
  backoffConsumesWindow.latencyBudget.endToEndDeadlineMs = 499;
  backoffConsumesWindow.latencyBudget.elapsedMs = 100;
  assert.equal(decideFallback(backoffConsumesWindow).reason, "deadline-exhausted");
});

test("clock regression and deadline overflow stop before transport execution", () => {
  const transport = new ScriptedCommercialTransport([{
    status: "response",
    response: successfulProviderResponse(),
  }]);
  const regressionInput = executionInput(transport);
  const readings = [100, 99];
  const regression = executeCommercialTutorInvocation({
    ...regressionInput,
    clock: { nowMs: () => readings.shift() ?? 99 },
  });
  assert.equal(regression.status, "static-fallback");
  assert.equal(regression.providerCalls, 0);

  const overflowTransport = new ScriptedCommercialTransport([{
    status: "response",
    response: successfulProviderResponse(),
  }]);
  const overflowInput = executionInput(overflowTransport);
  const deadlineOverflow = executeCommercialTutorInvocation({
    ...overflowInput,
    clock: { nowMs: () => MAX_SAFE },
  });
  assert.equal(deadlineOverflow.status, "static-fallback");
  assert.equal(deadlineOverflow.providerCalls, 0);
});

test("catalog work is deterministic at the 64-profile boundary", () => {
  const providers = Array.from({ length: 64 }, (_, index) => provider(index));
  const models = Array.from({ length: 64 }, (_, index) => model(index));
  const profiles = Array.from({ length: 64 }, (_, index) => policyProfile(index));
  const requirements = Array.from({ length: 64 }, (_, index) => policyRequirement(index));
  const availabilityStates = Array.from({ length: 64 }, (_, index) => availability(index));
  const large = catalog(providers, models, profiles, requirements);
  assert.ok(large);
  assert.deepEqual(
    [large.eligibleProviderCount, large.eligibleRouteCount],
    [64, 64],
  );

  const decision = routeProviderModel(
    routingRequest({ providerAvailability: availabilityStates }),
    large,
  );
  assert.equal(decision.status, "ROUTE_SELECTED");
  if (decision.status === "ROUTE_SELECTED") {
    assert.equal(decision.routeAttemptPlan.attempts[0]?.providerRef, "provider-profile:p0000");
    assert.equal(decision.routeAttemptPlan.attempts.length, 2);
  }

  assert.equal(catalog([...providers, provider(64)], models), null);
  assert.equal(catalog(providers, [...models, model(64)]), null);
});

test("empty, one-provider, ineligible, tie, and duplicate catalogs stay bounded", () => {
  const empty = catalog([provider()], [model()], [policyProfile(0, false)]);
  assert.ok(empty);
  assert.deepEqual([empty.eligibleProviderCount, empty.eligibleRouteCount], [0, 0]);
  assert.equal(routeProviderModel(routingRequest(), empty).status, "NO_ELIGIBLE_PROVIDER_ROUTE");

  const one = catalog([provider()], [model()]);
  assert.ok(one);
  assert.equal(routeProviderModel(routingRequest(), one).status, "ROUTE_SELECTED");

  const ineligibleProfiles = Array.from(
    { length: 64 },
    (_, index) => policyProfile(index, false),
  );
  const largeIneligible = catalog(
    Array.from({ length: 64 }, (_, index) => provider(index)),
    Array.from({ length: 64 }, (_, index) => model(index)),
    ineligibleProfiles,
    Array.from({ length: 64 }, (_, index) => policyRequirement(index)),
  );
  assert.ok(largeIneligible);
  assert.equal(largeIneligible.eligibleRouteCount, 0);

  const tied = catalog([provider(1), provider(0)], [model(1), model(0)]);
  assert.ok(tied);
  const tiedDecision = routeProviderModel(
    routingRequest({ providerAvailability: [availability(1), availability(0)] }),
    tied,
  );
  assert.equal(tiedDecision.status, "ROUTE_SELECTED");
  if (tiedDecision.status === "ROUTE_SELECTED") {
    assert.equal(tiedDecision.routeAttemptPlan.attempts[0]?.providerRef, "provider-profile:p0000");
  }

  assert.equal(catalog([provider(), provider()], [model()]), null);
  assert.equal(catalog([provider()], [model(), model()]), null);
  assert.equal(
    catalog(
      [provider(0), provider(1)],
      [model(0), model(1, { routeRef: model(0).routeRef })],
    ),
    null,
  );
});

test("token and context requests stop at exact structural ceilings", () => {
  const trusted = catalog([provider()], [model()]);
  assert.ok(trusted);

  const zeroInput = routeProviderModel(
    routingRequest({ contextSizeRequirement: { inputTokens: 0, requiredOutputTokens: 1 } }),
    trusted,
  );
  assert.equal(zeroInput.status, "ROUTE_SELECTED");

  const exact = routeProviderModel(
    routingRequest({ contextSizeRequirement: { inputTokens: 900, requiredOutputTokens: 100 } }),
    trusted,
  );
  assert.equal(exact.status, "ROUTE_SELECTED");

  for (const contextSizeRequirement of [
    { inputTokens: 900, requiredOutputTokens: 0 },
    { inputTokens: 901, requiredOutputTokens: 100 },
    { inputTokens: 899, requiredOutputTokens: 101 },
    { inputTokens: 0, requiredOutputTokens: MAX_SAFE },
    { inputTokens: 0, requiredOutputTokens: MAX_SAFE + 1 },
  ]) {
    assert.equal(
      routeProviderModel(routingRequest({ contextSizeRequirement }), trusted).status,
      "NO_ELIGIBLE_PROVIDER_ROUTE",
      JSON.stringify(contextSizeRequirement),
    );
  }
});

test("attempt expansion, duplicate references, and same-route failover are rejected", () => {
  const trusted = catalog([provider()], [model()]);
  assert.ok(trusted);
  const duplicate = "physical-attempt:duplicate";
  assert.equal(
    routeProviderModel(
      routingRequest({ physicalAttemptRefs: [duplicate, duplicate] }),
      trusted,
    ).status,
    "NO_ELIGIBLE_PROVIDER_ROUTE",
  );
  assert.equal(
    routeProviderModel(
      routingRequest({
        physicalAttemptRefs: [
          "physical-attempt:first",
          "physical-attempt:second",
          "physical-attempt:third",
        ],
      }),
      trusted,
    ).status,
    "NO_ELIGIBLE_PROVIDER_ROUTE",
  );

  const duplicateReservationAttempt = reserveExecutionBudget({
    executionBudget: executionBudget(),
    reservationRef: "reservation:duplicate-attempt",
    attempts: [
      attempt(0, { physicalAttemptRef: duplicate }),
      attempt(1, { physicalAttemptRef: duplicate }),
    ],
  });
  assert.equal(
    "decision" in duplicateReservationAttempt ? duplicateReservationAttempt.decision : null,
    "fixed-stop",
  );

  const thirdAttempt = reserveExecutionBudget({
    executionBudget: executionBudget(),
    reservationRef: "reservation:third-attempt",
    attempts: [
      attempt(0),
      attempt(1),
      { ...attempt(1), physicalAttemptRef: "physical-attempt:third" },
    ],
  });
  assert.equal("decision" in thirdAttempt ? thirdAttempt.decision : null, "fixed-stop");

  const sameRoute = fallbackInput();
  assert.ok(sameRoute.failoverAttempt);
  sameRoute.failoverAttempt.routeRef = sameRoute.primaryAttempt.routeRef;
  assert.equal(decideFallback(sameRoute).reason, "same-route-retry-forbidden");
});

test("[BLOCKER RA-01] provider-policy requirement cardinality is not bounded", () => {
  const requirements = Array.from(
    { length: 4_096 },
    (_, index) => policyRequirement(index),
  );
  const result = catalog([provider()], [model()], [policyProfile()], requirements);
  assert.ok(result, "the current boundary traverses and maps all 4,096 entries");
  assert.equal(result.eligibleRouteCount, 1);

  const nestedRequirement = {
    ...policyRequirement(),
    allowedRetentionClasses: Array.from(
      { length: 4_096 },
      () => "none" as const,
    ),
  };
  const nested = catalog([provider()], [model()], [policyProfile()], [nestedRequirement]);
  assert.ok(nested, "the nested requirement list is also traversed without a cap");
});

test("[BLOCKER RA-02] duplicate reservation identity replays commercial execution", () => {
  const firstTransport = new ScriptedCommercialTransport([{
    status: "response",
    response: successfulProviderResponse(),
  }]);
  const secondTransport = new ScriptedCommercialTransport([{
    status: "response",
    response: successfulProviderResponse(),
  }]);
  const first = executeCommercialTutorInvocation(executionInput(firstTransport));
  const replay = executeCommercialTutorInvocation(executionInput(secondTransport));

  assert.equal(first.status, "advisory");
  assert.equal(replay.status, "advisory");
  assert.equal(first.providerCalls + replay.providerCalls, 2);
  assert.equal(firstTransport.contexts[0]?.reservationRef, "reservation:commercial-one");
  assert.equal(secondTransport.contexts[0]?.reservationRef, "reservation:commercial-one");
});
