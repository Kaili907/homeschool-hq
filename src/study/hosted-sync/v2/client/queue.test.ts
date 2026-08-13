import { describe, expect, it } from 'vitest'
import {
  HOSTED_SYNC_MAX_ATTEMPTS,
  emptyHostedSyncQueue,
  enqueueFirstLinkImport,
  enqueueRevisionedWrite,
  parseHostedSyncQueue,
  recordQueuedRetry,
} from './queue'

const NOW = '2026-08-13T18:00:00.000Z'
const OPERATION_ID = '11111111-1111-4111-8111-111111111111'
const IDENTITY = {
  householdRef: 'household:one',
  learnerRef: 'learner:ada',
  documentRef: 'durable-study-v1',
}

describe('hosted sync R2 payload-free queue', () => {
  it('deduplicates a stable UUID and retains its immutable CAS base through bounded retries', () => {
    const first = enqueueRevisionedWrite(emptyHostedSyncQueue(), {
      identity: IDENTITY,
      operationId: OPERATION_ID,
      baseRevision: 7,
      createdAt: NOW,
    })
    expect(enqueueRevisionedWrite(first, {
      identity: IDENTITY,
      operationId: OPERATION_ID,
      baseRevision: 7,
      createdAt: NOW,
    })).toBe(first)
    expect(() => enqueueRevisionedWrite(first, {
      identity: IDENTITY,
      operationId: OPERATION_ID,
      baseRevision: 99,
      createdAt: NOW,
    })).toThrow(/reused for different intent/)
    let retried = first
    for (let attempt = 0; attempt < HOSTED_SYNC_MAX_ATTEMPTS + 2; attempt += 1) {
      retried = recordQueuedRetry(retried, OPERATION_ID, `2026-08-13T18:${String(attempt).padStart(2, '0')}:00.000Z`)
    }
    expect(retried.entries[0]).toMatchObject({
      operationId: OPERATION_ID,
      baseRevision: 7,
      attempts: HOSTED_SYNC_MAX_ATTEMPTS,
    })
  })

  it('contains no document, raw response, tutor, PIN, answer, or authorization authority', () => {
    const queued = enqueueFirstLinkImport(emptyHostedSyncQueue(), {
      identity: IDENTITY,
      operationId: OPERATION_ID,
      adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED',
      confirmedAt: NOW,
      createdAt: NOW,
    })
    const serialized = JSON.stringify(queued).toLowerCase()
    expect(serialized).not.toContain('"document":')
    for (const forbidden of [
      'snapshot', 'rawresponse', 'rawanswer', 'tutormessage', 'pin',
      'bearertoken', 'authorization', 'answertext',
    ]) expect(serialized).not.toContain(forbidden)
    expect(parseHostedSyncQueue(queued)).not.toBeNull()
  })

  it('refuses extra authority-bearing fields rather than silently stripping them', () => {
    const queued = enqueueRevisionedWrite(emptyHostedSyncQueue(), {
      identity: IDENTITY,
      operationId: OPERATION_ID,
      baseRevision: 0,
      createdAt: NOW,
    })
    const poisoned = {
      ...queued,
      entries: [{ ...queued.entries[0], rawAnswer: 'learner prose' }],
    }
    expect(parseHostedSyncQueue(poisoned)).toBeNull()
  })
})
