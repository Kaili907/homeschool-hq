import { useEffect, useState } from 'react'
import {
  readStudySafetyEvents,
  type StudySafetyEvent,
  type StudySafetyEventsClientOptions,
  type StudySafetyEventsView,
} from '../../study/client/studySafetyEventsClient'

export const STUDY_SAFETY_EVENTS_PENDING_NOTICE =
  'Notifications pending: delivery is not switched on yet, so nothing is sent to you automatically. Check this list after any session that stopped.'

export const STUDY_SAFETY_EVENTS_UNAVAILABLE_NOTICE =
  'This safety record could not be loaded. An empty list here does not mean nothing happened.'

const EVENT_TYPE: Record<string, string> = {
  'immediate-safety': 'Immediate safety check',
  'possible-safety': 'Possible safety check',
  'review-required': 'Review required',
}

const REASON: Record<string, string> = {
  urgent: 'The lesson stopped and an adult was asked for straight away.',
  uncertain: 'The lesson stopped and an adult check-in was asked for.',
  'review-required': 'The lesson stopped because the check could not be completed.',
}

function occurredAtLabel(value: string): string {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value
}

function EventRow({ event }: { event: StudySafetyEvent }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold text-slate-900">{EVENT_TYPE[event.reasonCategory] ?? 'Safety check'}</span>
        <time className="text-sm text-slate-600" dateTime={event.occurredAt}>{occurredAtLabel(event.occurredAt)}</time>
      </div>
      <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">Student:</span> {event.learnerRef}</p>
      <p className="mt-1 text-sm text-slate-700">{REASON[event.urgency] ?? 'The lesson stopped for a safety check.'}</p>
      <p className="mt-1 text-sm text-slate-600">
        {event.kind === 'delivered'
          ? `Delivered to you · ${event.read ? 'read' : 'unread'}`
          : `Captured, not delivered · ${event.deliveryState}`}
      </p>
    </li>
  )
}

/**
 * Pure projection of one resolved safety-event view. Kept separate from the
 * loading component so the rendered adult surface can be asserted directly.
 */
export function StudySafetyEventsSurface({ view }: { view: StudySafetyEventsView }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <h2 className="text-xl font-bold text-slate-900">Safety events</h2>
      <p className="mt-1 text-sm text-slate-600">Adults only. Every Study session that stopped for a safety check appears here.</p>

      {view.deliveryState !== 'delivering' && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold text-amber-900" role="status">
          {STUDY_SAFETY_EVENTS_PENDING_NOTICE}
          {view.deliveryPolicy === 'unknown'
            ? ' The delivery policy could not be read, so it is treated as not approved.'
            : ''}
        </p>
      )}

      {view.unavailable && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 font-semibold text-red-950" role="alert">
          {STUDY_SAFETY_EVENTS_UNAVAILABLE_NOTICE} Reason: {view.captureReasonCode}.
        </p>
      )}

      {!view.unavailable && !view.captureReadable && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          Captured-but-undelivered events are not readable yet ({view.captureReasonCode}). Only delivered notifications are listed below.
        </p>
      )}

      {view.events.length === 0 ? (
        <p className="mt-4 text-slate-700">No safety events are visible on this surface.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {view.events.map((event) => <EventRow key={event.eventId} event={event} />)}
        </ol>
      )}
    </section>
  )
}

/**
 * A6-5 — the adult-only record of Study safety events.
 *
 * Reachable only from the parent-PIN-gated Parent Hub. It must never be
 * imported by a student-facing Study surface; an import-boundary test enforces
 * that. It shows what is durably captured today, and states plainly when in-app
 * delivery is still refused by the Director-owned database policy, so an empty
 * list is never mistaken for "nothing happened".
 */
export function StudySafetyEventsPanel({
  clientOptions,
  read = readStudySafetyEvents,
}: {
  clientOptions?: StudySafetyEventsClientOptions
  read?: (options?: StudySafetyEventsClientOptions) => Promise<StudySafetyEventsView>
} = {}) {
  const [view, setView] = useState<StudySafetyEventsView | null>(null)

  useEffect(() => {
    let current = true
    read(clientOptions).then((next) => { if (current) setView(next) })
    return () => { current = false }
  }, [clientOptions, read])

  if (!view) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5" aria-busy="true">
        <h2 className="text-xl font-bold text-slate-900">Safety events</h2>
        <p className="mt-1 text-slate-600" role="status">Loading the safety record…</p>
      </section>
    )
  }
  return <StudySafetyEventsSurface view={view} />
}
