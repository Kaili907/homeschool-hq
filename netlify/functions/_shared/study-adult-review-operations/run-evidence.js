import { randomUUID } from 'node:crypto'
import {
  outcomeForRun,
  outcomeForSystemicError,
  responseForOutcome,
  resultResponse,
} from './entrypoint-result.js'

const RUN_KEYS = Object.freeze([
  'runId', 'startedAt', 'completedAt', 'resultCategory', 'claimedCount',
  'processedCount', 'retryableFailureCount', 'terminalFailureCount',
  'invocationKind', 'reasonCode',
])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WORKER_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const RESULT_CATEGORIES = new Set([
  'no_work', 'processed', 'partial_with_retryable_failures', 'failed', 'unavailable',
])
const REASONS_FOR_RESULT = Object.freeze({
  no_work: Object.freeze(['no-work']),
  processed: Object.freeze(['completed']),
  partial_with_retryable_failures: Object.freeze(['retryable-failures']),
  failed: Object.freeze(['retryable-failures', 'systemic-failure']),
  unavailable: Object.freeze(['dependency-unavailable']),
})

function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

function validTimestamp(value) {
  return typeof value === 'string' && TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
}

function validateRunReceipt(value) {
  if (
    !exactObject(value, RUN_KEYS) ||
    !UUID.test(value.runId) ||
    !validTimestamp(value.startedAt) ||
    !validTimestamp(value.completedAt) ||
    Date.parse(value.completedAt) < Date.parse(value.startedAt) ||
    !RESULT_CATEGORIES.has(value.resultCategory) ||
    !['scheduled', 'manual'].includes(value.invocationKind) ||
    typeof value.reasonCode !== 'string' ||
    !REASONS_FOR_RESULT[value.resultCategory].includes(value.reasonCode)
  ) throw new Error('worker_run_evidence_contract')
  for (const field of [
    'claimedCount', 'processedCount', 'retryableFailureCount', 'terminalFailureCount',
  ]) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 0 || value[field] > 50) {
      throw new Error('worker_run_evidence_contract')
    }
  }
  if (
    value.processedCount + value.retryableFailureCount + value.terminalFailureCount
      !== value.claimedCount
  ) throw new Error('worker_run_evidence_contract')
  return Object.freeze({ ...value })
}

function isoInstant(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('worker_run_evidence_clock')
  return date.toISOString()
}

function receiptFor({ runId, startedAt, completedAt, invocationKind, outcome }) {
  return validateRunReceipt({
    runId,
    startedAt,
    completedAt,
    resultCategory: outcome.status,
    ...outcome.evidenceCounts,
    invocationKind,
    reasonCode: outcome.reasonCode,
  })
}

export function createSupabaseAdultReviewRunEvidence(options = {}) {
  const rpc = options.rpc
  const workerIdentity = options.workerIdentity
  const credentialVersion = options.credentialVersion
  const configured = rpc?.isConfigured?.() === true
    && WORKER_REF.test(workerIdentity)
    && WORKER_REF.test(credentialVersion)
  const workerContext = Object.freeze({ workerIdentity, credentialVersion })

  return Object.freeze({
    isDurable: true,
    isReady: () => configured,
    async record(receipt) {
      if (!configured) throw new Error('durable_port_not_configured')
      const result = await rpc.call(
        'academy_study_record_adult_review_worker_run_v1',
        { p_worker_id: workerIdentity, p_run: validateRunReceipt(receipt) },
        { requireWorkerCredential: true, workerContext },
      )
      if (!exactObject(result, ['recorded', 'replayed'])
        || result.recorded !== true || typeof result.replayed !== 'boolean') {
        throw new Error('durable_port_contract')
      }
      return Object.freeze({ recorded: true, replayed: result.replayed })
    },
  })
}

export async function executeAdultReviewWorkerRun(options) {
  const now = options.now ?? (() => new Date())
  const createRunId = options.createRunId ?? randomUUID
  const runId = createRunId()
  if (!UUID.test(runId)) throw new Error('worker_run_evidence_identity')
  const startedAt = isoInstant(now())
  let outcome
  try {
    const result = await options.worker.run({
      trigger: options.invocationKind,
      workerCredential: options.workerCredential,
      limit: options.limit,
    }, { limit: options.limit })
    outcome = outcomeForRun(result, options.limit)
  } catch (error) {
    outcome = outcomeForSystemicError(error)
  }
  const completedAt = isoInstant(now())

  try {
    await options.runEvidence.record(receiptFor({
      runId,
      startedAt,
      completedAt,
      invocationKind: options.invocationKind,
      outcome,
    }))
  } catch {
    // A run without durable evidence cannot be reported as healthy or
    // successful. The response remains bounded and contains no database detail.
    return resultResponse(503, 'unavailable')
  }
  return responseForOutcome(outcome)
}

export const ADULT_REVIEW_RUN_EVIDENCE_KEYS = RUN_KEYS
