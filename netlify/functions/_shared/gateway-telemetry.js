import { createHash } from 'node:crypto'
import { createServerOperationalTelemetryWriter } from './operational-telemetry-writer.js'

const NO_REFERENCES = Object.freeze({
  courseRef: null,
  unitRef: null,
  lessonRef: null,
  skillRef: null,
})

function trustedScope(authority) {
  if (
    authority?.householdAttribution === 'resolved' &&
    typeof authority.householdRef === 'string'
  ) {
    return { scope: 'household', householdRef: authority.householdRef, learnerRef: null }
  }
  return { scope: 'system', householdRef: null, learnerRef: null }
}

function secondaryExecutionKey(requestKey, engine) {
  return `${engine}-${createHash('sha256').update(requestKey).digest('hex')}`
}

/** Bind TEL-FOUNDATION's writer to the gateway service-role client. */
export function createGatewayOperationalTelemetry({ env, access, onPersistenceFailure } = {}) {
  if (!access || typeof access.createOperationalTelemetryStore !== 'function') return null
  return createServerOperationalTelemetryWriter({
    env,
    store: access.createOperationalTelemetryStore(),
    resolveScope: async (authority) => trustedScope(authority),
    resolveCurriculumVersion: async () => null,
    onPersistenceFailure,
  })
}

function metadata({ operation, provider, route, statusCode, reasonCode, accountingAvailable }) {
  const value = {
    operation,
    provider,
    route,
    http_status: statusCode,
    reason_code: accountingAvailable === false ? 'accounting_unavailable' : reasonCode,
  }
  if (accountingAvailable === false) value.failure_stage = 'accounting_persistence'
  return value
}

export function gatewayErrorTerminal(error) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500
  const reasonCode = typeof error?.code === 'string' ? error.code : 'internal_error'
  let result = 'provider_error'
  if ([400, 413, 415, 422].includes(statusCode)) result = 'validation_error'
  else if (statusCode === 408 || statusCode === 504) result = 'timeout'
  else if (statusCode >= 400 && statusCode < 500) result = 'rejected'
  return {
    result,
    statusCode,
    reasonCode,
  }
}

/** Record a gateway outcome and, only for trusted Jarvis mode, a Jarvis turn. */
export async function recordGatewayTerminal(telemetry, {
  requestKey, authority, mode, operation, provider, route, result,
  statusCode, durationMs, reasonCode, accountingAvailable,
}) {
  if (!telemetry || typeof telemetry.record !== 'function') return Object.freeze([])
  const common = {
    result,
    durationMs,
    metadata: metadata({
      operation, provider, route, statusCode, reasonCode, accountingAvailable,
    }),
    ...NO_REFERENCES,
  }
  const observations = [{
    executionKey: requestKey,
    engine: 'gateway',
    eventType: 'gateway.request',
    ...common,
  }]
  if (mode === 'jarvis') {
    observations.push({
      executionKey: secondaryExecutionKey(requestKey, 'jarvis'),
      engine: 'jarvis',
      eventType: 'jarvis.turn',
      ...common,
    })
  }

  const receipts = []
  for (const observation of observations) {
    try {
      receipts.push(await telemetry.record(observation, authority))
    } catch {
      receipts.push({ status: 'not-recorded', executionKey: observation.executionKey })
    }
  }
  return Object.freeze(receipts)
}
