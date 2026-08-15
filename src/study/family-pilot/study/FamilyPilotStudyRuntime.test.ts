import { describe, expect, it, vi } from 'vitest'
import { AdaptiveTutorEngine, type TutorResponse } from '../../../../adaptive-tutor/core/index.ts'
import { syntheticGrade5StudyContext } from '../../demonstrations'
import type { HostLessonDescriptor } from '../../curriculumAdapter'
import { StudyLifecycleBoundary } from '../../lifecycle'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../../ports'
import { SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext } from '../../types'
import { FamilyPilotStudyRuntime } from './FamilyPilotStudyRuntime'
import type { FamilyPilotStudySession } from './types'

const RAW_ANSWER_CANARY = 'PILOT-RAW-STUDENT-ANSWER-CANARY'

function safetyPort(outcome: 'clear' | 'urgent' = 'clear'): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'family-pilot-test-safety-v1',
    evaluate: async () => outcome === 'clear'
      ? { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
      : { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' },
  }
}

/**
 * One household device: a single durable store plus a `reload()` that builds a
 * brand-new runtime over it, which is exactly what a browser refresh does.
 */
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

function pilotDevice(options: { readonly safety?: 'clear' | 'urgent' } = {}) {
  let tick = 0
  const now = () => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000))
  const { ports: localPorts, services } = createLocalDevelopmentStudyPorts({ now })
  const ports: StudyPortBundle = { ...localPorts, safety: safetyPort(options.safety ?? 'clear') }
  const lifecycle = new StudyLifecycleBoundary()
  // Node has no localStorage; the durable stop ledger gets an in-memory shim
  // that survives a reload exactly as browser storage would.
  const safetyStopStorage = memoryStorage()
  return {
    ports,
    services,
    lifecycle,
    safetyStopStorage,
    reload: () => new FamilyPilotStudyRuntime({ ports, now, lifecycle, safetyStopStorage }),
  }
}

function studentContext(id: string): HostStudyLaunchContext {
  return { ...syntheticGrade5StudyContext('math'), learnerRef: `learner:pilot-${id}`, hostProfileRef: `pilot-${id}` }
}

function mathLesson(id: string): HostLessonDescriptor {
  return {
    lessonRef: `pilot:grade5:math:${id}`,
    title: 'Grade 5 math study block',
    kind: 'math',
    skillRefs: ['pilot:grade5:math:multiplication'],
  }
}

function parentActivity(id: string): HostLessonDescriptor {
  return {
    lessonRef: `pilot:parent-activity:${id}`,
    title: 'Nature walk observation log',
    kind: 'parent-created',
    skillRefs: ['pilot:parent:observation'],
  }
}

/** The handle survives a reload only as JSON, so it is round-tripped as JSON. */
function storedHandle(session: FamilyPilotStudySession): FamilyPilotStudySession {
  return JSON.parse(JSON.stringify(session)) as FamilyPilotStudySession
}

async function startMath(device: ReturnType<typeof pilotDevice>, context: HostStudyLaunchContext, id: string) {
  const runtime = device.reload()
  const started = await runtime.startAssignment({
    context,
    assignment: { kind: 'static-curriculum', lesson: mathLesson(id) },
  })
  if (started.status !== 'ok') throw new Error(`start failed: ${started.reason}`)
  return { runtime, snapshot: started.snapshot, session: started.snapshot.session }
}

describe('Family Pilot Study runtime', () => {
  it('starts an assignment from the existing static-curriculum adapter', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { snapshot } = await startMath(device, context, 'start')
    expect(snapshot.assignmentState).toBe('active')
    expect(snapshot.sessionStatus).toBe('active')
    expect(snapshot.segmentOrdinal).toBe(1)
    expect(snapshot.remainingSegmentRefs).toHaveLength(5)
    expect(snapshot.tutorBridgeAvailable).toBe(true)
    expect(snapshot.session.sessionRef).toBe(`${snapshot.session.blockRef}:session`)
  })

  it('restores the exact lesson, segment, and checkpoint after a reload', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'exact-resume')
    const first = (await runtime.snapshot({ context, session })) as { snapshot: { segmentRef: string } }

    const action = await runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY })
    expect(action.status).toBe('accepted')
    const advanced = await runtime.completeSegment({ context, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)
    const saved = await runtime.checkpoint({ context, session })
    if (saved.status !== 'ok') throw new Error(saved.reason)
    expect(saved.snapshot.segmentOrdinal).toBe(2)
    expect(saved.snapshot.checkpointRevision).toBe(1)

    // Reload: a new runtime instance, the same durable store, only the handle.
    const reloaded = device.reload()
    const resumed = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (resumed.status !== 'ok') throw new Error(resumed.reason)
    expect(resumed.snapshot.lessonRef).toBe(saved.snapshot.lessonRef)
    expect(resumed.snapshot.segmentRef).toBe(saved.snapshot.segmentRef)
    expect(resumed.snapshot.segmentRef).not.toBe(first.snapshot.segmentRef)
    expect(resumed.snapshot.segmentOrdinal).toBe(2)
    expect(resumed.snapshot.completedSegmentRefs).toEqual(saved.snapshot.completedSegmentRefs)
    expect(resumed.snapshot.checkpointRef).toBe(saved.snapshot.checkpointRef)
    expect(resumed.snapshot.checkpointRevision).toBe(1)
    expect(resumed.snapshot.lastAcceptedEventRef).toBe(saved.snapshot.lastAcceptedEventRef)
  })

  it('pauses, survives a reload while paused, and resumes on the same step', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'water-break')
    const paused = await runtime.pause({ context, session })
    if (paused.status !== 'ok') throw new Error(paused.reason)
    expect(paused.snapshot.assignmentState).toBe('paused')
    expect(paused.snapshot.sessionStatus).toBe('paused')
    expect(paused.snapshot.checkpointRevision).toBe(1)

    const reloaded = device.reload()
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('paused')
    expect(afterReload.snapshot.segmentRef).toBe(paused.snapshot.segmentRef)
    expect(afterReload.snapshot.checkpointRef).toBe(paused.snapshot.checkpointRef)

    const resumed = await reloaded.resume({ context, session })
    if (resumed.status !== 'ok') throw new Error(resumed.reason)
    expect(resumed.snapshot.assignmentState).toBe('active')
    expect(resumed.snapshot.sessionStatus).toBe('active')
    expect(resumed.snapshot.segmentRef).toBe(paused.snapshot.segmentRef)
    expect(resumed.snapshot.segmentOrdinal).toBe(1)
  })

  it('advances to the next segment on completion and refuses out-of-state work', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session, snapshot } = await startMath(device, context, 'segments')
    const completed = await runtime.completeSegment({ context, session })
    if (completed.status !== 'ok') throw new Error(completed.reason)
    expect(completed.snapshot.completedSegmentRefs).toEqual([snapshot.segmentRef])
    expect(completed.snapshot.segmentOrdinal).toBe(2)
    expect(completed.snapshot.remainingSegmentRefs).toHaveLength(4)

    const paused = await runtime.pause({ context, session })
    if (paused.status !== 'ok') throw new Error(paused.reason)
    expect(await runtime.completeSegment({ context, session })).toMatchObject({
      status: 'rejected',
      reason: 'assignment-not-active',
    })
  })

  it('holds an accepted Tutor reteach advisory on the current segment', async () => {
    const original = AdaptiveTutorEngine.prototype.submit
    const submit = vi.spyOn(AdaptiveTutorEngine.prototype, 'submit').mockImplementation(function (
      this: AdaptiveTutorEngine,
      input: Parameters<AdaptiveTutorEngine['submit']>[0],
    ): TutorResponse {
      return { ...original.call(this, input), phase: 'reteach' }
    })
    try {
      const device = pilotDevice()
      const context = studentContext('one')
      const { runtime, session } = await startMath(device, context, 'reteach-hold')
      const action = await runtime.submitStudyAction({ context, session, transientLearnerText: 'incorrect' })
      expect(action).toMatchObject({ status: 'accepted', directive: 'reteach' })
      expect(await runtime.completeSegment({ context, session })).toMatchObject({
        status: 'rejected',
        reason: 'study-progression-held',
      })
      expect(await runtime.snapshot({ context, session })).toMatchObject({
        status: 'ok',
        snapshot: { assignmentState: 'active', completedSegmentRefs: [] },
      })
    } finally {
      submit.mockRestore()
    }
  })

  it('completes the whole assignment only against accepted Tutor receipts', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'full-run')
    for (let step = 0; step < 5; step += 1) {
      const action = await runtime.submitStudyAction({ context, session, transientLearnerText: 'ready' })
      expect(action.status).toBe('accepted')
      const advanced = await runtime.completeSegment({ context, session })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const finished = await runtime.completeAssignment({ context, session })
    if (finished.status !== 'ok') throw new Error(finished.reason)
    expect(finished.snapshot.assignmentState).toBe('completed')
    expect(finished.snapshot.sessionStatus).toBe('completed')
    expect(finished.snapshot.remainingSegmentRefs).toEqual([])
    expect(finished.snapshot.requiredWorkCompletionPercent).toBe(100)

    const reloaded = device.reload()
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('completed')
    expect(afterReload.snapshot.sessionStatus).toBe('completed')
  })

  it('rejects completion while required work is outstanding', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'early-finish')
    expect(await runtime.completeAssignment({ context, session })).toMatchObject({
      status: 'rejected',
      reason: 'assignment-incomplete',
    })
  })

  it('keeps two students in one household on separate assignments', async () => {
    const device = pilotDevice()
    const one = studentContext('one')
    const two = studentContext('two')
    const first = await startMath(device, one, 'shared-device')
    const second = await startMath(device, two, 'shared-device')

    expect(second.session.blockRef).not.toBe(first.session.blockRef)
    await first.runtime.completeSegment({ context: one, session: first.session })

    const secondSnapshot = await second.runtime.snapshot({ context: two, session: second.session })
    if (secondSnapshot.status !== 'ok') throw new Error(secondSnapshot.reason)
    expect(secondSnapshot.snapshot.completedSegmentRefs).toEqual([])
    expect(secondSnapshot.snapshot.segmentOrdinal).toBe(1)

    const firstSnapshot = await first.runtime.snapshot({ context: one, session: first.session })
    if (firstSnapshot.status !== 'ok') throw new Error(firstSnapshot.reason)
    expect(firstSnapshot.snapshot.completedSegmentRefs).toHaveLength(1)
  })

  it('never resumes one student’s stale session as another student', async () => {
    const device = pilotDevice()
    const one = studentContext('one')
    const two = studentContext('two')
    const { session } = await startMath(device, one, 'stale')
    const stale = storedHandle(session)
    const runtime = device.reload()

    for (const call of [
      () => runtime.resumeAssignment({ context: two, session: stale }),
      () => runtime.snapshot({ context: two, session: stale }),
      () => runtime.pause({ context: two, session: stale }),
      () => runtime.resume({ context: two, session: stale }),
      () => runtime.checkpoint({ context: two, session: stale }),
      () => runtime.completeSegment({ context: two, session: stale }),
      () => runtime.completeAssignment({ context: two, session: stale }),
    ]) {
      expect(await call()).toMatchObject({ status: 'rejected', reason: 'student-mismatch' })
    }
    expect(await runtime.submitStudyAction({ context: two, session: stale, transientLearnerText: 'ready' }))
      .toMatchObject({ status: 'rejected', reason: 'student-mismatch' })

    expect(await runtime.snapshot({
      context: { ...one, householdRef: 'household:other-family' },
      session: stale,
    })).toMatchObject({ status: 'rejected', reason: 'household-mismatch' })

    expect(await runtime.snapshot({
      context: one,
      session: { ...stale, sessionRef: `${stale.blockRef}:session:forged` },
    })).toMatchObject({ status: 'rejected', reason: 'session-binding-mismatch' })

    // Relabelling the handle for student two does not hand over the block:
    // the calendar is read in student two's scope, where it does not exist.
    expect(await runtime.snapshot({
      context: two,
      session: { ...stale, learnerRef: two.learnerRef },
    })).toMatchObject({ status: 'rejected', reason: 'unknown-assignment' })

    // A rejected stale session writes nothing at all.
    const state = device.services.inspectPublicStateForTest() as { sessions: unknown[]; calendar: unknown[] }
    expect(state.sessions).toHaveLength(1)
    expect(state.calendar).toHaveLength(1)
  })

  it('cancels the previous student’s lifecycle epoch when the learner switches', async () => {
    const device = pilotDevice()
    const one = studentContext('one')
    const two = studentContext('two')
    await startMath(device, one, 'epoch')
    const tokenForOne = device.lifecycle.token()
    expect(tokenForOne.isCurrent()).toBe(true)

    await startMath(device, two, 'epoch')
    expect(tokenForOne.isCurrent()).toBe(false)
    expect(device.lifecycle.lastReason).toBe('learner-switch')
  })

  it('persists no raw learner text and no free-text draft reference', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'minimized')
    await runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY })
    await runtime.checkpoint({ context, session, responseDraftRef: 'draft:pilot:one' })

    expect(await runtime.checkpoint({ context, session, responseDraftRef: 'I think the answer is 42' }))
      .toMatchObject({ status: 'rejected', reason: 'response-draft-not-opaque' })

    const persisted = JSON.stringify(device.services.inspectPublicStateForTest())
    expect(persisted).not.toContain(RAW_ANSWER_CANARY)
    expect(persisted).not.toMatch(/rawAnswerIncluded"\s*:\s*true/)
    expect(persisted).not.toMatch(/transcriptIncluded"\s*:\s*true/)
  })

  it('records completion-only work through the static-curriculum fallback', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const runtime = device.reload()
    const started = await runtime.startAssignment({
      context,
      assignment: { kind: 'static-curriculum', lesson: parentActivity('nature-walk') },
    })
    if (started.status !== 'ok') throw new Error(started.reason)
    const session = started.snapshot.session
    expect(started.snapshot.masteryAuthority).toBe('completion-only')
    expect(started.snapshot.tutorBridgeAvailable).toBe(false)

    const action = await runtime.submitStudyAction({ context, session, transientLearnerText: 'done' })
    expect(action.status).toBe('recorded')
    const advanced = await runtime.completeSegment({ context, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)
    const finished = await runtime.completeAssignment({ context, session })
    if (finished.status !== 'ok') throw new Error(finished.reason)
    expect(finished.snapshot.sessionStatus).toBe('completed')
    expect(finished.snapshot.lastAcceptedEventRef).toBeNull()
  })

  it('stops the session on an urgent safety result without recording work', async () => {
    const device = pilotDevice({ safety: 'urgent' })
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'safety')
    const action = await runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY })
    expect(action.status).toBe('stopped')
    if (action.status === 'stopped') expect(action.snapshot.completedSegmentRefs).toEqual([])
    expect(device.lifecycle.lastReason).toBe('safety-stop')
    expect(await runtime.completeSegment({ context, session }))
      .toMatchObject({ status: 'rejected', reason: 'session-stopped' })

    // The stop is durable: a reload starts stopped and cannot be relaunched.
    const reloaded = device.reload()
    expect(await reloaded.resumeAssignment({ context, session: storedHandle(session) }))
      .toMatchObject({ status: 'rejected', reason: 'session-stopped' })
    expect(await reloaded.submitStudyAction({ context, session, transientLearnerText: 'ready' }))
      .toMatchObject({ status: 'rejected', reason: 'session-stopped' })
    expect(JSON.stringify(device.services.inspectPublicStateForTest())).not.toContain(RAW_ANSWER_CANARY)
  })
})
