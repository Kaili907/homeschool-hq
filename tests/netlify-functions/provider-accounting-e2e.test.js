import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createAdminCostProjection } from '../../netlify/functions/_shared/admin-cost-projection.js'
import { createAnthropicSafetyClassifier } from '../../netlify/functions/_shared/study-safety/provider.js'
import { createTtsVoiceCatalog } from '../../netlify/functions/_shared/tts-catalog.js'
import { createAnthropicHandler } from '../../netlify/functions/anthropic.js'
import { createTtsHandler } from '../../netlify/functions/tts.js'
import { parseAdminCostsModel } from '../../src/admin/costsModel.ts'
import {
  createMemoryCache,
  createUsageMeter,
  createVoiceAdapter,
} from '../../src/tutor/voice.ts'

const ACCOUNT_ID = '10000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '20000000-0000-4000-8000-000000000001'
const ATTEMPT_ID_PREFIX = '90000000-0000-4000-8000-'
const NOW = new Date('2026-08-10T18:30:00.000Z')
const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  ANTHROPIC_API_KEY: 'anthropic-provider-secret',
  ELEVENLABS_API_KEY: 'elevenlabs-provider-secret',
  ELEVENLABS_ALLOWED_VOICE_IDS: 'private-voice-1',
  ACADEMY_APP_VERSION: 'academy-e2e-build',
  ACADEMY_STUDY_ENGINE_VERSION: 'study-safety-v1',
})

const TTS_CATALOG = createTtsVoiceCatalog({
  catalogVersion: 'provider-accounting-e2e-v1',
  defaultVoiceRef: 'academy.tts.provider-accounting-e2e',
  voices: [{
    voiceRef: 'academy.tts.provider-accounting-e2e',
    displayLabel: 'Provider accounting E2E',
    providerClass: 'premium',
    provider: 'elevenlabs',
    providerVoiceId: 'private-voice-1',
    voiceVersion: 'v1',
    status: 'active',
    cachedPlayback: 'allow',
    adminApproved: true,
  }],
})

const runtimeConfigurationResolver = Object.freeze({
  resolve: async () => ({
    values: {
      aiEnabled: true,
      ttsEnabled: true,
      aiDailyLimit: 50,
      ttsDailyLimit: 100,
      approvedTiers: ['sonnet', 'haiku'],
      defaultTier: 'sonnet',
    },
  }),
})

function event(mode = 'tutor') {
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
      voiceRef: 'academy.tts.provider-accounting-e2e',
      voiceVersion: 'v1',
    }),
  }
}

const STUDY_REQUEST = Object.freeze({
  classificationVersion: 1,
  normalizedTransientText: 'Private Study classifier input.',
  deterministicAssessment: Object.freeze({
    outcome: 'clear', categories: [], ruleIds: ['safety-clear-no-signal-v1'],
  }),
})

function fetchRouter(timeline) {
  return vi.fn(async (url) => {
    if (url === 'https://academy.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify({ id: ACCOUNT_ID }), { status: 200 })
    }
    if (url === 'https://api.anthropic.com/v1/messages') {
      timeline.push('provider')
      return new Response(JSON.stringify({
        usage: { input_tokens: 12, output_tokens: 3 },
        content: [{ type: 'text', text: 'Take one small step.' }],
      }), { status: 200 })
    }
    throw new Error(`unexpected URL: ${url}`)
  })
}

function currentStates(state) {
  return {
    reserved: state === 'reserved' ? 1 : 0,
    dispatchPossible: state === 'dispatch_possible' ? 1 : 0,
    outcomeObserved: state === 'outcome_observed' ? 1 : 0,
    ledgered: state === 'ledgered' ? 1 : 0,
    gapPending: state === 'gap_pending' ? 1 : 0,
    reconciliationConflict: state === 'reconciliation_conflict' ? 1 : 0,
    reconciled: state === 'reconciled' ? 1 : 0,
    confirmedNotDispatched: state === 'confirmed_not_dispatched' ? 1 : 0,
    unresolvable: state === 'unresolvable' ? 1 : 0,
  }
}

function summedStates(attempts) {
  return attempts.reduce((total, item) => {
    const itemStates = currentStates(item.state)
    for (const [key, value] of Object.entries(itemStates)) total[key] += value
    return total
  }, currentStates(null))
}

function missingLedgerRelationship(attempt) {
  return [
    'outcome_observed', 'gap_pending', 'reconciliation_conflict', 'unresolvable',
  ].includes(attempt.state) && attempt.state !== 'ledgered'
}

function coverageRows(attempts, dimension) {
  const groups = new Map()
  for (const attempt of attempts) {
    const key = attempt[dimension]
    const group = groups.get(key) ?? []
    group.push(attempt)
    groups.set(key, group)
  }
  return [...groups].map(([key, group]) => ({
    key,
    recordedProviderAttempts: group.length,
    ledgerLinkedAttempts: group.filter((item) => item.state === 'ledgered').length,
    journaledMissingLedgerRelationship: group.filter(missingLedgerRelationship).length,
    states: summedStates(group),
  }))
}

function accountingHarness({ ledgerFailure = false, conflict = false } = {}) {
  const timeline = []
  const usageRows = []
  const attempts = []

  const journal = {
    reserve: vi.fn(async (input) => {
      timeline.push('reserve')
      const attemptId = `${ATTEMPT_ID_PREFIX}${String(attempts.length + 1).padStart(12, '0')}`
      attempts.push({ ...input, attemptId, state: 'reserved' })
      return { status: 'created', attemptId, state: 'reserved' }
    }),
    transition: vi.fn(async (input) => {
      timeline.push(`transition:${input.toState}`)
      const attempt = attempts.find((item) => item.attemptId === input.attemptId)
      attempt.state = input.toState
      return { status: 'created', attemptId: input.attemptId, state: input.toState }
    }),
    linkLedger: vi.fn(async (input) => {
      timeline.push('link')
      const attempt = attempts.find((item) => item.attemptId === input.attemptId)
      const hasLedger = usageRows.some((row) => row.executionKey === attempt.ledgerExecutionKey)
      attempt.state = conflict
        ? 'reconciliation_conflict'
        : hasLedger ? 'ledgered' : 'gap_pending'
      return { status: 'created', attemptId: input.attemptId, state: attempt.state }
    }),
  }

  const access = {
    requireEntitlement: vi.fn(async () => ({
      householdRef: HOUSEHOLD_ID,
      householdAttribution: 'resolved',
    })),
    consumeUsage: vi.fn(async () => undefined),
    recordProviderUsage: vi.fn(async (record) => {
      timeline.push(ledgerFailure ? 'ledger_failure' : 'ledger')
      if (ledgerFailure) throw new Error('ledger unavailable')
      usageRows.push({
        schemaVersion: 2,
        usageId: `usage-e2e-${usageRows.length + 1}`,
        executionKey: record.requestKey,
        occurredAt: '2026-08-10T12:00:00.000Z',
        accountRef: record.accountRef,
        householdRef: record.householdRef,
        householdAttribution: record.householdAttribution,
        learnerRef: null,
        engine: record.engine,
        appVersion: record.appVersion,
        engineVersion: record.engineVersion,
        curriculumVersion: record.curriculumVersion,
        provider: record.provider,
        providerProductId: record.providerProductId,
        providerModelId: record.providerModelId,
        logicalModelTier: record.logicalModelTier,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        cachedInputReadTokens: record.cachedInputReadTokens,
        cachedInputWriteTokens: record.cachedInputWriteTokens,
        ttsCharacters: record.ttsCharacters,
        requestCount: 1,
        latencyMs: record.latencyMs,
        result: record.result,
        resultReasonCode: record.resultReasonCode,
        billingDisposition: record.billingDisposition,
        costMicros: null,
        currency: 'USD',
        costKind: 'unavailable',
        pricingCatalogVersion: null,
        costComponents: [],
        reconciliationRef: null,
      })
    }),
    readProviderUsageCosts: vi.fn(async () => {
      timeline.push('ledger_read')
      return usageRows
    }),
    readProviderAttemptCoverage: vi.fn(async ({ startAt, endExclusive }) => {
      timeline.push('coverage_read')
      const states = summedStates(attempts)
      const linked = attempts.filter((item) => item.state === 'ledgered').length
      const missing = attempts.filter(missingLedgerRelationship).length
      const orphan = usageRows.length - linked
      const attention = missing + orphan + states.gapPending
        + states.reconciliationConflict + states.unresolvable
      const coverageStatus = attention > 0
        ? 'attention_required'
        : states.reserved + states.dispatchPossible + states.outcomeObserved > 0
          ? 'in_progress'
          : 'covered'
      return {
        schemaVersion: 1,
        coverageStatus,
        range: { startAt, endExclusive },
        recordedProviderAttempts: attempts.length,
        ledgerLinkedAttempts: linked,
        journaledMissingLedgerRelationship: missing,
        ledgerRowsWithoutJournalRelationship: orphan,
        states,
        breakdowns: {
          engines: coverageRows(attempts, 'engine'),
          purposes: coverageRows(attempts, 'purpose'),
          providers: coverageRows(attempts, 'provider'),
        },
        costAuthority: 'academy_provider_usage_ledger',
        invoiceCompletenessClaim: false,
      }
    }),
  }

  return { access, journal, timeline, usageRows, attempts }
}

async function dispatchAnthropic(harness, mode = 'tutor') {
  return createAnthropicHandler({
    env: ENV,
    fetchImpl: fetchRouter(harness.timeline),
    gatewayAccess: harness.access,
    providerAttemptJournal: harness.journal,
    runtimeConfigurationResolver,
    requestIdFactory: () => `provider-accounting-e2e-${mode}`,
  })(event(mode))
}

async function dispatchTts(harness) {
  const fetchImpl = vi.fn(async (url) => {
    if (url === 'https://academy.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify({ id: ACCOUNT_ID }), { status: 200 })
    }
    harness.timeline.push('provider')
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    })
  })
  return createTtsHandler({
    env: ENV,
    fetchImpl,
    gatewayAccess: harness.access,
    providerAttemptJournal: harness.journal,
    runtimeConfigurationResolver,
    requestIdFactory: () => 'provider-accounting-e2e-tts',
    catalog: TTS_CATALOG,
  })(ttsEvent())
}

async function dispatchStudy(harness) {
  const classifier = createAnthropicSafetyClassifier({
    env: ENV,
    fetchImpl: vi.fn(async () => {
      harness.timeline.push('provider')
      return new Response(JSON.stringify({
        usage: { input_tokens: 9, output_tokens: 4 },
        content: [{
          type: 'text',
          text: JSON.stringify({
            outcome: 'clear', categories: [], reasonCodes: ['safety-provider-clear-v1'],
          }),
        }],
      }), { status: 200 })
    }),
    gatewayAccess: harness.access,
    providerAttemptJournal: harness.journal,
    maxAttempts: 1,
    delay: async () => {},
  })
  return classifier.classify(STUDY_REQUEST, {
    requestKey: 'provider-accounting-e2e-study',
    accountRef: ACCOUNT_ID,
    householdRef: HOUSEHOLD_ID,
    householdAttribution: 'resolved',
  })
}

async function readAdminProjection(harness) {
  return createAdminCostProjection({
    gatewayAccess: harness.access,
    now: () => NOW,
  }).read({ queryStringParameters: { range: 'today' } })
}

describe('provider accounting end-to-end contract', () => {
  it('composes Tutor, Jarvis, premium TTS, and Study safety through one Admin coverage truth', async () => {
    const harness = accountingHarness()
    const tutor = await dispatchAnthropic(harness, 'tutor')
    const jarvis = await dispatchAnthropic(harness, 'jarvis')
    const tts = await dispatchTts(harness)
    const study = await dispatchStudy(harness)

    expect([tutor.statusCode, jarvis.statusCode, tts.statusCode, study.outcome]).toEqual([
      200, 200, 200, 'clear',
    ])
    const completeAttemptTimeline = [
      'reserve',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'ledger',
      'link',
    ]
    expect(harness.timeline).toEqual([
      ...completeAttemptTimeline,
      ...completeAttemptTimeline,
      ...completeAttemptTimeline,
      ...completeAttemptTimeline,
    ])
    expect(harness.attempts.map(({ engine, purpose, provider }) => ({ engine, purpose, provider })))
      .toEqual([
        { engine: 'tutor', purpose: 'tutor_turn', provider: 'anthropic' },
        { engine: 'jarvis', purpose: 'jarvis_turn', provider: 'anthropic' },
        { engine: 'tts', purpose: 'tts_synthesis', provider: 'elevenlabs' },
        { engine: 'study', purpose: 'safety_classification', provider: 'anthropic' },
      ])
    expect(harness.usageRows.map((row) => row.engine)).toEqual([
      'tutor', 'jarvis', 'tts', 'study',
    ])
    expect(harness.usageRows[3]).toMatchObject({
      engine: 'study',
      provider: 'anthropic',
      providerProductId: 'claude-haiku-4-5',
      providerModelId: 'claude-haiku-4-5',
      logicalModelTier: 'haiku',
      inputTokens: 9,
      outputTokens: 4,
      learnerRef: null,
    })

    const projection = await readAdminProjection(harness)
    const browserModel = parseAdminCostsModel(projection)
    expect(harness.access.readProviderAttemptCoverage).toHaveBeenCalledWith({
      startAt: '2026-08-10T00:00:00.000Z',
      endExclusive: '2026-08-11T00:00:00.000Z',
    })
    expect(browserModel?.providerAccountingCoverage).toMatchObject({
      status: 'complete_for_journaled_attempts',
      journalStatus: 'complete_for_journaled_attempts',
      reconciliationState: 'clear_for_journaled_attempts',
      metrics: { reservedAttempts: 4, ledgerLinkedAttempts: 4, accountingGaps: 0 },
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
    })
    expect(browserModel?.providerAccountingCoverage.breakdowns.engines.map((row) => row.key))
      .toEqual(['tutor', 'jarvis', 'tts', 'study'])
    expect(browserModel?.providerAccountingCoverage.breakdowns.purposes.map((row) => row.key))
      .toEqual(['tutor_turn', 'jarvis_turn', 'tts_synthesis', 'safety_classification'])
    expect(browserModel?.source.recordsIncluded).toBe(4)

    const browserWire = JSON.stringify(browserModel)
    for (const prohibited of [
      'Private learner prompt.', 'Private speech input.', 'Private Study classifier input.',
      ACCOUNT_ID, HOUSEHOLD_ID, ATTEMPT_ID_PREFIX, 'provider-accounting-e2e',
      'anthropic-provider-secret', 'elevenlabs-provider-secret', 'executionKey',
    ]) expect(browserWire).not.toContain(prohibited)
  })

  it('turns ledger persistence failure into gap_pending without replacing the provider result', async () => {
    const harness = accountingHarness({ ledgerFailure: true })
    const response = await dispatchAnthropic(harness)
    expect(response.statusCode).toBe(200)
    expect(harness.timeline).toEqual([
      'reserve',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'ledger_failure',
      'link',
    ])

    const projection = await readAdminProjection(harness)
    expect(projection.providerAccountingCoverage).toMatchObject({
      status: 'gaps_detected',
      journalStatus: 'gaps_detected',
      metrics: { ledgerLinkedAttempts: 0, accountingGaps: 1, gapPending: 1 },
      invoiceCompletenessClaim: false,
    })
    expect(projection.source.recordsIncluded).toBe(0)
  })

  it('preserves reconciliation_conflict when durable journal and ledger facts disagree', async () => {
    const harness = accountingHarness({ conflict: true })
    expect((await dispatchAnthropic(harness)).statusCode).toBe(200)

    const projection = await readAdminProjection(harness)
    expect(projection.providerAccountingCoverage).toMatchObject({
      status: 'reconciliation_conflict',
      journalStatus: 'reconciliation_conflict',
      reconciliationState: 'conflict',
      metrics: { reconciliationConflicts: 1 },
      invoiceCompletenessClaim: false,
    })
  })

  it('excludes Tutor scripted replies and TTS browser/cache playback from provider dispatch', async () => {
    const tutorSource = readFileSync(
      new URL('../../src/components/tutor/TutorChat.tsx', import.meta.url),
      'utf8',
    )
    const scriptedBranch = tutorSource.indexOf('if (isConcerning(text))')
    const providerCall = tutorSource.indexOf('const result = await askTutor')
    expect(scriptedBranch).toBeGreaterThan(-1)
    expect(providerCall).toBeGreaterThan(scriptedBranch)
    expect(tutorSource.slice(scriptedBranch, providerCall)).toContain("source: 'scripted'")
    expect(tutorSource.slice(scriptedBranch, providerCall)).toMatch(/setEnded\('flagged'\)[\s\S]*return/)

    let usageState = null
    const usage = createUsageMeter({
      read: () => usageState,
      write: (value) => { usageState = value },
      now: () => NOW,
    })
    const premiumDispatch = vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])]))
    const adapter = createVoiceAdapter({
      cache: createMemoryCache(),
      usage,
      elevenLabs: { available: () => true, synthesize: premiumDispatch },
      catalog: {
        load: async () => ({ catalogVersion: 'e2e-v1', synthesisEnabled: true, defaultVoiceRef: null, voices: [] }),
        resolve: async (voiceRef, voiceVersion) => ({
          voiceRef, voiceVersion, displayLabel: 'Academy premium', providerClass: 'premium',
          status: 'active', deploymentAvailable: true, cachedPlaybackAllowed: true,
          synthesisEnabled: true,
        }),
      },
      browser: { available: () => true, speak: vi.fn(), cancel: vi.fn() },
      playAudio: vi.fn(async () => undefined),
      stopAudio: vi.fn(),
    })

    expect(await adapter.speak({ text: 'Browser only', voiceRef: 'urn:browser:test' })).toBe('browser')
    expect(premiumDispatch).not.toHaveBeenCalled()
    const premium = {
      text: 'Cache this line',
      voiceRef: 'catalog:academy.tts.provider-accounting-test:v1',
    }
    expect(await adapter.speak(premium)).toBe('elevenlabs')
    expect(await adapter.speak(premium)).toBe('cache')
    expect(premiumDispatch).toHaveBeenCalledTimes(1)
  })
})
