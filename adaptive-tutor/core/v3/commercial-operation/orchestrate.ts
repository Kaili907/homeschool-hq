import { validateExact } from "../../v2/contracts/validation.js";
import {
  CURRICULUM_ADMISSION_VERSION,
  evaluateCurriculumAdmission,
  type TrustedCurriculumMetadata,
  type TutorCapabilityDeclaration,
} from "../curriculum-admission/index.js";
import {
  LEARNER_STAGE_CATALOG_BINDING_VERSION,
  createCommercialLearnerStagePolicyCatalog,
} from "../learner-stage-policy/index.js";
import { validateProviderModelOutput } from "../model-output/index.js";
import {
  constrainPresentationByLearnerStageAllowance,
  mapValidatedModelOutputToCommercialResponse,
  type CommercialModelResponse,
} from "../presentation/index.js";
import {
  createEligibleRouteCatalog,
  routeProviderModel,
  ROUTING_REQUEST_VERSION,
  type ModelCapabilityProfile,
  type ProviderAvailabilityState,
  type ProviderCapabilityProfile,
  type SubjectCapability,
} from "../routing/provider-routing/index.js";
import {
  BUDGET_RESILIENCE_VERSION,
  decideFallback,
  reserveCommercialRouteAttemptPlan,
  settleBudgetReservation,
  type AttemptBudget,
  type BudgetReservation,
  type BudgetSettlement,
  type ExecutionBudget,
} from "../routing/budget-resilience/index.js";
import {
  projectCommercialProviderRequest,
  type BoundedCommercialProviderRequest,
} from "../provider-request/index.js";
import {
  evaluateGrounding,
  type GroundingDecision,
} from "../grounding/index.js";
import {
  projectTutorCommercialTelemetry,
  type TutorCommercialTelemetryEvent,
} from "../telemetry/index.js";
import type {
  ProviderEligibilityRequirements,
  TrustedProviderProfileRegistry,
} from "../provider-policy/index.js";
import {
  BoundedCommercialProviderResponseSchema,
  StudyCommercialTutorInvocationSchema,
  type BoundedCommercialProviderResponse,
  type StudyCommercialTutorAdvisory,
  type StudyCommercialTutorInvocation,
} from "../contracts/index.js";
import {
  CommercialAttemptUsageReceiptSchema,
  type CommercialAttempt,
  type CommercialAttemptUsageReceipt,
} from "./contracts.js";

export type CommercialTransportFailureKind =
  | "provider-outage"
  | "rate-limit"
  | "confirmed-not-dispatched-transport-failure"
  | "provider-timeout"
  | "provider-rejection";

export interface CommercialTransportMetrics {
  readonly inputTokenCount: number;
  readonly outputTokenCount: number;
  readonly latencyMs: number;
  readonly costMicros: string;
}

export type CommercialProviderTransportResult =
  | {
      readonly status: "response";
      readonly response: unknown;
      readonly usageReceipt: unknown;
    }
  | {
      readonly status: "failure";
      readonly kind: CommercialTransportFailureKind;
      readonly metrics: CommercialTransportMetrics;
      readonly usageReceipt: unknown | null;
    };

export interface CommercialOperationClock {
  nowMs(): number;
}

export interface CommercialAttemptExecutionContext {
  readonly reservationRef: string;
  readonly operationStartedAtMs: number;
  readonly operationDeadlineAtMs: number;
  readonly attemptStartedAtMs: number;
  readonly attemptDeadlineAtMs: number;
  readonly attemptTimeoutMs: number;
  readonly remainingOperationMs: number;
}

/** Injected provider-neutral transport. Production adapters are out of scope. */
export interface CommercialProviderTransport {
  execute(
    request: BoundedCommercialProviderRequest,
    attempt: CommercialAttempt,
    context: CommercialAttemptExecutionContext,
  ): CommercialProviderTransportResult;
}

export interface CommercialTutorRoutingContext {
  readonly requestRef: string;
  readonly routePlanRef: string;
  readonly physicalAttemptRefs: readonly string[];
  readonly reservationRef: string;
  readonly eligibilityClassRef: string;
  readonly providerProfiles: readonly ProviderCapabilityProfile[];
  readonly modelProfiles: readonly ModelCapabilityProfile[];
  readonly providerPolicyRegistry: TrustedProviderProfileRegistry;
  readonly providerPolicyRequirements: readonly ProviderEligibilityRequirements[];
  readonly providerAvailability: readonly ProviderAvailabilityState[];
  readonly inputTokens: number;
  readonly requiredOutputTokens: number;
  readonly safetyRequirement: "MINOR_STANDARD" | "MINOR_HEIGHTENED";
  readonly reviewedContentRequirement:
    | "NOT_REQUIRED"
    | "PROVIDER_REVIEWED_GROUNDING_REQUIRED"
    | "STATIC_REVIEWED_ONLY";
  readonly latencyCeilingMs: number;
  readonly costCeilingMicros: string;
  readonly executionBudget: ExecutionBudget;
  readonly failoverBackoffMs: number;
  readonly deterministicReserveMs: number;
  readonly telemetryEventRefs: readonly string[];
}

export interface CommercialTutorExecutionInput {
  readonly invocation: unknown;
  readonly trustedScope: {
    readonly householdScopeRef: string;
    readonly learnerScopeRef: string;
    readonly sessionRef: string;
    readonly interactionRef: string;
  };
  readonly curriculumMetadata: TrustedCurriculumMetadata | unknown;
  readonly capabilityDeclaration: TutorCapabilityDeclaration | null;
  readonly routing: CommercialTutorRoutingContext;
  readonly clock: CommercialOperationClock;
  readonly transport: CommercialProviderTransport;
}

export type CommercialTutorExecutionResult =
  | {
      readonly status: "rejected";
      readonly reasonCode: "INVALID_STUDY_COMMERCIAL_INVOCATION";
      readonly providerCalls: 0;
      readonly telemetry: readonly [];
    }
  | {
      readonly status: "static-fallback";
      readonly advisory: StudyCommercialTutorAdvisory;
      readonly providerCalls: number;
      readonly telemetry: readonly TutorCommercialTelemetryEvent[];
    }
  | {
      readonly status: "advisory";
      readonly advisory: StudyCommercialTutorAdvisory;
      readonly commercialResponse: CommercialModelResponse;
      readonly reservation: BudgetReservation;
      readonly settlement: BudgetSettlement;
      readonly usageReceipts: readonly CommercialAttemptUsageReceipt[];
      readonly providerCalls: number;
      readonly telemetry: readonly TutorCommercialTelemetryEvent[];
    };

type AdvisoryReasonCode = StudyCommercialTutorAdvisory["reasonCodes"][number];

function staticAdvisory(
  invocation: StudyCommercialTutorInvocation,
  reasonCode: AdvisoryReasonCode,
): StudyCommercialTutorAdvisory {
  return Object.freeze({
    contractVersion: "study-tutor-v3.commercial-advisory.v1",
    advisoryKind: "study-commercial-tutor-advisory",
    invocationRef: invocation.interactionRef,
    householdScopeRef: invocation.householdScopeRef,
    learnerScopeRef: invocation.learnerScopeRef,
    sessionRef: invocation.sessionRef,
    interactionRef: invocation.interactionRef,
    logicalOperationRef: invocation.logicalOperationRef,
    opportunityRef: invocation.curriculum.opportunityRef,
    status: "static-fallback-required",
    proposedTutorAction: null,
    reasonCodes: [reasonCode],
    reviewedContentRefs: [],
    groundingDecision: "not-executed",
    assistanceEvidenceRef: null,
    presentationIntent: null,
    studyDecisionRequired: true,
    studyMutationAllowed: false,
    officialMasteryAuthority: false,
    officialWorkingLevelAuthority: false,
    nominalGradeAuthority: false,
    curriculumAuthority: false,
    segmentCompletionAuthority: false,
  });
}

function finalizedAdvisory(
  invocation: StudyCommercialTutorInvocation,
  response: CommercialModelResponse,
  grounding: GroundingDecision | null,
): StudyCommercialTutorAdvisory {
  const proposal = response.validationStatus === "accepted-proposal";
  const reasonCode: AdvisoryReasonCode = proposal
    ? "COMMERCIAL_PROPOSAL_READY"
    : "PROVIDER_REFUSED";
  return Object.freeze({
    contractVersion: "study-tutor-v3.commercial-advisory.v1",
    advisoryKind: "study-commercial-tutor-advisory",
    invocationRef: invocation.interactionRef,
    householdScopeRef: invocation.householdScopeRef,
    learnerScopeRef: invocation.learnerScopeRef,
    sessionRef: invocation.sessionRef,
    interactionRef: invocation.interactionRef,
    logicalOperationRef: invocation.logicalOperationRef,
    opportunityRef: invocation.curriculum.opportunityRef,
    status: proposal ? "proposed" : "refused",
    proposedTutorAction: proposal ? response.validatedOutput.requestedTutorAction : null,
    reasonCodes: [reasonCode],
    reviewedContentRefs: proposal ? [...response.validatedOutput.reviewedContentRefs] : [],
    groundingDecision: grounding?.status === "grounded" ? "sufficient" : "insufficient",
    assistanceEvidenceRef: proposal ? invocation.curriculum.opportunityRef : null,
    presentationIntent: proposal ? response.presentationIntent : null,
    studyDecisionRequired: true,
    studyMutationAllowed: false,
    officialMasteryAuthority: false,
    officialWorkingLevelAuthority: false,
    nominalGradeAuthority: false,
    curriculumAuthority: false,
    segmentCompletionAuthority: false,
  });
}

function toAttemptBudget(
  attempt: CommercialAttempt,
  context: CommercialTutorRoutingContext,
): AttemptBudget {
  return {
    ...attempt,
    contractVersion: BUDGET_RESILIENCE_VERSION,
    eligibilityClassRef: context.eligibilityClassRef,
    hardConstraintsSatisfied: true,
    backoffBeforeMs: attempt.attemptIndex === 0 ? 0 : context.failoverBackoffMs,
  };
}

function telemetryFor(
  attempt: CommercialAttempt,
  reservation: BudgetReservation,
  context: CommercialTutorRoutingContext,
  result: {
    readonly status: "success" | "failure";
    readonly metrics: CommercialTransportMetrics;
    readonly reasonCode?: string;
  },
): TutorCommercialTelemetryEvent | null {
  const eventRef = context.telemetryEventRefs[attempt.attemptIndex];
  if (!eventRef) return null;
  const projected = projectTutorCommercialTelemetry(
    {
      status: result.status,
      eventRef,
      actionFamily: "other",
      routeClass: "unknown",
      cacheClass: "not-applicable",
      fallbackClass: attempt.role === "failover" ? "alternate-provider" : "none",
      reasonCode: result.reasonCode,
      metrics: result.metrics,
    },
    { attempt, reservation },
  );
  return projected.status === "projected" ? projected.event : null;
}

function executionFailureReason(kind: CommercialTransportFailureKind): string {
  switch (kind) {
    case "provider-outage":
      return "PROVIDER_UNAVAILABLE";
    case "provider-timeout":
      return "PROVIDER_TIMEOUT";
    case "provider-rejection":
      return "POLICY_REJECTION";
    case "rate-limit":
    case "confirmed-not-dispatched-transport-failure":
      return "UNKNOWN_FAILURE";
  }
}

function responseMetrics(response: BoundedCommercialProviderResponse): CommercialTransportMetrics {
  return response.metrics;
}

function checkedMillisecondsSum(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER - total) {
      return null;
    }
    total += value;
  }
  return total;
}

function readMonotonicClock(
  clock: CommercialOperationClock,
  notBeforeMs: number | null,
): number | null {
  try {
    const value = clock.nowMs();
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      (notBeforeMs !== null && value < notBeforeMs)
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function validateUsageReceipt(
  receiptInput: unknown,
  reservation: BudgetReservation,
  attempt: CommercialAttempt,
  actualCostMicros: string,
): CommercialAttemptUsageReceipt | null {
  const validation = validateExact(CommercialAttemptUsageReceiptSchema, receiptInput);
  if (validation.status === "rejected") return null;
  const receipt = validation.value;
  if (
    receipt.logicalOperationRef !== attempt.logicalOperationRef ||
    receipt.physicalAttemptRef !== attempt.physicalAttemptRef ||
    receipt.reservationRef !== reservation.reservationRef ||
    receipt.routeRef !== attempt.routeRef ||
    receipt.attemptIndex !== attempt.attemptIndex ||
    receipt.role !== attempt.role ||
    receipt.reservedCostMicros !== attempt.reservedCostMicros ||
    receipt.actualCostMicros !== actualCostMicros
  ) {
    return null;
  }
  try {
    if (BigInt(receipt.actualCostMicros) > BigInt(attempt.reservedCostMicros)) return null;
  } catch {
    return null;
  }
  return receipt;
}

/**
 * Deterministic provider-independent Wave 3 path. It stops before every
 * untrusted or unauthorized seam and returns only an advisory to Study.
 */
export function executeCommercialTutorInvocation(
  input: CommercialTutorExecutionInput,
): CommercialTutorExecutionResult {
  const operationStartedAtMs = readMonotonicClock(input.clock, null);
  const invocationValidation = validateExact(
    StudyCommercialTutorInvocationSchema,
    input.invocation,
  );
  if (invocationValidation.status === "rejected") {
    return {
      status: "rejected",
      reasonCode: "INVALID_STUDY_COMMERCIAL_INVOCATION",
      providerCalls: 0,
      telemetry: [],
    };
  }
  const invocation = invocationValidation.value;
  const operationDeadlineAtMs = operationStartedAtMs === null
    ? null
    : checkedMillisecondsSum([operationStartedAtMs, input.routing.latencyCeilingMs]);
  if (operationStartedAtMs === null || operationDeadlineAtMs === null) {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "BUDGET_OR_DEADLINE_EXHAUSTED"),
      providerCalls: 0,
      telemetry: [],
    };
  }
  if (
    invocation.householdScopeRef !== input.trustedScope.householdScopeRef ||
    invocation.learnerScopeRef !== input.trustedScope.learnerScopeRef ||
    invocation.sessionRef !== input.trustedScope.sessionRef ||
    invocation.interactionRef !== input.trustedScope.interactionRef ||
    invocation.groundedContext.scopeRef !== input.trustedScope.interactionRef
  ) {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "CURRICULUM_ADMISSION_FAILED"),
      providerCalls: 0,
      telemetry: [],
    };
  }

  const curriculumDecision = evaluateCurriculumAdmission(input.curriculumMetadata, {
    inputKind: "curriculum-tutor-admission",
    request: {
      requestVersion: CURRICULUM_ADMISSION_VERSION,
      requestKind: "curriculum-tutor-admission-request",
      capabilityRef: "guided-instruction",
      courseRef: invocation.curriculum.courseRef,
      subjectRef: invocation.curriculum.subjectId,
      unitRef: invocation.curriculum.unitRef,
      lessonRef: invocation.curriculum.lessonRef,
      nominalGrade: invocation.nominalGrade,
      officialWorkingLevel: invocation.officialWorkingLevel,
      assessmentPhase: invocation.assessmentPhase,
      actionFamily: "guided-support",
    },
    studyAuthorityScope: {
      scopeKind: "study-curriculum-tutor-authority",
      authorityRef: invocation.authorization.curriculumAuthorityRef,
      learnerScopeRef: invocation.learnerScopeRef,
      sessionRef: invocation.sessionRef,
      curriculumReleaseRef: invocation.curriculum.releaseRef,
      courseRef: invocation.curriculum.courseRef,
      subjectRef: invocation.curriculum.subjectId,
      unitRef: invocation.curriculum.unitRef,
      lessonRef: invocation.curriculum.lessonRef,
      nominalGrade: invocation.nominalGrade,
      officialWorkingLevel: invocation.officialWorkingLevel,
      allowedActionFamilies: ["guided-support"],
      curriculumAssignmentAllowed: false,
      officialWorkingLevelMutationAllowed: false,
    },
    capabilityDeclaration: input.capabilityDeclaration,
  });
  const metadata = input.curriculumMetadata as Partial<TrustedCurriculumMetadata>;
  if (
    curriculumDecision.status !== "admitted" ||
    metadata.releaseRef !== invocation.curriculum.releaseRef ||
    metadata.packageRef !== invocation.curriculum.packageRef ||
    metadata.releaseVersion !== invocation.curriculum.version ||
    metadata.releaseDigest !== invocation.curriculum.digest ||
    curriculumDecision.releaseRef !== invocation.curriculum.releaseRef ||
    curriculumDecision.subjectRef !== invocation.curriculum.subjectId ||
    curriculumDecision.courseRef !== invocation.curriculum.courseRef ||
    curriculumDecision.unitRef !== invocation.curriculum.unitRef ||
    curriculumDecision.lessonRef !== invocation.curriculum.lessonRef ||
    invocation.subjectRef !== `subject:${curriculumDecision.subjectRef}`
  ) {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "CURRICULUM_ADMISSION_FAILED"),
      providerCalls: 0,
      telemetry: [],
    };
  }

  const stageResolution = createCommercialLearnerStagePolicyCatalog().resolve({
    contractVersion: LEARNER_STAGE_CATALOG_BINDING_VERSION,
    bindingKind: "trusted-study-learner-stage-catalog-binding",
    bindingSource: "study-runtime",
    catalogVersion: invocation.authorization.learnerStageCatalogVersion,
    policyRevisionRef: invocation.authorization.learnerStagePolicyRevisionRef,
    learnerStageRef: invocation.learnerStageRef,
  });
  if (stageResolution.status !== "resolved") {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "LEARNER_STAGE_POLICY_FAILED"),
      providerCalls: 0,
      telemetry: [],
    };
  }

  if (
    input.routing.providerPolicyRequirements.some(
      (requirement) =>
        requirement.requiredContractPolicyRevision !==
        invocation.authorization.providerPolicyRevisionRef,
    )
  ) {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "NO_ELIGIBLE_PROVIDER_ROUTE"),
      providerCalls: 0,
      telemetry: [],
    };
  }
  const eligibleCatalog = createEligibleRouteCatalog({
    providerProfiles: input.routing.providerProfiles,
    modelProfiles: input.routing.modelProfiles,
    providerPolicyRegistry: input.routing.providerPolicyRegistry,
    providerPolicyRequirements: input.routing.providerPolicyRequirements,
  });
  if (eligibleCatalog === null) {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "NO_ELIGIBLE_PROVIDER_ROUTE"),
      providerCalls: 0,
      telemetry: [],
    };
  }

  const routeDecision = routeProviderModel(
    {
      requestVersion: ROUTING_REQUEST_VERSION,
      requestRef: input.routing.requestRef,
      routePlanRef: input.routing.routePlanRef,
      logicalOperationRef: invocation.logicalOperationRef,
      physicalAttemptRefs: input.routing.physicalAttemptRefs,
      actionFamily: invocation.requestedActionFamily,
      subjectCapability: invocation.subjectCapability as SubjectCapability,
      learnerStage: stageResolution.routingStageClass,
      contextSizeRequirement: {
        inputTokens: input.routing.inputTokens,
        requiredOutputTokens: input.routing.requiredOutputTokens,
      },
      safetyRequirement: input.routing.safetyRequirement,
      latencyCeilingMs: input.routing.latencyCeilingMs,
      costCeilingMicros: input.routing.costCeilingMicros,
      reviewedContentRequirement: input.routing.reviewedContentRequirement,
      multimodalRequirement: invocation.requestedPresentation.modalityRequirement,
      providerAvailability: input.routing.providerAvailability,
      studyPermissionBoundary: {
        permissionRef: invocation.authorization.studyPermissionRef,
        authorizedActionFamily: invocation.requestedActionFamily,
        routingMayWidenPermissions: false,
        routingMayChangeMastery: false,
        routingMayChangeGrade: false,
        routingMayChangeWorkingLevel: false,
        routingMayChangeCurriculum: false,
      },
      staticFallbackPolicyRef: input.routing.executionBudget.reviewedStaticFallback.policyRef,
    },
    eligibleCatalog,
  );
  if (routeDecision.status !== "ROUTE_SELECTED") {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "NO_ELIGIBLE_PROVIDER_ROUTE"),
      providerCalls: 0,
      telemetry: [],
    };
  }

  const reservation = reserveCommercialRouteAttemptPlan({
    executionBudget: input.routing.executionBudget,
    reservationRef: input.routing.reservationRef,
    routeAttemptPlan: routeDecision.routeAttemptPlan,
    eligibilityClassRef: input.routing.eligibilityClassRef,
    failoverBackoffMs: input.routing.failoverBackoffMs,
  });
  if (!("status" in reservation) || reservation.status !== "reserved") {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "BUDGET_OR_DEADLINE_EXHAUSTED"),
      providerCalls: 0,
      telemetry: [],
    };
  }

  const providerRequest = projectCommercialProviderRequest({
    factsKind: "trusted-study-commercial-invocation-facts",
    invocationRef: invocation.interactionRef,
    logicalOperationRef: invocation.logicalOperationRef,
    academicScope: {
      subjectRef: `subject:${curriculumDecision.subjectRef}`,
      courseRef: `course:${curriculumDecision.courseRef}`,
      conceptRef: invocation.curriculum.conceptRef,
    },
    actionFamily: invocation.requestedActionFamily,
    assessmentPhase: invocation.assessmentPhase,
    reviewedContentEvidence: invocation.reviewedContentEvidence,
    groundingEvidence: invocation.groundedContext.items.map((item) => ({
      groundingRef: item.contextRef,
      contentDigest: item.contentDigest,
    })),
    presentationRequirement:
      invocation.requestedPresentation.modalityRequirement === "TEXT_ONLY"
        ? "TEXT_ONLY"
        : "REVIEWED_VISUAL_REFERENCE",
    policyRefs: {
      learnerStagePolicyRef: stageResolution.profile.profileRef,
      providerPolicyRef: invocation.authorization.providerPolicyRevisionRef,
      configurationRef: invocation.authorization.configurationRef,
      safetyPolicyRef: invocation.authorization.safetyPolicyRef,
      presentationPolicyRef: invocation.authorization.presentationPolicyRef,
    },
  });
  if (providerRequest.status !== "accepted-commercial-provider-request") {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "UNTRUSTED_MODEL_OUTPUT_REJECTED"),
      providerCalls: 0,
      telemetry: [],
    };
  }

  const telemetry: TutorCommercialTelemetryEvent[] = [];
  const usageReceipts: CommercialAttemptUsageReceipt[] = [];
  const indeterminateTimeoutAttemptRefs: string[] = [];
  let providerCalls = 0;
  let acceptedResponse: BoundedCommercialProviderResponse | null = null;
  let lastClockReadingMs = operationStartedAtMs;
  for (let index = 0; index < reservation.attempts.length; index += 1) {
    const attempt = reservation.attempts[index];
    if (!attempt) break;
    const attemptStartedAtMs = readMonotonicClock(input.clock, lastClockReadingMs);
    if (attemptStartedAtMs === null) {
      return {
        status: "static-fallback",
        advisory: staticAdvisory(invocation, "BUDGET_OR_DEADLINE_EXHAUSTED"),
        providerCalls,
        telemetry,
      };
    }
    lastClockReadingMs = attemptStartedAtMs;
    const dispatchWindowEndMs = checkedMillisecondsSum([
      attemptStartedAtMs,
      input.routing.deterministicReserveMs,
      index === 0 ? 0 : input.routing.failoverBackoffMs,
      attempt.timeoutMs,
    ]);
    const attemptDeadlineAtMs = checkedMillisecondsSum([
      attemptStartedAtMs,
      attempt.timeoutMs,
    ]);
    if (
      dispatchWindowEndMs === null ||
      attemptDeadlineAtMs === null ||
      dispatchWindowEndMs > operationDeadlineAtMs ||
      attemptStartedAtMs >= operationDeadlineAtMs
    ) {
      break;
    }
    providerCalls += 1;
    let transportResult: CommercialProviderTransportResult;
    try {
      transportResult = input.transport.execute(providerRequest.request, attempt, {
        reservationRef: reservation.reservationRef,
        operationStartedAtMs,
        operationDeadlineAtMs,
        attemptStartedAtMs,
        attemptDeadlineAtMs: Math.min(attemptDeadlineAtMs, operationDeadlineAtMs),
        attemptTimeoutMs: attempt.timeoutMs,
        remainingOperationMs: operationDeadlineAtMs - attemptStartedAtMs,
      });
    } catch {
      transportResult = {
        status: "failure",
        kind: "confirmed-not-dispatched-transport-failure",
        metrics: { inputTokenCount: 0, outputTokenCount: 0, latencyMs: 0, costMicros: "0" },
        usageReceipt: null,
      };
    }
    const attemptCompletedAtMs = readMonotonicClock(input.clock, lastClockReadingMs);
    if (attemptCompletedAtMs === null) {
      return {
        status: "static-fallback",
        advisory: staticAdvisory(invocation, "BUDGET_OR_DEADLINE_EXHAUSTED"),
        providerCalls,
        telemetry,
      };
    }
    lastClockReadingMs = attemptCompletedAtMs;
    const observedAttemptMs = attemptCompletedAtMs - attemptStartedAtMs;
    let failureKind: CommercialTransportFailureKind | null = null;
    let failureMetrics: CommercialTransportMetrics | null = null;
    let reportedLatencyMs: number;

    if (transportResult.status === "response") {
      const responseValidation = validateExact(
        BoundedCommercialProviderResponseSchema,
        transportResult.response,
      );
      if (responseValidation.status === "rejected") {
        return {
          status: "static-fallback",
          advisory: staticAdvisory(invocation, "UNTRUSTED_MODEL_OUTPUT_REJECTED"),
          providerCalls,
          telemetry,
        };
      }
      const response = responseValidation.value;
      const receipt = validateUsageReceipt(
        transportResult.usageReceipt,
        reservation,
        attempt,
        response.metrics.costMicros,
      );
      if (receipt === null) {
        return {
          status: "static-fallback",
          advisory: staticAdvisory(invocation, "BUDGET_OR_DEADLINE_EXHAUSTED"),
          providerCalls,
          telemetry,
        };
      }
      usageReceipts.push(receipt);
      reportedLatencyMs = response.metrics.latencyMs;
      const reportedCompletionElapsedMs = checkedMillisecondsSum([
        attemptStartedAtMs - operationStartedAtMs,
        reportedLatencyMs,
      ]);
      const operationElapsedMs = Math.max(
        attemptCompletedAtMs - operationStartedAtMs,
        reportedCompletionElapsedMs ?? Number.MAX_SAFE_INTEGER,
      );
      const late =
        observedAttemptMs > attempt.timeoutMs ||
        reportedLatencyMs > attempt.timeoutMs ||
        attemptCompletedAtMs > operationDeadlineAtMs ||
        operationElapsedMs > input.routing.latencyCeilingMs;
      if (!late) {
        acceptedResponse = response;
        const event = telemetryFor(attempt, reservation, input.routing, {
          status: "success",
          metrics: responseMetrics(response),
        });
        if (event) telemetry.push(event);
        break;
      }
      failureKind = "provider-timeout";
      failureMetrics = response.metrics;
    } else {
      reportedLatencyMs = transportResult.metrics.latencyMs;
      if (
        !Number.isSafeInteger(reportedLatencyMs) ||
        reportedLatencyMs < 0 ||
        !/^(0|[1-9][0-9]*)$/.test(transportResult.metrics.costMicros)
      ) {
        return {
          status: "static-fallback",
          advisory: staticAdvisory(invocation, "BUDGET_OR_DEADLINE_EXHAUSTED"),
          providerCalls,
          telemetry,
        };
      }
      if (transportResult.usageReceipt === null) {
        if (transportResult.kind === "provider-timeout") {
          indeterminateTimeoutAttemptRefs.push(attempt.physicalAttemptRef);
        } else if (transportResult.kind !== "confirmed-not-dispatched-transport-failure") {
          return {
            status: "static-fallback",
            advisory: staticAdvisory(invocation, "BUDGET_OR_DEADLINE_EXHAUSTED"),
            providerCalls,
            telemetry,
          };
        }
      } else {
        const receipt = validateUsageReceipt(
          transportResult.usageReceipt,
          reservation,
          attempt,
          transportResult.metrics.costMicros,
        );
        if (receipt === null) {
          return {
            status: "static-fallback",
            advisory: staticAdvisory(invocation, "BUDGET_OR_DEADLINE_EXHAUSTED"),
            providerCalls,
            telemetry,
          };
        }
        usageReceipts.push(receipt);
      }
      failureKind =
        observedAttemptMs > attempt.timeoutMs ||
        reportedLatencyMs > attempt.timeoutMs ||
        attemptCompletedAtMs > operationDeadlineAtMs
          ? "provider-timeout"
          : transportResult.kind;
      failureMetrics = transportResult.metrics;
    }

    const event = telemetryFor(attempt, reservation, input.routing, {
      status: "failure",
      metrics: failureMetrics,
      reasonCode: executionFailureReason(failureKind),
    });
    if (event) telemetry.push(event);

    const primary = reservation.attempts[0];
    const failover = reservation.attempts[1];
    if (!primary) break;
    const reportedCompletionElapsedMs = checkedMillisecondsSum([
      attemptStartedAtMs - operationStartedAtMs,
      reportedLatencyMs,
    ]);
    const elapsedMs = Math.max(
      attemptCompletedAtMs - operationStartedAtMs,
      reportedCompletionElapsedMs ?? Number.MAX_SAFE_INTEGER,
    );
    const fallback = decideFallback({
      executionBudget: input.routing.executionBudget,
      reservation,
      latencyBudget: {
        contractVersion: BUDGET_RESILIENCE_VERSION,
        endToEndDeadlineMs: input.routing.latencyCeilingMs,
        deterministicReserveMs: input.routing.deterministicReserveMs,
        elapsedMs,
      },
      retryPolicy: {
        contractVersion: BUDGET_RESILIENCE_VERSION,
        maximumPhysicalAttempts: reservation.attempts.length as 1 | 2,
        maximumSameRouteRetries: 0,
        retryableFailures: [
          "provider-outage",
          "rate-limit",
          "confirmed-not-dispatched-transport-failure",
          "provider-timeout",
        ],
        backoffMs: input.routing.failoverBackoffMs,
        requireFreshAvailability: true,
        requireEqualHardEligibility: true,
        requireRemainingDeadlineAndBudget: true,
        retainFullReserveOnIndeterminateTimeout: true,
      },
      attemptsCompleted: 1,
      primaryAttempt: toAttemptBudget(primary, input.routing),
      failoverAttempt: failover ? toAttemptBudget(failover, input.routing) : null,
      failure: {
        kind: failureKind,
        retryAfterMs: null,
        indeterminatePrimaryReserveHeld: failureKind === "provider-timeout",
      },
      failoverAvailability: "eligible",
      failoverCircuitState: {
        state: "closed",
        windowStartedAtMs: 0,
        sampleCount: 0,
        failureCount: 0,
        consecutiveFailureCount: 0,
      },
    });
    if (fallback.decision !== "commercial-failover" || index !== 0) break;
  }

  if (acceptedResponse === null) {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "PROVIDER_TRANSPORT_FAILED"),
      providerCalls,
      telemetry,
    };
  }
  const settlement = settleBudgetReservation(
    reservation,
    usageReceipts,
    indeterminateTimeoutAttemptRefs,
  );
  if (settlement === null || settlement.costAnomaly) {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "BUDGET_OR_DEADLINE_EXHAUSTED"),
      providerCalls,
      telemetry,
    };
  }

  const validatedOutput = validateProviderModelOutput(acceptedResponse.output, {
    assessmentPhase: invocation.assessmentPhase,
    reviewedContentRefs: invocation.reviewedContentEvidence.map((item) => item.contentRef),
    groundingRefs: invocation.groundedContext.items.map((item) => item.contextRef),
    allowedTutorActions: invocation.allowedTutorActions,
    allowedInstructionalDisplayModes: invocation.requestedPresentation.allowedDisplayModes,
  });
  if (validatedOutput.status !== "accepted-proposal" && validatedOutput.status !== "refused") {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "UNTRUSTED_MODEL_OUTPUT_REJECTED"),
      providerCalls,
      telemetry,
    };
  }

  let grounding: GroundingDecision | null = null;
  if (validatedOutput.status === "accepted-proposal") {
    grounding = evaluateGrounding(
      invocation.groundedContext,
      invocation.groundingRequirements,
      acceptedResponse.groundedClaims,
    );
    if (grounding.status !== "grounded") {
      return {
        status: "static-fallback",
        advisory: staticAdvisory(invocation, "INSUFFICIENT_GROUNDED_CONTEXT"),
        providerCalls,
        telemetry,
      };
    }
  }

  const mapped = mapValidatedModelOutputToCommercialResponse(
    validatedOutput,
    invocation.requestedPresentation.mappingContext,
  );
  if (mapped.status !== "accepted") {
    return {
      status: "static-fallback",
      advisory: staticAdvisory(invocation, "PRESENTATION_INTENT_REJECTED"),
      providerCalls,
      telemetry,
    };
  }
  if (mapped.response.validationStatus === "accepted-proposal") {
    const stagePresentation = constrainPresentationByLearnerStageAllowance(
      mapped.response.presentationIntent,
      stageResolution.policyProfile.bounds.multimodalAllowance,
    );
    if (stagePresentation.status !== "allowed") {
      return {
        status: "static-fallback",
        advisory: staticAdvisory(invocation, "PRESENTATION_INTENT_REJECTED"),
        providerCalls,
        telemetry,
      };
    }
  }

  return {
    status: "advisory",
    advisory: finalizedAdvisory(invocation, mapped.response, grounding),
    commercialResponse: mapped.response,
    reservation,
    settlement: Object.freeze({ ...settlement }),
    usageReceipts: usageReceipts.map((receipt) => Object.freeze({ ...receipt })),
    providerCalls,
    telemetry,
  };
}
