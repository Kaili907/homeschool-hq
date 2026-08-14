import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import type {
  FamilyAutoPlannerSchoolPlanV1,
  FamilyAutoPlannerSubjectPlanV1,
  SchoolWeekday,
} from '../auto-planner'
import {
  setWorkingGrade,
  updateStudent,
  type FamilySetupState,
  type FamilySetupStudent,
} from '../setup'

export const SCHOOL_WEEKDAYS: readonly { readonly value: SchoolWeekday; readonly label: string; readonly shortLabel: string }[] = Object.freeze([
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5, label: 'Friday', shortLabel: 'Fri' },
  { value: 6, label: 'Saturday', shortLabel: 'Sat' },
  { value: 7, label: 'Sunday', shortLabel: 'Sun' },
])

const SUBJECT_LABELS: Readonly<Record<AcademySubject, string>> = Object.freeze({
  mathematics: 'Math',
  'english-language-arts': 'English Language Arts',
  science: 'Science',
  'social-studies': 'Social Studies',
  health: 'Health',
  'physical-education': 'Physical Education',
  'ready-for-life': 'Ready for Life',
  technology: 'Technology & Computer Science',
  'arts-and-music': 'Arts & Music',
  'financial-literacy': 'Financial Literacy',
})

export interface SchoolPlanDraft {
  readonly householdTimeZone: string
  readonly schoolYearStart: string
  readonly schoolYearEnd: string
  readonly schoolWeekdays: readonly SchoolWeekday[]
  readonly nonSchoolDates: readonly string[]
  readonly addedSchoolDates: readonly string[]
  readonly enabledSubjects: readonly AcademySubject[]
  readonly workingGradeBySubject: Partial<Record<AcademySubject, AcademyGrade>>
  readonly subjects: readonly FamilyAutoPlannerSubjectPlanV1[]
  readonly configuredAt: string
}

export function parentSubjectLabel(subject: AcademySubject): string {
  return SUBJECT_LABELS[subject]
}

export function orderedSubjects(
  subjects: readonly FamilyAutoPlannerSubjectPlanV1[],
): readonly FamilyAutoPlannerSubjectPlanV1[] {
  return Object.freeze([...subjects]
    .sort((left, right) => left.order - right.order || left.subject.localeCompare(right.subject))
    .map((item, order) => Object.freeze({ ...item, order })))
}

export function effectiveWorkingGrade(
  student: Pick<FamilySetupStudent, 'nominalGrade'>,
  draft: Pick<SchoolPlanDraft, 'workingGradeBySubject'>,
  subject: AcademySubject,
): AcademyGrade | null {
  const grade = draft.workingGradeBySubject[subject] ?? student.nominalGrade
  return ACADEMY_GRADES.includes(grade as AcademyGrade) ? grade as AcademyGrade : null
}

export function schoolDaysPhrase(days: readonly SchoolWeekday[]): string {
  const sorted = [...new Set(days)].sort((left, right) => left - right)
  if (sorted.join(',') === '1,2,3,4,5') return 'Monday through Friday'
  if (sorted.join(',') === '1,2,3,4,5,6,7') return 'every day'
  const labels = sorted.map((value) => SCHOOL_WEEKDAYS.find((day) => day.value === value)?.label).filter(Boolean) as string[]
  if (labels.length <= 1) return labels[0] ?? 'no selected days'
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`
}

export function formatStartTime(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return value
  const hour = Number(match[1])
  const minute = match[2]
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${suffix}`
}

function parentList(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? ''
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

export function schoolPlanSummary(student: FamilySetupStudent, draft: SchoolPlanDraft): {
  readonly introduction: string
  readonly subjects: readonly string[]
} {
  const days = schoolDaysPhrase(draft.schoolWeekdays)
  const active = orderedSubjects(draft.subjects).filter((subject) => !subject.paused)
  const paused = orderedSubjects(draft.subjects).filter((subject) => subject.paused)
  const activeNames = active.map((subject) => parentSubjectLabel(subject.subject))
  const introduction = activeNames.length
    ? `${student.displayName} will have ${parentList(activeNames)} on ${days}.`
    : `All of ${student.displayName}’s subjects are paused.`
  return Object.freeze({
    introduction,
    subjects: Object.freeze([
      ...active.map((subject) => `${parentSubjectLabel(subject.subject)}: ${subject.lessonsPerDay} ${subject.lessonsPerDay === 1 ? 'lesson' : 'lessons'} per school day, starting at ${formatStartTime(subject.startLocalTime)}`),
      ...paused.map((subject) => `${parentSubjectLabel(subject.subject)} is paused. Unfinished work stays available, but no new lesson will be added.`),
    ]),
  })
}

export function composeFamilySetup(
  state: FamilySetupState,
  student: FamilySetupStudent,
  draft: Pick<SchoolPlanDraft, 'enabledSubjects' | 'workingGradeBySubject'>,
  now: string,
): FamilySetupState | null {
  let next = state
  for (const subject of student.enabledSubjects) {
    const cleared = setWorkingGrade(next, student.studentRef, subject, null, now)
    if (cleared.status !== 'ok') return null
    next = cleared.state
  }
  const subjects = updateStudent(next, student.studentRef, { enabledSubjects: draft.enabledSubjects }, now)
  if (subjects.status !== 'ok') return null
  next = subjects.state
  for (const subject of draft.enabledSubjects) {
    const grade = draft.workingGradeBySubject[subject] ?? null
    const updated = setWorkingGrade(next, student.studentRef, subject, grade, now)
    if (updated.status !== 'ok') return null
    next = updated.state
  }
  return next
}

export function toPlannerSchoolPlan(
  draft: SchoolPlanDraft,
  schemaVersion: FamilyAutoPlannerSchoolPlanV1['schemaVersion'],
  updatedAt: string,
): FamilyAutoPlannerSchoolPlanV1 {
  return Object.freeze({
    schemaVersion,
    householdTimeZone: draft.householdTimeZone.trim(),
    schoolYearStart: draft.schoolYearStart,
    schoolYearEnd: draft.schoolYearEnd,
    schoolWeekdays: Object.freeze([...draft.schoolWeekdays].sort((left, right) => left - right)),
    nonSchoolDates: Object.freeze([...new Set(draft.nonSchoolDates)].sort()),
    addedSchoolDates: Object.freeze([...new Set(draft.addedSchoolDates)].sort()),
    subjects: orderedSubjects(draft.subjects).map((item) => Object.freeze({
      subject: item.subject,
      order: item.order,
      paused: item.paused,
      ...(item.courseRef?.trim() ? { courseRef: item.courseRef.trim() } : {}),
      lessonsPerDay: item.lessonsPerDay,
      startLocalTime: item.startLocalTime,
    })),
    configuredAt: draft.configuredAt,
    updatedAt,
  })
}

export function orderedEnabledSubjects(subjects: readonly AcademySubject[]): readonly AcademySubject[] {
  const selected = new Set(subjects)
  return Object.freeze(ACADEMY_SUBJECTS.filter((subject) => selected.has(subject)))
}
