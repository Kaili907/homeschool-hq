import {
  ADMIN_CONTRACT_VERSION,
  ADMIN_ROLE_CAPABILITIES,
  type AdminCapability,
  type AdminRole,
  hasAdminCapability,
} from './contracts'
import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from './adminDependencyTimeout'

export const ADMIN_AUTHORIZATION_ENDPOINT = '/api/admin/v1/authorization'
export const ADMIN_AUTHORIZATION_TIMEOUT_MS = 5_000

export type AdminAuthorizationState =
  | {
      readonly contractVersion: typeof ADMIN_CONTRACT_VERSION
      readonly status: 'authorized'
      readonly role: AdminRole
      readonly capabilities: readonly AdminCapability[]
    }
  | { readonly status: 'unauthenticated' | 'forbidden' | 'unavailable' }

type FetchLike = (url: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export interface ReadAdminAuthorizationOptions {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

function exactAuthorization(value: unknown): AdminAuthorizationState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 4 ||
    record.contractVersion !== ADMIN_CONTRACT_VERSION ||
    record.status !== 'authorized' ||
    typeof record.role !== 'string' ||
    !Object.hasOwn(ADMIN_ROLE_CAPABILITIES, record.role) ||
    !Array.isArray(record.capabilities)
  ) return null

  const role = record.role as AdminRole
  const expected = ADMIN_ROLE_CAPABILITIES[role]
  if (
    record.capabilities.length !== expected.length ||
    record.capabilities.some((capability, index) => capability !== expected[index])
  ) return null

  return Object.freeze({
    contractVersion: ADMIN_CONTRACT_VERSION,
    status: 'authorized',
    role,
    capabilities: Object.freeze([...expected]),
  })
}

/**
 * Loads advisory browser state for the Admin route. This state may decide what
 * to render, but it never authorizes data or actions; every Admin API must call
 * the server-side capability boundary again.
 */
export async function readAdminAuthorization(
  options: ReadAdminAuthorizationOptions = {},
): Promise<AdminAuthorizationState> {
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init))

  let accessToken: string | null
  try {
    accessToken = await withAdminDependencyTimeout(
      () => getAccessToken(), options.timeoutMs ?? ADMIN_AUTHORIZATION_TIMEOUT_MS,
    )
  } catch {
    return { status: 'unavailable' }
  }
  if (options.signal?.aborted) return { status: 'unavailable' }
  if (!accessToken) return { status: 'unauthenticated' }

  const controller = new AbortController()
  const cancel = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', cancel, { once: true })
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? ADMIN_AUTHORIZATION_TIMEOUT_MS,
  )
  try {
    const response = await withAdminDependencyTimeout(
      (timeoutSignal) => fetchImpl(ADMIN_AUTHORIZATION_ENDPOINT, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.any([controller.signal, timeoutSignal]),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      }),
      options.timeoutMs ?? ADMIN_AUTHORIZATION_TIMEOUT_MS,
    )
    if (response.status === 401) return { status: 'unauthenticated' }
    if (response.status === 403) return { status: 'forbidden' }
    if (response.status !== 200) return { status: 'unavailable' }
    return exactAuthorization(await response.json()) ?? { status: 'unavailable' }
  } catch {
    return { status: 'unavailable' }
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
  }
}

/** Advisory ADMIN-5 UI guard only. Server capability checks remain authoritative. */
export function hasAdminAuthorizationCapability(
  state: AdminAuthorizationState,
  capability: AdminCapability,
): boolean {
  return (
    state.status === 'authorized' &&
    hasAdminCapability(state.role, capability) &&
    state.capabilities.includes(capability)
  )
}
