import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CACHE_MAX_AGE_MS,
  __resetVoiceRuntime,
  browserPlayAudio,
  createElevenLabsSynth,
  createMemoryCache,
  createUsageMeter,
  createVoiceAdapter,
  encodeVoiceRef,
  getVoiceCache,
  parseVoiceRef,
  purgeVoiceCache,
  type BrowserTts,
  type FetchLike,
} from './voice'
import { getVoicePrefs, migrateLegacyVoiceToDefault, resolveSlotRef, setSlotRef } from './tutorState'
import { emptyProfile } from '../migration'

// A fixed-month usage meter over an in-memory string cell (no localStorage needed).
function makeUsage(cap = 1_000_000, startChars = 0) {
  let store: string | null = JSON.stringify({ month: '2026-07', chars: startChars, cap })
  return createUsageMeter({
    read: () => store,
    write: (v) => {
      store = v
    },
    now: () => new Date(2026, 6, 15), // month index 6 = July → key '2026-07'
  })
}

// A test harness: real adapter + real ElevenLabs provider over a fake fetch,
// with knobs to simulate the key, connectivity and network failures.
function harness(opts: { cap?: number; startChars?: number } = {}) {
  const state = {
    online: true,
    failNetwork: false,
    fetchCalls: 0,
  }
  const usage = makeUsage(opts.cap, opts.startChars)
  const fetchImpl: FetchLike = async () => {
    state.fetchCalls++
    if (state.failNetwork) throw new Error('network down')
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer }
  }
  const elevenLabs = createElevenLabsSynth({
    getAccessToken: async () => 'access-token',
    fetchImpl,
    isOnline: () => state.online,
    usage,
  })
  const browserSpoke: string[] = []
  const browser: BrowserTts = {
    available: () => true,
    speak: (r) => browserSpoke.push(r.text),
    cancel: () => {},
  }
  const played: number[] = []
  const adapter = createVoiceAdapter({
    cache: createMemoryCache(),
    usage,
    elevenLabs,
    browser,
    playAudio: async (b) => {
      played.push(b.size)
    },
    stopAudio: () => {},
  })
  return { state, usage, adapter, browserSpoke, played }
}

describe('MT-V ref encoding', () => {
  it('round-trips ElevenLabs and browser refs; browser refs never look premium', () => {
    expect(encodeVoiceRef({ provider: 'elevenlabs', ref: 'v1', label: 'x' })).toBe('el:v1')
    expect(encodeVoiceRef({ provider: 'browser', ref: 'urn:moz-tts:sapi:x', label: 'x' })).toBe(
      'urn:moz-tts:sapi:x',
    )
    expect(encodeVoiceRef(undefined)).toBeUndefined()
    expect(parseVoiceRef('el:v1')).toEqual({ provider: 'elevenlabs', ref: 'v1' })
    expect(parseVoiceRef('urn:moz-tts:sapi:x')).toEqual({
      provider: 'browser',
      ref: 'urn:moz-tts:sapi:x',
    })
    expect(parseVoiceRef(undefined)).toEqual({ provider: 'browser', ref: '' })
  })
})

describe('MT-V adapter chain: cache → ElevenLabs → browser (silent degradation)', () => {
  it('uses ElevenLabs with a key online, degrades to browser when the network drops, restores after', async () => {
    const h = harness()

    // valid key + online → premium
    expect(await h.adapter.speak({ text: 'one', voiceRef: 'el:v1' })).toBe('elevenlabs')
    expect(h.state.fetchCalls).toBe(1)
    expect(h.played).toHaveLength(1)

    // kill the network mid-session → next utterance is browser, no error surfaced
    h.state.online = false
    expect(await h.adapter.speak({ text: 'two', voiceRef: 'el:v1' })).toBe('browser')
    expect(h.browserSpoke).toContain('two')
    expect(h.state.fetchCalls).toBe(1) // no network call was attempted while offline

    // restore → back to ElevenLabs
    h.state.online = true
    expect(await h.adapter.speak({ text: 'three', voiceRef: 'el:v1' })).toBe(
      'elevenlabs',
    )
    expect(h.state.fetchCalls).toBe(2)
  })

  it('a mid-request fetch failure also degrades silently to browser', async () => {
    const h = harness()
    h.state.failNetwork = true
    expect(await h.adapter.speak({ text: 'boom', voiceRef: 'el:v1' })).toBe('browser')
    expect(h.browserSpoke).toContain('boom')
  })

  it('a browser-ref utterance never touches ElevenLabs', async () => {
    const h = harness()
    expect(await h.adapter.speak({ text: 'hi', voiceRef: 'urn:moz-tts:x' })).toBe(
      'browser',
    )
    expect(h.state.fetchCalls).toBe(0)
  })
})

describe('MT-V cache: same line = one API call', () => {
  it('synthesizes once, then serves the second identical line from cache', async () => {
    const h = harness()
    const req = { text: 'same line', voiceRef: 'el:v1', rate: 1 }

    expect(await h.adapter.speak(req)).toBe('elevenlabs')
    expect(await h.adapter.speak(req)).toBe('cache')

    expect(h.state.fetchCalls).toBe(1) // the whole point
    expect(h.played).toHaveLength(2) // both utterances still played
    expect(h.usage.chars()).toBe('same line'.length) // counted exactly once
  })
})

describe('MT-V usage cap flips the chain to browser-only', () => {
  it('spends ElevenLabs up to the cap, then falls back to browser for the rest of the month', async () => {
    const h = harness({ cap: 8 }) // tiny soft cap

    // first line (10 chars) is allowed (chars 0 < cap 8), and pushes usage over the cap
    expect(await h.adapter.speak({ text: 'abcdefghij', voiceRef: 'el:v1' })).toBe(
      'elevenlabs',
    )
    expect(h.usage.overCap()).toBe(true)

    // next line: cap reached → adapter no longer chooses ElevenLabs
    expect(await h.adapter.speak({ text: 'next one', voiceRef: 'el:v1' })).toBe(
      'browser',
    )
    expect(h.state.fetchCalls).toBe(1)
  })
})

describe('MT-V pre-warm', () => {
  it('caches a static line so it later plays from cache with no extra API call', async () => {
    const h = harness()
    const req = { text: "Let's work it out together.", voiceRef: 'el:v1', rate: 0.85 }

    expect(await h.adapter.prewarmLine(req)).toBe(true)
    expect(h.state.fetchCalls).toBe(1)

    // now the same line plays from cache — even if we were to go offline
    h.state.online = false
    expect(await h.adapter.speak(req)).toBe('cache')
    expect(h.state.fetchCalls).toBe(1)
  })
})

describe('MT-V voice-map resolution + fall-through', () => {
  const g6 = () => emptyProfile('p3', '6th Grader', '6')

  it('two slots for one girl resolve to two different voices', () => {
    let p = g6()
    p = setSlotRef(p, 'mathTutor', { provider: 'elevenlabs', ref: 'aaa', label: 'Rachel' })
    p = setSlotRef(p, 'mindset', { provider: 'elevenlabs', ref: 'bbb', label: 'Bella' })
    expect(resolveSlotRef(p, 'mathTutor')?.ref).toBe('aaa')
    expect(resolveSlotRef(p, 'mindset')?.ref).toBe('bbb')
  })

  it('an unset slot falls through to the default slot', () => {
    let p = g6()
    p = setSlotRef(p, 'default', { provider: 'elevenlabs', ref: 'def', label: 'Default' })
    // mathTutor is unset → resolves to the default slot
    expect(resolveSlotRef(p, 'mathTutor')?.ref).toBe('def')
    // and getVoicePrefs (the walkthrough path) encodes that as a premium ref
    expect(getVoicePrefs(p).voiceURI).toBe('el:def')
  })

  it('the math-tutor slot wins over the default slot for the walkthrough', () => {
    let p = g6()
    p = setSlotRef(p, 'default', { provider: 'elevenlabs', ref: 'def', label: 'D' })
    p = setSlotRef(p, 'mathTutor', { provider: 'elevenlabs', ref: 'math', label: 'M' })
    expect(getVoicePrefs(p).voiceURI).toBe('el:math')
  })

  it('an MT-1 single voice migrates into the default slot and resolves as a browser ref', () => {
    let p = g6()
    p = { ...p, tutor: { ...p.tutor, voiceURI: 'urn:moz-tts:sapi:kid' } }
    // even before migration, resolution falls through to the legacy voice
    expect(getVoicePrefs(p).voiceURI).toBe('urn:moz-tts:sapi:kid')
    p = migrateLegacyVoiceToDefault(p)
    expect(getSlotRefViaResolve(p)).toBe('urn:moz-tts:sapi:kid')
    // migration is idempotent
    expect(migrateLegacyVoiceToDefault(p)).toBe(p)
  })

  function getSlotRefViaResolve(p: ReturnType<typeof g6>): string | undefined {
    return resolveSlotRef(p, 'default')?.ref
  }
})

describe('MT-V cache lifecycle hardening', () => {
  afterEach(() => {
    __resetVoiceRuntime()
  })

  it('expires each entry after 30 days since its last use', async () => {
    let now = Date.parse('2026-07-01T00:00:00Z')
    const cache = createMemoryCache(undefined, () => now)
    await cache.put('old', new Blob(['old']))
    now += CACHE_MAX_AGE_MS - 1
    expect(await cache.get('old')).toBeDefined()
    now += CACHE_MAX_AGE_MS
    await cache.sweepExpired()
    expect(await cache.get('old')).toBeUndefined()
    expect(await cache.sizeBytes()).toBe(0)
  })

  it('purges the shared audio cache on sign-out', async () => {
    const cache = getVoiceCache()
    await cache.put('household-line', new Blob(['private audio']))
    expect(await cache.sizeBytes()).toBeGreaterThan(0)
    await purgeVoiceCache()
    expect(await cache.sizeBytes()).toBe(0)
  })
})

describe('MT-V object URL lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    __resetVoiceRuntime()
  })

  it('revokes synthesized audio object URLs when playback ends', async () => {
    let audio: FakeAudio | undefined
    class FakeAudio {
      src = ''
      onended: (() => void) | null = null
      constructor() { audio = this }
      pause() {}
      play() { return Promise.resolve() }
      removeAttribute(name: string) {
        if (name === 'src') this.src = ''
      }
    }
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:academy-audio'),
      revokeObjectURL,
    })

    await browserPlayAudio(new Blob(['audio']))
    audio?.onended?.()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:academy-audio')
    expect(audio?.src).toBe('')
  })
})
