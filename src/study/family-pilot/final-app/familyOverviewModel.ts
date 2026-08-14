import { ACADEMY_SUBJECT_LABELS } from '../../../academy/contentTypes'
import type { AcademySubject } from '../../../types'
import type { ScheduleItemV1 } from '../schedule'
import type { FamilySetupStudent } from '../setup'
import type {
  FamilyAutoPlannerStoreLoad,
  FamilyAutoPlannerTodayItem,
  FamilyAutoPlannerTodayPlan,
} from '../auto-planner'
import type {
  FinalAssessmentAssignmentStatus,
  FinalFamilyPilotAssessmentAssignment,
} from './state'

export type FamilyOverviewTodayState =
  | 'DONE'
  | 'WORK_REMAINING'
  | 'BLOCKED'
  | 'NEEDS_PLAN'
  | 'NO_SCHOOL'
  | 'ASSESSMENT_WAITING'

export type FamilyOverviewSchoolPlanState = 'CONFIGURED' | 'MISSING' | 'READ_ONLY' | 'UNAVAILABLE'

export interface FamilyOverviewWorkItem {
  readonly assignmentRef: string
  readonly title: string
  readonly subject: AcademySubject | null
  readonly workingGrade: string | null
  readonly status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'WAITING'
  readonly scheduledLocalTime: string | null
  readonly carriedForwardFromDate: string | null
  readonly assessment: boolean
}

export interface FamilyOverviewWorkingLevel {
  readonly subject: AcademySubject
  readonly subjectLabel: string
  readonly workingGrade: string
  readonly courseTitle: string | null
}

export interface FamilyOverviewLearner {
  readonly studentRef: string
  readonly displayName: string
  readonly nominalGrade: string
  readonly localDate: string
  readonly todayState: FamilyOverviewTodayState
  readonly schoolPlanState: FamilyOverviewSchoolPlanState
  readonly scheduledToday: number
  readonly completedToday: number
  readonly remainingToday: number
  readonly carriedUnfinished: number
  readonly openSafetyHolds: number
  readonly pendingAssessments: number
  readonly pendingAdultAssessmentReviews: number
  readonly pendingGuardianAttestations: number
  readonly blocked: boolean
  readonly needsParent: boolean
  readonly needsParentReasons: readonly string[]
  readonly courseComplete: boolean
  readonly offlineMaterializedWorkAvailable: boolean
  readonly workItems: readonly FamilyOverviewWorkItem[]
  readonly workingLevels: readonly FamilyOverviewWorkingLevel[]
}

const PARENT_ASSESSMENT_STATUSES: ReadonlySet<FinalAssessmentAssignmentStatus> = new Set([
  'ADULT_REVIEW_REQUIRED',
  'PENDING_GUARDIAN_ATTESTATION',
])

function planState(load: FamilyAutoPlannerStoreLoad): FamilyOverviewSchoolPlanState {
  if (load.status === 'read-only') return 'READ_ONLY'
  if (load.status === 'unavailable') return 'UNAVAILABLE'
  return load.document.schoolPlan ? 'CONFIGURED' : 'MISSING'
}

function workStatus(
  scheduled: ScheduleItemV1,
  planned: FamilyAutoPlannerTodayItem | undefined,
): FamilyOverviewWorkItem['status'] {
  if (scheduled.status === 'completed') return 'COMPLETED'
  if (planned?.state === 'BLOCKED') return 'BLOCKED'
  if (planned?.state === 'WAITING') return 'WAITING'
  if (scheduled.status === 'in-progress') return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

function todayState(
  plan: FamilyAutoPlannerTodayPlan,
  scheduled: number,
  remaining: number,
  blocked: boolean,
): FamilyOverviewTodayState {
  if (plan.status === 'NO_SCHOOL_TODAY') return 'NO_SCHOOL'
  if (blocked) return 'BLOCKED'
  if (plan.status === 'WAITING_FOR_ASSESSMENT') return 'ASSESSMENT_WAITING'
  if (scheduled > 0) return remaining === 0 ? 'DONE' : 'WORK_REMAINING'
  if (plan.status === 'COMPLETE_FOR_TODAY') return 'DONE'
  if (plan.status === 'NEEDS_PLAN_SETUP') return 'NEEDS_PLAN'
  return 'WORK_REMAINING'
}

export function buildFamilyOverviewLearner(input: {
  readonly student: FamilySetupStudent
  readonly plan: FamilyAutoPlannerTodayPlan
  readonly schedule: readonly ScheduleItemV1[]
  readonly schoolPlan: FamilyAutoPlannerStoreLoad
  readonly assessments: readonly FinalFamilyPilotAssessmentAssignment[]
  readonly openSafetyHolds: number
  readonly pendingGuardianAttestations: number
  readonly courseTitles: Readonly<Partial<Record<AcademySubject, string>>>
  readonly completedCourseTitles: readonly string[]
}): FamilyOverviewLearner {
  const { student, plan, schoolPlan } = input
  if (plan.scope.learnerRef !== student.studentRef) {
    throw new Error('Family overview learner scope did not match the requested student.')
  }
  if (input.schedule.some((item) => item.studentRef !== student.studentRef)) {
    throw new Error('Family overview schedule contained another learner.')
  }
  if (input.assessments.some((item) => item.studentRef !== student.studentRef)) {
    throw new Error('Family overview evidence was not safely learner-scoped.')
  }

  const plannedByAssignment = new Map(plan.items.map((item) => [item.assignmentRef, item]))
  const assessmentRefs = new Set(input.assessments.map((item) => item.assignmentRef))
  const workItems = input.schedule.map((scheduled): FamilyOverviewWorkItem => {
    const planned = scheduled.assignmentRef ? plannedByAssignment.get(scheduled.assignmentRef) : undefined
    return Object.freeze({
      assignmentRef: scheduled.assignmentRef ?? scheduled.scheduleItemRef,
      title: scheduled.title,
      subject: planned?.subject ?? null,
      workingGrade: planned?.workingGrade ?? null,
      status: workStatus(scheduled, planned),
      scheduledLocalTime: planned?.scheduledLocalTime ?? null,
      carriedForwardFromDate: planned?.carriedForwardFromDate ?? null,
      assessment: Boolean((scheduled.assignmentRef && assessmentRefs.has(scheduled.assignmentRef)) || planned?.kind === 'ASSESSMENT'),
    })
  })
  const completedToday = workItems.filter((item) => item.status === 'COMPLETED').length
  const remainingToday = workItems.length - completedToday
  const blocked = input.openSafetyHolds > 0 || plan.status === 'BLOCKED' || plan.items.some((item) => item.state === 'BLOCKED')
  const pendingAssessments = input.assessments.filter((item) => item.status !== 'CERTIFIED').length
  const pendingAdultAssessmentReviews = input.assessments.filter((item) => PARENT_ASSESSMENT_STATUSES.has(item.status)).length
  const schoolPlanState = planState(schoolPlan)
  const reasons: string[] = []
  if (schoolPlanState === 'MISSING') reasons.push('School Plan setup')
  else if (schoolPlanState === 'READ_ONLY') reasons.push('School Plan is read-only')
  else if (schoolPlanState === 'UNAVAILABLE') reasons.push('School Plan storage')
  if (input.openSafetyHolds > 0) reasons.push('Safety check-in')
  if (input.pendingGuardianAttestations > 0) reasons.push('Guardian attestation')
  if (pendingAdultAssessmentReviews > 0) reasons.push('Assessment review')
  if (plan.blockers.some((item) => [
    'SUBJECT_PLAN_MISSING',
    'WORKING_GRADE_UNSUPPORTED',
    'COURSE_ASSIGNMENT_AMBIGUOUS',
    'COURSE_ASSIGNMENT_UNAVAILABLE',
    'AUTO_ASSIGNMENT_ABANDONED',
    'ASSIGNMENT_MATERIALIZATION_FAILED',
    'ASSESSMENT_MATERIALIZATION_FAILED',
  ].includes(item.reason))) reasons.push('Plan or course attention')

  const workingLevels = student.enabledSubjects.map((subject): FamilyOverviewWorkingLevel => Object.freeze({
    subject,
    subjectLabel: ACADEMY_SUBJECT_LABELS[subject],
    workingGrade: student.workingGradeBySubject[subject] ?? student.nominalGrade,
    courseTitle: input.courseTitles[subject] ?? null,
  }))

  return Object.freeze({
    studentRef: student.studentRef,
    displayName: student.displayName,
    nominalGrade: student.nominalGrade,
    localDate: plan.localDate,
    todayState: todayState(plan, workItems.length, remainingToday, blocked),
    schoolPlanState,
    scheduledToday: workItems.length,
    completedToday,
    remainingToday,
    carriedUnfinished: workItems.filter((item) => item.status !== 'COMPLETED' && item.carriedForwardFromDate !== null).length,
    openSafetyHolds: input.openSafetyHolds,
    pendingAssessments,
    pendingAdultAssessmentReviews,
    pendingGuardianAttestations: input.pendingGuardianAttestations,
    blocked,
    needsParent: reasons.length > 0,
    needsParentReasons: Object.freeze([...new Set(reasons)]),
    courseComplete: input.completedCourseTitles.length > 0 || plan.reason === 'COURSE_COMPLETE' || plan.blockers.some((item) => item.reason === 'COURSE_COMPLETE'),
    offlineMaterializedWorkAvailable: plan.offlineMaterializedWorkAvailable,
    workItems: Object.freeze(workItems),
    workingLevels: Object.freeze(workingLevels),
  })
}

export interface FamilyOverviewSummary {
  readonly done: number
  readonly workRemaining: number
  readonly blocked: number
  readonly needsParent: number
  readonly assessmentsWaiting: number
}

export function summarizeFamilyOverview(learners: readonly FamilyOverviewLearner[]): FamilyOverviewSummary {
  return Object.freeze({
    done: learners.filter((item) => item.todayState === 'DONE').length,
    workRemaining: learners.filter((item) => item.remainingToday > 0).length,
    blocked: learners.filter((item) => item.blocked).length,
    needsParent: learners.filter((item) => item.needsParent).length,
    assessmentsWaiting: learners.filter((item) => item.pendingAssessments > 0).length,
  })
}
