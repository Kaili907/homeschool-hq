import {
  COMMERCIAL_EXECUTION_SCOPE_VERSION,
  COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION,
  type CommercialAttempt,
  type CommercialExecutionScope,
  type CommercialRouteAttemptPlan,
} from "../../../core/v3/commercial-operation/index.js";
import {
  STUDY_COMMERCIAL_EFFECT_RECEIPT_VERSION,
  type StudyCommercialEffectReceipt,
} from "../../../core/v3/contracts/index.js";
import {
  createInstructionalMemoryDelta,
  type InstructionalMemoryProjection,
  type InstructionalMemoryScope,
} from "../../../core/v3/memory/index.js";
import type { ReplayCrashRequest } from "./state-machine.js";

const CONFIGURATION_DIGEST = `sha256:${"b".repeat(64)}`;
const CAPABILITY_PROFILE_DIGEST = `sha256:${"c".repeat(64)}`;
const EFFECT_DIGEST = `sha256:${"a".repeat(64)}`;

export interface ReplayCrashFixtureOptions {
  readonly logicalOperationRef?: string;
  readonly contentRef?: string;
  readonly commercialScopeRef?: string;
  readonly primaryPhysicalAttemptRef?: string;
  readonly failoverPhysicalAttemptRef?: string | null;
  readonly priorMemory?: InstructionalMemoryProjection | null;
  readonly memoryRef?: string;
}

function makeAttempt(input: {
  readonly commercialScopeRef: string;
  readonly logicalOperationRef: string;
  readonly physicalAttemptRef: string;
  readonly attemptIndex: 0 | 1;
  readonly role: "primary" | "failover";
  readonly suffix: string;
}): CommercialAttempt {
  const providerSuffix = input.role === "primary" ? "primary" : "failover";
  return {
    commercialScopeRef: input.commercialScopeRef,
    logicalOperationRef: input.logicalOperationRef,
    physicalAttemptRef: input.physicalAttemptRef,
    attemptIndex: input.attemptIndex,
    role: input.role,
    routeRef: `route:${input.suffix}-${providerSuffix}`,
    providerRef: `provider:certification-${providerSuffix}`,
    modelRef: `model:certification-${providerSuffix}`,
    modelRevisionRef: `model-revision:certification-${providerSuffix}-r1`,
    configurationDigest: CONFIGURATION_DIGEST,
    capabilityProfileRevisionRef: `capability-profile:certification-${providerSuffix}-r1`,
    capabilityProfileDigest: CAPABILITY_PROFILE_DIGEST,
    providerPolicyRevisionRef: `provider-policy:certification-${providerSuffix}-r1`,
    providerPolicyEvidenceRef: `provider-policy-evidence:certification-${providerSuffix}-r1`,
    reservedCostMicros: input.role === "primary" ? "4000" : "3500",
    timeoutMs: 2_000,
  };
}

export function makeReplayCrashRequest(
  options: ReplayCrashFixtureOptions = {},
): ReplayCrashRequest {
  const logicalOperationRef = options.logicalOperationRef ?? "logical-operation:replay-001";
  const suffix = logicalOperationRef.split(":").at(-1) ?? "replay-001";
  const commercialScopeRef = options.commercialScopeRef ?? `commercial-scope:${suffix}`;
  const studyReceiptRef = `study-receipt:${suffix}`;
  const primaryPhysicalAttemptRef =
    options.primaryPhysicalAttemptRef ?? `physical-attempt:${suffix}-primary`;
  const failoverPhysicalAttemptRef =
    options.failoverPhysicalAttemptRef === undefined
      ? `physical-attempt:${suffix}-failover`
      : options.failoverPhysicalAttemptRef;
  const attempts: CommercialAttempt[] = [
    makeAttempt({
      commercialScopeRef,
      logicalOperationRef,
      physicalAttemptRef: primaryPhysicalAttemptRef,
      attemptIndex: 0,
      role: "primary",
      suffix,
    }),
    ...(failoverPhysicalAttemptRef
      ? [
          makeAttempt({
            commercialScopeRef,
            logicalOperationRef,
            physicalAttemptRef: failoverPhysicalAttemptRef,
            attemptIndex: 1,
            role: "failover",
            suffix,
          }),
        ]
      : []),
  ];
  const reservationRef = `reservation:${suffix}`;
  const telemetryEventRefs = attempts.map(
    (attempt) => `telemetry-event:${suffix}-${attempt.role}`,
  );
  const commercialScope: CommercialExecutionScope = {
    scopeVersion: COMMERCIAL_EXECUTION_SCOPE_VERSION,
    scopeKind: "trusted-study-commercial-execution-scope",
    issuedBy: "study-engine",
    scopeRef: commercialScopeRef,
    householdScopeRef: "household-scope:replay-family",
    learnerScopeRef: "learner-scope:replay-child",
    sessionRef: "session:replay-math",
    interactionRef: "interaction:replay-fractions",
    logicalOperationRef,
    curriculumReleaseRef: "family-pilot-r1",
    curriculumPackageRef: "curriculum-package:family-pilot-r1",
    curriculumCourseRef: "ma-g5-mathematics",
    curriculumSubjectRef: "mathematics",
    curriculumUnitRef: "ma-g5-mathematics-u01",
    curriculumLessonRef: "ma-g5-mathematics-u01-l01",
    conceptRef: "concept:fractions",
    opportunityRef: "opportunity:replay-practice",
    learnerStageRef: "learner-stage:middle-grades",
    presentationRef: "presentation-fallback:replay-fractions",
    routingRequestRef: `routing-request:${suffix}`,
    routePlanRef: `route-plan:${suffix}`,
    reservationRef,
    physicalAttemptRefs: attempts.map((attempt) => attempt.physicalAttemptRef),
    allowedRouteRefs: attempts.map((attempt) => attempt.routeRef),
    telemetryEventRefs,
  };
  const routePlan: CommercialRouteAttemptPlan = {
    contractVersion: COMMERCIAL_ROUTE_ATTEMPT_PLAN_VERSION,
    routePlanRef: commercialScope.routePlanRef,
    commercialScopeRef,
    logicalOperationRef,
    attempts,
    totalReservedCostMicros: failoverPhysicalAttemptRef ? "7500" : "4000",
  };
  const studyEffectReceipt: StudyCommercialEffectReceipt & {
    readonly decision: "accepted";
    readonly studyProgressCommitted: true;
  } = {
    contractVersion: STUDY_COMMERCIAL_EFFECT_RECEIPT_VERSION,
    receiptKind: "trusted-study-commercial-effect-receipt",
    issuedBy: "study-engine",
    receiptRef: studyReceiptRef,
    invocationRef: commercialScope.interactionRef,
    commercialExecutionScopeRef: commercialScope.scopeRef,
    householdScopeRef: commercialScope.householdScopeRef,
    logicalOperationRef,
    learnerScopeRef: commercialScope.learnerScopeRef,
    sessionRef: commercialScope.sessionRef,
    interactionRef: commercialScope.interactionRef,
    conceptRef: commercialScope.conceptRef,
    opportunityRef: commercialScope.opportunityRef,
    curriculumReleaseRef: commercialScope.curriculumReleaseRef,
    curriculumPackageRef: commercialScope.curriculumPackageRef,
    curriculumCourseRef: commercialScope.curriculumCourseRef,
    curriculumSubjectRef: commercialScope.curriculumSubjectRef,
    curriculumUnitRef: commercialScope.curriculumUnitRef,
    curriculumLessonRef: commercialScope.curriculumLessonRef,
    decision: "accepted",
    effectRef: `study-effect:${suffix}`,
    effectDigest: EFFECT_DIGEST,
    studyProgressCommitted: true,
    tutorMutationAuthorityGranted: false,
  };
  const memoryScope = {
    scopeKind: "trusted-study-instructional-memory-scope",
    learnerScopeRef: commercialScope.learnerScopeRef,
    sessionRef: commercialScope.sessionRef,
    contextRef: commercialScope.interactionRef,
    opportunityRef: commercialScope.opportunityRef,
  } as const satisfies InstructionalMemoryScope;
  const memoryRef = options.memoryRef ?? `memory:${suffix}`;
  const memoryDelta = createInstructionalMemoryDelta({
    commercialExecutionScopeRef: commercialScope.scopeRef,
    householdScopeRef: commercialScope.householdScopeRef,
    logicalOperationRef,
    sourceEventRef: studyReceiptRef,
    conceptRef: commercialScope.conceptRef,
    curriculumReleaseRef: commercialScope.curriculumReleaseRef,
    curriculumPackageRef: commercialScope.curriculumPackageRef,
    curriculumCourseRef: commercialScope.curriculumCourseRef,
    curriculumSubjectRef: commercialScope.curriculumSubjectRef,
    curriculumUnitRef: commercialScope.curriculumUnitRef,
    curriculumLessonRef: commercialScope.curriculumLessonRef,
    memoryDeltaRef: `memory-delta:${suffix}`,
    memoryRef,
    scope: memoryScope,
    prior: options.priorMemory ?? null,
    operations: [
      { operationKind: "add", field: "conceptRefs", value: commercialScope.conceptRef },
      { operationKind: "replace", field: "lastAssistanceLevel", value: "light-hint" },
      { operationKind: "replace", field: "lastHintLevel", value: "concept-cue" },
      { operationKind: "add", field: "recentActionReasonCodes", value: "replay-certified" },
    ],
  });
  return {
    logicalOperationRef,
    commercialScope,
    payload: {
      learnerScopeRef: commercialScope.learnerScopeRef,
      sessionRef: commercialScope.sessionRef,
      interactionRef: commercialScope.interactionRef,
      opportunityRef: commercialScope.opportunityRef,
      contentRef: options.contentRef ?? "content:equivalent-fractions",
      requestedAction: "hint",
    },
    routePlan,
    reservationRef,
    advisoryRef: commercialScope.interactionRef,
    studyEffectReceipt,
    memoryDelta,
    telemetryEventRef: telemetryEventRefs[0]!,
    parentProjectionRef: `parent-projection:${suffix}`,
  };
}
