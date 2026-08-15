export type StudentDashboardMissionState =
  | 'no-work'
  | 'day-complete'
  | 'no-school'
  | 'waiting-on-parent'
  | 'work-remaining'
  | 'lesson-ready'
  | 'continue-lesson'
  | 'assessment-pending'
  | 'guardian-pending'
  | 'safety-blocked'
  | 'social-source-blocked'
  | 'storage-unavailable'

export type StudentDashboardItemState =
  | 'complete'
  | 'ready'
  | 'in-progress'
  | 'pending'
  | 'blocked'
  | 'unavailable'

export interface StudentDashboardMission {
  readonly state: StudentDashboardMissionState
  readonly eyebrow: string
  readonly title: string
  readonly context?: string
  readonly statusLabel: string
  /** Explanatory copy is supplied by the host; the presentation never infers it. */
  readonly description?: string
  readonly workRef?: string
  readonly actionLabel?: string
}

export interface StudentDashboardWorkItem {
  readonly workRef: string
  readonly title: string
  readonly context: string
  readonly state: StudentDashboardItemState
  readonly stateLabel: string
  readonly actionable?: boolean
  /** Host-supplied action vocabulary; presentation never infers start/resume authority. */
  readonly actionLabel?: string
}

export interface StudentDashboardCourse {
  readonly courseRef: string
  readonly title: string
  readonly context: string
  readonly completed: number
  readonly total: number
  /** Null means there is no truthful denominator yet. */
  readonly completionPercent?: number | null
  readonly progressLabel?: string
  readonly actionable?: boolean
}

export interface StudentDashboardUpcomingItem {
  readonly upcomingRef: string
  readonly when: string
  readonly title: string
  readonly detail?: string
}

export interface StudentDashboardQuickTool {
  readonly toolRef: string
  readonly label: string
  readonly description?: string
}

export type StudentDashboardDayState =
  | 'complete'
  | 'no-school'
  | 'waiting-on-parent'
  | 'waiting-for-assessment'
  | 'unfinished'
  | 'needs-plan'

/** Factual school-day counts. These are counts, never inferred percentages. */
export interface StudentDashboardDayStatus {
  readonly state: StudentDashboardDayState
  readonly requiredCount: number
  readonly completedCount: number
  readonly remainingCount: number
  readonly waitingOnParentCount: number
  readonly carryForwardCount: number
  readonly assessmentCount: number
}

export interface StudentDashboardModel {
  readonly student: {
    readonly displayName: string
    readonly avatarInitial?: string
  }
  readonly periodEyebrow: string
  readonly periodLabel: string
  readonly progressLabel: string
  /** Present when the Auto Planner host has supplied school-day authority. */
  readonly dayStatus?: StudentDashboardDayStatus
  readonly mission: StudentDashboardMission
  readonly todayItems: readonly StudentDashboardWorkItem[]
  readonly todayEmptyLabel?: string
  readonly courses: readonly StudentDashboardCourse[]
  readonly upcoming: readonly StudentDashboardUpcomingItem[]
  readonly upcomingEmptyLabel?: string
  readonly quickTools: readonly StudentDashboardQuickTool[]
}

export type JarvisDashboardMode = 'visual-only' | 'tutor-v2'

export interface JarvisDashboardProps {
  readonly mode: JarvisDashboardMode
  /** Honest, host-supplied availability text. */
  readonly status: string
  /** Optional future Tutor V2 activation boundary. No behavior exists by default. */
  readonly onActivate?: () => void
}

export interface StudentDashboardProps {
  readonly model: StudentDashboardModel
  readonly jarvis?: JarvisDashboardProps
  readonly onOpenWork: (workRef: string) => void
  readonly onOpenCourse: (courseRef: string) => void
  readonly onOpenSchedule: () => void
  readonly onOpenTool: (toolRef: string) => void
  readonly onLock?: () => void
  readonly onSwitchLearner?: () => void
  readonly onSignOut: () => void
}
