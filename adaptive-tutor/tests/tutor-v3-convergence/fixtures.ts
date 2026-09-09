import {
  BOUNDED_COMMERCIAL_PROVIDER_RESPONSE_VERSION,
  STUDY_COMMERCIAL_TUTOR_INVOCATION_VERSION,
  type StudyCommercialTutorInvocation,
} from "../../core/v3/contracts/index.js";
import {
  BUDGET_RESILIENCE_VERSION,
  type ExecutionBudget,
} from "../../core/v3/routing/budget-resilience/index.js";
import {
  MODEL_CAPABILITY_PROFILE_VERSION,
  PROVIDER_AVAILABILITY_STATE_VERSION,
  PROVIDER_CAPABILITY_PROFILE_VERSION,
  type ModelCapabilityProfile,
  type ProviderAvailabilityState,
  type ProviderCapabilityProfile,
} from "../../core/v3/routing/provider-routing/index.js";
import {
  createTrustedProviderProfileRegistry,
  type ProviderEligibilityRequirements,
  type TrustedProviderProfile,
} from "../../core/v3/provider-policy/index.js";
import {
  CURRICULUM_METADATA_VERSION,
  type TrustedCurriculumMetadata,
  type TutorCapabilityDeclaration,
} from "../../core/v3/curriculum-admission/index.js";
import {
  type CommercialAttemptExecutionContext,
  type CommercialOperationClock,
  type CommercialProviderTransportResult,
  type CommercialTutorExecutionInput,
} from "../../core/v3/commercial-operation/orchestrate.js";
import {
  COMMERCIAL_ATTEMPT_USAGE_RECEIPT_VERSION,
  COMMERCIAL_EXECUTION_SCOPE_VERSION,
  type CommercialAttempt,
} from "../../core/v3/commercial-operation/contracts.js";
import {
  COMMERCIAL_EXECUTION_ELIGIBILITY_VERSION,
  InMemoryPhysicalAttemptDispatchClaimStore,
  type CommercialExecutionEligibilityResolver,
  type CurrentCommercialExecutionEligibilityRequest,
  type PhysicalAttemptDispatchClaimPort,
} from "../../core/v3/commercial-operation/execution-integrity.js";
import {
  GROUNDING_CONTRACT_VERSION,
} from "../../core/v3/grounding/index.js";
import {
  LEARNER_STAGE_CATALOG_VERSION,
  LEARNER_STAGE_POLICY_REVISION_REF,
} from "../../core/v3/learner-stage-policy/index.js";

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;
const DIGEST_C = `sha256:${"c".repeat(64)}`;
const DIGEST_D = `sha256:${"d".repeat(64)}`;
const DIGEST_F = `sha256:${"f".repeat(64)}`;

type ScriptedCommercialTransportResult =
  | (Omit<Extract<CommercialProviderTransportResult, { status: "response" }>, "usageReceipt"> & {
      readonly usageReceipt?: unknown;
      readonly observedExecutionMs?: number;
    })
  | (Omit<Extract<CommercialProviderTransportResult, { status: "failure" }>, "usageReceipt"> & {
      readonly usageReceipt?: unknown | null;
      readonly observedExecutionMs?: number;
    });

export class ManualCommercialOperationClock implements CommercialOperationClock {
  #nowMs = 0;

  nowMs(): number {
    return this.#nowMs;
  }

  advance(milliseconds: number): void {
    this.#nowMs += milliseconds;
  }
}

export interface MutableExecutionEligibilityState {
  availabilityState: "AVAILABLE" | "OUTAGE";
  circuitState: "closed" | "open";
  providerPolicyState: "active" | "revoked";
}

export class MutableCommercialExecutionEligibilityResolver
implements CommercialExecutionEligibilityResolver {
  readonly #states = new Map<string, MutableExecutionEligibilityState>();

  setProviderState(
    providerRef: string,
    state: Partial<MutableExecutionEligibilityState>,
  ): void {
    const current = this.#states.get(providerRef) ?? {
      availabilityState: "AVAILABLE",
      circuitState: "closed",
      providerPolicyState: "active",
    };
    this.#states.set(providerRef, { ...current, ...state });
  }

  resolve(request: CurrentCommercialExecutionEligibilityRequest): unknown {
    const state = this.#states.get(request.attempt.providerRef) ?? {
      availabilityState: "AVAILABLE",
      circuitState: "closed",
      providerPolicyState: "active",
    };
    const suffix = request.attempt.providerRef.split(":").at(-1) ?? "unknown";
    return {
      contractVersion: COMMERCIAL_EXECUTION_ELIGIBILITY_VERSION,
      evidenceKind: "trusted-current-commercial-execution-eligibility",
      issuedBy: "study-runtime",
      phase: request.phase,
      commercialScopeRef: request.commercialScopeRef,
      reservationRef: request.reservationRef,
      logicalOperationRef: request.attempt.logicalOperationRef,
      physicalAttemptRef: request.attempt.physicalAttemptRef,
      routeRef: request.attempt.routeRef,
      providerRef: request.attempt.providerRef,
      modelRef: request.attempt.modelRef,
      modelRevisionRef: request.attempt.modelRevisionRef,
      configurationDigest: request.attempt.configurationDigest,
      capabilityProfileRevisionRef: request.attempt.capabilityProfileRevisionRef,
      capabilityProfileDigest: request.attempt.capabilityProfileDigest,
      providerPolicyRevisionRef: request.attempt.providerPolicyRevisionRef,
      providerPolicyEvidenceRef: request.attempt.providerPolicyEvidenceRef,
      providerPolicyState: state.providerPolicyState,
      availabilityRef: `availability:${suffix}`,
      availabilityState: state.availabilityState,
      circuitState: state.circuitState,
      actionFamily: request.actionFamily,
      modalityRequirement: request.modalityRequirement,
      eligibilityEvidenceRef: `execution-eligibility:${suffix}-${request.phase}`,
    };
  }
}

function scriptedCostMicros(result: ScriptedCommercialTransportResult): string {
  if (result.status === "failure") return result.metrics.costMicros;
  const response = result.response as { metrics?: { costMicros?: unknown } };
  return typeof response?.metrics?.costMicros === "string"
    ? response.metrics.costMicros
    : "0";
}

export function commercialUsageReceipt(
  attempt: CommercialAttempt,
  reservationRef: string,
  actualCostMicros: string,
): unknown {
  return {
    contractVersion: COMMERCIAL_ATTEMPT_USAGE_RECEIPT_VERSION,
    receiptKind: "commercial-attempt-usage-receipt",
    commercialScopeRef: attempt.commercialScopeRef,
    logicalOperationRef: attempt.logicalOperationRef,
    physicalAttemptRef: attempt.physicalAttemptRef,
    reservationRef,
    routeRef: attempt.routeRef,
    providerRef: attempt.providerRef,
    modelRef: attempt.modelRef,
    modelRevisionRef: attempt.modelRevisionRef,
    configurationDigest: attempt.configurationDigest,
    capabilityProfileRevisionRef: attempt.capabilityProfileRevisionRef,
    capabilityProfileDigest: attempt.capabilityProfileDigest,
    providerPolicyRevisionRef: attempt.providerPolicyRevisionRef,
    providerPolicyEvidenceRef: attempt.providerPolicyEvidenceRef,
    attemptIndex: attempt.attemptIndex,
    role: attempt.role,
    reservedCostMicros: attempt.reservedCostMicros,
    actualCostMicros,
  };
}

export class ScriptedCommercialTransport {
  readonly requests: unknown[] = [];
  readonly attempts: unknown[] = [];
  readonly contexts: CommercialAttemptExecutionContext[] = [];
  readonly clock = new ManualCommercialOperationClock();
  readonly #results: ScriptedCommercialTransportResult[];

  constructor(results: readonly ScriptedCommercialTransportResult[]) {
    this.#results = results.map((result) => structuredClone(result));
  }

  execute(
    request: unknown,
    attempt: CommercialAttempt,
    context: CommercialAttemptExecutionContext,
  ): CommercialProviderTransportResult {
    this.requests.push(structuredClone(request));
    this.attempts.push(structuredClone(attempt));
    this.contexts.push(structuredClone(context));
    const scripted = this.#results.shift() ?? {
      status: "failure",
      kind: "confirmed-not-dispatched-transport-failure",
      metrics: { inputTokenCount: 0, outputTokenCount: 0, latencyMs: 0, costMicros: "0" },
    };
    this.clock.advance(scripted.observedExecutionMs ?? 0);
    const result = structuredClone(scripted) as ScriptedCommercialTransportResult & {
      observedExecutionMs?: number;
    };
    delete result.observedExecutionMs;
    if (result.status === "response") {
      return {
        status: "response",
        response: result.response,
        usageReceipt: result.usageReceipt ?? commercialUsageReceipt(
          attempt,
          context.reservationRef,
          scriptedCostMicros(result),
        ),
      };
    }
    return {
      status: "failure",
      kind: result.kind,
      metrics: result.metrics,
      usageReceipt: result.usageReceipt === undefined
        ? result.kind === "provider-timeout"
          ? null
          : commercialUsageReceipt(attempt, context.reservationRef, result.metrics.costMicros)
        : result.usageReceipt,
    };
  }
}

export function successfulProviderResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    responseVersion: BOUNDED_COMMERCIAL_PROVIDER_RESPONSE_VERSION,
    responseKind: "bounded-commercial-provider-response",
    output: {
      responseKind: "proposal",
      reviewedContentRefs: ["reviewed-content:text-one"],
      groundingRefs: ["grounding:lesson-one"],
      reasonCodes: ["needs-hint"],
      requestedTutorAction: "hint",
      instructionalDisplayMode: "reviewed-text",
      refusalState: "not-refused",
    },
    groundedClaims: [{
      claimRef: "claim:material-one",
      supportRefs: ["grounding:lesson-one"],
    }],
    metrics: {
      inputTokenCount: 120,
      outputTokenCount: 30,
      latencyMs: 100,
      costMicros: "100",
    },
    ...overrides,
  };
}

function providerProfile(suffix: "alpha" | "beta"): ProviderCapabilityProfile {
  return {
    profileVersion: PROVIDER_CAPABILITY_PROFILE_VERSION,
    providerRef: `provider-profile:${suffix}`,
    providerClass: "ZERO_RETENTION",
    lifecycle: "ACTIVE",
    modelRefs: [`model-profile:${suffix}`],
    minimumTimeoutMs: 100,
    maximumTimeoutMs: 2_000,
  };
}

function modelProfile(suffix: "alpha" | "beta"): ModelCapabilityProfile {
  return {
    profileVersion: MODEL_CAPABILITY_PROFILE_VERSION,
    modelRef: `model-profile:${suffix}`,
    modelRevisionRef: `model-revision:${suffix}-2026-08-r1`,
    configurationDigest: suffix === "alpha" ? DIGEST_A : DIGEST_B,
    capabilityProfileRevisionRef: `capability-profile:${suffix}-2026-08-r1`,
    capabilityProfileDigest: suffix === "alpha" ? DIGEST_C : DIGEST_D,
    modelClass: "BALANCED_TEXT",
    providerRef: `provider-profile:${suffix}`,
    routeRef: `route-profile:${suffix}`,
    lifecycle: "ACTIVE",
    actionFamilies: ["HINT"],
    subjectCapabilities: ["SYMBOLIC_REASONING"],
    learnerStages: ["MIDDLE_GRADES"],
    safetyCapabilities: ["MINOR_HEIGHTENED"],
    multimodalCapabilities: ["TEXT_ONLY"],
    reviewedContentSupport: "PROVIDED_REVIEWED_GROUNDING",
    maximumContextTokens: 8_192,
    maximumOutputTokens: 512,
    estimatedLatencyMs: suffix === "alpha" ? 300 : 350,
    attemptTimeoutMs: 700,
    worstCaseCostMicros: "100",
  };
}

function policyProfile(suffix: "alpha" | "beta"): TrustedProviderProfile {
  return {
    providerRef: `provider-profile:${suffix}`,
    trainingUse: "prohibited",
    retention: { class: "none", maximumDurationHours: 0 },
    minorDataEligibility: "supported",
    dataResidency: { approvedRegions: ["us-east"] },
    dataDeletionCapability: "supported",
    multimodalEligibility: "approved",
    contractPolicyRevision: "provider-policy-revision:commercial-r1",
    policyEvidenceRef: `provider-policy-evidence:${suffix}-commercial-r1`,
    policyEvidenceValidUntil: "2027-01-01T00:00:00.000Z",
    status: "active",
  };
}

function policyRequirement(suffix: "alpha" | "beta"): ProviderEligibilityRequirements {
  return {
    providerRef: `provider-profile:${suffix}`,
    allowedRetentionClasses: ["none"],
    maximumRetentionHours: 0,
    requiredRegion: "us-east",
    modality: "text",
    requiredContractPolicyRevision: "provider-policy-revision:commercial-r1",
    evaluatedAt: "2026-08-15T16:00:00.000Z",
  };
}

export function validInvocation(): StudyCommercialTutorInvocation {
  return {
    contractVersion: STUDY_COMMERCIAL_TUTOR_INVOCATION_VERSION,
    invocationKind: "trusted-study-commercial-tutor-invocation",
    issuedBy: "study-engine",
    householdScopeRef: "household-scope:family-one",
    learnerScopeRef: "learner-scope:learner-a",
    sessionRef: "session:commercial-one",
    interactionRef: "interaction:commercial-one",
    logicalOperationRef: "logical-operation:commercial-one",
    subjectRef: "subject:mathematics",
    nominalGradeRef: "nominal-grade:grade-eight",
    officialWorkingLevelRef: "working-level:grade-five",
    nominalGrade: 8,
    officialWorkingLevel: 5,
    curriculum: {
      releaseRef: "family-pilot-r1",
      packageRef: "curriculum-package:family-pilot-r1",
      version: "2.0.0",
      digest: DIGEST_A,
      courseRef: "ma-g5-mathematics",
      subjectId: "mathematics",
      unitRef: "ma-g5-mathematics-u01",
      lessonRef: "ma-g5-mathematics-u01-l01",
      conceptRef: "concept:fractions-one",
      opportunityRef: "opportunity:fractions-one",
    },
    learnerStageRef: "learner-stage:middle-grades",
    assessmentPhase: "instruction-or-practice",
    requestedActionFamily: "HINT",
    subjectCapability: "SYMBOLIC_REASONING",
    allowedTutorActions: ["hint"],
    requestedPresentation: {
      modalityRequirement: "TEXT_ONLY",
      allowedDisplayModes: ["reviewed-text"],
      mappingContext: {
        reviewedVisuals: [],
        requestSpeechAfterAcceptance: false,
        fallbackPresentation: {
          presentationRef: "presentation-fallback:commercial-one",
          requestedDeliveryChannels: ["text"],
        },
      },
    },
    reviewedContentEvidence: [{
      contentRef: "reviewed-content:text-one",
      contentDigest: DIGEST_A,
    }],
    groundedContext: {
      contractVersion: GROUNDING_CONTRACT_VERSION,
      bundleRef: "grounding-bundle:commercial-one",
      source: "study-authority",
      scopeRef: "interaction:commercial-one",
      assessmentPhase: "instruction-or-practice",
      items: [
        {
          contextRef: "grounding:lesson-one",
          scopeRef: "interaction:commercial-one",
          contentDigest: DIGEST_A,
          materialKind: "instructional",
          reviewAuthority: "study",
          reviewStatus: "study-reviewed",
          validity: "valid",
        },
        {
          contextRef: "grounding:fallback-one",
          scopeRef: "interaction:commercial-one",
          contentDigest: DIGEST_F,
          materialKind: "static-fallback",
          reviewAuthority: "study",
          reviewStatus: "study-reviewed",
          validity: "valid",
        },
      ],
      fallbackContextRef: "grounding:fallback-one",
    },
    groundingRequirements: [{
      claimRef: "claim:material-one",
      scopeRef: "interaction:commercial-one",
      claimKind: "instructional",
      requiredContext: [{
        contextRef: "grounding:lesson-one",
        contentDigest: DIGEST_A,
      }],
    }],
    authorization: {
      curriculumAuthorityRef: "curriculum-authority:commercial-one",
      curriculumPolicyRevisionRef: "curriculum-policy:commercial-r1",
      learnerStageCatalogVersion: LEARNER_STAGE_CATALOG_VERSION,
      learnerStagePolicyRevisionRef: LEARNER_STAGE_POLICY_REVISION_REF,
      providerPolicyRevisionRef: "provider-policy-revision:commercial-r1",
      configurationRef: "configuration:commercial-r1",
      safetyPolicyRef: "safety-policy:commercial-r1",
      presentationPolicyRef: "presentation-policy:commercial-r1",
      studyPermissionRef: "study-permission:commercial-one",
    },
    authorityBoundary: {
      tutorRecommendationIsAdvisory: true,
      studyProgressionDecisionRequired: true,
      tutorCanCompleteStudySegment: false,
      tutorCanDeclareOfficialMastery: false,
      tutorCanChangeOfficialWorkingLevel: false,
      tutorCanChangeNominalGrade: false,
      tutorCanAssignCurriculum: false,
      tutorCanClearSafety: false,
      tutorCanGrantGuardianAuthority: false,
    },
  };
}

export function curriculumMetadata(): TrustedCurriculumMetadata {
  return {
    metadataVersion: CURRICULUM_METADATA_VERSION,
    metadataKind: "accepted-curriculum-metadata",
    source: "accepted-curriculum-release",
    releaseRef: "family-pilot-r1",
    packageRef: "curriculum-package:family-pilot-r1",
    releaseVersion: "2.0.0",
    releaseDigest: DIGEST_A,
    reviewState: "reviewed",
    admissionState: "admitted",
    courses: [{
      courseRef: "ma-g5-mathematics",
      subjectRef: "mathematics",
      grade: 5,
      unitRefs: ["ma-g5-mathematics-u01"],
      lessonBindings: [{
        lessonRef: "ma-g5-mathematics-u01-l01",
        unitRef: "ma-g5-mathematics-u01",
      }],
    }],
  };
}

export function capabilityDeclaration(): TutorCapabilityDeclaration {
  return {
    declarationKind: "reviewed-tutor-capability",
    declarationRef: "capability-review:guided-instruction-v1",
    capabilityRef: "guided-instruction",
    reviewState: "reviewed",
    admissionState: "admitted",
    deliveryMode: "free-form-instruction",
    supportedCourseRefs: ["ma-g5-mathematics"],
    supportedSubjectRefs: ["mathematics"],
    allowedAssessmentPhases: ["instruction-or-practice", "completed-assessment-review"],
    allowedActionFamilies: ["guided-support"],
    unsupportedOutcome: "static-only",
  };
}

export function executionBudget(): ExecutionBudget {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    commercialScopeRef: "commercial-scope:commercial-one",
    logicalOperationRef: "logical-operation:commercial-one",
    currency: "USD",
    operationMaximumMicros: "200",
    interactionRemainingMicros: "200",
    householdPeriodRemainingMicros: "200",
    platformPeriodRemainingMicros: "200",
    maximumPhysicalAttempts: 2,
    reviewedStaticFallback: {
      selection: "reviewed-content-by-trusted-study-ref",
      policyRef: "fallback-policy:commercial-r1",
      reviewedContentRef: "reviewed-content:commercial-fallback-r1",
      reviewRef: "review:commercial-fallback-r1",
    },
  };
}

export function executionInput(
  transport: ScriptedCommercialTransport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]),
  options: {
    readonly executionEligibilityResolver?: CommercialExecutionEligibilityResolver;
    readonly dispatchClaims?: PhysicalAttemptDispatchClaimPort;
  } = {},
): CommercialTutorExecutionInput {
  const providers = [providerProfile("alpha"), providerProfile("beta")];
  const models = [modelProfile("alpha"), modelProfile("beta")];
  const availability: ProviderAvailabilityState[] = models.map((model) => ({
    stateVersion: PROVIDER_AVAILABILITY_STATE_VERSION,
    availabilityRef: `availability:${model.providerRef.endsWith("alpha") ? "alpha" : "beta"}`,
    providerRef: model.providerRef,
    modelRef: model.modelRef,
    modelRevisionRef: model.modelRevisionRef,
    state: "AVAILABLE",
  }));
  const policies = [policyProfile("alpha"), policyProfile("beta")];
  return {
    invocation: validInvocation(),
    trustedScope: {
      scopeVersion: COMMERCIAL_EXECUTION_SCOPE_VERSION,
      scopeKind: "trusted-study-commercial-execution-scope",
      issuedBy: "study-engine",
      scopeRef: "commercial-scope:commercial-one",
      householdScopeRef: "household-scope:family-one",
      learnerScopeRef: "learner-scope:learner-a",
      sessionRef: "session:commercial-one",
      interactionRef: "interaction:commercial-one",
      logicalOperationRef: "logical-operation:commercial-one",
      curriculumReleaseRef: "family-pilot-r1",
      curriculumPackageRef: "curriculum-package:family-pilot-r1",
      curriculumCourseRef: "ma-g5-mathematics",
      curriculumSubjectRef: "mathematics",
      curriculumUnitRef: "ma-g5-mathematics-u01",
      curriculumLessonRef: "ma-g5-mathematics-u01-l01",
      conceptRef: "concept:fractions-one",
      opportunityRef: "opportunity:fractions-one",
      learnerStageRef: "learner-stage:middle-grades",
      presentationRef: "presentation-fallback:commercial-one",
      routingRequestRef: "routing-request:commercial-one",
      routePlanRef: "route-plan:commercial-one",
      reservationRef: "reservation:commercial-one",
      physicalAttemptRefs: [
        "physical-attempt:commercial-primary",
        "physical-attempt:commercial-failover",
      ],
      allowedRouteRefs: ["route-profile:alpha", "route-profile:beta"],
      telemetryEventRefs: [
        "telemetry-event:commercial-primary",
        "telemetry-event:commercial-failover",
      ],
    },
    curriculumMetadata: curriculumMetadata(),
    capabilityDeclaration: capabilityDeclaration(),
    clock: transport.clock,
    executionEligibilityResolver:
      options.executionEligibilityResolver ?? new MutableCommercialExecutionEligibilityResolver(),
    dispatchClaims: options.dispatchClaims ?? new InMemoryPhysicalAttemptDispatchClaimStore(),
    routing: {
      requestRef: "routing-request:commercial-one",
      routePlanRef: "route-plan:commercial-one",
      physicalAttemptRefs: [
        "physical-attempt:commercial-primary",
        "physical-attempt:commercial-failover",
      ],
      reservationRef: "reservation:commercial-one",
      eligibilityClassRef: "eligibility:minor-heightened-us-reviewed",
      providerProfiles: providers,
      modelProfiles: models,
      providerPolicyRegistry: createTrustedProviderProfileRegistry(policies),
      providerPolicyRequirements: [policyRequirement("alpha"), policyRequirement("beta")],
      providerAvailability: availability,
      inputTokens: 500,
      requiredOutputTokens: 100,
      safetyRequirement: "MINOR_HEIGHTENED",
      reviewedContentRequirement: "PROVIDER_REVIEWED_GROUNDING_REQUIRED",
      latencyCeilingMs: 2_000,
      costCeilingMicros: "200",
      executionBudget: executionBudget(),
      failoverBackoffMs: 50,
      deterministicReserveMs: 50,
      telemetryEventRefs: ["telemetry-event:commercial-primary", "telemetry-event:commercial-failover"],
    },
    transport,
  };
}
