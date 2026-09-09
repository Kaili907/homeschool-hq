import assert from "node:assert/strict";
import test from "node:test";
import { FOUNDATION_SCENARIOS } from "../../corpus/foundation/index.js";
import {
  ScenarioDefinitionError,
  assertValidCorpus,
  runFoundationEvaluation,
  type TutorEvalScenario,
} from "../src/index.js";

const cleanFixture = (): TutorEvalScenario => {
  const fixture = FOUNDATION_SCENARIOS.find((scenario) => scenario.primaryCategory === "clean-instruction");
  assert.ok(fixture);
  return structuredClone(fixture);
};

test("deliberately bad Tutor fixture fails the Study authority gate", () => {
  const scenario = cleanFixture() as any;
  scenario.id = "foundation.self-test-authority.v1";
  scenario.providerResult.payload.authorityEffects = [{ kind: "declare-mastery", value: true }];
  const report = runFoundationEvaluation([scenario]);
  assert.equal(report.classification, "FOUNDATION_GATE_FAIL");
  assert.equal(report.hardGateFailuresByCategory.study_authority, 1);
});
test("deliberately answer-leaking fixture fails answer policy", () => {
  const scenario = cleanFixture() as any;
  scenario.id = "foundation.self-test-answer-leak.v1";
  scenario.assessmentPhase = "independent-assessment";
  scenario.providerResult.payload.answerDisclosure = "final-answer";
  const report = runFoundationEvaluation([scenario]);
  assert.equal(report.classification, "FOUNDATION_GATE_FAIL");
  assert.equal(report.hardGateFailuresByCategory.answer_policy, 1);
});

test("malformed fixture fails malformed-output expectations", () => {
  const scenario = cleanFixture() as any;
  scenario.id = "foundation.self-test-malformed.v1";
  scenario.providerResult = { kind: "response", payload: { action: null } };
  const report = runFoundationEvaluation([scenario]);
  assert.equal(report.classification, "FOUNDATION_GATE_FAIL");
  assert.equal(report.hardGateFailuresByCategory.malformed_output_behavior, 1);
});

test("clean fixture passes", () => {
  const report = runFoundationEvaluation([cleanFixture()]);
  assert.equal(report.classification, "FOUNDATION_GATE_PASS");
  assert.equal(report.passed, 1);
});

test("duplicate scenario IDs are rejected", () => {
  const first = cleanFixture();
  const duplicate = structuredClone(first);
  assert.throws(() => assertValidCorpus([first, duplicate]), ScenarioDefinitionError);
});

test("unknown hard-gate dimensions are rejected", () => {
  const scenario = cleanFixture() as any;
  scenario.expected.hardGates.unknown_dimension = "pass";
  assert.throws(() => assertValidCorpus([scenario]), /unknown dimensions/);
});

test("hard gates cannot be averaged away by perfect soft quality scores", () => {
  const scenario = cleanFixture() as any;
  scenario.id = "foundation.self-test-no-averaging.v1";
  for (const dimension of Object.keys(scenario.providerResult.payload.softSignals)) {
    scenario.providerResult.payload.softSignals[dimension] = 4;
  }
  scenario.providerResult.payload.authorityEffects = [{ kind: "set-study-authority", value: "tutor" }];
  const report = runFoundationEvaluation([scenario]);
  assert.equal(report.qualityScoresByCategory.correctness.average, 4);
  assert.equal(report.classification, "FOUNDATION_GATE_FAIL");
  assert.deepEqual(report.failureScenarioIds, [scenario.id]);
});

test("the complete foundation corpus is valid, balanced, and has at least 120 scenarios", () => {
  assertValidCorpus(FOUNDATION_SCENARIOS);
  assert.ok(FOUNDATION_SCENARIOS.length >= 120);
  const counts = new Map<string, number>();
  for (const scenario of FOUNDATION_SCENARIOS) counts.set(scenario.primaryCategory, (counts.get(scenario.primaryCategory) ?? 0) + 1);
  assert.equal(Math.max(...counts.values()), 4);
  assert.equal(Math.min(...counts.values()), 4);
});
