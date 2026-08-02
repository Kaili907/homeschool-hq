import {
  assertExactObject,
  boundedString,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'

const PATHS = new Set([
  '/api/study/adult-review/deliver',
  '/.netlify/functions/study-adult-review-deliver',
])

export function createStudyAdultReviewDeliverHandler(overrides = {}) {
  const authorization = overrides.workerAuthorization
  const delivery = overrides.delivery
  const ready = () => authorization?.isDurable === true
    && authorization?.isReady?.() === true
    && typeof authorization.authorize === 'function'
    && delivery?.isDurable === true
    && delivery?.isReady?.() === true
    && typeof delivery.reconcile === 'function'
  return async (event) => {
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (!ready()) return errorResponse(503, 'service_not_ready')
    try {
      const body = assertExactObject(readJsonBody(event, 512), ['schemaVersion', 'action', 'jobId'])
      if (body.schemaVersion !== 2 || body.action !== 'reconcile-indeterminate') {
        return errorResponse(400, 'invalid_request')
      }
      const jobId = boundedString(body.jobId, { max: 160, singleLine: true })
      const context = await authorization.authorize({ event, trigger: 'manual' })
      if (!context?.authorized || typeof context.workerIdentity !== 'string') {
        if (typeof authorization.recordDenied === 'function') {
          await authorization.recordDenied({
            eventName: 'study.adult_review.unauthorized_worker',
            reasonCode: 'worker-auth-failed',
          })
        }
        return errorResponse(403, 'worker_not_authorized')
      }
      const result = await delivery.reconcile({ jobId, workerIdentity: context.workerIdentity })
      const state = ['delivered', 'indeterminate', 'permanent-failure'].includes(result?.state)
        ? result.state : 'indeterminate'
      return jsonResponse(200, { state })
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createStudyAdultReviewDeliverHandler()
