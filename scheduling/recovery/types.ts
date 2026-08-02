/**
 * Manuel Academy schedule-recovery domain contracts.
 *
 * The recovery package intentionally owns its own versioned boundary. It can be
 * adapted to the shared planner without making the planner a second authority
 * for assignment completion, curriculum mastery, or attendance.
 */

export const RECOVERY_CONTRACT_VERSION = 1 as const

/** Calendar date in the household time zone (`YYYY-MM-DD`). */
export type ISODate = string

/** Local wall-clock time (`HH:mm`). Event starts never use `24:00`. */
export type LocalTime = string

/** An ISO timestamp with an explicit offset or `Z`. */
export type InstantString = string

export interface LocalDateTime {
  date: ISODate
  time: LocalTime
}

export type ActivityKind =
  | 'academic-assignment'
  | 'romeo-virtual-academy-assignment'
  | 'manuel-academy-lesson'
  | 'adaptive-tutor-intervention'
  | 'ready-for-life-activity'
  | 'wrestling'
  | 'jiu-jitsu'
  | 'weight-training'
  | 'pe-activity'
  | 'appointment'
  | 'meal'
  | 'movement-break'
  | 'focus-recovery-break'
  | 'parent-created-activity'
  | 'sleep'
  | 'protected-time'

export type LoadCategory =
  | 'academic'
  | 'life-skills'
  | 'physical'
  | 'restorative'
  | 'neutral'

export type WorkRequirement = 'required' | 'review' | 'optional'

export type PriorityBand = 'critical' | 'high' | 'normal' | 'low'

export interface PriorityModel {
  band: PriorityBand
  /** Stable parent/source priority before deadline urgency, from 0 through 100. */
  baseScore: number
  factors: Array<{
    code:
      | 'hard-deadline'
      | 'soft-deadline'
      | 'overdue'
      | 'prerequisite'
      | 'required'
      | 'parent-priority'
      | 'review'
      | 'student-readiness'
    weight: number
    explanation: string
  }>
}

export type DeadlineKind = 'hard' | 'soft'

export interface DeadlineModel {
  due: LocalDateTime
  kind: DeadlineKind
  /** A hard deadline is never changed by the recovery engine. */
  parentLocked: boolean
}

export type DurationConfidence = 'high' | 'medium' | 'low'

export interface DurationEstimate {
  expectedMinutes: number
  minimumMinutes: number
  maximumMinutes: number
  confidence: DurationConfidence
  basis:
    | 'source-provided'
    | 'student-history'
    | 'parent-estimate'
    | 'teacher-estimate'
    | 'default'
  observedSampleCount?: number
}

export interface SourceReference {
  system:
    | 'shared-planner'
    | 'romeo-virtual-academy'
    | 'manuel-academy'
    | 'adaptive-tutor'
    | 'ready-for-life'
    | 'parent'
    | 'external'
  sourceId: string
  adapterData?: JsonObject
}

export type WorkItemStatus = 'active' | 'completed' | 'waived'

/**
 * A work item is the durable obligation. Schedule events are only time
 * reservations for it, so shortening or splitting a reservation cannot silently
 * delete required work.
 */
export interface WorkItem {
  id: string
  studentId: string
  title: string
  kind: ActivityKind
  loadCategory: LoadCategory
  requirement: WorkRequirement
  priority: PriorityModel
  deadline?: DeadlineModel
  duration: DurationEstimate
  completedMinutes: number
  status: WorkItemStatus
  canSplit: boolean
  canShorten: boolean
  minimumSessionMinutes: number
  source: SourceReference
  createdAt: InstantString
  updatedAt: InstantString
}

export type EventMobility = 'fixed' | 'movable'

export type ScheduleEventStatus =
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'missed'
  | 'interrupted'
  | 'shortened'
  | 'overdue'
  | 'deferred'
  | 'cancelled'

export type ProtectionKind = 'none' | 'sleep' | 'meal' | 'parent-defined'

export interface ScheduleEvent {
  id: string
  studentId: string
  workItemId?: string
  title: string
  kind: ActivityKind
  loadCategory: LoadCategory
  start: LocalDateTime
  durationMinutes: number
  mobility: EventMobility
  /**
   * Parent locking is stronger than ordinary fixed placement. Recovery never
   * edits a parent-locked row, including its duration or disposition.
   */
  parentLocked: boolean
  protection: ProtectionKind
  status: ScheduleEventStatus
  /** Deterministic ordering for segments that share a work item. */
  segmentIndex?: number
  location?: string
  source: SourceReference
  createdAt: InstantString
  updatedAt: InstantString
}

export interface ProtectedWindow {
  id: string
  /** Omit to protect the window for every student in the household. */
  studentId?: string
  date: ISODate
  startTime: LocalTime
  /** May be `24:00` to represent the end of the local calendar day. */
  endTime: LocalTime
  kind: 'sleep' | 'meal' | 'parent-defined'
  title: string
  parentLocked: true
}

export interface CatchUpBlock {
  id: string
  studentId: string
  date: ISODate
  startTime: LocalTime
  /** May be `24:00` to represent the end of the local calendar day. */
  endTime: LocalTime
  label: string
  parentLocked: boolean
}

export interface DailyWorkloadLimit {
  /** All scheduled minutes, including sports and appointments. */
  maxScheduledMinutes: number
  maxAcademicMinutes: number
  maxPhysicalMinutes: number
}

export interface StudentWorkloadPolicy {
  studentId: string
  timeZone: string
  defaultDailyLimit: DailyWorkloadLimit
  /** Per-date parent overrides, keyed by household-local `YYYY-MM-DD`. */
  dailyLimitOverrides: Record<ISODate, DailyWorkloadLimit>
  maxAcademicMinutesPerWeek: number
  maxCarryoverMinutesPerDay: number
  preferredFocusBlockMinutes: number
  maxContinuousFocusMinutes: number
  minimumFocusBlockMinutes: number
  minimumBreakMinutes: number
  movementBreakAfterMinutes: number
  movementBreakMinutes: number
  focusRecoveryBreakMinutes: number
  earliestStartTime: LocalTime
  /** May be `24:00`. */
  latestEndTime: LocalTime
  /** Dates on which automatic academic placement is allowed. */
  activeWeekdays: Array<1 | 2 | 3 | 4 | 5 | 6 | 7>
}

export interface RecoveryStudent {
  id: string
  displayName: string
  policy: StudentWorkloadPolicy
}

export interface RecoverySchedule {
  version: typeof RECOVERY_CONTRACT_VERSION
  householdId: string
  timeZone: string
  range: {
    start: ISODate
    end: ISODate
  }
  students: RecoveryStudent[]
  workItems: WorkItem[]
  events: ScheduleEvent[]
  protectedWindows: ProtectedWindow[]
  catchUpBlocks: CatchUpBlock[]
  revision: number
  updatedAt: InstantString
}

export type RecoveryTriggerKind =
  | 'missed'
  | 'interrupted'
  | 'shortened'
  | 'overdue'
  | 'focus-difficulty'

export interface RecoveryTrigger {
  kind: RecoveryTriggerKind
  eventId: string
  observedAt: InstantString
  /** Required when the source cannot derive it from the linked work item/event. */
  remainingMinutes?: number
  actualMinutes?: number
  reason?: string
}

export type RecoveryChoice =
  | 'move-to-tomorrow'
  | 'shorten-today'
  | 'split-sessions'
  | 'move-to-catch-up-block'
  | 'replace-lower-priority-review'
  | 'keep-due-date-rebalance-week'
  | 'parent-manual'
  | 'leave-unchanged'

export const RECOVERY_CHOICE_LABELS: Record<RecoveryChoice, string> = {
  'move-to-tomorrow': 'Move to tomorrow',
  'shorten-today': "Shorten today’s remaining work",
  'split-sessions': 'Split into multiple sessions',
  'move-to-catch-up-block': 'Move into a catch-up block',
  'replace-lower-priority-review': 'Replace lower-priority review',
  'keep-due-date-rebalance-week': 'Keep the due date and rebalance the week',
  'parent-manual': 'Parent chooses manually',
  'leave-unchanged': 'Leave unchanged',
}

export type OptionAvailability = 'available' | 'requires-parent' | 'unavailable'

export type ChangeReasonCode =
  | 'recovered-missed-work'
  | 'recovered-interrupted-work'
  | 'recovered-shortened-work'
  | 'recovered-overdue-work'
  | 'support-focus-stamina'
  | 'protect-fixed-event'
  | 'protect-parent-lock'
  | 'protect-sleep'
  | 'protect-meal'
  | 'protect-parent-time'
  | 'avoid-daily-overload'
  | 'avoid-weekly-overload'
  | 'meet-deadline'
  | 'use-catch-up-capacity'
  | 'defer-lower-priority-review'
  | 'parent-override'
  | 'undo'

export interface EventChange {
  kind: 'event'
  eventId: string
  before: ScheduleEvent | null
  after: ScheduleEvent | null
  reasonCode: ChangeReasonCode
}

export interface WorkItemChange {
  kind: 'work-item'
  workItemId: string
  before: WorkItem | null
  after: WorkItem | null
  reasonCode: ChangeReasonCode
}

export type ScheduleChange = EventChange | WorkItemChange

export type DueDateRiskLevel = 'none' | 'watch' | 'at-risk' | 'overdue'

export interface DueDateRiskWarning {
  workItemId: string
  studentId: string
  level: DueDateRiskLevel
  due?: LocalDateTime
  unscheduledMinutes: number
  message: string
}

export interface Conflict {
  id: string
  studentId: string
  date: ISODate
  kind:
    | 'event-overlap'
    | 'protected-time-overlap'
    | 'outside-student-day'
    | 'fixed-event-overlap'
    | 'catch-up-capacity'
  eventIds: string[]
  protectedWindowId?: string
  message: string
}

export interface DayWorkloadSummary {
  studentId: string
  date: ISODate
  scheduledMinutes: number
  academicMinutes: number
  physicalMinutes: number
  carryoverMinutes: number
  limit: DailyWorkloadLimit
  overloaded: boolean
}

export interface WeekWorkloadSummary {
  studentId: string
  weekStart: ISODate
  weekEnd: ISODate
  academicMinutes: number
  maxAcademicMinutes: number
  overloaded: boolean
  days: DayWorkloadSummary[]
}

export interface RecoveryTradeoff {
  gained: string
  cost: string
}

export interface RecoveryOption {
  id: string
  choice: RecoveryChoice
  label: string
  availability: OptionAvailability
  why: string
  tradeoff: RecoveryTradeoff
  changes: ScheduleChange[]
  conflicts: Conflict[]
  dueDateRisks: DueDateRiskWarning[]
  workload: DayWorkloadSummary[]
  /** True only when the option adds no new invariant violation. */
  preservesInvariants: boolean
  studentExplanation: string
}

export type RecoveryProposalStatus =
  | 'pending-parent'
  | 'applied'
  | 'rejected'
  | 'superseded'

export interface RecoveryProposal {
  id: string
  scheduleRevision: number
  studentId: string
  trigger: RecoveryTrigger
  affectedWorkItemId?: string
  createdAt: InstantString
  status: RecoveryProposalStatus
  recommendedOptionId: string
  options: RecoveryOption[]
  summary: string
}

export interface RecoveryActor {
  id: string
  role: 'parent' | 'system'
  displayName?: string
}

export interface RecoveryDecision {
  id: string
  proposalId: string
  kind: 'approve' | 'override' | 'reject'
  actor: RecoveryActor
  decidedAt: InstantString
  selectedOptionId?: string
  /**
   * Override changes are allowed only for a parent actor and are subjected to
   * the same fixed/locked/protected/no-overload validation as generated options.
   */
  overrideChanges?: ScheduleChange[]
  reason?: string
  /**
   * Required to waive a required work item. Generated options never request
   * this; it exists solely for an explicit, reviewable parent override.
   */
  explicitlyApproveRequiredWorkRemoval?: boolean
}

export type RecoveryAuditAction =
  | 'proposal-applied'
  | 'parent-override-applied'
  | 'proposal-rejected'
  | 'undo'

export interface RecoveryAuditEntry {
  id: string
  proposalId: string
  decisionId: string
  action: RecoveryAuditAction
  actor: RecoveryActor
  at: InstantString
  reason?: string
  changes: ScheduleChange[]
  beforeSchedule: RecoverySchedule
  afterSchedule: RecoverySchedule
  undoOf?: string
  undoneBy?: string
}

export interface RecoveryState {
  schedule: RecoverySchedule
  proposals: RecoveryProposal[]
  /** Append-only. Undo appends a compensating entry instead of erasing history. */
  auditHistory: RecoveryAuditEntry[]
}

export interface GenerateRecoveryProposalInput {
  schedule: RecoverySchedule
  trigger: RecoveryTrigger
  /** Caller-supplied for deterministic distributed writes; generated if omitted. */
  proposalId?: string
  now?: InstantString
}

export interface ApplyRecoveryDecisionInput {
  state: RecoveryState
  decision: RecoveryDecision
}

export type RecoveryErrorCode =
  | 'invalid-contract'
  | 'event-not-found'
  | 'work-item-not-found'
  | 'proposal-not-found'
  | 'option-not-found'
  | 'proposal-not-pending'
  | 'stale-schedule-revision'
  | 'parent-approval-required'
  | 'fixed-event-change'
  | 'parent-locked-change'
  | 'protected-time-change'
  | 'required-work-removal'
  | 'new-conflict'
  | 'daily-overload'
  | 'weekly-overload'
  | 'carryover-overload'
  | 'focus-stamina-overload'
  | 'invalid-decision'
  | 'nothing-to-undo'
  | 'undo-not-latest'
  | 'already-undone'

export interface RecoveryError {
  code: RecoveryErrorCode
  message: string
  path?: string
}

export type RecoveryResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: RecoveryError[] }

export interface ValidationIssue {
  path: string
  code: string
  message: string
}

export type ValidationResult<T> =
  | { valid: true; value: T; issues: [] }
  | { valid: false; issues: ValidationIssue[] }

export type JsonPrimitive = string | number | boolean | null
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

/**
 * Narrow structural bridge for Session 1's planner. It deliberately does not
 * import or edit the shared planner package.
 */
export interface SharedPlannerBlockLike {
  id: string
  title: string
  category: string
  startTime: string
  expectedMinutes: number
  scheduleBehavior: 'fixed' | 'flexible'
  assignedProfileIds: string[]
  assignToAll: boolean
  source: { kind: string; [key: string]: unknown }
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface SharedPlannerDailyBlockLike {
  profileId: string
  date: ISODate
  instanceId: string
  block: SharedPlannerBlockLike
  progress: { status: string; activeElapsedSeconds?: number }
}
