import {
  executeCommercialTutorInvocation,
  type CommercialTutorExecutionInput,
  type CommercialTutorExecutionResult,
} from "../../../core/v3/commercial-operation/orchestrate.js";
import type { ProviderAvailabilityState } from "../../../core/v3/routing/provider-routing/index.js";
import {
  BUDGET_RESILIENCE_VERSION,
  evaluateCircuitBreaker,
} from "../../../core/v3/routing/budget-resilience/index.js";
import { evaluateProviderEligibility } from "../../../core/v3/provider-policy/index.js";
import {
  executionInput,
  successfulProviderResponse,
} from "../../../tests/tutor-v3-convergence/fixtures.js";
import {
  ProviderChaosAdapter,
  type ProviderChaosFault,
  type ProviderChaosStep,
} from "./adapter.js";

export type CertificationExpectedOutcome = "advisory" | "static-fallback";

interface FaultCaseDefinition {
  readonly id: string;
  readonly fault: ProviderChaosFault | "failover-unavailable" | "both-providers-unavailable" | "circuit-open";
  readonly steps: readonly ProviderChaosStep[];
  readonly expectedOutcome: CertificationExpectedOutcome;
  readonly expectedProviderCalls: number;
  readonly availability?: "failover-unavailable" | "both-unavailable" | "circuit-open";
  readonly transition?: "failover-becomes-unavailable" | "failover-circuit-opens" | "policy-revoked";
}

export interface ProviderChaosMatrixRow {
  readonly id: string;
  readonly fault: FaultCaseDefinition["fault"];
  readonly expectedOutcome: CertificationExpectedOutcome;
  readonly observedOutcome: CommercialTutorExecutionResult["status"];
  readonly expectedProviderCalls: number;
  readonly observedProviderCalls: number;
  readonly adapterBoundaryCalls: number;
  readonly providerDispatchCount: number;
  readonly calledRoutes: readonly string[];
  readonly attemptsFrozenAtBoundary: readonly boolean[];
  readonly mutationApplied: boolean;
  readonly trustedStateTransitionApplied: boolean;
  readonly noThirdAttempt: boolean;
  readonly noUnplannedRetry: boolean;
  readonly noSameRouteRetry: boolean;
  readonly noLateSuccessAdvisory: boolean;
  readonly noMalformedResponseAdvisory: boolean;
  readonly noBudgetEscape: boolean;
  readonly noPolicyIneligibleFailover: boolean;
  readonly reviewedStaticFallbackAvailable: boolean;
  readonly passed: boolean;
}

export interface ProviderChaosCertification {
  readonly certificationVersion: 1;
  readonly aggregateStatus: "PASS" | "BLOCKER_FOUND";
  readonly totalFaults: number;
  readonly passedFaults: number;
  readonly failedFaults: number;
  readonly rows: readonly ProviderChaosMatrixRow[];
}

const CASES: readonly FaultCaseDefinition[] = [
  { id: "PC-01", fault: "provider-unavailable", steps: ["provider-unavailable", "success"], expectedOutcome: "advisory", expectedProviderCalls: 2 },
  { id: "PC-02", fault: "rate-limit", steps: ["rate-limit", "success"], expectedOutcome: "advisory", expectedProviderCalls: 2 },
  { id: "PC-03", fault: "timeout-before-dispatch", steps: ["timeout-before-dispatch", "success"], expectedOutcome: "advisory", expectedProviderCalls: 2 },
  { id: "PC-04", fault: "timeout-after-possible-dispatch", steps: ["timeout-after-possible-dispatch", "success"], expectedOutcome: "advisory", expectedProviderCalls: 2 },
  { id: "PC-05", fault: "very-late-success", steps: ["very-late-success"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-06", fault: "malformed-json-object", steps: ["malformed-json-object"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-07", fault: "unknown-response-field", steps: ["unknown-response-field"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-08", fault: "truncated-response", steps: ["truncated-response"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-09", fault: "duplicate-response", steps: ["duplicate-response"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-10", fault: "wrong-physical-attempt-ref", steps: ["wrong-physical-attempt-ref"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-11", fault: "wrong-route-identity", steps: ["wrong-route-identity"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-12", fault: "wrong-model-revision", steps: ["wrong-model-revision"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-13", fault: "wrong-configuration-digest", steps: ["wrong-configuration-digest"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-14", fault: "wrong-usage-receipt", steps: ["wrong-usage-receipt"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-15", fault: "negative-invalid-cost", steps: ["negative-invalid-cost"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-16", fault: "over-reservation-cost", steps: ["over-reservation-cost"], expectedOutcome: "static-fallback", expectedProviderCalls: 1 },
  { id: "PC-17", fault: "provider-reported-false-latency", steps: ["provider-reported-false-latency"], expectedOutcome: "static-fallback", expectedProviderCalls: 1, availability: "failover-unavailable" },
  { id: "PC-18", fault: "failover-unavailable", steps: ["provider-unavailable", "success"], expectedOutcome: "static-fallback", expectedProviderCalls: 1, transition: "failover-becomes-unavailable" },
  { id: "PC-19", fault: "both-providers-unavailable", steps: ["provider-unavailable", "provider-unavailable"], expectedOutcome: "static-fallback", expectedProviderCalls: 2 },
  { id: "PC-20", fault: "circuit-open", steps: ["provider-unavailable", "success"], expectedOutcome: "static-fallback", expectedProviderCalls: 1, transition: "failover-circuit-opens" },
  { id: "PC-21", fault: "policy-revoked-between-planning-and-execution", steps: ["success"], expectedOutcome: "static-fallback", expectedProviderCalls: 1, transition: "policy-revoked" },
] as const;

function withAvailability(
  input: CommercialTutorExecutionInput,
  availability: FaultCaseDefinition["availability"],
): CommercialTutorExecutionInput {
  if (availability === undefined) return input;
  const circuitOpen = availability === "circuit-open" &&
    evaluateCircuitBreaker({
      state: { state: "open", openedAtMs: 0, reopenAtMs: 1_000 },
      policy: {
        contractVersion: BUDGET_RESILIENCE_VERSION,
        windowMs: 1_000,
        minimumSampleCount: 2,
        failureRatioNumerator: 1,
        failureRatioDenominator: 2,
        consecutiveFailureThreshold: 2,
        openMs: 1_000,
        successfulHalfOpenProbeCount: 1,
      },
      nowMs: 100,
      storageAvailable: true,
      requestKind: "learner-dispatch",
      signal: "none",
    }).action === "deny-commercial-route";
  const states: ProviderAvailabilityState[] = input.routing.providerAvailability.map((state, index) => ({
    ...state,
    state: availability === "failover-unavailable"
      ? index === 1 ? "OUTAGE" : "AVAILABLE"
      : availability === "circuit-open" ? circuitOpen ? "DISABLED" : "AVAILABLE" : "OUTAGE",
  }));
  return {
    ...input,
    routing: {
      ...input.routing,
      providerAvailability: states,
    },
  };
}

function isFallback(result: CommercialTutorExecutionResult): boolean {
  return result.status === "static-fallback" &&
    result.advisory.status === "static-fallback-required";
}

function resultProviderCalls(result: CommercialTutorExecutionResult): number {
  return result.providerCalls;
}

function runCase(definition: FaultCaseDefinition): ProviderChaosMatrixRow {
  let inputAtBoundary: CommercialTutorExecutionInput | null = null;
  let trustedStateTransitionApplied = false;
  const adapter = new ProviderChaosAdapter({
    steps: definition.steps,
    successfulResponse: successfulProviderResponse(),
    beforeExecute: ({ boundaryCallIndex }) => {
      if (boundaryCallIndex !== 0 || inputAtBoundary === null) return;
      const currentInput: CommercialTutorExecutionInput = inputAtBoundary;
      if (definition.transition === "failover-becomes-unavailable") {
        const failover = currentInput.routing.providerAvailability[1];
        if (failover) {
          (failover as unknown as { state: string }).state = "OUTAGE";
          trustedStateTransitionApplied = failover.state === "OUTAGE";
        }
      } else if (definition.transition === "failover-circuit-opens") {
        trustedStateTransitionApplied = evaluateCircuitBreaker({
          state: { state: "open", openedAtMs: 0, reopenAtMs: 1_000 },
          policy: {
            contractVersion: BUDGET_RESILIENCE_VERSION,
            windowMs: 1_000,
            minimumSampleCount: 2,
            failureRatioNumerator: 1,
            failureRatioDenominator: 2,
            consecutiveFailureThreshold: 2,
            openMs: 1_000,
            successfulHalfOpenProbeCount: 1,
          },
          nowMs: 100,
          storageAvailable: true,
          requestKind: "learner-dispatch",
          signal: "none",
        }).action === "deny-commercial-route";
      } else if (definition.transition === "policy-revoked") {
        for (const requirement of currentInput.routing.providerPolicyRequirements) {
          (requirement as unknown as { evaluatedAt: string }).evaluatedAt =
            "2027-01-02T00:00:00.000Z";
        }
        trustedStateTransitionApplied = currentInput.routing.providerPolicyRequirements.every(
          (requirement) =>
            requirement.evaluatedAt === "2027-01-02T00:00:00.000Z" &&
            evaluateProviderEligibility(
              currentInput.routing.providerPolicyRegistry,
              requirement,
            ).decision !== "eligible",
        );
      }
    },
  });
  const fixture = executionInput();
  const input = withAvailability({
    ...fixture,
    clock: adapter.clock,
    transport: adapter,
  }, definition.availability);
  inputAtBoundary = input;
  const result = executeCommercialTutorInvocation(input);
  const routes = adapter.calls.map((call) => call.routeRefBefore);
  const noThirdAttempt = resultProviderCalls(result) <= 2 && adapter.calls.length <= 2;
  const plannedRouteOrder = ["route-profile:alpha", "route-profile:beta"];
  const noUnplannedRetry = adapter.calls.length === resultProviderCalls(result) &&
    routes.every((route, index) => route === plannedRouteOrder[index]);
  const noSameRouteRetry = new Set(routes).size === routes.length;
  const noLateSuccessAdvisory = !["PC-05", "PC-17"].includes(definition.id) ||
    result.status === "static-fallback";
  const noMalformedResponseAdvisory = !["PC-06", "PC-07", "PC-08", "PC-09"].includes(definition.id) ||
    result.status === "static-fallback";
  const noBudgetEscape = !["PC-15", "PC-16"].includes(definition.id) ||
    result.status === "static-fallback";
  const noPolicyIneligibleFailover = definition.id === "PC-19"
    ? adapter.calls.length <= 2 && result.status === "static-fallback"
    : !["PC-18", "PC-20", "PC-21"].includes(definition.id) ||
      (adapter.calls.length <= 1 && result.status === "static-fallback");
  const reviewedStaticFallbackAvailable = result.status !== "static-fallback" ||
    (isFallback(result) &&
      input.routing.executionBudget.reviewedStaticFallback.selection ===
        "reviewed-content-by-trusted-study-ref");
  const outcomeMatches = result.status === definition.expectedOutcome;
  const callsMatch = resultProviderCalls(result) === definition.expectedProviderCalls;
  const passed = outcomeMatches && callsMatch && noThirdAttempt && noUnplannedRetry &&
    noSameRouteRetry && noLateSuccessAdvisory && noMalformedResponseAdvisory &&
    noBudgetEscape && noPolicyIneligibleFailover && reviewedStaticFallbackAvailable;
  return Object.freeze({
    id: definition.id,
    fault: definition.fault,
    expectedOutcome: definition.expectedOutcome,
    observedOutcome: result.status,
    expectedProviderCalls: definition.expectedProviderCalls,
    observedProviderCalls: resultProviderCalls(result),
    adapterBoundaryCalls: adapter.calls.length,
    providerDispatchCount: adapter.providerDispatchCount,
    calledRoutes: Object.freeze(routes),
    attemptsFrozenAtBoundary: Object.freeze(adapter.calls.map((call) => call.attemptFrozenAtEntry)),
    mutationApplied: adapter.calls.some((call) => call.mutationApplied),
    trustedStateTransitionApplied,
    noThirdAttempt,
    noUnplannedRetry,
    noSameRouteRetry,
    noLateSuccessAdvisory,
    noMalformedResponseAdvisory,
    noBudgetEscape,
    noPolicyIneligibleFailover,
    reviewedStaticFallbackAvailable,
    passed,
  });
}

export function runProviderChaosCertification(): ProviderChaosCertification {
  const rows = Object.freeze(CASES.map(runCase));
  const failedFaults = rows.filter((row) => !row.passed).length;
  return Object.freeze({
    certificationVersion: 1,
    aggregateStatus: failedFaults === 0 ? "PASS" : "BLOCKER_FOUND",
    totalFaults: rows.length,
    passedFaults: rows.length - failedFaults,
    failedFaults,
    rows,
  });
}
