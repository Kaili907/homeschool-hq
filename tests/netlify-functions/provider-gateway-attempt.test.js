import { describe, expect, it, vi } from 'vitest'
import {
  beginGatewayProviderAttempt,
  finishGatewayProviderAttempt,
  gatewayProviderAttemptIdentity,
  gatewayProviderPhysicalExecutionKey,
} from '../../netlify/functions/_shared/provider-gateway-attempt.js'
import { createAnthropicHandler as createBaseAnthropicHandler } from '../../netlify/functions/anthropic.js'
import { createTtsVoiceCatalog } from '../../netlify/functions/_shared/tts-catalog.js'
import { createTtsHandler as createBaseTtsHandler } from '../../netlify/functions/tts.js'
import { TEST_PROVIDER_ATTEMPT_ID } from './provider-attempt-test-helpers.js'

const ACCOUNT_ID = '10000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '20000000-0000-4000-8000-000000000001'
const ANTHROPIC_ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  ANTHROPIC_API_KEY: 'anthropic-provider-secret',
  ACADEMY_AI_ENABLED: 'true',
  ACADEMY_APP_VERSION: 'academy-test-build',
})
const TTS_ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  ELEVENLABS_API_KEY: 'elevenlabs-provider-secret',
  ELEVENLABS_ALLOWED_VOICE_IDS: 'private-voice-1',
  ACADEMY_TTS_ENABLED: 'true',
  ACADEMY_APP_VERSION: 'academy-test-build',
})
const TTS_CATALOG = createTtsVoiceCatalog({
  catalogVersion: 'provider-accounting-test-v1',
  defaultVoiceRef: 'academy.tts.provider-accounting-test',
  voices: [{
    voiceRef: 'academy.tts.provider-accounting-test',
    displayLabel: 'Provider accounting test',
    providerClass: 'premium',
    provider: 'elevenlabs',
    providerVoiceId: 'private-voice-1',
    voiceVersion: 'v1',
    status: 'active',
    cachedPlayback: 'allow',
    adminApproved: true,
  }],
})

function effectiveConfigurationReader(env = {}) {
  return {
    read: async () => ({
      status: 'available',
      runtime: {
        aiEnabled: env.ACADEMY_AI_ENABLED !== 'false',
        ttsEnabled: env.ACADEMY_TTS_ENABLED !== 'false',
      },
      quotas: { aiRequestsPerAccountDay: 50, ttsRequestsPerAccountDay: 100 },
      ai: { approvedTiers: ['sonnet', 'haiku'], defaultTier: 'sonnet' },
    }),
  }
}

function createAnthropicHandler(overrides = {}) {
  return createBaseAnthropicHandler({
    effectiveConfigurationReader: effectiveConfigurationReader(overrides.env),
    ...overrides,
  })
}

function createTtsHandler(overrides = {}) {
  return createBaseTtsHandler({
    catalog: TTS_CATALOG,
    effectiveConfigurationReader: effectiveConfigurationReader(overrides.env),
    ...overrides,
  })
}

function anthropicEvent(mode = 'tutor') {
  const context = mode === 'tutor'
    ? {
        grade: '3', problem: '365 - 128 = ?', correctAnswer: '237',
        studentAnswer: '243', graded: false,
      }
    : {
        assistant: { name: 'Jarvis', tonePreference: 'brief' },
        student: {
          grade: '10', today: '2026-08-10', mission: [], deadlines: [],
          courses: [], geometry: [], algebra: [], assessments: [],
        },
        actions: [],
        graded: false,
      }
  return {
    httpMethod: 'POST',
    path: '/api/anthropic/v1/messages',
    headers: {
      authorization: 'Bearer header.payload.signature',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      mode,
      modelTier: mode === 'tutor' ? 'sonnet' : 'haiku',
      context,
      messages: [{ role: 'user', content: 'Private learner prompt.' }],
    }),
  }
}

function ttsEvent() {
  return {
    httpMethod: 'POST',
    path: '/api/tts/synthesize',
    headers: {
      authorization: 'Bearer header.payload.signature',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      text: 'Private speech input.',
      voiceRef: 'academy.tts.provider-accounting-test',
      voiceVersion: 'v1',
    }),
  }
}

function accessHarness(timeline = [], overrides = {}) {
  return {
    requireEntitlement: vi.fn(async () => ({
      householdRef: HOUSEHOLD_ID,
      householdAttribution: 'resolved',
    })),
    consumeUsage: vi.fn(async () => undefined),
    recordProviderUsage: vi.fn(async () => {
      timeline.push('ledger')
    }),
    ...overrides,
  }
}

function journalHarness(timeline = [], overrides = {}) {
  return {
    reserve: vi.fn(async () => {
      timeline.push('reserve')
      return { status: 'created', attemptId: TEST_PROVIDER_ATTEMPT_ID, state: 'reserved' }
    }),
    transition: vi.fn(async (input) => {
      timeline.push(`transition:${input.toState}`)
      return { status: 'created', attemptId: input.attemptId, state: input.toState }
    }),
    linkLedger: vi.fn(async (input) => {
      timeline.push('link')
      return { status: 'created', attemptId: input.attemptId, state: 'ledgered' }
    }),
    ...overrides,
  }
}

function anthropicFetch(timeline = [], { status = 200, providerBody, providerError } = {}) {
  return vi.fn(async (url) => {
    if (url === 'https://academy.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify({ id: ACCOUNT_ID }), { status: 200 })
    }
    timeline.push('provider')
    if (providerError) throw providerError
    return new Response(JSON.stringify(providerBody ?? {
      usage: { input_tokens: 12, output_tokens: 3 },
      content: [{ type: 'text', text: 'Take one small step.' }],
    }), { status })
  })
}

function ttsFetch(timeline = []) {
  return vi.fn(async (url) => {
    if (url === 'https://academy.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify({ id: ACCOUNT_ID }), { status: 200 })
    }
    timeline.push('provider')
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    })
  })
}

function providerCalls(fetchImpl, providerUrl) {
  return fetchImpl.mock.calls.filter(([url]) => url === providerUrl)
}

describe('real provider gateway attempt coordination', () => {
  it('uses the production gateway access store with trusted authority and versions', async () => {
    const timeline = []
    const store = {
      reserve: vi.fn(async (record) => {
        timeline.push('reserve')
        return { status: 'created', attemptId: TEST_PROVIDER_ATTEMPT_ID, state: 'reserved' }
      }),
      transition: vi.fn(async (input) => {
        timeline.push(`transition:${input.toState}`)
        return { status: 'created', attemptId: input.attemptId, state: input.toState }
      }),
      linkLedger: vi.fn(async (input) => {
        timeline.push('link')
        return { status: 'created', attemptId: input.attemptId, state: 'ledgered' }
      }),
    }
    const access = accessHarness(timeline, {
      createProviderAttemptStore: vi.fn(() => store),
    })
    const response = await createAnthropicHandler({
      env: { ...ANTHROPIC_ENV, ACADEMY_TUTOR_ENGINE_VERSION: 'tutor-v2' },
      fetchImpl: anthropicFetch(timeline),
      gatewayAccess: access,
      requestIdFactory: () => 'production-journal-composition',
    })(anthropicEvent())

    expect(response.statusCode).toBe(200)
    expect(access.createProviderAttemptStore).toHaveBeenCalledTimes(1)
    expect(store.reserve).toHaveBeenCalledWith(expect.objectContaining({
      accountRef: ACCOUNT_ID,
      householdRef: HOUSEHOLD_ID,
      householdAttribution: 'resolved',
      appVersion: 'academy-test-build',
      engineVersion: 'tutor-v2',
      curriculumVersion: null,
      engine: 'tutor',
      purpose: 'tutor_turn',
    }))
    expect(timeline).toEqual([
      'reserve',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'ledger',
      'link',
    ])
  })

  it('proves reserve -> dispatch_possible -> provider -> outcome -> ledger -> link ordering', async () => {
    const timeline = []
    const journal = journalHarness(timeline)
    const access = accessHarness(timeline)
    const response = await createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl: anthropicFetch(timeline),
      gatewayAccess: access,
      providerAttemptJournal: journal,
      requestIdFactory: () => 'ordered-tutor-attempt',
    })(anthropicEvent())

    expect(response.statusCode).toBe(200)
    expect(timeline).toEqual([
      'reserve',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'ledger',
      'link',
    ])
    expect(journal.reserve).toHaveBeenCalledWith(expect.objectContaining({
      physicalRetryIndex: 0,
      operationalExecutionKey: 'ordered-tutor-attempt',
      ledgerExecutionKey: 'ordered-tutor-attempt',
      engine: 'tutor',
      purpose: 'tutor_turn',
      provider: 'anthropic',
      providerProductId: 'claude-sonnet-4-6',
      providerModelId: 'claude-sonnet-4-6',
      logicalModelTier: 'sonnet',
    }), {
      accountRef: ACCOUNT_ID,
      householdRef: HOUSEHOLD_ID,
      householdAttribution: 'resolved',
      versions: {
        appVersion: 'academy-test-build',
        engineVersion: null,
        curriculumVersion: null,
      },
    })
  })

  it('does not dispatch when reservation persistence fails', async () => {
    const fetchImpl = anthropicFetch()
    const journal = journalHarness([], {
      reserve: vi.fn(async () => { throw new Error('database unavailable') }),
    })
    const response = await createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl,
      gatewayAccess: accessHarness(),
      providerAttemptJournal: journal,
      requestIdFactory: () => 'reservation-failure',
    })(anthropicEvent())

    expect(response.statusCode).toBe(503)
    expect(providerCalls(fetchImpl, 'https://api.anthropic.com/v1/messages')).toHaveLength(0)
    expect(journal.transition).not.toHaveBeenCalled()
  })

  it('does not dispatch and best-effort closes the attempt when readiness persistence fails', async () => {
    const fetchImpl = anthropicFetch()
    const journal = journalHarness([], {
      transition: vi.fn(async (input) => {
        if (input.toState === 'dispatch_possible') throw new Error('database unavailable')
        return { status: 'created', attemptId: input.attemptId, state: input.toState }
      }),
    })
    const response = await createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl,
      gatewayAccess: accessHarness(),
      providerAttemptJournal: journal,
      requestIdFactory: () => 'readiness-failure',
    })(anthropicEvent())

    expect(response.statusCode).toBe(503)
    expect(providerCalls(fetchImpl, 'https://api.anthropic.com/v1/messages')).toHaveLength(0)
    expect(journal.transition.mock.calls.map(([input]) => input.toState)).toEqual([
      'dispatch_possible', 'confirmed_not_dispatched',
    ])
  })

  it('does not dispatch when readiness returns a receipt for a different attempt', async () => {
    const fetchImpl = anthropicFetch()
    const journal = journalHarness([], {
      transition: vi.fn(async (input) => ({
        status: 'created',
        attemptId: '90000000-0000-4000-8000-000000000002',
        state: input.toState,
      })),
    })
    const response = await createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl,
      gatewayAccess: accessHarness(),
      providerAttemptJournal: journal,
      requestIdFactory: () => 'mismatched-readiness-receipt',
    })(anthropicEvent())

    expect(response.statusCode).toBe(503)
    expect(providerCalls(fetchImpl, 'https://api.anthropic.com/v1/messages')).toHaveLength(0)
  })

  it.each([
    ['success', {}, 'success', 200],
    ['timeout', { providerError: new DOMException('timed out', 'TimeoutError') }, 'timeout', 504],
    ['provider error', { status: 500 }, 'provider_error', 502],
    ['response validation failure', {
      providerBody: {
        usage: { input_tokens: 8, output_tokens: 2 },
        content: [],
      },
    }, 'validation_error', 502],
  ])('records a bounded %s outcome', async (_label, provider, expectedOutcome, statusCode) => {
    const journal = journalHarness()
    const response = await createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl: anthropicFetch([], provider),
      gatewayAccess: accessHarness(),
      providerAttemptJournal: journal,
      requestIdFactory: () => `outcome-${expectedOutcome}`,
    })(anthropicEvent())

    expect(response.statusCode).toBe(statusCode)
    expect(journal.transition).toHaveBeenCalledWith(expect.objectContaining({
      toState: 'outcome_observed',
      outcomeResult: expectedOutcome,
      reasonCode: null,
      reconciliationRef: null,
    }))
  })

  it.each([
    ['ledger success', undefined, 'ledgered'],
    ['ledger failure', new Error('database unavailable'), 'gap_pending'],
    ['ledger timeout', new DOMException('timed out', 'TimeoutError'), 'gap_pending'],
    ['ledger relationship conflict', undefined, 'reconciliation_conflict'],
  ])('preserves the learner response for %s and records the journal state', async (
    _label, ledgerError, journalState,
  ) => {
    const timeline = []
    const journal = journalHarness(timeline, {
      linkLedger: vi.fn(async (input) => {
        timeline.push(`link:${journalState}`)
        return { status: 'created', attemptId: input.attemptId, state: journalState }
      }),
    })
    const access = accessHarness(timeline)
    if (ledgerError) {
      access.recordProviderUsage.mockImplementation(async () => {
        timeline.push('ledger')
        throw ledgerError
      })
    }
    const response = await createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl: anthropicFetch(timeline),
      gatewayAccess: access,
      providerAttemptJournal: journal,
      requestIdFactory: () => `link-${journalState}`,
    })(anthropicEvent())

    expect(JSON.parse(response.body)).toEqual({ text: 'Take one small step.' })
    expect(access.recordProviderUsage).toHaveBeenCalledTimes(1)
    expect(journal.linkLedger).toHaveBeenCalledTimes(1)
    expect(timeline.at(-1)).toBe(`link:${journalState}`)
  })

  it('suppresses exact trusted invocation replay instead of dispatching twice', async () => {
    let reserved = false
    const journal = journalHarness([], {
      reserve: vi.fn(async () => {
        if (reserved) {
          return { status: 'replayed', attemptId: TEST_PROVIDER_ATTEMPT_ID, state: 'ledgered' }
        }
        reserved = true
        return { status: 'created', attemptId: TEST_PROVIDER_ATTEMPT_ID, state: 'reserved' }
      }),
    })
    const fetchImpl = anthropicFetch()
    const requestIdFactory = vi.fn()
      .mockReturnValueOnce('first-platform-invocation')
      .mockReturnValueOnce('second-platform-invocation')
    const handler = createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl,
      gatewayAccess: accessHarness(),
      providerAttemptJournal: journal,
      requestIdFactory,
    })
    const replayedEvent = anthropicEvent()
    replayedEvent.headers['x-academy-operation-id'] = '30000000-0000-4000-8000-000000000001'
    replayedEvent.multiValueHeaders = {
      'x-academy-operation-id': ['30000000-0000-4000-8000-000000000001'],
    }

    expect((await handler(replayedEvent)).statusCode).toBe(200)
    expect((await handler(replayedEvent)).statusCode).toBe(503)
    expect(providerCalls(fetchImpl, 'https://api.anthropic.com/v1/messages')).toHaveLength(1)
    const [first, second] = journal.reserve.mock.calls.map(([input]) => input)
    expect(first.ledgerExecutionKey).toBe(second.ledgerExecutionKey)
    expect(first.logicalOperationKey).toBe(second.logicalOperationKey)
    expect(first.ledgerExecutionKey).not.toContain('30000000-0000-4000-8000-000000000001')
  })

  it('serializes parallel duplicate HTTP operations to one physical dispatch', async () => {
    let reservationCalls = 0
    let releaseReservations
    const bothReserved = new Promise((resolve) => { releaseReservations = resolve })
    const journal = journalHarness([], {
      reserve: vi.fn(async () => {
        reservationCalls += 1
        const position = reservationCalls
        if (reservationCalls === 2) releaseReservations()
        await bothReserved
        return position === 1
          ? { status: 'created', attemptId: TEST_PROVIDER_ATTEMPT_ID, state: 'reserved' }
          : { status: 'replayed', attemptId: TEST_PROVIDER_ATTEMPT_ID, state: 'reserved' }
      }),
    })
    const fetchImpl = anthropicFetch()
    const handler = createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl,
      gatewayAccess: accessHarness(),
      providerAttemptJournal: journal,
    })
    const duplicate = anthropicEvent()
    duplicate.headers['x-academy-operation-id'] = '60000000-0000-4000-8000-000000000001'

    const responses = await Promise.all([handler(duplicate), handler(duplicate)])
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 503])
    expect(providerCalls(fetchImpl, 'https://api.anthropic.com/v1/messages')).toHaveLength(1)
  })

  it('rejects malformed or ambiguous client operation IDs before reservation', async () => {
    const journal = journalHarness()
    const fetchImpl = anthropicFetch()
    const handler = createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl,
      gatewayAccess: accessHarness(),
      providerAttemptJournal: journal,
    })
    const malformed = anthropicEvent()
    malformed.headers['x-academy-operation-id'] = 'private learner prompt'
    expect((await handler(malformed)).statusCode).toBe(400)

    const ambiguous = anthropicEvent()
    ambiguous.headers['x-academy-operation-id'] = '40000000-0000-4000-8000-000000000001'
    ambiguous.multiValueHeaders = {
      'x-academy-operation-id': ['50000000-0000-4000-8000-000000000001'],
    }
    expect((await handler(ambiguous)).statusCode).toBe(400)
    expect(journal.reserve).not.toHaveBeenCalled()
    expect(providerCalls(fetchImpl, 'https://api.anthropic.com/v1/messages')).toHaveLength(0)
  })

  it('creates distinct indexed identities for physical retries of one logical operation', async () => {
    const attempt0 = gatewayProviderAttemptIdentity({
      engine: 'tutor',
      logicalOperationSeed: 'logical-operation',
      physicalExecutionKey: 'physical-attempt-0',
      physicalRetryIndex: 0,
    })
    const attempt1 = gatewayProviderAttemptIdentity({
      engine: 'tutor',
      logicalOperationSeed: 'logical-operation',
      physicalExecutionKey: 'physical-attempt-1',
      physicalRetryIndex: 1,
    })

    expect(attempt1.logicalOperationKey).toBe(attempt0.logicalOperationKey)
    expect(attempt1.reservationKey).not.toBe(attempt0.reservationKey)
    expect(attempt1.ledgerExecutionKey).not.toBe(attempt0.ledgerExecutionKey)
    expect(attempt1.operationalExecutionKey).not.toBe(attempt0.operationalExecutionKey)
    expect([attempt0.physicalRetryIndex, attempt1.physicalRetryIndex]).toEqual([0, 1])
  })

  it('derives distinct content-free Study physical retry execution keys', () => {
    const first = gatewayProviderPhysicalExecutionKey({
      engine: 'study', logicalOperationSeed: 'study-operation', physicalRetryIndex: 0,
    })
    const second = gatewayProviderPhysicalExecutionKey({
      engine: 'study', logicalOperationSeed: 'study-operation', physicalRetryIndex: 1,
    })

    expect(first).toMatch(/^study_[a-f0-9]{64}$/)
    expect(second).toMatch(/^study_[a-f0-9]{64}$/)
    expect(second).not.toBe(first)
    expect(first).not.toContain('private')
  })

  it('journals Jarvis under its own engine and never stores private provider material', async () => {
    const journal = journalHarness()
    const providerSecret = 'raw-provider-error-secret'
    const response = await createAnthropicHandler({
      env: ANTHROPIC_ENV,
      fetchImpl: anthropicFetch([], {
        status: 500,
        providerBody: { error: providerSecret },
      }),
      gatewayAccess: accessHarness(),
      providerAttemptJournal: journal,
      requestIdFactory: () => 'jarvis-private-attempt',
    })(anthropicEvent('jarvis'))

    expect(response.statusCode).toBe(502)
    expect(journal.reserve).toHaveBeenCalledWith(expect.objectContaining({
      engine: 'jarvis', purpose: 'jarvis_turn', logicalModelTier: 'haiku',
    }), expect.anything())
    const serialized = JSON.stringify([
      ...journal.reserve.mock.calls,
      ...journal.transition.mock.calls,
      ...journal.linkLedger.mock.calls,
    ])
    expect(serialized).not.toContain('Private learner prompt.')
    expect(serialized).not.toContain(providerSecret)
    expect(serialized).not.toContain('messages')
    expect(serialized).not.toContain('response')
  })

  it('journals only the real premium TTS call without text or provider voice ID', async () => {
    const timeline = []
    const journal = journalHarness(timeline)
    const access = accessHarness(timeline)
    const response = await createTtsHandler({
      env: TTS_ENV,
      fetchImpl: ttsFetch(timeline),
      gatewayAccess: access,
      providerAttemptJournal: journal,
      requestIdFactory: () => 'premium-tts-attempt',
    })(ttsEvent())

    expect(response.statusCode).toBe(200)
    expect(journal.reserve).toHaveBeenCalledWith(expect.objectContaining({
      engine: 'tts',
      purpose: 'tts_synthesis',
      provider: 'elevenlabs',
      providerProductId: 'eleven_turbo_v2_5',
      providerModelId: 'eleven_turbo_v2_5',
      logicalModelTier: null,
    }), expect.anything())
    const serialized = JSON.stringify(journal.reserve.mock.calls)
    expect(serialized).not.toContain('Private speech input.')
    expect(serialized).not.toContain('private-voice-1')
    expect(timeline).toEqual([
      'reserve',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'ledger',
      'link',
    ])
  })

  it.each([
    ['Anthropic', createAnthropicHandler, ANTHROPIC_ENV, anthropicEvent()],
    ['TTS', createTtsHandler, TTS_ENV, ttsEvent()],
  ])('creates no %s attempt while its provider path is disabled', async (
    _label, createHandler, enabledEnv, event,
  ) => {
    const env = { ...enabledEnv }
    if (createHandler === createAnthropicHandler) env.ACADEMY_AI_ENABLED = 'false'
    else env.ACADEMY_TTS_ENABLED = 'false'
    const journal = journalHarness()
    const response = await createHandler({
      env,
      fetchImpl: createHandler === createAnthropicHandler ? anthropicFetch() : ttsFetch(),
      gatewayAccess: accessHarness(),
      providerAttemptJournal: journal,
    })(event)

    expect(response.statusCode).toBe(503)
    expect(journal.reserve).not.toHaveBeenCalled()
  })
})

describe('post-dispatch coordinator recovery', () => {
  it('attempts linkage after a lost outcome receipt and preserves cost authority ordering', async () => {
    const timeline = []
    const journal = journalHarness(timeline, {
      transition: vi.fn(async () => {
        timeline.push('outcome-attempted')
        throw new Error('receipt lost')
      }),
    })
    const result = await finishGatewayProviderAttempt({
      journal,
      attempt: {
        attemptId: TEST_PROVIDER_ATTEMPT_ID,
        transitionKeys: { outcome: 'outcome:key', ledger: 'ledger:key' },
      },
      outcomeResult: 'success',
      persistUsage: async () => {
        timeline.push('ledger')
        return true
      },
    })

    expect(timeline).toEqual(['outcome-attempted', 'ledger', 'outcome-attempted', 'link'])
    expect(result).toEqual({ accountingAvailable: true, journalState: 'ledgered' })
  })

  it('replays an identical ledger link once when its first receipt is lost', async () => {
    let linkCalls = 0
    const journal = journalHarness([], {
      linkLedger: vi.fn(async (input) => {
        linkCalls += 1
        if (linkCalls === 1) throw new Error('receipt lost')
        return { status: 'replayed', attemptId: input.attemptId, state: 'ledgered' }
      }),
    })
    const result = await finishGatewayProviderAttempt({
      journal,
      attempt: {
        attemptId: TEST_PROVIDER_ATTEMPT_ID,
        transitionKeys: { outcome: 'outcome:key', ledger: 'ledger:key' },
      },
      outcomeResult: 'success',
      persistUsage: async () => true,
    })

    expect(journal.linkLedger).toHaveBeenCalledTimes(2)
    expect(result.journalState).toBe('ledgered')
  })

  it('reserves each physical retry with the stable logical key and distinct retry slot', async () => {
    let nextId = 1
    const journal = journalHarness([], {
      reserve: vi.fn(async () => ({
        status: 'created',
        attemptId: `90000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
        state: 'reserved',
      })),
    })
    const common = {
      journal,
      requestKey: 'physical-attempt-0',
      engine: 'tutor',
      purpose: 'tutor_turn',
      provider: 'anthropic',
      providerProductId: 'claude-sonnet-4-6',
      providerModelId: 'claude-sonnet-4-6',
      logicalModelTier: 'sonnet',
      authority: {
        accountRef: ACCOUNT_ID,
        householdRef: HOUSEHOLD_ID,
        householdAttribution: 'resolved',
      },
      logicalOperationSeed: 'one-logical-operation',
    }
    await beginGatewayProviderAttempt({
      ...common,
      physicalExecutionKey: 'physical-attempt-0',
      physicalRetryIndex: 0,
    })
    await beginGatewayProviderAttempt({
      ...common,
      requestKey: 'physical-attempt-1',
      physicalExecutionKey: 'physical-attempt-1',
      physicalRetryIndex: 1,
    })

    const [first, second] = journal.reserve.mock.calls.map(([input]) => input)
    expect(second.logicalOperationKey).toBe(first.logicalOperationKey)
    expect([first.physicalRetryIndex, second.physicalRetryIndex]).toEqual([0, 1])
    expect(second.reservationKey).not.toBe(first.reservationKey)
    expect(second.ledgerExecutionKey).not.toBe(first.ledgerExecutionKey)
  })
})
