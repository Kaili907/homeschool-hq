import assert from "node:assert/strict";
import test from "node:test";
import { makeProposal, makeStudyContext } from "../refusal/test-support.js";
import { detectAnswerBearingFields, evaluateAnswerPolicy } from "./index.js";

test("rejects an explicit answer-bearing structured field", () => {
  const raw = {
    ...makeProposal(),
    action: { ...makeProposal().action, correctAnswer: "four" },
  };
  assert.deepEqual(detectAnswerBearingFields(raw), [
    { path: "$/action/correctAnswer", code: "answer-bearing-field" },
  ]);
});

test("rejects an active-assessment direct-answer attempt", () => {
  const context = makeStudyContext({ phase: "active-graded-or-mastery-check" });
  const proposal = makeProposal({
    kind: "explain",
    content: "The correct answer is four.",
    groundingRefs: ["grounding:fractions"],
  });
  const decision = evaluateAnswerPolicy(proposal, context.instructionContext, {
    completedAssessmentReviewAllowed: false,
  });
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.equal(decision.code, "ANSWER_POLICY_REJECTED");
    assert.ok(
      decision.issues.some((issue) => issue.code === "active-assessment-answer-disclosure"),
    );
  }
});

test("post-assessment review fails closed without explicit permission", () => {
  const context = makeStudyContext({ phase: "completed-assessment-review" });
  const decision = evaluateAnswerPolicy(makeProposal(), context.instructionContext, undefined);
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.ok(decision.issues.some((issue) => issue.code === "completed-review-not-authorized"));
  }
});

test("post-assessment review allows direct review only with explicit permission", () => {
  const context = makeStudyContext({ phase: "completed-assessment-review" });
  const proposal = makeProposal({
    kind: "explain",
    content: "The correct answer is four because the whole has four equal parts.",
    groundingRefs: ["grounding:fractions"],
  });
  assert.deepEqual(
    evaluateAnswerPolicy(proposal, context.instructionContext, {
      completedAssessmentReviewAllowed: true,
    }),
    { status: "allowed" },
  );
});

test("active assessment allows a bounded thinking prompt", () => {
  const context = makeStudyContext({ phase: "active-graded-or-mastery-check" });
  const proposal = makeProposal({
    kind: "hint",
    content: "First identify how many equal parts make the whole.",
    hintLevel: "concept-cue",
    groundingRefs: ["grounding:fractions"],
  });
  assert.equal(
    evaluateAnswerPolicy(proposal, context.instructionContext, {
      completedAssessmentReviewAllowed: false,
    }).status,
    "allowed",
  );
});
