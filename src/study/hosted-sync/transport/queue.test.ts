import { describe, expect, it } from 'vitest'
import { emptyDurableStudyDocument, type DurableStudyDocumentV1 } from '../../family-pilot/durable-ports/schema'
import {
  STUDY_SYNC_MAX_QUEUE_ATTEMPTS,
  createStudySyncQueueEntry,
  nextStudySyncQueueEntry,
  recordStudySyncQueueAttempt,
} from './queue'
import type { StudySyncFailure, StudySyncPushResult } from './types'

const at = '2026-08-13T12:00:00.000Z'
const identity = Object.freeze({
  householdRef: 'household:queue',
  studentRef: 'student:ada',
  documentRef: 'study:primary',
})
const document = emptyDurableStudyDocument({
  householdRef: identity.householdRef,
  learnerRef: identity.studentRef,
}, at)

function entry(operationId: string, localSequence: number, overrides: Record<string, unknown> = {}) {
  return createStudySyncQueueEntry({
    identity,
    operationId,
    baseRevision: localSequence,
    document,
    localSequence,
    enqueuedAt: new Date(Date.parse(at) + localSequence * 1_000).toISOString(),
    ...overrides,
  })
}

function failure(overrides: Partial<StudySyncFailure> = {}): StudySyncFailure {
  return {
    code: 'NETWORK_UNAVAILABLE',
    retry: 'RETRY_WITH_BACKOFF',
    httpStatus: null,
    retryAfterMs: null,
    ...overrides,
  }
}

describe('Study sync queue primitives', () => {
  it('preserves stable operation identity and contains only bounded transport metadata', () => {
    const queued = entry('operation:stable-a', 7)
    expect(queued).toMatchObject({
      operationId: 'operation:stable-a',
      localSequence: 7,
      attempts: 0,
      nextAttemptAt: null,
      state: 'PENDING',
    })
    expect(Object.isFrozen(queued)).toBe(true)
    expect(JSON.stringify(queued)).not.toMatch(/authorization|credential|token|pin/i)
  })

  it('keeps per-document order while allowing another student/document to proceed', () => {
    const first = entry('operation:first', 1)
    const later = entry('operation:later', 2)
    const blockedFirst = recordStudySyncQueueAttempt(first, failure({
      code: 'STALE_REVISION', retry: 'REBASE_REQUIRED', httpStatus: 409,
    }))
    expect(blockedFirst.disposition).toBe('KEEP')
    const sibling = entry('operation:sibling', 1, {
      identity: { ...identity, studentRef: 'student:bea' },
      document: emptyDurableStudyDocument({
        householdRef: identity.householdRef,
        learnerRef: 'student:bea',
      }, at),
    })
    const held = blockedFirst.disposition === 'KEEP' ? blockedFirst.entry : first
    expect(nextStudySyncQueueEntry([later, held], new Date(at))).toBeNull()
    expect(nextStudySyncQueueEntry([later, held, sibling], new Date(at))?.operationId).toBe('operation:sibling')
  })

  it('does not consume an attempt on abort and removes both first and duplicate success', () => {
    const queued = entry('operation:abort-safe', 1)
    const aborted = recordStudySyncQueueAttempt(queued, failure({ code: 'ABORTED', retry: 'ABORTED' }))
    expect(aborted).toEqual({ disposition: 'UNCHANGED', entry: queued })
    expect(recordStudySyncQueueAttempt(queued, {
      code: 'SUCCESS',
      value: {
        identity,
        operationId: queued.operationId,
        serverRevision: 2,
        acceptedAt: '2026-08-13T12:01:00.000Z',
        duplicate: true,
      } satisfies StudySyncPushResult,
    })).toEqual({ disposition: 'REMOVE' })
  })

  it('requires caller-supplied retry timing and stops after the finite attempt bound', () => {
    let queued = entry('operation:bounded', 1)
    expect(() => recordStudySyncQueueAttempt(queued, failure())).toThrow(/next attempt time/)
    for (let index = 0; index < STUDY_SYNC_MAX_QUEUE_ATTEMPTS; index += 1) {
      const result = recordStudySyncQueueAttempt(
        queued,
        failure(),
        new Date(Date.parse(at) + (index + 1) * 60_000).toISOString(),
      )
      expect(result.disposition).toBe('KEEP')
      if (result.disposition === 'KEEP') queued = result.entry
    }
    expect(queued).toMatchObject({ attempts: STUDY_SYNC_MAX_QUEUE_ATTEMPTS, state: 'EXHAUSTED', nextAttemptAt: null })
    expect(nextStudySyncQueueEntry([queued], new Date('2030-01-01T00:00:00.000Z'))).toBeNull()
  })

  it('rejects sensitive state before it can enter a queue', () => {
    const unsafe = { ...document, personalityInference: 'private' } as DurableStudyDocumentV1
    expect(() => entry('operation:unsafe', 1, { document: unsafe })).toThrow(/Invalid Study sync queue operation/)
  })
})
