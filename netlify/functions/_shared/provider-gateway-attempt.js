import { createHash } from 'node:crypto'
import { GatewayError } from './http.js'
import { createServerProviderAttemptJournal } from './provider-attempt-journal.js'
import { trustedUsageVersions } from './usage-accounting.js'

const ATTEMPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EXECUTION_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const CLIENT_OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function serviceUnavailable() {
  return new GatewayError(503, 'service_unavailable')
}

function clientOperationHeaderValue(event) {
  const entries = Object.entries(event?.headers ?? {})
    .filter(([name]) => name.toLowerCase() === 'x-academy-operation-id')
  if (entries.length > 1 || (entries.length === 1 && typeof entries[0][1] !== 'string')) {
    throw new GatewayError(400, 'invalid_request')
  }
  let value = entries.length === 1 ? entries[0][1] : ''

  const multiEntries = Object.entries(event?.multiValueHeaders ?? {})
    .filter(([name]) => name.toLowerCase() === 'x-academy-operation-id')
  if (multiEntries.length > 1) throw new GatewayError(400, 'invalid_request')
  if (multiEntries.length === 1) {
    const values = multiEntries[0][1]
    if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string') {
      throw new GatewayError(400, 'invalid_request')
    }
    if (value && value !== values[0]) throw new GatewayError(400, 'invalid_request')
    value = values[0]
  }
  return value
}

/**
 * Scope a replay-stable browser operation ID to the verified account and
 * engine. Only the digest is used by telemetry, ledger, and journal storage.
 */
export function gatewayProviderExecutionKey({ event, accountRef, engine, fallbackRequestKey }) {
  const value = clientOperationHeaderValue(event)
  if (!value) return fallbackRequestKey
  if (
    !CLIENT_OPERATION_ID_PATTERN.test(value)
    || typeof accountRef !== 'string'
    || !ATTEMPT_ID_PATTERN.test(accountRef)
    || !['tutor', 'jarvis', 'tts'].includes(engine)
  ) {
    throw new GatewayError(400, 'invalid_request')
  }
  return `${engine}_${digest(
    `academy-provider-client-operation\0${accountRef}\0${engine}\0${value.toLowerCase()}`,
  )}`
}

/**
 * Derive content-free correlation keys. A future internal provider retry keeps
 * logicalOperationSeed stable, increments physicalRetryIndex, and supplies a
 * distinct physicalExecutionKey for its telemetry and cost-ledger receipt.
 */
export function gatewayProviderAttemptIdentity({
  engine,
  logicalOperationSeed,
  physicalExecutionKey,
  physicalRetryIndex,
}) {
  if (
    !['tutor', 'study', 'jarvis', 'tts'].includes(engine)
    || typeof logicalOperationSeed !== 'string'
    || !EXECUTION_KEY_PATTERN.test(logicalOperationSeed)
    || typeof physicalExecutionKey !== 'string'
    || !EXECUTION_KEY_PATTERN.test(physicalExecutionKey)
    || !Number.isSafeInteger(physicalRetryIndex)
    || physicalRetryIndex < 0
    || physicalRetryIndex > 100
  ) {
    throw serviceUnavailable()
  }
  const logicalDigest = digest(`academy-provider-operation\0${engine}\0${logicalOperationSeed}`)
  const attemptDigest = digest(
    `academy-provider-attempt\0${engine}\0${logicalOperationSeed}\0${physicalRetryIndex}\0${physicalExecutionKey}`,
  )
  return Object.freeze({
    reservationKey: `${engine}:attempt:${attemptDigest}`,
    logicalOperationKey: `${engine}:operation:${logicalDigest}`,
    physicalRetryIndex,
    operationalExecutionKey: physicalExecutionKey,
    ledgerExecutionKey: physicalExecutionKey,
    transitionKeys: Object.freeze({
      dispatch: `dispatch:${attemptDigest}`,
      notDispatched: `not-dispatched:${attemptDigest}`,
      outcome: `outcome:${attemptDigest}`,
      ledger: `ledger:${attemptDigest}`,
    }),
  })
}

/** Derive a distinct, content-free ledger/telemetry key for one physical retry. */
export function gatewayProviderPhysicalExecutionKey({
  engine,
  logicalOperationSeed,
  physicalRetryIndex,
}) {
  if (
    !['tutor', 'study', 'jarvis', 'tts'].includes(engine)
    || typeof logicalOperationSeed !== 'string'
    || !EXECUTION_KEY_PATTERN.test(logicalOperationSeed)
    || !Number.isSafeInteger(physicalRetryIndex)
    || physicalRetryIndex < 0
    || physicalRetryIndex > 100
  ) {
    throw serviceUnavailable()
  }
  return `${engine}_${digest(
    `academy-provider-physical-execution\0${engine}\0${logicalOperationSeed}\0${physicalRetryIndex}`,
  )}`
}

/** Bind the journal foundation to the same trusted service-role gateway client. */
export function createGatewayProviderAttemptJournal({ env, access } = {}) {
  if (!access || typeof access.createProviderAttemptStore !== 'function') {
    throw serviceUnavailable()
  }
  let store
  try {
    store = access.createProviderAttemptStore()
  } catch {
    throw serviceUnavailable()
  }
  try {
    return createServerProviderAttemptJournal({
      store,
      resolveAuthority: async (context) => ({
        accountRef: context.accountRef,
        householdRef: context.householdRef,
        householdAttribution: context.householdAttribution,
      }),
      resolveVersions: async (engine, context) => (
        context.versions ?? trustedUsageVersions(env, engine)
      ),
    })
  } catch {
    throw serviceUnavailable()
  }
}

async function confirmNotDispatched(journal, attemptId, transitionKey) {
  try {
    await journal.transition({
      attemptId,
      transitionKey,
      toState: 'confirmed_not_dispatched',
      outcomeResult: null,
      reasonCode: 'dispatch_transition_unavailable',
      reconciliationRef: null,
    })
  } catch {
    // Best effort only. The hard guarantee is that the provider is not called.
  }
}

/** Reserve and durably establish dispatch readiness before returning to a caller. */
export async function beginGatewayProviderAttempt({
  journal,
  requestKey,
  engine,
  purpose,
  provider,
  providerProductId,
  providerModelId,
  logicalModelTier,
  authority,
  versions,
  physicalRetryIndex = 0,
  logicalOperationSeed = requestKey,
  physicalExecutionKey = requestKey,
}) {
  if (
    !journal
    || typeof journal.reserve !== 'function'
    || typeof journal.transition !== 'function'
    || typeof journal.linkLedger !== 'function'
  ) {
    throw serviceUnavailable()
  }
  const identity = gatewayProviderAttemptIdentity({
    engine,
    logicalOperationSeed,
    physicalExecutionKey,
    physicalRetryIndex,
  })
  let reservation
  try {
    reservation = await journal.reserve({
      reservationKey: identity.reservationKey,
      logicalOperationKey: identity.logicalOperationKey,
      physicalRetryIndex: identity.physicalRetryIndex,
      operationalExecutionKey: identity.operationalExecutionKey,
      ledgerExecutionKey: identity.ledgerExecutionKey,
      engine,
      purpose,
      provider,
      providerProductId,
      providerModelId,
      logicalModelTier,
    }, {
      accountRef: authority.accountRef,
      householdRef: authority.householdRef,
      householdAttribution: authority.householdAttribution,
      ...(versions === undefined ? {} : { versions }),
    })
  } catch {
    throw serviceUnavailable()
  }

  // A replay may represent an already-dispatched or indeterminate invocation.
  // Never convert it into a second physical call.
  if (
    reservation?.status !== 'created'
    || reservation.state !== 'reserved'
    || !ATTEMPT_ID_PATTERN.test(reservation.attemptId ?? '')
  ) {
    throw serviceUnavailable()
  }

  try {
    const ready = await journal.transition({
      attemptId: reservation.attemptId,
      transitionKey: identity.transitionKeys.dispatch,
      toState: 'dispatch_possible',
      outcomeResult: null,
      reasonCode: null,
      reconciliationRef: null,
    })
    if (
      ready?.attemptId !== reservation.attemptId
      || ready?.state !== 'dispatch_possible'
    ) throw serviceUnavailable()
  } catch {
    await confirmNotDispatched(
      journal,
      reservation.attemptId,
      identity.transitionKeys.notDispatched,
    )
    throw serviceUnavailable()
  }

  return Object.freeze({
    attemptId: reservation.attemptId,
    ledgerExecutionKey: identity.ledgerExecutionKey,
    transitionKeys: identity.transitionKeys,
  })
}

/**
 * Preserve the outcome -> cost authority -> journal link ordering. Failures
 * after a physical dispatch never replace the established learner response.
 */
export async function finishGatewayProviderAttempt({
  journal,
  attempt,
  outcomeResult,
  persistUsage,
}) {
  let outcomeObserved = false
  try {
    const receipt = await journal.transition({
      attemptId: attempt.attemptId,
      transitionKey: attempt.transitionKeys.outcome,
      toState: 'outcome_observed',
      outcomeResult,
      reasonCode: null,
      reconciliationRef: null,
    })
    outcomeObserved = receipt?.state === 'outcome_observed'
  } catch {
    // The authoritative usage receipt is still persisted below when possible.
  }

  let accountingAvailable = false
  try {
    accountingAvailable = await persistUsage() === true
  } catch {
    accountingAvailable = false
  }

  if (!outcomeObserved) {
    try {
      const receipt = await journal.transition({
        attemptId: attempt.attemptId,
        transitionKey: attempt.transitionKeys.outcome,
        toState: 'outcome_observed',
        outcomeResult,
        reasonCode: null,
        reconciliationRef: null,
      })
      outcomeObserved = receipt?.state === 'outcome_observed'
    } catch {
      // A bounded replay recovers a committed-but-lost receipt or a transient
      // failure without changing the normalized outcome evidence.
    }
  }

  let journalState = outcomeObserved ? 'outcome_observed' : 'dispatch_possible'
  for (let linkAttempt = 0; linkAttempt < 2; linkAttempt += 1) {
    try {
      const receipt = await journal.linkLedger({
        attemptId: attempt.attemptId,
        transitionKey: attempt.transitionKeys.ledger,
      })
      if (['ledgered', 'gap_pending', 'reconciliation_conflict'].includes(receipt?.state)) {
        journalState = receipt.state
      }
      break
    } catch {
      // A single identical replay can recover an idempotently committed link.
    }
  }

  return Object.freeze({ accountingAvailable, journalState })
}
