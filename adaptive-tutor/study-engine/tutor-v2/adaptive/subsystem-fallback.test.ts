import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAdaptiveAdmission, type AdaptiveFeature } from "../../../core/v2/admission/index.js";
import { buildConceptGraph } from "../../../core/v2/concepts/index.js";
import { createAcademicMisconceptionRegistry } from "../../../core/v2/misconceptions/index.js";
import { selectBoundedHint } from "../../../core/v2/hints/index.js";
import { recommendNextIntervention } from "../../../core/v2/interventions/index.js";
import { evaluateMasteryEvidence } from "../../../core/v2/mastery/index.js";
import { wave2Fixture } from "../../../tests/tutor-v2-convergence/wave2-fixtures.js";
import { explainTutorRecommendationForParentHub } from "../parent-explanations/index.js";
import { proposePrerequisiteRepair } from "../prerequisite-repair/index.js";
import { proposeReteachPlan } from "../reteach/index.js";
import type { Wave2AdaptiveCompositionRequest, Wave2StudyDecisionPacket } from "./contracts.js";
import {
  composeWave2AdaptiveIntelligence,
  type Wave2AdaptiveSubsystems,
} from "./orchestrator.js";
import { InMemoryWave2ReplayLedger } from "./replay.js";

type Boundary = keyof Wave2AdaptiveSubsystems;
type ActionKind = Wave2AdaptiveCompositionRequest["studyAuthority"]["allowedActions"][number];

class CustomThrownValue {
  readonly privateNote = "custom-class-private-note";
}

const ORDERED_BOUNDARIES: readonly Boundary[] = [
  "evaluateAdmission",
  "buildConceptGraph",
  "queryConceptGraph",
  "createMisconceptionRegistry",
  "matchMisconception",
  "recommendIntervention",
  "selectHint",
  "evaluateMastery",
  "proposeRepair",
  "proposeReteach",
  "explainParent",
];

const EXPECTED_FAILURE: Readonly<Record<Boundary, {
  readonly reasonCode: string;
  readonly failedFeature: AdaptiveFeature;
}>> = {
  evaluateAdmission: {
    reasonCode: "adaptive-admission-unavailable",
    failedFeature: "concept-prerequisite-graph",
  },
  buildConceptGraph: {
    reasonCode: "concept-graph-unavailable",
    failedFeature: "concept-prerequisite-graph",
  },
  queryConceptGraph: {
    reasonCode: "concept-query-unavailable",
    failedFeature: "concept-prerequisite-graph",
  },
  createMisconceptionRegistry: {
    reasonCode: "misconception-registry-unavailable",
    failedFeature: "misconception-analysis",
  },
  matchMisconception: {
    reasonCode: "misconception-match-unavailable",
    failedFeature: "misconception-analysis",
  },
  selectHint: {
    reasonCode: "hint-ladder-unavailable",
    failedFeature: "hint-ladder",
  },
  recommendIntervention: {
    reasonCode: "intervention-ladder-unavailable",
    failedFeature: "intervention-ladder",
  },
  evaluateMastery: {
    reasonCode: "mastery-evidence-unavailable",
    failedFeature: "mastery-evidence",
  },
  proposeRepair: {
    reasonCode: "prerequisite-repair-unavailable",
    failedFeature: "prerequisite-repair",
  },
  proposeReteach: {
    reasonCode: "reteach-unavailable",
    failedFeature: "reteach",
  },
  explainParent: {
    reasonCode: "parent-explanation-unavailable",
    failedFeature: "parent-explanation",
  },
};

function trackedSubsystems(calls: Boundary[]): Wave2AdaptiveSubsystems {
  return {
    evaluateAdmission(input) {
      calls.push("evaluateAdmission");
      return evaluateAdaptiveAdmission(input);
    },
    buildConceptGraph(input) {
      calls.push("buildConceptGraph");
      return buildConceptGraph(input);
    },
    queryConceptGraph(graph, conceptRef) {
      calls.push("queryConceptGraph");
      return graph.graph.directPrerequisites(conceptRef);
    },
    createMisconceptionRegistry(input) {
      calls.push("createMisconceptionRegistry");
      return createAcademicMisconceptionRegistry(input);
    },
    matchMisconception(registry, request) {
      calls.push("matchMisconception");
      return registry.registry.match(request);
    },
    selectHint(input) {
      calls.push("selectHint");
      return selectBoundedHint(input);
    },
    recommendIntervention(input) {
      calls.push("recommendIntervention");
      return recommendNextIntervention(input);
    },
    evaluateMastery(input) {
      calls.push("evaluateMastery");
      return evaluateMasteryEvidence(input);
    },
    proposeRepair(input, dependencies) {
      calls.push("proposeRepair");
      return proposePrerequisiteRepair(input, dependencies);
    },
    proposeReteach(input, dependencies) {
      calls.push("proposeReteach");
      return proposeReteachPlan(input, dependencies);
    },
    explainParent(input) {
      calls.push("explainParent");
      return explainTutorRecommendationForParentHub(input);
    },
  };
}

function authorize(
  request: Wave2AdaptiveCompositionRequest,
  allowedActions: readonly ActionKind[],
): void {
  request.studyAuthority.allowedActions = [...allowedActions];
  request.intervention.allowedActions = [...allowedActions];
  if (!allowedActions.includes("hint")) {
    request.hintSelection.previousAssistanceLevel = "independent";
    request.masteryEvidence.currentOpportunityAssistanceLevel = "independent";
    const current = request.masteryEvidence.evidence.find(
      ({ opportunityRef }) => opportunityRef === request.studyAuthority.currentOpportunityRef,
    );
    if (current !== undefined) current.assistanceLevel = "independent";
  }
}

function selectBoundaryRoute(
  request: Wave2AdaptiveCompositionRequest,
  boundary: Boundary,
): void {
  if (boundary === "selectHint") {
    request.misconceptionMatch.evidence = [];
  }
  if (boundary === "proposeReteach") {
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
}

async function compose(
  request: unknown,
  subsystems: Wave2AdaptiveSubsystems,
): Promise<Wave2StudyDecisionPacket> {
  return composeWave2AdaptiveIntelligence(request, {
    replayLedger: new InMemoryWave2ReplayLedger(),
    adaptiveSubsystems: subsystems,
  });
}

function assertReviewedFallback(
  result: Wave2StudyDecisionPacket,
  request: Wave2AdaptiveCompositionRequest,
  boundary: Boundary,
): void {
  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status !== "reviewed-static-fallback") throw new Error("Expected fallback");
  assert.equal(result.eventRef, request.studyAuthority.eventRef);
  assert.equal(result.fallbackRef, request.reviewedStaticFallback.fallbackRef);
  assert.deepEqual(result.reviewedContentRefs, request.reviewedStaticFallback.reviewedContentRefs);
  assert.equal(result.reasonCode, EXPECTED_FAILURE[boundary].reasonCode);
  assert.equal(result.failedFeature, EXPECTED_FAILURE[boundary].failedFeature);
  assert.equal("admissions" in result, false);
  assert.equal("mastery" in result, false);
  assert.equal("parentExplanation" in result, false);
  assert.equal(result.studyMutationAllowed, false);
}

function throwingSubsystems(
  calls: Boundary[],
  boundary: Boundary,
  thrown: unknown,
): Wave2AdaptiveSubsystems {
  const subsystems = trackedSubsystems(calls);
  Object.defineProperty(subsystems, boundary, {
    value: () => {
      calls.push(boundary);
      throw thrown;
    },
  });
  return subsystems;
}

for (const boundary of ORDERED_BOUNDARIES) {
  test(`${boundary} synchronous failure returns reviewed Study fallback`, async () => {
    const request = wave2Fixture();
    selectBoundaryRoute(request, boundary);
    const calls: Boundary[] = [];
    const result = await compose(
      request,
      throwingSubsystems(calls, boundary, new Error("secret-parent-pin-4938")),
    );

    assertReviewedFallback(result, request, boundary);
    assert.equal(JSON.stringify(result).includes("secret-parent-pin-4938"), false);
    const failureCall = calls.indexOf(boundary);
    assert.notEqual(failureCall, -1);
    for (const later of ORDERED_BOUNDARIES.slice(ORDERED_BOUNDARIES.indexOf(boundary) + 1)) {
      assert.equal(calls.includes(later), false, `${later} ran after ${boundary} failed`);
    }
  });
}

for (const boundary of ["proposeRepair", "proposeReteach"] as const) {
  test(`${boundary} rejected Promise returns reviewed Study fallback`, async () => {
    const request = wave2Fixture();
    selectBoundaryRoute(request, boundary);
    const calls: Boundary[] = [];
    const subsystems = trackedSubsystems(calls);
    Object.defineProperty(subsystems, boundary, {
      value: () => {
        calls.push(boundary);
        return Promise.reject({ privateNote: "another-child-private-note" });
      },
    });

    const result = await compose(request, subsystems);

    assertReviewedFallback(result, request, boundary);
    assert.equal(JSON.stringify(result).includes("another-child-private-note"), false);
  });
}

const UNKNOWN_THROWN_VALUES: readonly { readonly name: string; readonly value: unknown }[] = [
  { name: "string", value: "provider-hidden-prompt-material" },
  { name: "number", value: 4938 },
  { name: "null", value: null },
  { name: "undefined", value: undefined },
  { name: "plain object", value: { credential: "private-credential" } },
  { name: "custom class instance", value: new CustomThrownValue() },
  {
    name: "hostile toString object",
    value: { toString() { throw new Error("hostile-private-note"); } },
  },
];

for (const thrown of UNKNOWN_THROWN_VALUES) {
  test(`unknown ${thrown.name} throw is contained without coercion`, async () => {
    const request = wave2Fixture();
    const result = await compose(
      request,
      throwingSubsystems([], "buildConceptGraph", thrown.value),
    );

    assertReviewedFallback(result, request, "buildConceptGraph");
    const serialized = JSON.stringify(result);
    for (const secret of [
      "provider-hidden-prompt-material",
      "private-credential",
      "custom-class-private-note",
      "hostile-private-note",
    ]) assert.equal(serialized.includes(secret), false);
  });
}

test("late reteach failure discards all earlier adaptive computations", async () => {
  const request = wave2Fixture();
  selectBoundaryRoute(request, "proposeReteach");
  const calls: Boundary[] = [];
  const result = await compose(
    request,
    throwingSubsystems(calls, "proposeReteach", { rawLearnerAttempt: "private-attempt" }),
  );

  assertReviewedFallback(result, request, "proposeReteach");
  for (const earlier of [
    "recommendIntervention", "evaluateMastery",
  ] as const) assert.equal(calls.includes(earlier), true);
  for (const unrelated of ["selectHint", "proposeRepair"] as const) {
    assert.equal(calls.includes(unrelated), false);
  }
  assert.equal(JSON.stringify(result).includes("private-attempt"), false);
});

test("Study safety hold outranks fallback and invokes zero throwing subsystems", async () => {
  const request = wave2Fixture();
  request.studyAuthority.safetyStatus = "academic-flow-held";
  request.capabilityMetadata.safetyAdmission = "restricted";
  request.intervention.safetyRestriction = {
    status: "academic-flow-held",
    restrictionRef: "restriction:wave2-held",
  };
  const calls: Boundary[] = [];
  const subsystems = trackedSubsystems(calls);
  for (const boundary of ORDERED_BOUNDARIES) {
    Object.defineProperty(subsystems, boundary, {
      value: () => {
        calls.push(boundary);
        throw new Error("must-not-run");
      },
    });
  }

  const result = await compose(request, subsystems);

  assert.equal(result.status, "quarantined");
  assert.equal(result.reasonCode, "study-safety-held");
  assert.deepEqual(calls, []);
  assert.equal("reviewedContentRefs" in result, false);
});

for (const disabled of [
  { boundary: "selectHint", action: "hint" },
  { boundary: "proposeRepair", action: "check-prerequisite" },
  { boundary: "proposeReteach", action: "reteach" },
] as const) {
  test(`disabled ${disabled.boundary} is never called even when configured to throw`, async () => {
    const request = wave2Fixture();
    authorize(
      request,
      request.studyAuthority.allowedActions.filter((action) => action !== disabled.action),
    );
    const calls: Boundary[] = [];
    const result = await compose(
      request,
      throwingSubsystems(calls, disabled.boundary, new Error("disabled-private-note")),
    );

    assert.equal(result.status, "pending-study-decision");
    assert.equal(calls.includes(disabled.boundary), false);
    assert.equal(JSON.stringify(result).includes("disabled-private-note"), false);
  });
}

test("null Parent Why never invokes a throwing parent subsystem", async () => {
  const request = wave2Fixture();
  request.parentWhy = null;
  const calls: Boundary[] = [];
  const result = await compose(
    request,
    throwingSubsystems(calls, "explainParent", new Error("parent-private-note")),
  );

  assert.equal(result.status, "pending-study-decision");
  assert.equal(calls.includes("explainParent"), false);
  if (result.status === "pending-study-decision") assert.equal(result.parentExplanation, null);
});

test("malformed input retains canonical invalid-request fallback constants", async () => {
  const request = wave2Fixture();
  const attackerInput = {
    ...request,
    reviewedStaticFallback: {
      fallbackRef: "fallback:attacker-selected",
      reviewedContentRefs: ["content:attacker-selected"],
      extra: "invalid",
    },
  };
  const result = await compose(attackerInput, trackedSubsystems([]));

  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status !== "reviewed-static-fallback") throw new Error("Expected fallback");
  assert.equal(result.eventRef, "event:invalid-wave2-request");
  assert.equal(result.fallbackRef, "fallback:reviewed-static-wave2");
  assert.deepEqual(result.reviewedContentRefs, ["content:reviewed-static-wave2"]);
  assert.equal(JSON.stringify(result).includes("attacker-selected"), false);
});
