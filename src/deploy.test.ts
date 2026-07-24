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

describe('D1 Anthropic proxy mode', () => {
  const okJson = (text: string): JsonFetch =>
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }] }) }))

  it('with no local key, routes to the proxy and sends NO key / dangerous header', async () => {
    const spy = okJson('a hint')
    const res = await askTutor(
      { getKey: () => null, fetchImpl: spy, isOnline: () => true, endpointBase: '/api/anthropic' },
      { system: 's', messages: [{ role: 'user', content: 'help' }] },
    )
    expect(res).toEqual({ ok: true, text: 'a hint' }) // NOT no-key — the proxy holds the key
    const [url, init] = (spy as unknown as { mock: { calls: [string, { headers: Record<string, string> }][] } }).mock.calls[0]
    expect(url).toBe('/api/anthropic/v1/messages')
    expect(init.headers['x-api-key']).toBeUndefined()
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBeUndefined()
    expect(init.headers['content-type']).toBe('application/json')
  })

  it('direct mode still requires the family key (regression)', async () => {
    const res = await askTutor(
      { getKey: () => null, fetchImpl: okJson('x'), isOnline: () => true, endpointBase: '' },
      { system: 's', messages: [] },
    )
    expect(res).toEqual({ ok: false, reason: 'no-key' })
  })
})

describe('D1 ElevenLabs proxy mode', () => {
  const okBin = (): BinFetch =>
    vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }))

  it('is available without a local key and routes to the proxy without xi-api-key', async () => {
    const spy = okBin()
    const synth = createElevenLabsSynth({
      getKey: () => null,
      fetchImpl: spy,
      isOnline: () => true,
      usage: meter(),
      endpointBase: '/api/tts',
    })
    expect(synth.available()).toBe(true) // proxy holds the key
    await synth.synthesize({ text: 'hello', voiceId: 'abc' })
    const [url, init] = (spy as unknown as { mock: { calls: [string, { headers: Record<string, string> }][] } }).mock.calls[0]
    expect(url).toContain('/api/tts/v1/text-to-speech/abc')
    expect(init.headers['xi-api-key']).toBeUndefined()
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
