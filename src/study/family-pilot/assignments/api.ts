import {
  findFamilyPilotStudent,
  startFamilyPilotAssignment,
  type FamilyPilotAssignmentState,
  type FamilyPilotStateV1,
} from '../core'

// FAMILY-PILOT-ASSIGN-1 — day-to-day reads/writes against an already-planned
// student. None of this needs the catalog: "what's open right now" and
// "start this one" are pure state questions once plan.ts has done its job.

export interface PilotTodayAssignment {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly subject: string
  readonly title: string
  readonly state: FamilyPilotAssignmentState
}

/** Every assignment this student still has open — planned, active, or
 * paused. Normally at most one per enabled subject, since plan.ts only ever
 * opens the next one after the current one completes. Insertion order,
 * which matches the order subjects were planned in. */
export function getTodayAssignments(
  state: FamilyPilotStateV1,
  studentRef: string,
): readonly PilotTodayAssignment[] {
  const student = findFamilyPilotStudent(state, studentRef)
  if (!student) return []
  return student.assignments
    .filter((assignment) => assignment.state !== 'completed' && assignment.state !== 'abandoned')
    .map((assignment) =>
      Object.freeze({
        assignmentRef: assignment.assignmentRef,
        lessonRef: assignment.lessonRef,
        subject: assignment.subject,
        title: assignment.title,
        state: assignment.state,
      }),
    )
}

/** Binds a Study session to an assignment and marks it the student's active
 * work. Thin wrapper over core's own transition so callers only need to
 * depend on this module for the whole assignment lifecycle. */
export function markAssignmentStarted(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  sessionRef: string,
  now: string,
): FamilyPilotStateV1 {
  return startFamilyPilotAssignment(state, studentRef, assignmentRef, sessionRef, now)
}
