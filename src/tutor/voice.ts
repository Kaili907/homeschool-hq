import { useEffect, useState } from 'react'
import type { VoiceProviderId, VoiceRef } from '../types'
import { getGatewayAccessToken } from './gatewayAuth'

/**
 * MT-V voice: a ranked provider adapter — **cache → ElevenLabs → browser TTS**.
 *
 * Failures degrade SILENTLY down the chain: a kid mid-walkthrough must never see
 * an error because wifi dropped — she just hears the browser voice. Text is always
 * displayed alongside speech (MT-1 rule), so speaking is never the only channel.
 *
 * MT-1's browser `speechSynthesis` is not removed — it becomes the fallback tier.
 * The public `speak()` / `cancelSpeech()` / `SpeakOptions` surface is unchanged so
 * Walkthrough / QuizSession keep calling the speak layer exactly as before; the
 * only new wire is that `SpeakOptions.voiceURI` may now carry an encoded premium
 * ref (`el:<voiceId>`) which the adapter routes to ElevenLabs.
 */

// ---------- MT-1 browser voice list (unchanged) ----------

export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!voiceSupported()) return []
  return window.speechSynthesis.getVoices()
}

/** Subscribe to the (async-loading) system voice list. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => getVoices())
  useEffect(() => {
    if (!voiceSupported()) return
    const synth = window.speechSynthesis
    const update = () => setVoices(synth.getVoices())
    update()
    synth.addEventListener('voiceschanged', update)
    return () => synth.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

const clampRate = (r: number) => Math.max(0.5, Math.min(1.5, r))

export interface SpeakOptions {
  /** browser voiceURI, or an encoded premium ref (`el:<voiceId>`) — see encodeVoiceRef. */
  voiceURI?: string
  rate?: number
}

// ---------- ref encoding: pack (provider, ref) into one opaque string ----------
// Walkthrough/QuizSession forward SpeakOptions.voiceURI untouched, so the provider
// choice rides inside that string. Browser voiceURIs never start with "el:".

const EL_PREFIX = 'el:'

export function encodeVoiceRef(v: VoiceRef | undefined): string | undefined {
  if (!v || !v.ref) return undefined
  return v.provider === 'elevenlabs' ? EL_PREFIX + v.ref : v.ref
}

export function parseVoiceRef(voiceURI?: string): { provider: VoiceProviderId; ref: string } {
  if (voiceURI && voiceURI.startsWith(EL_PREFIX)) {
    return { provider: 'elevenlabs', ref: voiceURI.slice(EL_PREFIX.length) }
  }
  return { provider: 'browser', ref: voiceURI ?? '' }
}

// ---------- deterministic cache key: hash(voiceRef + rate + text) ----------

/** cyrb53 — fast, sync, deterministic (browser + node), plenty for a cache key. */
export function hashKey(str: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0)
  return n.toString(36)
}

export function cacheKeyFor(voiceRef: string | undefined, rate: number, text: string): string {
  return hashKey(`${voiceRef ?? ''}${rate}${text}`)
}

// ---------- interfaces (all provider-agnostic + dependency-injectable for tests) ----------

export interface SpeakRequest {
  text: string
  /** encoded ref: `el:<voiceId>` for ElevenLabs, else a browser voiceURI (or undefined). */
  voiceRef?: string
  rate?: number
}

export type UsedProvider = 'cache' | 'elevenlabs' | 'browser' | 'none'

export interface AudioCache {
  get(key: string): Promise<Blob | undefined>
  put(key: string, blob: Blob): Promise<void>
  sizeBytes(): Promise<number>
  clear(): Promise<void>
}

export interface UsageMeter {
  chars(): number
  cap(): number
  month(): string
  add(n: number): void
  setCap(n: number): void
  /** true once the month's characters reach the soft cap → chain drops ElevenLabs. */
  overCap(): boolean
}

export interface ElevenLabsSynth {
  available(): boolean
  synthesize(req: { text: string; voiceId: string }): Promise<Blob>
}

export interface BrowserTts {
  available(): boolean
  speak(req: { text: string; voiceURI?: string; rate?: number }): void
  cancel(): void
}

export interface VoiceAdapterDeps {
  cache: AudioCache
  usage: UsageMeter
  elevenLabs: ElevenLabsSynth
  browser: BrowserTts
  /** play a synthesized mp3 blob through the single shared Audio element. */
  playAudio: (blob: Blob) => Promise<void>
  stopAudio: () => void
  /** dev-only per-utterance provider log. */
  log?: (provider: UsedProvider, req: SpeakRequest) => void
}

export interface VoiceAdapter {
  /** Speak one line down the ranked chain; resolves to whichever tier was used. */
  speak(req: SpeakRequest): Promise<UsedProvider>
  cancel(): void
  /** Synthesize + cache a line WITHOUT playing it (pre-warm). true = it is cached. */
  prewarmLine(req: SpeakRequest): Promise<boolean>
}

// ---------- the adapter ----------

export function createVoiceAdapter(deps: VoiceAdapterDeps): VoiceAdapter {
  const { cache, usage, elevenLabs, browser, playAudio, stopAudio, log } = deps

  const cancel = () => {
    try {
      browser.cancel()
    } catch {
      /* ignore */
    }
    try {
      stopAudio()
    } catch {
      /* ignore */
    }
  }

  async function tryCache(key: string): Promise<Blob | undefined> {
    try {
      return await cache.get(key)
    } catch {
      return undefined
    }
  }

  async function speak(req: SpeakRequest): Promise<UsedProvider> {
    if (!req.text.trim()) return 'none'
    cancel() // never let two lines overlap (mirrors MT-1 synth.cancel())
    const { provider, ref } = parseVoiceRef(req.voiceRef)
    const rate = req.rate ?? 1

    if (provider === 'elevenlabs') {
      const key = cacheKeyFor(req.voiceRef, rate, req.text)

      // 1. cache — always first, and works offline once pre-warmed.
      const hit = await tryCache(key)
      if (hit) {
        try {
          await playAudio(hit)
        } catch {
          /* even a play glitch shouldn't error the kid — fall through to browser */
        }
        log?.('cache', req)
        return 'cache'
      }

      // 2. ElevenLabs — only when a key is present, online and under the cap.
      if (elevenLabs.available()) {
        try {
          const blob = await elevenLabs.synthesize({ text: req.text, voiceId: ref })
          usage.add(req.text.length) // count ACTUAL characters sent
          try {
            await cache.put(key, blob)
          } catch {
            /* cache write is best-effort */
          }
          await playAudio(blob)
          log?.('elevenlabs', req)
          return 'elevenlabs'
        } catch {
          /* network / api / decode failure → silently degrade to browser */
        }
      }
    }

    // 3. browser TTS — the always-available fallback tier.
    if (browser.available()) {
      // an ElevenLabs ref is not a browser voiceURI → let the browser use its default.
      browser.speak({ text: req.text, voiceURI: provider === 'browser' ? ref : undefined, rate })
      log?.('browser', req)
      return 'browser'
    }
    log?.('none', req)
    return 'none'
  }

  async function prewarmLine(req: SpeakRequest): Promise<boolean> {
    if (!req.text.trim()) return false
    const { provider, ref } = parseVoiceRef(req.voiceRef)
    if (provider !== 'elevenlabs') return false
    const key = cacheKeyFor(req.voiceRef, req.rate ?? 1, req.text)
    const hit = await tryCache(key)
    if (hit) return true // already offline-ready
    if (!elevenLabs.available()) return false
    try {
      const blob = await elevenLabs.synthesize({ text: req.text, voiceId: ref })
      usage.add(req.text.length)
      await cache.put(key, blob)
      return true
    } catch {
      return false
    }
  }

  return { speak, cancel, prewarmLine }
}

// ---------- ElevenLabs REST provider ----------

// ElevenLabs revs models often — keep the id in ONE place. Turbo = low-latency.
export const ELEVENLABS_MODEL_ID = 'eleven_turbo_v2_5'

// D1 deploy: with VITE_USE_PROXY=true this points at the serverless proxy
// (netlify/functions/tts via the /api/tts redirect), which injects the key
// server-side — the key never ships to the client. Empty (local dev / no flag)
// keeps the direct-with-panel-key path. Only this one value changes.
export const ELEVENLABS_ENDPOINT_BASE = import.meta.env.VITE_USE_PROXY === 'true' ? '/api/tts' : ''

/** Minimal fetch shape so tests can inject a fake without the whole DOM Response type. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>

export function createElevenLabsSynth(deps: {
  getKey: () => string | null
  getAccessToken?: () => Promise<string | null>
  fetchImpl: FetchLike
  isOnline: () => boolean
  usage: UsageMeter
  endpointBase?: string
  modelId?: string
}): ElevenLabsSynth {
  const base = deps.endpointBase ?? ELEVENLABS_ENDPOINT_BASE
  const modelId = deps.modelId ?? ELEVENLABS_MODEL_ID
  const proxyMode = base !== ''
  const origin = base || 'https://api.elevenlabs.io'
  return {
    available() {
      // Proxy mode holds the key server-side, so no local key is required.
      return (proxyMode || !!deps.getKey()) && deps.isOnline() && !deps.usage.overCap()
    },
    async synthesize({ text, voiceId }) {
      const key = deps.getKey()
      if (!proxyMode && !key) throw new Error('elevenlabs: no key')
      let url: string
      let headers: Record<string, string>
      let body: string
      if (proxyMode) {
        const accessToken = await (deps.getAccessToken ?? getGatewayAccessToken)()
        if (!accessToken) throw new Error('elevenlabs: unauthenticated')
        url = `${origin}/synthesize`
        headers = {
          Authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        }
        body = JSON.stringify({ text, voiceId })
      } else {
        url = `${origin}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`
        headers = {
          'xi-api-key': key as string,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        }
        body = JSON.stringify({ text, model_id: modelId })
      }
      const res = await deps.fetchImpl(url, {
        method: 'POST',
        headers,
        body,
      })
      if (!res.ok) throw new Error(`elevenlabs: http ${res.status}`)
      const buf = await res.arrayBuffer()
      return new Blob([buf], { type: 'audio/mpeg' })
    },
  }
}

// ---------- browser TTS provider (MT-1 behavior, now a tier) ----------

export function createBrowserTts(): BrowserTts {
  const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window
  return {
    available: supported,
    speak({ text, voiceURI, rate }) {
      if (!supported() || !text.trim()) return
      const synth = window.speechSynthesis
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      if (voiceURI) {
        const v = synth.getVoices().find((vv) => vv.voiceURI === voiceURI)
        if (v) u.voice = v
      }
      u.rate = clampRate(rate ?? 1)
      synth.speak(u)
    },
    cancel() {
      if (supported()) window.speechSynthesis.cancel()
    },
  }
}

// ---------- shared Audio element (single instance, respects mute/replay) ----------

let sharedAudio: HTMLAudioElement | null = null
let sharedUrl: string | null = null

function browserStopAudio(): void {
  if (sharedAudio) {
    try {
      sharedAudio.pause()
    } catch {
      /* ignore */
    }
  }
  if (sharedUrl) {
    try {
      URL.revokeObjectURL(sharedUrl)
    } catch {
      /* ignore */
    }
    sharedUrl = null
  }
}

async function browserPlayAudio(blob: Blob): Promise<void> {
  if (typeof Audio === 'undefined') return
  browserStopAudio()
  if (!sharedAudio) sharedAudio = new Audio()
  sharedUrl = URL.createObjectURL(blob)
  sharedAudio.src = sharedUrl
  try {
    await sharedAudio.play()
  } catch {
    /* autoplay policy / interruption — silent, text is still shown */
  }
}

// ---------- IndexedDB / in-memory mp3 cache (200 MB LRU) ----------

export const CACHE_MAX_BYTES = 200 * 1024 * 1024
const DB_NAME = 'homeschool-hq-voice'
const DB_STORE = 'mp3'

/** In-memory LRU cache — the node/test + no-IndexedDB fallback. */
export function createMemoryCache(maxBytes: number = CACHE_MAX_BYTES): AudioCache {
  const map = new Map<string, { blob: Blob; size: number; seq: number }>()
  let seq = 0
  let total = 0
  const evict = () => {
    while (total > maxBytes && map.size > 0) {
      let oldestKey: string | null = null
      let oldest = Infinity
      for (const [k, v] of map) {
        if (v.seq < oldest) {
          oldest = v.seq
          oldestKey = k
        }
      }
      if (oldestKey === null) break
      total -= map.get(oldestKey)!.size
      map.delete(oldestKey)
    }
  }
  return {
    async get(key) {
      const e = map.get(key)
      if (!e) return undefined
      e.seq = ++seq // touch → most-recently-used
      return e.blob
    },
    async put(key, blob) {
      const size = blob.size || 0
      const prev = map.get(key)
      if (prev) total -= prev.size
      map.set(key, { blob, size, seq: ++seq })
      total += size
      evict()
    },
    async sizeBytes() {
      return total
    },
    async clear() {
      map.clear()
      total = 0
    },
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DB_STORE)) {
        const store = db.createObjectStore(DB_STORE, { keyPath: 'key' })
        store.createIndex('lastUsed', 'lastUsed')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

interface CacheRow {
  key: string
  blob: Blob
  size: number
  lastUsed: number
}

/** Persistent IndexedDB cache with LRU eviction to stay under `maxBytes`. */
export function createIndexedDbCache(maxBytes: number = CACHE_MAX_BYTES): AudioCache {
  const tx = <T,>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    openDb().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const store = db.transaction(DB_STORE, mode).objectStore(DB_STORE)
          const r = fn(store)
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        }),
    )

  async function totalBytes(): Promise<number> {
    const rows = (await tx<CacheRow[]>('readonly', (s) => s.getAll() as IDBRequest<CacheRow[]>)) ?? []
    return rows.reduce((n, r) => n + (r.size || 0), 0)
  }

  async function evict(): Promise<void> {
    let rows = (await tx<CacheRow[]>('readonly', (s) => s.getAll() as IDBRequest<CacheRow[]>)) ?? []
    let sum = rows.reduce((n, r) => n + (r.size || 0), 0)
    if (sum <= maxBytes) return
    rows = rows.sort((a, b) => a.lastUsed - b.lastUsed) // oldest first
    for (const row of rows) {
      if (sum <= maxBytes) break
      await tx('readwrite', (s) => s.delete(row.key))
      sum -= row.size || 0
    }
  }

  return {
    async get(key) {
      try {
        const row = await tx<CacheRow | undefined>('readonly', (s) => s.get(key) as IDBRequest<CacheRow | undefined>)
        if (!row) return undefined
        row.lastUsed = Date.now()
        await tx('readwrite', (s) => s.put(row))
        return row.blob
      } catch {
        return undefined
      }
    },
    async put(key, blob) {
      try {
        const row: CacheRow = { key, blob, size: blob.size || 0, lastUsed: Date.now() }
        await tx('readwrite', (s) => s.put(row))
        await evict()
      } catch {
        /* best-effort */
      }
    },
    async sizeBytes() {
      try {
        return await totalBytes()
      } catch {
        return 0
      }
    },
    async clear() {
      try {
        await tx('readwrite', (s) => s.clear())
      } catch {
        /* ignore */
      }
    },
  }
}

/** IndexedDB when available (browser), else the in-memory fallback. */
export function createBrowserCache(maxBytes: number = CACHE_MAX_BYTES): AudioCache {
  if (typeof indexedDB !== 'undefined') return createIndexedDbCache(maxBytes)
  return createMemoryCache(maxBytes)
}

// ---------- monthly usage meter + Dad-set soft cap ----------

export const DEFAULT_MONTHLY_CAP = 90_000

interface UsageRecord {
  month: string // YYYY-MM
  chars: number
  cap: number
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function createUsageMeter(deps: {
  read: () => string | null
  write: (v: string) => void
  now: () => Date
}): UsageMeter {
  const save = (r: UsageRecord) => {
    try {
      deps.write(JSON.stringify(r))
    } catch {
      /* ignore */
    }
  }
  const load = (): UsageRecord => {
    const cur = monthKey(deps.now())
    let rec: UsageRecord = { month: cur, chars: 0, cap: DEFAULT_MONTHLY_CAP }
    try {
      const raw = deps.read()
      if (raw) {
        const p = JSON.parse(raw) as Partial<UsageRecord>
        rec = {
          month: typeof p.month === 'string' ? p.month : cur,
          chars: typeof p.chars === 'number' ? p.chars : 0,
          cap: typeof p.cap === 'number' ? p.cap : DEFAULT_MONTHLY_CAP,
        }
      }
    } catch {
      /* corrupt → defaults */
    }
    if (rec.month !== cur) {
      rec = { month: cur, chars: 0, cap: rec.cap } // monthly reset keeps the cap
      save(rec)
    }
    return rec
  }
  return {
    chars: () => load().chars,
    cap: () => load().cap,
    month: () => load().month,
    add: (n) => {
      const r = load()
      r.chars += Math.max(0, Math.floor(n))
      save(r)
    },
    setCap: (n) => {
      const r = load()
      r.cap = Math.max(0, Math.floor(n))
      save(r)
    },
    overCap: () => {
      const r = load()
      return r.cap > 0 && r.chars >= r.cap
    },
  }
}

// ---------- static lines pre-warm registry ----------

/**
 * Fixed tutor lines that repeat verbatim across sessions — these converge to ~100%
 * cache hits and are what "Download voices for offline" pre-warms. MM's mindset
 * lesson paragraphs append here once that milestone ships (slot 'mindset'); dynamic
 * walkthrough text is per-question and correctly falls back to browser TTS offline.
 */
export const STATIC_VOICE_LINES: readonly string[] = [
  "Let's work it out together.",
  'Nice — you got it!',
  'You did it yourself!',
  "Almost — let's see how it works.",
  'Try one like it.',
  'Got it!',
  'Great job!',
  'Keep going — every try makes your brain grow.',
]

export function staticVoiceLines(): string[] {
  return [...STATIC_VOICE_LINES]
}

// ---------- local-storage backed key store (NEVER in AppState → never exported) ----------

const KEY_LS = 'homeschool-hq:voice:key'
const USAGE_LS = 'homeschool-hq:voice:usage'

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function getStoredKey(): string | null {
  return ls()?.getItem(KEY_LS) ?? null
}

export function setStoredKey(k: string): void {
  const s = ls()
  if (!s) return
  const t = k.trim()
  if (t) s.setItem(KEY_LS, t)
  else s.removeItem(KEY_LS)
}

export function clearStoredKey(): void {
  ls()?.removeItem(KEY_LS)
}

export function hasStoredKey(): boolean {
  return !!getStoredKey()
}

/** Masked display for the Grown-Ups field — the raw key is never rendered. */
export function maskKey(k: string | null): string {
  if (!k) return ''
  if (k.length <= 6) return '••••'
  return `${k.slice(0, 3)}••••••${k.slice(-2)}`
}

// ---------- app-wide default instances (browser) ----------

let _meter: UsageMeter | null = null
export function getUsageMeter(): UsageMeter {
  if (_meter) return _meter
  _meter = createUsageMeter({
    read: () => ls()?.getItem(USAGE_LS) ?? null,
    write: (v) => ls()?.setItem(USAGE_LS, v),
    now: () => new Date(),
  })
  return _meter
}

export interface UsageSnapshot {
  chars: number
  cap: number
  month: string
  /** at/over the cap → the chain has dropped to browser-only for the rest of the month. */
  browserOnly: boolean
}

export function voiceUsageSnapshot(): UsageSnapshot {
  const m = getUsageMeter()
  return { chars: m.chars(), cap: m.cap(), month: m.month(), browserOnly: m.overCap() }
}

export function setVoiceMonthlyCap(n: number): void {
  getUsageMeter().setCap(n)
}

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

function devLog(provider: UsedProvider, req: SpeakRequest): void {
  try {
    const meta = import.meta as unknown as { env?: { DEV?: boolean } }
    if (meta.env?.DEV && typeof console !== 'undefined') {
      console.debug(`[voice] ${provider} · "${req.text.slice(0, 24)}"`)
    }
  } catch {
    /* ignore */
  }
}

let _cache: AudioCache | null = null
/** The one cache the default adapter uses — also read/cleared by the Grown-Ups panel. */
export function getVoiceCache(): AudioCache {
  if (!_cache) _cache = createBrowserCache()
  return _cache
}

let _adapter: VoiceAdapter | null = null
export function getVoiceAdapter(): VoiceAdapter {
  if (_adapter) return _adapter
  const usage = getUsageMeter()
  _adapter = createVoiceAdapter({
    cache: getVoiceCache(),
    usage,
    elevenLabs: createElevenLabsSynth({
      getKey: getStoredKey,
      getAccessToken: getGatewayAccessToken,
      fetchImpl: (url, init) => fetch(url, init as RequestInit),
      isOnline,
      usage,
    }),
    browser: createBrowserTts(),
    playAudio: browserPlayAudio,
    stopAudio: browserStopAudio,
    log: devLog,
  })
  return _adapter
}

/** Test seam: drop the memoized default adapter (and usage meter + cache). */
export function __resetVoiceRuntime(): void {
  _adapter = null
  _meter = null
  _cache = null
}

// ---------- MT-1 public surface (unchanged signatures; now routed through the chain) ----------

/** Speak one line, cancelling anything already in progress. No-op when unsupported. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (typeof window === 'undefined' || !text.trim()) return
  void getVoiceAdapter()
    .speak({ text, voiceRef: opts.voiceURI, rate: opts.rate })
    .catch(() => {
      /* never surface a speech error to the kid */
    })
}

export function cancelSpeech(): void {
  if (typeof window === 'undefined') return
  try {
    getVoiceAdapter().cancel()
  } catch {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }
}
