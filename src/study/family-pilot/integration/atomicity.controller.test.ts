import { describe, expect, it } from 'vitest'
import type { FetchLike, TutorApiDeps } from '../../../tutor/tutorApi'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import type { StudyPortBundle } from '../../ports'
import type { StudyScope } from '../../types'
import type { FamilyPilotHelpSession, FamilyPilotTutorDeps } from '../tutor'
import { FamilyPilotController } from './controller'
import { hostLessonCurriculumPort } from './curriculum'
import { learnerScopeFor } from './identity'
import { FamilyPilotSafetyHoldBridge } from './safetyHolds'

// SAFETY-ATOMICITY-H1
//
// Independently confirmed defect: a Family Pilot safety hold (or a Tutor turn
// still being classified) blocks start/resume/help entry, but NOT an
// already-open session's pause / checkpoint / completeSegment / complete, and
// a pending Tutor classification races Study mutations rather than blocking
// them. These tests are written FIRST and drive the REAL controller, REAL
// Core store and REAL Study runtime — exactly the composition
// IntegratedPilotSurface.tsx wires — with only clock/storage/curriculum
// injected, so a pass here means the fix is real, not that mocks agree with
// mocks.

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

/**
 * A deterministic, controllable stand-in for the network gateway call inside
 * askTutor(). No real model/provider is ever reached: `started` resolves the
 * instant the "request" is made, and the caller controls exactly when (and
 * with what text) it settles via `release`. This is the same deferred-promise
 * technique src/study/mountedOutputSafety.integration.test.tsx already uses
 * to prove a "still pending" state deterministically.
 */
function deferredFetch(): {
  readonly fetchImpl: FetchLike
  readonly started: Promise<void>
  readonly release: (text: string) => void
} {
  let markStarted!: () => void
  const started = new Promise<void>((resolve) => { markStarted = resolve })
  let release!: (text: string) => void
  const gate = new Promise<string>((resolve) => { release = resolve })
  const fetchImpl: FetchLike = async () => {
    markStarted()
    const text = await gate
    return { ok: true, status: 200, json: async () => ({ text }) }
  }
  return { fetchImpl, started, release }
}

function deferredApiDeps(): ReturnType<typeof deferredFetch> & { readonly apiDeps: TutorApiDeps } {
  const gate = deferredFetch()
  const apiDeps: TutorApiDeps = {
    getAccessToken: async () => 'test-access-token',
    isOnline: () => true,
    fetchImpl: gate.fetchImpl,
    createOperationId: () => 'atomicity-test-op',
  }
  return { ...gate, apiDeps }
}

function harness(tutorDeps?: FamilyPilotTutorDeps) {
  const now = () => new Date('2026-03-04T15:00:00.000Z')
  const coreStore = { storage: memoryStorage(), now: () => now().toISOString() }
  const { ports: localPorts } = createLocalDevelopmentStudyPorts({ now })
  const ports: StudyPortBundle = { ...localPorts }
  const bridge = new FamilyPilotSafetyHoldBridge({ coreStore, storage: memoryStorage(), now: () => now().toISOString() })
  let counter = 0
  const controller = new FamilyPilotController({
    ports,
    curriculum: hostLessonCurriculumPort(1),
    store: coreStore,
    safety: bridge.port,
    safetySignals: bridge,
    tutorDeps,
    now,
    householdTimeZone: 'UTC',
    defaultGrade: '5',
    newStudentRef: () => `student:fixed-${(counter += 1)}`,
  })
  return { controller, bridge, now }
}

/** A tutor-core-eligible help session, hand-built and scoped to a real Study session's sessionRef. */
function tutorCoreSession(ref: string, sessionRef: string): FamilyPilotHelpSession {
  const scope: StudyScope = { ...learnerScopeFor(ref), sessionRef }
  return {
    scope,
    context: {
      scope,
      subject: 'math',
      grade: 5,
      noAudio: false,
      mediaAvailable: true,
      problem: { prompt: '2 + 2 = ?', correctAnswer: '4', studentAnswer: '' },
    },
    path: 'tutor-core',
    eligibilityReason: 'test seam: forced tutor-core eligibility',
    studentTurns: 0,
    flaggedForAdult: false,
    redactionOccurred: false,
    closed: false,
    transcript: [],
  }
}

describe('Family Pilot safety atomicity — existing hold blocks every mutating action (Invariant 1)', () => {
  it('a Tutor-created hold refuses pause/checkpoint/completeSegment/complete with zero state change, and lifts once resolved', async () => {
    const { controller, bridge } = harness()
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0]!.studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)
    const assignmentRef = controller.assignmentsFor(ref)[0]!.assignmentRef

    const started = await controller.start(ref, assignmentRef)
    if (started.status !== 'ok') throw new Error('expected an ok start')

    const help = controller.help(ref, assignmentRef)
    if (!help) throw new Error('expected a help step')
    const turn = await controller.helpTurn(help.session, 'I want to hurt myself')
    expect(turn.session.flaggedForAdult).toBe(true)
    expect(bridge.openHoldsFor(ref)).toHaveLength(1)

    const before = controller.snapshot()

    const pauseResult = await controller.pause(ref, assignmentRef)
    expect(pauseResult.status).toBe('rejected')

    const checkpointResult = await controller.checkpoint(ref, assignmentRef)
    expect(checkpointResult.status).toBe('rejected')

    const completeSegmentResult = await controller.completeSegment(ref, assignmentRef)
    expect(completeSegmentResult.status).toBe('rejected')

    const completeResult = await controller.complete(ref, assignmentRef)
    expect(completeResult.status).toBe('rejected')

    // None of the four refusals touched Core state.
    expect(controller.snapshot()).toEqual(before)

    const [hold] = bridge.openHoldsFor(ref)
    const outcome = bridge.resolveHold(hold!.holdRef, 'family-pilot-parent')
    expect(outcome.ok).toBe(true)

    const afterResolve = await controller.checkpoint(ref, assignmentRef)
    expect(afterResolve.status).toBe('ok')
  })
})

describe('Family Pilot safety atomicity — a pending Tutor classification blocks same-session Study mutations (Invariant 2)', () => {
  it('mutations refuse while a CLEAR-bound turn is still in flight, and proceed once it settles', async () => {
    const gate = deferredApiDeps()
    const { controller } = harness({ apiDeps: gate.apiDeps })
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0]!.studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)
    const assignmentRef = controller.assignmentsFor(ref)[0]!.assignmentRef

    const started = await controller.start(ref, assignmentRef)
    if (started.status !== 'ok' || !started.study) throw new Error('expected an ok start')

    const session = tutorCoreSession(ref, started.study.session.sessionRef)
    const pending = controller.helpTurn(session, 'I do not understand this problem')
    let settled = false
    void pending.finally(() => { settled = true })

    // Deterministic proof we are genuinely mid-flight: the fetch call has
    // started, but nothing has resolved it yet.
    await gate.started
    expect(settled).toBe(false)

    const duringPause = await controller.pause(ref, assignmentRef)
    expect(duringPause.status).toBe('rejected')
    expect(settled).toBe(false)

    const duringCheckpoint = await controller.checkpoint(ref, assignmentRef)
    expect(duringCheckpoint.status).toBe('rejected')

    const duringCompleteSegment = await controller.completeSegment(ref, assignmentRef)
    expect(duringCompleteSegment.status).toBe('rejected')

    gate.release('Try counting on your fingers first.')
    const finalStep = await pending
    expect(finalStep.session.flaggedForAdult).toBe(false)
    expect(settled).toBe(true)

    const afterClear = await controller.checkpoint(ref, assignmentRef)
    expect(afterClear.status).toBe('ok')
  })

  it('a CONCERNING turn keeps mutations blocked through classification and the resulting hold — no gap in between', async () => {
    const { controller, bridge } = harness()
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0]!.studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)
    const assignmentRef = controller.assignmentsFor(ref)[0]!.assignmentRef

    const started = await controller.start(ref, assignmentRef)
    if (started.status !== 'ok') throw new Error('expected an ok start')
    const help = controller.help(ref, assignmentRef)
    if (!help) throw new Error('expected a help step')

    // Fired without awaiting: JS run-to-completion guarantees the guard added
    // synchronously at the top of helpTurn() is still set when these
    // same-tick mutation attempts make their own synchronous entry checks —
    // no event-loop turn happens in between.
    const pending = controller.helpTurn(help.session, 'I want to hurt myself')
    const duringPause = controller.pause(ref, assignmentRef)
    const duringCheckpoint = controller.checkpoint(ref, assignmentRef)

    const [pauseResult, checkpointResult, turn] = await Promise.all([duringPause, duringCheckpoint, pending])
    expect(pauseResult.status).toBe('rejected')
    expect(checkpointResult.status).toBe('rejected')
    expect(turn.session.flaggedForAdult).toBe(true)

    expect(bridge.openHoldsFor(ref)).toHaveLength(1)
    const afterSettle = await controller.pause(ref, assignmentRef)
    expect(afterSettle.status).toBe('rejected')
  })

  it('an errored/degraded turn releases the pending lock instead of deadlocking the learner', async () => {
    const failingApiDeps: TutorApiDeps = {
      getAccessToken: async () => null, // askTutor resolves { ok: false, reason: 'unauthenticated' }
      isOnline: () => true,
      fetchImpl: async () => { throw new Error('must not be called') },
    }
    const { controller } = harness({ apiDeps: failingApiDeps })
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0]!.studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)
    const assignmentRef = controller.assignmentsFor(ref)[0]!.assignmentRef
    const started = await controller.start(ref, assignmentRef)
    if (started.status !== 'ok' || !started.study) throw new Error('expected an ok start')

    const session = tutorCoreSession(ref, started.study.session.sessionRef)
    const settledStep = await controller.helpTurn(session, 'I do not understand this problem')
    expect(settledStep.session.path).toBe('static-fallback')
    expect(settledStep.session.flaggedForAdult).toBe(false)

    const after = await controller.checkpoint(ref, assignmentRef)
    expect(after.status).toBe('ok')
  })
})

describe('Family Pilot safety atomicity — learner isolation (Invariant 3)', () => {
  it('a pending classification for learner A never blocks learner B', async () => {
    const gate = deferredApiDeps()
    const { controller } = harness({ apiDeps: gate.apiDeps })
    controller.createStudent('Ada')
    controller.createStudent('Bo')
    const [adaRef, boRef] = controller.snapshot().state.students.map((student) => student.studentRef)

    controller.selectStudent(adaRef)
    controller.ensureAssignments(adaRef)
    const adaAssignment = controller.assignmentsFor(adaRef)[0]!.assignmentRef
    const adaStarted = await controller.start(adaRef, adaAssignment)
    if (adaStarted.status !== 'ok' || !adaStarted.study) throw new Error('expected an ok start')

    controller.selectStudent(boRef)
    controller.ensureAssignments(boRef)
    const boAssignment = controller.assignmentsFor(boRef)[0]!.assignmentRef
    const boStarted = await controller.start(boRef, boAssignment)
    if (boStarted.status !== 'ok') throw new Error('expected an ok start')

    const session = tutorCoreSession(adaRef, adaStarted.study.session.sessionRef)
    const pending = controller.helpTurn(session, 'I do not understand this problem')
    await gate.started

    const boPause = await controller.pause(boRef, boAssignment)
    expect(boPause.status).toBe('ok')

    const adaDuring = await controller.pause(adaRef, adaAssignment)
    expect(adaDuring.status).toBe('rejected')

    gate.release('Take it one step at a time.')
    await pending
  })
})
