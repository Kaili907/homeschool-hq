import { describe, expect, it } from 'vitest'
import { StudyLifecycleBoundary } from '../../lifecycle'
import { SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext } from '../../types'
import {
  FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX,
  createFamilyPilotDurableStudyPorts,
  durableStudyDocumentKey,
} from '../durable-ports'
import { safetyPort } from '../durable-indexeddb/testing/pilotDevice'
import type { FamilyPilotSafetyPort } from '../integration/safety'
import { FamilyPilotStudyRuntime } from '../study/FamilyPilotStudyRuntime'
import {
  HOUSEHOLD,
  householdDevice,
  mathLesson,
  startMath,
  storedHandle,
  studentContext,
  studentRefOf,
} from './testing/householdDevice'

const ADA = studentRefOf('ada')
const BEA = studentRefOf('bea')
const ENTRY = { assignmentRef: 'assignment:pilot:math' } as const

/** A household already running the accepted localStorage-backed durable ports. */
function legacyHousehold() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  let tick = 0
  const now = () => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000))
  const safetyStopValues = new Map<string, string>()
  const { ports } = createFamilyPilotDurableStudyPorts({ safety: safetyPort(), storage, now })
  return {
    values,
    storage,
    runtime: new FamilyPilotStudyRuntime({
      ports,
      now,
      lifecycle: new StudyLifecycleBoundary(),
      safetyStopStorage: {
        getItem: (key: string) => safetyStopValues.get(key) ?? null,
        setItem: (key: string, value: string) => { safetyStopValues.set(key, value) },
      },
    }),
  }
}

/** A clock that starts well after the legacy household stopped writing. */
const laterClock = () => {
  let later = 0
  return () => new Date(SYNTHETIC_NOW.getTime() + 10_000_000 + (later += 1000))
}

async function advance(runtime: FamilyPilotStudyRuntime, context: HostStudyLaunchContext, session: unknown, steps: number) {
  for (let step = 0; step < steps; step += 1) {
    await runtime.submitStudyAction({ context, session: session as never, transientLearnerText: 'ready' })
    const advanced = await runtime.completeSegment({ context, session: session as never })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)
  }
}

describe('Family Pilot production Study ports — migrating a whole household off localStorage', () => {
  it('imports every student and resumes each on the step they were on', async () => {
    const legacy = legacyHousehold()
    const ada = studentContext('ada')
    const bea = studentContext('bea')
    const adaSession = await startMath(legacy.runtime, ada, 'migrated')
    const beaSession = await startMath(legacy.runtime, bea, 'migrated')
    await advance(legacy.runtime, ada, adaSession, 2)
    await advance(legacy.runtime, bea, beaSession, 1)
    const legacyAdaBytes = (legacy.values.get(durableStudyDocumentKey(ada)) as string).length
    expect(legacyAdaBytes).toBeGreaterThan(0)

    const device = householdDevice({ legacyStorage: legacy.storage, clock: laterClock() })
    const opened = await device.reopen([ADA, BEA])
    for (const studentRef of [ADA, BEA]) {
      expect(opened.handle.student(studentRef).migration, studentRef).toMatchObject({
        status: 'imported',
        documentReadable: true,
        legacyRetained: true,
      })
    }

    const adaResumed = await opened.runtime(ADA).resumeAssignment({ context: ada, session: storedHandle(adaSession) })
    if (adaResumed.status !== 'ok') throw new Error(adaResumed.reason)
    expect(adaResumed.snapshot.segmentOrdinal).toBe(3)
    const beaResumed = await opened.runtime(BEA).resumeAssignment({ context: bea, session: storedHandle(beaSession) })
    if (beaResumed.status !== 'ok') throw new Error(beaResumed.reason)
    expect(beaResumed.snapshot.segmentOrdinal).toBe(2)

    // The only other copy of this household's school year is still where it was.
    expect((legacy.values.get(durableStudyDocumentKey(ada)) as string).length).toBe(legacyAdaBytes)
    expect(legacy.values.get(durableStudyDocumentKey(bea))).toBeTypeOf('string')
  })

  it('imports once, and a later reopen neither re-imports nor undoes a reset', async () => {
    const legacy = legacyHousehold()
    const ada = studentContext('ada')
    const bea = studentContext('bea')
    const adaSession = await startMath(legacy.runtime, ada, 'migrated-once')
    await startMath(legacy.runtime, bea, 'migrated-once')
    await advance(legacy.runtime, ada, adaSession, 2)

    const device = householdDevice({ legacyStorage: legacy.storage, clock: laterClock() })
    const first = await device.reopen([ADA, BEA])
    expect(first.handle.student(ADA).migration.status).toBe('imported')
    await first.handle.student(ADA).reset()
    first.handle.close()

    const second = await device.reopen([ADA, BEA])
    expect(second.handle.student(ADA).migration.status).toBe('not-needed')
    // The reset stands: the old school year is not imported back over it.
    expect(await second.runtime(ADA).resumeAssignment({ context: ada, session: storedHandle(adaSession) }))
      .toMatchObject({ status: 'rejected', reason: 'unknown-assignment' })
    // And it is still safe on the accepted store, which this module never writes.
    expect(legacy.values.get(durableStudyDocumentKey(ada))).toBeTypeOf('string')
  })

  it('reports "not needed" for a household that has no accepted-store records', async () => {
    const device = householdDevice()
    const opened = await device.reopen([ADA, BEA])
    const health = await opened.handle.health()
    for (const student of health.students) {
      expect(student.migration, student.studentRef).toMatchObject({ status: 'not-needed', legacyRetained: true })
    }
  })
})

describe('Family Pilot production Study ports — storage health is reportable', () => {
  it('reports a ready household, per student and in total', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const opened = await device.reopen([ADA, BEA])
    const session = await startMath(opened.runtime(ADA), ada, 'health')
    await advance(opened.runtime(ADA), ada, session, 1)

    const health = await opened.handle.health()
    expect(health).toMatchObject({ backend: 'indexeddb', householdRef: HOUSEHOLD, ready: true })
    expect(health.students.map((student) => student.studentRef)).toEqual([ADA, BEA])
    expect(health.usageBytes).toBeGreaterThan(0)
    expect(health.quotaBytes).toBeGreaterThan(health.usageBytes as number)
    for (const student of health.students) {
      expect(student, student.studentRef).toMatchObject({
        ready: true,
        status: 'ready',
        reasonCode: null,
        previousWriteFailed: false,
        // The one thing this whole path cannot make durable, said out loud.
        adultPrivateNotesDurable: false,
        storageFailureKind: null,
        pendingWrites: 0,
      })
    }
  })

  it('reports one student’s unreadable record without calling the sibling unhealthy', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const bea = studentContext('bea')
    const opened = await device.reopen([ADA, BEA])
    await startMath(opened.runtime(ADA), ada, 'tampered')
    await startMath(opened.runtime(BEA), bea, 'tampered')
    opened.handle.close()

    // A newer build of the app wrote Ada's record. This build may not read it
    // and must not replace it.
    const key = durableStudyDocumentKey(ada)
    device.fake.tamper(key, { envelopeVersion: 99, key, value: '{}' })

    const reopened = await device.reopen([ADA, BEA])
    const health = await reopened.handle.health()
    expect(health.ready).toBe(false)
    const [adaHealth, beaHealth] = health.students
    expect(adaHealth).toMatchObject({
      studentRef: ADA,
      ready: false,
      status: 'read-only',
      reasonCode: 'storage-read-failed',
      storageFailureKind: 'record-version-ahead',
    })
    expect(beaHealth).toMatchObject({ studentRef: BEA, ready: true, status: 'ready' })

    // And Bea keeps working while Ada's record is refused.
    const beaStep = await reopened.runtime(BEA).snapshot({ context: bea, session: storedHandle(await (async () => {
      const restarted = await reopened.runtime(BEA).startAssignment({
        context: bea,
        assignment: { kind: 'static-curriculum', lesson: mathLesson('tampered') },
      })
      if (restarted.status !== 'ok') throw new Error(restarted.reason)
      return restarted.snapshot.session
    })()) })
    expect(beaStep.status).toBe('ok')
  })

  /**
   * The accepted store keeps ONE write-health sidecar per origin, so this is a
   * fact about the device and not about Ada. Reporting it for every student is
   * the cautious direction and it is what the sidecar actually says; the moment
   * any write lands, it clears for the whole household (see the next describe).
   */
  it('still reports a device that dropped work after a cold reopen', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const opened = await device.reopen([ADA, BEA])
    const session = await startMath(opened.runtime(ADA), ada, 'dropped')
    device.fake.failNextWrites(1)
    expect(await opened.runtime(ADA).completeSegment({ context: ada, session }))
      .toMatchObject({ status: 'rejected', reason: 'study-unavailable' })
    opened.handle.close()

    const reopened = await device.reopen([ADA, BEA])
    const health = await reopened.handle.health()
    expect(health.ready).toBe(false)
    expect(health.students[0]).toMatchObject({ studentRef: ADA, ready: false, previousWriteFailed: true })
    expect(health.students[1]).toMatchObject({ studentRef: BEA, ready: false, previousWriteFailed: true })
    // Ada's own record is intact all the same — nothing was corrupted, the
    // device simply refused one write.
    expect(health.students[0]).toMatchObject({ status: 'ready', reasonCode: null })
  })
})

describe('Family Pilot production Study ports — what device health does NOT promise', () => {
  /**
   * The write-health sidecar is one record per origin and every student's handle
   * hydrates its own view of it, so it is honest in one direction only: set
   * means a drop really happened, clear does not mean none did. These two tests
   * pin the blind spot rather than let a comment claim it away. Closing it means
   * changing the accepted store's sidecar, which this module does not own.
   */
  it('reports the drop against the student who suffered it, and not yet the sibling', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const opened = await device.reopen([ADA, BEA])
    const session = await startMath(opened.runtime(ADA), ada, 'live-asymmetry')
    device.fake.failNextWrites(1)
    expect(await opened.runtime(ADA).completeSegment({ context: ada, session }))
      .toMatchObject({ status: 'rejected', reason: 'study-unavailable' })

    const live = await opened.handle.health()
    expect(live.ready).toBe(false)
    expect(live.students[0]).toMatchObject({ studentRef: ADA, ready: false, previousWriteFailed: true })
    // Bea's handle hydrated its view before the failure and has not reread it.
    expect(live.students[1]).toMatchObject({ studentRef: BEA, ready: true, previousWriteFailed: false })
  })

  it('KNOWN LIMITATION: a sibling’s later write clears the evidence of the drop', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const bea = studentContext('bea')
    const opened = await device.reopen([ADA, BEA])
    const adaSession = await startMath(opened.runtime(ADA), ada, 'evidence')
    const beaSession = await startMath(opened.runtime(BEA), bea, 'evidence')
    const before = await opened.runtime(ADA).snapshot({ context: ada, session: adaSession })
    if (before.status !== 'ok') throw new Error(before.reason)

    device.fake.failNextWrites(1)
    expect(await opened.runtime(ADA).completeSegment({ context: ada, session: adaSession }))
      .toMatchObject({ status: 'rejected', reason: 'study-unavailable' })
    // Bea's handle never saw the failure, so her successful write puts the
    // sidecar back to 'ready' for the whole origin.
    await advance(opened.runtime(BEA), bea, beaSession, 1)
    opened.handle.close()

    const reopened = await device.reopen([ADA, BEA])
    const health = await reopened.handle.health()
    expect(health.ready).toBe(true)
    expect(health.students[0]).toMatchObject({ studentRef: ADA, previousWriteFailed: false })

    // What is NOT lost: the refusal reached Ada at the call that made it, and
    // her work is exactly where it was. Only the after-the-fact flag is gone.
    const after = await reopened.runtime(ADA).snapshot({ context: ada, session: storedHandle(adaSession) })
    if (after.status !== 'ok') throw new Error(after.reason)
    expect(after.snapshot.segmentOrdinal).toBe(before.snapshot.segmentOrdinal)
  })

  it('KNOWN LIMITATION: a stale localStorage failure flag migrates onto a working device', async () => {
    const legacy = new Map<string, string>([[`${FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX}:health`, 'write-failed']])
    const device = householdDevice({ legacyStorage: { getItem: (key: string) => legacy.get(key) ?? null } })
    const opened = await device.reopen([ADA, BEA])

    // The old full device's flag is imported with everything else, so a brand
    // new working device opens reporting that it dropped work.
    const health = await opened.handle.health()
    expect(health.ready).toBe(false)
    expect(health.students.every((student) => student.previousWriteFailed)).toBe(true)

    // It is a false alarm that clears itself: one successful save puts it right.
    const ada = studentContext('ada')
    await startMath(opened.runtime(ADA), ada, 'stale-flag')
    const cleared = await opened.handle.health()
    expect(cleared.students[0]).toMatchObject({ studentRef: ADA, ready: true, previousWriteFailed: false })
  })
})

describe('Family Pilot production Study ports — a refused write is never a save', () => {
  /**
   * The one failure mode that would make this whole path worse than no
   * persistence at all: the student is told the step was recorded, moves on, and
   * the work is gone at the next reopen.
   */
  it('refuses the step when the device is out of room, and the work has not moved', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const opened = await device.reopen([ADA, BEA])
    const session = await startMath(opened.runtime(ADA), ada, 'quota')
    const before = await opened.runtime(ADA).snapshot({ context: ada, session })
    if (before.status !== 'ok') throw new Error(before.reason)

    // Exactly full: the next document write is larger than the one it replaces.
    device.fake.setQuota(device.fake.usedBytes())
    const refused = await opened.runtime(ADA).completeSegment({ context: ada, session })
    expect(refused).toMatchObject({ status: 'rejected', reason: 'study-unavailable' })
    expect(refused).not.toMatchObject({ status: 'ok' })

    // Said out loud, before any reopen, while the student is still sitting there.
    const health = await opened.handle.health()
    expect(health.ready).toBe(false)
    expect(health.students[0]).toMatchObject({ studentRef: ADA, ready: false, previousWriteFailed: true })

    opened.handle.close()
    device.fake.setQuota(2_000_000_000)
    const reopened = await device.reopen([ADA, BEA])
    const after = await reopened.runtime(ADA).snapshot({ context: ada, session: storedHandle(session) })
    if (after.status !== 'ok') throw new Error(after.reason)
    expect(after.snapshot.segmentOrdinal).toBe(before.snapshot.segmentOrdinal)
    expect(after.snapshot.completedSegmentRefs).toEqual(before.snapshot.completedSegmentRefs)
  })

  it('carries on for that student, and never blocked the sibling', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const bea = studentContext('bea')
    const opened = await device.reopen([ADA, BEA])
    const adaSession = await startMath(opened.runtime(ADA), ada, 'recovers')
    const beaSession = await startMath(opened.runtime(BEA), bea, 'recovers')

    device.fake.failNextWritesOf(durableStudyDocumentKey(ada), 1)
    expect(await opened.runtime(ADA).completeSegment({ context: ada, session: adaSession }))
      .toMatchObject({ status: 'rejected' })
    // Bea's write was never in that batch and never refused.
    await advance(opened.runtime(BEA), bea, beaSession, 1)
    await advance(opened.runtime(ADA), ada, adaSession, 1)
    opened.handle.close()

    const reopened = await device.reopen([ADA, BEA])
    const adaAfter = await reopened.runtime(ADA).snapshot({ context: ada, session: storedHandle(adaSession) })
    const beaAfter = await reopened.runtime(BEA).snapshot({ context: bea, session: storedHandle(beaSession) })
    if (adaAfter.status !== 'ok') throw new Error(adaAfter.reason)
    if (beaAfter.status !== 'ok') throw new Error(beaAfter.reason)
    expect(adaAfter.snapshot.segmentOrdinal).toBe(2)
    expect(beaAfter.snapshot.segmentOrdinal).toBe(2)
    expect((await reopened.handle.health()).ready).toBe(true)
  })
})

describe('Family Pilot production Study ports — the composed Study-entry decision', () => {
  const holdOn = (studentRef: string): FamilyPilotSafetyPort => ({
    checkStudyEntry: (input) => input.studentRef === studentRef
      ? { allowed: false, reasonCode: 'family-pilot-safety-hold', studentMessage: 'Please go get an adult.' }
      : { allowed: true },
    checkTutorEntry: (input) => input.studentRef === studentRef
      ? { allowed: false, reasonCode: 'family-pilot-safety-hold', studentMessage: 'Please go get an adult.' }
      : { allowed: true },
  })

  it('allows both students when nothing is held and every record is readable', async () => {
    const device = householdDevice()
    const opened = await device.reopen([ADA, BEA])
    for (const studentRef of [ADA, BEA]) {
      expect(opened.handle.studyEntrySafety.checkStudyEntry?.({ ...ENTRY, studentRef }), studentRef)
        .toEqual({ allowed: true })
      expect(opened.handle.studyEntrySafety.checkTutorEntry?.({ ...ENTRY, studentRef }), studentRef)
        .toEqual({ allowed: true })
    }
  })

  it('holds one student and leaves the sibling entirely alone', async () => {
    const device = householdDevice({ holds: holdOn(ADA) })
    const bea = studentContext('bea')
    const opened = await device.reopen([ADA, BEA])

    expect(opened.handle.studyEntrySafety.checkStudyEntry?.({ ...ENTRY, studentRef: ADA }))
      .toMatchObject({ allowed: false, reasonCode: 'family-pilot-safety-hold' })
    expect(opened.handle.studyEntrySafety.checkTutorEntry?.({ ...ENTRY, studentRef: ADA }))
      .toMatchObject({ allowed: false, reasonCode: 'family-pilot-safety-hold' })
    expect(opened.handle.studyEntrySafety.checkStudyEntry?.({ ...ENTRY, studentRef: BEA }))
      .toEqual({ allowed: true })

    // A hold is a decision about entry, not about the other child's records.
    const session = await startMath(opened.runtime(BEA), bea, 'held-sibling')
    await advance(opened.runtime(BEA), bea, session, 1)
    opened.handle.close()
    const reopened = await device.reopen([ADA, BEA])
    const after = await reopened.runtime(BEA).snapshot({ context: bea, session: storedHandle(session) })
    if (after.status !== 'ok') throw new Error(after.reason)
    expect(after.snapshot.segmentOrdinal).toBe(2)
  })

  it('refuses the student whose saved record cannot be opened, and only that one', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const opened = await device.reopen([ADA, BEA])
    await startMath(opened.runtime(ADA), ada, 'unreadable')
    opened.handle.close()
    const key = durableStudyDocumentKey(ada)
    device.fake.tamper(key, { envelopeVersion: 99, key, value: '{}' })

    const reopened = await device.reopen([ADA, BEA])
    expect(reopened.handle.studyEntrySafety.checkStudyEntry?.({ ...ENTRY, studentRef: ADA })).toMatchObject({
      allowed: false,
      reasonCode: 'durable-study-record-storage-read-failed',
      studentMessage: 'Your saved work could not be opened. Please go get an adult.',
    })
    expect(reopened.handle.studyEntrySafety.checkStudyEntry?.({ ...ENTRY, studentRef: BEA }))
      .toEqual({ allowed: true })
  })

  it('reports the Safety Hold rather than the storage complaint when both refuse', async () => {
    const device = householdDevice({ holds: holdOn(ADA) })
    const ada = studentContext('ada')
    const opened = await device.reopen([ADA, BEA])
    await startMath(opened.runtime(ADA), ada, 'both')
    opened.handle.close()
    const key = durableStudyDocumentKey(ada)
    device.fake.tamper(key, { envelopeVersion: 99, key, value: '{}' })

    const reopened = await device.reopen([ADA, BEA])
    expect(reopened.handle.studyEntrySafety.checkStudyEntry?.({ ...ENTRY, studentRef: ADA }))
      .toMatchObject({ allowed: false, reasonCode: 'family-pilot-safety-hold' })
  })

  it('treats a throwing hold, and a student who is not open, as no opinion', async () => {
    const device = householdDevice({
      holds: { checkStudyEntry: () => { throw new Error('safety module is down') } },
    })
    const opened = await device.reopen([ADA, BEA])
    expect(opened.handle.studyEntrySafety.checkStudyEntry?.({ ...ENTRY, studentRef: ADA }))
      .toEqual({ allowed: true })
    // No handle means no port bundle either, so there is nothing to protect.
    expect(opened.handle.studyEntrySafety.checkStudyEntry?.({ ...ENTRY, studentRef: 'learner:pilot-nobody' }))
      .toEqual({ allowed: true })
  })
})

describe('Family Pilot production Study ports — a refusal is never reported as done', () => {
  /**
   * The parent's one escape hatch from a blocked child. The accepted store
   * REFUSES to remove a document a newer build wrote, and returns that refusal
   * as a snapshot rather than by throwing — so an unchecked `reset()` resolves,
   * the record stays, the child stays blocked, and the household is told it
   * started over.
   */
  it('refuses to claim a reset that the device would not perform', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const opened = await device.reopen([ADA, BEA])
    await startMath(opened.runtime(ADA), ada, 'unresettable')
    opened.handle.close()
    const key = durableStudyDocumentKey(ada)
    device.fake.tamper(key, { envelopeVersion: 99, key, value: '{}' })

    const reopened = await device.reopen([ADA, BEA])
    await expect(reopened.handle.student(ADA).reset()).rejects.toThrow(/could not be cleared/)
    // And it really did leave the newer build's record alone.
    expect(device.fake.records().get(key)).toMatchObject({ envelopeVersion: 99 })
    expect(reopened.handle.student(ADA).health()).toMatchObject({ ready: false, status: 'read-only' })
    // The sibling is unaffected by any of it.
    expect(reopened.handle.student(BEA).health()).toMatchObject({ ready: true, status: 'ready' })
  })

  it('resolves a reset that really did clear the record', async () => {
    const device = householdDevice()
    const ada = studentContext('ada')
    const opened = await device.reopen([ADA, BEA])
    const session = await startMath(opened.runtime(ADA), ada, 'resettable')
    await expect(opened.handle.student(ADA).reset()).resolves.toBeUndefined()
    expect(await opened.runtime(ADA).snapshot({ context: ada, session: storedHandle(session) }))
      .toMatchObject({ status: 'rejected', reason: 'unknown-assignment' })
  })

  it('stops answering once the household is closed, rather than reporting itself ready', async () => {
    const device = householdDevice()
    const opened = await device.reopen([ADA, BEA])
    expect((await opened.handle.health()).ready).toBe(true)
    opened.handle.close()

    // Closing drops the connections; the hydrated views behind them survive, so
    // an unguarded surface would keep serving reads and keep saying "ready".
    await expect(opened.handle.health()).rejects.toThrow(/has been closed/)
    expect(() => opened.handle.ports(ADA)).toThrow(/has been closed/)
    expect(() => opened.handle.student(ADA)).toThrow(/has been closed/)
    // The safety hook still answers, because a safety hook must never throw.
    expect(opened.handle.studyEntrySafety.checkStudyEntry?.({ ...ENTRY, studentRef: ADA }))
      .toEqual({ allowed: true })
  })
})
