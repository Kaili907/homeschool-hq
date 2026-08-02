export const SESSION_17_RATE_LIMIT_SCOPES = Object.freeze([
  "classification",
  "proposal-creation",
  "recipient-resolution",
  "worker-claim",
  "delivery-attempt",
  "parent-notification-read",
]);

export const RATE_LIMIT_SCOPES = Object.freeze({
  CLASSIFICATION: "classification",
  PROPOSAL_CREATION: "proposal-creation",
  RECIPIENT_RESOLUTION: "recipient-resolution",
  WORKER_CLAIM: "worker-claim",
  DELIVERY_ATTEMPT: "delivery-attempt",
  PARENT_NOTIFICATION_READ: "parent-notification-read",
});

const WORKER_SCOPES = new Set(["worker-claim", "delivery-attempt"]);
const ACTOR_REF = /^actor:[0-9a-f]{64}$/;
const OPTIONAL_REF = Object.freeze({
  householdRef: /^household:[0-9a-f]{64}$/,
  learnerRef: /^learner:[0-9a-f]{64}$/,
  routeRef: /^route:[0-9a-f]{64}$/,
});
const CALLER_TIME_KEYS = Object.freeze([
  "now",
  "nowMs",
  "timestamp",
  "timestampMs",
  "window",
  "windowId",
  "windowStart",
  "windowStartMs",
]);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;

export class DurableRateLimitUnavailableError extends Error {
  constructor(message = "Durable rate limiting is unavailable") {
    super(message);
    this.name = "DurableRateLimitUnavailableError";
    this.code = "durable-rate-limit-unavailable";
  }
}

export class DurableRateLimitRequestError extends Error {
  constructor(message, code = "invalid-rate-limit-request") {
    super(message);
    this.name = "DurableRateLimitRequestError";
    this.code = code;
  }
}

function explicitCapability(target, name) {
  if (!target) return false;
  if (target[name] === true) return true;
  if (typeof target[name] !== "function") return false;
  try {
    return target[name]() === true;
  } catch {
    return false;
  }
}

function normalizeRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new DurableRateLimitRequestError("request must be an object");
  }
  if (CALLER_TIME_KEYS.some((key) => own(request, key))) {
    throw new DurableRateLimitRequestError(
      "Rate-limit time and windows are owned by durable persistence",
      "caller-time-forbidden",
    );
  }
  if (!SESSION_17_RATE_LIMIT_SCOPES.includes(request.scope)) {
    throw new DurableRateLimitRequestError("Unknown Session 17 rate-limit scope");
  }
  if (typeof request.actorRef !== "string" || !ACTOR_REF.test(request.actorRef)) {
    throw new DurableRateLimitRequestError(
      "actorRef must be an opaque actor SHA-256 reference",
    );
  }

  const normalized = {
    scope: request.scope,
    actorRef: request.actorRef,
    householdRef: request.householdRef ?? "none",
    learnerRef: request.learnerRef ?? "none",
    routeRef: request.routeRef ?? "none",
    workerId: request.workerId ?? null,
  };
  for (const [key, pattern] of Object.entries(OPTIONAL_REF)) {
    if (
      normalized[key] !== "none" &&
      (typeof normalized[key] !== "string" || !pattern.test(normalized[key]))
    ) {
      throw new DurableRateLimitRequestError(
        `${key} must be none or an opaque SHA-256 reference`,
      );
    }
  }
  if (normalized.workerId !== null) {
    if (
      typeof normalized.workerId !== "string" ||
      normalized.workerId.length === 0 ||
      normalized.workerId.length > 256
    ) {
      throw new DurableRateLimitRequestError("workerId must be a non-empty string");
    }
  }
  return Object.freeze(normalized);
}

function normalizePersistenceResult(result) {
  if (!result || typeof result !== "object" || typeof result.allowed !== "boolean") {
    throw new DurableRateLimitUnavailableError(
      "Durable persistence returned an invalid result",
    );
  }
  if (result.allowed === true) {
    if (Object.keys(result).length !== 1) {
      throw new DurableRateLimitUnavailableError(
        "Allowed result must be exactly { allowed: true }",
      );
    }
    return Object.freeze({ allowed: true });
  }
  if (
    Object.keys(result).length !== 3 ||
    result.reasonCode !== "rate-limit-threshold" ||
    !positiveInteger(result.retryAfterSeconds)
  ) {
    throw new DurableRateLimitUnavailableError(
      "Denied result requires a strict positive retry-after",
    );
  }
  return Object.freeze({
    allowed: false,
    reasonCode: "rate-limit-threshold",
    retryAfterSeconds: result.retryAfterSeconds,
  });
}

async function authorizeWorker(workerAuthorization, request) {
  if (!request.workerId) {
    throw new DurableRateLimitRequestError(
      "workerId is required for worker rate-limit scopes",
      "worker-authorization-required",
    );
  }
  const authorize =
    typeof workerAuthorization === "function"
      ? workerAuthorization
      : workerAuthorization?.authorize;
  if (typeof authorize !== "function") {
    throw new DurableRateLimitRequestError(
      "Explicit worker authorization is required",
      "worker-authorization-required",
    );
  }
  const authorized = await authorize.call(workerAuthorization, request);
  if (authorized !== true) {
    throw new DurableRateLimitRequestError(
      "Worker is not authorized",
      "worker-not-authorized",
    );
  }
}

async function monitorViolation(monitoring, event) {
  const record =
    typeof monitoring === "function"
      ? monitoring
      : monitoring?.recordRateLimitViolation ?? monitoring?.record;
  if (typeof record !== "function") return;
  try {
    await record.call(monitoring, event);
  } catch {
    // Monitoring failure must not mutate a deterministic denial response.
  }
}

/**
 * Injects the durable atomic RPC boundary. persistence.reserve owns all clock
 * and window decisions and must perform one atomic distributed reservation.
 */
export function createDurableRateLimiter({
  persistence,
  monitoring,
  workerAuthorization,
} = {}) {
  const durable = explicitCapability(persistence, "isDurable");
  const ready =
    durable &&
    typeof persistence?.reserve === "function" &&
    explicitCapability(persistence, "isReady");

  function isDurable() {
    return durable;
  }

  function isReady() {
    return ready;
  }

  async function reserve(input) {
    if (!ready) throw new DurableRateLimitUnavailableError();
    const request = normalizeRequest(input);
    if (WORKER_SCOPES.has(request.scope)) {
      await authorizeWorker(workerAuthorization, request);
    }

    const result = normalizePersistenceResult(
      await persistence.reserve({
        scope: request.scope,
        actorRef: request.actorRef,
        householdRef: request.householdRef,
        learnerRef: request.learnerRef,
        routeRef: request.routeRef,
        workerId: request.workerId,
      }),
    );
    if (!result.allowed) {
      await monitorViolation(
        monitoring,
        Object.freeze({
          type: "study-rate-limit-violation",
          scope: request.scope,
          reasonCode: result.reasonCode,
          retryAfterSeconds: result.retryAfterSeconds,
        }),
      );
    }
    return result;
  }

  return Object.freeze({
    reserve,
    consume: reserve,
    isDurable,
    isReady,
  });
}
