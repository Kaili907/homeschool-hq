import {
  assertExactObject,
  boundedInteger,
  envFlagEnabled,
  errorResponse,
  GatewayError,
  hasQuery,
  readJsonBody,
} from './_shared/http.js'
import { createProductionAdultReviewWorkerComposition } from './_shared/study-adult-review-operations/composition.js'
import {
  responseForRun,
  responseForSystemicError,
  resultResponse,
} from './_shared/study-adult-review-operations/entrypoint-result.js'
import { executeAdultReviewWorkerRun } from './_shared/study-adult-review-operations/run-evidence.js'

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
   * prerequisite surfaces as 503 unavailable rather than a module-load
   * 500, and no partially started worker can exist. A failed attempt is not
   * cached, so a transient durable outage does not wedge the deployment.
   */
  async function composition() {
    if (injected) {
      return {
        worker: overrides.worker,
        authorization: overrides.workerAuthorization,
        runEvidence: overrides.runEvidence,
      }
    }
    if (!pending) pending = compose({ env }).catch(() => null)
    const composed = await pending
    if (!composed) {
      pending = null
      return {}
    }
    return {
      worker: composed.worker,
      authorization: composed.workerAuthorization,
      runEvidence: composed.runEvidence,
    }
  }

  const ready = (worker, authorization, runEvidence) => typeof worker?.ready === 'function'
    && typeof worker.run === 'function'
    && authorization?.isDurable === true
    && authorization?.isReady?.() === true
    && typeof authorization.credentialForEvent === 'function'
    && (injected || (
      runEvidence?.isDurable === true
      && runEvidence?.isReady?.() === true
      && typeof runEvidence.record === 'function'
    ))

  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    const { worker, authorization, runEvidence } = await composition()
    if (!ready(worker, authorization, runEvidence)) return resultResponse(503, 'unavailable')
    try {
      let limit = 10
      const body = assertExactObject(readJsonBody(event, 512), ['schemaVersion', 'action'], ['limit'])
      if (body.schemaVersion !== 2 || body.action !== 'process-pending') {
        return errorResponse(400, 'invalid_request')
      }
      if (body.limit !== undefined) limit = boundedInteger(body.limit, 1, 50)
      // This public endpoint remains manual-only. Scheduling is owned by the
      // separate platform-private entrypoint; x-nf-event and all other trigger
      // claims are inert here, and only the server-held secret authorizes it.
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
      if (runEvidence) {
        return executeAdultReviewWorkerRun({
          worker,
          runEvidence,
          invocationKind: trigger,
          workerCredential: credentialContext.workerCredential,
          limit,
          now: overrides.now,
          createRunId: overrides.createRunId,
        })
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
