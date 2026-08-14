import assert from "node:assert/strict";
import test from "node:test";
import {
  PARENT_EXPLANATION_DISCLAIMER,
  PARENT_EXPLANATION_REASON_CODES,
  PARENT_EXPLANATION_VERSION,
  REVIEWED_PARENT_EXPLANATION_COPY,
  explainTutorRecommendationForParentHub,
} from "./parent-explanation.js";

const baseRequest = {
  requestKind: "parent-hub-why",
  scope: {
    selectedLearnerRef: "learner:child-a",
    authorizedLearnerRef: "learner:child-a",
  },
  recommendation: {
    learnerRef: "learner:child-a",
    recommendationRef: "recommendation:rec-001",
    reasonCode: "prerequisite-review-suggested",
    provenance: {
      producer: "study-engine",
      recommendationEventRef: "event:recommendation-001",
      policyRef: "policy:tutor-v2-parent-why-v1",
      producedAt: "2026-08-14T16:30:00.000Z",
    },
  },
};

function request(overrides: Record<string, unknown> = {}): unknown {
  const value = structuredClone(baseRequest) as Record<string, unknown>;
  return Object.assign(value, overrides);
}

function accepted(reasonCode = baseRequest.recommendation.reasonCode) {
  const value = structuredClone(baseRequest);
  value.recommendation.reasonCode = reasonCode;
  const result = explainTutorRecommendationForParentHub(value);
  assert.equal(result.status, "accepted");
  return result.value;
}

test("renders reviewed deterministic copy for every explanation class", () => {
  for (const reasonCode of PARENT_EXPLANATION_REASON_CODES) {
    const explanation = accepted(reasonCode);
    assert.deepEqual(
      {
        title: explanation.title,
        explanation: explanation.explanation,
      },
      REVIEWED_PARENT_EXPLANATION_COPY[reasonCode],
    );
    assert.equal(explanation.reasonCode, reasonCode);
    assert.equal(explanation.disclaimer, PARENT_EXPLANATION_DISCLAIMER);
  }
});

test("copy is deterministic and does not claim recommendation authority", () => {
  const first = accepted("reteach-suggested");
  const second = accepted("reteach-suggested");
  assert.deepEqual(first, second);
  assert.equal(first.explanationVersion, PARENT_EXPLANATION_VERSION);
  assert.equal(first.audience, "parent-hub");
  assert.match(first.disclaimer, /does not make or change/i);
});

test("raw learner answers are rejected and never reflected", () => {
  const contaminated = structuredClone(baseRequest) as Record<string, unknown>;
  (contaminated.recommendation as Record<string, unknown>).rawLearnerAnswer =
    "The private answer is 42";
  const result = explainTutorRecommendationForParentHub(contaminated);
  assert.deepEqual(result, {
    status: "rejected",
    code: "PARENT_EXPLANATION_REQUEST_REJECTED",
  });
  assert.doesNotMatch(JSON.stringify(result), /private answer|42/i);
});

test("Tutor and provider transcripts are rejected and never reflected", () => {
  for (const contamination of [
    { tutorTranscript: [{ role: "learner", content: "raw turn" }] },
    { rawProviderPrompt: "private provider prompt" },
    { rawProviderResponse: "private provider response" },
  ]) {
    const contaminated = structuredClone(baseRequest) as Record<string, unknown>;
    Object.assign(
      contaminated.recommendation as Record<string, unknown>,
      contamination,
    );
    const result = explainTutorRecommendationForParentHub(contaminated);
    assert.equal(result.status, "rejected");
    assert.doesNotMatch(JSON.stringify(result), /raw turn|private provider/i);
  }
});

test("diagnostic, emotional, and personality language cannot enter the explanation", () => {
  for (const contamination of [
    { diagnosticInference: "diagnosis-private" },
    { emotionalLabel: "anxious-private" },
    { personalityJudgment: "unmotivated-private" },
  ]) {
    const contaminated = structuredClone(baseRequest) as Record<string, unknown>;
    Object.assign(
      contaminated.recommendation as Record<string, unknown>,
      contamination,
    );
    const result = explainTutorRecommendationForParentHub(contaminated);
    assert.equal(result.status, "rejected");
    assert.doesNotMatch(
      JSON.stringify(result),
      /diagnosis-private|anxious-private|unmotivated-private/i,
    );
  }

  for (const reasonCode of PARENT_EXPLANATION_REASON_CODES) {
    assert.doesNotMatch(
      `${accepted(reasonCode).title} ${accepted(reasonCode).explanation}`,
      /diagnos|disorder|condition|anxious|unmotivated|lazy|personality/i,
    );
  }
});

test("sibling and household data are rejected and never reflected", () => {
  for (const contamination of [
    { siblingRecords: [{ learnerRef: "learner:child-b" }] },
    { householdPrivateData: "household-private-value" },
  ]) {
    const contaminated = structuredClone(baseRequest) as Record<string, unknown>;
    Object.assign(contaminated, contamination);
    const result = explainTutorRecommendationForParentHub(contaminated);
    assert.equal(result.status, "rejected");
    assert.doesNotMatch(
      JSON.stringify(result),
      /child-b|household-private-value/i,
    );
  }
});

test("credentials are rejected and never reflected", () => {
  for (const contamination of [
    { authBearer: "bearer-private-value" },
    { serviceRoleKey: "credential-private-value" },
  ]) {
    const contaminated = structuredClone(baseRequest) as Record<string, unknown>;
    Object.assign(contaminated, contamination);
    const result = explainTutorRecommendationForParentHub(contaminated);
    assert.equal(result.status, "rejected");
    assert.doesNotMatch(
      JSON.stringify(result),
      /bearer-private-value|credential-private-value/i,
    );
  }
});

test("cross-child scope mismatches fail closed without returning child references", () => {
  for (const mutate of [
    (value: typeof baseRequest) => {
      value.scope.selectedLearnerRef = "learner:child-b";
    },
    (value: typeof baseRequest) => {
      value.scope.authorizedLearnerRef = "learner:child-b";
    },
    (value: typeof baseRequest) => {
      value.recommendation.learnerRef = "learner:child-b";
    },
  ]) {
    const contaminated = structuredClone(baseRequest);
    mutate(contaminated);
    const result = explainTutorRecommendationForParentHub(contaminated);
    assert.deepEqual(result, {
      status: "rejected",
      code: "PARENT_EXPLANATION_SCOPE_MISMATCH",
    });
    assert.doesNotMatch(JSON.stringify(result), /child-a|child-b/i);
  }
});

test("malformed reason values are rejected", () => {
  for (const malformedReason of [" Not a code ", "", 7, null, {}]) {
    const malformed = structuredClone(baseRequest) as Record<string, unknown>;
    (malformed.recommendation as Record<string, unknown>).reasonCode =
      malformedReason;
    assert.deepEqual(explainTutorRecommendationForParentHub(malformed), {
      status: "rejected",
      code: "PARENT_EXPLANATION_REQUEST_REJECTED",
    });
  }
});

test("unknown well-formed reason codes fail closed", () => {
  const unknown = structuredClone(baseRequest) as Record<string, unknown>;
  (unknown.recommendation as Record<string, unknown>).reasonCode =
    "future-unreviewed-reason";
  assert.deepEqual(explainTutorRecommendationForParentHub(unknown), {
    status: "rejected",
    code: "PARENT_EXPLANATION_UNKNOWN_REASON",
  });
});

test("missing or malformed provenance is rejected", () => {
  const missing = structuredClone(baseRequest) as Record<string, unknown>;
  delete (missing.recommendation as Record<string, unknown>).provenance;
  assert.equal(
    explainTutorRecommendationForParentHub(missing).status,
    "rejected",
  );

  const wrongProducer = structuredClone(baseRequest) as Record<string, unknown>;
  (
    (wrongProducer.recommendation as Record<string, unknown>)
      .provenance as Record<string, unknown>
  ).producer = "provider";
  assert.equal(
    explainTutorRecommendationForParentHub(wrongProducer).status,
    "rejected",
  );
});

test("accepted explanations contain only minimized reviewed evidence", () => {
  const explanation = accepted("evidence-not-yet-strong-enough");
  assert.deepEqual(Object.keys(explanation).sort(), [
    "audience",
    "disclaimer",
    "explanation",
    "explanationVersion",
    "provenance",
    "reasonCode",
    "title",
  ]);
  assert.deepEqual(Object.keys(explanation.provenance).sort(), [
    "producedAt",
    "recommendationRef",
  ]);
  assert.equal("learnerRef" in explanation, false);
  assert.equal("recommendationEventRef" in explanation.provenance, false);
  assert.equal("policyRef" in explanation.provenance, false);

  const withEvidence = structuredClone(baseRequest) as Record<string, unknown>;
  (withEvidence.recommendation as Record<string, unknown>).evidence = [
    { observation: "raw-private-evidence" },
  ];
  const result = explainTutorRecommendationForParentHub(withEvidence);
  assert.equal(result.status, "rejected");
  assert.doesNotMatch(JSON.stringify(result), /raw-private-evidence/i);
});

test("answer keys cannot enter the explanation boundary", () => {
  const contaminated = structuredClone(baseRequest) as Record<string, unknown>;
  (contaminated.recommendation as Record<string, unknown>).answerKey = {
    expected: "private-correct-answer",
  };
  const result = explainTutorRecommendationForParentHub(contaminated);
  assert.equal(result.status, "rejected");
  assert.doesNotMatch(JSON.stringify(result), /private-correct-answer/i);
});

test("unknown top-level fields are rejected", () => {
  const malformed = request({ deliveryChannel: "push" });
  assert.deepEqual(explainTutorRecommendationForParentHub(malformed), {
    status: "rejected",
    code: "PARENT_EXPLANATION_REQUEST_REJECTED",
  });
});
