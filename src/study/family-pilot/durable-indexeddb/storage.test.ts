import { describe, expect, it } from 'vitest'
import {
  FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX,
  durableStudyDocumentKey,
  durableStudyQuarantineKey,
  emptyDurableStudyDocument,
  loadDurableStudyDocument,
  resetDurableStudyDocument,
  saveDurableStudyDocument,
} from '../durable-ports'
import type { StudyLearnerScope } from '../../types'
import { FAMILY_PILOT_DURABLE_DATABASE_NAME } from './indexedDbRecords'
import { FamilyPilotDurableStorageError, openFamilyPilotIndexedDbStudyStorage } from './storage'
import { createFakeIndexedDb } from './testing/fakeIndexedDb'

const ADA: StudyLearnerScope = { householdRef: 'household:manuel', learnerRef: 'learner:ada' }
const BEA: StudyLearnerScope = { householdRef: 'household:manuel', learnerRef: 'learner:bea' }
const NOW = '2026-08-12T09:00:00.000Z'

function device() {
  const fake = createFakeIndexedDb()
  return {
    fake,
    open: (scope: StudyLearnerScope, legacyStorage?: Pick<Storage, 'getItem'>) =>
      openFamilyPilotIndexedDbStudyStorage({
        scope,
        factory: fake.factory,
        storageManager: fake.storageManager,
        ...(legacyStorage ? { legacyStorage } : {}),
      }),
  }
}

describe('Family Pilot IndexedDB Study storage — the accepted seam', () => {
  it('serves the accepted store a synchronous read of what it wrote', async () => {
    const { open } = device()
    const handle = await open(ADA)
    const written = saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: handle.storage })
    expect(written.status).toBe('ready')
    await handle.flush()

    const loaded = loadDurableStudyDocument(ADA, { storage: handle.storage })
    expect(loaded.status).toBe('ready')
    expect(loaded.document.scope).toEqual(ADA)
    expect(handle.status()).toMatchObject({ durable: true, failureKind: null, pendingWrites: 0 })
  })

  it('reads back through a second handle that shares nothing but the database', async () => {
    const { open } = device()
    const first = await open(ADA)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: first.storage })
    await first.flush()
    first.close()

    const second = await open(ADA)
    expect(loadDurableStudyDocument(ADA, { storage: second.storage }).status).toBe('ready')
  })

  it('touches only this student’s document, quarantine and the device health flag', async () => {
    const { fake, open } = device()
    const handle = await open(ADA)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: handle.storage })
    await handle.flush()

    // Pins the coupling to the accepted store's private key naming: if it ever
    // writes a key outside this allowlist, the adapter throws rather than
    // silently dropping it, and this test is where that is noticed.
    expect([...fake.records(FAMILY_PILOT_DURABLE_DATABASE_NAME).keys()].sort()).toEqual([
      `${FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX}:health`,
      durableStudyDocumentKey(ADA),
    ].sort())
  })

  it('refuses any key outside the student it was opened for', async () => {
    const { open } = device()
    const handle = await open(ADA)
    for (const key of [durableStudyDocumentKey(BEA), durableStudyQuarantineKey(BEA), 'unrelated-key']) {
      expect(() => handle.storage.getItem(key)).toThrow(/outside this student/)
      expect(() => handle.storage.setItem(key, 'x')).toThrow(/outside this student/)
      expect(() => handle.storage.removeItem(key)).toThrow(/outside this student/)
    }
  })

  it('keeps two students on one device in separate records', async () => {
    const { fake, open } = device()
    const ada = await open(ADA)
    const bea = await open(BEA)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: ada.storage })
    saveDurableStudyDocument(BEA, emptyDurableStudyDocument(BEA, NOW), { storage: bea.storage })
    await ada.flush()
    await bea.flush()

    const keys = [...fake.records().keys()]
    expect(keys).toContain(durableStudyDocumentKey(ADA))
    expect(keys).toContain(durableStudyDocumentKey(BEA))
    expect(loadDurableStudyDocument(ADA, { storage: ada.storage }).document.scope.learnerRef).toBe('learner:ada')
    expect(loadDurableStudyDocument(BEA, { storage: bea.storage }).document.scope.learnerRef).toBe('learner:bea')
  })
})

describe('Family Pilot IndexedDB Study storage — write failures are detectable', () => {
  it('reports a refused transaction and rolls the page back to what is on the device', async () => {
    const { fake, open } = device()
    const handle = await open(ADA)
    const first = emptyDurableStudyDocument(ADA, NOW)
    saveDurableStudyDocument(ADA, first, { storage: handle.storage })
    await handle.flush()

    fake.failNextWrites(1)
    const second = { ...first, updatedAt: '2026-08-12T10:00:00.000Z' }
    // The accepted store's own read-back check passes: it is reading the page,
    // and the page did take the write. Only the flush knows the truth.
    expect(saveDurableStudyDocument(ADA, second, { storage: handle.storage }).status).toBe('ready')
    await expect(handle.flush()).rejects.toBeInstanceOf(FamilyPilotDurableStorageError)

    expect(loadDurableStudyDocument(ADA, { storage: handle.storage }).document.updatedAt).toBe(NOW)
    expect(handle.status().durable).toBe(true)
  })

  it('refuses a document larger than the remaining quota and keeps the previous one', async () => {
    const { fake, open } = device()
    const handle = await open(ADA)
    const first = emptyDurableStudyDocument(ADA, NOW)
    saveDurableStudyDocument(ADA, first, { storage: handle.storage })
    await handle.flush()

    // The device is full at exactly what it already holds, and the next thing
    // the student does makes the document bigger.
    fake.setQuota(fake.usedBytes())
    const grown = {
      ...first,
      updatedAt: '2026-08-12T11:00:00.000Z',
      outbox: [{
        proposalRef: 'proposal:adult-review:one',
        route: 'adult-review',
        status: 'proposed-not-delivered',
        evidenceRefs: ['evidence:one'],
      }],
    } as unknown as typeof first
    saveDurableStudyDocument(ADA, grown, { storage: handle.storage })
    // A quota refusal aborts the transaction, which is the failure the flush reports.
    await expect(handle.flush()).rejects.toThrow(/could not be saved|quota/i)
    expect(loadDurableStudyDocument(ADA, { storage: handle.storage }).document.updatedAt).toBe(NOW)
    expect(loadDurableStudyDocument(ADA, { storage: handle.storage }).document.outbox).toEqual([])
  })

  it('leaves the accepted store’s health flag set so a later cold load still says so', async () => {
    const { fake, open } = device()
    const handle = await open(ADA)
    fake.failNextWrites(1)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: handle.storage })
    await expect(handle.flush()).rejects.toBeInstanceOf(FamilyPilotDurableStorageError)
    handle.close()

    const reopened = await device().open(ADA)
    expect(reopened.status().durable).toBe(true)
    const cold = await open(ADA)
    expect(cold.storage.getItem(`${FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX}:health`)).toBe('write-failed')
    expect(loadDurableStudyDocument(ADA, { storage: cold.storage }).previousWriteFailed).toBe(true)
  })

  it('lets a household that frees space carry on after a reported failure', async () => {
    const { fake, open } = device()
    const handle = await open(ADA)
    fake.failNextWrites(1)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: handle.storage })
    await expect(handle.flush()).rejects.toBeInstanceOf(FamilyPilotDurableStorageError)

    const later = { ...emptyDurableStudyDocument(ADA, NOW), updatedAt: '2026-08-12T12:00:00.000Z' }
    saveDurableStudyDocument(ADA, later, { storage: handle.storage })
    await expect(handle.flush()).resolves.toBeUndefined()
    expect(loadDurableStudyDocument(ADA, { storage: handle.storage }).document.updatedAt)
      .toBe('2026-08-12T12:00:00.000Z')
  })
})

describe('Family Pilot IndexedDB Study storage — a rolled-back write restores the state, not just the bytes', () => {
  /**
   * The failure mode this pins: "unreadable" is a state a record is IN, not a
   * way of being absent. A reset whose delete does not land must leave the
   * corrupt record still refusing. If the rollback restored only values, the
   * key would come back as simply missing, and the accepted store would report
   * a student with a term of unreadable work as a student with no work at all.
   */
  it('leaves a corrupt record refusing after a reset that did not land', async () => {
    const { fake, open } = device()
    const seed = await open(ADA)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: seed.storage })
    await seed.flush()
    seed.close()
    fake.tamper(durableStudyDocumentKey(ADA), { envelopeVersion: 1, key: 'not-this-key', value: '{}' })

    const handle = await open(ADA)
    expect(loadDurableStudyDocument(ADA, { storage: handle.storage }).status).toBe('read-only')

    fake.failNextWrites(1)
    resetDurableStudyDocument(ADA, { storage: handle.storage })
    await expect(handle.flush()).rejects.toBeInstanceOf(FamilyPilotDurableStorageError)

    const after = loadDurableStudyDocument(ADA, { storage: handle.storage })
    expect(after.status).toBe('read-only')
    expect(after.reasonCode).toBe('storage-read-failed')
  })

  it('clears the record once the reset does land', async () => {
    const { fake, open } = device()
    const seed = await open(ADA)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: seed.storage })
    await seed.flush()
    seed.close()
    fake.tamper(durableStudyDocumentKey(ADA), { envelopeVersion: 1, key: 'not-this-key', value: '{}' })

    const handle = await open(ADA)
    resetDurableStudyDocument(ADA, { storage: handle.storage })
    await expect(handle.flush()).resolves.toBeUndefined()
    expect(loadDurableStudyDocument(ADA, { storage: handle.storage }).status).toBe('ready')

    const cold = await open(ADA)
    expect(loadDurableStudyDocument(ADA, { storage: cold.storage }).status).toBe('ready')
  })

  /**
   * The accepted store writes the device health flag as a best-effort sidecar
   * and swallows its own failures there. So must this: telling a student
   * "Nothing was recorded" about a step whose document write committed would
   * make them do finished work twice.
   */
  it('does not fail a committed document write because the device flag would not fit', async () => {
    const { fake, open } = device()
    const handle = await open(ADA)
    fake.failNextWritesOf(`${FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX}:health`, 1)

    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: handle.storage })
    await expect(handle.flush()).resolves.toBeUndefined()

    const cold = await open(ADA)
    expect(loadDurableStudyDocument(ADA, { storage: cold.storage }).status).toBe('ready')
  })
})

describe('Family Pilot IndexedDB Study storage — a newer build’s data is never overwritten', () => {
  it('refuses to open a database a newer build upgraded', async () => {
    const { fake, open } = device()
    const handle = await open(ADA)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: handle.storage })
    await handle.flush()
    fake.upgradeDatabase(FAMILY_PILOT_DURABLE_DATABASE_NAME, 2)

    await expect(open(ADA)).rejects.toMatchObject({ kind: 'database-version-ahead' })
  })

  it('closes a live connection when another tab upgrades, and reports the next write', async () => {
    const { fake, open } = device()
    const handle = await open(ADA)
    fake.upgradeDatabase(FAMILY_PILOT_DURABLE_DATABASE_NAME, 2)

    // Reads keep serving what this connection already had, so a student mid
    // lesson is not thrown out — but the handle stops calling itself durable,
    // and the next write says so out loud.
    expect(handle.status()).toMatchObject({ durable: false, failureKind: 'storage-unavailable' })
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: handle.storage })
    await expect(handle.flush()).rejects.toBeInstanceOf(FamilyPilotDurableStorageError)
  })

  it('refuses to read or replace a record wrapped by a newer build', async () => {
    const { fake, open } = device()
    const seed = await open(ADA)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: seed.storage })
    await seed.flush()
    seed.close()
    const key = durableStudyDocumentKey(ADA)
    // A newer build's envelope: same key, a wrapper version this build has never
    // heard of, and a payload it must not try to interpret.
    fake.tamper(key, { envelopeVersion: 99, key, value: '{}' })

    const handle = await open(ADA)
    expect(() => handle.storage.getItem(key)).toThrow(FamilyPilotDurableStorageError)
    expect(() => handle.storage.setItem(key, '{}')).toThrow(/newer version/)
    // The accepted store turns that read refusal into a fail-closed refusal
    // rather than an empty document.
    const loaded = loadDurableStudyDocument(ADA, { storage: handle.storage })
    expect(loaded.status).toBe('read-only')
    expect(loaded.reasonCode).toBe('storage-read-failed')
  })

  it('treats a record that is not one of ours as unreadable, never as absent', async () => {
    const { fake, open } = device()
    const seed = await open(ADA)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: seed.storage })
    await seed.flush()
    seed.close()
    const key = durableStudyDocumentKey(ADA)
    fake.tamper(key, { envelopeVersion: 1, key: 'someone-elses-key', value: '{}' })

    const handle = await open(ADA)
    expect(loadDurableStudyDocument(ADA, { storage: handle.storage }).status).toBe('read-only')
  })
})

describe('Family Pilot IndexedDB Study storage — availability', () => {
  it('throws rather than quietly falling back when there is no IndexedDB', async () => {
    await expect(
      openFamilyPilotIndexedDbStudyStorage({ scope: ADA, factory: undefined as unknown as IDBFactory }),
    ).rejects.toMatchObject({ kind: 'storage-unavailable' })
  })

  it('requires an authenticated student', async () => {
    const { fake } = device()
    await expect(
      openFamilyPilotIndexedDbStudyStorage({
        scope: { householdRef: '', learnerRef: 'learner:ada' },
        factory: fake.factory,
      }),
    ).rejects.toThrow(/household and learner/)
  })

  it('reports what the platform says about the origin’s storage budget', async () => {
    const { open } = device()
    const handle = await open(ADA)
    saveDurableStudyDocument(ADA, emptyDurableStudyDocument(ADA, NOW), { storage: handle.storage })
    await handle.flush()
    const estimate = await handle.estimate()
    expect(estimate.usage).toBeGreaterThan(0)
    expect(estimate.quota).toBeGreaterThan(estimate.usage as number)
  })
})
