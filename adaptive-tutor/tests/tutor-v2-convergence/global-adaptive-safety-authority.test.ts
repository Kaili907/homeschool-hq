import assert from "node:assert/strict";
import test from "node:test";
import { wave2Fixture } from "./wave2-fixtures.js";
import {
  assertNoAdaptiveCalls,
  composeWithCounters,
  counters,
  CountingReplayLedger,
  heldFixture,
} from "./wave2-r2-test-support.js";

test("GLOBAL_ADAPTIVE_SAFETY_AUTHORITY reconciles every safety representation before dependencies", async () => {
  const contradictions = [
    () => {
      const input = heldFixture();
      input.capabilityMetadata.safetyAdmission = "admitted";
      return input;
    },
    () => {
      const input = wave2Fixture();
      input.capabilityMetadata.safetyAdmission = "restricted";
      return input;
    },
    () => {
      const input = heldFixture();
      input.intervention.safetyRestriction = { status: "none", restrictionRef: null };
      return input;
    },
    () => {
      const input = wave2Fixture();
      input.intervention.safetyRestriction = {
        status: "academic-flow-held",
        restrictionRef: "restriction:contradictory",
      };
      return input;
    },
  ];

  for (const makeInput of contradictions) {
    const calls = counters();
    const ledger = new CountingReplayLedger();
    const result = await composeWithCounters(makeInput(), calls, ledger);
    assert.equal(result.status, "quarantined");
    assert.equal(result.reasonCode, "safety-representation-conflict");
    assert.equal(ledger.calls, 0);
    assertNoAdaptiveCalls(calls);
  }

  const calls = counters();
  const held = await composeWithCounters(heldFixture(), calls);
  assert.equal(held.status, "quarantined");
  assert.equal(held.reasonCode, "study-safety-held");
  for (const forbidden of [
    "admissions", "concept", "misconception", "hint", "intervention", "mastery",
    "repair", "reteach", "parentExplanation", "reviewedContentRefs",
  ]) assert.equal(forbidden in held, false, forbidden);
  assertNoAdaptiveCalls(calls);
});
