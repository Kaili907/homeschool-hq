import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_WAVE4_GATE_EVIDENCE,
  NEGATIVE_CONTROL_CATALOG,
  POST_REPAIR_BLOCKER_CLOSURES,
  WAVE4_HARD_GATE_FAMILIES,
  evaluateWave4HardGates,
  negativeControlEvidence,
} from "../../scripts/tutor-v4/evidence.js";

test("all 38 historical blockers remain RED in baseline provenance and CLOSED now", () => {
  assert.equal(POST_REPAIR_BLOCKER_CLOSURES.length, 38);
  assert.equal(new Set(POST_REPAIR_BLOCKER_CLOSURES.map((item) => item.id)).size, 38);
  assert.equal(
    POST_REPAIR_BLOCKER_CLOSURES.every((item) =>
      item.baseline === "BASELINE_ADVERSARIAL_FINDING" && item.current === "CLOSED"
    ),
    true,
  );
  assert.deepEqual(
    Object.fromEntries(["W4-03", "W4-05", "W4-06", "W4-08", "W4-10"].map((lane) => [
      lane,
      POST_REPAIR_BLOCKER_CLOSURES.filter((item) => item.lane === lane).length,
    ])),
    { "W4-03": 19, "W4-05": 5, "W4-06": 2, "W4-08": 7, "W4-10": 5 },
  );
});

test("all 13 Wave 4 hard-gate families are present, ordered, and non-compensable", () => {
  const results = evaluateWave4HardGates(CURRENT_WAVE4_GATE_EVIDENCE);
  assert.equal(results.length, 13);
  assert.deepEqual(results.map((result) => result.name), WAVE4_HARD_GATE_FAMILIES);
  assert.deepEqual(results.filter((result) => result.status !== "PASS"), []);
  assert.equal(results.every((result) => result.nonCompensable), true);
});

test("one failed Wave 4 family fails the aggregate with no compensation", () => {
  const evidence = {
    ...CURRENT_WAVE4_GATE_EVIDENCE,
    CROSS_SCOPE_COMMERCIAL_ISOLATION: false,
  };
  const results = evaluateWave4HardGates(evidence);
  assert.deepEqual(
    results.filter((result) => result.status === "FAIL").map((result) => result.name),
    ["CROSS_SCOPE_COMMERCIAL_ISOLATION"],
  );
});

for (const control of NEGATIVE_CONTROL_CATALOG) {
  test(`${control.id} detects ${control.family}`, () => {
    const result = negativeControlEvidence().find((item) => item.id === control.id);
    assert.ok(result);
    assert.equal(result.status, "DETECTED");
    assert.deepEqual(result.failedFamilies, [control.family]);
    assert.equal(result.compilerFailureUsedAsDetection, false);
  });
}
