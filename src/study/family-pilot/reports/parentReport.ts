import type { FinalFamilyPilotCatalog } from '../../../curriculum/final-app-data'
import type { AcademySubject, Grade } from '../../../types'
import type { FamilyPilotAssignmentRecordV1, FamilyPilotStateV1 } from '../core'
import type { FinalAssessmentAssignmentStatus, FinalFamilyPilotAssessmentAssignment } from '../final-app'
import type { FamilySetupStudent } from '../setup'
import type { FactualStudyTime } from './factualProgress'

export type ParentReportRangePreset = 'this-week' | 'month' | 'school-year' | 'custom'

export interface ParentReportRange {
  readonly preset: ParentReportRangePreset
  readonly startDate: string
  readonly endDate: string
  readonly label: string
}

export type ParentReportRangeResolution =
  | { readonly status: 'ready'; readonly range: ParentReportRange }
  | { readonly status: 'unavailable'; readonly reason: string }

export interface ParentReportAssessmentRecord {
  readonly assessmentRef: string
  readonly title: string
  readonly subject: AcademySubject
  readonly courseRef: string
  readonly authorityClass: FinalFamilyPilotAssessmentAssignment['authorityClass']
  readonly status: FinalAssessmentAssignmentStatus
  readonly recordDate: string
}

export interface ParentReportCompletedLesson {
  readonly lessonRef: string
  readonly title: string
  readonly subject: AcademySubject
}

export interface ParentReportSubjectRecord {
  readonly subject: AcademySubject
  readonly workingGrade: Grade
  readonly courseRef: string | null
  readonly courseTitle: string
  readonly courseLessonCount: number | null
  readonly assignedLessons: number
  readonly completedLessonsInPeriod: number
  readonly recordedStudyTime: FactualStudyTime
  readonly position: {
    readonly unitNumber: number | null
    readonly unitTitle: string | null
    readonly courseLessonNumber: number | null
    readonly lessonTitle: string
    readonly lessonState: FamilyPilotAssignmentRecordV1['state']
  } | null
  readonly certifiedAssessmentsInPeriod: number
  readonly pendingAssessments: number
}

export interface ParentSchoolLogDay {
  readonly date: string
  readonly subjectsWorked: readonly AcademySubject[]
  readonly lessonsCompleted: readonly ParentReportCompletedLesson[]
  readonly recordedStudyTime: FactualStudyTime
  readonly assessmentStates: readonly ParentReportAssessmentRecord[]
}

export interface ParentProgressReportModel {
  readonly generatedOn: string
  readonly range: ParentReportRange
  readonly learner: {
    readonly studentRef: string
    readonly displayName: string
    readonly nominalGrade: Grade
  }
  readonly totals: {
    readonly lessonsCompleted: number
    readonly recordedStudyTime: FactualStudyTime
    readonly schoolDaysWithRecordedActivity: number
    readonly certifiedAssessments: number
    readonly pendingAssessments: number
  }
  readonly subjects: readonly ParentReportSubjectRecord[]
  readonly certifiedAssessments: readonly ParentReportAssessmentRecord[]
  readonly pendingAssessments: readonly ParentReportAssessmentRecord[]
  readonly schoolLog: readonly ParentSchoolLogDay[]
  readonly gradingBoundary: 'CERTIFIED_RECORDS_ONLY_NO_GPA_OR_LETTER_GRADE'
  readonly privacyBoundary: 'ONE_PARENT_SELECTED_LEARNER_NO_PRIVATE_CONTENT'
}

export interface BuildParentProgressReportInput {
  readonly student: FamilySetupStudent
  /** Full Core state; this projection selects only the exact studentRef. */
  readonly coreState: FamilyPilotStateV1
  readonly assessments: readonly FinalFamilyPilotAssessmentAssignment[]
  readonly catalog: Pick<FinalFamilyPilotCatalog['runtime'], 'listCourses' | 'listUnits'>
  /** Parent-authorized course choices from the saved School Plan, when present. */
  readonly courseRefBySubject?: Partial<Record<AcademySubject, string>>
  readonly range: ParentReportRange
  readonly generatedOn: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function validDate(value: string): boolean {
  return ISO_DATE.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00.000Z`))
}

function mondayOnOrBefore(today: string): string {
  const held = new Date(`${today}T12:00:00.000Z`)
  const offset = (held.getUTCDay() + 6) % 7
  held.setUTCDate(held.getUTCDate() - offset)
  return held.toISOString().slice(0, 10)
}

export function resolveParentReportRange(input: {
  readonly preset: ParentReportRangePreset
  readonly today: string
  readonly schoolYear?: { readonly startDate: string; readonly endDate: string } | null
  readonly customStart?: string
  readonly customEnd?: string
}): ParentReportRangeResolution {
  if (!validDate(input.today)) return { status: 'unavailable', reason: 'The report date is invalid.' }
  if (input.preset === 'this-week') {
    return { status: 'ready', range: { preset: input.preset, startDate: mondayOnOrBefore(input.today), endDate: input.today, label: 'This week' } }
  }
  if (input.preset === 'month') {
    return { status: 'ready', range: { preset: input.preset, startDate: `${input.today.slice(0, 7)}-01`, endDate: input.today, label: 'Month to date' } }
  }
  if (input.preset === 'school-year') {
    if (!input.schoolYear || !validDate(input.schoolYear.startDate) || !validDate(input.schoolYear.endDate) || input.schoolYear.endDate < input.schoolYear.startDate) {
      return { status: 'unavailable', reason: 'Save valid School Plan dates to use the school-year range.' }
    }
    return {
      status: 'ready',
      range: { preset: input.preset, startDate: input.schoolYear.startDate, endDate: input.schoolYear.endDate, label: 'School year' },
    }
  }
  const startDate = input.customStart ?? ''
  const endDate = input.customEnd ?? ''
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) {
    return { status: 'unavailable', reason: 'Choose a valid custom start and end date.' }
  }
  return { status: 'ready', range: { preset: input.preset, startDate, endDate, label: 'Custom range' } }
}

function inRange(date: string | null | undefined, range: ParentReportRange): boolean {
  const held = date?.slice(0, 10)
  return Boolean(held && held >= range.startDate && held <= range.endDate)
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

function currentAssignment(assignments: readonly FamilyPilotAssignmentRecordV1[]): FamilyPilotAssignmentRecordV1 | null {
  return assignments.find((item) => item.state === 'active')
    ?? assignments.find((item) => item.state === 'paused')
    ?? assignments.find((item) => item.state === 'planned')
    ?? [...assignments]
      .filter((item) => item.state === 'completed')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]
    ?? null
}

function assessmentRecord(item: FinalFamilyPilotAssessmentAssignment): ParentReportAssessmentRecord {
  return Object.freeze({
    assessmentRef: item.assessmentRef,
    title: item.title,
    subject: item.subject,
    courseRef: item.courseRef,
    authorityClass: item.authorityClass,
    status: item.status,
    recordDate: (item.completedAt ?? item.updatedAt).slice(0, 10),
  })
}

/**
 * Builds one parent-selected learner's factual household record. The output is
 * deliberately metadata-only: no learner response, Tutor transcript, private
 * reflection, inferred grade, GPA, comparative rank, or behavioral inference.
 */
export function buildParentProgressReport(input: BuildParentProgressReportInput): ParentProgressReportModel {
  const assignments = (input.coreState.students.find((item) => item.studentRef === input.student.studentRef)?.assignments ?? [])
    .filter((item) => item.state !== 'abandoned')
  const assessments = input.assessments.filter((item) => item.studentRef === input.student.studentRef)
  const courses = input.catalog.listCourses()
  const unitsByCourse = new Map(courses.map((course) => [course.courseRef, input.catalog.listUnits(course.courseRef)]))
  const lessonLocation = new Map<string, { readonly courseRef: string; readonly unitNumber: number; readonly unitTitle: string; readonly courseLessonNumber: number }>()
  for (const course of courses) {
    let courseLessonNumber = 0
    for (const unit of unitsByCourse.get(course.courseRef) ?? []) {
      for (const lessonRef of unit.lessonRefs) {
        courseLessonNumber += 1
        lessonLocation.set(lessonRef, { courseRef: course.courseRef, unitNumber: unit.unitNumber, unitTitle: unit.title, courseLessonNumber })
      }
    }
  }

  const certifiedAssessments = assessments
    .filter((item) => item.status === 'CERTIFIED' && inRange(item.completedAt ?? item.updatedAt, input.range))
    .map(assessmentRecord)
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.title.localeCompare(b.title))
  const pendingAssessments = assessments
    .filter((item) => item.status !== 'CERTIFIED')
    .map(assessmentRecord)
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.title.localeCompare(b.title))

  const subjects = input.student.enabledSubjects.map((subject): ParentReportSubjectRecord => {
    const subjectAssignments = assignments.filter((item) => item.subject === subject)
    const current = currentAssignment(subjectAssignments)
    const currentLocation = current ? lessonLocation.get(current.lessonRef) : undefined
    const preferredCourseRef = currentLocation?.courseRef ?? input.courseRefBySubject?.[subject]
    const workingGrade = input.student.workingGradeBySubject[subject] ?? input.student.nominalGrade
    const course = courses.find((item) => item.courseRef === preferredCourseRef)
      ?? input.catalog.listCourses(Number(workingGrade) as never).find((item) => item.subject === subject)
    return Object.freeze({
      subject,
      workingGrade,
      courseRef: course?.courseRef ?? null,
      courseTitle: course?.title ?? subject,
      courseLessonCount: course?.lessonCount ?? null,
      assignedLessons: subjectAssignments.length,
      completedLessonsInPeriod: subjectAssignments.filter((item) => item.state === 'completed' && inRange(item.completedAt, input.range)).length,
      recordedStudyTime: studyTime(subjectAssignments, input.range.startDate, input.range.endDate),
      position: current ? Object.freeze({
        unitNumber: currentLocation?.unitNumber ?? null,
        unitTitle: currentLocation?.unitTitle ?? null,
        courseLessonNumber: currentLocation?.courseLessonNumber ?? null,
        lessonTitle: current.title,
        lessonState: current.state,
      }) : null,
      certifiedAssessmentsInPeriod: certifiedAssessments.filter((item) => item.subject === subject).length,
      pendingAssessments: pendingAssessments.filter((item) => item.subject === subject).length,
    })
  })

  const log = new Map<string, {
    subjects: Set<AcademySubject>
    lessons: ParentReportCompletedLesson[]
    assessmentStates: ParentReportAssessmentRecord[]
  }>()
  const day = (date: string) => {
    const existing = log.get(date)
    if (existing) return existing
    const created = { subjects: new Set<AcademySubject>(), lessons: [], assessmentStates: [] }
    log.set(date, created)
    return created
  }
  for (const assignment of assignments) {
    const subject = assignment.subject as AcademySubject
    for (const time of assignment.progress.activeSecondsByDate ?? []) {
      if (time.activeSeconds > 0 && inRange(time.date, input.range)) day(time.date).subjects.add(subject)
    }
    if (assignment.state === 'completed' && inRange(assignment.completedAt, input.range)) {
      const date = assignment.completedAt!.slice(0, 10)
      const held = day(date)
      held.subjects.add(subject)
      held.lessons.push(Object.freeze({ lessonRef: assignment.lessonRef, title: assignment.title, subject }))
    }
  }
  for (const assessment of assessments) {
    if (assessment.status === 'PLANNED') continue
    const record = assessmentRecord(assessment)
    if (!inRange(record.recordDate, input.range)) continue
    const held = day(record.recordDate)
    held.subjects.add(record.subject)
    held.assessmentStates.push(record)
  }

  const schoolLog = [...log.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, held]): ParentSchoolLogDay => Object.freeze({
      date,
      subjectsWorked: Object.freeze([...held.subjects].sort()),
      lessonsCompleted: Object.freeze([...held.lessons].sort((a, b) => a.title.localeCompare(b.title))),
      recordedStudyTime: studyTime(assignments, date, date),
      assessmentStates: Object.freeze([...held.assessmentStates].sort((a, b) => a.title.localeCompare(b.title))),
    }))

  const completedLessons = assignments.filter((item) => item.state === 'completed' && inRange(item.completedAt, input.range)).length
  return Object.freeze({
    generatedOn: input.generatedOn,
    range: Object.freeze({ ...input.range }),
    learner: Object.freeze({ studentRef: input.student.studentRef, displayName: input.student.displayName, nominalGrade: input.student.nominalGrade }),
    totals: Object.freeze({
      lessonsCompleted: completedLessons,
      recordedStudyTime: studyTime(assignments, input.range.startDate, input.range.endDate),
      schoolDaysWithRecordedActivity: schoolLog.length,
      certifiedAssessments: certifiedAssessments.length,
      pendingAssessments: pendingAssessments.length,
    }),
    subjects: Object.freeze(subjects),
    certifiedAssessments: Object.freeze(certifiedAssessments),
    pendingAssessments: Object.freeze(pendingAssessments),
    schoolLog: Object.freeze(schoolLog),
    gradingBoundary: 'CERTIFIED_RECORDS_ONLY_NO_GPA_OR_LETTER_GRADE',
    privacyBoundary: 'ONE_PARENT_SELECTED_LEARNER_NO_PRIVATE_CONTENT',
  })
}

function csvCell(value: string | number): string {
  const held = String(value)
  return /[",\n]/.test(held) ? `"${held.replaceAll('"', '""')}"` : held
}

/** Minimal, whitelist-only chronological activity export. */
export function parentSchoolLogToCsv(report: ParentProgressReportModel): string {
  const rows = [[
    'date',
    'learner',
    'nominalGrade',
    'subjectsWorked',
    'lessonsCompleted',
    'recordedActiveStudySeconds',
    'assessmentStates',
  ].join(',')]
  for (const entry of report.schoolLog) {
    rows.push([
      entry.date,
      report.learner.displayName,
      report.learner.nominalGrade,
      entry.subjectsWorked.join('; '),
      entry.lessonsCompleted.map((item) => item.title).join('; '),
      entry.recordedStudyTime.activeSeconds ?? '',
      entry.assessmentStates.map((item) => `${item.title}: ${item.status}`).join('; '),
    ].map(csvCell).join(','))
  }
  return rows.join('\n')
}

/** Minimal JSON export built from explicit factual fields, never the source records. */
export function parentProgressReportToJson(report: ParentProgressReportModel): string {
  return JSON.stringify({
    schemaVersion: 1,
    kind: 'manuel-academy-parent-factual-progress-report',
    generatedOn: report.generatedOn,
    period: { startDate: report.range.startDate, endDate: report.range.endDate, label: report.range.label },
    learner: { displayName: report.learner.displayName, nominalGrade: report.learner.nominalGrade },
    totals: report.totals,
    subjects: report.subjects.map((subject) => ({
      subject: subject.subject,
      workingGrade: subject.workingGrade,
      course: subject.courseTitle,
      courseLessonCount: subject.courseLessonCount,
      assignedLessons: subject.assignedLessons,
      completedLessonsInPeriod: subject.completedLessonsInPeriod,
      recordedStudyTime: subject.recordedStudyTime,
      position: subject.position,
      certifiedAssessmentsInPeriod: subject.certifiedAssessmentsInPeriod,
      pendingAssessments: subject.pendingAssessments,
    })),
    certifiedAssessments: report.certifiedAssessments.map(({ title, subject, courseRef, authorityClass, status, recordDate }) => ({ title, subject, courseRef, authorityClass, status, recordDate })),
    pendingAssessments: report.pendingAssessments.map(({ title, subject, courseRef, authorityClass, status, recordDate }) => ({ title, subject, courseRef, authorityClass, status, recordDate })),
    schoolLog: report.schoolLog.map((entry) => ({
      date: entry.date,
      subjectsWorked: entry.subjectsWorked,
      lessonsCompleted: entry.lessonsCompleted.map((lesson) => ({ title: lesson.title, subject: lesson.subject })),
      recordedStudyTime: entry.recordedStudyTime,
      assessmentStates: entry.assessmentStates.map(({ title, subject, status }) => ({ title, subject, status })),
    })),
    boundaries: {
      grading: report.gradingBoundary,
      privacy: report.privacyBoundary,
      schoolLog: 'FACTUAL_ACTIVITY_ONLY_NOT_LEGAL_ATTENDANCE_CLAIM',
    },
  }, null, 2)
}
