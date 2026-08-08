import { envFlagEnabled, errorResponse, jsonResponse, responseForError } from './_shared/http.js'
import { createProductionAdultReviewWorkerComposition } from './_shared/study-adult-review-operations/composition.js'
import { createNetlifyScheduledWorkerAuthorization } from './_shared/study-worker/credential.js'

/**
 * First-party SCHEDULED adult-review delivery worker.
 *
 * Netlify runs a function that has a schedule configured on that schedule, and
 * does not accept incoming web requests for it. That platform path exclusivity
 * is this function's authority -- not a token, not a signature, not
 * `x-nf-event`, not a custom header. Nothing a caller can send arrives here at
 * all, which is a stronger statement than any header check could make.
 *
 * The consequence for this file is a prohibition rather than a permission: it
 * reads no path, no HTTP method, no query, no body, and no header, and it
 * never touches the manual invocation secret. A scheduled invocation carries
 * no caller-controlled input, so there is nothing here to validate and nothing
 * to be steered by. The handler does not even accept the event argument.
 *
 * Manual, operator-driven runs keep their own entrypoint
 * (`study-adult-review-worker.js`), which stays publicly routed and stays
 * authenticated by a server-held secret. The two never share authority.
 */

// Netlify caps a scheduled invocation at 30 seconds. One in-app delivery costs
// several sequential durable round trips (claim, lease proof, attempt, renew,
// deliver, verify), so the batch stays deliberately small: a full batch has to
// finish inside that ceiling, and anything still pending is picked up by the
// next run five minutes later rather than being cut off mid-delivery.
const SCHEDULED_BATCH_LIMIT = 4

export function createStudyAdultReviewScheduledWorkerHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const injected = overrides.worker !== undefined || overrides.workerAuthorization !== undefined
  const compose = overrides.compose ?? createProductionAdultReviewWorkerComposition
  let pending = null

  /**
   * Same fail-closed lazy composition as the manual entrypoint: nothing is
   * constructed at module import time, so a missing or malformed production
   * prerequisite surfaces as 503 rather than a module-load crash, and a failed
   * attempt is not cached so a transient durable outage does not wedge the
   * schedule until the next deploy.
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
    // The scheduled authority is built here, from the environment, rather than
    // taken from the composed graph: the graph's `workerAuthorization` is the
    // MANUAL one, and this path must never hold it.
    return {
      worker: composed.worker,
      authorization: createNetlifyScheduledWorkerAuthorization({ env }),
    }
  }

  const ready = (worker, authorization) => worker?.ready && typeof worker.run === 'function'
    && authorization?.isDurable === true
    && authorization?.isReady?.() === true
    && typeof authorization.credentialForEvent === 'function'

  return async () => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    const { worker, authorization } = await composition()
    if (!ready(worker, authorization)) return errorResponse(503, 'service_not_ready')
    try {
      const trigger = 'scheduled'
      const credentialContext = await authorization.credentialForEvent({ trigger })
      if (
        !credentialContext?.authorized ||
        typeof credentialContext.workerCredential !== 'string' ||
        credentialContext.workerCredential.length < 32 ||
        credentialContext.workerCredential.length > 512 ||
        Object.hasOwn(credentialContext, 'workerIdentity')
      ) {
        return errorResponse(403, 'worker_not_authorized')
      }
      await worker.run({
        trigger,
        workerCredential: credentialContext.workerCredential,
        limit: SCHEDULED_BATCH_LIMIT,
      }, { limit: SCHEDULED_BATCH_LIMIT })
      // Per-run counts stay in monitoring. No operator reads a scheduled
      // response, so publishing claimed/delivered/failed figures here would put
      // worker internals on an HTTP surface for no reader at all.
      return jsonResponse(200, { status: 'processed' })
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createStudyAdultReviewScheduledWorkerHandler()
