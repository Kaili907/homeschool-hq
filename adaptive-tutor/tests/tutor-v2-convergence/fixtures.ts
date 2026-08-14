import {
  TUTOR_ACTION_KINDS,
  TUTOR_V2_ACTION_COMPATIBILITY_ID,
  TUTOR_V2_ACTION_SCHEMA_VERSION,
  TUTOR_V2_COMPATIBILITY_ID,
  TUTOR_V2_CONTRACT_VERSION,
  type TutorActionKind,
  type TutorActionProposal,
  type TutorRequest,
} from "../../core/v2/contracts/index.js";
import {
  TutorSessionMemoryStore,
  type TutorMemoryScope,
} from "../../core/v2/memory/index.js";
import {
  createApprovedAgePolicyRegistry,
  type AgeAwareTutorPolicyProfile,
  type TutorTurnPolicyPlan,
} from "../../core/v2/policy/age/index.js";
import type {
  ProviderExecutionRequest,
  ProviderExecutionResult,
  TutorProviderPort,
} from "../../core/v2/providers/ports/index.js";
import {
  TUTOR_V2_BRIDGE_VERSION,
  type TutorV2BridgeDependencies,
  type TutorV2BridgeInvocation,
} from "../../study-engine/bridges/tutor-v2/index.js";
import { minimizeProviderContext } from "../../study-engine/tutor-v2/privacy/index.js";

export const NOW = Date.parse("2026-08-13T20:01:00.000Z");
export const DIGEST = `sha256:${"a".repeat(64)}` as const;
export const OTHER_DIGEST = `sha256:${"b".repeat(64)}` as const;
export const VERSION = {
  contractVersion: TUTOR_V2_CONTRACT_VERSION,
  actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
  compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
  actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
} as const;

export const BASE_SCOPE: TutorMemoryScope = {
  scopeKind: "trusted-study-tutor-scope",
  householdScopeRef: "household-scope:convergence-a",
  learnerScopeRef: "learner-scope:convergence-a",
  sessionRef: "session:convergence-a",
  interactionRef: "interaction:convergence-a",
  lessonRef: "lesson:fractions-a",
};

export const BASE_PROFILE: AgeAwareTutorPolicyProfile = {
  profileKind: "approved-learning-stage-policy",
  policyProfileRef: "age-policy:convergence-middle",
  learningStageRef: "learner-stage:middle-childhood",
  approvalRef: "approval:convergence-age-policy",
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

export function requestFixture(): TutorRequest {
  return {
    ...VERSION,
    envelope: "tutor-request",
    requestRef: "request:convergence-a",
    requestIntent: "propose-next-teaching-action",
    studyAuthorityContext: {
      ...VERSION,
      contextKind: "study-authority",
      interactionRef: BASE_SCOPE.interactionRef,
      invocationBindingRef: "invocation:convergence-a",
      authorizationRef: "authorization:convergence-a",
      authorizationRevision: 1,
      safetyClearanceRef: "safety:convergence-a",
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
          summaryRef: "summary:convergence-a",
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
        routeRef: "route:convergence-a",
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

export function actionFor(kind: TutorActionKind): TutorActionProposal["action"] {
  const groundingRefs = ["grounding:fraction-model"];
  switch (kind) {
    case "explain": return { kind, content: "Equal parts make a fraction model.", groundingRefs };
    case "hint": return { kind, content: "Count the equal parts first.", hintLevel: "nudge", groundingRefs };
    case "ask-check": return { kind, question: "What should you count first?", checkKind: "next-step", groundingRefs };
    case "show-example": return { kind, content: "Here is a different equal-parts model.", exampleRef: "grounding:fraction-model", groundingRefs, nonIsomorphicToActiveItem: true };
    case "reteach": return { kind, content: "Let us rebuild the equal-parts idea.", conceptRef: "concept:fractions", groundingRefs };
    case "check-prerequisite": return { kind, prerequisiteConceptRef: "concept:fractions", reasonCode: "review-equal-parts", groundingRefs };
    case "suggest-break": return { kind, reasonCode: "study-break-suggested", proposedDurationMinutes: 5 };
    case "escalate": return { kind, reasonCode: "adult-review-suggested", escalationTarget: "study-adult-review-policy", claimsDelivery: false };
    case "return-to-lesson": return { kind, reasonCode: "continue-reviewed-lesson", resumeTarget: "study-selected-position" };
  }
}

export function proposalFixture(kind: TutorActionKind = "explain"): TutorActionProposal {
  const grounded = !["suggest-break", "escalate", "return-to-lesson"].includes(kind);
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
  };
}

export function invocationFixture(): TutorV2BridgeInvocation {
  return {
    bridgeVersion: TUTOR_V2_BRIDGE_VERSION,
    request: requestFixture(),
    invocationPermission: {
      permissionKind: "study-issued-tutor-invocation",
      permitRef: "permit:convergence-a",
      invocationBindingRef: "invocation:convergence-a",
      authorizationRef: "authorization:convergence-a",
      authorizationRevision: 1,
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
    memoryAccess: { memoryRef: "memory:convergence-a", scope: structuredClone(BASE_SCOPE) },
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
      evidenceRef: "tutor-evidence:convergence-a",
      observedAt: "2026-08-13T20:01:00.000Z",
      currentSkillRef: "skill:identify-equal-parts",
      learnerResponseOutcome: "not-evaluated",
      prerequisiteReview: { status: "not-recommended" },
    },
    reviewedFallback: {
      fallbackRef: "fallback:reviewed-static-curriculum",
      reviewApprovalRef: "approval:reviewed-fallback",
      proposal: {
        ...proposalFixture("return-to-lesson"),
        proposalRef: "proposal:reviewed-static-fallback",
      },
    },
  };
}

/** Exact provider-safe envelope produced by the repaired Study bridge. */
export function providerExecutionRequestFixture(): ProviderExecutionRequest {
  const request = requestFixture();
  const invocation = invocationFixture();
  const minimized = minimizeProviderContext({
    studyAuthorityContext: request.studyAuthorityContext,
    disclosurePolicy: invocation.disclosurePolicy,
  });
  if (minimized.status !== "accepted") throw new Error("provider projection fixture failed");
  return {
    ...VERSION,
    envelope: "provider-execution-request",
    requestRef: request.requestRef,
    context: minimized.value,
    shortTermState: structuredClone(request.shortTermState),
    budgetRoutingContext: structuredClone(request.budgetRoutingContext),
  };
}

const METRICS = { inputTokenCount: 20, outputTokenCount: 12, latencyMs: 5, costUnits: 1 } as const;

function telemetry(request: TutorRequest, outcomeCode: "ACTION_PROPOSED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "MALFORMED_RESPONSE" | "UNSUPPORTED_ACTION", action: TutorActionKind | null = null) {
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

export function successResult(proposal: unknown): unknown {
  const request = requestFixture();
  const kind = (proposal as { action?: { kind?: TutorActionKind } })?.action?.kind ?? null;
  return { status: "success", proposal, fallbackRequired: false, telemetry: telemetry(request, "ACTION_PROPOSED", kind) };
}

export function failureResult(status: "unavailable" | "timeout" | "malformed-response", reason: "PROVIDER_OUTAGE" | "PROVIDER_TIMEOUT" | "INVALID_JSON"): unknown {
  const request = requestFixture();
  const canonical = status === "timeout" ? "PROVIDER_TIMEOUT" : status === "malformed-response" ? "MALFORMED_RESPONSE" : "PROVIDER_UNAVAILABLE";
  return {
    status,
    reason,
    retryable: status !== "malformed-response",
    fallbackRequired: true,
    fallback: { ...VERSION, envelope: "tutor-static-fallback-required", interactionRef: BASE_SCOPE.interactionRef, code: "STATIC_FALLBACK_REQUIRED", fallbackRef: "fallback:reviewed-static-curriculum", reasonCode: canonical },
    telemetry: telemetry(request, canonical),
  };
}

export class QueueProvider implements TutorProviderPort {
  callCount = 0;
  constructor(readonly steps: readonly unknown[]) {}
  async execute(): Promise<ProviderExecutionResult> {
    const step = this.steps[Math.min(this.callCount, this.steps.length - 1)];
    this.callCount += 1;
    if (step instanceof Error) throw step;
    return structuredClone(step) as ProviderExecutionResult;
  }
}

export class AtomicLedger {
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
  const text = "content" in proposal.action ? proposal.action.content : "question" in proposal.action ? proposal.action.question : "";
  return {
    introducedConceptRefs: proposal.action.kind === "reteach" ? [proposal.action.conceptRef] : [],
    estimatedTutorWordCount: Math.max(1, text.trim().split(/\s+/).length),
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

export interface Harness {
  readonly input: TutorV2BridgeInvocation;
  readonly dependencies: TutorV2BridgeDependencies;
  readonly provider: QueueProvider;
  readonly memory: TutorSessionMemoryStore;
  readonly ledger: AtomicLedger;
}

export function harness(steps: readonly unknown[] = [successResult(proposalFixture())]): Harness {
  const input = invocationFixture();
  const memory = new TutorSessionMemoryStore({ now: () => NOW });
  const opened = memory.open({ ...input.memoryAccess, ttlMs: 60_000 });
  if (opened.status !== "accepted") throw new Error("memory fixture failed");
  const registry = createApprovedAgePolicyRegistry([BASE_PROFILE]);
  if (registry.status !== "ready") throw new Error("age registry fixture failed");
  const provider = new QueueProvider(steps);
  const ledger = new AtomicLedger();
  const dependencies: TutorV2BridgeDependencies = {
    permission: { consume: () => ({ status: "accepted" }) },
    safety: { consume: () => ({ status: "accepted" }) },
    agePolicies: registry.registry,
    ageTurnInspector: { inspect: ({ proposal }) => turnPlan(proposal) },
    staticFallback: { validate: () => ({ status: "accepted" }) },
    memory,
    provider,
    eventLedger: ledger,
    now: () => NOW,
  };
  return { input, dependencies, provider, memory, ledger };
}
