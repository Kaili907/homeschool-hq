import {
  createInstructionalMemoryDelta,
  type InstructionalMemoryProjection,
  type InstructionalMemoryScope,
} from "../../../core/v3/memory/index.js";
import type { ReplayCrashRequest } from "./state-machine.js";

export const certificationScope = {
  scopeKind: "trusted-study-instructional-memory-scope",
  learnerScopeRef: "learner:replay-child",
  sessionRef: "session:replay-math",
  contextRef: "interaction:replay-fractions",
  opportunityRef: "opportunity:replay-practice",
} as const satisfies InstructionalMemoryScope;

export function makeReplayCrashRequest(options: {
  readonly logicalOperationRef?: string;
  readonly contentRef?: string;
  readonly primaryPhysicalAttemptRef?: string;
  readonly failoverPhysicalAttemptRef?: string | null;
  readonly priorMemory?: InstructionalMemoryProjection | null;
  readonly memoryRef?: string;
} = {}): ReplayCrashRequest {
  const logicalOperationRef = options.logicalOperationRef ?? "logical-operation:replay-001";
  const suffix = logicalOperationRef.split(":").at(-1) ?? "replay-001";
  const studyReceiptRef = `study-receipt:${suffix}`;
  const primaryPhysicalAttemptRef =
    options.primaryPhysicalAttemptRef ?? `physical-attempt:${suffix}-primary`;
  const failoverPhysicalAttemptRef =
    options.failoverPhysicalAttemptRef === undefined
      ? `physical-attempt:${suffix}-failover`
      : options.failoverPhysicalAttemptRef;
  const attempts = [
    {
      physicalAttemptRef: primaryPhysicalAttemptRef,
      attemptIndex: 0,
      role: "primary" as const,
      routeRef: `route:${suffix}-primary`,
      providerRef: "provider:certification-primary",
      modelRef: "model:certification-primary",
      reservedCostMicros: "4000",
    },
    ...(failoverPhysicalAttemptRef
      ? [
          {
            physicalAttemptRef: failoverPhysicalAttemptRef,
            attemptIndex: 1,
            role: "failover" as const,
            routeRef: `route:${suffix}-failover`,
            providerRef: "provider:certification-failover",
            modelRef: "model:certification-failover",
            reservedCostMicros: "3500",
          },
        ]
      : []),
  ];
  const memoryRef = options.memoryRef ?? `memory:${suffix}`;
  const memoryDelta = createInstructionalMemoryDelta({
    logicalOperationRef,
    sourceEventRef: studyReceiptRef,
    memoryDeltaRef: `memory-delta:${suffix}`,
    memoryRef,
    scope: certificationScope,
    prior: options.priorMemory ?? null,
    operations: [
      { operationKind: "add", field: "conceptRefs", value: "concept:fractions" },
      { operationKind: "replace", field: "lastAssistanceLevel", value: "light-hint" },
      { operationKind: "replace", field: "lastHintLevel", value: "concept-cue" },
      { operationKind: "add", field: "recentActionReasonCodes", value: "replay-certified" },
    ],
  });
  return {
    logicalOperationRef,
    payload: {
      learnerScopeRef: certificationScope.learnerScopeRef,
      sessionRef: certificationScope.sessionRef,
      interactionRef: certificationScope.contextRef,
      opportunityRef: certificationScope.opportunityRef,
      contentRef: options.contentRef ?? "content:equivalent-fractions",
      requestedAction: "hint",
    },
    routePlan: {
      routePlanRef: `route-plan:${suffix}`,
      logicalOperationRef,
      attempts,
    },
    reservationRef: `reservation:${suffix}`,
    advisoryRef: `advisory:${suffix}`,
    effectRef: `study-effect:${suffix}`,
    effectDigest: `sha256:${"a".repeat(64)}`,
    studyReceiptRef,
    memoryDelta,
    telemetryEventRef: `telemetry-event:${suffix}`,
    parentProjectionRef: `parent-projection:${suffix}`,
  };
}
