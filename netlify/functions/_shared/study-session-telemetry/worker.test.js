import { describe, expect, it, vi } from 'vitest'
import {
  createStudySessionTelemetryWorker,
  studySessionTelemetryObservationForTests,
} from './worker.js'

const EVENT_ID = '00000000-0000-4000-8000-000000000001'

function claim(overrides = {}) {
  return {
    outboxId: '10000000-0000-4000-8000-000000000001',
    executionKey: 'study:session:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    householdRef: '20000000-0000-4000-8000-000000000001',
    authoritativeOperation: 'session:transition',
    operation: 'complete',
    result: 'success',
    sessionRevision: 7,
    checkpointRevision: null,
    acceptedAt: '2026-08-10T15:51:00.000Z',
    curriculumVersion: '1.0.0',
    lessonRef: 'lesson-production-a',
    reasonCode: 'session-completed',
    attemptCount: 1,
    leaseToken: '30000000-0000-4000-8000-000000000001',
    ...overrides,
  }
}

function dependencies({ claims = [claim()], record } = {}) {
  return {
    outbox: {
      claim: vi.fn(async () => claims),
      complete: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
    },
    telemetry: {
      record: record ?? vi.fn(async () => ({
        status: 'recorded', event: { eventId: EVENT_ID },
      })),
    },
  }
}

describe('Study session telemetry outbox worker', () => {
  it('delivers a minimized observation from durable server authority', async () => {
    const ports = dependencies()
    const worker = createStudySessionTelemetryWorker(ports)
    await expect(worker.run({ limit: 10, leaseSeconds: 45 })).resolves.toEqual({
      claimed: 1,
      delivered: 1,
      replayed: 0,
      retryScheduled: 0,
      acknowledgementFailed: 0,
    })
    expect(ports.outbox.claim).toHaveBeenCalledWith({ limit: 10, leaseSeconds: 45 })
    expect(ports.telemetry.record).toHaveBeenCalledWith({
      executionKey: claim().executionKey,
      engine: 'study',
      eventType: 'study.session',
      result: 'success',
      durationMs: null,
      metadata: {
        operation: 'complete',
        reason_code: 'session-completed',
        source: 'study-session-outbox',
      },
      courseRef: null,
      unitRef: null,
      lessonRef: 'lesson-production-a',
      skillRef: null,
    }, {
      householdRef: claim().householdRef,
      curriculumVersion: '1.0.0',
    })
    expect(ports.outbox.complete).toHaveBeenCalledWith({
      outboxId: claim().outboxId,
      leaseToken: claim().leaseToken,
      operationalEventId: EVENT_ID,
    })
    const serialized = JSON.stringify(studySessionTelemetryObservationForTests(claim()))
    expect(serialized).not.toMatch(
      /learner|student|answer|transcript|prompt|response|audio|emotion|personality|diagnos|secret|error/i,
    )
  })

  it('replays safely after telemetry persisted but durable acknowledgement failed', async () => {
    const ports = dependencies()
    ports.outbox.complete
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
    ports.telemetry.record
      .mockResolvedValueOnce({ status: 'recorded', event: { eventId: EVENT_ID } })
      .mockResolvedValueOnce({ status: 'replayed', event: { eventId: EVENT_ID } })
    const worker = createStudySessionTelemetryWorker(ports)
    await expect(worker.run()).resolves.toMatchObject({
      delivered: 0, acknowledgementFailed: 1,
    })
    await expect(worker.run()).resolves.toMatchObject({
      delivered: 1, replayed: 1, acknowledgementFailed: 0,
    })
    expect(ports.telemetry.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ executionKey: claim().executionKey }),
      expect.any(Object),
    )
  })

  it.each([
    [{ status: 'not-recorded' }, 'telemetry_unavailable'],
    [{ status: 'reconciliation_conflict' }, 'reconciliation_conflict'],
  ])('keeps non-delivery %j retryable without acknowledging success', async (result, code) => {
    const ports = dependencies({ record: vi.fn(async () => result) })
    await expect(createStudySessionTelemetryWorker(ports).run()).resolves.toMatchObject({
      delivered: 0, retryScheduled: 1,
    })
    expect(ports.outbox.complete).not.toHaveBeenCalled()
    expect(ports.outbox.retry).toHaveBeenCalledWith({
      outboxId: claim().outboxId,
      leaseToken: claim().leaseToken,
      failureCode: code,
    })
  })

  it.each([
    [Object.assign(new Error('bounded'), { code: 'telemetry_input_invalid' }), 'validation_error'],
    [Object.assign(new Error('bounded'), { name: 'AbortError' }), 'timeout'],
    [new Error('must not be serialized'), 'telemetry_unavailable'],
  ])('maps delivery exceptions to bounded retry classes', async (error, code) => {
    const ports = dependencies({ record: vi.fn(async () => { throw error }) })
    await createStudySessionTelemetryWorker(ports).run()
    expect(ports.outbox.retry).toHaveBeenCalledWith(expect.objectContaining({
      failureCode: code,
    }))
    expect(JSON.stringify(ports.outbox.retry.mock.calls)).not.toContain(error.message)
  })

  it('lets an expired lease recover when retry acknowledgement is unavailable', async () => {
    const ports = dependencies({
      record: vi.fn(async () => ({ status: 'not-recorded' })),
    })
    ports.outbox.retry.mockRejectedValue(new Error('lease store offline'))
    await expect(createStudySessionTelemetryWorker(ports).run()).resolves.toMatchObject({
      delivered: 0,
      retryScheduled: 0,
      acknowledgementFailed: 1,
    })
  })
})
