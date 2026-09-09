import {
  TUTOR_ACTION_KINDS,
  TutorRequestSchema,
  TutorStaticFallbackOutcomeSchema,
  TutorTelemetryEnvelopeSchema,
  validateExact,
  type HintLevel,
  type TutorActionProposal,
  type TutorRequest,
} from "../../../core/v2/contracts/index.js";
import {
  MAXIMUM_INTERVENTION_COUNT,
  TutorSessionMemoryStateSchema,
  type TutorSessionMemoryState,
} from "../../../core/v2/memory/index.js";
import {
  AgeAwareTutorPolicyProfileSchema,
  evaluateTutorTurnAgainstAgePolicy,
  type AgeAwareTutorPolicyProfile,
} from "../../../core/v2/policy/age/index.js";
import {
  evaluateTutorProposalPolicy,
} from "../../../core/v2/policy/refusal/index.js";
import type {
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ProviderFailureReason,
  ProviderFailureStatus,
} from "../../../core/v2/providers/ports/index.js";
import { projectTutorEvidence } from "../../tutor-v2/evidence/index.js";
import {
  minimizeProviderContext,
  type MinimizedProviderContext,
} from "../../tutor-v2/privacy/index.js";
import {
  TUTOR_V2_BRIDGE_EVENT_VERSION,
  TutorV2BridgeInvocationSchema,
  type CanonicalBridgeFallbackReason,
  type LearnerSafeTutorActionProjection,
  type ProviderFailureDetail,
  type ReviewedStaticFallback,
  type TutorAdultReviewHookProposal,
  type TutorV2BridgeDependencies,
  type TutorV2BridgeInvocation,
  type TutorV2BridgeResult,
} from "./contracts.js";
import {
  validateLearnerSafeTutorAction,
} from "./privacy.js";
import {
  authorizeReviewedLearnerAction,
  authorizeReviewedProviderContext,
} from "./reviewed-content.js";

const ACTIONS = new Set<string>(TUTOR_ACTION_KINDS);
const FAILURE_STATUSES = new Set<ProviderFailureStatus>([
  "unavailable",
  "timeout",
  "malformed-response",
  "rejected-response",
  "over-budget",
  "transient-failure",
  "permanent-failure",
]);
const FAILURE_REASONS = new Set<ProviderFailureReason>([
  "PROVIDER_OUTAGE",
  "PROVIDER_TIMEOUT",
  "INVALID_JSON",
  "SCHEMA_MISMATCH",
  "UNSUPPORTED_ACTION",
  "RESPONSE_BINDING_MISMATCH",
  "RESPONSE_TOO_LARGE",
  "OUTPUT_TOKEN_LIMIT_EXCEEDED",
  "COST_BUDGET_EXCEEDED",
  "NO_ACTION_BUDGET",
  "PROVIDER_REJECTED",
  "TRANSPORT_EXCEPTION",
  "PERMANENT_TRANSPORT_FAILURE",
  "INVALID_CLOSED_REQUEST",
]);
const HINT_ORDER: Readonly<Record<HintLevel, number>> = {
  none: 0,
  nudge: 1,
  "concept-cue": 2,
  "guided-step": 3,
};

interface ResolvedInvocation {
  readonly invocation: TutorV2BridgeInvocation;
  readonly request: TutorRequest;
  readonly memory: TutorSessionMemoryState;
  readonly ageProfile: AgeAwareTutorPolicyProfile;
  readonly providerContext: MinimizedProviderContext;
}

interface FallbackContext {
  readonly invocation: TutorV2BridgeInvocation;
  readonly request: TutorRequest | null;
  readonly memory: TutorSessionMemoryState | null;
  readonly ageProfile: AgeAwareTutorPolicyProfile | null;
  readonly reasonCode: CanonicalBridgeFallbackReason;
  readonly providerDetail: ProviderFailureDetail | null;
  readonly providerCallCount: 0 | 1;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function immutableSnapshot<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function canonicalFailureReason(
  status: ProviderFailureStatus,
  reason: ProviderFailureReason,
): CanonicalBridgeFallbackReason {
  if (status === "timeout") return "PROVIDER_TIMEOUT";
  if (reason === "UNSUPPORTED_ACTION") return "UNSUPPORTED_ACTION";
  if (status === "malformed-response" || status === "rejected-response" || status === "over-budget") {
    return "MALFORMED_RESPONSE";
  }
  return "PROVIDER_UNAVAILABLE";
}

function policyReasonCode(code: CanonicalBridgeFallbackReason): string {
  return code.toLowerCase().replaceAll("_", "-");
}

function validateTemporalBinding(
  invocation: TutorV2BridgeInvocation,
  request: TutorRequest,
  now: number,
): boolean {
  const authority = request.studyAuthorityContext;
  const permission = invocation.invocationPermission;
  const requestIssued = Date.parse(authority.issuedAt);
  const requestExpires = Date.parse(authority.expiresAt);
  const permitIssued = Date.parse(permission.issuedAt);
  const permitExpires = Date.parse(permission.expiresAt);
  return (
    Number.isFinite(now) &&
    Number.isFinite(requestIssued) &&
    Number.isFinite(requestExpires) &&
    Number.isFinite(permitIssued) &&
    Number.isFinite(permitExpires) &&
    requestIssued <= now &&
    now < requestExpires &&
    permitIssued <= now &&
    now < permitExpires &&
    authority.interactionRef === request.shortTermState.interactionRef &&
    authority.interactionRef === invocation.memoryAccess.scope.interactionRef &&
    authority.instructionContext.learnerStageRef === invocation.agePolicyBinding.learningStageRef &&
    authority.invocationBindingRef === permission.invocationBindingRef &&
    authority.authorizationRef === permission.authorizationRef &&
    authority.authorizationRevision === permission.authorizationRevision &&
    permission.allowedActions.length === new Set(permission.allowedActions).size &&
    authority.instructionContext.allowedActions.length ===
      new Set(authority.instructionContext.allowedActions).size &&
    authority.instructionContext.allowedActions.every((action) =>
      permission.allowedActions.includes(action),
    )
  );
}

function validateAgeDisclosure(
  invocation: TutorV2BridgeInvocation,
  profile: AgeAwareTutorPolicyProfile,
): boolean {
  const disclosure = invocation.disclosurePolicy.agePolicy;
  return disclosure.mode === "omit" || (
    disclosure.parameters.agePolicyRef === profile.policyProfileRef &&
    disclosure.parameters.learnerStageRef === profile.learningStageRef &&
    disclosure.parameters.maximumResponseWords <=
      profile.dimensions.recommendedTurnLengthWords.maximumWords
  );
}

function projection(proposal: TutorActionProposal): LearnerSafeTutorActionProjection {
  return {
    projectionKind: "learner-safe-tutor-action-proposal",
    proposalRef: proposal.proposalRef,
    interactionRef: proposal.interactionRef,
    action: structuredClone(proposal.action),
    assistanceLevel: proposal.assistanceLevel,
    hintLevel: proposal.hintLevel,
    groundingRefs:
      "groundingRefs" in proposal.action ? [...proposal.action.groundingRefs] : [],
    authoritative: false,
    requiresStudyValidation: true,
    studyDecisionRequired: true,
  };
}

function adultReviewHook(
  proposal: TutorActionProposal,
): TutorAdultReviewHookProposal | null {
  if (proposal.action.kind !== "escalate") return null;
  return {
    hookKind: "study-adult-review-proposal",
    hookRef: `adult-review:${proposal.proposalRef.split(":").at(-1) ?? "tutor"}`,
    interactionRef: proposal.interactionRef,
    reasonCode: proposal.action.reasonCode,
    deliveryStatus: "proposed-not-delivered",
    directIdentifiersIncluded: false,
    rawTutorContentIncluded: false,
  };
}

function providerOutcomeClass(
  reasonCode: CanonicalBridgeFallbackReason | null,
): "action-proposed" | "provider-failure" | "provider-refusal" | "static-fallback" {
  if (reasonCode === null) return "action-proposed";
  if (reasonCode === "POLICY_REJECTION" || reasonCode === "INSUFFICIENT_GROUNDED_CONTEXT" || reasonCode === "UNSUPPORTED_ACTION") {
    return "provider-refusal";
  }
  return "provider-failure";
}

function evidenceFor(
  invocation: TutorV2BridgeInvocation,
  request: TutorRequest,
  proposal: TutorActionProposal,
  fallbackReason: CanonicalBridgeFallbackReason | null,
) {
  const evidence = projectTutorEvidence({
    evidenceRef: invocation.evidenceContext.evidenceRef,
    interactionRef: request.studyAuthorityContext.interactionRef,
    observedAt: invocation.evidenceContext.observedAt,
    tutorActionType: proposal.action.kind,
    hintLevelUsed: proposal.hintLevel,
    guidedInstructionUsed:
      proposal.assistanceLevel === "guided" || proposal.hintLevel === "guided-step",
    reteachRequired:
      proposal.assistanceLevel === "reteach-required" || proposal.action.kind === "reteach",
    learnerResponseOutcome: invocation.evidenceContext.learnerResponseOutcome,
    prerequisiteReview: invocation.evidenceContext.prerequisiteReview,
    groundingReferenceIds:
      "groundingRefs" in proposal.action ? [...proposal.action.groundingRefs] : [],
    policyOutcome: fallbackReason === null ? "action-approved" : "fallback-required",
    policyReasonCode:
      fallbackReason === null ? "instructional-action-approved" : policyReasonCode(fallbackReason),
    providerOutcomeClass: providerOutcomeClass(fallbackReason),
    fallbackUsed: fallbackReason !== null,
    // The request-bound turn is stable across an identical retry, unlike the
    // mutable in-memory counter that is advanced only after ledger acceptance.
    interventionCount: request.shortTermState.turnCount + 1,
    currentConceptRef: request.studyAuthorityContext.instructionContext.conceptRef,
    currentSkillRef: invocation.evidenceContext.currentSkillRef,
  });
  return evidence.status === "accepted" ? evidence.value : null;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function idempotencyKey(value: unknown): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value)),
  );
  return `study-tutor-v2:event:v1:${toHex(new Uint8Array(digest))}`;
}

async function claimStudyFacingEffect(
  dependencies: TutorV2BridgeDependencies,
  request: TutorRequest,
  invocation: TutorV2BridgeInvocation,
  value: unknown,
  providerCallCount: 0 | 1,
): Promise<"appended" | TutorV2BridgeResult> {
  try {
    const ledger = await dependencies.eventLedger.appendAcceptedEvent(
      invocation.memoryAccess.scope.sessionRef,
      request.requestRef,
      TUTOR_V2_BRIDGE_EVENT_VERSION,
      await idempotencyKey(value),
    );
    if (!isPlainRecord(ledger) || !exactKeys(ledger, ["status"])) {
      throw new Error("Malformed accepted-event ledger result");
    }
    if (ledger.status === "appended") return "appended";
    if (ledger.status === "duplicate-ignored") {
      return {
        status: "duplicate-ignored",
        requestRef: request.requestRef,
        evidenceReturned: false,
        proposalReturned: false,
        providerCallCount: 1,
        studyMutationAllowed: false,
      };
    }
    return {
      status: "quarantined",
      requestRef: request.requestRef,
      reasonCode: "EVENT_ID_COLLISION",
      evidenceReturned: false,
      proposalReturned: false,
      providerCallCount,
      studyMutationAllowed: false,
    };
  } catch {
    return {
      status: "quarantined",
      requestRef: request.requestRef,
      reasonCode: "LEDGER_FAILURE",
      evidenceReturned: false,
      proposalReturned: false,
      providerCallCount,
      studyMutationAllowed: false,
    };
  }
}

function nextHint(current: HintLevel, proposed: HintLevel): HintLevel {
  return HINT_ORDER[proposed] > HINT_ORDER[current] ? proposed : current;
}

function updateMemory(
  dependencies: TutorV2BridgeDependencies,
  invocation: TutorV2BridgeInvocation,
  request: TutorRequest,
  memory: TutorSessionMemoryState,
  proposal: TutorActionProposal,
): boolean {
  const result = dependencies.memory.update({
    memoryRef: invocation.memoryAccess.memoryRef,
    scope: invocation.memoryAccess.scope,
    patch: {
      hintLevelUsed: nextHint(memory.hintLevelUsed, proposal.hintLevel),
      currentConceptRef: request.studyAuthorityContext.instructionContext.conceptRef,
      lastTutorAction: proposal.action.kind,
      interventionCount: memory.interventionCount + 1,
    },
  });
  return result.status === "accepted";
}

function validateProviderResult(
  value: unknown,
  request: TutorRequest,
): ProviderExecutionResult | null {
  if (!isPlainRecord(value) || typeof value.status !== "string") return null;
  if (value.status === "success") {
    if (!exactKeys(value, ["status", "proposal", "fallbackRequired", "telemetry"]) || value.fallbackRequired !== false) return null;
    const telemetry = validateExact(TutorTelemetryEnvelopeSchema, value.telemetry);
    if (telemetry.status === "rejected" || !isPlainRecord(value.proposal)) return null;
    const rawAction = isPlainRecord(value.proposal.action)
      ? value.proposal.action.kind
      : undefined;
    if (
      value.proposal.interactionRef !== request.studyAuthorityContext.interactionRef ||
      telemetry.value.interactionRef !== request.studyAuthorityContext.interactionRef ||
      telemetry.value.providerRef !== request.budgetRoutingContext.route.providerRef ||
      telemetry.value.modelRef !== request.budgetRoutingContext.route.modelRef ||
      telemetry.value.outcomeCode !== "ACTION_PROPOSED" ||
      telemetry.value.action !== rawAction
    ) return null;
    return value as unknown as ProviderExecutionResult;
  }
  if (!FAILURE_STATUSES.has(value.status as ProviderFailureStatus)) return null;
  if (!exactKeys(value, ["status", "reason", "retryable", "fallbackRequired", "fallback", "telemetry"])) return null;
  if (
    typeof value.reason !== "string" ||
    !FAILURE_REASONS.has(value.reason as ProviderFailureReason) ||
    typeof value.retryable !== "boolean" ||
    value.fallbackRequired !== true ||
    validateExact(TutorStaticFallbackOutcomeSchema, value.fallback).status === "rejected" ||
    validateExact(TutorTelemetryEnvelopeSchema, value.telemetry).status === "rejected"
  ) return null;
  const fallback = validateExact(TutorStaticFallbackOutcomeSchema, value.fallback);
  const telemetry = validateExact(TutorTelemetryEnvelopeSchema, value.telemetry);
  const canonical = canonicalFailureReason(
    value.status as ProviderFailureStatus,
    value.reason as ProviderFailureReason,
  );
  const expectedRetryable =
    value.status === "unavailable" ||
    value.status === "timeout" ||
    value.status === "transient-failure";
  if (
    fallback.status === "rejected" ||
    telemetry.status === "rejected" ||
    fallback.value.interactionRef !== request.studyAuthorityContext.interactionRef ||
    fallback.value.reasonCode !== canonical ||
    value.retryable !== expectedRetryable ||
    telemetry.value.interactionRef !== request.studyAuthorityContext.interactionRef ||
    telemetry.value.providerRef !== request.budgetRoutingContext.route.providerRef ||
    telemetry.value.modelRef !== request.budgetRoutingContext.route.modelRef ||
    telemetry.value.outcomeCode !== canonical ||
    telemetry.value.action !== null
  ) return null;
  return value as unknown as ProviderExecutionResult;
}

function validateTurn(
  dependencies: TutorV2BridgeDependencies,
  proposal: TutorActionProposal,
  profile: AgeAwareTutorPolicyProfile,
  memory: TutorSessionMemoryState,
): boolean {
  let inspected: unknown;
  try {
    inspected = dependencies.ageTurnInspector.inspect({ proposal, profile, memory });
  } catch {
    return false;
  }
  return evaluateTutorTurnAgainstAgePolicy(profile, inspected).status === "allowed";
}

async function validateReviewedFallback(
  fallback: ReviewedStaticFallback,
  request: TutorRequest,
  profile: AgeAwareTutorPolicyProfile,
  memory: TutorSessionMemoryState,
  dependencies: TutorV2BridgeDependencies,
): Promise<TutorActionProposal | null> {
  let approval;
  try {
    approval = await dependencies.staticFallback.validate(fallback, request);
  } catch {
    return null;
  }
  if (
    !isPlainRecord(approval) ||
    !exactKeys(approval, approval.status === "accepted" ? ["status"] : ["status", "code"]) ||
    approval.status !== "accepted"
  ) return null;
  if (
    fallback.proposal.interactionRef !== request.studyAuthorityContext.interactionRef ||
    validateLearnerSafeTutorAction(fallback.proposal.action).status === "rejected"
  ) return null;
  const policy = evaluateTutorProposalPolicy(
    fallback.proposal,
    request.studyAuthorityContext,
    // This authority is Study-owned and applies only to an already reviewed
    // static fallback, never to a provider assertion.
    { completedAssessmentReviewAllowed: true },
  );
  if (policy.status !== "accepted") return null;
  return validateTurn(dependencies, policy.proposal, profile, memory)
    ? policy.proposal
    : null;
}

async function fallbackResult(
  context: FallbackContext,
  dependencies: TutorV2BridgeDependencies,
): Promise<TutorV2BridgeResult> {
  const { invocation, request, memory, ageProfile } = context;
  if (request === null || memory === null || ageProfile === null) {
    return {
      status: "fallback",
      requestRef: request?.requestRef ?? null,
      reasonCode: context.reasonCode,
      fallbackRef: invocation.reviewedFallback.fallbackRef,
      fallback: null,
      evidence: null,
      providerDetail: context.providerDetail,
      providerCallCount: context.providerCallCount,
      studyMutationAllowed: false,
    };
  }
  const proposal = await validateReviewedFallback(
    invocation.reviewedFallback,
    request,
    ageProfile,
    memory,
    dependencies,
  );
  if (proposal === null) {
    return {
      status: "fallback",
      requestRef: request.requestRef,
      reasonCode: context.reasonCode,
      fallbackRef: invocation.reviewedFallback.fallbackRef,
      fallback: null,
      evidence: null,
      providerDetail: context.providerDetail,
      providerCallCount: context.providerCallCount,
      studyMutationAllowed: false,
    };
  }
  const safeProjection = projection(proposal);
  const evidence = evidenceFor(invocation, request, proposal, context.reasonCode);
  if (evidence === null) {
    return {
      status: "fallback",
      requestRef: request.requestRef,
      reasonCode: context.reasonCode,
      fallbackRef: invocation.reviewedFallback.fallbackRef,
      fallback: null,
      evidence: null,
      providerDetail: context.providerDetail,
      providerCallCount: context.providerCallCount,
      studyMutationAllowed: false,
    };
  }
  const claim = await claimStudyFacingEffect(
    dependencies,
    request,
    invocation,
    { reasonCode: context.reasonCode, fallback: safeProjection, evidence },
    context.providerCallCount,
  );
  if (claim !== "appended") return claim;
  if (!updateMemory(dependencies, invocation, request, memory, proposal)) {
    return {
      status: "quarantined",
      requestRef: request.requestRef,
      reasonCode: "LEDGER_FAILURE",
      evidenceReturned: false,
      proposalReturned: false,
      providerCallCount: context.providerCallCount,
      studyMutationAllowed: false,
    };
  }
  return {
    status: "fallback",
    requestRef: request.requestRef,
    reasonCode: context.reasonCode,
    fallbackRef: invocation.reviewedFallback.fallbackRef,
    fallback: safeProjection,
    evidence,
    providerDetail: context.providerDetail,
    providerCallCount: context.providerCallCount,
    studyMutationAllowed: false,
  };
}

async function resolveInvocation(
  input: unknown,
  dependencies: TutorV2BridgeDependencies,
): Promise<ResolvedInvocation | TutorV2BridgeResult> {
  const invocationValidation = validateExact(TutorV2BridgeInvocationSchema, input);
  if (invocationValidation.status === "rejected") {
    return {
      status: "fallback",
      requestRef: null,
      reasonCode: "MALFORMED_RESPONSE",
      fallbackRef: "fallback:reviewed-static-curriculum",
      fallback: null,
      evidence: null,
      providerDetail: null,
      providerCallCount: 0,
      studyMutationAllowed: false,
    };
  }
  const invocation = invocationValidation.value;
  const requestValidation = validateExact(TutorRequestSchema, invocation.request);
  if (requestValidation.status === "rejected") {
    return fallbackResult(
      {
        invocation,
        request: null,
        memory: null,
        ageProfile: null,
        reasonCode: "MALFORMED_RESPONSE",
        providerDetail: null,
        providerCallCount: 0,
      },
      dependencies,
    );
  }
  const request = requestValidation.value;
  let now: number;
  try {
    now = dependencies.now();
  } catch {
    now = Number.NaN;
  }
  if (!validateTemporalBinding(invocation, request, now)) {
    return fallbackResult(
      { invocation, request, memory: null, ageProfile: null, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 0 },
      dependencies,
    );
  }

  let permission;
  try {
    permission = await dependencies.permission.consume(invocation.invocationPermission, request);
  } catch {
    permission = { status: "rejected" as const, code: "INVOCATION_NOT_AUTHORIZED" as const };
  }
  if (
    !isPlainRecord(permission) ||
    !exactKeys(
      permission,
      permission.status === "accepted" ? ["status"] : ["status", "code"],
    ) ||
    permission.status !== "accepted"
  ) {
    return fallbackResult(
      { invocation, request, memory: null, ageProfile: null, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 0 },
      dependencies,
    );
  }

  let safety;
  try {
    safety = await dependencies.safety.consume({
      safetyClearanceRef: request.studyAuthorityContext.safetyClearanceRef,
      interactionRef: request.studyAuthorityContext.interactionRef,
      safetyPolicyRef: request.studyAuthorityContext.policyRefs.safetyPolicyRef,
    });
  } catch {
    safety = { status: "rejected" as const, code: "SAFETY_CLASSIFIER_UNAVAILABLE" as const, adultReviewRequired: true };
  }
  if (
    !isPlainRecord(safety) ||
    !exactKeys(
      safety,
      safety.status === "accepted"
        ? ["status"]
        : ["status", "code", "adultReviewRequired"],
    ) ||
    (safety.status !== "accepted" && safety.status !== "rejected") ||
    (safety.status === "rejected" &&
      (typeof safety.adultReviewRequired !== "boolean" ||
        ![
          "SAFETY_CLEARANCE_REJECTED",
          "SAFETY_CLASSIFIER_UNAVAILABLE",
          "SAFETY_CLEARANCE_REPLAYED",
        ].includes(String(safety.code))))
  ) {
    safety = {
      status: "rejected" as const,
      code: "SAFETY_CLASSIFIER_UNAVAILABLE" as const,
      adultReviewRequired: true,
    };
  }
  if (
    safety.status !== "accepted" ||
    !request.studyAuthorityContext.instructionContext.safetyConstraints.mayContinueAcademicFlow
  ) {
    const code = safety.status === "rejected" ? safety.code : "SAFETY_CLEARANCE_REJECTED";
    return {
      status: "safety-stop",
      requestRef: request.requestRef,
      reasonCode: code,
      adultReviewHook:
        safety.status === "rejected" && safety.adultReviewRequired
          ? {
              hookKind: "study-adult-review-proposal",
              hookRef: `adult-review:${request.requestRef.split(":").at(-1) ?? "tutor"}`,
              interactionRef: request.studyAuthorityContext.interactionRef,
              reasonCode: "safety-dependent-interaction-stopped",
              deliveryStatus: "proposed-not-delivered",
              directIdentifiersIncluded: false,
              rawTutorContentIncluded: false,
            }
          : null,
      providerCallCount: 0,
      studyMutationAllowed: false,
    };
  }

  const age = dependencies.agePolicies.resolve(invocation.agePolicyBinding);
  if (
    age.status !== "resolved" ||
    validateExact(AgeAwareTutorPolicyProfileSchema, age.profile).status !== "accepted" ||
    !validateAgeDisclosure(invocation, age.profile)
  ) {
    return fallbackResult(
      { invocation, request, memory: null, ageProfile: null, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 0 },
      dependencies,
    );
  }

  const memory = dependencies.memory.read(invocation.memoryAccess);
  const memoryValidation = memory.status === "accepted"
    ? validateExact(TutorSessionMemoryStateSchema, memory.state)
    : null;
  if (
    memory.status !== "accepted" ||
    memoryValidation?.status !== "accepted" ||
    memory.state.interventionCount >= MAXIMUM_INTERVENTION_COUNT
  ) {
    return fallbackResult(
      { invocation, request, memory: null, ageProfile: age.profile, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 0 },
      dependencies,
    );
  }

  const minimized = minimizeProviderContext({
    studyAuthorityContext: request.studyAuthorityContext,
    disclosurePolicy: invocation.disclosurePolicy,
  });
  if (minimized.status !== "accepted") {
    return fallbackResult(
      { invocation, request, memory: memory.state, ageProfile: age.profile, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 0 },
      dependencies,
    );
  }
  let contentApproval;
  try {
    if (dependencies.reviewedContent === undefined) throw new Error("Reviewed content authority unavailable");
    contentApproval = await authorizeReviewedProviderContext(
      minimized.value,
      invocation.memoryAccess,
      dependencies.reviewedContent,
    );
  } catch {
    contentApproval = { status: "rejected" as const };
  }
  if (contentApproval.status !== "accepted") {
    return fallbackResult(
      { invocation, request, memory: memory.state, ageProfile: age.profile, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 0 },
      dependencies,
    );
  }

  return {
    invocation: immutableSnapshot(invocation),
    request: immutableSnapshot(request),
    memory: immutableSnapshot(memory.state),
    ageProfile: immutableSnapshot(age.profile),
    providerContext: immutableSnapshot(minimized.value),
  };
}

function providerExecutionRequest(resolved: ResolvedInvocation): ProviderExecutionRequest {
  const { request, providerContext } = resolved;
  return immutableSnapshot({
    contractVersion: request.contractVersion,
    actionSchemaVersion: request.actionSchemaVersion,
    compatibilityId: request.compatibilityId,
    actionCompatibilityId: request.actionCompatibilityId,
    envelope: "provider-execution-request",
    requestRef: request.requestRef,
    context: providerContext,
    shortTermState: request.shortTermState,
    budgetRoutingContext: request.budgetRoutingContext,
  });
}

/**
 * The single supported Study -> Tutor V2 -> Study orchestration route.
 * It returns proposals and minimized evidence only; it has no Study mutation
 * port and claims the atomic accepted-event ledger before returning effects.
 */
export async function orchestrateTutorV2Bridge(
  input: unknown,
  dependencies: TutorV2BridgeDependencies,
): Promise<TutorV2BridgeResult> {
  const resolved = await resolveInvocation(input, dependencies);
  if (!("providerContext" in resolved)) return resolved;
  const { invocation, request, memory, ageProfile, providerContext } = resolved;
  const providerRequest = providerExecutionRequest(resolved);

  let rawProviderResult: unknown;
  try {
    rawProviderResult = immutableSnapshot(await dependencies.provider.execute(providerRequest));
  } catch {
    return fallbackResult(
      {
        invocation,
        request,
        memory,
        ageProfile,
        reasonCode: "PROVIDER_UNAVAILABLE",
        providerDetail: {
          status: "transient-failure",
          reason: "TRANSPORT_EXCEPTION",
          retryable: true,
        },
        providerCallCount: 1,
      },
      dependencies,
    );
  }

  const providerResult = validateProviderResult(rawProviderResult, request);
  if (providerResult === null) {
    return fallbackResult(
      { invocation, request, memory, ageProfile, reasonCode: "MALFORMED_RESPONSE", providerDetail: null, providerCallCount: 1 },
      dependencies,
    );
  }
  if (providerResult.status !== "success") {
    const detail: ProviderFailureDetail = {
      status: providerResult.status,
      reason: providerResult.reason,
      retryable: providerResult.retryable,
    };
    return fallbackResult(
      {
        invocation,
        request,
        memory,
        ageProfile,
        reasonCode: canonicalFailureReason(providerResult.status, providerResult.reason),
        providerDetail: detail,
        providerCallCount: 1,
      },
      dependencies,
    );
  }

  const policy = evaluateTutorProposalPolicy(
    providerResult.proposal,
    request.studyAuthorityContext,
    invocation.assessmentPolicy,
  );
  if (policy.status !== "accepted") {
    const reasonCode: CanonicalBridgeFallbackReason =
      policy.status === "quarantined"
        ? "POLICY_REJECTION"
        : policy.code === "INSUFFICIENT_GROUNDED_CONTEXT"
          ? "INSUFFICIENT_GROUNDED_CONTEXT"
          : policy.code === "UNSUPPORTED_ACTION"
            ? "UNSUPPORTED_ACTION"
            : policy.issues.length > 0 &&
                policy.issues.every((issue) => issue.code === "unsupported-or-malformed-field")
              ? "MALFORMED_RESPONSE"
            : "POLICY_REJECTION";
    return fallbackResult(
      { invocation, request, memory, ageProfile, reasonCode, providerDetail: null, providerCallCount: 1 },
      dependencies,
    );
  }
  if (!ACTIONS.has(policy.proposal.action.kind)) {
    return fallbackResult(
      { invocation, request, memory, ageProfile, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 1 },
      dependencies,
    );
  }
  let contentApproval;
  try {
    if (dependencies.reviewedContent === undefined) throw new Error("Reviewed content authority unavailable");
    contentApproval = await authorizeReviewedLearnerAction(
      policy.proposal,
      providerContext,
      invocation.memoryAccess,
      dependencies.reviewedContent,
    );
  } catch {
    contentApproval = { status: "rejected" as const };
  }
  if (contentApproval.status !== "accepted") {
    return fallbackResult(
      { invocation, request, memory, ageProfile, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 1 },
      dependencies,
    );
  }
  if (!validateTurn(dependencies, policy.proposal, ageProfile, memory)) {
    return fallbackResult(
      { invocation, request, memory, ageProfile, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 1 },
      dependencies,
    );
  }

  const safeProjection = projection(policy.proposal);
  const evidence = evidenceFor(invocation, request, policy.proposal, null);
  if (evidence === null) {
    return fallbackResult(
      { invocation, request, memory, ageProfile, reasonCode: "POLICY_REJECTION", providerDetail: null, providerCallCount: 1 },
      dependencies,
    );
  }
  const hook = adultReviewHook(policy.proposal);
  const claim = await claimStudyFacingEffect(
    dependencies,
    request,
    invocation,
    { proposal: safeProjection, evidence, adultReviewHook: hook },
    1,
  );
  if (claim !== "appended") return claim;
  if (!updateMemory(dependencies, invocation, request, memory, policy.proposal)) {
    return {
      status: "quarantined",
      requestRef: request.requestRef,
      reasonCode: "LEDGER_FAILURE",
      evidenceReturned: false,
      proposalReturned: false,
      providerCallCount: 1,
      studyMutationAllowed: false,
    };
  }
  return {
    status: "accepted",
    requestRef: request.requestRef,
    proposal: safeProjection,
    evidence,
    adultReviewHook: hook,
    providerCallCount: 1,
    studyMutationAllowed: false,
  };
}
