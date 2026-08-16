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

export class MutationDispatchAuthorizationError extends Error {
  readonly code = 'ACADEMY_SYNC_DISPATCH_DENIED'

  constructor() {
    super('The household authorization changed at mutation dispatch.')
    this.name = 'MutationDispatchAuthorizationError'
  }
}

type FetchLike = typeof globalThis.fetch

export type PinnedWriteClientFactory = (
  accessToken: string,
  guardedFetch: FetchLike,
) => SupabaseClient

function combinedAbortSignal(
  operationSignal: AbortSignal | undefined,
  sdkSignal: AbortSignal | null | undefined,
): AbortSignal | undefined {
  if (!operationSignal) return sdkSignal ?? undefined
  if (!sdkSignal || sdkSignal === operationSignal) return operationSignal
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([operationSignal, sdkSignal])
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (operationSignal.aborted || sdkSignal.aborted) {
    controller.abort()
  } else {
    operationSignal.addEventListener('abort', abort, { once: true })
    sdkSignal.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}

/**
 * The SDK performs asynchronous token/header preparation before invoking this
 * operation-scoped wrapper. Authorization is therefore checked here, at the
 * true fetch boundary, and native fetch is invoked in the same synchronous
 * stack frame when the check succeeds.
 */
export function guardedMutationFetch(
  dispatchStillAuthorized: () => boolean,
  operationSignal: AbortSignal | undefined,
  nativeFetch: FetchLike,
  authorizeAtBoundary?: () => Promise<boolean>,
): FetchLike {
  return (input, init) => {
    const dispatch = () => {
      const requestSignal =
        typeof Request !== 'undefined' && input instanceof Request
          ? input.signal
          : undefined
      const signal = combinedAbortSignal(
        operationSignal,
        init?.signal ?? requestSignal,
      )
      if (
        operationSignal?.aborted ||
        signal?.aborted ||
        !dispatchStillAuthorized()
      ) {
        return Promise.reject(new MutationDispatchAuthorizationError())
      }
      return nativeFetch(input, { ...init, ...(signal ? { signal } : {}) })
    }
    if (!authorizeAtBoundary) return dispatch()
    return authorizeAtBoundary().then((authorized) => {
      if (!authorized) throw new MutationDispatchAuthorizationError()
      return dispatch()
    })
  }
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

/**
 * Terminal session teardown must not depend on a subscriber. A throwing
 * listener is reported and contained; the returned unsubscribe is idempotent
 * and swallows SDK errors; and a late fire from the SDK after unsubscribe is
 * ignored so an async race cannot restore ended session state.
 */
export function onAuthSessionChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
  client = getSupabaseClient(),
): () => void {
  if (!client) return () => undefined
  let terminated = false
  const shielded = (event: AuthChangeEvent, session: Session | null): void => {
    if (terminated) return
    try {
      callback(event, session)
    } catch (cause) {
      reportAuthListenerFailure(event, cause)
    }
  }
  const { data } = client.auth.onAuthStateChange(shielded)
  return () => {
    if (terminated) return
    terminated = true
    try {
      data.subscription.unsubscribe()
    } catch (cause) {
      reportAuthListenerFailure('unsubscribe', cause)
    }
  }
}

function reportAuthListenerFailure(context: unknown, cause: unknown): void {
  try {
    // Reporting must never itself block session teardown.
    // eslint-disable-next-line no-console
    console.error('[sync/auth-session] listener failed for', context, cause)
  } catch {
    // ignored
  }
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
  createWriteClient: PinnedWriteClientFactory = (accessToken, guardedFetch) =>
    createClient(supabaseUrl(), supabaseAnonKey(), {
      accessToken: async () => accessToken,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: guardedFetch },
    }),
  nativeFetch: FetchLike = globalThis.fetch,
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
    const fetchAtAuthorizedBoundary = guardedMutationFetch(
      dispatchStillAuthorized,
      signal,
      nativeFetch,
      () =>
        verifyPinnedAuthContext(
          verifiedContext,
          expectedHouseholdId,
          verificationClient,
          signal,
        ),
    )
    const writeClient = createWriteClient(
      verifiedContext.accessToken,
      fetchAtAuthorizedBoundary,
    )
    let query = writeClient.rpc('academy_apply_profile_mutation', {
      p_expected_revision: expectedRevision,
      p_mutation_id: mutationId,
      p_profiles: payload,
    })
    if (signal) query = query.abortSignal(signal)
    // This early check avoids starting SDK preparation for an already-invalid
    // operation. The authoritative check is repeated by guarded fetch after
    // every SDK-internal await and immediately before native fetch.
    if (!dispatchStillAuthorized() || signal?.aborted) {
      return {
        ok: false,
        error: 'The household authorization changed at mutation dispatch.',
      }
    }
    const { data, error } = await query
    if (error) {
      if (
        error.message.includes('MutationDispatchAuthorizationError') ||
        error.message.includes('ACADEMY_SYNC_DISPATCH_DENIED')
      ) {
        return {
          ok: false,
          error: 'The household authorization changed at mutation dispatch.',
        }
      }
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
  } catch (cause) {
    if (cause instanceof MutationDispatchAuthorizationError) {
      return { ok: false, error: cause.message }
    }
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
