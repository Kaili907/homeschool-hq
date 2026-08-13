import {
  buildAcknowledgeRequest,
  buildHydrateRequest,
  buildPullRequest,
  buildPushRequest,
  parseAcknowledgeResponse,
  parseHydrateResponse,
  parsePullResponse,
  parsePushResponse,
} from './contracts'
import type {
  StudySyncAcknowledgeInput,
  StudySyncAcknowledgeResult,
  StudySyncAuthorization,
  StudySyncFailure,
  StudySyncHydrateInput,
  StudySyncHydrateResult,
  StudySyncOperation,
  StudySyncOutcome,
  StudySyncPullInput,
  StudySyncPullResult,
  StudySyncPushInput,
  StudySyncPushResult,
  StudySyncRequestContract,
  StudySyncRetryClassification,
  StudySyncTransport,
  StudySyncTransportCode,
  StudySyncTransportOptions,
} from './types'

export const STUDY_SYNC_DEFAULT_TIMEOUT_MS = 15_000
export const STUDY_SYNC_MAX_TIMEOUT_MS = 120_000

const BASE_HEADERS = Object.freeze({
  accept: 'application/json',
  'content-type': 'application/json',
})

const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
const FORBIDDEN_AUTH_HEADER = /^(?:cookie|set-cookie|host|origin|referer|content-length|connection)$/i

function frozenFailure(
  code: Exclude<StudySyncTransportCode, 'SUCCESS'>,
  retry: StudySyncRetryClassification,
  httpStatus: number | null = null,
  retryAfterMs: number | null = null,
): StudySyncFailure {
  return Object.freeze({ code, retry, httpStatus, retryAfterMs })
}

const ABORTED = frozenFailure('ABORTED', 'ABORTED')
const OFFLINE = frozenFailure('OFFLINE', 'RETRY_WITH_BACKOFF')
const NETWORK_UNAVAILABLE = frozenFailure('NETWORK_UNAVAILABLE', 'RETRY_WITH_BACKOFF')
const TIMEOUT = frozenFailure('TIMEOUT', 'RETRY_WITH_BACKOFF')
const AUTHORIZATION_REQUIRED = frozenFailure('AUTHORIZATION_REQUIRED', 'REAUTHORIZE')
const MALFORMED_RESPONSE = frozenFailure('MALFORMED_RESPONSE', 'DO_NOT_RETRY')
const PERMANENT_REFUSAL = frozenFailure('PERMANENT_REFUSAL', 'DO_NOT_RETRY')

function validEndpoint(value: string): boolean {
  if (value.startsWith('/')) {
    return !value.startsWith('//') && !value.includes('?') && !value.includes('#') && !value.includes('\\')
  }
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
  } catch {
    return false
  }
}

function endpointFor(resolve: (operation: StudySyncOperation) => string, operation: StudySyncOperation): string | null {
  try {
    const endpoint = resolve(operation)
    return typeof endpoint === 'string' && validEndpoint(endpoint) ? endpoint : null
  } catch {
    return null
  }
}

function authorizedHeaders(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const output: Record<string, string> = {}
  let hasAuthorization = false
  for (const [name, entry] of Object.entries(value)) {
    if (!HEADER_NAME.test(name) || FORBIDDEN_AUTH_HEADER.test(name) ||
        typeof entry !== 'string' || entry.length === 0 || entry.length > 4096 || /[\r\n]/.test(entry)) return null
    const normalized = name.toLowerCase()
    output[normalized] = entry
    if (normalized !== 'accept' && normalized !== 'content-type') hasAuthorization = true
  }
  if (!hasAuthorization) return null
  output.accept = BASE_HEADERS.accept
  output['content-type'] = BASE_HEADERS['content-type']
  return output
}

async function authorize(
  seam: StudySyncAuthorization | undefined,
): Promise<Record<string, string> | null> {
  if (!seam || typeof seam.authorizeStudyRequestHeaders !== 'function') return null
  try {
    return authorizedHeaders(await seam.authorizeStudyRequestHeaders(BASE_HEADERS))
  } catch {
    return null
  }
}

async function authorizeUntilAbort(
  seam: StudySyncAuthorization | undefined,
  signal: AbortSignal,
): Promise<Record<string, string> | null> {
  if (signal.aborted) return null
  let onAbort: (() => void) | undefined
  const interrupted = new Promise<null>((resolve) => {
    onAbort = () => resolve(null)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([authorize(seam), interrupted])
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}

function retryAfterMs(response: Response, now: Date): number | null {
  const raw = response.headers.get('retry-after')
  if (!raw) return null
  const seconds = Number(raw)
  const value = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(raw) - now.getTime()
  return Number.isFinite(value) && value >= 0
    ? Math.min(Math.round(value), 24 * 60 * 60 * 1_000)
    : null
}

function classifyHttp(response: Response, now: Date): StudySyncFailure {
  const status = response.status
  if (status === 401) return frozenFailure('SESSION_EXPIRED', 'REAUTHORIZE', status)
  if (status === 409 || status === 412) return frozenFailure('STALE_REVISION', 'REBASE_REQUIRED', status)
  if (status === 429) {
    return frozenFailure('RATE_LIMITED', 'RETRY_AFTER_DELAY', status, retryAfterMs(response, now))
  }
  if (status === 408 || status === 425 || status >= 500) {
    return frozenFailure('SERVER_UNAVAILABLE', 'RETRY_WITH_BACKOFF', status)
  }
  return frozenFailure('PERMANENT_REFUSAL', 'DO_NOT_RETRY', status)
}

function jsonContent(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  return contentType.includes('application/json') || contentType.includes('+json')
}

function onlineByDefault(): boolean {
  try {
    return typeof navigator === 'undefined' || navigator.onLine !== false
  } catch {
    return true
  }
}

/**
 * Browser-only HTTP mechanics. It neither reads nor writes IndexedDB and it
 * never retries: local-first composition and retry scheduling remain above it.
 */
export function createStudySyncTransport(options: StudySyncTransportOptions): StudySyncTransport {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const isOnline = options.isOnline ?? onlineByDefault
  const now = options.now ?? (() => new Date())
  const timeoutMs = options.timeoutMs ?? STUDY_SYNC_DEFAULT_TIMEOUT_MS
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > STUDY_SYNC_MAX_TIMEOUT_MS) {
    throw new Error('Study sync timeout must be a bounded positive integer.')
  }

  async function execute<T>(input: {
    readonly operation: StudySyncOperation
    readonly request: StudySyncRequestContract | null
    readonly signal?: AbortSignal
    readonly parse: (value: unknown) => T | null
  }): Promise<StudySyncOutcome<T>> {
    if (!input.request) return PERMANENT_REFUSAL
    if (input.signal?.aborted) return ABORTED
    try {
      if (!isOnline()) return OFFLINE
    } catch {
      return NETWORK_UNAVAILABLE
    }
    const endpoint = endpointFor(options.resolveEndpoint, input.operation)
    if (!endpoint) return PERMANENT_REFUSAL

    const controller = new AbortController()
    let timedOut = false
    const onAbort = () => controller.abort(input.signal?.reason)
    input.signal?.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const headers = await authorizeUntilAbort(options.authorization, controller.signal)
      if (input.signal?.aborted) return ABORTED
      if (timedOut) return TIMEOUT
      if (!headers) return AUTHORIZATION_REQUIRED

      let response: Response
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(input.request),
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
        })
      } catch {
        if (timedOut) return TIMEOUT
        if (input.signal?.aborted) return ABORTED
        return NETWORK_UNAVAILABLE
      }
      if (!response.ok) return classifyHttp(response, now())
      if (!jsonContent(response)) return MALFORMED_RESPONSE
      let raw: unknown
      try {
        raw = await response.json()
      } catch {
        if (timedOut) return TIMEOUT
        if (input.signal?.aborted) return ABORTED
        return MALFORMED_RESPONSE
      }
      if (input.signal?.aborted) return ABORTED
      if (timedOut) return TIMEOUT
      const value = input.parse(raw)
      return value === null
        ? MALFORMED_RESPONSE
        : Object.freeze({ code: 'SUCCESS' as const, value })
    } finally {
      clearTimeout(timer)
      input.signal?.removeEventListener('abort', onAbort)
    }
  }

  return Object.freeze({
    hydrate(input: StudySyncHydrateInput, signal?: AbortSignal) {
      let request: StudySyncRequestContract | null
      try {
        request = buildHydrateRequest(input)
      } catch {
        request = null
      }
      const expected = request?.operation === 'HYDRATE'
        ? { householdRef: request.householdRef, students: request.students }
        : null
      return execute<StudySyncHydrateResult>({
        operation: 'HYDRATE',
        request,
        signal,
        parse: (value) => expected ? parseHydrateResponse(value, expected) : null,
      })
    },
    pull(input: StudySyncPullInput, signal?: AbortSignal) {
      let request: StudySyncRequestContract | null
      try {
        request = buildPullRequest(input)
      } catch {
        request = null
      }
      const expected = request?.operation === 'PULL'
        ? { identity: request.identity, afterRevision: request.afterRevision }
        : null
      return execute<StudySyncPullResult>({
        operation: 'PULL',
        request,
        signal,
        parse: (value) => expected ? parsePullResponse(value, expected) : null,
      })
    },
    push(input: StudySyncPushInput, signal?: AbortSignal) {
      let request: StudySyncRequestContract | null
      try {
        request = buildPushRequest(input)
      } catch {
        request = null
      }
      const expected = request?.operation === 'PUSH'
        ? {
            identity: request.identity,
            operationId: request.operationId,
            baseRevision: request.baseRevision,
            document: request.document,
          }
        : null
      return execute<StudySyncPushResult>({
        operation: 'PUSH',
        request,
        signal,
        parse: (value) => expected ? parsePushResponse(value, expected) : null,
      })
    },
    acknowledge(input: StudySyncAcknowledgeInput, signal?: AbortSignal) {
      let request: StudySyncRequestContract | null
      try {
        request = buildAcknowledgeRequest(input)
      } catch {
        request = null
      }
      const expected = request?.operation === 'ACKNOWLEDGE'
        ? {
            identity: request.identity,
            acknowledgementId: request.acknowledgementId,
            serverRevision: request.serverRevision,
          }
        : null
      return execute<StudySyncAcknowledgeResult>({
        operation: 'ACKNOWLEDGE',
        request,
        signal,
        parse: (value) => expected ? parseAcknowledgeResponse(value, expected) : null,
      })
    },
  })
}
