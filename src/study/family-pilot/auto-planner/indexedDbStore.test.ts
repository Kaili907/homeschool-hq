import { describe, expect, it } from 'vitest'
import { FAMILY_PILOT_DURABLE_DATABASE_NAME } from '../durable-indexeddb'
import { createFakeIndexedDb } from '../durable-indexeddb/testing/fakeIndexedDb'
import {
  familyAutoPlannerRecordKey,
  openFamilyAutoPlannerIndexedDbStore,
} from './indexedDbStore'
import type { FamilyAutoPlannerDocumentV1, FamilyAutoPlannerSchoolPlanV1, FamilyAutoPlannerScope } from './types'

const ADA: FamilyAutoPlannerScope = { householdRef: 'household:manuel', learnerRef: 'learner:ada' }
const BEA: FamilyAutoPlannerScope = { householdRef: 'household:manuel', learnerRef: 'learner:bea' }
const NOW = '2026-08-14T13:00:00.000Z'

function plan(): FamilyAutoPlannerSchoolPlanV1 {
  return {
    schemaVersion: 1,
    householdTimeZone: 'America/Detroit',
    schoolYearStart: '2026-08-01',
    schoolYearEnd: '2027-06-30',
    schoolWeekdays: [1, 2, 3, 4, 5],
    nonSchoolDates: [],
    addedSchoolDates: [],
    subjects: [{ subject: 'mathematics', order: 0, paused: false, lessonsPerDay: 1, startLocalTime: '09:00' }],
    configuredAt: NOW,
    updatedAt: NOW,
  }
}

function configured(base: FamilyAutoPlannerDocumentV1): FamilyAutoPlannerDocumentV1 {
  return { ...base, revision: base.revision + 1, updatedAt: NOW, schoolPlan: plan() }
}

describe('Family Auto Planner IndexedDB persistence', () => {
  it('reuses the accepted Family Pilot IndexedDB database and survives reopen', async () => {
    const fake = createFakeIndexedDb()
    const first = await openFamilyAutoPlannerIndexedDbStore({
      factory: fake.factory,
      storageManager: fake.storageManager,
      now: () => new Date(NOW),
    })
    const empty = await first.load(ADA)
    expect(empty).toMatchObject({ status: 'ready', document: { revision: 0, schoolPlan: null } })
    if (empty.status !== 'ready') throw new Error('expected ready')
    await expect(first.save(ADA, configured(empty.document), 0)).resolves.toMatchObject({ status: 'saved' })
    first.close()

    expect([...fake.records(FAMILY_PILOT_DURABLE_DATABASE_NAME).keys()]).toContain(familyAutoPlannerRecordKey(ADA))
    const reopened = await openFamilyAutoPlannerIndexedDbStore({ factory: fake.factory, storageManager: fake.storageManager })
    await expect(reopened.load(ADA)).resolves.toMatchObject({
      status: 'ready', document: { revision: 1, schoolPlan: { householdTimeZone: 'America/Detroit' } },
    })
  })

  it('keeps multiple learners in separate records', async () => {
    const fake = createFakeIndexedDb()
    const store = await openFamilyAutoPlannerIndexedDbStore({ factory: fake.factory, storageManager: fake.storageManager, now: () => new Date(NOW) })
    const ada = await store.load(ADA)
    const bea = await store.load(BEA)
    if (ada.status !== 'ready' || bea.status !== 'ready') throw new Error('expected ready')
    await store.save(ADA, configured(ada.document), 0)
    await store.save(BEA, configured(bea.document), 0)
    const keys = [...fake.records(FAMILY_PILOT_DURABLE_DATABASE_NAME).keys()]
    expect(keys).toContain(familyAutoPlannerRecordKey(ADA))
    expect(keys).toContain(familyAutoPlannerRecordKey(BEA))
    expect(familyAutoPlannerRecordKey(ADA)).not.toBe(familyAutoPlannerRecordKey(BEA))
  })

  it('uses atomic revision preconditions to refuse stale tabs', async () => {
    const fake = createFakeIndexedDb()
    const first = await openFamilyAutoPlannerIndexedDbStore({ factory: fake.factory, storageManager: fake.storageManager, now: () => new Date(NOW) })
    const second = await openFamilyAutoPlannerIndexedDbStore({ factory: fake.factory, storageManager: fake.storageManager, now: () => new Date(NOW) })
    const left = await first.load(ADA)
    const right = await second.load(ADA)
    if (left.status !== 'ready' || right.status !== 'ready') throw new Error('expected ready')
    await expect(first.save(ADA, configured(left.document), 0)).resolves.toMatchObject({ status: 'saved' })
    await expect(second.save(ADA, configured(right.document), 0)).resolves.toEqual({ status: 'conflict' })
    await expect(second.load(ADA)).resolves.toMatchObject({ status: 'ready', document: { revision: 1 } })
  })

  it('fails closed on a future planner envelope and never overwrites it', async () => {
    const fake = createFakeIndexedDb()
    const store = await openFamilyAutoPlannerIndexedDbStore({ factory: fake.factory, storageManager: fake.storageManager, now: () => new Date(NOW) })
    const empty = await store.load(ADA)
    if (empty.status !== 'ready') throw new Error('expected ready')
    await store.save(ADA, configured(empty.document), 0)
    const key = familyAutoPlannerRecordKey(ADA)
    fake.tamper(key, { envelopeVersion: 99, key, document: { schemaVersion: 99 } })
    await expect(store.load(ADA)).resolves.toEqual({ status: 'read-only', reason: 'schema-version-ahead' })
    await expect(store.save(ADA, { ...configured(empty.document), revision: 2 }, 1)).resolves.not.toMatchObject({ status: 'saved' })
    expect((fake.records(FAMILY_PILOT_DURABLE_DATABASE_NAME).get(key) as { envelopeVersion: number }).envelopeVersion).toBe(99)
  })
})
