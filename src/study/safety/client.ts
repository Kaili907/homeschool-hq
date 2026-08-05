import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  STUDY_SAFETY_SCHEMA_VERSION,
  type StudySafetyClassificationRequestV1,
  type StudySafetyClassificationResponseV1,
} from '../contracts/safety'
import { learnerSafeResult } from './learnerSafe'
import type { PreAcceptanceSafetyFailureMode } from './localStopLedger'

export const STUDY_SAFETY_ENDPOINT = '/api/study/safety/classify'
export const STUDY_SAFETY_CLIENT_TIMEOUT_MS = 8_000

type FetchLike = (
  url: string,
  init: RequestInit,
) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>

export interface StudySafetyClientDeps {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly timeoutMs?: number
  /** Host lifecycle cancellation (logout, learner switch, navigation, etc.). */
  readonly signal?: AbortSignal
}

const VALID_CLASSIFICATIONS = new Set(['urgent', 'uncertain', 'clear', 'invalid'])
function validResponse(value: unknown): value is StudySafetyClassificationResponseV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 4 ||
    !['schemaVersion', 'classification', 'learner', 'continueToTutorCore'].every((key) => key in record)
  ) return false
  const classification = record.classification
  if (
    record.schemaVersion !== STUDY_SAFETY_SCHEMA_VERSION ||
    typeof classification !== 'string' ||
    !VALID_CLASSIFICATIONS.has(classification) ||
    typeof record.continueToTutorCore !== 'boolean'
  ) return false
  const learner = record.learner
  if (!learner || typeof learner !== 'object' || Array.isArray(learner)) return false
  const safe = learner as Record<string, unknown>
  if (Object.keys(safe).length !== 5 || typeof safe.messageCode !== 'string' || typeof safe.message !== 'string' || typeof safe.mayContinue !== 'boolean') {
    return false
  }
  const approved = learnerSafeResult(classification as Parameters<typeof learnerSafeResult>[0])
  if (JSON.stringify(safe) !== JSON.stringify(approved)) return false
  return classification === 'clear'
    ? record.continueToTutorCore === true && safe.mayContinue === true
    : record.continueToTutorCore === false && safe.mayContinue === false
}

function failClosed(reasonCode: string): StudySafetyClassificationResponseV1 {
  return {
    schemaVersion: STUDY_SAFETY_SCHEMA_VERSION,
    classification: 'invalid',
    learner: learnerSafeResult('invalid'),
    continueToTutorCore: false,
  }
}

export interface StudySafetyClientResult {
  readonly response: StudySafetyClassificationResponseV1
  readonly failureMode?: PreAcceptanceSafetyFailureMode
  readonly serverCaptureStatus?: 'server-not-contacted' | 'server-acceptance-not-confirmed'
}

/**
 * Sends one transient request. It never writes the text to browser storage and
 * intentionally performs no automatic retry, so failures cannot duplicate an
 * adult-review proposal.
 */
export async function classifyStudySafety(
  request: StudySafetyClassificationRequestV1,
  deps: StudySafetyClientDeps = {},
): Promise<StudySafetyClassificationResponseV1> {
  return (await classifyStudySafetyWithCaptureStatus(request, deps)).response
}

/** Same fail-closed request with local-only provenance for an unacknowledged stop. */
export async function classifyStudySafetyWithCaptureStatus(
  request: StudySafetyClassificationRequestV1,
  deps: StudySafetyClientDeps = {},
): Promise<StudySafetyClientResult> {
  const getAccessToken = deps.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = deps.fetchImpl ?? ((url, init) => fetch(url, init))
  if (deps.signal?.aborted) return { response: failClosed('client-cancelled'), failureMode: 'network-failure-mid-request', serverCaptureStatus: 'server-not-contacted' }
  let accessToken: string | null
  try {
    accessToken = await getAccessToken()
  } catch {
    return { response: failClosed('client-auth-unavailable'), failureMode: 'authentication-failure', serverCaptureStatus: 'server-not-contacted' }
  }
  if (!accessToken) return { response: failClosed('client-unauthenticated'), failureMode: 'authentication-failure', serverCaptureStatus: 'server-not-contacted' }
  if (deps.signal?.aborted) return { response: failClosed('client-cancelled'), failureMode: 'network-failure-mid-request', serverCaptureStatus: 'server-not-contacted' }

  const controller = new AbortController()
  const cancelFromHost = () => controller.abort(deps.signal?.reason)
  deps.signal?.addEventListener('abort', cancelFromHost, { once: true })
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    deps.timeoutMs ?? STUDY_SAFETY_CLIENT_TIMEOUT_MS,
  )
  try {
    const response = await fetchImpl(STUDY_SAFETY_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok) return { response: failClosed('client-gateway-error'), failureMode: response.status === 503 ? 'gateway-503' : 'classifier-unreachable', serverCaptureStatus: 'server-acceptance-not-confirmed' }
    const result = await response.json()
    return validResponse(result) ? { response: result } : { response: failClosed('client-malformed-response'), failureMode: 'malformed-server-response', serverCaptureStatus: 'server-acceptance-not-confirmed' }
  } catch {
    const timedOut = controller.signal.aborted && !deps.signal?.aborted
    return { response: failClosed('client-network-error'), failureMode: timedOut ? 'request-timeout' : 'network-failure-mid-request', serverCaptureStatus: 'server-acceptance-not-confirmed' }
  } finally {
    globalThis.clearTimeout(timer)
    deps.signal?.removeEventListener('abort', cancelFromHost)
  }
}
