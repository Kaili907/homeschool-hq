import { describe, expect, it } from 'vitest'
import { mathLesson, pilotDevice, startMath, storedHandle, studentContext } from './testing/pilotDevice'

// The cold-restart proof for the IndexedDB backing store.
//
// A `reload()` here is stronger than the accepted module's: it throws away the
// runtime, the port bundle AND the storage handle, so the in-memory mirror that
// makes the synchronous seam possible is rebuilt from the database every time.
// If durability lived in the mirror rather than on the device, every test below
// would fail.

const RAW_ANSWER_CANARY = 'PILOT-RAW-STUDENT-ANSWER-CANARY'

describe('Family Pilot IndexedDB Study ports — cold restart', () => {
  it('restores the exact segment, checkpoint and receipt through a brand-new database connection', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'exact-resume')
    const first = await runtime.snapshot({ context, session })
    if (first.status !== 'ok') throw new Error(first.reason)

    expect(await runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY }))
      .toMatchObject({ status: 'accepted' })
    const advanced = await runtime.completeSegment({ context, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)
    const saved = await runtime.checkpoint({ context, session })
    if (saved.status !== 'ok') throw new Error(saved.reason)
    expect(saved.snapshot.segmentOrdinal).toBe(2)

    const { runtime: reloaded } = await device.reload(context)
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

  it('survives a mid-session restart at every step of one assignment', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { session } = await startMath(device, context, 'reload-every-step')
    for (let step = 0; step < 5; step += 1) {
      const { runtime } = await device.reload(context)
      const handle = storedHandle(session)
      const before = await runtime.snapshot({ context, session: handle })
      if (before.status !== 'ok') throw new Error(before.reason)
      expect(before.snapshot.segmentOrdinal).toBe(step + 1)
      expect(await runtime.submitStudyAction({ context, session: handle, transientLearnerText: 'ready' }))
        .toMatchObject({ status: 'accepted' })
      const advanced = await runtime.completeSegment({ context, session: handle })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const { runtime: last } = await device.reload(context)
    const finished = await last.completeAssignment({ context, session: storedHandle(session) })
    if (finished.status !== 'ok') throw new Error(finished.reason)
    expect(finished.snapshot.assignmentState).toBe('completed')
  })

  it('keeps a completed assignment completed, and refuses to start it over', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'full-run')
    for (let step = 0; step < 5; step += 1) {
      await runtime.submitStudyAction({ context, session, transientLearnerText: 'ready' })
      const advanced = await runtime.completeSegment({ context, session })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const finished = await runtime.completeAssignment({ context, session })
    if (finished.status !== 'ok') throw new Error(finished.reason)
    expect(finished.snapshot.requiredWorkCompletionPercent).toBe(100)

    const { runtime: reloaded } = await device.reload(context)
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('completed')
    expect(afterReload.snapshot.remainingSegmentRefs).toEqual([])
    expect(await reloaded.startAssignment({
      context,
      assignment: { kind: 'static-curriculum', lesson: mathLesson('full-run') },
    })).toMatchObject({ status: 'rejected', reason: 'assignment-already-complete' })
  })

  it('pauses, survives a restart while paused, and resumes on the same step', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'water-break')
    const paused = await runtime.pause({ context, session })
    if (paused.status !== 'ok') throw new Error(paused.reason)

    const { runtime: reloaded } = await device.reload(context)
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('paused')
    expect(afterReload.snapshot.segmentRef).toBe(paused.snapshot.segmentRef)

    const resumed = await reloaded.resume({ context, session })
    if (resumed.status !== 'ok') throw new Error(resumed.reason)
    expect(resumed.snapshot.assignmentState).toBe('active')
    expect(resumed.snapshot.segmentRef).toBe(paused.snapshot.segmentRef)
  })
})

describe('Family Pilot IndexedDB Study ports — a refused write is a refused step', () => {
  /**
   * The whole risk of an optimistic write. The accepted store's read-back check
   * cannot see past the mirror, so without the flush this step would report
   * success, the student would move on, and the work would be gone at the next
   * reload. It has to fail at the call that made it.
   */
  it('refuses the step and does not advance the student when the device will not take the write', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'refused-write')
    const before = await runtime.snapshot({ context, session })
    if (before.status !== 'ok') throw new Error(before.reason)

    device.fake.failNextWrites(1)
    expect(await runtime.completeSegment({ context, session }))
      .toMatchObject({ status: 'rejected', reason: 'study-unavailable' })

    const { runtime: reloaded } = await device.reload(context)
    const afterReload = await reloaded.snapshot({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.segmentOrdinal).toBe(before.snapshot.segmentOrdinal)
    expect(afterReload.snapshot.completedSegmentRefs).toEqual(before.snapshot.completedSegmentRefs)
  })

  it('tells a later cold load that this device has been dropping work', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'health')
    device.fake.failNextWrites(1)
    await runtime.completeSegment({ context, session })

    const { handle } = await device.reload(context)
    expect(handle.services.health(context).previousWriteFailed).toBe(true)
  })

  it('carries on once the device will take writes again', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'recovers')
    device.fake.failNextWrites(1)
    await runtime.completeSegment({ context, session })

    const advanced = await runtime.completeSegment({ context, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)
    const { runtime: reloaded } = await device.reload(context)
    const afterReload = await reloaded.snapshot({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.segmentOrdinal).toBe(2)
  })
})

describe('Family Pilot IndexedDB Study ports — two connections on one student', () => {
  /**
   * A second tab on the same student. Each connection serves reads from its own
   * hydrated mirror, so the accepted store's re-read-before-write check cannot
   * see across them; that check moved down into the write transaction instead.
   * What must never happen is the older tab silently replacing the newer one's
   * work, which is exactly what a plain last-writer-wins put would do.
   */
  it('refuses the stale connection’s write and keeps the other tab’s work', async () => {
    const device = pilotDevice()
    const context = studentContext('two-tabs')
    const { runtime, session } = await startMath(device, context, 'two-tabs')
    const stale = await device.reload(context)

    const advanced = await runtime.completeSegment({ context, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)

    expect(await stale.runtime.completeSegment({ context, session: storedHandle(session) }))
      .toMatchObject({ status: 'rejected' })

    const { runtime: reloaded } = await device.reload(context)
    const afterReload = await reloaded.snapshot({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.segmentOrdinal).toBe(2)
    expect(afterReload.snapshot.completedSegmentRefs).toEqual(advanced.snapshot.completedSegmentRefs)
  })
})

describe('Family Pilot IndexedDB Study ports — privacy and minimization', () => {
  it('writes no learner text, transcript, or grant to the database', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, session } = await startMath(device, context, 'privacy')
    await runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY })
    await runtime.completeSegment({ context, session })
    await runtime.checkpoint({ context, session })

    // Keys as well as values, and the record wrappers as well as the payloads.
    const stored = [...device.fake.records().entries()]
      .map(([key, value]) => `${key}\n${JSON.stringify(value)}`)
      .join('\n')
    expect(stored.length).toBeGreaterThan(0)
    expect(stored).not.toContain(RAW_ANSWER_CANARY)
    for (const forbidden of [
      'rawAnswer"', 'transcriptText', 'transientLearnerText', 'Bearer ', 'launchGrant',
      'accessToken', 'refreshToken', 'serviceRole', 'apiKey', 'sessionGrant',
    ]) {
      expect(stored).not.toContain(forbidden)
    }
    expect(stored).toContain('rawAnswerIncluded')
    expect(stored).not.toContain('"rawAnswerIncluded":true')
    expect(stored).not.toContain('"transcriptIncluded":true')
  })

  it('never writes an adult’s private note body, and says so', async () => {
    const device = pilotDevice()
    const context = studentContext('one')
    const { runtime, handle, session } = await startMath(device, context, 'adult-note')
    expect(handle.services.health(context).adultPrivateNotesDurable).toBe(false)

    const note = 'PILOT-ADULT-PRIVATE-NOTE-CANARY'
    await handle.ports.adultPrivate.commit(
      context,
      { adultAuthorized: true, householdRef: context.householdRef, role: 'parent', actorRef: 'adult:one' },
      { noteRef: 'note:one', category: 'observation', body: note },
    )
    // A later durable write must not pick the note up on its way past either.
    await runtime.checkpoint({ context, session })

    const stored = [...device.fake.records().entries()].map(([key, value]) => `${key}${JSON.stringify(value)}`).join('\n')
    expect(stored).not.toContain(note)
  })
})

describe('Family Pilot IndexedDB Study ports — student isolation', () => {
  it('keeps two sisters on the same lesson in separate records across a restart', async () => {
    const device = pilotDevice()
    const one = studentContext('ada')
    const two = studentContext('bea')
    const first = await startMath(device, one, 'shared-lesson')
    const second = await startMath(device, two, 'shared-lesson')
    expect(second.session.blockRef).not.toBe(first.session.blockRef)

    await first.runtime.completeSegment({ context: one, session: first.session })
    await first.runtime.completeSegment({ context: one, session: first.session })

    const ada = await device.reload(one)
    const bea = await device.reload(two)
    const beaAfterReload = await bea.runtime.snapshot({ context: two, session: storedHandle(second.session) })
    if (beaAfterReload.status !== 'ok') throw new Error(beaAfterReload.reason)
    expect(beaAfterReload.snapshot.completedSegmentRefs).toEqual([])
    expect(beaAfterReload.snapshot.segmentOrdinal).toBe(1)

    const adaAfterReload = await ada.runtime.snapshot({ context: one, session: storedHandle(first.session) })
    if (adaAfterReload.status !== 'ok') throw new Error(adaAfterReload.reason)
    expect(adaAfterReload.snapshot.completedSegmentRefs).toHaveLength(2)
  })

  it('refuses one student’s durable session under another student, across a restart', async () => {
    const device = pilotDevice()
    const one = studentContext('ada')
    const two = studentContext('bea')
    const { session } = await startMath(device, one, 'stale')
    const stale = storedHandle(session)
    const { runtime } = await device.reload(two)

    for (const call of [
      () => runtime.resumeAssignment({ context: two, session: stale }),
      () => runtime.snapshot({ context: two, session: stale }),
      () => runtime.checkpoint({ context: two, session: stale }),
      () => runtime.completeSegment({ context: two, session: stale }),
      () => runtime.completeAssignment({ context: two, session: stale }),
    ]) {
      expect(await call()).toMatchObject({ status: 'rejected', reason: 'student-mismatch' })
    }
  })

  it('refuses a learner whose stored document names another household', async () => {
    const device = pilotDevice()
    const context = studentContext('ada')
    await startMath(device, context, 'household-binding')

    const moved = { ...context, householdRef: 'household:other-family' }
    const { handle } = await device.reload(moved)
    // Read-only, not empty: the alternative is a second divergent document under
    // which this student's completed work simply stops existing.
    expect(handle.services.health(moved)).toMatchObject({
      status: 'read-only',
      reasonCode: 'household-binding-mismatch',
      durable: false,
    })
  })
})
