import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

export const AUTH_VERIFICATION_TIMEOUT_MS = 8_000
export const SUPABASE_BROWSER_AUTH_FLOW = 'pkce' as const

export interface VerifiedAuthContext {
  readonly user: { readonly id: string; readonly email: string }
  readonly accessToken: string
  readonly verifiedAt: number
  readonly kind: 'supabase-access-token'
}

/** Browser-auth configuration shared without importing legacy profile sync. */
export function supabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
}

export function supabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
}

export function supabaseConfigured(): boolean {
  return supabaseUrl() !== '' && supabaseAnonKey() !== ''
}

export function supabaseAuthStorageKey(url = supabaseUrl()): string | null {
  try {
    const hostname = new URL(url).hostname
    const projectRef = hostname.endsWith('.supabase.co')
      ? hostname.slice(0, -'.supabase.co'.length)
      : ''
    return projectRef ? `sb-${projectRef}-auth-token` : null
  } catch { return null }
}

/** Presence-only persistence check; provider credential bytes are never read. */
export function supabaseSessionRecordIsPresent(url = supabaseUrl()): boolean {
  if (typeof window === 'undefined') return true
  const key = supabaseAuthStorageKey(url)
  if (!key) return false
  try { return window.localStorage.getItem(key) !== null } catch { return false }
}

function browserAuthStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  try { return window.localStorage } catch { return undefined }
}

/**
 * The supported auth client owns session persistence and refresh. It exposes no
 * profile read/write operation, so gateway authentication does not pull legacy
 * whole-profile sync into a route bundle.
 */
let singleton: SupabaseClient | null | undefined
let singletonConfiguration: string | null = null

export function createSupabaseBrowserClient(
  url = supabaseUrl(),
  anonKey = supabaseAnonKey(),
): SupabaseClient {
  const storage = browserAuthStorage()
  const storageKey = supabaseAuthStorageKey(url)
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: SUPABASE_BROWSER_AUTH_FLOW,
      ...(storage ? { storage } : {}),
      ...(storageKey ? { storageKey } : {}),
    },
  })
}

export function getSupabaseClient(
  url = supabaseUrl(),
  anonKey = supabaseAnonKey(),
): SupabaseClient | null {
  if (!url || !anonKey) return null
  const configuration = `${url.replace(/\/+$/, '')}\u0000${anonKey}`
  if (singleton === undefined) {
    singleton = createSupabaseBrowserClient(url, anonKey)
    singletonConfiguration = configuration
  }
  if (singletonConfiguration !== configuration) return null
  return singleton
}

export async function getCurrentSession(
  client = getSupabaseClient(),
): Promise<Session | null> {
  if (!client) return null
  const { data, error } = await client.auth.getSession()
  return error ? null : data.session
}

function accessTokenShapeIsValid(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every((part) => part.length > 0) && !/\s/.test(token)
}

async function boundedAuthorization<T>(
  operation: Promise<T>,
  signal?: AbortSignal,
  timeoutMs = AUTH_VERIFICATION_TIMEOUT_MS,
): Promise<T | null> {
  if (signal?.aborted) return null
  return new Promise<T | null>((resolve) => {
    let settled = false
    const finish = (value: T | null) => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(timer)
      signal?.removeEventListener('abort', aborted)
      resolve(value)
    }
    const aborted = () => finish(null)
    const timer = globalThis.setTimeout(() => finish(null), timeoutMs)
    signal?.addEventListener('abort', aborted, { once: true })
    void operation.then((value) => finish(value), () => finish(null))
  })
}

/**
 * Canonical remote-user/access-token capture shared by auth-only consumers and
 * legacy sync. The provider verifies the exact token; this function does not
 * decode or introduce a second bearer verifier.
 */
export async function getVerifiedAuthContext(
  client = getSupabaseClient(),
  signal?: AbortSignal,
  timeoutMs = AUTH_VERIFICATION_TIMEOUT_MS,
): Promise<VerifiedAuthContext | null> {
  if (!client) return null
  const sessionResult = await boundedAuthorization(client.auth.getSession(), signal, timeoutMs)
  if (!sessionResult || signal?.aborted) return null
  const { data: sessionData, error: sessionError } = sessionResult
  const accessToken = sessionData.session?.access_token
  if (sessionError || !accessToken || !accessTokenShapeIsValid(accessToken)) return null
  const userResult = await boundedAuthorization(client.auth.getUser(accessToken), signal, timeoutMs)
  if (!userResult || signal?.aborted) return null
  const { data, error } = userResult
  if (error || !data.user?.id) return null
  return Object.freeze({
    user: Object.freeze({ id: data.user.id, email: data.user.email ?? data.user.id }),
    accessToken,
    verifiedAt: Date.now(),
    kind: 'supabase-access-token',
  })
}

export function resetSupabaseClientForTests(): void {
  singleton = undefined
}
