import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  ADMIN_CONFIGURATION_INTEGRATION_STATUS,
  isAdminConfigurationKey,
  isAdminConfigurationValue,
  sanitizeAdminRuntimeConfigurationProjection,
  type AdminConfigurationKey,
  type AdminRuntimeConfigurationProjection,
  type AdminConfigurationValue,
} from './configurationModel'
import type { AdminConfigurationReasonCode } from './configurationUiModel'

export const ADMIN_CONFIGURATION_ENDPOINT = '/api/admin/v1/configuration'
export const ADMIN_CONFIGURATION_PREVIEW_ENDPOINT = '/api/admin/v1/configuration/preview'
export const ADMIN_CONFIGURATION_COMMIT_ENDPOINT = '/api/admin/v1/configuration/commit'

export type AdminConfigurationErrorCode =
  | 'configuration_unauthorized'
  | 'configuration_timeout'
  | 'configuration_unavailable'
  | 'revision_conflict'
  | 'idempotency_conflict'
  | 'confirmation_expired'
  | 'confirmation_reused'
  | 'request_in_progress'
  | 'confirmation_invalid'
  | 'confirmation_mismatch'
  | 'cross_setting_invalid'
  | 'value_invalid'
  | 'unknown_key'
  | 'invalid_request'

export class AdminConfigurationError extends Error {
  constructor(readonly code: AdminConfigurationErrorCode) {
    super(code)
    this.name = 'AdminConfigurationError'
  }
}

export interface AdminConfigurationChangeRequest {
  readonly settingKey: AdminConfigurationKey
  readonly expectedRevision: string
  readonly newValue: AdminConfigurationValue
  readonly reasonCode: AdminConfigurationReasonCode
}

export interface AdminConfigurationPreview {
  readonly schemaVersion: 2
  readonly settingKey: AdminConfigurationKey
  readonly currentValue: AdminConfigurationValue
  readonly newValue: AdminConfigurationValue
  readonly expectedRevision: string
  readonly warningLevel: 'warning' | 'critical'
  readonly confirmationId: string
  readonly confirmationExpiresAt: string
  readonly confirmationToken: string
  readonly integrationStatus: typeof ADMIN_CONFIGURATION_INTEGRATION_STATUS
}

export interface AdminConfigurationCommitRequest extends AdminConfigurationChangeRequest {
  readonly requestId: string
  readonly confirmationToken: string
}

export interface AdminConfigurationCommitResult {
  readonly schemaVersion: 2
  readonly settingKey: AdminConfigurationKey
  readonly value: AdminConfigurationValue
  readonly revision: string
  readonly idempotencyResult: 'created' | 'replayed'
  readonly integrationStatus: typeof ADMIN_CONFIGURATION_INTEGRATION_STATUS
}

type FetchLike = (url: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export interface AdminConfigurationSourceOptions {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly timeoutMs?: number
}

export interface AdminConfigurationRequestOptions {
  readonly signal?: AbortSignal
}

export interface AdminConfigurationSource {
  read(options?: AdminConfigurationRequestOptions): Promise<AdminRuntimeConfigurationProjection>
  preview(
    request: AdminConfigurationChangeRequest,
    options?: AdminConfigurationRequestOptions,
  ): Promise<AdminConfigurationPreview>
  commit(
    request: AdminConfigurationCommitRequest,
    options?: AdminConfigurationRequestOptions,
  ): Promise<AdminConfigurationCommitResult>
}

const REVISION = /^[1-9]\d*$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONFIRMATION_TOKEN = /^[A-Za-z0-9_-]{43}$/
const SOURCE_CODES = new Set<AdminConfigurationErrorCode>([
  'revision_conflict', 'idempotency_conflict', 'confirmation_expired',
  'confirmation_reused', 'request_in_progress', 'confirmation_invalid',
  'confirmation_mismatch', 'cross_setting_invalid', 'value_invalid',
  'unknown_key', 'invalid_request',
])

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index])
}

function sameValue(left: AdminConfigurationValue, right: AdminConfigurationValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index])
  }
  return left === right
}

function parsePreview(value: unknown): AdminConfigurationPreview | null {
  const source = record(value)
  if (!source || !exactKeys(source, [
    'schemaVersion', 'settingKey', 'currentValue', 'newValue', 'expectedRevision',
    'warningLevel', 'confirmationId', 'confirmationExpiresAt', 'integrationStatus',
    'confirmationToken',
  ])) return null
  if (source.schemaVersion !== 2
    || !isAdminConfigurationKey(source.settingKey)
    || !isAdminConfigurationValue(source.settingKey, source.currentValue)
    || !isAdminConfigurationValue(source.settingKey, source.newValue)
    || typeof source.expectedRevision !== 'string' || !REVISION.test(source.expectedRevision)
    || (source.warningLevel !== 'warning' && source.warningLevel !== 'critical')
    || typeof source.confirmationId !== 'string' || !UUID.test(source.confirmationId)
    || typeof source.confirmationExpiresAt !== 'string'
    || !Number.isFinite(Date.parse(source.confirmationExpiresAt))
    || typeof source.confirmationToken !== 'string'
    || !CONFIRMATION_TOKEN.test(source.confirmationToken)
    || source.integrationStatus !== ADMIN_CONFIGURATION_INTEGRATION_STATUS) return null
  return Object.freeze(source as unknown as AdminConfigurationPreview)
}

function parseCommit(value: unknown): AdminConfigurationCommitResult | null {
  const source = record(value)
  if (!source || !exactKeys(source, [
    'schemaVersion', 'settingKey', 'value', 'revision', 'idempotencyResult',
    'integrationStatus',
  ])) return null
  if (source.schemaVersion !== 2
    || !isAdminConfigurationKey(source.settingKey)
    || !isAdminConfigurationValue(source.settingKey, source.value)
    || typeof source.revision !== 'string' || !REVISION.test(source.revision)
    || (source.idempotencyResult !== 'created' && source.idempotencyResult !== 'replayed')
    || source.integrationStatus !== ADMIN_CONFIGURATION_INTEGRATION_STATUS) return null
  return Object.freeze(source as unknown as AdminConfigurationCommitResult)
}

async function responseError(response: { readonly status: number; json(): Promise<unknown> }) {
  let code: string | null = null
  try {
    const body = record(await response.json())
    const error = record(body?.error)
    if (body && error && exactKeys(body, ['error']) && exactKeys(error, ['code'])
      && typeof error.code === 'string') code = error.code
  } catch {
    // Error bodies are untrusted and never surfaced.
  }
  if (response.status === 401 || response.status === 403) {
    return new AdminConfigurationError('configuration_unauthorized')
  }
  if (response.status === 504 || code === 'configuration_source_timeout') {
    return new AdminConfigurationError('configuration_timeout')
  }
  if (code && SOURCE_CODES.has(code as AdminConfigurationErrorCode)) {
    return new AdminConfigurationError(code as AdminConfigurationErrorCode)
  }
  return new AdminConfigurationError('configuration_unavailable')
}

export function createAdminConfigurationHttpSource(
  dependencies: AdminConfigurationSourceOptions = {},
): AdminConfigurationSource {
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const getAccessToken = dependencies.getAccessToken ?? getGatewayAccessToken

  async function request(
    endpoint: string,
    method: 'GET' | 'POST',
    body: AdminConfigurationChangeRequest | AdminConfigurationCommitRequest | null,
    options: AdminConfigurationRequestOptions,
  ): Promise<unknown> {
    const controller = new AbortController()
    const forwardAbort = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', forwardAbort, { once: true })
    if (options.signal?.aborted) controller.abort(options.signal.reason)
    const timer = globalThis.setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 10_000)
    try {
      const token = await getAccessToken()
      if (!token || controller.signal.aborted) {
        throw new AdminConfigurationError('configuration_unauthorized')
      }
      const response = await fetchImpl(endpoint, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      })
      if (response.status !== 200) throw await responseError(response)
      return await response.json()
    } catch (error) {
      if (error instanceof AdminConfigurationError) throw error
      throw new AdminConfigurationError(
        controller.signal.aborted ? 'configuration_timeout' : 'configuration_unavailable',
      )
    } finally {
      globalThis.clearTimeout(timer)
      options.signal?.removeEventListener('abort', forwardAbort)
    }
  }

  return Object.freeze({
    async read(options = {}) {
      const projection = sanitizeAdminRuntimeConfigurationProjection(
        await request(ADMIN_CONFIGURATION_ENDPOINT, 'GET', null, options),
      )
      if (!projection) throw new AdminConfigurationError('configuration_unavailable')
      return projection
    },
    async preview(change: AdminConfigurationChangeRequest, options: AdminConfigurationRequestOptions = {}) {
      const preview = parsePreview(
        await request(ADMIN_CONFIGURATION_PREVIEW_ENDPOINT, 'POST', change, options),
      )
      if (!preview
        || preview.settingKey !== change.settingKey
        || preview.expectedRevision !== change.expectedRevision
        || !sameValue(preview.newValue, change.newValue)) {
        throw new AdminConfigurationError('configuration_unavailable')
      }
      return preview
    },
    async commit(change: AdminConfigurationCommitRequest, options: AdminConfigurationRequestOptions = {}) {
      const result = parseCommit(
        await request(ADMIN_CONFIGURATION_COMMIT_ENDPOINT, 'POST', change, options),
      )
      if (!result
        || result.settingKey !== change.settingKey
        || !sameValue(result.value, change.newValue)) {
        throw new AdminConfigurationError('configuration_unavailable')
      }
      return result
    },
  })
}
