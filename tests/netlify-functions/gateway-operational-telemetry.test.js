import { describe, expect, it, vi } from 'vitest'
import { GatewayError } from '../../netlify/functions/_shared/http.js'
import {
  createGatewayOperationalTelemetry,
  recordGatewayTerminal,
} from '../../netlify/functions/_shared/gateway-telemetry.js'
import { createAnthropicHandler } from '../../netlify/functions/anthropic.js'
import { createTtsHandler } from '../../netlify/functions/tts.js'

const HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001'
const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  ANTHROPIC_API_KEY: 'anthropic-provider-secret',
  ELEVENLABS_API_KEY: 'elevenlabs-provider-secret',
  ELEVENLABS_ALLOWED_VOICE_IDS: 'voice-1',
  ACADEMY_AI_ENABLED: 'true',
  ACADEMY_TTS_ENABLED: 'true',
  ACADEMY_APP_VERSION: 'academy-test-build',
  ACADEMY_GATEWAY_ENGINE_VERSION: 'gateway-v3',
  ACADEMY_JARVIS_ENGINE_VERSION: 'jarvis-v2',
})

function access(overrides = {}) {
  return {
    requireEntitlement: vi.fn(async () => ({
      householdRef: HOUSEHOLD_ID,
      householdAttribution: 'resolved',
    })),
    consumeUsage: vi.fn(async () => undefined),
    recordProviderUsage: vi.fn(async () => undefined),
    ...overrides,
  }
}

function telemetry() {
  return { record: vi.fn(async () => ({ status: 'recorded' })) }
}

function anthropicEvent(body) {
  return {
    httpMethod: 'POST',
    path: '/api/anthropic/v1/messages',
    headers: {
      authorization: 'Bearer header.payload.signature',
      'content-type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
}

function tutorRequest() {
  return {
    mode: 'tutor',
    modelTier: 'sonnet',
    context: {
      grade: '3', problem: '365 - 128 = ?', correctAnswer: '237',
      studentAnswer: '243', graded: false,
    },
    messages: [{ role: 'user', content: 'Private learner prompt.' }],
  }
}

function jarvisRequest() {
  return {
    mode: 'jarvis',
    modelTier: 'haiku',
    context: {
      assistant: { name: 'Jarvis', tonePreference: 'brief' },
      student: {
        grade: '10', today: '2026-08-09', mission: [], deadlines: [],
        courses: [], geometry: [], algebra: [], assessments: [],
      },
      actions: [],
      graded: false,
    },
    messages: [{ role: 'user', content: 'What next?' }],
  }
}

function authThenAnthropic({ status = 200, body } = {}) {
  return vi.fn(async (url) => {
    if (url === 'https://academy.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify({ id: 'account-1' }), { status: 200 })
    }
    if (url === 'https://api.anthropic.com/v1/messages') {
      if (body instanceof Error) throw body
      return new Response(JSON.stringify(body ?? {
        usage: { input_tokens: 12, output_tokens: 3 },
        content: [{ type: 'text', text: 'Take one small step.' }],
      }), { status })
    }
    throw new Error(`unexpected URL: ${url}`)
  })
}

function ttsEvent(text = 'Private speech text.') {
  return {
    httpMethod: 'POST',
    path: '/api/tts/synthesize',
    headers: {
      authorization: 'Bearer header.payload.signature',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text, voiceId: 'voice-1' }),
  }
}

function authThenTts() {
  return vi.fn(async (url) => {
    if (url === 'https://academy.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify({ id: 'account-1' }), { status: 200 })
    }
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    })
  })
}

describe('production gateway operational telemetry', () => {
  it('records success without prompt, response, or invented learner attribution', async () => {
    const sink = telemetry()
    const response = await createAnthropicHandler({
      env: ENV,
      fetchImpl: authThenAnthropic(),
      gatewayAccess: access(),
      telemetry: sink,
      requestIdFactory: () => 'gateway-success',
    })(anthropicEvent(tutorRequest()))

    expect(response.statusCode).toBe(200)
    expect(sink.record).toHaveBeenCalledTimes(1)
    expect(sink.record.mock.calls[0]).toEqual([
      expect.objectContaining({
        executionKey: 'gateway-success', engine: 'gateway',
        eventType: 'gateway.request', result: 'success',
        metadata: expect.objectContaining({ reason_code: 'completed', http_status: 200 }),
      }),
      { householdRef: HOUSEHOLD_ID, householdAttribution: 'resolved' },
    ])
    const serialized = JSON.stringify(sink.record.mock.calls)
    expect(serialized).not.toContain('Private learner prompt.')
    expect(serialized).not.toContain('Take one small step.')
    expect(serialized).not.toContain('learnerRef')
  })

  it('classifies validation and quota rejection without provider use or failure inflation', async () => {
    const validationSink = telemetry()
    const validationAccess = access()
    const invalid = await createAnthropicHandler({
      env: ENV,
      fetchImpl: authThenAnthropic(),
      gatewayAccess: validationAccess,
      telemetry: validationSink,
      requestIdFactory: () => 'gateway-validation',
    })(anthropicEvent('{bad json'))
    expect(invalid.statusCode).toBe(400)
    expect(validationSink.record).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'validation_error', metadata: expect.objectContaining({ reason_code: 'malformed_json' }) }),
      expect.anything(),
    )
    expect(validationAccess.consumeUsage).not.toHaveBeenCalled()

    const quotaSink = telemetry()
    const quotaAccess = access({
      consumeUsage: vi.fn(async () => { throw new GatewayError(429, 'usage_limit') }),
    })
    const quotaFetch = authThenAnthropic()
    const rejected = await createAnthropicHandler({
      env: ENV,
      fetchImpl: quotaFetch,
      gatewayAccess: quotaAccess,
      telemetry: quotaSink,
      requestIdFactory: () => 'gateway-quota',
    })(anthropicEvent(tutorRequest()))
    expect(rejected.statusCode).toBe(429)
    expect(quotaSink.record).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'rejected', metadata: expect.objectContaining({ reason_code: 'usage_limit' }) }),
      expect.anything(),
    )
    expect(quotaFetch).toHaveBeenCalledTimes(1)
    expect(quotaAccess.recordProviderUsage).not.toHaveBeenCalled()
  })

  it.each([
    ['provider error', authThenAnthropic({ status: 500 }), 'provider_error', 502, 'provider_rejected'],
    ['timeout', authThenAnthropic({ body: new DOMException('timed out', 'TimeoutError') }), 'timeout', 504, 'upstream_timeout'],
  ])('records %s as its canonical terminal result', async (_label, fetchImpl, result, status, reason) => {
    const sink = telemetry()
    const response = await createAnthropicHandler({
      env: ENV, fetchImpl, gatewayAccess: access(), telemetry: sink,
      requestIdFactory: () => `gateway-${result}`,
    })(anthropicEvent(tutorRequest()))
    expect(response.statusCode).toBe(status)
    expect(sink.record).toHaveBeenCalledWith(
      expect.objectContaining({ result, metadata: expect.objectContaining({ reason_code: reason }) }),
      expect.anything(),
    )
  })

  it('emits a Jarvis turn only from the trusted validated request mode', async () => {
    const sink = telemetry()
    await createAnthropicHandler({
      env: ENV, fetchImpl: authThenAnthropic(), gatewayAccess: access(), telemetry: sink,
      requestIdFactory: () => 'jarvis-terminal',
    })(anthropicEvent(jarvisRequest()))
    expect(sink.record.mock.calls.map(([observation]) => [observation.engine, observation.eventType]))
      .toEqual([['gateway', 'gateway.request'], ['jarvis', 'jarvis.turn']])
    for (const [observation] of sink.record.mock.calls) {
      expect(observation).not.toHaveProperty('learnerRef')
    }
  })

  it('derives TTS telemetry from the same provider receipt and never stores text or audio', async () => {
    const sink = telemetry()
    const providerAccess = access()
    const text = 'Private TTS input.'
    const response = await createTtsHandler({
      env: ENV, fetchImpl: authThenTts(), gatewayAccess: providerAccess, telemetry: sink,
      requestIdFactory: () => 'tts-parity',
    })(ttsEvent(text))
    expect(response.statusCode).toBe(200)
    const receipt = providerAccess.recordProviderUsage.mock.calls[0][0]
    const observation = sink.record.mock.calls[0][0]
    expect([observation.result, observation.durationMs]).toEqual([receipt.result, receipt.latencyMs])
    expect(observation.eventType).toBe('gateway.request')
    expect(sink.record.mock.calls.some(([event]) => event.eventType === 'tts.synthesis')).toBe(false)
    expect(JSON.stringify(sink.record.mock.calls)).not.toContain(text)
    expect(JSON.stringify(sink.record.mock.calls)).not.toContain(response.body)
  })

  it('marks provider success with unavailable accounting without changing the response', async () => {
    const sink = telemetry()
    const failedAccounting = access({
      recordProviderUsage: vi.fn(async () => { throw new Error('database unavailable') }),
    })
    const response = await createAnthropicHandler({
      env: ENV, fetchImpl: authThenAnthropic(), gatewayAccess: failedAccounting,
      telemetry: sink, requestIdFactory: () => 'accounting-gap',
    })(anthropicEvent(tutorRequest()))
    expect(JSON.parse(response.body)).toEqual({ text: 'Take one small step.' })
    expect(sink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'success',
        metadata: expect.objectContaining({
          reason_code: 'accounting_unavailable',
          failure_stage: 'accounting_persistence',
        }),
      }),
      expect.anything(),
    )
  })

  it('uses trusted versions, system scope for ambiguous households, and no learner identity', async () => {
    const append = vi.fn(async (_executionKey, facts) => ({
      status: 'created',
      event: {
        ...facts,
        eventId: '00000000-0000-4000-8000-000000000001',
        occurredAt: '2026-08-09T16:00:00.000Z',
      },
    }))
    const writer = createGatewayOperationalTelemetry({
      env: ENV,
      access: {
        createOperationalTelemetryStore: () => ({ append, list: async () => [] }),
      },
    })
    await recordGatewayTerminal(writer, {
      requestKey: 'ambiguous-household',
      authority: { householdRef: null, householdAttribution: 'ambiguous' },
      mode: 'tutor', operation: 'anthropic_messages', provider: 'anthropic', route: 'anthropic',
      result: 'success', statusCode: 200, durationMs: 9,
      reasonCode: 'completed', accountingAvailable: true,
    })
    expect(append).toHaveBeenCalledWith('ambiguous-household', expect.objectContaining({
      scope: 'system', householdRef: null, learnerRef: null,
      appVersion: 'academy-test-build', engineVersion: 'gateway-v3',
    }))
  })
})
