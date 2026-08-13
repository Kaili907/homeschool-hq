import {
  FAMILY_PILOT_SCHEMA_VERSION,
  emptyFamilyPilotCompletion,
  isFamilyPilotRef,
  type FamilyPilotAssignmentRecordV1,
  type FamilyPilotAttestationEvidence,
  type FamilyPilotCompletionAuthority,
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
      // Seeded under learner authority. The real authority for this lesson is
      // resolved from the completion policy at the moment work is finished, not
      // at seed time, so a curriculum that starts requiring an adult applies to
      // work already on the list rather than only to work seeded afterwards.
      completion: emptyFamilyPilotCompletion(),
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

/**
 * Completes an assignment under LEARNER authority.
 *
 * The guard is the point: an assignment whose completion authority is
 * GUARDIAN_ATTESTATION_REQUIRED and which is not already certified is REFUSED
 * here, not completed. Every learner-driven path in the pilot ends up in this
 * function, so refusing it here is what makes "a learner click alone cannot
 * certify" a property of the store rather than a habit of its callers.
 */
export function completeFamilyPilotAssignment(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  now: string,
): FamilyPilotStateV1 {
  const completed = withAssignment(state, studentRef, assignmentRef, now, (assignment) => {
    if (assignment.state === 'completed') return assignment
    if (
      assignment.completion.authority === 'GUARDIAN_ATTESTATION_REQUIRED' &&
      assignment.completion.status !== 'CERTIFIED'
    ) return assignment
    return Object.freeze({
      ...assignment,
      state: 'completed',
      sessionRef: null,
      completion: Object.freeze({
        ...assignment.completion,
        status: 'CERTIFIED' as const,
        learnerAssertedAt: assignment.completion.learnerAssertedAt ?? now,
      }),
      // First completion wins, mirroring AcademyLessonState.completedAt.
      completedAt: assignment.completedAt ?? now,
      pause: Object.freeze({ ...assignment.pause, pausedAt: null }),
    })
  })
  // A refused completion must leave the student exactly as it found them. Only
  // a completion that actually landed clears the pointer to the open work.
  if (completed === state) return state
  return withStudent(completed, studentRef, (student) =>
    student.activeAssignmentRef === assignmentRef
      ? Object.freeze({ ...student, activeAssignmentRef: null })
      : student)
}

/**
 * The learner says they are finished, under the authority the completion policy
 * resolved for this lesson.
 *
 * Under LEARNER_AUTHORITY this is exactly the completion the pilot has always
 * performed. Under GUARDIAN_ATTESTATION_REQUIRED the work is RECORDED and the
 * assignment is left in whatever state it was already in — the learner's click
 * moves the completion status to PENDING_GUARDIAN_ATTESTATION and nothing else.
 * It does not set `state`, `completedAt`, or clear the session; only an adult
 * attestation does that.
 *
 * Repeat clicks are a no-op: the first assertion's instant stands, so a child
 * pressing Finish twice cannot make the work look freshly done to a parent.
 */
export function recordFamilyPilotLearnerCompletion(
  state: FamilyPilotStateV1,
  studentRef: string,
  assignmentRef: string,
  authority: FamilyPilotCompletionAuthority,
  now: string,
): FamilyPilotStateV1 {
  if (authority === 'LEARNER_AUTHORITY') {
    return completeFamilyPilotAssignment(state, studentRef, assignmentRef, now)
  }
  return withAssignment(state, studentRef, assignmentRef, now, (assignment) => {
    if (assignment.completion.status === 'CERTIFIED') return assignment
    if (
      assignment.completion.status === 'PENDING_GUARDIAN_ATTESTATION' &&
      assignment.completion.authority === 'GUARDIAN_ATTESTATION_REQUIRED'
    ) return assignment
    return Object.freeze({
      ...assignment,
      completion: Object.freeze({
        ...emptyFamilyPilotCompletion('GUARDIAN_ATTESTATION_REQUIRED'),
        status: 'PENDING_GUARDIAN_ATTESTATION' as const,
        learnerAssertedAt: assignment.completion.learnerAssertedAt ?? now,
      }),
    })
  })
}

/**
 * A household-authorized adult certifies one pending assignment.
 *
 * This is the ONLY transition that can move guardian-required work to
 * completed, and it refuses everything it cannot prove:
 *
 *   • `withAssignment` scopes the write to the named student, so an attestation
 *     for one child can never land on a sibling — which matters because
 *     assignment refs are lesson-derived and therefore identical across
 *     children working the same lesson.
 *   • `lessonRef` must match the record. A stale attestation, raised against
 *     the lesson that was open a moment ago, is refused rather than applied to
 *     whatever now sits under that assignment ref.
 *   • The record must actually be pending. Attesting work under learner
 *     authority, or work the learner has not finished, changes nothing.
 *
 * Attesting twice is a no-op: the second call sees CERTIFIED and returns the
 * record untouched, so `attestedAt` keeps naming the moment the adult really
 * did certify.
 *
 * Adult AUTHORIZATION is not checked here — this module has no notion of an
 * authenticated adult. It is checked at the runtime seam, by the controller,
 * before this is ever reached.
 */
export function attestFamilyPilotCompletion(
  state: FamilyPilotStateV1,
  input: {
    readonly studentRef: string
    readonly assignmentRef: string
    readonly lessonRef: string
    readonly attestedByRef: string
    readonly evidenceMode: FamilyPilotAttestationEvidence
  },
  now: string,
): FamilyPilotStateV1 {
  // An adult ref this schema could not read back is refused at write time. The
  // alternative is worse than a refused sign-off: the parser would drop the
  // whole assignment on the next load, and the household would lose the work
  // rather than just the certification.
  if (!isFamilyPilotRef(input.attestedByRef)) return state
  const attested = withAssignment(state, input.studentRef, input.assignmentRef, now, (assignment) => {
    if (assignment.lessonRef !== input.lessonRef) return assignment
    // Abandoned work is not signed off back into existence.
    if (assignment.state === 'abandoned') return assignment
    if (assignment.completion.authority !== 'GUARDIAN_ATTESTATION_REQUIRED') return assignment
    if (assignment.completion.status !== 'PENDING_GUARDIAN_ATTESTATION') return assignment
    return Object.freeze({
      ...assignment,
      state: 'completed',
      sessionRef: null,
      completion: Object.freeze({
        authority: 'GUARDIAN_ATTESTATION_REQUIRED' as const,
        status: 'CERTIFIED' as const,
        learnerAssertedAt: assignment.completion.learnerAssertedAt,
        attestedAt: now,
        attestedByRef: input.attestedByRef,
        evidenceMode: input.evidenceMode,
        // The binding is written from the record itself, never from the caller,
        // so a caller cannot bind an attestation to anything but what it
        // actually certified.
        attestedStudentRef: input.studentRef,
        attestedAssignmentRef: assignment.assignmentRef,
        attestedLessonRef: assignment.lessonRef,
      }),
      completedAt: assignment.completedAt ?? now,
      pause: Object.freeze({ ...assignment.pause, pausedAt: null }),
    })
  })
  // Same rule as completion: a refused attestation changes nothing at all, so a
  // learner whose adult declined does not silently lose their open work.
  if (attested === state) return state
  return withStudent(attested, input.studentRef, (student) =>
    student.activeAssignmentRef === input.assignmentRef
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
