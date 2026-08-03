import {
  BRIDGE_CONTRACT_VERSION,
  TUTOR_PHASES,
  type BridgeValidationResult,
  type TutorBridgeEventV1,
} from "./contracts.ts";
import {
  isRFC3339,
  makeQuarantineRecord,
  validateTutorBridgeEvent,
} from "./validation.ts";

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const DRAFT_REFERENCE = /^draft:[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const TUTOR_STATE_REFERENCE =
  /^tutor-state:[A-Za-z0-9][A-Za-z0-9._:/-]{0,113}$/;

export interface SafeInstructionalCursorV1 {
  readonly tutorPhase: (typeof TUTOR_PHASES)[number];
  readonly cycleNumber: number;
  readonly currentItemId: string | null;
  readonly currentItemIndex: number;
  readonly teachingTurnIndex: number;
}

export interface SegmentActiveTimeV1 {
  readonly segmentId: string;
  readonly activeSeconds: number;
}

export interface TechnicalInterruptionCheckpointV1 {
  readonly status: "none" | "active" | "recovering";
  readonly interruptionId: string | null;
  readonly category:
    | "none"
    | "network-unavailable"
    | "device-power"
    | "application-restart"
    | "audio-unavailable"
    | "input-unavailable"
    | "unknown-technical";
  readonly startedAt: string | null;
}

export interface StudyRecoveryCheckpointV1 {
  readonly contract: "study-core-bridge.recovery-checkpoint.v1";
  readonly contractVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly checkpointId: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sessionId: string;
  readonly lessonId: string;
  readonly segmentId: string;
  readonly safeInstructionalCursor: SafeInstructionalCursorV1;
  readonly completedSegmentIds: readonly string[];
  readonly perSegmentActiveTime: readonly SegmentActiveTimeV1[];
  readonly pausedSeconds: number;
  readonly breakSeconds: number;
  readonly protectedDraftRef: string | null;
  /**
   * Opaque reference to Tutor-owned recovery state held behind a sidecar.
   * The bridge checkpoint never contains the Core snapshot, observations,
   * attempts, scores, raw responses, or transcript.
   */
  readonly protectedTutorStateRef: string;
  readonly lastAcceptedEventId: string | null;
  readonly eventVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly tutorInteractionRef: string;
  readonly technicalInterruption: TechnicalInterruptionCheckpointV1;
  readonly rawAnswerIncluded: false;
  readonly transcriptIncluded: false;
}

export interface ResumeValidationContext {
  readonly expectedSessionId: string;
  readonly expectedLessonId: string;
  readonly expectedSegmentId: string;
  readonly expectedTutorInteractionRef: string;
  readonly expectedSafeInstructionalCursor: SafeInstructionalCursorV1;
  readonly knownSegmentIds: readonly string[];
  /** Exact compare-and-swap revision expected by the resume caller. */
  readonly expectedRevision: number;
  readonly expectedLastAcceptedEventId: string | null;
  readonly expectedProtectedTutorStateRef: string;
  readonly now: string;
  readonly maximumFutureSkewMs?: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function exact(
  value: Record<string, unknown>,
  required: readonly string[],
): boolean {
  const allowed = new Set(required);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function id(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID.test(value);
}

function nonnegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function uniqueIds(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every(id) &&
    new Set(value).size === value.length
  );
}

function validCursor(value: unknown): value is SafeInstructionalCursorV1 {
  if (
    !record(value) ||
    !exact(value, [
      "tutorPhase",
      "cycleNumber",
      "currentItemId",
      "currentItemIndex",
      "teachingTurnIndex",
    ])
  ) {
    return false;
  }
  return (
    typeof value.tutorPhase === "string" &&
    (TUTOR_PHASES as readonly string[]).includes(value.tutorPhase) &&
    Number.isSafeInteger(value.cycleNumber) &&
    Number(value.cycleNumber) >= 0 &&
    (value.currentItemId === null || id(value.currentItemId)) &&
    nonnegativeInteger(value.currentItemIndex) &&
    nonnegativeInteger(value.teachingTurnIndex)
  );
}

function validTechnical(
  value: unknown,
): value is TechnicalInterruptionCheckpointV1 {
  if (
    !record(value) ||
    !exact(value, ["status", "interruptionId", "category", "startedAt"])
  ) {
    return false;
  }
  const status = String(value.status);
  const category = String(value.category);
  if (
    !["none", "active", "recovering"].includes(status) ||
    ![
      "none",
      "network-unavailable",
      "device-power",
      "application-restart",
      "audio-unavailable",
      "input-unavailable",
      "unknown-technical",
    ].includes(category) ||
    !(value.interruptionId === null || id(value.interruptionId)) ||
    !(value.startedAt === null || isRFC3339(value.startedAt))
  ) {
    return false;
  }
  if (status === "none") {
    return (
      category === "none" &&
      value.interruptionId === null &&
      value.startedAt === null
    );
  }
  return (
    category !== "none" &&
    value.interruptionId !== null &&
    value.startedAt !== null
  );
}

function structuralCheckpoint(
  value: Record<string, unknown>,
): value is Record<string, unknown> & StudyRecoveryCheckpointV1 {
  const keys = [
    "contract",
    "contractVersion",
    "checkpointId",
    "revision",
    "createdAt",
    "updatedAt",
    "sessionId",
    "lessonId",
    "segmentId",
    "safeInstructionalCursor",
    "completedSegmentIds",
    "perSegmentActiveTime",
    "pausedSeconds",
    "breakSeconds",
    "protectedDraftRef",
    "protectedTutorStateRef",
    "lastAcceptedEventId",
    "eventVersion",
    "tutorInteractionRef",
    "technicalInterruption",
    "rawAnswerIncluded",
    "transcriptIncluded",
  ] as const;
  if (!exact(value, keys)) return false;
  if (
    value.contract !== "study-core-bridge.recovery-checkpoint.v1" ||
    value.contractVersion !== BRIDGE_CONTRACT_VERSION ||
    value.eventVersion !== BRIDGE_CONTRACT_VERSION ||
    !id(value.checkpointId) ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 1 ||
    !isRFC3339(value.createdAt) ||
    !isRFC3339(value.updatedAt) ||
    Date.parse(value.updatedAt) < Date.parse(value.createdAt) ||
    !id(value.sessionId) ||
    !id(value.lessonId) ||
    !id(value.segmentId) ||
    !validCursor(value.safeInstructionalCursor) ||
    !uniqueIds(value.completedSegmentIds) ||
    !Array.isArray(value.perSegmentActiveTime) ||
    !nonnegativeInteger(value.pausedSeconds) ||
    !nonnegativeInteger(value.breakSeconds) ||
    !(
      value.protectedDraftRef === null ||
      (typeof value.protectedDraftRef === "string" &&
        DRAFT_REFERENCE.test(value.protectedDraftRef))
    ) ||
    typeof value.protectedTutorStateRef !== "string" ||
    !TUTOR_STATE_REFERENCE.test(value.protectedTutorStateRef) ||
    !(value.lastAcceptedEventId === null || id(value.lastAcceptedEventId)) ||
    !id(value.tutorInteractionRef) ||
    !validTechnical(value.technicalInterruption) ||
    value.rawAnswerIncluded !== false ||
    value.transcriptIncluded !== false
  ) {
    return false;
  }
  const segmentTimes = value.perSegmentActiveTime;
  const segmentIds = new Set<string>();
  for (const entry of segmentTimes) {
    if (
      !record(entry) ||
      !exact(entry, ["segmentId", "activeSeconds"]) ||
      !id(entry.segmentId) ||
      !nonnegativeInteger(entry.activeSeconds) ||
      segmentIds.has(entry.segmentId)
    ) {
      return false;
    }
    segmentIds.add(entry.segmentId);
  }
  return true;
}

export function validateRecoveryCheckpoint(
  input: unknown,
  context: ResumeValidationContext,
): BridgeValidationResult<StudyRecoveryCheckpointV1> {
  const now = context.now;
  const inputId =
    record(input) && typeof input.checkpointId === "string"
      ? input.checkpointId
      : undefined;
  if (
    !isRFC3339(now) ||
    !TUTOR_STATE_REFERENCE.test(context.expectedProtectedTutorStateRef) ||
    !record(input) ||
    !structuralCheckpoint(input)
  ) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "malformed-event",
        "checkpoint",
        isRFC3339(now) ? now : new Date(0).toISOString(),
        inputId,
      ),
    };
  }
  if (
    input.sessionId !== context.expectedSessionId ||
    input.lessonId !== context.expectedLessonId ||
    input.segmentId !== context.expectedSegmentId ||
    input.tutorInteractionRef !== context.expectedTutorInteractionRef ||
    input.protectedTutorStateRef !==
      context.expectedProtectedTutorStateRef ||
    canonicalJson(input.safeInstructionalCursor) !==
      canonicalJson(context.expectedSafeInstructionalCursor)
  ) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "checkpoint-session-mismatch",
        "checkpoint",
        now,
        input.checkpointId,
      ),
    };
  }
  const knownSegments = new Set(context.knownSegmentIds);
  if (
    !knownSegments.has(input.segmentId) ||
    input.completedSegmentIds.some((segmentId) => !knownSegments.has(segmentId)) ||
    input.perSegmentActiveTime.some(
      (segmentTime) => !knownSegments.has(segmentTime.segmentId),
    )
  ) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "malformed-event",
        "checkpoint",
        now,
        input.checkpointId,
      ),
    };
  }
  if (
    input.revision !== context.expectedRevision ||
    input.lastAcceptedEventId !== context.expectedLastAcceptedEventId
  ) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "stale-checkpoint",
        "checkpoint",
        now,
        input.checkpointId,
      ),
    };
  }
  const futureSkew = context.maximumFutureSkewMs ?? 5 * 60 * 1000;
  if (
    Date.parse(input.updatedAt) > Date.parse(now) + futureSkew ||
    Date.parse(input.updatedAt) < Date.UTC(2000, 0, 1) ||
    (input.technicalInterruption.startedAt !== null &&
      (Date.parse(input.technicalInterruption.startedAt) >
        Date.parse(now) + futureSkew ||
        Date.parse(input.technicalInterruption.startedAt) <
          Date.UTC(2000, 0, 1)))
  ) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "impossible-date",
        "checkpoint",
        now,
        input.checkpointId,
      ),
    };
  }
  return { status: "accepted", value: input, privacyActions: [] };
}

export interface AcceptedEventLedgerV1 {
  readonly contract: "study-core-bridge.accepted-event-ledger.v1";
  readonly contractVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly entries: Readonly<Record<string, string>>;
}

export type EventLedgerAcceptance =
  | {
      readonly status: "accepted";
      readonly event: TutorBridgeEventV1;
      readonly ledger: AcceptedEventLedgerV1;
    }
  | {
      readonly status: "duplicate-ignored";
      readonly eventId: string;
      readonly reasonCode: "duplicate-event";
      readonly ledger: AcceptedEventLedgerV1;
    }
  | {
      readonly status: "quarantined";
      readonly quarantine: ReturnType<typeof makeQuarantineRecord>;
      readonly ledger: AcceptedEventLedgerV1;
    };

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}

function digest(value: unknown): string {
  const text = canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function emptyAcceptedEventLedger(): AcceptedEventLedgerV1 {
  return {
    contract: "study-core-bridge.accepted-event-ledger.v1",
    contractVersion: BRIDGE_CONTRACT_VERSION,
    entries: {},
  };
}

export function acceptEventOnce(
  input: unknown,
  ledger: AcceptedEventLedgerV1,
  receivedAt: string,
): EventLedgerAcceptance {
  const validation = validateTutorBridgeEvent(input, { receivedAt });
  if (validation.status !== "accepted") {
    return {
      status: "quarantined",
      quarantine:
        validation.status === "quarantined"
          ? validation.quarantine
          : makeQuarantineRecord(
              "duplicate-event",
              "tutor-core",
              receivedAt,
            ),
      ledger,
    };
  }
  const event = validation.value;
  const currentDigest = digest(event);
  const priorDigest = ledger.entries[event.eventId];
  if (priorDigest === currentDigest) {
    return {
      status: "duplicate-ignored",
      eventId: event.eventId,
      reasonCode: "duplicate-event",
      ledger,
    };
  }
  if (priorDigest !== undefined) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "event-id-collision",
        "tutor-core",
        receivedAt,
        event.eventId,
      ),
      ledger,
    };
  }
  return {
    status: "accepted",
    event,
    ledger: {
      ...ledger,
      entries: { ...ledger.entries, [event.eventId]: currentDigest },
    },
  };
}
