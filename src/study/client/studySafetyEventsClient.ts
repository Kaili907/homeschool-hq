import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  readSafetyStopLedger,
  type StudyStopCaptureStatus,
  type StudyStopClassification,
} from '../safety/stopLedger'

export const STUDY_SAFETY_EVENTS_ENDPOINT = '/api/study/parent-notifications'
export const STUDY_SAFETY_EVENTS_CLIENT_TIMEOUT_MS = 5_000

export type StudySafetyEventUrgency = 'urgent' | 'uncertain' | 'review-required'
export type StudySafetyEventReason = 'immediate-safety' | 'possible-safety' | 'review-required'

/** A safety event the server captured and delivered to the adult. */
export interface StudySafetyDeliveredEvent {
  readonly kind: 'delivered'
  readonly eventId: string
  readonly occurredAt: string
  readonly learnerRef: string
  readonly reasonCategory: StudySafetyEventReason
  readonly urgency: StudySafetyEventUrgency
  readonly read: boolean
}

/**
 * A safety stop recorded by the browser at the moment it happened. It exists
 * whether or not the server ever captured a proposal for it, which is the only
 * reason a stop that failed to reach the server is visible to an adult at all.
 */
export interface StudySafetyLocalEvent {
  readonly kind: 'local'
  readonly eventId: string
  readonly occurredAt: string
  readonly learnerRef: string
  readonly reasonCategory: StudySafetyEventReason
  readonly urgency: StudySafetyEventUrgency
  readonly captureStatus: StudyStopCaptureStatus
  readonly captureReasonCode: string | null
}

export type StudySafetyEvent = StudySafetyDeliveredEvent | StudySafetyLocalEvent

export interface StudySafetyEventsView {
  /** Every event the adult can currently see, newest first. */
  readonly events: readonly StudySafetyEvent[]
  /** False when the server list could not be read; the local record still stands. */
  readonly serverReadable: boolean
  readonly serverReasonCode: string | null
  /** How many of the events came from the local stop record. */
  readonly localStopCount: number
}

type FetchLike = (url: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export interface StudySafetyEventsClientOptions {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

const REASONS: readonly string[] = ['immediate-safety', 'possible-safety', 'review-required']
const URGENCIES: readonly string[] = ['urgent', 'uncertain', 'review-required']

const LOCAL_PROJECTION: Readonly<Record<StudyStopClassification, {
  readonly reasonCategory: StudySafetyEventReason
  readonly urgency: StudySafetyEventUrgency
}>> = {
  urgent: { reasonCategory: 'immediate-safety', urgency: 'urgent' },
  uncertain: { reasonCategory: 'possible-safety', urgency: 'uncertain' },
  invalid: { reasonCategory: 'review-required', urgency: 'review-required' },
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function deliveredEvent(value: unknown): StudySafetyDeliveredEvent | null {
  const entry = record(value)
  const occurredAt = typeof entry?.createdAt === 'string' && Number.isFinite(Date.parse(entry.createdAt))
    ? entry.createdAt
    : null
  if (
    !entry || occurredAt === null ||
    typeof entry.notificationId !== 'string' ||
    !REASONS.includes(String(entry.reasonCategory)) ||
    !URGENCIES.includes(String(entry.urgency)) ||
    typeof entry.read !== 'boolean'
  ) return null
  return Object.freeze({
    kind: 'delivered' as const,
    eventId: entry.notificationId,
    occurredAt,
    // The delivered projection is recipient-scoped and carries no learner ref.
    learnerRef: 'this household',
    reasonCategory: entry.reasonCategory as StudySafetyEventReason,
    urgency: entry.urgency as StudySafetyEventUrgency,
    read: entry.read,
  })
}

function localEvents(): readonly StudySafetyLocalEvent[] {
  return readSafetyStopLedger().map((stop) => Object.freeze({
    kind: 'local' as const,
    eventId: stop.stopRef,
    occurredAt: stop.occurredAt,
    learnerRef: stop.learnerRef,
    reasonCategory: LOCAL_PROJECTION[stop.classification].reasonCategory,
    urgency: LOCAL_PROJECTION[stop.classification].urgency,
    captureStatus: stop.captureStatus,
    captureReasonCode: stop.captureReasonCode,
  }))
}

/**
 * A6-5-C: the local stop record is merged in unconditionally, so a failed
 * server read reports itself as unreadable AND still lists every stop this
 * browser recorded. An adult is never shown "no safety events" because the
 * server surface broke, and never shown an empty list after a stop happened.
 */
function view(
  delivered: readonly StudySafetyDeliveredEvent[],
  serverReadable: boolean,
  serverReasonCode: string | null,
): StudySafetyEventsView {
  const local = localEvents()
  const events = [...delivered, ...local]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
  return Object.freeze({
    events: Object.freeze(events),
    serverReadable,
    serverReasonCode,
    localStopCount: local.length,
  })
}

export async function readStudySafetyEvents(
  options: StudySafetyEventsClientOptions = {},
): Promise<StudySafetyEventsView> {
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init))
  if (options.signal?.aborted) return view([], false, 'client-cancelled')

  let accessToken: string | null
  try {
    accessToken = await getAccessToken()
  } catch {
    return view([], false, 'client-auth-unavailable')
  }
  if (!accessToken) return view([], false, 'client-unauthenticated')

  const controller = new AbortController()
  const cancel = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', cancel, { once: true })
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? STUDY_SAFETY_EVENTS_CLIENT_TIMEOUT_MS,
  )
  try {
    const response = await fetchImpl(STUDY_SAFETY_EVENTS_ENDPOINT, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (response.status !== 200) return view([], false, 'client-gateway-error')
    const body = record(await response.json())
    if (!body || !Array.isArray(body.notifications)) {
      return view([], false, 'client-malformed-response')
    }
    const delivered = body.notifications
      .map(deliveredEvent)
      .filter((entry): entry is StudySafetyDeliveredEvent => entry !== null)
    return view(delivered, true, null)
  } catch {
    return view([], false, 'client-network-error')
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
  }
}
