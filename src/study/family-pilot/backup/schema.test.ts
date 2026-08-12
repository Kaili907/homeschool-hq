import { describe, expect, it } from 'vitest'
import { emptyFamilyPilotState } from '../core/schema'
import {
  addFamilyPilotAssignment,
  completeFamilyPilotAssignment,
  createFamilyPilotStudent,
  recordFamilyPilotProgress,
  startFamilyPilotAssignment,
} from '../core/operations'
import {
  FAMILY_PILOT_BACKUP_SCHEMA_VERSION,
  backupSummary,
  exportFamilyPilotBackup,
  parseFamilyPilotBackup,
  restoreFamilyPilotBackup,
  serializeFamilyPilotBackup,
  validateFamilyPilotBackup,
} from './schema'

const NOW = '2026-08-12T09:00:00.000Z'
const LATER = '2026-08-12T09:30:00.000Z'

function twoStudentState() {
  let state = emptyFamilyPilotState(NOW)
  state = createFamilyPilotStudent(state, { studentRef: 'student:a', displayName: 'Alex' }, NOW)
  state = createFamilyPilotStudent(state, { studentRef: 'student:b', displayName: 'Alex' }, NOW)
  state = addFamilyPilotAssignment(state, 'student:a', {
    assignmentRef: 'assignment:1',
    lessonRef: 'lesson:fractions',
    subject: 'Math',
    title: 'Equivalent fractions',
    totalSegments: 4,
  }, NOW)
  state = addFamilyPilotAssignment(state, 'student:b', {
    assignmentRef: 'assignment:2',
    lessonRef: 'lesson:reading',
    subject: 'Reading',
    title: 'Chapter 3',
    totalSegments: 2,
  }, NOW)
  state = startFamilyPilotAssignment(state, 'student:a', 'assignment:1', 'session:1', NOW)
  state = recordFamilyPilotProgress(state, 'student:a', 'assignment:1', {
    segmentRef: 'segment:1', activeSeconds: 120,
  }, LATER)
  state = completeFamilyPilotAssignment(state, 'student:b', 'assignment:2', LATER)
  return state
}

function roundTrip(state: ReturnType<typeof emptyFamilyPilotState>) {
  const backup = exportFamilyPilotBackup(state, LATER)
  const serialized = serializeFamilyPilotBackup(backup)
  const restored = restoreFamilyPilotBackup(emptyFamilyPilotState(NOW), serialized)
  return { backup, serialized, restored }
}

describe('family pilot backup export/restore', () => {
  it('round-trips an empty state', () => {
    const { restored } = roundTrip(emptyFamilyPilotState(NOW))
    expect(restored.status).toBe('restored')
    expect(restored.status === 'restored' && restored.state.students).toEqual([])
  })

  it('round-trips two students', () => {
    const { restored } = roundTrip(twoStudentState())
    expect(restored.status).toBe('restored')
    const state = restored.status === 'restored' ? restored.state : null
    expect(state?.students).toHaveLength(2)
  })

  it('preserves assignment progress', () => {
    const { restored } = roundTrip(twoStudentState())
    const assignment = restored.status === 'restored'
      ? restored.state.students.find((s) => s.studentRef === 'student:a')?.assignments[0]
      : undefined
    expect(assignment?.progress.completedSegmentRefs).toEqual(['segment:1'])
    expect(assignment?.progress.activeSeconds).toBe(120)
  })

  it('preserves the active assignment', () => {
    const { restored } = roundTrip(twoStudentState())
    const student = restored.status === 'restored'
      ? restored.state.students.find((s) => s.studentRef === 'student:a')
      : undefined
    expect(student?.activeAssignmentRef).toBe('assignment:1')
    expect(student?.assignments[0]?.state).toBe('active')
  })

  it('preserves session metadata', () => {
    const { restored } = roundTrip(twoStudentState())
    const assignment = restored.status === 'restored'
      ? restored.state.students.find((s) => s.studentRef === 'student:a')?.assignments[0]
      : undefined
    expect(assignment?.sessionRef).toBe('session:1')
  })

  it('preserves completed work', () => {
    const { restored } = roundTrip(twoStudentState())
    const assignment = restored.status === 'restored'
      ? restored.state.students.find((s) => s.studentRef === 'student:b')?.assignments[0]
      : undefined
    expect(assignment?.state).toBe('completed')
    expect(assignment?.completedAt).toBe(LATER)
  })

  it('rejects malformed JSON without throwing', () => {
    const outcome = restoreFamilyPilotBackup(emptyFamilyPilotState(NOW), '{not json')
    expect(outcome.status).toBe('rejected')
    expect(outcome.status === 'rejected' && outcome.reasonCode).toBe('malformed-json')
  })

  it.each([null, undefined, 0, '', [], { foo: 'bar' }])(
    'rejects malformed/wrong-shape input %s without throwing',
    (value) => {
      expect(validateFamilyPilotBackup(value).status).toBe('invalid')
    },
  )

  it('rejects a future backup schema version', () => {
    const outcome = validateFamilyPilotBackup({
      backupSchemaVersion: FAMILY_PILOT_BACKUP_SCHEMA_VERSION + 1,
      createdAt: NOW,
      familyPilotState: emptyFamilyPilotState(NOW),
    })
    expect(outcome.status).toBe('invalid')
    expect(outcome.status === 'invalid' && outcome.reasonCode).toBe('backup-version-ahead')
  })

  it('rejects a future family pilot state schema version', () => {
    const outcome = validateFamilyPilotBackup({
      backupSchemaVersion: FAMILY_PILOT_BACKUP_SCHEMA_VERSION,
      createdAt: NOW,
      familyPilotState: { ...emptyFamilyPilotState(NOW), schemaVersion: 999 },
    })
    expect(outcome.status).toBe('invalid')
    expect(outcome.status === 'invalid' && outcome.reasonCode).toBe('state-schema-version-ahead')
  })

  it('drops invalid student refs and invalid assignment/progress state rather than restoring them', () => {
    // student:ghost has a malformed ref (fails the shared identifier pattern) and
    // student:a carries one assignment with out-of-range progress. Neither may
    // survive into the restored state, but the rest of the backup still restores
    // — the same "one bad record costs only itself" contract src/study/family-pilot/core/schema.ts
    // already guarantees for ordinary local reads.
    const state = JSON.parse(JSON.stringify(twoStudentState()))
    state.students[0].assignments[0].progress.totalSegments = -1
    state.students.push({
      studentRef: 'not a valid ref!!',
      displayName: 'Ghost',
      createdAt: NOW,
      updatedAt: NOW,
      activeAssignmentRef: null,
      assignments: [],
    })
    const outcome = restoreFamilyPilotBackup(emptyFamilyPilotState(NOW), {
      backupSchemaVersion: FAMILY_PILOT_BACKUP_SCHEMA_VERSION,
      createdAt: NOW,
      familyPilotState: state,
    })
    expect(outcome.status).toBe('restored')
    const students = outcome.status === 'restored' ? outcome.state.students : []
    expect(students.map((s) => s.studentRef)).toEqual(['student:a', 'student:b'])
    expect(students.find((s) => s.studentRef === 'student:a')?.assignments).toEqual([])
  })

  it('leaves the original state completely unchanged on a rejected restore', () => {
    const original = twoStudentState()
    const outcome = restoreFamilyPilotBackup(original, '{not json')
    expect(outcome.status).toBe('rejected')
    // Reference equality: not a structurally-equal copy, the SAME object.
    expect(outcome.status === 'rejected' && outcome.state).toBe(original)
  })

  it('never carries raw-answer or transcript fields in the serialized backup', () => {
    const backup = exportFamilyPilotBackup(twoStudentState(), LATER)
    const serialized = serializeFamilyPilotBackup(backup)
    expect(serialized).not.toMatch(/rawAnswer(?!Included)/)
    expect(serialized).not.toMatch(/transcript(?!Included)/i)
    expect(serialized).toContain('"rawAnswerIncluded":false')
    expect(serialized).toContain('"transcriptIncluded":false')
  })

  it('keeps same-named students separated by studentRef through restore', () => {
    const { restored } = roundTrip(twoStudentState())
    const state = restored.status === 'restored' ? restored.state : null
    expect(state?.students.map((s) => s.displayName)).toEqual(['Alex', 'Alex'])
    expect(new Set(state?.students.map((s) => s.studentRef)).size).toBe(2)
    const alexA = state?.students.find((s) => s.studentRef === 'student:a')
    const alexB = state?.students.find((s) => s.studentRef === 'student:b')
    expect(alexA?.assignments[0]?.assignmentRef).toBe('assignment:1')
    expect(alexB?.assignments[0]?.assignmentRef).toBe('assignment:2')
  })

  it('serializes deterministically regardless of property construction order', () => {
    const backup = exportFamilyPilotBackup(twoStudentState(), LATER)
    const reordered = {
      familyPilotState: backup.familyPilotState,
      createdAt: backup.createdAt,
      backupSchemaVersion: backup.backupSchemaVersion,
    }
    expect(serializeFamilyPilotBackup(backup)).toBe(serializeFamilyPilotBackup(reordered as typeof backup))
  })

  it('parseFamilyPilotBackup accepts a valid already-parsed backup', () => {
    const backup = exportFamilyPilotBackup(twoStudentState(), LATER)
    const parsed = parseFamilyPilotBackup(JSON.parse(serializeFamilyPilotBackup(backup)))
    expect(parsed).toEqual(backup)
  })

  it('summarizes a backup', () => {
    const backup = exportFamilyPilotBackup(twoStudentState(), LATER)
    expect(backupSummary(backup)).toEqual({
      createdAt: LATER,
      studentCount: 2,
      assignmentCount: 2,
      completedAssignmentCount: 1,
      activeAssignmentCount: 1,
    })
  })
})
