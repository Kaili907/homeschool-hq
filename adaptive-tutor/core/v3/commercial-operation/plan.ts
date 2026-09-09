import { validateExact } from "../../v2/contracts/validation.js";
import {
  COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION,
  CommercialAttemptSchema,
  CommercialRouteAttemptPlanSchema,
  MAX_CANONICAL_INTEGER_MICROS,
  type CommercialAttempt,
  type CommercialRouteAttemptPlan,
} from "./contracts.js";

export function parseCanonicalIntegerMicros(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed <= MAX_CANONICAL_INTEGER_MICROS ? parsed : null;
  } catch {
    return null;
  }
}

const ATTEMPT_KEYS = [
  "commercialScopeRef",
  "logicalOperationRef",
  "physicalAttemptRef",
  "attemptIndex",
  "role",
  "routeRef",
  "providerRef",
  "modelRef",
  "modelRevisionRef",
  "configurationDigest",
  "capabilityProfileRevisionRef",
  "capabilityProfileDigest",
  "providerPolicyRevisionRef",
  "providerPolicyEvidenceRef",
  "reservedCostMicros",
  "timeoutMs",
] as const satisfies readonly (keyof CommercialAttempt)[];

export function commercialAttemptsEqual(
  left: CommercialAttempt,
  right: CommercialAttempt,
): boolean {
  return ATTEMPT_KEYS.every((key) => left[key] === right[key]);
}

export function isCanonicalCommercialAttempt(value: unknown): value is CommercialAttempt {
  const validation = validateExact(CommercialAttemptSchema, value);
  if (validation.status === "rejected") return false;
  const attempt = validation.value;
  return (
    parseCanonicalIntegerMicros(attempt.reservedCostMicros) !== null &&
    attempt.role === (attempt.attemptIndex === 0 ? "primary" : "failover")
  );
}

function checkedAttemptCostTotal(attempts: readonly CommercialAttempt[]): bigint | null {
  let total = 0n;
  for (const attempt of attempts) {
    const cost = parseCanonicalIntegerMicros(attempt.reservedCostMicros);
    if (cost === null || cost > MAX_CANONICAL_INTEGER_MICROS - total) return null;
    total += cost;
  }
  return total;
}

function attemptSequenceIsValid(
  commercialScopeRef: string,
  logicalOperationRef: string,
  attempts: readonly CommercialAttempt[],
): boolean {
  if (attempts.length < 1 || attempts.length > 2) return false;
  if (!attempts.every(isCanonicalCommercialAttempt)) return false;
  if (
    !attempts.every(
      (attempt, index) =>
        attempt.commercialScopeRef === commercialScopeRef &&
        attempt.logicalOperationRef === logicalOperationRef &&
        attempt.attemptIndex === index &&
        attempt.role === (index === 0 ? "primary" : "failover"),
    )
  ) {
    return false;
  }
  if (new Set(attempts.map((attempt) => attempt.physicalAttemptRef)).size !== attempts.length) {
    return false;
  }
  return attempts.length === 1 || attempts[0]?.routeRef !== attempts[1]?.routeRef;
}

export function validateCommercialRouteAttemptPlan(
  value: unknown,
): CommercialRouteAttemptPlan | null {
  const validation = validateExact(CommercialRouteAttemptPlanSchema, value);
  if (validation.status === "rejected") return null;
  const plan = validation.value;
  const total = checkedAttemptCostTotal(plan.attempts);
  const declaredTotal = parseCanonicalIntegerMicros(plan.totalReservedCostMicros);
  if (
    total === null ||
    declaredTotal === null ||
    total !== declaredTotal ||
    !attemptSequenceIsValid(plan.commercialScopeRef, plan.logicalOperationRef, plan.attempts)
  ) {
    return null;
  }
  return plan;
}

export function createCommercialRouteAttemptPlan(input: {
  readonly routePlanRef: string;
  readonly commercialScopeRef: string;
  readonly logicalOperationRef: string;
  readonly attempts: readonly CommercialAttempt[];
}): CommercialRouteAttemptPlan | null {
  const total = checkedAttemptCostTotal(input.attempts);
  if (total === null) return null;
  const plan = {
    contractVersion: COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION,
    routePlanRef: input.routePlanRef,
    commercialScopeRef: input.commercialScopeRef,
    logicalOperationRef: input.logicalOperationRef,
    attempts: input.attempts.map((attempt) => ({ ...attempt })),
    totalReservedCostMicros: total.toString(),
  };
  const validated = validateCommercialRouteAttemptPlan(plan);
  if (validated === null) return null;
  const attempts = validated.attempts.map((attempt) => Object.freeze({ ...attempt }));
  Object.freeze(attempts);
  return Object.freeze({
    ...validated,
    attempts,
  });
}
