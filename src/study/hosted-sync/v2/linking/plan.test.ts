import { describe, expect, it } from 'vitest'
import { buildFirstLinkPlan } from './plan'
import type {
  FirstLinkInspection,
  LocalHouseholdForLink,
  LocalStudentForLink,
  RemoteStudentSummary,
} from './types'

const FUTURE = '2099-01-01T00:00:00.000Z'

function localStudent(ref: string, displayName = 'Ada'): LocalStudentForLink {
  return {
    localStudentRef: ref,
    displayName,
    identity: { kind: 'legacy-profile-id', value: ref },
    assignments: [{
      kind: 'lesson', localAssignmentRef: `assignment:${ref}`, contentRef: 'lesson:math',
      title: 'Math', subject: 'math', state: 'active', completedAt: null,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z',
      progress: { completedSegmentRefs: ['segment:1'], totalSegments: 2, lastSegmentRef: 'segment:2', activeSeconds: 45 },
    }],
    studyDocument: {
      localDocumentRef: `document:${ref}`, updatedAt: '2026-08-02T00:00:00.000Z', sessions: [{
        localSessionRef: `session:${ref}`, localAssignmentRef: `assignment:${ref}`,
        blockRef: `block:${ref}`, lessonRef: 'lesson:math', status: 'active', segmentRef: 'segment:2',
        updatedAt: '2026-08-02T00:00:00.000Z', lastAcceptedEventRef: null, checkpoint: null,
      }],
    },
    sources: [], attestations: [], safetyHolds: [],
  }
}

function local(...students: LocalStudentForLink[]): LocalHouseholdForLink {
  return { localHouseholdRef: 'household:local', capturedAt: '2026-08-02T00:00:00.000Z', students }
}

function remote(ref: string, identities: RemoteStudentSummary['identities'] = []): RemoteStudentSummary {
  return { remoteStudentRef: ref, displayName: 'Ada', identities, assignments: [], sessions: [] }
}

function inspection(...students: RemoteStudentSummary[]): FirstLinkInspection {
  return {
    authority: {
      status: 'authenticated-parent-household-authority', authorityRef: 'authority:server',
      remoteHouseholdRef: 'household:remote', expiresAt: FUTURE,
    },
    serverBaseRevision: 7,
    remoteStudents: students,
  }
}

describe('deterministic first-link plan', () => {
  it('never treats an equal display name as identity proof', () => {
    const plan = buildFirstLinkPlan(local(localStudent('student:local', 'Same Name')), inspection(remote('student:remote')))
    expect(plan.students[0]).toMatchObject({
      state: 'EXPLICIT_MAP_REQUIRED',
      remoteStudentRef: null,
      candidateRemoteStudentRefs: ['student:remote'],
      reasonCode: 'no-stable-identity-match',
    })
    expect(plan.readyForParentConfirmation).toBe(false)
  })

  it('requires a Parent choice for ambiguity, then preserves both IDs in an exact mapping', () => {
    const before = buildFirstLinkPlan(local(localStudent('student:local')), inspection(remote('student:remote')))
    expect(before.students[0]?.state).toBe('EXPLICIT_MAP_REQUIRED')

    const after = buildFirstLinkPlan(
      local(localStudent('student:local')),
      inspection(remote('student:remote')),
      [{ localStudentRef: 'student:local', remoteStudentRef: 'student:remote' }],
    )
    expect(after.students[0]).toMatchObject({
      state: 'EXACT_MATCH', localStudentRef: 'student:local', remoteStudentRef: 'student:remote',
    })
    expect(after.students[0]?.assignments[0]?.state).toBe('NEW_REMOTE_ASSIGNMENT')
    expect(after.readyForParentConfirmation).toBe(true)
  })

  it('allows the Parent to explicitly create a new student without silently claiming a remote one', () => {
    const plan = buildFirstLinkPlan(
      local(localStudent('student:local')),
      inspection(remote('student:remote')),
      [{ localStudentRef: 'student:local', remoteStudentRef: null }],
    )
    expect(plan.students[0]).toMatchObject({ state: 'NEW_REMOTE_STUDENT', remoteStudentRef: null })
  })

  it('recognizes exact stable student, assignment, and session origins', () => {
    const student = localStudent('student:local')
    const exactRemote: RemoteStudentSummary = {
      ...remote('student:remote', [student.identity]),
      assignments: [{
        remoteAssignmentRef: 'assignment:remote', kind: 'lesson', contentRef: 'lesson:math',
        originLocalAssignmentRef: 'assignment:student:local', revision: 3,
      }],
      sessions: [{
        remoteSessionRef: 'session:remote', remoteAssignmentRef: 'assignment:remote',
        lessonRef: 'lesson:math', originLocalSessionRef: 'session:student:local', revision: 4,
      }],
    }
    const plan = buildFirstLinkPlan(local(student), inspection(exactRemote))
    expect(plan.students[0]).toMatchObject({ state: 'EXACT_MATCH', remoteStudentRef: 'student:remote' })
    expect(plan.students[0]?.assignments[0]).toMatchObject({ state: 'EXACT_MATCH', remoteAssignmentRef: 'assignment:remote' })
    expect(plan.students[0]?.sessions[0]).toMatchObject({ state: 'EXACT_MATCH', remoteSessionRef: 'session:remote' })
  })

  it('blocks rather than overwriting a same-content remote assignment without origin proof', () => {
    const student = localStudent('student:local')
    const conflicting: RemoteStudentSummary = {
      ...remote('student:remote', [student.identity]),
      assignments: [{
        remoteAssignmentRef: 'assignment:unrelated', kind: 'lesson', contentRef: 'lesson:math',
        originLocalAssignmentRef: null, revision: 9,
      }],
    }
    const plan = buildFirstLinkPlan(local(student), inspection(conflicting))
    expect(plan.students[0]).toMatchObject({ state: 'CONFLICT', reasonCode: 'remote-state-conflict' })
    expect(plan.students[0]?.assignments[0]).toMatchObject({
      state: 'CONFLICT', reasonCode: 'remote-assignment-same-content-without-origin-proof',
    })
    expect(plan.readyForParentConfirmation).toBe(false)
  })

  it('blocks two local students from mapping to one remote student', () => {
    const plan = buildFirstLinkPlan(
      local(localStudent('student:a'), localStudent('student:b')),
      inspection(remote('student:remote')),
      [
        { localStudentRef: 'student:a', remoteStudentRef: 'student:remote' },
        { localStudentRef: 'student:b', remoteStudentRef: 'student:remote' },
      ],
    )
    expect(plan.students.map((item) => item.state)).toEqual(['CONFLICT', 'CONFLICT'])
    expect(plan.students.every((item) => item.reasonCode === 'remote-student-selected-more-than-once')).toBe(true)
  })
})
