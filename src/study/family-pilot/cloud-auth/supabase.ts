import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCurrentSession,
  getSupabaseClient,
  getVerifiedAuthContext,
  supabaseAnonKey,
  supabaseUrl,
  type VerifiedAuthContext,
} from '../../../auth/supabaseSession'
import { FAMILY_PILOT_PATH, FAMILY_PILOT_RESET_PASSWORD_PATH } from '../core/route'
import { FamilyCloudAuthCoordinator, type FamilyCloudAuthCoordinatorOptions } from './coordinator'
import { createLinkedFamilyDeviceStore } from './deviceStore'
import type {
  FamilyCloudAuthRuntime,
  FamilyCloudIdentityContext,
  FamilyCloudIdentityPort,
  FamilyCloudLocalDataPort,
  FamilyHouseholdAuthorityPort,
  FamilyHouseholdAuthorityResult,
} from './types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const FAMILY_CLOUD_PATH = FAMILY_PILOT_PATH
export const FAMILY_CLOUD_PASSWORD_RECOVERY_PATH = FAMILY_PILOT_RESET_PASSWORD_PATH

export function familyCloudRedirectTo(path: typeof FAMILY_CLOUD_PATH | typeof FAMILY_CLOUD_PASSWORD_RECOVERY_PATH): string | undefined {
  if (typeof window === 'undefined' || !window.location.origin) return undefined
  return new URL(path, window.location.origin).toString()
}

async function currentContext(
  client: SupabaseClient | null,
  signal?: AbortSignal,
): Promise<FamilyCloudIdentityContext | null> {
  if (!client || signal?.aborted) return null
  const session = await getCurrentSession(client)
  if (!session?.expires_at || session.expires_at * 1_000 <= Date.now()) return null
  const authorization = await getVerifiedAuthContext(client, signal)
  if (!authorization || authorization.user.id !== session.user.id) return null
  return Object.freeze({
    authorization,
    expiresAt: new Date(session.expires_at * 1_000).toISOString(),
  })
}

export function createSupabaseFamilyCloudIdentity(
  client: SupabaseClient | null = getSupabaseClient(),
): FamilyCloudIdentityPort {
  return Object.freeze({
    current: (signal?: AbortSignal) => currentContext(client, signal),
    async signIn(email: string, password: string, signal?: AbortSignal) {
      if (!client || signal?.aborted) return Object.freeze({ status: 'UNAVAILABLE' as const })
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) {
        return Object.freeze({
          status: error.status === 400 || error.status === 401
            ? 'INVALID_CREDENTIALS' as const
            : 'UNAVAILABLE' as const,
        })
      }
      const context = await currentContext(client, signal)
      return context
        ? Object.freeze({ status: 'SIGNED_IN' as const, context })
        : Object.freeze({ status: 'UNAVAILABLE' as const })
    },
    async signUp(email: string, password: string, signal?: AbortSignal) {
      if (!client || signal?.aborted) return Object.freeze({ status: 'UNAVAILABLE' as const })
      const emailRedirectTo = familyCloudRedirectTo(FAMILY_CLOUD_PATH)
      const { data, error } = await client.auth.signUp({
        email,
        password,
        ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
      })
      if (error) {
        return Object.freeze({
          status: error.status === 400 || error.status === 401 || error.status === 422
            ? 'INVALID_CREDENTIALS' as const
            : 'UNAVAILABLE' as const,
        })
      }
      if (!data.session && data.user) return Object.freeze({ status: 'CONFIRM_EMAIL' as const })
      const context = await currentContext(client, signal)
      return context
        ? Object.freeze({ status: 'SIGNED_IN' as const, context })
        : Object.freeze({ status: 'UNAVAILABLE' as const })
    },
    async requestPasswordRecovery(email: string, signal?: AbortSignal) {
      if (!client || signal?.aborted) return 'UNAVAILABLE' as const
      const redirectTo = familyCloudRedirectTo(FAMILY_CLOUD_PASSWORD_RECOVERY_PATH)
      if (!redirectTo) return 'UNAVAILABLE' as const
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
      return error || signal?.aborted ? 'UNAVAILABLE' as const : 'SENT' as const
    },
    async requestMagicLink(email: string, signal?: AbortSignal) {
      if (!client || signal?.aborted) return 'UNAVAILABLE' as const
      const emailRedirectTo = familyCloudRedirectTo(FAMILY_CLOUD_PATH)
      if (!emailRedirectTo) return 'UNAVAILABLE' as const
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo, shouldCreateUser: false },
      })
      return error || signal?.aborted ? 'UNAVAILABLE' as const : 'SENT' as const
    },
    async signOut() {
      if (client) await client.auth.signOut()
    },
  })
}

function membershipRows(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > 2) return null
  const householdRefs: string[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const row = item as Record<string, unknown>
    const household = row.academy_households
    if (
      Object.keys(row).length !== 2 ||
      typeof row.household_id !== 'string' || !UUID.test(row.household_id) ||
      !household || typeof household !== 'object' || Array.isArray(household) ||
      Object.keys(household).length !== 1 ||
      (household as Record<string, unknown>).status !== 'active'
    ) return null
    householdRefs.push(row.household_id)
  }
  return Object.freeze([...new Set(householdRefs)])
}

/**
 * Canonical household membership lookup. The pinned access token supplies
 * auth.uid() to the existing RLS policy; no caller-provided household is sent.
 */
export function createSupabaseFamilyHouseholdAuthority(options: {
  readonly url?: string
  readonly anonKey?: string
  readonly fetchImpl?: typeof fetch
  readonly bootstrap?: (context: VerifiedAuthContext, signal?: AbortSignal) => Promise<string | null>
} = {}): FamilyHouseholdAuthorityPort {
  const url = (options.url ?? supabaseUrl()).replace(/\/+$/, '')
  const anonKey = options.anonKey ?? supabaseAnonKey()
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  return Object.freeze({
    async resolve(context: VerifiedAuthContext, signal?: AbortSignal): Promise<FamilyHouseholdAuthorityResult> {
      if (!url || !anonKey || !UUID.test(context.user.id) || signal?.aborted) {
        return Object.freeze({ status: 'UNAVAILABLE' })
      }
      const endpoint = new URL(`${url}/rest/v1/academy_household_memberships`)
      endpoint.searchParams.set('select', 'household_id,academy_households!inner(status)')
      endpoint.searchParams.set('user_id', `eq.${context.user.id}`)
      endpoint.searchParams.set('status', 'eq.active')
      endpoint.searchParams.set('revoked_at', 'is.null')
      endpoint.searchParams.set('academy_households.status', 'eq.active')
      endpoint.searchParams.set('limit', '2')
      let response: Response
      try {
        response = await fetchImpl(endpoint, {
          method: 'GET', redirect: 'error', signal,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${context.accessToken}`,
            accept: 'application/json',
          },
        })
      } catch { return Object.freeze({ status: 'UNAVAILABLE' }) }
      if (response.status === 401 || response.status === 403) return Object.freeze({ status: 'UNAVAILABLE' })
      if (!response.ok) return Object.freeze({ status: 'UNAVAILABLE' })
      let rows: readonly string[] | null
      try { rows = membershipRows(await response.json()) } catch { rows = null }
      if (!rows) return Object.freeze({ status: 'UNAVAILABLE' })
      if (rows.length === 0 && options.bootstrap) {
        const householdRef = await options.bootstrap(context, signal).catch(() => null)
        return householdRef && UUID.test(householdRef)
          ? Object.freeze({ status: 'RESOLVED', householdRef })
          : Object.freeze({ status: 'NO_ACTIVE_HOUSEHOLD' })
      }
      if (rows.length === 0) return Object.freeze({ status: 'NO_ACTIVE_HOUSEHOLD' })
      if (rows.length > 1) return Object.freeze({ status: 'AMBIGUOUS_HOUSEHOLD' })
      return Object.freeze({ status: 'RESOLVED', householdRef: rows[0] })
    },
  })
}

export function createSupabaseFamilyCloudAuth(options: {
  readonly localData: FamilyCloudLocalDataPort
  readonly client?: SupabaseClient | null
  readonly authority?: FamilyHouseholdAuthorityPort
  readonly coordinator?: Omit<FamilyCloudAuthCoordinatorOptions, 'identity' | 'authority' | 'localData' | 'device'>
}): FamilyCloudAuthRuntime {
  return new FamilyCloudAuthCoordinator({
    identity: createSupabaseFamilyCloudIdentity(options.client),
    authority: options.authority ?? createSupabaseFamilyHouseholdAuthority(),
    localData: options.localData,
    device: createLinkedFamilyDeviceStore(),
    ...options.coordinator,
  })
}
