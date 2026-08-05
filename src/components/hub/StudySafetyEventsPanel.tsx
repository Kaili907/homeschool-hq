import { useEffect, useState } from 'react'
import {
  readStudySafetyEvents,
  type StudySafetyEvent,
  type StudySafetyEventsClientOptions,
  type StudySafetyEventsView,
} from '../../study/client/studySafetyEventsClient'

export const STUDY_SAFETY_SERVER_UNREADABLE_NOTICE =
  'The server record of safety events could not be read. Anything listed below is what this device recorded; there may be more that is not shown.'

export const STUDY_SAFETY_LOCAL_ONLY_NOTICE =
  'Recorded on this device. The server has no confirmed record of this stop, so nothing was sent anywhere — this list is the only place it appears.'

export const STUDY_SAFETY_NO_EVENTS_NOTICE =
  'No safety events have been recorded. Nothing is sent to you automatically, so check here after any session that stopped.'

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

/** Plain words for how far the stop got, so an adult can tell what is on record. */
const CAPTURE: Record<string, string> = {
  captured: 'Recorded on this device · the server also captured it for review',
  'not-confirmed': 'Recorded on this device only · the server did not confirm it was saved',
  'never-attempted': 'Recorded on this device only · the safety service was never reached',
}

function occurredAtLabel(value: string): string {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value
}

function EventRow({ event }: { event: StudySafetyEvent }) {
  const localOnly = event.kind === 'local' && event.captureStatus !== 'captured'
  return (
    <li className={`rounded-lg border p-4 ${localOnly ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold text-slate-900">{EVENT_TYPE[event.reasonCategory] ?? 'Safety check'}</span>
        <time className="text-sm text-slate-600" dateTime={event.occurredAt}>{occurredAtLabel(event.occurredAt)}</time>
      </div>
      <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">Student:</span> {event.learnerRef}</p>
      <p className="mt-1 text-sm text-slate-700">{REASON[event.urgency] ?? 'The lesson stopped for a safety check.'}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">
        {event.kind === 'delivered'
          ? `Delivered to you · ${event.read ? 'read' : 'unread'}`
          : CAPTURE[event.captureStatus]}
      </p>
      {localOnly && (
        <p className="mt-1 text-sm text-amber-900">
          {STUDY_SAFETY_LOCAL_ONLY_NOTICE}
          {event.kind === 'local' && event.captureReasonCode ? ` Reason: ${event.captureReasonCode}.` : ''}
        </p>
      )}
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
      <p className="mt-1 text-sm text-slate-600">
        Adults only. Every Study session that stopped for a safety check appears here, including stops the
        server never recorded. One stop can appear twice when both this device and the server hold a record of it.
      </p>

      {!view.serverReadable && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 font-semibold text-red-950" role="alert">
          {STUDY_SAFETY_SERVER_UNREADABLE_NOTICE} Reason: {view.serverReasonCode}.
        </p>
      )}

      {view.events.length === 0 ? (
        <p className="mt-4 text-slate-700" role="status">{STUDY_SAFETY_NO_EVENTS_NOTICE}</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {view.events.map((event) => <EventRow key={event.eventId} event={event} />)}
        </ol>
      )}
    </section>
  )
}

/**
 * A6-5-C — the adult-only record of Study safety events.
 *
 * Reachable only from the parent-PIN-gated Parent Hub. It must never be
 * imported by a student-facing Study surface; an import-boundary test enforces
 * that. It merges the server's delivered notifications with the browser's own
 * stop record, so a stop whose server capture failed — or never happened — is
 * still visible, and an empty list is never mistaken for "nothing happened".
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
