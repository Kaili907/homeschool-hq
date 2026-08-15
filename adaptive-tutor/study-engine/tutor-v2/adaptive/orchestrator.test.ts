import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAdaptiveAdmission } from "../../../core/v2/admission/index.js";
import { buildConceptGraph } from "../../../core/v2/concepts/index.js";
import { createAcademicMisconceptionRegistry } from "../../../core/v2/misconceptions/index.js";
import { selectBoundedHint } from "../../../core/v2/hints/index.js";
import { recommendNextIntervention } from "../../../core/v2/interventions/index.js";
import { evaluateMasteryEvidence } from "../../../core/v2/mastery/index.js";
import { wave2Fixture } from "../../../tests/tutor-v2-convergence/wave2-fixtures.js";
import { explainTutorRecommendationForParentHub } from "../parent-explanations/index.js";
import { proposePrerequisiteRepair } from "../prerequisite-repair/index.js";
import { proposeReteachPlan } from "../reteach/index.js";
import type { Wave2AdaptiveCompositionRequest } from "./contracts.js";
import {
  composeWave2AdaptiveIntelligence,
  type Wave2AdaptiveSubsystems,
} from "./orchestrator.js";
import { InMemoryWave2ReplayLedger } from "./replay.js";

const SUBSYSTEM_NAMES = [
  "admission",
  "conceptGraph",
  "conceptQuery",
  "misconceptionRegistry",
  "misconceptionMatch",
  "hint",
  "intervention",
  "mastery",
  "repair",
  "reteach",
  "parent",
] as const;
type SubsystemName = (typeof SUBSYSTEM_NAMES)[number];
type SubsystemCounters = Record<SubsystemName, number>;
type ActionKind = Wave2AdaptiveCompositionRequest["studyAuthority"]["allowedActions"][number];

function counters(): SubsystemCounters {
  return Object.fromEntries(SUBSYSTEM_NAMES.map((name) => [name, 0])) as SubsystemCounters;
}

function countingSubsystems(calls: SubsystemCounters): Wave2AdaptiveSubsystems {
  return {
    evaluateAdmission(input) {
      calls.admission += 1;
      return evaluateAdaptiveAdmission(input);
    },
    buildConceptGraph(input) {
      calls.conceptGraph += 1;
      return buildConceptGraph(input);
    },
    queryConceptGraph(graph, conceptRef) {
      calls.conceptQuery += 1;
      return graph.graph.directPrerequisites(conceptRef);
    },
    createMisconceptionRegistry(input) {
      calls.misconceptionRegistry += 1;
      return createAcademicMisconceptionRegistry(input);
    },
    matchMisconception(registry, request) {
      calls.misconceptionMatch += 1;
      return registry.registry.match(request);
    },
    selectHint(input) {
      calls.hint += 1;
      return selectBoundedHint(input);
    },
    recommendIntervention(input) {
      calls.intervention += 1;
      return recommendNextIntervention(input);
    },
    evaluateMastery(input) {
      calls.mastery += 1;
      return evaluateMasteryEvidence(input);
    },
    proposeRepair(input, dependencies) {
      calls.repair += 1;
      return proposePrerequisiteRepair(input, dependencies);
    },
    proposeReteach(input, dependencies) {
      calls.reteach += 1;
      return proposeReteachPlan(input, dependencies);
    },
    explainParent(input) {
      calls.parent += 1;
      return explainTutorRecommendationForParentHub(input);
    },
  };
}

class CountingReplayLedger extends InMemoryWave2ReplayLedger {
  calls = 0;

  override claim(eventRef: string, requestFingerprint: string) {
    this.calls += 1;
    return super.claim(eventRef, requestFingerprint);
  }
}

function heldFixture(): Wave2AdaptiveCompositionRequest {
  const input = wave2Fixture();
  input.studyAuthority.safetyStatus = "academic-flow-held";
  input.capabilityMetadata.safetyAdmission = "restricted";
  input.intervention.safetyRestriction = {
    status: "academic-flow-held",
    restrictionRef: "restriction:study-wave2-safety-hold",
  };
  return input;
}

function authorize(
  input: Wave2AdaptiveCompositionRequest,
  allowedActions: readonly ActionKind[],
): void {
  input.studyAuthority.allowedActions = [...allowedActions];
  input.intervention.allowedActions = [...allowedActions];
}

async function composeWithCounters(
  input: unknown,
  calls: SubsystemCounters,
  replayLedger = new CountingReplayLedger(),
) {
  return composeWave2AdaptiveIntelligence(input, {
    replayLedger,
    adaptiveSubsystems: countingSubsystems(calls),
  });
}

function assertNoAdaptiveCalls(calls: SubsystemCounters): void {
  assert.deepEqual(calls, counters());
}

test("Study safety conflict fails closed before replay or adaptive dependencies", async () => {
  const input = heldFixture();
  input.capabilityMetadata.safetyAdmission = "admitted";
  const calls = counters();
  const ledger = new CountingReplayLedger();

  const result = await composeWithCounters(input, calls, ledger);

  assert.equal(result.status, "quarantined");
  assert.equal(result.reasonCode, "safety-representation-conflict");
  assert.equal(ledger.calls, 0);
  assertNoAdaptiveCalls(calls);

  const interventionConflict = heldFixture();
  interventionConflict.intervention.safetyRestriction = {
    status: "none",
    restrictionRef: null,
  };
  const interventionCalls = counters();
  const interventionLedger = new CountingReplayLedger();
  const interventionResult = await composeWithCounters(
    interventionConflict,
    interventionCalls,
    interventionLedger,
  );
  assert.equal(interventionResult.status, "quarantined");
  assert.equal(interventionResult.reasonCode, "safety-representation-conflict");
  assert.equal(interventionLedger.calls, 0);
  assertNoAdaptiveCalls(interventionCalls);

  const bindingConflict = heldFixture();
  bindingConflict.masteryEvidence.learnerScopeRef = "learner-scope:other-child";
  const bindingCalls = counters();
  const bindingLedger = new CountingReplayLedger();
  const bindingResult = await composeWithCounters(bindingConflict, bindingCalls, bindingLedger);
  assert.equal(bindingResult.status, "quarantined");
  assert.equal(bindingResult.reasonCode, "study-safety-held-binding-conflict");
  assert.equal(bindingLedger.calls, 0);
  assertNoAdaptiveCalls(bindingCalls);
});

test("Study safety hold preserves replay protection and invokes zero adaptive subsystems", async () => {
  const input = heldFixture();
  const calls = counters();
  const ledger = new CountingReplayLedger();

  const held = await composeWithCounters(input, calls, ledger);

  assert.equal(held.status, "quarantined");
  assert.equal(held.reasonCode, "study-safety-held");
  assert.equal(held.studyDecisionRequired, true);
  assert.equal(held.studyMutationAllowed, false);
  assert.equal(held.studyEngineRemainsAuthority, true);
  for (const proposal of [
    "admissions", "concept", "misconception", "hint", "intervention", "mastery",
    "repair", "reteach", "parentExplanation", "reviewedContentRefs",
  ]) assert.equal(proposal in held, false, proposal);
  assert.equal(ledger.calls, 1);
  assertNoAdaptiveCalls(calls);

  const duplicate = await composeWithCounters(heldFixture(), calls, ledger);
  assert.equal(duplicate.status, "duplicate-ignored");
  assert.equal(ledger.calls, 2);
  assertNoAdaptiveCalls(calls);

  const collisionInput = heldFixture();
  collisionInput.hintSelection.attemptCount += 1;
  const collision = await composeWithCounters(collisionInput, calls, ledger);
  assert.equal(collision.status, "quarantined");
  assert.equal(collision.reasonCode, "event-identity-collision");
  assert.equal(ledger.calls, 3);
  assertNoAdaptiveCalls(calls);

  const unavailableCalls = counters();
  const replayUnavailable = await composeWave2AdaptiveIntelligence(heldFixture(), {
    replayLedger: {
      claim() {
        throw new Error("replay unavailable");
      },
    },
    adaptiveSubsystems: countingSubsystems(unavailableCalls),
  });
  assert.equal(replayUnavailable.status, "quarantined");
  assert.equal(replayUnavailable.reasonCode, "study-safety-held-replay-unavailable");
  assert.equal("reviewedContentRefs" in replayUnavailable, false);
  assertNoAdaptiveCalls(unavailableCalls);
});

test("Study actions return-to-lesson and escalate withhold hint, repair, and reteach", async () => {
  const input = wave2Fixture();
  authorize(input, ["return-to-lesson", "escalate"]);
  const calls = counters();

  const result = await composeWithCounters(input, calls);

  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected Study decision");
  assert.equal(calls.hint, 0);
  assert.equal(calls.repair, 0);
  assert.equal(calls.reteach, 0);
  assert.equal(calls.intervention, 1);
  assert.deepEqual(result.hint, {
    status: "no-hint",
    hintLevel: "none",
    reviewedContentRef: null,
    unrestrictedProviderProseAllowed: false,
  });
  assert.equal(result.repair.status, "withheld");
  assert.equal(result.repair.reasonCode, "study-action-not-authorized");
  assert.equal(result.repair.source, "none");
  assert.deepEqual(result.repair.recommendedConceptRefs, []);
  assert.deepEqual(result.repair.reviewedContentRefs, []);
  assert.equal(result.reteach.status, "withheld");
  assert.equal(result.reteach.reasonCode, "study-action-not-authorized");
  assert.equal(result.reteach.source, "none");
  assert.deepEqual(result.reteach.reviewedContentRefs, []);
  assert.equal(result.intervention.actionKind, "escalate");
  assert.ok(
    result.intervention.actionKind === null ||
      input.studyAuthority.allowedActions.includes(result.intervention.actionKind),
  );
});

test("Study independently withholds an unauthorized hint", async () => {
  const input = wave2Fixture();
  authorize(input, input.studyAuthority.allowedActions.filter((action) => action !== "hint"));
  const calls = counters();

  const result = await composeWithCounters(input, calls);

  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected Study decision");
  assert.equal(calls.hint, 0);
  assert.equal(result.hint.status, "no-hint");
  assert.equal(result.hint.reviewedContentRef, null);
});

test("Study independently withholds unauthorized prerequisite repair", async () => {
  const input = wave2Fixture();
  authorize(
    input,
    input.studyAuthority.allowedActions.filter((action) => action !== "check-prerequisite"),
  );
  const calls = counters();

  const result = await composeWithCounters(input, calls);

  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected Study decision");
  assert.equal(calls.repair, 0);
  assert.equal(result.repair.status, "withheld");
  assert.equal(result.repair.source, "none");
});

test("Study independently withholds unauthorized reteach", async () => {
  const input = wave2Fixture();
  authorize(input, input.studyAuthority.allowedActions.filter((action) => action !== "reteach"));
  const calls = counters();

  const result = await composeWithCounters(input, calls);

  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected Study decision");
  assert.equal(calls.reteach, 0);
  assert.equal(result.reteach.status, "withheld");
  assert.equal(result.reteach.source, "none");
});

test("invalid request cannot select event or fallback refs", async () => {
  const fixture = wave2Fixture();
  const attackerInput = {
    ...fixture,
    studyAuthority: {
      ...fixture.studyAuthority,
      eventRef: "event:attacker-selected",
    },
    reviewedStaticFallback: {
      fallbackRef: "fallback:provider-selected",
      reviewedContentRefs: ["content:provider-selected-unreviewed"],
      unauthorizedRouting: { opaqueRef: "route:attacker-selected" },
    },
  };
  const calls = counters();

  const result = await composeWithCounters(attackerInput, calls);

  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status !== "reviewed-static-fallback") throw new Error("Expected fallback");
  assert.equal(result.eventRef, "event:invalid-wave2-request");
  assert.equal(result.fallbackRef, "fallback:reviewed-static-wave2");
  assert.equal(JSON.stringify(result).includes("attacker-selected"), false);
  assert.equal(JSON.stringify(result).includes("provider-selected"), false);
  assertNoAdaptiveCalls(calls);
});

test("invalid request cannot select reviewed content refs", async () => {
  const fixture = wave2Fixture();
  const attackerInput = {
    ...fixture,
    reviewedStaticFallback: {
      ...fixture.reviewedStaticFallback,
      reviewedContentRefs: ["content:provider-selected-unreviewed"],
      extraNestedFields: { reviewed: false },
    },
  };

  const result = await composeWave2AdaptiveIntelligence(attackerInput, {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });

  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status !== "reviewed-static-fallback") throw new Error("Expected fallback");
  assert.deepEqual(result.reviewedContentRefs, ["content:reviewed-static-wave2"]);
  assert.equal(JSON.stringify(result).includes("provider-selected-unreviewed"), false);
});

test("invalid fallback never invokes accessors or trusts proxies", async () => {
  const fixture = wave2Fixture();
  let getterCalls = 0;
  const authority = { ...fixture.studyAuthority } as Record<string, unknown>;
  Object.defineProperty(authority, "eventRef", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "event:getter-selected";
    },
  });
  const getterResult = await composeWave2AdaptiveIntelligence({
    ...fixture,
    studyAuthority: authority,
  }, { replayLedger: new InMemoryWave2ReplayLedger() });
  assert.equal(getterResult.eventRef, "event:invalid-wave2-request");
  assert.equal(getterCalls, 0);

  let proxyTrapCalls = 0;
  const proxy = new Proxy(wave2Fixture(), {
    getPrototypeOf() {
      proxyTrapCalls += 1;
      throw new Error("hostile proxy");
    },
  });
  const proxyResult = await composeWave2AdaptiveIntelligence(proxy, {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });
  assert.equal(proxyResult.eventRef, "event:invalid-wave2-request");
  assert.equal(proxyTrapCalls, 1);
});
