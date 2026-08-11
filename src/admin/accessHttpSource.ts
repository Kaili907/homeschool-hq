import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  sanitizeAdminAccessMutationResult,
  sanitizeAdminAccessProjection,
  type AdminAccessMutationRequest,
  type AdminAccessMutationResult,
  type AdminAccessProjection,
} from './accessModel'

export const ADMIN_ACCESS_ENDPOINT = '/api/admin/v1/access'
const ACCESS_TIMEOUT_MS = 5_000

export type AdminAccessErrorCode =
  | 'access_unauthorized'
  | 'access_timeout'
  | 'access_unavailable'
  | 'access_malformed'
  | 'access_conflict'
  | 'sole_owner_protected'
  | 'idempotency_conflict'

export class AdminAccessError extends Error {
  constructor(readonly code: AdminAccessErrorCode) {
    super(code)
    this.name = 'AdminAccessError'
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export interface AdminAccessHttpSourceOptions {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly timeoutMs?: number
}

function mutationError(status: number, body: unknown): AdminAccessErrorCode {
  const code = body && typeof body === 'object' && !Array.isArray(body)
    && 'error' in body && body.error && typeof body.error === 'object'
    && !Array.isArray(body.error) && 'code' in body.error
    ? body.error.code : null
  if (status === 401 || status === 403) return 'access_unauthorized'
  if (status === 504) return 'access_timeout'
  if (code === 'sole_owner_protected') return 'sole_owner_protected'
  if (code === 'idempotency_conflict') return 'idempotency_conflict'
  if (status === 409) return 'access_conflict'
  return 'access_unavailable'
}

export function createAdminAccessHttpSource(options: AdminAccessHttpSourceOptions = {}) {
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? ACCESS_TIMEOUT_MS

  async function tokenAndSignal(externalSignal?: AbortSignal) {
    const token = await getAccessToken()
    if (!token || externalSignal?.aborted) throw new AdminAccessError('access_unauthorized')
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : timeoutSignal
    return { token, signal, timeoutSignal }
  }

  return Object.freeze({
    async read({ signal: externalSignal }: { readonly signal?: AbortSignal } = {}): Promise<AdminAccessProjection> {
      const { token, signal, timeoutSignal } = await tokenAndSignal(externalSignal)
      try {
        const response = await fetchImpl(ADMIN_ACCESS_ENDPOINT, {
          method: 'GET',
          signal,
          headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        })
        if (response.status === 401 || response.status === 403) {
          throw new AdminAccessError('access_unauthorized')
        }
        if (response.status === 504) throw new AdminAccessError('access_timeout')
        if (response.status !== 200) throw new AdminAccessError('access_unavailable')
        const projection = sanitizeAdminAccessProjection(await response.json())
        if (!projection) throw new AdminAccessError('access_malformed')
        return projection
      } catch (error) {
        if (error instanceof AdminAccessError) throw error
        throw new AdminAccessError(timeoutSignal.aborted ? 'access_timeout' : 'access_unavailable')
      }
    },

    async mutate(request: AdminAccessMutationRequest): Promise<AdminAccessMutationResult> {
      const { action, ...body } = request
      const { token, signal, timeoutSignal } = await tokenAndSignal()
      try {
        const response = await fetchImpl(`${ADMIN_ACCESS_ENDPOINT}/${action}`, {
          method: 'POST',
          signal,
          headers: {
            authorization: `Bearer ${token}`,
            accept: 'application/json',
            'content-type': 'application/json',
          },
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          body: JSON.stringify(body),
        })
        const value = await response.json().catch(() => null)
        if (response.status !== 200) throw new AdminAccessError(mutationError(response.status, value))
        const result = sanitizeAdminAccessMutationResult(value)
        if (!result) throw new AdminAccessError('access_malformed')
        return result
      } catch (error) {
        if (error instanceof AdminAccessError) throw error
        throw new AdminAccessError(timeoutSignal.aborted ? 'access_timeout' : 'access_unavailable')
      }
    },
  })
}

export type AdminAccessHttpSource = ReturnType<typeof createAdminAccessHttpSource>
