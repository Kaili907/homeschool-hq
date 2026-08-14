import assert from "node:assert/strict";
import test from "node:test";
import type {
  AssessmentPhase,
  TutorActionProposal,
  TutorRequest,
} from "../../core/v2/contracts/index.js";
import {
  evaluateAnswerPolicy,
  type AnswerPolicyDecision,
} from "../../core/v2/policy/anti-answer/index.js";
import type {
  ProviderExecutionRequest,
  ProviderExecutionResult,
  TutorProviderPort,
} from "../../core/v2/providers/ports/index.js";
import {
  orchestrateTutorV2Bridge,
  type TutorV2BridgeResult,
} from "../../study-engine/bridges/tutor-v2/index.js";
import {
  approvalForProposal,
  defaultReviewedApprovals,
  harness,
  proposalFixture,
  successResult,
} from "./fixtures.js";

const FREE_FORM_ACTION_KINDS = [
  "explain",
  "hint",
  "ask-check",
  "show-example",
  "reteach",
] as const;

type FreeFormActionKind = (typeof FREE_FORM_ACTION_KINDS)[number];

const STRUCTURED_CONTROL_ACTION_KINDS = [
  "check-prerequisite",
  "suggest-break",
  "escalate",
  "return-to-lesson",
] as const;

const ACTION_SHAPE_PROSE = [
  ["benign", "Consider the relationship between the quantities."],
  ["obvious-direct-answer", "The correct answer is 4."],
  ["novel-paraphrase", "Trace the sapphire arc and place its count in the vessel."],
] as const;

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

class FunctionalProvider implements TutorProviderPort {
  constructor(
    private readonly behavior: (
      request: ProviderExecutionRequest,
    ) => unknown | Promise<unknown>,
  ) {}

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    return await this.behavior(request) as ProviderExecutionResult;
  }
}

function requestOf(input: { request: unknown }): TutorRequest {
  return input.request as TutorRequest;
}

function proposalWithProse(kind: FreeFormActionKind, prose: string): TutorActionProposal {
  const proposal = proposalFixture(kind);
  if (proposal.action.kind === "ask-check") proposal.action.question = prose;
  else if (
    proposal.action.kind === "explain" ||
    proposal.action.kind === "hint" ||
    proposal.action.kind === "show-example" ||
    proposal.action.kind === "reteach"
  ) proposal.action.content = prose;
  return proposal;
}

function setPhase(input: { request: unknown }, phase: AssessmentPhase): void {
  requestOf(input).studyAuthorityContext.instructionContext.assessmentPhase = phase;
}

function assertFallback(result: TutorV2BridgeResult, reason: string): void {
  assert.equal(result.status, "fallback");
  if (result.status === "fallback") {
    assert.equal(result.reasonCode, reason);
    assert.equal(result.studyMutationAllowed, false);
    assert.equal(result.fallback?.action.kind, "return-to-lesson");
  }
}

function structuralDecision(proposal: TutorActionProposal): AnswerPolicyDecision {
  const h = harness();
  setPhase(h.input, "active-graded-or-mastery-check");
  return evaluateAnswerPolicy(
    proposal,
    requestOf(h.input).studyAuthorityContext.instructionContext,
    h.input.assessmentPolicy,
  );
}

async function runProposal(
  proposal: TutorActionProposal,
  phase: AssessmentPhase,
): Promise<TutorV2BridgeResult> {
  const approval = await approvalForProposal(proposal);
  const h = harness(
    [successResult(proposal)],
    { approvals: [...defaultReviewedApprovals().slice(0, 3), approval] },
  );
  setPhase(h.input, phase);
  return await orchestrateTutorV2Bridge(h.input, h.dependencies);
}

let structuralCase = 0;
for (const kind of FREE_FORM_ACTION_KINDS) {
  for (const [description, prose] of ACTION_SHAPE_PROSE) {
    structuralCase += 1;
    const caseNumber = String(structuralCase).padStart(2, "0");
    test(`W1-09R3 structural anti-answer adversarial ${caseNumber}: active ${kind} rejects ${description} prose by shape`, async () => {
      const proposal = proposalWithProse(kind, prose);
      const decision = structuralDecision(proposal);
      assert.equal(decision.status, "rejected");
      if (decision.status === "rejected") {
        assert.ok(
          decision.issues.some((issue) =>
            issue.path === "$/action" &&
            issue.code === "active-assessment-free-form-action"
          ),
          "the structural active-phase/action-shape issue must independently reject",
        );
        if (description === "benign" || description === "novel-paraphrase") {
          assert.deepEqual(decision.issues, [
            { path: "$/action", code: "active-assessment-free-form-action" },
          ]);
        }
      }
      const result = await runProposal(proposal, "active-graded-or-mastery-check");
      assertFallback(result, "POLICY_REJECTION");
      assert.equal(JSON.stringify(result).includes(prose), false);
    });
  }
}

PHRASE_MATRIX.forEach((prose, index) => {
  const kind = FREE_FORM_ACTION_KINDS[index % FREE_FORM_ACTION_KINDS.length] ?? "explain";
  const caseNumber = String(index + 1).padStart(2, "0");
  test(`W1-09R3 phrase matrix ${caseNumber}: active ${kind} blocks semantic directive by shape`, async () => {
    const proposal = proposalWithProse(kind, prose);
    const decision = structuralDecision(proposal);
    assert.equal(decision.status, "rejected");
    if (decision.status === "rejected") {
      assert.ok(
        decision.issues.some((issue) => issue.code === "active-assessment-free-form-action"),
      );
    }
    const result = await runProposal(proposal, "active-graded-or-mastery-check");
    assertFallback(result, "POLICY_REJECTION");
    assert.equal(JSON.stringify(result).includes(prose), false);
  });
});

for (const kind of STRUCTURED_CONTROL_ACTION_KINDS) {
  test(`W1-09R3 structured control: active phase does not itself reject ${kind}`, async () => {
    const proposal = proposalFixture(kind);
    assert.deepEqual(structuralDecision(proposal), { status: "allowed" });
    const result = await runProposal(proposal, "active-graded-or-mastery-check");
    assert.equal(result.status, "accepted", kind);
    if (result.status === "accepted") assert.equal(result.proposal.action.kind, kind);
  });
}

for (const kind of FREE_FORM_ACTION_KINDS) {
  test(`W1-09R3 instruction/practice regression: authorized ${kind} remains functional`, async () => {
    const result = await runProposal(
      proposalWithProse(kind, "Use the reviewed concept to reason about the next step."),
      "instruction-or-practice",
    );
    assert.equal(result.status, "accepted", kind);
  });

  test(`W1-09R3 non-graded-review regression: authorized ${kind} remains functional`, async () => {
    const result = await runProposal(
      proposalWithProse(kind, "Review the approved concept and explain your reasoning."),
      "non-graded-review",
    );
    assert.equal(result.status, "accepted", kind);
  });
}

test("W1-09R3 completed review: Study permission false rejects", async () => {
  const h = harness([successResult(proposalFixture("explain"))]);
  setPhase(h.input, "completed-assessment-review");
  h.input.assessmentPolicy.completedAssessmentReviewAllowed = false;
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
});

test("W1-09R3 completed review: Study permission true follows normal policy", async () => {
  const h = harness([successResult(proposalFixture("explain"))]);
  setPhase(h.input, "completed-assessment-review");
  h.input.assessmentPolicy.completedAssessmentReviewAllowed = true;
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
});

test("W1-09R3 answer-bearing structured field is a hard rejection", async () => {
  const proposal = structuredClone(proposalFixture("explain")) as unknown as Record<string, unknown>;
  Object.assign(proposal.action as Record<string, unknown>, { correctAnswer: "4" });
  const h = harness([successResult(proposal)]);
  setPhase(h.input, "active-graded-or-mastery-check");
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
});

test("W1-09R3 provider receives no answer or Study authority", async () => {
  let received: ProviderExecutionRequest | null = null;
  const h = harness();
  Object.assign(h.dependencies, {
    provider: new FunctionalProvider((request) => {
      received = structuredClone(request);
      return successResult(proposalFixture("explain"));
    }),
  });
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  assert.ok(received);
  const serialized = JSON.stringify(received).toLowerCase();
  for (const forbidden of [
    "studyauthoritycontext",
    "authorizationref",
    "invocationbindingref",
    "safetyclearanceref",
    "answerpolicyref",
    "correctanswer",
    "answerindex",
    "expectedanswer",
    "solutionkey",
    "scoringauthority",
    "answerkeylocator",
    "serverscoringmaterial",
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
});
