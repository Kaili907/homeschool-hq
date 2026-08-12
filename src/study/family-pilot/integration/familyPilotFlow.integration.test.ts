import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import type { StudyPortBundle } from '../../ports'
import { FAMILY_PILOT_STATE_KEY, loadFamilyPilotState } from '../core'
import { FamilyPilotController } from './controller'
import { assignmentRefFor, hostLessonCurriculumPort } from './curriculum'
import { fromStudentSelector, toStudentSelector } from './identity'
import type { FamilyPilotSafetyPort } from './safety'

// FAMILY-PILOT-INTEGRATION: the required pilot user flow, end to end.
//
// These tests drive the real Core store, the real Study runtime and the real
// Tutor bridge — only the clock, the storage and the student ref generator are
// injected, so a pass here means the composed pilot works, not that a set of
// mocks agree with each other.

function memoryStorage(): Storage & { readonly map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    get length() { return map.size },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => { map.clear() },
  } as Storage & { readonly map: Map<string, string> }
}

interface Harness {
  readonly storage: Storage
  readonly ports: StudyPortBundle
  controller: FamilyPilotController
  readonly rebuild: (safety?: FamilyPilotSafetyPort) => FamilyPilotController
}

function harness(): Harness {
  const storage = memoryStorage()
  // A fixed clock keeps the derived blockRef (which embeds the learner's local
  // date) stable across a runtime recreation inside one test. The ports get the
  // same clock: the calendar runtime rejects events that predate the block's
  // own creation stamp, so a real-time port clock and a fixed runtime clock
  // would make every start look out of order.
  const now = () => new Date('2026-03-04T15:00:00.000Z')
  const ports = createLocalDevelopmentStudyPorts({ now }).ports
  let counter = 0
  const build = (safety?: FamilyPilotSafetyPort) => new FamilyPilotController({
    ports,
    curriculum: hostLessonCurriculumPort(2),
    store: { storage, now: () => now().toISOString() },
    safety,
    now,
    householdTimeZone: 'UTC',
    defaultGrade: '5',
    newStudentRef: () => `student:fixed-${(counter += 1)}`,
  })
  const state: Harness = {
    storage,
    ports,
    controller: build(),
    rebuild: (safety?: FamilyPilotSafetyPort) => {
      state.controller = build(safety)
      return state.controller
    },
  }
  return state
}

function firstAssignmentRef(controller: FamilyPilotController, ref: string): string {
  const assignments = controller.assignmentsFor(ref)
  expect(assignments.length).toBeGreaterThan(0)
  return assignments[0].assignmentRef
}

describe('family pilot integrated flow', () => {
  it('signs student A in and lists their assignments', () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const profiles = pilot.controller.studentProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].displayName).toBe('Ada')

    // The login surface hands back a selector; the pilot must resolve it to the
    // exact ref Core persisted.
    const studentRef = fromStudentSelector(profiles[0].studentRef)
    expect(toStudentSelector(studentRef)).toEqual(profiles[0].studentRef)

    pilot.controller.selectStudent(studentRef)
    pilot.controller.ensureAssignments(studentRef)
    const assignments = pilot.controller.assignmentsFor(studentRef)
    expect(assignments).toHaveLength(2)
    expect(assignments[0].status).toBe('NOT_STARTED')
    // Real step titles are available before Study ever starts.
    expect(assignments[0].segments.length).toBeGreaterThan(0)
  })

  it('seeds assignments idempotently', () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.ensureAssignments(ref)
    pilot.controller.ensureAssignments(ref)
    pilot.controller.ensureAssignments(ref)
    expect(pilot.controller.assignmentsFor(ref)).toHaveLength(2)
  })

  it('starts Study and records the session against the student', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.selectStudent(ref)
    pilot.controller.ensureAssignments(ref)
    const assignmentRef = firstAssignmentRef(pilot.controller, ref)

    const started = await pilot.controller.start(ref, assignmentRef)
    expect(started.status).toBe('ok')
    if (started.status !== 'ok' || !started.study) throw new Error('expected a Study snapshot')
    expect(started.study.session.learnerRef).toBe(ref)
    expect(started.study.segmentOrdinal).toBe(1)

    const record = started.snapshot.state.students[0].assignments
      .find((item) => item.assignmentRef === assignmentRef)
    expect(record?.state).toBe('active')
    expect(record?.sessionRef).toBe(started.study.session.blockRef)
    expect(started.snapshot.state.students[0].activeAssignmentRef).toBe(assignmentRef)
  })

  it('checkpoints, survives a shell/runtime recreation, and resumes to the exact position', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.selectStudent(ref)
    pilot.controller.ensureAssignments(ref)
    const assignmentRef = firstAssignmentRef(pilot.controller, ref)

    await pilot.controller.start(ref, assignmentRef)
    // Advance one step so the resume position is a real position, not step one.
    const advanced = await pilot.controller.completeSegment(ref, assignmentRef)
    expect(advanced.status).toBe('ok')
    const checkpointed = await pilot.controller.checkpoint(ref, assignmentRef)
    expect(checkpointed.status).toBe('ok')
    if (checkpointed.status !== 'ok' || !checkpointed.study) throw new Error('expected a Study snapshot')
    const expectedSegment = checkpointed.study.segmentRef
    const expectedCompleted = [...checkpointed.study.completedSegmentRefs]
    const expectedRevision = checkpointed.study.checkpointRevision
    expect(expectedSegment).not.toBeNull()

    const paused = await pilot.controller.pause(ref, assignmentRef)
    expect(paused.status).toBe('ok')

    // Throw the shell and the runtime away. Only persisted pilot state and the
    // Study ports survive — exactly what a remount leaves behind.
    const rebuilt = pilot.rebuild()
    const reloaded = loadFamilyPilotState({ storage: pilot.storage })
    expect(reloaded.state.activeStudentRef).toBe(ref)
    expect(
      reloaded.state.students[0].assignments.find((item) => item.assignmentRef === assignmentRef)?.state,
    ).toBe('paused')

    const resumed = await rebuilt.resume(ref, assignmentRef)
    expect(resumed.status).toBe('ok')
    if (resumed.status !== 'ok' || !resumed.study) throw new Error('expected a Study snapshot')
    expect(resumed.study.segmentRef).toBe(expectedSegment)
    expect([...resumed.study.completedSegmentRefs]).toEqual(expectedCompleted)
    expect(resumed.study.checkpointRevision).toBeGreaterThanOrEqual(expectedRevision)
    expect(resumed.study.assignmentState).toBe('active')
    expect(
      resumed.snapshot.state.students[0].assignments.find((item) => item.assignmentRef === assignmentRef)?.state,
    ).toBe('active')
  })

  it('does not count the step in progress as finished when a place is saved', async () => {
    // "Save my place" happens WHILE a step is open. Recording that step as
    // finished would both over-report progress to a parent and, after a
    // restart, replay past a step the learner never did.
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.selectStudent(ref)
    pilot.controller.ensureAssignments(ref)
    const assignmentRef = firstAssignmentRef(pilot.controller, ref)

    const started = await pilot.controller.start(ref, assignmentRef)
    if (started.status !== 'ok' || !started.study) throw new Error('expected a Study snapshot')
    expect(started.study.segmentOrdinal).toBe(1)

    const saved = await pilot.controller.checkpoint(ref, assignmentRef)
    expect(saved.status).toBe('ok')
    if (saved.status !== 'ok' || !saved.study) throw new Error('expected a Study snapshot')

    // Still on step one, and nothing is claimed as finished.
    expect(saved.study.segmentOrdinal).toBe(1)
    const record = saved.snapshot.state.students[0].assignments
      .find((item) => item.assignmentRef === assignmentRef)
    expect(record?.progress.completedSegmentRefs).toHaveLength(0)
    expect(pilot.controller.parentProgress(ref)?.assignments
      .find((item) => item.assignmentRef === assignmentRef)?.percentComplete).toBe(0)
  })

  it('returns to the unfinished step after a restart that followed a saved place', async () => {
    const storage = memoryStorage()
    const now = () => new Date('2026-03-04T15:00:00.000Z')
    const build = () => new FamilyPilotController({
      ports: createLocalDevelopmentStudyPorts({ now }).ports,
      curriculum: hostLessonCurriculumPort(2),
      store: { storage, now: () => now().toISOString() },
      now,
      householdTimeZone: 'UTC',
      defaultGrade: '5',
      newStudentRef: () => 'student:saved-1',
    })
    const before = build()
    before.createStudent('Ada')
    const ref = before.snapshot().state.students[0].studentRef
    before.selectStudent(ref)
    before.ensureAssignments(ref)
    const assignmentRef = firstAssignmentRef(before, ref)
    await before.start(ref, assignmentRef)
    await before.checkpoint(ref, assignmentRef)

    // The learner saved their place on step one without finishing it, so the
    // restart must hand step one back — not step two.
    const resumed = await build().resume(ref, assignmentRef)
    expect(resumed.status).toBe('ok')
    if (resumed.status !== 'ok' || !resumed.study) throw new Error('expected a Study snapshot')
    expect(resumed.study.segmentOrdinal).toBe(1)
  })

  it('rebuilds the lesson position after a device restart loses the Study ports', async () => {
    // Closing the browser empties the in-memory Study ports but leaves Core's
    // record in storage. The learner must not be handed step one again.
    const storage = memoryStorage()
    const now = () => new Date('2026-03-04T15:00:00.000Z')
    const build = () => new FamilyPilotController({
      // Deliberately FRESH ports each time — this is the restart.
      ports: createLocalDevelopmentStudyPorts({ now }).ports,
      curriculum: hostLessonCurriculumPort(2),
      store: { storage, now: () => now().toISOString() },
      now,
      householdTimeZone: 'UTC',
      defaultGrade: '5',
      newStudentRef: () => 'student:restart-1',
    })

    const before = build()
    before.createStudent('Ada')
    const ref = before.snapshot().state.students[0].studentRef
    before.selectStudent(ref)
    before.ensureAssignments(ref)
    const assignmentRef = firstAssignmentRef(before, ref)
    await before.start(ref, assignmentRef)
    await before.completeSegment(ref, assignmentRef)
    await before.completeSegment(ref, assignmentRef)
    const finished = before.snapshot().state.students[0].assignments
      .find((item) => item.assignmentRef === assignmentRef)?.progress.completedSegmentRefs ?? []
    expect(finished).toHaveLength(2)

    const after = build()
    // Core survived the restart.
    expect(after.snapshot().state.activeStudentRef).toBe(ref)

    const resumed = await after.resume(ref, assignmentRef)
    expect(resumed.status).toBe('ok')
    if (resumed.status !== 'ok' || !resumed.study) throw new Error('expected a Study snapshot')
    // Back at step three, not step one: the two finished steps were replayed.
    expect(resumed.study.segmentOrdinal).toBe(3)
    expect([...resumed.study.completedSegmentRefs]).toEqual([...finished])
    expect(resumed.study.assignmentState).toBe('active')
  })

  it('offers Tutor help and the fallback path does not end the lesson', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.selectStudent(ref)
    pilot.controller.ensureAssignments(ref)
    const assignmentRef = firstAssignmentRef(pilot.controller, ref)
    await pilot.controller.start(ref, assignmentRef)

    // No single answer-checked problem is active, so the bridge must fall back
    // rather than fail.
    const step = pilot.controller.help(ref, assignmentRef)
    expect(step).not.toBeNull()
    expect(step?.session.path).toBe('static-fallback')
    expect(step?.presentation.visibleText.length ?? 0).toBeGreaterThan(0)

    // The lesson is untouched by the help excursion.
    const after = await pilot.controller.checkpoint(ref, assignmentRef)
    expect(after.status).toBe('ok')
    if (after.status !== 'ok' || !after.study) throw new Error('expected a Study snapshot')
    expect(after.study.assignmentState).toBe('active')
  })

  it('reports parent progress for the current student', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.selectStudent(ref)
    pilot.controller.ensureAssignments(ref)
    const assignmentRef = firstAssignmentRef(pilot.controller, ref)
    await pilot.controller.start(ref, assignmentRef)
    await pilot.controller.completeSegment(ref, assignmentRef)

    const progress = pilot.controller.parentProgress(ref)
    expect(progress?.displayName).toBe('Ada')
    expect(progress?.inProgressCount).toBe(1)
    const item = progress?.assignments.find((entry) => entry.assignmentRef === assignmentRef)
    expect(item?.state).toBe('active')
    expect(item?.percentComplete).toBeGreaterThan(0)
  })

  it('completes an assignment only once Study agrees the work is finished', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.selectStudent(ref)
    pilot.controller.ensureAssignments(ref)
    const assignmentRef = firstAssignmentRef(pilot.controller, ref)
    const started = await pilot.controller.start(ref, assignmentRef)
    if (started.status !== 'ok' || !started.study) throw new Error('expected a Study snapshot')

    // Refused while work remains, and Core is left untouched by the refusal.
    const premature = await pilot.controller.complete(ref, assignmentRef)
    expect(premature.status).toBe('rejected')
    expect(
      premature.snapshot.state.students[0].assignments
        .find((item) => item.assignmentRef === assignmentRef)?.state,
    ).toBe('active')

    const total = started.study.remainingSegmentRefs.length
    for (let index = 0; index < total; index += 1) {
      const done = await pilot.controller.completeSegment(ref, assignmentRef)
      expect(done.status).toBe('ok')
    }

    const completed = await pilot.controller.complete(ref, assignmentRef)
    expect(completed.status).toBe('ok')
    const record = completed.snapshot.state.students[0].assignments
      .find((item) => item.assignmentRef === assignmentRef)
    expect(record?.state).toBe('completed')
    expect(record?.completedAt).not.toBeNull()
    expect(pilot.controller.assignmentsFor(ref)[0].status).toBe('COMPLETED')
    expect(pilot.controller.parentProgress(ref)?.completedCount).toBe(1)
  })

  it('switches from student A to student B without carrying any state across', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    pilot.controller.createStudent('Bo')
    const [adaRef, boRef] = pilot.controller.snapshot().state.students.map((s) => s.studentRef)
    expect(adaRef).not.toBe(boRef)

    pilot.controller.selectStudent(adaRef)
    pilot.controller.ensureAssignments(adaRef)
    const adaAssignment = firstAssignmentRef(pilot.controller, adaRef)
    await pilot.controller.start(adaRef, adaAssignment)
    await pilot.controller.completeSegment(adaRef, adaAssignment)

    pilot.controller.selectStudent(boRef)
    pilot.controller.ensureAssignments(boRef)
    expect(pilot.controller.snapshot().state.activeStudentRef).toBe(boRef)

    // Bo's list is his own: same lessons, none of Ada's progress.
    const boAssignments = pilot.controller.assignmentsFor(boRef)
    expect(boAssignments).toHaveLength(2)
    expect(boAssignments.every((item) => item.status === 'NOT_STARTED')).toBe(true)
    expect(boAssignments.every((item) => (item.completedSegmentRefs ?? []).length === 0)).toBe(true)

    const boProgress = pilot.controller.parentProgress(boRef)
    expect(boProgress?.displayName).toBe('Bo')
    expect(boProgress?.inProgressCount).toBe(0)
    expect(boProgress?.assignments.every((item) => item.percentComplete === 0)).toBe(true)

    // Ada's own record is untouched by Bo's activity.
    const adaProgress = pilot.controller.parentProgress(adaRef)
    expect(adaProgress?.displayName).toBe('Ada')
    expect(adaProgress?.inProgressCount).toBe(1)

    // Persisted state keeps the two apart on disk as well as in memory.
    const persisted = JSON.parse(pilot.storage.getItem(FAMILY_PILOT_STATE_KEY) ?? '{}')
    const boRecord = persisted.students.find((s: { studentRef: string }) => s.studentRef === boRef)
    expect(boRecord.assignments.every((a: { sessionRef: string | null }) => a.sessionRef === null)).toBe(true)
  })

  it('gives two students separate Study sessions for the same lesson', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    pilot.controller.createStudent('Bo')
    const [adaRef, boRef] = pilot.controller.snapshot().state.students.map((s) => s.studentRef)
    pilot.controller.ensureAssignments(adaRef)
    pilot.controller.ensureAssignments(boRef)

    // Assignment refs are derived from the LESSON, so both learners carry the
    // same ref for the same lesson. That is safe precisely because every Core
    // operation is scoped to a studentRef first, and it is the case most likely
    // to blend two children's work, so it is asserted rather than assumed.
    const shared = firstAssignmentRef(pilot.controller, adaRef)
    expect(firstAssignmentRef(pilot.controller, boRef)).toBe(shared)

    const adaStarted = await pilot.controller.start(adaRef, shared)
    if (adaStarted.status !== 'ok' || !adaStarted.study) throw new Error('expected a Study snapshot')
    await pilot.controller.completeSegment(adaRef, shared)

    const boStarted = await pilot.controller.start(boRef, shared)
    if (boStarted.status !== 'ok' || !boStarted.study) throw new Error('expected a Study snapshot')

    // Separate learners, separate blocks, separate sessions.
    expect(adaStarted.study.session.learnerRef).toBe(adaRef)
    expect(boStarted.study.session.learnerRef).toBe(boRef)
    expect(boStarted.study.session.blockRef).not.toBe(adaStarted.study.session.blockRef)
    expect(boStarted.study.session.sessionRef).not.toBe(adaStarted.study.session.sessionRef)

    // Bo starts at step one even though Ada already advanced past it.
    expect(boStarted.study.segmentOrdinal).toBe(1)
    expect(boStarted.study.completedSegmentRefs).toHaveLength(0)

    const students = pilot.controller.snapshot().state.students
    const adaRecord = students.find((s) => s.studentRef === adaRef)?.assignments
      .find((a) => a.assignmentRef === shared)
    const boRecord = students.find((s) => s.studentRef === boRef)?.assignments
      .find((a) => a.assignmentRef === shared)
    expect(adaRecord?.sessionRef).not.toBe(boRecord?.sessionRef)
    expect(adaRecord?.progress.completedSegmentRefs.length).toBe(1)
    expect(boRecord?.progress.completedSegmentRefs.length).toBe(0)
  })

  it('refuses an assignment the named student does not have', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const adaRef = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.ensureAssignments(adaRef)
    const known = firstAssignmentRef(pilot.controller, adaRef)

    const unknownStudent = await pilot.controller.start('student:not-set-up', known)
    expect(unknownStudent.status).toBe('rejected')
    if (unknownStudent.status !== 'rejected') throw new Error('expected a refusal')
    expect(unknownStudent.reason).toBe('unknown-student')

    const unknownAssignment = await pilot.controller.start(adaRef, 'assignment:not-mine')
    expect(unknownAssignment.status).toBe('rejected')
    if (unknownAssignment.status !== 'rejected') throw new Error('expected a refusal')
    expect(unknownAssignment.reason).toBe('unknown-assignment')
  })

  it('runs with no safety port installed, and honours one when present', async () => {
    const pilot = harness()
    pilot.controller.createStudent('Ada')
    const ref = pilot.controller.snapshot().state.students[0].studentRef
    pilot.controller.ensureAssignments(ref)
    const assignmentRef = firstAssignmentRef(pilot.controller, ref)

    // C1 ships without the safety branch: the flow must still run.
    expect((await pilot.controller.start(ref, assignmentRef)).status).toBe('ok')

    const refusing = pilot.rebuild({
      checkStudyEntry: () => ({ allowed: false, reasonCode: 'pilot-hold', studentMessage: 'Please get an adult.' }),
    })
    const refused = await refusing.resume(ref, assignmentRef)
    expect(refused.status).toBe('rejected')
    if (refused.status !== 'rejected') throw new Error('expected a refusal')
    expect(refused.reason).toBe('pilot-hold')

    // A safety port that throws must not take the lesson down with it.
    const throwing = pilot.rebuild({
      checkStudyEntry: () => { throw new Error('safety unavailable') },
    })
    expect((await throwing.resume(ref, assignmentRef)).status).toBe('ok')
  })
})
