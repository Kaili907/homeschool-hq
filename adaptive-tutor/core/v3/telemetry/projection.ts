import {
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

function optionalReference(record: Record<string, unknown>, key: string): string | null {
  const value = ownDataProperty(record, key);
  return isOpaqueReference(value) ? value : null;
}

function rejected(reasonCode: "INVALID_EXECUTION_RESULT" | "INVALID_OPERATIONAL_REFERENCE" | "INVALID_NUMERIC_METRIC"): TelemetryProjectionResult {
  return Object.freeze({ status: "rejected", reasonCode });
}

/**
 * Projects a provider execution result into a closed, prose-free commercial
 * operations event. Unknown properties are not enumerated and never cross the
 * telemetry boundary.
 */
export function projectTutorCommercialTelemetry(executionResult: unknown): TelemetryProjectionResult {
  if (!isPlainRecord(executionResult)) return rejected("INVALID_EXECUTION_RESULT");

  const status = ownDataProperty(executionResult, "status");
  const metrics = ownDataProperty(executionResult, "metrics");
  if ((status !== "success" && status !== "failure") || !isPlainRecord(metrics)) {
    return rejected("INVALID_EXECUTION_RESULT");
  }

  const eventRef = ownDataProperty(executionResult, "eventRef");
  const providerRef = ownDataProperty(executionResult, "providerRef");
  const modelRef = ownDataProperty(executionResult, "modelRef");
  if (!isOpaqueReference(eventRef) || !isOpaqueReference(providerRef) || !isOpaqueReference(modelRef)) {
    return rejected("INVALID_OPERATIONAL_REFERENCE");
  }

  const inputTokenCount = safeCounter(ownDataProperty(metrics, "inputTokenCount"));
  const outputTokenCount = safeCounter(ownDataProperty(metrics, "outputTokenCount"));
  const latencyMs = safeCounter(ownDataProperty(metrics, "latencyMs"));
  const costMicros = safeCounter(ownDataProperty(metrics, "costMicros"));
  if (
    inputTokenCount === null ||
    outputTokenCount === null ||
    latencyMs === null ||
    costMicros === null
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
    providerRef,
    modelRef,
    actionFamily,
    routeClass,
    inputTokenCount,
    outputTokenCount,
    latencyMs,
    costMicros,
    cacheClass,
    fallbackClass,
    outcome: status,
    reasonCode,
    policyRevisionRef: optionalReference(executionResult, "policyRevisionRef"),
    configRevisionRef: optionalReference(executionResult, "configRevisionRef"),
    authorityScope: "commercial-operations-only",
    instructionalUseAllowed: false,
    studyAuthority: false,
    studyMutationAllowed: false,
  };

  return Object.freeze({ status: "projected", event: Object.freeze(event) });
}
