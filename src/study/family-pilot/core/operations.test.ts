import { describe, expect, it } from 'vitest'
import { emptyFamilyPilotState, type FamilyPilotStateV1 } from './schema'
import {
  abandonFamilyPilotAssignment,
  addFamilyPilotAssignment,
  completeFamilyPilotAssignment,
  createFamilyPilotStudent,
  findFamilyPilotStudent,
  pauseFamilyPilotAssignment,
  recordFamilyPilotProgress,
  removeFamilyPilotStudent,
  resumeFamilyPilotAssignment,
  setActiveFamilyPilotStudent,
  startFamilyPilotAssignment,
} from './operations'

const T0 = '2026-08-12T09:00:00.000Z'
const T1 = '2026-08-12T09:30:00.000Z'
const T2 = '2026-08-12T10:00:00.000Z'

/** Two learners on one device, each with one assignment. */
function household(): FamilyPilotStateV1 {
  let state = emptyFamilyPilotState(T0)
  state = createFamilyPilotStudent(state, { studentRef: 'student:ada', displayName: 'Ada' }, T0)
  state = createFamilyPilotStudent(state, { studentRef: 'student:bo', displayName: 'Bo' }, T0)
  state = addFamilyPilotAssignment(state, 'student:ada', {
    assignmentRef: 'assignment:ada-1',
    lessonRef: 'lesson:fractions',
    subject: 'Math',
    title: 'Equivalent fractions',
    totalSegments: 4,
  }, T0)
  return addFamilyPilotAssignment(state, 'student:bo', {
    assignmentRef: 'assignment:bo-1',
    lessonRef: 'lesson:fractions',
    subject: 'Math',
    title: 'Equivalent fractions',
    totalSegments: 4,
  }, T0)
}

function assignment(state: FamilyPilotStateV1, studentRef: string, assignmentRef: string) {
  return findFamilyPilotStudent(state, studentRef)
    ?.assignments.find((item) => item.assignmentRef === assignmentRef) ?? null
}

describe('family pilot student separation', () => {
  // The central pilot guarantee: two children share one browser profile and one
  // storage key, so every mutation must be provably confined to one studentRef.
  it('confines a progress write to the addressed student', () => {
    const before = household()
    const after = recordFamilyPilotProgress(
      before, 'student:ada', 'assignment:ada-1', { segmentRef: 'segment:1' }, T1,
    )
    expect(assignment(after, 'student:ada', 'assignment:ada-1')?.progress.completedSegmentRefs)
      .toEqual(['segment:1'])
    // Bo's identically-named lesson and segment must be untouched...
    expect(assignment(after, 'student:bo', 'assignment:bo-1')?.progress.completedSegmentRefs)
      .toEqual([])
    // ...and returned by reference, proving nothing rewrote the sibling record.
    expect(findFamilyPilotStudent(after, 'student:bo'))
      .toBe(findFamilyPilotStudent(before, 'student:bo'))
  })

  it('confines session, pause and completion writes to the addressed student', () => {
    const before = household()
    let after = startFamilyPilotAssignment(
      before, 'student:ada', 'assignment:ada-1', 'session:ada', T1,
    )
    after = pauseFamilyPilotAssignment(after, 'student:ada', 'assignment:ada-1', T1)
    after = completeFamilyPilotAssignment(after, 'student:ada', 'assignment:ada-1', T2)
    const bo = assignment(after, 'student:bo', 'assignment:bo-1')
    expect(bo?.state).toBe('planned')
    expect(bo?.sessionRef).toBeNull()
    expect(bo?.completedAt).toBeNull()
    expect(findFamilyPilotStudent(after, 'student:bo'))
      .toBe(findFamilyPilotStudent(before, 'student:bo'))
  })

  it('treats an unknown studentRef as a no-op, never a write to the first student', () => {
    const before = household()
    const after = recordFamilyPilotProgress(
      before, 'student:nobody', 'assignment:ada-1', { segmentRef: 'segment:9' }, T1,
    )
    expect(after).toBe(before)
  })

  it('will not reach a sibling assignment through the wrong student', () => {
    const before = household()
    // Bo's assignment ref addressed under Ada's studentRef must change nothing.
    const after = startFamilyPilotAssignment(
      before, 'student:ada', 'assignment:bo-1', 'session:x', T1,
    )
    expect(assignment(after, 'student:bo', 'assignment:bo-1')?.state).toBe('planned')
    expect(assignment(after, 'student:ada', 'assignment:ada-1')?.state).toBe('planned')
  })

  it('removes only the named student and clears a dangling active pointer', () => {
    let state = setActiveFamilyPilotStudent(household(), 'student:ada')
    state = removeFamilyPilotStudent(state, 'student:ada')
    expect(state.students.map((item) => item.studentRef)).toEqual(['student:bo'])
    expect(state.activeStudentRef).toBeNull()
  })

  it('refuses to select a student who does not exist', () => {
    const before = household()
    expect(setActiveFamilyPilotStudent(before, 'student:ghost')).toBe(before)
  })

  it('does not reset an existing student when created again', () => {
    const before = recordFamilyPilotProgress(
      household(), 'student:ada', 'assignment:ada-1', { segmentRef: 'segment:1' }, T1,
    )
    const after = createFamilyPilotStudent(
      before, { studentRef: 'student:ada', displayName: 'Ada' }, T2,
    )
    expect(after).toBe(before)
  })
})

describe('family pilot pause, resume and completion', () => {
  it('accumulates paused time across a pause/resume cycle', () => {
    let state = startFamilyPilotAssignment(
      household(), 'student:ada', 'assignment:ada-1', 'session:1', T0,
    )
    state = recordFamilyPilotProgress(
      state, 'student:ada', 'assignment:ada-1', { segmentRef: 'segment:1' }, T0,
    )
    state = pauseFamilyPilotAssignment(state, 'student:ada', 'assignment:ada-1', T1)
    const paused = assignment(state, 'student:ada', 'assignment:ada-1')
    expect(paused?.state).toBe('paused')
    // Resume returns to the last segment actually worked on.
    expect(paused?.pause.resumeSegmentRef).toBe('segment:1')

    state = resumeFamilyPilotAssignment(
      state, 'student:ada', 'assignment:ada-1', 'session:2', T2,
    )
    const resumed = assignment(state, 'student:ada', 'assignment:ada-1')
    expect(resumed?.state).toBe('active')
    expect(resumed?.sessionRef).toBe('session:2')
    expect(resumed?.pause.pausedSeconds).toBe(1800)
    expect(resumed?.pause.pausedAt).toBeNull()
  })

  it('never contributes negative paused time when the clock moves backwards', () => {
    let state = startFamilyPilotAssignment(
      household(), 'student:ada', 'assignment:ada-1', 'session:1', T2,
    )
    state = pauseFamilyPilotAssignment(state, 'student:ada', 'assignment:ada-1', T2)
    state = resumeFamilyPilotAssignment(
      state, 'student:ada', 'assignment:ada-1', 'session:2', T0,
    )
    expect(assignment(state, 'student:ada', 'assignment:ada-1')?.pause.pausedSeconds).toBe(0)
  })

  it('counts a repeated segment once', () => {
    let state = household()
    for (const at of [T0, T1, T2]) {
      state = recordFamilyPilotProgress(
        state, 'student:ada', 'assignment:ada-1', { segmentRef: 'segment:1', activeSeconds: 10 }, at,
      )
    }
    const record = assignment(state, 'student:ada', 'assignment:ada-1')
    expect(record?.progress.completedSegmentRefs).toEqual(['segment:1'])
    expect(record?.progress.activeSeconds).toBe(30)
  })

  it('keeps the first completion timestamp and clears the active pointer', () => {
    let state = startFamilyPilotAssignment(
      household(), 'student:ada', 'assignment:ada-1', 'session:1', T0,
    )
    expect(findFamilyPilotStudent(state, 'student:ada')?.activeAssignmentRef)
      .toBe('assignment:ada-1')
    state = completeFamilyPilotAssignment(state, 'student:ada', 'assignment:ada-1', T1)
    state = completeFamilyPilotAssignment(state, 'student:ada', 'assignment:ada-1', T2)
    const record = assignment(state, 'student:ada', 'assignment:ada-1')
    expect(record?.completedAt).toBe(T1)
    expect(record?.sessionRef).toBeNull()
    expect(findFamilyPilotStudent(state, 'student:ada')?.activeAssignmentRef).toBeNull()
  })

  it('refuses to restart or re-progress completed work', () => {
    let state = completeFamilyPilotAssignment(
      household(), 'student:ada', 'assignment:ada-1', T1,
    )
    state = startFamilyPilotAssignment(
      state, 'student:ada', 'assignment:ada-1', 'session:2', T2,
    )
    state = recordFamilyPilotProgress(
      state, 'student:ada', 'assignment:ada-1', { segmentRef: 'segment:9' }, T2,
    )
    const record = assignment(state, 'student:ada', 'assignment:ada-1')
    expect(record?.state).toBe('completed')
    expect(record?.progress.completedSegmentRefs).toEqual([])
  })

  it('does not abandon completed work', () => {
    const state = abandonFamilyPilotAssignment(
      completeFamilyPilotAssignment(household(), 'student:ada', 'assignment:ada-1', T1),
      'student:ada', 'assignment:ada-1', T2,
    )
    expect(assignment(state, 'student:ada', 'assignment:ada-1')?.state).toBe('completed')
  })

  it('only pauses work that is actually active', () => {
    const before = household()
    expect(pauseFamilyPilotAssignment(before, 'student:ada', 'assignment:ada-1', T1))
      .toBe(before)
  })
})
