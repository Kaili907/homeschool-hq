import { createHash, timingSafeEqual } from 'node:crypto'
import { getHeader } from '../http.js'
import {
  ADULT_REVIEW_WORKER_AUTHORITY_SCHEMA_VERSION,
  ADULT_REVIEW_WORKER_SCOPE,
  validateVerifiedWorkerContext,
} from './context.js'

/**
 * Worker credential and invocation authority for the Netlify adult-review
 * worker entrypoint.
 *
 * Two different things are modelled here, and the difference is the whole
 * security argument:
 *
 *   1. The verified worker context this module mints is a CONFIGURATION
 *      BINDING ARTIFACT. It proves only that the credential material presented
 *      to this process equals the credential material this deployment was
 *      configured with, and it packages that fact in the exact envelope
 *      `createAdultReviewWorker` requires. It is not, and must not be read as,
 *      an authorization decision.
 *
 *   2. The REAL durable authorization authority is the SQL worker registry
 *      reached through the RPC boundary. Every durable call made with this
 *      envelope also carries the credential headers that
 *      `createSupabaseServiceRpc` attaches, and the registry re-checks
 *      identity, version, scope, expiry, and revocation there.
 *
 * The consequence is deliberate: a credential that still matches this
 * deployment's configuration but has been revoked in the durable registry
 * verifies locally and then fails on the very next durable RPC. Local
 * verification can never widen durable authority, only narrow it.
 *
 * The credential is never logged, never returned in a response, never placed
 * in a monitoring event, and never derived from anything the caller supplied.
 */

// The envelope covers a single worker run. It is minted per verification and
// deliberately short: it is configuration evidence, not a durable grant.
const CONTEXT_TTL_MS = 300_000
const VERIFIER_VERSION = 'netlify-adult-review-worker-verifier-v1'
const INVOCATION_HEADER = 'x-academy-study-worker-invocation'
const MIN_CREDENTIAL_LENGTH = 32
const MAX_CREDENTIAL_LENGTH = 512
// Matches the `WORKER_REF` shape the durable RPC boundary enforces on the
// identity and version headers it sends alongside every call.
const WORKER_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/

function trimmed(env, name) {
  const value = env?.[name]
  return typeof value === 'string' ? value.trim() : ''
}

function boundedSecret(value) {
  return value.length >= MIN_CREDENTIAL_LENGTH && value.length <= MAX_CREDENTIAL_LENGTH
}

/**
 * Constant-time comparison over fixed-width digests, so neither the outcome
 * nor the operand lengths are observable from timing.
 */
function secretEquals(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  return timingSafeEqual(
    createHash('sha256').update(left, 'utf8').digest(),
    createHash('sha256').update(right, 'utf8').digest(),
  )
}

function workerConfiguration(env) {
  const configuration = {
    workerIdentity: trimmed(env, 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID'),
    credentialId: trimmed(env, 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID'),
    credentialVersion: trimmed(env, 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION'),
    configurationVersion: trimmed(env, 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION'),
    credential: trimmed(env, 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL'),
  }
  if (
    !WORKER_REF.test(configuration.workerIdentity) ||
    !WORKER_REF.test(configuration.credentialId) ||
    !WORKER_REF.test(configuration.credentialVersion) ||
    !WORKER_REF.test(configuration.configurationVersion) ||
    !boundedSecret(configuration.credential)
  ) return null
  return configuration
}

/**
 * A non-secret binding reference. It is derived only from configuration
 * identifiers and the verification instant, so it can be recorded as audit
 * evidence without ever carrying credential material.
 */
function verificationRef(configuration, checkedAt) {
  const digest = createHash('sha256').update(JSON.stringify({
    workerIdentity: configuration.workerIdentity,
    credentialId: configuration.credentialId,
    credentialVersion: configuration.credentialVersion,
    configurationVersion: configuration.configurationVersion,
    scope: ADULT_REVIEW_WORKER_SCOPE,
    checkedAt,
  }), 'utf8').digest('hex')
  return `verification:${digest}`
}

export class WorkerCredentialConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'WorkerCredentialConfigurationError'
  }
}

/**
 * Mints the verified worker context `createAdultReviewWorker` requires from
 * this deployment's configured credential material.
 *
 * `isDurable` is true because this verifier is bound to durable deployment
 * configuration rather than to an in-process test double; it does not claim
 * that this module decided authorization. See the module header.
 */
export function createNetlifyWorkerCredentialVerifier(options = {}) {
  const env = options.env ?? process.env
  const configuration = workerConfiguration(env)

  async function verify(request = {}) {
    if (!configuration) throw new Error('worker_credential_not_configured')
    if (request.trigger !== 'scheduled' && request.trigger !== 'manual') {
      throw new Error('worker_credential_verification_failed')
    }
    if (
      request.requiredScope !== ADULT_REVIEW_WORKER_SCOPE ||
      request.requiredSchemaVersion !== ADULT_REVIEW_WORKER_AUTHORITY_SCHEMA_VERSION ||
      request.requiredCredentialVersion !== configuration.credentialVersion
    ) throw new Error('worker_credential_verification_failed')

    const checkedAtMs = Date.parse(request.checkedAt)
    if (!Number.isFinite(checkedAtMs)) throw new Error('worker_credential_verification_failed')

    // Caller-supplied identity is never read. Only the credential material is
    // taken from the request, and only to be compared with configuration.
    const presented = request.workerCredential
    if (
      typeof presented !== 'string' ||
      !boundedSecret(presented) ||
      !secretEquals(presented, configuration.credential)
    ) throw new Error('worker_credential_verification_failed')

    const checkedAt = new Date(checkedAtMs).toISOString()
    return validateVerifiedWorkerContext({
      verified: true,
      schemaVersion: ADULT_REVIEW_WORKER_AUTHORITY_SCHEMA_VERSION,
      workerIdentity: configuration.workerIdentity,
      credentialId: configuration.credentialId,
      credentialVersion: configuration.credentialVersion,
      scope: ADULT_REVIEW_WORKER_SCOPE,
      expiresAt: new Date(checkedAtMs + CONTEXT_TTL_MS).toISOString(),
      revoked: false,
      verifierVersion: VERIFIER_VERSION,
      verificationRef: verificationRef(configuration, checkedAt),
    }, { at: new Date(checkedAtMs) })
  }

  return Object.freeze({
    isDurable: true,
    isReady: () => configuration !== null,
    credentialVersion: configuration?.credentialVersion,
    workerIdentity: configuration?.workerIdentity,
    verify,
  })
}

/**
 * Invocation authority for the worker HTTP entrypoint.
 *
 * `x-nf-event: schedule` is an ordinary request header on the function event.
 * Nothing in this runtime authenticates it, and a Netlify scheduled invocation
 * cannot be configured to present a secret of its own, so there is no
 * independent proof available for the scheduled trigger. This public/manual
 * authority therefore refuses scheduled claims outright. The separate
 * Netlify Scheduled Function uses the platform's private schedule boundary,
 * never this request-header authority.
 *
 * Manual invocation is authorized against a server-held secret that a real
 * authorized operator can actually present, compared in constant time.
 */
export function createNetlifyWorkerInvocationAuthorization(options = {}) {
  const env = options.env ?? process.env
  const monitor = options.monitor
  const configuration = workerConfiguration(env)
  const invocationSecret = trimmed(env, 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET')
  const configured = configuration !== null && boundedSecret(invocationSecret)

  return Object.freeze({
    isDurable: true,
    isReady: () => configured && typeof monitor?.record === 'function',

    // Scheduled triggers are refused here, before any credential is read.
    scheduledInvocationAuthority: 'blocked',

    async credentialForEvent({ event, trigger } = {}) {
      if (!configured || trigger !== 'manual') return Object.freeze({ authorized: false })
      const presented = getHeader(event?.headers, INVOCATION_HEADER)
      if (!boundedSecret(presented) || !secretEquals(presented, invocationSecret)) {
        return Object.freeze({ authorized: false })
      }
      return Object.freeze({ authorized: true, workerCredential: configuration.credential })
    },

    async recordDenied({ eventName, reasonCode }) {
      await monitor?.record?.(eventName, {
        occurrences: 1,
        value: 1,
        dimensions: { source: 'netlify-function', reason_code: reasonCode },
      })
    },
  })
}

/**
 * Server-configured credential source for the separate Netlify Scheduled
 * Function entrypoint.
 *
 * This object does not inspect an event, request, header, payload, learner, or
 * session. Netlify's checked-in `schedule` configuration is the invocation
 * boundary: scheduled functions have no production URL. Once that private
 * platform boundary has invoked the entrypoint, this source supplies the same
 * deployment credential that the worker verifies locally and every durable
 * RPC re-verifies against the SQL worker registry.
 */
export function createNetlifyScheduledWorkerCredentialSource(options = {}) {
  const env = options.env ?? process.env
  const configuration = workerConfiguration(env)

  return Object.freeze({
    isDurable: true,
    isReady: () => configuration !== null,
    authorityBoundary: 'netlify-scheduled-function',

    async credentialForRun() {
      if (!configuration) throw new WorkerCredentialConfigurationError(
        'Scheduled worker credential is not configured',
      )
      return configuration.credential
    },
  })
}

export const ADULT_REVIEW_WORKER_INVOCATION_HEADER = INVOCATION_HEADER
export const ADULT_REVIEW_WORKER_VERIFIER_VERSION = VERIFIER_VERSION
