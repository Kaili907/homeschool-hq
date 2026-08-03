import {
  STUDY_ENGINE_SCHEMA_VERSION,
  asBrandedId,
  type ActiveStudySession,
  type ApprovedBreakStudySession,
  type CompletedStudySession,
  type EvidenceId,
  type InterruptionId,
  type LessonStudyPlan,
  type PausedStudySession,
  type PlannedStudySession,
  type ResumePoint,
  type SegmentId,
  type SessionEventId,
  type SessionId,
  type SessionResultId,
  type StudySession,
  type StudySessionEvent,
} from "@study-contracts";
import { canonicalSegmentId, LEARNER_REFERENCE } from "../catalog";
import type { CanonicalUiSegmentId, RuntimeSubjectId } from "../runtimeTypes";

const SESSION_SCHEMA_TAG = "student-runtime.canonical-state.v1";

function safeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, ".").slice(0, 48);
}

function lastOccurredAt(session: StudySession): string {
  return session.eventLog.at(-1)?.occurredAt ?? session.updatedAt;
}

function monotonicAt(session: StudySession, requestedAt: string): string {
  const requested = Date.parse(requestedAt);
  const previous = Date.parse(lastOccurredAt(session));
  if (!Number.isFinite(requested)) {
    throw new TypeError("Session timestamps must be valid ISO date-time values.");
  }
  return requested < previous ? lastOccurredAt(session) : requestedAt;
}

function nextEvent(
  session: StudySession,
  type: StudySessionEvent["type"],
  requestedAt: string,
  options: {
    readonly actor?: StudySessionEvent["actor"];
    readonly segmentId?: SegmentId;
    readonly detailCode?: string;
    readonly evidenceRef?: EvidenceId;
  } = {},
): StudySessionEvent {
  const sequence = session.eventLog.length + 1;
  const occurredAt = monotonicAt(session, requestedAt);
  const suffix = [
    sequence,
    safeToken(type),
    options.segmentId ? safeToken(options.segmentId) : "session",
  ].join(":");
  return {
    id: asBrandedId<SessionEventId>(`event:${safeToken(session.id)}:${suffix}`),
    sessionId: session.id,
    sequence,
    occurredAt,
    type,
    actor: options.actor ?? "system",
    ...(options.segmentId ? { segmentId: options.segmentId } : {}),
    ...(options.detailCode ? { detailCode: options.detailCode } : {}),
    ...(options.evidenceRef ? { evidenceRef: options.evidenceRef } : {}),
  };
}

function appendEvents(
  session: StudySession,
  specifications: readonly {
    readonly type: StudySessionEvent["type"];
    readonly at: string;
    readonly actor?: StudySessionEvent["actor"];
    readonly segmentId?: SegmentId;
    readonly detailCode?: string;
    readonly evidenceRef?: EvidenceId;
  }[],
): readonly StudySessionEvent[] {
  let working = session;
  const appended: StudySessionEvent[] = [];
  for (const specification of specifications) {
    const event = nextEvent(working, specification.type, specification.at, specification);
    appended.push(event);
    working = {
      ...working,
      eventLog: [...working.eventLog, event],
      updatedAt: event.occurredAt,
    } as StudySession;
  }
  return [...session.eventLog, ...appended];
}

function sessionBase(
  session: StudySession,
  eventLog: readonly StudySessionEvent[],
  updatedAt: string,
) {
  return {
    kind: "study-session" as const,
    schemaVersion: STUDY_ENGINE_SCHEMA_VERSION,
    id: session.id,
    revision: session.revision + 1,
    createdAt: session.createdAt,
    updatedAt,
    metadata: session.metadata,
    studentId: session.studentId,
    studyPlanId: session.studyPlanId,
    plannedSegmentIds: session.plannedSegmentIds,
    eventLog,
  };
}

function startTime(session: StudySession): string {
  if ("startedAt" in session) return session.startedAt;
  const startedEvent = session.eventLog.find((event) => event.type === "session-started");
  return startedEvent?.occurredAt ?? session.createdAt;
}

export function responseDraftReference(sessionId: SessionId, segmentId: SegmentId) {
  return `draft:${safeToken(sessionId)}:${safeToken(segmentId)}`;
}

export function resumePointFor(
  session: StudySession,
  segmentId: SegmentId,
): ResumePoint {
  return {
    segmentId,
    elapsedActiveSecondsInSegment:
      "elapsedActiveSeconds" in session ? session.elapsedActiveSeconds : 0,
    responseDraftRef: responseDraftReference(session.id, segmentId),
  };
}

export function createPlannedCanonicalSession(
  subjectId: RuntimeSubjectId,
  plan: LessonStudyPlan,
  sessionId: SessionId,
  at: string,
): PlannedStudySession {
  const id = sessionId;
  const event: StudySessionEvent = {
    id: asBrandedId<SessionEventId>(`event:${safeToken(id)}:1:session-planned:session`),
    sessionId: id,
    sequence: 1,
    occurredAt: at,
    type: "session-planned",
    actor: "system",
    detailCode: "local-integration-lab",
  };
  return {
    kind: "study-session",
    schemaVersion: STUDY_ENGINE_SCHEMA_VERSION,
    id,
    revision: 1,
    createdAt: at,
    updatedAt: at,
    metadata: {
      source: "manual",
      tags: ["student-runtime", subjectId],
      extensions: {
        "manuel:runtime-state-version": SESSION_SCHEMA_TAG,
        "manuel:learner-reference-is-pseudonymous": true,
      },
    },
    status: "planned",
    studentId: LEARNER_REFERENCE,
    studyPlanId: plan.id,
    plannedSegmentIds: plan.segmentSequence,
    eventLog: [event],
    scheduledStartAt: at,
  };
}

export function startCanonicalSession(
  session: PlannedStudySession,
  subjectId: RuntimeSubjectId,
  at: string,
): ActiveStudySession {
  const segmentId = canonicalSegmentId(subjectId, "check-in");
  const eventLog = appendEvents(session, [
    { type: "session-started", at, actor: "student", detailCode: "learner-started" },
    { type: "segment-started", at, actor: "system", segmentId },
  ]);
  const updatedAt = eventLog.at(-1)!.occurredAt;
  return {
    ...sessionBase(session, eventLog, updatedAt),
    status: "active",
    startedAt: updatedAt,
    currentSegmentId: segmentId,
    elapsedActiveSeconds: 0,
  };
}

export function recordSegmentCompletion(
  session: ActiveStudySession,
  segmentId: SegmentId,
  nextSegmentId: SegmentId | undefined,
  evidenceRef: EvidenceId,
  at: string,
): ActiveStudySession {
  if (session.currentSegmentId !== segmentId) {
    throw new Error("The completion segment does not match the active segment.");
  }
  const eventLog = appendEvents(session, [
    {
      type: "active-response-recorded",
      at,
      actor: "student",
      segmentId,
      detailCode: "response-captured-local-no-raw",
      evidenceRef,
    },
    {
      type: "segment-completed",
      at,
      actor: "system",
      segmentId,
      detailCode: "idempotent-segment-completion",
      evidenceRef,
    },
    ...(nextSegmentId
      ? [
          {
            type: "segment-started" as const,
            at,
            actor: "system" as const,
            segmentId: nextSegmentId,
          },
        ]
      : []),
  ]);
  const updatedAt = eventLog.at(-1)!.occurredAt;
  return {
    ...sessionBase(session, eventLog, updatedAt),
    status: "active",
    startedAt: session.startedAt,
    currentSegmentId: nextSegmentId ?? segmentId,
    elapsedActiveSeconds: session.elapsedActiveSeconds,
  };
}

export function startApprovedBreak(
  session: ActiveStudySession,
  segmentId: SegmentId,
  interruptionId: InterruptionId,
  durationMinutes: number,
  at: string,
  reasonCategory: "student-request" | "accessibility-need" | "scheduled-break" =
    "student-request",
): ApprovedBreakStudySession {
  const eventLog = appendEvents(session, [
    {
      type: "break-requested",
      at,
      actor: "student",
      segmentId,
      detailCode: "learner-requested-break",
    },
    {
      type: "break-approved",
      at,
      actor: "system",
      segmentId,
      detailCode: "approved-break-not-failure",
    },
    {
      type: "break-started",
      at,
      actor: "student",
      segmentId,
      detailCode: "instructional-time-paused",
    },
  ]);
  const updatedAt = eventLog.at(-1)!.occurredAt;
  return {
    ...sessionBase(session, eventLog, updatedAt),
    status: "approved-break",
    startedAt: session.startedAt,
    break: {
      interruptionId,
      requestedAt: at,
      approvedAt: at,
      approvedBy: { role: "system" },
      reasonCategory,
      plannedDurationMinutes: durationMinutes,
    },
    resumePoint: resumePointFor(session, segmentId),
  };
}

export function resumeFromBreak(
  session: ApprovedBreakStudySession,
  at: string,
): ActiveStudySession {
  const segmentId = session.resumePoint.segmentId;
  const eventLog = appendEvents(session, [
    {
      type: "break-ended",
      at,
      actor: "student",
      segmentId,
      detailCode: "learner-ready",
    },
    {
      type: "session-resumed",
      at,
      actor: "student",
      segmentId,
      detailCode: "exact-resume-point-restored",
    },
  ]);
  const updatedAt = eventLog.at(-1)!.occurredAt;
  return {
    ...sessionBase(session, eventLog, updatedAt),
    status: "active",
    startedAt: session.startedAt,
    currentSegmentId: segmentId,
    elapsedActiveSeconds: session.resumePoint.elapsedActiveSecondsInSegment,
  };
}

export function pauseCanonicalSession(
  session: ActiveStudySession,
  segmentId: SegmentId,
  at: string,
  pauseCategory:
    | "student-request"
    | "adult-directed"
    | "scheduled"
    | "accessibility-need" = "student-request",
): PausedStudySession {
  const eventLog = appendEvents(session, [
    {
      type: "pause-started",
      at,
      actor: pauseCategory === "student-request" ? "student" : "system",
      segmentId,
      detailCode:
        pauseCategory === "student-request"
          ? "intentional-save-exit"
          : "duration-cap-enforced",
    },
  ]);
  const updatedAt = eventLog.at(-1)!.occurredAt;
  return {
    ...sessionBase(session, eventLog, updatedAt),
    status: "paused",
    startedAt: session.startedAt,
    pausedAt: updatedAt,
    pauseCategory,
    resumePoint: resumePointFor(session, segmentId),
  };
}

export function resumePausedCanonicalSession(
  session: PausedStudySession,
  at: string,
): ActiveStudySession {
  const segmentId = session.resumePoint.segmentId;
  const eventLog = appendEvents(session, [
    {
      type: "session-resumed",
      at,
      actor: "student",
      segmentId,
      detailCode: "exact-resume-point-restored",
    },
  ]);
  const updatedAt = eventLog.at(-1)!.occurredAt;
  return {
    ...sessionBase(session, eventLog, updatedAt),
    status: "active",
    startedAt: session.startedAt,
    currentSegmentId: segmentId,
    elapsedActiveSeconds: session.resumePoint.elapsedActiveSecondsInSegment,
  };
}

export function recordTechnicalRecovery(
  session: ActiveStudySession,
  segmentId: SegmentId,
  at: string,
): ActiveStudySession {
  const interruptionNumber =
    session.eventLog.filter((event) => event.type === "technical-interruption-started")
      .length + 1;
  const eventLog = appendEvents(session, [
    {
      type: "technical-interruption-started",
      at,
      actor: "system",
      segmentId,
      detailCode: `application-restart-${interruptionNumber}`,
    },
    {
      type: "technical-interruption-ended",
      at,
      actor: "system",
      segmentId,
      detailCode: "local-state-validated",
    },
    {
      type: "session-resumed",
      at,
      actor: "system",
      segmentId,
      detailCode: "exact-resume-point-restored",
    },
  ]);
  const updatedAt = eventLog.at(-1)!.occurredAt;
  return {
    ...sessionBase(session, eventLog, updatedAt),
    status: "active",
    startedAt: session.startedAt,
    currentSegmentId: segmentId,
    elapsedActiveSeconds: session.elapsedActiveSeconds,
  };
}

export function updateActiveElapsedSeconds(
  session: ActiveStudySession,
  elapsedActiveSeconds: number,
  at: string,
): ActiveStudySession {
  return {
    ...session,
    revision: session.revision + 1,
    updatedAt: monotonicAt(session, at),
    elapsedActiveSeconds: Math.max(
      session.elapsedActiveSeconds,
      Math.floor(elapsedActiveSeconds),
    ),
  };
}

export function completeCanonicalSession(
  session: ActiveStudySession,
  completedSegmentIds: readonly SegmentId[],
  evidenceIds: readonly EvidenceId[],
  durations: {
    readonly activeDurationSeconds: number;
    readonly breakDurationSeconds: number;
    readonly pausedDurationSeconds: number;
  },
  at: string,
): CompletedStudySession {
  const eventLog = appendEvents(session, [
    {
      type: "session-completed",
      at,
      actor: "student",
      detailCode: "learner-finished-cycle",
    },
  ]);
  const updatedAt = eventLog.at(-1)!.occurredAt;
  const completedSet = new Set(completedSegmentIds);
  const remainingSegmentIds = session.plannedSegmentIds.filter(
    (segmentId) => !completedSet.has(segmentId),
  );
  return {
    ...sessionBase(session, eventLog, updatedAt),
    status: "completed",
    startedAt: startTime(session),
    completedAt: updatedAt,
    result: {
      id: asBrandedId<SessionResultId>(`result:${safeToken(session.id)}:v1`),
      sessionId: session.id,
      outcome: remainingSegmentIds.length === 0 ? "completed" : "partially-completed",
      completedSegmentIds,
      remainingSegmentIds,
      activeDurationSeconds: Math.max(0, Math.floor(durations.activeDurationSeconds)),
      breakDurationSeconds: Math.max(0, Math.floor(durations.breakDurationSeconds)),
      pausedDurationSeconds: Math.max(0, Math.floor(durations.pausedDurationSeconds)),
      evidenceIds,
      recommendedNextAction: evidenceIds.length > 0 ? "review" : "none",
      recordedAt: updatedAt,
    },
  };
}

export function canonicalCompletionEventId(
  session: StudySession,
  segmentId: SegmentId,
): string {
  return `complete:${session.id}:${segmentId}`;
}

export function canonicalSegmentForUi(
  subjectId: RuntimeSubjectId,
  segment: CanonicalUiSegmentId,
) {
  return canonicalSegmentId(subjectId, segment);
}
