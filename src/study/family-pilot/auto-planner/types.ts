import type { FinalCatalogCourse, FinalCatalogLesson, FinalCatalogUnit } from '../../../curriculum/final-runtime'
import type { AcademyGrade, AcademySubject, Grade } from '../../../types'
import type { FamilyPilotAssignmentState } from '../core'
import type { FinalAssessmentAssignmentStatus } from '../final-app/state'

export const FAMILY_AUTO_PLANNER_SCHEMA_VERSION = 1 as const

export type FamilyAutoPlannerStatus =
  | 'READY'
  | 'NO_SCHOOL_TODAY'
  | 'COMPLETE_FOR_TODAY'
  | 'COURSE_COMPLETE'
  | 'NEEDS_PLAN_SETUP'
  | 'BLOCKED'
  | 'WAITING_FOR_ASSESSMENT'

export type FamilyAutoPlannerReason =
  | 'NONE'
  | 'SCHOOL_PLAN_MISSING'
  | 'SCHOOL_PLAN_INVALID'
  | 'LEARNER_NOT_FOUND'
  | 'SUBJECT_PLAN_MISSING'
  | 'WORKING_GRADE_UNSUPPORTED'
  | 'COURSE_ASSIGNMENT_AMBIGUOUS'
  | 'COURSE_ASSIGNMENT_UNAVAILABLE'
  | 'CATALOG_UNAVAILABLE'
  | 'ASSIGNMENT_MATERIALIZATION_FAILED'
  | 'ASSESSMENT_MATERIALIZATION_FAILED'
  | 'PERSISTENCE_UNAVAILABLE'
  | 'PERSISTENCE_READ_ONLY'
  | 'CONCURRENT_UPDATE'
  | 'SUBJECT_PAUSED'
  | 'SAFETY_HOLD'
  | 'ASSESSMENT_PENDING'
  | 'ASSESSMENT_REVIEW_REQUIRED'
  | 'ASSESSMENT_GUARDIAN_REQUIRED'
  | 'AUTO_ASSIGNMENT_ABANDONED'
  | 'COURSE_COMPLETE'
  | 'OUTSIDE_SCHOOL_YEAR'
  | 'NON_SCHOOL_DAY'

/** ISO weekday: Monday=1 ... Sunday=7. */
export type SchoolWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface FamilyAutoPlannerSubjectPlanV1 {
  readonly subject: AcademySubject
  readonly order: number
  readonly paused: boolean
  /** Optional parent-selected course. When absent, an existing course assignment
   * is preferred; otherwise the catalog must have exactly one matching course. */
  readonly courseRef?: string
  /** New work per school-local day. Open work never counts against this cap. */
  readonly lessonsPerDay: number
  /** 24-hour school-local time used by the future Dashboard schedule adapter. */
  readonly startLocalTime: string
}

/** One learner's durable plan. Learner identity lives in the document scope. */
export interface FamilyAutoPlannerSchoolPlanV1 {
  readonly schemaVersion: typeof FAMILY_AUTO_PLANNER_SCHEMA_VERSION
  readonly householdTimeZone: string
  readonly schoolYearStart: string
  readonly schoolYearEnd: string
  readonly schoolWeekdays: readonly SchoolWeekday[]
  readonly nonSchoolDates: readonly string[]
  readonly addedSchoolDates: readonly string[]
  readonly subjects: readonly FamilyAutoPlannerSubjectPlanV1[]
  readonly configuredAt: string
  readonly updatedAt: string
}

export interface FamilyAutoPlannerScope {
  readonly householdRef: string
  readonly learnerRef: string
}

/** Read-only projection of existing learner/profile authority. */
export interface FamilyAutoPlannerLearner {
  readonly learnerRef: string
  readonly displayName: string
  /** Reporting truth. The planner never writes this field. */
  readonly nominalGrade: Grade
  /** Existing explicit working-level authority. The planner never writes it. */
  readonly workingGradeBySubject: Partial<Record<AcademySubject, AcademyGrade>>
  readonly enabledSubjects: readonly AcademySubject[]
  /** Existing course enrollment/assignment refs, when the host has them. */
  readonly assignedCourseRefs: readonly string[]
}

export interface FamilyAutoPlannerAssignmentFact {
  readonly assignmentRef: string
  readonly learnerRef: string
  readonly lessonRef: string
  readonly subject: AcademySubject
  readonly title: string
  readonly state: FamilyPilotAssignmentState
  readonly sessionRef: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly completedAt: string | null
  /** Parent-created optional work does not consume the automatic daily quota. */
  readonly optional: boolean
}

export interface FamilyAutoPlannerAssessmentFact {
  readonly assignmentRef: string
  readonly learnerRef: string
  readonly assessmentRef: string
  readonly courseRef: string
  readonly subject: AcademySubject
  readonly title: string
  readonly status: FinalAssessmentAssignmentStatus
  readonly createdAt: string
  readonly updatedAt: string
  readonly completedAt: string | null
}

export interface FamilyAutoPlannerHoldFact {
  readonly learnerRef: string
  readonly sessionRef: string
  /** Only the literal cleared value is non-blocking, matching SafetyHoldV1. */
  readonly status: string
  readonly reasonCode: string
}

export type FamilyAutoPlannerMaterializationKind = 'LESSON' | 'ASSESSMENT'

/** Durable provenance for one automatic materialization. Core/assessment state
 * remains lifecycle authority; this record only says why it appeared today. */
export interface FamilyAutoPlannerMaterializationV1 {
  readonly materializationRef: string
  readonly kind: FamilyAutoPlannerMaterializationKind
  readonly localDate: string
  readonly subject: AcademySubject
  readonly workingGrade: AcademyGrade
  readonly courseRef: string
  readonly unitRef: string
  readonly itemRef: string
  readonly assignmentRef: string
  readonly title: string
  readonly createdAt: string
}

export interface FamilyAutoPlannerDocumentV1 {
  readonly schemaVersion: typeof FAMILY_AUTO_PLANNER_SCHEMA_VERSION
  readonly scope: FamilyAutoPlannerScope
  readonly revision: number
  readonly updatedAt: string
  readonly schoolPlan: FamilyAutoPlannerSchoolPlanV1 | null
  readonly materializations: readonly FamilyAutoPlannerMaterializationV1[]
}

export type FamilyAutoPlannerStoreLoad =
  | { readonly status: 'ready'; readonly document: FamilyAutoPlannerDocumentV1 }
  | { readonly status: 'read-only'; readonly reason: 'schema-version-ahead' | 'record-unreadable' }
  | { readonly status: 'unavailable'; readonly reason: string }

export type FamilyAutoPlannerStoreSave =
  | { readonly status: 'saved'; readonly document: FamilyAutoPlannerDocumentV1 }
  | { readonly status: 'conflict' }
  | { readonly status: 'read-only'; readonly reason: string }
  | { readonly status: 'unavailable'; readonly reason: string }

export interface FamilyAutoPlannerStorePort {
  load(scope: FamilyAutoPlannerScope): Promise<FamilyAutoPlannerStoreLoad>
  save(
    scope: FamilyAutoPlannerScope,
    document: FamilyAutoPlannerDocumentV1,
    expectedRevision: number,
  ): Promise<FamilyAutoPlannerStoreSave>
}

export interface FamilyAutoPlannerCourseBundle {
  readonly course: FinalCatalogCourse
  readonly units: readonly FinalCatalogUnit[]
  readonly lessons: readonly FinalCatalogLesson[]
}

export interface FamilyAutoPlannerBlocker {
  readonly reason: FamilyAutoPlannerReason
  readonly subject: AcademySubject | null
  readonly detail: string
}

export interface FamilyAutoPlannerCourseCompletion {
  readonly courseRef: string
  readonly title: string
  readonly subject: AcademySubject
  readonly workingGrade: AcademyGrade
  /** Null when a required completion fact did not carry an authoritative timestamp. */
  readonly completedAt: string | null
}

export type FamilyAutoPlannerItemKind = 'LESSON' | 'ASSESSMENT'
export type FamilyAutoPlannerItemOrigin = 'AUTO' | 'MANUAL_OVERRIDE'
export type FamilyAutoPlannerItemState =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'WAITING'
  | 'BLOCKED'

/** Dashboard-safe schedule projection. Full content and learner responses never
 * enter the planner or its persistence document. */
export interface FamilyAutoPlannerTodayItem {
  readonly kind: FamilyAutoPlannerItemKind
  readonly origin: FamilyAutoPlannerItemOrigin
  readonly learnerRef: string
  readonly assignmentRef: string
  readonly itemRef: string
  readonly lessonRef: string | null
  readonly assessmentRef: string | null
  readonly courseRef: string | null
  readonly unitRef: string | null
  readonly subject: AcademySubject
  readonly workingGrade: AcademyGrade | null
  readonly title: string
  readonly state: FamilyAutoPlannerItemState
  readonly scheduledLocalTime: string
  readonly materializedForDate: string | null
  readonly carriedForwardFromDate: string | null
  readonly blockedReason: FamilyAutoPlannerReason | null
}

export interface FamilyAutoPlannerTodayPlan {
  readonly status: FamilyAutoPlannerStatus
  readonly reason: FamilyAutoPlannerReason
  readonly scope: FamilyAutoPlannerScope
  readonly householdTimeZone: string | null
  readonly localDate: string
  readonly generatedAt: string
  readonly items: readonly FamilyAutoPlannerTodayItem[]
  readonly blockers: readonly FamilyAutoPlannerBlocker[]
  readonly completedCourses: readonly FamilyAutoPlannerCourseCompletion[]
  readonly manualOverrideActive: boolean
  readonly offlineMaterializedWorkAvailable: boolean
}

export type FamilyAutoPlannerMaterializationIntent =
  | {
      readonly kind: 'LESSON'
      readonly localDate: string
      readonly subject: AcademySubject
      readonly workingGrade: AcademyGrade
      readonly courseRef: string
      readonly unitRef: string
      readonly lesson: FinalCatalogLesson
    }
  | {
      readonly kind: 'ASSESSMENT'
      readonly localDate: string
      readonly subject: AcademySubject
      readonly workingGrade: AcademyGrade
      readonly courseRef: string
      readonly unitRef: string
      readonly assessmentRef: string
      readonly title: string
    }

export interface FamilyAutoPlannerComputation {
  readonly plan: FamilyAutoPlannerTodayPlan
  readonly intents: readonly FamilyAutoPlannerMaterializationIntent[]
}
