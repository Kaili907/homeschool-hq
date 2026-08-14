import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TUTOR_ACTION_KINDS,
  TUTOR_V2_ACTION_COMPATIBILITY_ID,
  TUTOR_V2_ACTION_SCHEMA_VERSION,
  TUTOR_V2_COMPATIBILITY_ID,
  TUTOR_V2_CONTRACT_VERSION,
  type TutorActionKind,
  type TutorActionProposal,
  type TutorRequest,
} from "../../../core/v2/contracts/index.js";
import {
  TutorSessionMemoryStore,
  type TutorMemoryScope,
} from "../../../core/v2/memory/index.js";
import {
  createApprovedAgePolicyRegistry,
  type AgeAwareTutorPolicyProfile,
  type TutorTurnPolicyPlan,
} from "../../../core/v2/policy/age/index.js";
import {
  TransportBackedTutorProvider,
  type ProviderExecutionResult,
  type ProviderTransportPort,
  type ProviderTransportRequest,
  type ProviderTransportResult,
  type TutorProviderPort,
} from "../../../core/v2/providers/ports/index.js";
import {
  TUTOR_V2_BRIDGE_VERSION,
  orchestrateTutorV2Bridge,
  type TutorV2BridgeDependencies,
  type TutorV2BridgeInvocation,
  type TutorV2BridgeResult,
} from "../../bridges/tutor-v2/index.js";

const NOW = Date.parse("2026-08-13T20:01:00.000Z");
const DIGEST = `sha256:${"a".repeat(64)}` as const;
const OTHER_DIGEST = `sha256:${"b".repeat(64)}` as const;
const VERSION = {
  contractVersion: TUTOR_V2_CONTRACT_VERSION,
  actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
  compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
  actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
} as const;

const BASE_SCOPE: TutorMemoryScope = {
  scopeKind: "trusted-study-tutor-scope",
  householdScopeRef: "household-scope:opaque-a",
  learnerScopeRef: "learner-scope:opaque-a",
  sessionRef: "session:math-a",
  interactionRef: "interaction:tutor-a",
  lessonRef: "lesson:fraction-a",
};

const BASE_PROFILE: AgeAwareTutorPolicyProfile = {
  profileKind: "approved-learning-stage-policy",
  policyProfileRef: "age-policy:middle-childhood",
  learningStageRef: "learner-stage:middle-childhood",
  approvalRef: "approval:age-middle-childhood",
  approvalKind: "study-approved",
  dimensions: {
    maximumConceptsIntroducedPerTurn: 3,
    recommendedTurnLengthWords: { minimumWords: 1, maximumWords: 240 },
    maximumStepsPerTurn: 8,
    abstractionLevel: "conceptual",
    stepGranularity: "multi-step",
    comprehensionCheckFrequencyTurns: 6,
    concreteExamplePreference: "preferred",
    independentReasoningExpectation: "mixed",
    socraticQuestioningLevel: "moderate",
    vocabularyComplexity: "academic",
    allowableExplanationDensity: "moderate",
    maximumHintEscalationsBeforeRecheck: 3,
  },
};

function requestFixture(): TutorRequest {
  return {
    ...VERSION,
    envelope: "tutor-request",
    requestRef: "request:tutor-a",
    requestIntent: "propose-next-teaching-action",
    studyAuthorityContext: {
      ...VERSION,
      contextKind: "study-authority",
      interactionRef: BASE_SCOPE.interactionRef,
      invocationBindingRef: "invocation:tutor-a",
      authorizationRef: "authorization:tutor-a",
      authorizationRevision: 2,
      safetyClearanceRef: "safety:tutor-a",
      policyRefs: {
        authorityPolicyRef: "policy:authority-v1",
        assessmentPolicyRef: "policy:assessment-v1",
        answerPolicyRef: "policy:answer-v1",
        safetyPolicyRef: "policy:safety-v1",
        privacyPolicyRef: "policy:privacy-v1",
      },
      instructionContext: {
        contextKind: "tutor-instruction",
        subjectRef: "subject:mathematics",
        conceptRef: "concept:fractions",
        workingLevelInstructionRef: "working-level:fraction-foundations",
        learnerStageRef: BASE_PROFILE.learningStageRef,
        learnerSafeItem: {
          itemRef: "item:fraction-parts",
          itemKind: "short-response",
          learnerSafeContent: "How many equal parts are shown?",
        },
        assessmentPhase: "instruction-or-practice",
        approvedEvidenceSummary: {
          summaryRef: "summary:tutor-a",
          evidenceCode: "needs-fraction-support",
          attemptCount: 2,
          assistanceLevel: "light-hint",
          observationRefs: ["observation:partition-confusion"],
        },
        allowedActions: [...TUTOR_ACTION_KINDS],
        hintCeiling: "guided-step",
        safetyConstraints: {
          safetyMode: "standard",
          mayContinueAcademicFlow: true,
          learnerSafeLanguageRequired: true,
          disallowedContentCodes: ["final-graded-answer"],
        },
        groundingReferences: [
          {
            groundingRef: "grounding:fraction-model",
            kind: "curriculum-excerpt",
            contentDigest: DIGEST,
            learnerSafeContent: "A fraction names equal parts of a whole.",
          },
          {
            groundingRef: "grounding:reviewed-fallback",
            kind: "static-fallback",
            contentDigest: OTHER_DIGEST,
            learnerSafeContent: "Return to the reviewed lesson explanation.",
          },
        ],
      },
      issuedAt: "2026-08-13T20:00:00.000Z",
      expiresAt: "2026-08-13T20:06:00.000Z",
    },
    budgetRoutingContext: {
      actionBudget: { remainingActions: 3 },
      timeoutBudgetMs: 2_000,
      retryBudget: { remainingRetries: 2 },
      route: {
        routeRef: "route:tutor-a",
        providerRef: "provider:test",
        modelRef: "model:test",
      },
      costBudget: { unit: "integer-cost-unit", maximumCostUnits: 10 },
    },
    shortTermState: {
      ...VERSION,
      stateKind: "ephemeral-interaction-state",
      interactionRef: BASE_SCOPE.interactionRef,
      turnCount: 0,
      assistanceLevel: "independent",
      highestHintUsed: "none",
      lastAction: null,
      usedGroundingRefs: [],
      expiresAt: "2026-08-13T20:06:00.000Z",
      persistenceAllowed: false,
    },
  };
}

function actionFor(kind: TutorActionKind): TutorActionProposal["action"] {
  const groundingRefs = ["grounding:fraction-model"];
  switch (kind) {
    case "explain":
      return { kind, content: "Equal parts make a fraction model.", groundingRefs };
    case "hint":
      return { kind, content: "Count the equal parts first.", hintLevel: "nudge", groundingRefs };
    case "ask-check":
      return { kind, question: "What should you count first?", checkKind: "next-step", groundingRefs };
    case "show-example":
      return {
        kind,
        content: "Here is a different equal-parts model.",
        exampleRef: "grounding:fraction-model",
        groundingRefs,
        nonIsomorphicToActiveItem: true,
      };
    case "reteach":
      return { kind, content: "Let us rebuild the equal-parts idea.", conceptRef: "concept:fractions", groundingRefs };
    case "check-prerequisite":
      return { kind, prerequisiteConceptRef: "concept:fractions", reasonCode: "review-equal-parts", groundingRefs };
    case "suggest-break":
      return { kind, reasonCode: "study-break-suggested", proposedDurationMinutes: 5 };
    case "escalate":
      return { kind, reasonCode: "adult-review-suggested", escalationTarget: "study-adult-review-policy", claimsDelivery: false };
    case "return-to-lesson":
      return { kind, reasonCode: "continue-reviewed-lesson", resumeTarget: "study-selected-position" };
  }
}

function proposalFixture(
  kind: TutorActionKind = "explain",
  overrides: Record<string, unknown> = {},
): TutorActionProposal {
  const grounded = ["explain", "hint", "ask-check", "show-example", "reteach", "check-prerequisite"].includes(kind);
  return {
    ...VERSION,
    envelope: "tutor-action-proposal",
    proposalRef: `proposal:${kind}`,
    interactionRef: BASE_SCOPE.interactionRef,
    action: actionFor(kind),
    groundingClaims: grounded
      ? [{ groundingRef: "grounding:fraction-model", contentDigest: DIGEST, claimKind: "direct-support" }]
      : [],
    assistanceLevel: kind === "reteach" ? "reteach-required" : kind === "hint" ? "light-hint" : "independent",
    hintLevel: kind === "hint" ? "nudge" : "none",
    authoritative: false,
    requiresStudyValidation: true,
    ...overrides,
  } as TutorActionProposal;
}

function fallbackProposal(): TutorActionProposal {
  return {
    ...VERSION,
    envelope: "tutor-action-proposal",
    proposalRef: "proposal:reviewed-static-fallback",
    interactionRef: BASE_SCOPE.interactionRef,
    action: {
      kind: "return-to-lesson",
      reasonCode: "reviewed-static-fallback",
      resumeTarget: "study-selected-position",
    },
    groundingClaims: [],
    assistanceLevel: "independent",
    hintLevel: "none",
    authoritative: false,
    requiresStudyValidation: true,
  };
}

function invocationFixture(): TutorV2BridgeInvocation {
  return {
    bridgeVersion: TUTOR_V2_BRIDGE_VERSION,
    request: requestFixture(),
    invocationPermission: {
      permissionKind: "study-issued-tutor-invocation",
      permitRef: "permit:tutor-a",
      invocationBindingRef: "invocation:tutor-a",
      authorizationRef: "authorization:tutor-a",
      authorizationRevision: 2,
      allowedActions: [...TUTOR_ACTION_KINDS],
      issuedAt: "2026-08-13T20:00:00.000Z",
      expiresAt: "2026-08-13T20:06:00.000Z",
    },
    agePolicyBinding: {
      bindingKind: "trusted-study-age-policy-binding",
      policyProfileRef: BASE_PROFILE.policyProfileRef,
      learningStageRef: BASE_PROFILE.learningStageRef,
      approvalRef: BASE_PROFILE.approvalRef,
    },
    memoryAccess: { memoryRef: "memory:tutor-a", scope: structuredClone(BASE_SCOPE) },
    disclosurePolicy: {
      workingLevel: "omit",
      learnerAttempt: { mode: "omit" },
      agePolicy: {
        mode: "include",
        parameters: {
          agePolicyRef: BASE_PROFILE.policyProfileRef,
          learnerStageRef: BASE_PROFILE.learningStageRef,
          responseStyleCode: "bounded-middle-childhood",
          maximumResponseWords: 200,
        },
      },
    },
    assessmentPolicy: { completedAssessmentReviewAllowed: false },
    evidenceContext: {
      evidenceRef: "tutor-evidence:tutor-a",
      observedAt: "2026-08-13T20:01:00.000Z",
      currentSkillRef: "skill:identify-equal-parts",
      learnerResponseOutcome: "not-evaluated",
      prerequisiteReview: { status: "not-recommended" },
    },
    reviewedFallback: {
      fallbackRef: "fallback:reviewed-static-curriculum",
      reviewApprovalRef: "approval:reviewed-fallback",
      proposal: fallbackProposal(),
    },
  };
}

const METRICS = { inputTokenCount: 20, outputTokenCount: 12, latencyMs: 5, costUnits: 1 } as const;

function telemetry(
  request: TutorRequest,
  outcomeCode: "ACTION_PROPOSED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "MALFORMED_RESPONSE" | "UNSUPPORTED_ACTION",
  action: TutorActionKind | null = null,
) {
  return {
    ...VERSION,
    telemetryKind: "minimized-operation" as const,
    interactionRef: request.studyAuthorityContext.interactionRef,
    action: outcomeCode === "ACTION_PROPOSED" ? action : null,
    providerRef: request.budgetRoutingContext.route.providerRef,
    modelRef: request.budgetRoutingContext.route.modelRef,
    ...METRICS,
    outcomeCode,
  };
}

function successResult(proposal: unknown): unknown {
  const request = requestFixture();
  const rawKind = (proposal as { action?: { kind?: unknown } })?.action?.kind;
  const action = typeof rawKind === "string" && TUTOR_ACTION_KINDS.some((kind) => kind === rawKind)
    ? rawKind as TutorActionKind
    : null;
  return {
    status: "success",
    proposal,
    fallbackRequired: false,
    telemetry: telemetry(request, "ACTION_PROPOSED", action),
  };
}

function failureResult(
  status: "unavailable" | "timeout" | "malformed-response" | "rejected-response" | "over-budget" | "transient-failure" | "permanent-failure",
  reason: "PROVIDER_OUTAGE" | "PROVIDER_TIMEOUT" | "INVALID_JSON" | "UNSUPPORTED_ACTION" | "RESPONSE_TOO_LARGE" | "COST_BUDGET_EXCEEDED" | "TRANSPORT_EXCEPTION" | "PERMANENT_TRANSPORT_FAILURE",
): unknown {
  const request = requestFixture();
  const canonical = status === "timeout" ? "PROVIDER_TIMEOUT" : reason === "UNSUPPORTED_ACTION" ? "UNSUPPORTED_ACTION" : status === "malformed-response" || status === "rejected-response" || status === "over-budget" ? "MALFORMED_RESPONSE" : "PROVIDER_UNAVAILABLE";
  return {
    status,
    reason,
    retryable: status === "unavailable" || status === "timeout" || status === "transient-failure",
    fallbackRequired: true,
    fallback: {
      ...VERSION,
      envelope: "tutor-static-fallback-required",
      interactionRef: BASE_SCOPE.interactionRef,
      code: "STATIC_FALLBACK_REQUIRED",
      fallbackRef: "fallback:reviewed-static-curriculum",
      reasonCode: canonical,
    },
    telemetry: telemetry(request, canonical),
  };
}

class QueueProvider implements TutorProviderPort {
  readonly steps: readonly unknown[];
  callCount = 0;

  constructor(steps: readonly unknown[]) {
    this.steps = steps;
  }

  async execute(): Promise<ProviderExecutionResult> {
    const step = this.steps[Math.min(this.callCount, this.steps.length - 1)];
    this.callCount += 1;
    if (step instanceof Error) throw step;
    return structuredClone(step) as ProviderExecutionResult;
  }
}

class AtomicLedger {
  readonly entries = new Map<string, string>();

  async appendAcceptedEvent(sessionRef: string, eventRef: string, eventVersion: number, idempotencyKey: string) {
    const key = `${sessionRef}:${eventRef}:${eventVersion}`;
    const existing = this.entries.get(key);
    if (existing === idempotencyKey) return { status: "duplicate-ignored" as const };
    if (existing !== undefined) return { status: "idempotency-collision" as const };
    this.entries.set(key, idempotencyKey);
    return { status: "appended" as const };
  }
}

function turnPlan(proposal: TutorActionProposal): TutorTurnPolicyPlan {
  const text = "content" in proposal.action
    ? proposal.action.content
    : "question" in proposal.action
      ? proposal.action.question
      : "";
  return {
    introducedConceptRefs:
      proposal.action.kind === "reteach" ? [proposal.action.conceptRef] : [],
    estimatedTutorWordCount: text.trim() === "" ? 1 : text.trim().split(/\s+/).length,
    plannedStepCount: 1,
    abstractionLevel: "conceptual",
    stepGranularity: "small-step",
    turnsSinceComprehensionCheck: 0,
    includesComprehensionCheck: proposal.action.kind === "ask-check",
    includesConcreteExample: proposal.action.kind === "show-example",
    independentReasoningExpectation: "mixed",
    socraticQuestioningLevel: "moderate",
    vocabularyComplexity: "academic",
    explanationDensity: "moderate",
    hintEscalationsSinceRecheck: 0,
  };
}

interface Harness {
  readonly input: TutorV2BridgeInvocation;
  readonly dependencies: TutorV2BridgeDependencies;
  readonly provider: QueueProvider;
  readonly memory: TutorSessionMemoryStore;
  readonly ledger: AtomicLedger;
  advance(ms: number): void;
}

function harness(options: {
  readonly steps?: readonly unknown[];
  readonly profile?: AgeAwareTutorPolicyProfile;
  readonly provider?: TutorProviderPort;
  readonly inspect?: (proposal: TutorActionProposal) => unknown;
  readonly permission?: "accepted" | "rejected" | "throw";
  readonly safety?: "accepted" | "rejected" | "unavailable" | "throw";
  readonly ttlMs?: number;
} = {}): Harness {
  let now = NOW;
  const input = invocationFixture();
  const profile = options.profile ?? BASE_PROFILE;
  if (profile !== BASE_PROFILE) {
    Object.assign(input.agePolicyBinding, {
      policyProfileRef: profile.policyProfileRef,
      learningStageRef: profile.learningStageRef,
      approvalRef: profile.approvalRef,
    });
    Object.assign((input.request as TutorRequest).studyAuthorityContext.instructionContext, {
      learnerStageRef: profile.learningStageRef,
    });
    if (input.disclosurePolicy.agePolicy.mode === "include") {
      Object.assign(input.disclosurePolicy.agePolicy.parameters, {
        agePolicyRef: profile.policyProfileRef,
        learnerStageRef: profile.learningStageRef,
        maximumResponseWords: Math.min(200, profile.dimensions.recommendedTurnLengthWords.maximumWords),
      });
    }
  }
  const memory = new TutorSessionMemoryStore({ now: () => now });
  assert.equal(memory.open({ ...input.memoryAccess, ttlMs: options.ttlMs ?? 60_000 }).status, "accepted");
  const registry = createApprovedAgePolicyRegistry([profile]);
  assert.equal(registry.status, "ready");
  if (registry.status !== "ready") throw new Error("registry setup failed");
  const queued = new QueueProvider(options.steps ?? [successResult(proposalFixture())]);
  const ledger = new AtomicLedger();
  const dependencies: TutorV2BridgeDependencies = {
    permission: {
      async consume() {
        if (options.permission === "throw") throw new Error("permission unavailable");
        return options.permission === "rejected"
          ? { status: "rejected", code: "INVOCATION_NOT_AUTHORIZED" }
          : { status: "accepted" };
      },
    },
    safety: {
      async consume() {
        if (options.safety === "throw") throw new Error("classifier unavailable");
        if (options.safety === "rejected") return { status: "rejected", code: "SAFETY_CLEARANCE_REJECTED", adultReviewRequired: true };
        if (options.safety === "unavailable") return { status: "rejected", code: "SAFETY_CLASSIFIER_UNAVAILABLE", adultReviewRequired: true };
        return { status: "accepted" };
      },
    },
    agePolicies: registry.registry,
    ageTurnInspector: { inspect: ({ proposal }) => options.inspect?.(proposal) ?? turnPlan(proposal) },
    staticFallback: { validate: () => ({ status: "accepted" }) },
    memory,
    provider: options.provider ?? queued,
    eventLedger: ledger,
    now: () => now,
  };
  return { input, dependencies, provider: queued, memory, ledger, advance(ms) { now += ms; } };
}

function requestOf(input: TutorV2BridgeInvocation): TutorRequest {
  return input.request as TutorRequest;
}

function assertFallback(result: TutorV2BridgeResult, reason?: string): asserts result is Extract<TutorV2BridgeResult, { status: "fallback" }> {
  assert.equal(result.status, "fallback");
  if (result.status !== "fallback") return;
  if (reason !== undefined) assert.equal(result.reasonCode, reason);
  assert.equal(result.studyMutationAllowed, false);
}

for (const kind of TUTOR_ACTION_KINDS) {
  test(`valid action ${kind} returns a non-authoritative Study proposal`, async () => {
    const h = harness({ steps: [successResult(proposalFixture(kind))] });
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted") return;
    assert.equal(result.proposal.action.kind, kind);
    assert.equal(result.proposal.authoritative, false);
    assert.equal(result.proposal.studyDecisionRequired, true);
    assert.equal(result.studyMutationAllowed, false);
    assert.equal(result.adultReviewHook?.deliveryStatus, kind === "escalate" ? "proposed-not-delivered" : undefined);
  });
}

const AUTHORITY_CASES: readonly [string, Record<string, unknown>][] = [
  ["grade mutation", { officialGrade: 9 }],
  ["working-level mutation", { officialWorkingLevel: "grade-9" }],
  ["mastery declaration", { declareMastery: true }],
  ["scoring mutation", { assessmentResults: [{ score: 1 }] }],
  ["guardian certification", { certifyGuardianWork: true }],
  ["guardian-authority mutation", { guardianAuthority: "provider" }],
  ["safety-clear mutation", { clearSafetyHold: true }],
  ["permission mutation", { permissions: ["admin"] }],
  ["arbitrary student-state mutation", { studentStateWrite: { grade: 12 } }],
];

for (const [name, contamination] of AUTHORITY_CASES) {
  test(`${name} is rejected`, async () => {
    const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
    Object.assign(proposal.action as Record<string, unknown>, contamination);
    const h = harness({ steps: [successResult(proposal)] });
    assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  });
}

test("active-assessment direct answer is rejected", async () => {
  const proposal = proposalFixture("explain");
  Object.assign(proposal.action, { content: "The correct answer is 4." });
  const h = harness({ steps: [successResult(proposal)] });
  Object.assign(requestOf(h.input).studyAuthorityContext.instructionContext, { assessmentPhase: "active-graded-or-mastery-check" });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
});

test("answer-bearing provider field is rejected before exact schema acceptance", async () => {
  const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
  Object.assign(proposal.action as Record<string, unknown>, { correctAnswer: "4" });
  const h = harness({ steps: [successResult(proposal)] });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
});

test("completed review without explicit Study authority is rejected", async () => {
  const h = harness();
  Object.assign(requestOf(h.input).studyAuthorityContext.instructionContext, { assessmentPhase: "completed-assessment-review" });
  h.input.assessmentPolicy.completedAssessmentReviewAllowed = false;
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
});

test("completed review with explicit Study authority follows policy", async () => {
  const h = harness();
  Object.assign(requestOf(h.input).studyAuthorityContext.instructionContext, { assessmentPhase: "completed-assessment-review" });
  h.input.assessmentPolicy.completedAssessmentReviewAllowed = true;
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
});

test("provider context excludes protected answer authority", async () => {
  let captured: ProviderTransportRequest | null = null;
  const transport: ProviderTransportPort = {
    async send(request): Promise<ProviderTransportResult> {
      captured = structuredClone(request);
      return { status: "response", body: JSON.stringify(proposalFixture()), metrics: METRICS };
    },
  };
  const h = harness({ provider: new TransportBackedTutorProvider({ transport }) });
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  assert.notEqual(captured, null);
  const text = JSON.stringify(captured);
  assert.equal(/answerKey|correctAnswer|protectedAnswer|authorizationRef|answerPolicyRef/.test(text), false);
});

test("valid grounding is accepted", async () => {
  const h = harness();
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
});

test("missing grounding claims produce insufficient-grounding fallback", async () => {
  const proposal = proposalFixture();
  Object.assign(proposal, { groundingClaims: [] });
  const h = harness({ steps: [successResult(proposal)] });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "INSUFFICIENT_GROUNDED_CONTEXT");
});

test("invented concept is rejected", async () => {
  const proposal = proposalFixture();
  Object.assign(proposal.action, { content: "Use concept:invented-number-magic now." });
  const h = harness({ steps: [successResult(proposal)] });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "INSUFFICIENT_GROUNDED_CONTEXT");
});

test("wrong lesson or item reference is rejected", async () => {
  for (const ref of ["lesson:wrong-lesson", "item:wrong-item"]) {
    const proposal = proposalFixture();
    Object.assign(proposal.action, { content: `Use ${ref} now.` });
    const h = harness({ steps: [successResult(proposal)] });
    assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "INSUFFICIENT_GROUNDED_CONTEXT");
  }
});

test("grounding digest mismatch is rejected", async () => {
  const proposal = proposalFixture();
  Object.assign(proposal, { groundingClaims: [{ groundingRef: "grounding:fraction-model", contentDigest: OTHER_DIGEST, claimKind: "direct-support" }] });
  const h = harness({ steps: [successResult(proposal)] });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "INSUFFICIENT_GROUNDED_CONTEXT");
});

test("insufficient grounding uses reviewed deterministic fallback", async () => {
  const proposal = proposalFixture();
  Object.assign(proposal, { groundingClaims: [] });
  const h = harness({ steps: [successResult(proposal)] });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result, "INSUFFICIENT_GROUNDED_CONTEXT");
  assert.equal(result.fallback?.action.kind, "return-to-lesson");
  assert.equal(result.fallbackRef, "fallback:reviewed-static-curriculum");
});

const PROVIDER_FAILURES: readonly [string, unknown, string][] = [
  ["unavailable", failureResult("unavailable", "PROVIDER_OUTAGE"), "PROVIDER_UNAVAILABLE"],
  ["timeout", failureResult("timeout", "PROVIDER_TIMEOUT"), "PROVIDER_TIMEOUT"],
  ["malformed", { status: "success", proposal: "not-an-object" }, "MALFORMED_RESPONSE"],
  ["unknown action", failureResult("rejected-response", "UNSUPPORTED_ACTION"), "UNSUPPORTED_ACTION"],
  ["excessive output", successResult({ ...proposalFixture(), action: { kind: "explain", content: "x".repeat(2401), groundingRefs: ["grounding:fraction-model"] } }), "MALFORMED_RESPONSE"],
  ["thrown provider failure", new Error("provider failed"), "PROVIDER_UNAVAILABLE"],
  ["over-budget", failureResult("over-budget", "COST_BUDGET_EXCEEDED"), "MALFORMED_RESPONSE"],
  ["permanent failure", failureResult("permanent-failure", "PERMANENT_TRANSPORT_FAILURE"), "PROVIDER_UNAVAILABLE"],
];

for (const [name, step, reason] of PROVIDER_FAILURES) {
  test(`provider ${name} maps to canonical static fallback`, async () => {
    const h = harness({ steps: [step] });
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(result, reason);
    assert.equal(result.providerCallCount, 1);
    assert.equal(result.fallback?.action.kind, "return-to-lesson");
  });
}

const REQUEST_PRIVACY_CASES: readonly [string, string][] = [
  ["credential contamination", "password=secret-value"],
  ["PIN contamination", "Parent PIN: 1234"],
  ["household-private contamination", "Household private financial data"],
  ["sibling contamination", "Sibling record grade data"],
  ["adult-private note contamination", "Adult private note: do not share"],
];

for (const [name, content] of REQUEST_PRIVACY_CASES) {
  test(`${name} is blocked before provider execution`, async () => {
    const h = harness();
    const item = requestOf(h.input).studyAuthorityContext.instructionContext.learnerSafeItem;
    assert.notEqual(item, null);
    if (item !== null) Object.assign(item, { learnerSafeContent: content });
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assertFallback(result, "POLICY_REJECTION");
    assert.equal(h.provider.callCount, 0);
  });
}

test("transcript persistence contamination is rejected", async () => {
  const proposal = structuredClone(proposalFixture()) as unknown as Record<string, unknown>;
  proposal.tutorTranscript = [{ role: "learner", content: "private" }];
  const h = harness({ steps: [successResult(proposal)] });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result, "MALFORMED_RESPONSE");
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("raw provider response persistence contamination is rejected", async () => {
  const raw = successResult(proposalFixture()) as Record<string, unknown>;
  raw.rawProviderResponse = "private raw provider output";
  const h = harness({ steps: [raw] });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result, "MALFORMED_RESPONSE");
  assert.equal(JSON.stringify(result).includes("private raw"), false);
});

test("prohibited direct learner identifier is blocked", async () => {
  const proposal = proposalFixture();
  Object.assign(proposal.action, { content: "Email learner@example.com for the next hint." });
  const h = harness({ steps: [successResult(proposal)] });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
});

test("valid same-scope memory is resolved and advanced once", async () => {
  const h = harness();
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  const read = h.memory.read(h.input.memoryAccess);
  assert.equal(read.status, "accepted");
  if (read.status === "accepted") assert.equal(read.state.interventionCount, 1);
});

test("cross-session memory is rejected", async () => {
  const h = harness();
  Object.assign(h.input.memoryAccess.scope, { sessionRef: "session:other" });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(h.provider.callCount, 0);
});

test("cross-learner memory is rejected", async () => {
  const h = harness();
  Object.assign(h.input.memoryAccess.scope, { learnerScopeRef: "learner-scope:other" });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(h.provider.callCount, 0);
});

test("expired memory is rejected and purged", async () => {
  const h = harness({ ttlMs: 30_000 });
  h.advance(31_000);
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(h.memory.activeEntryCount, 0);
  assert.equal(h.provider.callCount, 0);
});

test("memory bounds are enforced before provider execution", async () => {
  const h = harness();
  assert.equal(h.memory.update({ ...h.input.memoryAccess, patch: { interventionCount: 24 } }).status, "accepted");
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(h.provider.callCount, 0);
});

test("younger-stage turn limits reject excessive response size", async () => {
  const profile: AgeAwareTutorPolicyProfile = {
    ...structuredClone(BASE_PROFILE),
    policyProfileRef: "age-policy:younger",
    learningStageRef: "learner-stage:younger",
    approvalRef: "approval:age-younger",
    dimensions: {
      ...structuredClone(BASE_PROFILE.dimensions),
      recommendedTurnLengthWords: { minimumWords: 1, maximumWords: 5 },
      abstractionLevel: "concrete",
      stepGranularity: "micro-step",
      vocabularyComplexity: "foundational",
    },
  };
  const h = harness({
    profile,
    inspect: (proposal) => ({
      ...turnPlan(proposal),
      estimatedTutorWordCount:
        proposal.proposalRef === "proposal:reviewed-static-fallback" ? 1 : 12,
    }),
  });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
});

test("older-stage bounded response is accepted", async () => {
  const profile: AgeAwareTutorPolicyProfile = {
    ...structuredClone(BASE_PROFILE),
    policyProfileRef: "age-policy:older",
    learningStageRef: "learner-stage:older",
    approvalRef: "approval:age-older",
    dimensions: {
      ...structuredClone(BASE_PROFILE.dimensions),
      recommendedTurnLengthWords: { minimumWords: 1, maximumWords: 500 },
      abstractionLevel: "formal",
      stepGranularity: "synthesis",
      vocabularyComplexity: "advanced",
      allowableExplanationDensity: "dense",
    },
  };
  const h = harness({ profile, inspect: (proposal) => ({ ...turnPlan(proposal), estimatedTutorWordCount: 300 }) });
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
});

test("unsupported learning stage fails safely", async () => {
  const h = harness();
  Object.assign(h.input.agePolicyBinding, { policyProfileRef: "age-policy:unsupported" });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(h.provider.callCount, 0);
});

const EVIDENCE_CASES: readonly [string, Partial<TutorActionProposal>, string][] = [
  ["independent", { assistanceLevel: "independent", hintLevel: "none" }, "INDEPENDENT"],
  ["light-hint", { assistanceLevel: "light-hint", hintLevel: "concept-cue" }, "LIGHT_HINT"],
  ["guided", { assistanceLevel: "guided", hintLevel: "guided-step" }, "GUIDED"],
  ["reteach-required", { assistanceLevel: "reteach-required", hintLevel: "guided-step" }, "RETEACH_REQUIRED"],
];

for (const [name, overrides, expected] of EVIDENCE_CASES) {
  test(`${name} assistance produces minimized ${expected} evidence`, async () => {
    const proposal = proposalFixture("explain", overrides as Record<string, unknown>);
    const h = harness({ steps: [successResult(proposal)] });
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assert.equal(result.status, "accepted");
    if (result.status === "accepted") assert.equal(result.evidence.evidenceCharacteristic, expected);
  });
}

test("heavily assisted success is never represented as independent", async () => {
  const proposal = proposalFixture("explain", { assistanceLevel: "guided", hintLevel: "guided-step" });
  const h = harness({ steps: [successResult(proposal)] });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(result.status, "accepted");
  if (result.status === "accepted") assert.notEqual(result.evidence.evidenceCharacteristic, "INDEPENDENT");
});

test("identical retry returns no duplicate evidence or proposal", async () => {
  const h = harness({ steps: [successResult(proposalFixture()), successResult(proposalFixture())] });
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  const retry = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(retry.status, "duplicate-ignored");
  if (retry.status === "duplicate-ignored") {
    assert.equal(retry.evidenceReturned, false);
    assert.equal(retry.proposalReturned, false);
  }
});

test("conflicting content under accepted request identity is quarantined", async () => {
  const h = harness({ steps: [successResult(proposalFixture("explain")), successResult(proposalFixture("hint"))] });
  assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "accepted");
  const collision = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(collision.status, "quarantined");
  if (collision.status === "quarantined") assert.equal(collision.reasonCode, "EVENT_ID_COLLISION");
});

test("provider retry cannot duplicate Study-facing proposal or evidence", async () => {
  const h = harness({ steps: [successResult(proposalFixture()), successResult(proposalFixture())] });
  const first = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  const second = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assert.equal(first.status, "accepted");
  assert.equal(second.status, "duplicate-ignored");
  assert.equal(h.ledger.entries.size, 1);
  const memory = h.memory.read(h.input.memoryAccess);
  assert.equal(memory.status, "accepted");
  if (memory.status === "accepted") assert.equal(memory.state.interventionCount, 1);
});

for (const [name, step] of [
  ["outage", failureResult("unavailable", "PROVIDER_OUTAGE")],
  ["malformed result", { status: "success", proposal: null }],
  ["grounding failure", successResult({ ...proposalFixture(), groundingClaims: [] })],
] as const) {
  test(`${name} leaves authoritative Study invocation state intact`, async () => {
    const h = harness({ steps: [step] });
    const snapshot = structuredClone(h.input);
    assert.equal((await orchestrateTutorV2Bridge(h.input, h.dependencies)).status, "fallback");
    assert.deepEqual(h.input, snapshot);
  });
}

test("static fallback is deterministic", async () => {
  const first = harness({ steps: [failureResult("timeout", "PROVIDER_TIMEOUT")] });
  const second = harness({ steps: [failureResult("timeout", "PROVIDER_TIMEOUT")] });
  const a = await orchestrateTutorV2Bridge(first.input, first.dependencies);
  const b = await orchestrateTutorV2Bridge(second.input, second.dependencies);
  assert.equal(a.status, "fallback");
  assert.equal(b.status, "fallback");
  if (a.status === "fallback" && b.status === "fallback") {
    assert.deepEqual(a.fallback, b.fallback);
    assert.deepEqual(a.evidence, b.evidence);
  }
});

test("unapproved static fallback content is never returned", async () => {
  const h = harness({ steps: [failureResult("timeout", "PROVIDER_TIMEOUT")] });
  Object.assign(h.dependencies.staticFallback, {
    validate: () => ({ status: "rejected", code: "STATIC_FALLBACK_NOT_APPROVED" }),
  });
  const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
  assertFallback(result, "PROVIDER_TIMEOUT");
  assert.equal(result.fallback, null);
  assert.equal(result.evidence, null);
});

test("rejected Study invocation permission prevents provider execution", async () => {
  const h = harness({ permission: "rejected" });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "POLICY_REJECTION");
  assert.equal(h.provider.callCount, 0);
});

for (const safety of ["rejected", "unavailable", "throw"] as const) {
  test(`safety dependency ${safety} fails closed`, async () => {
    const h = harness({ safety });
    const result = await orchestrateTutorV2Bridge(h.input, h.dependencies);
    assert.equal(result.status, "safety-stop");
    if (result.status === "safety-stop") assert.equal(result.adultReviewHook?.deliveryStatus, "proposed-not-delivered");
    assert.equal(h.provider.callCount, 0);
  });
}

test("request version mismatch fails before provider execution", async () => {
  const h = harness();
  Object.assign(h.input.request as object, { contractVersion: "2.0.1" });
  assertFallback(await orchestrateTutorV2Bridge(h.input, h.dependencies), "MALFORMED_RESPONSE");
  assert.equal(h.provider.callCount, 0);
});

test("ownership-adjudication SHA is in W1-08 ancestry", () => {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", "f79271ac2cc57e9128ee61774a4f082c35c6fa77", "HEAD"], { cwd: process.cwd() });
  assert.equal(result.status, 0);
});

test("accepted W1-03 through W1-07 trees still match adjudicated lane deltas", () => {
  const lanes: readonly [string, readonly string[]][] = [
    ["ee6cc83fdaa43fe733d05abefdaedffe3d0febf9", ["core/v2/providers"]],
    ["befb91bb2321aec0449d2d8e613619a592feb76c", ["core/v2/policy/authority", "core/v2/policy/grounding", "core/v2/policy/anti-answer", "core/v2/policy/refusal"]],
    ["4a8bded7bc0caf5ff647dae814e011d20c8ae5bf", ["core/v2/policy/age", "core/v2/memory"]],
    ["b93765552d60a88ac7691ca7840dfc2ae3a23e77", ["study-engine/tutor-v2/evidence", "study-engine/tutor-v2/privacy"]],
    ["9b959ab7e8176ebccb4fd3ca7b54bf5584602b35", ["evals/v2/framework", "evals/v2/corpus/foundation"]],
  ];
  for (const [sha, paths] of lanes) {
    const result = spawnSync("git", ["diff", "--exit-code", sha, "--", ...paths], { cwd: process.cwd() });
    assert.equal(result.status, 0, result.stdout.toString() + result.stderr.toString());
  }
});

test("adjudicated map, not old proposed paths, is controlling", () => {
  const map = readFileSync("../docs/study-tutor-v2/architecture/wave1-path-ownership.md", "utf8");
  assert.match(map, /W1-03[^\n]+core\/v2\/providers/);
  assert.match(map, /W1-06[^\n]+study-engine\/tutor-v2\/evidence/);
  assert.match(map, /authoritative Wave 1 merge-conflict boundary/);
});

test("W1-08 crosses no release or security path ownership", () => {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0);
  const forbidden = /(?:^|\/)(?:netlify|supabase|src|curriculum-production|curriculum-release-admitted)(?:\/|$)/;
  for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
    const file = line.slice(3);
    assert.equal(forbidden.test(file), false, file);
  }
});
