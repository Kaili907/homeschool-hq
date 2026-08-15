import { describe, expect, it } from 'vitest'
import { StudyLifecycleBoundary } from '../../lifecycle'
import { SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext } from '../../types'
import { createFamilyPilotDurableStudyPorts, durableStudyDocumentKey } from '../durable-ports'
import { FamilyPilotStudyRuntime } from '../study/FamilyPilotStudyRuntime'
import { mathLesson, pilotDevice, safetyPort, startMath, storedHandle, studentContext } from './testing/pilotDevice'

// The migration path off the accepted store's localStorage records.
//
// The rule this file exists to pin: the accepted store's records are read and
// never written, never cleared, and never trusted to have landed until they have
// been read back out of the database. A household that has a school year in
// localStorage has exactly one copy of it, and an import is not a reason to make
// that zero.

/** A device already running the accepted localStorage-backed durable ports. */
function legacyDevice() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  let tick = 0
  const now = () => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000))
  const safetyStopValues = new Map<string, string>()
  return {
    values,
    storage,
    /** A clock the migrated device can continue from without going backwards. */
    laterClock: () => {
      let later = 0
      return () => new Date(SYNTHETIC_NOW.getTime() + 10_000_000 + (later += 1000))
    },
    reload: () => {
      const { ports } = createFamilyPilotDurableStudyPorts({ safety: safetyPort(), storage, now })
      return new FamilyPilotStudyRuntime({
        ports,
        now,
        lifecycle: new StudyLifecycleBoundary(),
        safetyStopStorage: {
          getItem: (key: string) => safetyStopValues.get(key) ?? null,
          setItem: (key: string, value: string) => { safetyStopValues.set(key, value) },
        },
      })
    },
  }
}

/** A student who is part way through a lesson on the accepted store. */
async function legacyHouseholdInProgress(context: HostStudyLaunchContext) {
  const legacy = legacyDevice()
  const runtime = legacy.reload()
  const started = await runtime.startAssignment({
    context,
    assignment: { kind: 'static-curriculum', lesson: mathLesson('migrated') },
  })
  if (started.status !== 'ok') throw new Error(started.reason)
  const session = started.snapshot.session
  await runtime.submitStudyAction({ context, session, transientLearnerText: 'ready' })
  const advanced = await runtime.completeSegment({ context, session })
  if (advanced.status !== 'ok') throw new Error(advanced.reason)
  const saved = await runtime.checkpoint({ context, session })
  if (saved.status !== 'ok') throw new Error(saved.reason)
  return { legacy, session, saved: saved.snapshot }
}

describe('Family Pilot IndexedDB Study ports — migrating off localStorage', () => {
  it('imports an in-progress household and resumes it on the exact same step', async () => {
    const context = studentContext('migrating')
    const { legacy, session, saved } = await legacyHouseholdInProgress(context)
    const before = legacy.values.get(durableStudyDocumentKey(context)) as string
    expect(before.length).toBeGreaterThan(0)

    const device = pilotDevice({ legacyStorage: legacy.storage, clock: legacy.laterClock() })
    const { runtime, handle } = await device.reload(context)
    expect(handle.migration).toMatchObject({
      status: 'imported',
      documentReadable: true,
      legacyRetained: true,
    })
    expect(handle.migration.importedKeys).toContain(durableStudyDocumentKey(context))
    expect(handle.migration.documentBytes).toBe(before.length)

    const resumed = await runtime.resumeAssignment({ context, session: storedHandle(session) })
    if (resumed.status !== 'ok') throw new Error(resumed.reason)
    expect(resumed.snapshot.segmentRef).toBe(saved.segmentRef)
    expect(resumed.snapshot.segmentOrdinal).toBe(saved.segmentOrdinal)
    expect(resumed.snapshot.completedSegmentRefs).toEqual(saved.completedSegmentRefs)
    expect(resumed.snapshot.checkpointRef).toBe(saved.checkpointRef)
    expect(resumed.snapshot.lastAcceptedEventRef).toBe(saved.lastAcceptedEventRef)

    // The only other copy of this household's work is exactly where it was.
    expect(legacy.values.get(durableStudyDocumentKey(context))).toBe(before)
  })

  it('leaves the accepted store’s record untouched as the household keeps working', async () => {
    const context = studentContext('kept')
    const { legacy, session } = await legacyHouseholdInProgress(context)
    const before = legacy.values.get(durableStudyDocumentKey(context)) as string

    const device = pilotDevice({ legacyStorage: legacy.storage, clock: legacy.laterClock() })
    const { runtime } = await device.reload(context)
    for (let step = 0; step < 4; step += 1) {
      const action = await runtime.submitStudyAction({
        context,
        session: storedHandle(session),
        transientLearnerText: 'ready',
      })
      if (action.status !== 'accepted') throw new Error(`unexpected Study action: ${action.status}`)
      const advanced = await runtime.completeSegment({ context, session: storedHandle(session) })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const finished = await runtime.completeAssignment({ context, session: storedHandle(session) })
    if (finished.status !== 'ok') throw new Error(finished.reason)

    expect(legacy.values.get(durableStudyDocumentKey(context))).toBe(before)
    // And the finished work is on the new store, not the old one.
    const { runtime: reloaded } = await device.reload(context)
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('completed')
  })

  it('does not import over work the new store already has', async () => {
    const context = studentContext('already-moved')
    const { legacy } = await legacyHouseholdInProgress(context)
    const device = pilotDevice({ legacyStorage: legacy.storage, clock: legacy.laterClock() })

    const first = await device.reload(context)
    expect(first.handle.migration.status).toBe('imported')
    const { runtime, session } = await startMath(device, context, 'after-migration')
    const advanced = await runtime.completeSegment({ context, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)

    // A second open finds a database that has already moved on. Re-importing
    // would resurrect the state the household has since worked past.
    const second = await device.reload(context)
    expect(second.handle.migration.status).toBe('not-needed')
    const afterReload = await second.runtime.snapshot({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.segmentOrdinal).toBe(2)
  })

  it('refuses to run rather than start the student over when the import cannot be verified', async () => {
    const context = studentContext('unverified')
    const { legacy } = await legacyHouseholdInProgress(context)
    const before = legacy.values.get(durableStudyDocumentKey(context)) as string

    const device = pilotDevice({ legacyStorage: legacy.storage, clock: legacy.laterClock() })
    device.fake.failNextWrites(1)
    const { runtime, handle } = await device.reload(context)
    expect(handle.migration).toMatchObject({ status: 'failed', legacyRetained: true })
    expect(handle.migration.importedKeys).not.toContain(durableStudyDocumentKey(context))

    // Fail closed. An empty document here would offer a student with a term of
    // finished work a brand-new lesson.
    expect(handle.services.health(context)).toMatchObject({ status: 'read-only', durable: false })
    expect(await runtime.startAssignment({
      context,
      assignment: { kind: 'static-curriculum', lesson: mathLesson('migrated') },
    })).toMatchObject({ status: 'rejected' })
    expect(legacy.values.get(durableStudyDocumentKey(context))).toBe(before)
  })

  it('imports an unreadable accepted-store record verbatim rather than dropping it', async () => {
    const context = studentContext('corrupt')
    const { legacy } = await legacyHouseholdInProgress(context)
    const key = durableStudyDocumentKey(context)
    const damaged = (legacy.values.get(key) as string).slice(0, 400)
    legacy.values.set(key, damaged)

    const device = pilotDevice({ legacyStorage: legacy.storage, clock: legacy.laterClock() })
    const { handle } = await device.reload(context)
    expect(handle.migration).toMatchObject({ status: 'imported', documentReadable: false, legacyRetained: true })

    // The accepted store's own corruption policy takes over from here: keep the
    // payload, refuse to run, and wait for the household to decide.
    expect(handle.services.health(context)).toMatchObject({ status: 'quarantined', durable: false })
    expect(legacy.values.get(key)).toBe(damaged)
  })

  /**
   * The trap in "import whenever the new store has no document": the household's
   * own "start this student over" removes that document, and the very next open
   * would import the old school year back over the reset. A marker record, not
   * the document's presence, is what says this device has already migrated.
   */
  it('does not undo a household’s reset by importing the old record again', async () => {
    const context = studentContext('reset')
    const { legacy } = await legacyHouseholdInProgress(context)
    const device = pilotDevice({ legacyStorage: legacy.storage, clock: legacy.laterClock() })

    const first = await device.reload(context)
    expect(first.handle.migration.status).toBe('imported')
    await first.handle.reset(context)
    first.handle.close()

    const second = await device.reload(context)
    expect(second.handle.migration.status).toBe('not-needed')
    expect(second.handle.services.health(context)).toMatchObject({ status: 'ready', durable: true })
    expect(await second.handle.ports.calendar.list(context)).toEqual([])
    // The reset discarded the student's work on this device; it did not discard
    // the household's other copy of it.
    expect(legacy.values.get(durableStudyDocumentKey(context))).toBeTypeOf('string')
  })

  it('keeps the accepted store’s record importable after a failed import and a reset attempt', async () => {
    const context = studentContext('stuck')
    const { legacy, saved } = await legacyHouseholdInProgress(context)
    const device = pilotDevice({ legacyStorage: legacy.storage, clock: legacy.laterClock() })

    device.fake.failNextWrites(1)
    const blocked = await device.reload(context)
    expect(blocked.handle.migration.status).toBe('failed')
    // A reset here must not be allowed to orphan the household's only copy.
    await blocked.handle.reset(context)
    blocked.handle.close()

    const recovered = await device.reload(context)
    expect(recovered.handle.migration.status).toBe('imported')
    const blocks = await recovered.handle.ports.calendar.list(context)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].lessonRef).toBe(saved.lessonRef)
  })

  it('reports nothing to do on a device that never ran the accepted store', async () => {
    const context = studentContext('fresh')
    const device = pilotDevice({ legacyStorage: { getItem: () => null } })
    const { handle } = await device.reload(context)
    expect(handle.migration).toMatchObject({ status: 'not-needed', importedKeys: [], legacyRetained: true })
  })
})
