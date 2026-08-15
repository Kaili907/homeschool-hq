import assert from "node:assert/strict";
import test from "node:test";
import { TUTOR_ACTION_KINDS } from "../contracts/primitives.js";
import { validateExact } from "../contracts/validation.js";
import {
  ABSOLUTE_MAXIMUM_INTERVENTIONS,
  InterventionLadderResultSchema,
  recommendNextIntervention,
  type InterventionLadderInput,
  type InterventionLadderResult,
  type InterventionRecommendation,
  type LearnerStageInterventionProfile,
} from "./intervention-ladder.js";

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
          { actionKind: "return-to-lesson", outcome: "difficulty-persists" },
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
          { actionKind: "hint", outcome: "difficulty-persists" },
          { actionKind: "hint", outcome: "difficulty-persists" },
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
        assistanceHistory: [{ actionKind: "hint", outcome: "difficulty-persists" }],
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
        assistanceHistory: [{ actionKind: "hint", outcome: "difficulty-persists" }],
      }),
    ),
  );

  assert.equal(result.state, "suggest-break");
  assert.equal(result.actionKind, "suggest-break");
  assert.equal(result.breakSuggestionIsOptional, true);
  assert.equal(result.proposedBreakDurationMinutes, 5);
  assert.equal(result.terminal, false);
});

test("recent break protection prevents a repeated break suggestion", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        attemptCount: 4,
        elapsedInstructionalEffortMinutes: 40,
        interventionCount: 2,
        assistanceHistory: [
          { actionKind: "hint", outcome: "difficulty-persists" },
          { actionKind: "suggest-break", outcome: "difficulty-persists" },
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

test("final available intervention slot escalates only to Study adult review", () => {
  const result = recommendation(
    recommendNextIntervention(
      input({
        interventionCount: 3,
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
      { actionKind: "return-to-lesson", outcome: "difficulty-persists" },
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
      { actionKind: "hint", outcome: "difficulty-persists" },
      { actionKind: "hint", outcome: "difficulty-persists" },
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
      { actionKind: "return-to-lesson", outcome: "difficulty-persists" },
    ],
  });
  const snapshot = structuredClone(evidence);

  const first = recommendNextIntervention(evidence);
  const second = recommendNextIntervention(evidence);

  assert.deepEqual(first, second);
  assert.deepEqual(evidence, snapshot);
  assert.equal(validateExact(InterventionLadderResultSchema, first).status, "accepted");
});

test("bounded intervention count stops after the approved cap", () => {
  const atCap = recommendNextIntervention(
    input({
      interventionCount: 4,
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
        { actionKind: "hint", outcome: "difficulty-persists" },
        { actionKind: "escalate", outcome: "not-observed" },
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
      assistanceHistory: [{ actionKind: "hint", outcome: "difficulty-persists" }],
    }),
  );
  assert.equal(inconsistentHistory.status, "blocked");
  if (inconsistentHistory.status === "blocked") {
    assert.equal(inconsistentHistory.code, "INVALID_INTERVENTION_INPUT");
  }
});
