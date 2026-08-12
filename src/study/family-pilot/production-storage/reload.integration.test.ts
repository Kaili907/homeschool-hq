import { describe, expect, it } from 'vitest'
import { HOUSEHOLD, householdDevice, startMath, storedHandle, studentContext, studentRefOf } from './testing/householdDevice'

// The proof this whole layer exists for: start, checkpoint, throw the household
// away entirely, open it again, and land on the same step — for every student on
// the device at once.
//
// `reopen()` closes every storage handle and builds new ones, so nothing here is
// served by a mirror that survived. If durability lived in the page rather than
// on the device, every assertion below would fail.

const ADA = studentRefOf('ada')
const BEA = studentRefOf('bea')
const CAI = studentRefOf('cai')

describe('Family Pilot production Study ports — cold restart of a household', () => {
  it('resumes two students on their exact step after everything is destroyed', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const bea = studentContext('bea')
    const opened = await device.reopen([ADA, BEA])

    const adaSession = await startMath(opened.runtime(ADA), ada, 'exact-resume')
    const beaSession = await startMath(opened.runtime(BEA), bea, 'exact-resume')
    expect(beaSession.blockRef).not.toBe(adaSession.blockRef)

    // Ada finishes two segments; Bea finishes one. Both checkpoint.
    for (let step = 0; step < 2; step += 1) {
      await opened.runtime(ADA).submitStudyAction({ context: ada, session: adaSession, transientLearnerText: 'ready' })
      const advanced = await opened.runtime(ADA).completeSegment({ context: ada, session: adaSession })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    await opened.runtime(BEA).submitStudyAction({ context: bea, session: beaSession, transientLearnerText: 'ready' })
    const beaAdvanced = await opened.runtime(BEA).completeSegment({ context: bea, session: beaSession })
    if (beaAdvanced.status !== 'ok') throw new Error(beaAdvanced.reason)

    const adaSaved = await opened.runtime(ADA).checkpoint({ context: ada, session: adaSession })
    if (adaSaved.status !== 'ok') throw new Error(adaSaved.reason)
    const beaSaved = await opened.runtime(BEA).checkpoint({ context: bea, session: beaSession })
    if (beaSaved.status !== 'ok') throw new Error(beaSaved.reason)
    expect(adaSaved.snapshot.segmentOrdinal).toBe(3)
    expect(beaSaved.snapshot.segmentOrdinal).toBe(2)

    // Destroy everything: both port bundles, both storage handles, both
    // connections, and the entire household surface that held them.
    opened.handle.close()

    const reopened = await device.reopen([ADA, BEA])
    for (const [context, session, saved] of [
      [ada, adaSession, adaSaved.snapshot],
      [bea, beaSession, beaSaved.snapshot],
    ] as const) {
      const resumed = await reopened.runtime(context.learnerRef)
        .resumeAssignment({ context, session: storedHandle(session) })
      if (resumed.status !== 'ok') throw new Error(resumed.reason)
      expect(resumed.snapshot.lessonRef).toBe(saved.lessonRef)
      expect(resumed.snapshot.segmentRef).toBe(saved.segmentRef)
      expect(resumed.snapshot.segmentOrdinal).toBe(saved.segmentOrdinal)
      expect(resumed.snapshot.completedSegmentRefs).toEqual(saved.completedSegmentRefs)
      expect(resumed.snapshot.checkpointRef).toBe(saved.checkpointRef)
      expect(resumed.snapshot.checkpointRevision).toBe(saved.checkpointRevision)
      expect(resumed.snapshot.lastAcceptedEventRef).toBe(saved.lastAcceptedEventRef)
    }
    // And the two really are at different places, so "exact" means each one's own.
    expect(adaSaved.snapshot.segmentRef).not.toBe(beaSaved.snapshot.segmentRef)
  })

  it('keeps three students at three different points across repeated reopens', async () => {
    const device = householdDevice()
    const contexts = { [ADA]: studentContext('ada'), [BEA]: studentContext('bea'), [CAI]: studentContext('cai') }
    const first = await device.reopen([ADA, BEA, CAI])
    const sessions = {
      [ADA]: await startMath(first.runtime(ADA), contexts[ADA], 'three'),
      [BEA]: await startMath(first.runtime(BEA), contexts[BEA], 'three'),
      [CAI]: await startMath(first.runtime(CAI), contexts[CAI], 'three'),
    }
    first.handle.close()

    // Ada advances on every reopen, Bea on every other, Cai never.
    for (let round = 0; round < 3; round += 1) {
      const opened = await device.reopen([ADA, BEA, CAI])
      const advancing = round % 2 === 0 ? [ADA, BEA] : [ADA]
      for (const studentRef of advancing) {
        const context = contexts[studentRef]
        const session = storedHandle(sessions[studentRef])
        await opened.runtime(studentRef).submitStudyAction({ context, session, transientLearnerText: 'ready' })
        const advanced = await opened.runtime(studentRef).completeSegment({ context, session })
        if (advanced.status !== 'ok') throw new Error(advanced.reason)
      }
      opened.handle.close()
    }

    const last = await device.reopen([ADA, BEA, CAI])
    for (const [studentRef, ordinal] of [[ADA, 4], [BEA, 3], [CAI, 1]] as const) {
      const context = contexts[studentRef]
      const snapshot = await last.runtime(studentRef).snapshot({ context, session: storedHandle(sessions[studentRef]) })
      if (snapshot.status !== 'ok') throw new Error(snapshot.reason)
      expect(snapshot.snapshot.segmentOrdinal, studentRef).toBe(ordinal)
      expect(snapshot.snapshot.completedSegmentRefs, studentRef).toHaveLength(ordinal - 1)
    }
  })

  it('runs one student to completion and keeps it completed through a reopen', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const bea = studentContext('bea')
    const opened = await device.reopen([ADA, BEA])
    const adaSession = await startMath(opened.runtime(ADA), ada, 'finished')
    const beaSession = await startMath(opened.runtime(BEA), bea, 'finished')
    for (let step = 0; step < 5; step += 1) {
      await opened.runtime(ADA).submitStudyAction({ context: ada, session: adaSession, transientLearnerText: 'ready' })
      const advanced = await opened.runtime(ADA).completeSegment({ context: ada, session: adaSession })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const finished = await opened.runtime(ADA).completeAssignment({ context: ada, session: adaSession })
    if (finished.status !== 'ok') throw new Error(finished.reason)
    opened.handle.close()

    const reopened = await device.reopen([ADA, BEA])
    const adaAfter = await reopened.runtime(ADA).resumeAssignment({ context: ada, session: storedHandle(adaSession) })
    if (adaAfter.status !== 'ok') throw new Error(adaAfter.reason)
    expect(adaAfter.snapshot.assignmentState).toBe('completed')
    expect(adaAfter.snapshot.requiredWorkCompletionPercent).toBe(100)

    // The sibling on the same lesson is untouched by any of it.
    const beaAfter = await reopened.runtime(BEA).resumeAssignment({ context: bea, session: storedHandle(beaSession) })
    if (beaAfter.status !== 'ok') throw new Error(beaAfter.reason)
    expect(beaAfter.snapshot.assignmentState).toBe('active')
    expect(beaAfter.snapshot.segmentOrdinal).toBe(1)
  })
})

describe('Family Pilot production Study ports — student isolation', () => {
  it('refuses one student’s durable session under a sibling, across a reopen', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const bea = studentContext('bea')
    const opened = await device.reopen([ADA, BEA])
    const adaSession = await startMath(opened.runtime(ADA), ada, 'stale')
    opened.handle.close()

    const reopened = await device.reopen([ADA, BEA])
    const stale = storedHandle(adaSession)
    const beaRuntime = reopened.runtime(BEA)
    for (const call of [
      () => beaRuntime.resumeAssignment({ context: bea, session: stale }),
      () => beaRuntime.snapshot({ context: bea, session: stale }),
      () => beaRuntime.checkpoint({ context: bea, session: stale }),
      () => beaRuntime.completeSegment({ context: bea, session: stale }),
    ]) {
      expect(await call()).toMatchObject({ status: 'rejected', reason: 'student-mismatch' })
    }
  })

  it('resets one student without touching the other', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const bea = studentContext('bea')
    const opened = await device.reopen([ADA, BEA])
    const adaSession = await startMath(opened.runtime(ADA), ada, 'reset')
    const beaSession = await startMath(opened.runtime(BEA), bea, 'reset')
    await opened.runtime(BEA).submitStudyAction({ context: bea, session: beaSession, transientLearnerText: 'ready' })
    const beaAdvanced = await opened.runtime(BEA).completeSegment({ context: bea, session: beaSession })
    if (beaAdvanced.status !== 'ok') throw new Error(beaAdvanced.reason)

    await opened.handle.student(ADA).reset()
    opened.handle.close()

    const reopened = await device.reopen([ADA, BEA])
    // Ada's record is gone, so her old session handle no longer resolves.
    expect(await reopened.runtime(ADA).resumeAssignment({ context: ada, session: storedHandle(adaSession) }))
      .toMatchObject({ status: 'rejected', reason: 'unknown-assignment' })
    // Bea's completed segment is exactly where she left it.
    const beaAfter = await reopened.runtime(BEA).snapshot({ context: bea, session: storedHandle(beaSession) })
    if (beaAfter.status !== 'ok') throw new Error(beaAfter.reason)
    expect(beaAfter.snapshot.segmentOrdinal).toBe(2)
    expect(beaAfter.snapshot.completedSegmentRefs).toEqual(beaAdvanced.snapshot.completedSegmentRefs)
  })

  it('opens one household and refuses a second handle on the same student', async () => {
    const device = householdDevice()
    await expect(device.reopen([ADA, ADA])).rejects.toThrow(/opened once per device/)
    await expect(device.reopen([])).rejects.toThrow(/At least one student/)
  })

  it('exposes the household reference it was opened with', async () => {
    const device = householdDevice()
    const opened = await device.reopen([ADA, BEA])
    expect(opened.handle.householdRef).toBe(HOUSEHOLD)
    expect(opened.handle.students).toEqual([ADA, BEA])
    expect(opened.handle.student(ADA).scope).toEqual({ householdRef: HOUSEHOLD, learnerRef: ADA })
    expect(() => opened.handle.ports('learner:pilot-nobody')).toThrow(/not open on this device/)
  })
})
