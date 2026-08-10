import { describe, expect, it, vi } from 'vitest'
import { createStudySessionTelemetryDeliveryEntrypoint } from './entrypoint.js'

const DELIVERY = Object.freeze({
  schemaVersion: 1,
  category: 'processed',
  claimed: 2,
  delivered: 2,
  replayed: 1,
  retryScheduled: 0,
  leaseLost: 0,
  acknowledgementFailed: 0,
})

describe('Study session telemetry trusted manual entrypoint', () => {
  it('runs one bounded batch and returns only delivery and health projections', async () => {
    const run = vi.fn(async () => DELIVERY)
    const health = vi.fn(async ({ deliveryResultCategory }) => ({
      schemaVersion: 1,
      worker: 'available',
      pendingCount: null,
      oldestPendingAgeBucket: null,
      deliveryResultCategory,
    }))
    const createWorker = vi.fn(() => ({ run, health }))
    const entrypoint = createStudySessionTelemetryDeliveryEntrypoint({ createWorker })
    const env = { ACADEMY_APP_VERSION: 'test' }

    await expect(entrypoint({ env, limit: 7, leaseSeconds: 45 })).resolves.toEqual({
      schemaVersion: 1,
      delivery: DELIVERY,
      health: {
        schemaVersion: 1,
        worker: 'available',
        pendingCount: null,
        oldestPendingAgeBucket: null,
        deliveryResultCategory: 'processed',
      },
    })
    expect(createWorker).toHaveBeenCalledWith({ env })
    expect(run).toHaveBeenCalledWith({ limit: 7, leaseSeconds: 45 })
    expect(health).toHaveBeenCalledWith({ deliveryResultCategory: 'processed' })
  })

  it('fails closed with a bounded unavailable result when composition is not trusted', async () => {
    const entrypoint = createStudySessionTelemetryDeliveryEntrypoint({
      createWorker: () => { throw new Error('secret raw database object') },
    })
    const result = await entrypoint()
    expect(result.delivery.category).toBe('unavailable')
    expect(result.health.worker).toBe('unavailable')
    expect(JSON.stringify(result)).not.toMatch(/secret|raw|database|exception/i)
  })
})
