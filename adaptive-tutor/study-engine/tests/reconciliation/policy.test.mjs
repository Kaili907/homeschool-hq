import test from "node:test";
import assert from "node:assert/strict";
import { resolveDurationPolicy } from "../../reconciliation/probes/policy.mjs";

const base = {
  policyVersion: 1,
  integrityValid: true,
  actorAuthorized: true,
  safety: { minimumMinutes: 5, maximumMinutes: 60 },
  accommodations: [],
  adultHardMaximums: [],
  currentMinutes: 20,
  gradeBandDefaultMinutes: 25
};

test("hard maximum clamps an active hold", () => {
  const result = resolveDurationPolicy({
    ...base,
    currentMinutes: 30,
    adultHardMaximums: [{ active: true, minutes: 20 }],
    manualOverride: { active: true, mode: "hold" }
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.targetMinutes, 20);
});

test("required accommodation wins over looser parent maximum and manual target", () => {
  const result = resolveDurationPolicy({
    ...base,
    accommodations: [{ active: true, maximumMinutes: 15 }],
    adultHardMaximums: [{ active: true, minutes: 20 }],
    manualOverride: { active: true, mode: "target", targetMinutes: 25 }
  });
  assert.equal(result.targetMinutes, 15);
});

test("incompatible required bounds stop automation", () => {
  const result = resolveDurationPolicy({
    ...base,
    accommodations: [
      { active: true, minimumMinutes: 25 },
      { active: true, maximumMinutes: 15 }
    ]
  });
  assert.equal(result.status, "manual-review");
  assert.equal(result.targetMinutes, null);
});

test("rejected recommendation is not applied", () => {
  const result = resolveDurationPolicy({
    ...base,
    establishedTargetMinutes: 20,
    recommendation: { state: "rejected", targetMinutes: 35 }
  });
  assert.equal(result.source, "established-target");
  assert.equal(result.targetMinutes, 20);
});

test("unsupported policy versions quarantine before resolution", () => {
  const result = resolveDurationPolicy({ ...base, policyVersion: 2 });
  assert.equal(result.status, "quarantine");
});
