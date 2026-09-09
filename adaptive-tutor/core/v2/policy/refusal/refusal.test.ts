import assert from "node:assert/strict";
import test from "node:test";
import {
  TutorStaticFallbackOutcomeSchema,
  validateExact,
  type TutorAction,
} from "../../contracts/index.js";
import {
  createStaticFallbackDecision,
  evaluateTutorProposalPolicy,
} from "./index.js";
import { makeProposal, makeStudyContext } from "./test-support.js";

const legitimateActions: readonly TutorAction[] = [
  {
    kind: "explain",
    content: "A grounded explanation of equal parts.",
    groundingRefs: ["grounding:fractions"],
  },
  {
    kind: "hint",
    content: "Count the equal sections first.",
    hintLevel: "nudge",
    groundingRefs: ["grounding:fractions"],
  },
  {
    kind: "ask-check",
    question: "What could you identify before counting?",
    checkKind: "next-step",
    groundingRefs: ["grounding:fractions"],
  },
  {
    kind: "show-example",
    content: "Consider a different whole divided into equal parts.",
    exampleRef: "example:fraction-model",
    groundingRefs: ["example:fraction-model"],
    nonIsomorphicToActiveItem: true,
  },
  {
    kind: "reteach",
    content: "A fraction describes equal parts of a whole.",
    conceptRef: "concept:fractions",
    groundingRefs: ["concept:fractions"],
  },
  {
    kind: "check-prerequisite",
    prerequisiteConceptRef: "concept:equal-parts",
    reasonCode: "possible-prerequisite-gap",
    groundingRefs: ["concept:equal-parts"],
  },
  { kind: "suggest-break", reasonCode: "study-policy-signal", proposedDurationMinutes: 5 },
  {
    kind: "escalate",
    reasonCode: "adult-review-proposed",
    escalationTarget: "study-adult-review-policy",
    claimsDelivery: false,
  },
  {
    kind: "return-to-lesson",
    reasonCode: "instructional-check-complete",
    resumeTarget: "study-selected-position",
  },
];

for (const action of legitimateActions) {
  test(`accepts legitimate Tutor action class: ${action.kind}`, () => {
    const decision = evaluateTutorProposalPolicy(
      makeProposal(action),
      makeStudyContext(),
      { completedAssessmentReviewAllowed: false },
    );
    assert.equal(decision.status, "accepted");
    if (decision.status === "accepted") {
      assert.equal(decision.code, "ACTION_PROPOSED");
      assert.equal(decision.proposal.authoritative, false);
      assert.equal(decision.proposal.requiresStudyValidation, true);
    }
  });
}

test("rejects an unknown action deterministically", () => {
  const raw = { ...makeProposal(), action: { kind: "sing-a-song", content: "No." } };
  const decision = evaluateTutorProposalPolicy(raw, makeStudyContext());
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") assert.equal(decision.code, "UNSUPPORTED_ACTION");
});

test("an unsupported field fails closed", () => {
  const raw = { ...makeProposal(), providerCommand: "apply-directly" };
  const decision = evaluateTutorProposalPolicy(raw, makeStudyContext());
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.equal(decision.code, "POLICY_REJECTION");
    assert.equal(decision.studyMutationAllowed, false);
  }
});

test("a Study safety stop quarantines without creating another safety path", () => {
  const decision = evaluateTutorProposalPolicy(
    makeProposal(),
    makeStudyContext({ mayContinueAcademicFlow: false }),
  );
  assert.deepEqual(decision, {
    status: "quarantined",
    code: "SAFETY_STOP",
    safetyRef: "safety:policy-test",
    studyMutationAllowed: false,
  });
});

test("a rejected Tutor output produces a static, contract-valid fallback decision", () => {
  const studyContext = makeStudyContext();
  const before = structuredClone(studyContext);
  const rejected = evaluateTutorProposalPolicy(
    { ...makeProposal(), providerCommand: "apply-directly" },
    studyContext,
  );
  assert.equal(rejected.status, "rejected");
  if (rejected.status !== "rejected") return;

  const fallback = createStaticFallbackDecision(rejected, studyContext, {
    fallbackRef: "fallback:static-instruction",
  });
  assert.equal(fallback.code, "STATIC_FALLBACK_REQUIRED");
  assert.equal(fallback.triggerCode, "POLICY_REJECTION");
  assert.equal(fallback.studyMutationAllowed, false);
  assert.equal(validateExact(TutorStaticFallbackOutcomeSchema, fallback.outcome).status, "accepted");
  assert.deepEqual(studyContext, before);
});

test("explicit answer fields are classified as answer-policy rejection", () => {
  const base = makeProposal();
  const raw = { ...base, action: { ...base.action, finalAnswer: "four" } };
  const decision = evaluateTutorProposalPolicy(raw, makeStudyContext());
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") assert.equal(decision.code, "ANSWER_POLICY_REJECTED");
});
