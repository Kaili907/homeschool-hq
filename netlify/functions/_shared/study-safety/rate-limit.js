/** Contract for an atomic cross-instance limiter supplied by production infrastructure. */
export function validRateLimitPort(port, requireDurable = true) {
  return Boolean(
    port &&
    typeof port.reserve === 'function' &&
    typeof port.isReady === 'function' &&
    port.isReady() === true &&
    (!requireDurable || port.isDurable === true),
  )
}

/** Test-only fixed-window limiter; never satisfies production durability readiness. */
export function createInMemoryRateLimitPort(options = {}) {
  const limit = options.limit ?? 20
  const windowMs = options.windowMs ?? 60_000
  const cells = new Map()
  return Object.freeze({
    isDurable: false,
    isReady: () => true,
    async reserve({ actorRef, scope, now }) {
      const key = `${scope}:${actorRef}`
      const prior = cells.get(key)
      const current = !prior || now >= prior.resetAt ? { count: 0, resetAt: now + windowMs } : prior
      if (current.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
      }
      current.count += 1
      cells.set(key, current)
      return { allowed: true }
    },
  })
}

export function rateLimitActorRef(userId, env = process.env) {
  const key = typeof env.STUDY_SAFETY_RATE_LIMIT_HMAC_KEY === 'string'
    ? env.STUDY_SAFETY_RATE_LIMIT_HMAC_KEY.trim()
    : ''
  if (!key) return null
  return `actor:${createHmac('sha256', key).update(userId, 'utf8').digest('hex')}`
}
import { createHmac } from 'node:crypto'
