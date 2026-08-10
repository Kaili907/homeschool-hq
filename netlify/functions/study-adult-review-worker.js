import {
  assertExactObject,
  boundedInteger,
  envFlagEnabled,
  errorResponse,
  GatewayError,
  hasQuery,
  jsonResponse,
  readJsonBody,
} from './_shared/http.js'
import { createProductionAdultReviewWorkerComposition } from './_shared/study-adult-review-operations/composition.js'

const PATHS = new Set([
  '/api/study/adult-review/worker',
  '/.netlify/functions/study-adult-review-worker',
])

const EMPTY_RESULT = Object.freeze({ claimed: 0, delivered: 0, indeterminate: 0, failed: 0 })

function resultResponse(statusCode, status, counts = EMPTY_RESULT) {
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

function responseForRun(result, limit) {
  const counts = boundedRunCounts(result, limit)
  if (counts.claimed === 0) return resultResponse(200, 'no_work', counts)
  if (counts.failed === 0) return resultResponse(200, 'processed', counts)
  return resultResponse(
    503,
    counts.failed < counts.claimed ? 'partial_with_retryable_failures' : 'failed',
    counts,
  )
}

function responseForSystemicError(error) {
  const unavailable = error?.name === 'AdultReviewWorkerConfigurationError'
    || [
      'durable_port_not_configured',
      'durable_port_unavailable',
      'worker_credential_not_configured',
    ].includes(error?.message)
  return resultResponse(unavailable ? 503 : 500, unavailable ? 'unavailable' : 'failed')
}

export function createStudyAdultReviewWorkerHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const injected = overrides.worker !== undefined || overrides.workerAuthorization !== undefined
  const compose = overrides.compose ?? createProductionAdultReviewWorkerComposition
  let pending = null

  /**
   * The production graph is built lazily and fail-closed. Nothing is
   * constructed at module import time, so a missing or malformed production
   * prerequisite surfaces as 503 unavailable rather than a module-load
   * 500, and no partially started worker can exist. A failed attempt is not
   * cached, so a transient durable outage does not wedge the deployment.
   */
  async function composition() {
    if (injected) {
      return { worker: overrides.worker, authorization: overrides.workerAuthorization }
    }
    if (!pending) pending = compose({ env }).catch(() => null)
    const composed = await pending
    if (!composed) {
      pending = null
      return {}
    }
    return { worker: composed.worker, authorization: composed.workerAuthorization }
  }

  const ready = (worker, authorization) => typeof worker?.ready === 'function'
    && typeof worker.run === 'function'
    && authorization?.isDurable === true
    && authorization?.isReady?.() === true
    && typeof authorization.credentialForEvent === 'function'

  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    const { worker, authorization } = await composition()
    if (!ready(worker, authorization)) return resultResponse(503, 'unavailable')
    try {
      let limit = 10
      const body = assertExactObject(readJsonBody(event, 512), ['schemaVersion', 'action'], ['limit'])
      if (body.schemaVersion !== 2 || body.action !== 'process-pending') {
        return errorResponse(400, 'invalid_request')
      }
      if (body.limit !== undefined) limit = boundedInteger(body.limit, 1, 50)
      // This public endpoint is manual-only until a separate platform-private
      // scheduled entrypoint is activated. x-nf-event and all other trigger
      // claims are inert; only the server-held bearer secret authorizes it.
      const trigger = 'manual'
      const credentialContext = await authorization.credentialForEvent({ event, trigger })
      if (
        !credentialContext?.authorized ||
        typeof credentialContext.workerCredential !== 'string' ||
        credentialContext.workerCredential.length < 32 ||
        credentialContext.workerCredential.length > 512 ||
        Object.hasOwn(credentialContext, 'workerIdentity')
      ) {
        if (typeof authorization.recordDenied === 'function') {
          await authorization.recordDenied({
            eventName: 'study.adult_review.unauthorized_worker',
            reasonCode: 'worker-auth-failed',
          })
        }
        return errorResponse(403, 'worker_not_authorized')
      }
      return responseForRun(await worker.run({
        trigger,
        workerCredential: credentialContext.workerCredential,
        limit,
      }, { limit }), limit)
    } catch (error) {
      if (error instanceof GatewayError) return errorResponse(error.statusCode, error.code)
      return responseForSystemicError(error)
    }
  }
}

export const handler = createStudyAdultReviewWorkerHandler()
