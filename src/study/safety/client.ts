import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import type { StudySessionAuthorization } from '../client/studySessionTransport'
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
  /**
   * Supplies the learner's opaque Study-session reference for `x-study-session`.
   * The gateway's authorizer refuses classification without it, so an absent or
   * empty seam fails closed here, before any network activity.
   */
  readonly sessionAuthorization?: StudySessionAuthorization
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

/**
 * Which thing could not be obtained. `session-authorization` means the adult
 * bearer or the learner's Study session was missing, expired, revoked, or
 * refused; `rate-limit` means the gateway shed the request;
 * `authorization-infrastructure` means a trusted authorization dependency of
 * this request could not produce a usable authorization answer at all — the
 * question went unanswered rather than answered "no", so nothing was refused and
 * nothing was judged; `classifier` means everything else that stopped a
 * classification. All four fail closed — none may continue tutoring — but only
 * the last is a safety-classifier incident, so an ordinary session expiry, a
 * rate limit and an authorization outage are never reported as one.
 *
 * `authorization-infrastructure` is defined by that semantics and not by its
 * producer: any of the request's authorization-verification dependencies may
 * raise it, and which one did is a server detail this client must not have to
 * care about — the set is a server contract, enumerated and pinned there. It is
 * correspondingly narrower than "the gateway failed": an authorization answer of
 * "no" is an identity refusal and stays `session-authorization`, and a server
 * error or an unavailability that is not this signal stays `classifier`. What
 * the category buys the learner is a technical retry interruption instead of a
 * learner-safety classification.
 */
export type StudySafetyFailureCategory =
  | 'session-authorization'
  | 'rate-limit'
  | 'authorization-infrastructure'
  | 'classifier'

/**
 * Which half of the authorization pair was refused, as a non-secret code. The
 * two need different recovery: a refused adult bearer needs the adult to sign in
 * again, while a refused Study session needs the learner's session cleared and
 * re-issued. The host cannot tell them apart from the fail-closed response
 * alone, and must never have to parse an error string to find out.
 */
export type StudySessionAuthorizationFailure = 'adult-authentication-rejected' | 'study-session-rejected'

export interface StudySafetyClientResult {
  readonly response: StudySafetyClassificationResponseV1
  /**
   * The local safety ledger's vocabulary, and set only for the failures that
   * belong in it. A session-authorization or rate-limit result carries none,
   * so a caller that writes on `failureMode` alone still cannot turn one into a
   * durable safety-stop record.
   */
  readonly failureMode?: PreAcceptanceSafetyFailureMode
  readonly serverCaptureStatus?: 'server-not-contacted' | 'server-acceptance-not-confirmed'
  readonly failureCategory?: StudySafetyFailureCategory
  /** Present only when `failureCategory` is `session-authorization`. */
  readonly sessionAuthorizationFailure?: StudySessionAuthorizationFailure
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
  if (deps.signal?.aborted) return { response: failClosed('client-cancelled'), failureMode: 'network-failure-mid-request', serverCaptureStatus: 'server-not-contacted', failureCategory: 'classifier' }
  let accessToken: string | null
  try {
    accessToken = await getAccessToken()
  } catch {
    return { response: failClosed('client-auth-unavailable'), serverCaptureStatus: 'server-not-contacted', failureCategory: 'session-authorization', sessionAuthorizationFailure: 'adult-authentication-rejected' }
  }
  if (!accessToken) return { response: failClosed('client-unauthenticated'), serverCaptureStatus: 'server-not-contacted', failureCategory: 'session-authorization', sessionAuthorizationFailure: 'adult-authentication-rejected' }
  // Read once, only to build this request's headers. A missing seam, a cleared
  // transport, and a reference the identity contract refuses all land here, so
  // no unauthorized classification ever reaches the network.
  //
  // The seam is host code and can throw — a transport mid-rotation, a revoked
  // accessor, a composition bug. A throw is still an unusable Study session, so
  // it is guarded here and kept inside the taxonomy: escaping would lose the
  // category, skip the host's recovery callback, and drop the failure into a
  // broader runtime quarantine. The thrown value itself is discarded rather
  // than reported, because it is host detail this result may not carry.
  let headers: Record<string, string> | null | undefined
  try {
    headers = deps.sessionAuthorization?.authorizeStudyRequestHeaders({
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    })
  } catch {
    headers = null
  }
  if (!headers) return { response: failClosed('client-study-session-unavailable'), serverCaptureStatus: 'server-not-contacted', failureCategory: 'session-authorization', sessionAuthorizationFailure: 'study-session-rejected' }
  if (deps.signal?.aborted) return { response: failClosed('client-cancelled'), failureMode: 'network-failure-mid-request', serverCaptureStatus: 'server-not-contacted', failureCategory: 'classifier' }

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
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok) {
      // The gateway answers 401 when the adult bearer is refused and 403 when
      // the learner's Study-session reference is missing, expired, revoked, or
      // unauthorized. Neither means the classifier was unreachable, so neither
      // is reported as one — an expired session is an ordinary lifecycle event.
      // Only the status decides this; the body is never read or parsed, so a
      // gateway that answers 403 with an explanatory payload leaks nothing.
      if (response.status === 401) {
        return { response: failClosed('client-adult-authentication-rejected'), serverCaptureStatus: 'server-acceptance-not-confirmed', failureCategory: 'session-authorization', sessionAuthorizationFailure: 'adult-authentication-rejected' }
      }
      if (response.status === 403) {
        return { response: failClosed('client-study-session-rejected'), serverCaptureStatus: 'server-acceptance-not-confirmed', failureCategory: 'session-authorization', sessionAuthorizationFailure: 'study-session-rejected' }
      }
      // Shedding load is not a safety outage and not an authorization refusal.
      // It still fails closed, but the classifier never saw the text, so there
      // is nothing about this learner to record.
      if (response.status === 429) {
        return { response: failClosed('client-rate-limited'), serverCaptureStatus: 'server-acceptance-not-confirmed', failureCategory: 'rate-limit' }
      }
      // STUDY-A1-AUTH-INFRA-BOUNDARY-C — 424 Failed Dependency, the gateway's
      // `authorization-infrastructure` category: an authorization dependency of
      // this request could not answer at all. It is one semantic category and
      // deliberately not one producer — it may come from any of the request's
      // authorization-verification dependencies, and STUDY-A1-AUTH-INFRA-
      // BOUNDARY-H2 added the adult bearer verifier's outage states to the
      // learner/session verifier that first raised it. Which dependency it was
      // is a server detail this client must not have to care about; the exact
      // set is a server contract, enumerated and pinned there.
      //
      // Every one of them runs strictly before the classifier, so the learner's
      // text was never read, let alone judged. None carries a `failureMode`,
      // which is the local safety ledger's vocabulary, so a caller writing on
      // `failureMode` alone still cannot make a durable safety record out of it.
      //
      // Only the status decides this. The body is never read or parsed here, so
      // a gateway — or anything that can answer as one — cannot talk its way
      // into or out of this category with an error string, and the same
      // `authorization_unavailable` payload on a 500 or a 503 stays firmly on
      // the safety side below.
      if (response.status === 424) {
        return { response: failClosed('client-authorization-infrastructure-unavailable'), serverCaptureStatus: 'server-acceptance-not-confirmed', failureCategory: 'authorization-infrastructure' }
      }
      return { response: failClosed('client-gateway-error'), failureMode: response.status === 503 ? 'gateway-503' : 'classifier-unreachable', serverCaptureStatus: 'server-acceptance-not-confirmed', failureCategory: 'classifier' }
    }
    const result = await response.json()
    return validResponse(result) ? { response: result } : { response: failClosed('client-malformed-response'), failureMode: 'malformed-server-response', serverCaptureStatus: 'server-acceptance-not-confirmed', failureCategory: 'classifier' }
  } catch {
    const timedOut = controller.signal.aborted && !deps.signal?.aborted
    return { response: failClosed('client-network-error'), failureMode: timedOut ? 'request-timeout' : 'network-failure-mid-request', serverCaptureStatus: 'server-acceptance-not-confirmed', failureCategory: 'classifier' }
  } finally {
    globalThis.clearTimeout(timer)
    deps.signal?.removeEventListener('abort', cancelFromHost)
  }
}
