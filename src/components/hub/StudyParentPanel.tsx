import { useEffect, useMemo, useState } from 'react'
import type { StudyParentControlPorts } from '../../study/ports'
import { StudyParentController } from '../../study/parentController'
import type {
  StudyAdultAuthorization,
  StudyCalendarEntry,
  StudyParentCommand,
  StudyParentSettings,
  StudyReviewRecommendation,
} from '../../study/types'
import { StudyCalendarPanel } from './StudyCalendarPanel'

export interface StudyParentLearnerOption {
  readonly hostProfileRef: string
  readonly learnerRef: string
  readonly displayName: string
}

export function StudyParentPanel({
  householdRef,
  learners,
  ports,
  authorization,
}: {
  householdRef: string
  learners: readonly StudyParentLearnerOption[]
  ports: StudyParentControlPorts
  authorization: StudyAdultAuthorization
}) {
  const [learnerRef, setLearnerRef] = useState(learners[0]?.learnerRef ?? '')
  const [settings, setSettings] = useState<StudyParentSettings | null>(null)
  const [calendar, setCalendar] = useState<readonly StudyCalendarEntry[]>([])
  const [reviews, setReviews] = useState<readonly StudyReviewRecommendation[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [maximum, setMaximum] = useState('30')
  const [breakMinutes, setBreakMinutes] = useState('5')
  const [accommodation, setAccommodation] = useState('Extra processing time and shorter written directions')
  const [privateNote, setPrivateNote] = useState('')
  const [reviewReason, setReviewReason] = useState('Please review the current instructional evidence.')
  const controller = useMemo(() => new StudyParentController(ports), [ports])
  const scope = { householdRef, learnerRef }

  const refresh = async () => {
    if (!learnerRef) return
    try {
      const [nextSettings, nextCalendar, nextReviews] = await Promise.all([
        ports.parentSettings.read(scope),
        ports.calendar.list(scope),
        ports.reviewQueue.list(scope),
      ])
      setSettings(nextSettings)
      setCalendar(nextCalendar)
      setReviews(nextReviews)
      setError('')
    } catch { setError('Study evidence could not be loaded safely.') }
  }
  useEffect(() => { refresh() }, [learnerRef, ports])

  const run = async (command: StudyParentCommand, success: string) => {
    setError('')
    try {
      const result = await controller.execute(scope, authorization, command)
      setStatus(`${success} ${result.deliveryStatus === 'local-only-not-delivered' ? 'This request has not been delivered.' : ''}`.trim())
      await refresh()
    } catch { setError('The parent control was rejected. Check authorization, learner, value, and current revision.') }
  }
  if (!learnerRef) return <section className="rounded-xl bg-white p-5"><h2 className="font-bold">Study</h2><p>No learner is available.</p></section>

  const partial = calendar.filter((entry) => entry.state === 'paused' && entry.requiredWorkCompletionPercent > 0 && entry.requiredWorkCompletionPercent < 100)
  const active = calendar.filter((entry) => entry.state === 'active')
  return (
    <div className="study-runtime-host space-y-5" aria-busy={!settings}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-2xl font-bold text-slate-900">Study Engine evidence and controls</h2><p className="text-sm text-slate-600">Local development only — not durable. Adult review delivery is not enabled.</p></div>
          <label className="font-semibold text-slate-800">Learner
            <select className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2" value={learnerRef} onChange={(event) => setLearnerRef(event.target.value)}>
              {learners.map((learner) => <option key={learner.learnerRef} value={learner.learnerRef}>{learner.displayName}</option>)}
            </select>
          </label>
        </div>
        {status && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-emerald-900" role="status">{status}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-red-900" role="alert">{error}</p>}
      </section>

      <StudyCalendarPanel entries={calendar} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">Today and review queue</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <EvidenceCard label="Scheduled" value={String(calendar.filter((entry) => entry.state === 'scheduled').length)} />
          <EvidenceCard label="Completed" value={String(calendar.filter((entry) => entry.state === 'completed').length)} />
          <EvidenceCard label="Resume needed" value={String(calendar.filter((entry) => entry.state === 'paused').length)} />
        </div>
        <h3 className="mt-5 font-bold">Review recommendations</h3>
        {reviews.length === 0 ? <p className="mt-2 text-slate-600">No review recommendation is queued.</p> : <ul className="mt-3 space-y-3">{reviews.map((review) => <li key={review.recommendationRef} className="rounded-lg border p-3"><p className="font-semibold">Due {review.dueDate} · {review.reasonCodes.join(', ')}</p><div className="mt-2 flex gap-2"><button className="rounded-lg bg-emerald-700 px-4 py-2 text-white" onClick={() => run({ type: 'accept-recommendation', recommendationRef: review.recommendationRef }, 'Recommendation accepted.')}>Accept</button><button className="rounded-lg border border-slate-400 px-4 py-2" onClick={() => run({ type: 'reject-recommendation', recommendationRef: review.recommendationRef }, 'Recommendation rejected.')}>Reject</button></div></li>)}</ul>}
      </section>

      {settings && <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">Effective work-block settings</h2>
        <p className="mt-2 text-slate-700">Up to {settings.maximumWorkMinutes} minutes · {settings.breakMinutes}-minute breaks · timer {settings.timerHidden ? 'hidden' : 'shown'}</p>
        <p className="mt-1 text-sm text-slate-600">Active accommodations: {settings.accommodations.length}. Adult-review requests: {settings.adultReviewRequests.length}, all local-only and not delivered.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="font-semibold">Maximum duration (1–240)<input className="mt-1 block w-full rounded-lg border p-2 text-base" type="number" min="1" max="240" value={maximum} onChange={(event) => setMaximum(event.target.value)} /></label>
          <button className="self-end rounded-lg bg-slate-800 px-4 py-2 font-bold text-white" onClick={() => run({ type: 'set-maximum-duration', minutes: Number(maximum) }, 'Maximum duration updated.')}>Set maximum duration</button>
          <label className="font-semibold">Break duration (1–120)<input className="mt-1 block w-full rounded-lg border p-2 text-base" type="number" min="1" max="120" value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} /></label>
          <button className="self-end rounded-lg bg-slate-800 px-4 py-2 font-bold text-white" onClick={() => run({ type: 'set-break-duration', minutes: Number(breakMinutes) }, 'Break duration updated.')}>Set break duration</button>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={settings.timerHidden} onChange={(event) => run({ type: 'hide-timer', hidden: event.target.checked }, event.target.checked ? 'Timer hidden.' : 'Timer shown.')} /><span className="font-semibold">Hide timer</span></label>
        </div>
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">Accommodation</h2>
        <label className="mt-3 block font-semibold">Functional support (no diagnosis)<input className="mt-1 block w-full rounded-lg border p-3 text-base" value={accommodation} onChange={(event) => setAccommodation(event.target.value)} /></label>
        <button className="mt-3 rounded-lg bg-slate-800 px-4 py-2 font-bold text-white" onClick={() => run({ type: 'add-accommodation', accommodation: { accommodationRef: `accommodation:${Date.now()}`, functionalDescription: accommodation, studentMessage: 'You may take extra processing time.' } }, 'Accommodation added.')}>Add accommodation</button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">Incomplete work and interruptions</h2>
        {partial.length === 0 ? <p className="mt-2 text-slate-600">No partially completed paused block needs rescheduling.</p> : partial.map((entry) => <button key={entry.blockRef} className="mt-3 block w-full rounded-lg border p-3 text-left font-semibold" onClick={() => run({ type: 'reschedule-incomplete-work', blockRef: entry.blockRef, replacementStart: new Date(Date.now() + 86_400_000).toISOString() }, 'Continuation scheduled.')}>Reschedule {entry.title} for tomorrow</button>)}
        {active.map((entry) => <div key={entry.blockRef} className="mt-3 flex flex-wrap gap-2"><span className="w-full font-semibold">{entry.title}</span><button className="rounded-lg border px-4 py-2" onClick={() => run({ type: 'mark-interruption', blockRef: entry.blockRef, kind: 'outside', occurredAt: new Date().toISOString() }, 'Outside interruption marked.')}>Mark outside interruption</button><button className="rounded-lg border px-4 py-2" onClick={() => run({ type: 'mark-interruption', blockRef: entry.blockRef, kind: 'technical', occurredAt: new Date().toISOString() }, 'Technical interruption marked.')}>Mark technical interruption</button></div>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">Adult-private note</h2>
        <p className="mt-1 text-sm text-slate-600">The body goes only to the isolated adult-private port. It never enters AppState or student projections.</p>
        <label className="mt-3 block font-semibold">Private note<textarea className="mt-1 block min-h-24 w-full rounded-lg border p-3 text-base" value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} /></label>
        <button className="mt-3 rounded-lg bg-slate-800 px-4 py-2 font-bold text-white" disabled={!privateNote.trim()} onClick={async () => { await run({ type: 'add-adult-private-note', noteRef: `private-note:${Date.now()}`, category: 'instruction', body: privateNote }, 'Private note committed.'); setPrivateNote('') }}>Add adult-private note</button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">Request tutor or teacher review</h2>
        <label className="mt-3 block font-semibold">Reason<input className="mt-1 block w-full rounded-lg border p-3 text-base" value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} /></label>
        <div className="mt-3 flex flex-wrap gap-2"><button className="rounded-lg bg-slate-800 px-4 py-2 font-bold text-white" onClick={() => run({ type: 'request-adult-review', requestRef: `adult-review:${Date.now()}`, audience: 'tutor', reason: reviewReason, evidenceRefs: [] }, 'Tutor review proposed.')}>Request tutor review</button><button className="rounded-lg border border-slate-500 px-4 py-2 font-bold" onClick={() => run({ type: 'request-adult-review', requestRef: `adult-review:${Date.now()}`, audience: 'teacher', reason: reviewReason, evidenceRefs: [] }, 'Teacher review proposed.')}>Request teacher review</button></div>
      </section>
    </div>
  )
}

function EvidenceCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-100 p-4"><p className="text-sm font-semibold text-slate-600">{label}</p><p className="text-2xl font-bold text-slate-900">{value}</p></div>
}
