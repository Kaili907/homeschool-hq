import {
  commercialAttemptsEqual,
  isCanonicalCommercialAttempt,
  parseCanonicalIntegerMicros,
} from "../commercial-operation/index.js";
import { validateExact } from "../../v2/contracts/validation.js";
import { validateBudgetReservationSnapshot } from "../routing/budget-resilience/index.js";
import {
  CommercialTelemetryLineageSchema,
  TELEMETRY_ACTION_FAMILIES,
  TELEMETRY_CACHE_CLASSES,
  TELEMETRY_FAILURE_REASON_CODES,
  TELEMETRY_FALLBACK_CLASSES,
  TELEMETRY_ROUTE_CLASSES,
  TUTOR_COMMERCIAL_TELEMETRY_CONTRACT_VERSION,
  type TelemetryActionFamily,
  type TelemetryCacheClass,
  type TelemetryFailureReasonCode,
  type TelemetryFallbackClass,
  type TelemetryProjectionRejectionCode,
  type TelemetryProjectionResult,
  type TelemetryRouteClass,
  type TutorCommercialTelemetryEvent,
} from "./contracts.js";

const MISSING = Symbol("missing-operational-property");
const OPAQUE_REFERENCE = /^[a-z][a-z0-9-]{1,31}:[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    return Object.getPrototypeOf(value) === Object.prototype;
  } catch {
    return false;
  }
}

/** Reads an own data property without invoking an accessor. */
function ownDataProperty(record: Record<string, unknown>, key: string): unknown | typeof MISSING {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || descriptor.get || descriptor.set || !("value" in descriptor)) return MISSING;
    return descriptor.value;
  } catch {
    return MISSING;
  }
}

function isOpaqueReference(value: unknown): value is string {
  return typeof value === "string" && value.length <= 160 && OPAQUE_REFERENCE.test(value);
}

function safeCounter(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizedCode<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function rejected(reasonCode: TelemetryProjectionRejectionCode): TelemetryProjectionResult {
  return Object.freeze({ status: "rejected", reasonCode });
}

/**
 * Projects only allowlisted operational fields. All route, model, policy, and
 * reservation identity is copied from the canonical reserved attempt rather
 * than accepted from a provider execution result.
 */
export function projectTutorCommercialTelemetry(
  executionResult: unknown,
  lineageInput: unknown,
): TelemetryProjectionResult {
  const lineageValidation = validateExact(CommercialTelemetryLineageSchema, lineageInput);
  if (lineageValidation.status === "rejected") {
    return rejected("INVALID_COMMERCIAL_LINEAGE");
  }
  const { attempt, reservation } = lineageValidation.value;
  if (validateBudgetReservationSnapshot(reservation) === null) {
    return rejected("INVALID_COMMERCIAL_LINEAGE");
  }
  const reservedAttempt = reservation.attempts.find(
    (candidate) => candidate.physicalAttemptRef === attempt.physicalAttemptRef,
  );
  if (
    !isCanonicalCommercialAttempt(attempt) ||
    reservation.logicalOperationRef !== attempt.logicalOperationRef ||
    !reservedAttempt ||
    !commercialAttemptsEqual(reservedAttempt, attempt)
  ) {
    return rejected("INVALID_COMMERCIAL_LINEAGE");
  }
  if (!isPlainRecord(executionResult)) return rejected("INVALID_EXECUTION_RESULT");

  const status = ownDataProperty(executionResult, "status");
  const metrics = ownDataProperty(executionResult, "metrics");
  if ((status !== "success" && status !== "failure") || !isPlainRecord(metrics)) {
    return rejected("INVALID_EXECUTION_RESULT");
  }
  const eventRef = ownDataProperty(executionResult, "eventRef");
  if (!isOpaqueReference(eventRef)) return rejected("INVALID_OPERATIONAL_REFERENCE");

  const inputTokenCount = safeCounter(ownDataProperty(metrics, "inputTokenCount"));
  const outputTokenCount = safeCounter(ownDataProperty(metrics, "outputTokenCount"));
  const latencyMs = safeCounter(ownDataProperty(metrics, "latencyMs"));
  const costMicrosInput = ownDataProperty(metrics, "costMicros");
  const costMicros = parseCanonicalIntegerMicros(costMicrosInput);
  if (
    inputTokenCount === null ||
    outputTokenCount === null ||
    latencyMs === null ||
    costMicros === null ||
    typeof costMicrosInput !== "string"
  ) {
    return rejected("INVALID_NUMERIC_METRIC");
  }

  const actionFamily = normalizedCode<TelemetryActionFamily>(
    ownDataProperty(executionResult, "actionFamily"),
    TELEMETRY_ACTION_FAMILIES,
    status === "success" ? "other" : "none",
  );
  const routeClass = normalizedCode<TelemetryRouteClass>(
    ownDataProperty(executionResult, "routeClass"),
    TELEMETRY_ROUTE_CLASSES,
    "unknown",
  );
  const cacheClass = normalizedCode<TelemetryCacheClass>(
    ownDataProperty(executionResult, "cacheClass"),
    TELEMETRY_CACHE_CLASSES,
    "not-applicable",
  );
  const fallbackClass = normalizedCode<TelemetryFallbackClass>(
    ownDataProperty(executionResult, "fallbackClass"),
    TELEMETRY_FALLBACK_CLASSES,
    status === "success" ? "none" : "unknown",
  );
  const reasonCode = status === "success"
    ? "COMPLETED"
    : normalizedCode<TelemetryFailureReasonCode>(
        ownDataProperty(executionResult, "reasonCode"),
        TELEMETRY_FAILURE_REASON_CODES,
        "UNKNOWN_FAILURE",
      );

  const event: TutorCommercialTelemetryEvent = {
    contractVersion: TUTOR_COMMERCIAL_TELEMETRY_CONTRACT_VERSION,
    eventKind: "tutor-commercial-operation",
    eventRef,
    logicalOperationRef: attempt.logicalOperationRef,
    physicalAttemptRef: attempt.physicalAttemptRef,
    reservationRef: reservation.reservationRef,
    routeRef: attempt.routeRef,
    providerRef: attempt.providerRef,
    modelRef: attempt.modelRef,
    modelRevisionRef: attempt.modelRevisionRef,
    configurationDigest: attempt.configurationDigest,
    capabilityProfileRevisionRef: attempt.capabilityProfileRevisionRef,
    capabilityProfileDigest: attempt.capabilityProfileDigest,
    providerPolicyRevisionRef: attempt.providerPolicyRevisionRef,
    providerPolicyEvidenceRef: attempt.providerPolicyEvidenceRef,
    attemptIndex: attempt.attemptIndex,
    role: attempt.role,
    actionFamily,
    routeClass,
    inputTokenCount,
    outputTokenCount,
    latencyMs,
    costMicros: costMicrosInput,
    cacheClass,
    fallbackClass,
    outcome: status,
    reasonCode,
    authorityScope: "commercial-operations-only",
    instructionalUseAllowed: false,
    studyAuthority: false,
    studyMutationAllowed: false,
  };

  return Object.freeze({ status: "projected", event: Object.freeze(event) });
}
