const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const LEDGER_KEY = /^[A-Za-z0-9_-]{1,128}$/
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._:@/+\-]{0,127}$/
const REASON = /^[a-z0-9][a-z0-9._:-]{0,119}$/
const PROHIBITED_FIELD = /(?:raw|messages?|conversation|transcript|prompt|response|audio|speech|emotion|personality|psycholog|diagnos|answer|journal|secret|credential|bearer|password|api.?key|body|content)/i

export const PROVIDER_ATTEMPT_STATES = Object.freeze([
  'reserved',
  'dispatch_possible',
  'outcome_observed',
  'ledgered',
  'gap_pending',
  'reconciliation_conflict',
  'reconciled',
  'confirmed_not_dispatched',
  'unresolvable',
])

export const PROVIDER_ATTEMPT_PURPOSES = Object.freeze([
  'tutor_turn',
  'jarvis_turn',
  'tts_synthesis',
  'safety_classification',
])

const RESULTS = new Set([
  'success', 'fallback', 'rejected', 'timeout', 'provider_error',
  'validation_error', 'safety_stop',
])
const STATES = new Set(PROVIDER_ATTEMPT_STATES)
const GENERIC_TRANSITION_STATES = new Set([
  'dispatch_possible', 'outcome_observed', 'gap_pending',
  'reconciliation_conflict', 'reconciled',
  'confirmed_not_dispatched', 'unresolvable',
])
const RESERVATION_FIELDS = new Set([
  'reservationKey', 'logicalOperationKey', 'physicalRetryIndex',
  'operationalExecutionKey', 'ledgerExecutionKey', 'engine', 'purpose',
  'provider', 'providerProductId', 'providerModelId', 'logicalModelTier',
])
const TRANSITION_FIELDS = new Set([
  'attemptId', 'transitionKey', 'toState', 'outcomeResult',
  'reasonCode', 'reconciliationRef',
])
const LINK_FIELDS = new Set(['attemptId', 'transitionKey'])

export class ProviderAttemptJournalError extends Error {
  constructor(code) {
    super(code)
    this.name = 'ProviderAttemptJournalError'
    this.code = code
  }
}

function plainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactFields(value, fields) {
  if (!plainRecord(value)) throw new ProviderAttemptJournalError('provider_attempt_input_invalid')
  const keys = Object.keys(value)
  if (keys.length !== fields.size || keys.some((key) => !fields.has(key))) {
    const prohibited = keys.find((key) => !fields.has(key) && PROHIBITED_FIELD.test(key))
    throw new ProviderAttemptJournalError(
      prohibited ? 'provider_attempt_prohibited_field' : 'provider_attempt_field_not_allowed',
    )
  }
  return value
}

function validIdentifier(value, pattern = REFERENCE) {
  return typeof value === 'string' && pattern.test(value)
}

function validProduct(value) {
  return typeof value === 'string'
    && value.trim().length >= 1
    && value.trim().length <= 120
    && !/[\u0000-\u001f\u007f]/u.test(value)
}

function validShape({ engine, purpose, provider, logicalModelTier }) {
  if (engine === 'tutor' && purpose === 'tutor_turn') {
    return provider === 'anthropic' && ['sonnet', 'haiku'].includes(logicalModelTier)
  }
  if (engine === 'jarvis' && purpose === 'jarvis_turn') {
    return provider === 'anthropic' && ['sonnet', 'haiku'].includes(logicalModelTier)
  }
  if (engine === 'study' && purpose === 'safety_classification') {
    return provider === 'anthropic' && ['sonnet', 'haiku'].includes(logicalModelTier)
  }
  return engine === 'tts'
    && purpose === 'tts_synthesis'
    && provider === 'elevenlabs'
    && logicalModelTier === null
}

function reservation(value) {
  const input = exactFields(value, RESERVATION_FIELDS)
  if (
    !validIdentifier(input.reservationKey)
    || !validIdentifier(input.logicalOperationKey)
    || !Number.isSafeInteger(input.physicalRetryIndex)
    || input.physicalRetryIndex < 0
    || input.physicalRetryIndex > 100
    || !validIdentifier(input.operationalExecutionKey)
    || !validIdentifier(input.ledgerExecutionKey, LEDGER_KEY)
    || !validProduct(input.providerProductId)
    || !validProduct(input.providerModelId)
    || !validShape(input)
  ) {
    throw new ProviderAttemptJournalError('provider_attempt_reservation_invalid')
  }
  return input
}

function authority(value) {
  if (!plainRecord(value)) throw new ProviderAttemptJournalError('provider_attempt_authority_invalid')
  const keys = Object.keys(value)
  if (
    keys.length !== 3
    || !keys.every((key) => ['accountRef', 'householdRef', 'householdAttribution'].includes(key))
    || !validIdentifier(value.accountRef, UUID)
    || !['resolved', 'no_active_household', 'ambiguous', 'lookup_unavailable']
      .includes(value.householdAttribution)
    || ((value.householdAttribution === 'resolved') !== validIdentifier(value.householdRef, UUID))
    || (value.householdAttribution !== 'resolved' && value.householdRef !== null)
  ) {
    throw new ProviderAttemptJournalError('provider_attempt_authority_invalid')
  }
  return value
}

function versions(value) {
  if (!plainRecord(value)) throw new ProviderAttemptJournalError('provider_attempt_version_invalid')
  const keys = Object.keys(value)
  if (
    keys.length !== 3
    || !keys.every((key) => ['appVersion', 'engineVersion', 'curriculumVersion'].includes(key))
    || !validIdentifier(value.appVersion, VERSION)
    || !(value.engineVersion === null || validIdentifier(value.engineVersion, VERSION))
    || !(value.curriculumVersion === null || validIdentifier(value.curriculumVersion, VERSION))
  ) {
    throw new ProviderAttemptJournalError('provider_attempt_version_invalid')
  }
  return value
}

function transition(value) {
  const input = exactFields(value, TRANSITION_FIELDS)
  if (
    !validIdentifier(input.attemptId, UUID)
    || !validIdentifier(input.transitionKey)
    || !GENERIC_TRANSITION_STATES.has(input.toState)
    || !(input.outcomeResult === null || RESULTS.has(input.outcomeResult))
    || !(input.reasonCode === null || validIdentifier(input.reasonCode, REASON))
    || !(input.reconciliationRef === null || validIdentifier(input.reconciliationRef))
  ) {
    throw new ProviderAttemptJournalError('provider_attempt_transition_invalid')
  }
  const needsReason = [
    'gap_pending', 'reconciliation_conflict', 'reconciled',
    'confirmed_not_dispatched', 'unresolvable',
  ].includes(input.toState)
  if (
    ((input.toState === 'outcome_observed') !== (input.outcomeResult !== null))
    || (needsReason !== (input.reasonCode !== null))
    || ((input.toState === 'reconciled') !== (input.reconciliationRef !== null))
  ) {
    throw new ProviderAttemptJournalError('provider_attempt_transition_invalid')
  }
  return input
}

function link(value) {
  const input = exactFields(value, LINK_FIELDS)
  if (!validIdentifier(input.attemptId, UUID) || !validIdentifier(input.transitionKey)) {
    throw new ProviderAttemptJournalError('provider_attempt_ledger_link_invalid')
  }
  return input
}

function assertServerRuntime() {
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    throw new ProviderAttemptJournalError('provider_attempt_server_only')
  }
}

function receipt(value) {
  if (!plainRecord(value)) throw new ProviderAttemptJournalError('provider_attempt_store_invalid')
  const keys = Object.keys(value)
  if (
    keys.length !== 3
    || !keys.every((key) => ['status', 'attemptId', 'state'].includes(key))
    || !['created', 'replayed'].includes(value.status)
    || !validIdentifier(value.attemptId, UUID)
    || !STATES.has(value.state)
  ) {
    throw new ProviderAttemptJournalError('provider_attempt_store_invalid')
  }
  return Object.freeze({
    status: value.status,
    attemptId: value.attemptId,
    state: value.state,
  })
}

/**
 * Trusted pre-dispatch seam. Identity and version snapshots are resolved from
 * server authority, never from the provider request or browser payload.
 */
export function createServerProviderAttemptJournal({
  store,
  resolveAuthority,
  resolveVersions,
} = {}) {
  assertServerRuntime()
  if (
    !store
    || typeof store.reserve !== 'function'
    || typeof store.transition !== 'function'
    || typeof store.linkLedger !== 'function'
    || typeof resolveAuthority !== 'function'
    || typeof resolveVersions !== 'function'
  ) {
    throw new TypeError('provider_attempt_journal_configuration_invalid')
  }

  return Object.freeze({
    async reserve(input, trustedContext) {
      const facts = reservation(input)
      const [trustedAuthority, trustedVersions] = await Promise.all([
        resolveAuthority(trustedContext),
        resolveVersions(facts.engine, trustedContext),
      ])
      return receipt(await store.reserve({
        ...facts,
        ...authority(trustedAuthority),
        ...versions(trustedVersions),
      }))
    },

    async transition(input) {
      return receipt(await store.transition(transition(input)))
    },

    async linkLedger(input) {
      return receipt(await store.linkLedger(link(input)))
    },
  })
}

function mappedStoreError(error) {
  if (error?.code === '42501') return new ProviderAttemptJournalError('provider_attempt_unauthorized')
  if (error?.code === '23505' || error?.message?.includes?.('reconciliation_conflict')) {
    return new ProviderAttemptJournalError('reconciliation_conflict')
  }
  if (['22023', '22P02', '23503', '23514'].includes(error?.code)) {
    return new ProviderAttemptJournalError('provider_attempt_invalid')
  }
  return new ProviderAttemptJournalError('provider_attempt_store_unavailable')
}

async function rpc(client, name, parameters) {
  const { data, error } = await client.rpc(name, parameters)
  if (error) throw mappedStoreError(error)
  return receipt(data)
}

/** Service-role Supabase adapter; it exposes no browser credential or direct table access. */
export function createSupabaseProviderAttemptStore(client) {
  if (!client || typeof client.rpc !== 'function') {
    throw new TypeError('provider_attempt_store_configuration_invalid')
  }
  return Object.freeze({
    reserve(record) {
      return rpc(client, 'academy_reserve_provider_attempt_v1', {
        p_reservation_key: record.reservationKey,
        p_facts: {
          schema_version: 1,
          logical_operation_key: record.logicalOperationKey,
          physical_retry_index: record.physicalRetryIndex,
          operational_execution_key: record.operationalExecutionKey,
          ledger_execution_key: record.ledgerExecutionKey,
          account_id: record.accountRef,
          household_id: record.householdRef,
          household_attribution: record.householdAttribution,
          engine: record.engine,
          purpose: record.purpose,
          app_version: record.appVersion,
          engine_version: record.engineVersion,
          curriculum_version: record.curriculumVersion,
          provider: record.provider,
          provider_product_id: record.providerProductId,
          provider_model_id: record.providerModelId,
          logical_model_tier: record.logicalModelTier,
        },
      })
    },
    transition(record) {
      return rpc(client, 'academy_transition_provider_attempt_v1', {
        p_attempt_id: record.attemptId,
        p_transition_key: record.transitionKey,
        p_to_state: record.toState,
        p_outcome_result: record.outcomeResult,
        p_reason_code: record.reasonCode,
        p_reconciliation_ref: record.reconciliationRef,
      })
    },
    linkLedger(record) {
      return rpc(client, 'academy_link_provider_attempt_ledger_v1', {
        p_attempt_id: record.attemptId,
        p_transition_key: record.transitionKey,
      })
    },
  })
}
