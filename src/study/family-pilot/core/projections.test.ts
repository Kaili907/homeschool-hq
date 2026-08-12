import { describe, expect, it } from 'vitest'
import { emptyFamilyPilotState, type FamilyPilotStateV1 } from './schema'
import {
  addFamilyPilotAssignment,
  completeFamilyPilotAssignment,
  createFamilyPilotStudent,
  pauseFamilyPilotAssignment,
  recordFamilyPilotProgress,
  setActiveFamilyPilotStudent,
  startFamilyPilotAssignment,
} from './operations'
import { projectFamilyPilotDiagnostics, projectFamilyPilotParentProgress } from './projections'

const T0 = '2026-08-12T09:00:00.000Z'
const T1 = '2026-08-12T09:30:00.000Z'

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
    lessonRef: 'lesson:reading',
    subject: 'Reading',
    title: 'Chapter 3',
    totalSegments: 2,
  }, T0)
}

describe('parent-visible progress', () => {
  it('derives percent complete from recorded segments', () => {
    let state = household()
    state = recordFamilyPilotProgress(
      state, 'student:ada', 'assignment:ada-1', { segmentRef: 'segment:1', activeSeconds: 60 }, T1,
    )
    const view = projectFamilyPilotParentProgress(state, 'student:ada')
    expect(view?.assignments[0]?.completedSegments).toBe(1)
    expect(view?.assignments[0]?.totalSegments).toBe(4)
    expect(view?.assignments[0]?.percentComplete).toBe(25)
    expect(view?.assignments[0]?.activeSeconds).toBe(60)
  })

  it('reports only the addressed student', () => {
    const view = projectFamilyPilotParentProgress(household(), 'student:ada')
    expect(view?.displayName).toBe('Ada')
    expect(view?.assignments.map((item) => item.assignmentRef)).toEqual(['assignment:ada-1'])
  })

  it('returns null for an unknown or absent student', () => {
    expect(projectFamilyPilotParentProgress(household(), 'student:ghost')).toBeNull()
    expect(projectFamilyPilotParentProgress(household(), null)).toBeNull()
  })

  it('counts finished and in-progress work', () => {
    let state = startFamilyPilotAssignment(
      household(), 'student:ada', 'assignment:ada-1', 'session:1', T0,
    )
    let view = projectFamilyPilotParentProgress(state, 'student:ada')
    expect(view?.inProgressCount).toBe(1)
    expect(view?.completedCount).toBe(0)

    state = completeFamilyPilotAssignment(state, 'student:ada', 'assignment:ada-1', T1)
    view = projectFamilyPilotParentProgress(state, 'student:ada')
    expect(view?.completedCount).toBe(1)
    expect(view?.inProgressCount).toBe(0)
    expect(view?.assignments[0]?.completedAt).toBe(T1)
  })

  it('reports zero percent rather than dividing by an unknown segment count', () => {
    let state = emptyFamilyPilotState(T0)
    state = createFamilyPilotStudent(state, { studentRef: 'student:ada', displayName: 'Ada' }, T0)
    state = addFamilyPilotAssignment(state, 'student:ada', {
      assignmentRef: 'assignment:x',
      lessonRef: 'lesson:x',
      subject: 'Math',
      title: 'Unscoped work',
      totalSegments: 0,
    }, T0)
    expect(projectFamilyPilotParentProgress(state, 'student:ada')?.assignments[0]?.percentComplete)
      .toBe(0)
  })

  it('exposes the resume point a paused learner returns to', () => {
    let state = startFamilyPilotAssignment(
      household(), 'student:ada', 'assignment:ada-1', 'session:1', T0,
    )
    state = recordFamilyPilotProgress(
      state, 'student:ada', 'assignment:ada-1', { segmentRef: 'segment:2' }, T0,
    )
    state = pauseFamilyPilotAssignment(state, 'student:ada', 'assignment:ada-1', T1)
    const view = projectFamilyPilotParentProgress(state, 'student:ada')
    expect(view?.assignments[0]?.state).toBe('paused')
    expect(view?.assignments[0]?.resumeSegmentRef).toBe('segment:2')
  })
})

describe('pilot diagnostics', () => {
  it('identifies the active student, lesson and session', () => {
    let state = setActiveFamilyPilotStudent(household(), 'student:bo')
    state = startFamilyPilotAssignment(
      state, 'student:bo', 'assignment:bo-1', 'session:bo-42', T0,
    )
    const view = projectFamilyPilotDiagnostics({ status: 'ready', state, reasonCode: null })
    expect(view.activeStudentRef).toBe('student:bo')
    expect(view.activeStudentName).toBe('Bo')
    expect(view.activeAssignmentRef).toBe('assignment:bo-1')
    expect(view.activeLessonRef).toBe('lesson:reading')
    expect(view.activeSessionRef).toBe('session:bo-42')
    expect(view.activeAssignmentState).toBe('active')
    expect(view.studentCount).toBe(2)
  })

  it('reports an idle pilot without inventing an active session', () => {
    const view = projectFamilyPilotDiagnostics({
      status: 'ready', state: emptyFamilyPilotState(T0), reasonCode: null,
    })
    expect(view.activeStudentRef).toBeNull()
    expect(view.activeSessionRef).toBeNull()
    expect(view.studentCount).toBe(0)
  })

  it('surfaces the storage status and reason code', () => {
    const view = projectFamilyPilotDiagnostics({
      status: 'recovered', state: emptyFamilyPilotState(T0), reasonCode: 'schema-unreadable',
    })
    expect(view.storageStatus).toBe('recovered')
    expect(view.reasonCode).toBe('schema-unreadable')
  })

  it('exposes no learner-answer or transcript field', () => {
    // The diagnostics panel renders every key it is given, so the projection's
    // key set is the actual privacy boundary for that surface.
    let state = setActiveFamilyPilotStudent(household(), 'student:ada')
    state = startFamilyPilotAssignment(state, 'student:ada', 'assignment:ada-1', 'session:1', T0)
    const view = projectFamilyPilotDiagnostics({ status: 'ready', state, reasonCode: null })
    const serialized = JSON.stringify(view).toLowerCase()
    for (const forbidden of ['rawanswer', 'transcript', 'answertext', 'responsetext', 'draft']) {
      expect(serialized).not.toContain(forbidden)
    }
  })
})
