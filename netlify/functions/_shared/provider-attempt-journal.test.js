import { describe, expect, it, vi } from 'vitest'
import {
  ProviderAttemptJournalError,
  createServerProviderAttemptJournal,
  createSupabaseProviderAttemptStore,
} from './provider-attempt-journal.js'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '00000000-0000-4000-8000-000000000002'
const ATTEMPT_ID = '00000000-0000-4000-8000-000000000003'

function input(overrides = {}) {
  return {
    reservationKey: 'reserve.operation-1.retry-0',
    logicalOperationKey: 'operation-1',
    physicalRetryIndex: 0,
    operationalExecutionKey: 'telemetry.operation-1.retry-0',
    ledgerExecutionKey: 'ledger_operation-1_retry-0',
    engine: 'tutor',
    purpose: 'tutor_turn',
    provider: 'anthropic',
    providerProductId: 'claude-sonnet-4-6',
    providerModelId: 'claude-sonnet-4-6',
    logicalModelTier: 'sonnet',
    ...overrides,
  }
}

function setup(overrides = {}) {
  const rows = new Map()
  const store = overrides.store ?? {
    reserve: vi.fn(async (facts) => {
      const key = `${facts.logicalOperationKey}:${facts.physicalRetryIndex}`
      const previous = rows.get(key)
      if (previous) {
        if (JSON.stringify(previous.facts) !== JSON.stringify(facts)) {
          throw new ProviderAttemptJournalError('reconciliation_conflict')
        }
        return { status: 'replayed', attemptId: previous.attemptId, state: 'reserved' }
      }
      const attemptId = facts.physicalRetryIndex === 0
        ? ATTEMPT_ID
        : `00000000-0000-4000-8000-00000000000${facts.physicalRetryIndex + 3}`
      rows.set(key, { facts, attemptId })
      return { status: 'created', attemptId, state: 'reserved' }
    }),
    transition: vi.fn(async () => ({ status: 'created', attemptId: ATTEMPT_ID, state: 'dispatch_possible' })),
    linkLedger: vi.fn(async () => ({ status: 'created', attemptId: ATTEMPT_ID, state: 'ledgered' })),
  }
  const journal = createServerProviderAttemptJournal({
    store,
    resolveAuthority: overrides.resolveAuthority ?? (async () => ({
      accountRef: ACCOUNT_ID,
      householdRef: HOUSEHOLD_ID,
      householdAttribution: 'resolved',
    })),
    resolveVersions: overrides.resolveVersions ?? (async (engine) => ({
      appVersion: 'academy.2026.08.10',
      engineVersion: `${engine}.v1`,
      curriculumVersion: null,
    })),
  })
  return { journal, store }
}

describe('trusted provider attempt journal seam', () => {
  it('resolves authority and versions outside the reservation payload', async () => {
    const { journal, store } = setup()
    await expect(journal.reserve(input(), { verifiedAccount: 'opaque' })).resolves.toMatchObject({
      status: 'created', attemptId: ATTEMPT_ID, state: 'reserved',
    })
    expect(store.reserve).toHaveBeenCalledWith(expect.objectContaining({
      accountRef: ACCOUNT_ID,
      householdRef: HOUSEHOLD_ID,
      householdAttribution: 'resolved',
      appVersion: 'academy.2026.08.10',
      engineVersion: 'tutor.v1',
    }))
  })

  it('keeps one record per physical retry and replays the same retry', async () => {
    const { journal, store } = setup()
    const first = await journal.reserve(input(), {})
    const replay = await journal.reserve(input(), {})
    const retry = await journal.reserve(input({
      reservationKey: 'reserve.operation-1.retry-1',
      physicalRetryIndex: 1,
      operationalExecutionKey: 'telemetry.operation-1.retry-1',
      ledgerExecutionKey: 'ledger_operation-1_retry-1',
    }), {})
    expect(replay).toEqual({ ...first, status: 'replayed' })
    expect(retry.attemptId).not.toBe(first.attemptId)
    expect(store.reserve).toHaveBeenCalledTimes(3)
  })

  it('represents Study safety without changing its engine', async () => {
    const { journal, store } = setup()
    await journal.reserve(input({
      engine: 'study', purpose: 'safety_classification', logicalModelTier: 'haiku',
    }), {})
    expect(store.reserve).toHaveBeenLastCalledWith(expect.objectContaining({
      engine: 'study', purpose: 'safety_classification', logicalModelTier: 'haiku',
    }))
    await expect(journal.reserve(input({
      engine: 'tutor', purpose: 'safety_classification', logicalModelTier: 'haiku',
    }), {})).rejects.toMatchObject({ code: 'provider_attempt_reservation_invalid' })
  })

  it.each([
    ['prompt', 'learner prompt'],
    ['providerResponse', { usage: 1 }],
    ['studentAnswer', 'private'],
    ['rawErrorBody', 'private'],
    ['providerSecret', 'private'],
  ])('rejects prohibited %s fields before persistence', async (field, value) => {
    const { journal, store } = setup()
    await expect(journal.reserve({ ...input(), [field]: value }, {}))
      .rejects.toMatchObject({ code: 'provider_attempt_prohibited_field' })
    expect(store.reserve).not.toHaveBeenCalled()
  })

  it.each([
    ['learnerIdentity', { id: 'private-learner' }],
    ['classifierText', 'private classifier output'],
    ['audio', new Uint8Array([1, 2, 3])],
    ['answer', 'private learner answer'],
    ['providerRawObject', { error: 'private provider body' }],
  ])('rejects injected %s evidence before persistence', async (field, value) => {
    const { journal, store } = setup()
    await expect(journal.reserve({ ...input(), [field]: value }, {})).rejects.toBeInstanceOf(
      ProviderAttemptJournalError,
    )
    expect(store.reserve).not.toHaveBeenCalled()
  })

  it('accepts only normalized transition evidence', async () => {
    const { journal, store } = setup()
    await journal.transition({
      attemptId: ATTEMPT_ID,
      transitionKey: 'transition.operation-1.dispatch',
      toState: 'dispatch_possible',
      outcomeResult: null,
      reasonCode: null,
      reconciliationRef: null,
    })
    expect(store.transition).toHaveBeenCalledTimes(1)
    await expect(journal.transition({
      attemptId: ATTEMPT_ID,
      transitionKey: 'transition.operation-1.outcome',
      toState: 'outcome_observed',
      outcomeResult: 'success',
      reasonCode: 'raw provider error body',
      reconciliationRef: null,
    })).rejects.toMatchObject({ code: 'provider_attempt_transition_invalid' })
  })

  it('fails closed on a malformed durable reservation receipt', async () => {
    const { journal } = setup({
      store: {
        reserve: vi.fn(async () => ({ status: 'created' })),
        transition: vi.fn(),
        linkLedger: vi.fn(),
      },
    })
    await expect(journal.reserve(input(), {})).rejects.toMatchObject({
      code: 'provider_attempt_store_invalid',
    })
  })

  it('rejects transition receipts bound to a different attempt', async () => {
    const { journal } = setup({
      store: {
        reserve: vi.fn(),
        transition: vi.fn(async () => ({
          status: 'created',
          attemptId: '00000000-0000-4000-8000-000000000099',
          state: 'dispatch_possible',
        })),
        linkLedger: vi.fn(),
      },
    })
    await expect(journal.transition({
      attemptId: ATTEMPT_ID,
      transitionKey: 'transition.wrong-attempt',
      toState: 'dispatch_possible',
      outcomeResult: null,
      reasonCode: null,
      reconciliationRef: null,
    })).rejects.toMatchObject({ code: 'provider_attempt_store_invalid' })
  })
})

describe('provider attempt Supabase store', () => {
  it('maps minimized facts to the three trusted RPCs', async () => {
    const rpc = vi.fn(async (name) => ({
      data: { status: 'created', attemptId: ATTEMPT_ID, state: name.includes('link') ? 'ledgered' : 'reserved' },
      error: null,
    }))
    const store = createSupabaseProviderAttemptStore({ rpc })
    const record = {
      ...input(),
      accountRef: ACCOUNT_ID,
      householdRef: HOUSEHOLD_ID,
      householdAttribution: 'resolved',
      appVersion: 'academy.v1',
      engineVersion: 'tutor.v1',
      curriculumVersion: null,
    }
    await store.reserve(record)
    await store.transition({
      attemptId: ATTEMPT_ID, transitionKey: 'transition.dispatch',
      toState: 'dispatch_possible', outcomeResult: null, reasonCode: null,
      reconciliationRef: null,
    })
    await store.linkLedger({ attemptId: ATTEMPT_ID, transitionKey: 'transition.ledger' })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'academy_reserve_provider_attempt_v1',
      'academy_transition_provider_attempt_v1',
      'academy_link_provider_attempt_ledger_v1',
    ])
    expect(rpc.mock.calls[0][1].p_facts).not.toHaveProperty('prompt')
    expect(rpc.mock.calls[0][1].p_facts).not.toHaveProperty('response')
  })

  it('bounds a reservation RPC that never returns', async () => {
    const rpc = vi.fn(() => ({
      abortSignal: (signal) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }),
    }))
    const store = createSupabaseProviderAttemptStore({ rpc }, { timeoutMs: 5 })
    const record = {
      ...input(),
      accountRef: ACCOUNT_ID,
      householdRef: HOUSEHOLD_ID,
      householdAttribution: 'resolved',
      appVersion: 'academy.v1',
      engineVersion: 'tutor.v1',
      curriculumVersion: null,
    }

    await expect(store.reserve(record)).rejects.toMatchObject({
      code: 'provider_attempt_store_unavailable',
    })
  })
})
