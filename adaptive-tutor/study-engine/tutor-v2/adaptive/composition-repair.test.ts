import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAdaptiveAdmission } from "../../../core/v2/admission/index.js";
import { buildConceptGraph } from "../../../core/v2/concepts/index.js";
import { createAcademicMisconceptionRegistry } from "../../../core/v2/misconceptions/index.js";
import { selectBoundedHint } from "../../../core/v2/hints/index.js";
import { recommendNextIntervention } from "../../../core/v2/interventions/index.js";
import { evaluateMasteryEvidence } from "../../../core/v2/mastery/index.js";
import { validateExact } from "../../../core/v2/contracts/index.js";
import { wave2Fixture } from "../../../tests/tutor-v2-convergence/wave2-fixtures.js";
import { explainTutorRecommendationForParentHub } from "../parent-explanations/index.js";
import { proposePrerequisiteRepair } from "../prerequisite-repair/index.js";
import { proposeReteachPlan } from "../reteach/index.js";
import {
  Wave2StudyDecisionPacketSchema,
  type Wave2AdaptiveCompositionRequest,
} from "./contracts.js";
import {
  composeWave2AdaptiveIntelligence,
  type Wave2AdaptiveSubsystems,
} from "./orchestrator.js";
import { InMemoryWave2ReplayLedger } from "./replay.js";

function subsystems(): Wave2AdaptiveSubsystems {
  return {
    evaluateAdmission: evaluateAdaptiveAdmission,
    buildConceptGraph,
    queryConceptGraph: (graph, conceptRef) => graph.graph.directPrerequisites(conceptRef),
    createMisconceptionRegistry: createAcademicMisconceptionRegistry,
    matchMisconception: (registry, request) => registry.registry.match(request),
    selectHint: selectBoundedHint,
    recommendIntervention: recommendNextIntervention,
    evaluateMastery: evaluateMasteryEvidence,
    proposeRepair: proposePrerequisiteRepair,
    proposeReteach: proposeReteachPlan,
    explainParent: explainTutorRecommendationForParentHub,
  };
}

function selectReteach(request: Wave2AdaptiveCompositionRequest): void {
  request.intervention.assistanceHistory = [{
    learnerScopeRef: request.studyAuthority.learnerScopeRef,
    sessionRef: request.studyAuthority.sessionRef,
    instructionalContextRef: request.studyAuthority.instructionalContextRef,
    sourceInteractionRef: "interaction:prior-prerequisite-check",
    opportunityRef: request.studyAuthority.currentOpportunityRef,
    actionKind: "check-prerequisite",
    outcome: "difficulty-persists",
  }];
  request.intervention.interventionCount = 1;
  request.masteryEvidence.currentOpportunityAssistanceLevel = "guided";
  const current = request.masteryEvidence.evidence.find(
    ({ opportunityRef }) => opportunityRef === request.studyAuthority.currentOpportunityRef,
  );
  if (current !== undefined) current.assistanceLevel = "guided";
}

test("transient adaptive failure does not poison replay and exact retry commits once", async () => {
  const ledger = new InMemoryWave2ReplayLedger();
  const injected = subsystems();
  let available = false;
  Object.defineProperty(injected, "buildConceptGraph", {
    value: (input: unknown) => {
      if (!available) throw new Error("temporary graph outage");
      return buildConceptGraph(input);
    },
  });

  const first = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: ledger,
    adaptiveSubsystems: injected,
  });
  assert.equal(first.status, "reviewed-static-fallback");
  assert.equal(ledger.size, 0);

  available = true;
  const recovered = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: ledger,
    adaptiveSubsystems: injected,
  });
  assert.equal(recovered.status, "pending-study-decision");
  assert.equal(ledger.size, 1);

  const duplicate = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: ledger,
    adaptiveSubsystems: injected,
  });
  assert.equal(duplicate.status, "duplicate-ignored");
  assert.equal(ledger.size, 1);
});

test("concurrent exact requests expose one pending Study effect", async () => {
  const ledger = new InMemoryWave2ReplayLedger();
  const results = await Promise.all([
    composeWave2AdaptiveIntelligence(wave2Fixture(), { replayLedger: ledger }),
    composeWave2AdaptiveIntelligence(wave2Fixture(), { replayLedger: ledger }),
  ]);
  assert.deepEqual(
    results.map(({ status }) => status).sort(),
    ["duplicate-ignored", "pending-study-decision"],
  );
  assert.equal(ledger.size, 1);
});

test("ledger receives only eventRef and SHA-256 digest", async () => {
  const calls: unknown[][] = [];
  const result = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: {
      claim(...args: [string, string]) {
        calls.push(args);
        return "claimed";
      },
    },
  });
  assert.equal(result.status, "pending-study-decision");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.slice(0, 1), ["event:wave2-convergence-a"]);
  assert.match(String(calls[0]?.[1]), /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(calls).includes("learner-scope:wave2-a"), false);
  assert.equal(JSON.stringify(calls).includes("academic-evidence"), false);
});

test("semantic admission reordering is duplicate, while changed payload collides", async () => {
  const ledger = new InMemoryWave2ReplayLedger();
  assert.equal((await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: ledger,
  })).status, "pending-study-decision");

  const reordered = wave2Fixture();
  reordered.reviewedContentAdmissions.reverse();
  reordered.capabilityMetadata.capabilities.reverse();
  reordered.studyAuthority.allowedActions.reverse();
  reordered.intervention.allowedActions.reverse();
  assert.equal((await composeWave2AdaptiveIntelligence(reordered, {
    replayLedger: ledger,
  })).status, "duplicate-ignored");

  const changed = wave2Fixture();
  changed.hintSelection.attemptCount += 1;
  const collision = await composeWave2AdaptiveIntelligence(changed, { replayLedger: ledger });
  assert.equal(collision.status, "quarantined");
  assert.equal(collision.reasonCode, "event-identity-collision");
});

test("unknown ledger result fails closed as dependency failure, not collision", async () => {
  const result = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: {
      claim: (() => "unknown-ledger-state") as never,
    },
  });
  assert.equal(result.status, "reviewed-static-fallback");
  assert.equal(result.reasonCode, "replay-ledger-unavailable");
});

test("malformed intervention and authority-bearing repair outputs fall back", async () => {
  const malformedIntervention = subsystems();
  Object.defineProperty(malformedIntervention, "recommendIntervention", {
    value: () => ({
      status: "recommended",
      recommendation: { actionKind: "return-to-lesson" },
    }),
  });
  const interventionResult = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: new InMemoryWave2ReplayLedger(),
    adaptiveSubsystems: malformedIntervention,
  });
  assert.equal(interventionResult.status, "reviewed-static-fallback");
  assert.equal(interventionResult.failedFeature, "intervention-ladder");

  const malformedRepair = subsystems();
  Object.defineProperty(malformedRepair, "proposeRepair", {
    value: async () => ({
      status: "proposed",
      proposalRef: "repair-proposal:fake",
      reviewedContentRefs: ["reviewed-content:untrusted"],
      appliedRepairDepth: 99,
      authorityEffects: {
        workingLevelMutation: "replace-official-level",
        masteryWrite: "declare-mastered",
      },
    }),
  });
  const repairResult = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: new InMemoryWave2ReplayLedger(),
    adaptiveSubsystems: malformedRepair,
  });
  assert.equal(repairResult.status, "reviewed-static-fallback");
  assert.equal(repairResult.failedFeature, "prerequisite-repair");
  assert.equal(JSON.stringify(repairResult).includes("replace-official-level"), false);
  assert.equal(JSON.stringify(repairResult).includes("declare-mastered"), false);
});

test("graph membership without trusted signal does not infer prerequisite deficiency", async () => {
  const request = wave2Fixture();
  request.misconceptionMatch.evidence = [];
  const result = await composeWave2AdaptiveIntelligence(request, {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected pending decision");
  assert.equal(result.misconception.status, "no-signal");
  assert.equal(result.intervention.actionKind, "hint");
  assert.equal(result.repair.status, "withheld");
  assert.deepEqual(result.repair.recommendedConceptRefs, []);
  assert.equal(result.parentExplanation?.reasonCode, "hint-level-changed");
});

test("progress return-to-lesson suppresses unrelated action lanes and Parent Why follows it", async () => {
  const request = wave2Fixture();
  request.intervention.assistanceHistory = [{
    learnerScopeRef: request.studyAuthority.learnerScopeRef,
    sessionRef: request.studyAuthority.sessionRef,
    instructionalContextRef: request.studyAuthority.instructionalContextRef,
    sourceInteractionRef: "interaction:progress-observed",
    opportunityRef: request.studyAuthority.currentOpportunityRef,
    actionKind: "hint",
    outcome: "progress-observed",
  }];
  request.intervention.interventionCount = 1;
  const result = await composeWave2AdaptiveIntelligence(request, {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected pending decision");
  assert.equal(result.intervention.actionKind, "return-to-lesson");
  assert.equal(result.hint.status, "no-hint");
  assert.equal(result.repair.status, "withheld");
  assert.equal(result.reteach.status, "withheld");
  assert.equal(result.parentExplanation?.reasonCode, "independent-practice-requested");
});

test("reteach is the sole action proposal and Parent Why explains reteach", async () => {
  const request = wave2Fixture();
  selectReteach(request);
  const result = await composeWave2AdaptiveIntelligence(request, {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected pending decision");
  assert.equal(result.intervention.actionKind, "reteach");
  assert.equal(result.hint.status, "no-hint");
  assert.equal(result.repair.status, "withheld");
  assert.equal(result.reteach.status, "proposed");
  assert.equal(result.parentExplanation?.reasonCode, "reteach-suggested");
});

test("foreign-grade prerequisite cannot influence the selected route", async () => {
  const request = wave2Fixture();
  const prerequisite = request.conceptScopeBindings.find(
    ({ conceptRef }) => conceptRef === "concept:equivalent-fractions",
  );
  assert.ok(prerequisite);
  prerequisite.gradeRef = "grade:foreign";
  const result = await composeWave2AdaptiveIntelligence(request, {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected pending decision");
  assert.notEqual(result.intervention.actionKind, "check-prerequisite");
  assert.equal(result.repair.status, "withheld");
  assert.deepEqual(result.concept.directPrerequisiteRefs, []);
});

test("pending result is runtime-valid and carries minimized opportunity provenance", async () => {
  const request = wave2Fixture();
  const result = await composeWave2AdaptiveIntelligence(request, {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });
  assert.equal(validateExact(Wave2StudyDecisionPacketSchema, result).status, "accepted");
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected pending decision");
  assert.deepEqual(result.opportunityProvenance, {
    learnerScopeRef: request.studyAuthority.learnerScopeRef,
    sessionRef: request.studyAuthority.sessionRef,
    instructionalContextRef: request.studyAuthority.instructionalContextRef,
    currentOpportunityRef: request.studyAuthority.currentOpportunityRef,
    effectiveCurrentAssistanceLevel: "light-hint",
  });
  assert.equal(JSON.stringify(result.opportunityProvenance).includes("name"), false);
});
