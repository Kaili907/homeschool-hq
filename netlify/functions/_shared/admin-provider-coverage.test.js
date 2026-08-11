import { describe, expect, it } from 'vitest'
import {
  buildAdminProviderAccountingCoverage,
  unavailableProviderAccountingCoverage,
} from './admin-provider-coverage.js'

const RANGE = {
  startAt: '2026-08-08T00:00:00.000Z',
  endExclusive: '2026-08-09T00:00:00.000Z',
}

function states(overrides = {}) {
  return {
    reserved: 0,
    dispatchPossible: 0,
    outcomeObserved: 0,
    ledgered: 0,
    gapPending: 0,
    reconciliationConflict: 0,
    reconciled: 0,
    confirmedNotDispatched: 0,
    unresolvable: 0,
    ...overrides,
  }
}

function rawCoverage(overrides = {}) {
  const coverage = {
    schemaVersion: 1,
    coverageStatus: 'covered',
    range: RANGE,
    recordedProviderAttempts: 2,
    ledgerLinkedAttempts: 1,
    journaledMissingLedgerRelationship: 0,
    ledgerRowsWithoutJournalRelationship: 0,
    states: states({ ledgered: 1, confirmedNotDispatched: 1 }),
    breakdowns: { engines: [], purposes: [], providers: [] },
    costAuthority: 'academy_provider_usage_ledger',
    invoiceCompletenessClaim: false,
    ...overrides,
  }
  if (!Object.hasOwn(overrides, 'breakdowns')) {
    const row = {
      recordedProviderAttempts: coverage.recordedProviderAttempts,
      ledgerLinkedAttempts: coverage.ledgerLinkedAttempts,
      journaledMissingLedgerRelationship: coverage.journaledMissingLedgerRelationship,
      states: coverage.states,
    }
    coverage.breakdowns = coverage.recordedProviderAttempts === 0
      ? { engines: [], purposes: [], providers: [] }
      : {
          engines: [{ key: 'tutor', ...row }],
          purposes: [{ key: 'tutor_turn', ...row }],
          providers: [{ key: 'anthropic', ...row }],
        }
  }
  return coverage
}

function breakdownRow(key, overrides = {}) {
  return {
    key,
    recordedProviderAttempts: 2,
    ledgerLinkedAttempts: 1,
    journaledMissingLedgerRelationship: 0,
    states: states({ ledgered: 1, confirmedNotDispatched: 1 }),
    ...overrides,
  }
}

describe('Admin provider accounting coverage projection', () => {
  it('reports terminal journal coverage without making a provider invoice claim', () => {
    const coverage = buildAdminProviderAccountingCoverage(rawCoverage(), RANGE)
    expect(coverage).toMatchObject({
      status: 'complete_for_journaled_attempts',
      journalStatus: 'complete_for_journaled_attempts',
      reconciliationState: 'clear_for_journaled_attempts',
      providerInstrumentation: {
        status: 'complete',
        engines: [
          { key: 'tutor', status: 'covered' },
          { key: 'jarvis', status: 'covered' },
          { key: 'tts', status: 'covered' },
          { key: 'study', status: 'covered' },
        ],
      },
      invoiceCompletenessClaim: false,
      metrics: {
        reservedAttempts: 2,
        ledgerLinkedAttempts: 1,
        confirmedNotDispatched: 1,
        accountingGaps: 0,
        gapPending: 0,
      },
    })
  })

  it.each([
    [
      'partial lifecycle',
      rawCoverage({
        coverageStatus: 'in_progress', recordedProviderAttempts: 1,
        ledgerLinkedAttempts: 0, states: states({ dispatchPossible: 1 }),
      }),
      'partial',
    ],
    [
      'missing ledger',
      rawCoverage({
        coverageStatus: 'attention_required', recordedProviderAttempts: 1,
        ledgerLinkedAttempts: 0, journaledMissingLedgerRelationship: 1,
        states: states({ gapPending: 1 }),
      }),
      'gaps_detected',
    ],
    [
      'reconciliation conflict',
      rawCoverage({
        coverageStatus: 'attention_required', recordedProviderAttempts: 1,
        ledgerLinkedAttempts: 0, journaledMissingLedgerRelationship: 1,
        states: states({ reconciliationConflict: 1 }),
      }),
      'reconciliation_conflict',
    ],
    [
      'unresolvable attempt',
      rawCoverage({
        coverageStatus: 'attention_required', recordedProviderAttempts: 1,
        ledgerLinkedAttempts: 0, journaledMissingLedgerRelationship: 1,
        states: states({ unresolvable: 1 }),
      }),
      'gaps_detected',
    ],
    [
      'no attempts',
      rawCoverage({
        coverageStatus: 'no_data', recordedProviderAttempts: 0,
        ledgerLinkedAttempts: 0, states: states(),
      }),
      'insufficient_evidence',
    ],
  ])('classifies %s truthfully', (_label, raw, status) => {
    expect(buildAdminProviderAccountingCoverage(raw, RANGE).status).toBe(status)
  })

  it('surfaces safe engine, purpose, and provider breakdowns', () => {
    const coverage = buildAdminProviderAccountingCoverage(rawCoverage({
      breakdowns: {
        engines: [breakdownRow('tutor')],
        purposes: [breakdownRow('tutor_turn')],
        providers: [breakdownRow('anthropic')],
      },
    }), RANGE)
    expect(coverage.breakdowns).toEqual({
      engines: [expect.objectContaining({ key: 'tutor', reservedAttempts: 2 })],
      purposes: [expect.objectContaining({ key: 'tutor_turn', ledgerLinkedAttempts: 1 })],
      providers: [expect.objectContaining({ key: 'anthropic', status: 'complete_for_journaled_attempts' })],
    })
  })

  it('reduces one million provider attempts to fixed-size aggregate evidence', () => {
    const attempts = 1_000_000
    const aggregateStates = states({ ledgered: attempts })
    const row = {
      recordedProviderAttempts: attempts,
      ledgerLinkedAttempts: attempts,
      journaledMissingLedgerRelationship: 0,
      states: aggregateStates,
    }
    const started = performance.now()
    const coverage = buildAdminProviderAccountingCoverage(rawCoverage({
      recordedProviderAttempts: attempts,
      ledgerLinkedAttempts: attempts,
      states: aggregateStates,
      breakdowns: {
        engines: [{ key: 'tutor', ...row }],
        purposes: [{ key: 'tutor_turn', ...row }],
        providers: [{ key: 'anthropic', ...row }],
      },
    }), RANGE)
    console.info(`[admin-performance] 1000000 provider-attempt aggregate ${(performance.now() - started).toFixed(1)}ms`)
    expect(coverage).toMatchObject({
      status: 'complete_for_journaled_attempts',
      metrics: { reservedAttempts: attempts, ledgerLinkedAttempts: attempts },
    })
    expect(coverage.breakdowns.engines).toHaveLength(1)
    expect(JSON.stringify(coverage).length).toBeLessThan(5_000)
  })

  it('isolates unavailable or malformed coverage and strips private or raw fields', () => {
    expect(unavailableProviderAccountingCoverage()).toMatchObject({
      status: 'unavailable', metrics: null, invoiceCompletenessClaim: false,
    })
    const coverage = buildAdminProviderAccountingCoverage({
      ...rawCoverage(),
      prompt: 'PRIVATE LEARNER PROMPT',
      rawProviderError: 'SECRET',
    }, RANGE)
    expect(coverage.status).toBe('unavailable')
    const wire = JSON.stringify(coverage)
    expect(wire).not.toContain('PRIVATE')
    expect(wire).not.toContain('SECRET')
    expect(wire).not.toContain('prompt')
    expect(wire).not.toContain('rawProviderError')
  })

  it('fails coverage closed when the range, authority, status, or false invoice ruling changes', () => {
    expect(buildAdminProviderAccountingCoverage(rawCoverage({
      invoiceCompletenessClaim: true,
    }), RANGE).status).toBe('unavailable')
    expect(buildAdminProviderAccountingCoverage(rawCoverage({
      costAuthority: 'provider_invoice',
    }), RANGE).status).toBe('unavailable')
    expect(buildAdminProviderAccountingCoverage(rawCoverage({
      range: { ...RANGE, endExclusive: '2026-08-10T00:00:00.000Z' },
    }), RANGE).status).toBe('unavailable')
  })
})
