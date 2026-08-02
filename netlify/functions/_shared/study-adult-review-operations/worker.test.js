import assert from "node:assert/strict";
import test from "node:test";

import {
  AdultReviewWorkerAuthorizationError,
  AdultReviewWorkerConfigurationError,
  createAdultReviewWorker,
} from "./worker.js";

const durable = (value) => ({ durable: true, ...value });

function fixture(overrides = {}) {
  const calls = [];
  const providers = new Map([
    ["in_app", durable({ kind: "in-app", deliver: async ({ onSubmitted }) => {
      await onSubmitted({ providerAttemptId: "provider-1" });
      return { status: "submitted", receipt: { verified: true } };
    } })],
  ]);
  const ports = {
    schemaVersion: 2,
    workerId: "adult-review-worker-v1",
    environment: "test",
    readiness: durable({ evaluate: async () => ({ ready: true }) }),
    workerAuthorization: durable({ authorize: async () => ({ authorized: true }) }),
    persistence: durable({
      cancelInvalid: async (value) => { calls.push(["cancelInvalid", value]); return 0; },
      claim: async () => [],
      renew: async (value) => { calls.push(["renew", value]); return true; },
      release: async (value) => calls.push(["release", value]),
      recordCrash: async (value) => calls.push(["crash", value]),
    }),
    resolver: durable({ reauthorize: async () => ({ authorized: true, recipient: { id: "adult-1" } }) }),
    providers,
    attempts: durable({
      create: async (value) => { calls.push(["createAttempt", value]); return { attemptId: "attempt-1" }; },
      recordState: async (value) => calls.push(["attemptState", value]),
    }),
    receipts: durable({
      commitVerified: async (value) => calls.push(["receipt", value]),
      reconcile: async (value) => { calls.push(["reconcile", value]); return 0; },
    }),
    monitoring: durable({ record: async (value) => calls.push(["monitor", value]) }),
    ...overrides,
  };
  return { calls, ports };
}

test("refuses missing, non-durable, wrong-schema, and production test ports", () => {
  assert.throws(() => createAdultReviewWorker(), AdultReviewWorkerConfigurationError);
  const nonDurable = fixture().ports;
  nonDurable.persistence = { ...nonDurable.persistence, durable: false };
  assert.throws(() => createAdultReviewWorker(nonDurable), /not durable/);
  assert.throws(() => createAdultReviewWorker({ ...fixture().ports, schemaVersion: 1 }), /schema version 2/);
  const production = fixture({ environment: "production" }).ports;
  production.providers.get("in_app").testOnly = true;
  assert.throws(() => createAdultReviewWorker(production), /forbidden in production/);
});

test("refuses unauthorized and not-ready worker contexts before claims", async () => {
  const unauthorized = fixture();
  unauthorized.ports.workerAuthorization.authorize = async () => ({ authorized: false });
  await assert.rejects(
    () => createAdultReviewWorker(unauthorized.ports).run({ trigger: "scheduled" }),
    AdultReviewWorkerAuthorizationError,
  );

  const notReady = fixture();
  notReady.ports.readiness.evaluate = async () => ({ ready: false });
  await assert.rejects(
    () => createAdultReviewWorker(notReady.ports).run({ trigger: "manual" }),
    /not ready/,
  );
});

test("reconciles, cancels invalid, and bounds claims before delivery", async () => {
  const { calls, ports } = fixture();
  ports.persistence.claim = async ({ batchSize }) => {
    assert.equal(batchSize, 1);
    return [
      { jobId: "job-1", route: "in_app", leaseToken: "lease-1" },
      { jobId: "job-2", route: "in_app", leaseToken: "lease-2" },
    ];
  };
  const result = await createAdultReviewWorker({ ...ports, maxBatchSize: 1 })
    .run({ trigger: "scheduled" }, { batchSize: 100 });
  assert.equal(result.claimed, 1);
  assert.equal(result.delivered, 1);
  assert.equal(calls.findIndex(([name]) => name === "reconcile") <
    calls.findIndex(([name]) => name === "cancelInvalid"), true);
  assert.deepEqual(
    calls.filter(([name]) => name === "attemptState").map(([, value]) => value.state),
    ["submitted", "receipt_committed"],
  );
  assert.equal(calls.filter(([name]) => name === "receipt").length, 1);
  assert.equal(calls.filter(([name]) => name === "release").length, 1);
});

test("reauthorization failure cancels a claimed job without provider use", async () => {
  const { calls, ports } = fixture();
  ports.persistence.claim = async () => [{ jobId: "job-1", route: "in_app", leaseToken: "lease-1" }];
  ports.resolver.reauthorize = async () => ({ authorized: false, reason: "permission_revoked" });
  ports.providers.get("in_app").deliver = async () => assert.fail("provider must not run");
  const result = await createAdultReviewWorker(ports).run({ trigger: "manual" });
  assert.equal(result.results[0].status, "cancelled");
  assert.equal(calls.filter(([name]) => name === "cancelInvalid").length, 2);
});

test("a submitted attempt without a receipt becomes indeterminate and reconciles", async () => {
  const { calls, ports } = fixture();
  ports.persistence.claim = async () => [{ jobId: "job-1", route: "in_app", leaseToken: "lease-1" }];
  ports.providers.get("in_app").deliver = async ({ onSubmitted }) => {
    await onSubmitted({ providerAttemptId: "provider-uncertain" });
    throw new Error("connection ended before receipt");
  };
  const result = await createAdultReviewWorker(ports).run({ trigger: "scheduled" });
  assert.equal(result.indeterminate, 1);
  assert.equal(calls.filter(([name, value]) => name === "attemptState" && value.state === "indeterminate").length, 1);
  assert.equal(calls.filter(([name]) => name === "receipt").length, 0);
  assert.equal(calls.filter(([name]) => name === "reconcile").length, 2);
});

test("records a pre-submission provider crash and releases its lease", async () => {
  const { calls, ports } = fixture();
  ports.persistence.claim = async () => [{ jobId: "job-1", route: "in_app", leaseToken: "lease-1" }];
  ports.providers.get("in_app").deliver = async () => { throw new Error("provider unavailable"); };
  const result = await createAdultReviewWorker(ports).run({ trigger: "scheduled" });
  assert.equal(result.failed, 1);
  assert.equal(calls.filter(([name]) => name === "crash").length, 1);
  assert.equal(calls.filter(([name]) => name === "release").length, 1);
});
