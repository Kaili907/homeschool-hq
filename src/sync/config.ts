import type { SyncMeta } from './types'
import { emptyMeta } from './types'

/**
 * M6 sync config + persistence. Supabase is configured entirely through env vars.
 * The ANON key is public by design (RLS protects the data); the service key must
 * NEVER be referenced anywhere in the client. With no config, every function here
 * degrades to "not configured" and the app stays in today's local-only mode.
 */

export function supabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
}
export function supabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
}
/** True only when BOTH the URL and the anon key are present. */
export function supabaseConfigured(): boolean {
  return supabaseUrl() !== '' && supabaseAnonKey() !== ''
}

// ---------- session + meta persistence (own localStorage slots, OUTSIDE AppState) ----------

const SESSION_LS = 'homeschool-hq:sync:session'
const META_LS = 'homeschool-hq:sync:meta'

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** A persisted Supabase auth session. Access token is refreshed on demand. */
export interface StoredSession {
  access_token: string
  refresh_token: string
  /** epoch ms when the access token expires. */
  expires_at: number
  user: { id: string; email: string }
}

export function getStoredSession(): StoredSession | null {
  const raw = ls()?.getItem(SESSION_LS)
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as StoredSession
    return s.access_token && s.user?.id ? s : null
  } catch {
    return null
  }
}

export function setStoredSession(s: StoredSession | null): void {
  const store = ls()
  if (!store) return
  if (s) store.setItem(SESSION_LS, JSON.stringify(s))
  else store.removeItem(SESSION_LS)
}

export function loadMeta(): SyncMeta {
  const raw = ls()?.getItem(META_LS)
  if (!raw) return emptyMeta()
  try {
    const m = JSON.parse(raw) as SyncMeta
    return m && m.profiles ? m : emptyMeta()
  } catch {
    return emptyMeta()
  }
}

export function saveMeta(m: SyncMeta): void {
  try {
    ls()?.setItem(META_LS, JSON.stringify(m))
  } catch {
    /* best-effort */
  }
}
