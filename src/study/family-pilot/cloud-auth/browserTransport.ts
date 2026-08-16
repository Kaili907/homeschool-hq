import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { getVerifiedAuthContext, type VerifiedAuthContext } from '../../../auth/supabaseSession'
import {
  HOSTED_SYNC_OUTCOME_CODES,
  type HostedSyncAuthenticatedRpcProvider,
  type HostedSyncEphemeralAuthorization,
  type HostedSyncOutcomeCode,
  type HostedSyncRpcName,
  type HostedSyncRpcProviderResult,
} from '../../hosted-sync/v2/client'
import type {
  FamilyCloudRemoteDirectoryPortR1,
  FamilyCloudRemoteDirectoryResultR1,
} from './hostedLocalDataPort'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const DIGEST = /^[0-9a-f]{64}$/u
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/u

function validTimeZone(value: string): boolean {
  if (!value || value.length > 80) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0)); return true } catch { return false }
}

function detectedTimeZone(): string {
  const value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  return validTimeZone(value) ? value : 'UTC'
}

function sessionExpiry(session: Session): string | null {
  if (!session.expires_at) return null
  const expiresAt = new Date(session.expires_at * 1_000).toISOString()
  return Date.parse(expiresAt) > Date.now() ? expiresAt : null
}

function errorResult(error: unknown): HostedSyncRpcProviderResult {
  const held = error as { status?: number; code?: string; message?: string } | null
  const status = held?.status ?? null
  let code: Exclude<HostedSyncOutcomeCode, 'SUCCESS' | 'OFFLINE' | 'AUTH_REQUIRED' | 'MALFORMED_RESPONSE'> = 'SERVER_UNAVAILABLE'
  if (status === 401 || status === 403) code = 'SESSION_EXPIRED'
  else if (status === 408) code = 'TIMEOUT'
  else if (status === 429) code = 'RATE_LIMITED'
  else if (status !== null && status >= 400 && status < 500) code = 'PERMANENT_REFUSAL'
  return Object.freeze({ data: null, error: Object.freeze({ code, httpStatus: status, reasonCode: held?.code ?? null }) })
}

/** Supabase owns bearer attachment and refresh; this provider exposes only the approved RPC names. */
export function createSupabaseHostedSyncRpcProvider(
  client: SupabaseClient,
  expectedUserId: string,
  expectedAccessToken: string,
): HostedSyncAuthenticatedRpcProvider {
  return Object.freeze({
    async rpc(name: HostedSyncRpcName, args: Readonly<Record<string, unknown>>, signal?: AbortSignal) {
      if (signal?.aborted) return Object.freeze({ data: null, error: Object.freeze({ code: 'ABORTED' as const }) })
      const verified = await getVerifiedAuthContext(client, signal)
      if (!verified || verified.user.id !== expectedUserId || verified.accessToken !== expectedAccessToken) {
        return Object.freeze({ data: null, error: Object.freeze({ code: 'SESSION_EXPIRED' as const }) })
      }
      try {
        const query = client.rpc(name, args)
        const result = await query.abortSignal(signal ?? new AbortController().signal)
        return result.error ? errorResult(result.error) : Object.freeze({ data: result.data, error: null })
      } catch (error) { return errorResult(error) }
    },
  })
}

/**
 * Each call gets a freshly provider-verified user/session pair. The lease is
 * pinned to that exact user and token; refresh, sign-out, or account switching
 * invalidates it before a later RPC can dispatch.
 */
export function createSupabaseHostedSyncAuthorization(
  client: SupabaseClient,
): HostedSyncEphemeralAuthorization {
  return Object.freeze({
    async acquire(signal?: AbortSignal) {
      if (signal?.aborted) return Object.freeze({ status: 'AUTH_REQUIRED' as const })
      const [{ data, error }, verified] = await Promise.all([
        client.auth.getSession(),
        getVerifiedAuthContext(client, signal),
      ])
      const session = data.session
      const expiresAt = session ? sessionExpiry(session) : null
      if (error || !session || !verified) return Object.freeze({ status: 'AUTH_REQUIRED' as const })
      if (!expiresAt || session.user.id !== verified.user.id || session.access_token !== verified.accessToken) {
        return Object.freeze({ status: 'SESSION_EXPIRED' as const })
      }
      let released = false
      const provider = createSupabaseHostedSyncRpcProvider(client, verified.user.id, verified.accessToken)
      return Object.freeze({
        status: 'AUTHORIZED' as const,
        lease: Object.freeze({
          clientKind: 'AUTHENTICATED_USER' as const,
          expiresAt,
          provider: Object.freeze({
            rpc(name: HostedSyncRpcName, args: Readonly<Record<string, unknown>>, rpcSignal?: AbortSignal) {
              if (released) return Promise.resolve(Object.freeze({ data: null, error: Object.freeze({ code: 'ABORTED' as const }) }))
              return provider.rpc(name, args, rpcSignal)
            },
          }),
          release() { released = true },
        }),
      })
    },
  })
}

export interface FamilyCloudBootstrapLearnerR1 {
  readonly learnerRef: string
  readonly displayName: string
  readonly gradeLevel: string | null
}

interface BootstrapResult {
  readonly schemaVersion: 1
  readonly status: 'ready'
  readonly householdRef: string
  readonly learners: readonly Readonly<{
    learnerRef: string
    hostedStudentId: string
    tokenDigest: string
    hostedAssignmentRef: string
    hostedSessionRef: string
  }>[]
}

export async function establishSupabaseFamilyHousehold(
  client: SupabaseClient,
  context: VerifiedAuthContext,
  signal?: AbortSignal,
): Promise<string | null> {
  const verified = await getVerifiedAuthContext(client, signal)
  if (!verified || verified.user.id !== context.user.id || verified.accessToken !== context.accessToken) return null
  try {
    const query = client.rpc('academy_family_cloud_bootstrap_r1', {
      p_local_learners: [], p_household_timezone: detectedTimeZone(),
    })
    const { data, error } = await query.abortSignal(signal ?? new AbortController().signal)
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
    const householdRef = (data as { householdRef?: unknown }).householdRef
    return typeof householdRef === 'string' && UUID.test(householdRef) ? householdRef : null
  } catch { return null }
}

function parseBootstrap(value: unknown, householdRef: string): BootstrapResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const held = value as Partial<BootstrapResult>
  if (held.schemaVersion !== 1 || held.status !== 'ready' || held.householdRef !== householdRef || !Array.isArray(held.learners)) return null
  const learners = held.learners
  if (learners.length > 24 || new Set(learners.map((item) => item.learnerRef)).size !== learners.length) return null
  if (!learners.every((item) => item && REF.test(item.learnerRef) && UUID.test(item.hostedStudentId) &&
    DIGEST.test(item.tokenDigest) && REF.test(item.hostedAssignmentRef) && REF.test(item.hostedSessionRef))) return null
  return held as BootstrapResult
}

/** Narrow onboarding/directory adapter. It receives no household selector. */
export function createSupabaseFamilyCloudRemoteDirectory(options: {
  readonly client: SupabaseClient
  readonly localLearners: (householdRef: string) => readonly FamilyCloudBootstrapLearnerR1[]
  readonly householdTimeZone?: (householdRef: string) => string | Promise<string>
}): FamilyCloudRemoteDirectoryPortR1 {
  return Object.freeze({
    async resolve(input: { householdRef: string; authorization: VerifiedAuthContext; signal?: AbortSignal }): Promise<FamilyCloudRemoteDirectoryResultR1> {
      if (input.signal?.aborted) return Object.freeze({ status: 'UNAVAILABLE' })
      const verified = await getVerifiedAuthContext(options.client, input.signal)
      if (!verified || verified.user.id !== input.authorization.user.id || verified.accessToken !== input.authorization.accessToken) {
        return Object.freeze({ status: 'UNAVAILABLE' })
      }
      const localLearners = options.localLearners(input.householdRef).map((learner) => Object.freeze({
        learnerRef: learner.learnerRef,
        displayName: learner.displayName,
        gradeLevel: learner.gradeLevel,
      }))
      try {
        const householdTimeZone = options.householdTimeZone
          ? await options.householdTimeZone(input.householdRef) : detectedTimeZone()
        if (!validTimeZone(householdTimeZone)) return Object.freeze({ status: 'UNAVAILABLE' })
        const query = options.client.rpc('academy_family_cloud_bootstrap_r1', {
          p_local_learners: localLearners, p_household_timezone: householdTimeZone,
        })
        const { data, error } = await query.abortSignal(input.signal ?? new AbortController().signal)
        if (error) return Object.freeze({ status: 'UNAVAILABLE' })
        const parsed = parseBootstrap(data, input.householdRef)
        if (!parsed) return Object.freeze({ status: 'UNAVAILABLE' })
        return Object.freeze({ status: 'READY', learners: Object.freeze(parsed.learners.map((learner) => Object.freeze({
          learnerRef: learner.learnerRef,
          hostedStudentId: learner.hostedStudentId,
          tokenDigest: learner.tokenDigest,
          hostedScope: Object.freeze({ assignmentRef: learner.hostedAssignmentRef, sessionRef: learner.hostedSessionRef }),
        }))) })
      } catch { return Object.freeze({ status: 'UNAVAILABLE' }) }
    },
  })
}

export function isHostedSyncProviderOutcomeCode(value: string): value is HostedSyncOutcomeCode {
  return HOSTED_SYNC_OUTCOME_CODES.includes(value as HostedSyncOutcomeCode)
}
