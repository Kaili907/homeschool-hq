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

  it('bounds unexpected worker and health failures without raw errors', async () => {
    const runFailure = createStudySessionTelemetryDeliveryEntrypoint({
      createWorker: () => ({
        run: async () => { throw new Error('learner transcript database secret') },
        health: vi.fn(),
      }),
    })
    const failedRun = await runFailure()
    expect(failedRun.delivery.category).toBe('unavailable')
    expect(JSON.stringify(failedRun)).not.toMatch(/learner|transcript|database|secret/i)

    const healthFailure = createStudySessionTelemetryDeliveryEntrypoint({
      createWorker: () => ({
        run: async () => DELIVERY,
        health: async () => { throw new Error('provider raw object') },
      }),
    })
    const failedHealth = await healthFailure()
    expect(failedHealth.delivery.category).toBe('processed')
    expect(failedHealth.health).toMatchObject({
      worker: 'unavailable',
      deliveryResultCategory: 'processed',
    })
    expect(JSON.stringify(failedHealth)).not.toMatch(/provider|raw|object/i)
  })
})
