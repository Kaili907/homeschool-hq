import type { FinalFamilyPilotCatalog } from '../../../curriculum/final-app-data'
import type { AcademySubject, Grade } from '../../../types'
import type { FamilyPilotAssignmentRecordV1, FamilyPilotStateV1 } from '../core'
import type { FinalAssessmentAssignmentStatus, FinalFamilyPilotAssessmentAssignment } from '../final-app'
import type { FamilySetupStudent } from '../setup'

export type StudyTimeCoverage = 'recorded' | 'partial' | 'not-recorded'

export interface FactualStudyTime {
  readonly activeSeconds: number | null
  readonly coverage: StudyTimeCoverage
}

export interface FactualAssessmentProgress {
  readonly assigned: number
  readonly certified: number
  readonly pending: number
  readonly byStatus: Readonly<Record<FinalAssessmentAssignmentStatus, number>>
}

export interface FactualSubjectProgress {
  readonly subject: AcademySubject
  readonly workingGrade: Grade
  readonly courseRef: string | null
  readonly courseTitle: string
  readonly assignedLessons: number
  readonly completedLessons: number
  readonly totalCourseLessons: number | null
  readonly currentLesson: {
    readonly lessonRef: string
    readonly title: string
    readonly state: FamilyPilotAssignmentRecordV1['state']
  } | null
  readonly currentUnit: {
    readonly unitRef: string
    readonly unitNumber: number
    readonly title: string
  } | null
  readonly assessments: FactualAssessmentProgress
  readonly studyTimeToday: FactualStudyTime
  readonly studyTimeThisWeek: FactualStudyTime
}

export interface FamilyFactualProgressModel {
  readonly learner: {
    readonly studentRef: string
    readonly displayName: string
  }
  readonly today: {
    readonly date: string
    readonly lessonsCompleted: number
    readonly studyTime: FactualStudyTime
  }
  readonly thisWeek: {
    readonly startDate: string
    readonly endDate: string
    readonly lessonsCompleted: number
    readonly studyTime: FactualStudyTime
  }
  readonly lessons: {
    readonly assigned: number
    readonly completed: number
  }
  readonly assessments: FactualAssessmentProgress
  readonly subjects: readonly FactualSubjectProgress[]
  readonly gradingBoundary: 'CERTIFIED_OUTCOMES_ONLY_NO_GPA'
}

export interface BuildFamilyFactualProgressInput {
  readonly student: FamilySetupStudent
  /** Full nested Core state so this projection performs its own exact studentRef isolation. */
  readonly coreState: FamilyPilotStateV1
  readonly assessments: readonly FinalFamilyPilotAssessmentAssignment[]
  readonly catalog: Pick<FinalFamilyPilotCatalog['runtime'], 'listCourses' | 'listUnits'>
  readonly today: string
}

const ASSESSMENT_STATUSES: readonly FinalAssessmentAssignmentStatus[] = Object.freeze([
  'PLANNED',
  'ACTIVE',
  'PENDING_ASSESSMENT',
  'ADULT_REVIEW_REQUIRED',
  'PENDING_GUARDIAN_ATTESTATION',
  'CERTIFIED',
])

function weekRange(today: string): { readonly startDate: string; readonly endDate: string } {
  const held = new Date(`${today}T12:00:00.000Z`)
  if (!Number.isFinite(held.getTime())) return { startDate: today, endDate: today }
  const offset = (held.getUTCDay() + 6) % 7
  const start = new Date(held)
  start.setUTCDate(start.getUTCDate() - offset)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

function assessmentProgress(
  assessments: readonly FinalFamilyPilotAssessmentAssignment[],
): FactualAssessmentProgress {
  const byStatus = Object.fromEntries(ASSESSMENT_STATUSES.map((status) => [
    status,
    assessments.filter((item) => item.status === status).length,
  ])) as unknown as Readonly<Record<FinalAssessmentAssignmentStatus, number>>
  return Object.freeze({
    assigned: assessments.length,
    certified: byStatus.CERTIFIED,
    pending: assessments.length - byStatus.CERTIFIED,
    byStatus: Object.freeze(byStatus),
  })
}

function studyTime(
  assignments: readonly FamilyPilotAssignmentRecordV1[],
  startDate: string,
  endDate: string,
): FactualStudyTime {
  if (assignments.length === 0) return Object.freeze({ activeSeconds: 0, coverage: 'recorded' })
  const recorded = assignments.filter((item) => item.progress.activeSecondsByDate !== undefined)
  if (recorded.length === 0) return Object.freeze({ activeSeconds: null, coverage: 'not-recorded' })
  const activeSeconds = recorded.reduce((total, item) => total + (item.progress.activeSecondsByDate ?? [])
    .filter((day) => day.date >= startDate && day.date <= endDate)
    .reduce((sum, day) => sum + day.activeSeconds, 0), 0)
  return Object.freeze({
    activeSeconds,
    coverage: recorded.length === assignments.length ? 'recorded' : 'partial',
  })
}

function currentAssignment(
  assignments: readonly FamilyPilotAssignmentRecordV1[],
): FamilyPilotAssignmentRecordV1 | null {
  return assignments.find((item) => item.state === 'active')
    ?? assignments.find((item) => item.state === 'paused')
    ?? assignments.find((item) => item.state === 'planned')
    ?? [...assignments]
      .filter((item) => item.state === 'completed')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]
    ?? null
}

/**
 * Pure projection over the learner's accepted Core, assessment, and catalog
 * records. It produces counts and positions only: no GPA, inferred grade,
 * personality, motivation, comparative rank, raw answer, or Tutor transcript.
 */
export function buildFamilyFactualProgress(
  input: BuildFamilyFactualProgressInput,
): FamilyFactualProgressModel {
  const learnerAssignments = (input.coreState.students.find((item) =>
    item.studentRef === input.student.studentRef)?.assignments ?? Object.freeze([]))
    .filter((item) => item.state !== 'abandoned')
  const learnerAssessments = input.assessments.filter((item) => item.studentRef === input.student.studentRef)
  const week = weekRange(input.today)
  const completed = learnerAssignments.filter((item) => item.state === 'completed')
  const subjects = input.student.enabledSubjects.map((subject): FactualSubjectProgress => {
    const workingGrade = input.student.workingGradeBySubject[subject] ?? input.student.nominalGrade
    const course = input.catalog.listCourses(Number(workingGrade) as never).find((item) => item.subject === subject)
    const lessonRefs = course
      ? new Set(input.catalog.listUnits(course.courseRef).flatMap((unit) => unit.lessonRefs))
      : null
    const subjectAssignments = learnerAssignments.filter((item) =>
      item.subject === subject && (!lessonRefs || lessonRefs.has(item.lessonRef)))
    const subjectAssessments = learnerAssessments.filter((item) =>
      item.subject === subject && (!course || item.courseRef === course.courseRef))
    const current = currentAssignment(subjectAssignments)
    const unit = course && current
      ? input.catalog.listUnits(course.courseRef).find((item) => item.lessonRefs.includes(current.lessonRef))
      : null
    return Object.freeze({
      subject,
      workingGrade,
      courseRef: course?.courseRef ?? null,
      courseTitle: course?.title ?? subject,
      assignedLessons: subjectAssignments.length,
      completedLessons: subjectAssignments.filter((item) => item.state === 'completed').length,
      totalCourseLessons: course?.lessonCount ?? null,
      currentLesson: current ? Object.freeze({ lessonRef: current.lessonRef, title: current.title, state: current.state }) : null,
      currentUnit: unit ? Object.freeze({ unitRef: unit.unitRef, unitNumber: unit.unitNumber, title: unit.title }) : null,
      assessments: assessmentProgress(subjectAssessments),
      studyTimeToday: studyTime(subjectAssignments, input.today, input.today),
      studyTimeThisWeek: studyTime(subjectAssignments, week.startDate, week.endDate),
    })
  })
  return Object.freeze({
    learner: Object.freeze({ studentRef: input.student.studentRef, displayName: input.student.displayName }),
    today: Object.freeze({
      date: input.today,
      lessonsCompleted: completed.filter((item) => item.completedAt?.slice(0, 10) === input.today).length,
      studyTime: studyTime(learnerAssignments, input.today, input.today),
    }),
    thisWeek: Object.freeze({
      ...week,
      lessonsCompleted: completed.filter((item) => {
        const date = item.completedAt?.slice(0, 10)
        return Boolean(date && date >= week.startDate && date <= week.endDate)
      }).length,
      studyTime: studyTime(learnerAssignments, week.startDate, week.endDate),
    }),
    lessons: Object.freeze({ assigned: learnerAssignments.length, completed: completed.length }),
    assessments: assessmentProgress(learnerAssessments),
    subjects: Object.freeze(subjects),
    gradingBoundary: 'CERTIFIED_OUTCOMES_ONLY_NO_GPA',
  })
}
