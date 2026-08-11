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
export type ParentHubReadFailureCode = Exclude<
  AdultProductionFailureCode,
  'stale-revision' | 'idempotency-collision' | 'already-decided' | 'safety-state-changed'
>
export type ParentHubMutationFailureCode = Exclude<
  AdultProductionFailureCode,
  'stale-revision' | 'already-decided' | 'safety-state-changed'
>

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
export type SettingsReadInput = ParentHubStudentSelector
export type SettingsApplyInput = ParentHubMutationInput & { readonly changes: ParentHubSettingsChanges }
export type SettingsReadResult =
  | Readonly<{ status: 'settings'; settings: ParentHubSettings; revision: number; updatedAt: string }>
  | AdultProductionFailure<ParentHubReadFailureCode>
export type SettingsApplyResult =
  | Readonly<{ status: 'applied'; revision: number; appliedAt: string }>
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<ParentHubMutationFailureCode>
export interface ParentHubSettingsPort {
  read(input: SettingsReadInput): Promise<SettingsReadResult>
  apply(input: SettingsApplyInput): Promise<SettingsApplyResult>
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
export type ReviewsListInput = ParentHubListInput
export type ReviewsDecideInput = ParentHubMutationInput & {
  readonly reviewRef: string
  readonly decision: ParentHubReviewDecision
}
export type ReviewsListResult =
  | Readonly<{ status: 'listed'; reviews: readonly ParentHubReviewSummary[]; nextCursor?: string }>
  | AdultProductionFailure<ParentHubReadFailureCode>
export type ReviewsDecideResult =
  | Readonly<{ status: 'decided'; decision: ParentHubReviewDecision; revision: number; decidedAt: string }>
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'already-decided'; decision: ParentHubReviewDecision; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<ParentHubMutationFailureCode>
export interface ParentHubReviewsPort {
  list(input: ReviewsListInput): Promise<ReviewsListResult>
  decide(input: ReviewsDecideInput): Promise<ReviewsDecideResult>
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
export type CalendarListInput = ParentHubListInput
export type CalendarPauseInput = ParentHubMutationInput & {
  readonly blockRef: string
  readonly reason: 'planned-break' | 'requested-break' | 'outside-interruption' | 'technical-interruption'
}
export type CalendarCreateContinuationInput = ParentHubMutationInput & {
  readonly sourceBlockRef: string
  /** Requested future schedule time, not a client assertion of when the server acted. */
  readonly scheduledAt: string
  readonly durationMinutes: number
}
export type CalendarListResult =
  | Readonly<{ status: 'listed'; blocks: readonly ParentHubCalendarSummary[]; nextCursor?: string }>
  | AdultProductionFailure<ParentHubReadFailureCode>
type ParentHubCalendarMutationConflict =
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'calendar-state-changed'; currentState: ParentHubCalendarState; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<ParentHubMutationFailureCode>
export type CalendarPauseResult =
  | Readonly<{ status: 'paused'; revision: number; pausedAt: string }>
  | ParentHubCalendarMutationConflict
export type CalendarCreateContinuationResult =
  | Readonly<{ status: 'continuation-created'; blockRef: string; revision: number; createdAt: string }>
  | ParentHubCalendarMutationConflict
export interface ParentHubCalendarPort {
  list(input: CalendarListInput): Promise<CalendarListResult>
  pause(input: CalendarPauseInput): Promise<CalendarPauseResult>
  createContinuation(input: CalendarCreateContinuationInput): Promise<CalendarCreateContinuationResult>
}

export interface ParentHubSafetyReviewSummary {
  readonly safetyReviewRef: string
  readonly studentRef: string
  readonly category: 'urgent-safety' | 'wellbeing'
  readonly urgency: 'urgent' | 'high'
  readonly heldAt: string
  readonly revision: number
}
export const PARENT_HUB_SAFETY_REVIEW_DECISIONS = ['resume-approved', 'end-session'] as const
export type ParentHubSafetyReviewDecision = typeof PARENT_HUB_SAFETY_REVIEW_DECISIONS[number]
export type ParentHubSafetyReviewResolution =
  | Readonly<{
      /** Clears the adult hold only; this is not a learner resume command. */
      decision: 'resume-approved'
      reasonCode: 'adult-reviewed-resume-approved'
    }>
  | Readonly<{
      /** Authorizes the server transaction to end the work bound to this review. */
      decision: 'end-session'
      reasonCode: 'adult-reviewed-end-session'
    }>
export type SafetyReviewListOpenInput = ParentHubStudentSelector
export type SafetyReviewAndClearInput = ParentHubStudentSelector & ParentHubSafetyReviewResolution & {
  readonly safetyReviewRef: string
  readonly proposalRevision: number
  readonly sessionRevision: number
  readonly calendarRevision: number
  readonly mutationId: string
}
export interface ParentHubSafetyStateRevisions {
  readonly proposalRevision: number
  readonly sessionRevision: number
  readonly calendarRevision: number
}
export type SafetyReviewListOpenResult =
  | Readonly<{ status: 'listed'; reviews: readonly ParentHubSafetyReviewSummary[] }>
  | AdultProductionFailure<ParentHubReadFailureCode>
export type SafetyReviewAndClearResult =
  | (Readonly<{
      status: 'cleared'
      decision: ParentHubSafetyReviewDecision
      clearedAt: string
    }> & ParentHubSafetyStateRevisions)
  | (Readonly<{ status: 'duplicate-replay'; decision: ParentHubSafetyReviewDecision }> & ParentHubSafetyStateRevisions)
  | (Readonly<{ status: 'safety-state-changed' }> & ParentHubSafetyStateRevisions)
  | AdultProductionFailure<ParentHubMutationFailureCode>
export interface ParentHubSafetyReviewPort {
  listOpen(input: SafetyReviewListOpenInput): Promise<SafetyReviewListOpenResult>
  reviewAndClear(input: SafetyReviewAndClearInput): Promise<SafetyReviewAndClearResult>
}

export type ParentHubAdultNoteCategory = 'instructional' | 'accommodation' | 'follow-up' | 'administrative'
export type AdultPrivateCommitNoteInput = ParentHubMutationInput & {
  readonly noteRef: string
  readonly category: ParentHubAdultNoteCategory
  readonly body: string
}
export type AdultPrivateCommitNoteResult =
  | Readonly<{ status: 'committed'; noteRef: string; revision: number; committedAt: string }>
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<ParentHubMutationFailureCode>
export interface ParentHubAdultPrivatePort {
  commitNote(input: AdultPrivateCommitNoteInput): Promise<AdultPrivateCommitNoteResult>
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
export type NotificationsListInput = ParentHubListInput
export type NotificationsMarkReadInput = ParentHubMutationInput & { readonly notificationId: string }
export type NotificationsListResult =
  | Readonly<{ status: 'listed'; notifications: readonly ParentHubNotificationSummary[]; nextCursor?: string }>
  | AdultProductionFailure<ParentHubReadFailureCode>
export type NotificationsMarkReadResult =
  | Readonly<{ status: 'marked-read'; revision: number; readAt: string }>
  | Readonly<{ status: 'duplicate-replay'; revision: number }>
  | Readonly<{ status: 'stale-revision'; currentRevision: number }>
  | AdultProductionFailure<ParentHubMutationFailureCode>
export interface ParentHubNotificationsPort {
  readonly delivery: 'in-app'
  list(input: NotificationsListInput): Promise<NotificationsListResult>
  markRead(input: NotificationsMarkReadInput): Promise<NotificationsMarkReadResult>
}

export interface ProductionStudyParentHubPorts {
  readonly settings: ParentHubSettingsPort
  readonly reviews: ParentHubReviewsPort
  readonly calendar: ParentHubCalendarPort
  readonly safetyReview: ParentHubSafetyReviewPort
  readonly adultPrivate: ParentHubAdultPrivatePort
  readonly notifications: ParentHubNotificationsPort
}
