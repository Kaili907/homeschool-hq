import assert from "node:assert/strict";
import test from "node:test";
import { wave2Fixture } from "./wave2-fixtures.js";
import {
  assertNoAdaptiveCalls,
  composeWithCounters,
  counters,
  requirePending,
} from "./wave2-r2-test-support.js";

function hintHistory() {
  const input = wave2Fixture();
  return {
    learnerScopeRef: input.studyAuthority.learnerScopeRef,
    sessionRef: input.studyAuthority.sessionRef,
    interventionRef: "intervention:legitimate-prior-hint",
    contextRef: input.studyAuthority.instructionalContextRef,
    sourceInteractionRef: "interaction:legitimate-prior-hint",
    opportunityRef: "opportunity:legitimate-prior-hint",
    ordinal: 1,
    interventionKind: "hint-provided" as const,
    hintLevel: "nudge" as const,
    assistanceLevel: "light-hint" as const,
  };
}

function interventionHistory() {
  const input = wave2Fixture();
  return {
    learnerScopeRef: input.studyAuthority.learnerScopeRef,
    sessionRef: input.studyAuthority.sessionRef,
    instructionalContextRef: input.studyAuthority.instructionalContextRef,
    sourceInteractionRef: "interaction:legitimate-prior-intervention",
    opportunityRef: "opportunity:legitimate-prior-intervention",
    actionKind: "hint" as const,
    outcome: "difficulty-persists" as const,
  };
}

test("ADAPTIVE_HISTORY_SCOPE_PROVENANCE rejects cross-child/session/context histories and permits legitimate prior interactions", async () => {
  for (const field of ["learnerScopeRef", "sessionRef", "contextRef"] as const) {
    const input = wave2Fixture();
    input.hintSelection.interventionHistory = [{
      ...hintHistory(),
      [field]: `${field}:attacker-scope`,
    }];
    const calls = counters();
    const result = await composeWithCounters(input, calls);
    assert.equal(result.status, "reviewed-static-fallback", `hint ${field}`);
    assertNoAdaptiveCalls(calls);
  }

  for (const field of [
    "learnerScopeRef", "sessionRef", "instructionalContextRef",
  ] as const) {
    const input = wave2Fixture();
    input.intervention.interventionCount = 1;
    input.intervention.assistanceHistory = [{
      ...interventionHistory(),
      [field]: `${field}:attacker-scope`,
    }];
    const calls = counters();
    const result = await composeWithCounters(input, calls);
    assert.equal(result.status, "reviewed-static-fallback", `intervention ${field}`);
    assertNoAdaptiveCalls(calls);
  }

  const legitimate = wave2Fixture();
  legitimate.hintSelection.interventionHistory = [hintHistory()];
  legitimate.intervention.interventionCount = 1;
  legitimate.intervention.assistanceHistory = [interventionHistory()];
  const accepted = requirePending(await composeWithCounters(legitimate, counters()));
  assert.equal(accepted.intervention.actionKind, "check-prerequisite");
  assert.equal(accepted.hint.status, "no-hint");
  assert.equal(accepted.repair.status, "proposed");
  assert.equal(accepted.reteach.status, "withheld");
});

test("ADAPTIVE_HISTORY_SCOPE_PROVENANCE binds all request-level opportunity and scope duplicates to Study", async () => {
  const mutations = [
    (input: ReturnType<typeof wave2Fixture>) => {
      input.hintSelection.learnerScopeRef = "learner-scope:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.hintSelection.sessionRef = "session:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.hintSelection.contextRef = "instructional-context:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.hintSelection.currentOpportunityRef = "opportunity:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.intervention.learnerScopeRef = "learner-scope:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.intervention.sessionRef = "session:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.intervention.instructionalContextRef = "instructional-context:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.intervention.currentOpportunityRef = "opportunity:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.masteryEvidence.currentSessionRef = "session:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.masteryEvidence.currentInstructionalContextRef = "instructional-context:other";
    },
    (input: ReturnType<typeof wave2Fixture>) => {
      input.masteryEvidence.currentOpportunityRef = "opportunity:other";
    },
  ];
  for (const mutate of mutations) {
    const input = wave2Fixture();
    mutate(input);
    const calls = counters();
    assert.equal((await composeWithCounters(input, calls)).status, "reviewed-static-fallback");
    assertNoAdaptiveCalls(calls);
  }
});
