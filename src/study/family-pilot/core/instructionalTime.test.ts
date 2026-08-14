import { describe, expect, it } from 'vitest'
import {
  addFamilyPilotAssignment,
  completeFamilyPilotAssignment,
  createFamilyPilotStudent,
  emptyFamilyPilotState,
  FAMILY_PILOT_MAX_CONFIRMED_ACTIVE_INTERVAL_SECONDS,
  hideFamilyPilotInstructionalSession,
  parseFamilyPilotState,
  pauseFamilyPilotAssignment,
  recordFamilyPilotInstructionalHeartbeat,
  resumeFamilyPilotAssignment,
  showFamilyPilotInstructionalSession,
  startFamilyPilotAssignment,
  type FamilyPilotStateV1,
} from './index'

const T0 = '2026-08-14T12:00:00.000Z'

function seeded(): FamilyPilotStateV1 {
  let state = emptyFamilyPilotState(T0)
  for (const studentRef of ['student:ada', 'student:bea']) {
    state = createFamilyPilotStudent(state, { studentRef, displayName: studentRef }, T0)
    state = addFamilyPilotAssignment(state, studentRef, {
      assignmentRef: `assignment:${studentRef}`,
      lessonRef: `lesson:${studentRef}`,
      subject: 'mathematics',
      title: 'Factual lesson',
      totalSegments: 2,
    }, T0)
  }
  return state
}

function assignment(state: FamilyPilotStateV1, studentRef = 'student:ada') {
  return state.students.find((item) => item.studentRef === studentRef)!.assignments[0]!
}

describe('minimized instructional session timing', () => {
  it('records start, bounded visible heartbeats, pause, resume, and end without an event log', () => {
    let state = startFamilyPilotAssignment(seeded(), 'student:ada', 'assignment:student:ada', 'session:ada', T0)
    state = recordFamilyPilotInstructionalHeartbeat(state, 'student:ada', 'assignment:student:ada', '2026-08-14T12:01:00.000Z')
    state = pauseFamilyPilotAssignment(state, 'student:ada', 'assignment:student:ada', '2026-08-14T12:01:30.000Z')
    expect(assignment(state)).toMatchObject({
      instructionalSession: { sessionRef: 'session:ada', startedAt: T0, activeSince: null, inactiveAt: '2026-08-14T12:01:30.000Z', endedAt: null, state: 'paused' },
      progress: { activeSeconds: 90, activeSecondsByDate: [{ date: '2026-08-14', activeSeconds: 90 }] },
    })

    state = resumeFamilyPilotAssignment(state, 'student:ada', 'assignment:student:ada', 'session:ada', '2026-08-14T12:10:00.000Z')
    state = completeFamilyPilotAssignment(state, 'student:ada', 'assignment:student:ada', '2026-08-14T12:11:00.000Z')
    expect(assignment(state)).toMatchObject({
      state: 'completed',
      instructionalSession: { activeSince: null, inactiveAt: '2026-08-14T12:11:00.000Z', endedAt: '2026-08-14T12:11:00.000Z', state: 'ended' },
      progress: { activeSeconds: 150, activeSecondsByDate: [{ date: '2026-08-14', activeSeconds: 150 }] },
    })
  })

  it('stops while hidden, resumes explicitly, and caps an unconfirmed wall-clock gap', () => {
    let state = startFamilyPilotAssignment(seeded(), 'student:ada', 'assignment:student:ada', 'session:ada', T0)
    state = hideFamilyPilotInstructionalSession(state, 'student:ada', 'assignment:student:ada', '2026-08-14T12:00:30.000Z')
    state = recordFamilyPilotInstructionalHeartbeat(state, 'student:ada', 'assignment:student:ada', '2026-08-14T13:00:00.000Z')
    expect(assignment(state).progress.activeSeconds).toBe(30)

    state = showFamilyPilotInstructionalSession(state, 'student:ada', 'assignment:student:ada', '2026-08-14T13:00:00.000Z')
    state = recordFamilyPilotInstructionalHeartbeat(state, 'student:ada', 'assignment:student:ada', '2026-08-14T15:00:00.000Z')
    expect(assignment(state).progress.activeSeconds).toBe(30 + FAMILY_PILOT_MAX_CONFIRMED_ACTIVE_INTERVAL_SECONDS)
  })

  it('splits a confirmed interval across UTC reporting days', () => {
    let state = startFamilyPilotAssignment(
      seeded(), 'student:ada', 'assignment:student:ada', 'session:ada', '2026-08-14T23:59:30.000Z',
    )
    state = recordFamilyPilotInstructionalHeartbeat(
      state, 'student:ada', 'assignment:student:ada', '2026-08-15T00:00:30.000Z',
    )
    expect(assignment(state).progress.activeSecondsByDate).toEqual([
      { date: '2026-08-14', activeSeconds: 30 },
      { date: '2026-08-15', activeSeconds: 30 },
    ])
  })

  it('begins minimized timing when an older active v1 assignment is reopened', () => {
    let state = startFamilyPilotAssignment(seeded(), 'student:ada', 'assignment:student:ada', 'session:ada', T0)
    state = {
      ...state,
      students: state.students.map((held) => held.studentRef !== 'student:ada' ? held : {
        ...held,
        assignments: held.assignments.map(({ instructionalSession: _omitted, ...legacy }) => ({
          ...legacy,
          progress: { ...legacy.progress, activeSecondsByDate: undefined },
        })),
      }),
    }
    state = showFamilyPilotInstructionalSession(state, 'student:ada', 'assignment:student:ada', '2026-08-14T13:00:00.000Z')
    expect(assignment(state).instructionalSession).toEqual({
      sessionRef: 'session:ada', startedAt: '2026-08-14T13:00:00.000Z', activeSince: '2026-08-14T13:00:00.000Z', inactiveAt: null, endedAt: null, state: 'active',
    })
    expect(assignment(state).progress.activeSecondsByDate).toEqual([])
  })

  it('mutates only the exact student even when sibling assignment shapes match', () => {
    const before = seeded()
    const siblingBefore = assignment(before, 'student:bea')
    let state = startFamilyPilotAssignment(before, 'student:ada', 'assignment:student:ada', 'session:ada', T0)
    state = recordFamilyPilotInstructionalHeartbeat(state, 'student:ada', 'assignment:student:ada', '2026-08-14T12:01:00.000Z')
    expect(assignment(state, 'student:bea')).toBe(siblingBefore)
    expect(assignment(state, 'student:bea').progress.activeSeconds).toBe(0)
  })

  it('round-trips only aggregate lifecycle and day totals and discards unrelated extra fields', () => {
    let state = startFamilyPilotAssignment(seeded(), 'student:ada', 'assignment:student:ada', 'session:ada', T0)
    state = recordFamilyPilotInstructionalHeartbeat(state, 'student:ada', 'assignment:student:ada', '2026-08-14T12:01:00.000Z')
    const stored = JSON.parse(JSON.stringify(state))
    stored.students[0].assignments[0].keystrokes = ['x']
    stored.students[0].assignments[0].transcript = 'not allowed'
    const parsed = parseFamilyPilotState(stored)
    expect(parsed).not.toBeNull()
    expect(parsed).toEqual(state)
    expect(JSON.stringify(parsed)).not.toContain('keystrokes')
    expect(JSON.stringify(parsed)).not.toContain('not allowed')
  })
})
