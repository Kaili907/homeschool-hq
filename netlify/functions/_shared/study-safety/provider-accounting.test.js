import { describe, expect, it, vi } from 'vitest'
import { createAnthropicSafetyClassifier } from './provider.js'
import { classifyTransientSafety } from './service.js'

const CONTEXT = Object.freeze({
  requestKey: 'trusted-study-provider-operation',
  accountRef: '11111111-1111-4111-8111-111111111111',
  householdRef: '22222222-2222-4222-8222-222222222222',
  householdAttribution: 'resolved',
})
const REQUEST = Object.freeze({
  classificationVersion: 1,
  normalizedTransientText: 'private synthetic learner sentinel',
  deterministicAssessment: Object.freeze({
    outcome: 'clear', categories: [], ruleIds: ['safety-clear-no-signal-v1'],
  }),
})
const VALID_PROVIDER_DATA = Object.freeze({
  usage: Object.freeze({ input_tokens: 13, output_tokens: 5 }),
  content: Object.freeze([Object.freeze({
    type: 'text',
    text: JSON.stringify({
      outcome: 'clear', categories: [], reasonCodes: ['safety-provider-clear-v1'],
    }),
  })]),
})

function response(data = VALID_PROVIDER_DATA, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function accountingHarness(options = {}) {
  const timeline = []
  let attemptSequence = 0
  let ledgerPersisted = false
  const journal = {
    reserve: vi.fn(async (input) => {
      timeline.push(`reserve:${input.physicalRetryIndex}`)
      if (options.reservationError) throw options.reservationError
      return {
        status: 'created',
        attemptId: `90000000-0000-4000-8000-${String(++attemptSequence).padStart(12, '0')}`,
        state: 'reserved',
      }
    }),
    transition: vi.fn(async (input) => {
      timeline.push(`transition:${input.toState}`)
      if (options.dispatchError && input.toState === 'dispatch_possible') throw options.dispatchError
      return { status: 'created', attemptId: input.attemptId, state: input.toState }
    }),
    linkLedger: vi.fn(async (input) => {
      const state = typeof options.linkState === 'function'
        ? options.linkState(input)
        : options.linkState ?? (ledgerPersisted ? 'ledgered' : 'gap_pending')
      timeline.push(`link:${state}`)
      return { status: 'created', attemptId: input.attemptId, state }
    }),
  }
  const gatewayAccess = {
    recordProviderUsage: vi.fn(async () => {
      timeline.push('ledger')
      if (options.ledgerError) throw options.ledgerError
      ledgerPersisted = true
    }),
  }
  const fetchImpl = options.fetchImpl ?? vi.fn(async () => {
    timeline.push('provider')
    return response()
  })
  let clock = Date.parse('2026-08-10T12:00:00.000Z')
  const classifier = createAnthropicSafetyClassifier({
    env: {
      ANTHROPIC_API_KEY: 'provider-test-key',
      ACADEMY_APP_VERSION: 'academy-study-test-build',
      ACADEMY_STUDY_ENGINE_VERSION: 'study-safety-v1',
    },
    fetchImpl,
    gatewayAccess,
    providerAttemptJournal: journal,
    delay: async () => {},
    maxAttempts: options.maxAttempts ?? 2,
    timeoutMs: options.timeoutMs ?? 100,
    now: options.now ?? (() => ++clock),
  })
  return { classifier, fetchImpl, gatewayAccess, journal, timeline }
}

describe('Study safety physical provider attempt accounting', () => {
  it('reserves one Study safety attempt before dispatch and ledgers authoritative usage', async () => {
    const harness = accountingHarness({ maxAttempts: 1 })
    const result = await harness.classifier.classify(REQUEST, CONTEXT)

    expect(result.outcome).toBe('clear')
    expect(harness.timeline).toEqual([
      'reserve:0',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'ledger',
      'link:ledgered',
    ])
    expect(harness.journal.reserve).toHaveBeenCalledWith(expect.objectContaining({
      physicalRetryIndex: 0,
      engine: 'study',
      purpose: 'safety_classification',
      provider: 'anthropic',
      providerProductId: 'claude-haiku-4-5',
      providerModelId: 'claude-haiku-4-5',
      logicalModelTier: 'haiku',
    }), expect.objectContaining({
      accountRef: CONTEXT.accountRef,
      householdRef: CONTEXT.householdRef,
      householdAttribution: 'resolved',
    }))
    expect(harness.gatewayAccess.recordProviderUsage).toHaveBeenCalledWith(expect.objectContaining({
      engine: 'study',
      provider: 'anthropic',
      inputTokens: 13,
      outputTokens: 5,
      result: 'success',
      billingDisposition: 'billable',
    }))
  })

  it('orders reservation, outcome, and ledger transitions explicitly when every clock read is equal', async () => {
    const instant = Date.parse('2026-08-10T12:00:00.000Z')
    const harness = accountingHarness({ maxAttempts: 1, now: () => instant })
    await harness.classifier.classify(REQUEST, CONTEXT)
    expect(harness.timeline).toEqual([
      'reserve:0',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'ledger',
      'link:ledgered',
    ])
    expect(harness.gatewayAccess.recordProviderUsage).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: '2026-08-10T12:00:00.000Z', latencyMs: 0 }),
    )
  })

  it('accounts for a physical retry independently without collapsing attempts', async () => {
    let providerCall = 0
    const harness = accountingHarness({
      fetchImpl: vi.fn(async () => {
        harness.timeline.push('provider')
        providerCall += 1
        if (providerCall === 1) throw new Error('private raw provider failure')
        return response()
      }),
      linkState: ({ attemptId }) => attemptId.endsWith('1') ? 'gap_pending' : 'ledgered',
    })

    const result = await harness.classifier.classify(REQUEST, CONTEXT)
    expect(result.outcome).toBe('clear')
    expect(harness.timeline).toEqual([
      'reserve:0',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'link:gap_pending',
      'reserve:1',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'ledger',
      'link:ledgered',
    ])
    const reservations = harness.journal.reserve.mock.calls.map(([input]) => input)
    expect(reservations.map((item) => item.physicalRetryIndex)).toEqual([0, 1])
    expect(reservations[1].logicalOperationKey).toBe(reservations[0].logicalOperationKey)
    expect(reservations[1].reservationKey).not.toBe(reservations[0].reservationKey)
    expect(reservations[1].ledgerExecutionKey).not.toBe(reservations[0].ledgerExecutionKey)
  })

  it('does not dispatch when reservation fails and remains fail closed', async () => {
    const harness = accountingHarness({ reservationError: new Error('database unavailable') })
    const provider = await harness.classifier.classify(REQUEST, CONTEXT)
    const decision = await classifyTransientSafety(REQUEST.normalizedTransientText, harness.classifier, CONTEXT)

    expect(provider.outcome).toBe('invalid')
    expect(decision.outcome).toBe('invalid')
    expect(harness.fetchImpl).not.toHaveBeenCalled()
    expect(harness.journal.transition).not.toHaveBeenCalled()
  })

  it('does not dispatch when dispatch readiness fails and records not-dispatched best effort', async () => {
    const harness = accountingHarness({ dispatchError: new Error('database unavailable') })
    const result = await harness.classifier.classify(REQUEST, CONTEXT)

    expect(result.outcome).toBe('invalid')
    expect(harness.fetchImpl).not.toHaveBeenCalled()
    expect(harness.journal.transition.mock.calls.map(([input]) => input.toState)).toEqual([
      'dispatch_possible', 'confirmed_not_dispatched',
    ])
  })

  it('records timeout as one indeterminate physical attempt and does not retry', async () => {
    let harness
    const fetchImpl = vi.fn(async (_url, init) => new Promise((_resolve, reject) => {
      harness.timeline.push('provider')
      init.signal.addEventListener(
        'abort',
        () => reject(new DOMException('private timeout', 'AbortError')),
        { once: true },
      )
    }))
    harness = accountingHarness({ fetchImpl, timeoutMs: 1 })
    const result = await harness.classifier.classify(REQUEST, CONTEXT)

    expect(result.reasonCodes).toEqual(['safety-invalid-provider-timeout-v1'])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(harness.gatewayAccess.recordProviderUsage).not.toHaveBeenCalled()
    expect(harness.journal.transition).toHaveBeenCalledWith(expect.objectContaining({
      toState: 'outcome_observed', outcomeResult: 'timeout',
    }))
    expect(harness.timeline.at(-1)).toBe('link:gap_pending')
  })

  it('records provider and validation errors with only actual response usage', async () => {
    const providerError = accountingHarness({
      maxAttempts: 1,
      fetchImpl: vi.fn(async () => response({ error: 'private provider body' }, 500)),
      linkState: 'gap_pending',
    })
    expect((await providerError.classifier.classify(REQUEST, CONTEXT)).outcome).toBe('invalid')
    expect(providerError.gatewayAccess.recordProviderUsage).not.toHaveBeenCalled()
    expect(providerError.journal.transition).toHaveBeenCalledWith(expect.objectContaining({
      outcomeResult: 'provider_error',
    }))
    expect(providerError.timeline.at(-1)).toBe('link:gap_pending')

    const validationError = accountingHarness({
      maxAttempts: 1,
      fetchImpl: vi.fn(async () => response({
        usage: { input_tokens: 8, output_tokens: 2 },
        content: [{ type: 'text', text: 'private malformed classification' }],
      })),
    })
    expect((await validationError.classifier.classify(REQUEST, CONTEXT)).outcome).toBe('invalid')
    expect(validationError.gatewayAccess.recordProviderUsage).toHaveBeenCalledWith(expect.objectContaining({
      inputTokens: 8,
      outputTokens: 2,
      result: 'validation_error',
    }))
  })

  it.each([
    ['ledger failure', { ledgerError: new Error('database unavailable'), linkState: 'gap_pending' }, 'gap_pending'],
    ['link conflict', { linkState: 'reconciliation_conflict' }, 'reconciliation_conflict'],
  ])('preserves a safe provider result across %s', async (_label, options, expectedState) => {
    const harness = accountingHarness(options)
    const result = await harness.classifier.classify(REQUEST, CONTEXT)

    expect(result.outcome).toBe('clear')
    expect(harness.timeline.at(-1)).toBe(`link:${expectedState}`)
  })

  it('never journals learner text, response content, raw errors, or secrets', async () => {
    const rawError = 'RAW-PRIVATE-PROVIDER-ERROR-SENTINEL'
    let call = 0
    const harness = accountingHarness({
      fetchImpl: vi.fn(async () => {
        call += 1
        if (call === 1) throw new Error(rawError)
        return response()
      }),
      linkState: 'gap_pending',
    })
    await harness.classifier.classify(REQUEST, CONTEXT)

    const persisted = JSON.stringify({
      reservations: harness.journal.reserve.mock.calls,
      transitions: harness.journal.transition.mock.calls,
      links: harness.journal.linkLedger.mock.calls,
      ledger: harness.gatewayAccess.recordProviderUsage.mock.calls,
    })
    expect(persisted).not.toContain(REQUEST.normalizedTransientText)
    expect(persisted).not.toContain(VALID_PROVIDER_DATA.content[0].text)
    expect(persisted).not.toContain(rawError)
    expect(persisted).not.toContain('provider-test-key')
    expect(persisted).not.toContain('student')
  })
})
