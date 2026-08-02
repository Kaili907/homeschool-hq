import assert from "node:assert/strict";
import { test } from "vitest";

import {
  DurableRateLimitRequestError,
  DurableRateLimitUnavailableError,
  RATE_LIMIT_SCOPES,
  SESSION_17_RATE_LIMIT_SCOPES,
  createDurableRateLimiter,
} from "./durable-rate-limit.js";

const hash = (character) => character.repeat(64);
const baseRequest = Object.freeze({
  scope: RATE_LIMIT_SCOPES.PROPOSAL_CREATION,
  actorRef: `actor:${hash("a")}`,
  householdRef: `household:${hash("b")}`,
  learnerRef: `learner:${hash("c")}`,
  routeRef: `route:${hash("d")}`,
});

class SyntheticAtomicPersistence {
  isDurable = true;
  isReady = true;
  #tail = Promise.resolve();
  #buckets = new Map();
  #serverNowSeconds = 1_000;
  calls = [];

  constructor(limit = 5, windowSeconds = 60) {
    this.limit = limit;
    this.windowSeconds = windowSeconds;
  }

  reserve(input) {
    this.calls.push(input);
    assert.equal("now" in input, false);
    assert.equal("nowMs" in input, false);
    const operation = this.#tail.then(async () => {
      await Promise.resolve();
      const key = JSON.stringify(input);
      const now = this.#serverNowSeconds;
      let bucket = this.#buckets.get(key);
      if (!bucket || now >= bucket.resetAt) {
        bucket = { reservations: 0, resetAt: now + this.windowSeconds };
      }
      if (bucket.reservations >= this.limit) {
        return {
          allowed: false,
          reasonCode: "rate-limit-threshold",
          retryAfterSeconds: bucket.resetAt - now,
        };
      }
      bucket.reservations += 1;
      this.#buckets.set(key, bucket);
      return { allowed: true };
    });
    this.#tail = operation.catch(() => {});
    return operation;
  }
}

test("publishes the exact six Session 17 scopes", () => {
  assert.deepEqual(SESSION_17_RATE_LIMIT_SCOPES, [
    "classification",
    "proposal-creation",
    "recipient-resolution",
    "worker-claim",
    "delivery-attempt",
    "parent-notification-read",
  ]);
});

test("distributed race-shaped reservations cannot exceed the atomic limit", async () => {
  const persistence = new SyntheticAtomicPersistence(5);
  const limiter = createDurableRateLimiter({ persistence });
  const results = await Promise.all(
    Array.from({ length: 50 }, () => limiter.reserve(baseRequest)),
  );
  assert.equal(results.filter(({ allowed }) => allowed).length, 5);
  assert.equal(results.filter(({ allowed }) => !allowed).length, 45);
  for (const denial of results.filter(({ allowed }) => !allowed)) {
    assert.deepEqual(denial, {
      allowed: false,
      reasonCode: "rate-limit-threshold",
      retryAfterSeconds: 60,
    });
  }
});

test("server time only: caller clocks and windows are rejected", async () => {
  const limiter = createDurableRateLimiter({
    persistence: new SyntheticAtomicPersistence(),
  });
  for (const field of ["now", "nowMs", "timestamp", "windowId", "windowStartMs"]) {
    await assert.rejects(
      limiter.reserve({ ...baseRequest, [field]: 1 }),
      (error) =>
        error instanceof DurableRateLimitRequestError &&
        error.code === "caller-time-forbidden",
    );
  }
});

test("dimensions are exact opaque refs and optional refs default to none", async () => {
  const persistence = new SyntheticAtomicPersistence();
  const limiter = createDurableRateLimiter({ persistence });
  await limiter.reserve({
    scope: RATE_LIMIT_SCOPES.CLASSIFICATION,
    actorRef: `actor:${hash("e")}`,
  });
  assert.deepEqual(persistence.calls[0], {
    scope: "classification",
    actorRef: `actor:${hash("e")}`,
    householdRef: "none",
    learnerRef: "none",
    routeRef: "none",
    workerId: null,
  });

  for (const invalid of [
    { ...baseRequest, actorRef: `account:${hash("a")}` },
    { ...baseRequest, actorRef: "actor:not-a-hash" },
    { ...baseRequest, householdRef: `learner:${hash("b")}` },
    { ...baseRequest, learnerRef: "" },
    { ...baseRequest, routeRef: "route:PII@example.test" },
  ]) {
    await assert.rejects(limiter.reserve(invalid), DurableRateLimitRequestError);
  }
});

test("memory and non-durable persistence are never ready", async () => {
  for (const persistence of [
    undefined,
    { isDurable: false, isReady: true, reserve() {} },
    { kind: "memory", isDurable: false, isReady: true, reserve() {} },
    { isDurable: true, isReady: false, reserve() {} },
  ]) {
    const limiter = createDurableRateLimiter({ persistence });
    assert.equal(limiter.isReady(), false);
    if (!persistence?.isDurable) assert.equal(limiter.isDurable(), false);
    await assert.rejects(
      limiter.reserve(baseRequest),
      DurableRateLimitUnavailableError,
    );
  }
});

test("worker claim and delivery attempt require explicit authorization", async () => {
  for (const scope of [
    RATE_LIMIT_SCOPES.WORKER_CLAIM,
    RATE_LIMIT_SCOPES.DELIVERY_ATTEMPT,
  ]) {
    const persistence = new SyntheticAtomicPersistence();
    const noAuthorization = createDurableRateLimiter({ persistence });
    await assert.rejects(
      noAuthorization.reserve({ ...baseRequest, scope, workerId: "worker-1" }),
      (error) => error.code === "worker-authorization-required",
    );
    assert.equal(persistence.calls.length, 0);

    const denied = createDurableRateLimiter({
      persistence,
      workerAuthorization: async () => false,
    });
    await assert.rejects(
      denied.reserve({ ...baseRequest, scope, workerId: "worker-1" }),
      (error) => error.code === "worker-not-authorized",
    );
    assert.equal(persistence.calls.length, 0);

    const authorized = createDurableRateLimiter({
      persistence,
      workerAuthorization: async (request) =>
        request.workerId === "worker-1" && request.scope === scope,
    });
    assert.deepEqual(
      await authorized.reserve({ ...baseRequest, scope, workerId: "worker-1" }),
      { allowed: true },
    );
  }
});

test("strict retry-after rejects malformed durable denials", async () => {
  for (const result of [
    { allowed: false, reasonCode: "rate-limit-threshold" },
    {
      allowed: false,
      reasonCode: "rate-limit-threshold",
      retryAfterSeconds: 0,
    },
    { allowed: false, reasonCode: "other", retryAfterSeconds: 3 },
    {
      allowed: false,
      reasonCode: "rate-limit-threshold",
      retryAfterSeconds: 3,
      extra: true,
    },
  ]) {
    const limiter = createDurableRateLimiter({
      persistence: {
        isDurable: true,
        isReady: true,
        async reserve() {
          return result;
        },
      },
    });
    await assert.rejects(
      limiter.reserve(baseRequest),
      DurableRateLimitUnavailableError,
    );
  }
});

test("each violation is emitted for distributed repeated-violation aggregation", async () => {
  const events = [];
  const limiter = createDurableRateLimiter({
    persistence: new SyntheticAtomicPersistence(1),
    monitoring: { recordRateLimitViolation: (event) => events.push(event) },
  });
  await limiter.reserve(baseRequest);
  await limiter.reserve(baseRequest);
  await limiter.reserve(baseRequest);
  assert.equal(events.length, 2);
  assert.equal(events[0].type, "study-rate-limit-violation");
  assert.equal(events[0].reasonCode, "rate-limit-threshold");
  assert.deepEqual(Object.keys(events[0]).sort(), [
    "reasonCode", "retryAfterSeconds", "scope", "type",
  ]);
});
