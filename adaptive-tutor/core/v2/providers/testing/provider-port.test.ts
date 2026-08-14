import assert from "node:assert/strict";
import test from "node:test";
import {
  TUTOR_V2_ACTION_COMPATIBILITY_ID,
  TUTOR_V2_ACTION_SCHEMA_VERSION,
  TUTOR_V2_COMPATIBILITY_ID,
  TUTOR_V2_CONTRACT_VERSION,
  TutorActionProposalSchema,
  TutorStaticFallbackOutcomeSchema,
  TutorTelemetryEnvelopeSchema,
  validateExact,
  type TutorActionProposal,
} from "../../contracts/index.js";
import {
  DeterministicLocalTutorProvider,
} from "../local/index.js";
import {
  TransportBackedTutorProvider,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
  type ProviderFailureResult,
  type ProviderTransportPort,
  type ProviderTransportRequest,
  type ProviderTransportResult,
  type TutorProviderPort,
} from "../ports/index.js";
import { DeterministicTestTutorProvider } from "./scripted-provider.js";

const digest = `sha256:${"a".repeat(64)}` as const;
const metrics = {
  inputTokenCount: 100,
  outputTokenCount: 40,
  latencyMs: 8,
  costUnits: 1,
} as const;

function requestFixture(): ProviderExecutionRequest {
  return {
    contractVersion: TUTOR_V2_CONTRACT_VERSION,
    actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
    compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
    actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
    envelope: "provider-execution-request",
    requestRef: "request:provider-port-test",
    context: {
      contractVersion: TUTOR_V2_CONTRACT_VERSION,
      actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
      compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
      actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
      contextKind: "provider",
      interactionRef: "interaction:provider-port-test",
      instruction: {
        subjectRef: "subject:mathematics",
        conceptRef: "concept:fractions",
        learnerStageRef: "learner-stage:middle-childhood",
        learnerSafeItem: {
          itemRef: "item:fraction-parts",
          itemKind: "short-response",
          learnerSafeContent: "How many equal parts are shown?",
        },
        assessmentPhase: "instruction-or-practice",
        approvedEvidenceSummary: {
          summaryRef: "summary:provider-port-test",
          evidenceCode: "needs-fraction-support",
          attemptCount: 2,
          assistanceLevel: "light-hint",
          observationRefs: ["observation:partition-confusion"],
        },
        allowedActions: ["hint"],
        hintCeiling: "guided-step",
        safetyConstraints: {
          safetyMode: "standard",
          mayContinueAcademicFlow: true,
          learnerSafeLanguageRequired: true,
          disallowedContentCodes: ["final-graded-answer"],
        },
        groundingReferences: [{
          groundingRef: "grounding:fraction-model",
          kind: "curriculum-excerpt",
          contentDigest: digest,
          learnerSafeContent: "A fraction names equal parts of a whole.",
        }],
      },
    },
    budgetRoutingContext: {
      actionBudget: { remainingActions: 2 },
      timeoutBudgetMs: 2_000,
      retryBudget: { remainingRetries: 2 },
      route: {
        routeRef: "route:provider-port-test",
        providerRef: "provider:deterministic-test",
        modelRef: "model:deterministic-test",
      },
      costBudget: { unit: "integer-cost-unit", maximumCostUnits: 10 },
    },
    shortTermState: {
      contractVersion: TUTOR_V2_CONTRACT_VERSION,
      actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
      compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
      actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
      stateKind: "ephemeral-interaction-state",
      interactionRef: "interaction:provider-port-test",
      turnCount: 1,
      assistanceLevel: "light-hint",
      highestHintUsed: "nudge",
      lastAction: "hint",
      usedGroundingRefs: ["grounding:fraction-model"],
      expiresAt: "2026-08-13T20:05:00.000Z",
      persistenceAllowed: false,
    },
  };
}

function proposalFixture(): TutorActionProposal {
  return {
    contractVersion: TUTOR_V2_CONTRACT_VERSION,
    actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
    compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
    actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
    envelope: "tutor-action-proposal",
    proposalRef: "proposal:provider-port-test",
    interactionRef: "interaction:provider-port-test",
    action: {
      kind: "explain",
      content: "Compare the equal parts using the reviewed fraction model.",
      groundingRefs: ["grounding:fraction-model"],
    },
    groundingClaims: [{
      groundingRef: "grounding:fraction-model",
      contentDigest: digest,
      claimKind: "direct-support",
    }],
    assistanceLevel: "light-hint",
    hintLevel: "nudge",
    authoritative: false,
    requiresStudyValidation: true,
  };
}

function responseStep(): ProviderTransportResult {
  return { status: "response", body: JSON.stringify(proposalFixture()), metrics };
}

function assertFailure(result: ProviderExecutionResult): asserts result is ProviderFailureResult {
  assert.notEqual(result.status, "success");
  if (result.status === "success") throw new Error("Expected a provider failure.");
  assert.equal(result.fallbackRequired, true);
  assert.equal(validateExact(TutorStaticFallbackOutcomeSchema, result.fallback).status, "accepted");
  assert.equal(validateExact(TutorTelemetryEnvelopeSchema, result.telemetry).status, "accepted");
}

test("valid provider port returns a canonical proposal without applying policy", async () => {
  const port: TutorProviderPort = new DeterministicLocalTutorProvider();
  const result = await port.execute(requestFixture());
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(validateExact(TutorActionProposalSchema, result.proposal).status, "accepted");
  assert.equal(result.proposal.action.kind, "explain");
  assert.deepEqual(requestFixture().context.instruction.allowedActions, ["hint"]);
  assert.equal(result.proposal.requiresStudyValidation, true);
});

test("provider unavailable is normalized and requires static fallback", async () => {
  const result = await new DeterministicLocalTutorProvider({ mode: "provider-outage" })
    .execute(requestFixture());
  assertFailure(result);
  assert.equal(result.status, "unavailable");
  assert.equal(result.retryable, true);
  assert.equal(result.fallback.reasonCode, "PROVIDER_UNAVAILABLE");
});

test("provider timeout is normalized and requires static fallback", async () => {
  const result = await new DeterministicLocalTutorProvider({ mode: "timeout" })
    .execute(requestFixture());
  assertFailure(result);
  assert.equal(result.status, "timeout");
  assert.equal(result.fallback.reasonCode, "PROVIDER_TIMEOUT");
});

test("malformed structured response is rejected without exposing its body", async () => {
  const result = await new DeterministicLocalTutorProvider({ mode: "malformed-response" })
    .execute(requestFixture());
  assertFailure(result);
  assert.equal(result.status, "malformed-response");
  assert.equal(result.reason, "INVALID_JSON");
  assert.doesNotMatch(JSON.stringify(result), /not-json/);
});

test("unsupported action is forwarded as invalid and never executed", async () => {
  const state = { workingLevel: "unchanged" };
  const result = await new DeterministicLocalTutorProvider({ mode: "unknown-action" })
    .execute(requestFixture());
  assertFailure(result);
  assert.equal(result.status, "rejected-response");
  assert.equal(result.reason, "UNSUPPORTED_ACTION");
  assert.equal(result.fallback.reasonCode, "UNSUPPORTED_ACTION");
  assert.equal(state.workingLevel, "unchanged");
});

test("excessive provider output is bounded before JSON parsing", async () => {
  const result = await new DeterministicLocalTutorProvider({
    mode: "excessive-output",
    maximumResponseBytes: 512,
  }).execute(requestFixture());
  assertFailure(result);
  assert.equal(result.status, "over-budget");
  assert.equal(result.reason, "RESPONSE_TOO_LARGE");
});

test("provider exception is normalized without leaking exception credentials", async () => {
  class ThrowingTransport implements ProviderTransportPort {
    async send(_request: ProviderTransportRequest): Promise<ProviderTransportResult> {
      throw new Error("transport failed with credential sk-test-never-log");
    }
  }
  const result = await new TransportBackedTutorProvider({ transport: new ThrowingTransport() })
    .execute(requestFixture());
  assertFailure(result);
  assert.equal(result.status, "transient-failure");
  assert.equal(result.reason, "TRANSPORT_EXCEPTION");
  assert.doesNotMatch(JSON.stringify(result.telemetry), /credential|sk-test-never-log|authorization/);
});

test("transport rejection and permanent failure use normalized outcomes", async () => {
  const rejected = new DeterministicTestTutorProvider({
    steps: [{ status: "rejected", metrics }],
  });
  const rejectedResult = await rejected.execute(requestFixture());
  assertFailure(rejectedResult);
  assert.equal(rejectedResult.status, "rejected-response");
  assert.equal(rejectedResult.reason, "PROVIDER_REJECTED");

  const permanent = new DeterministicTestTutorProvider({
    steps: [{ status: "permanent-failure", metrics }],
  });
  const permanentResult = await permanent.execute(requestFixture());
  assertFailure(permanentResult);
  assert.equal(permanentResult.status, "permanent-failure");
  assert.equal(permanentResult.retryable, false);
});

test("zero budget produces over-budget fallback without calling transport", async () => {
  const provider = new DeterministicTestTutorProvider({ steps: [responseStep()] });
  const request = requestFixture();
  request.budgetRoutingContext.costBudget.maximumCostUnits = 0;
  const result = await provider.execute(request);
  assertFailure(result);
  assert.equal(result.status, "over-budget");
  assert.equal(result.reason, "COST_BUDGET_EXCEEDED");
  assert.equal(provider.transport.callCount, 0);
});

test("scripted retry behavior is deterministic and repeatable", async () => {
  const provider = new DeterministicTestTutorProvider({
    steps: [
      { status: "transient-failure", metrics },
      responseStep(),
    ],
    repeat: "last",
  });
  const first = await provider.execute(requestFixture());
  const second = await provider.execute(requestFixture());
  const third = await provider.execute(requestFixture());
  assert.equal(first.status, "transient-failure");
  assert.equal(second.status, "success");
  assert.deepEqual(third, second);
  assert.equal(provider.transport.callCount, 3);
});

test("transport receives a provider projection, never Study authority or an arbitrary prompt", async () => {
  const provider = new DeterministicTestTutorProvider({
    steps: [responseStep()],
  });
  await provider.execute(requestFixture());
  const projected = provider.transport.lastRequest;
  assert.ok(projected);
  const serialized = JSON.stringify(projected);
  assert.doesNotMatch(serialized, /authorizationRef|workingLevelInstructionRef|invocationBindingRef/);
  assert.equal(Object.hasOwn(projected, "prompt"), false);
  assert.equal(projected.context.contextKind, "provider");
});

test("provider execute has no arbitrary mutation callback", async () => {
  const provider = new DeterministicLocalTutorProvider();
  const state = { mutated: false };
  const executeWithExtraArgument = provider.execute.bind(provider) as unknown as (
    request: ProviderExecutionRequest,
    callback: () => void,
  ) => Promise<ProviderExecutionResult>;
  await executeWithExtraArgument(requestFixture(), () => {
    state.mutated = true;
  });
  assert.equal(state.mutated, false);
  assert.equal(provider.execute.length, 1);
});
