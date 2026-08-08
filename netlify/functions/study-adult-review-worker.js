import {
  assertExactObject,
  boundedInteger,
  envFlagEnabled,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { createProductionAdultReviewWorkerComposition } from './_shared/study-adult-review-operations/composition.js'

const PATHS = new Set([
  '/api/study/adult-review/worker',
  '/.netlify/functions/study-adult-review-worker',
])

export function createStudyAdultReviewWorkerHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const injected = overrides.worker !== undefined || overrides.workerAuthorization !== undefined
  const compose = overrides.compose ?? createProductionAdultReviewWorkerComposition
  let pending = null

  /**
   * The production graph is built lazily and fail-closed. Nothing is
   * constructed at module import time, so a missing or malformed production
   * prerequisite surfaces as 503 service_not_ready rather than a module-load
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

  const ready = (worker, authorization) => worker?.ready && typeof worker.run === 'function'
    && authorization?.isDurable === true
    && authorization?.isReady?.() === true
    && typeof authorization.credentialForEvent === 'function'

  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    const { worker, authorization } = await composition()
    if (!ready(worker, authorization)) return errorResponse(503, 'service_not_ready')
    try {
      // Unconditional. The old schedule branch skipped body validation, so a
      // bodyless public POST carrying a forged `x-nf-event` reached the
      // authorization check and bought a durable denial write for the cost of
      // an empty request. Malformed input now dies here, before any durable
      // work at all.
      let limit = 10
      const body = assertExactObject(readJsonBody(event, 512), ['schemaVersion', 'action'], ['limit'])
      if (body.schemaVersion !== 2 || body.action !== 'process-pending') {
        return errorResponse(400, 'invalid_request')
      }
      if (body.limit !== undefined) limit = boundedInteger(body.limit, 1, 50)
      // This entrypoint is manual, always. Scheduled runs live in the separate
      // scheduled entrypoint, which Netlify does not expose to web requests, so
      // no header a caller can send needs to be consulted to tell them apart --
      // and a forged `x-nf-event` is inert caller data.
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
      const result = await worker.run({
        trigger,
        workerCredential: credentialContext.workerCredential,
        limit,
      }, { limit })
      return jsonResponse(200, {
        status: 'processed',
        claimed: result.claimed ?? 0,
        delivered: result.delivered ?? 0,
        indeterminate: result.indeterminate ?? 0,
        failed: result.failed ?? 0,
      })
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createStudyAdultReviewWorkerHandler()
