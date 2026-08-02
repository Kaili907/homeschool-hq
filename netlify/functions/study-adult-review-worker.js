import {
  assertExactObject,
  boundedInteger,
  errorResponse,
  getHeader,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'

const PATHS = new Set([
  '/api/study/adult-review/worker',
  '/.netlify/functions/study-adult-review-worker',
])

export function createStudyAdultReviewWorkerHandler(overrides = {}) {
  const worker = overrides.worker
  const authorization = overrides.workerAuthorization
  const ready = () => worker?.ready && typeof worker.run === 'function'
    && authorization?.isDurable === true
    && authorization?.isReady?.() === true
    && typeof authorization.credentialForEvent === 'function'

  return async (event) => {
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    if (!ready()) return errorResponse(503, 'service_not_ready')
    try {
      const scheduled = getHeader(event.headers, 'x-nf-event') === 'schedule'
      let limit = 10
      if (!scheduled) {
        const body = assertExactObject(readJsonBody(event, 512), ['schemaVersion', 'action'], ['limit'])
        if (body.schemaVersion !== 2 || body.action !== 'process-pending') {
          return errorResponse(400, 'invalid_request')
        }
        if (body.limit !== undefined) limit = boundedInteger(body.limit, 1, 50)
      }
      const trigger = scheduled ? 'scheduled' : 'manual'
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
