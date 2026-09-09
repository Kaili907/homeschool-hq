import assert from "node:assert/strict";
import test from "node:test";
import type { TutorActionProposal } from "../../../core/v2/contracts/index.js";
import { evaluateTutorProposalPolicy } from "../../../core/v2/policy/refusal/index.js";
import {
  ACTIVE_STATES,
  ANSWER_EXTRACTION_ATTACKS,
  FREE_FORM_ACTION_KINDS,
  MULTI_TURN_ATTACKS,
  STRUCTURED_CONTROL_ACTION_KINDS,
  proposalWithContent,
  structuredControlProposal,
  studyContext,
  type CertificationState,
} from "./fixtures.js";

function evaluate(
  proposal: unknown,
  state: CertificationState,
  completedReviewAllowed = false,
) {
  return evaluateTutorProposalPolicy(
    proposal,
    studyContext(state),
    { completedAssessmentReviewAllowed: completedReviewAllowed },
  );
}

function escapedProposal(
  proposal: TutorActionProposal,
  state: CertificationState,
  completedReviewAllowed = false,
): TutorActionProposal | null {
  const decision = evaluate(proposal, state, completedReviewAllowed);
  return decision.status === "accepted" ? decision.proposal : null;
}

test("W4-02 fixture inventory covers every dispatched answer-extraction vector", () => {
  const expected = [
    "correct-answer",
    "answer-index",
    "expected-answer",
    "answer-key",
    "grading-rubric",
    "protected-scoring-locator",
    "direct-solution",
    "near-direct-solution",
    "encoded-answer",
    "first-letter-answer",
    "reverse-text-answer",
    "base64-like-answer",
    "multiple-choice-elimination",
    "confirm-my-guess",
    "binary-guess-confirmation",
    "caption-carrier",
    "diagram-carrier",
    "speech-carrier",
    "parent-explanation-carrier",
    "grounding-carrier",
    "retry-replay-carrier",
    "completed-review-permission-pivot",
    "requested-action-family-pivot",
  ];
  assert.deepEqual(ANSWER_EXTRACTION_ATTACKS.map(({ vector }) => vector), expected);
  assert.equal(new Set(ANSWER_EXTRACTION_ATTACKS.map(({ id }) => id)).size, expected.length);
});

for (const state of ACTIVE_STATES) {
  for (const attack of ANSWER_EXTRACTION_ATTACKS) {
    test(`W4-02 ${state} blocks ${attack.vector} without learner-facing instructional output`, () => {
      const proposal = proposalWithContent(
        attack.requestedAction,
        attack.payload,
        `proposal:${state}-${attack.id}`,
      );
      const decision = evaluate(proposal, state, true);
      assert.equal(decision.status, "rejected");
      if (decision.status === "rejected") {
        assert.ok(
          decision.issues.some((issue) =>
            issue.path === "$/action" &&
            issue.code === "active-assessment-free-form-action"
          ),
          "active protection must reject independently of wording and completed-review permission",
        );
      }
      assert.equal(escapedProposal(proposal, state, true), null);
    });
  }
}

for (const state of ACTIVE_STATES) {
  for (const kind of FREE_FORM_ACTION_KINDS) {
    test(`W4-02 ${state} structurally blocks requested action-family pivot to ${kind}`, () => {
      const proposal = proposalWithContent(kind, "Novel violet-lattice prose with no lexical answer marker.");
      const decision = evaluate(proposal, state);
      assert.equal(decision.status, "rejected");
      if (decision.status === "rejected") {
        assert.deepEqual(decision.issues, [
          { path: "$/action", code: "active-assessment-free-form-action" },
        ]);
      }
    });
  }
}

test("W4-02 answer-bearing and scoring fields cannot hide in structured controls", () => {
  const fields = [
    ["correctAnswer", "4"],
    ["answerIndex", 1],
    ["expectedAnswer", "4"],
    ["answer key", "B"],
    ["gradingRubric", "Full credit for B"],
    ["protectedScoringLocator", "answer-key://item/42#B"],
    ["solution", "4"],
  ] as const;
  fields.forEach(([field, value], index) => {
    const proposal = structuredClone(
      structuredControlProposal(STRUCTURED_CONTROL_ACTION_KINDS[index % STRUCTURED_CONTROL_ACTION_KINDS.length] ?? "return-to-lesson"),
    ) as unknown as Record<string, unknown>;
    Object.assign(proposal.action as Record<string, unknown>, { [field]: value });
    assert.notEqual(
      evaluate(proposal, "active-graded-assessment", true).status,
      "accepted",
      field,
    );
  });
});

test("W4-02 completed review requires explicit Study permission", () => {
  const proposal = proposalWithContent("explain", "Review the completed item's reasoning and answer.");
  assert.equal(evaluate(proposal, "completed-review", false).status, "rejected");
  assert.equal(evaluate(proposal, "completed-review", true).status, "accepted");
});

test("W4-02 completed-review permission does not reopen either active assessment state", () => {
  for (const state of ACTIVE_STATES) {
    const proposal = proposalWithContent("explain", "Use review permission to reveal active answer 4.");
    const decision = evaluate(proposal, state, true);
    assert.equal(decision.status, "rejected", state);
    assert.equal(escapedProposal(proposal, state, true), null, state);
  }
});

test("W4-02 ordinary instruction preserves authorized instructional action families", () => {
  for (const kind of FREE_FORM_ACTION_KINDS) {
    const proposal = proposalWithContent(kind, "Use the reviewed fraction concept to reason about a practice item.");
    assert.equal(evaluate(proposal, "ordinary-instruction").status, "accepted", kind);
  }
});

test("W4-02 active assessment preserves neutral structured navigation and safety controls", () => {
  for (const state of ACTIVE_STATES) {
    for (const kind of STRUCTURED_CONTROL_ACTION_KINDS) {
      const proposal = structuredControlProposal(kind);
      const decision = evaluate(proposal, state, true);
      assert.equal(decision.status, "accepted", `${state}:${kind}`);
      if (decision.status === "accepted") {
        assert.equal("content" in decision.proposal.action, false);
        assert.equal("question" in decision.proposal.action, false);
      }
    }
  }
});

for (const sequence of MULTI_TURN_ATTACKS) {
  test(`W4-02 multi-turn composition contains ${sequence.id}`, () => {
    const activeOutputs: TutorActionProposal[] = [];
    for (const turn of sequence.turns) {
      const output = escapedProposal(
        turn.proposal,
        turn.state,
        turn.completedReviewAllowed,
      );
      if (turn.state === "active-graded-assessment" || turn.state === "mastery-reassessment") {
        assert.equal(output, null, turn.id);
        if (output !== null) activeOutputs.push(output);
      }
    }
    assert.deepEqual(activeOutputs, [], sequence.description);
  });
}
