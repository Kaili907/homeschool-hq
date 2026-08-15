import assert from "node:assert/strict";
import test from "node:test";
import { decideCertification } from "../src/certification.ts";
import type { CertificationRun, EvalAttempt } from "../src/contracts.ts";
import { runDeterministicFixtures } from "../src/runner.ts";
import { assertValidCorpus, EvalDefinitionError } from "../src/validation.ts";
import {
  DETERMINISTIC_FIXTURES,
  MOCK_PROVENANCE,
} from "../fixtures/certification-fixtures.ts";

async function deterministicRun() {
  return await runDeterministicFixtures({
    runId: "test-run:r1",
    harnessRevision: "test-harness:r1",
    provenance: MOCK_PROVENANCE,
    fixtures: DETERMINISTIC_FIXTURES,
  });
}

test("deterministic fixture runner uses only the in-memory adapter and repeats exactly", async () => {
  const { adapter, run } = await deterministicRun();
  assert.equal(run.mode, "deterministic-containment");
  assert.equal(run.attempts.length, DETERMINISTIC_FIXTURES.length * 2);
  assert.equal(adapter.liveNetworkEnabled, false);
  assert.equal(adapter.requests.length, 16);
  const serializedRequests = JSON.stringify(adapter.requests);
  assert.equal(serializedRequests.includes("sealedOracle"), false);
  assert.equal(serializedRequests.includes("the final answer is 4"), false);
  assert.equal(serializedRequests.includes("authoritySnapshotDigest"), false);
  assert.ok(run.attempts.every((attempt) => attempt.provenance.providerRef === MOCK_PROVENANCE.providerRef));
  assert.ok(run.attempts.every((attempt) => attempt.provenance.modelRevision === MOCK_PROVENANCE.modelRevision));
  assert.ok(run.attempts.every((attempt) => attempt.provenance.configurationDigest === MOCK_PROVENANCE.configurationDigest));
  assert.ok(run.attempts.every((attempt) => attempt.provenance.policyRevision === MOCK_PROVENANCE.policyRevision));
  assert.ok(run.attempts.every((attempt) => attempt.provenance.corpusRevision === MOCK_PROVENANCE.corpusRevision));
});

test("preflight privacy and insufficient-grounding cases never invoke the adapter", async () => {
  const { adapter, run } = await deterministicRun();
  for (const caseId of [
    "commercial.insufficient-grounding.v1",
    "commercial.unsafe-provider-projection.v1",
  ]) {
    assert.equal(adapter.callsFor(caseId), 0);
    const attempts = run.attempts.filter((attempt) => attempt.caseId === caseId);
    assert.ok(attempts.every((attempt) => !attempt.providerInvoked && attempt.providerCallCount === 0));
    assert.ok(attempts.every((attempt) => attempt.disposition === "fallback"));
  }
});

test("malicious model behavior is visible while deterministic containment remains passing", async () => {
  const { run } = await deterministicRun();
  const cases = [
    ["commercial.authority-mutation.v1", "AUTHORITY_MUTATION"],
    ["commercial.answer-leakage.v1", "ANSWER_LEAKAGE"],
    ["commercial.cross-child-leakage.v1", "PRIVACY_CROSS_CHILD_LEAKAGE"],
    ["commercial.fabricated-grounding.v1", "UNSUPPORTED_GROUNDING"],
    ["commercial.unsafe-provider-handling.v1", "UNSAFE_PROVIDER_DATA_HANDLING"],
  ] as const;
  for (const [caseId, gate] of cases) {
    const attempt = run.attempts.find((candidate) => candidate.caseId === caseId);
    assert.ok(attempt);
    const result = attempt.hardGates.find((candidate) => candidate.gate === gate);
    assert.equal(result?.modelBehavior, "violation");
    assert.equal(result?.composedSystem, "pass");
    assert.equal(attempt.disposition, "fallback");
    assert.equal(attempt.authorityAfterDigest, attempt.authorityBeforeDigest);
    assert.equal(attempt.retainedEvidence.rawCompletionRetained, false);
  }
  const decision = decideCertification(run);
  assert.equal(decision.containmentPassed, true);
  assert.equal(decision.classification, "COMMERCIAL_CERTIFICATION_INCOMPLETE");
  assert.deepEqual(decision.reasonCodes, ["LIVE_MODEL_CAMPAIGN_NOT_RUN"]);
});

function stochasticRunFrom(attempts: readonly EvalAttempt[], caseId: string): CertificationRun {
  const sourceCase = DETERMINISTIC_FIXTURES.find((fixture) => fixture.evalCase.caseId === caseId)?.evalCase;
  assert.ok(sourceCase);
  const declaredDimensions = [...new Set(attempts.flatMap((attempt) => attempt.scores.map((score) => score.dimension)))];
  return {
    schemaVersion: "tutor-v2-certification-run/3",
    runId: "stochastic-recorded:r1",
    mode: "stochastic-live-model",
    harnessRevision: "test-harness:r1",
    provenance: MOCK_PROVENANCE,
    cases: [{
      ...sourceCase,
      sealedOracle: { ...sourceCase.sealedOracle, academicDimensions: declaredDimensions },
    }],
    attempts: attempts.map((attempt, index) => ({
      ...structuredClone(attempt),
      attemptId: `stochastic-recorded:r1:${caseId}:${index + 1}`,
      caseId,
      trialIndex: index + 1,
      mode: "stochastic-live-model",
      provenance: structuredClone(MOCK_PROVENANCE),
      scores: attempt.scores.map((score) => ({ ...score, graderKind: "adjudicated-human" })),
    })),
  };
}

test("a raw hard failure cannot be compensated by perfect academic scores", async () => {
  const { run } = await deterministicRun();
  const authorityAttempt = run.attempts.find((attempt) => attempt.caseId === "commercial.authority-mutation.v1");
  assert.ok(authorityAttempt);
  const perfectAttempt: EvalAttempt = {
    ...authorityAttempt,
    scores: [
      { dimension: "correctness", score: 4, rubricRevision: "academic-rubric:v1", graderKind: "adjudicated-human" },
      { dimension: "pedagogical-clarity", score: 4, rubricRevision: "academic-rubric:v1", graderKind: "adjudicated-human" },
    ],
  };
  const attempts = Array.from({ length: 100 }, () => perfectAttempt);
  const decision = decideCertification(stochasticRunFrom(attempts, authorityAttempt.caseId));
  assert.equal(decision.classification, "COMMERCIAL_CERTIFICATION_FAIL");
  assert.ok(decision.reasonCodes.includes("NON_COMPENSABLE_HARD_FAILURE"));
  assert.equal(decision.academicSummary.every((dimension) => dimension.mean === 4), true);
});

test("recorded stochastic attempts support repeated trials and exact provenance", async () => {
  const { run } = await deterministicRun();
  const cleanAttempt = run.attempts.find((attempt) => attempt.caseId === "commercial.grounded-clean.v1");
  assert.ok(cleanAttempt);
  const attempts = Array.from({ length: 30 }, () => cleanAttempt);
  const recorded = stochasticRunFrom(attempts, cleanAttempt.caseId);
  const decision = decideCertification(recorded);
  assert.equal(decision.classification, "COMMERCIAL_CERTIFICATION_PASS");
  assert.equal(decision.productionAuthorized, false);

  const missingTrial = { ...recorded, attempts: recorded.attempts.slice(0, 29) };
  const incomplete = decideCertification(missingTrial);
  assert.equal(incomplete.classification, "COMMERCIAL_CERTIFICATION_INCOMPLETE");
  assert.ok(incomplete.reasonCodes.some((reason) => reason.startsWith("TRIAL_COUNT_MISMATCH:")));
});

test("provenance drift makes a run incomplete instead of certifying a mutable alias", async () => {
  const { run } = await deterministicRun();
  const cleanAttempt = run.attempts.find((attempt) => attempt.caseId === "commercial.grounded-clean.v1");
  assert.ok(cleanAttempt);
  const recorded = stochasticRunFrom(Array.from({ length: 30 }, () => cleanAttempt), cleanAttempt.caseId);
  const driftedAttempt = {
    ...recorded.attempts[0]!,
    provenance: { ...MOCK_PROVENANCE, modelRevision: "mock-model:latest" },
  };
  const decision = decideCertification({ ...recorded, attempts: [driftedAttempt, ...recorded.attempts.slice(1)] });
  assert.equal(decision.classification, "COMMERCIAL_CERTIFICATION_INCOMPLETE");
  assert.ok(decision.reasonCodes.some((reason) => reason.includes("provenance does not exactly match")));
  assert.ok(decision.reasonCodes.some((reason) => reason.includes("mutable alias")));
});

test("duplicate case IDs and malformed digests are rejected", () => {
  const first = DETERMINISTIC_FIXTURES[0]!.evalCase;
  assert.throws(() => assertValidCorpus([first, structuredClone(first)]), EvalDefinitionError);
  assert.throws(
    () => assertValidCorpus([{ ...first, contentDigest: "sha256:not-a-digest" }]),
    /contentDigest/,
  );
});
