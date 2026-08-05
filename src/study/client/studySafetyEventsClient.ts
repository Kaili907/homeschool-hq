import { getGatewayAccessToken } from '../../tutor/gatewayAuth'

export const STUDY_SAFETY_EVENTS_ENDPOINT = '/api/study/parent-notifications'
export const STUDY_SAFETY_EVENTS_CLIENT_TIMEOUT_MS = 5_000

export type StudySafetyEventUrgency = 'urgent' | 'uncertain' | 'review-required'
export type StudySafetyEventReason = 'immediate-safety' | 'possible-safety' | 'review-required'

/** A safety event that reached the adult through the durable in-app route. */
export interface StudySafetyDeliveredEvent {
  readonly kind: 'delivered'
  readonly eventId: string
  readonly occurredAt: string
  readonly learnerRef: string
  readonly reasonCategory: StudySafetyEventReason
  readonly urgency: StudySafetyEventUrgency
  readonly read: boolean
}

/** A safety event durably captured server-side but not yet delivered. */
export interface StudySafetyCapturedEvent {
  readonly kind: 'captured'
  readonly eventId: string
  readonly occurredAt: string
  readonly learnerRef: string
  readonly reasonCategory: StudySafetyEventReason
  readonly urgency: StudySafetyEventUrgency
  readonly deliveryState: string
}

export type StudySafetyEvent = StudySafetyDeliveredEvent | StudySafetyCapturedEvent

export interface StudySafetyEventsView {
  /** Every event the adult can currently see, newest first. */
  readonly events: readonly StudySafetyEvent[]
  /** 'approved' means the database permits in-app delivery; 'unknown' means it could not be read. */
  readonly deliveryPolicy: 'approved' | 'not-approved' | 'unknown'
  readonly deliveryState: 'delivering' | 'pending-approval'
  /** Whether captured-but-undelivered events are readable at all. */
  readonly captureReadable: boolean
  readonly captureReasonCode: string | null
  /** True when this surface could not be loaded and is therefore not evidence of "nothing happened". */
  readonly unavailable: boolean
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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function timestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null
}

function deliveredEvent(value: unknown): StudySafetyDeliveredEvent | null {
  const entry = record(value)
  const occurredAt = timestamp(entry?.createdAt)
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

function capturedEvent(value: unknown): StudySafetyCapturedEvent | null {
  const entry = record(value)
  const occurredAt = timestamp(entry?.occurredAt)
  if (
    !entry || occurredAt === null ||
    typeof entry.reviewId !== 'string' ||
    typeof entry.learnerRef !== 'string' ||
    !REASONS.includes(String(entry.reasonCategory)) ||
    !URGENCIES.includes(String(entry.urgency)) ||
    typeof entry.deliveryState !== 'string'
  ) return null
  return Object.freeze({
    kind: 'captured' as const,
    eventId: entry.reviewId,
    occurredAt,
    learnerRef: entry.learnerRef,
    reasonCategory: entry.reasonCategory as StudySafetyEventReason,
    urgency: entry.urgency as StudySafetyEventUrgency,
    deliveryState: entry.deliveryState,
  })
}

/**
 * A6-5: a failed read is reported as unavailable, never as an empty list. An
 * adult must never be shown "no safety events" because the surface broke.
 */
function unavailableView(reasonCode: string): StudySafetyEventsView {
  return Object.freeze({
    events: Object.freeze([]),
    deliveryPolicy: 'unknown' as const,
    deliveryState: 'pending-approval' as const,
    captureReadable: false,
    captureReasonCode: reasonCode,
    unavailable: true,
  })
}

export async function readStudySafetyEvents(
  options: StudySafetyEventsClientOptions = {},
): Promise<StudySafetyEventsView> {
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init))
  if (options.signal?.aborted) return unavailableView('client-cancelled')

  let accessToken: string | null
  try {
    accessToken = await getAccessToken()
  } catch {
    return unavailableView('client-auth-unavailable')
  }
  if (!accessToken) return unavailableView('client-unauthenticated')

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
    if (response.status !== 200) return unavailableView('client-gateway-error')
    const body = record(await response.json())
    const delivery = record(body?.delivery)
    const capture = record(body?.capture)
    if (!body || !delivery || !capture || !Array.isArray(body.notifications)) {
      return unavailableView('client-malformed-response')
    }
    const captureReadable = capture.state === 'available'
    const events = [
      ...body.notifications.map(deliveredEvent),
      ...(captureReadable && Array.isArray(capture.pendingReviews)
        ? capture.pendingReviews.map(capturedEvent)
        : []),
    ].filter((entry): entry is StudySafetyEvent => entry !== null)
    events.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    return Object.freeze({
      events: Object.freeze(events),
      deliveryPolicy: ['approved', 'not-approved'].includes(String(delivery.policy))
        ? delivery.policy as 'approved' | 'not-approved'
        : 'unknown',
      deliveryState: delivery.state === 'delivering' ? 'delivering' as const : 'pending-approval' as const,
      captureReadable,
      captureReasonCode: captureReadable ? null : String(capture.reasonCode ?? 'capture-read-unavailable'),
      unavailable: false,
    })
  } catch {
    return unavailableView('client-network-error')
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
  }
}
