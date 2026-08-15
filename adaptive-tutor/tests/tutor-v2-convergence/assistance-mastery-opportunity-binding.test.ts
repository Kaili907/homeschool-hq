import assert from "node:assert/strict";
import test from "node:test";
import { wave2Fixture } from "./wave2-fixtures.js";
import {
  composeWithCounters,
  counters,
  requirePending,
  setCurrentAssistance,
} from "./wave2-r2-test-support.js";

function noCurrentHint() {
  const input = wave2Fixture();
  input.hintSelection.attemptCount = 0;
  setCurrentAssistance(input, "independent");
  return input;
}

function guidedHint() {
  const input = wave2Fixture();
  input.misconceptionMatch.evidence = [];
  input.studyAuthority.studyHintCeiling = "guided-step";
  input.hintSelection.studyHintCeiling = "guided-step";
  input.hintSelection.attemptCount = 3;
  input.hintSelection.reviewedHints.push({
    metadataKind: "study-reviewed-hint",
    hintRef: "hint:wave2-guided",
    reviewedContentRef: "reviewed-content:wave2-guided",
    reviewRef: "review:wave2-guided",
    hintLevel: "guided-step",
    eligibleMisconceptionCodes: [],
    eligibleLearnerStageRefs: ["learning-stage:middle"],
  });
  return input;
}

test("ASSISTANCE_MASTERY_OPPORTUNITY_BINDING accepts independent evidence only with no current assistance", async () => {
  const result = requirePending(await composeWithCounters(noCurrentHint(), counters()));
  assert.equal(result.hint.status, "no-hint");
  assert.equal(result.mastery.recommendation, "supported-evidence");
});

test("ASSISTANCE_MASTERY_OPPORTUNITY_BINDING reproduces W2-10R1 concept-cue to independent attack", async () => {
  const input = wave2Fixture();
  input.misconceptionMatch.evidence = [];
  input.hintSelection.reviewedHints.push({
    metadataKind: "study-reviewed-hint",
    hintRef: "hint:wave2-generic-concept",
    reviewedContentRef: "reviewed-content:wave2-generic-concept",
    reviewRef: "review:wave2-generic-concept",
    hintLevel: "concept-cue",
    eligibleMisconceptionCodes: [],
    eligibleLearnerStageRefs: [],
  });
  setCurrentAssistance(input, "independent");
  const calls = counters();
  const result = await composeWithCounters(input, calls);
  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status === "reviewed-static-fallback") {
    assert.equal(result.reasonCode, "current-opportunity-assistance-binding-rejected");
    assert.equal(result.failedFeature, "mastery-evidence");
  }
  assert.equal(calls.hint, 1);
  assert.equal(calls.mastery, 0);
});

test("ASSISTANCE_MASTERY_OPPORTUNITY_BINDING rejects guided to independent but accepts guided to guided", async () => {
  const attack = guidedHint();
  setCurrentAssistance(attack, "independent");
  const attackCalls = counters();
  const rejected = await composeWithCounters(attack, attackCalls);
  assert.equal(rejected.status, "reviewed-static-fallback");
  assert.equal(attackCalls.mastery, 0);

  const aligned = guidedHint();
  setCurrentAssistance(aligned, "guided");
  const result = requirePending(await composeWithCounters(aligned, counters()));
  assert.equal(result.hint.hintLevel, "guided-step");
  assert.equal(result.mastery.evaluationStatus, "summarized");
  assert.equal(result.mastery.recommendation, "emerging-evidence");
  assert.equal(result.mastery.sampleCount, 2);
});

test("ASSISTANCE_MASTERY_OPPORTUNITY_BINDING preserves historical independence without relabeling current guided work", async () => {
  const input = guidedHint();
  setCurrentAssistance(input, "guided");
  const result = requirePending(await composeWithCounters(input, counters()));
  assert.equal(result.mastery.sampleCount, 2);
  assert.notEqual(result.mastery.recommendation, "supported-evidence");
});

test("ASSISTANCE_MASTERY_OPPORTUNITY_BINDING uses most-assisted same-opportunity history and rejects duplicate opportunities", async () => {
  const historyAttack = wave2Fixture();
  historyAttack.hintSelection.interventionHistory = [{
    learnerScopeRef: historyAttack.studyAuthority.learnerScopeRef,
    sessionRef: historyAttack.studyAuthority.sessionRef,
    interventionRef: "intervention:guided-current-opportunity",
    contextRef: historyAttack.studyAuthority.instructionalContextRef,
    sourceInteractionRef: "interaction:guided-current-opportunity",
    opportunityRef: historyAttack.studyAuthority.currentOpportunityRef,
    ordinal: 1,
    interventionKind: "hint-provided",
    hintLevel: "guided-step",
    assistanceLevel: "guided",
  }];
  const historyCalls = counters();
  const historyResult = await composeWithCounters(historyAttack, historyCalls);
  assert.equal(historyResult.status, "reviewed-static-fallback");
  assert.equal(historyCalls.mastery, 0);

  const duplicate = noCurrentHint();
  duplicate.masteryEvidence.evidence.push({
    ...duplicate.masteryEvidence.evidence[1]!,
    evidenceRef: "study-evidence:duplicate-opportunity",
  });
  const result = requirePending(await composeWithCounters(duplicate, counters()));
  assert.equal(result.mastery.evaluationStatus, "rejected");
  assert.equal(result.mastery.sampleCount, 0);
  assert.notEqual(result.mastery.recommendation, "supported-evidence");
});
