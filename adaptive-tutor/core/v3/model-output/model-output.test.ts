import assert from "node:assert/strict";
import test from "node:test";
import type {
  AssessmentPhase,
  OpaqueReference,
  TutorActionKind,
} from "../../v2/contracts/index.js";
import {
  validateProviderModelOutput,
  type InstructionalDisplayMode,
  type ModelOutputValidationContext,
  type ProviderModelProposalEnvelope,
} from "./index.js";

const reviewedRef = "reviewed-content:fraction-hint" as OpaqueReference;
const groundingRef = "grounding:fraction-model" as OpaqueReference;

function contextFixture(
  assessmentPhase: AssessmentPhase = "instruction-or-practice",
): ModelOutputValidationContext {
  return {
    assessmentPhase,
    reviewedContentRefs: [reviewedRef],
    groundingRefs: [groundingRef],
    allowedTutorActions: ["hint"],
    allowedInstructionalDisplayModes: ["reviewed-text"],
  };
}

function proposalFixture(): ProviderModelProposalEnvelope {
  return {
    responseKind: "proposal",
    reviewedContentRefs: [reviewedRef],
    groundingRefs: [groundingRef],
    reasonCodes: ["needs-hint"],
    requestedTutorAction: "hint",
    instructionalDisplayMode: "reviewed-text",
    refusalState: "not-refused",
  };
}

function withInjectedField(field: string, value: unknown): Record<string, unknown> {
  return { ...proposalFixture(), [field]: value };
}

test("accepts a reference-only proposal and returns a detached frozen snapshot", () => {
  const providerOutput = proposalFixture();
  const result = validateProviderModelOutput(providerOutput, contextFixture());

  assert.equal(result.status, "accepted-proposal");
  if (result.status !== "accepted-proposal") return;
  assert.equal(result.staticFallbackRequired, false);
  assert.deepEqual(Object.keys(result.proposal).sort(), [
    "groundingRefs",
    "instructionalDisplayMode",
    "reasonCodes",
    "refusalState",
    "requestedTutorAction",
    "responseKind",
    "reviewedContentRefs",
  ]);
  assert.notEqual(result.proposal, providerOutput);
  assert.notEqual(result.proposal.reviewedContentRefs, providerOutput.reviewedContentRefs);
  assert.equal(Object.isFrozen(result.proposal), true);
  assert.equal(Object.isFrozen(result.proposal.reviewedContentRefs), true);

  providerOutput.reviewedContentRefs[0] = "reviewed-content:provider-mutated";
  assert.deepEqual(result.proposal.reviewedContentRefs, [reviewedRef]);
});

test("normalizes a closed refusal without retaining provider-owned arrays", () => {
  const providerOutput = {
    responseKind: "refusal",
    reviewedContentRefs: [],
    groundingRefs: [],
    reasonCodes: ["insufficient-grounding"],
    requestedTutorAction: null,
    instructionalDisplayMode: "none",
    refusalState: "refused",
  };
  const result = validateProviderModelOutput(providerOutput, contextFixture());

  assert.equal(result.status, "refused");
  if (result.status !== "refused") return;
  assert.equal(result.staticFallbackRequired, true);
  assert.deepEqual(result.refusal.reasonCodes, ["insufficient-grounding"]);
  assert.notEqual(result.refusal.reasonCodes, providerOutput.reasonCodes);
  assert.equal(Object.isFrozen(result.refusal), true);
});

test("rejects unknown fields as malformed and never echoes untrusted values", () => {
  const output = withInjectedField("debugTrace", "secret-provider-payload");
  const result = validateProviderModelOutput(output, contextFixture());

  assert.deepEqual(result, {
    status: "malformed",
    reasonCode: "MODEL_OUTPUT_SCHEMA_REJECTED",
    staticFallbackRequired: true,
  });
  assert.doesNotMatch(JSON.stringify(result), /secret-provider-payload|debugTrace/);
});

test("rejects malformed, inconsistent, and over-bounded envelopes", () => {
  const malformed: readonly unknown[] = [
    null,
    [],
    "provider prose",
    {},
    { ...proposalFixture(), responseKind: "unknown" },
    { ...proposalFixture(), refusalState: "refused" },
    { ...proposalFixture(), reviewedContentRefs: [] },
    {
      ...proposalFixture(),
      reviewedContentRefs: Array.from(
        { length: 13 },
        (_, index) => `reviewed-content:item-${index}`,
      ),
    },
    {
      responseKind: "refusal",
      reviewedContentRefs: [reviewedRef],
      groundingRefs: [],
      reasonCodes: ["insufficient-grounding"],
      requestedTutorAction: null,
      instructionalDisplayMode: "none",
      refusalState: "refused",
    },
  ];

  for (const output of malformed) {
    assert.equal(validateProviderModelOutput(output, contextFixture()).status, "malformed");
  }
});

test("unreviewed content references require deterministic static fallback", () => {
  const output = {
    ...proposalFixture(),
    reviewedContentRefs: ["reviewed-content:not-in-trusted-registry"],
  };
  assert.deepEqual(validateProviderModelOutput(output, contextFixture()), {
    status: "static-fallback-required",
    reasonCode: "UNREVIEWED_CONTENT_REFERENCE",
    staticFallbackRequired: true,
  });
});

test("unknown grounding references require deterministic static fallback", () => {
  const output = {
    ...proposalFixture(),
    groundingRefs: ["grounding:not-in-request"],
  };
  assert.deepEqual(validateProviderModelOutput(output, contextFixture()), {
    status: "static-fallback-required",
    reasonCode: "UNKNOWN_GROUNDING_REFERENCE",
    staticFallbackRequired: true,
  });
});

test("provider-requested actions and display modes remain subordinate to trusted policy", () => {
  const disallowedAction = {
    ...proposalFixture(),
    requestedTutorAction: "reteach" as TutorActionKind,
  };
  assert.deepEqual(validateProviderModelOutput(disallowedAction, contextFixture()), {
    status: "static-fallback-required",
    reasonCode: "REQUESTED_TUTOR_ACTION_NOT_ALLOWED",
    staticFallbackRequired: true,
  });

  const disallowedMode = {
    ...proposalFixture(),
    instructionalDisplayMode: "reviewed-visual" as InstructionalDisplayMode,
  };
  assert.deepEqual(validateProviderModelOutput(disallowedMode, contextFixture()), {
    status: "static-fallback-required",
    reasonCode: "INSTRUCTIONAL_DISPLAY_MODE_NOT_ALLOWED",
    staticFallbackRequired: true,
  });
});

test("authority-field injection cannot change Study-owned state", () => {
  const studyAuthority = {
    mastery: "unchanged",
    workingLevel: "unchanged",
    nominalGrade: "unchanged",
    curriculum: "unchanged",
    safety: "restricted",
    guardianActionAuthorized: false,
    toolsExecuted: 0,
  };
  const injectedAuthorityFields = [
    "changeMastery",
    "workingLevel",
    "nominalGrade",
    "curriculumAssignment",
    "clearSafety",
    "guardianActionAuthorization",
    "toolCalls",
  ] as const;

  for (const field of injectedAuthorityFields) {
    const result = validateProviderModelOutput(
      withInjectedField(field, { authorize: true, value: "provider-selected" }),
      contextFixture(),
    );
    assert.deepEqual(result, {
      status: "static-fallback-required",
      reasonCode: "FORBIDDEN_MODEL_AUTHORITY",
      staticFallbackRequired: true,
    });
  }
  assert.deepEqual(studyAuthority, {
    mastery: "unchanged",
    workingLevel: "unchanged",
    nominalGrade: "unchanged",
    curriculum: "unchanged",
    safety: "restricted",
    guardianActionAuthorized: false,
    toolsExecuted: 0,
  });
});

test("active assessment rejects answer-bearing and unrestricted tutoring fields", () => {
  const active = contextFixture("active-graded-or-mastery-check");
  const injectedAnswerFields = [
    "answer",
    "correctAnswer",
    "solution",
    "content",
    "explanation",
    "hintText",
    "question",
    "tutoringText",
  ] as const;

  for (const field of injectedAnswerFields) {
    assert.deepEqual(
      validateProviderModelOutput(withInjectedField(field, "The correct answer is 42."), active),
      {
        status: "static-fallback-required",
        reasonCode: "ACTIVE_ASSESSMENT_ANSWER_BEARING_OUTPUT",
        staticFallbackRequired: true,
      },
    );
  }
});

test("active assessment also rejects answer disclosure hidden under an unknown field", () => {
  const output = withInjectedField("payload", "The final answer is 42.");
  assert.deepEqual(
    validateProviderModelOutput(
      output,
      contextFixture("active-graded-or-mastery-check"),
    ),
    {
      status: "static-fallback-required",
      reasonCode: "ACTIVE_ASSESSMENT_ANSWER_BEARING_OUTPUT",
      staticFallbackRequired: true,
    },
  );
});

test("active assessment can accept the closed reference-only proposal", () => {
  const result = validateProviderModelOutput(
    proposalFixture(),
    contextFixture("active-graded-or-mastery-check"),
  );
  assert.equal(result.status, "accepted-proposal");
  if (result.status !== "accepted-proposal") return;
  assert.equal(Object.hasOwn(result.proposal, "content"), false);
  assert.equal(Object.hasOwn(result.proposal, "answer"), false);
});

test("free-form provider content is still rejected outside assessment by the closed schema", () => {
  assert.equal(
    validateProviderModelOutput(
      withInjectedField("content", "A provider-authored explanation."),
      contextFixture(),
    ).status,
    "malformed",
  );
});

test("hazard inspection does not invoke provider-defined getters", () => {
  let getterCalled = false;
  const output = proposalFixture() as ProviderModelProposalEnvelope & { payload?: unknown };
  Object.defineProperty(output, "payload", {
    enumerable: true,
    get() {
      getterCalled = true;
      return "The answer is 42.";
    },
  });

  assert.equal(validateProviderModelOutput(output, contextFixture()).status, "malformed");
  assert.equal(getterCalled, false);
});

test("hidden and symbol unknown fields reject instead of being stripped", () => {
  const hidden = proposalFixture();
  Object.defineProperty(hidden, "debugTrace", {
    enumerable: false,
    value: "hidden-provider-data",
  });
  assert.equal(validateProviderModelOutput(hidden, contextFixture()).status, "malformed");

  const symbol = proposalFixture();
  Object.defineProperty(symbol, Symbol("provider-metadata"), {
    enumerable: true,
    value: "symbol-provider-data",
  });
  assert.equal(validateProviderModelOutput(symbol, contextFixture()).status, "malformed");

  const arrayMetadata = proposalFixture();
  Object.defineProperty(arrayMetadata.groundingRefs, "providerMetadata", {
    enumerable: true,
    value: "array-provider-data",
  });
  assert.equal(validateProviderModelOutput(arrayMetadata, contextFixture()).status, "malformed");
});

test("hostile reflection failures normalize to malformed without escaping", () => {
  const output = new Proxy(proposalFixture(), {
    ownKeys() {
      throw new Error("provider reflection trap with secret payload");
    },
  });

  assert.doesNotThrow(() => validateProviderModelOutput(output, contextFixture()));
  assert.deepEqual(validateProviderModelOutput(output, contextFixture()), {
    status: "malformed",
    reasonCode: "MODEL_OUTPUT_SCHEMA_REJECTED",
    staticFallbackRequired: true,
  });
});
