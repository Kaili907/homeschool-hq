import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createAdminCostProjection } from '../../netlify/functions/_shared/admin-cost-projection.js'
import { createAnthropicHandler } from '../../netlify/functions/anthropic.js'
import { parseAdminCostsModel } from '../../src/admin/costsModel.ts'
import { monthlyCostAlertFixture } from '../../src/admin/costsTestFixtures.ts'
import {
  createMemoryCache,
  createUsageMeter,
  createVoiceAdapter,
} from '../../src/tutor/voice.ts'

const ACCOUNT_ID = '10000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '20000000-0000-4000-8000-000000000001'
const ATTEMPT_ID = '90000000-0000-4000-8000-000000000001'
const NOW = new Date('2026-08-10T18:30:00.000Z')
const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  ANTHROPIC_API_KEY: 'anthropic-provider-secret',
  ACADEMY_APP_VERSION: 'academy-e2e-build',
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

function event() {
  return {
    httpMethod: 'POST',
    path: '/api/anthropic/v1/messages',
    headers: {
      authorization: 'Bearer header.payload.signature',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'tutor',
      modelTier: 'sonnet',
      context: {
        grade: '3',
        problem: '365 - 128 = ?',
        correctAnswer: '237',
        studentAnswer: '243',
        graded: false,
      },
      messages: [{ role: 'user', content: 'Private learner prompt.' }],
    }),
  }
}

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

function accountingHarness({ ledgerFailure = false, conflict = false } = {}) {
  const timeline = []
  const usageRows = []
  let attempt = null

  const journal = {
    reserve: vi.fn(async (input) => {
      timeline.push('reserve')
      attempt = { ...input, state: 'reserved' }
      return { status: 'created', attemptId: ATTEMPT_ID, state: 'reserved' }
    }),
    transition: vi.fn(async (input) => {
      timeline.push(`transition:${input.toState}`)
      attempt.state = input.toState
      return { status: 'created', attemptId: input.attemptId, state: input.toState }
    }),
    linkLedger: vi.fn(async (input) => {
      timeline.push('link')
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
        usageId: 'usage-e2e-1',
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
        costMicros: '0',
        currency: 'USD',
        costKind: 'calculated',
        pricingCatalogVersion: 'provider-accounting-e2e-v1',
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
      const states = currentStates(attempt.state)
      const linked = attempt.state === 'ledgered' ? 1 : 0
      const missing = [
        'outcome_observed', 'gap_pending', 'reconciliation_conflict', 'unresolvable',
      ].includes(attempt.state) && linked === 0 ? 1 : 0
      const orphan = usageRows.length - linked
      const attention = missing + orphan + states.gapPending
        + states.reconciliationConflict + states.unresolvable
      const coverageStatus = attention > 0
        ? 'attention_required'
        : states.reserved + states.dispatchPossible + states.outcomeObserved > 0
          ? 'in_progress'
          : 'covered'
      const row = {
        recordedProviderAttempts: 1,
        ledgerLinkedAttempts: linked,
        journaledMissingLedgerRelationship: missing,
        states,
      }
      return {
        schemaVersion: 1,
        coverageStatus,
        range: { startAt, endExclusive },
        recordedProviderAttempts: 1,
        ledgerLinkedAttempts: linked,
        journaledMissingLedgerRelationship: missing,
        ledgerRowsWithoutJournalRelationship: orphan,
        states,
        breakdowns: {
          engines: [{ key: 'tutor', ...row }],
          purposes: [{ key: 'tutor_turn', ...row }],
          providers: [{ key: 'anthropic', ...row }],
        },
        costAuthority: 'academy_provider_usage_ledger',
        invoiceCompletenessClaim: false,
      }
    }),
  }

  return { access, journal, timeline, usageRows }
}

async function dispatchTutor(harness) {
  return createAnthropicHandler({
    env: ENV,
    fetchImpl: fetchRouter(harness.timeline),
    gatewayAccess: harness.access,
    providerAttemptJournal: harness.journal,
    runtimeConfigurationResolver,
    requestIdFactory: () => 'provider-accounting-e2e',
  })(event())
}

async function readAdminProjection(harness) {
  return createAdminCostProjection({
    gatewayAccess: harness.access,
    now: () => NOW,
  }).read({ queryStringParameters: { range: 'today' } })
}

describe('provider accounting end-to-end contract', () => {
  it('composes reservation, physical dispatch, outcome, ledger, link, coverage read, and Admin projection', async () => {
    const harness = accountingHarness()
    const response = await dispatchTutor(harness)

    expect(response.statusCode).toBe(200)
    expect(harness.timeline).toEqual([
      'reserve',
      'transition:dispatch_possible',
      'provider',
      'transition:outcome_observed',
      'ledger',
      'link',
    ])

    const projection = await readAdminProjection(harness)
    const browserModel = parseAdminCostsModel({
      ...projection,
      contractVersion: 4,
      monthlyCostAlert: monthlyCostAlertFixture({ generatedAt: NOW.toISOString() }),
    })
    expect(harness.access.readProviderAttemptCoverage).toHaveBeenCalledWith({
      startAt: '2026-08-10T00:00:00.000Z',
      endExclusive: '2026-08-11T00:00:00.000Z',
    })
    expect(browserModel?.providerAccountingCoverage).toMatchObject({
      status: 'partial',
      journalStatus: 'complete_for_journaled_attempts',
      reconciliationState: 'clear_for_journaled_attempts',
      metrics: { reservedAttempts: 1, ledgerLinkedAttempts: 1, accountingGaps: 0 },
      providerInstrumentation: {
        status: 'partial',
        engines: [
          { key: 'tutor', status: 'covered' },
          { key: 'jarvis', status: 'covered' },
          { key: 'tts', status: 'covered' },
          { key: 'study', status: 'pending' },
        ],
      },
      invoiceCompletenessClaim: false,
    })
    expect(browserModel?.source.recordsIncluded).toBe(1)

    const browserWire = JSON.stringify(browserModel)
    for (const prohibited of [
      'Private learner prompt.', ACCOUNT_ID, HOUSEHOLD_ID, ATTEMPT_ID,
      'provider-accounting-e2e', 'anthropic-provider-secret', 'executionKey',
    ]) expect(browserWire).not.toContain(prohibited)
  })

  it('turns ledger persistence failure into gap_pending without replacing the provider result', async () => {
    const harness = accountingHarness({ ledgerFailure: true })
    const response = await dispatchTutor(harness)
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
    expect((await dispatchTutor(harness)).statusCode).toBe(200)

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
