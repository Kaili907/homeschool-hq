import { describe, expect, it, vi } from 'vitest'
import { createAdminSafetyReader, decodeSafetyCursor } from './admin-safety-reader.js'

function metric(value) {
  return { status: 'available', value }
}

function event(index, overrides = {}) {
  return {
    schemaVersion: 1,
    eventRef: `operational:event-${index}`,
    source: 'operational-telemetry',
    learner: { reference: `20000000-0000-4000-8000-00000000000${index}`, displayName: `Learner ${index}` },
    occurredAt: `2026-08-08T12:00:0${index}.000Z`,
    engine: 'study',
    versionSnapshot: { appVersion: 'app-1', engineVersion: 'study-2', curriculumVersion: null },
    evidenceCategory: 'safety-stop',
    reasonCode: 'study-safety-stop',
    state: 'unknown',
    resolution: { state: 'unknown' },
    history: [],
    ...overrides,
  }
}

function projection(events) {
  return {
    observedAt: '2026-08-08T13:00:00.000Z',
    summary: {
      openSafetyStops: metric(0), resolvedSafetyStops: metric(0),
      adultReviewPending: metric(0), failClosedEvents: metric(0),
      safetyStopEvents: metric(events.length), fallbackRejectionEvents: metric(0),
      unresolvedSafetyConditions: metric(0),
    },
    sources: [
      { source: 'operational-telemetry', status: 'available' },
      { source: 'study-adult-review', status: 'available' },
      { source: 'study-safety-monitoring', status: 'available' },
    ],
    operationalTelemetry: { status: 'available' },
    events,
  }
}

function clientResult(data, error = null) {
  const abortSignal = vi.fn(async () => ({ data, error }))
  return { client: { rpc: vi.fn(() => ({ abortSignal })) }, abortSignal }
}

describe('ADMIN-10B server safety reader', () => {
  it('calls only the narrow safety:read RPC and emits deterministic pagination', async () => {
    const { client } = clientResult(projection([event(3), event(2), event(1)]))
    const reader = createAdminSafetyReader({ client })
    const result = await reader.read({ limit: 2, cursor: null })
    expect(client.rpc).toHaveBeenCalledWith('academy_admin_read_safety_operations_v1', {
      p_limit: 3,
      p_before_at: null,
      p_before_ref: null,
      p_household_id: null,
      p_learner_id: null,
      p_required_capability: 'safety:read',
    })
    expect(result.events).toHaveLength(2)
    expect(result.page.nextCursor).toEqual(expect.any(String))
    expect(decodeSafetyCursor(result.page.nextCursor)).toEqual({
      occurredAt: result.events[1].occurredAt,
      eventRef: result.events[1].eventRef,
    })
  })

  it('supports a full 100-event page with a separately validated lookahead row', async () => {
    const events = Array.from({ length: 101 }, (_, index) => event((index % 9) + 1, {
      eventRef: `operational:full-page-${String(index).padStart(3, '0')}`,
      occurredAt: `2026-08-08T12:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
    }))
    const { client } = clientResult(projection(events))
    const result = await createAdminSafetyReader({ client }).read({ limit: 100 })
    expect(result.events).toHaveLength(100)
    expect(result.page.nextCursor).toEqual(expect.any(String))
  })

  it('copies only bounded DTO fields and maps unknown reasons to safe copy', async () => {
    const sentinel = 'private conversation journal adult note provider body raw metadata bearer token'
    const unsafe = event(1, {
      reasonCode: `raw-error:${sentinel}`,
      conversation: sentinel,
      journalText: sentinel,
      adultPrivateNote: sentinel,
      metadata: { raw: sentinel },
      exception: sentinel,
      history: Array.from({ length: 80 }, (_, index) => ({
        occurredAt: `2026-08-07T12:${String(index % 60).padStart(2, '0')}:00.000Z`, state: 'unknown', reasonCode: sentinel,
      })),
    })
    const { client } = clientResult(projection([unsafe]))
    const result = await createAdminSafetyReader({ client }).read({ limit: 10 })
    const wire = JSON.stringify(result)
    expect(result.events[0].reasonCode).toBe('unknown-safety-condition')
    expect(result.events[0].history).toHaveLength(50)
    expect(wire).not.toContain(sentinel)
    expect(wire).not.toContain('conversation')
    expect(wire).not.toContain('metadata')
  })

  it('keeps legitimate zero available and source failure unavailable', async () => {
    const success = clientResult(projection([]))
    const result = await createAdminSafetyReader({ client: success.client }).read({ limit: 50 })
    expect(result.summary.safetyStopEvents).toEqual(metric(0))
    expect(result.events).toEqual([])
    expect(result.page.nextCursor).toBeNull()

    const failure = clientResult(null, { code: 'XX000', message: 'raw SQL failure' })
    await expect(createAdminSafetyReader({ client: failure.client }).read({ limit: 50 }))
      .rejects.toThrow('safety_source_unavailable')
  })

  it('fails closed on malformed rows instead of returning partial unsafe data', async () => {
    const malformed = projection([{ ...event(1), eventRef: 'contains spaces' }])
    const { client } = clientResult(malformed)
    await expect(createAdminSafetyReader({ client }).read({ limit: 50 }))
      .rejects.toThrow('safety_source_unavailable')
  })

  it('rejects malformed, excessive, or non-canonical cursors', () => {
    expect(decodeSafetyCursor('not-json')).toBeNull()
    expect(decodeSafetyCursor('x'.repeat(513))).toBeNull()
    const bad = Buffer.from(JSON.stringify({ at: 'not-time', ref: 'event one' })).toString('base64url')
    expect(decodeSafetyCursor(bad)).toBeNull()
  })
})
