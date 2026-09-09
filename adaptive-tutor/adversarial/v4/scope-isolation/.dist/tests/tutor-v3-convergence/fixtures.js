import { BOUNDED_COMMERCIAL_PROVIDER_RESPONSE_VERSION, STUDY_COMMERCIAL_TUTOR_INVOCATION_VERSION, } from "../../core/v3/contracts/index.js";
import { BUDGET_RESILIENCE_VERSION, } from "../../core/v3/routing/budget-resilience/index.js";
import { MODEL_CAPABILITY_PROFILE_VERSION, PROVIDER_AVAILABILITY_STATE_VERSION, PROVIDER_CAPABILITY_PROFILE_VERSION, } from "../../core/v3/routing/provider-routing/index.js";
import { createTrustedProviderProfileRegistry, } from "../../core/v3/provider-policy/index.js";
import { CURRICULUM_METADATA_VERSION, } from "../../core/v3/curriculum-admission/index.js";
import {} from "../../core/v3/commercial-operation/orchestrate.js";
import { COMMERCIAL_ATTEMPT_USAGE_RECEIPT_VERSION, } from "../../core/v3/commercial-operation/contracts.js";
import { GROUNDING_CONTRACT_VERSION, } from "../../core/v3/grounding/index.js";
import { LEARNER_STAGE_CATALOG_VERSION, LEARNER_STAGE_POLICY_REVISION_REF, } from "../../core/v3/learner-stage-policy/index.js";
const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;
const DIGEST_C = `sha256:${"c".repeat(64)}`;
const DIGEST_D = `sha256:${"d".repeat(64)}`;
const DIGEST_F = `sha256:${"f".repeat(64)}`;
export class ManualCommercialOperationClock {
    #nowMs = 0;
    nowMs() {
        return this.#nowMs;
    }
    advance(milliseconds) {
        this.#nowMs += milliseconds;
    }
}
function scriptedCostMicros(result) {
    if (result.status === "failure")
        return result.metrics.costMicros;
    const response = result.response;
    return typeof response?.metrics?.costMicros === "string"
        ? response.metrics.costMicros
        : "0";
}
export function commercialUsageReceipt(attempt, reservationRef, actualCostMicros) {
    return {
        contractVersion: COMMERCIAL_ATTEMPT_USAGE_RECEIPT_VERSION,
        receiptKind: "commercial-attempt-usage-receipt",
        logicalOperationRef: attempt.logicalOperationRef,
        physicalAttemptRef: attempt.physicalAttemptRef,
        reservationRef,
        routeRef: attempt.routeRef,
        attemptIndex: attempt.attemptIndex,
        role: attempt.role,
        reservedCostMicros: attempt.reservedCostMicros,
        actualCostMicros,
    };
}
export class ScriptedCommercialTransport {
    requests = [];
    attempts = [];
    contexts = [];
    clock = new ManualCommercialOperationClock();
    #results;
    constructor(results) {
        this.#results = results.map((result) => structuredClone(result));
    }
    execute(request, attempt, context) {
        this.requests.push(structuredClone(request));
        this.attempts.push(structuredClone(attempt));
        this.contexts.push(structuredClone(context));
        const scripted = this.#results.shift() ?? {
            status: "failure",
            kind: "confirmed-not-dispatched-transport-failure",
            metrics: { inputTokenCount: 0, outputTokenCount: 0, latencyMs: 0, costMicros: "0" },
        };
        this.clock.advance(scripted.observedExecutionMs ?? 0);
        const result = structuredClone(scripted);
        delete result.observedExecutionMs;
        if (result.status === "response") {
            return {
                status: "response",
                response: result.response,
                usageReceipt: result.usageReceipt ?? commercialUsageReceipt(attempt, context.reservationRef, scriptedCostMicros(result)),
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
export function successfulProviderResponse(overrides = {}) {
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
function providerProfile(suffix) {
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
function modelProfile(suffix) {
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
function policyProfile(suffix) {
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
function policyRequirement(suffix) {
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
export function validInvocation() {
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
export function curriculumMetadata() {
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
export function capabilityDeclaration() {
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
export function executionBudget() {
    return {
        contractVersion: BUDGET_RESILIENCE_VERSION,
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
export function executionInput(transport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
])) {
    const providers = [providerProfile("alpha"), providerProfile("beta")];
    const models = [modelProfile("alpha"), modelProfile("beta")];
    const availability = models.map((model) => ({
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
            householdScopeRef: "household-scope:family-one",
            learnerScopeRef: "learner-scope:learner-a",
            sessionRef: "session:commercial-one",
            interactionRef: "interaction:commercial-one",
        },
        curriculumMetadata: curriculumMetadata(),
        capabilityDeclaration: capabilityDeclaration(),
        clock: transport.clock,
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
