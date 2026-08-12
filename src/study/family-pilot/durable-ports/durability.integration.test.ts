import { describe, expect, it } from 'vitest'
import type { HostLessonDescriptor } from '../../curriculumAdapter'
import { syntheticGrade5StudyContext } from '../../demonstrations'
import { StudyLifecycleBoundary } from '../../lifecycle'
import type { StudySafetyPort } from '../../ports'
import { SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext } from '../../types'
import { FamilyPilotStudyRuntime } from '../study/FamilyPilotStudyRuntime'
import type { FamilyPilotStudySession } from '../study/types'
import { createFamilyPilotDurableStudyPorts } from './durableStudyPorts'
import { durableStudyDocumentKey } from './store'

// The durability proof. Every `reload()` here throws away the runtime AND the
// whole port bundle and builds new ones over the same device storage, which is
// what a browser refresh actually does. The accepted runtime test reloads only
// the runtime over one long-lived in-memory provider, so it cannot show this.

const RAW_ANSWER_CANARY = 'PILOT-RAW-STUDENT-ANSWER-CANARY'

function safetyPort(outcome: 'clear' | 'urgent' = 'clear'): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'family-pilot-durable-ports-test-safety-v1',
    evaluate: async () => outcome === 'clear'
      ? { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
      : { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' },
  }
}

/** One household device: a single storage map that outlives every runtime. */
function deviceStorage() {
  const values = new Map<string, string>()
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    },
  }
}

function pilotDevice(options: { readonly safety?: 'clear' | 'urgent' } = {}) {
  let tick = 0
  const now = () => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000))
  const device = deviceStorage()
  const safetyStopValues = new Map<string, string>()
  const safetyStopStorage = {
    getItem: (key: string) => safetyStopValues.get(key) ?? null,
    setItem: (key: string, value: string) => { safetyStopValues.set(key, value) },
  }
  return {
    device,
    safetyStopStorage,
    /** A cold start: new ports, new services, new runtime, same storage. */
    reload: () => {
      const { ports, services } = createFamilyPilotDurableStudyPorts({
        safety: safetyPort(options.safety ?? 'clear'),
        storage: device.storage,
        now,
      })
      const runtime = new FamilyPilotStudyRuntime({
        ports,
        now,
        lifecycle: new StudyLifecycleBoundary(),
        safetyStopStorage,
      })
      return { runtime, ports, services }
    },
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

/** The handle survives a reload only as JSON, so it is round-tripped as JSON. */
function storedHandle(session: FamilyPilotStudySession): FamilyPilotStudySession {
  return JSON.parse(JSON.stringify(session)) as FamilyPilotStudySession
}

async function startMath(device: ReturnType<typeof pilotDevice>, context: HostStudyLaunchContext, id: string) {
  const { runtime } = device.reload()
  const started = await runtime.startAssignment({
    context,
    assignment: { kind: 'static-curriculum', lesson: mathLesson(id) },
  })
  if (started.status !== 'ok') throw new Error(`start failed: ${started.reason}`)
  return { runtime, snapshot: started.snapshot, session: started.snapshot.session }
}

describe('Family Pilot durable Study ports — reload durability', () => {
  it('restores the exact segment, checkpoint and receipt through a brand-new port bundle', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'exact-resume')
    const first = await runtime.snapshot({ context, session })
    if (first.status !== 'ok') throw new Error(first.reason)

    const action = await runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY })
    expect(action.status).toBe('accepted')
    const advanced = await runtime.completeSegment({ context, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)
    const saved = await runtime.checkpoint({ context, session })
    if (saved.status !== 'ok') throw new Error(saved.reason)
    expect(saved.snapshot.segmentOrdinal).toBe(2)
    expect(saved.snapshot.checkpointRevision).toBe(1)

    // Everything that held state in memory is gone from here on.
    const { runtime: reloaded } = device.reload()
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

    const { runtime: reloaded } = device.reload()
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('paused')
    expect(afterReload.snapshot.sessionStatus).toBe('paused')
    expect(afterReload.snapshot.segmentRef).toBe(paused.snapshot.segmentRef)
    expect(afterReload.snapshot.checkpointRef).toBe(paused.snapshot.checkpointRef)

    const resumed = await reloaded.resume({ context, session })
    if (resumed.status !== 'ok') throw new Error(resumed.reason)
    expect(resumed.snapshot.assignmentState).toBe('active')
    expect(resumed.snapshot.segmentRef).toBe(paused.snapshot.segmentRef)
  })

  it('keeps a completed assignment completed across a restart', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'full-run')
    for (let step = 0; step < 5; step += 1) {
      expect(await runtime.submitStudyAction({ context, session, transientLearnerText: 'ready' }))
        .toMatchObject({ status: 'accepted' })
      const advanced = await runtime.completeSegment({ context, session })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const finished = await runtime.completeAssignment({ context, session })
    if (finished.status !== 'ok') throw new Error(finished.reason)
    expect(finished.snapshot.assignmentState).toBe('completed')
    expect(finished.snapshot.requiredWorkCompletionPercent).toBe(100)

    const { runtime: reloaded } = device.reload()
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('completed')
    expect(afterReload.snapshot.sessionStatus).toBe('completed')
    expect(afterReload.snapshot.remainingSegmentRefs).toEqual([])

    // Re-launching the same lesson after a restart finds the finished block on
    // the durable calendar and refuses to start it over.
    expect(await reloaded.startAssignment({
      context,
      assignment: { kind: 'static-curriculum', lesson: mathLesson('full-run') },
    })).toMatchObject({ status: 'rejected', reason: 'assignment-already-complete' })
  })

  it('survives a mid-session reload at every step of one assignment', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { session } = await startMath(device, context, 'reload-every-step')
    for (let step = 0; step < 5; step += 1) {
      // A different runtime and a different port bundle for every single step.
      const { runtime } = device.reload()
      const handle = storedHandle(session)
      const before = await runtime.snapshot({ context, session: handle })
      if (before.status !== 'ok') throw new Error(before.reason)
      expect(before.snapshot.segmentOrdinal).toBe(step + 1)
      expect(await runtime.submitStudyAction({ context, session: handle, transientLearnerText: 'ready' }))
        .toMatchObject({ status: 'accepted' })
      const advanced = await runtime.completeSegment({ context, session: handle })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const { runtime: last } = device.reload()
    const finished = await last.completeAssignment({ context, session: storedHandle(session) })
    if (finished.status !== 'ok') throw new Error(finished.reason)
    expect(finished.snapshot.assignmentState).toBe('completed')
  })

  it('writes no learner text, transcript, or grant to the device', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'privacy')
    await runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY })
    await runtime.completeSegment({ context, session })
    await runtime.checkpoint({ context, session })

    // Keys as well as values: a reference that carried prose would land in a
    // storage key, where a values-only scan would never see it.
    const stored = [...device.device.values.entries()].flat().join('\n')
    expect(stored.length).toBeGreaterThan(0)
    expect(stored).not.toContain(RAW_ANSWER_CANARY)
    for (const forbidden of ['rawAnswer"', 'transcriptText', 'transientLearnerText', 'Bearer ', 'launchGrant']) {
      expect(stored).not.toContain(forbidden)
    }
    // The literal minimization markers are still present and still false.
    expect(stored).toContain('"rawAnswerIncluded":false')
    expect(stored).toContain('"transcriptIncluded":false')
    expect(stored).not.toContain('"rawAnswerIncluded":true')
    expect(stored).not.toContain('"transcriptIncluded":true')
  })
})

describe('Family Pilot durable Study ports — composed reference lengths', () => {
  /**
   * The Study runtime builds event references out of other references, and
   * `completion:${sessionRef}:${lessonRef}` runs past 256 characters for an
   * ordinary descriptive lesson reference that every upstream validator accepts.
   * A read-side bound below that would have made this store accept the write and
   * then refuse to read its own document back — costing the household every
   * record it had, for the sole offence of a long lesson name.
   *
   * A parent-authored activity is the shortest honest route to it: it is
   * completion-only, so the run does not also have to satisfy the Tutor bridge's
   * own identifier limits, which are what actually bound the tutor-core path.
   */
  it('keeps a household with long lesson references fully durable', async () => {
    const device = pilotDevice()
    const context = studentContext('longref')
    const longLessonRef = `pilot:parent-activity:${'nature-walk-observation-log-with-a-long-descriptive-name'.repeat(2)}`
      .slice(0, 124)
    expect(longLessonRef.length).toBe(124)
    const descriptor: HostLessonDescriptor = {
      lessonRef: longLessonRef,
      title: 'Nature walk observation log',
      kind: 'parent-created',
      skillRefs: ['pilot:parent:observation'],
      // Caller-authored, as curriculumAdapter allows, and short enough for the
      // calendar runtime's 128-character segment id ceiling.
      // A parent-created activity is a single canonical segment.
      segmentRefs: ['seg:a'],
    }

    const { runtime } = device.reload()
    const started = await runtime.startAssignment({ context, assignment: { kind: 'static-curriculum', lesson: descriptor } })
    if (started.status !== 'ok') throw new Error(started.reason)
    const session = started.snapshot.session
    for (const segmentRef of descriptor.segmentRefs ?? []) {
      expect(segmentRef.length).toBeLessThanOrEqual(128)
      const advanced = await runtime.completeSegment({ context, session })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const finished = await runtime.completeAssignment({ context, session })
    if (finished.status !== 'ok') throw new Error(finished.reason)

    // The regression this pins: at least one stored reference really is past the
    // bound that used to reject it, so the test cannot quietly stop covering it.
    const document = JSON.parse(
      [...device.device.values.entries()].find(([key]) => key.includes(':learner:'))?.[1] as string,
    )
    const longest = Math.max(...document.events.map((record: { eventRef: string }) => record.eventRef.length))
    expect(longest).toBeGreaterThan(256)

    const { runtime: reloaded } = device.reload()
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('completed')
  })
})

describe('Family Pilot durable Study ports — storage budget', () => {
  /**
   * This store refuses rather than prunes when the device runs out of room, so
   * how much one lesson costs is a deployment fact, not an implementation
   * detail. Pinned here so a change that multiplies the record fails loudly
   * instead of quietly shortening how long a household can use the pilot.
   *
   * At the time of writing one completed five-segment lesson costs ~12 KB, so a
   * ~5 MB origin quota is roughly 400 completed lessons for one student, shared
   * across the household. There is deliberately no retention policy: dropping
   * old work silently is the failure this module exists to prevent.
   */
  it('keeps one completed lesson within its pinned storage budget', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'budget')
    for (let step = 0; step < 5; step += 1) {
      await runtime.submitStudyAction({ context, session, transientLearnerText: 'ready' })
      await runtime.checkpoint({ context, session })
      const advanced = await runtime.completeSegment({ context, session })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const finished = await runtime.completeAssignment({ context, session })
    if (finished.status !== 'ok') throw new Error(finished.reason)

    const bytes = [...device.device.values.values()].reduce((total, value) => total + value.length, 0)
    expect(bytes).toBeGreaterThan(1_000)
    expect(bytes).toBeLessThan(20_000)
  })
})

describe('Family Pilot durable Study ports — student isolation', () => {
  it('keeps two sisters on the same lesson in separate documents', async () => {
    const device = pilotDevice()
    const one = studentContext('ada')
    const two = studentContext('bea')
    // Deliberately the SAME lesson id for both students.
    const first = await startMath(device, one, 'shared-lesson')
    const second = await startMath(device, two, 'shared-lesson')
    expect(second.session.blockRef).not.toBe(first.session.blockRef)

    const keys = [...device.device.values.keys()]
    expect(keys).toContain(durableStudyDocumentKey(one))
    expect(keys).toContain(durableStudyDocumentKey(two))
    expect(durableStudyDocumentKey(one)).not.toBe(durableStudyDocumentKey(two))

    await first.runtime.completeSegment({ context: one, session: first.session })
    await first.runtime.completeSegment({ context: one, session: first.session })

    // A cold start must not carry one sister's progress into the other's.
    const { runtime } = device.reload()
    const beaAfterReload = await runtime.snapshot({ context: two, session: storedHandle(second.session) })
    if (beaAfterReload.status !== 'ok') throw new Error(beaAfterReload.reason)
    expect(beaAfterReload.snapshot.completedSegmentRefs).toEqual([])
    expect(beaAfterReload.snapshot.segmentOrdinal).toBe(1)

    const adaAfterReload = await runtime.snapshot({ context: one, session: storedHandle(first.session) })
    if (adaAfterReload.status !== 'ok') throw new Error(adaAfterReload.reason)
    expect(adaAfterReload.snapshot.completedSegmentRefs).toHaveLength(2)
  })

  it('refuses one student’s durable session under another student, across a reload', async () => {
    const device = pilotDevice()
    const one = studentContext('ada')
    const two = studentContext('bea')
    const { session } = await startMath(device, one, 'stale')
    const stale = storedHandle(session)
    const { runtime } = device.reload()

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
    expect(await runtime.snapshot({
      context: { ...one, householdRef: 'household:other-family' },
      session: stale,
    })).toMatchObject({ status: 'rejected', reason: 'household-mismatch' })
  })

  it('does not carry active session state across a student switch', async () => {
    const device = pilotDevice()
    const one = studentContext('ada')
    const two = studentContext('bea')
    const ada = await startMath(device, one, 'switch')
    await ada.runtime.submitStudyAction({ context: one, session: ada.session, transientLearnerText: 'ready' })
    await ada.runtime.completeSegment({ context: one, session: ada.session })

    // Switching student on the same device is a fresh start for that student.
    const bea = await startMath(device, two, 'switch')
    const beaSnapshot = await bea.runtime.snapshot({ context: two, session: bea.session })
    if (beaSnapshot.status !== 'ok') throw new Error(beaSnapshot.reason)
    expect(beaSnapshot.snapshot.segmentOrdinal).toBe(1)
    expect(beaSnapshot.snapshot.checkpointRevision).toBe(0)
    expect(beaSnapshot.snapshot.lastAcceptedEventRef).toBeNull()

    // And Ada's own work is exactly where she left it.
    const { runtime } = device.reload()
    const adaSnapshot = await runtime.snapshot({ context: one, session: storedHandle(ada.session) })
    if (adaSnapshot.status !== 'ok') throw new Error(adaSnapshot.reason)
    expect(adaSnapshot.snapshot.segmentOrdinal).toBe(2)
    expect(adaSnapshot.snapshot.lastAcceptedEventRef).not.toBeNull()
  })
})
