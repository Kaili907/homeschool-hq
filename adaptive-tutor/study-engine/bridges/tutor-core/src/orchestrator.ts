import type {
  BridgeValidationResult,
  QuarantineRecordV1,
  StudyProjectionV1,
  StudyRecommendationV1,
  StudySchemaRegistryPort,
} from "./contracts.ts";
import {
  adaptFrozenTutorCoreResult,
  type FrozenTutorCoreCallbackResult,
  type FrozenTutorCorePort,
  type StudyCoreBridgeCycleInput,
  type VerifiedTutorEventV1,
} from "./core-adapter.ts";
import {
  projectTutorEventToStudy,
  recommendStudyAction,
} from "./evidence.ts";
import {
  buildOutboxEvents,
  type BridgeOutboxEventV1,
  type ParentOverrideProvenanceV1,
  type PersistenceSidecarPort,
} from "./hooks.ts";
import type { GovernedIdRegistry } from "./mappings.ts";
import {
  evaluatePreCoreUrgentSafety,
  type PreCoreUrgentSafetyResult,
  type UrgentSafetyGatewayConfiguration,
} from "./safety-gateway.ts";
import {
  isIanaTimeZone,
  isISODate,
  makeQuarantineRecord,
} from "./validation.ts";

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

type MaybePromise<T> = T | Promise<T>;

export interface StudyCoreOrchestrationInput
  extends Omit<StudyCoreBridgeCycleInput, "submitToTutorCore"> {
  readonly recommendationId: string;
  readonly parentOverrideProvenance?: ParentOverrideProvenanceV1;
  readonly submitToTutorCore: (
    transientLearnerText: string,
  ) => MaybePromise<FrozenTutorCoreCallbackResult>;
}

export interface StudyCoreOrchestrationDependencies {
  /**
   * Production callers must select `mode: "production"` and supply the
   * production classifier port. The local-demo mode is intentionally explicit.
   */
  readonly safety: UrgentSafetyGatewayConfiguration;
  readonly tutorCore: FrozenTutorCorePort;
  readonly skillRegistry: GovernedIdRegistry;
  readonly studySchemas: StudySchemaRegistryPort;
  /**
   * Must implement an atomic uniqueness constraint on (sessionId, eventId).
   * The idempotency key includes a SHA-256 fingerprint of the verified,
   * minimized Tutor event so an event-ID collision is distinguishable from an
   * identical replay.
   */
  readonly eventLedger: Pick<PersistenceSidecarPort, "appendAcceptedEvent">;
}

export type StudyCoreOrchestrationResult =
  | {
      readonly status: "accepted";
      readonly eventId: string;
      readonly projection: StudyProjectionV1;
      readonly recommendation: StudyRecommendationV1;
      readonly outboxProposals: readonly BridgeOutboxEventV1[];
      readonly eventLedgerIdempotencyKey: string;
      readonly callbackInvocations: 1;
    }
  | {
      readonly status: "duplicate-ignored";
      readonly eventId: string;
      readonly reasonCode: "duplicate-event";
      readonly outboxProposals: readonly [];
      readonly callbackInvocations: 1;
    }
  | {
      readonly status: "quarantined";
      readonly quarantine: QuarantineRecordV1;
      readonly outboxProposals: readonly [];
      readonly callbackInvocations: 0 | 1;
    }
  | Exclude<
      PreCoreUrgentSafetyResult,
      { readonly status: "continue-to-tutor-core" }
    >;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson(
          (value as Record<string, unknown>)[key],
        )}`,
    )
    .join(",")}}`;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function eventLedgerIdempotencyKey(
  verified: VerifiedTutorEventV1,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(verified.event));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `study-core-bridge:event:v1:${toHex(new Uint8Array(digest))}`;
}

function quarantined(
  quarantine: QuarantineRecordV1,
  callbackInvocations: 0 | 1,
): StudyCoreOrchestrationResult {
  return {
    status: "quarantined",
    quarantine,
    outboxProposals: [],
    callbackInvocations,
  };
}

function validDownstreamContext(input: StudyCoreOrchestrationInput): boolean {
  return (
    OPAQUE_ID.test(input.recommendationId) &&
    input.recommendationId.length <= 80 &&
    isISODate(input.study.learnerLocalDate) &&
    isIanaTimeZone(input.study.householdTimeZone)
  );
}

function exactLedgerStatus(
  value: unknown,
): value is
  | { readonly status: "appended" }
  | { readonly status: "duplicate-ignored" }
  | { readonly status: "idempotency-collision" } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 1 &&
    (record.status === "appended" ||
      record.status === "duplicate-ignored" ||
      record.status === "idempotency-collision")
  );
}

/**
 * The single supported end-to-end bridge path.
 *
 * It deliberately performs the atomic event-ledger operation after frozen-Core
 * authority validation but before canonical Study projection or outbox
 * proposal construction. Therefore duplicate and collision branches cannot
 * project, propose, enqueue, or deliver downstream work.
 *
 * The raw learner text is transient. It is passed only to the safety boundary
 * and, for a clear classification with a one-time permit, to the supplied Core
 * callback. It is never returned, fingerprinted, persisted, or included in an
 * adult hook.
 */
export async function orchestrateStudyCoreBridge(
  input: StudyCoreOrchestrationInput,
  dependencies: StudyCoreOrchestrationDependencies,
): Promise<StudyCoreOrchestrationResult> {
  const gateway = await evaluatePreCoreUrgentSafety(
    input.transientLearnerText,
    {
      eventId: input.eventId,
      sessionId: input.study.sessionId,
      occurredAt: input.occurredAt,
    },
    dependencies.safety,
  );
  if (gateway.status !== "continue-to-tutor-core") return gateway;

  if (!validDownstreamContext(input)) {
    return {
      status: "stop-invalid-input",
      continueToTutorCore: false,
      mustStopAcademicFlow: true,
      adultReviewRequired: true,
      learner: {
        messageCode: "lesson-paused-invalid-bridge-context",
        message:
          "The lesson is paused while a trusted adult checks the learning setup. You are not in trouble.",
        mayContinue: false,
        adultReviewPending: true,
      },
      classification: {
        classificationVersion: 1,
        classifierVersion: "study-core-bridge-orchestrator-v1",
        outcome: "invalid",
        categories: [],
        reasonCodes: ["invalid-downstream-context"],
      },
      reasonCode: "urgent-gateway-invalid-context",
      rawTextStored: false,
      matchedTextStored: false,
      diagnosisMade: false,
    };
  }

  let coreResult: FrozenTutorCoreCallbackResult;
  try {
    // Deliberately one syntactic invocation. Promise assimilation does not
    // re-invoke the callback.
    coreResult = await input.submitToTutorCore(input.transientLearnerText);
  } catch {
    return quarantined(
      makeQuarantineRecord(
        "malformed-event",
        "tutor-core",
        input.occurredAt,
        input.eventId,
      ),
      1,
    );
  }

  const adapted = adaptFrozenTutorCoreResult(
    {
      ...coreResult,
      eventId: input.eventId,
      occurredAt: input.occurredAt,
      tutorInteractionId: input.tutorInteractionId,
      study: input.study,
      preCorePermit: gateway.permit,
    },
    dependencies.tutorCore,
    dependencies.skillRegistry,
  );
  if (adapted.status !== "accepted") {
    return quarantined(
      adapted.status === "quarantined"
        ? adapted.quarantine
        : makeQuarantineRecord(
            "duplicate-event",
            "tutor-core",
            input.occurredAt,
            input.eventId,
          ),
      1,
    );
  }

  const idempotencyKey = await eventLedgerIdempotencyKey(adapted.value);
  let ledgerResult: Awaited<
    ReturnType<PersistenceSidecarPort["appendAcceptedEvent"]>
  >;
  try {
    ledgerResult = await dependencies.eventLedger.appendAcceptedEvent(
      input.study.sessionId,
      adapted.value.event.eventId,
      adapted.value.event.eventVersion,
      idempotencyKey,
    );
  } catch {
    return quarantined(
      makeQuarantineRecord(
        "event-id-collision",
        "study-engine",
        input.occurredAt,
        input.eventId,
      ),
      1,
    );
  }
  if (!exactLedgerStatus(ledgerResult)) {
    return quarantined(
      makeQuarantineRecord(
        "malformed-event",
        "study-engine",
        input.occurredAt,
        input.eventId,
      ),
      1,
    );
  }
  if (ledgerResult.status === "duplicate-ignored") {
    return {
      status: "duplicate-ignored",
      eventId: input.eventId,
      reasonCode: "duplicate-event",
      outboxProposals: [],
      callbackInvocations: 1,
    };
  }
  if (ledgerResult.status === "idempotency-collision") {
    return quarantined(
      makeQuarantineRecord(
        "event-id-collision",
        "study-engine",
        input.occurredAt,
        input.eventId,
      ),
      1,
    );
  }
  if (ledgerResult.status !== "appended") {
    return quarantined(
      makeQuarantineRecord(
        "malformed-event",
        "study-engine",
        input.occurredAt,
        input.eventId,
      ),
      1,
    );
  }

  const projected: BridgeValidationResult<StudyProjectionV1> =
    projectTutorEventToStudy(adapted.value, {
      receivedAt: input.occurredAt,
      schemaRegistry: dependencies.studySchemas,
    });
  if (projected.status !== "accepted") {
    return quarantined(
      projected.status === "quarantined"
        ? projected.quarantine
        : makeQuarantineRecord(
            "duplicate-event",
            "study-engine",
            input.occurredAt,
            input.eventId,
          ),
      1,
    );
  }

  let recommendation: StudyRecommendationV1;
  let outboxProposals: readonly BridgeOutboxEventV1[];
  try {
    recommendation = recommendStudyAction(projected.value, {
      recommendationId: input.recommendationId,
      learnerLocalDate: input.study.learnerLocalDate,
      householdTimeZone: input.study.householdTimeZone,
    });
    outboxProposals = buildOutboxEvents(projected.value, recommendation, {
      occurredAt: input.occurredAt,
      sessionId: input.study.sessionId,
      lessonId: input.study.lessonId,
      segmentId: input.study.segmentId,
      ...(input.parentOverrideProvenance
        ? { parentOverrideProvenance: input.parentOverrideProvenance }
        : {}),
    });
  } catch {
    return quarantined(
      makeQuarantineRecord(
        "malformed-event",
        "outbox",
        input.occurredAt,
        input.eventId,
      ),
      1,
    );
  }
  return {
    status: "accepted",
    eventId: input.eventId,
    projection: projected.value,
    recommendation,
    outboxProposals,
    eventLedgerIdempotencyKey: idempotencyKey,
    callbackInvocations: 1,
  };
}
