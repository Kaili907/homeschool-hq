import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTACK_FAMILIES,
  PROMPT_INJECTION_CORPUS,
  SAFE_OUTCOMES,
} from "./corpus.js";
import {
  applyMutationControl,
  assertCaseObservation,
  executeAttackCase,
} from "./harness.js";

test("corpus is stable, categorized, and covers both trust boundaries", () => {
  assert.equal(PROMPT_INJECTION_CORPUS.cases.length, 38);
  assert.equal(PROMPT_INJECTION_CORPUS.mutationControls.length, 6);
  assert.deepEqual(
    [...new Set(PROMPT_INJECTION_CORPUS.cases.map((attack) => attack.family))].sort(),
    [...ATTACK_FAMILIES].sort(),
  );
  assert.deepEqual(
    [...new Set(PROMPT_INJECTION_CORPUS.cases.map((attack) => attack.surface))].sort(),
    ["trusted-reviewed-context", "untrusted-provider-response"],
  );
  for (const attack of PROMPT_INJECTION_CORPUS.cases) {
    assert.ok(SAFE_OUTCOMES.includes(attack.expectedOutcome));
    assert.match(attack.caseId, /^W4-PI-(?:TR|PR)-\d{3}$/);
  }
});

for (const attack of PROMPT_INJECTION_CORPUS.cases) {
  test(`${attack.caseId} ${attack.surface} / ${attack.family}`, () => {
    const observation = executeAttackCase(attack);
    assertCaseObservation(observation);
  });
}

test("mutation-style negative controls are killed by the permanent corpus oracle", () => {
  for (const mutation of PROMPT_INJECTION_CORPUS.mutationControls) {
    const attack = PROMPT_INJECTION_CORPUS.cases.find(
      (candidate) => candidate.caseId === mutation.targetCaseId,
    );
    assert.ok(attack, `${mutation.mutationId} target must exist`);
    const observation = executeAttackCase(attack);
    assertCaseObservation(observation);
    const mutant = applyMutationControl(observation, mutation);
    assert.throws(
      () => assertCaseObservation(mutant),
      new RegExp(`\\[${mutation.expectedDetector}\\]`),
      `${mutation.mutationId} must be killed by ${mutation.expectedDetector}`,
    );
  }
});
