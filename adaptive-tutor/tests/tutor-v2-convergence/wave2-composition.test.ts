import assert from "node:assert/strict";
import test from "node:test";
import { TutorV2 } from "../../core/index.js";
import { validateExact } from "../../core/v2/contracts/index.js";
import {
  InMemoryWave2ReplayLedger,
  Wave2StudyDecisionPacketSchema,
  composeWave2AdaptiveIntelligence,
} from "../../study-engine/tutor-v2/adaptive/index.js";
import { wave2Fixture } from "./wave2-fixtures.js";

async function compose(
  input: unknown = wave2Fixture(),
  ledger = new InMemoryWave2ReplayLedger(),
) {
  return composeWave2AdaptiveIntelligence(input, { replayLedger: ledger });
}

function requirePending(result: Awaited<ReturnType<typeof compose>>) {
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected pending Study decision");
  return result;
}

function selectReteach(input: ReturnType<typeof wave2Fixture>): void {
  input.intervention.assistanceHistory = [{
    learnerScopeRef: input.studyAuthority.learnerScopeRef,
    sessionRef: input.studyAuthority.sessionRef,
    instructionalContextRef: input.studyAuthority.instructionalContextRef,
    sourceInteractionRef: "interaction:wave2-reteach-selection",
    opportunityRef: input.studyAuthority.currentOpportunityRef,
    actionKind: "check-prerequisite",
    outcome: "difficulty-persists",
  }];
  input.intervention.interventionCount = 1;
  input.masteryEvidence.currentOpportunityAssistanceLevel = "guided";
  const current = input.masteryEvidence.evidence.find(
    ({ opportunityRef }) => opportunityRef === input.studyAuthority.currentOpportunityRef,
  );
  assert.ok(current);
  current.assistanceLevel = "guided";
}

test("Wave 2 composition runs all admitted lanes and returns control to Study", async () => {
  const result = requirePending(await compose());
  assert.equal(result.admissions.length, 8);
  assert.ok(result.admissions.every(({ status }) => status === "admitted"));
  assert.deepEqual(result.concept.directPrerequisiteRefs, ["concept:equivalent-fractions"]);
  assert.equal(result.misconception.status, "possible-misconception");
  assert.equal(result.hint.status, "no-hint");
  assert.equal(result.intervention.actionKind, "check-prerequisite");
  assert.equal(result.mastery.recommendation, "supported-evidence");
  assert.equal(result.repair.status, "proposed");
  assert.equal(result.reteach.status, "withheld");
  assert.notEqual(result.parentExplanation, null);
  assert.equal(result.studyEngineRemainsAuthority, true);
  assert.equal(result.studyMutationAllowed, false);
  assert.equal(result.studyDecisionRequired, true);
});

test("ADMISSION_GATE prevents an unadmitted capability from running", async () => {
  const input = wave2Fixture();
  const capability = input.capabilityMetadata.capabilities.find(
    ({ feature }) => feature === "hint-ladder",
  );
  assert.ok(capability);
  capability.admission = "not-admitted";
  const result = await compose(input);
  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status === "reviewed-static-fallback") {
    assert.equal(result.failedFeature, "hint-ladder");
    assert.equal(result.reasonCode, "admission-adaptive-feature-not-admitted");
  }
});

test("CONCEPT_GRAPH_GATE rejects cycles before a repair route exists", async () => {
  const input = wave2Fixture();
  input.conceptGraph.edges.push({
    prerequisiteConceptRef: "concept:fraction-addition",
    dependentConceptRef: "concept:equivalent-fractions",
  });
  const result = await compose(input);
  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status === "reviewed-static-fallback") {
    assert.equal(result.failedFeature, "concept-prerequisite-graph");
  }
});

test("MISCONCEPTION_GATE remains an academic signal without diagnostic authority", async () => {
  const result = requirePending(await compose());
  assert.equal(result.misconception.possibleInstructionalSignalOnly, true);
  assert.equal(result.misconception.authoritativeDiagnosis, false);
  assert.equal(result.misconception.durableLearnerClassificationAllowed, false);
  const serialized = JSON.stringify(result.misconception);
  for (const forbidden of ["psychologicalLabel", "diagnosticLabel", "personality", "emotion"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("HINT_CEILING_GATE never exceeds the Study ceiling", async () => {
  const input = wave2Fixture();
  input.studyAuthority.studyHintCeiling = "nudge";
  input.hintSelection.studyHintCeiling = "nudge";
  input.hintSelection.attemptCount = 9;
  input.misconceptionMatch.evidence = [];
  input.masteryEvidence.currentOpportunityAssistanceLevel = "light-hint";
  const current = input.masteryEvidence.evidence.find(
    ({ opportunityRef }) => opportunityRef === input.studyAuthority.currentOpportunityRef,
  );
  assert.ok(current);
  current.assistanceLevel = "light-hint";
  const result = requirePending(await compose(input));
  assert.equal(result.hint.hintLevel, "nudge");
  assert.equal(result.repair.status, "withheld");
  assert.equal(result.reteach.status, "withheld");
});

test("ACTIVE_ASSESSMENT_GATE structurally withholds hints, repair, and reteach", async () => {
  const input = wave2Fixture();
  input.studyAuthority.assessmentPhase = "active-graded-or-mastery-check";
  input.hintSelection.assessmentPhase = "active-graded-or-mastery-check";
  input.intervention.assessmentPhase = "active-graded-or-mastery-check";
  input.masteryEvidence.currentOpportunityAssistanceLevel = "independent";
  const current = input.masteryEvidence.evidence.find(
    ({ opportunityRef }) => opportunityRef === input.studyAuthority.currentOpportunityRef,
  );
  assert.ok(current);
  current.assistanceLevel = "independent";
  const result = requirePending(await compose(input));
  assert.equal(result.hint.status, "no-hint");
  assert.equal(result.hint.hintLevel, "none");
  assert.equal(result.repair.status, "withheld");
  assert.equal(result.reteach.status, "withheld");
  assert.equal(result.reteach.activeAssessmentBypass, false);
});

test("MASTERY_AUTHORITY_GATE emits evidence only and cannot declare mastery", async () => {
  const result = requirePending(await compose());
  assert.equal(result.mastery.authoritative, false);
  assert.equal(result.mastery.studyMutationAllowed, false);
  assert.equal(result.tutorCanDeclareOfficialMastery, false);
  assert.equal("mastered" in result.mastery, false);
});

test("WORKING_LEVEL_GATE leaves official placement unchanged", async () => {
  const result = requirePending(await compose());
  assert.equal(result.repair.workingLevelMutation, "none");
  assert.equal(result.reteach.workingLevelMutation, "none");
  assert.equal(result.tutorCanChangeOfficialWorkingLevel, false);
  assert.equal(JSON.stringify(result).includes("working-level:official-study-a"), false);
});

test("REPAIR_DEPTH_GATE caps repair depth and repeated reteach loops", async () => {
  const result = requirePending(await compose());
  assert.ok(result.repair.appliedRepairDepth <= 3);
  assert.ok(result.reteach.stepCount <= 4);

  const input = wave2Fixture();
  selectReteach(input);
  input.reteachPolicy.priorReteachLoops = input.reteachPolicy.maximumRepeatedLoops;
  const capped = requirePending(await compose(input));
  assert.equal(capped.reteach.status, "withheld");
  assert.equal(capped.reteach.source, "none");
  assert.equal(capped.reteach.reasonCode, "repeated-reteach-loop-cap-reached");
  assert.equal(capped.reteach.stepCount, 0);
  assert.deepEqual(capped.reteach.reviewedContentRefs, []);
});

test("CROSS_CHILD_ISOLATION_GATE rejects learner reuse", async () => {
  const input = wave2Fixture();
  input.masteryEvidence.learnerScopeRef = "learner-scope:other-child";
  const result = await compose(input);
  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status === "reviewed-static-fallback") {
    assert.equal(result.reasonCode, "cross-context-or-authority-binding-rejected");
  }
});

test("PARENT_PRIVACY_GATE returns closed reviewed copy and Study-bound visibility scope", async () => {
  const result = requirePending(await compose());
  assert.notEqual(result.parentExplanation, null);
  if (result.parentExplanation === null) throw new Error("Expected Parent Why");
  assert.equal(
    result.parentExplanation.explanation.title,
    "Prerequisite review suggested",
  );
  assert.equal(
    result.parentExplanation.explanation.explanation,
    "Tutor suggested reviewing an earlier skill that may help with the current work.",
  );
  assert.equal(
    "authoritativeDiagnosis" in result.parentExplanation.explanation,
    false,
  );
  assert.equal(result.parentExplanation.authoritative, false);
  assert.equal(result.parentExplanation.studyMutationAllowed, false);
  assert.equal(
    result.parentExplanation.visibilityAuthorization.learnerScopeRef,
    "learner-scope:wave2-a",
  );
  assert.equal(result.parentExplanation.visibilityAuthorization.issuer, "study");
  const serialized = JSON.stringify(result.parentExplanation);
  for (const forbidden of [
    "transcript", "rawLearner", "academic-evidence", "diagnosis", "personality",
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
});

test("REPLAY_GATE ignores exact duplicates and quarantines identity collisions", async () => {
  const ledger = new InMemoryWave2ReplayLedger();
  assert.equal((await compose(wave2Fixture(), ledger)).status, "pending-study-decision");
  const duplicate = await compose(wave2Fixture(), ledger);
  assert.equal(duplicate.status, "duplicate-ignored");

  const changed = wave2Fixture();
  changed.hintSelection.attemptCount = 3;
  const collision = await compose(changed, ledger);
  assert.equal(collision.status, "quarantined");
  assert.equal(ledger.size, 1);
});

test("STATIC_FALLBACK_GATE retains reviewed content on adaptive failure", async () => {
  const input = wave2Fixture();
  input.conceptGraph.edges.push({
    prerequisiteConceptRef: "concept:fraction-addition",
    dependentConceptRef: "concept:missing",
  });
  const result = await compose(input);
  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status === "reviewed-static-fallback") {
    assert.equal(result.fallbackRef, "fallback:wave2-composition");
    assert.deepEqual(result.reviewedContentRefs, ["reviewed-content:wave2-composition-static"]);
    assert.equal(result.studyMutationAllowed, false);
  }
});

test("serialized Wave 2 decision packets conform to the generated boundary", async () => {
  for (const result of [
    await compose(),
    await compose({ malformed: true }),
  ]) {
    assert.equal(validateExact(Wave2StudyDecisionPacketSchema, result).status, "accepted");
  }
});

test("shared Tutor V2 namespace exports accepted Wave 2 core lanes", () => {
  assert.equal(typeof TutorV2.evaluateAdaptiveAdmission, "function");
  assert.equal(typeof TutorV2.buildConceptGraph, "function");
  assert.equal(typeof TutorV2.selectBoundedHint, "function");
  assert.equal(typeof TutorV2.recommendNextIntervention, "function");
  assert.equal(typeof TutorV2.evaluateMasteryEvidence, "function");
});
