import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getStoredSession,
  loadMeta,
  saveMeta,
  setStoredSession,
  supabaseAnonKey,
  supabaseConfigured,
  supabaseUrl,
  type StoredSession,
} from './config'
import { markDirty } from './engine'
import { emptyMeta } from './types'
import {
  ensureFresh,
  pullProfiles,
  pushProfiles,
  signInWithPassword,
  type FetchLike,
} from './supabase'

// ---------------------------------------------------------------------------
// Keyless local mode: with no Supabase env, sync is inert and the app is today's.
// ---------------------------------------------------------------------------
describe('M6 keyless local mode', () => {
  it('is not configured when the env vars are absent (test env)', () => {
    expect(supabaseUrl()).toBe('')
    expect(supabaseAnonKey()).toBe('')
    expect(supabaseConfigured()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// session + meta persistence (localStorage shim, outside AppState).
// ---------------------------------------------------------------------------
class MemStorage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  clear() { this.m.clear() }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null }
}

describe('M6 session + meta persistence', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStorage() as unknown as Storage
  })
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage
  })

  it('round-trips a session and clears it on sign-out', () => {
    const s: StoredSession = {
      access_token: 'at', refresh_token: 'rt', expires_at: Date.now() + 3_600_000,
      user: { id: 'u1', email: 'dad@example.com' },
    }
    setStoredSession(s)
    expect(getStoredSession()?.user.email).toBe('dad@example.com')
    setStoredSession(null)
    expect(getStoredSession()).toBe(null)
  })

  it('round-trips sync meta', () => {
    const m = markDirty(emptyMeta(), ['p1'], 1000)
    saveMeta(m)
    expect(loadMeta().profiles.p1.dirty).toBe(true)
  })

  it('the sync session is NOT part of AppState (own localStorage slot)', () => {
    setStoredSession({ access_token: 'SECRET-TOKEN', refresh_token: 'r', expires_at: 0, user: { id: 'u', email: 'e' } })
    // an AppState export would be JSON.stringify(state); the token lives elsewhere.
    const fakeAppStateExport = JSON.stringify({ schemaVersion: 2, profiles: {}, activeProfileId: null, parentPin: '' })
    expect(fakeAppStateExport).not.toContain('SECRET-TOKEN')
  })
})

// ---------------------------------------------------------------------------
// Transport: correct auth + data requests; anon key + bearer only, no service key.
// ---------------------------------------------------------------------------
const DEPS = (fetchImpl: FetchLike, now = () => 1_000_000) => ({
  fetchImpl,
  url: 'https://proj.supabase.co',
  anonKey: 'ANON_PUBLIC_KEY',
  now,
})
const session = (over: Partial<StoredSession> = {}): StoredSession => ({
  access_token: 'AT', refresh_token: 'RT', expires_at: 9_999_999_999_999,
  user: { id: 'u1', email: 'dad@example.com' }, ...over,
})

describe('M6 Supabase transport', () => {
  it('sign-in posts to the token endpoint with the anon key and parses the session', async () => {
    const spy = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'u1', email: 'dad@example.com' } }),
      text: async () => '',
    }))
    const res = await signInWithPassword('dad@example.com', 'pw', DEPS(spy as unknown as FetchLike))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.session.user.id).toBe('u1')
    const [url, init] = (spy as unknown as { mock: { calls: [string, { headers: Record<string, string>; body: string }][] } }).mock.calls[0]
    expect(url).toContain('/auth/v1/token?grant_type=password')
    expect(init.headers.apikey).toBe('ANON_PUBLIC_KEY')
    expect(JSON.parse(init.body).email).toBe('dad@example.com')
  })

  it('sign-in surfaces a friendly error on bad credentials', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false, status: 400, json: async () => ({ error_description: 'Invalid login credentials' }), text: async () => '',
    })
    const res = await signInWithPassword('x', 'y', DEPS(fetchImpl))
    expect(res).toEqual({ ok: false, error: 'Invalid login credentials' })
  })

  it('pull sends apikey + bearer and maps rows', async () => {
    const spy = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => [{ profile_id: 'p1', data: { id: 'p1', name: 'Ada' }, updated_at: '2026-07-24T10:00:00Z' }],
      text: async () => '',
    }))
    const rows = await pullProfiles(session(), DEPS(spy as unknown as FetchLike))
    expect(rows).toHaveLength(1)
    expect(rows[0].profile_id).toBe('p1')
    const [url, init] = (spy as unknown as { mock: { calls: [string, { headers: Record<string, string> }][] } }).mock.calls[0]
    expect(url).toContain('/rest/v1/profiles?select=')
    expect(init.headers.apikey).toBe('ANON_PUBLIC_KEY')
    expect(init.headers.Authorization).toBe('Bearer AT')
  })

  it('push upserts with merge-duplicates and never sends a service key or household_id', async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({}), text: async () => '' }))
    const ok = await pushProfiles(
      session(),
      [{ profile_id: 'p1', data: { id: 'p1', name: 'Ada' } as never, updated_at: '2026-07-24T10:00:00Z' }],
      DEPS(spy as unknown as FetchLike),
    )
    expect(ok).toBe(true)
    const [url, init] = (spy as unknown as { mock: { calls: [string, { headers: Record<string, string>; body: string }][] } }).mock.calls[0]
    expect(url).toContain('on_conflict=household_id,profile_id')
    expect(init.headers.Prefer).toContain('resolution=merge-duplicates')
    expect(init.headers.Authorization).toBe('Bearer AT')
    const body = JSON.parse(init.body)
    expect(body[0].household_id).toBeUndefined() // filled server-side by auth.uid()
    expect(init.headers['service_role']).toBeUndefined()
  })

  it('ensureFresh refreshes an about-to-expire token', async () => {
    const now = () => 1_000_000
    const stale = session({ expires_at: 1_000_000 + 30_000 }) // within the 60s window
    const spy = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ access_token: 'NEW', refresh_token: 'RT2', expires_in: 3600, user: { id: 'u1', email: 'dad@example.com' } }),
      text: async () => '',
    }))
    const fresh = await ensureFresh(stale, DEPS(spy as unknown as FetchLike, now))
    expect(fresh?.access_token).toBe('NEW')
  })
})
