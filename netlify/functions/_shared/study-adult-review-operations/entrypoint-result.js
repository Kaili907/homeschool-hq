import { jsonResponse } from '../http.js'

export const EMPTY_WORKER_RESULT = Object.freeze({
  claimed: 0,
  delivered: 0,
  indeterminate: 0,
  failed: 0,
})

export function resultResponse(statusCode, status, counts = EMPTY_WORKER_RESULT) {
  return jsonResponse(statusCode, { status, ...counts })
}

function boundedRunCounts(result, limit) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('worker_run_contract')
  }
  const counts = {}
  for (const field of ['claimed', 'delivered', 'indeterminate', 'failed']) {
    const value = result[field]
    if (!Number.isSafeInteger(value) || value < 0 || value > limit) {
      throw new Error('worker_run_contract')
    }
    counts[field] = value
  }
  if (counts.delivered + counts.indeterminate + counts.failed > counts.claimed) {
    throw new Error('worker_run_contract')
  }
  return Object.freeze(counts)
}

function boundedTerminalFailures(result, limit, counts) {
  const value = result.cancelled ?? 0
  if (!Number.isSafeInteger(value) || value < 0 || value > limit) {
    throw new Error('worker_run_contract')
  }
  if (value + counts.failed > counts.claimed) throw new Error('worker_run_contract')
  return value
}

export function outcomeForRun(result, limit) {
  const counts = boundedRunCounts(result, limit)
  const terminalFailureCount = boundedTerminalFailures(result, limit, counts)
  const status = counts.claimed === 0
    ? 'no_work'
    : counts.failed === 0
      ? 'processed'
      : counts.failed < counts.claimed
        ? 'partial_with_retryable_failures'
        : 'failed'
  return Object.freeze({
    statusCode: status === 'no_work' || status === 'processed' ? 200 : 503,
    status,
    reasonCode: status === 'no_work'
      ? 'no-work'
      : status === 'processed'
        ? 'completed'
        : 'retryable-failures',
    counts,
    evidenceCounts: Object.freeze({
      claimedCount: counts.claimed,
      processedCount: counts.claimed - counts.failed - terminalFailureCount,
      retryableFailureCount: counts.failed,
      terminalFailureCount,
    }),
  })
}

export function outcomeForSystemicError(error) {
  const unavailable = error?.name === 'AdultReviewWorkerConfigurationError'
    || [
      'durable_port_not_configured',
      'durable_port_unavailable',
      'worker_credential_not_configured',
    ].includes(error?.message)
  return Object.freeze({
    statusCode: unavailable ? 503 : 500,
    status: unavailable ? 'unavailable' : 'failed',
    reasonCode: unavailable ? 'dependency-unavailable' : 'systemic-failure',
    counts: EMPTY_WORKER_RESULT,
    evidenceCounts: Object.freeze({
      claimedCount: 0,
      processedCount: 0,
      retryableFailureCount: 0,
      terminalFailureCount: 0,
    }),
  })
}

export function responseForOutcome(outcome) {
  return resultResponse(outcome.statusCode, outcome.status, outcome.counts)
}

export function responseForRun(result, limit) {
  return responseForOutcome(outcomeForRun(result, limit))
}

export function responseForSystemicError(error) {
  return responseForOutcome(outcomeForSystemicError(error))
}
