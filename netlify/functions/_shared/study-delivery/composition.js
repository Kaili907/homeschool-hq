import { createSupabaseStudySafetyPorts } from '../study-adult-review/supabase-ports.js'
import { createDurableInAppProvider } from './in-app-provider.js'
import { createSupabaseInAppPersistence } from './supabase-in-app.js'

/**
 * A6-5 — the composition root for the durable in-app adult-notification route.
 *
 * Before this module the provider existed but was never constructed outside
 * tests, and its policy argument defaulted to 'not-approved' in code. Here the
 * policy is read from the Director-owned database record on every construction
 * (public.academy_study_adult_review_readiness_v2 →
 * academy_private.study_production_policy), so flipping that row to 'approved'
 * is sufficient — no code change, no redeploy of this module's logic.
 *
 * The database still independently refuses delivery
 * (STUDY_ADULT_REVIEW_POLICY_NOT_APPROVED in
 * public.academy_study_deliver_in_app_notification_v2), so an unreadable or
 * stale policy here cannot open the route: this is a second gate, not the gate.
 */
export async function createConfiguredInAppProvider(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const ports = options.ports ?? createSupabaseStudySafetyPorts({ env, fetchImpl })
  const persistence = options.persistence ?? createSupabaseInAppPersistence({
    env,
    fetchImpl,
    leaseContext: options.leaseContext,
  })

  let policy = 'not-approved'
  let reasonCode = null
  try {
    const readiness = await ports.readAdultReviewReadiness()
    policy = readiness.adultReviewInAppDeliveryPolicy === 'approved' ? 'approved' : 'not-approved'
    if (policy !== 'approved') reasonCode = 'director-policy-approval-required'
  } catch {
    reasonCode = 'adult-review-readiness-unavailable'
  }

  const provider = createDurableInAppProvider({
    persistence,
    adultReviewInAppDeliveryPolicy: policy,
    environment: options.environment ?? env.NODE_ENV,
  })
  return Object.freeze({ provider, policy, reasonCode })
}
