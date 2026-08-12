import type { StudySubject } from '../../types'
import type {
  FamilyPilotAssignLesson,
  FamilyPilotAssignment,
  FamilyPilotAssignmentStatus,
  FamilyPilotAssignStudent,
  FamilyPilotWorkingGradeEntry,
} from './types'

export interface FamilyPilotCurrentAssignmentRow {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly lessonTitle: string
  readonly subject: StudySubject
  readonly status: FamilyPilotAssignmentStatus
  readonly optional: boolean
  readonly canResume: boolean
  readonly canSkip: boolean
}

export interface FamilyPilotAssignableLessonRow {
  readonly lessonRef: string
  readonly title: string
  readonly subject: StudySubject
  readonly grade: number
  readonly duplicateAssignmentRef: string | null
  readonly duplicateStatus: FamilyPilotAssignmentStatus | null
  readonly canResumeDuplicate: boolean
  readonly priorStatus: FamilyPilotAssignmentStatus | null
}

export interface FamilyPilotAssignViewModel {
  readonly studentRef: string
  readonly displayName: string
  readonly nominalGrade: number
  readonly workingGrades: readonly FamilyPilotWorkingGradeEntry[]
  readonly currentAssignments: readonly FamilyPilotCurrentAssignmentRow[]
  readonly assignableLessons: readonly FamilyPilotAssignableLessonRow[]
}

const OPEN_STATUSES: readonly FamilyPilotAssignmentStatus[] = ['not-started', 'in-progress', 'paused']
const RESUMABLE_STATUSES: readonly FamilyPilotAssignmentStatus[] = ['in-progress', 'paused']

/**
 * Builds one student's assignment-control view from that student's own data
 * only. The explicit studentRef filters below are the guarantee that a host
 * which accidentally hands in another student's lessons/assignments can
 * never have them appear against this student — a same-name student, or a
 * stale prop from a just-completed switch, must never blend in.
 */
export function buildAssignViewModel(input: {
  readonly student: FamilyPilotAssignStudent
  readonly availableLessons: readonly FamilyPilotAssignLesson[]
  readonly currentAssignments: readonly FamilyPilotAssignment[]
  readonly workingGrade: readonly FamilyPilotWorkingGradeEntry[]
  readonly enabledSubjects: readonly StudySubject[]
  readonly supportsSkip: boolean
}): FamilyPilotAssignViewModel {
  const { student, availableLessons, currentAssignments, workingGrade, enabledSubjects, supportsSkip } = input
  const enabledSubjectSet = new Set(enabledSubjects)
  const studentAssignments = currentAssignments.filter((assignment) => assignment.studentRef === student.studentRef)

  // "Current work" means open work — a completed or skipped assignment
  // sitting in this list forever would read to a parent as still needing
  // attention, so closed assignments are left out here (they still inform
  // assignableLessons.priorStatus below).
  const currentAssignmentRows: FamilyPilotCurrentAssignmentRow[] = studentAssignments
    .filter((assignment) => OPEN_STATUSES.includes(assignment.status))
    .map((assignment) => ({
      assignmentRef: assignment.assignmentRef,
      lessonRef: assignment.lessonRef,
      lessonTitle: assignment.lessonTitle,
      subject: assignment.subject,
      status: assignment.status,
      optional: assignment.optional,
      canResume: RESUMABLE_STATUSES.includes(assignment.status),
      canSkip: supportsSkip && OPEN_STATUSES.includes(assignment.status),
    }))

  const assignableLessons: FamilyPilotAssignableLessonRow[] = availableLessons
    .filter((lesson) => enabledSubjectSet.has(lesson.subject))
    .map((lesson) => {
      const duplicate = studentAssignments.find(
        (assignment) => assignment.lessonRef === lesson.lessonRef && OPEN_STATUSES.includes(assignment.status),
      )
      const priorClosed = duplicate
        ? undefined
        : studentAssignments.find((assignment) => assignment.lessonRef === lesson.lessonRef)
      return {
        lessonRef: lesson.lessonRef,
        title: lesson.title,
        subject: lesson.subject,
        grade: lesson.grade,
        duplicateAssignmentRef: duplicate?.assignmentRef ?? null,
        duplicateStatus: duplicate?.status ?? null,
        canResumeDuplicate: duplicate ? RESUMABLE_STATUSES.includes(duplicate.status) : false,
        priorStatus: priorClosed?.status ?? null,
      }
    })

  const workingGrades = workingGrade.filter((entry) => enabledSubjectSet.has(entry.subject))

  return {
    studentRef: student.studentRef,
    displayName: student.displayName,
    nominalGrade: student.nominalGrade,
    workingGrades,
    currentAssignments: currentAssignmentRows,
    assignableLessons,
  }
}
