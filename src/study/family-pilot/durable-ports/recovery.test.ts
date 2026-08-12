import { describe, expect, it } from 'vitest'
import type { HostLessonDescriptor } from '../../curriculumAdapter'
import { syntheticGrade5StudyContext } from '../../demonstrations'
import { StudyLifecycleBoundary } from '../../lifecycle'
import type { StudySafetyPort } from '../../ports'
import { SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext, StudyLearnerScope } from '../../types'
import { FamilyPilotStudyRuntime } from '../study/FamilyPilotStudyRuntime'
import {
  FamilyPilotDurableStudyStorageError,
  createFamilyPilotDurableStudyPorts,
} from './durableStudyPorts'
import { createDurableStudyRecordSafetyPort, durableStudyRecordDecision } from './safetySeam'
import { FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION } from './schema'
import {
  durableStudyDocumentKey,
  durableStudyQuarantineKey,
  loadDurableStudyDocument,
  readDurableStudyQuarantine,
} from './store'

// What this store does when the device lies to it: empty, corrupt, partly
// corrupt, written by a newer build, out of quota, or written by another tab.
// The rule throughout is that Study refuses and keeps the evidence. It never
// substitutes an empty document, because an empty document would restart
// finished work and would present a blocked assignment as fresh.

const SAFETY: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'family-pilot-durable-ports-test-safety-v1',
  evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
}

function mapStorage(values = new Map<string, string>()) {
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    },
  }
}

function context(): HostStudyLaunchContext {
  return { ...syntheticGrade5StudyContext('math'), learnerRef: 'learner:pilot-ada', hostProfileRef: 'pilot-ada' }
}

function scopeOf(host: HostStudyLaunchContext): StudyLearnerScope {
  return { householdRef: host.householdRef, learnerRef: host.learnerRef }
}

function lesson(id: string): HostLessonDescriptor {
  return {
    lessonRef: `pilot:grade5:math:${id}`,
    title: 'Grade 5 math study block',
    kind: 'math',
    skillRefs: ['pilot:grade5:math:multiplication'],
  }
}

function bundle(storage: ReturnType<typeof mapStorage>['storage']) {
  let tick = 0
  const now = () => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000))
  const { ports, services } = createFamilyPilotDurableStudyPorts({ safety: SAFETY, storage, now })
  const runtime = new FamilyPilotStudyRuntime({
    ports,
    now,
    lifecycle: new StudyLifecycleBoundary(),
    safetyStopStorage: mapStorage().storage,
  })
  return { ports, services, runtime }
}

/** Runs one assignment to completion so there is real work to protect. */
async function completedDevice() {
  const device = mapStorage()
  const host = context()
  const { runtime } = bundle(device.storage)
  const started = await runtime.startAssignment({
    context: host,
    assignment: { kind: 'static-curriculum', lesson: lesson('recovery') },
  })
  if (started.status !== 'ok') throw new Error(started.reason)
  const session = started.snapshot.session
  for (let step = 0; step < 5; step += 1) {
    await runtime.submitStudyAction({ context: host, session, transientLearnerText: 'ready' })
    const advanced = await runtime.completeSegment({ context: host, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)
  }
  const finished = await runtime.completeAssignment({ context: host, session })
  if (finished.status !== 'ok') throw new Error(finished.reason)
  return { device, host, session }
}

describe('Family Pilot durable Study ports — empty and absent storage', () => {
  it('treats empty storage as a clean, writable start', async () => {
    const device = mapStorage()
    const host = context()
    const snapshot = loadDurableStudyDocument(scopeOf(host), { storage: device.storage })
    expect(snapshot.status).toBe('ready')
    expect(snapshot.document.calendar).toEqual([])
    expect(snapshot.raw).toBeNull()

    const { ports } = bundle(device.storage)
    await expect(ports.calendar.list(scopeOf(host))).resolves.toEqual([])
    await expect(ports.persistence.loadSession({ ...scopeOf(host), sessionRef: 'session:none' })).resolves.toBeNull()
  })

  it('runs in memory for the page, and says so, when the device has no storage', async () => {
    const host = { ...context(), learnerRef: 'learner:pilot-no-storage' }
    const { ports, services } = createFamilyPilotDurableStudyPorts({ safety: SAFETY })
    expect(services.health(scopeOf(host))).toMatchObject({ status: 'unavailable', durable: false })
    await ports.persistence.savePreferences(scopeOf(host), {
      accessibility: {
        largeText: true, reducedMotion: false, noAudio: false,
        captions: true, transientTranscript: false, highContrast: false, oneTaskAtATime: true,
      },
      timerPreference: { visibility: 'shown', milestonesOnly: false },
    })
    // A second bundle in the same page still sees it, and it is still not durable.
    const second = createFamilyPilotDurableStudyPorts({ safety: SAFETY })
    await expect(second.ports.persistence.loadPreferences(scopeOf(host)))
      .resolves.toMatchObject({ accessibility: { largeText: true } })
    expect(second.services.health(scopeOf(host)).durable).toBe(false)
  })
})

describe('Family Pilot durable Study ports — corrupt storage', () => {
  it('quarantines an unparseable payload and refuses rather than starting over', async () => {
    const { device, host } = await completedDevice()
    device.values.set(durableStudyDocumentKey(scopeOf(host)), '{"schemaVersion":1,"calendar":[')

    const health = bundle(device.storage).services.health(scopeOf(host))
    expect(health).toMatchObject({ status: 'quarantined', reasonCode: 'schema-unreadable', durable: false })
    expect(readDurableStudyQuarantine(scopeOf(host), { storage: device.storage }))
      .toBe('{"schemaVersion":1,"calendar":[')

    const { ports, runtime } = bundle(device.storage)
    await expect(ports.calendar.list(scopeOf(host))).rejects.toBeInstanceOf(FamilyPilotDurableStudyStorageError)
    // The student is told Study is unavailable — never handed a blank calendar
    // that would let finished work be started again from zero.
    expect(await runtime.startAssignment({
      context: host,
      assignment: { kind: 'static-curriculum', lesson: lesson('recovery') },
    })).toMatchObject({ status: 'rejected', reason: 'study-unavailable' })
  })

  it('keeps the first corrupt payload, not the last', async () => {
    const { device, host } = await completedDevice()
    const key = durableStudyDocumentKey(scopeOf(host))
    device.values.set(key, 'first-corruption')
    bundle(device.storage).services.health(scopeOf(host))
    device.values.set(key, 'second-corruption')
    bundle(device.storage).services.health(scopeOf(host))
    expect(device.values.get(durableStudyQuarantineKey(scopeOf(host)))).toBe('first-corruption')
  })

  it('refuses a document where only one record is bad, instead of dropping it', async () => {
    const { device, host } = await completedDevice()
    const key = durableStudyDocumentKey(scopeOf(host))
    const document = JSON.parse(device.values.get(key) as string)
    expect(document.calendar.length).toBeGreaterThan(0)
    // Exactly one field of one record is damaged. A store that dropped this
    // record would silently offer a finished assignment as brand new work.
    document.calendar[0].block.internalBlockId = { not: 'a reference' }
    device.values.set(key, JSON.stringify(document))

    expect(bundle(device.storage).services.health(scopeOf(host)))
      .toMatchObject({ status: 'quarantined', reasonCode: 'record-unreadable' })
    await expect(bundle(device.storage).ports.calendar.list(scopeOf(host)))
      .rejects.toThrow(/could not be read/)
  })

  it('refuses a record that claims to carry learner prose', async () => {
    const { device, host } = await completedDevice()
    const key = durableStudyDocumentKey(scopeOf(host))
    const document = JSON.parse(device.values.get(key) as string)
    document.sessions[0].rawAnswer = 'the student wrote this'
    device.values.set(key, JSON.stringify(document))
    expect(bundle(device.storage).services.health(scopeOf(host)))
      .toMatchObject({ status: 'quarantined', reasonCode: 'record-unreadable' })
  })

  it('refuses a resume point whose draft reference was replaced with prose', async () => {
    const device = mapStorage()
    const host = context()
    const { runtime } = bundle(device.storage)
    const started = await runtime.startAssignment({
      context: host,
      assignment: { kind: 'static-curriculum', lesson: lesson('draft-ref') },
    })
    if (started.status !== 'ok') throw new Error(started.reason)
    const paused = await runtime.pause({ context: host, session: started.snapshot.session })
    if (paused.status !== 'ok') throw new Error(paused.reason)

    const key = durableStudyDocumentKey(scopeOf(host))
    const document = JSON.parse(device.values.get(key) as string)
    // The engine's own resume metadata is the one field in a verbatim calendar
    // block that could carry learner prose instead of a reference.
    expect(document.calendar[0].block.resumePoint).toBeTruthy()
    document.calendar[0].block.resumePoint.responseDraftRef = 'the student typed this whole answer'
    device.values.set(key, JSON.stringify(document))

    expect(bundle(device.storage).services.health(scopeOf(host)))
      .toMatchObject({ status: 'quarantined', reasonCode: 'record-unreadable' })
  })

  it('refuses a document moved under another student’s key', async () => {
    const { device, host } = await completedDevice()
    const sister = { ...host, learnerRef: 'learner:pilot-bea' }
    device.values.set(
      durableStudyDocumentKey(scopeOf(sister)),
      device.values.get(durableStudyDocumentKey(scopeOf(host))) as string,
    )
    expect(bundle(device.storage).services.health(scopeOf(sister)))
      .toMatchObject({ status: 'quarantined' })
  })

  it('refuses one learner claimed by a second household, rather than forking the record', async () => {
    const { device, host } = await completedDevice()
    const key = durableStudyDocumentKey(scopeOf(host))
    const stored = device.values.get(key) as string
    const reparented = { ...host, householdRef: 'household:second-claim' }

    // The accepted provider rejects a learner reference seen under a second
    // household. Keying on the learner and checking the household inside the
    // document reproduces that, instead of quietly writing a second record whose
    // effect is that the work done so far stops appearing.
    const { ports, services } = bundle(device.storage)
    expect(services.health(scopeOf(reparented)))
      .toMatchObject({ status: 'read-only', reasonCode: 'household-binding-mismatch' })
    await expect(ports.calendar.list(scopeOf(reparented))).rejects.toThrow(/different household/)
    expect(await bundle(device.storage).runtime.startAssignment({
      context: reparented,
      assignment: { kind: 'static-curriculum', lesson: lesson('recovery') },
    })).toMatchObject({ status: 'rejected', reason: 'study-unavailable' })

    // Nothing forked and nothing was overwritten; the real household still reads it.
    expect(device.values.get(key)).toBe(stored)
    expect([...device.values.keys()].filter((name) => name.includes(':learner:'))).toHaveLength(1)
    await expect(bundle(device.storage).ports.calendar.list(scopeOf(host))).resolves.toHaveLength(1)
  })

  it('refuses rather than serving an empty record when a present storage stops reading', async () => {
    const { device, host } = await completedDevice()
    const scope = scopeOf(host)
    const failing = {
      ...device.storage,
      getItem: (key: string) => {
        if (key === durableStudyDocumentKey(scope)) throw new DOMException('denied', 'SecurityError')
        return device.values.get(key) ?? null
      },
    }
    const { ports, services, runtime } = bundle(failing)
    // Storage was present and then refused. Reporting that as "no storage" and
    // handing back an empty document would offer this student's finished work
    // as brand-new work.
    expect(services.health(scope)).toMatchObject({ status: 'read-only', reasonCode: 'storage-read-failed' })
    await expect(ports.calendar.list(scope)).rejects.toThrow(/could not be read from this device/)
    await expect(ports.persistence.loadSession({ ...scope, sessionRef: 'session:any' }))
      .rejects.toBeInstanceOf(FamilyPilotDurableStudyStorageError)
    expect(await runtime.startAssignment({
      context: host,
      assignment: { kind: 'static-curriculum', lesson: lesson('recovery') },
    })).toMatchObject({ status: 'rejected', reason: 'study-unavailable' })
  })

  it('recovers only on an explicit reset', async () => {
    const { device, host } = await completedDevice()
    device.values.set(durableStudyDocumentKey(scopeOf(host)), 'corrupt')
    const { services } = bundle(device.storage)
    expect(services.health(scopeOf(host)).status).toBe('quarantined')
    expect(services.reset(scopeOf(host))).toMatchObject({ status: 'ready', durable: true })
    expect(device.values.get(durableStudyQuarantineKey(scopeOf(host)))).toBeUndefined()

    const { runtime } = bundle(device.storage)
    const restarted = await runtime.startAssignment({
      context: host,
      assignment: { kind: 'static-curriculum', lesson: lesson('recovery') },
    })
    expect(restarted.status).toBe('ok')
  })
})

describe('Family Pilot durable Study ports — schema written by a newer build', () => {
  it('refuses a newer document schema without reinterpreting or overwriting it', async () => {
    const { device, host } = await completedDevice()
    const key = durableStudyDocumentKey(scopeOf(host))
    const document = JSON.parse(device.values.get(key) as string)
    document.schemaVersion = FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION + 1
    document.somethingThisBuildDoesNotKnow = 'kept'
    const stored = JSON.stringify(document)
    device.values.set(key, stored)

    const { ports, services, runtime } = bundle(device.storage)
    expect(services.health(scopeOf(host)))
      .toMatchObject({ status: 'read-only', reasonCode: 'schema-version-ahead', durable: false })
    await expect(ports.calendar.list(scopeOf(host))).rejects.toThrow(/newer version/)
    expect(await runtime.startAssignment({
      context: host,
      assignment: { kind: 'static-curriculum', lesson: lesson('recovery') },
    })).toMatchObject({ status: 'rejected', reason: 'study-unavailable' })

    // Byte-for-byte untouched, and not quarantined: a newer build still loads it.
    expect(device.values.get(key)).toBe(stored)
    expect(device.values.get(durableStudyQuarantineKey(scopeOf(host)))).toBeUndefined()
  })

  it('refuses a calendar record written against a newer Study Engine', async () => {
    const { device, host } = await completedDevice()
    const key = durableStudyDocumentKey(scopeOf(host))
    const document = JSON.parse(device.values.get(key) as string)
    document.calendar[0].block.schemaVersion = 'calendar-parent-runtime.v2'
    const stored = JSON.stringify(document)
    device.values.set(key, stored)

    const { ports, services } = bundle(device.storage)
    expect(services.health(scopeOf(host)))
      .toMatchObject({ status: 'read-only', reasonCode: 'calendar-schema-ahead' })
    await expect(ports.calendar.list(scopeOf(host))).rejects.toThrow(/newer version/)
    // Byte-for-byte untouched, and not quarantined: a newer build still loads it.
    expect(device.values.get(key)).toBe(stored)
    expect(device.values.get(durableStudyQuarantineKey(scopeOf(host)))).toBeUndefined()
  })
})

describe('Family Pilot durable Study ports — write failures', () => {
  it('reports a quota failure instead of pretending the work was saved', async () => {
    const device = mapStorage()
    const host = context()
    const failing = {
      getItem: device.storage.getItem,
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError') },
      removeItem: device.storage.removeItem,
    }
    const { runtime } = bundle(failing)
    expect(await runtime.startAssignment({
      context: host,
      assignment: { kind: 'static-curriculum', lesson: lesson('quota') },
    })).toMatchObject({ status: 'rejected', reason: 'study-unavailable' })
    expect(device.values.size).toBe(0)
  })

  it('remembers a device write failure across a reload, without blocking Study', async () => {
    const device = mapStorage()
    const host = context()
    const scope = scopeOf(host)
    const preferences = {
      accessibility: {
        largeText: false, reducedMotion: false, noAudio: false,
        captions: true, transientTranscript: false, highContrast: false, oneTaskAtATime: true,
      },
      timerPreference: { visibility: 'shown' as const, milestonesOnly: false },
    }
    await bundle(device.storage).ports.persistence.savePreferences(scope, preferences)
    expect(bundle(device.storage).services.health(scope).previousWriteFailed).toBe(false)

    // The document write fails; the small health flag still fits, which is the
    // realistic quota-exhaustion shape.
    let allowDocumentWrite = false
    const nearlyFull = {
      ...device.storage,
      setItem: (key: string, value: string) => {
        if (!allowDocumentWrite && key === durableStudyDocumentKey(scope)) {
          throw new DOMException('quota', 'QuotaExceededError')
        }
        device.values.set(key, value)
      },
    }
    await expect(bundle(nearlyFull).ports.persistence.savePreferences(scope, {
      ...preferences,
      timerPreference: { visibility: 'hidden', milestonesOnly: true },
    })).rejects.toThrow(/could not be saved/)

    // A later page load still finds the older document and can still work,
    // but the household is told this device has been dropping work.
    const reloaded = bundle(device.storage)
    expect(reloaded.services.health(scope)).toMatchObject({ status: 'ready', previousWriteFailed: true })
    // The flag is a fact about the DEVICE, so a sister's parent surface sees it
    // too, even though her own record is untouched.
    expect(reloaded.services.health({ ...scope, learnerRef: 'learner:pilot-bea' }).previousWriteFailed).toBe(true)
    await expect(reloaded.ports.persistence.loadPreferences(scope))
      .resolves.toMatchObject({ timerPreference: { visibility: 'shown' } })

    // And the flag clears itself once a write verifiably lands again.
    allowDocumentWrite = true
    await bundle(nearlyFull).ports.persistence.savePreferences(scope, preferences)
    expect(bundle(device.storage).services.health(scope).previousWriteFailed).toBe(false)
  })

  it('catches a write that reports success but stores nothing', async () => {
    const device = mapStorage()
    const host = context()
    const silent = {
      getItem: device.storage.getItem,
      // The failure mode that read-back verification exists for.
      setItem: () => {},
      removeItem: device.storage.removeItem,
    }
    const { ports } = bundle(silent)
    await expect(ports.persistence.savePreferences(scopeOf(host), {
      accessibility: {
        largeText: false, reducedMotion: false, noAudio: false,
        captions: true, transientTranscript: false, highContrast: false, oneTaskAtATime: true,
      },
      timerPreference: { visibility: 'shown', milestonesOnly: false },
    })).rejects.toThrow(/could not be saved/)
  })

  it('refuses to overwrite work another tab wrote since this one read', async () => {
    const device = mapStorage()
    const host = context()
    const scope = scopeOf(host)
    const first = bundle(device.storage)
    await first.ports.outbox.propose(scope, {
      proposalRef: 'proposal:one', route: 'adult-review', evidenceRefs: ['evidence:one'], status: 'proposed-not-delivered',
    })

    // Two bundles read the same document; the second writes first.
    const tabA = createFamilyPilotDurableStudyPorts({ safety: SAFETY, storage: device.storage })
    const tabB = createFamilyPilotDurableStudyPorts({ safety: SAFETY, storage: device.storage })
    const readFirst = loadDurableStudyDocument(scope, { storage: device.storage })
    await tabB.ports.outbox.propose(scope, {
      proposalRef: 'proposal:from-tab-b', route: 'adult-review', evidenceRefs: ['evidence:b'], status: 'proposed-not-delivered',
    })
    expect(readFirst.raw).not.toBe(device.values.get(durableStudyDocumentKey(scope)))

    // Tab A's own next write still succeeds, because it re-reads before writing.
    await tabA.ports.outbox.propose(scope, {
      proposalRef: 'proposal:from-tab-a', route: 'adult-review', evidenceRefs: ['evidence:a'], status: 'proposed-not-delivered',
    })
    const document = loadDurableStudyDocument(scope, { storage: device.storage }).document
    expect(document.outbox.map((item) => item.proposalRef))
      .toEqual(['proposal:one', 'proposal:from-tab-b', 'proposal:from-tab-a'])
  })

  it('refuses the write when another tab lands between this tab’s read and write', async () => {
    const device = mapStorage()
    const host = context()
    const scope = scopeOf(host)
    const key = durableStudyDocumentKey(scope)
    await bundle(device.storage).ports.outbox.propose(scope, {
      proposalRef: 'proposal:one', route: 'adult-review', evidenceRefs: ['evidence:one'], status: 'proposed-not-delivered',
    })
    const interleaved = device.values.get(key) as string

    // localStorage is shared across tabs, so a second tab really can commit in
    // the gap between this tab's read and its write. Simulated by letting the
    // other tab land on the read that happens just before the write check.
    let reads = 0
    const racing = {
      ...device.storage,
      getItem: (readKey: string) => {
        const value = device.values.get(readKey) ?? null
        if (readKey === key) {
          reads += 1
          // The other tab commits right after this tab has finished reading.
          if (reads === 1) device.values.set(key, interleaved.replace('proposal:one', 'proposal:tab-b'))
        }
        return value
      },
    }
    await expect(bundle(racing).ports.outbox.propose(scope, {
      proposalRef: 'proposal:two', route: 'adult-review', evidenceRefs: ['evidence:two'], status: 'proposed-not-delivered',
    })).rejects.toThrow(/another tab/)
    // The other tab's work is intact; this tab recorded nothing.
    expect(device.values.get(key)).toContain('proposal:tab-b')
    expect(device.values.get(key)).not.toContain('proposal:two')
  })
})

describe('Family Pilot durable Study ports — safety seam', () => {
  it('says nothing while the record is readable, in memory or on the device', async () => {
    const device = mapStorage()
    const host = context()
    const { services } = bundle(device.storage)
    expect(durableStudyRecordDecision(services, scopeOf(host))).toEqual({ allowed: true })
    // No device storage is reported through health(), never as a refusal: it
    // would lock a private-window family out of Study altogether.
    const ephemeral = createFamilyPilotDurableStudyPorts({ safety: SAFETY })
    expect(ephemeral.services.health(scopeOf(host)).durable).toBe(false)
    expect(durableStudyRecordDecision(ephemeral.services, scopeOf(host))).toEqual({ allowed: true })
  })

  it('refuses entry, with a reason, when the record cannot be trusted', async () => {
    const { device, host } = await completedDevice()
    device.values.set(durableStudyDocumentKey(scopeOf(host)), 'corrupt')
    const { services } = bundle(device.storage)
    expect(durableStudyRecordDecision(services, scopeOf(host))).toMatchObject({
      allowed: false,
      reasonCode: 'durable-study-record-schema-unreadable',
    })

    // And through the seam the Safety Hold module already consults.
    const port = createDurableStudyRecordSafetyPort(services, host.householdRef)
    const input = { studentRef: host.learnerRef, assignmentRef: 'assignment:one' }
    expect(port.checkStudyEntry?.(input)).toMatchObject({ allowed: false })
    expect(port.checkTutorEntry?.(input)).toMatchObject({ allowed: false })
    // A different student on the same device is unaffected.
    expect(port.checkStudyEntry?.({ ...input, studentRef: 'learner:pilot-bea' })).toEqual({ allowed: true })
  })

  it('refuses entry when the record was written by a newer build', async () => {
    const { device, host } = await completedDevice()
    const key = durableStudyDocumentKey(scopeOf(host))
    const document = JSON.parse(device.values.get(key) as string)
    document.schemaVersion = FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION + 1
    device.values.set(key, JSON.stringify(document))
    const { services } = bundle(device.storage)
    expect(durableStudyRecordDecision(services, scopeOf(host))).toMatchObject({
      allowed: false,
      reasonCode: 'durable-study-record-schema-version-ahead',
    })
  })
})
