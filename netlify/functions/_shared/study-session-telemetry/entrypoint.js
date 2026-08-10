import { createProductionStudySessionTelemetryWorker } from './production.js'

const UNAVAILABLE_DELIVERY = Object.freeze({
  schemaVersion: 1,
  category: 'unavailable',
  claimed: 0,
  delivered: 0,
  replayed: 0,
  retryScheduled: 0,
  leaseLost: 0,
  acknowledgementFailed: 0,
})

const UNAVAILABLE_HEALTH = Object.freeze({
  schemaVersion: 1,
  worker: 'unavailable',
  pendingCount: null,
  oldestPendingAgeBucket: null,
  deliveryResultCategory: 'unavailable',
})

/**
 * Server-only manual invocation seam. It emits bounded results and deliberately
 * exposes neither an HTTP handler nor scheduling policy.
 */
export function createStudySessionTelemetryDeliveryEntrypoint({
  createWorker = createProductionStudySessionTelemetryWorker,
} = {}) {
  if (typeof createWorker !== 'function') {
    throw new TypeError('study_session_telemetry_entrypoint_invalid')
  }
  return async ({ env = process.env, limit = 25, leaseSeconds = 30 } = {}) => {
    let worker
    try {
      worker = createWorker({ env })
    } catch {
      return Object.freeze({
        schemaVersion: 1,
        delivery: UNAVAILABLE_DELIVERY,
        health: UNAVAILABLE_HEALTH,
      })
    }

    const delivery = await worker.run({ limit, leaseSeconds })
    const health = await worker.health({ deliveryResultCategory: delivery.category })
    return Object.freeze({ schemaVersion: 1, delivery, health })
  }
}

export const runProductionStudySessionTelemetryDelivery =
  createStudySessionTelemetryDeliveryEntrypoint()
