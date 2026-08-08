import { createSupabaseStudySafetyPorts } from '../study-adult-review/supabase-ports.js'
import { createTrustedStudySessionVerifier } from '../study-identity/supabase.js'
import { createAnthropicSafetyClassifier } from '../study-safety/provider.js'
import {
  ACADEMIC_SESSION_13_DEPENDENCIES,
  createAcademicRuntimeReadinessProbe,
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

/**
 * The academic probe reports one state per Session 13 dependency. A throwing,
 * malformed, non-own, or out-of-vocabulary entry is not-ready; no key ever
 * defaults to ready.
 */
async function academicStates(probe) {
  const states = new Map(ACADEMIC_SESSION_13_DEPENDENCIES.map((key) => [key, 'not-ready']))
  if (typeof probe !== 'function') return states
  try {
    const result = await probe()
    if (!result || typeof result !== 'object' || Array.isArray(result)) return states
    for (const key of ACADEMIC_SESSION_13_DEPENDENCIES) {
      if (!Object.hasOwn(result, key)) continue
      const value = result[key]
      if (validState(value)) states.set(key, value)
    }
  } catch {
    for (const key of ACADEMIC_SESSION_13_DEPENDENCIES) states.set(key, 'not-ready')
  }
  return states
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
  const academicReadiness = options.academicReadiness
    ?? createAcademicRuntimeReadinessProbe({ env, fetchImpl })
  const session17 = options.session17 ?? Object.freeze({})
  let cached = null
  let inFlight = null

  async function refresh() {
    const checkedAtMs = now()
    const [
      identity,
      academic,
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
      academicStates(academicReadiness),
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
    // RPC set. Those adapters are answered per dependency by the academic
    // runtime probe, which reports ready only for what the server can observe.
    for (const key of ACADEMIC_SESSION_13_DEPENDENCIES) {
      statusByDependency.set(key, academic.get(key) ?? 'not-ready')
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
