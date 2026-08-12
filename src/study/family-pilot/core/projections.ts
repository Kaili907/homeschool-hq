import { findFamilyPilotStudent } from './operations'
import type { FamilyPilotAssignmentState, FamilyPilotStateV1 } from './schema'
import type { FamilyPilotSnapshot } from './store'

// FAMILY-PILOT-CORE: read-only projections.
//
// Both projections below are DERIVED from the persisted records rather than
// stored alongside them. A stored copy of "percent complete" is a second source
// of truth that drifts the first time a write is interrupted; deriving it means
// the parent view and the diagnostics panel can never disagree with the record.
//
// Neither projection can leak learner prose, because no learner prose is stored:
// every field below is a ref, a count, a state name, or a household-authored
// title. See the rawAnswerIncluded/transcriptIncluded invariant in schema.ts.

export interface FamilyPilotAssignmentProgressView {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly subject: string
  readonly title: string
  readonly state: FamilyPilotAssignmentState
  readonly completedSegments: number
  readonly totalSegments: number
  /** 0–100, integer. 0 when the segment count is not yet known. */
  readonly percentComplete: number
  readonly activeSeconds: number
  readonly pausedSeconds: number
  readonly resumeSegmentRef: string | null
  readonly completedAt: string | null
  readonly updatedAt: string
}

export interface FamilyPilotParentProgressView {
  readonly studentRef: string
  readonly displayName: string
  readonly assignments: readonly FamilyPilotAssignmentProgressView[]
  readonly completedCount: number
  readonly inProgressCount: number
}

function percentComplete(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
}

/** Parent-visible progress metadata for one student. Null for an unknown ref. */
export function projectFamilyPilotParentProgress(
  state: FamilyPilotStateV1,
  studentRef: string | null,
): FamilyPilotParentProgressView | null {
  const student = findFamilyPilotStudent(state, studentRef)
  if (!student) return null
  const assignments = student.assignments.map((assignment) => {
    const completedSegments = assignment.progress.completedSegmentRefs.length
    return Object.freeze({
      assignmentRef: assignment.assignmentRef,
      lessonRef: assignment.lessonRef,
      subject: assignment.subject,
      title: assignment.title,
      state: assignment.state,
      completedSegments,
      totalSegments: assignment.progress.totalSegments,
      percentComplete: percentComplete(completedSegments, assignment.progress.totalSegments),
      activeSeconds: assignment.progress.activeSeconds,
      pausedSeconds: assignment.pause.pausedSeconds,
      resumeSegmentRef: assignment.pause.resumeSegmentRef,
      completedAt: assignment.completedAt,
      updatedAt: assignment.updatedAt,
    })
  })
  return Object.freeze({
    studentRef: student.studentRef,
    displayName: student.displayName,
    assignments: Object.freeze(assignments),
    completedCount: assignments.filter((item) => item.state === 'completed').length,
    inProgressCount: assignments.filter(
      (item) => item.state === 'active' || item.state === 'paused',
    ).length,
  })
}

export interface FamilyPilotDiagnosticsView {
  readonly schemaVersion: number
  readonly storageStatus: FamilyPilotSnapshot['status']
  readonly reasonCode: string | null
  readonly studentCount: number
  readonly activeStudentRef: string | null
  readonly activeStudentName: string | null
  readonly activeAssignmentRef: string | null
  readonly activeLessonRef: string | null
  readonly activeSessionRef: string | null
  readonly activeAssignmentState: FamilyPilotAssignmentState | null
  readonly updatedAt: string
}

/**
 * DEV/PILOT diagnostics: enough to answer "which student and which session am I
 * actually looking at right now?" without exposing any learner work. It reports
 * refs and states only — never a title-free-text pairing that could identify
 * what a child wrote, because no such field exists in the schema.
 */
export function projectFamilyPilotDiagnostics(
  snapshot: FamilyPilotSnapshot,
): FamilyPilotDiagnosticsView {
  const state = snapshot.state
  const student = findFamilyPilotStudent(state, state.activeStudentRef)
  const assignment = student
    ? student.assignments.find(
        (item) => item.assignmentRef === student.activeAssignmentRef,
      ) ?? null
    : null
  return Object.freeze({
    schemaVersion: state.schemaVersion,
    storageStatus: snapshot.status,
    reasonCode: snapshot.reasonCode,
    studentCount: state.students.length,
    activeStudentRef: state.activeStudentRef,
    activeStudentName: student?.displayName ?? null,
    activeAssignmentRef: assignment?.assignmentRef ?? null,
    activeLessonRef: assignment?.lessonRef ?? null,
    activeSessionRef: assignment?.sessionRef ?? null,
    activeAssignmentState: assignment?.state ?? null,
    updatedAt: state.updatedAt,
  })
}
