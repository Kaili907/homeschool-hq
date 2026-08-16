import {
  COMMERCIAL_ATTEMPT_USAGE_RECEIPT_VERSION,
  type CommercialAttempt,
} from "../../../core/v3/commercial-operation/contracts.js";
import type {
  CommercialAttemptExecutionContext,
  CommercialOperationClock,
  CommercialProviderTransport,
  CommercialProviderTransportResult,
} from "../../../core/v3/commercial-operation/orchestrate.js";
import type { BoundedCommercialProviderRequest } from "../../../core/v3/provider-request/index.js";

export const PROVIDER_CHAOS_FAULTS = [
  "provider-unavailable",
  "rate-limit",
  "timeout-before-dispatch",
  "timeout-after-possible-dispatch",
  "very-late-success",
  "malformed-json-object",
  "unknown-response-field",
  "truncated-response",
  "duplicate-response",
  "wrong-physical-attempt-ref",
  "wrong-route-identity",
  "wrong-model-revision",
  "wrong-configuration-digest",
  "wrong-usage-receipt",
  "negative-invalid-cost",
  "over-reservation-cost",
  "provider-reported-false-latency",
  "policy-revoked-between-planning-and-execution",
] as const;

export type ProviderChaosFault = (typeof PROVIDER_CHAOS_FAULTS)[number];
export type ProviderChaosStep = ProviderChaosFault | "success";

export type ProviderChaosBoundaryHook = (input: {
  readonly boundaryCallIndex: number;
  readonly step: ProviderChaosStep;
  readonly attempt: CommercialAttempt;
  readonly context: CommercialAttemptExecutionContext;
}) => void;

export interface ProviderChaosCallRecord {
  readonly boundaryCallIndex: number;
  readonly step: ProviderChaosStep;
  readonly routeRefBefore: string;
  readonly routeRefAfter: string;
  readonly physicalAttemptRefBefore: string;
  readonly physicalAttemptRefAfter: string;
  readonly modelRevisionRefBefore: string;
  readonly modelRevisionRefAfter: string;
  readonly configurationDigestBefore: string;
  readonly configurationDigestAfter: string;
  readonly attemptFrozenAtEntry: boolean;
  readonly mutationApplied: boolean;
  readonly providerDispatchPossible: boolean;
}

export class DeterministicChaosClock implements CommercialOperationClock {
  #nowMs = 0;

  nowMs(): number {
    return this.#nowMs;
  }

  advance(milliseconds: number): void {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new Error("Chaos clock advances must be safe non-negative integers.");
    }
    this.#nowMs += milliseconds;
  }
}

function usageReceipt(
  attempt: CommercialAttempt,
  reservationRef: string,
  actualCostMicros: string,
  overrides: Readonly<Record<string, unknown>> = {},
): unknown {
  return {
    contractVersion: COMMERCIAL_ATTEMPT_USAGE_RECEIPT_VERSION,
    receiptKind: "commercial-attempt-usage-receipt",
    logicalOperationRef: attempt.logicalOperationRef,
    physicalAttemptRef: attempt.physicalAttemptRef,
    reservationRef,
    routeRef: attempt.routeRef,
    attemptIndex: attempt.attemptIndex,
    role: attempt.role,
    reservedCostMicros: attempt.reservedCostMicros,
    actualCostMicros,
    ...overrides,
  };
}

function cloneRecord(value: unknown): Record<string, unknown> {
  return structuredClone(value) as Record<string, unknown>;
}

function responseWithCost(response: unknown, costMicros: string): unknown {
  const candidate = cloneRecord(response);
  const metrics = candidate.metrics;
  if (typeof metrics === "object" && metrics !== null) {
    (metrics as Record<string, unknown>).costMicros = costMicros;
  }
  return candidate;
}

function responseWithLatency(response: unknown, latencyMs: number): unknown {
  const candidate = cloneRecord(response);
  const metrics = candidate.metrics;
  if (typeof metrics === "object" && metrics !== null) {
    (metrics as Record<string, unknown>).latencyMs = latencyMs;
  }
  return candidate;
}

function applyAttemptMutation(
  attempt: CommercialAttempt,
  field: "modelRevisionRef" | "configurationDigest",
  value: string,
): boolean {
  try {
    (attempt as unknown as Record<string, unknown>)[field] = value;
    return attempt[field] === value;
  } catch {
    return false;
  }
}

/**
 * Offline deterministic transport adversary for the accepted commercial seam.
 * It has no SDK, credentials, timers, randomness, or network capability.
 */
export class ProviderChaosAdapter implements CommercialProviderTransport {
  readonly clock = new DeterministicChaosClock();
  readonly calls: ProviderChaosCallRecord[] = [];
  readonly requests: unknown[] = [];
  readonly contexts: CommercialAttemptExecutionContext[] = [];
  #providerDispatchCount = 0;
  readonly #steps: ProviderChaosStep[];
  readonly #successfulResponse: unknown;
  readonly #beforeExecute: ProviderChaosBoundaryHook | undefined;

  constructor(input: {
    readonly steps: readonly ProviderChaosStep[];
    readonly successfulResponse: unknown;
    readonly beforeExecute?: ProviderChaosBoundaryHook;
  }) {
    this.#steps = [...input.steps];
    this.#successfulResponse = structuredClone(input.successfulResponse);
    this.#beforeExecute = input.beforeExecute;
  }

  get providerDispatchCount(): number {
    return this.#providerDispatchCount;
  }

  execute(
    request: BoundedCommercialProviderRequest,
    attempt: CommercialAttempt,
    context: CommercialAttemptExecutionContext,
  ): CommercialProviderTransportResult {
    const step = this.#steps.shift() ?? "timeout-before-dispatch";
    const before = {
      routeRef: attempt.routeRef,
      physicalAttemptRef: attempt.physicalAttemptRef,
      modelRevisionRef: attempt.modelRevisionRef,
      configurationDigest: attempt.configurationDigest,
    };
    const attemptFrozenAtEntry = Object.isFrozen(attempt);
    let mutationApplied = false;
    let providerDispatchPossible = step !== "timeout-before-dispatch";
    if (providerDispatchPossible) this.#providerDispatchCount += 1;

    this.requests.push(structuredClone(request));
    this.contexts.push(structuredClone(context));
    this.#beforeExecute?.({
      boundaryCallIndex: this.calls.length,
      step,
      attempt,
      context,
    });

    let result: CommercialProviderTransportResult;
    switch (step) {
      case "success":
        result = {
          status: "response",
          response: structuredClone(this.#successfulResponse),
          usageReceipt: usageReceipt(attempt, context.reservationRef, "100"),
        };
        break;
      case "provider-unavailable":
        result = {
          status: "failure",
          kind: "provider-outage",
          metrics: { inputTokenCount: 20, outputTokenCount: 0, latencyMs: 100, costMicros: "20" },
          usageReceipt: usageReceipt(attempt, context.reservationRef, "20"),
        };
        break;
      case "rate-limit":
        result = {
          status: "failure",
          kind: "rate-limit",
          metrics: { inputTokenCount: 0, outputTokenCount: 0, latencyMs: 10, costMicros: "0" },
          usageReceipt: usageReceipt(attempt, context.reservationRef, "0"),
        };
        break;
      case "timeout-before-dispatch":
        result = {
          status: "failure",
          kind: "confirmed-not-dispatched-transport-failure",
          metrics: { inputTokenCount: 0, outputTokenCount: 0, latencyMs: 0, costMicros: "0" },
          usageReceipt: null,
        };
        break;
      case "timeout-after-possible-dispatch":
        this.clock.advance(300);
        result = {
          status: "failure",
          kind: "provider-timeout",
          metrics: { inputTokenCount: 50, outputTokenCount: 0, latencyMs: 300, costMicros: "0" },
          usageReceipt: null,
        };
        break;
      case "very-late-success":
        this.clock.advance(context.attemptTimeoutMs + 1_500);
        result = {
          status: "response",
          response: responseWithLatency(this.#successfulResponse, 1),
          usageReceipt: usageReceipt(attempt, context.reservationRef, "100"),
        };
        break;
      case "malformed-json-object":
        result = {
          status: "response",
          response: "{\"responseKind\":",
          usageReceipt: usageReceipt(attempt, context.reservationRef, "0"),
        };
        break;
      case "unknown-response-field": {
        const response = cloneRecord(this.#successfulResponse);
        response.providerAuthority = "forged";
        result = {
          status: "response",
          response,
          usageReceipt: usageReceipt(attempt, context.reservationRef, "100"),
        };
        break;
      }
      case "truncated-response": {
        const response = cloneRecord(this.#successfulResponse);
        delete response.metrics;
        result = {
          status: "response",
          response,
          usageReceipt: usageReceipt(attempt, context.reservationRef, "0"),
        };
        break;
      }
      case "duplicate-response":
        result = {
          status: "response",
          response: [
            structuredClone(this.#successfulResponse),
            structuredClone(this.#successfulResponse),
          ],
          usageReceipt: usageReceipt(attempt, context.reservationRef, "100"),
        };
        break;
      case "wrong-physical-attempt-ref":
        result = {
          status: "response",
          response: structuredClone(this.#successfulResponse),
          usageReceipt: usageReceipt(attempt, context.reservationRef, "100", {
            physicalAttemptRef: "physical-attempt:foreign",
          }),
        };
        break;
      case "wrong-route-identity":
        result = {
          status: "response",
          response: structuredClone(this.#successfulResponse),
          usageReceipt: usageReceipt(attempt, context.reservationRef, "100", {
            routeRef: "route-profile:foreign",
          }),
        };
        break;
      case "wrong-model-revision": {
        mutationApplied = applyAttemptMutation(
          attempt,
          "modelRevisionRef",
          "model-revision:provider-forged",
        );
        const response = cloneRecord(this.#successfulResponse);
        if (!mutationApplied) response.modelRevisionRef = "model-revision:provider-forged";
        result = {
          status: "response",
          response,
          usageReceipt: usageReceipt(attempt, context.reservationRef, "100"),
        };
        break;
      }
      case "wrong-configuration-digest": {
        mutationApplied = applyAttemptMutation(
          attempt,
          "configurationDigest",
          `sha256:${"e".repeat(64)}`,
        );
        const response = cloneRecord(this.#successfulResponse);
        if (!mutationApplied) response.configurationDigest = `sha256:${"e".repeat(64)}`;
        result = {
          status: "response",
          response,
          usageReceipt: usageReceipt(attempt, context.reservationRef, "100"),
        };
        break;
      }
      case "wrong-usage-receipt":
        result = {
          status: "response",
          response: structuredClone(this.#successfulResponse),
          usageReceipt: usageReceipt(attempt, "reservation:foreign", "100"),
        };
        break;
      case "negative-invalid-cost":
        result = {
          status: "response",
          response: responseWithCost(this.#successfulResponse, "-1"),
          usageReceipt: usageReceipt(attempt, context.reservationRef, "-1"),
        };
        break;
      case "over-reservation-cost":
        result = {
          status: "response",
          response: responseWithCost(this.#successfulResponse, "101"),
          usageReceipt: usageReceipt(attempt, context.reservationRef, "101"),
        };
        break;
      case "provider-reported-false-latency":
        this.clock.advance(context.attemptTimeoutMs + 1);
        result = {
          status: "response",
          response: responseWithLatency(this.#successfulResponse, 1),
          usageReceipt: usageReceipt(attempt, context.reservationRef, "100"),
        };
        break;
      case "policy-revoked-between-planning-and-execution":
        result = {
          status: "failure",
          kind: "provider-rejection",
          metrics: { inputTokenCount: 0, outputTokenCount: 0, latencyMs: 1, costMicros: "0" },
          usageReceipt: usageReceipt(attempt, context.reservationRef, "0"),
        };
        break;
    }

    this.calls.push(Object.freeze({
      boundaryCallIndex: this.calls.length,
      step,
      routeRefBefore: before.routeRef,
      routeRefAfter: attempt.routeRef,
      physicalAttemptRefBefore: before.physicalAttemptRef,
      physicalAttemptRefAfter: attempt.physicalAttemptRef,
      modelRevisionRefBefore: before.modelRevisionRef,
      modelRevisionRefAfter: attempt.modelRevisionRef,
      configurationDigestBefore: before.configurationDigest,
      configurationDigestAfter: attempt.configurationDigest,
      attemptFrozenAtEntry,
      mutationApplied,
      providerDispatchPossible,
    }));
    return result;
  }
}
