export const PARENT_HUB_PRODUCTION_SCHEMA_VERSION = 1 as const

export const ADULT_PRODUCTION_FAILURE_CODES = [
  'adult-unauthorized',
  'student-out-of-guardian-scope',
  'stale-revision',
  'idempotency-collision',
  'authorization-infrastructure-unavailable',
  'rate-limited',
  'not-found',
  'already-decided',
  'safety-state-changed',
] as const

export type AdultProductionFailureCode = typeof ADULT_PRODUCTION_FAILURE_CODES[number]

export type AdultProductionFailure<Code extends AdultProductionFailureCode = AdultProductionFailureCode> = Readonly<{
  status: 'failed'
  code: Code
  retryAfterSeconds?: number
}>

export interface ParentHubStudentSelector {
  /** Identifies the requested target only. The server derives access independently. */
  readonly studentRef: string
}

export interface ParentHubListInput extends ParentHubStudentSelector { readonly cursor?: string }
export interface ParentHubMutationInput extends ParentHubStudentSelector {
  readonly expectedRevision: number
  readonly mutationId: string
}

export type ParentHubTimerMode = 'visible' | 'hidden' | 'count-up' | 'count-down'
export interface ParentHubSettings {
  readonly timerMode: ParentHubTimerMode
  readonly maximumWorkMinutes: number
  readonly breakMinimumMinutes: number
  readonly breakMaximumMinutes: number
  readonly requiredBreaks: number
  readonly reducedMotion: boolean
  readonly noAudio: boolean
  readonly largeText: boolean
  readonly readAloud: boolean
  readonly speechInputAllowed: boolean
}
export type ParentHubSettingsChanges = Readonly<Partial<ParentHubSettings>>
export type SettingsReadResult =
  | Readonly<{ status: 'settings'; settings: ParentHubSettings; revision: number; updatedAt: string }>
  | AdultProductionFailure
export type SettingsApplyResult =
  | Readonly<{ status: 'applied'; revision: number; appliedAt: string }>
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<Exclude<AdultProductionFailureCode, 'stale-revision'>>
export interface ParentHubSettingsPort {
  read(input: ParentHubStudentSelector): Promise<SettingsReadResult>
  apply(input: ParentHubMutationInput & { readonly changes: ParentHubSettingsChanges }): Promise<SettingsApplyResult>
}

export type ParentHubReviewKind = 'spaced' | 'reteach' | 'prerequisite' | 'manual'
export type ParentHubReviewDecision = 'accepted' | 'rejected'
export interface ParentHubReviewSummary {
  readonly reviewRef: string
  readonly studentRef: string
  readonly kind: ParentHubReviewKind
  readonly dueAt: string
  readonly priority: number
  readonly state: 'pending' | 'decided'
  readonly revision: number
}
export type ReviewsListResult =
  | Readonly<{ status: 'listed'; reviews: readonly ParentHubReviewSummary[]; nextCursor?: string }>
  | AdultProductionFailure
export type ReviewsDecideResult =
  | Readonly<{ status: 'decided'; decision: ParentHubReviewDecision; revision: number; decidedAt: string }>
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'already-decided'; decision: ParentHubReviewDecision; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<Exclude<AdultProductionFailureCode, 'already-decided' | 'stale-revision'>>
export interface ParentHubReviewsPort {
  list(input: ParentHubListInput): Promise<ReviewsListResult>
  decide(input: ParentHubMutationInput & { readonly reviewRef: string; readonly decision: ParentHubReviewDecision }): Promise<ReviewsDecideResult>
}

export type ParentHubCalendarState = 'scheduled' | 'available' | 'in-progress' | 'paused' | 'completed' | 'cancelled'
export type ParentHubCalendarCategory = 'lesson' | 'review' | 'resume' | 'break' | 'assessment'
export interface ParentHubCalendarSummary {
  readonly blockRef: string
  readonly studentRef: string
  readonly category: ParentHubCalendarCategory
  readonly scheduledAt: string
  readonly durationMinutes: number
  readonly state: ParentHubCalendarState
  readonly revision: number
}
export type CalendarListResult =
  | Readonly<{ status: 'listed'; blocks: readonly ParentHubCalendarSummary[]; nextCursor?: string }>
  | AdultProductionFailure
type ParentHubCalendarMutationConflict =
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'calendar-state-changed'; currentState: ParentHubCalendarState; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<Exclude<AdultProductionFailureCode, 'stale-revision'>>
export type CalendarPauseResult =
  | Readonly<{ status: 'paused'; revision: number; pausedAt: string }>
  | ParentHubCalendarMutationConflict
export type CalendarCreateContinuationResult =
  | Readonly<{ status: 'continuation-created'; blockRef: string; revision: number; createdAt: string }>
  | ParentHubCalendarMutationConflict
export interface ParentHubCalendarPort {
  list(input: ParentHubListInput): Promise<CalendarListResult>
  pause(input: ParentHubMutationInput & {
    readonly blockRef: string
    readonly pausedAt: string
    readonly reason: 'planned-break' | 'requested-break' | 'outside-interruption' | 'technical-interruption'
  }): Promise<CalendarPauseResult>
  createContinuation(input: ParentHubMutationInput & {
    readonly sourceBlockRef: string
    readonly scheduledAt: string
    readonly durationMinutes: number
  }): Promise<CalendarCreateContinuationResult>
}

export interface ParentHubSafetyReviewSummary {
  readonly safetyReviewRef: string
  readonly studentRef: string
  readonly category: 'urgent-safety' | 'wellbeing'
  readonly urgency: 'urgent' | 'high'
  readonly heldAt: string
  readonly revision: number
}
export type SafetyReviewListOpenResult =
  | Readonly<{ status: 'listed'; reviews: readonly ParentHubSafetyReviewSummary[] }>
  | AdultProductionFailure
export type SafetyReviewAndClearResult =
  | Readonly<{ status: 'cleared'; revision: number; clearedAt: string }>
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'safety-state-changed'; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<Exclude<AdultProductionFailureCode, 'safety-state-changed' | 'stale-revision'>>
export interface ParentHubSafetyReviewPort {
  listOpen(input: ParentHubStudentSelector): Promise<SafetyReviewListOpenResult>
  reviewAndClear(input: ParentHubMutationInput & { readonly safetyReviewRef: string; readonly reviewedAt: string }): Promise<SafetyReviewAndClearResult>
}

export type ParentHubAdultNoteCategory = 'instructional' | 'accommodation' | 'follow-up' | 'administrative'
export type AdultPrivateCommitNoteResult =
  | Readonly<{ status: 'committed'; noteRef: string; revision: number; committedAt: string }>
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<Exclude<AdultProductionFailureCode, 'stale-revision'>>
export interface ParentHubAdultPrivatePort {
  commitNote(input: ParentHubMutationInput & {
    readonly noteRef: string
    readonly category: ParentHubAdultNoteCategory
    readonly body: string
  }): Promise<AdultPrivateCommitNoteResult>
}

export type ParentHubNotificationTitle = 'Review ready' | 'Schedule changed' | 'Safety review required' | 'Settings updated'
export type ParentHubNotificationCategory = 'review' | 'calendar' | 'safety' | 'settings'
export type ParentHubNotificationUrgency = 'routine' | 'important' | 'urgent'
export interface ParentHubNotificationSummary {
  readonly notificationId: string
  readonly studentRef: string
  readonly title: ParentHubNotificationTitle
  readonly category: ParentHubNotificationCategory
  readonly urgency: ParentHubNotificationUrgency
  readonly createdAt: string
  readonly readAt: string | null
  readonly safeActionRef: string | null
}
export type NotificationsListResult =
  | Readonly<{ status: 'listed'; notifications: readonly ParentHubNotificationSummary[]; nextCursor?: string }>
  | AdultProductionFailure
export type NotificationsMarkReadResult =
  | Readonly<{ status: 'marked-read'; revision: number; readAt: string }>
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<Exclude<AdultProductionFailureCode, 'stale-revision'>>
export interface ParentHubNotificationsPort {
  readonly delivery: 'in-app'
  list(input: ParentHubListInput): Promise<NotificationsListResult>
  markRead(input: ParentHubMutationInput & { readonly notificationId: string }): Promise<NotificationsMarkReadResult>
}

export interface ProductionStudyParentHubPorts {
  readonly settings: ParentHubSettingsPort
  readonly reviews: ParentHubReviewsPort
  readonly calendar: ParentHubCalendarPort
  readonly safetyReview: ParentHubSafetyReviewPort
  readonly adultPrivate: ParentHubAdultPrivatePort
  readonly notifications: ParentHubNotificationsPort
}
