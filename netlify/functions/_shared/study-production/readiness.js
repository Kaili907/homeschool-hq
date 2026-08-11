import { createSupabaseStudySafetyPorts } from '../study-adult-review/supabase-ports.js'
import { createTrustedStudySessionVerifier } from '../study-identity/supabase.js'
import { createAnthropicSafetyClassifier } from '../study-safety/provider.js'
import {
  academicDependenciesUnavailable,
  academicDependencyMap,
  combineAcademicReadiness,
  createSupabaseStudyAcademicReadiness,
} from './academic-readiness.js'

export const STUDY_PRODUCTION_READINESS_SCHEMA_VERSION = 1
export const STUDY_PRODUCTION_READINESS_STATES = Object.freeze([
  'ready',
  'not-ready',
  'degraded',
])

export const STUDY_PRODUCTION_DEPENDENCIES = Object.freeze([
  'session-verifying-authorizer',
  'household-learner-resolver',
  'study-session-adapter',
  'checkpoint-adapter',
  'review-queue',
  'calendar-adapter',
  'parent-settings-adapter',
  'adult-private-adapter',
  'event-ledger',
  'adult-review-proposal-store',
  'outbox-store',
  'rate-limiter',
  'authorized-recipient-resolver',
  'production-classifier',
  'monitoring-sink',
  'delivery-provider',
  'receipt-validator',
])

const IDENTITY_DEPENDENCIES = Object.freeze([
  'session-verifying-authorizer',
  'household-learner-resolver',
])
const ACADEMIC_SESSION_13_DEPENDENCIES = Object.freeze([
  'study-session-adapter',
  'checkpoint-adapter',
  'review-queue',
  'calendar-adapter',
  'parent-settings-adapter',
  'adult-private-adapter',
  'event-ledger',
])
const SAFETY_DURABLE_DEPENDENCIES = Object.freeze([
  'adult-review-proposal-store',
  'outbox-store',
  'rate-limiter',
  'authorized-recipient-resolver',
  'monitoring-sink',
])
const SESSION_17_DEPENDENCIES = Object.freeze([
  'delivery-provider',
  'receipt-validator',
])

export const ADULT_REVIEW_IN_APP_DELIVERY_POLICIES = Object.freeze([
  'approved',
  'not-approved',
])

export function adultReviewInAppDeliveryPolicy(value) {
  return ADULT_REVIEW_IN_APP_DELIVERY_POLICIES.includes(value) ? value : 'not-approved'
}

function validState(value) {
  return STUDY_PRODUCTION_READINESS_STATES.includes(value)
}

function classifierState(classifier) {
  if (classifier?.isConfigured?.() !== true) return 'not-ready'
  const circuit = classifier?.circuitState?.()
  return circuit === 'closed' ? 'ready' : validState(circuit) ? circuit : 'degraded'
}

async function identityState(verifier) {
  if (verifier?.isDurable !== true || verifier?.isReady?.() !== true) return 'not-ready'
  try {
    const result = await verifier.readiness()
    return validState(result?.status) ? result.status : 'not-ready'
  } catch {
    return 'not-ready'
  }
}

async function durableState(ports) {
  try {
    const ready = await ports?.refreshReadiness?.()
    return ready === true ? 'ready' : 'not-ready'
  } catch {
    return 'not-ready'
  }
}

async function productionPolicyState(ports) {
  try {
    const result = await ports?.readAdultReviewReadiness?.()
    return Object.freeze({
      state: validState(result?.state) ? result.state : 'not-ready',
      policy: adultReviewInAppDeliveryPolicy(result?.adultReviewInAppDeliveryPolicy),
    })
  } catch {
    return Object.freeze({ state: 'not-ready', policy: 'not-approved' })
  }
}

async function optionalOperationalState(probe) {
  if (typeof probe !== 'function') return 'not-ready'
  try {
    const result = await probe()
    return validState(result) ? result : 'not-ready'
  } catch {
    return 'not-ready'
  }
}

/**
 * The durable half of academic readiness. Absent transport, a rejected read and
 * a malformed body already resolve to every-dependency-not-ready inside the port,
 * and the map is revalidated here rather than trusted: a partial map read key by
 * key would let the dependencies it mentions pass while the ones it omits fail,
 * so a truncated result would open a dependency instead of closing all of them.
 */
async function academicDatabaseState(probe) {
  if (typeof probe?.read !== 'function') return academicDependenciesUnavailable()
  try {
    return academicDependencyMap(await probe.read())
  } catch {
    return academicDependenciesUnavailable()
  }
}

function aggregateStatus(registrations) {
  if (registrations.some(({ status }) => status === 'not-ready')) return 'not-ready'
  if (registrations.some(({ status }) => status === 'degraded')) return 'degraded'
  return 'ready'
}

/**
 * Server-only production assembly. Its default path uses the real verified
 * identity and durable Supabase readiness RPCs. Session 17 dependencies have
 * no defaults: until real delivery and receipt probes are supplied, they stay
 * explicitly not-ready.
 */
export function createStudyProductionReadinessService(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const now = options.now ?? Date.now
  const ttlMs = Math.max(1_000, Math.min(60_000, options.ttlMs ?? 5_000))
  const identityVerifier = options.identityVerifier ?? createTrustedStudySessionVerifier({ env, fetchImpl })
  const durablePorts = options.durablePorts ?? createSupabaseStudySafetyPorts({ env, fetchImpl })
  const classifier = options.classifier ?? createAnthropicSafetyClassifier({ env, fetchImpl })
  // The durable academic probe has a real default; the operation-surface probe
  // deliberately does not. Both must agree before an academic dependency reads
  // ready, so wiring the durable half cannot by itself move readiness.
  const academicDatabase = options.academicDatabaseReadiness
    ?? createSupabaseStudyAcademicReadiness({ env, fetchImpl })
  const session17 = options.session17 ?? Object.freeze({})
  let cached = null
  let inFlight = null

  async function refresh() {
    const checkedAtMs = now()
    const [
      identity,
      academic,
      academicDatabaseFacts,
      safetyDurable,
      policyEvidence,
      recipient,
      limiter,
      monitoring,
      workerCredential,
      workerScheduler,
      lease,
      attemptStore,
      operationalReadiness,
      deliveryProbe,
      receiptProbe,
    ] = await Promise.all([
      identityState(identityVerifier),
      optionalOperationalState(options.academicReadiness),
      academicDatabaseState(academicDatabase),
      durableState(durablePorts),
      productionPolicyState(durablePorts),
      optionalOperationalState(session17.authorizedRecipientResolver),
      optionalOperationalState(session17.rateLimiter),
      optionalOperationalState(session17.monitoringSink),
      optionalOperationalState(session17.workerCredentialVerifier),
      optionalOperationalState(session17.workerScheduler),
      optionalOperationalState(session17.leaseOperations),
      optionalOperationalState(session17.attemptStore),
      optionalOperationalState(session17.operationalReadiness),
      optionalOperationalState(session17.deliveryProvider),
      optionalOperationalState(session17.receiptValidator),
    ])
    const inAppDeliveryPolicy = policyEvidence.policy
    const policyApproved = inAppDeliveryPolicy === 'approved' && policyEvidence.state === 'ready'
    const criticalAdultReviewStates = [
      recipient,
      limiter,
      monitoring,
      workerCredential,
      workerScheduler,
      lease,
      attemptStore,
      operationalReadiness,
      deliveryProbe,
      receiptProbe,
    ]
    const adultReviewStatus = !policyApproved || criticalAdultReviewStates.includes('not-ready')
      ? 'not-ready'
      : criticalAdultReviewStates.includes('degraded') ? 'degraded' : 'ready'
    const delivery = adultReviewStatus === 'ready' ? deliveryProbe : adultReviewStatus
    const receipt = adultReviewStatus === 'ready' ? receiptProbe : adultReviewStatus
    const statusByDependency = new Map()
    for (const key of IDENTITY_DEPENDENCIES) statusByDependency.set(key, identity)
    // The safety reconciliation probe does not prove the Session 13 academic
    // RPC set. Those adapters require their own injected live probe — and, since
    // the durable readiness RPC landed, agreement from it as well. The operation
    // surface says Netlify composition supports the dependency; the durable probe
    // says the underlying server contract exists in the expected shape. Neither
    // is allowed to report a dependency ready on its own.
    for (const key of ACADEMIC_SESSION_13_DEPENDENCIES) {
      statusByDependency.set(key, combineAcademicReadiness(academic, academicDatabaseFacts[key]))
    }
    for (const key of SAFETY_DURABLE_DEPENDENCIES) statusByDependency.set(key, safetyDurable)
    statusByDependency.set('outbox-store', adultReviewStatus)
    statusByDependency.set('rate-limiter', limiter === 'ready' ? adultReviewStatus : limiter)
    statusByDependency.set('authorized-recipient-resolver', recipient === 'ready' ? adultReviewStatus : recipient)
    statusByDependency.set('monitoring-sink', monitoring === 'ready' ? adultReviewStatus : monitoring)
    statusByDependency.set('production-classifier', classifierState(classifier))
    statusByDependency.set('delivery-provider', delivery)
    statusByDependency.set('receipt-validator', receipt)

    const registrations = Object.freeze(STUDY_PRODUCTION_DEPENDENCIES.map((dependency) =>
      Object.freeze({ dependency, status: statusByDependency.get(dependency) ?? 'not-ready' }),
    ))
    const snapshot = Object.freeze({
      schemaVersion: STUDY_PRODUCTION_READINESS_SCHEMA_VERSION,
      status: aggregateStatus(registrations),
      checkedAtMs,
      expiresAtMs: checkedAtMs + ttlMs,
      // Server-internal diagnostics. readinessWireResult deliberately drops it.
      registrations,
      adultReviewInAppDeliveryPolicy: inAppDeliveryPolicy,
    })
    cached = snapshot
    return snapshot
  }

  async function check({ force = false } = {}) {
    if (!force && cached && now() < cached.expiresAtMs) return cached
    if (inFlight) return inFlight
    inFlight = refresh().finally(() => { inFlight = null })
    return inFlight
  }

  return Object.freeze({
    check,
    invalidate() { cached = null },
  })
}

export function readinessWireResult(snapshot) {
  const status = validState(snapshot?.status) ? snapshot.status : 'not-ready'
  const expiresAtMs = Number.isFinite(snapshot?.expiresAtMs) ? snapshot.expiresAtMs : Date.now()
  return Object.freeze({
    schemaVersion: STUDY_PRODUCTION_READINESS_SCHEMA_VERSION,
    status,
    expiresAt: new Date(expiresAtMs).toISOString(),
  })
}
