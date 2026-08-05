function config(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !anonKey) return null
    return { url: url.toString().replace(/\/+$/, ''), anonKey }
  } catch {
    return null
  }
}

function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('guardian_notification_port_contract')
  }
  const actual = Object.keys(value)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error('guardian_notification_port_contract')
  }
  return value
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validateListResult(value) {
  const result = exactObject(value, ['notifications'])
  if (!Array.isArray(result.notifications) || result.notifications.length > 100) {
    throw new Error('guardian_notification_port_contract')
  }
  for (const entry of result.notifications) {
    exactObject(entry, [
      'notificationId', 'title', 'reasonCategory', 'urgency',
      'createdAt', 'deliveredAt', 'read', 'actionRef',
    ])
    if (
      !/^notification:[0-9a-f]{64}$/.test(entry.notificationId) ||
      entry.title !== 'Study check-in needs your review' ||
      !['immediate-safety', 'possible-safety', 'review-required'].includes(entry.reasonCategory) ||
      !['urgent', 'uncertain', 'review-required'].includes(entry.urgency) ||
      !validTimestamp(entry.createdAt) || !validTimestamp(entry.deliveredAt) ||
      typeof entry.read !== 'boolean' ||
      typeof entry.actionRef !== 'string' ||
      !/^adult-review:[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(entry.actionRef)
    ) throw new Error('guardian_notification_port_contract')
  }
  return result
}

function validateReadResult(value) {
  const result = exactObject(value, ['read'])
  if (result.read !== true) throw new Error('guardian_notification_port_contract')
  return result
}

/**
 * A6-5: captured-but-undelivered adult reviews. The hosted read RPC is a
 * prepared, unexecuted change (see docs/study-engine-safety/A6-5-PREPARED-HOSTED-SQL.sql).
 * Until the Director runs it, this read is reported as unavailable rather than
 * as an empty list, so an unreadable store is never shown as "nothing happened".
 */
function validatePendingResult(value) {
  const result = exactObject(value, ['pendingReviews'])
  if (!Array.isArray(result.pendingReviews) || result.pendingReviews.length > 100) {
    throw new Error('guardian_notification_port_contract')
  }
  for (const entry of result.pendingReviews) {
    exactObject(entry, [
      'reviewId', 'learnerRef', 'reasonCategory', 'urgency', 'occurredAt', 'deliveryState',
    ])
    if (
      !/^safety-proposal-[a-f0-9]{32}$/.test(entry.reviewId) ||
      typeof entry.learnerRef !== 'string' || entry.learnerRef.length > 160 ||
      !['immediate-safety', 'possible-safety', 'review-required'].includes(entry.reasonCategory) ||
      !['urgent', 'uncertain', 'review-required'].includes(entry.urgency) ||
      !validTimestamp(entry.occurredAt) ||
      !['proposed', 'accepted', 'rejected', 'cancelled', 'expired'].includes(entry.deliveryState)
    ) throw new Error('guardian_notification_port_contract')
  }
  return result
}

export function createGuardianNotificationPort(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 3_000
  const configured = config(env)

  async function call(name, parameters, accessToken) {
    if (!configured || typeof fetchImpl !== 'function' || typeof accessToken !== 'string') {
      throw new Error('guardian_notification_port_not_ready')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${configured.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          apikey: configured.anonKey,
          Authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(parameters),
      })
      if (!response.ok) throw new Error('guardian_notification_not_available')
      return await response.json()
    } catch (error) {
      if (error instanceof Error && error.message === 'guardian_notification_not_available') throw error
      throw new Error('guardian_notification_port_unavailable')
    } finally {
      clearTimeout(timer)
    }
  }

  return Object.freeze({
    isDurable: true,
    isReady: () => configured !== null && typeof fetchImpl === 'function',
    async list({ accessToken, limit = 50 }) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new TypeError('invalid_guardian_notification_limit')
      }
      return validateListResult(await call(
        'academy_study_list_parent_notifications_v1', { p_limit: limit }, accessToken,
      ))
    },
    async listPendingReviews({ accessToken, limit = 50 }) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new TypeError('invalid_guardian_notification_limit')
      }
      try {
        const result = validatePendingResult(await call(
          'academy_study_list_adult_review_proposals_v1', { p_limit: limit }, accessToken,
        ))
        return { state: 'available', pendingReviews: result.pendingReviews }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown'
        return {
          state: 'unavailable',
          reasonCode: message === 'guardian_notification_not_available'
            ? 'capture-read-path-not-authorized'
            : message === 'guardian_notification_port_contract'
              ? 'capture-read-contract-mismatch'
              : 'capture-read-path-unavailable',
        }
      }
    },
    async markRead({ accessToken, notificationRef }) {
      if (typeof notificationRef !== 'string' || !/^notification:[0-9a-f]{64}$/.test(notificationRef)) {
        throw new TypeError('invalid_guardian_notification_ref')
      }
      return validateReadResult(await call(
        'academy_study_mark_parent_notification_read_v1',
        { p_notification_ref: notificationRef }, accessToken,
      ))
    },
  })
}
