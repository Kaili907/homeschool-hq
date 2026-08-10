import { validateVerifiedAdultReviewReceipt } from '../study-delivery/receipt-contract.js'
import {
  ADULT_REVIEW_WORKER_AUTHORITY_SCHEMA_VERSION,
  ADULT_REVIEW_WORKER_SCOPE,
  validateVerifiedWorkerContext,
} from '../study-worker/context.js'

const DEFAULT_BATCH_SIZE = 10
const DEFAULT_MAX_BATCH_SIZE = 50
const DEFAULT_LEASE_MS = 60_000

export { ADULT_REVIEW_WORKER_AUTHORITY_SCHEMA_VERSION, ADULT_REVIEW_WORKER_SCOPE }
const LEASE_PROOF_KEYS = new Set([
  'active', 'claimId', 'jobId', 'leaseToken', 'leaseRevision', 'leaseExpiresAt',
])
const ATTEMPT_PROOF_KEYS = new Set([
  'current', 'attemptId', 'jobId', 'leaseToken', 'deliveryIdempotencyKey',
  'providerName', 'providerConfigVersion',
])
const RECEIPT_COMMIT_KEYS = new Set([
  'committed', 'replayed', 'receiptId', 'eventIdempotencyKey', 'attemptId', 'jobId',
])
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
// The durable estate builds this key as `'delivery:' || study_sha256_json(...)`.
const DELIVERY_KEY = /^delivery:[a-f0-9]{64}$/
// Only permissions whose `recipient_ref` matches `^recipient:[0-9a-f]{64}$` are
// ever disclosed by the durable recipient resolution.
const RECIPIENT_REF = /^recipient:[a-f0-9]{64}$/

export class AdultReviewWorkerConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AdultReviewWorkerConfigurationError'
  }
}

export class AdultReviewWorkerAuthorizationError extends Error {
  constructor(message = 'A verified adult-review worker credential is required') {
    super(message)
    this.name = 'AdultReviewWorkerAuthorizationError'
    this.statusCode = 401
  }
}

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new AdultReviewWorkerConfigurationError(`Missing adult-review worker ${name}`)
  }
  return value
}

function method(port, name, aliases = []) {
  required(port, `${name} port`)
  for (const candidate of [name, ...aliases]) {
    if (typeof port[candidate] === 'function') return port[candidate].bind(port)
  }
  throw new AdultReviewWorkerConfigurationError(
    `Adult-review worker port is missing ${name}()`,
  )
}

function optionalMethod(port, names) {
  for (const name of names) {
    if (typeof port?.[name] === 'function') return port[name].bind(port)
  }
  return undefined
}

function exactObject(value, keys) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.size &&
    Object.keys(value).every((key) => keys.has(key)),
  )
}

function validRef(value) {
  return typeof value === 'string' && REF.test(value)
}

// `RegExp#test` coerces its argument, so the string guard is what stops a
// hostile carrier object from presenting a durable identifier it does not hold.
function matches(pattern, value) {
  return typeof value === 'string' && pattern.test(value)
}

function validTimestamp(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

function positiveInteger(value, fallback) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : fallback
}

function isProduction(environment) {
  return String(environment || '').toLowerCase() === 'production'
}

function isTestProvider(provider) {
  const kind = String(provider.kind || provider.name || '').toLowerCase()
  return (
    provider.testOnly === true ||
    provider.isTestProvider === true ||
    kind === 'test' ||
    kind === 'fake' ||
    kind === 'mock' ||
    kind.includes('test-provider')
  )
}

function claimIdOf(claim) {
  return claim?.claimId ?? claim?.id ?? claim?.deliveryId ?? claim?.jobId
}

function jobIdOf(claim) {
  return claim?.jobId ?? claim?.deliveryId
}

function validationResult(schema, claim) {
  const parse = optionalMethod(schema, ['safeParse', 'validate'])
  if (parse) {
    const result = parse(claim)
    if (result?.success === false || result?.valid === false) {
      return { valid: false, reason: result.error ?? result.errors ?? 'schema_validation_failed' }
    }
    if (result?.success === true) return { valid: true, value: result.data }
    if (result?.valid === true) return { valid: true, value: result.value ?? claim }
    if (result === false) return { valid: false, reason: 'schema_validation_failed' }
    if (result === true) return { valid: true, value: claim }
  }

  const parseOrThrow = optionalMethod(schema, ['parse'])
  if (!parseOrThrow) {
    throw new AdultReviewWorkerConfigurationError('Adult-review worker schema is missing parse()/safeParse()')
  }
  try {
    return { valid: true, value: parseOrThrow(claim) }
  } catch (error) {
    return { valid: false, reason: error }
  }
}

function resolvedRecipient(result) {
  if (!result || result.valid === false || result.status === 'invalid' || result.status === 'not_found') {
    return undefined
  }
  return result.recipient ?? result.value ?? result
}

function indeterminate(errorOrResult) {
  return Boolean(
    errorOrResult?.indeterminate === true ||
      errorOrResult?.status === 'indeterminate' ||
      errorOrResult?.state === 'indeterminate' ||
      errorOrResult?.outcome === 'indeterminate' ||
      errorOrResult?.code === 'DELIVERY_INDETERMINATE',
  )
}

function submitted(result) {
  return Boolean(
    result?.submitted === true ||
      result?.status === 'submitted' ||
      result?.status === 'accepted' ||
      result?.attemptId ||
      result?.providerAttemptId,
  )
}

function validateWorkerAuthority(value, at, requiredCredentialVersion) {
  try {
    const authority = validateVerifiedWorkerContext(value, { at })
    if (authority.credentialVersion !== requiredCredentialVersion) throw new Error('version_mismatch')
    return authority
  } catch {
    throw new AdultReviewWorkerAuthorizationError('Worker credential verification failed')
  }
}

function validateClaimBinding(delivery, recipient, provider) {
  const binding = {
    providerName: provider.providerName ?? provider.providerId,
    route: provider.channel,
    routeRef: delivery?.routeRef,
    jobId: jobIdOf(delivery),
    proposalId: delivery?.proposalId,
    householdId: delivery?.householdId,
    studentId: delivery?.studentId,
    recipientRef: recipient?.recipientRef,
    deliveryIdempotencyKey: delivery?.deliveryIdempotencyKey ?? delivery?.idempotencyKey,
    providerConfigVersion: provider.providerConfigVersion ?? provider.configurationVersion,
  }
  if (
    !validRef(binding.providerName) ||
    !validRef(binding.route) ||
    !validRef(binding.routeRef) ||
    !validRef(binding.jobId) ||
    !validRef(binding.proposalId) ||
    !validRef(binding.householdId) ||
    !validRef(binding.studentId) ||
    !matches(RECIPIENT_REF, binding.recipientRef) ||
    !matches(DELIVERY_KEY, binding.deliveryIdempotencyKey) ||
    !validRef(binding.providerConfigVersion) ||
    (delivery?.recipientRef !== undefined && delivery.recipientRef !== binding.recipientRef)
  ) throw new Error('delivery_binding_incomplete')
  return Object.freeze(binding)
}

function validateLeaseProof(value, expected, at) {
  if (
    !exactObject(value, LEASE_PROOF_KEYS) ||
    value.active !== true ||
    value.claimId !== expected.claimId ||
    value.jobId !== expected.jobId ||
    value.leaseToken !== expected.leaseToken ||
    !Number.isSafeInteger(value.leaseRevision) ||
    value.leaseRevision < expected.leaseRevision ||
    !validTimestamp(value.leaseExpiresAt) ||
    Date.parse(value.leaseExpiresAt) <= at.getTime()
  ) throw new Error('active_lease_required')
  return Object.freeze({ ...value })
}

function validateAttemptProof(value, binding) {
  if (
    !exactObject(value, ATTEMPT_PROOF_KEYS) ||
    value.current !== true ||
    !validRef(value.attemptId) ||
    value.jobId !== binding.jobId ||
    value.leaseToken !== binding.leaseToken ||
    value.deliveryIdempotencyKey !== binding.deliveryIdempotencyKey ||
    value.providerName !== binding.providerName ||
    value.providerConfigVersion !== binding.providerConfigVersion
  ) throw new Error('current_attempt_required')
  return Object.freeze({ ...value })
}

function validateReceiptCommit(value, receipt) {
  if (
    !exactObject(value, RECEIPT_COMMIT_KEYS) ||
    value.committed !== true ||
    value.replayed !== false ||
    value.receiptId !== receipt.providerReceiptRef ||
    value.eventIdempotencyKey !== receipt.eventIdempotencyKey ||
    value.attemptId !== receipt.attemptId ||
    value.jobId !== receipt.jobId
  ) throw new Error(value?.replayed === true ? 'receipt_replay_rejected' : 'receipt_commit_not_confirmed')
  return value
}

/**
 * Creates a fail-closed worker. The worker credential is verified inside the
 * worker for every run. Caller-authored identities are rejected and never
 * forwarded to durable ports.
 */
export function createAdultReviewWorker(options = {}) {
  const persistence = required(options.persistence, 'persistence')
  const resolver = required(options.resolver, 'resolver')
  const provider = required(options.provider, 'provider')
  const monitor = required(options.monitor, 'monitor')
  const schema = required(options.schema, 'schema')
  const workerCredentialVerifier = required(options.workerCredentialVerifier, 'credential verifier')
  const requiredCredentialVersion = required(options.workerCredentialVersion, 'credential version')
  const environment = options.environment ?? process.env.NODE_ENV

  if (
    workerCredentialVerifier.isDurable !== true ||
    typeof workerCredentialVerifier.isReady !== 'function'
  ) throw new AdultReviewWorkerConfigurationError('A durable worker credential verifier is required')
  if (isProduction(environment) && isTestProvider(provider)) {
    throw new AdultReviewWorkerConfigurationError('Test delivery providers are forbidden in production')
  }
  if (isProduction(environment) && provider.isDurable !== true) {
    throw new AdultReviewWorkerConfigurationError('A durable delivery provider is required in production')
  }
  if (
    isProduction(environment) &&
    provider.channel === 'in-app' &&
    provider.adultReviewInAppDeliveryPolicy !== 'approved'
  ) throw new AdultReviewWorkerConfigurationError('Adult-review in-app delivery policy is not approved')

  const readinessPorts = [
    ['persistence', persistence],
    ['resolver', resolver],
    ['provider', provider],
    ['monitor', monitor],
    ['schema', schema],
    ['worker credential verifier', workerCredentialVerifier],
  ]
  const verifyWorkerCredential = method(workerCredentialVerifier, 'verify', ['verifyCredential'])
  const claim = method(persistence, 'claim', ['claimDue', 'claimDeliveries'])
  const cancel = method(persistence, 'cancel', ['cancelClaim', 'cancelDelivery'])
  const renewLease = method(persistence, 'renewLease', ['renew'])
  const validateLease = method(persistence, 'validateLease', ['assertActiveLease'])
  const releaseLease = method(persistence, 'releaseLease', ['release'])
  const recordAttemptSubmitted = method(persistence, 'recordAttemptSubmitted', ['markAttemptSubmitted'])
  const validateCurrentAttempt = method(persistence, 'validateCurrentAttempt', ['assertCurrentAttempt'])
  const commitReceipt = method(persistence, 'commitReceipt', ['recordReceipt'])
  const markIndeterminate = method(persistence, 'markIndeterminate', ['recordIndeterminate'])
  const resolve = method(resolver, 'resolve', ['resolveRecipient'])
  const deliver = method(provider, 'deliver', ['send'])
  const recordMonitor = method(monitor, 'record', ['emit', 'capture'])
  const claimIndeterminate = optionalMethod(persistence, ['claimIndeterminate', 'claimForReconciliation'])
  const reconcileProvider = optionalMethod(provider, ['reconcile', 'lookupAttempt'])
  const resolveIndeterminate = optionalMethod(persistence, ['resolveIndeterminate', 'commitReconciliation'])
  const now = options.now ?? (() => new Date())
  const maxBatchSize = positiveInteger(options.maxBatchSize, DEFAULT_MAX_BATCH_SIZE)
  const defaultBatchSize = Math.min(
    positiveInteger(options.batchSize, DEFAULT_BATCH_SIZE),
    maxBatchSize,
  )
  const leaseMs = positiveInteger(options.leaseMs, DEFAULT_LEASE_MS)

  async function monitorEvent(name, workerContext) {
    await recordMonitor(name, {
      occurredAt: now().toISOString(),
      occurrences: 1,
      value: 1,
      workerIdentity: workerContext.workerIdentity,
      workerCredentialVersion: workerContext.credentialVersion,
      workerVerificationRef: workerContext.verificationRef,
    })
  }

  async function ready() {
    for (const [name, port] of readinessPorts) {
      const check = optionalMethod(port, ['ready', 'readiness', 'isReady'])
      if (!check) {
        throw new AdultReviewWorkerConfigurationError(`${name} port is missing readiness()`)
      }
      const result = await check()
      if (result === false || result?.ready === false || result?.ok === false) {
        throw new AdultReviewWorkerConfigurationError(`${name} port is not ready`)
      }
    }
    return { ready: true }
  }

  async function authorize(context) {
    if (!context || (context.trigger !== 'scheduled' && context.trigger !== 'manual')) {
      throw new AdultReviewWorkerAuthorizationError('Worker trigger is not authorized')
    }
    if (Object.hasOwn(context, 'workerIdentity') || Object.hasOwn(context, 'authenticated')) {
      throw new AdultReviewWorkerAuthorizationError('Caller-authored worker authority is forbidden')
    }
    if (!Object.hasOwn(context, 'workerCredential') || context.workerCredential == null) {
      throw new AdultReviewWorkerAuthorizationError()
    }
    const checkedAt = now()
    const authority = await verifyWorkerCredential({
      workerCredential: context.workerCredential,
      trigger: context.trigger,
      requiredScope: ADULT_REVIEW_WORKER_SCOPE,
      requiredCredentialVersion,
      requiredSchemaVersion: ADULT_REVIEW_WORKER_AUTHORITY_SCHEMA_VERSION,
      checkedAt: checkedAt.toISOString(),
    })
    return validateWorkerAuthority(authority, checkedAt, requiredCredentialVersion)
  }

  async function reconcile(context, workerContext, limit) {
    if (!claimIndeterminate && !reconcileProvider && !resolveIndeterminate) return 0
    if (!claimIndeterminate || !reconcileProvider || !resolveIndeterminate) {
      throw new AdultReviewWorkerConfigurationError(
        'Indeterminate reconciliation requires persistence claim/resolve and provider reconcile ports',
      )
    }

    const records = (await claimIndeterminate({
      workerContext,
      limit,
      leaseMs,
      now: now(),
      trigger: context.trigger,
    })) ?? []
    let completed = 0
    for (const record of records.slice(0, limit)) {
      const claimId = claimIdOf(record)
      try {
        const result = await reconcileProvider({ record, workerContext, trigger: context.trigger })
        await resolveIndeterminate({ claimId, record, result, workerContext, now: now() })
        completed += 1
      } catch {
        await releaseLease({ claimId, workerContext, reason: 'reconciliation_failed', now: now() })
        await monitorEvent('study.adult_review.indeterminate_job', workerContext)
      }
    }
    return completed
  }

  async function processClaim(rawClaim, context, workerContext) {
    const claimId = required(claimIdOf(rawClaim), 'claim id')
    const jobId = required(jobIdOf(rawClaim), 'job id')
    const expectedLease = {
      claimId,
      jobId,
      leaseToken: required(rawClaim.leaseToken, 'lease token'),
      leaseRevision: required(rawClaim.leaseRevision, 'lease revision'),
    }
    let terminal = false
    let attemptProof
    let leaseProof

    try {
      leaseProof = validateLeaseProof(
        await validateLease({ ...expectedLease, workerContext, checkedAt: now() }),
        expectedLease,
        now(),
      )
      const validation = validationResult(schema, rawClaim)
      if (!validation.valid) {
        await cancel({
          claimId,
          jobId,
          leaseToken: leaseProof.leaseToken,
          leaseRevision: leaseProof.leaseRevision,
          workerContext,
          reason: 'invalid_delivery',
          now: now(),
        })
        terminal = true
        await monitorEvent('study.adult_review.delivery_permanent_failure', workerContext)
        return { deliveryId: jobId, status: 'cancelled', reason: 'invalid_delivery' }
      }

      const delivery = validation.value
      const resolution = await resolve({ delivery, workerContext, trigger: context.trigger })
      const recipient = resolvedRecipient(resolution)
      if (!recipient) {
        await cancel({
          claimId,
          jobId,
          leaseToken: leaseProof.leaseToken,
          leaseRevision: leaseProof.leaseRevision,
          workerContext,
          reason: 'invalid_recipient',
          now: now(),
        })
        terminal = true
        await monitorEvent('study.adult_review.recipient_resolution_failure', workerContext)
        return { deliveryId: jobId, status: 'cancelled', reason: 'invalid_recipient' }
      }

      const binding = validateClaimBinding(delivery, recipient, provider)
      const renewed = await renewLease({
        claimId,
        jobId,
        leaseToken: leaseProof.leaseToken,
        leaseRevision: leaseProof.leaseRevision,
        workerContext,
        leaseMs,
        now: now(),
      })
      leaseProof = validateLeaseProof(renewed, expectedLease, now())

      const noteSubmitted = async (attempt = {}) => {
        const attemptId = attempt?.attemptId ?? attempt?.providerAttemptId
        if (!validRef(attemptId)) throw new Error('attempt_id_required')
        if (attemptProof) {
          if (attemptProof.attemptId !== attemptId) throw new Error('attempt_identity_changed')
          return attemptProof
        }
        const proof = await recordAttemptSubmitted({
          claimId,
          ...binding,
          attemptId,
          leaseToken: leaseProof.leaseToken,
          leaseRevision: leaseProof.leaseRevision,
          workerContext,
          submittedAt: now(),
        })
        attemptProof = validateAttemptProof(proof, {
          ...binding,
          attemptId,
          leaseToken: leaseProof.leaseToken,
        })
        return attemptProof
      }

      let result
      try {
        result = await deliver({
          delivery,
          recipient,
          workerContext,
          trigger: context.trigger,
          onAttemptSubmitted: noteSubmitted,
        })
        if (submitted(result)) await noteSubmitted(result)
      } catch (error) {
        if (indeterminate(error) || attemptProof) {
          await markIndeterminate({
            claimId,
            jobId,
            workerContext,
            attemptId: attemptProof?.attemptId,
            reason: 'provider-outcome-indeterminate',
            now: now(),
          })
          terminal = true
          await monitorEvent('study.adult_review.indeterminate_job', workerContext)
          return { deliveryId: jobId, status: 'indeterminate' }
        }
        throw error
      }

      if (indeterminate(result)) {
        await markIndeterminate({
          claimId,
          jobId,
          workerContext,
          attemptId: attemptProof?.attemptId,
          reason: 'provider-outcome-indeterminate',
          now: now(),
        })
        terminal = true
        await monitorEvent('study.adult_review.indeterminate_job', workerContext)
        return { deliveryId: jobId, status: 'indeterminate' }
      }
      if (!attemptProof) throw new Error('current_attempt_required')

      attemptProof = validateAttemptProof(
        await validateCurrentAttempt({
          claimId,
          jobId,
          attemptId: attemptProof.attemptId,
          leaseToken: leaseProof.leaseToken,
          workerContext,
          checkedAt: now(),
        }),
        { ...binding, leaseToken: leaseProof.leaseToken },
      )
      leaseProof = validateLeaseProof(
        await validateLease({
          claimId,
          jobId,
          leaseToken: leaseProof.leaseToken,
          leaseRevision: leaseProof.leaseRevision,
          workerContext,
          checkedAt: now(),
        }),
        { ...expectedLease, leaseRevision: leaseProof.leaseRevision },
        now(),
      )

      const receipt = validateVerifiedAdultReviewReceipt(
        result?.receipt ?? result,
        { ...binding, attemptId: attemptProof.attemptId },
        { environment },
      )
      const committed = await commitReceipt({
        claimId,
        jobId,
        leaseToken: leaseProof.leaseToken,
        leaseRevision: leaseProof.leaseRevision,
        workerContext,
        attempt: attemptProof,
        receipt,
        committedAt: now(),
      })
      validateReceiptCommit(committed, receipt)
      terminal = true
      return { deliveryId: jobId, status: 'delivered' }
    } catch (error) {
      await monitorEvent('study.adult_review.delivery_permanent_failure', workerContext)
      throw error
    } finally {
      if (!terminal) {
        await releaseLease({
          claimId,
          jobId,
          leaseToken: leaseProof?.leaseToken ?? expectedLease.leaseToken,
          leaseRevision: leaseProof?.leaseRevision ?? expectedLease.leaseRevision,
          workerContext,
          reason: attemptProof ? 'submitted_without_receipt' : 'processing_incomplete',
          now: now(),
        })
      }
    }
  }

  async function run(context, runOptions = {}) {
    await ready()
    const workerContext = await authorize(context)
    const limit = Math.min(
      positiveInteger(runOptions.limit ?? context.limit, defaultBatchSize),
      maxBatchSize,
    )
    const reconciled = await reconcile(context, workerContext, limit)
    const claims = (await claim({
      workerContext,
      limit,
      leaseMs,
      now: now(),
      trigger: context.trigger,
    })) ?? []
    const boundedClaims = claims.slice(0, limit)
    const results = []
    for (const claimed of boundedClaims) {
      try {
        results.push(await processClaim(claimed, context, workerContext))
      } catch {
        results.push({
          deliveryId: jobIdOf(claimed),
          status: 'failed',
        })
      }
    }

    return {
      workerIdentity: workerContext.workerIdentity,
      workerCredentialVersion: workerContext.credentialVersion,
      claimed: boundedClaims.length,
      reconciled,
      delivered: results.filter((result) => result.status === 'delivered').length,
      cancelled: results.filter((result) => result.status === 'cancelled').length,
      indeterminate: results.filter((result) => result.status === 'indeterminate').length,
      failed: results.filter((result) => result.status === 'failed').length,
      results,
    }
  }

  return Object.freeze({ ready, run, processClaim })
}

export const createWorker = createAdultReviewWorker
