import type { FamilyPilotStudentSnapshot, FamilyPilotWorkItem } from './types'

const STATUS_LABEL: Record<FamilyPilotWorkItem['status'], string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  paused: 'Paused',
  completed: 'Completed',
}

const STATUS_BADGE_CLASS: Record<FamilyPilotWorkItem['status'], string> = {
  'not-started': 'bg-slate-100 text-slate-700',
  'in-progress': 'bg-cyan-100 text-cyan-900',
  paused: 'bg-amber-100 text-amber-900',
  completed: 'bg-emerald-100 text-emerald-900',
}

function formatTimeOnTask(seconds: number | null): string | null {
  if (seconds === null) return null
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-100 p-4">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

export function FamilyPilotStudentCard({
  snapshot,
  onAllowResume,
  onReviewDecision,
}: {
  readonly snapshot: FamilyPilotStudentSnapshot
  readonly onAllowResume: (blockRef: string) => void | Promise<void>
  readonly onReviewDecision: (recommendationRef: string, decision: 'accepted' | 'rejected') => void | Promise<void>
}) {
  const { learner, workItems, reviewItems, safety, counts } = snapshot
  return (
    <div className="family-pilot-student-card space-y-5" data-learner-ref={learner.learnerRef}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-bold text-slate-900">{learner.displayName}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <SummaryTile label="Not started" value={counts.notStarted} />
          <SummaryTile label="In progress" value={counts.inProgress} />
          <SummaryTile label="Paused" value={counts.paused} />
          <SummaryTile label="Completed" value={counts.completed} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby={`family-pilot-assigned-work-${learner.learnerRef}`}>
        <h3 id={`family-pilot-assigned-work-${learner.learnerRef}`} className="text-xl font-bold text-slate-900">
          Assigned work
        </h3>
        {workItems.length === 0 ? (
          <p className="mt-2 text-slate-600">No study work is assigned to {learner.displayName} yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {workItems.map((item) => (
              <li key={item.blockRef} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">{item.title}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE_CLASS[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {item.scheduledLocalDate} · {item.requiredWorkCompletionPercent}% of required work complete
                </p>
                {item.currentSegmentTitle && (
                  <p className="mt-1 text-sm text-slate-700">
                    Current: {item.currentSegmentTitle}
                    {item.currentSegmentOrdinal ? ` (step ${item.currentSegmentOrdinal} of ${item.totalSegments})` : ''}
                  </p>
                )}
                {formatTimeOnTask(item.timeOnTaskSeconds) && (
                  <p className="mt-1 text-sm text-slate-600">Time on task: {formatTimeOnTask(item.timeOnTaskSeconds)}</p>
                )}
                {item.pauseState && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">
                      Paused{item.pauseState.category !== 'unspecified' ? ` — ${item.pauseState.category} interruption` : ''}
                    </p>
                    <button
                      type="button"
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white"
                      onClick={() => onAllowResume(item.blockRef)}
                    >
                      Allow resume
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby={`family-pilot-review-${learner.learnerRef}`}>
        <h3 id={`family-pilot-review-${learner.learnerRef}`} className="text-xl font-bold text-slate-900">
          Parent review
        </h3>
        {reviewItems.length === 0 ? (
          <p className="mt-2 text-slate-600">No review is waiting for {learner.displayName}.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reviewItems.map((review) => (
              <li key={review.recommendationRef} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">
                  Due {review.dueDate} · {review.reasonCodes.join(', ')}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
                    onClick={() => onReviewDecision(review.recommendationRef, 'accepted')}
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-bold text-slate-700"
                    onClick={() => onReviewDecision(review.recommendationRef, 'rejected')}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className={`rounded-2xl border p-5 ${safety.hasActiveStop ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
        role={safety.hasActiveStop ? 'alert' : undefined}
      >
        <h3 className="text-xl font-bold text-slate-900">Study safety status</h3>
        {safety.historyState === 'unavailable' && (
          <p role="alert" className="mt-1 text-sm font-semibold text-red-900">This device could not record safety events.</p>
        )}
        {safety.historyState === 'incomplete' && (
          <p role="alert" className="mt-1 text-sm font-semibold text-amber-900">Safety-event history may be incomplete on this device.</p>
        )}
        {safety.hasActiveStop ? (
          <p className="mt-1 font-semibold text-red-900">
            A safety stop was recorded{safety.mostRecentStopAt ? ` (most recently at ${safety.mostRecentStopAt})` : ''}. This
            device-local hold cannot be cleared from the Parent Hub.
          </p>
        ) : (
          <p className="mt-1 text-slate-700">No safety stop is recorded for {learner.displayName} on this device.</p>
        )}
      </section>
    </div>
  )
}
