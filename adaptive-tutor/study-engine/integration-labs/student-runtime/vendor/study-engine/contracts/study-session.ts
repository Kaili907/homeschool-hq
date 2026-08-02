import type {
  ActorReference,
  ContractHeader,
  EvidenceId,
  InterruptionId,
  ISODateTime,
  SegmentId,
  SessionActor,
  SessionEventId,
  SessionId,
  SessionResultId,
  StudentId,
  StudyPlanId,
} from './common.ts'

export interface ResumePoint {
  readonly segmentId: SegmentId
  readonly elapsedActiveSecondsInSegment: number
  readonly responseDraftRef?: string
}

export type SessionEventType =
  | 'session-planned'
  | 'session-started'
  | 'segment-started'
  | 'active-response-recorded'
  | 'segment-completed'
  | 'pause-started'
  | 'break-requested'
  | 'break-approved'
  | 'break-started'
  | 'break-ended'
  | 'technical-interruption-started'
  | 'technical-interruption-ended'
  | 'session-resumed'
  | 'redirection-recorded'
  | 'tutor-intervention-recorded'
  | 'session-completed'
  | 'session-abandoned'

export interface StudySessionEvent {
  readonly id: SessionEventId
  readonly sessionId: SessionId
  readonly sequence: number
  readonly occurredAt: ISODateTime
  readonly type: SessionEventType
  readonly actor: SessionActor
  readonly segmentId?: SegmentId
  readonly detailCode?: string
  /** Low-detail references only; never raw keystrokes, audio, or app names. */
  readonly evidenceRef?: EvidenceId
}

export interface SessionResult {
  readonly id: SessionResultId
  readonly sessionId: SessionId
  readonly outcome: 'completed' | 'partially-completed' | 'abandoned'
  readonly completedSegmentIds: readonly SegmentId[]
  readonly remainingSegmentIds: readonly SegmentId[]
  readonly activeDurationSeconds: number
  readonly breakDurationSeconds: number
  readonly pausedDurationSeconds: number
  readonly evidenceIds: readonly EvidenceId[]
  readonly recommendedNextAction:
    | 'continue-plan'
    | 'review'
    | 'reteach'
    | 'prerequisite-remediation'
    | 'adult-review'
    | 'none'
  readonly recordedAt: ISODateTime
}

export interface ApprovedBreak {
  readonly interruptionId: InterruptionId
  readonly requestedAt: ISODateTime
  readonly approvedAt: ISODateTime
  readonly approvedBy: ActorReference & { readonly role: 'parent' | 'teacher' | 'tutor' | 'system' }
  readonly reasonCategory:
    | 'student-request'
    | 'accessibility-need'
    | 'scheduled-break'
    | 'wellbeing'
    | 'adult-directed'
  readonly plannedDurationMinutes: number
}

export interface StudentRequestedBreak {
  readonly interruptionId: InterruptionId
  readonly requestedAt: ISODateTime
  readonly requestState: 'pending' | 'approved'
  readonly approvedAt?: ISODateTime
  readonly plannedDurationMinutes?: number
}

export interface TechnicalInterruption {
  readonly interruptionId: InterruptionId
  readonly startedAt: ISODateTime
  readonly category:
    | 'network-unavailable'
    | 'device-power'
    | 'application-restart'
    | 'audio-unavailable'
    | 'input-unavailable'
    | 'unknown-technical'
  readonly recoverable: boolean
  readonly detailCode?: string
}

interface StudySessionBase<Status extends string>
  extends ContractHeader<'study-session', SessionId> {
  readonly status: Status
  readonly studentId: StudentId
  readonly studyPlanId: StudyPlanId
  readonly plannedSegmentIds: readonly SegmentId[]
  readonly eventLog: readonly StudySessionEvent[]
}

export interface PlannedStudySession extends StudySessionBase<'planned'> {
  readonly scheduledStartAt: ISODateTime
}

export interface ActiveStudySession extends StudySessionBase<'active'> {
  readonly startedAt: ISODateTime
  readonly currentSegmentId: SegmentId
  readonly elapsedActiveSeconds: number
}

export interface PausedStudySession extends StudySessionBase<'paused'> {
  readonly startedAt: ISODateTime
  readonly pausedAt: ISODateTime
  readonly pauseCategory: 'student-request' | 'adult-directed' | 'scheduled' | 'accessibility-need'
  readonly resumePoint: ResumePoint
}

export interface ApprovedBreakStudySession extends StudySessionBase<'approved-break'> {
  readonly startedAt: ISODateTime
  readonly break: ApprovedBreak
  readonly resumePoint: ResumePoint
}

export interface StudentRequestedBreakStudySession
  extends StudySessionBase<'student-requested-break'> {
  readonly startedAt: ISODateTime
  readonly breakRequest: StudentRequestedBreak
  readonly resumePoint: ResumePoint
}

export interface TechnicalInterruptionStudySession
  extends StudySessionBase<'technical-interruption'> {
  readonly startedAt: ISODateTime
  readonly interruption: TechnicalInterruption
  readonly resumePoint: ResumePoint
}

export interface CompletedStudySession extends StudySessionBase<'completed'> {
  readonly startedAt: ISODateTime
  readonly completedAt: ISODateTime
  readonly result: SessionResult & { readonly outcome: 'completed' | 'partially-completed' }
}

export interface AbandonedStudySession extends StudySessionBase<'abandoned'> {
  readonly startedAt: ISODateTime
  readonly abandonedAt: ISODateTime
  readonly reasonCategory:
    | 'student-choice'
    | 'adult-directed'
    | 'schedule-change'
    | 'wellbeing'
    | 'technical-unrecoverable'
    | 'other'
  readonly result: SessionResult & { readonly outcome: 'abandoned' }
}

export type StudySession =
  | PlannedStudySession
  | ActiveStudySession
  | PausedStudySession
  | ApprovedBreakStudySession
  | StudentRequestedBreakStudySession
  | TechnicalInterruptionStudySession
  | CompletedStudySession
  | AbandonedStudySession

