import { describe, expect, it } from 'vitest'
import {
  abandonFamilyPilotAssignment,
  addFamilyPilotAssignment,
  attestFamilyPilotCompletion,
  completeFamilyPilotAssignment,
  createFamilyPilotStudent,
  emptyFamilyPilotState,
  parseFamilyPilotState,
  recordFamilyPilotLearnerCompletion,
  projectFamilyPilotParentProgress,
  startFamilyPilotAssignment,
  type FamilyPilotStateV1,
} from '../core'
import {
  computeFamilyPilotCompletionStatus,
  familyPilotCompletionAuthority,
  guardianAttestationCompletionPolicy,
  learnerAuthorityCompletionPolicy,
  resolveCompletionAuthority,
} from './policy'

const T0 = '2026-08-12T09:00:00.000Z'
const T1 = '2026-08-12T10:00:00.000Z'
const T2 = '2026-08-12T11:00:00.000Z'
const LESSON = 'grade-5:rfl:day-4'
const ASSIGNMENT = 'assignment:grade-5:rfl:day-4'

/** Two siblings, both carrying the SAME lesson-derived assignment ref. */
function household(): FamilyPilotStateV1 {
  let state = emptyFamilyPilotState(T0)
  for (const [ref, name] of [['student:ada', 'Ada'], ['student:bo', 'Bo']] as const) {
    state = createFamilyPilotStudent(state, { studentRef: ref, displayName: name }, T0)
    state = addFamilyPilotAssignment(state, ref, {
      assignmentRef: ASSIGNMENT,
      lessonRef: LESSON,
      subject: 'Ready for Life',
      title: 'Cook a meal with a grown-up',
      totalSegments: 2,
    }, T0)
    state = startFamilyPilotAssignment(state, ref, ASSIGNMENT, 'block:1', T0)
  }
  return state
}

function recordFor(state: FamilyPilotStateV1, studentRef: string) {
  return state.students
    .find((student) => student.studentRef === studentRef)
    ?.assignments.find((item) => item.assignmentRef === ASSIGNMENT)
}

describe('completion policy', () => {
  it('maps the authored curriculum authority onto the runtime authority', () => {
    expect(familyPilotCompletionAuthority('learner')).toBe('LEARNER_AUTHORITY')
    expect(familyPilotCompletionAuthority('guardian')).toBe('GUARDIAN_ATTESTATION_REQUIRED')
  })

  it('never certifies guardian work from a learner assertion alone', () => {
    expect(computeFamilyPilotCompletionStatus('GUARDIAN_ATTESTATION_REQUIRED', true, false))
      .toBe('PENDING_GUARDIAN_ATTESTATION')
    expect(computeFamilyPilotCompletionStatus('GUARDIAN_ATTESTATION_REQUIRED', true, true))
      .toBe('CERTIFIED')
    // An adult attestation certifies whether or not the learner ever clicked.
    expect(computeFamilyPilotCompletionStatus('GUARDIAN_ATTESTATION_REQUIRED', false, true))
      .toBe('CERTIFIED')
    expect(computeFamilyPilotCompletionStatus('GUARDIAN_ATTESTATION_REQUIRED', false, false))
      .toBe('NOT_COMPLETE')
    expect(computeFamilyPilotCompletionStatus('LEARNER_AUTHORITY', true, false)).toBe('CERTIFIED')
    expect(computeFamilyPilotCompletionStatus('LEARNER_AUTHORITY', false, false)).toBe('NOT_COMPLETE')
  })

  it('resolves per lesson, and fails closed when the policy cannot answer', () => {
    const input = { studentRef: 'student:ada', assignmentRef: ASSIGNMENT, lessonRef: LESSON }
    expect(resolveCompletionAuthority(learnerAuthorityCompletionPolicy(), input))
      .toBe('LEARNER_AUTHORITY')
    expect(resolveCompletionAuthority(guardianAttestationCompletionPolicy([LESSON]), input))
      .toBe('GUARDIAN_ATTESTATION_REQUIRED')
    expect(resolveCompletionAuthority(guardianAttestationCompletionPolicy(['other:lesson']), input))
      .toBe('LEARNER_AUTHORITY')
    // A policy that throws must not be the reason a real-world task certifies
    // itself. Asking an adult needlessly is the survivable failure.
    expect(resolveCompletionAuthority({
      authorityFor: () => { throw new Error('curriculum unavailable') },
    }, input)).toBe('GUARDIAN_ATTESTATION_REQUIRED')
  })
})

describe('guardian attestation transitions', () => {
  it('records the learner click without completing the assignment', () => {
    const state = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    const record = recordFor(state, 'student:ada')
    expect(record?.completion.status).toBe('PENDING_GUARDIAN_ATTESTATION')
    expect(record?.completion.learnerAssertedAt).toBe(T1)
    // The work is recorded; the assignment is NOT finished.
    expect(record?.state).toBe('active')
    expect(record?.completedAt).toBeNull()
  })

  it('refuses a learner-driven completion of guardian work', () => {
    const pending = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    // The generic completion path is the one every learner surface reaches.
    const forced = completeFamilyPilotAssignment(pending, 'student:ada', ASSIGNMENT, T2)
    expect(forced).toBe(pending)
    expect(recordFor(forced, 'student:ada')?.state).toBe('active')

    // A second click is a no-op, and does not restamp the first assertion.
    const again = recordFamilyPilotLearnerCompletion(
      pending, 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T2)
    expect(again).toBe(pending)
    expect(recordFor(again, 'student:ada')?.completion.learnerAssertedAt).toBe(T1)
  })

  it('completes on the learner’s own authority when the lesson allows it', () => {
    const state = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'LEARNER_AUTHORITY', T1)
    const record = recordFor(state, 'student:ada')
    expect(record?.state).toBe('completed')
    expect(record?.completion.status).toBe('CERTIFIED')
    expect(record?.completion.authority).toBe('LEARNER_AUTHORITY')
    expect(record?.completion.attestedAt).toBeNull()
  })

  it('certifies on an adult attestation, and is idempotent', () => {
    const pending = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    const input = {
      studentRef: 'student:ada',
      assignmentRef: ASSIGNMENT,
      lessonRef: LESSON,
      attestedByRef: 'family-pilot-parent',
      evidenceMode: 'adult-observed' as const,
    }
    const certified = attestFamilyPilotCompletion(pending, input, T2)
    const record = recordFor(certified, 'student:ada')
    expect(record?.state).toBe('completed')
    expect(record?.completedAt).toBe(T2)
    expect(record?.completion.status).toBe('CERTIFIED')
    expect(record?.completion.attestedAt).toBe(T2)
    expect(record?.completion.attestedByRef).toBe('family-pilot-parent')
    // The binding is written from the record, so it names exactly what it certified.
    expect(record?.completion.attestedStudentRef).toBe('student:ada')
    expect(record?.completion.attestedAssignmentRef).toBe(ASSIGNMENT)
    expect(record?.completion.attestedLessonRef).toBe(LESSON)

    const twice = attestFamilyPilotCompletion(certified, input, '2026-08-12T23:00:00.000Z')
    expect(twice).toBe(certified)
    expect(recordFor(twice, 'student:ada')?.completion.attestedAt).toBe(T2)
  })

  it('gives the simulated alternative the same credit as the observed action', () => {
    const pending = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    const base = {
      studentRef: 'student:ada', assignmentRef: ASSIGNMENT, lessonRef: LESSON,
      attestedByRef: 'family-pilot-parent',
    }
    const observed = recordFor(
      attestFamilyPilotCompletion(pending, { ...base, evidenceMode: 'adult-observed' }, T2),
      'student:ada')
    const simulated = recordFor(
      attestFamilyPilotCompletion(pending, { ...base, evidenceMode: 'simulated-alternative' }, T2),
      'student:ada')
    expect(simulated?.state).toBe(observed?.state)
    expect(simulated?.completedAt).toBe(observed?.completedAt)
    expect(simulated?.completion.status).toBe(observed?.completion.status)
    // The evidence mode is the ONLY difference between the two records.
    expect(simulated?.completion.evidenceMode).toBe('simulated-alternative')
    expect(observed?.completion.evidenceMode).toBe('adult-observed')
    expect({ ...simulated?.completion, evidenceMode: null })
      .toEqual({ ...observed?.completion, evidenceMode: null })
  })

  it('refuses an attestation raised against the wrong lesson or the wrong work', () => {
    const pending = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    const base = {
      studentRef: 'student:ada', assignmentRef: ASSIGNMENT, lessonRef: LESSON,
      attestedByRef: 'family-pilot-parent', evidenceMode: 'adult-observed' as const,
    }
    // Stale lesson: the adult surface was showing something else.
    expect(attestFamilyPilotCompletion(pending, { ...base, lessonRef: 'grade-5:rfl:day-3' }, T2))
      .toBe(pending)
    expect(attestFamilyPilotCompletion(pending, { ...base, assignmentRef: 'assignment:other' }, T2))
      .toBe(pending)
    expect(attestFamilyPilotCompletion(pending, { ...base, studentRef: 'student:nobody' }, T2))
      .toBe(pending)
  })

  it('refuses an adult ref this schema could not read back', () => {
    const pending = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    const base = {
      studentRef: 'student:ada', assignmentRef: ASSIGNMENT, lessonRef: LESSON,
      evidenceMode: 'adult-observed' as const,
    }
    // Writing these would certify the work now and cost the household the whole
    // assignment on the next load, when the parser refused to read them.
    for (const attestedByRef of ['', 'a grown up', '-leading-dash', 'x'.repeat(200)]) {
      expect(attestFamilyPilotCompletion(pending, { ...base, attestedByRef }, T2)).toBe(pending)
    }
    const certified = attestFamilyPilotCompletion(
      pending, { ...base, attestedByRef: 'family-pilot-parent' }, T2)
    expect(recordFor(certified, 'student:ada')?.completion.status).toBe('CERTIFIED')
    // And what it did write reads back intact.
    expect(parseFamilyPilotState(JSON.parse(JSON.stringify(certified)))
      ?.students[0].assignments).toHaveLength(1)
  })

  it('refuses to attest work the learner has not finished, or work that needs no adult', () => {
    const fresh = household()
    const base = {
      studentRef: 'student:ada', assignmentRef: ASSIGNMENT, lessonRef: LESSON,
      attestedByRef: 'family-pilot-parent', evidenceMode: 'adult-observed' as const,
    }
    // Nothing recorded yet: there is no learner completion to certify.
    expect(attestFamilyPilotCompletion(fresh, base, T2)).toBe(fresh)
    // Learner-authority work is not attestable; it needs no adult.
    const learnerDone = recordFamilyPilotLearnerCompletion(
      fresh, 'student:ada', ASSIGNMENT, 'LEARNER_AUTHORITY', T1)
    expect(attestFamilyPilotCompletion(learnerDone, base, T2)).toBe(learnerDone)
  })

  it('does not sign abandoned work back into existence', () => {
    const pending = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    const dropped = abandonFamilyPilotAssignment(pending, 'student:ada', ASSIGNMENT, T2)
    expect(recordFor(dropped, 'student:ada')?.state).toBe('abandoned')
    const attested = attestFamilyPilotCompletion(dropped, {
      studentRef: 'student:ada', assignmentRef: ASSIGNMENT, lessonRef: LESSON,
      attestedByRef: 'family-pilot-parent', evidenceMode: 'adult-observed',
    }, T2)
    expect(attested).toBe(dropped)
    expect(recordFor(attested, 'student:ada')?.state).toBe('abandoned')
  })

  it('does not let one sibling’s attestation satisfy the other’s identical work', () => {
    let state = household()
    for (const ref of ['student:ada', 'student:bo']) {
      state = recordFamilyPilotLearnerCompletion(
        state, ref, ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    }
    // Both children carry the SAME assignment ref for the same lesson.
    expect(recordFor(state, 'student:ada')?.assignmentRef)
      .toBe(recordFor(state, 'student:bo')?.assignmentRef)

    const certified = attestFamilyPilotCompletion(state, {
      studentRef: 'student:ada',
      assignmentRef: ASSIGNMENT,
      lessonRef: LESSON,
      attestedByRef: 'family-pilot-parent',
      evidenceMode: 'adult-observed',
    }, T2)
    expect(recordFor(certified, 'student:ada')?.completion.status).toBe('CERTIFIED')
    expect(recordFor(certified, 'student:bo')?.completion.status)
      .toBe('PENDING_GUARDIAN_ATTESTATION')
    expect(recordFor(certified, 'student:bo')?.state).toBe('active')
  })
})

describe('attestation at rest', () => {
  function serialized(state: FamilyPilotStateV1): Record<string, unknown> {
    return JSON.parse(JSON.stringify(state))
  }

  function certifiedHousehold(): FamilyPilotStateV1 {
    const pending = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    return attestFamilyPilotCompletion(pending, {
      studentRef: 'student:ada', assignmentRef: ASSIGNMENT, lessonRef: LESSON,
      attestedByRef: 'family-pilot-parent', evidenceMode: 'adult-observed',
    }, T2)
  }

  it('survives a round trip through storage, pending and certified alike', () => {
    const pending = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    const reloadedPending = parseFamilyPilotState(serialized(pending))
    expect(recordFor(reloadedPending!, 'student:ada')?.completion.status)
      .toBe('PENDING_GUARDIAN_ATTESTATION')
    expect(recordFor(reloadedPending!, 'student:ada')?.state).toBe('active')

    const reloaded = parseFamilyPilotState(serialized(certifiedHousehold()))
    expect(recordFor(reloaded!, 'student:ada')?.completion).toEqual(
      recordFor(certifiedHousehold(), 'student:ada')?.completion)
  })

  it('refuses a stored record that claims completion without a certification', () => {
    const raw = serialized(recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1))
    const students = raw.students as { studentRef: string; assignments: Record<string, unknown>[] }[]
    students[0].assignments[0].state = 'completed'
    students[0].assignments[0].completedAt = T2
    const reloaded = parseFamilyPilotState(raw)
    // The forged assignment is dropped, not honoured. Ada's record survives.
    expect(reloaded?.students[0].studentRef).toBe('student:ada')
    expect(reloaded?.students[0].assignments).toHaveLength(0)
  })

  it('refuses a certification copied onto another child’s record', () => {
    const raw = serialized(certifiedHousehold())
    const students = raw.students as { studentRef: string; assignments: Record<string, unknown>[] }[]
    const stolen = JSON.parse(JSON.stringify(students[0].assignments[0]))
    // Bo's record now claims Ada's certification verbatim.
    students[1].assignments[0] = stolen
    const reloaded = parseFamilyPilotState(raw)
    expect(reloaded?.students[1].studentRef).toBe('student:bo')
    expect(reloaded?.students[1].assignments).toHaveLength(0)
    // Ada keeps her own.
    expect(recordFor(reloaded!, 'student:ada')?.completion.status).toBe('CERTIFIED')
  })

  it('refuses a certification rebound to a different lesson', () => {
    const raw = serialized(certifiedHousehold())
    const students = raw.students as { studentRef: string; assignments: Record<string, unknown>[] }[]
    const completion = students[0].assignments[0].completion as Record<string, unknown>
    completion.attestedLessonRef = 'grade-5:rfl:day-9'
    expect(parseFamilyPilotState(raw)?.students[0].assignments).toHaveLength(0)
  })

  it('persists refs, enums and instants only — never prose or media', () => {
    const raw = serialized(certifiedHousehold())
    const students = raw.students as { assignments: { completion: Record<string, unknown> }[] }[]
    const completion = students[0].assignments[0].completion
    expect(Object.keys(completion).sort()).toEqual([
      'attestedAssignmentRef', 'attestedAt', 'attestedByRef', 'attestedLessonRef',
      'attestedStudentRef', 'authority', 'evidenceMode', 'learnerAssertedAt', 'status',
    ])
    // No field anywhere in the persisted document can hold what was said, seen
    // or recorded — there is nowhere to put it. The two invariant markers are
    // stripped first: they are literal `false` flags asserting that absence,
    // not somewhere prose could hide.
    const document = JSON.stringify(raw)
    expect(document).toContain('"rawAnswerIncluded":false')
    expect(document).toContain('"transcriptIncluded":false')
    expect(document.replace(/"(rawAnswerIncluded|transcriptIncluded)":false/g, ''))
      .not.toMatch(/note|reflection|answer|transcript|audio|video|photo|narrative/i)
  })

  it('upgrades a version 1 record written before completion authority existed', () => {
    const raw = serialized(completeFamilyPilotAssignment(household(), 'student:ada', ASSIGNMENT, T1))
    const students = raw.students as { assignments: Record<string, unknown>[] }[]
    // Exactly what the previous build stored: version 1, and no completion block.
    raw.schemaVersion = 1
    for (const student of students) {
      for (const assignment of student.assignments) delete assignment.completion
    }
    const upgraded = parseFamilyPilotState(raw)
    expect(upgraded?.schemaVersion).toBe(2)
    const record = recordFor(upgraded!, 'student:ada')
    // It completed under the only authority that build had.
    expect(record?.state).toBe('completed')
    expect(record?.completion.status).toBe('CERTIFIED')
    expect(record?.completion.authority).toBe('LEARNER_AUTHORITY')
    // And unfinished version 1 work upgrades without being called complete.
    expect(recordFor(upgraded!, 'student:bo')?.completion.status).toBe('NOT_COMPLETE')
    expect(recordFor(upgraded!, 'student:bo')?.state).toBe('active')
  })

  it('refuses a version 2 record whose completion block was deleted', () => {
    // The version bump also stops the write that produces this payload: a
    // version 1 build reading version 2 state hits its own
    // 'schema-version-ahead' guard, reports read-only and declines to write,
    // so it can no longer strip the block and complete the work on a click.
    // Without the version bump this payload is indistinguishable from the
    // legitimate legacy record above, and deleting one key would be enough to
    // certify guardian work — every check in parseCompletion sits on the other
    // side of that branch.
    const raw = serialized(recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1))
    const students = raw.students as { assignments: Record<string, unknown>[] }[]
    delete students[0].assignments[0].completion
    students[0].assignments[0].state = 'completed'
    students[0].assignments[0].completedAt = T2
    expect(raw.schemaVersion).toBe(2)
    expect(parseFamilyPilotState(raw)?.students[0].assignments).toHaveLength(0)
  })

})

describe('parent-facing completion status', () => {
  it('reports what is waiting on the adult, and what the adult certified', () => {
    const pending = recordFamilyPilotLearnerCompletion(
      household(), 'student:ada', ASSIGNMENT, 'GUARDIAN_ATTESTATION_REQUIRED', T1)
    const waiting = projectFamilyPilotParentProgress(pending, 'student:ada')
    expect(waiting?.pendingAttestationCount).toBe(1)
    expect(waiting?.completedCount).toBe(0)
    const item = waiting?.assignments[0]
    expect(item?.completionStatus).toBe('PENDING_GUARDIAN_ATTESTATION')
    expect(item?.completionAuthority).toBe('GUARDIAN_ATTESTATION_REQUIRED')
    expect(item?.awaitingAdultAttestation).toBe(true)
    expect(item?.learnerAssertedAt).toBe(T1)

    const certified = projectFamilyPilotParentProgress(attestFamilyPilotCompletion(pending, {
      studentRef: 'student:ada', assignmentRef: ASSIGNMENT, lessonRef: LESSON,
      attestedByRef: 'family-pilot-parent', evidenceMode: 'simulated-alternative',
    }, T2), 'student:ada')
    expect(certified?.pendingAttestationCount).toBe(0)
    expect(certified?.completedCount).toBe(1)
    expect(certified?.assignments[0].completionStatus).toBe('CERTIFIED')
    expect(certified?.assignments[0].attestedAt).toBe(T2)
    expect(certified?.assignments[0].evidenceMode).toBe('simulated-alternative')
  })
})
