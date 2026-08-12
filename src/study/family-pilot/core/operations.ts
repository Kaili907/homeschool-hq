import {
  FAMILY_PILOT_SCHEMA_VERSION,
  type FamilyPilotAssignmentRecordV1,
  type FamilyPilotStateV1,
  type FamilyPilotStudentRecordV1,
} from './schema'

// FAMILY-PILOT-CORE: pure state transitions. No storage, no clock, no randomness
// — every operation takes `now` explicitly so the same inputs always produce the
// same record, which is what makes the tests meaningful.
//
// STUDENT ISOLATION: every mutation routes through `withStudent`, which rebuilds
// the student list by mapping over it and returning non-matching students by
// reference. A mutation therefore cannot reach a sibling's record even if the
// caller passes a wrong or unknown ref — an unknown ref is a no-op, never a
// write against whichever student happens to be first.

function withStudent(
  state: FamilyPilotStateV1,
  studentRef: string,
  mutate: (student: FamilyPilotStudentRecordV1) => FamilyPilotStudentRecordV1,
): FamilyPilotStateV1 {
  let changed = false
  const students = state.students.map((student) => {
    if (student.studentRef !== studentRef) return student
    const next = mutate(student)
    if (next !== student) changed = true
    return next
  })
  // An unknown ref, or a mutation the record refused, returns the ORIGINAL state
  // object. Callers can therefore use reference equality to detect a real change.
  if (!changed) return state
  return Object.freeze({ ...state, students: Object.freeze(students) })
}

function withAssignment(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  now: string,
  mutate: (assignment: FamilyPilotAssignmentRecordV1) => FamilyPilotAssignmentRecordV1,
): FamilyPilotStateV1 {
  return withStudent(state, studentRef, (student) => {
    let changed = false
    const assignments = student.assignments.map((assignment) => {
      if (assignment.assignmentRef !== assignmentRef) return assignment
      const next = mutate(assignment)
      // A refused transition must not bump updatedAt. Timestamp churn on a no-op
      // reads downstream as "the learner worked on this", which is untrue.
      if (next === assignment) return assignment
      changed = true
      return Object.freeze({ ...next, updatedAt: now })
    })
    if (!changed) return student
    return Object.freeze({ ...student, updatedAt: now, assignments: Object.freeze(assignments) })
  })
}

export function createFamilyPilotStudent(
  state: FamilyPilotStateV1,
  input: { readonly studentRef: string; readonly displayName: string },
  now: string,
): FamilyPilotStateV1 {
  // Creating an existing student is a no-op, not a reset of their work.
  if (state.students.some((student) => student.studentRef === input.studentRef)) return state
  const student: FamilyPilotStudentRecordV1 = Object.freeze({
    studentRef: input.studentRef,
    displayName: input.displayName,
    createdAt: now,
    updatedAt: now,
    activeAssignmentRef: null,
    assignments: Object.freeze([]),
  })
  return Object.freeze({
    ...state,
    activeStudentRef: state.activeStudentRef ?? input.studentRef,
    students: Object.freeze([...state.students, student]),
  })
}

export function removeFamilyPilotStudent(
  state: FamilyPilotStateV1,
  studentRef: string,
): FamilyPilotStateV1 {
  const students = state.students.filter((student) => student.studentRef !== studentRef)
  if (students.length === state.students.length) return state
  return Object.freeze({
    ...state,
    activeStudentRef: state.activeStudentRef === studentRef ? null : state.activeStudentRef,
    students: Object.freeze(students),
  })
}

/** Selecting an unknown student is refused; the previous selection stands. */
export function setActiveFamilyPilotStudent(
  state: FamilyPilotStateV1,
  studentRef: string | null,
): FamilyPilotStateV1 {
  if (studentRef !== null && !state.students.some((item) => item.studentRef === studentRef)) {
    return state
  }
  return Object.freeze({ ...state, activeStudentRef: studentRef })
}

export function addFamilyPilotAssignment(
  state: FamilyPilotStateV1,
  studentRef: string,
  input: {
    readonly assignmentRef: string
    readonly lessonRef: string
    readonly subject: string
    readonly title: string
    readonly totalSegments: number
  },
  now: string,
): FamilyPilotStateV1 {
  return withStudent(state, studentRef, (student) => {
    if (student.assignments.some((item) => item.assignmentRef === input.assignmentRef)) {
      return student
    }
    const assignment: FamilyPilotAssignmentRecordV1 = Object.freeze({
      assignmentRef: input.assignmentRef,
      lessonRef: input.lessonRef,
      subject: input.subject,
      title: input.title,
      state: 'planned',
      sessionRef: null,
      progress: Object.freeze({
        completedSegmentRefs: Object.freeze([]),
        totalSegments: input.totalSegments,
        lastSegmentRef: null,
        activeSeconds: 0,
      }),
      pause: Object.freeze({
        pausedAt: null,
        resumedAt: null,
        pausedSeconds: 0,
        resumeSegmentRef: null,
      }),
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })
    return Object.freeze({
      ...student,
      updatedAt: now,
      assignments: Object.freeze([...student.assignments, assignment]),
    })
  })
}

/** Binds a Study session to an assignment and makes it the student's current work. */
export function startFamilyPilotAssignment(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  sessionRef: string,
  now: string,
): FamilyPilotStateV1 {
  const started = withAssignment(state, studentRef, assignmentRef, now, (assignment) =>
    assignment.state === 'completed'
      ? assignment
      : Object.freeze({ ...assignment, state: 'active', sessionRef }))
  return withStudent(started, studentRef, (student) =>
    student.assignments.some(
      (item) => item.assignmentRef === assignmentRef && item.state === 'active',
    )
      ? Object.freeze({ ...student, activeAssignmentRef: assignmentRef })
      : student)
}

export function pauseFamilyPilotAssignment(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  now: string,
): FamilyPilotStateV1 {
  return withAssignment(state, studentRef, assignmentRef, now, (assignment) =>
    assignment.state !== 'active'
      ? assignment
      : Object.freeze({
          ...assignment,
          state: 'paused',
          pause: Object.freeze({
            ...assignment.pause,
            pausedAt: now,
            resumedAt: null,
            // Where to come back to. Falls back to the last segment worked on.
            resumeSegmentRef: assignment.progress.lastSegmentRef,
          }),
        }))
}

/**
 * Resumes a paused assignment, accumulating the time spent paused. A clock that
 * moved backwards contributes zero rather than a negative pause total.
 */
export function resumeFamilyPilotAssignment(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  sessionRef: string,
  now: string,
): FamilyPilotStateV1 {
  return withAssignment(state, studentRef, assignmentRef, now, (assignment) => {
    if (assignment.state !== 'paused') return assignment
    const pausedAt = assignment.pause.pausedAt
    const elapsed = pausedAt === null
      ? 0
      : Math.max(0, Math.floor((Date.parse(now) - Date.parse(pausedAt)) / 1000))
    return Object.freeze({
      ...assignment,
      state: 'active',
      sessionRef,
      pause: Object.freeze({
        ...assignment.pause,
        pausedAt: null,
        resumedAt: now,
        pausedSeconds: assignment.pause.pausedSeconds + (Number.isFinite(elapsed) ? elapsed : 0),
      }),
    })
  })
}

/** Records checkpoint/progress metadata. Segment refs are a set, never a log. */
export function recordFamilyPilotProgress(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  input: { readonly segmentRef: string; readonly activeSeconds?: number },
  now: string,
): FamilyPilotStateV1 {
  return withAssignment(state, studentRef, assignmentRef, now, (assignment) => {
    if (assignment.state === 'completed' || assignment.state === 'abandoned') return assignment
    const completedSegmentRefs = assignment.progress.completedSegmentRefs.includes(input.segmentRef)
      ? assignment.progress.completedSegmentRefs
      : Object.freeze([...assignment.progress.completedSegmentRefs, input.segmentRef])
    const added = Math.max(0, Math.floor(input.activeSeconds ?? 0))
    return Object.freeze({
      ...assignment,
      progress: Object.freeze({
        ...assignment.progress,
        completedSegmentRefs,
        lastSegmentRef: input.segmentRef,
        totalSegments: Math.max(assignment.progress.totalSegments, completedSegmentRefs.length),
        activeSeconds: assignment.progress.activeSeconds + added,
      }),
    })
  })
}

export function completeFamilyPilotAssignment(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  now: string,
): FamilyPilotStateV1 {
  const completed = withAssignment(state, studentRef, assignmentRef, now, (assignment) =>
    assignment.state === 'completed'
      ? assignment
      : Object.freeze({
          ...assignment,
          state: 'completed',
          sessionRef: null,
          // First completion wins, mirroring AcademyLessonState.completedAt.
          completedAt: assignment.completedAt ?? now,
          pause: Object.freeze({ ...assignment.pause, pausedAt: null }),
        }))
  return withStudent(completed, studentRef, (student) =>
    student.activeAssignmentRef === assignmentRef
      ? Object.freeze({ ...student, activeAssignmentRef: null })
      : student)
}

export function abandonFamilyPilotAssignment(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  now: string,
): FamilyPilotStateV1 {
  const abandoned = withAssignment(state, studentRef, assignmentRef, now, (assignment) =>
    assignment.state === 'completed'
      ? assignment
      : Object.freeze({ ...assignment, state: 'abandoned', sessionRef: null }))
  return withStudent(abandoned, studentRef, (student) =>
    student.activeAssignmentRef === assignmentRef
      ? Object.freeze({ ...student, activeAssignmentRef: null })
      : student)
}

export function findFamilyPilotStudent(
  state: FamilyPilotStateV1,
  studentRef: string | null,
): FamilyPilotStudentRecordV1 | null {
  if (studentRef === null) return null
  return state.students.find((student) => student.studentRef === studentRef) ?? null
}

/** Used by the shell to prove the state it holds is the version it can write. */
export function isCurrentFamilyPilotSchema(state: FamilyPilotStateV1): boolean {
  return state.schemaVersion === FAMILY_PILOT_SCHEMA_VERSION
}
