import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TutorV2 } from "../../core/index.js";
import {
  TUTOR_ACTION_KINDS,
  type TutorRequest,
} from "../../core/v2/contracts/index.js";
import {
  TransportBackedTutorProvider,
  type ProviderTransportRequest,
  type ProviderTransportResult,
} from "../../core/v2/providers/ports/index.js";
import { FOUNDATION_SCENARIOS } from "../../evals/v2/corpus/foundation/index.js";
import {
  runFoundationEvaluation,
  type TutorEvalScenario,
  type TutorResponseFixture,
} from "../../evals/v2/framework/src/index.js";
import * as StudyTutorV2 from "../../study-engine/tutor-v2/index.js";
import {
  orchestrateTutorV2Bridge,
  type TutorV2BridgeResult,
} from "../../study-engine/bridges/tutor-v2/index.js";
import {
  validateTutorEvidenceForPersistence,
} from "../../study-engine/tutor-v2/evidence/index.js";
import {
  DIGEST,
  OTHER_DIGEST,
  failureResult,
  harness,
  proposalFixture,
  providerExecutionRequestFixture,
  successResult,
} from "./fixtures.js";

function requestOf(input: { request: unknown }): TutorRequest {
  return input.request as TutorRequest;
}

function assertFallback(result: TutorV2BridgeResult, reason: string): void {
  assert.equal(result.status, "fallback");
  if (result.status === "fallback") {
    assert.equal(result.reasonCode, reason);
    assert.equal(result.studyMutationAllowed, false);
  }
}

test("shared Core V2 namespace exposes the canonical contracts without replacing v0.2", () => {
  assert.deepEqual(TutorV2.TUTOR_ACTION_KINDS, TUTOR_ACTION_KINDS);
  assert.equal(typeof TutorV2.validateExact, "function");
});

test("Study shared barrel exposes minimized boundaries but no alternate orchestration route", () => {
  assert.equal(typeof StudyTutorV2.projectTutorEvidence, "function");
  assert.equal(typeof StudyTutorV2.minimizeProviderContext, "function");
  assert.equal(Object.hasOwn(StudyTutorV2, "orchestrateTutorV2Bridge"), false);
});

test("W1-08 remains the only orchestration function definition", () => {
  const source = readFileSync("study-engine/bridges/tutor-v2/orchestrator.ts", "utf8");
  assert.equal((source.match(/export async function orchestrateTutorV2Bridge/g) ?? []).length, 1);
  assert.doesNotMatch(readFileSync("core/v2/index.ts", "utf8"), /orchestrateTutorV2Bridge/);
  assert.doesNotMatch(readFileSync("study-engine/tutor-v2/index.ts", "utf8"), /export\s*\{[^}]*orchestrateTutorV2Bridge/s);
});

test("all nine contract actions cross provider policy and bridge as non-authoritative proposals", async () => {
  for (const kind of TUTOR_ACTION_KINDS) {
    const h = harness([successResult(proposalFixture(kind))]);
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assert.equal(result.status, "accepted", kind);
    if (result.status === "accepted") {
      assert.equal(result.proposal.action.kind, kind);
      assert.equal(result.proposal.authoritative, false);
      assert.equal(result.proposal.requiresStudyValidation, true);
      assert.equal(result.studyMutationAllowed, false);
    }
  }
});

test("provider port receives only canonical provider-safe context and state", async () => {
  let captured: ProviderTransportRequest | null = null;
  const provider = new TransportBackedTutorProvider({
    transport: {
      async send(request): Promise<ProviderTransportResult> {
        captured = structuredClone(request);
        return {
          status: "response",
          body: JSON.stringify(proposalFixture()),
          metrics: { inputTokenCount: 12, outputTokenCount: 8, latencyMs: 3, costUnits: 1 },
        };
      },
    },
  });
  assert.equal((await provider.execute(providerExecutionRequestFixture())).status, "success");
  assert.notEqual(captured, null);
  const serialized = JSON.stringify(captured);
  for (const forbidden of ["authorizationRef", "answerPolicyRef", "workingLevelInstructionRef", "rawTranscript", "studentId"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("age policy can reject output without acquiring Study mutation authority", async () => {
  const h = harness();
  Object.assign(h.dependencies.ageTurnInspector, { inspect: () => ({
    introducedConceptRefs: [], estimatedTutorWordCount: 999, plannedStepCount: 1,
    abstractionLevel: "conceptual", stepGranularity: "small-step",
    turnsSinceComprehensionCheck: 0, includesComprehensionCheck: false,
    includesConcreteExample: false, independentReasoningExpectation: "mixed",
    socraticQuestioningLevel: "moderate", vocabularyComplexity: "academic",
    explanationDensity: "moderate", hintEscalationsSinceRecheck: 0,
  }) });
  const snapshot = structuredClone(h.input);
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.deepEqual(h.input, snapshot);
});

test("accepted bridge evidence is persistence-compatible and minimized", async () => {
  const h = harness();
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(validateTutorEvidenceForPersistence(result.evidence).status, "accepted");
  assert.equal(JSON.stringify(result.evidence).includes("Equal parts make"), false);
});

test("raw Tutor content cannot be appended to durable evidence", async () => {
  const h = harness();
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(validateTutorEvidenceForPersistence({ ...result.evidence, rawTutorTranscript: "private" }).status, "rejected");
});

test("unknown action cannot cross provider to Study", async () => {
  const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
  proposal.action = { kind: "change-grade", grade: 12 };
  const h = harness([successResult(proposal)]);
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "MALFORMED_RESPONSE");
});

test("grounding references and digests remain bound through the full path", async () => {
  const valid = harness();
  const accepted = await orchestrateTutorV2Bridge(valid.input, valid.dependencies);
  assert.equal(accepted.status, "accepted");
  if (accepted.status === "accepted") assert.deepEqual(accepted.evidence.groundingReferenceIds, ["grounding:fraction-model"]);

  const proposal = proposalFixture();
  proposal.groundingClaims = [{ groundingRef: "grounding:fraction-model", contentDigest: OTHER_DIGEST, claimKind: "direct-support" }];
  const invalid = harness([successResult(proposal)]);
  assertFallback(await orchestrateTutorV2Bridge(invalid.input, invalid.dependencies), "INSUFFICIENT_GROUNDED_CONTEXT");
});

test("active assessment answer-bearing output cannot cross the full path", async () => {
  const proposal = proposalFixture();
  Object.assign(proposal.action, { content: "The correct answer is 4." });
  const h = harness([successResult(proposal)]);
  requestOf(h.input).studyAuthorityContext.instructionContext.assessmentPhase = "active-graded-or-mastery-check";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
});

for (const [name, contamination] of [
  ["official grade", { officialGrade: 9 }],
  ["official working level", { officialWorkingLevel: "grade-9" }],
  ["mastery", { declareMastery: true }],
  ["guardian certification", { certifyGuardianWork: true }],
  ["safety clear", { clearSafetyHold: true }],
] as const) {
  test(`${name} mutation cannot cross the full path`, async () => {
    const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
    Object.assign(proposal.action as Record<string, unknown>, contamination);
    const h = harness([successResult(proposal)]);
    assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  });
}

for (const [name, result, reason] of [
  ["timeout", failureResult("timeout", "PROVIDER_TIMEOUT"), "PROVIDER_TIMEOUT"],
  ["unavailable", failureResult("unavailable", "PROVIDER_OUTAGE"), "PROVIDER_UNAVAILABLE"],
  ["malformed", { status: "success", proposal: null }, "MALFORMED_RESPONSE"],
] as const) {
  test(`provider ${name} reaches deterministic static fallback`, async () => {
    const h = harness([result]);
    const first = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(first, reason);
    if (first.status === "fallback") {
      assert.equal(first.fallbackRef, "fallback:reviewed-static-curriculum");
      assert.equal(first.fallback?.action.kind, "return-to-lesson");
    }
  });
}

test("insufficient grounding reaches Study-reviewed static fallback", async () => {
  const proposal = proposalFixture();
  proposal.groundingClaims = [];
  const h = harness([successResult(proposal)]);
  let reviews = 0;
  Object.assign(h.dependencies.staticFallback, { validate: () => { reviews += 1; return { status: "accepted" as const }; } });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result, "INSUFFICIENT_GROUNDED_CONTEXT");
  assert.equal(reviews, 1);
  if (result.status === "fallback") assert.equal(result.fallback?.proposalRef, "proposal:reviewed-static-fallback");
});

test("identical replay cannot duplicate Study-facing evidence", async () => {
  const h = harness([successResult(proposalFixture()), successResult(proposalFixture())]);
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  const replay = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(replay.status, "duplicate-ignored");
  if (replay.status === "duplicate-ignored") {
    assert.equal(replay.evidenceReturned, false);
    assert.equal(replay.proposalReturned, false);
  }
  assert.equal(h.ledger.entries.size, 1);
});

test("conflicting event identity is quarantined", async () => {
  const h = harness([successResult(proposalFixture("explain")), successResult(proposalFixture("hint"))]);
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  const conflict = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(conflict.status, "quarantined");
  if (conflict.status === "quarantined") assert.equal(conflict.reasonCode, "EVENT_ID_COLLISION");
});

test("cross-session memory is rejected before provider execution", async () => {
  const h = harness();
  h.input.memoryAccess.scope.sessionRef = "session:other";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(h.provider.callCount, 0);
});

test("cross-learner memory is rejected before provider execution", async () => {
  const h = harness();
  h.input.memoryAccess.scope.learnerScopeRef = "learner-scope:other";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(h.provider.callCount, 0);
});

test("forbidden provider context fails before provider execution", async () => {
  const h = harness();
  const item = requestOf(h.input).studyAuthorityContext.instructionContext.learnerSafeItem;
  assert.notEqual(item, null);
  if (item !== null) item.learnerSafeContent = "Parent PIN: 1234";
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(h.provider.callCount, 0);
});

test("raw transcript cannot become a provider result or durable evidence", async () => {
  const contaminated = { ...proposalFixture(), rawTranscript: [{ role: "learner", content: "private" }] };
  const h = harness([successResult(contaminated)]);
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result, "MALFORMED_RESPONSE");
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("provider telemetry remains exact and minimized", async () => {
  const provider = new TransportBackedTutorProvider({
    transport: { send: async (): Promise<ProviderTransportResult> => ({
      status: "response", body: JSON.stringify(proposalFixture()),
      metrics: { inputTokenCount: 12, outputTokenCount: 8, latencyMs: 3, costUnits: 1 },
    }) },
  });
  const result = await provider.execute(providerExecutionRequestFixture());
  assert.deepEqual(Object.keys(result.telemetry).sort(), [
    "action", "actionCompatibilityId", "actionSchemaVersion", "compatibilityId",
    "contractVersion", "costUnits", "inputTokenCount", "interactionRef", "latencyMs",
    "modelRef", "outcomeCode", "outputTokenCount", "providerRef", "telemetryKind",
  ].sort());
  assert.equal(JSON.stringify(result.telemetry).includes("content"), false);
});

test("hard evaluation failure cannot be hidden by perfect soft scores", () => {
  const clean = FOUNDATION_SCENARIOS.find((scenario) => scenario.primaryCategory === "clean-instruction");
  assert.notEqual(clean, undefined);
  if (clean === undefined || clean.providerResult.kind !== "response") return;
  const payload = clean.providerResult.payload as TutorResponseFixture;
  const contaminated: TutorEvalScenario = {
    ...structuredClone(clean),
    providerResult: {
      kind: "response",
      payload: {
        ...structuredClone(payload),
        authorityEffects: [{ kind: "set-grade", value: 12 }],
        softSignals: {
          correctness: 4,
          curriculum_consistency: 4,
          helpfulness: 4,
          age_appropriateness: 4,
          misconception_handling: 4,
          hint_progression: 4,
          excessive_verbosity: 0,
          escalation_quality: 4,
        },
      },
    },
  };
  const report = runFoundationEvaluation([contaminated]);
  assert.equal(report.classification, "FOUNDATION_GATE_FAIL");
  assert.equal(report.failed, 1);
  assert.equal(report.releaseReady, false);
});

test("canonical digest fixture is a closed SHA-256 reference", () => {
  assert.match(DIGEST, /^sha256:[a-f0-9]{64}$/);
});
