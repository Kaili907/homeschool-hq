import { describe, expect, it, vi } from 'vitest'
import { askTutor, type FetchLike as JsonFetch } from './tutor/tutorApi'
import {
  VoiceGatewayError,
  createElevenLabsSynth,
  createMemoryCache,
  type FetchLike as BinFetch,
  type UsageMeter,
} from './tutor/voice'

const meter = (): UsageMeter => ({
  chars: () => 0,
  cap: () => 90_000,
  month: () => '2026-07',
  add: () => {},
  setCap: () => {},
  overCap: () => false,
})

const tutorRequest = {
  messages: [{ role: 'user' as const, content: 'help' }],
  gateway: {
    mode: 'tutor' as const,
    context: {
      grade: '3' as const,
      problem: '2 + 2 = ?',
      correctAnswer: '4',
      studentAnswer: '5',
      graded: false,
    },
  },
}

describe('secured Anthropic gateway client', () => {
  const okJson = (text: string): JsonFetch =>
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text }) }))

  it('sends bearer auth and the exact Tutor schema without provider-native controls', async () => {
    const spy = okJson('a hint')
    const result = await askTutor(
      {
        getAccessToken: async () => 'SUPABASE_ACCESS_TOKEN',
        fetchImpl: spy,
        isOnline: () => true,
      },
      tutorRequest,
    )
    expect(result).toEqual({ ok: true, text: 'a hint' })

    const [url, init] = (
      spy as unknown as {
        mock: { calls: [string, { headers: Record<string, string>; body: string }][] }
      }
    ).mock.calls[0]
    expect(url).toBe('/api/anthropic/v1/messages')
    expect(init.headers).toEqual({
      Authorization: 'Bearer SUPABASE_ACCESS_TOKEN',
      'content-type': 'application/json',
    })
    expect(JSON.parse(init.body)).toEqual({
      mode: 'tutor',
      modelTier: 'sonnet',
      context: tutorRequest.gateway.context,
      messages: tutorRequest.messages,
    })
  })

  it('fails closed without a Supabase token and never calls the gateway', async () => {
    const spy = okJson('unused')
    const result = await askTutor(
      { getAccessToken: async () => null, fetchImpl: spy, isOnline: () => true },
      tutorRequest,
    )
    expect(result).toEqual({ ok: false, reason: 'unauthenticated' })
    expect(spy).not.toHaveBeenCalled()
  })

  it.each(['unauthenticated', 'not_entitled', 'usage_limit', 'gateway_disabled'] as const)(
    'surfaces the stable %s gateway error category',
    async (code) => {
      const fetchImpl: JsonFetch = async () => ({
        ok: false,
        status: code === 'usage_limit' ? 429 : 403,
        json: async () => ({ error: { code } }),
      })
      await expect(
        askTutor(
          { getAccessToken: async () => 'token', fetchImpl, isOnline: () => true },
          tutorRequest,
        ),
      ).resolves.toEqual({ ok: false, reason: code })
    },
  )
})

describe('secured TTS gateway client', () => {
  const okBin = (): BinFetch =>
    vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }))

  it('uses one fixed operation with bearer auth and no provider settings', async () => {
    const spy = okBin()
    const synth = createElevenLabsSynth({
      getAccessToken: async () => 'SUPABASE_ACCESS_TOKEN',
      fetchImpl: spy,
      isOnline: () => true,
      usage: meter(),
    })
    expect(synth.available()).toBe(true)
    await synth.synthesize({ text: 'hello', voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' })

    const [url, init] = (
      spy as unknown as {
        mock: { calls: [string, { headers: Record<string, string>; body: string }][] }
      }
    ).mock.calls[0]
    expect(url).toBe('/api/tts/synthesize')
    expect(init.headers).toEqual({
      Authorization: 'Bearer SUPABASE_ACCESS_TOKEN',
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    })
    expect(JSON.parse(init.body)).toEqual({ text: 'hello', voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' })
  })

  it('fails closed without a Supabase token and never calls the gateway', async () => {
    const spy = okBin()
    const synth = createElevenLabsSynth({
      getAccessToken: async () => null,
      fetchImpl: spy,
      isOnline: () => true,
      usage: meter(),
    })
    await expect(synth.synthesize({ text: 'hello', voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' })).rejects.toMatchObject({
      code: 'unauthenticated',
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it.each(['not_entitled', 'usage_limit', 'gateway_disabled'] as const)(
    'surfaces the stable %s gateway error category',
    async (code) => {
      const synth = createElevenLabsSynth({
        getAccessToken: async () => 'token',
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          arrayBuffer: async () => new ArrayBuffer(0),
          json: async () => ({ error: { code } }),
        }),
        isOnline: () => true,
        usage: meter(),
      })
      await expect(synth.synthesize({ text: 'hello', voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1' })).rejects.toEqual(
        new VoiceGatewayError(code),
      )
    },
  )

  it('keeps the memory audio cache available behind the gateway', async () => {
    const cache = createMemoryCache()
    await cache.put('k', new Blob(['x']))
    expect(await cache.get('k')).toBeDefined()
  })
})
