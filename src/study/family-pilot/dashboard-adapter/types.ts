import type { FinalFamilyPilotCatalog } from '../../../curriculum/final-app-data'
import type { AcademySubject, Grade } from '../../../types'
import type { FamilyPilotStateV1 } from '../core'
import type { CanonicalCourseStatus, CanonicalNextCourseOption } from '../course-completion'
import type { FinalFamilyPilotAttestationRecord, FinalFamilyPilotStorageHealth } from '../final-composition'
import type {
  FinalFamilyPilotAppStoreStatus,
  FinalFamilyPilotAssessmentAssignment,
  FinalFamilyPilotSourceAttachment,
} from '../final-app'
import type { SafetyHoldV1, SafetyStateRecoveryState } from '../safety'
import type { ScheduleItemV1 } from '../schedule'
import type { FamilySetupState } from '../setup'

export const FAMILY_PILOT_DASHBOARD_TODAY_LIMIT = 24 as const
export const FAMILY_PILOT_DASHBOARD_UPCOMING_LIMIT = 5 as const
export const FAMILY_PILOT_DASHBOARD_RECENT_LIMIT = 5 as const

export type FamilyPilotDashboardCommand =
  | {
      readonly type: 'START' | 'CONTINUE'
      readonly studentRef: string
      readonly assignmentRef: string
      readonly workKind: 'LESSON' | 'ASSESSMENT'
    }
  | {
      readonly type: 'OPEN_COURSE'
      readonly studentRef: string
      readonly courseRef: string
    }
  | {
      readonly type: 'OPEN_SCHEDULE' | 'OPEN_REPORTS' | 'OPEN_ASSIGNMENTS' | 'SIGN_OUT'
      readonly studentRef: string
    }

export type FamilyPilotDashboardBlockedKind =
  | 'STORAGE_UNAVAILABLE'
  | 'SAFETY_HOLD'
  | 'GUARDIAN_PENDING'
  | 'SOCIAL_SOURCE_REQUIRED'
  | 'ASSESSMENT_SCORING_PENDING'
  | 'ADULT_REVIEW_REQUIRED'
  | 'ASSIGNMENT_UNAVAILABLE'

export interface FamilyPilotDashboardBlockedState {
  readonly kind: FamilyPilotDashboardBlockedKind
  /** Learner-safe copy only. Internal reason codes and hold details stay out. */
  readonly message: string
}

export type FamilyPilotDashboardWorkKind =
  | 'LESSON'
  | 'ASSESSMENT'
  | 'STUDY_SESSION'
  | 'BREAK'
  | 'UNAVAILABLE'

export type FamilyPilotDashboardWorkStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'WAITING'
  | 'UNAVAILABLE'

export interface FamilyPilotDashboardWorkItem {
  readonly scheduleItemRef: string
  readonly assignmentRef: string | null
  readonly kind: FamilyPilotDashboardWorkKind
  readonly title: string
  readonly subject: AcademySubject | null
  readonly courseRef: string | null
  readonly workingGrade: Grade | null
  readonly date: string
  readonly timing: 'TODAY' | 'UPCOMING'
  readonly status: FamilyPilotDashboardWorkStatus
  readonly blocked: FamilyPilotDashboardBlockedState | null
  readonly action: FamilyPilotDashboardCommand | null
}

export interface FamilyPilotDashboardTodayModel {
  readonly date: string
  readonly state: 'SCHEDULED' | 'EMPTY'
  readonly emptyReason: 'NO_SCHEDULED_WORK' | null
  readonly items: readonly FamilyPilotDashboardWorkItem[]
  readonly scheduledCount: number
  readonly omittedCount: number
  readonly academicCount: number
  readonly completedAcademicCount: number
}

export interface FamilyPilotDashboardCourseModel {
  readonly subject: AcademySubject
  readonly workingGrade: Grade
  readonly curriculumStatus: 'AVAILABLE' | 'UNAVAILABLE'
  readonly courseRef: string | null
  readonly title: string
  readonly assignedLessons: number
  readonly completedLessons: number
  readonly totalLessons: number
  readonly requiredAssessments: number
  readonly completionPercent: number | null
  readonly completionStatus: CanonicalCourseStatus
  readonly completionDate: string | null
  readonly nextCourseOptions: readonly CanonicalNextCourseOption[]
  readonly currentUnit: {
    readonly unitRef: string
    readonly unitNumber: number
    readonly title: string
  } | null
  readonly assessmentsAssigned: number
  readonly assessmentsCertified: number
  readonly assessmentStatus: 'NONE' | 'OPEN' | 'WAITING' | 'COMPLETE'
  readonly action: FamilyPilotDashboardCommand | null
}

export interface FamilyPilotDashboardRecentCompletion {
  readonly assignmentRef: string
  readonly title: string
  readonly subject: AcademySubject | null
  readonly completedAt: string
}

export interface FamilyPilotDashboardProgressModel {
  readonly lessonsAssigned: number
  readonly lessonsCompleted: number
  readonly assessmentsAssigned: number
  readonly assessmentsCertified: number
  readonly recentCompletions: readonly FamilyPilotDashboardRecentCompletion[]
}

export interface FamilyPilotDashboardAlert {
  readonly kind: FamilyPilotDashboardBlockedKind
  readonly message: string
  readonly count: number
}

export type FamilyPilotDashboardTutorCapability = 'NOT_CONNECTED' | 'AVAILABLE'

/**
 * Future injection seam only. The R1 model stays visual-only and the default
 * port below has no callback, so importing this adapter cannot call a tutor.
 */
export type FamilyPilotDashboardJarvisActionPort =
  | { readonly tutorCapability: 'NOT_CONNECTED' }
  | {
      readonly tutorCapability: 'AVAILABLE'
      readonly onOpenTutor: (input: { readonly studentRef: string }) => void
    }

export interface FamilyPilotDashboardJarvisModel {
  readonly mode: 'VISUAL_ONLY'
  readonly status: 'STATIC_HELP_AVAILABLE' | 'TUTOR_NOT_CONNECTED' | 'AVAILABLE_VISUAL'
  readonly tutorCapability: FamilyPilotDashboardTutorCapability
  readonly interactive: false
  readonly staticHelpAvailable: true
}

export interface FamilyPilotStudentDashboardModel {
  readonly learner: {
    readonly studentRef: string
    readonly displayName: string
    readonly avatarInitial: string
    readonly nominalGrade: Grade
    readonly greeting: string
  }
  readonly today: FamilyPilotDashboardTodayModel
  readonly courses: readonly FamilyPilotDashboardCourseModel[]
  readonly progressSummary: FamilyPilotDashboardProgressModel
  readonly upcoming: readonly FamilyPilotDashboardWorkItem[]
  readonly alerts: readonly FamilyPilotDashboardAlert[]
  readonly tools: readonly {
    readonly kind: 'SCHEDULE' | 'REPORTS' | 'ASSIGNMENTS'
    readonly action: FamilyPilotDashboardCommand
  }[]
  readonly jarvis: FamilyPilotDashboardJarvisModel
  readonly actions: {
    readonly signOut: FamilyPilotDashboardCommand
  }
}

export type FamilyPilotDashboardSourceAttachment = Pick<
  FinalFamilyPilotSourceAttachment,
  'studentRef' | 'assignmentRef' | 'lessonRef' | 'status'
>

export type FamilyPilotDashboardAttestation = Pick<
  FinalFamilyPilotAttestationRecord,
  'studentRef' | 'assignmentRef' | 'lessonRef' | 'status'
>

export type FamilyPilotDashboardSafetyHold = Pick<
  SafetyHoldV1,
  'studentRef' | 'sessionRef' | 'status'
>

export interface FamilyPilotDashboardCatalog {
  readonly runtime: Pick<
    FinalFamilyPilotCatalog['runtime'],
    'listGrades' | 'listCourses' | 'listUnits' | 'getLesson'
  >
  readonly getAssessment: FinalFamilyPilotCatalog['getAssessment']
}

/**
 * Existing-authority inputs only. Passing the full app snapshot is avoided on
 * purpose so PIN digests, household refs, and backup state never cross this
 * composition seam.
 */
export interface BuildFamilyPilotStudentDashboardInput {
  readonly today: string
  readonly activeStudentRef: string | null
  readonly setup: FamilySetupState
  readonly coreState: FamilyPilotStateV1
  readonly schedule: readonly ScheduleItemV1[]
  readonly assessments: readonly FinalFamilyPilotAssessmentAssignment[]
  readonly attestations: readonly FamilyPilotDashboardAttestation[]
  readonly sourceAttachments: readonly FamilyPilotDashboardSourceAttachment[]
  readonly safetyHolds: readonly FamilyPilotDashboardSafetyHold[]
  readonly safetyRecovery: SafetyStateRecoveryState
  readonly appStoreStatus: FinalFamilyPilotAppStoreStatus
  readonly studyStorageHealth?: Pick<
    FinalFamilyPilotStorageHealth,
    'ready' | 'reasonCode' | 'previousWriteFailed'
  > | null
  readonly catalog: FamilyPilotDashboardCatalog
  readonly jarvisPort?: FamilyPilotDashboardJarvisActionPort
}
