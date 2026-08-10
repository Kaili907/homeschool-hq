import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js'
import { ADULT_REVIEW_WORKER_SCOPE, workerContextForRpc } from '../study-worker/context.js'

/**
 * Durable v2 operations adapter for the adult-review delivery worker.
 *
 * Every port below maps onto one accepted C2 SQL contract and adapts only what
 * the worker's own proof shapes require:
 *
 *   claim()                 -> academy_study_claim_delivery_jobs_v2        (M1)
 *   validateLease()         -> academy_study_prove_delivery_lease_v2       (M2)
 *   validateCurrentAttempt()-> academy_study_prove_current_attempt_v2      (M3)
 *   cancel()                -> academy_study_cancel_delivery_job_v2        (M4)
 *   renewLease()            -> academy_study_renew_delivery_lease_v2
 *   releaseLease()          -> academy_study_release_delivery_lease_v2
 *   recordAttemptSubmitted()-> create_delivery_attempt_v2 + record_attempt_event_v2 + M3
 *   markIndeterminate()     -> record_attempt_event_v2 ('timeout-indeterminate')
 *   commitReceipt()         -> academy_study_verify_in_app_notification_v2 (read-only)
 *
 * The SQL is authoritative. This module renames nothing the durable estate owns
 * except the one field the worker spells differently (`revision` is surfaced as
 * `leaseRevision`, because `revision` is what every lease-bound RPC compares),
 * and it never invents a server-owned identifier, token, revision, or expiry.
 */

const PROVIDER_ACCEPTED_STATE = 'provider-accepted'
// C2 M6 moved the provider transition into the delivery transaction. JS may
// author only the states on either side of that boundary.
const JS_AUTHORED_ATTEMPT_STATES = new Set([
  'created', 'submitted', 'timeout-indeterminate',
])
const CANCEL_REASONS = new Set(['invalid_delivery', 'invalid_recipient'])
// The only reason for which returning a job to 'pending' is safe. Every other
// reason reaches this port after the provider boundary was crossed.
const RELEASABLE_REASONS = new Set(['processing_incomplete'])

const CLAIM_ENVELOPE_KEYS = ['jobs', 'serverTime']
const CLAIM_JOB_KEYS = [
  'claimId', 'jobId', 'proposalId', 'householdId', 'studentId', 'templateCode',
  'recipientRef', 'routeRef', 'route', 'idempotencyKey', 'leaseToken',
  'leaseExpiresAt', 'leaseGeneration', 'revision',
]
const SQL_LEASE_PROOF_KEYS = [
  'active', 'jobId', 'leaseToken', 'leaseRevision', 'leaseExpiresAt',
]
const ATTEMPT_PROOF_KEYS = [
  'current', 'attemptId', 'jobId', 'leaseToken', 'deliveryIdempotencyKey',
  'providerName', 'providerConfigVersion',
]
const RENEW_KEYS = ['renewed', 'revision', 'leaseExpiresAt']
const RELEASE_KEYS = ['released']
const CANCEL_KEYS = ['cancelled', 'replay', 'state', 'jobId', 'reasonCode', 'revision']
const ATTEMPT_EVENT_KEYS = ['recorded', 'state']
const VERIFY_BINDING_KEYS = [
  'providerReceiptRef', 'providerName', 'route', 'routeRef', 'jobId',
  'attemptId', 'proposalId', 'householdId', 'studentId', 'recipientRef',
  'deliveryIdempotencyKey', 'providerConfigVersion',
]
// Every field the verification RPC discloses must agree with the receipt the
// provider already validated. Nothing here is defaulted or reconstructed.
const RECEIPT_CONFIRMATION_KEYS = [
  'receiptSchemaVersion', 'providerReceiptRef', 'jobId', 'attemptId',
  'deliveryIdempotencyKey', 'recipientRef', 'proposalId', 'householdId',
  'studentId', 'routeRef', 'route', 'providerName', 'providerConfigVersion',
  'deliveredAt', 'evidenceRef', 'eventIdempotencyKey', 'receiptSource',
  'testReceipt',
]

// `workerContextForRpc` minimizes a verified authority by dropping `verified`
// and `revoked`, so its own output can never be re-validated as one. The G1
// in-app persistence hands the lease context exactly that minimized projection.
const RPC_CONTEXT_KEYS = [
  'schemaVersion', 'workerIdentity', 'credentialId', 'credentialVersion',
  'scope', 'expiresAt', 'verifierVersion', 'verificationRef',
]

const NORMALIZED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
// M2 already emits normalized UTC milliseconds. M1 and the renew RPC project a
// raw timestamptz, which on hosted PostgreSQL carries a numeric timezone offset
// and up to microsecond precision.
const SERVER_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2}|[+-]\d{4}|[+-]\d{2})$/

function exact(value, keys, code = 'durable_port_contract') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code)
  const actual = Object.keys(value)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(code)
  }
  return value
}

/**
 * Accepts both valid server timestamp shapes and returns the single form the
 * worker and receipt contracts accept. Sub-millisecond precision is truncated,
 * never rounded, so a normalized lease expiry can never read later than the
 * instant the server actually granted.
 */
export function normalizeServerTimestamp(value) {
  if (typeof value !== 'string') throw new Error('durable_port_contract')
  if (NORMALIZED_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))) return value
  const match = SERVER_TIMESTAMP.exec(value)
  if (!match) throw new Error('durable_port_contract')
  const [, date, time, fraction = '', offset] = match
  const millis = `${fraction}000`.slice(0, 3)
  const zone = offset === 'Z' || offset.includes(':')
    ? offset
    : offset.length === 3 ? `${offset}:00` : `${offset.slice(0, 3)}:${offset.slice(3)}`
  const parsed = Date.parse(`${date}T${time}.${millis}${zone}`)
  if (!Number.isFinite(parsed)) throw new Error('durable_port_contract')
  return new Date(parsed).toISOString()
}

/**
 * Accepts either a fully verified worker authority (what the worker passes) or
 * the already-minimized RPC projection of one (what the G1 in-app persistence
 * passes into the lease context), and returns the minimized form in both cases.
 * The minimized branch re-checks scope and expiry so a garbage context still
 * fails closed; it cannot re-check `verified`/`revoked`, which the module that
 * produced it had already enforced.
 */
function rpcWorkerContext(value) {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'verified')) {
    return workerContextForRpc(value)
  }
  exact(value, RPC_CONTEXT_KEYS, 'worker_credential_verification_failed')
  if (
    value.scope !== ADULT_REVIEW_WORKER_SCOPE ||
    typeof value.workerIdentity !== 'string' || value.workerIdentity === '' ||
    typeof value.credentialVersion !== 'string' || value.credentialVersion === '' ||
    !NORMALIZED_TIMESTAMP.test(value.expiresAt) ||
    !(Date.parse(value.expiresAt) > Date.now())
  ) throw new Error('worker_credential_verification_failed')
  return Object.freeze({ ...value })
}

// The SQL claim bounds. Adapting to the documented range keeps a worker option
// from turning the whole batch into STUDY_DELIVERY_CLAIM_INVALID.
function leaseSeconds(leaseMs) {
  return Math.min(300, Math.max(5, Math.ceil(Number(leaseMs) / 1000) || 5))
}
function batchSize(limit) {
  return Math.min(50, Math.max(1, Math.trunc(Number(limit)) || 1))
}

/**
 * The delivery attempt identifier is derived from durable job identity the
 * server itself disclosed: it is stable for one lease generation, so a retry
 * inside the same lease is idempotent, and it changes on re-claim, which is
 * exactly the binding `attempt.lease_generation = job.lease_generation` enforces.
 */
function deriveAttemptId(jobId, generation) {
  return `attempt:${jobId}:${generation}`
}

export function createSupabaseAdultReviewOperations(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options)
  // Lease identity as the durable claim disclosed it. Held here so the G1 lease
  // context never has to trust a caller-authored token. Replaced wholesale by
  // each claim batch, so it cannot outgrow one batch.
  let held = new Map()

  function call(name, parameters, workerContext) {
    return rpc.call(name, parameters, { requireWorkerCredential: true, workerContext })
  }

  async function proveLease({ claimId, jobId, leaseToken, workerContext }) {
    const proof = exact(await call('academy_study_prove_delivery_lease_v2', {
      p_worker_id: workerContext.workerIdentity,
      p_job_id: jobId,
      p_lease_token: leaseToken,
    }, workerContext), SQL_LEASE_PROOF_KEYS)

    // `active` reports proof liveness only. A delivered job keeps its lease
    // identity as terminal evidence, so this may be true for work that can no
    // longer be claimed, renewed, released, cancelled, or attempted. No branch
    // in this module treats it as permission to mutate; every mutating port
    // goes straight to a SQL RPC that requires state 'leased'.
    if (proof.active !== true) {
      return Object.freeze({
        active: false, claimId, jobId: proof.jobId,
        leaseToken: null, leaseRevision: null, leaseExpiresAt: null,
      })
    }
    if (typeof proof.leaseToken !== 'string' || !Number.isSafeInteger(proof.leaseRevision)) {
      throw new Error('durable_port_contract')
    }
    // Only the caller's already-known claimId is reattached; the SQL proof does
    // not carry one. Every other field is the server's.
    return Object.freeze({
      active: true,
      claimId,
      jobId: proof.jobId,
      leaseToken: proof.leaseToken,
      leaseRevision: proof.leaseRevision,
      leaseExpiresAt: normalizeServerTimestamp(proof.leaseExpiresAt),
    })
  }

  async function proveCurrentAttempt({ jobId, attemptId, leaseToken, workerContext }) {
    const proof = exact(await call('academy_study_prove_current_attempt_v2', {
      p_worker_id: workerContext.workerIdentity,
      p_job_id: jobId,
      p_attempt_id: attemptId,
      p_lease_token: leaseToken,
    }, workerContext), ATTEMPT_PROOF_KEYS)
    return Object.freeze({ ...proof })
  }

  async function recordAttemptEvent(event, workerContext) {
    // Structural guarantee for C2 M6: this adapter cannot author the provider
    // transition, whatever a caller asks for.
    if (event.state === PROVIDER_ACCEPTED_STATE || !JS_AUTHORED_ATTEMPT_STATES.has(event.state)) {
      throw new Error('provider_transition_not_owned_by_js')
    }
    const result = exact(await call('academy_study_record_attempt_event_v2', {
      p_worker_id: workerContext.workerIdentity,
      p_event: {
        attemptId: event.attemptId,
        jobId: event.jobId,
        state: event.state,
        structuredResult: event.structuredResult,
        timeoutState: event.timeoutState,
        retryDecision: event.retryDecision,
        errorCode: null,
      },
    }, workerContext), ATTEMPT_EVENT_KEYS)
    if (result.recorded !== true || result.state !== event.state) {
      throw new Error('durable_port_contract')
    }
  }

  const operations = {
    isDurable: true,
    isReady: () => rpc?.isConfigured?.() === true,

    async claim({ workerContext, limit, leaseMs }) {
      const authority = workerContextForRpc(workerContext)
      const envelope = exact(await call('academy_study_claim_delivery_jobs_v2', {
        p_worker_id: authority.workerIdentity,
        p_batch_size: batchSize(limit),
        p_lease_seconds: leaseSeconds(leaseMs),
      }, authority), CLAIM_ENVELOPE_KEYS)
      if (!Array.isArray(envelope.jobs)) throw new Error('durable_port_contract')

      const claims = envelope.jobs.map((job) => {
        exact(job, CLAIM_JOB_KEYS)
        if (!Number.isSafeInteger(job.revision) || !Number.isSafeInteger(job.leaseGeneration)) {
          throw new Error('durable_port_contract')
        }
        return Object.freeze({
          claimId: job.claimId,
          jobId: job.jobId,
          proposalId: job.proposalId,
          householdId: job.householdId,
          studentId: job.studentId,
          templateCode: job.templateCode,
          recipientRef: job.recipientRef,
          routeRef: job.routeRef,
          route: job.route,
          idempotencyKey: job.idempotencyKey,
          attemptId: deriveAttemptId(job.jobId, job.leaseGeneration),
          leaseToken: job.leaseToken,
          leaseGeneration: job.leaseGeneration,
          // The worker's lease revision is the job revision every lease-bound
          // RPC compares. `leaseGeneration` is a different durable counter and
          // is deliberately not conflated with it.
          leaseRevision: job.revision,
          leaseExpiresAt: normalizeServerTimestamp(job.leaseExpiresAt),
        })
      })
      held = new Map(claims.map((claim) => [claim.jobId, claim]))
      return claims
    },

    async validateLease({ claimId, jobId, leaseToken, workerContext }) {
      return proveLease({
        claimId, jobId, leaseToken, workerContext: workerContextForRpc(workerContext),
      })
    },

    async renewLease({ claimId, jobId, leaseToken, leaseRevision, workerContext, leaseMs }) {
      const authority = workerContextForRpc(workerContext)
      const renewed = exact(await call('academy_study_renew_delivery_lease_v2', {
        p_worker_id: authority.workerIdentity,
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_expected_revision: leaseRevision,
        p_lease_seconds: leaseSeconds(leaseMs),
      }, authority), RENEW_KEYS)
      if (renewed.renewed !== true) throw new Error('durable_port_contract')
      // The renew RPC reports the new revision and expiry but no lease identity.
      // Read the proof back rather than assembling one, so every lease proof the
      // worker sees comes from the read-only proof contract.
      const proof = await proveLease({ claimId, jobId, leaseToken, workerContext: authority })
      if (proof.active !== true || proof.leaseRevision !== renewed.revision) {
        throw new Error('lease_renewal_not_proven')
      }
      return proof
    },

    async releaseLease({ jobId, leaseToken, leaseRevision, workerContext, reason }) {
      // Load-bearing. Once provider work has been submitted, the SQL release
      // path is not merely unnecessary, it is unsafe: returning the job to
      // 'pending' would make a delivery that may already have happened eligible
      // to be attempted again. Post-submit work waits for lease expiry, which
      // the M1 claim sweep resolves to 'indeterminate' with
      // 'lease-expired-after-submit' rather than to 'pending'.
      if (!RELEASABLE_REASONS.has(reason)) {
        return Object.freeze({ released: false, quarantined: true, reason })
      }
      const authority = workerContextForRpc(workerContext)
      const result = exact(await call('academy_study_release_delivery_lease_v2', {
        p_worker_id: authority.workerIdentity,
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_expected_revision: leaseRevision,
      }, authority), RELEASE_KEYS)
      if (result.released !== true) throw new Error('durable_port_contract')
      return Object.freeze({ released: true, quarantined: false, reason })
    },

    async recordAttemptSubmitted({
      jobId, attemptId, leaseToken, leaseRevision,
      providerName, providerConfigVersion, workerContext,
    }) {
      const authority = workerContextForRpc(workerContext)
      const created = await call('academy_study_create_delivery_attempt_v2', {
        p_worker_id: authority.workerIdentity,
        p_attempt: {
          jobId,
          leaseToken,
          expectedRevision: leaseRevision,
          attemptId,
          providerName,
          providerConfigVersion,
        },
      }, authority)
      if (typeof created?.created !== 'boolean' || created.attemptId !== attemptId ||
        !Number.isSafeInteger(created.revision)) {
        throw new Error('durable_port_contract')
      }

      const event = { attemptId, jobId }
      await recordAttemptEvent({
        ...event,
        state: 'created',
        structuredResult: 'attempt-created',
        timeoutState: 'not-timed-out',
        retryDecision: 'not-applicable',
      }, authority)
      await recordAttemptEvent({
        ...event,
        state: 'submitted',
        structuredResult: 'provider-submitted',
        timeoutState: 'not-timed-out',
        // An in-app submission must never be replayed against the provider.
        retryDecision: 'do-not-retry',
      }, authority)

      // The worker's attempt proof is the server's, including the stored
      // provider identity. Nothing the caller supplied overrides it.
      return proveCurrentAttempt({ jobId, attemptId, leaseToken, workerContext: authority })
    },

    async validateCurrentAttempt({ jobId, attemptId, leaseToken, workerContext }) {
      return proveCurrentAttempt({
        jobId, attemptId, leaseToken, workerContext: workerContextForRpc(workerContext),
      })
    },

    async cancel({ jobId, leaseToken, leaseRevision, workerContext, reason }) {
      if (!CANCEL_REASONS.has(reason)) throw new Error('cancel_reason_not_permitted')
      const authority = workerContextForRpc(workerContext)
      const result = exact(await call('academy_study_cancel_delivery_job_v2', {
        p_worker_id: authority.workerIdentity,
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_expected_revision: leaseRevision,
        p_reason_code: reason,
      }, authority), CANCEL_KEYS)
      if (result.jobId !== jobId || result.reasonCode !== reason ||
        result.state !== 'cancelled' || typeof result.replay !== 'boolean' ||
        typeof result.cancelled !== 'boolean') {
        throw new Error('durable_port_contract')
      }
      // Replay is a settled outcome, not a failure: the same worker re-issuing
      // the same cancellation observes it and writes nothing.
      return Object.freeze({ ...result })
    },

    async markIndeterminate({ jobId, attemptId, workerContext }) {
      // With no durable attempt the provider boundary was never crossed, so
      // there is nothing to quarantine and nothing to record. The lease simply
      // expires and the claim sweep returns the job to 'pending'.
      if (typeof attemptId !== 'string' || attemptId === '') {
        return Object.freeze({ recorded: false, quarantined: false })
      }
      await recordAttemptEvent({
        attemptId,
        jobId,
        state: 'timeout-indeterminate',
        structuredResult: 'provider-outcome-indeterminate',
        timeoutState: 'after-submit',
        retryDecision: 'reconcile',
      }, workerContextForRpc(workerContext))
      return Object.freeze({ recorded: true, quarantined: true })
    },

    async commitReceipt({ jobId, workerContext, attempt, receipt }) {
      // There is no second receipt writer. The C2/G1 delivery transaction has
      // already written the notification, receipt, receipt event, and terminal
      // state; this port only re-reads the read-only verification proof and
      // confirms it still matches the receipt the provider returned.
      if (attempt?.attemptId !== receipt?.attemptId ||
        attempt?.jobId !== receipt?.jobId || jobId !== receipt?.jobId) {
        return Object.freeze({
          committed: false,
          replayed: true,
          receiptId: receipt?.providerReceiptRef,
          eventIdempotencyKey: receipt?.eventIdempotencyKey,
          attemptId: attempt?.attemptId,
          jobId,
        })
      }
      const authority = workerContextForRpc(workerContext)
      const binding = {}
      for (const key of VERIFY_BINDING_KEYS) binding[key] = receipt[key]
      const verified = await call('academy_study_verify_in_app_notification_v2', {
        p_worker_id: authority.workerIdentity,
        p_binding: binding,
      }, authority)
      if (verified?.verified !== true) throw new Error('receipt_confirmation_not_verified')
      for (const key of RECEIPT_CONFIRMATION_KEYS) {
        if (verified[key] !== receipt[key]) {
          throw new Error(`receipt_confirmation_mismatch:${key}`)
        }
      }
      return Object.freeze({
        committed: true,
        replayed: false,
        receiptId: verified.providerReceiptRef,
        eventIdempotencyKey: verified.eventIdempotencyKey,
        attemptId: verified.attemptId,
        jobId: verified.jobId,
      })
    },

    /**
     * Lease context for `createSupabaseInAppPersistence`. It discloses only the
     * two lease fields the exact G1 delivery payload needs, plus the two
     * liveness assertions that persistence checks. The lease token comes from
     * the durable claim this adapter holds, never from the delivery caller.
     */
    leaseContext: Object.freeze({
      async forAttempt({ jobId, attemptId, workerContext }) {
        const claim = held.get(jobId)
        if (!claim) throw new Error('lease_context_unknown_job')
        const authority = rpcWorkerContext(workerContext)
        const lease = await proveLease({
          claimId: claim.claimId, jobId, leaseToken: claim.leaseToken, workerContext: authority,
        })
        const attempt = await proveCurrentAttempt({
          jobId, attemptId, leaseToken: claim.leaseToken, workerContext: authority,
        })
        return Object.freeze({
          leaseToken: lease.leaseToken,
          // The live job revision. Attempt creation already advanced it, so a
          // value cached at claim time would fail the delivery binding.
          expectedRevision: lease.leaseRevision,
          active: lease.active === true,
          currentAttempt: attempt.current === true,
        })
      },
    }),
  }

  return Object.freeze(operations)
}
