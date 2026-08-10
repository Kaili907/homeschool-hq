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

export function responseForRun(result, limit) {
  const counts = boundedRunCounts(result, limit)
  if (counts.claimed === 0) return resultResponse(200, 'no_work', counts)
  if (counts.failed === 0) return resultResponse(200, 'processed', counts)
  return resultResponse(
    503,
    counts.failed < counts.claimed ? 'partial_with_retryable_failures' : 'failed',
    counts,
  )
}

export function responseForSystemicError(error) {
  const unavailable = error?.name === 'AdultReviewWorkerConfigurationError'
    || [
      'durable_port_not_configured',
      'durable_port_unavailable',
      'worker_credential_not_configured',
    ].includes(error?.message)
  return resultResponse(unavailable ? 503 : 500, unavailable ? 'unavailable' : 'failed')
}
