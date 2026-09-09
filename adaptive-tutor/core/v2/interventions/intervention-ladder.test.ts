import assert from "node:assert/strict";
import test from "node:test";
import { TUTOR_ACTION_KINDS } from "../contracts/primitives.js";
import { validateExact } from "../contracts/validation.js";
import {
  ABSOLUTE_MAXIMUM_INTERVENTIONS,
  InterventionLadderResultSchema,
  recommendNextIntervention,
  type AssistanceHistoryEntry,
  type InterventionLadderInput,
  type InterventionLadderResult,
  type InterventionRecommendation,
  type LearnerStageInterventionProfile,
} from "./intervention-ladder.js";

const LEARNER_SCOPE_REF = "learner-scope:learner-a";
const SESSION_REF = "session:session-a";
const INSTRUCTIONAL_CONTEXT_REF = "instructional-context:fractions-item";
const CURRENT_OPPORTUNITY_REF = "opportunity:fractions-current";

const PROFILE: LearnerStageInterventionProfile = {
  profileKind: "study-approved-intervention-profile",
  profileRef: "policy:intervention-stage-a",
  learnerStageRef: "stage:approved-a",
  approvalRef: "approval:study-stage-a",
  approvalKind: "study-approved",
  attemptsBeforeFirstHint: 1,
  maximumHintsBeforeReteach: 2,
  maximumReteachesBeforeEscalation: 1,
  breakSuggestionAfterEffortMinutes: 20,
  minimumAttemptsBeforeBreakSuggestion: 2,
  breakSuggestionCooldownInterventions: 3,
  proposedBreakDurationMinutes: 5,
  maximumInterventionsBeforeEscalation: 8,
};

function input(
  overrides: Partial<InterventionLadderInput> = {},
): InterventionLadderInput {
  return {
    inputKind: "study-intervention-evidence",
    learnerScopeRef: LEARNER_SCOPE_REF,
    sessionRef: SESSION_REF,
    instructionalContextRef: INSTRUCTIONAL_CONTEXT_REF,
    currentOpportunityRef: CURRENT_OPPORTUNITY_REF,
    interactionRef: "interaction:ladder-test",
    attemptCount: 1,
    assistanceHistory: [],
    misconceptionSignal: { status: "none", hypothesisRef: null },
    prerequisiteSignal: { status: "none", prerequisiteConceptRef: null },
    learnerStageProfile: { ...PROFILE },
    elapsedInstructionalEffortMinutes: 3,
    interventionCount: 0,
    safetyRestriction: { status: "none", restrictionRef: null },
    recentBreakSuggestion: { status: "none" },
    assessmentPhase: "instruction-or-practice",
    allowedActions: [...TUTOR_ACTION_KINDS],
    ...overrides,
  };
}

function historyEntry(
  actionKind: AssistanceHistoryEntry["actionKind"],
  outcome: AssistanceHistoryEntry["outcome"],
  ordinal = 1,
  overrides: Partial<AssistanceHistoryEntry> = {},
): AssistanceHistoryEntry {
  return {
    learnerScopeRef: LEARNER_SCOPE_REF,
    sessionRef: SESSION_REF,
    instructionalContextRef: INSTRUCTIONAL_CONTEXT_REF,
    sourceInteractionRef: `interaction:assistance-history-${ordinal}`,
    opportunityRef: `opportunity:assistance-history-${ordinal}`,
    actionKind,
    outcome,
    ...overrides,
  };
}

function recommendation(result: InterventionLadderResult): InterventionRecommendation {
  assert.equal(result.status, "recommended");
  return result.recommendation;
}

test("first difficulty continues through the existing return-to-lesson action", () => {
  const result = recommendation(recommendNextIntervention(input()));

  assert.equal(result.state, "continue");
  assert.equal(result.actionKind, "return-to-lesson");
  assert.equal(result.reasonCode, "first-difficulty-try-again");
  assert.equal(result.proposalOnly, true);
  assert.equal(result.tutorMayExecute, false);
  assert.equal(result.studyMutationAllowed, false);
});

test("repeated difficulty recommends a bounded hint", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 2,
        interventionCount: 1,
        assistanceHistory: [
          historyEntry("return-to-lesson", "difficulty-persists"),
        ],
      }),
    ),
  );

  assert.equal(result.state, "hint");
  assert.equal(result.actionKind, "hint");
});

test("hint exhaustion enters the reteach path", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 4,
        interventionCount: 2,
        assistanceHistory: [
          historyEntry("hint", "difficulty-persists", 1),
          historyEntry("hint", "difficulty-persists", 2),
        ],
      }),
    ),
  );

  assert.equal(result.state, "reteach");
  assert.equal(result.reasonCode, "hint-path-exhausted");
});

test("prerequisite suspicion precedes ordinary hinting", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 2,
        prerequisiteSignal: {
          status: "suspected",
          prerequisiteConceptRef: "concept:equal-parts",
        },
      }),
    ),
  );

  assert.equal(result.state, "check-prerequisite");
  assert.equal(result.actionKind, "check-prerequisite");
});

test("persistent misconception signal uses the bounded reteach path", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 3,
        interventionCount: 1,
        assistanceHistory: [historyEntry("hint", "difficulty-persists")],
        misconceptionSignal: {
          status: "persistent",
          hypothesisRef: "misconception:denominator-counts-pieces",
        },
      }),
    ),
  );

  assert.equal(result.state, "reteach");
  assert.equal(result.reasonCode, "persistent-misconception-signal");
});

test("elapsed instructional effort makes an optional break suggestion eligible", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 3,
        elapsedInstructionalEffortMinutes: 25,
        interventionCount: 1,
        assistanceHistory: [historyEntry("hint", "difficulty-persists")],
      }),
    ),
  );

  assert.equal(result.state, "suggest-break");
  assert.equal(result.actionKind, "suggest-break");
  assert.equal(result.breakSuggestionIsOptional, true);
  assert.equal(result.proposedBreakDurationMinutes, 5);
  assert.equal(result.terminal, false);
});

test("history-derived break cooldown prevents a repeated break suggestion", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 4,
        elapsedInstructionalEffortMinutes: 40,
        interventionCount: 2,
        assistanceHistory: [
          historyEntry("hint", "difficulty-persists", 1),
          historyEntry("suggest-break", "difficulty-persists", 2),
        ],
        recentBreakSuggestion: {
          status: "recent",
          interventionsSinceSuggestion: 0,
        },
      }),
    ),
  );

  assert.equal(result.state, "hint");
  assert.notEqual(result.actionKind, "suggest-break");
  assert.equal(result.breakSuggestionIsOptional, false);
});

test("break aggregate that omits a history-backed cooldown fails closed", () => {
  const result = recommendNextIntervention(
    input({
      attemptCount: 4,
      elapsedInstructionalEffortMinutes: 40,
      interventionCount: 2,
      assistanceHistory: [
        historyEntry("suggest-break", "difficulty-persists", 1),
        historyEntry("hint", "difficulty-persists", 2),
      ],
      recentBreakSuggestion: { status: "none" },
    }),
  );

  assert.deepEqual(result, {
    status: "blocked",
    code: "INVALID_INTERVENTION_INPUT",
    proposalOnly: true,
    tutorMayExecute: false,
    studyMutationAllowed: false,
  });
});

test("break aggregate without matching history fails closed", () => {
  const result = recommendNextIntervention(
    input({
      interventionCount: 1,
      assistanceHistory: [historyEntry("hint", "difficulty-persists", 1)],
      recentBreakSuggestion: {
        status: "recent",
        interventionsSinceSuggestion: 0,
      },
    }),
  );

  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.code, "INVALID_INTERVENTION_INPUT");
  }
});

test("break aggregate count must exactly match scoped history", () => {
  const result = recommendNextIntervention(
    input({
      interventionCount: 2,
      assistanceHistory: [
        historyEntry("suggest-break", "difficulty-persists", 1),
        historyEntry("hint", "difficulty-persists", 2),
      ],
      recentBreakSuggestion: {
        status: "recent",
        interventionsSinceSuggestion: 0,
      },
    }),
  );

  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.code, "INVALID_INTERVENTION_INPUT");
  }
});

test("history-backed break outside cooldown may become eligible again", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 6,
        elapsedInstructionalEffortMinutes: 40,
        interventionCount: 4,
        assistanceHistory: [
          historyEntry("suggest-break", "difficulty-persists", 1),
          historyEntry("hint", "difficulty-persists", 2),
          historyEntry("hint", "difficulty-persists", 3),
          historyEntry("reteach", "difficulty-persists", 4),
        ],
        recentBreakSuggestion: { status: "none" },
      }),
    ),
  );

  assert.equal(result.state, "suggest-break");
  assert.equal(result.breakSuggestionIsOptional, true);
});

test("final available intervention slot escalates only to Study adult review", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        interventionCount: 3,
        assistanceHistory: [
          historyEntry("return-to-lesson", "difficulty-persists", 1),
          historyEntry("hint", "difficulty-persists", 2),
          historyEntry("reteach", "difficulty-persists", 3),
        ],
        learnerStageProfile: {
          ...PROFILE,
          maximumInterventionsBeforeEscalation: 4,
        },
      }),
    ),
  );

  assert.equal(result.state, "escalate");
  assert.equal(result.actionKind, "escalate");
  assert.equal(result.escalationTarget, "study-adult-review-policy");
  assert.equal(result.claimsEscalationDelivery, false);
  assert.equal(result.terminal, true);
  assert.equal(result.nextInterventionCount, 4);
});

test("safety hold cannot be cleared or bypassed", () => {
  const held = input({
    safetyRestriction: {
      status: "academic-flow-held",
      restrictionRef: "safety:active-hold",
    },
  });
  const escalated = recommendation(recommendNextIntervention(held));

  assert.equal(escalated.state, "escalate");
  assert.equal(escalated.reasonCode, "safety-hold-study-review");
  assert.equal(escalated.authoritativeDecision, false);

  const unauthorized = recommendNextIntervention({
    ...held,
    allowedActions: ["return-to-lesson"],
  });
  assert.deepEqual(unauthorized, {
    status: "blocked",
    code: "STUDY_REVIEW_REQUIRED",
    proposalOnly: true,
    tutorMayExecute: false,
    studyMutationAllowed: false,
  });
});

test("Study allowedActions skips unauthorized recommendations and fails closed", () => {
  const repeated = input({
    attemptCount: 2,
    interventionCount: 1,
    assistanceHistory: [
      historyEntry("return-to-lesson", "difficulty-persists"),
    ],
  });
  const authorizedFallback = recommendation(
    recommendNextIntervention({ ...repeated, allowedActions: ["reteach"] }),
  );

  assert.equal(authorizedFallback.state, "reteach");
  assert.equal(authorizedFallback.actionKind, "reteach");

  const blocked = recommendNextIntervention({
    ...repeated,
    allowedActions: ["explain"],
  });
  assert.equal(blocked.status, "blocked");
  if (blocked.status === "blocked") {
    assert.equal(blocked.code, "NO_STUDY_AUTHORIZED_INTERVENTION");
  }
});

test("active assessment never recommends free-form hinting or reteaching", () => {
  const assessment = input({
    attemptCount: 4,
    interventionCount: 2,
    assistanceHistory: [
      historyEntry("hint", "difficulty-persists", 1),
      historyEntry("hint", "difficulty-persists", 2),
    ],
    assessmentPhase: "active-graded-or-mastery-check",
  });
  const safeRoute = recommendation(recommendNextIntervention(assessment));

  assert.equal(safeRoute.state, "return-to-lesson");
  assert.equal(safeRoute.actionKind, "return-to-lesson");

  const noSafeRoute = recommendNextIntervention({
    ...assessment,
    allowedActions: ["hint", "reteach"],
  });
  assert.equal(noSafeRoute.status, "blocked");
});

test("replay is deterministic and does not mutate structured input", () => {
  const evidence = input({
    attemptCount: 2,
    interventionCount: 1,
    assistanceHistory: [
      historyEntry("return-to-lesson", "difficulty-persists"),
    ],
  });
  const snapshot = structuredClone(evidence);

  const first = recommendNextIntervention(evidence);
  const second = recommendNextIntervention(evidence);

  assert.deepEqual(first, second);
  assert.deepEqual(evidence, snapshot);
  assert.equal(validateExact(InterventionLadderResultSchema, first).status, "accepted");
});

test("cross-learner intervention history fails closed instead of forcing reteach", () => {
  const result = recommendNextIntervention(
    input({
      attemptCount: 2,
      interventionCount: 1,
      prerequisiteSignal: {
        status: "suspected",
        prerequisiteConceptRef: "concept:equal-parts",
      },
      assistanceHistory: [
        historyEntry("check-prerequisite", "difficulty-persists", 1, {
          learnerScopeRef: "learner-scope:learner-b",
        }),
      ],
    }),
  );
  assert.deepEqual(result, {
    status: "blocked",
    code: "INVALID_INTERVENTION_INPUT",
    proposalOnly: true,
    tutorMayExecute: false,
    studyMutationAllowed: false,
  });
});

test("same learner intervention history from another session fails closed", () => {
  const result = recommendNextIntervention(
    input({
      interventionCount: 1,
      assistanceHistory: [
        historyEntry("hint", "difficulty-persists", 1, {
          sessionRef: "session:session-b",
        }),
      ],
    }),
  );
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.code, "INVALID_INTERVENTION_INPUT");
  }
});

test("same learner and session intervention history from another context fails closed", () => {
  const result = recommendNextIntervention(
    input({
      interventionCount: 1,
      assistanceHistory: [
        historyEntry("hint", "difficulty-persists", 1, {
          instructionalContextRef: "instructional-context:different-item",
        }),
      ],
    }),
  );
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.code, "INVALID_INTERVENTION_INPUT");
  }
});

test("foreign learner break history fails closed before cooldown can contribute", () => {
  const result = recommendNextIntervention(
    input({
      attemptCount: 4,
      elapsedInstructionalEffortMinutes: 40,
      interventionCount: 1,
      assistanceHistory: [
        historyEntry("suggest-break", "difficulty-persists", 1, {
          learnerScopeRef: "learner-scope:learner-b",
        }),
      ],
      recentBreakSuggestion: {
        status: "recent",
        interventionsSinceSuggestion: 0,
      },
    }),
  );

  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.code, "INVALID_INTERVENTION_INPUT");
  }
});

test("legitimate prior interaction and opportunity in the same intervention scope is accepted", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 2,
        interventionCount: 1,
        prerequisiteSignal: {
          status: "suspected",
          prerequisiteConceptRef: "concept:equal-parts",
        },
        assistanceHistory: [
          historyEntry("check-prerequisite", "difficulty-persists", 1, {
            sourceInteractionRef: "interaction:prior-prerequisite-check",
            opportunityRef: "opportunity:prior-prerequisite-check",
          }),
        ],
      }),
    ),
  );
  assert.equal(result.state, "reteach");
  assert.equal(result.reasonCode, "prerequisite-difficulty-persists");
});

test("duplicate and malformed intervention provenance fails closed", () => {
  const first = historyEntry("hint", "difficulty-persists");
  const malformedCandidates: unknown[] = [
    input({
      interventionCount: 2,
      assistanceHistory: [first, structuredClone(first)],
    }),
    input({
      interventionCount: 2,
      assistanceHistory: [
        first,
        historyEntry("reteach", "progress-observed", 2, {
          sourceInteractionRef: first.sourceInteractionRef,
        }),
      ],
    }),
    { ...input(), currentOpportunityRef: "not an opaque reference" },
    input({
      interventionCount: 1,
      assistanceHistory: [
        historyEntry("hint", "difficulty-persists", 1, {
          opportunityRef: "malformed opportunity",
        }),
      ],
    }),
    input({
      interventionCount: 1,
      assistanceHistory: [
        historyEntry("hint", "difficulty-persists", 1, {
          sourceInteractionRef: "malformed interaction",
        }),
      ],
    }),
  ];

  for (const malformed of malformedCandidates) {
    const result = recommendNextIntervention(malformed);
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.equal(result.code, "INVALID_INTERVENTION_INPUT");
    }
  }
});

test("bounded intervention count stops after the approved cap", () => {
  const atCap = recommendNextIntervention(
    input({
      interventionCount: 4,
      assistanceHistory: [
        historyEntry("return-to-lesson", "difficulty-persists", 1),
        historyEntry("hint", "difficulty-persists", 2),
        historyEntry("hint", "difficulty-persists", 3),
        historyEntry("reteach", "difficulty-persists", 4),
      ],
      learnerStageProfile: {
        ...PROFILE,
        maximumInterventionsBeforeEscalation: 4,
      },
    }),
  );

  assert.deepEqual(atCap, {
    status: "blocked",
    code: "INTERVENTION_LIMIT_REACHED",
    proposalOnly: true,
    tutorMayExecute: false,
    studyMutationAllowed: false,
  });

  const alreadyEscalated = recommendNextIntervention(
    input({
      interventionCount: 2,
      assistanceHistory: [
        historyEntry("hint", "difficulty-persists", 1),
        historyEntry("escalate", "not-observed", 2),
      ],
    }),
  );
  assert.equal(alreadyEscalated.status, "blocked");
  if (alreadyEscalated.status === "blocked") {
    assert.equal(alreadyEscalated.code, "ADULT_REVIEW_PENDING");
  }

  assert.equal(ABSOLUTE_MAXIMUM_INTERVENTIONS, 12);
});

test("malformed or inconsistent evidence is rejected exactly", () => {
  const extraField = recommendNextIntervention({ ...input(), learnerMood: "upset" });
  assert.equal(extraField.status, "blocked");
  if (extraField.status === "blocked") {
    assert.equal(extraField.code, "INVALID_INTERVENTION_INPUT");
  }

  const inconsistentHistory = recommendNextIntervention(
    input({
      interventionCount: 0,
      assistanceHistory: [historyEntry("hint", "difficulty-persists")],
    }),
  );
  assert.equal(inconsistentHistory.status, "blocked");
  if (inconsistentHistory.status === "blocked") {
    assert.equal(inconsistentHistory.code, "INVALID_INTERVENTION_INPUT");
  }

  const unbackedHighCount = recommendNextIntervention(
    input({
      interventionCount: 7,
      learnerStageProfile: {
        ...PROFILE,
        maximumInterventionsBeforeEscalation: 8,
      },
    }),
  );
  assert.equal(unbackedHighCount.status, "blocked");
  if (unbackedHighCount.status === "blocked") {
    assert.equal(unbackedHighCount.code, "INVALID_INTERVENTION_INPUT");
  }
});

test("latest progress-observed history returns control to the lesson", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 4,
        interventionCount: 2,
        assistanceHistory: [
          historyEntry("return-to-lesson", "difficulty-persists", 1),
          historyEntry("hint", "progress-observed", 2),
        ],
      }),
    ),
  );

  assert.equal(result.state, "return-to-lesson");
  assert.equal(result.reasonCode, "progress-return-to-study");
});
