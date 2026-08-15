import assert from "node:assert/strict";
import test from "node:test";
import { validateExact } from "../contracts/validation.js";
import {
  MasteryEvidenceEvaluationSchema,
  evaluateMasteryEvidence,
  type MasteryEvidenceEvaluation,
} from "./index.js";

const baseInput = {
  envelope: "study-issued-mastery-evidence",
  learnerScopeRef: "learner-scope:learner-a",
  conceptRef: "concept:fraction-equivalence",
  evaluatedAt: "2026-08-14T16:00:00.000Z",
  evidence: [],
} as const;

function evidence(
  evidenceRef: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    evidenceRef,
    issuer: "study",
    learnerScopeRef: baseInput.learnerScopeRef,
    conceptRef: baseInput.conceptRef,
    outcome: "demonstrated",
    assistanceLevel: "independent",
    recency: "current",
    spacing: "same-session",
    observedAt: "2026-08-14T15:00:00.000Z",
    ...overrides,
  };
}

function evaluate(items: readonly Record<string, unknown>[]): MasteryEvidenceEvaluation {
  const result = evaluateMasteryEvidence({ ...baseInput, evidence: items });
  assert.equal(validateExact(MasteryEvidenceEvaluationSchema, result).status, "accepted");
  assert.equal(result.studyDecisionRequired, true);
  assert.equal(result.studyMutationAllowed, false);
  assert.equal(result.authoritative, false);
  for (const forbiddenOutputField of [
    "mastered",
    "progress",
    "officialGrade",
    "workingLevel",
  ]) {
    assert.equal(forbiddenOutputField in result, false);
  }
  return result;
}

function requireSummary(result: MasteryEvidenceEvaluation) {
  assert.equal(result.evaluationStatus, "summarized");
  if (result.evaluationStatus !== "summarized") throw new Error("Expected summary");
  return result;
}

test("no evidence is insufficient", () => {
  const result = requireSummary(evaluate([]));
  assert.equal(result.recommendation, "insufficient-evidence");
  assert.equal(result.sampleCount, 0);
  assert.deepEqual(result.reasonCodes, ["no-usable-evidence"]);
});

test("one independent result is emerging, not supported", () => {
  const result = requireSummary(evaluate([evidence("study-evidence:one")]));
  assert.equal(result.recommendation, "emerging-evidence");
  assert.equal(result.independentDemonstratedCount, 1);
  assert.deepEqual(result.reasonCodes, ["single-independent-sample"]);
});

test("multiple current independent results with spacing are supported evidence", () => {
  const result = requireSummary(
    evaluate([
      evidence("study-evidence:one"),
      evidence("study-evidence:two", {
        spacing: "spaced",
        observedAt: "2026-08-12T15:00:00.000Z",
      }),
    ]),
  );
  assert.equal(result.recommendation, "supported-evidence");
  assert.equal(result.sampleCount, 2);
  assert.equal(result.independentDemonstratedCount, 2);
  assert.equal(result.spacedEvidenceCount, 1);
  assert.deepEqual(result.reasonCodes, ["repeated-independent-evidence", "spaced-evidence"]);
});

test("all guided success is only emerging evidence", () => {
  const result = requireSummary(
    evaluate([
      evidence("study-evidence:one", { assistanceLevel: "guided" }),
      evidence("study-evidence:two", { assistanceLevel: "guided", spacing: "spaced" }),
      evidence("study-evidence:three", { assistanceLevel: "guided", spacing: "spaced" }),
    ]),
  );
  assert.equal(result.recommendation, "emerging-evidence");
  assert.equal(result.independentDemonstratedCount, 0);
  assert.equal(result.assistanceProfile.guided, 3);
  assert.deepEqual(result.reasonCodes, ["guided-evidence-only"]);
});

test("reteach-only success remains insufficient evidence", () => {
  const result = requireSummary(
    evaluate([
      evidence("study-evidence:one", { assistanceLevel: "reteach-required" }),
      evidence("study-evidence:two", {
        assistanceLevel: "reteach-required",
        spacing: "spaced",
      }),
    ]),
  );
  assert.equal(result.recommendation, "insufficient-evidence");
  assert.equal(result.assistanceProfile.reteachRequired, 2);
  assert.deepEqual(result.reasonCodes, ["reteach-required-only"]);
});

test("mixed assistance does not inflate one independent result to supported", () => {
  const result = requireSummary(
    evaluate([
      evidence("study-evidence:one"),
      evidence("study-evidence:two", { assistanceLevel: "light-hint", spacing: "spaced" }),
      evidence("study-evidence:three", { assistanceLevel: "guided", spacing: "spaced" }),
    ]),
  );
  assert.equal(result.recommendation, "emerging-evidence");
  assert.equal(result.independentDemonstratedCount, 1);
  assert.deepEqual(result.assistanceProfile, {
    independent: 1,
    lightHint: 1,
    guided: 1,
    reteachRequired: 0,
  });
});

test("contradictory demonstrated and not-demonstrated outcomes conflict", () => {
  const result = requireSummary(
    evaluate([
      evidence("study-evidence:success"),
      evidence("study-evidence:failure", { outcome: "not-demonstrated" }),
    ]),
  );
  assert.equal(result.recommendation, "conflicting-evidence");
  assert.equal(result.demonstratedCount, 1);
  assert.equal(result.notDemonstratedCount, 1);
  assert.ok(result.reasonCodes.includes("contradiction-detected"));
});

test("stale evidence alone is insufficient even when independently demonstrated", () => {
  const result = requireSummary(
    evaluate([
      evidence("study-evidence:one", { recency: "stale" }),
      evidence("study-evidence:two", { recency: "stale", spacing: "spaced" }),
    ]),
  );
  assert.equal(result.recommendation, "insufficient-evidence");
  assert.equal(result.currentEvidenceCount, 0);
  assert.equal(result.staleEvidenceCount, 2);
  assert.ok(result.reasonCodes.includes("stale-evidence-only"));
});

test("spaced assisted evidence cannot satisfy independent spacing", () => {
  const result = requireSummary(
    evaluate([
      evidence("study-evidence:independent-one"),
      evidence("study-evidence:independent-two"),
      evidence("study-evidence:guided-spaced", {
        assistanceLevel: "guided",
        spacing: "spaced",
      }),
    ]),
  );
  assert.equal(result.recommendation, "emerging-evidence");
  assert.ok(result.reasonCodes.includes("insufficient-spacing"));
});

test("exact duplicate replay is counted once and cannot create support", () => {
  const item = evidence("study-evidence:replay");
  const result = requireSummary(evaluate([item, structuredClone(item)]));
  assert.equal(result.recommendation, "emerging-evidence");
  assert.equal(result.sampleCount, 1);
  assert.equal(result.duplicateReplayCount, 1);
  assert.ok(result.reasonCodes.includes("replay-deduplicated"));
});

test("conflicting versions of one replay reference force conflicting evidence", () => {
  const result = requireSummary(
    evaluate([
      evidence("study-evidence:collision"),
      evidence("study-evidence:collision", { outcome: "not-demonstrated" }),
    ]),
  );
  assert.equal(result.recommendation, "conflicting-evidence");
  assert.equal(result.sampleCount, 0);
  assert.equal(result.conflictingReplayCount, 1);
  assert.ok(result.reasonCodes.includes("conflicting-replay"));
});

test("cross-concept evidence rejects the whole batch without scoped counts", () => {
  const result = evaluate([
    evidence("study-evidence:foreign-concept", { conceptRef: "concept:decimal-place-value" }),
  ]);
  assert.equal(result.evaluationStatus, "rejected");
  assert.deepEqual(result.reasonCodes, ["cross-concept-evidence"]);
  assert.equal("sampleCount" in result, false);
});

test("cross-learner evidence rejects the whole batch without scoped counts", () => {
  const result = evaluate([
    evidence("study-evidence:foreign-learner", {
      learnerScopeRef: "learner-scope:learner-b",
    }),
  ]);
  assert.equal(result.evaluationStatus, "rejected");
  assert.deepEqual(result.reasonCodes, ["cross-learner-evidence"]);
  assert.equal("sampleCount" in result, false);
});

test("future-dated evidence rejects the whole batch", () => {
  const result = evaluate([
    evidence("study-evidence:future", { observedAt: "2026-08-15T15:00:00.000Z" }),
  ]);
  assert.equal(result.evaluationStatus, "rejected");
  assert.deepEqual(result.reasonCodes, ["future-evidence"]);
});

test("attempted authoritative mastery fields reject the input", () => {
  for (const attemptedMutation of [
    { mastered: true },
    { authoritativeMastery: true },
    { declareMastery: true },
  ]) {
    const result = evaluate([
      { ...evidence("study-evidence:authority-attack"), ...attemptedMutation },
    ]);
    assert.equal(result.evaluationStatus, "rejected");
    assert.equal(result.recommendation, "insufficient-evidence");
    assert.deepEqual(result.reasonCodes, ["invalid-study-evidence"]);
  }
});

test("attempted grade and working-level mutations reject the input", () => {
  for (const attemptedMutation of [
    { officialGrade: 8 },
    { workingLevel: "grade-8" },
    { mutateWorkingLevel: true },
  ]) {
    const result = evaluate([
      { ...evidence("study-evidence:level-attack"), ...attemptedMutation },
    ]);
    assert.equal(result.evaluationStatus, "rejected");
    assert.deepEqual(result.reasonCodes, ["invalid-study-evidence"]);
  }
});

test("answer material, learner responses, and transcripts are outside the contract", () => {
  for (const forbiddenData of [
    { answerKey: "private" },
    { correctAnswer: "private" },
    { answerIndex: 2 },
    { rawLearnerResponse: "private" },
    { rawTranscript: "private" },
  ]) {
    const result = evaluate([
      { ...evidence("study-evidence:privacy-attack"), ...forbiddenData },
    ]);
    assert.equal(result.evaluationStatus, "rejected");
    assert.deepEqual(result.reasonCodes, ["invalid-study-evidence"]);
  }
});

test("input ordering cannot change the deterministic summary", () => {
  const items = [
    evidence("study-evidence:one"),
    evidence("study-evidence:two", { assistanceLevel: "light-hint", spacing: "spaced" }),
    evidence("study-evidence:three", { outcome: "inconclusive" }),
  ];
  assert.deepEqual(evaluate(items), evaluate([...items].reverse()));
});
