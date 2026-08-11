import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  createStudySessionTelemetryScheduledEntrypoint,
  STUDY_SESSION_TELEMETRY_SCHEDULE_STATUS,
} from './scheduled.js'

const RESULT = Object.freeze({
  schemaVersion: 1,
  delivery: Object.freeze({
    schemaVersion: 1,
    category: 'processed',
    claimed: 1,
    delivered: 1,
    replayed: 0,
    retryScheduled: 0,
    leaseLost: 0,
    acknowledgementFailed: 0,
  }),
  health: Object.freeze({
    schemaVersion: 1,
    worker: 'available',
    pendingCount: null,
    oldestPendingAgeBucket: null,
    deliveryResultCategory: 'processed',
  }),
})

describe('Study session telemetry private scheduled seam', () => {
  it('has no cadence and invokes the shared production delivery entrypoint without caller input', async () => {
    const runDelivery = vi.fn(async () => RESULT)
    const scheduled = createStudySessionTelemetryScheduledEntrypoint({ runDelivery })

    await expect(scheduled({
      headers: { 'x-nf-event': 'schedule', authorization: 'forged' },
      body: JSON.stringify({ limit: 999, leaseSeconds: 999, appVersion: 'latest' }),
    })).resolves.toEqual(RESULT)
    expect(STUDY_SESSION_TELEMETRY_SCHEDULE_STATUS).toBe('not_configured')
    expect(runDelivery).toHaveBeenCalledWith()
  })

  it('keeps the scheduled seam private and unbound until cadence approval', () => {
    const config = readFileSync(new URL('../../../../netlify.toml', import.meta.url), 'utf8')
    expect(config).not.toMatch(
      /\[functions[."']+study-session-telemetry-scheduled["']*\][\s\S]*?schedule\s*=/i,
    )
    expect(existsSync(new URL('../../study-session-telemetry-scheduled.js', import.meta.url)))
      .toBe(false)
  })

  it('maps failures to unavailable without exposing raw errors', async () => {
    const scheduled = createStudySessionTelemetryScheduledEntrypoint({
      runDelivery: async () => { throw new Error('learner answer provider secret') },
    })
    const result = await scheduled()
    expect(result.delivery.category).toBe('unavailable')
    expect(result.health.worker).toBe('unavailable')
    expect(JSON.stringify(result)).not.toMatch(/learner|answer|provider|secret/i)
  })
})
