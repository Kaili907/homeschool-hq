import type { ISODate } from '../types'

/** The planner evolves independently while AppState remains schema version 2. */
export const PLANNER_VERSION = 2 as const

/** Monday = 1 through Sunday = 7. Recurring templates may include weekends. */
export type PlannerWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type PlannerScheduleBehavior = 'flexible' | 'fixed'

export type PlannerBlockStatus =
  | 'not-started'
  | 'in-progress'
  | 'paused'
  | 'completed'
  | 'skipped'
  | 'excused'
  | 'moved'

/**
 * Persisted values are stable identifiers. Human-readable labels live in
 * defaults.ts so labels can change without rewriting saved planner data.
 */
export type PlannerActivityCategory =
  | 'romeo-online'
  | 'manuel-academy'
  | 'existing-mission'
  | 'wrestling'
  | 'jiu-jitsu'
  | 'weight-training'
  | 'other-pe'
  | 'reading'
  | 'meal'
  | 'break'
  | 'appointment'
  | 'family-responsibility'
  | 'custom'

export type PlannerJsonPrimitive = string | number | boolean | null
export type PlannerJsonValue =
  | PlannerJsonPrimitive
  | PlannerJsonValue[]
  | { [key: string]: PlannerJsonValue }
export type PlannerJsonObject = { [key: string]: PlannerJsonValue }

export interface PlannerCurriculumItemRef {
  id: string
  text: string
  dadTaught: boolean
}

export type PlannerActivitySource =
  | { kind: 'manual' }
  | {
      kind: 'mission'
      missionItemId: string
      /** Auto-only items can only be completed by their linked activity. */
      autoOnly: boolean
      autoKind?: 'math' | 'typing' | 'reading' | 'mindset'
    }
  | {
      kind: 'curriculum'
      subjectId: string
      subjectLabel: string
      week: number
      items: PlannerCurriculumItemRef[]
    }
  | {
      kind: 'romeo-online'
      activityId?: string
    }

/**
 * Safe entry information for an activity. It is deliberately conservative:
 * adapters provide the safest dependable entry point, never an invented lesson
 * step that the destination cannot actually restore.
 */
export interface LinkedPlannerActivity {
  adapter: 'mission' | 'curriculum' | 'romeo-online' | 'route'
  activityId: string
  route?: string
  lessonId?: string
  stepId?: string
  itemId?: string
  safeEntryData?: PlannerJsonObject
}

export interface PlannerBlock {
  /** Stable template/generated-block identifier. */
  id: string
  title: string
  /** Safe for the assigned student to read. */
  studentInstructions: string
  /** Parent-private. Student projections must remove this field structurally. */
  parentNotes?: string
  category: PlannerActivityCategory
  source: PlannerActivitySource
  /**
   * Explicit assignment snapshot. `assignToAll` additionally includes profiles
   * added later; keeping both makes group-assigned sync behavior unambiguous.
   */
  assignedProfileIds: string[]
  assignToAll: boolean
  weekdays: PlannerWeekday[]
  /** Local wall-clock preference in 24-hour HH:mm form. */
  startTime: string
  expectedMinutes: number
  scheduleBehavior: PlannerScheduleBehavior
  linkedActivity?: LinkedPlannerActivity
  requiresParentHelp: boolean
  location?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type PlannerBlockChanges = Partial<
  Pick<
    PlannerBlock,
    | 'title'
    | 'studentInstructions'
    | 'parentNotes'
    | 'category'
    | 'assignedProfileIds'
    | 'assignToAll'
    | 'weekdays'
    | 'startTime'
    | 'expectedMinutes'
    | 'scheduleBehavior'
    | 'linkedActivity'
    | 'requiresParentHelp'
    | 'location'
    | 'active'
  >
>

/**
 * A date override is family-owned schedule configuration. `profileIds`
 * undefined/empty means the override applies to every assigned profile.
 */
export interface PlannerDateOverride {
  id: string
  date: ISODate
  action: 'add' | 'remove' | 'change'
  profileIds?: string[]
  targetBlockId?: string
  block?: PlannerBlock
  changes?: PlannerBlockChanges
  createdAt: string
  updatedAt: string
}

export interface ResumePointer {
  adapter?: LinkedPlannerActivity['adapter']
  /** Binds adapter-owned data to the occurrence that produced it. */
  blockId?: string
  route?: string
  activityId?: string
  lessonId?: string
  stepId?: string
  questionId?: string
  itemId?: string
  /** Adapter-owned, JSON-only data. Never store functions, tokens, or secrets. */
  adapterData?: PlannerJsonObject
  updatedAt: string
}

export interface ParentVerification {
  verified: boolean
  verifiedAt?: string
  verifiedBy?: string
}

export type PlannerPlacement =
  | {
      kind: 'scheduled'
      startMinute: number
      endMinute: number
      startTime: string
      crossesMidnight?: boolean
      conflict?: 'fixed-overlap' | 'historical-overlap'
    }
  | {
      kind: 'overflow'
      order: number
      earliestStartMinute: number
      durationMinutes: number
      reason: 'past-day-boundary' | 'no-available-interval'
    }
  | {
      kind: 'unavailable'
      reason: 'invalid-duration' | 'missing-source'
      message: string
    }

/**
 * Immutable display and placement data captured from a freshly reselected row.
 * Status/timestamps remain in PlannerProgress so there is still one progress truth.
 */
export interface PlannerOccurrenceSnapshot {
  /**
   * Captured rows may support narrow execution settlement after their template
   * disappears. Normalization-only archives are display history and read-only.
   * Optional so persisted v1 occurrence snapshots remain backward compatible.
   */
  provenance?: 'captured' | 'legacy-template' | 'normalized-archive'
  blockInstanceId: string
  blockId: string
  profileId: string
  date: ISODate
  title: string
  studentInstructions: string
  parentNotes?: string
  category: PlannerActivityCategory
  source: PlannerActivitySource
  preferredStartTime: string
  preferredStartMinute: number
  placement: PlannerPlacement
  expectedMinutes: number
  scheduleBehavior: PlannerScheduleBehavior
  linkedActivity?: LinkedPlannerActivity
  requiresParentHelp: boolean
  location?: string
  capturedAt: string
}

export interface PlannerProgress {
  profileId: string
  date: ISODate
  blockInstanceId: string
  blockId: string
  status: PlannerBlockStatus
  /** Mission rows persist timing only; Profile.missions owns their completion. */
  completionAuthority?: 'planner' | 'mission'
  startedAt?: string
  /** The current active segment; absent whenever the block is not in progress. */
  activeSince?: string
  lastPausedAt?: string
  completedAt?: string
  terminalAt?: string
  reopenedAt?: string
  activeElapsedSeconds: number
  parentVerification?: ParentVerification
  resumePointer?: ResumePointer
  completionNote?: string
  occurrence?: PlannerOccurrenceSnapshot
  updatedAt: string
}

export interface PlannerState {
  version: typeof PLANNER_VERSION
  /** Recurring family schedule templates. Generated blocks are never persisted here. */
  blocks: PlannerBlock[]
  overrides: PlannerDateOverride[]
  /** Keyed by deterministic block-instance ID. */
  progress: Record<string, PlannerProgress>
}

/**
 * Future planner payloads remain byte-for-byte JSON-equivalent in AppState and
 * backups. Current code treats them as opaque and read-only.
 */
export interface UnsupportedPlannerState {
  version: number
  [key: string]: PlannerJsonValue
}

export type PlannerPersistedState = PlannerState | UnsupportedPlannerState

export type PlannerCompatibility =
  | { kind: 'supported'; version: typeof PLANNER_VERSION }
  | { kind: 'unsupported-newer'; version: number }

export interface PlannerAvailabilityNotice {
  id: string
  profileId: string
  date: ISODate
  reason:
    | 'missing-plan'
    | 'missing-placement'
    | 'missing-source'
    | 'missing-adapter'
    | 'unsupported-destination'
    | 'planner-update-required'
  title: string
  message: string
}

export type PlannerDestination =
  | { kind: 'manual-activity' }
  | { kind: 'math-practice' }
  | { kind: 'typing' }
  | { kind: 'reading' }
  | { kind: 'mindset' }
  | { kind: 'high-school-course'; courseId: string }
  | { kind: 'curriculum-instructions'; instanceId: string }
  | {
      kind: 'unavailable'
      code: 'missing-source' | 'unsupported-route' | 'profile-mismatch' | 'no-safe-entry'
      message: string
    }

export interface PlannerNavigationResolution {
  destination: PlannerDestination
  source: 'resume-pointer' | 'linked-activity' | 'safe-fallback'
  granularity: 'activity' | 'subject' | 'course' | 'instructions' | 'none'
}

export interface DailyPlanBlock {
  profileId: string
  date: ISODate
  instanceId: string
  block: PlannerBlock
  scheduledStartTime: string
  preferredStartMinute: number
  placement: PlannerPlacement
  /** Present only for a real scheduled wall-clock placement. */
  effectiveStartTime?: string
  progress: PlannerProgress
  /** False for auto-only, unavailable, or non-today mission items. */
  canManuallyComplete: boolean
  /** Mission disposition remains governed by the existing mission system. */
  canSetDisposition: boolean
  canStart: boolean
  unavailableReason?: string
  navigation?: PlannerNavigationResolution
  generated: boolean
}

export interface DailyPlanSummary {
  plannedMinutes: number
  plannedMinutesRemaining: number
  activeMinutes: number
  completedCount: number
  remainingCount: number
  eligibleCount: number
  completionPercentage: number
}

export interface DailyPlan {
  profileId: string
  date: ISODate
  blocks: DailyPlanBlock[]
  notices: PlannerAvailabilityNotice[]
  compatibility: PlannerCompatibility
  summary: DailyPlanSummary
}

export type StudentPlannerBlock = Pick<
  PlannerBlock,
  | 'id'
  | 'title'
  | 'studentInstructions'
  | 'category'
  | 'startTime'
  | 'expectedMinutes'
  | 'scheduleBehavior'
  | 'requiresParentHelp'
  | 'location'
  | 'active'
> & {
  source:
    | { kind: 'manual' }
    | {
        kind: 'mission'
        missionItemId: string
        autoOnly: boolean
        autoKind?: 'math' | 'typing' | 'reading' | 'mindset'
      }
    | {
        kind: 'curriculum'
        subjectId: string
        subjectLabel: string
        week: number
        items: PlannerCurriculumItemRef[]
      }
    | { kind: 'romeo-online'; activityId?: string }
}
export type StudentPlannerOccurrenceSnapshot = Pick<
  PlannerOccurrenceSnapshot,
  | 'blockInstanceId'
  | 'blockId'
  | 'profileId'
  | 'date'
  | 'title'
  | 'studentInstructions'
  | 'category'
  | 'preferredStartTime'
  | 'preferredStartMinute'
  | 'placement'
  | 'expectedMinutes'
  | 'scheduleBehavior'
  | 'requiresParentHelp'
  | 'location'
  | 'capturedAt'
>
export type StudentPlannerProgress = Pick<
  PlannerProgress,
  | 'profileId'
  | 'date'
  | 'blockInstanceId'
  | 'blockId'
  | 'status'
  | 'completionAuthority'
  | 'startedAt'
  | 'activeSince'
  | 'lastPausedAt'
  | 'completedAt'
  | 'terminalAt'
  | 'reopenedAt'
  | 'activeElapsedSeconds'
  | 'updatedAt'
> & {
  occurrence?: StudentPlannerOccurrenceSnapshot
}
export type StudentDailyPlanBlock = Omit<DailyPlanBlock, 'block' | 'progress'> & {
  block: StudentPlannerBlock
  progress: StudentPlannerProgress
}
export type StudentDailyPlan = Omit<DailyPlan, 'blocks'> & {
  blocks: StudentDailyPlanBlock[]
}

export type PlannerAction =
  | 'start'
  | 'pause'
  | 'resume'
  | 'complete'
  | 'skip'
  | 'excuse'
  | 'move'
  | 'reopen'

export type PlannerCommandActor =
  | { kind: 'parent' }
  | { kind: 'student'; profileId: string }

export interface PlannerCommandTarget {
  profileId: string
  date: ISODate
  blockId: string
  blockInstanceId: string
}

export interface PlannerCommand {
  actor: PlannerCommandActor
  action: PlannerAction
  target: PlannerCommandTarget
}

export type PlannerCommandRejection =
  | 'profile-not-found'
  | 'actor-profile-mismatch'
  | 'active-profile-mismatch'
  | 'student-date-restricted'
  | 'planner-version-unsupported'
  | 'invalid-instance-id'
  | 'block-not-found'
  | 'block-not-actionable'
  | 'not-assigned'
  | 'source-unavailable'
  | 'permission-denied'
  | 'invalid-transition'
  | 'mission-date-restricted'
  | 'navigation-unavailable'

export type PlannerCommandOutcome =
  | { kind: 'applied'; from: PlannerBlockStatus; to: PlannerBlockStatus }
  | { kind: 'idempotent'; status: PlannerBlockStatus }
  | { kind: 'rejected'; reason: PlannerCommandRejection; status?: PlannerBlockStatus }
