import { createHash } from 'node:crypto'
import {
  assertExactObject,
  boundedString,
  envFlagEnabled,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { createGuardianNotificationPort } from './_shared/study-adult-review/guardian-notifications.js'
import { createSupabaseStudySafetyPorts } from './_shared/study-adult-review/supabase-ports.js'
import { verifySupabaseBearer } from './_shared/supabase-auth.js'

const PATHS = new Set([
  '/api/study/parent-notifications',
  '/.netlify/functions/study-parent-notifications',
])

function actorRef(userId) {
  return `actor:${createHash('sha256').update(userId).digest('hex')}`
}

export function createStudyParentNotificationsHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authVerifier = overrides.authVerifier ?? verifySupabaseBearer
  const notifications = overrides.notifications
    ?? createGuardianNotificationPort({ env, fetchImpl })
  const rateLimiter = overrides.rateLimiter
  const adultReviewReadiness = overrides.adultReviewReadiness
    ?? createSupabaseStudySafetyPorts({ env, fetchImpl }).readAdultReviewReadiness

  /**
   * A6-5: the adult surface must be told when in-app delivery is still refused
   * by the Director-owned database policy. An unreadable policy is reported as
   * unknown-and-not-approved, never silently as approved.
   */
  async function deliveryState() {
    try {
      const readiness = await adultReviewReadiness()
      return {
        policy: readiness.adultReviewInAppDeliveryPolicy,
        state: readiness.adultReviewInAppDeliveryPolicy === 'approved' && readiness.state === 'ready'
          ? 'delivering'
          : 'pending-approval',
      }
    } catch {
      return { policy: 'unknown', state: 'pending-approval' }
    }
  }
  const ready = () => notifications?.isDurable === true
    && notifications?.isReady?.() === true
    && rateLimiter?.isDurable === true
    && rateLimiter?.isReady?.() === true

  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (!['GET', 'POST'].includes(event?.httpMethod)) {
      return errorResponse(405, 'method_not_allowed', { allow: 'GET, POST' })
    }
    try {
      const auth = await authVerifier(event, { env, fetchImpl, timeoutMs: 3_000 })
      if (!auth.ok) return auth.response
      if (!ready()) return errorResponse(503, 'service_not_ready')
      const limited = await rateLimiter.reserve({
        scope: 'parent-notification-read',
        actorRef: actorRef(auth.user.id),
      })
      if (!limited.allowed) {
        return errorResponse(429, 'rate_limit_threshold', {
          'retry-after': String(limited.retryAfterSeconds),
        })
      }
      if (event.httpMethod === 'GET') {
        const [result, capture, delivery] = await Promise.all([
          notifications.list({ accessToken: auth.accessToken, limit: 50 }),
          typeof notifications.listPendingReviews === 'function'
            ? notifications.listPendingReviews({ accessToken: auth.accessToken, limit: 50 })
            : { state: 'unavailable', reasonCode: 'capture-read-path-not-implemented' },
          deliveryState(),
        ])
        return jsonResponse(200, {
          schemaVersion: 1,
          notifications: result.notifications,
          capture,
          delivery,
        })
      }
      const body = assertExactObject(readJsonBody(event, 512), [
        'schemaVersion', 'action', 'notificationId',
      ])
      if (body.schemaVersion !== 1 || body.action !== 'mark-read') {
        return errorResponse(400, 'invalid_request')
      }
      const notificationRef = boundedString(body.notificationId, { max: 160, singleLine: true })
      const result = await notifications.markRead({
        accessToken: auth.accessToken,
        notificationRef,
      })
      return jsonResponse(200, result)
    } catch (error) {
      if (error instanceof Error && error.message === 'guardian_notification_not_available') {
        return errorResponse(403, 'not_available')
      }
      return responseForError(error)
    }
  }
}

export const handler = createStudyParentNotificationsHandler()
