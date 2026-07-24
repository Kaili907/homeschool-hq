import type { RemoteProfileRow } from './types'
import type { StoredSession } from './config'
import { supabaseAnonKey, supabaseUrl } from './config'

/**
 * M6 Supabase transport — a thin, dependency-free REST client over GoTrue (auth)
 * and PostgREST (data). Only the ANON key + the signed-in user's bearer token are
 * ever sent; the service key is never referenced. `fetchImpl` is injectable so the
 * whole thing is testable without a network or a real project.
 */

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>

export interface TransportDeps {
  fetchImpl?: FetchLike
  url?: string
  anonKey?: string
  now?: () => number
}

const resolve = (d: TransportDeps = {}) => ({
  fetchImpl: (d.fetchImpl ?? ((u, i) => fetch(u, i as RequestInit))) as FetchLike,
  url: d.url ?? supabaseUrl(),
  anonKey: d.anonKey ?? supabaseAnonKey(),
  now: d.now ?? (() => Date.now()),
})

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

function toSession(data: unknown, nowMs: number): StoredSession | null {
  const d = asRecord(data)
  const user = asRecord(d.user)
  if (typeof d.access_token !== 'string' || typeof user.id !== 'string') return null
  const expiresAt =
    typeof d.expires_at === 'number'
      ? d.expires_at * 1000
      : nowMs + (typeof d.expires_in === 'number' ? d.expires_in : 3600) * 1000
  return {
    access_token: d.access_token,
    refresh_token: typeof d.refresh_token === 'string' ? d.refresh_token : '',
    expires_at: expiresAt,
    user: { id: user.id, email: typeof user.email === 'string' ? user.email : '' },
  }
}

export type SignInResult = { ok: true; session: StoredSession } | { ok: false; error: string }

/** Email/password sign-in for the household owner (Dad). */
export async function signInWithPassword(email: string, password: string, deps?: TransportDeps): Promise<SignInResult> {
  const { fetchImpl, url, anonKey, now } = resolve(deps)
  try {
    const res = await fetchImpl(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const body = asRecord(await res.json().catch(() => ({})))
      return { ok: false, error: typeof body.error_description === 'string' ? body.error_description : `sign-in failed (${res.status})` }
    }
    const session = toSession(await res.json(), now())
    return session ? { ok: true, session } : { ok: false, error: 'unexpected sign-in response' }
  } catch {
    return { ok: false, error: 'network error — check your connection' }
  }
}

/** Exchange a refresh token for a fresh session, or null on failure. */
export async function refreshSession(refreshToken: string, deps?: TransportDeps): Promise<StoredSession | null> {
  const { fetchImpl, url, anonKey, now } = resolve(deps)
  if (!refreshToken) return null
  try {
    const res = await fetchImpl(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    return toSession(await res.json(), now())
  } catch {
    return null
  }
}

/** Return a valid session, refreshing if the access token is within 60s of expiry. */
export async function ensureFresh(session: StoredSession, deps?: TransportDeps): Promise<StoredSession | null> {
  const { now } = resolve(deps)
  if (session.expires_at - now() > 60_000) return session
  return refreshSession(session.refresh_token, deps)
}

const dataHeaders = (session: StoredSession, anonKey: string): Record<string, string> => ({
  apikey: anonKey,
  Authorization: `Bearer ${session.access_token}`,
  'content-type': 'application/json',
})

/** Pull all of this household's profile rows (RLS scopes them to the owner). */
export async function pullProfiles(session: StoredSession, deps?: TransportDeps): Promise<RemoteProfileRow[]> {
  const { fetchImpl, url, anonKey } = resolve(deps)
  const fresh = await ensureFresh(session, deps)
  if (!fresh) return []
  const res = await fetchImpl(`${url}/rest/v1/profiles?select=profile_id,data,updated_at`, {
    method: 'GET',
    headers: dataHeaders(fresh, anonKey),
  })
  if (!res.ok) return []
  const rows = await res.json()
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => asRecord(r))
    .filter((r) => typeof r.profile_id === 'string' && r.data && typeof r.updated_at === 'string')
    .map((r) => ({ profile_id: r.profile_id as string, data: r.data as RemoteProfileRow['data'], updated_at: r.updated_at as string }))
}

/**
 * Upsert profile rows. household_id is filled server-side by the column default
 * `auth.uid()` and enforced by RLS, so the client never sends it. Returns success.
 */
export async function pushProfiles(session: StoredSession, rows: RemoteProfileRow[], deps?: TransportDeps): Promise<boolean> {
  if (rows.length === 0) return true
  const { fetchImpl, url, anonKey } = resolve(deps)
  const fresh = await ensureFresh(session, deps)
  if (!fresh) return false
  try {
    const res = await fetchImpl(`${url}/rest/v1/profiles?on_conflict=household_id,profile_id`, {
      method: 'POST',
      headers: { ...dataHeaders(fresh, anonKey), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.map((r) => ({ profile_id: r.profile_id, data: r.data, updated_at: r.updated_at }))),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Best-effort remote sign-out (revokes the refresh token). */
export async function signOutRemote(session: StoredSession, deps?: TransportDeps): Promise<void> {
  const { fetchImpl, url, anonKey } = resolve(deps)
  try {
    await fetchImpl(`${url}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
    })
  } catch {
    /* ignore — local sign-out still proceeds */
  }
}
