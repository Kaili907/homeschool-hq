import assert from "node:assert/strict";
import test from "node:test";
import { makeProposal, makeStudyContext } from "../refusal/test-support.js";
import { evaluateGroundingPolicy } from "./index.js";

test("rejects invented grounding outside the allowed Tutor context", () => {
  const proposal = makeProposal({
    kind: "explain",
    content: "An invented curriculum claim.",
    groundingRefs: ["grounding:invented-authority"],
  });
  const decision = evaluateGroundingPolicy(proposal, makeStudyContext().instructionContext);
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.equal(decision.code, "INSUFFICIENT_GROUNDED_CONTEXT");
    assert.ok(decision.issues.some((issue) => issue.code === "grounding-outside-allowed-set"));
  }
});

test("rejects missing grounding claims", () => {
  const proposal = { ...makeProposal(), groundingClaims: [] };
  const decision = evaluateGroundingPolicy(proposal, makeStudyContext().instructionContext);
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.deepEqual(decision.missingGroundingRefs, ["grounding:fractions"]);
  }
});

test("rejects an unknown concept reference", () => {
  const proposal = makeProposal({
    kind: "reteach",
    content: "Review the prerequisite concept.",
    conceptRef: "concept:invented",
    groundingRefs: ["grounding:fractions"],
  });
  const decision = evaluateGroundingPolicy(proposal, makeStudyContext().instructionContext);
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.ok(decision.issues.some((issue) => issue.code === "unknown-curriculum-reference"));
  }
});

test("rejects an unknown lesson or item reference embedded in teaching content", () => {
  const proposal = makeProposal({
    kind: "explain",
    content: "According to lesson:invented and item:unknown, use this rule.",
    groundingRefs: ["grounding:fractions"],
  });
  const decision = evaluateGroundingPolicy(proposal, makeStudyContext().instructionContext);
  assert.equal(decision.status, "rejected");
  if (decision.status === "rejected") {
    assert.deepEqual(
      decision.issues
        .filter((issue) => issue.code === "unknown-curriculum-reference")
        .map((issue) => issue.reference),
      ["lesson:invented", "item:unknown"],
    );
  }
});

test("accepts supplied reference membership with matching digests", () => {
  const proposal = makeProposal({
    kind: "show-example",
    content: "Here is an approved analogous fraction model.",
    exampleRef: "example:fraction-model",
    groundingRefs: ["example:fraction-model"],
    nonIsomorphicToActiveItem: true,
  });
  assert.equal(
    evaluateGroundingPolicy(proposal, makeStudyContext().instructionContext).status,
    "grounded",
  );
});
