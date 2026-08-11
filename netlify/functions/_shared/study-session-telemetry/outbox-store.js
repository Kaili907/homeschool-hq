const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const AUTHORITATIVE_OPERATIONS = new Set([
  'session:begin', 'session:resume', 'session:transition',
  'checkpoint:compare-and-swap',
])
const OPERATIONS = new Set([
  'begin', 'resume', 'transition', 'checkpoint', 'complete', 'abandon',
])
const REASONS = new Set([
  'session-begun', 'session-resumable', 'session-closed',
  'segment-started', 'segment-completed', 'pause-started',
  'session-resumed', 'break-requested', 'break-started', 'break-ended',
  'technical-interruption-started', 'technical-interruption-ended',
  'session-completed', 'session-abandoned', 'checkpoint-saved',
])
const FAILURE_CODES = new Set([
  'validation_error', 'timeout', 'telemetry_unavailable',
  'reconciliation_conflict',
])
const CLAIM_FIELDS = new Set([
  'outboxId', 'executionKey', 'householdRef', 'authoritativeOperation',
  'operation', 'result', 'sessionRevision', 'checkpointRevision',
  'acceptedAt', 'curriculumVersion', 'lessonRef', 'reasonCode',
  'attemptCount', 'leaseToken',
])
const READINESS_FIELDS = new Set(['schemaVersion', 'status'])

function plainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function decodeClaim(value) {
  if (!plainRecord(value)
      || Object.keys(value).length !== CLAIM_FIELDS.size
      || Object.keys(value).some((key) => !CLAIM_FIELDS.has(key))
      || !UUID.test(value.outboxId)
      || !REFERENCE.test(value.executionKey)
      || !UUID.test(value.householdRef)
      || !AUTHORITATIVE_OPERATIONS.has(value.authoritativeOperation)
      || !OPERATIONS.has(value.operation)
      || value.result !== 'success'
      || !positiveInteger(value.sessionRevision)
      || (value.checkpointRevision !== null && !positiveInteger(value.checkpointRevision))
      || (value.authoritativeOperation === 'checkpoint:compare-and-swap')
        !== (value.checkpointRevision !== null)
      || typeof value.acceptedAt !== 'string'
      || !INSTANT.test(value.acceptedAt)
      || !Number.isFinite(Date.parse(value.acceptedAt))
      || !VERSION.test(value.curriculumVersion)
      || !REFERENCE.test(value.lessonRef)
      || !REASONS.has(value.reasonCode)
      || !positiveInteger(value.attemptCount)
      || !UUID.test(value.leaseToken)) {
    throw new StudySessionTelemetryOutboxStoreError('database-contract')
  }
  return Object.freeze({ ...value })
}

function decodeReadiness(value) {
  if (!plainRecord(value)
      || Object.keys(value).length !== READINESS_FIELDS.size
      || Object.keys(value).some((key) => !READINESS_FIELDS.has(key))
      || value.schemaVersion !== 1
      || !['ready', 'not-ready'].includes(value.status)) {
    throw new StudySessionTelemetryOutboxStoreError('database-contract')
  }
  return Object.freeze({ ...value })
}

function mappedError(error) {
  if (error?.code === '42501') return 'unauthorized'
  if (['22023', '22P02', '23503', '23514'].includes(error?.code)) return 'invalid-request'
  return 'temporarily-unavailable'
}

export class StudySessionTelemetryOutboxStoreError extends Error {
  constructor(code) {
    super(code)
    this.name = 'StudySessionTelemetryOutboxStoreError'
    this.code = code
  }
}

async function rpc(client, name, parameters) {
  try {
    const { data, error } = await client.rpc(name, parameters)
    if (error) throw new StudySessionTelemetryOutboxStoreError(mappedError(error))
    return data
  } catch (error) {
    if (error instanceof StudySessionTelemetryOutboxStoreError) throw error
    throw new StudySessionTelemetryOutboxStoreError('temporarily-unavailable')
  }
}

/** Service-role adapter; the private table is never queried directly. */
export function createStudySessionTelemetryOutboxStore(client) {
  if (!client || typeof client.rpc !== 'function') {
    throw new TypeError('study_session_telemetry_outbox_store_invalid')
  }
  return Object.freeze({
    async readiness() {
      return decodeReadiness(await rpc(
        client,
        'academy_study_session_telemetry_outbox_readiness_v1',
        {},
      ))
    },

    async claim({ limit = 25, leaseSeconds = 30 } = {}) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
          || !Number.isSafeInteger(leaseSeconds)
          || leaseSeconds < 5 || leaseSeconds > 300) {
        throw new StudySessionTelemetryOutboxStoreError('invalid-request')
      }
      const value = await rpc(
        client,
        'academy_claim_study_session_telemetry_outbox_v1',
        { p_limit: limit, p_lease_seconds: leaseSeconds },
      )
      if (!Array.isArray(value)) {
        throw new StudySessionTelemetryOutboxStoreError('database-contract')
      }
      return Object.freeze(value.map(decodeClaim))
    },

    async complete({ outboxId, leaseToken, operationalEventId }) {
      if (![outboxId, leaseToken, operationalEventId].every(
        (value) => typeof value === 'string' && UUID.test(value),
      )) {
        throw new StudySessionTelemetryOutboxStoreError('invalid-request')
      }
      const completed = await rpc(
        client,
        'academy_complete_study_session_telemetry_outbox_v1',
        {
          p_outbox_id: outboxId,
          p_lease_token: leaseToken,
          p_operational_event_id: operationalEventId,
        },
      )
      if (completed !== true) {
        throw new StudySessionTelemetryOutboxStoreError('lease-lost')
      }
    },

    async retry({ outboxId, leaseToken, failureCode }) {
      if (typeof outboxId !== 'string' || !UUID.test(outboxId)
          || typeof leaseToken !== 'string' || !UUID.test(leaseToken)
          || !FAILURE_CODES.has(failureCode)) {
        throw new StudySessionTelemetryOutboxStoreError('invalid-request')
      }
      const retried = await rpc(
        client,
        'academy_retry_study_session_telemetry_outbox_v1',
        {
          p_outbox_id: outboxId,
          p_lease_token: leaseToken,
          p_failure_code: failureCode,
        },
      )
      if (retried !== true) {
        throw new StudySessionTelemetryOutboxStoreError('lease-lost')
      }
    },
  })
}
