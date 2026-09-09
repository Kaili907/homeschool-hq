import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDER_CHAOS_FAULTS, ProviderChaosAdapter } from "./adapter.js";
import { runProviderChaosCertification } from "./matrix.js";
import { successfulProviderResponse } from "../../../tests/tutor-v3-convergence/fixtures.js";

test("provider chaos adapter is deterministic and offline by construction", () => {
  const left = runProviderChaosCertification();
  const right = runProviderChaosCertification();
  assert.deepEqual(left, right);
  assert.equal(PROVIDER_CHAOS_FAULTS.length, 18);
  assert.equal(typeof ProviderChaosAdapter.prototype.execute, "function");
});

test("fault matrix covers every requested provider failure mode", () => {
  const certification = runProviderChaosCertification();
  assert.equal(certification.totalFaults, 21);
  assert.deepEqual(
    certification.rows.map((row) => row.id),
    Array.from({ length: 21 }, (_, index) => `PC-${String(index + 1).padStart(2, "0")}`),
  );
  for (const fault of PROVIDER_CHAOS_FAULTS) {
    assert.equal(certification.rows.some((row) => row.fault === fault), true, fault);
  }
  for (const fault of ["failover-unavailable", "both-providers-unavailable", "circuit-open"]) {
    assert.equal(certification.rows.some((row) => row.fault === fault), true, fault);
  }
});

test("certification detects mutable commercial attempt identity blocker", () => {
  const certification = runProviderChaosCertification();
  assert.equal(certification.aggregateStatus, "BLOCKER_FOUND");
  assert.equal(certification.passedFaults, 16);
  assert.equal(certification.failedFaults, 5);
  assert.deepEqual(
    certification.rows.filter((row) => !row.passed).map((row) => row.id),
    ["PC-12", "PC-13", "PC-18", "PC-20", "PC-21"],
  );
  for (const id of ["PC-12", "PC-13"]) {
    const row = certification.rows.find((candidate) => candidate.id === id);
    assert.ok(row);
    assert.equal(row.expectedOutcome, "static-fallback");
    assert.equal(row.observedOutcome, "advisory");
    assert.equal(row.observedProviderCalls, 1);
    assert.deepEqual(row.attemptsFrozenAtBoundary, [false]);
    assert.equal(row.mutationApplied, true);
  }
});

test("certification detects stale failover availability, circuit, and policy snapshots", () => {
  const certification = runProviderChaosCertification();
  for (const id of ["PC-18", "PC-20"]) {
    const row = certification.rows.find((candidate) => candidate.id === id);
    assert.ok(row);
    assert.equal(row.trustedStateTransitionApplied, true);
    assert.equal(row.expectedProviderCalls, 1);
    assert.equal(row.observedProviderCalls, 2);
    assert.equal(row.observedOutcome, "advisory");
    assert.equal(row.noPolicyIneligibleFailover, false);
  }
  const revoked = certification.rows.find((candidate) => candidate.id === "PC-21");
  assert.ok(revoked);
  assert.equal(revoked.trustedStateTransitionApplied, true);
  assert.equal(revoked.observedProviderCalls, 1);
  assert.equal(revoked.observedOutcome, "advisory");
  assert.equal(revoked.noPolicyIneligibleFailover, false);
});

test("all chaos cases preserve bounded attempts, planned routes, and static fallback availability", () => {
  const certification = runProviderChaosCertification();
  for (const row of certification.rows) {
    assert.equal(row.noThirdAttempt, true, row.id);
    assert.equal(row.noUnplannedRetry, true, row.id);
    assert.equal(row.noSameRouteRetry, true, row.id);
    assert.equal(row.noLateSuccessAdvisory, true, row.id);
    assert.equal(row.noMalformedResponseAdvisory, true, row.id);
    assert.equal(row.noBudgetEscape, true, row.id);
    assert.equal(row.reviewedStaticFallbackAvailable, true, row.id);
  }
});

test("policy-ineligible failover invariant fails only for the reproduced stale-state blockers", () => {
  const certification = runProviderChaosCertification();
  assert.deepEqual(
    certification.rows.filter((row) => !row.noPolicyIneligibleFailover).map((row) => row.id),
    ["PC-18", "PC-20", "PC-21"],
  );
});

test("malformed, late, cost, and receipt responses never become advisories", () => {
  const certification = runProviderChaosCertification();
  const requiredStatic = new Set([
    "PC-05", "PC-06", "PC-07", "PC-08", "PC-09", "PC-10", "PC-11",
    "PC-14", "PC-15", "PC-16", "PC-17",
  ]);
  for (const row of certification.rows) {
    if (requiredStatic.has(row.id)) assert.equal(row.observedOutcome, "static-fallback", row.id);
  }
});

test("adapter never depends on real provider behavior", () => {
  const adapter = new ProviderChaosAdapter({
    steps: ["timeout-before-dispatch"],
    successfulResponse: successfulProviderResponse(),
  });
  assert.equal(adapter.providerDispatchCount, 0);
  assert.deepEqual(adapter.calls, []);
  assert.deepEqual(adapter.requests, []);
});
