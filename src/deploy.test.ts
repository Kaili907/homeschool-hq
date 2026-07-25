import { describe, expect, it, vi } from 'vitest'
import { askTutor, type FetchLike as JsonFetch } from './tutor/tutorApi'
import {
  createElevenLabsSynth,
  createMemoryCache,
  type FetchLike as BinFetch,
  type UsageMeter,
} from './tutor/voice'

// ---------------------------------------------------------------------------
// D1 deploy: proxy mode drops the client key + browser headers; the serverless
// function injects the key server-side. Direct mode is unchanged.
// ---------------------------------------------------------------------------

const meter = (): UsageMeter => ({
  chars: () => 0,
  cap: () => 90000,
  month: () => '2026-07',
  add: () => {},
  setCap: () => {},
  overCap: () => false,
})

describe('secured Anthropic proxy client', () => {
  const okJson = (text: string): JsonFetch =>
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text }) }))

  it('sends bearer auth and the exact Tutor schema without provider-native controls', async () => {
    const spy = okJson('a hint')
    const result = await askTutor(
      {
        getKey: () => null,
        getAccessToken: async () => 'SUPABASE_ACCESS_TOKEN',
        fetchImpl: spy,
        isOnline: () => true,
        endpointBase: '/api/anthropic',
      },
      {
        system: 'client system must never reach the gateway',
        messages: [{ role: 'user', content: 'help' }],
        gateway: {
          mode: 'tutor',
          context: {
            grade: '3',
            problem: '2 + 2 = ?',
            correctAnswer: '4',
            studentAnswer: '5',
            graded: false,
          },
        },
      },
    )
    expect(result).toEqual({ ok: true, text: 'a hint' })

    const [url, init] = (
      spy as unknown as {
        mock: {
          calls: [string, { headers: Record<string, string>; body: string }][]
        }
      }
    ).mock.calls[0]
    expect(url).toBe('/api/anthropic/v1/messages')
    expect(init.headers).toEqual({
      Authorization: 'Bearer SUPABASE_ACCESS_TOKEN',
      'content-type': 'application/json',
    })
    const body = JSON.parse(init.body)
    expect(body).toEqual({
      mode: 'tutor',
      modelTier: 'sonnet',
      context: {
        grade: '3',
        problem: '2 + 2 = ?',
        correctAnswer: '4',
        studentAnswer: '5',
        graded: false,
      },
      messages: [{ role: 'user', content: 'help' }],
    })
    expect(body.system).toBeUndefined()
    expect(body.model).toBeUndefined()
    expect(body.max_tokens).toBeUndefined()
    expect(body.tools).toBeUndefined()
  })

  it('fails closed without a Supabase token and never calls the gateway', async () => {
    const spy = okJson('unused')
    const result = await askTutor(
      {
        getKey: () => null,
        getAccessToken: async () => null,
        fetchImpl: spy,
        isOnline: () => true,
        endpointBase: '/api/anthropic',
      },
      {
        system: 'unused',
        messages: [{ role: 'user', content: 'help' }],
        gateway: {
          mode: 'tutor',
          context: {
            grade: '3',
            problem: 'p',
            correctAnswer: '1',
            studentAnswer: '2',
            graded: false,
          },
        },
      },
    )
    expect(result).toEqual({ ok: false, reason: 'unauthenticated' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('direct mode still requires the family key (regression)', async () => {
    const res = await askTutor(
      { getKey: () => null, fetchImpl: okJson('x'), isOnline: () => true, endpointBase: '' },
      { system: 's', messages: [] },
    )
    expect(res).toEqual({ ok: false, reason: 'no-key' })
  })
})

describe('secured TTS proxy client', () => {
  const okBin = (): BinFetch =>
    vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }))

  it('uses one fixed operation with bearer auth and no provider settings', async () => {
    const spy = okBin()
    const synth = createElevenLabsSynth({
      getKey: () => null,
      getAccessToken: async () => 'SUPABASE_ACCESS_TOKEN',
      fetchImpl: spy,
      isOnline: () => true,
      usage: meter(),
      endpointBase: '/api/tts',
    })
    expect(synth.available()).toBe(true) // proxy holds the key
    await synth.synthesize({ text: 'hello', voiceId: 'abc' })

    const [url, init] = (
      spy as unknown as {
        mock: {
          calls: [string, { headers: Record<string, string>; body: string }][]
        }
      }
    ).mock.calls[0]
    expect(url).toBe('/api/tts/synthesize')
    expect(init.headers).toEqual({
      Authorization: 'Bearer SUPABASE_ACCESS_TOKEN',
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    })
    expect(JSON.parse(init.body)).toEqual({ text: 'hello', voiceId: 'abc' })
    expect(init.body).not.toContain('model_id')
    expect(init.body).not.toContain('output_format')
  })

  it('fails closed without a Supabase token and never calls the gateway', async () => {
    const spy = okBin()
    const synth = createElevenLabsSynth({
      getKey: () => null,
      getAccessToken: async () => null,
      fetchImpl: spy,
      isOnline: () => true,
      usage: meter(),
      endpointBase: '/api/tts',
    })
    await expect(synth.synthesize({ text: 'hello', voiceId: 'abc' })).rejects.toThrow('unauthenticated')
    expect(spy).not.toHaveBeenCalled()
  })

  it('direct mode still needs the local key', () => {
    const synth = createElevenLabsSynth({
      getKey: () => null,
      fetchImpl: okBin(),
      isOnline: () => true,
      usage: meter(),
      endpointBase: '',
    })
    expect(synth.available()).toBe(false)
  })

  it('the memory cache still works (unaffected by proxy mode)', async () => {
    const c = createMemoryCache()
    await c.put('k', new Blob(['x']))
    expect(await c.get('k')).toBeDefined()
  })
})
