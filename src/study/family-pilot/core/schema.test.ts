import { describe, expect, it } from 'vitest'
import {
  FAMILY_PILOT_SCHEMA_VERSION,
  emptyFamilyPilotState,
  parseFamilyPilotAssignment,
  parseFamilyPilotState,
  upgradeFamilyPilotState,
} from './schema'
import { addFamilyPilotAssignment, createFamilyPilotStudent } from './operations'

const NOW = '2026-08-12T09:00:00.000Z'

function populated() {
  let state = emptyFamilyPilotState(NOW)
  state = createFamilyPilotStudent(state, { studentRef: 'student:a', displayName: 'Ada' }, NOW)
  return addFamilyPilotAssignment(state, 'student:a', {
    assignmentRef: 'assignment:1',
    lessonRef: 'lesson:fractions',
    subject: 'Math',
    title: 'Equivalent fractions',
    totalSegments: 4,
  }, NOW)
}

describe('family pilot state parsing', () => {
  it('round-trips a real state through JSON', () => {
    const state = populated()
    expect(parseFamilyPilotState(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })

  it.each([
    null, undefined, 0, '', 'null', [], { schemaVersion: 1 },
    { schemaVersion: 0, updatedAt: NOW, activeStudentRef: null, students: [] },
    { schemaVersion: 1, updatedAt: 'not-a-date', activeStudentRef: null, students: [] },
    { schemaVersion: 1, updatedAt: NOW, activeStudentRef: null, students: {} },
  ])('rejects malformed input %s without throwing', (value) => {
    expect(parseFamilyPilotState(value)).toBeNull()
  })

  it('drops one unreadable assignment rather than the whole student', () => {
    const state = JSON.parse(JSON.stringify(populated()))
    state.students[0].assignments.push({ assignmentRef: 'broken' })
    const parsed = parseFamilyPilotState(state)
    expect(parsed?.students).toHaveLength(1)
    expect(parsed?.students[0]?.assignments).toHaveLength(1)
  })

  it('keeps only the first record for a duplicated studentRef', () => {
    const state = JSON.parse(JSON.stringify(populated()))
    state.students.push({ ...state.students[0], displayName: 'Impostor' })
    const parsed = parseFamilyPilotState(state)
    expect(parsed?.students).toHaveLength(1)
    expect(parsed?.students[0]?.displayName).toBe('Ada')
  })

  it('nulls an activeStudentRef that points at nobody', () => {
    const state = { ...JSON.parse(JSON.stringify(populated())), activeStudentRef: 'student:ghost' }
    expect(parseFamilyPilotState(state)?.activeStudentRef).toBeNull()
  })

  it('refuses a stored assignment that claims to carry learner prose', () => {
    const assignment = JSON.parse(JSON.stringify(populated().students[0]!.assignments[0]!))
    expect(parseFamilyPilotAssignment(assignment)).not.toBeNull()
    expect(parseFamilyPilotAssignment({ ...assignment, rawAnswerIncluded: true })).toBeNull()
    expect(parseFamilyPilotAssignment({ ...assignment, transcriptIncluded: true })).toBeNull()
  })
})

describe('family pilot schema upgrades', () => {
  it('reports a current state as current', () => {
    const outcome = upgradeFamilyPilotState(JSON.parse(JSON.stringify(populated())))
    expect(outcome.status).toBe('current')
  })

  it('distinguishes a future schema from an unreadable one', () => {
    // A newer build's state must be identifiable so the caller can decline to
    // overwrite it, rather than being lumped in with ordinary corruption.
    expect(upgradeFamilyPilotState({
      schemaVersion: FAMILY_PILOT_SCHEMA_VERSION + 1, updatedAt: NOW, students: [],
    })).toEqual({ status: 'unreadable', reasonCode: 'schema-version-ahead' })
    expect(upgradeFamilyPilotState('garbage')).toEqual({
      status: 'unreadable', reasonCode: 'schema-unreadable',
    })
  })
})
