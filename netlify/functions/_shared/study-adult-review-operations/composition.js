import { createSupabaseServiceRpc, createSupabaseStudySafetyPorts } from '../study-adult-review/supabase-ports.js'
import { createDurableInAppProvider } from '../study-delivery/in-app-provider.js'
import { createSupabaseInAppPersistence } from '../study-delivery/supabase-in-app.js'
import { MONITORING_EVENT_CATALOG, createMonitoringService, createStructuredServerLog } from '../study-monitoring/monitoring.js'
import { createSupabaseAdultReviewMonitoringSink } from '../study-monitoring/supabase-sink.js'
import {
  createNetlifyScheduledWorkerAuthorization,
  createNetlifyWorkerCredentialVerifier,
  createNetlifyWorkerInvocationAuthorization,
} from '../study-worker/credential.js'
import { createSupabaseAdultReviewOperations } from './supabase-operations.js'
import { createAdultReviewWorker } from './worker.js'

/**
 * Production composition for the Netlify adult-review delivery worker.
 *
 * In-app only. Nothing here imports, constructs, or can reach an email or SMS
 * provider, and the claim schema below refuses any job whose durable route is
 * not `in-app` before a delivery attempt, a provider submission, a
 * notification insert, or any receipt work can happen.
 *
 * Delivery authority is unchanged from the reviewed C2 design: this JS writes
 * only `created` and `submitted` attempt states, and the durable delivery
 * transaction owns `provider-accepted`, the notification insert, the receipt,
 * receipt verification, and the terminal delivered state.
 */

export const ADULT_REVIEW_DELIVERY_ROUTE = 'in-app'
export const ADULT_REVIEW_PROVIDER_NAME = 'academy-in-app'
export const ADULT_REVIEW_TEMPLATE_CODE = 'study-safety-adult-review-v1'
// The composition always applies the strict production rules (no test
// provider, durable provider required, approved policy required, no test
// receipt), regardless of what NODE_ENV happens to be inside the function.
const PRODUCTION_ENVIRONMENT = 'production'

/**
 * The invocation authorities this composition may build, and the only ones.
 *
 * The manual and scheduled entrypoints differ in exactly one thing -- who is
 * allowed to start a run -- so that is the only thing injected. Everything
 * downstream (the RPC client, the operations adapter and its lease context, the
 * provider, the policy, the monitoring, the worker) is built identically for
 * both, from one graph.
 *
 * Membership is by FUNCTION IDENTITY against this frozen set, not by name or by
 * shape, so the selection cannot be reached from anything a caller can send: no
 * JSON body, header, or query can carry a function, and nothing outside these
 * two modules holds either of these references. A caller therefore cannot
 * choose the authority, and cannot smuggle in a third one that authorizes
 * itself.
 *
 * The DEFAULT is the manual authority, which fails closed: an entrypoint that
 * forgets to state its authority gets the one that demands a presented secret,
 * never the one whose authority is the platform path.
 */
const INVOCATION_AUTHORITIES = new Set([
  createNetlifyWorkerInvocationAuthorization,
  createNetlifyScheduledWorkerAuthorization,
])

// The exact key set the C2 claim projection emits, in
// `createSupabaseAdultReviewOperations().claim()`.
export const ADULT_REVIEW_CLAIM_KEYS = Object.freeze([
  'claimId', 'jobId', 'proposalId', 'householdId', 'studentId', 'templateCode',
  'recipientRef', 'routeRef', 'route', 'idempotencyKey', 'attemptId',
  'leaseToken', 'leaseGeneration', 'leaseRevision', 'leaseExpiresAt',
])

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const RECIPIENT_REF = /^recipient:[a-f0-9]{64}$/
const ROUTE_REF = /^route:[a-f0-9]{64}$/
const DELIVERY_KEY = /^delivery:[a-f0-9]{64}$/
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export class AdultReviewCompositionError extends Error {
  constructor(reason) {
    super(reason)
    this.name = 'AdultReviewCompositionError'
    this.reason = reason
  }
}

function validRef(value) {
  return typeof value === 'string' && REF.test(value)
}

// `RegExp#test` coerces its argument, so the string guard is what stops a
// hostile carrier object from presenting a durable identifier it does not hold.
function matches(pattern, value) {
  return typeof value === 'string' && pattern.test(value)
}

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

/**
 * Closed-object gate over one durable claim.
 *
 * The load-bearing check is `route === 'in-app'`. The worker runs this before
 * it resolves a recipient, renews the lease, creates a delivery attempt, or
 * reaches the provider, so an `email`, `sms`, or unknown-route job is
 * cancelled as `invalid_delivery` with no provider contact of any kind.
 */
export function createInAppAdultReviewClaimSchema() {
  return Object.freeze({
    isReady: () => true,
    route: ADULT_REVIEW_DELIVERY_ROUTE,
    safeParse(claim) {
      if (
        !exactKeys(claim, ADULT_REVIEW_CLAIM_KEYS) ||
        claim.route !== ADULT_REVIEW_DELIVERY_ROUTE ||
        claim.templateCode !== ADULT_REVIEW_TEMPLATE_CODE ||
        !validRef(claim.claimId) ||
        !validRef(claim.jobId) ||
        !validRef(claim.proposalId) ||
        !validRef(claim.householdId) ||
        !validRef(claim.studentId) ||
        !validRef(claim.attemptId) ||
        !validRef(claim.leaseToken) ||
        !matches(RECIPIENT_REF, claim.recipientRef) ||
        !matches(ROUTE_REF, claim.routeRef) ||
        !matches(DELIVERY_KEY, claim.idempotencyKey) ||
        !Number.isSafeInteger(claim.leaseGeneration) ||
        !Number.isSafeInteger(claim.leaseRevision) ||
        !matches(TIMESTAMP, claim.leaseExpiresAt)
      ) return { success: false, error: 'invalid_delivery' }
      return { success: true, data: claim }
    },
  })
}

/**
 * Pure projection. The worker already holds exactly one durable job for
 * exactly one recipient, and the durable claim already carries the opaque
 * recipient reference, so resolution is a shape assertion and nothing else:
 * no database lookup, no destination lookup, no contact value, no fan-out.
 *
 * A recipient reference that is not the reviewed opaque shape yields no
 * recipient, which the worker turns into a safe `invalid_recipient`
 * cancellation before the provider is reached.
 */
export function createInAppRecipientProjection() {
  return Object.freeze({
    isDurable: true,
    isReady: () => true,
    async resolve({ delivery } = {}) {
      const recipientRef = delivery?.recipientRef
      if (!matches(RECIPIENT_REF, recipientRef)) {
        return Object.freeze({ valid: false, status: 'invalid' })
      }
      return Object.freeze({ recipientRef })
    },
  })
}

/**
 * Narrow adapter between the worker's monitor call and the monitoring event
 * schema.
 *
 * The worker emits `workerIdentity`, `workerCredentialVersion`, and
 * `workerVerificationRef` alongside the measurement. Those are not permitted
 * input fields, so the real monitoring service rejects the worker's shape with
 * `monitoring_schema_field_not_allowed`. They are also unnecessary: the SQL
 * monitoring sink binds worker identity out-of-band from configuration, so
 * repeating it inside the event would widen the recorded surface for nothing.
 *
 * This adapter forwards only the allowed measurement fields and attaches safe
 * constant dimensions, narrowed per event to the dimensions that event's own
 * definition permits.
 */
export function createAdultReviewWorkerMonitorAdapter(monitoring) {
  const constantDimensions = {
    route: ADULT_REVIEW_DELIVERY_ROUTE,
    provider: ADULT_REVIEW_PROVIDER_NAME,
  }

  function dimensionsFor(eventName) {
    const allowed = MONITORING_EVENT_CATALOG[eventName]?.dimensions ?? []
    const dimensions = {}
    for (const [key, value] of Object.entries(constantDimensions)) {
      if (allowed.includes(key)) dimensions[key] = value
    }
    return dimensions
  }

  return Object.freeze({
    isReady: () => monitoring.isReady(),
    ready: () => monitoring.ready(),
    async record(eventName, input = {}) {
      return monitoring.record(eventName, {
        occurredAt: input.occurredAt,
        occurrences: input.occurrences,
        value: input.value,
        dimensions: dimensionsFor(eventName),
      })
    },
  })
}

function fail(reason) {
  throw new AdultReviewCompositionError(reason)
}

/**
 * Builds the production worker graph, or throws. It is never called at module
 * import time: the entrypoint calls it lazily and turns any failure into
 * `503 service_not_ready` rather than a module-load crash, so no partial
 * worker can ever start.
 */
export async function createProductionAdultReviewWorkerComposition(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  // Checked first, before a single durable round trip: an unrecognised
  // authority is a wiring mistake, and it must not be able to buy durable work
  // on its way to being refused.
  const invocationAuthority = options.invocationAuthority ?? createNetlifyWorkerInvocationAuthorization
  if (!INVOCATION_AUTHORITIES.has(invocationAuthority)) fail('unknown_invocation_authority')
  // One RPC client, one set of durable credentials, one boundary.
  const rpc = options.rpc ?? createSupabaseServiceRpc({ env, fetchImpl })
  if (rpc.isConfigured?.() !== true) fail('durable_rpc_not_configured')

  const credentialVerifier = createNetlifyWorkerCredentialVerifier({ env })
  if (credentialVerifier.isReady() !== true) fail('worker_credential_not_configured')

  // Durable policy source. The in-app delivery policy is read from the durable
  // adult-review readiness RPC, never from an environment flag, so an enabled
  // deployment whose durable policy is not approved composes nothing.
  const safetyPorts = createSupabaseStudySafetyPorts({ rpc })
  if (await safetyPorts.refreshReadiness() !== true) fail('durable_readiness_not_ready')
  let readiness
  try {
    readiness = await safetyPorts.readAdultReviewReadiness()
  } catch {
    fail('durable_policy_unavailable')
  }
  if (readiness.state !== 'ready') fail('durable_policy_not_ready')
  if (readiness.adultReviewInAppDeliveryPolicy !== 'approved') fail('in_app_delivery_policy_not_approved')

  // PHASE 3 — exactly one operations instance. The worker's persistence and
  // the in-app provider's persistence are the same durable authority: the
  // provider's lease context IS this instance's lease context, so the lease
  // token the provider delivers under is the one this instance's claim held.
  // A second adapter would hold a second, empty claim map and every delivery
  // would fail `lease_context_unknown_job`.
  const operations = createSupabaseAdultReviewOperations({ rpc })
  const inAppPersistence = createSupabaseInAppPersistence({
    rpc,
    leaseContext: operations.leaseContext,
  })

  const provider = createDurableInAppProvider({
    persistence: inAppPersistence,
    adultReviewInAppDeliveryPolicy: readiness.adultReviewInAppDeliveryPolicy,
    environment: PRODUCTION_ENVIRONMENT,
  })
  if (provider.isReady() !== true) fail('in_app_provider_not_ready')

  const monitoringSink = createSupabaseAdultReviewMonitoringSink({
    rpc,
    workerIdentity: credentialVerifier.workerIdentity,
  })
  if (monitoringSink.isReady() !== true) fail('monitoring_sink_not_ready')
  const monitoring = createMonitoringService({
    durableSink: monitoringSink,
    serverLog: createStructuredServerLog((event) => {
      // The event has already passed the monitoring schema, so it carries only
      // allowlisted safe tokens and references: no identifiers, no credential
      // material, no learner content.
      console.log(JSON.stringify(event))
    }, 'netlify_adult_review_worker'),
    environment: PRODUCTION_ENVIRONMENT,
  })
  if (monitoring.isReady() !== true) fail('monitoring_not_ready')
  const monitor = createAdultReviewWorkerMonitorAdapter(monitoring)

  const schema = createInAppAdultReviewClaimSchema()
  const resolver = createInAppRecipientProjection()

  const worker = createAdultReviewWorker({
    persistence: operations,
    resolver,
    provider,
    monitor,
    schema,
    workerCredentialVerifier: credentialVerifier,
    workerCredentialVersion: credentialVerifier.credentialVersion,
    environment: PRODUCTION_ENVIRONMENT,
  })

  // The selected authority, and only it, is constructed. Selecting the
  // scheduled one therefore never CALLS the manual factory, which is the only
  // place `ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET` is read -- so
  // the automatic worker composes with that secret absent, malformed, or
  // rotated. The manual operator path is optional; guardian delivery is not,
  // and must not inherit the optional path's prerequisites.
  const workerAuthorization = invocationAuthority({ env, monitor: monitoring })
  if (workerAuthorization.isReady() !== true) fail('worker_invocation_authority_not_configured')

  return Object.freeze({
    worker: Object.freeze({ ready: worker.ready, run: worker.run }),
    workerAuthorization,
    // Exposed so the composition's one-instance and route guarantees are
    // provable from outside, not merely asserted in a comment.
    operations,
    inAppLeaseContext: operations.leaseContext,
    provider,
    monitor,
    schema,
    resolver,
    adultReviewInAppDeliveryPolicy: readiness.adultReviewInAppDeliveryPolicy,
  })
}
