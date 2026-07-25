import { describe, expect, it, vi } from 'vitest'
import { TTS_REQUEST_LIMIT_BYTES, TTS_TEXT_LIMIT } from '../../netlify/functions/_shared/tts-policy.js'
import { createTtsHandler } from '../../netlify/functions/tts.js'

const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  ELEVENLABS_API_KEY: 'elevenlabs-provider-secret',
  ELEVENLABS_ALLOWED_VOICE_IDS: 'voice-1,voice_2',
})

function event(body = { text: 'Let us work through one small step.', voiceId: 'voice-1' }, overrides = {}) {
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
    if (url === 'https://api.elevenlabs.io/v1/text-to-speech/voice-1?output_format=mp3_44100_128') {
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
  ])('rejects arbitrary provider setting %s', async (field, value) => {
    const fetchImpl = fetchRouter()
    const result = await createTtsHandler({ fetchImpl, env: ENV })(
      event({ text: 'hello', voiceId: 'voice-1', [field]: value }),
    )
    expect(result.statusCode).toBe(400)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('rejects unsupported voices and excessive text', async () => {
    const handler = createTtsHandler({ fetchImpl: fetchRouter(), env: ENV })
    const unsupported = await handler(event({ text: 'hello', voiceId: 'not-approved' }))
    expect(unsupported.statusCode).toBe(400)
    expect(responseJson(unsupported)).toEqual({
      error: { code: 'unsupported_voice' },
    })
    expect(
      (
        await handler(
          event({
            text: 'x'.repeat(TTS_TEXT_LIMIT + 1),
            voiceId: 'voice-1',
          }),
        )
      ).statusCode,
    ).toBe(400)
  })

  it('fails closed when no server voice allowlist is configured', async () => {
    const { ELEVENLABS_ALLOWED_VOICE_IDS: _removed, ...withoutAllowlist } = ENV
    const result = await createTtsHandler({
      fetchImpl: fetchRouter(),
      env: withoutAllowlist,
    })(event())
    expect(result.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({
      error: { code: 'service_unavailable' },
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
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-1?output_format=mp3_44100_128')
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
})
