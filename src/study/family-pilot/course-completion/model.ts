import {
  parseFinalCurriculumGrade,
  type FinalCatalogCourse,
  type FinalCatalogUnit,
  type FinalCurriculumGrade,
} from '../../../curriculum/final-runtime'
import type { AcademySubject, Grade } from '../../../types'
import type { FamilyPilotAssignmentRecordV1 } from '../core'
import type { FinalFamilyPilotAssessmentAssignment } from '../final-app/state'

export type CanonicalCourseStatus =
  | 'UNAVAILABLE'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PENDING_CERTIFICATION'
  | 'COMPLETE'

export interface CanonicalNextCourseOption {
  readonly courseRef: string
  readonly title: string
  readonly grade: FinalCurriculumGrade
  readonly subject: AcademySubject
}

export interface CanonicalCourseCompletion {
  readonly status: CanonicalCourseStatus
  readonly courseRef: string | null
  readonly title: string
  readonly subject: AcademySubject
  readonly workingGrade: Grade
  readonly requiredLessonCount: number
  readonly completedLessonCount: number
  readonly requiredAssessmentCount: number
  readonly certifiedAssessmentCount: number
  /** Present only when every required completion fact carries an authoritative timestamp. */
  readonly completedAt: string | null
  readonly pendingAssessment: boolean
  readonly guardianGate: boolean
  /** The canonical course(s) at the nearest higher authored grade, never a fabricated Grade 6 course. */
  readonly nextCourseOptions: readonly CanonicalNextCourseOption[]
}

export interface CanonicalCourseCatalog {
  readonly listCourses: (grade?: FinalCurriculumGrade) => readonly FinalCatalogCourse[]
  readonly listUnits: (courseRef: string) => readonly FinalCatalogUnit[]
}

export interface DeriveCanonicalCourseCompletionInput {
  readonly catalog: CanonicalCourseCatalog
  readonly studentRef: string
  readonly subject: AcademySubject
  readonly workingGrade: Grade
  readonly assignments: readonly FamilyPilotAssignmentRecordV1[]
  readonly assessments: readonly FinalFamilyPilotAssessmentAssignment[]
  /** Pending guardian records are separate authority from Core assignment state. */
  readonly pendingGuardianAssignmentRefs?: ReadonlySet<string>
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

function validInstant(value: string | null): value is string {
  return value !== null && Number.isFinite(Date.parse(value))
}

function firstCompletionAt(values: readonly (string | null)[]): string | null {
  const authoritative = values.filter(validInstant).sort()
  return authoritative[0] ?? null
}

function nextCourseOptions(
  catalog: CanonicalCourseCatalog,
  course: FinalCatalogCourse,
): readonly CanonicalNextCourseOption[] {
  const later = catalog.listCourses()
    .filter((candidate) => candidate.subject === course.subject && candidate.grade > course.grade)
  if (later.length === 0) return Object.freeze([])
  const nextGrade = Math.min(...later.map((candidate) => candidate.grade))
  return Object.freeze(later
    .filter((candidate) => candidate.grade === nextGrade)
    .sort((left, right) => left.title.localeCompare(right.title) || left.courseRef.localeCompare(right.courseRef))
    .map((candidate) => Object.freeze({
      courseRef: candidate.courseRef,
      title: candidate.title,
      grade: candidate.grade,
      subject: candidate.subject,
    })))
}

/**
 * Derives course completion from the admitted catalog and existing lifecycle
 * facts. It creates no enrollment, assignment, promotion, or working-level
 * mutation. Abandoned lessons never satisfy a required lesson.
 */
export function deriveCanonicalCourseCompletion(
  input: DeriveCanonicalCourseCompletionInput,
): CanonicalCourseCompletion {
  const grade = parseFinalCurriculumGrade(input.workingGrade)
  const course = grade === null
    ? undefined
    : input.catalog.listCourses(grade).find((candidate) => candidate.subject === input.subject)
  if (!course) {
    return Object.freeze({
      status: 'UNAVAILABLE',
      courseRef: null,
      title: `${input.subject} · Grade ${input.workingGrade}`,
      subject: input.subject,
      workingGrade: input.workingGrade,
      requiredLessonCount: 0,
      completedLessonCount: 0,
      requiredAssessmentCount: 0,
      certifiedAssessmentCount: 0,
      completedAt: null,
      pendingAssessment: false,
      guardianGate: false,
      nextCourseOptions: Object.freeze([]),
    })
  }

  const units = input.catalog.listUnits(course.courseRef)
  const lessonRefs = unique(units.flatMap((unit) => unit.lessonRefs))
  const assessmentRefs = unique(units.flatMap((unit) => unit.assessmentRef ? [unit.assessmentRef] : []))
  const courseAssignments = input.assignments.filter((assignment) =>
    assignment.subject === input.subject && lessonRefs.includes(assignment.lessonRef))
  const courseAssessments = input.assessments.filter((assessment) =>
    assessment.studentRef === input.studentRef &&
    assessment.courseRef === course.courseRef &&
    assessmentRefs.includes(assessment.assessmentRef))

  const completedLessonRefs = lessonRefs.filter((lessonRef) =>
    courseAssignments.some((assignment) => assignment.lessonRef === lessonRef && assignment.state === 'completed'))
  const certifiedAssessmentRefs = assessmentRefs.filter((assessmentRef) =>
    courseAssessments.some((assessment) => assessment.assessmentRef === assessmentRef && assessment.status === 'CERTIFIED'))
  const lessonsComplete = lessonRefs.length > 0 && completedLessonRefs.length === lessonRefs.length
  const assessmentsComplete = certifiedAssessmentRefs.length === assessmentRefs.length
  const complete = lessonsComplete && assessmentsComplete
  const started = courseAssignments.length > 0 || courseAssessments.length > 0
  const guardianGate = courseAssignments.some((assignment) =>
    input.pendingGuardianAssignmentRefs?.has(assignment.assignmentRef)) ||
    courseAssessments.some((assessment) => assessment.status === 'PENDING_GUARDIAN_ATTESTATION')

  const completionInstants = complete ? [
    ...lessonRefs.map((lessonRef) => firstCompletionAt(courseAssignments
      .filter((assignment) => assignment.lessonRef === lessonRef && assignment.state === 'completed')
      .map((assignment) => assignment.completedAt))),
    ...assessmentRefs.map((assessmentRef) => firstCompletionAt(courseAssessments
      .filter((assessment) => assessment.assessmentRef === assessmentRef && assessment.status === 'CERTIFIED')
      .map((assessment) => assessment.completedAt))),
  ] : []
  const completedAt = complete && completionInstants.every(validInstant)
    ? [...completionInstants].sort().at(-1) ?? null
    : null

  return Object.freeze({
    status: complete
      ? 'COMPLETE'
      : lessonsComplete && !assessmentsComplete
        ? 'PENDING_CERTIFICATION'
        : started
          ? 'IN_PROGRESS'
          : 'NOT_STARTED',
    courseRef: course.courseRef,
    title: course.title,
    subject: input.subject,
    workingGrade: input.workingGrade,
    requiredLessonCount: lessonRefs.length,
    completedLessonCount: completedLessonRefs.length,
    requiredAssessmentCount: assessmentRefs.length,
    certifiedAssessmentCount: certifiedAssessmentRefs.length,
    completedAt,
    pendingAssessment: courseAssessments.some((assessment) => assessment.status !== 'CERTIFIED') ||
      (lessonsComplete && assessmentRefs.length > certifiedAssessmentRefs.length),
    guardianGate,
    nextCourseOptions: complete ? nextCourseOptions(input.catalog, course) : Object.freeze([]),
  })
}
