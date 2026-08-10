import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdultReviewWorker } from './worker.js'
import { createSupabaseAdultReviewOperations } from './supabase-operations.js'
import { createDurableInAppProvider } from '../study-delivery/in-app-provider.js'
import { createSupabaseInAppPersistence } from '../study-delivery/supabase-in-app.js'
import { ADULT_REVIEW_WORKER_SCOPE } from '../study-worker/context.js'

/**
 * In-memory model of the accepted C2/G1 durable contract.
 *
 * Every guard, state transition, revision bump, and returned key set below is
 * transcribed from the reviewed migrations:
 *   20260801170000 (attempt creation, attempt events, renew, release)
 *   20260806120000 (verified receipt deliveredAt normalization)
 *   20260806140000 (M1 claim, M2 lease proof, M3 attempt proof, M4 cancel,
 *                   M5 retained terminal lease, M6 provider-accepted ownership)
 * It is a faithful model of that SQL, not the SQL itself; the SQL is proven
 * separately by supabase/study-engine-adult-review.db.test.ts.
 */

const WORKER_ID = 'worker:c2'
const JOB_ID = '11111111-1111-4111-8111-111111111111'
const PROPOSAL_ID = 'proposal:c2-1'
const HOUSEHOLD_ID = '22222222-2222-4222-8222-222222222222'
const STUDENT_ID = '33333333-3333-4333-8333-333333333333'
const DELIVERY_KEY = `delivery:${'a'.repeat(64)}`
const ROUTE_REF = `route:${'b'.repeat(64)}`
const RECIPIENT_REF = `recipient:${'c'.repeat(64)}`
const TEMPLATE_CODE = 'study-safety-adult-review-v1'

const AUTHORITY = Object.freeze({
  verified: true,
  schemaVersion: 1,
  workerIdentity: WORKER_ID,
  credentialId: 'worker-credential:c2',
  credentialVersion: 'worker-credential-v2',
  scope: ADULT_REVIEW_WORKER_SCOPE,
  // `workerContextForRpc` validates expiry against the real clock, so this must
  // stay in the wall-clock future independently of the simulated estate clock.
  expiresAt: '2099-08-07T13:00:00.000Z',
  revoked: false,
  verifierVersion: 'worker-verifier-v1',
  verificationRef: 'worker-verification:c2',
})

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const ATTEMPT_STATES = new Set([
  'created', 'submitted', 'provider-accepted', 'provider-rejected',
  'timeout-indeterminate', 'receipt-rejected', 'permanent-failure',
])
const TRANSITIONS = new Map([
  ['none', new Set(['created'])],
  ['created', new Set(['submitted', 'permanent-failure'])],
  ['submitted', new Set([
    'provider-accepted', 'provider-rejected', 'timeout-indeterminate', 'permanent-failure',
  ])],
  ['provider-accepted', new Set(['receipt-rejected', 'permanent-failure'])],
  ['timeout-indeterminate', new Set(['receipt-rejected', 'permanent-failure'])],
  ['provider-rejected', new Set(['permanent-failure'])],
  ['receipt-rejected', new Set(['permanent-failure'])],
])

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

class DurableError extends Error {}

/** Raw `to_json(timestamptz)` shape: numeric offset, microsecond precision. */
function rawTimestamptz(ms, offsetMinutes = 0) {
  const shifted = new Date(ms + offsetMinutes * 60_000).toISOString()
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
  return `${shifted.slice(0, 23)}456${offset}`
}

/** `to_char(... at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`. */
function normalizedUtc(ms) {
  return new Date(ms).toISOString()
}

function createDurableEstate(options = {}) {
  const offsetMinutes = options.offsetMinutes ?? 0
  let clock = Date.parse('2026-08-07T12:00:00.000Z')
  const calls = []
  const job = {
    id: JOB_ID,
    state: 'pending',
    proposalId: PROPOSAL_ID,
    householdId: HOUSEHOLD_ID,
    studentId: STUDENT_ID,
    channel: 'in-app',
    templateCode: TEMPLATE_CODE,
    recipientRef: RECIPIENT_REF,
    routeRef: ROUTE_REF,
    deliveryIdempotencyKey: DELIVERY_KEY,
    leaseToken: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    leaseGeneration: 0,
    attemptCount: 0,
    revision: 1,
    deliveredAt: null,
  }
  const attempts = new Map()
  const attemptEvents = []
  const notifications = new Map()
  const receipts = []
  const receiptEvents = []
  const audit = []
  const estate = {
    calls, job, attempts, attemptEvents, notifications, receipts, receiptEvents, audit,
    tick: (ms = 1) => { clock += ms },
    advanceTo: (iso) => { clock = Date.parse(iso) },
    now: () => clock,
    recipientRevoked: options.recipientRevoked === true,
    proposalInvalid: options.proposalInvalid === true,
  }

  function latestState(attemptId) {
    for (let index = attemptEvents.length - 1; index >= 0; index -= 1) {
      if (attemptEvents[index].attemptId === attemptId) return attemptEvents[index].state
    }
    return null
  }
  function jobHasPostSubmitEvent() {
    return attemptEvents.some((event) => (
      ['submitted', 'provider-accepted', 'timeout-indeterminate'].includes(event.state) &&
      attempts.get(event.attemptId)?.jobId === job.id
    ))
  }
  function authorize(workerId) {
    if (workerId !== WORKER_ID) throw new DurableError('STUDY_WORKER_NOT_AUTHORIZED')
  }

  const procedures = {
    academy_study_claim_delivery_jobs_v2({ p_worker_id, p_batch_size, p_lease_seconds }) {
      authorize(p_worker_id)
      if (!Number.isInteger(p_batch_size) || p_batch_size < 1 || p_batch_size > 50 ||
        !Number.isInteger(p_lease_seconds) || p_lease_seconds < 5 || p_lease_seconds > 300) {
        throw new DurableError('STUDY_DELIVERY_CLAIM_INVALID')
      }
      // Expiry sweep: submitted work is quarantined, never returned to pending.
      if (job.state === 'leased' && job.leaseExpiresAt <= clock) {
        const quarantine = jobHasPostSubmitEvent()
        job.state = quarantine ? 'indeterminate' : 'pending'
        job.lastFailureCode = quarantine ? 'lease-expired-after-submit' : null
        job.leaseToken = null
        job.leaseOwner = null
        job.leaseExpiresAt = null
        job.revision += 1
      }
      if (job.state !== 'pending' && job.state !== 'retryable') {
        return { jobs: [], serverTime: rawTimestamptz(clock, offsetMinutes) }
      }
      job.state = 'leased'
      job.leaseToken = `lease-${job.leaseGeneration + 1}-uuid`
      job.leaseOwner = p_worker_id
      job.leaseExpiresAt = clock + p_lease_seconds * 1000
      job.leaseGeneration += 1
      job.revision += 1
      return {
        jobs: [{
          claimId: job.id,
          jobId: job.id,
          proposalId: job.proposalId,
          householdId: job.householdId,
          studentId: job.studentId,
          templateCode: job.templateCode,
          recipientRef: job.recipientRef,
          routeRef: job.routeRef,
          route: job.channel,
          idempotencyKey: job.deliveryIdempotencyKey,
          leaseToken: job.leaseToken,
          leaseExpiresAt: rawTimestamptz(job.leaseExpiresAt, offsetMinutes),
          leaseGeneration: job.leaseGeneration,
          revision: job.revision,
        }],
        serverTime: rawTimestamptz(clock, offsetMinutes),
      }
    },

    academy_study_prove_delivery_lease_v2({ p_worker_id, p_job_id, p_lease_token }) {
      authorize(p_worker_id)
      if (job.id !== p_job_id || job.leaseOwner !== p_worker_id ||
        job.leaseToken !== p_lease_token || job.leaseExpiresAt === null ||
        job.leaseExpiresAt <= clock) {
        return {
          active: false, jobId: p_job_id, leaseToken: null,
          leaseRevision: null, leaseExpiresAt: null,
        }
      }
      return {
        active: true,
        jobId: job.id,
        leaseToken: job.leaseToken,
        leaseRevision: job.revision,
        leaseExpiresAt: normalizedUtc(job.leaseExpiresAt),
      }
    },

    academy_study_prove_current_attempt_v2({ p_worker_id, p_job_id, p_attempt_id, p_lease_token }) {
      authorize(p_worker_id)
      const attempt = attempts.get(p_attempt_id)
      if (job.id !== p_job_id || !attempt || attempt.jobId !== p_job_id ||
        job.leaseOwner !== p_worker_id || job.leaseToken !== p_lease_token ||
        attempt.leaseGeneration !== job.leaseGeneration ||
        attempt.attemptOrdinal !== job.attemptCount) {
        return {
          current: false, attemptId: p_attempt_id, jobId: p_job_id, leaseToken: null,
          deliveryIdempotencyKey: null, providerName: null, providerConfigVersion: null,
        }
      }
      return {
        current: true,
        attemptId: attempt.attemptId,
        jobId: attempt.jobId,
        leaseToken: job.leaseToken,
        deliveryIdempotencyKey: attempt.deliveryIdempotencyKey,
        providerName: attempt.providerName,
        providerConfigVersion: attempt.providerConfigVersion,
      }
    },

    academy_study_renew_delivery_lease_v2({
      p_worker_id, p_job_id, p_lease_token, p_expected_revision, p_lease_seconds,
    }) {
      authorize(p_worker_id)
      if (p_lease_seconds < 5 || p_lease_seconds > 300) {
        throw new DurableError('STUDY_WORKER_NOT_AUTHORIZED')
      }
      if (job.id !== p_job_id || job.state !== 'leased' || job.leaseOwner !== p_worker_id ||
        job.leaseToken !== p_lease_token || job.revision !== p_expected_revision ||
        job.leaseExpiresAt <= clock) {
        throw new DurableError('STUDY_DELIVERY_LEASE_CONFLICT')
      }
      job.leaseExpiresAt = clock + p_lease_seconds * 1000
      job.revision += 1
      return {
        renewed: true,
        revision: job.revision,
        leaseExpiresAt: rawTimestamptz(job.leaseExpiresAt, offsetMinutes),
      }
    },

    academy_study_release_delivery_lease_v2({
      p_worker_id, p_job_id, p_lease_token, p_expected_revision,
    }) {
      authorize(p_worker_id)
      if (jobHasPostSubmitEvent()) throw new DurableError('STUDY_DELIVERY_RELEASE_UNSAFE')
      if (job.id !== p_job_id || job.state !== 'leased' || job.leaseOwner !== p_worker_id ||
        job.leaseToken !== p_lease_token || job.revision !== p_expected_revision) {
        throw new DurableError('STUDY_DELIVERY_LEASE_CONFLICT')
      }
      job.state = 'pending'
      job.leaseToken = null
      job.leaseOwner = null
      job.leaseExpiresAt = null
      job.revision += 1
      return { released: true }
    },

    academy_study_create_delivery_attempt_v2({ p_worker_id, p_attempt }) {
      authorize(p_worker_id)
      if (!exactKeys(p_attempt, [
        'jobId', 'leaseToken', 'expectedRevision', 'attemptId',
        'providerName', 'providerConfigVersion',
      ]) || !IDENTIFIER.test(p_attempt.attemptId ?? '') ||
        !IDENTIFIER.test(p_attempt.providerName ?? '') ||
        !IDENTIFIER.test(p_attempt.providerConfigVersion ?? '')) {
        throw new DurableError('STUDY_DELIVERY_ATTEMPT_INVALID')
      }
      const existing = attempts.get(p_attempt.attemptId)
      if (job.id !== p_attempt.jobId || job.state !== 'leased' ||
        job.leaseOwner !== p_worker_id || job.leaseToken !== p_attempt.leaseToken ||
        job.leaseExpiresAt <= clock ||
        (job.revision !== p_attempt.expectedRevision &&
          !(existing && job.revision === p_attempt.expectedRevision + 1))) {
        throw new DurableError('STUDY_DELIVERY_ATTEMPT_BINDING_MISMATCH')
      }
      if (existing) {
        return { created: false, attemptId: existing.attemptId, revision: job.revision }
      }
      const ordinal = job.attemptCount + 1
      attempts.set(p_attempt.attemptId, {
        attemptId: p_attempt.attemptId,
        jobId: job.id,
        attemptOrdinal: ordinal,
        leaseGeneration: job.leaseGeneration,
        deliveryIdempotencyKey: job.deliveryIdempotencyKey,
        recipientRef: job.recipientRef,
        routeRef: job.routeRef,
        channel: job.channel,
        providerName: p_attempt.providerName,
        providerConfigVersion: p_attempt.providerConfigVersion,
      })
      job.attemptCount = ordinal
      job.revision += 1
      return {
        created: true, attemptId: p_attempt.attemptId,
        attemptCount: ordinal, revision: job.revision,
      }
    },

    academy_study_record_attempt_event_v2({ p_worker_id, p_event }) {
      authorize(p_worker_id)
      if (!exactKeys(p_event, [
        'attemptId', 'jobId', 'state', 'structuredResult', 'timeoutState',
        'retryDecision', 'errorCode',
      ])) throw new DurableError('STUDY_ATTEMPT_EVENT_INVALID')
      const attempt = attempts.get(p_event.attemptId)
      if (!attempt || attempt.jobId !== p_event.jobId || job.state !== 'leased' ||
        job.leaseOwner !== p_worker_id || job.leaseExpiresAt <= clock ||
        attempt.leaseGeneration !== job.leaseGeneration ||
        attempt.attemptOrdinal !== job.attemptCount) {
        throw new DurableError('STUDY_ATTEMPT_EVENT_BINDING_MISMATCH')
      }
      if (!ATTEMPT_STATES.has(p_event.state) ||
        !IDENTIFIER.test(p_event.structuredResult ?? '') ||
        !['not-timed-out', 'before-submit', 'after-submit'].includes(p_event.timeoutState) ||
        !['not-applicable', 'safe-retry', 'do-not-retry', 'reconcile'].includes(p_event.retryDecision) ||
        (p_event.errorCode !== null && !IDENTIFIER.test(p_event.errorCode ?? ''))) {
        throw new DurableError('STUDY_ATTEMPT_EVENT_INVALID')
      }
      const prior = latestState(attempt.attemptId) ?? 'none'
      if (!TRANSITIONS.get(prior)?.has(p_event.state)) {
        throw new DurableError('STUDY_ATTEMPT_EVENT_TRANSITION_INVALID')
      }
      attemptEvents.push({
        attemptId: attempt.attemptId, jobId: attempt.jobId, state: p_event.state,
        occurredAt: clock, source: 'record_attempt_event_v2',
      })
      return { recorded: true, state: p_event.state }
    },

    academy_study_cancel_delivery_job_v2({
      p_worker_id, p_job_id, p_lease_token, p_expected_revision, p_reason_code,
    }) {
      authorize(p_worker_id)
      if (!['invalid_delivery', 'invalid_recipient'].includes(p_reason_code)) {
        throw new DurableError('STUDY_DELIVERY_CANCEL_REASON_INVALID')
      }
      if (job.id === p_job_id && job.state === 'cancelled') {
        if (audit.some((row) => row.eventName === 'delivery-job-cancelled' &&
          row.jobRef === p_job_id && row.workerId === p_worker_id &&
          row.reasonCode === p_reason_code)) {
          return {
            cancelled: false, replay: true, state: 'cancelled',
            jobId: job.id, reasonCode: p_reason_code, revision: job.revision,
          }
        }
        throw new DurableError('STUDY_DELIVERY_CANCEL_CONFLICT')
      }
      if (job.id !== p_job_id || job.state !== 'leased' || job.leaseOwner !== p_worker_id ||
        job.leaseToken !== p_lease_token || job.leaseExpiresAt === null ||
        job.leaseExpiresAt <= clock || job.revision !== p_expected_revision) {
        throw new DurableError('STUDY_DELIVERY_CANCEL_CONFLICT')
      }
      job.state = 'cancelled'
      job.leaseToken = null
      job.leaseOwner = null
      job.leaseExpiresAt = null
      job.revision += 1
      audit.push({
        eventName: 'delivery-job-cancelled', workerId: p_worker_id,
        jobRef: job.id, reasonCode: p_reason_code,
      })
      return {
        cancelled: true, replay: false, state: 'cancelled',
        jobId: job.id, reasonCode: p_reason_code, revision: job.revision,
      }
    },

    academy_study_deliver_in_app_notification_v2({ p_worker_id, p_delivery }) {
      authorize(p_worker_id)
      if (!exactKeys(p_delivery, [
        'schemaVersion', 'jobId', 'leaseToken', 'expectedRevision', 'attemptId',
        'deliveryIdempotencyKey', 'recipientRef', 'routeRef', 'proposalId',
        'householdId', 'studentId', 'providerName', 'providerConfigVersion',
      ]) || p_delivery.schemaVersion !== 2 ||
        p_delivery.providerName !== 'academy-in-app' ||
        p_delivery.providerConfigVersion !== 'in-app-config-v1') {
        throw new DurableError('STUDY_IN_APP_DELIVERY_INVALID')
      }
      const existing = notifications.get(p_delivery.deliveryIdempotencyKey)
      if (existing) {
        const receipt = receipts.find((row) => row.jobId === existing.jobId &&
          row.attemptId === existing.attemptId)
        if (!receipt) throw new DurableError('STUDY_IN_APP_IDEMPOTENCY_COLLISION')
        return {
          state: 'already-delivered', providerReceiptRef: receipt.providerReceiptRef,
          jobId: existing.jobId, attemptId: existing.attemptId,
          proposalId: existing.proposalId, householdId: existing.householdId,
          studentId: existing.studentId,
          deliveryIdempotencyKey: existing.deliveryIdempotencyKey,
          recipientRef: existing.recipientRef, routeRef: existing.routeRef,
          providerName: receipt.providerName,
          providerConfigVersion: receipt.providerConfigVersion,
          notification: existing.notification,
        }
      }
      if (job.id !== p_delivery.jobId || job.state !== 'leased' ||
        job.leaseOwner !== p_worker_id || job.leaseToken !== p_delivery.leaseToken ||
        job.leaseExpiresAt <= clock || job.revision !== p_delivery.expectedRevision ||
        job.channel !== 'in-app' ||
        job.deliveryIdempotencyKey !== p_delivery.deliveryIdempotencyKey ||
        job.recipientRef !== p_delivery.recipientRef ||
        job.routeRef !== p_delivery.routeRef ||
        job.proposalId !== p_delivery.proposalId ||
        job.householdId !== p_delivery.householdId ||
        job.studentId !== p_delivery.studentId) {
        throw new DurableError('STUDY_IN_APP_DELIVERY_BINDING_MISMATCH')
      }
      if (estate.proposalInvalid) {
        job.state = 'cancelled'
        job.leaseToken = null
        job.leaseOwner = null
        job.leaseExpiresAt = null
        job.revision += 1
        return { state: 'revoked', reasonCode: 'proposal-invalid-before-insert' }
      }
      if (estate.recipientRevoked) {
        job.state = 'cancelled'
        job.leaseToken = null
        job.leaseOwner = null
        job.leaseExpiresAt = null
        job.revision += 1
        return { state: 'revoked', reasonCode: 'recipient-revoked-before-insert' }
      }
      const attempt = attempts.get(p_delivery.attemptId)
      if (!attempt || attempt.leaseGeneration !== job.leaseGeneration ||
        attempt.attemptOrdinal !== job.attemptCount ||
        attempt.providerName !== 'academy-in-app' ||
        attempt.providerConfigVersion !== 'in-app-config-v1' ||
        (latestState(attempt.attemptId) ?? 'none') !== 'submitted') {
        throw new DurableError('STUDY_IN_APP_ATTEMPT_NOT_SUBMITTED')
      }
      // M6: the delivery transaction owns provider-accepted.
      const acceptedAt = clock
      attemptEvents.push({
        attemptId: attempt.attemptId, jobId: job.id, state: 'provider-accepted',
        occurredAt: acceptedAt, source: 'delivery_transaction',
      })
      const deliveredAt = acceptedAt + 1
      const receiptRef = `in-app-receipt:${job.deliveryIdempotencyKey.slice(9, 41)}`
      const evidenceRef = `in-app-evidence:${job.deliveryIdempotencyKey.slice(9, 41)}`
      const notification = {
        jobId: job.id, attemptId: attempt.attemptId, proposalId: job.proposalId,
        householdId: job.householdId, studentId: job.studentId,
        deliveryIdempotencyKey: job.deliveryIdempotencyKey,
        recipientRef: job.recipientRef, routeRef: job.routeRef,
        deliveredAt,
        notification: {
          title: 'Study check-in needs your review',
          reasonCategory: 'review-required',
          urgency: 'review-required',
          actionRef: `adult-review:${job.proposalId.replace(/[^A-Za-z0-9._/-]/g, '-')}`,
        },
      }
      notifications.set(job.deliveryIdempotencyKey, notification)
      const receipt = {
        jobId: job.id, attemptId: attempt.attemptId, providerReceiptRef: receiptRef,
        evidenceRef, deliveredAt, acceptedAt, providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1', verificationState: 'verified',
      }
      receipts.push(receipt)
      receiptEvents.push({
        eventIdempotencyKey: `receipt-event:${attempt.attemptId}`,
        jobId: job.id, attemptId: attempt.attemptId, state: 'verified',
      })
      attemptEvents.push({
        attemptId: attempt.attemptId, jobId: job.id, state: 'receipt-verified',
        occurredAt: deliveredAt, source: 'delivery_transaction',
      })
      // M5: terminal lease identity is retained as evidence.
      job.state = 'delivered'
      job.deliveredAt = deliveredAt
      job.revision += 1
      return {
        state: 'delivered', providerReceiptRef: receiptRef, jobId: job.id,
        attemptId: attempt.attemptId, proposalId: job.proposalId,
        householdId: job.householdId, studentId: job.studentId,
        deliveryIdempotencyKey: job.deliveryIdempotencyKey,
        recipientRef: job.recipientRef, routeRef: job.routeRef,
        providerName: 'academy-in-app', providerConfigVersion: 'in-app-config-v1',
        notification: notification.notification,
      }
    },

    academy_study_verify_in_app_notification_v2({ p_worker_id, p_binding }) {
      authorize(p_worker_id)
      if (!exactKeys(p_binding, [
        'providerReceiptRef', 'providerName', 'route', 'routeRef', 'jobId',
        'attemptId', 'proposalId', 'householdId', 'studentId', 'recipientRef',
        'deliveryIdempotencyKey', 'providerConfigVersion',
      ]) || p_binding.providerName !== 'academy-in-app' || p_binding.route !== 'in-app' ||
        p_binding.providerConfigVersion !== 'in-app-config-v1') {
        throw new DurableError('STUDY_IN_APP_RECEIPT_INVALID')
      }
      const notification = notifications.get(p_binding.deliveryIdempotencyKey)
      if (!notification || notification.jobId !== p_binding.jobId ||
        notification.attemptId !== p_binding.attemptId ||
        notification.recipientRef !== p_binding.recipientRef ||
        notification.routeRef !== p_binding.routeRef ||
        notification.proposalId !== p_binding.proposalId ||
        notification.householdId !== p_binding.householdId ||
        notification.studentId !== p_binding.studentId) return { verified: false }
      const receipt = receipts.find((row) => row.jobId === notification.jobId &&
        row.attemptId === notification.attemptId &&
        row.providerReceiptRef === p_binding.providerReceiptRef &&
        row.verificationState === 'verified')
      if (!receipt) return { verified: false }
      const receiptEvent = receiptEvents.find((row) => row.jobId === receipt.jobId &&
        row.attemptId === receipt.attemptId && row.state === 'verified')
      if (!receiptEvent) return { verified: false }
      return (options.verifyOverride ?? ((value) => value))({
        verified: true,
        receiptSchemaVersion: 1,
        providerReceiptRef: receipt.providerReceiptRef,
        jobId: notification.jobId,
        attemptId: notification.attemptId,
        deliveryIdempotencyKey: notification.deliveryIdempotencyKey,
        recipientRef: notification.recipientRef,
        proposalId: notification.proposalId,
        householdId: notification.householdId,
        studentId: notification.studentId,
        routeRef: notification.routeRef,
        route: 'in-app',
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
        deliveredAt: normalizedUtc(notification.deliveredAt),
        evidenceRef: receipt.evidenceRef,
        eventIdempotencyKey: receiptEvent.eventIdempotencyKey,
        receiptSource: 'server-verified',
        testReceipt: false,
      })
    },
  }

  estate.rpc = {
    isConfigured: () => true,
    call: vi.fn(async (name, parameters) => {
      calls.push({ name, parameters })
      const procedure = procedures[name]
      if (!procedure) throw new Error(`durable_port_contract:${name}`)
      return procedure(parameters)
    }),
  }
  estate.namesCalled = () => calls.map((call) => call.name)
  estate.callsTo = (name) => calls.filter((call) => call.name === name)
  return estate
}

function leaseGeneration(estate) {
  return estate.job.leaseGeneration
}
function derivedAttemptId(estate) {
  return `attempt:${JOB_ID}:${leaseGeneration(estate)}`
}

/** Drives a claim to the point where a lease is held, as the worker would. */
async function claimOne(operations, estate) {
  const [claim] = await operations.claim({
    workerContext: AUTHORITY, limit: 1, leaseMs: 60_000,
    now: new Date(estate.now()), trigger: 'scheduled',
  })
  return claim
}

function workerFixture(estate, { patchOperations, ...overrides } = {}) {
  const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
  const provider = createDurableInAppProvider({
    persistence: createSupabaseInAppPersistence({
      rpc: estate.rpc,
      // Always the real adapter's lease context, even when the worker is handed
      // a patched persistence facade.
      leaseContext: operations.leaseContext,
    }),
    adultReviewInAppDeliveryPolicy: 'approved',
    environment: 'production',
  })
  const monitor = { isReady: () => true, record: vi.fn(async () => undefined) }
  const worker = createAdultReviewWorker({
    persistence: patchOperations ? patchOperations(operations) : operations,
    // The recipient identity is the one the durable C2 claim projection already
    // disclosed. Composing the production resolver is a D1 concern.
    resolver: {
      isReady: () => true,
      resolve: vi.fn(async ({ delivery }) => ({
        recipient: { recipientRef: delivery.recipientRef },
      })),
    },
    provider,
    monitor,
    schema: { isReady: () => true, safeParse: (value) => ({ success: true, data: value }) },
    workerCredentialVerifier: {
      isReady: () => true, isDurable: true, verify: vi.fn(async () => AUTHORITY),
    },
    workerCredentialVersion: AUTHORITY.credentialVersion,
    now: () => new Date(estate.now()),
    environment: 'production',
    leaseMs: 60_000,
    ...overrides,
  })
  return { worker, operations, provider, monitor }
}

async function run(worker) {
  return worker.run({ trigger: 'scheduled', workerCredential: 'opaque-worker-credential' })
}

describe('C2 v2 operations adapter — claim projection', () => {
  let estate
  beforeEach(() => { estate = createDurableEstate() })

  it('adapts the SQL leaseGeneration/revision split to the worker lease revision', async () => {
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    // SQL is authoritative: revision is what every lease-bound RPC compares.
    expect(claim.leaseRevision).toBe(estate.job.revision)
    expect(claim.leaseRevision).not.toBe(estate.job.leaseGeneration)
    expect(claim.leaseGeneration).toBe(estate.job.leaseGeneration)
    expect(estate.callsTo('academy_study_claim_delivery_jobs_v2')[0].parameters).toEqual({
      p_worker_id: WORKER_ID, p_batch_size: 1, p_lease_seconds: 60,
    })
  })

  it('preserves the durable identifiers verbatim and adds no PII', async () => {
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    expect(claim.idempotencyKey).toBe(DELIVERY_KEY)
    expect(claim.routeRef).toBe(ROUTE_REF)
    expect(claim.recipientRef).toBe(RECIPIENT_REF)
    expect(Object.keys(claim).sort()).toEqual([
      'attemptId', 'claimId', 'householdId', 'idempotencyKey', 'jobId',
      'leaseExpiresAt', 'leaseGeneration', 'leaseRevision', 'leaseToken',
      'proposalId', 'recipientRef', 'route', 'routeRef', 'studentId', 'templateCode',
    ])
  })

  it('derives a lease-generation-bound attempt id the in-app provider can use', async () => {
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    expect(claim.attemptId).toBe(derivedAttemptId(estate))
    expect(IDENTIFIER.test(claim.attemptId)).toBe(true)
    expect(claim.attemptId.length).toBeLessThanOrEqual(128)
  })
})

describe('C2 v2 operations adapter — timestamp shapes', () => {
  it('normalizes a raw M1 timestamptz with numeric offset and microseconds', async () => {
    const estate = createDurableEstate({ offsetMinutes: -240 })
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    const raw = estate.rpc.call.mock.results[0].value
    await expect(raw).resolves.toMatchObject({})
    expect(claim.leaseExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Date.parse(claim.leaseExpiresAt)).toBe(estate.job.leaseExpiresAt)
  })

  it('passes the already-normalized M2 proof timestamp through unchanged', async () => {
    const estate = createDurableEstate()
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    const proof = await operations.validateLease({
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
      checkedAt: new Date(estate.now()),
    })
    expect(proof.leaseExpiresAt).toBe(normalizedUtc(estate.job.leaseExpiresAt))
  })

  it('truncates sub-millisecond precision downward so a lease never reads longer', async () => {
    const estate = createDurableEstate()
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    // The raw form carried `.xxx456`; the normalized form keeps only `.xxx`.
    expect(Date.parse(claim.leaseExpiresAt)).toBeLessThanOrEqual(estate.job.leaseExpiresAt)
  })
})

describe('C2 v2 operations adapter — lease proof', () => {
  let estate
  let operations
  beforeEach(async () => {
    estate = createDurableEstate()
    operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
  })

  it('reattaches only the caller-known claimId and never fabricates server fields', async () => {
    const claim = await claimOne(operations, estate)
    const proof = await operations.validateLease({
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
      checkedAt: new Date(estate.now()),
    })
    expect(Object.keys(proof).sort()).toEqual([
      'active', 'claimId', 'jobId', 'leaseExpiresAt', 'leaseRevision', 'leaseToken',
    ])
    expect(proof).toMatchObject({
      active: true, claimId: claim.claimId, jobId: JOB_ID,
      leaseToken: estate.job.leaseToken, leaseRevision: estate.job.revision,
    })
  })

  it('fails closed for a wrong worker, wrong token, or expired lease', async () => {
    const claim = await claimOne(operations, estate)
    const base = {
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
      checkedAt: new Date(estate.now()),
    }
    await expect(operations.validateLease({ ...base, leaseToken: 'lease-other-uuid' }))
      .resolves.toMatchObject({ active: false, leaseToken: null, leaseRevision: null })
    await expect(operations.validateLease({
      ...base, workerContext: { ...AUTHORITY, workerIdentity: 'worker:other' },
    })).rejects.toThrow()
    estate.advanceTo('2026-08-07T12:05:00.000Z')
    await expect(operations.validateLease(base))
      .resolves.toMatchObject({ active: false, leaseExpiresAt: null })
  })

  it('treats active:true on a delivered job as evidence liveness, never as authority', async () => {
    const { worker } = workerFixture(estate)
    await expect(run(worker)).resolves.toMatchObject({ delivered: 1 })
    expect(estate.job.state).toBe('delivered')
    // M5 retains the lease identity, so the proof is still live...
    const proof = await operations.validateLease({
      claimId: JOB_ID, jobId: JOB_ID, leaseToken: estate.job.leaseToken,
      leaseRevision: estate.job.revision, workerContext: AUTHORITY,
      checkedAt: new Date(estate.now()),
    })
    expect(proof.active).toBe(true)
    // ...but it grants no capability. Every mutating port still fails closed
    // because 'delivered' is not a leased state.
    const bound = {
      claimId: JOB_ID, jobId: JOB_ID, leaseToken: estate.job.leaseToken,
      leaseRevision: estate.job.revision, workerContext: AUTHORITY,
      now: new Date(estate.now()),
    }
    await expect(operations.renewLease({ ...bound, leaseMs: 60_000 })).rejects.toThrow()
    await expect(operations.cancel({ ...bound, reason: 'invalid_delivery' })).rejects.toThrow()
    await expect(operations.releaseLease({ ...bound, reason: 'processing_incomplete' }))
      .rejects.toThrow()
    const before = estate.job.revision
    await expect(operations.recordAttemptSubmitted({
      ...bound, attemptId: 'attempt:forged', providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1', jobId: JOB_ID,
      deliveryIdempotencyKey: DELIVERY_KEY, submittedAt: new Date(estate.now()),
    })).rejects.toThrow()
    expect(estate.job.state).toBe('delivered')
    expect(estate.job.revision).toBe(before)
  })
})

describe('C2 v2 operations adapter — renew', () => {
  let estate
  let operations
  beforeEach(() => {
    estate = createDurableEstate()
    operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
  })

  it('returns the worker lease-proof shape sourced from the read-only proof', async () => {
    const claim = await claimOne(operations, estate)
    estate.tick(1000)
    const renewed = await operations.renewLease({
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
      leaseMs: 60_000, now: new Date(estate.now()),
    })
    expect(Object.keys(renewed).sort()).toEqual([
      'active', 'claimId', 'jobId', 'leaseExpiresAt', 'leaseRevision', 'leaseToken',
    ])
    expect(renewed.leaseRevision).toBe(estate.job.revision)
    expect(renewed.leaseRevision).toBeGreaterThan(claim.leaseRevision)
    expect(renewed.leaseExpiresAt).toBe(normalizedUtc(estate.job.leaseExpiresAt))
    expect(estate.namesCalled()).toContain('academy_study_prove_delivery_lease_v2')
  })

  it.each([
    ['wrong worker', { workerContext: { ...AUTHORITY, workerIdentity: 'worker:other' } }],
    ['wrong token', { leaseToken: 'lease-other-uuid' }],
    ['stale revision', { leaseRevision: 1 }],
  ])('fails closed on %s', async (_label, patch) => {
    const claim = await claimOne(operations, estate)
    await expect(operations.renewLease({
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
      leaseMs: 60_000, now: new Date(estate.now()), ...patch,
    })).rejects.toThrow()
  })
})

describe('C2 v2 operations adapter — release semantics', () => {
  let estate
  let operations
  beforeEach(() => {
    estate = createDurableEstate()
    operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
  })

  it('releases pre-submit work through the SQL release RPC', async () => {
    const claim = await claimOne(operations, estate)
    const result = await operations.releaseLease({
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
      reason: 'processing_incomplete', now: new Date(estate.now()),
    })
    expect(result).toMatchObject({ released: true })
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(1)
    expect(estate.job.state).toBe('pending')
  })

  it.each([
    ['submitted_without_receipt'],
    ['reconciliation_failed'],
  ])('issues no SQL release for post-submit reason %s', async (reason) => {
    const claim = await claimOne(operations, estate)
    await operations.recordAttemptSubmitted({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: claim.attemptId,
      leaseToken: claim.leaseToken, leaseRevision: claim.leaseRevision,
      deliveryIdempotencyKey: DELIVERY_KEY, providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1', workerContext: AUTHORITY,
      submittedAt: new Date(estate.now()),
    })
    const stateBefore = estate.job.state
    const revisionBefore = estate.job.revision
    const result = await operations.releaseLease({
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: estate.job.revision, workerContext: AUTHORITY,
      reason, now: new Date(estate.now()),
    })
    expect(result).toMatchObject({ released: false, quarantined: true })
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(0)
    expect(estate.job.state).toBe(stateBefore)
    expect(estate.job.revision).toBe(revisionBefore)
    expect(estate.job.state).not.toBe('pending')
  })

  it('never releases for an unrecognised reason', async () => {
    const claim = await claimOne(operations, estate)
    const result = await operations.releaseLease({
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
      reason: 'something_new', now: new Date(estate.now()),
    })
    expect(result).toMatchObject({ released: false, quarantined: true })
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(0)
  })
})

describe('C2 v2 operations adapter — attempt submission', () => {
  let estate
  let operations
  beforeEach(() => {
    estate = createDurableEstate()
    operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
  })

  it('composes create -> created -> submitted and never emits provider-accepted', async () => {
    const claim = await claimOne(operations, estate)
    const proof = await operations.recordAttemptSubmitted({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: claim.attemptId,
      leaseToken: claim.leaseToken, leaseRevision: claim.leaseRevision,
      deliveryIdempotencyKey: DELIVERY_KEY, providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1', workerContext: AUTHORITY,
      submittedAt: new Date(estate.now()),
    })
    expect(estate.namesCalled().filter((name) => name.startsWith('academy_study_'))).toEqual([
      'academy_study_claim_delivery_jobs_v2',
      'academy_study_create_delivery_attempt_v2',
      'academy_study_record_attempt_event_v2',
      'academy_study_record_attempt_event_v2',
      'academy_study_prove_current_attempt_v2',
    ])
    expect(estate.attemptEvents.map((event) => event.state)).toEqual(['created', 'submitted'])
    const authored = estate.callsTo('academy_study_record_attempt_event_v2')
      .map((call) => call.parameters.p_event.state)
    expect(authored).not.toContain('provider-accepted')
    expect(Object.keys(proof).sort()).toEqual([
      'attemptId', 'current', 'deliveryIdempotencyKey', 'jobId',
      'leaseToken', 'providerConfigVersion', 'providerName',
    ])
    expect(proof).toMatchObject({ current: true, attemptId: claim.attemptId, jobId: JOB_ID })
  })

  it('returns server-stored provider identity, not caller-authored values', async () => {
    const claim = await claimOne(operations, estate)
    const proof = await operations.recordAttemptSubmitted({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: claim.attemptId,
      leaseToken: claim.leaseToken, leaseRevision: claim.leaseRevision,
      deliveryIdempotencyKey: 'delivery:forged', providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1', workerContext: AUTHORITY,
      submittedAt: new Date(estate.now()),
    })
    expect(proof.deliveryIdempotencyKey).toBe(DELIVERY_KEY)
  })
})

describe('C2 v2 operations adapter — current attempt proof', () => {
  it('writes no attempt event and fails closed on a stale generation', async () => {
    const estate = createDurableEstate()
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    await operations.recordAttemptSubmitted({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: claim.attemptId,
      leaseToken: claim.leaseToken, leaseRevision: claim.leaseRevision,
      deliveryIdempotencyKey: DELIVERY_KEY, providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1', workerContext: AUTHORITY,
      submittedAt: new Date(estate.now()),
    })
    const eventsBefore = estate.attemptEvents.length
    const proof = await operations.validateCurrentAttempt({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: claim.attemptId,
      leaseToken: claim.leaseToken, workerContext: AUTHORITY,
      checkedAt: new Date(estate.now()),
    })
    expect(proof.current).toBe(true)
    expect(estate.attemptEvents).toHaveLength(eventsBefore)
    // A stale attempt from an earlier lease generation is not current.
    estate.job.leaseGeneration += 1
    await expect(operations.validateCurrentAttempt({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: claim.attemptId,
      leaseToken: claim.leaseToken, workerContext: AUTHORITY,
      checkedAt: new Date(estate.now()),
    })).resolves.toMatchObject({ current: false, leaseToken: null })
    await expect(operations.validateCurrentAttempt({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: 'attempt:other',
      leaseToken: claim.leaseToken, workerContext: AUTHORITY,
      checkedAt: new Date(estate.now()),
    })).resolves.toMatchObject({ current: false })
  })
})

describe('C2 v2 operations adapter — targeted cancel', () => {
  let estate
  let operations
  beforeEach(() => {
    estate = createDurableEstate()
    operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
  })

  it.each([['invalid_delivery'], ['invalid_recipient']])(
    'cancels exactly one lease-bound job for reason %s', async (reason) => {
      const claim = await claimOne(operations, estate)
      const result = await operations.cancel({
        claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
        leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
        reason, now: new Date(estate.now()),
      })
      expect(result).toMatchObject({ cancelled: true, replay: false, jobId: JOB_ID, reasonCode: reason })
      expect(estate.job.state).toBe('cancelled')
      const call = estate.callsTo('academy_study_cancel_delivery_job_v2')[0].parameters
      expect(call).toEqual({
        p_worker_id: WORKER_ID, p_job_id: JOB_ID, p_lease_token: claim.leaseToken,
        p_expected_revision: claim.leaseRevision, p_reason_code: reason,
      })
    })

  it('preserves replay semantics without a second durable write', async () => {
    const claim = await claimOne(operations, estate)
    const bound = {
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
      reason: 'invalid_recipient', now: new Date(estate.now()),
    }
    await operations.cancel(bound)
    const revisionAfterFirst = estate.job.revision
    await expect(operations.cancel(bound)).resolves.toMatchObject({
      cancelled: false, replay: true, state: 'cancelled',
    })
    expect(estate.job.revision).toBe(revisionAfterFirst)
    expect(estate.audit).toHaveLength(1)
  })

  it('refuses any reason outside the closed set before reaching SQL', async () => {
    const claim = await claimOne(operations, estate)
    await expect(operations.cancel({
      claimId: claim.claimId, jobId: claim.jobId, leaseToken: claim.leaseToken,
      leaseRevision: claim.leaseRevision, workerContext: AUTHORITY,
      reason: 'expired', now: new Date(estate.now()),
    })).rejects.toThrow(/cancel_reason/)
    expect(estate.callsTo('academy_study_cancel_delivery_job_v2')).toHaveLength(0)
    expect(estate.job.state).toBe('leased')
  })
})

describe('C2 v2 operations adapter — indeterminate', () => {
  it('quarantines submitted work and never returns it to pending', async () => {
    const estate = createDurableEstate()
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    await operations.recordAttemptSubmitted({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: claim.attemptId,
      leaseToken: claim.leaseToken, leaseRevision: claim.leaseRevision,
      deliveryIdempotencyKey: DELIVERY_KEY, providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1', workerContext: AUTHORITY,
      submittedAt: new Date(estate.now()),
    })
    await operations.markIndeterminate({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: claim.attemptId,
      workerContext: AUTHORITY, reason: 'provider-outcome-indeterminate',
      now: new Date(estate.now()),
    })
    expect(estate.attemptEvents.at(-1).state).toBe('timeout-indeterminate')
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(0)
    // Lease expiry now quarantines rather than re-queues.
    estate.advanceTo('2026-08-07T12:10:00.000Z')
    await operations.claim({
      workerContext: AUTHORITY, limit: 1, leaseMs: 60_000,
      now: new Date(estate.now()), trigger: 'scheduled',
    })
    expect(estate.job.state).toBe('indeterminate')
    expect(estate.job.lastFailureCode).toBe('lease-expired-after-submit')
  })

  it('records nothing when no durable attempt exists yet', async () => {
    const estate = createDurableEstate()
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    await operations.markIndeterminate({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: undefined,
      workerContext: AUTHORITY, reason: 'provider-outcome-indeterminate',
      now: new Date(estate.now()),
    })
    expect(estate.attemptEvents).toHaveLength(0)
    expect(estate.callsTo('academy_study_record_attempt_event_v2')).toHaveLength(0)
  })

  it('exposes no optional reconciliation ports', () => {
    const estate = createDurableEstate()
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    expect(operations.claimIndeterminate).toBeUndefined()
    expect(operations.claimForReconciliation).toBeUndefined()
    expect(operations.resolveIndeterminate).toBeUndefined()
    expect(operations.commitReconciliation).toBeUndefined()
  })
})

describe('C2 v2 operations adapter — G1 lease context', () => {
  it('proves lease and current attempt from the server, ignoring caller input', async () => {
    const estate = createDurableEstate()
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    await operations.recordAttemptSubmitted({
      claimId: claim.claimId, jobId: claim.jobId, attemptId: claim.attemptId,
      leaseToken: claim.leaseToken, leaseRevision: claim.leaseRevision,
      deliveryIdempotencyKey: DELIVERY_KEY, providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1', workerContext: AUTHORITY,
      submittedAt: new Date(estate.now()),
    })
    const lease = await operations.leaseContext.forAttempt({
      jobId: claim.jobId, attemptId: claim.attemptId, workerContext: AUTHORITY,
      // Caller-authored values must be ignored entirely.
      leaseToken: 'lease-forged-uuid', expectedRevision: 99,
    })
    expect(Object.keys(lease).sort()).toEqual([
      'active', 'currentAttempt', 'expectedRevision', 'leaseToken',
    ])
    expect(lease.leaseToken).toBe(estate.job.leaseToken)
    // The live revision, which attempt creation already advanced.
    expect(lease.expectedRevision).toBe(estate.job.revision)
    expect(lease.expectedRevision).toBeGreaterThan(claim.leaseRevision)
    expect(lease).toMatchObject({ active: true, currentAttempt: true })
  })

  it('refuses a job it never claimed', async () => {
    const estate = createDurableEstate()
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    await expect(operations.leaseContext.forAttempt({
      jobId: JOB_ID, attemptId: 'attempt:x', workerContext: AUTHORITY,
    })).rejects.toThrow(/lease_context/)
  })

  it('reports a non-current attempt without asserting liveness', async () => {
    const estate = createDurableEstate()
    const operations = createSupabaseAdultReviewOperations({ rpc: estate.rpc })
    const claim = await claimOne(operations, estate)
    const lease = await operations.leaseContext.forAttempt({
      jobId: claim.jobId, attemptId: 'attempt:never-created', workerContext: AUTHORITY,
    })
    expect(lease).toMatchObject({ active: true, currentAttempt: false })
  })
})

describe('C2 v2 operations adapter — receipt confirmation', () => {
  it('confirms the already-verified durable receipt without a second write', async () => {
    const estate = createDurableEstate()
    const { worker, operations } = workerFixture(estate)
    await expect(run(worker)).resolves.toMatchObject({ delivered: 1 })
    const receiptsAfter = estate.receipts.length
    const receiptEventsAfter = estate.receiptEvents.length
    const attemptEventsAfter = estate.attemptEvents.length
    expect(receiptsAfter).toBe(1)
    expect(receiptEventsAfter).toBe(1)

    const receipt = {
      verified: true, receiptSchemaVersion: 1,
      providerReceiptRef: estate.receipts[0].providerReceiptRef,
      providerName: 'academy-in-app', route: 'in-app', routeRef: ROUTE_REF,
      jobId: JOB_ID, attemptId: estate.receipts[0].attemptId, proposalId: PROPOSAL_ID,
      householdId: HOUSEHOLD_ID, studentId: STUDENT_ID, recipientRef: RECIPIENT_REF,
      deliveryIdempotencyKey: DELIVERY_KEY, providerConfigVersion: 'in-app-config-v1',
      deliveredAt: normalizedUtc(estate.receipts[0].deliveredAt),
      evidenceRef: estate.receipts[0].evidenceRef,
      eventIdempotencyKey: estate.receiptEvents[0].eventIdempotencyKey,
      receiptSource: 'server-verified', testReceipt: false,
    }
    const attempt = {
      current: true, attemptId: receipt.attemptId, jobId: JOB_ID,
      leaseToken: estate.job.leaseToken, deliveryIdempotencyKey: DELIVERY_KEY,
      providerName: 'academy-in-app', providerConfigVersion: 'in-app-config-v1',
    }
    const confirmed = await operations.commitReceipt({
      claimId: JOB_ID, jobId: JOB_ID, leaseToken: estate.job.leaseToken,
      leaseRevision: estate.job.revision, workerContext: AUTHORITY,
      attempt, receipt, committedAt: new Date(estate.now()),
    })
    expect(confirmed).toEqual({
      committed: true, replayed: false, receiptId: receipt.providerReceiptRef,
      eventIdempotencyKey: receipt.eventIdempotencyKey,
      attemptId: receipt.attemptId, jobId: JOB_ID,
    })
    expect(estate.receipts).toHaveLength(receiptsAfter)
    expect(estate.receiptEvents).toHaveLength(receiptEventsAfter)
    expect(estate.attemptEvents).toHaveLength(attemptEventsAfter)

    // A receipt presented against a different attempt is rejected as a replay.
    await expect(operations.commitReceipt({
      claimId: JOB_ID, jobId: JOB_ID, leaseToken: estate.job.leaseToken,
      leaseRevision: estate.job.revision, workerContext: AUTHORITY,
      attempt: { ...attempt, attemptId: 'attempt:other' }, receipt,
      committedAt: new Date(estate.now()),
    })).resolves.toMatchObject({ committed: false, replayed: true })
    expect(estate.receipts).toHaveLength(receiptsAfter)
    expect(estate.receiptEvents).toHaveLength(receiptEventsAfter)
  })

  it('rejects a receipt the durable estate cannot verify', async () => {
    const estate = createDurableEstate()
    const { worker, operations } = workerFixture(estate)
    await run(worker)
    const receipt = {
      verified: true, receiptSchemaVersion: 1,
      providerReceiptRef: 'in-app-receipt:forged',
      providerName: 'academy-in-app', route: 'in-app', routeRef: ROUTE_REF,
      jobId: JOB_ID, attemptId: estate.receipts[0].attemptId, proposalId: PROPOSAL_ID,
      householdId: HOUSEHOLD_ID, studentId: STUDENT_ID, recipientRef: RECIPIENT_REF,
      deliveryIdempotencyKey: DELIVERY_KEY, providerConfigVersion: 'in-app-config-v1',
      deliveredAt: normalizedUtc(estate.receipts[0].deliveredAt),
      evidenceRef: estate.receipts[0].evidenceRef,
      eventIdempotencyKey: estate.receiptEvents[0].eventIdempotencyKey,
      receiptSource: 'server-verified', testReceipt: false,
    }
    await expect(operations.commitReceipt({
      claimId: JOB_ID, jobId: JOB_ID, leaseToken: estate.job.leaseToken,
      leaseRevision: estate.job.revision, workerContext: AUTHORITY,
      attempt: {
        current: true, attemptId: receipt.attemptId, jobId: JOB_ID,
        leaseToken: estate.job.leaseToken, deliveryIdempotencyKey: DELIVERY_KEY,
        providerName: 'academy-in-app', providerConfigVersion: 'in-app-config-v1',
      },
      receipt, committedAt: new Date(estate.now()),
    })).rejects.toThrow(/receipt_confirmation/)
  })
})

describe('C2 v2 operations adapter — real worker end to end', () => {
  it('delivers in-app through the real worker with the exact durable sequence', async () => {
    const estate = createDurableEstate()
    const { worker, monitor } = workerFixture(estate)
    const result = await run(worker)
    expect(result).toMatchObject({
      workerIdentity: WORKER_ID, claimed: 1, delivered: 1,
      cancelled: 0, indeterminate: 0, failed: 0, reconciled: 0,
    })
    expect(result.results).toEqual([{ deliveryId: JOB_ID, status: 'delivered' }])
    expect(estate.namesCalled()).toEqual([
      'academy_study_claim_delivery_jobs_v2',
      'academy_study_prove_delivery_lease_v2',
      'academy_study_renew_delivery_lease_v2',
      'academy_study_prove_delivery_lease_v2',
      'academy_study_create_delivery_attempt_v2',
      'academy_study_record_attempt_event_v2',
      'academy_study_record_attempt_event_v2',
      'academy_study_prove_current_attempt_v2',
      'academy_study_prove_delivery_lease_v2',
      'academy_study_prove_current_attempt_v2',
      'academy_study_deliver_in_app_notification_v2',
      'academy_study_verify_in_app_notification_v2',
      'academy_study_prove_current_attempt_v2',
      'academy_study_prove_delivery_lease_v2',
      'academy_study_verify_in_app_notification_v2',
    ])
    // The durable evidence ledger, in order, with provider-accepted owned by SQL.
    expect(estate.attemptEvents.map((event) => [event.state, event.source])).toEqual([
      ['created', 'record_attempt_event_v2'],
      ['submitted', 'record_attempt_event_v2'],
      ['provider-accepted', 'delivery_transaction'],
      ['receipt-verified', 'delivery_transaction'],
    ])
    expect(estate.job.state).toBe('delivered')
    expect(estate.receipts).toHaveLength(1)
    expect(estate.receiptEvents).toHaveLength(1)
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(0)
    expect(estate.callsTo('academy_study_cancel_delivery_job_v2')).toHaveLength(0)
    expect(monitor.record).not.toHaveBeenCalled()
  })

  it('never authors provider-accepted from JS on any reachable adapter path', async () => {
    // Exercise every adapter path that can write an attempt event: the full
    // delivered run, and the post-submit indeterminate quarantine.
    const delivered = createDurableEstate()
    await run(workerFixture(delivered).worker)
    const quarantined = createDurableEstate()
    await run(workerFixture(quarantined, {
      provider: {
        isReady: () => true, channel: 'in-app', providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1', isDurable: true, isTestProvider: false,
        adultReviewInAppDeliveryPolicy: 'approved',
        deliver: async ({ onAttemptSubmitted, delivery }) => {
          await onAttemptSubmitted({ attemptId: delivery.attemptId })
          return { submitted: true, attemptId: delivery.attemptId, status: 'indeterminate' }
        },
      },
    }).worker)

    for (const estate of [delivered, quarantined]) {
      const authored = estate.callsTo('academy_study_record_attempt_event_v2')
        .map((call) => call.parameters.p_event.state)
      expect(authored.length).toBeGreaterThan(0)
      expect(authored).not.toContain('provider-accepted')
      expect(new Set(authored).size).toBeLessThanOrEqual(3)
      for (const state of authored) {
        expect(['created', 'submitted', 'timeout-indeterminate']).toContain(state)
      }
    }
    // provider-accepted exists in the ledger, and only the SQL transaction wrote it.
    const accepted = delivered.attemptEvents.filter((event) => event.state === 'provider-accepted')
    expect(accepted).toHaveLength(1)
    expect(accepted[0].source).toBe('delivery_transaction')
    expect(quarantined.attemptEvents.some((event) => event.state === 'provider-accepted')).toBe(false)
  })

  it('never routes through an external provider, email, or SMS', async () => {
    const estate = createDurableEstate()
    const { worker, provider } = workerFixture(estate)
    await run(worker)
    expect(provider.channel).toBe('in-app')
    expect(estate.namesCalled().some((name) => /email|sms|external/i.test(name))).toBe(false)
  })

  it('discloses no learner text, transcript, or contact destination in any RPC payload', async () => {
    const estate = createDurableEstate()
    const { worker } = workerFixture(estate)
    await run(worker)
    const wire = JSON.stringify(estate.calls)
    for (const forbidden of [
      'rawText', 'learnerText', 'tutorText', 'transcript', 'audio', 'email',
      'phone', 'postalAddress', 'destination', 'messageBody', 'credential',
      'serviceRole', 'opaque-worker-credential',
    ]) expect(wire).not.toContain(forbidden)
    expect(wire).toContain(DELIVERY_KEY)
    expect(wire).toContain(RECIPIENT_REF)
    expect(wire).toContain(ROUTE_REF)
  })
})

describe('C2 v2 operations adapter — failure matrix', () => {
  it('cancels invalid delivery payloads with invalid_delivery', async () => {
    const estate = createDurableEstate()
    const { worker } = workerFixture(estate, {
      schema: { isReady: () => true, safeParse: () => ({ success: false, error: 'bad' }) },
    })
    await expect(run(worker)).resolves.toMatchObject({ cancelled: 1, delivered: 0 })
    expect(estate.job.state).toBe('cancelled')
    expect(estate.callsTo('academy_study_cancel_delivery_job_v2')[0].parameters.p_reason_code)
      .toBe('invalid_delivery')
    expect(estate.attemptEvents).toHaveLength(0)
  })

  it('cancels unresolvable recipients with invalid_recipient', async () => {
    const estate = createDurableEstate()
    const { worker } = workerFixture(estate, {
      resolver: { isReady: () => true, resolve: async () => ({ status: 'not_found' }) },
    })
    await expect(run(worker)).resolves.toMatchObject({ cancelled: 1, delivered: 0 })
    expect(estate.callsTo('academy_study_cancel_delivery_job_v2')[0].parameters.p_reason_code)
      .toBe('invalid_recipient')
    expect(estate.job.state).toBe('cancelled')
  })

  it('fails closed when the lease token is wrong before any provider work', async () => {
    const estate = createDurableEstate()
    const { worker } = workerFixture(estate, {
      patchOperations: (operations) => ({
        ...operations,
        claim: async (input) => (await operations.claim(input)).map((claim) => ({
          ...claim, leaseToken: 'lease-forged-uuid',
        })),
      }),
    })
    await expect(run(worker)).resolves.toMatchObject({ delivered: 0, failed: 1 })
    expect(estate.attemptEvents).toHaveLength(0)
    expect(estate.notifications.size).toBe(0)
    expect(estate.receipts).toHaveLength(0)
  })

  it('fails closed for a wrong worker identity', async () => {
    const estate = createDurableEstate()
    const { worker } = workerFixture(estate, {
      workerCredentialVerifier: {
        isReady: () => true, isDurable: true,
        verify: async () => ({ ...AUTHORITY, workerIdentity: 'worker:other' }),
      },
    })
    await expect(run(worker)).rejects.toThrow()
    expect(estate.job.state).toBe('pending')
    expect(estate.notifications.size).toBe(0)
  })

  it('fails closed on an expired lease and leaves the job recoverable', async () => {
    const estate = createDurableEstate()
    const { worker } = workerFixture(estate, {
      now: () => new Date(estate.now()),
      resolver: {
        isReady: () => true,
        resolve: async ({ delivery }) => {
          estate.advanceTo('2026-08-07T12:30:00.000Z')
          return { recipient: { recipientRef: delivery.recipientRef } }
        },
      },
    })
    await expect(run(worker)).resolves.toMatchObject({ delivered: 0, failed: 1 })
    expect(estate.notifications.size).toBe(0)
    expect(estate.attemptEvents).toHaveLength(0)
  })

  it('cancels when the recipient is revoked inside the delivery transaction', async () => {
    const estate = createDurableEstate({ recipientRevoked: true })
    const { worker } = workerFixture(estate)
    await expect(run(worker)).resolves.toMatchObject({ delivered: 0 })
    expect(estate.job.state).toBe('cancelled')
    expect(estate.notifications.size).toBe(0)
    expect(estate.receipts).toHaveLength(0)
    // Submitted work is never released back to pending.
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(0)
  })

  it('quarantines a provider outcome that is indeterminate after submission', async () => {
    const estate = createDurableEstate()
    const provider = {
      isReady: () => true, channel: 'in-app', providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1', isDurable: true, isTestProvider: false,
      adultReviewInAppDeliveryPolicy: 'approved',
      deliver: async ({ onAttemptSubmitted, delivery }) => {
        await onAttemptSubmitted({ attemptId: delivery.attemptId })
        const error = new Error('provider timeout')
        error.indeterminate = true
        throw error
      },
    }
    const { worker } = workerFixture(estate, { provider })
    await expect(run(worker)).resolves.toMatchObject({ indeterminate: 1, delivered: 0 })
    expect(estate.attemptEvents.map((event) => event.state))
      .toEqual(['created', 'submitted', 'timeout-indeterminate'])
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(0)
    expect(estate.job.state).toBe('leased')
    estate.advanceTo('2026-08-07T12:30:00.000Z')
    await createSupabaseAdultReviewOperations({ rpc: estate.rpc }).claim({
      workerContext: AUTHORITY, limit: 1, leaseMs: 60_000,
      now: new Date(estate.now()), trigger: 'scheduled',
    })
    expect(estate.job.state).toBe('indeterminate')
  })

  it('releases a provider failure that happened before submission', async () => {
    const estate = createDurableEstate()
    const provider = {
      isReady: () => true, channel: 'in-app', providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1', isDurable: true, isTestProvider: false,
      adultReviewInAppDeliveryPolicy: 'approved',
      deliver: async () => { throw new Error('provider unavailable') },
    }
    const { worker } = workerFixture(estate, { provider })
    await expect(run(worker)).resolves.toMatchObject({ failed: 1, delivered: 0 })
    expect(estate.attemptEvents).toHaveLength(0)
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(1)
    expect(estate.job.state).toBe('pending')
  })

  it('rejects a receipt whose attempt identity does not match the proof', async () => {
    const estate = createDurableEstate()
    let committed = 0
    const { worker } = workerFixture(estate, {
      patchOperations: (operations) => ({
        ...operations,
        validateCurrentAttempt: async (input) => ({
          ...(await operations.validateCurrentAttempt(input)), attemptId: 'attempt:mismatch',
        }),
        commitReceipt: async (input) => { committed += 1; return operations.commitReceipt(input) },
      }),
    })
    await expect(run(worker)).resolves.toMatchObject({ delivered: 0, failed: 1 })
    expect(committed).toBe(0)
  })

  // Receipt verification runs after the durable delivery transaction has already
  // committed the notification, receipt, receipt event, and terminal state. A
  // verification failure therefore cannot be "quarantined": the job is already
  // terminal. The correct outcome is that the worker refuses to claim success,
  // writes nothing further, and the job stays delivered and unclaimable.
  it.each([
    ['unverifiable receipt', () => ({ verified: false })],
    ['mismatched receipt id', (result) => ({ ...result, providerReceiptRef: 'in-app-receipt:other' })],
  ])('fails closed on a %s without disturbing the committed delivery', async (_label, verifyOverride) => {
    const estate = createDurableEstate({ verifyOverride })
    const { worker } = workerFixture(estate)
    await expect(run(worker)).resolves.toMatchObject({
      delivered: 0, indeterminate: 0, cancelled: 0, failed: 1,
    })
    expect(estate.job.state).toBe('delivered')
    expect(estate.receipts).toHaveLength(1)
    expect(estate.receiptEvents).toHaveLength(1)
    expect(estate.notifications.size).toBe(1)
    // No release, and no attempt event written after the terminal transition.
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(0)
    expect(estate.attemptEvents.map((event) => event.state))
      .toEqual(['created', 'submitted', 'provider-accepted', 'receipt-verified'])
    // A delivered job is terminal, so nothing can re-deliver it.
    await expect(run(worker)).resolves.toMatchObject({ claimed: 0 })
    expect(estate.receipts).toHaveLength(1)
  })

  it('does not deliver twice on a replayed claim of a delivered job', async () => {
    const estate = createDurableEstate()
    const { worker } = workerFixture(estate)
    await expect(run(worker)).resolves.toMatchObject({ delivered: 1 })
    const receiptsAfter = estate.receipts.length
    const eventsAfter = estate.attemptEvents.length
    // The delivered job is terminal, so a second run claims nothing.
    await expect(run(worker)).resolves.toMatchObject({ claimed: 0, delivered: 0 })
    expect(estate.receipts).toHaveLength(receiptsAfter)
    expect(estate.attemptEvents).toHaveLength(eventsAfter)
    expect(estate.job.state).toBe('delivered')
  })

  it('fails closed when a post-submit error occurs before the receipt commits', async () => {
    const estate = createDurableEstate()
    const { worker } = workerFixture(estate, {
      patchOperations: (operations) => ({
        ...operations,
        commitReceipt: async () => { throw new Error('commit exploded') },
      }),
    })
    await expect(run(worker)).resolves.toMatchObject({ delivered: 0, failed: 1 })
    expect(estate.callsTo('academy_study_release_delivery_lease_v2')).toHaveLength(0)
    expect(estate.receipts).toHaveLength(1)
    expect(estate.receiptEvents).toHaveLength(1)
  })
})
