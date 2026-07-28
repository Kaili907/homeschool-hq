import type { ISODate } from '../types'

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
 * adapters should provide the safest dependable entry point, not invent a
 * lesson-step location that the linked module cannot actually restore.
 */
export interface LinkedPlannerActivity {
  adapter: 'mission' | 'curriculum' | 'romeo-online' | 'route'
  activityId: string
  route?: string
  lessonId?: string
  stepId?: string
  itemId?: string
  safeEntryData?: { [key: string]: PlannerJsonValue }
}

export interface PlannerBlock {
  /** Stable template/generated-block identifier. */
  id: string
  title: string
  description: string
  category: PlannerActivityCategory
  source: PlannerActivitySource
  /**
   * Explicit assignment snapshot. `assignToAll` additionally includes profiles
   * added later; keeping both makes group-assigned sync behavior unambiguous.
   */
  assignedProfileIds: string[]
  assignToAll: boolean
  weekdays: PlannerWeekday[]
  /** Local wall-clock time in 24-hour HH:mm form. */
  startTime: string
  expectedMinutes: number
  scheduleBehavior: PlannerScheduleBehavior
  linkedActivity?: LinkedPlannerActivity
  requiresParentHelp: boolean
  location?: string
  notes?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type PlannerBlockChanges = Partial<
  Pick<
    PlannerBlock,
    | 'title'
    | 'description'
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
    | 'notes'
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
  route?: string
  activityId?: string
  lessonId?: string
  stepId?: string
  questionId?: string
  itemId?: string
  /** Adapter-owned, JSON-only data. Never store functions, tokens, or secrets. */
  adapterData?: { [key: string]: PlannerJsonValue }
  updatedAt: string
}

export interface ParentVerification {
  verified: boolean
  verifiedAt?: string
  verifiedBy?: string
}

export interface PlannerProgress {
  profileId: string
  date: ISODate
  blockInstanceId: string
  blockId: string
  status: PlannerBlockStatus
  startedAt?: string
  /** The current active segment; absent whenever the block is not in progress. */
  activeSince?: string
  lastPausedAt?: string
  completedAt?: string
  activeElapsedSeconds: number
  parentVerification?: ParentVerification
  resumePointer?: ResumePointer
  completionNote?: string
  updatedAt: string
}

export interface PlannerState {
  version: 1
  /** Recurring family schedule templates. Generated blocks are never persisted here. */
  blocks: PlannerBlock[]
  overrides: PlannerDateOverride[]
  /** Keyed by deterministic block-instance ID. */
  progress: Record<string, PlannerProgress>
}

export interface DailyPlanBlock {
  profileId: string
  date: ISODate
  instanceId: string
  block: PlannerBlock
  scheduledStartTime: string
  effectiveStartTime: string
  progress: PlannerProgress
  /** False for auto-only mission items. */
  canManuallyComplete: boolean
  /** Mission disposition remains governed by the existing mission system. */
  canSetDisposition: boolean
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
  summary: DailyPlanSummary
}

export type PlannerAction =
  | 'start'
  | 'pause'
  | 'resume'
  | 'complete'
  | 'skip'
  | 'excuse'
  | 'move'
