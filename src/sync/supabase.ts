import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js'
import {
  cleanupLegacySyncStorage,
  supabaseAnonKey,
  supabaseConfigured,
  supabaseUrl,
} from './config'
import type {
  CloudPullResult,
  CloudPushResult,
  RemoteProfileRow,
  SignedInUser,
} from './types'

/**
 * Official Supabase browser client. Its supported auth layer owns session
 * persistence, refresh-token rotation, and TOKEN_REFRESHED storage updates.
 */
let singleton: SupabaseClient | null | undefined

export function createSupabaseBrowserClient(
  url = supabaseUrl(),
  anonKey = supabaseAnonKey(),
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseConfigured()) return null
  if (singleton === undefined) singleton = createSupabaseBrowserClient()
  return singleton
}

export function userFromSession(session: Session | null): SignedInUser | null {
  if (!session?.user.id) return null
  return { id: session.user.id, email: session.user.email ?? session.user.id }
}

export type SignInResult =
  | { ok: true; user: SignedInUser }
  | { ok: false; error: string }

export async function signInWithPassword(
  email: string,
  password: string,
  client = getSupabaseClient(),
): Promise<SignInResult> {
  if (!client) return { ok: false, error: 'Cloud sync is not configured.' }
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })
  if (error) return { ok: false, error: error.message }
  const user = userFromSession(data.session)
  return user
    ? { ok: true, user }
    : {
        ok: false,
        error: 'Supabase did not return a verified household session.',
      }
}

export async function getCurrentSession(
  client = getSupabaseClient(),
): Promise<Session | null> {
  if (!client) return null
  const { data, error } = await client.auth.getSession()
  return error ? null : data.session
}

/** Server-verified user identity for the final cloud mutation boundary. */
export async function getVerifiedCurrentUser(
  client = getSupabaseClient(),
): Promise<SignedInUser | null> {
  if (!client) return null
  const { data, error } = await client.auth.getUser()
  if (error || !data.user?.id) return null
  return {
    id: data.user.id,
    email: data.user.email ?? data.user.id,
  }
}

export interface VerifiedAuthContext {
  user: SignedInUser
  accessToken: string
}

/**
 * Capture one server-verified auth context. Mutations use this fixed token so a
 * different session appearing in another tab cannot retarget an in-flight write.
 */
export async function getVerifiedAuthContext(
  client = getSupabaseClient(),
): Promise<VerifiedAuthContext | null> {
  if (!client) return null
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (sessionError || !accessToken) return null
  const { data, error } = await client.auth.getUser(accessToken)
  if (error || !data.user?.id) return null
  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? data.user.id,
    },
    accessToken,
  }
}

export function onAuthSessionChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
  client = getSupabaseClient(),
): () => void {
  if (!client) return () => undefined
  const { data } = client.auth.onAuthStateChange(callback)
  return () => data.subscription.unsubscribe()
}

function isRemoteProfileRow(value: unknown): value is RemoteProfileRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<RemoteProfileRow>
  return (
    typeof row.profile_id === 'string' &&
    !!row.data &&
    typeof row.data === 'object' &&
    row.data.id === row.profile_id &&
    typeof row.data.name === 'string' &&
    typeof row.updated_at === 'string' &&
    Number.isFinite(Date.parse(row.updated_at))
  )
}

/** Pull failures remain failures; an empty array is returned only on a successful query. */
export async function pullProfiles(
  client = getSupabaseClient(),
  signal?: AbortSignal,
): Promise<CloudPullResult> {
  if (!client) return { ok: false, error: 'Cloud sync is not configured.' }
  try {
    let query = client.from('profiles').select('profile_id,data,updated_at')
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) return { ok: false, error: error.message }
    if (!Array.isArray(data)) {
      return {
        ok: false,
        error: 'The cloud returned an invalid profile response.',
      }
    }
    const rows = data.filter(isRemoteProfileRow)
    if (rows.length !== data.length) {
      return { ok: false, error: 'The cloud returned an invalid profile row.' }
    }
    return { ok: true, rows }
  } catch {
    return {
      ok: false,
      error: 'Network error while reading cloud data. Retry when online.',
    }
  }
}

export async function pushProfiles(
  rows: RemoteProfileRow[],
  verifiedAccessToken: string,
  signal?: AbortSignal,
): Promise<CloudPushResult> {
  if (rows.length === 0) return { ok: true }
  if (!supabaseConfigured())
    return { ok: false, error: 'Cloud sync is not configured.' }
  if (!verifiedAccessToken) {
    return {
      ok: false,
      error: 'A server-verified auth token is required for cloud writes.',
    }
  }
  try {
    const payload = profileRowsForUpsert(rows)
    const writeClient = createClient(supabaseUrl(), supabaseAnonKey(), {
      accessToken: async () => verifiedAccessToken,
    })
    let query = writeClient.from('profiles').upsert(payload, {
      onConflict: 'household_id,profile_id',
      defaultToNull: false,
    })
    if (signal) query = query.abortSignal(signal)
    const { error } = await query
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch {
    return {
      ok: false,
      error: 'Network error while writing cloud data. Retry when online.',
    }
  }
}

export function profileRowsForUpsert(rows: RemoteProfileRow[]) {
  return rows.map((row) => ({
    profile_id: row.profile_id,
    data: row.data,
    updated_at: row.updated_at,
  }))
}

/** Local sign-out removes this browser session without revoking other devices. */
export async function signOutRemote(
  client = getSupabaseClient(),
): Promise<void> {
  try {
    if (client) await client.auth.signOut({ scope: 'local' })
  } finally {
    cleanupLegacySyncStorage()
  }
}

export function resetSupabaseClientForTests(): void {
  singleton = undefined
}
