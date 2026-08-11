const COVERAGE_STATUSES = new Set([
  'attention_required',
  'in_progress',
  'no_data',
  'covered',
])

const STATE_KEYS = [
  'reserved',
  'dispatchPossible',
  'outcomeObserved',
  'ledgered',
  'gapPending',
  'reconciliationConflict',
  'reconciled',
  'confirmedNotDispatched',
  'unresolvable',
]

const DIMENSIONS = Object.freeze({
  engines: new Set(['tutor', 'study', 'jarvis', 'tts']),
  purposes: new Set([
    'tutor_turn',
    'jarvis_turn',
    'tts_synthesis',
    'safety_classification',
  ]),
  providers: new Set(['anthropic', 'elevenlabs']),
})

const PROVIDER_INSTRUMENTATION = Object.freeze({
  status: 'complete',
  engines: Object.freeze([
    Object.freeze({ key: 'tutor', status: 'covered' }),
    Object.freeze({ key: 'jarvis', status: 'covered' }),
    Object.freeze({ key: 'tts', status: 'covered' }),
    Object.freeze({ key: 'study', status: 'covered' }),
  ]),
})

const RAW_COVERAGE_KEYS = [
  'schemaVersion',
  'coverageStatus',
  'range',
  'recordedProviderAttempts',
  'ledgerLinkedAttempts',
  'journaledMissingLedgerRelationship',
  'ledgerRowsWithoutJournalRelationship',
  'states',
  'breakdowns',
  'costAuthority',
  'invoiceCompletenessClaim',
]

const RAW_BREAKDOWN_KEYS = [
  'key',
  'recordedProviderAttempts',
  'ledgerLinkedAttempts',
  'journaledMissingLedgerRelationship',
  'states',
]

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null
}

function exactKeys(value, keys) {
  const source = record(value)
  return source
    && Object.keys(source).length === keys.length
    && keys.every((key) => Object.hasOwn(source, key))
    ? source
    : null
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function safeAdd(...values) {
  const total = values.reduce((sum, value) => sum + value, 0)
  return Number.isSafeInteger(total) ? total : null
}

function readStates(value) {
  const source = exactKeys(value, STATE_KEYS)
  if (!source) return null
  const states = Object.create(null)
  for (const key of STATE_KEYS) {
    const valueCount = count(source[key])
    if (valueCount === null) return null
    states[key] = valueCount
  }
  return states
}

function statusFor(metrics, states) {
  if (states.reconciliationConflict > 0) return 'reconciliation_conflict'
  if (metrics.accountingGaps > 0 || states.gapPending > 0 || states.unresolvable > 0) {
    return 'gaps_detected'
  }
  if (metrics.reservedAttempts === 0) return 'insufficient_evidence'
  if (states.reserved + states.dispatchPossible + states.outcomeObserved > 0) return 'partial'
  return 'complete_for_journaled_attempts'
}

function reconciliationStateFor(status) {
  if (status === 'reconciliation_conflict') return 'conflict'
  if (status === 'gaps_detected') return 'gaps_detected'
  if (status === 'partial') return 'in_progress'
  if (status === 'insufficient_evidence') return 'insufficient_evidence'
  return 'clear_for_journaled_attempts'
}

function presentMetrics({ recorded, linked, missing, orphan = 0, states }) {
  const accountingGaps = safeAdd(missing, orphan)
  if (accountingGaps === null) return null
  return {
    reservedAttempts: recorded,
    reservationOnlyAttempts: states.reserved,
    dispatchPossibleAttempts: states.dispatchPossible,
    observedOutcomes: states.outcomeObserved,
    ledgerLinkedAttempts: linked,
    accountingGaps,
    gapPending: states.gapPending,
    reconciliationConflicts: states.reconciliationConflict,
    reconciledAttempts: states.reconciled,
    confirmedNotDispatched: states.confirmedNotDispatched,
    unresolvable: states.unresolvable,
  }
}

function relationshipsMatchStates({ linked, missing, states }) {
  const statesMissingRelationship = safeAdd(
    states.outcomeObserved,
    states.gapPending,
    states.reconciliationConflict,
    states.unresolvable,
  )
  return linked === states.ledgered && missing === statesMissingRelationship
}

function overallStatusFor(journalStatus) {
  if (journalStatus !== 'complete_for_journaled_attempts') return journalStatus
  return PROVIDER_INSTRUMENTATION.status === 'complete'
    ? journalStatus
    : 'partial'
}

function expectedRawStatus(metrics, states) {
  const attention = safeAdd(
    states.gapPending,
    states.reconciliationConflict,
    states.unresolvable,
    metrics.accountingGaps,
  )
  if (attention === null) return null
  if (attention > 0) return 'attention_required'
  if (states.reserved + states.dispatchPossible + states.outcomeObserved > 0) return 'in_progress'
  if (metrics.reservedAttempts === 0) return 'no_data'
  return 'covered'
}

function readBreakdownRows(value, dimension) {
  if (!Array.isArray(value) || value.length > DIMENSIONS[dimension].size) return null
  const seen = new Set()
  const rows = []
  for (const item of value) {
    const source = exactKeys(item, RAW_BREAKDOWN_KEYS)
    const states = readStates(source?.states)
    const recorded = count(source?.recordedProviderAttempts)
    const linked = count(source?.ledgerLinkedAttempts)
    const missing = count(source?.journaledMissingLedgerRelationship)
    if (
      !source || !states || !DIMENSIONS[dimension].has(source.key) || seen.has(source.key)
      || recorded === null || linked === null || missing === null
      || linked > recorded || missing > recorded
      || safeAdd(...STATE_KEYS.map((key) => states[key])) !== recorded
      || !relationshipsMatchStates({ linked, missing, states })
    ) return null
    const metrics = presentMetrics({ recorded, linked, missing, states })
    if (!metrics) return null
    const status = statusFor(metrics, states)
    rows.push({ key: source.key, status, ...metrics })
    seen.add(source.key)
  }
  return rows
}

function breakdownMatchesSummary(rows, { recorded, linked, missing }) {
  const recordedTotal = safeAdd(...rows.map((row) => row.reservedAttempts))
  const linkedTotal = safeAdd(...rows.map((row) => row.ledgerLinkedAttempts))
  const missingTotal = safeAdd(...rows.map((row) => row.accountingGaps))
  return recordedTotal === recorded && linkedTotal === linked && missingTotal === missing
}

export function unavailableProviderAccountingCoverage() {
  return Object.freeze({
    status: 'unavailable',
    journalStatus: 'unavailable',
    reconciliationState: 'unavailable',
    providerInstrumentation: PROVIDER_INSTRUMENTATION,
    invoiceCompletenessClaim: false,
    metrics: null,
    breakdowns: { engines: [], purposes: [], providers: [] },
  })
}

/**
 * Reduces the service-only journal projection to a fixed, privacy-safe wire
 * contract. Unknown fields or inconsistent totals make only coverage
 * unavailable; provider payloads and database errors never reach the browser.
 */
export function buildAdminProviderAccountingCoverage(value, range) {
  const source = exactKeys(value, RAW_COVERAGE_KEYS)
  const rawRange = exactKeys(source?.range, ['startAt', 'endExclusive'])
  const states = readStates(source?.states)
  const breakdowns = exactKeys(source?.breakdowns, ['engines', 'purposes', 'providers'])
  const recorded = count(source?.recordedProviderAttempts)
  const linked = count(source?.ledgerLinkedAttempts)
  const missing = count(source?.journaledMissingLedgerRelationship)
  const orphan = count(source?.ledgerRowsWithoutJournalRelationship)
  if (
    !source || source.schemaVersion !== 1 || !COVERAGE_STATUSES.has(source.coverageStatus)
    || !rawRange || rawRange.startAt !== range.startAt || rawRange.endExclusive !== range.endExclusive
    || recorded === null || linked === null || missing === null || orphan === null
    || linked > recorded || missing > recorded
    || !states || safeAdd(...STATE_KEYS.map((key) => states[key])) !== recorded
    || !relationshipsMatchStates({ linked, missing, states })
    || source.costAuthority !== 'academy_provider_usage_ledger'
    || source.invoiceCompletenessClaim !== false
    || !breakdowns
  ) return unavailableProviderAccountingCoverage()

  const metrics = presentMetrics({ recorded, linked, missing, orphan, states })
  const engines = readBreakdownRows(breakdowns.engines, 'engines')
  const purposes = readBreakdownRows(breakdowns.purposes, 'purposes')
  const providers = readBreakdownRows(breakdowns.providers, 'providers')
  if (
    !metrics || !engines || !purposes || !providers
    || !breakdownMatchesSummary(engines, { recorded, linked, missing })
    || !breakdownMatchesSummary(purposes, { recorded, linked, missing })
    || !breakdownMatchesSummary(providers, { recorded, linked, missing })
    || expectedRawStatus(metrics, states) !== source.coverageStatus
  ) return unavailableProviderAccountingCoverage()

  const journalStatus = statusFor(metrics, states)
  return Object.freeze({
    status: overallStatusFor(journalStatus),
    journalStatus,
    reconciliationState: reconciliationStateFor(journalStatus),
    providerInstrumentation: PROVIDER_INSTRUMENTATION,
    invoiceCompletenessClaim: false,
    metrics,
    breakdowns: { engines, purposes, providers },
  })
}

/** Shared fail-closed read seam for Costs and Overview. */
export async function readAdminProviderAccountingCoverage(readCoverage, range) {
  if (typeof readCoverage !== 'function') return unavailableProviderAccountingCoverage()
  try {
    const rawCoverage = await readCoverage({
      startAt: range.startAt,
      endExclusive: range.endExclusive,
    })
    return buildAdminProviderAccountingCoverage(rawCoverage, range)
  } catch {
    return unavailableProviderAccountingCoverage()
  }
}
