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
import { validateRemoteProfileRows } from './provenance'
import type {
  CloudPullResult,
  CloudPushResult,
  RemoteProfileRow,
  SignedInUser,
} from './types'

export const AUTH_VERIFICATION_TIMEOUT_MS = 8_000

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
  signal?: AbortSignal,
  timeoutMs = AUTH_VERIFICATION_TIMEOUT_MS,
): Promise<SignedInUser | null> {
  if (!client) return null
  const result = await boundedAuthorization(
    client.auth.getUser(),
    signal,
    timeoutMs,
  )
  if (!result || signal?.aborted) return null
  const { data, error } = result
  if (error || !data.user?.id) return null
  return {
    id: data.user.id,
    email: data.user.email ?? data.user.id,
  }
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
    void operation.then(
      (value) => finish(value),
      () => finish(null),
    )
  })
}

export interface VerifiedAuthContext {
  user: SignedInUser
  accessToken: string
  readonly verifiedAt: number
  readonly kind: 'supabase-access-token'
}

function accessTokenShapeIsValid(token: string): boolean {
  const parts = token.split('.')
  return (
    parts.length === 3 &&
    parts.every((part) => part.length > 0) &&
    !/\s/.test(token)
  )
}

function isVerifiedAuthContext(value: unknown): value is VerifiedAuthContext {
  if (!value || typeof value !== 'object') return false
  const context = value as Partial<VerifiedAuthContext>
  return (
    context.kind === 'supabase-access-token' &&
    typeof context.verifiedAt === 'number' &&
    Number.isFinite(context.verifiedAt) &&
    typeof context.user?.id === 'string' &&
    typeof context.accessToken === 'string' &&
    accessTokenShapeIsValid(context.accessToken)
  )
}

function redactAccessToken(message: string, accessToken: string): string {
  return accessToken ? message.split(accessToken).join('[redacted]') : message
}

/**
 * Capture one server-verified auth context. Mutations use this fixed token so a
 * different session appearing in another tab cannot retarget an in-flight write.
 */
export async function getVerifiedAuthContext(
  client = getSupabaseClient(),
  signal?: AbortSignal,
  timeoutMs = AUTH_VERIFICATION_TIMEOUT_MS,
): Promise<VerifiedAuthContext | null> {
  if (!client) return null
  const sessionResult = await boundedAuthorization(
    client.auth.getSession(),
    signal,
    timeoutMs,
  )
  if (!sessionResult || signal?.aborted) return null
  const { data: sessionData, error: sessionError } = sessionResult
  const accessToken = sessionData.session?.access_token
  if (sessionError || !accessToken || !accessTokenShapeIsValid(accessToken))
    return null
  const userResult = await boundedAuthorization(
    client.auth.getUser(accessToken),
    signal,
    timeoutMs,
  )
  if (!userResult || signal?.aborted) return null
  const { data, error } = userResult
  if (error || !data.user?.id) return null
  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? data.user.id,
    },
    accessToken,
    verifiedAt: Date.now(),
    kind: 'supabase-access-token',
  }
}

/**
 * Re-verifies both the exact pinned token and the canonical current session.
 * A same-household refresh may change token text, but sign-out/account switch
 * is denied even while the older pinned access token remains server-valid.
 */
export async function verifyPinnedAuthContext(
  context: unknown,
  expectedHouseholdId: string,
  client = getSupabaseClient(),
  signal?: AbortSignal,
  timeoutMs = AUTH_VERIFICATION_TIMEOUT_MS,
): Promise<boolean> {
  if (
    !client ||
    !isVerifiedAuthContext(context) ||
    context.user.id !== expectedHouseholdId
  ) {
    return false
  }
  try {
    const verification = await boundedAuthorization(
      Promise.all([
        client.auth.getUser(context.accessToken),
        client.auth.getSession(),
        client.auth.getUser(),
      ]),
      signal,
      timeoutMs,
    )
    if (!verification || signal?.aborted) return false
    const [pinned, session, canonical] = verification
    return (
      !pinned.error &&
      pinned.data.user?.id === expectedHouseholdId &&
      !session.error &&
      !!session.data.session?.access_token &&
      session.data.session.user.id === expectedHouseholdId &&
      !canonical.error &&
      canonical.data.user?.id === expectedHouseholdId
    )
  } catch {
    return false
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

function parseServerRevision(value: unknown): string | null {
  if (
    (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) ||
    (typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0)
  ) {
    return String(value)
  }
  return null
}

function parseSnapshot(value: unknown): CloudPullResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'The cloud returned an invalid sync snapshot.' }
  }
  const snapshot = value as Record<string, unknown>
  const revision = parseServerRevision(snapshot.revision)
  const rows = validateRemoteProfileRows(snapshot.rows)
  if (!revision || !rows.ok) {
    return {
      ok: false,
      error: rows.ok ? 'The cloud returned an invalid revision.' : rows.error,
    }
  }
  return { ok: true, rows: rows.rows, revision }
}

/** Pull failures remain failures; an empty array is returned only on a successful query. */
export async function pullProfiles(
  client = getSupabaseClient(),
  signal?: AbortSignal,
): Promise<CloudPullResult> {
  if (!client) return { ok: false, error: 'Cloud sync is not configured.' }
  try {
    let query = client.rpc('academy_sync_snapshot')
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) return { ok: false, error: error.message }
    return parseSnapshot(data)
  } catch {
    return {
      ok: false,
      error: 'Network error while reading cloud data. Retry when online.',
    }
  }
}

export async function pushProfiles(
  rows: RemoteProfileRow[],
  expectedRevision: string,
  mutationId: string,
  verifiedContext: unknown,
  expectedHouseholdId: string,
  dispatchStillAuthorized: () => boolean,
  signal?: AbortSignal,
  verificationClient = getSupabaseClient(),
  createWriteClient: (
    accessToken: string,
  ) => SupabaseClient = (accessToken) =>
    createClient(supabaseUrl(), supabaseAnonKey(), {
      accessToken: async () => accessToken,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
): Promise<CloudPushResult> {
  if (rows.length === 0) return { ok: true, revision: expectedRevision }
  if (!supabaseConfigured())
    return { ok: false, error: 'Cloud sync is not configured.' }
  if (
    !isVerifiedAuthContext(verifiedContext) ||
    verifiedContext.user.id !== expectedHouseholdId ||
    !dispatchStillAuthorized() ||
    !(await verifyPinnedAuthContext(
      verifiedContext,
      expectedHouseholdId,
      verificationClient,
      signal,
    ))
  ) {
    return {
      ok: false,
      error:
        'An exact server-verified household access token is required for cloud writes.',
    }
  }
  if (!dispatchStillAuthorized() || signal?.aborted) {
    return {
      ok: false,
      error: 'The household session changed before cloud write dispatch.',
    }
  }
  try {
    const validation = validateRemoteProfileRows(rows)
    if (!validation.ok) return { ok: false, error: validation.error }
    const payload = profileRowsForMutation(validation.rows)
    const writeClient = createWriteClient(verifiedContext.accessToken)
    let query = writeClient.rpc('academy_apply_profile_mutation', {
      p_expected_revision: expectedRevision,
      p_mutation_id: mutationId,
      p_profiles: payload,
    })
    if (signal) query = query.abortSignal(signal)
    // Creating a PostgREST builder is inert. This is the final synchronous
    // authorization check immediately before awaiting it starts the request.
    if (!dispatchStillAuthorized() || signal?.aborted) {
      return {
        ok: false,
        error: 'The household authorization changed at mutation dispatch.',
      }
    }
    const { data, error } = await query
    if (error) {
      return {
        ok: false,
        error: redactAccessToken(error.message, verifiedContext.accessToken),
      }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'The cloud returned an invalid CAS result.' }
    }
    const result = data as Record<string, unknown>
    const revision = parseServerRevision(result.revision)
    if (!revision) {
      return { ok: false, error: 'The cloud returned an invalid CAS revision.' }
    }
    if (result.status === 'conflict') {
      return {
        ok: false,
        conflict: true,
        revision,
        error:
          'Another device updated this household first. Review the refreshed cloud data.',
      }
    }
    if (result.status === 'applied' || result.status === 'replayed') {
      return {
        ok: true,
        revision,
        ...(result.status === 'replayed' ? { replayed: true } : {}),
      }
    }
    return { ok: false, error: 'The cloud returned an unknown CAS result.' }
  } catch {
    return {
      ok: false,
      error: 'Network error while writing cloud data. Retry when online.',
    }
  }
}

export function profileRowsForMutation(rows: RemoteProfileRow[]) {
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
