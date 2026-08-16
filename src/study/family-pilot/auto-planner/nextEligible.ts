import type { AcademyGrade, AcademySubject } from '../../../types'
import type { FinalCatalogLesson } from '../../../curriculum/final-runtime'
import type {
  FamilyAutoPlannerAssessmentFact,
  FamilyAutoPlannerAssignmentFact,
  FamilyAutoPlannerCourseBundle,
  FamilyAutoPlannerHoldFact,
} from './types'

export type FamilyCourseGate =
  | 'SAFETY_HOLD'
  | 'PENDING_ASSESSMENT'
  | 'PARENT_REVIEW'
  | 'GUARDIAN_CERTIFICATION'
  | 'ASSESSMENT_REQUIRED'
  | 'PREREQUISITE'
  | 'COURSE_COMPLETE'
  | 'COURSE_UNAVAILABLE'

export type FamilyCourseNextEligible =
  | {
      readonly status: 'LESSON'
      readonly courseRef: string
      readonly unitRef: string
      readonly subject: AcademySubject
      readonly workingGrade: AcademyGrade
      readonly lesson: FinalCatalogLesson
      readonly assignment: FamilyAutoPlannerAssignmentFact | null
    }
  | {
      readonly status: 'GATED'
      readonly courseRef: string
      readonly subject: AcademySubject
      readonly workingGrade: AcademyGrade
      readonly gate: FamilyCourseGate
      readonly title: string
    }

export interface ResolveFamilyCourseNextEligibleInput {
  readonly learnerRef: string
  readonly bundle: FamilyAutoPlannerCourseBundle
  readonly assignments: readonly FamilyAutoPlannerAssignmentFact[]
  readonly assessments: readonly FamilyAutoPlannerAssessmentFact[]
  readonly holds: readonly FamilyAutoPlannerHoldFact[]
  readonly pendingGuardianAssignmentRefs?: ReadonlySet<string>
}

function assessmentGate(status: FamilyAutoPlannerAssessmentFact['status']): FamilyCourseGate {
  if (status === 'PLANNED' || status === 'ACTIVE') return 'ASSESSMENT_REQUIRED'
  if (status === 'ADULT_REVIEW_REQUIRED') return 'PARENT_REVIEW'
  if (status === 'PENDING_GUARDIAN_ATTESTATION') return 'GUARDIAN_CERTIFICATION'
  return 'PENDING_ASSESSMENT'
}

function gated(
  input: ResolveFamilyCourseNextEligibleInput,
  gate: FamilyCourseGate,
  title: string,
): FamilyCourseNextEligible {
  return Object.freeze({
    status: 'GATED',
    courseRef: input.bundle.course.courseRef,
    subject: input.bundle.course.subject,
    workingGrade: String(input.bundle.course.grade) as AcademyGrade,
    gate,
    title,
  })
}

/**
 * Canonical, subject-neutral course-sequence decision. It reads assignment,
 * assessment, guardian, Safety, and curriculum authority but writes nothing.
 */
export function resolveFamilyCourseNextEligible(
  input: ResolveFamilyCourseNextEligibleInput,
): FamilyCourseNextEligible {
  const { bundle, learnerRef } = input
  const lessonRefs = new Set(bundle.lessons.map((lesson) => lesson.lessonRef))
  const assignments = input.assignments.filter((item) =>
    item.learnerRef === learnerRef && lessonRefs.has(item.lessonRef))
  const open = assignments
    .filter((item) => ['active', 'paused', 'planned'].includes(item.state))
    .sort((left, right) => {
      const priority = (state: FamilyAutoPlannerAssignmentFact['state']) =>
        state === 'active' ? 0 : state === 'paused' ? 1 : 2
      return priority(left.state) - priority(right.state) ||
        left.createdAt.localeCompare(right.createdAt) || left.assignmentRef.localeCompare(right.assignmentRef)
    })[0]

  if (open) {
    if (open.sessionRef && input.holds.some((hold) =>
      hold.learnerRef === learnerRef && hold.sessionRef === open.sessionRef && hold.status !== 'cleared')) {
      return gated(input, 'SAFETY_HOLD', open.title)
    }
    if (input.pendingGuardianAssignmentRefs?.has(open.assignmentRef)) {
      return gated(input, 'GUARDIAN_CERTIFICATION', open.title)
    }
    const lesson = bundle.lessons.find((item) => item.lessonRef === open.lessonRef)
    if (lesson) {
      return Object.freeze({
        status: 'LESSON', courseRef: bundle.course.courseRef, unitRef: lesson.unitRef,
        subject: bundle.course.subject, workingGrade: String(bundle.course.grade) as AcademyGrade,
        lesson, assignment: open,
      })
    }
  }

  const orderedLessons = [...bundle.lessons]
    .sort((left, right) => left.courseDay - right.courseDay || left.lessonRef.localeCompare(right.lessonRef))
  const units = [...bundle.units]
    .sort((left, right) => left.unitNumber - right.unitNumber || left.unitRef.localeCompare(right.unitRef))

  for (const unit of units) {
    for (const lesson of orderedLessons.filter((item) => item.unitRef === unit.unitRef)) {
      const facts = assignments.filter((item) => item.lessonRef === lesson.lessonRef)
      if (facts.some((item) => item.state === 'completed' || item.state === 'abandoned')) continue
      return Object.freeze({
        status: 'LESSON', courseRef: bundle.course.courseRef, unitRef: unit.unitRef,
        subject: bundle.course.subject, workingGrade: String(bundle.course.grade) as AcademyGrade,
        lesson, assignment: null,
      })
    }

    if (!unit.assessmentRef) continue
    const assessment = input.assessments.find((item) =>
      item.learnerRef === learnerRef && item.courseRef === bundle.course.courseRef &&
      item.assessmentRef === unit.assessmentRef)
    if (!assessment) return gated(input, 'ASSESSMENT_REQUIRED', `${unit.title} assessment`)
    if (assessment.status !== 'CERTIFIED') {
      return gated(input, assessmentGate(assessment.status), assessment.title)
    }
  }

  return orderedLessons.length > 0
    ? gated(input, 'COURSE_COMPLETE', bundle.course.title)
    : gated(input, 'COURSE_UNAVAILABLE', bundle.course.title)
}
