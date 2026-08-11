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

const DELIVERY_CATEGORIES = new Set([
  'no_work',
  'processed',
  'partial_with_retryable_failures',
  'failed',
  'unavailable',
])

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function deliveryWire(value) {
  if (!DELIVERY_CATEGORIES.has(value?.category)) return UNAVAILABLE_DELIVERY
  return Object.freeze({
    schemaVersion: 1,
    category: value.category,
    claimed: count(value.claimed),
    delivered: count(value.delivered),
    replayed: count(value.replayed),
    retryScheduled: count(value.retryScheduled),
    leaseLost: count(value.leaseLost),
    acknowledgementFailed: count(value.acknowledgementFailed),
  })
}

function healthWire(value, deliveryResultCategory) {
  if (!['available', 'unavailable'].includes(value?.worker)) {
    return Object.freeze({ ...UNAVAILABLE_HEALTH, deliveryResultCategory })
  }
  return Object.freeze({
    schemaVersion: 1,
    worker: value.worker,
    pendingCount: null,
    oldestPendingAgeBucket: null,
    deliveryResultCategory,
  })
}

export function studySessionTelemetryDeliveryWireResult(value) {
  const delivery = deliveryWire(value?.delivery)
  return Object.freeze({
    schemaVersion: 1,
    delivery,
    health: healthWire(value?.health, delivery.category),
  })
}

export function unavailableStudySessionTelemetryDeliveryResult() {
  return Object.freeze({
    schemaVersion: 1,
    delivery: UNAVAILABLE_DELIVERY,
    health: UNAVAILABLE_HEALTH,
  })
}

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
      return unavailableStudySessionTelemetryDeliveryResult()
    }

    let delivery
    try {
      delivery = deliveryWire(await worker.run({ limit, leaseSeconds }))
    } catch {
      return unavailableStudySessionTelemetryDeliveryResult()
    }

    let health
    try {
      health = healthWire(
        await worker.health({ deliveryResultCategory: delivery.category }),
        delivery.category,
      )
    } catch {
      health = healthWire(null, delivery.category)
    }
    return Object.freeze({ schemaVersion: 1, delivery, health })
  }
}

export const runProductionStudySessionTelemetryDelivery =
  createStudySessionTelemetryDeliveryEntrypoint()
