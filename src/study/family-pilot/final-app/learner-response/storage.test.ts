import { describe, expect, it } from 'vitest'
import { createFakeIndexedDb } from '../../durable-indexeddb/testing/fakeIndexedDb'
import {
  BrowserLearnerResponseStore,
  FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY,
  FAMILY_PILOT_LEARNER_RESPONSES_KEY,
  learnerResponseDocumentKey,
} from './store'
import type { LearnerResponseAttemptContext, LearnerResponseRecord } from './types'

const ADA: LearnerResponseAttemptContext = Object.freeze({
  lessonRef: 'lesson:math', studentRef: 'student:ada', assignmentRef: 'assignment:math', attemptRef: 'attempt:ada:1',
})
const BEA: LearnerResponseAttemptContext = Object.freeze({
  lessonRef: 'lesson:math', studentRef: 'student:bea', assignmentRef: 'assignment:math', attemptRef: 'attempt:bea:1',
})

function response(
  context: LearnerResponseAttemptContext,
  itemRef: string,
  text: string,
  savedAt = '2026-08-13T15:00:00.000Z',
): LearnerResponseRecord {
  return Object.freeze({
    schemaVersion: 1,
    ...context,
    sectionRef: 'section:practice',
    itemRef,
    segmentRef: 'segment:practice',
    responseType: 'TEXT',
    evidenceMode: 'INDEPENDENT',
    response: Object.freeze({ kind: 'TEXT', text }),
    status: 'PENDING_ASSESSMENT',
    savedAt,
    assessment: null,
  })
}

function legacyStorage(values: Map<string, string>): Pick<Storage, 'getItem' | 'removeItem'> {
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key) },
  }
}

describe('BrowserLearnerResponseStore IndexedDB authority', () => {
  it('persists a fresh response through reload and hard runtime reconstruction without localStorage authority', async () => {
    const fake = createFakeIndexedDb()
    const legacy = new Map<string, string>()
    const first = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(legacy) })
    await first.save(response(ADA, 'item:1', 'Ada durable response'))

    const reload = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(legacy) })
    expect(await reload.list(ADA)).toMatchObject([{ itemRef: 'item:1', response: { text: 'Ada durable response' } }])
    expect(legacy.size).toBe(0)
    expect(fake.records().has(learnerResponseDocumentKey(ADA))).toBe(true)
    expect(fake.records().has(FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY)).toBe(true)
    const durableBytes = JSON.stringify(fake.records().get(learnerResponseDocumentKey(ADA)))
    expect(durableBytes).not.toMatch(/pin|bearer|authorization|answerKey|correctAnswer/i)
  })

  it('migrates every existing student once, verifies readback, cleans the source, and is idempotent', async () => {
    const fake = createFakeIndexedDb()
    const legacyRecords = [response(ADA, 'item:1', 'Ada legacy'), response(BEA, 'item:1', 'Bea legacy')]
    const raw = JSON.stringify(legacyRecords)
    const legacy = new Map<string, string>([[FAMILY_PILOT_LEARNER_RESPONSES_KEY, raw]])
    const first = new BrowserLearnerResponseStore({
      factory: fake.factory,
      legacyStorage: legacyStorage(legacy),
      now: () => '2026-08-13T16:00:00.000Z',
    })

    expect(await first.list(ADA)).toMatchObject([{ response: { text: 'Ada legacy' } }])
    expect(await first.list(BEA)).toMatchObject([{ response: { text: 'Bea legacy' } }])
    expect(legacy.get(FAMILY_PILOT_LEARNER_RESPONSES_KEY)).toBeUndefined()
    expect(fake.records().get(FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY)).toMatchObject({
      status: 'complete', recordCount: 2,
    })

    legacy.set(FAMILY_PILOT_LEARNER_RESPONSES_KEY, JSON.stringify([
      response(ADA, 'item:1', 'stale source replacement', '2026-08-13T17:00:00.000Z'),
    ]))
    const reopened = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(legacy) })
    expect(await reopened.list(ADA)).toMatchObject([{ response: { text: 'Ada legacy' } }])
    expect(await reopened.list(BEA)).toMatchObject([{ response: { text: 'Bea legacy' } }])
    expect(legacy.get(FAMILY_PILOT_LEARNER_RESPONSES_KEY)).toBeUndefined()
  })

  it('retries an interrupted migration without duplicates and retains the source until the marker is verified', async () => {
    const fake = createFakeIndexedDb()
    const raw = JSON.stringify([response(ADA, 'item:1', 'preserve me')])
    const legacy = new Map<string, string>([[FAMILY_PILOT_LEARNER_RESPONSES_KEY, raw]])
    fake.failNextWritesOf(FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY, 1)
    const interrupted = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(legacy) })
    await expect(interrupted.list(ADA)).rejects.toThrow()
    expect(legacy.get(FAMILY_PILOT_LEARNER_RESPONSES_KEY)).toBe(raw)
    expect(fake.records().has(learnerResponseDocumentKey(ADA))).toBe(true)

    const retried = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(legacy) })
    expect(await retried.list(ADA)).toHaveLength(1)
    expect(fake.records().has(FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY)).toBe(true)
    expect(legacy.get(FAMILY_PILOT_LEARNER_RESPONSES_KEY)).toBeUndefined()
  })

  it('fails closed on corrupt legacy storage without overwriting or marking it migrated', async () => {
    const fake = createFakeIndexedDb()
    const legacy = new Map([[FAMILY_PILOT_LEARNER_RESPONSES_KEY, '{not-json']])
    const store = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(legacy) })

    await expect(store.list(ADA)).rejects.toThrow('cannot be safely migrated')
    await expect(store.save(response(ADA, 'item:1', 'must not advance'))).rejects.toThrow()
    expect(legacy.get(FAMILY_PILOT_LEARNER_RESPONSES_KEY)).toBe('{not-json')
    expect(fake.records().has(FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY)).toBe(false)
    expect(fake.records().has(learnerResponseDocumentKey(ADA))).toBe(false)
  })

  it('retries legacy cleanup after durable migration when localStorage initially refuses removal', async () => {
    const fake = createFakeIndexedDb()
    const raw = JSON.stringify([response(ADA, 'item:1', 'durable before cleanup')])
    const legacy = new Map<string, string>([[FAMILY_PILOT_LEARNER_RESPONSES_KEY, raw]])
    const refusingCleanup = {
      getItem: (key: string) => legacy.get(key) ?? null,
      removeItem: () => { /* injected refusal */ },
    }
    const first = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: refusingCleanup })
    await expect(first.list(ADA)).rejects.toThrow('could not be removed')
    expect(fake.records().has(learnerResponseDocumentKey(ADA))).toBe(true)
    expect(fake.records().has(FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY)).toBe(true)
    expect(legacy.get(FAMILY_PILOT_LEARNER_RESPONSES_KEY)).toBe(raw)

    const retry = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(legacy) })
    expect(await retry.list(ADA)).toMatchObject([{ response: { text: 'durable before cleanup' } }])
    expect(legacy.has(FAMILY_PILOT_LEARNER_RESPONSES_KEY)).toBe(false)
  })

  it('refuses an unavailable durable write and leaves the prior checkpoint unchanged', async () => {
    const fake = createFakeIndexedDb()
    const store = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(new Map()) })
    await store.list(ADA) // finish the no-legacy migration before injecting the response failure
    fake.failNextWritesOf(learnerResponseDocumentKey(ADA), 1)

    await expect(store.save(response(ADA, 'item:1', 'dropped'))).rejects.toThrow()
    const reopened = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(new Map()) })
    expect(await reopened.list(ADA)).toEqual([])
  })

  it('keeps sibling students and attempts isolated', async () => {
    const fake = createFakeIndexedDb()
    const store = new BrowserLearnerResponseStore({ factory: fake.factory, legacyStorage: legacyStorage(new Map()) })
    const adaSecondAttempt = { ...ADA, attemptRef: 'attempt:ada:2' }
    await store.save(response(ADA, 'item:1', 'Ada first'))
    await store.save(response(BEA, 'item:1', 'Bea first'))
    await store.save(response(adaSecondAttempt, 'item:1', 'Ada retake'))

    expect((await store.list(ADA))[0]?.response).toMatchObject({ text: 'Ada first' })
    expect((await store.list(BEA))[0]?.response).toMatchObject({ text: 'Bea first' })
    expect((await store.list(adaSecondAttempt))[0]?.response).toMatchObject({ text: 'Ada retake' })
    expect(new Set([
      learnerResponseDocumentKey(ADA), learnerResponseDocumentKey(BEA), learnerResponseDocumentKey(adaSecondAttempt),
    ]).size).toBe(3)
  })
})
