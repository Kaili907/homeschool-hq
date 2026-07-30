import {
  BRIDGE_CONTRACT_VERSION,
  TUTOR_CORE_VERSION,
  type AdultReviewFlagV1,
  type QuarantineRecordV1,
  type StudyProjectionV1,
  type StudyRecommendationV1,
} from "./contracts.ts";
import type { StudyRecoveryCheckpointV1 } from "./checkpoint.ts";
import { assertPersistenceProjectionSafe } from "./privacy.ts";
import { isIanaTimeZone, isISODate, isRFC3339 } from "./validation.ts";

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

export interface ParentOverrideProvenanceV1 {
  readonly decisionId: string;
  readonly controlSetId: string;
  readonly controlRevision: number;
  readonly decidedByRole: "parent" | "teacher";
  readonly actorRef: string;
  readonly decision: "accepted" | "rejected";
  readonly decidedAt: string;
}

export interface RetryPolicyV1 {
  readonly maximumAttempts: number;
  readonly initialBackoffSeconds: number;
  readonly backoffMultiplier: number;
  readonly maximumBackoffSeconds: number;
  readonly terminalBehavior: "quarantine";
}

export type OutboxRouteV1 =
  | "review-queue"
  | "calendar-placement"
  | "parent-control-enforcement";

export interface BridgeOutboxPayloadV1 {
  readonly sourceEventId: string;
  readonly evidenceId: string;
  readonly recommendationId: string;
  readonly sessionId: string;
  readonly lessonId: string;
  readonly segmentId: string;
  readonly action: StudyRecommendationV1["action"];
  readonly reasonCodes: readonly string[];
  readonly adultReview: AdultReviewFlagV1;
  readonly parentOverrideProvenance: ParentOverrideProvenanceV1 | null;
  readonly rawAnswerIncluded: false;
  readonly transcriptIncluded: false;
  readonly directIdentifiersIncluded: false;
  readonly adultPrivateNoteIncluded: false;
}

export interface BridgeOutboxEventV1 {
  readonly contract: "study-core-bridge.outbox-event.v1";
  readonly contractVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly eventId: string;
  readonly eventVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly learnerLocalDate: string;
  readonly householdTimeZone: string;
  readonly route: OutboxRouteV1;
  readonly retry: RetryPolicyV1;
  readonly quarantineOn:
    | "unsupported-version"
    | "invalid-payload"
    | "idempotency-collision"
    | "retry-exhausted";
  readonly payload: BridgeOutboxPayloadV1;
}

export const DEFAULT_RETRY_POLICY: RetryPolicyV1 = {
  maximumAttempts: 8,
  initialBackoffSeconds: 5,
  backoffMultiplier: 2,
  maximumBackoffSeconds: 900,
  terminalBehavior: "quarantine",
};

export function buildOutboxEvents(
  projection: StudyProjectionV1,
  recommendation: StudyRecommendationV1,
  context: {
    readonly occurredAt: string;
    readonly sessionId: string;
    readonly lessonId: string;
    readonly segmentId: string;
    readonly parentOverrideProvenance?: ParentOverrideProvenanceV1;
  },
): readonly BridgeOutboxEventV1[] {
  if (
    !isRFC3339(context.occurredAt) ||
    !isISODate(recommendation.learnerLocalDate) ||
    !isIanaTimeZone(recommendation.householdTimeZone) ||
    ![
      recommendation.recommendationId,
      recommendation.sourceEvidenceId,
      context.sessionId,
      context.lessonId,
      context.segmentId,
    ].every((value) => OPAQUE_ID.test(value)) ||
    recommendation.recommendationId.length > 80 ||
    recommendation.sourceEvidenceId !== projection.evidence.id ||
    projection.evidence.sessionId !== context.sessionId
  ) {
    throw new Error("Outbox context failed the non-echoing date boundary.");
  }
  const parent = context.parentOverrideProvenance;
  if (
    parent &&
    (![
      parent.decisionId,
      parent.controlSetId,
      parent.actorRef,
    ].every((value) => OPAQUE_ID.test(value)) ||
      !Number.isSafeInteger(parent.controlRevision) ||
      parent.controlRevision < 1 ||
      !isRFC3339(parent.decidedAt))
  ) {
    throw new Error("Parent provenance failed the non-echoing boundary.");
  }
  const payload: BridgeOutboxPayloadV1 = {
    sourceEventId: projection.sourceEventId,
    evidenceId: projection.evidence.id,
    recommendationId: recommendation.recommendationId,
    sessionId: context.sessionId,
    lessonId: context.lessonId,
    segmentId: context.segmentId,
    action: recommendation.action,
    reasonCodes: [...recommendation.reasonCodes],
    adultReview: projection.adult.adultReview,
    parentOverrideProvenance: context.parentOverrideProvenance ?? null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    directIdentifiersIncluded: false,
    adultPrivateNoteIncluded: false,
  };
  const routes: readonly OutboxRouteV1[] = [
    "review-queue",
    "calendar-placement",
    "parent-control-enforcement",
  ];
  const events = routes.map((route) => ({
    contract: "study-core-bridge.outbox-event.v1" as const,
    contractVersion: BRIDGE_CONTRACT_VERSION,
    eventId: `${recommendation.recommendationId}-${route}`,
    eventVersion: BRIDGE_CONTRACT_VERSION,
    idempotencyKey: `${recommendation.recommendationId}:${route}:v1`,
    occurredAt: context.occurredAt,
    learnerLocalDate: recommendation.learnerLocalDate,
    householdTimeZone: recommendation.householdTimeZone,
    route,
    retry: DEFAULT_RETRY_POLICY,
    quarantineOn: "retry-exhausted" as const,
    payload,
  }));
  events.forEach(assertPersistenceProjectionSafe);
  return events;
}

export interface PersistenceSidecarPort {
  readCheckpoint(
    sessionId: string,
  ): Promise<StudyRecoveryCheckpointV1 | null>;
  compareAndSwapCheckpoint(
    checkpoint: StudyRecoveryCheckpointV1,
    expectedRevision: number | null,
  ): Promise<
    | { readonly status: "stored"; readonly revision: number }
    | { readonly status: "revision-conflict"; readonly currentRevision: number }
    | { readonly status: "quarantined"; readonly quarantine: QuarantineRecordV1 }
  >;
  appendAcceptedEvent(
    sessionId: string,
    eventId: string,
    eventVersion: number,
    idempotencyKey: string,
  ): Promise<
    | { readonly status: "appended" }
    | { readonly status: "duplicate-ignored" }
    | { readonly status: "idempotency-collision" }
  >;
}

/**
 * Production implementations keep the complete Tutor-owned recovery state
 * behind this boundary. The bridge receives only an opaque protected
 * reference and never reads or writes Core observations, attempts, raw
 * responses, scores, misconceptions, or transcripts.
 */
export interface TutorRecoverySidecarPort {
  captureTutorState(input: {
    readonly tutorInteractionRef: string;
    readonly sourceEventId: string;
    readonly corePackageVersion: typeof TUTOR_CORE_VERSION;
  }): Promise<
    | {
        readonly status: "captured";
        readonly protectedTutorStateRef: string;
        readonly corePackageVersion: typeof TUTOR_CORE_VERSION;
      }
    | { readonly status: "quarantined"; readonly quarantine: QuarantineRecordV1 }
  >;
  restoreTutorState(input: {
    readonly protectedTutorStateRef: string;
    readonly tutorInteractionRef: string;
    readonly expectedLastAcceptedEventId: string | null;
    readonly corePackageVersion: typeof TUTOR_CORE_VERSION;
  }): Promise<
    | {
        readonly status: "restored";
        readonly tutorInteractionRef: string;
        readonly corePackageVersion: typeof TUTOR_CORE_VERSION;
      }
    | {
        readonly status: "stale";
        readonly reasonCode: "event-mismatch" | "core-version-mismatch";
      }
    | { readonly status: "quarantined"; readonly quarantine: QuarantineRecordV1 }
  >;
}

export interface DurableOutboxPort {
  enqueue(
    event: BridgeOutboxEventV1,
  ): Promise<
    | { readonly status: "enqueued" }
    | { readonly status: "duplicate-ignored" }
    | { readonly status: "quarantined"; readonly quarantine: QuarantineRecordV1 }
  >;
}

export interface ReviewQueuePort {
  propose(
    event: BridgeOutboxEventV1 & { readonly route: "review-queue" },
  ): Promise<
    | { readonly status: "proposed"; readonly queueReference: string }
    | { readonly status: "duplicate-ignored"; readonly queueReference: string }
    | { readonly status: "quarantined"; readonly quarantine: QuarantineRecordV1 }
  >;
}

export interface CalendarPlacementPort {
  propose(
    event: BridgeOutboxEventV1 & { readonly route: "calendar-placement" },
  ): Promise<
    | { readonly status: "proposed"; readonly placementReference: string }
    | {
        readonly status: "manual-review";
        readonly reasonCode: "missing-time-zone" | "parent-conflict";
      }
    | { readonly status: "quarantined"; readonly quarantine: QuarantineRecordV1 }
  >;
}

export interface ParentControlEnforcementPort {
  evaluate(
    event: BridgeOutboxEventV1 & {
      readonly route: "parent-control-enforcement";
    },
  ): Promise<
    | {
        readonly status: "allowed";
        readonly provenance: ParentOverrideProvenanceV1 | null;
      }
    | {
        readonly status: "blocked";
        readonly reasonCode:
          | "parent-rejected"
          | "hard-maximum"
          | "required-accommodation"
          | "manual-review";
        readonly provenance: ParentOverrideProvenanceV1 | null;
      }
    | { readonly status: "quarantined"; readonly quarantine: QuarantineRecordV1 }
  >;
}

export interface IntegrationHookBundle {
  readonly checkpoint: PersistenceSidecarPort;
  readonly tutorRecovery: TutorRecoverySidecarPort;
  readonly outbox: DurableOutboxPort;
  readonly reviewQueue: ReviewQueuePort;
  readonly calendar: CalendarPlacementPort;
  readonly parentControls: ParentControlEnforcementPort;
}
