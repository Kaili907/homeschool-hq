import assert from "node:assert/strict";
import test from "node:test";
import type {
  AssessmentPhase,
  TutorAction,
  TutorActionProposal,
} from "../../contracts/index.js";
import { makeProposal, makeStudyContext } from "../refusal/test-support.js";
import { detectAnswerBearingFields, evaluateAnswerPolicy } from "./index.js";

const FREE_FORM_ACTION_KINDS = [
  "explain",
  "hint",
  "ask-check",
  "show-example",
  "reteach",
] as const;

type FreeFormActionKind = (typeof FREE_FORM_ACTION_KINDS)[number];

function freeFormAction(kind: FreeFormActionKind, prose: string): TutorAction {
  const groundingRefs = ["grounding:fractions"];
  switch (kind) {
    case "explain":
      return { kind, content: prose, groundingRefs };
    case "hint":
      return { kind, content: prose, hintLevel: "nudge", groundingRefs };
    case "ask-check":
      return { kind, question: prose, checkKind: "next-step", groundingRefs };
    case "show-example":
      return {
        kind,
        content: prose,
        exampleRef: "example:fraction-model",
        groundingRefs,
        nonIsomorphicToActiveItem: true,
      };
    case "reteach":
      return {
        kind,
        content: prose,
        conceptRef: "concept:fractions",
        groundingRefs,
      };
  }
}

function evaluate(
  proposal: TutorActionProposal,
  phase: AssessmentPhase,
  completedAssessmentReviewAllowed = false,
) {
  const context = makeStudyContext({ phase });
  return evaluateAnswerPolicy(proposal, context.instructionContext, {
    completedAssessmentReviewAllowed,
  });
}

function assertStructuralRejection(kind: FreeFormActionKind, prose: string): void {
  const decision = evaluate(
    makeProposal(freeFormAction(kind, prose)),
    "active-graded-or-mastery-check",
  );
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.equal(decision.code, "ANSWER_POLICY_REJECTED");
    assert.ok(
      decision.issues.some((issue) => issue.code === "active-assessment-free-form-action"),
    );
  }
}

for (const field of [
  "answer",
  "answerKey",
  "correctAnswer",
  "correctChoice",
  "solution",
  "finalAnswer",
] as const) {
  test(`rejects explicit answer-bearing field ${field}`, () => {
    const raw = {
      ...makeProposal(),
      action: { ...makeProposal().action, [field]: "four" },
    };
    assert.deepEqual(detectAnswerBearingFields(raw), [
      { path: `$/action/${field}`, code: "answer-bearing-field" },
    ]);
  });
}

const PHRASE_MATRIX = [
  "The correct answer is 4.",
  "Use 4 as the response.",
  "Put 4 in the box.",
  "Your response should be 4.",
  "Type 4.",
  "Write 4.",
  "Enter 4.",
  "Fill in 4.",
  "Choose B.",
  "Mark B.",
  "Select the second option.",
  "The value you need is four.",
  "Go with four.",
  "I would put four.",
  "Answer using the number four.",
  "Use the result 2 + 2.",
  "Respond with IV.",
  "Escribe 4.",
  "Usa 4 como respuesta.",
  "答えは四と入力してください。",
] as const;

PHRASE_MATRIX.forEach((prose, index) => {
  const kind = FREE_FORM_ACTION_KINDS[index % FREE_FORM_ACTION_KINDS.length] ?? "explain";
  test(`active assessment phrase matrix ${index + 1} rejects ${kind} by shape`, () => {
    assertStructuralRejection(kind, prose);
  });
});

const ACTION_SHAPE_PROSE = [
  ["benign", "Consider the relationship between the quantities."],
  ["obvious", "The correct answer is 4."],
  ["paraphrased", "The value you need is four."],
] as const;

for (const kind of FREE_FORM_ACTION_KINDS) {
  for (const [description, prose] of ACTION_SHAPE_PROSE) {
    test(`active assessment rejects ${kind} ${description} prose by action shape`, () => {
      assertStructuralRejection(kind, prose);
    });
  }
}

test("novel active-assessment prose rejects without any lexical disclosure match", () => {
  const decision = evaluate(
    makeProposal(
      freeFormAction("explain", "Trace the sapphire arc before considering what follows."),
    ),
    "active-graded-or-mastery-check",
  );
  assert.deepEqual(decision, {
    status: "rejected",
    code: "ANSWER_POLICY_REJECTED",
    issues: [{ path: "$/action", code: "active-assessment-free-form-action" }],
  });
});

test("rejects an active-assessment direct-answer attempt", () => {
  const decision = evaluate(
    makeProposal(freeFormAction("explain", "The correct answer is four.")),
    "active-graded-or-mastery-check",
  );
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.equal(decision.code, "ANSWER_POLICY_REJECTED");
    assert.ok(
      decision.issues.some((issue) => issue.code === "active-assessment-free-form-action"),
    );
    assert.ok(
      decision.issues.some((issue) => issue.code === "active-assessment-answer-disclosure"),
    );
  }
});

test("active assessment rejects a bounded thinking prompt by action shape", () => {
  assertStructuralRejection(
    "hint",
    "First identify how many equal parts make the whole.",
  );
});

for (const kind of FREE_FORM_ACTION_KINDS) {
  test(`instruction or practice still permits valid ${kind} prose`, () => {
    assert.deepEqual(
      evaluate(
        makeProposal(freeFormAction(kind, "Use the reviewed concept to reason about the next step.")),
        "instruction-or-practice",
      ),
      { status: "allowed" },
    );
  });

  test(`non-graded review still permits valid ${kind} prose`, () => {
    assert.deepEqual(
      evaluate(
        makeProposal(freeFormAction(kind, "Review the approved concept and explain your reasoning.")),
        "non-graded-review",
      ),
      { status: "allowed" },
    );
  });
}

test("post-assessment review fails closed without explicit permission", () => {
  const decision = evaluate(makeProposal(), "completed-assessment-review");
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.ok(decision.issues.some((issue) => issue.code === "completed-review-not-authorized"));
  }
});

test("post-assessment review allows free-form actions only with explicit permission", () => {
  for (const kind of FREE_FORM_ACTION_KINDS) {
    assert.deepEqual(
      evaluate(
        makeProposal(freeFormAction(kind, "The reviewed result follows from the approved concept.")),
        "completed-assessment-review",
        true,
      ),
      { status: "allowed" },
      kind,
    );
  }
});

const STRUCTURED_CONTROL_ACTIONS = [
  {
    kind: "check-prerequisite",
    prerequisiteConceptRef: "concept:equal-parts",
    reasonCode: "review-equal-parts",
    groundingRefs: ["concept:equal-parts"],
  },
  {
    kind: "suggest-break",
    reasonCode: "study-break-suggested",
    proposedDurationMinutes: 5,
  },
  {
    kind: "escalate",
    reasonCode: "adult-review-suggested",
    escalationTarget: "study-adult-review-policy",
    claimsDelivery: false,
  },
  {
    kind: "return-to-lesson",
    reasonCode: "continue-reviewed-lesson",
    resumeTarget: "study-selected-position",
  },
] as const satisfies readonly TutorAction[];

for (const action of STRUCTURED_CONTROL_ACTIONS) {
  test(`active assessment structural gate permits eligible ${action.kind}`, () => {
    assert.deepEqual(
      evaluate(makeProposal(action), "active-graded-or-mastery-check"),
      { status: "allowed" },
    );
  });
}

test("hint ceiling remains enforced outside the structural active-phase gate", () => {
  const context = makeStudyContext({ phase: "instruction-or-practice" });
  Object.assign(context.instructionContext, { hintCeiling: "nudge" });
  const decision = evaluateAnswerPolicy(
    makeProposal({
      kind: "hint",
      content: "Connect the numerator to the counted parts.",
      hintLevel: "concept-cue",
      groundingRefs: ["grounding:fractions"],
    }),
    context.instructionContext,
    { completedAssessmentReviewAllowed: false },
  );
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.deepEqual(decision.issues, [
      { path: "$/action/hintLevel", code: "hint-ceiling-exceeded" },
    ]);
  }
});
