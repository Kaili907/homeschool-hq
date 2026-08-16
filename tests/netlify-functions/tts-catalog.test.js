import { describe, expect, it, vi } from 'vitest'
import {
  TTS_VOICE_CATALOG,
  createTtsVoiceCatalog,
  projectPublicTtsCatalog,
} from '../../netlify/functions/_shared/tts-catalog.js'
import { createTtsHandler as createBaseTtsHandler } from '../../netlify/functions/tts.js'

const PROVIDER_SENTINEL = 'server-only-provider-voice-sentinel'
const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  ELEVENLABS_API_KEY: 'provider-key',
  ELEVENLABS_ALLOWED_VOICE_IDS: PROVIDER_SENTINEL,
  ACADEMY_TTS_ENABLED: 'true',
  ACADEMY_APP_VERSION: 'catalog-test-build',
})
const EFFECTIVE_CONFIGURATION = Object.freeze({
  status: 'available',
  runtime: Object.freeze({ ttsEnabled: true }),
  quotas: Object.freeze({ ttsRequestsPerAccountDay: 100 }),
})

function createTtsHandler(overrides = {}) {
  return createBaseTtsHandler({
    effectiveConfigurationReader: { read: vi.fn(async () => EFFECTIVE_CONFIGURATION) },
    ...overrides,
  })
}

function entry(overrides = {}) {
  return {
    voiceRef: 'academy.tts.synthetic',
    displayLabel: 'Synthetic voice',
    providerClass: 'premium',
    provider: 'elevenlabs',
    providerVoiceId: PROVIDER_SENTINEL,
    voiceVersion: 'v1',
    status: 'active',
    cachedPlayback: 'allow',
    adminApproved: true,
    ...overrides,
  }
}

function catalog(voices = [entry()], defaultVoiceRef = 'academy.tts.synthetic') {
  return createTtsVoiceCatalog({ catalogVersion: 'test-v1', defaultVoiceRef, voices })
}

function access() {
  return {
    requireEntitlement: vi.fn(async () => ({
      householdRef: 'household-1', householdAttribution: 'resolved',
    })),
    consumeUsage: vi.fn(async () => undefined),
    recordProviderUsage: vi.fn(async () => undefined),
  }
}

function authFetch() {
  return vi.fn(async (url) => {
    if (url === 'https://academy.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000701' }), { status: 200 })
    }
    return new Response(new Uint8Array([1]), {
      status: 200, headers: { 'content-type': 'audio/mpeg' },
    })
  })
}

function synthEvent(body = {
  text: 'Synthetic request', voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1',
}) {
  return {
    httpMethod: 'POST', path: '/api/tts/synthesize',
    headers: {
      authorization: 'Bearer header.payload.signature',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}

function catalogEvent() {
  return {
    httpMethod: 'GET', path: '/api/tts/catalog',
    headers: { authorization: 'Bearer header.payload.signature' },
  }
}

describe('server-owned TTS catalog contract', () => {
  it('ships with zero active production voices and an immutable null default', () => {
    expect(TTS_VOICE_CATALOG.defaultVoiceRef).toBeNull()
    expect(TTS_VOICE_CATALOG.voices).toEqual([])
    expect(Object.isFrozen(TTS_VOICE_CATALOG)).toBe(true)
    expect(Object.isFrozen(TTS_VOICE_CATALOG.voices)).toBe(true)
  })

  it('rejects duplicate refs and invalid defaults', () => {
    expect(() => catalog([entry(), entry({ providerVoiceId: 'second-sentinel' })]))
      .toThrow(/duplicate/)
    expect(() => catalog([entry({ status: 'disabled' })]))
      .toThrow(/default.*active and approved/)
    expect(() => catalog([entry()], 'academy.tts.missing')).toThrow(/default/)
  })

  it('projects active, disabled, legacy, and revoked entries without private mapping data', () => {
    const privateCatalog = catalog([
      entry(),
      entry({ voiceRef: 'academy.tts.disabled', providerVoiceId: 'disabled-private', status: 'disabled' }),
      entry({ voiceRef: 'academy.tts.legacy', providerVoiceId: 'legacy-private', status: 'legacy' }),
      entry({ voiceRef: 'academy.tts.revoked', providerVoiceId: 'revoked-private', status: 'revoked' }),
    ])
    const projected = projectPublicTtsCatalog(privateCatalog, ENV, true)
    expect(projected.synthesisEnabled).toBe(true)
    expect(projected.voices.map((voice) => voice.status)).toEqual([
      'active', 'disabled', 'legacy', 'revoked',
    ])
    const serialized = JSON.stringify(projected)
    for (const secret of [PROVIDER_SENTINEL, 'disabled-private', 'legacy-private', 'revoked-private']) {
      expect(serialized).not.toContain(secret)
    }
    expect(serialized).not.toContain('adminApproved')
  })

  it('serves only the authenticated sanitized catalog projection', async () => {
    const result = await createTtsHandler({
      env: ENV, catalog: catalog(), fetchImpl: authFetch(), gatewayAccess: access(),
    })(catalogEvent())
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body).toMatchObject({
      catalogVersion: 'test-v1', synthesisEnabled: true,
      defaultVoiceRef: 'academy.tts.synthetic',
    })
    expect(body.voices[0]).toEqual({
      voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1',
      displayLabel: 'Synthetic voice', providerClass: 'premium', status: 'active',
      deploymentAvailable: true, cachedPlaybackAllowed: true,
    })
    expect(result.body).not.toContain(PROVIDER_SENTINEL)
  })

  it('reports provider synthesis disabled without revoking safe cached playback', async () => {
    const result = await createTtsHandler({
      env: ENV,
      catalog: catalog(),
      fetchImpl: authFetch(),
      gatewayAccess: access(),
      effectiveConfigurationReader: { read: vi.fn(async () => ({
        status: 'available', runtime: { ttsEnabled: false },
      })) },
    })(catalogEvent())
    const body = JSON.parse(result.body)
    expect(body.synthesisEnabled).toBe(false)
    expect(body.voices[0]).toMatchObject({
      voiceRef: 'academy.tts.synthetic',
      deploymentAvailable: true,
      cachedPlaybackAllowed: true,
    })
    expect(result.body).not.toContain(PROVIDER_SENTINEL)
  })

  it.each([
    ['unknown voice', 'unknown_voice_ref', [entry()], { voiceRef: 'academy.tts.unknown', voiceVersion: 'v1' }, ENV],
    ['stale voice', 'stale_voice_ref', [entry()], { voiceRef: 'academy.tts.synthetic', voiceVersion: 'old' }, ENV],
    ['zero deployable disabled voices', 'gateway_disabled', [entry({ status: 'disabled' })], { voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' }, ENV],
    ['zero deployable legacy voices', 'gateway_disabled', [entry({ status: 'legacy' })], { voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' }, ENV],
    ['zero deployable unapproved voices', 'gateway_disabled', [entry({ adminApproved: false })], { voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' }, ENV],
    ['zero deployment-allowed voices', 'gateway_disabled', [entry()], { voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' }, { ...ENV, ELEVENLABS_ALLOWED_VOICE_IDS: 'different' }],
    ['unconfigured premium provider', 'gateway_disabled', [entry()], { voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' }, { ...ENV, ELEVENLABS_API_KEY: '' }],
  ])('returns the safe %s result before consuming quota', async (_scenario, code, voices, selection, env) => {
    const gatewayAccess = access()
    const result = await createTtsHandler({
      env,
      catalog: catalog(voices, voices[0]?.status === 'active' && voices[0]?.adminApproved
        ? 'academy.tts.synthetic' : null),
      fetchImpl: authFetch(),
      gatewayAccess,
    })(synthEvent({ text: 'Synthetic request', ...selection }))
    expect(JSON.parse(result.body)).toEqual({ error: { code } })
    expect(gatewayAccess.consumeUsage).not.toHaveBeenCalled()
    expect(gatewayAccess.recordProviderUsage).not.toHaveBeenCalled()
  })

  it.each([
    ['voiceId', 'browser-supplied-provider-id'],
    ['provider', 'elevenlabs'],
    ['model_id', 'provider-model'],
    ['url', 'https://provider.invalid'],
    ['output_format', 'pcm'],
    ['voice_settings', { stability: 1 }],
    ['unknown', true],
  ])('rejects browser authority field %s', async (field, value) => {
    const gatewayAccess = access()
    const result = await createTtsHandler({
      env: ENV, catalog: catalog(), fetchImpl: authFetch(), gatewayAccess,
    })(synthEvent({
      text: 'Synthetic request', voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1',
      [field]: value,
    }))
    expect(result.statusCode).toBe(400)
    expect(gatewayAccess.consumeUsage).not.toHaveBeenCalled()
  })
})
