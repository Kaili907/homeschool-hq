import { afterEach, describe, expect, it, vi } from 'vitest'
import { TTS_REQUEST_LIMIT_BYTES, TTS_TEXT_LIMIT } from '../../netlify/functions/_shared/tts-policy.js'
import { GatewayError } from '../../netlify/functions/_shared/http.js'
import { createTtsVoiceCatalog } from '../../netlify/functions/_shared/tts-catalog.js'
import { createTtsHandler as createBaseTtsHandler } from '../../netlify/functions/tts.js'
import { savedRuntimeConfigurationProjection } from './admin-runtime-configuration-fixture.js'

const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  ELEVENLABS_API_KEY: 'elevenlabs-provider-secret',
  ELEVENLABS_ALLOWED_VOICE_IDS: 'synthetic-provider-voice-secret',
  ACADEMY_TTS_ENABLED: 'enabled',
  ACADEMY_APP_VERSION: 'academy-test-build',
})

const TEST_CATALOG = createTtsVoiceCatalog({
  catalogVersion: 'test-v1',
  defaultVoiceRef: 'academy.tts.synthetic',
  voices: [{
    voiceRef: 'academy.tts.synthetic',
    displayLabel: 'Synthetic test voice',
    providerClass: 'premium',
    provider: 'elevenlabs',
    providerVoiceId: 'synthetic-provider-voice-secret',
    voiceVersion: 'v1',
    status: 'active',
    cachedPlayback: 'allow',
    adminApproved: true,
  }],
})

function testAccess({
  memberships = [
    {
      id: 'active-membership',
      user_id: 'household-user',
      status: 'active',
      revoked_at: null,
      household_id: 'household-1',
    },
  ],
} = {}) {
  return {
    requireEntitlement: vi.fn(async (userId) => {
      const membership = memberships.find(
        (row) => row.user_id === userId && row.status === 'active' && row.revoked_at === null,
      )
      if (!membership) throw new GatewayError(403, 'not_entitled')
      return { householdRef: membership.household_id, householdAttribution: 'resolved' }
    }),
    consumeUsage: vi.fn(async () => undefined),
    recordProviderUsage: vi.fn(async () => undefined),
  }
}

function createTtsHandler(overrides = {}) {
  const runtimeConfigurationSource = overrides.runtimeConfigurationSource ?? {
    read: vi.fn(async () => savedRuntimeConfigurationProjection()),
  }
  return createBaseTtsHandler({
    gatewayAccess: testAccess(), catalog: TEST_CATALOG, runtimeConfigurationSource, ...overrides,
  })
}

function runtimeResolver(overrides = {}) {
  return {
    resolve: vi.fn(async () => ({
      values: {
        aiEnabled: false, ttsEnabled: true,
        aiDailyLimit: 50, ttsDailyLimit: 100,
        approvedTiers: ['sonnet', 'haiku'], defaultTier: 'sonnet',
        ...overrides,
      },
    })),
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function event(body = { text: 'Let us work through one small step.', voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' }, overrides = {}) {
  return {
    httpMethod: 'POST',
    path: '/api/tts/synthesize',
    headers: {
      authorization: 'Bearer header.payload.signature',
      'content-type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...overrides,
  }
}

function responseJson(result) {
  return JSON.parse(result.body)
}

function installFakeAbortTimeout() {
  vi.useFakeTimers()
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('timed out', 'TimeoutError')), milliseconds)
    return controller.signal
  })
}

function fetchRouter({
  authStatus = 200,
  authBody = { id: 'household-user' },
  providerStatus = 200,
  audio = new Uint8Array([1, 2, 3, 4]),
  providerError = { detail: 'elevenlabs-provider-secret' },
} = {}) {
  return vi.fn(async (url) => {
    if (url === 'https://academy.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify(authBody), {
        status: authStatus,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url === 'https://api.elevenlabs.io/v1/text-to-speech/synthetic-provider-voice-secret?output_format=mp3_44100_128') {
      return providerStatus >= 200 && providerStatus < 300
        ? new Response(audio, {
            status: providerStatus,
            headers: { 'content-type': 'audio/mpeg' },
          })
        : new Response(JSON.stringify(providerError), {
            status: providerStatus,
            headers: { 'content-type': 'application/json' },
          })
    }
    throw new Error(`unexpected URL: ${url}`)
  })
}

describe('authenticated TTS gateway', () => {
  it('rejects unsupported methods before any external call', async () => {
    const fetchImpl = fetchRouter()
    const result = await createTtsHandler({ fetchImpl, env: ENV })(event(undefined, { httpMethod: 'GET' }))
    expect(result.statusCode).toBe(405)
    expect(result.headers.allow).toBe('POST')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('makes arbitrary provider paths and query forwarding impossible', async () => {
    const fetchImpl = fetchRouter()
    const handler = createTtsHandler({ fetchImpl, env: ENV })
    expect((await handler(event(undefined, { path: '/api/tts/v1/voices' }))).statusCode).toBe(404)
    expect(
      (
        await handler(
          event(undefined, {
            path: '/api/tts/synthesize',
            rawQuery: 'output_format=pcm_44100',
          }),
        )
      ).statusCode,
    ).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects missing, malformed, and invalid bearer tokens', async () => {
    const handler = createTtsHandler({ fetchImpl: fetchRouter(), env: ENV })
    const missing = event()
    delete missing.headers.authorization
    expect((await handler(missing)).statusCode).toBe(401)
    const malformed = event()
    malformed.headers.authorization = 'Basic abc'
    expect((await handler(malformed)).statusCode).toBe(401)

    const rejectedFetch = fetchRouter({
      authStatus: 401,
      authBody: { error: 'expired' },
    })
    const rejected = await createTtsHandler({
      fetchImpl: rejectedFetch,
      env: ENV,
    })(event())
    expect(rejected.statusCode).toBe(401)
    expect(rejected.body).not.toContain('expired')
    expect(rejectedFetch).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed JSON, unsupported content types, and oversized bodies', async () => {
    const handler = createTtsHandler({ fetchImpl: fetchRouter(), env: ENV })
    expect((await handler(event('{bad json'))).statusCode).toBe(400)
    const unsupported = event()
    unsupported.headers['content-type'] = 'text/plain'
    expect((await handler(unsupported)).statusCode).toBe(415)
    const oversized = JSON.stringify({
      padding: 'x'.repeat(TTS_REQUEST_LIMIT_BYTES),
    })
    expect((await handler(event(oversized))).statusCode).toBe(413)
  })

  it.each([
    ['model_id', 'arbitrary-model'],
    ['voice_settings', { stability: 1 }],
    ['output_format', 'pcm_44100'],
    ['path', '/v1/voices'],
    ['url', 'https://api.elevenlabs.io/v1/voices'],
    ['seed', 123],
    ['effectiveValue', true],
    ['enforcement', 'enforced'],
  ])('rejects arbitrary provider setting %s', async (field, value) => {
    const fetchImpl = fetchRouter()
    const result = await createTtsHandler({ fetchImpl, env: ENV })(
      event({ text: 'hello', voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1', [field]: value }),
    )
    expect(result.statusCode).toBe(400)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('rejects unknown logical refs and excessive text', async () => {
    const handler = createTtsHandler({ fetchImpl: fetchRouter(), env: ENV })
    const unsupported = await handler(event({ text: 'hello', voiceRef: 'academy.tts.unknown', voiceVersion: 'v1' }))
    expect(unsupported.statusCode).toBe(400)
    expect(responseJson(unsupported)).toEqual({
      error: { code: 'unknown_voice_ref' },
    })
    expect(
      (
        await handler(
          event({
            text: 'x'.repeat(TTS_TEXT_LIMIT + 1),
            voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1',
          }),
        )
      ).statusCode,
    ).toBe(400)
  })

  it('fails closed when the resolved voice is absent from the deployment allowlist', async () => {
    const { ELEVENLABS_ALLOWED_VOICE_IDS: _removed, ...withoutAllowlist } = ENV
    const result = await createTtsHandler({
      fetchImpl: fetchRouter(),
      env: withoutAllowlist,
    })(event())
    expect(result.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({
      error: { code: 'gateway_disabled' },
    })
  })

  it('reaches only fixed ElevenLabs synthesis with server settings and returns safe audio', async () => {
    const fetchImpl = fetchRouter()
    const result = await createTtsHandler({ fetchImpl, env: ENV })(event())
    expect(result.statusCode).toBe(200)
    expect(result.isBase64Encoded).toBe(true)
    expect(result.body).toBe(Buffer.from([1, 2, 3, 4]).toString('base64'))
    expect(result.headers).toEqual({
      'content-type': 'audio/mpeg',
      'cache-control': 'private, no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    const [url, init] = fetchImpl.mock.calls[1]
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/synthetic-provider-voice-secret?output_format=mp3_44100_128')
    expect(init.headers.Authorization).toBeUndefined()
    expect(init.headers['xi-api-key']).toBe('elevenlabs-provider-secret')
    expect(init.redirect).toBe('error')
    expect(JSON.parse(init.body)).toEqual({
      text: 'Let us work through one small step.',
      model_id: 'eleven_turbo_v2_5',
    })
  })

  it('sanitizes provider failures without exposing secrets', async () => {
    const fetchImpl = fetchRouter({ providerStatus: 500 })
    const result = await createTtsHandler({ fetchImpl, env: ENV })(event())
    expect(result.statusCode).toBe(502)
    expect(responseJson(result)).toEqual({
      error: { code: 'provider_failure' },
    })
    expect(result.body).not.toContain('elevenlabs-provider-secret')
  })

  it('rejects non-audio provider responses and maps throttling safely', async () => {
    const wrongTypeFetch = vi.fn(async (url) => {
      if (url === 'https://academy.supabase.co/auth/v1/user') {
        return new Response(JSON.stringify({ id: 'household-user' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('not audio', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      })
    })
    const wrongType = await createTtsHandler({
      fetchImpl: wrongTypeFetch,
      env: ENV,
    })(event())
    expect(wrongType.statusCode).toBe(502)

    const throttled = await createTtsHandler({
      fetchImpl: fetchRouter({ providerStatus: 429 }),
      env: ENV,
    })(event())
    expect(throttled.statusCode).toBe(429)
    expect(responseJson(throttled)).toEqual({ error: { code: 'usage_limit' } })
  })

  it.each(['1', 'true', 'TRUE', 'on', 'enabled', 'ENABLED'])(
    'enables only an explicit allow value: %s',
    async (value) => {
      const result = await createTtsHandler({
        fetchImpl: fetchRouter(),
        env: { ...ENV, ACADEMY_TTS_ENABLED: value },
      })(event())
      expect(result.statusCode).toBe(200)
    },
  )

  it.each([undefined, '', '0', 'false', 'off', 'disabled', 'yes', ' true '])(
    'fails closed for an unset or non-allow flag: %s',
    async (value) => {
      const env = { ...ENV }
      if (value === undefined) delete env.ACADEMY_TTS_ENABLED
      else env.ACADEMY_TTS_ENABLED = value
      const fetchImpl = fetchRouter()
      const result = await createTtsHandler({ fetchImpl, env })(event())
      expect(result.statusCode).toBe(503)
      expect(responseJson(result)).toEqual({ error: { code: 'gateway_disabled' } })
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    },
  )

  it('rejects a valid token without an active household membership', async () => {
    const access = testAccess({ memberships: [] })
    const fetchImpl = fetchRouter()
    const result = await createTtsHandler({ fetchImpl, env: ENV, gatewayAccess: access })(event())
    expect(result.statusCode).toBe(403)
    expect(responseJson(result)).toEqual({ error: { code: 'not_entitled' } })
    expect(access.consumeUsage).not.toHaveBeenCalled()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('rejects a valid token backed by a revoked membership before calling ElevenLabs', async () => {
    const access = testAccess({
      memberships: [
        {
          id: 'revoked-membership',
          user_id: 'household-user',
          status: 'revoked',
          revoked_at: '2026-07-31T18:00:00.000Z',
        },
      ],
    })
    const fetchImpl = fetchRouter()
    const result = await createTtsHandler({ fetchImpl, env: ENV, gatewayAccess: access })(event())
    expect(result.statusCode).toBe(403)
    expect(responseJson(result)).toEqual({ error: { code: 'not_entitled' } })
    expect(access.consumeUsage).not.toHaveBeenCalled()
    expect(
      fetchImpl.mock.calls.filter(([url]) =>
        url.startsWith('https://api.elevenlabs.io/v1/text-to-speech/'),
      ),
    ).toHaveLength(0)
  })

  it('accepts an active membership and reserves the configured per-user usage', async () => {
    const access = testAccess()
    const result = await createTtsHandler({
      fetchImpl: fetchRouter(),
      env: { ...ENV, ACADEMY_TTS_DAILY_LIMIT: '125' },
      gatewayAccess: access,
    })(event())
    expect(result.statusCode).toBe(200)
    expect(access.requireEntitlement).toHaveBeenCalledWith('household-user')
    expect(access.consumeUsage).toHaveBeenCalledWith('household-user', 'tts', 125)
  })

  it('uses only the trusted resolved gate and exact effective daily quota', async () => {
    const access = testAccess()
    const disabled = await createTtsHandler({
      fetchImpl: fetchRouter(), env: ENV, gatewayAccess: access,
      runtimeConfigurationResolver: runtimeResolver({ ttsEnabled: false, ttsDailyLimit: 19 }),
    })(event())
    expect(disabled.statusCode).toBe(503)
    expect(access.requireEntitlement).not.toHaveBeenCalled()

    const enabled = await createTtsHandler({
      fetchImpl: fetchRouter(), env: ENV, gatewayAccess: access,
      runtimeConfigurationResolver: runtimeResolver({ ttsDailyLimit: 19 }),
    })(event())
    expect(enabled.statusCode).toBe(200)
    expect(access.consumeUsage).toHaveBeenCalledWith('household-user', 'tts', 19)
  })

  it('fails closed when the trusted resolver itself throws', async () => {
    const access = testAccess()
    const result = await createTtsHandler({
      fetchImpl: fetchRouter(), env: ENV, gatewayAccess: access,
      runtimeConfigurationResolver: { resolve: vi.fn(async () => { throw new Error('SECRET') }) },
    })(event())
    expect(result.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'gateway_disabled' } })
    expect(result.body).not.toContain('SECRET')
    expect(access.requireEntitlement).not.toHaveBeenCalled()
  })

  it('returns usage_limit before the provider call when the ledger is at cap', async () => {
    const access = testAccess()
    access.consumeUsage.mockRejectedValue(new GatewayError(429, 'usage_limit'))
    const fetchImpl = fetchRouter()
    const result = await createTtsHandler({ fetchImpl, env: ENV, gatewayAccess: access })(event())
    expect(result.statusCode).toBe(429)
    expect(responseJson(result)).toEqual({ error: { code: 'usage_limit' } })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('times out Supabase auth verification after five seconds with fake timers', async () => {
    installFakeAbortTimeout()
    const fetchImpl = vi.fn((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
      }),
    )
    const pending = createTtsHandler({ fetchImpl, env: ENV })(event())
    await vi.advanceTimersByTimeAsync(5_000)
    const result = await pending
    expect(result.statusCode).toBe(504)
    expect(responseJson(result)).toEqual({ error: { code: 'upstream_timeout' } })
  })

  it('times out TTS after thirty seconds with fake timers', async () => {
    installFakeAbortTimeout()
    const access = testAccess()
    const fetchImpl = vi.fn(async (url, init) => {
      if (url === 'https://academy.supabase.co/auth/v1/user') {
        return new Response(JSON.stringify({ id: 'household-user' }), { status: 200 })
      }
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
      })
    })
    const pending = createTtsHandler({ fetchImpl, env: ENV, gatewayAccess: access })(event())
    await vi.advanceTimersByTimeAsync(30_000)
    const result = await pending
    expect(result.statusCode).toBe(504)
    expect(responseJson(result)).toEqual({ error: { code: 'upstream_timeout' } })
    expect(access.recordProviderUsage).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'timeout', resultReasonCode: 'upstream_timeout', billingDisposition: 'unknown' }),
    )
  })

  it('rejects declared and streamed TTS responses above 4 MiB', async () => {
    const declaredFetch = vi.fn(async (url) => {
      if (url === 'https://academy.supabase.co/auth/v1/user') {
        return new Response(JSON.stringify({ id: 'household-user' }), { status: 200 })
      }
      return new Response(new Uint8Array([1]), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'content-length': String(4 * 1024 * 1024 + 1) },
      })
    })
    const declared = await createTtsHandler({ fetchImpl: declaredFetch, env: ENV })(event())
    expect(responseJson(declared)).toEqual({ error: { code: 'upstream_too_large' } })

    const streamedFetch = vi.fn(async (url) => {
      if (url === 'https://academy.supabase.co/auth/v1/user') {
        return new Response(JSON.stringify({ id: 'household-user' }), { status: 200 })
      }
      return new Response(new Uint8Array(4 * 1024 * 1024 + 1), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      })
    })
    const streamed = await createTtsHandler({ fetchImpl: streamedFetch, env: ENV })(event())
    expect(responseJson(streamed)).toEqual({ error: { code: 'upstream_too_large' } })
  })

  it('persists exact submitted characters and approved voice without storing text or audio', async () => {
    const access = testAccess()
    const request = { text: 'Count 🚀 exactly.', voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' }
    const result = await createTtsHandler({
      fetchImpl: fetchRouter(),
      env: ENV,
      gatewayAccess: access,
      requestIdFactory: () => 'tts-ledger-test',
    })(event(request))

    expect(result.statusCode).toBe(200)
    expect(access.recordProviderUsage).toHaveBeenCalledWith({
      requestKey: 'tts-ledger-test',
      occurredAt: expect.any(String),
      accountRef: 'household-user',
      householdRef: 'household-1',
      householdAttribution: 'resolved',
      appVersion: 'academy-test-build',
      engineVersion: null,
      curriculumVersion: null,
      engine: 'tts',
      provider: 'elevenlabs',
      providerProductId: 'eleven_turbo_v2_5',
      providerModelId: 'eleven_turbo_v2_5',
      logicalModelTier: null,
      inputTokens: null,
      outputTokens: null,
      cachedInputReadTokens: null,
      cachedInputWriteTokens: null,
      ttsCharacters: Array.from(request.text).length,
      latencyMs: expect.any(Number),
      result: 'success',
      resultReasonCode: null,
      billingDisposition: 'billable',
    })
    const persisted = access.recordProviderUsage.mock.calls[0][0]
    expect(JSON.stringify(persisted)).not.toContain(request.text)
    expect(JSON.stringify(persisted)).not.toContain(result.body)
  })

  it('records throttling and provider failures as billing-unknown', async () => {
    const throttledAccess = testAccess()
    await createTtsHandler({
      fetchImpl: fetchRouter({ providerStatus: 429 }),
      env: ENV,
      gatewayAccess: throttledAccess,
    })(event())
    expect(throttledAccess.recordProviderUsage).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'rejected', resultReasonCode: 'provider_throttled', billingDisposition: 'unknown' }),
    )

    const failedAccess = testAccess()
    await createTtsHandler({
      fetchImpl: fetchRouter({ providerStatus: 500 }),
      env: ENV,
      gatewayAccess: failedAccess,
    })(event())
    expect(failedAccess.recordProviderUsage).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'provider_error', resultReasonCode: 'provider_rejected', billingDisposition: 'unknown' }),
    )
  })
})
