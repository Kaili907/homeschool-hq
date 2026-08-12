import type { StudentReport } from './types'

function periodLabel(report: StudentReport): string {
  return 'date' in report ? report.date : `${report.startDate} to ${report.endDate}`
}

function formatTimeOnTask(seconds: number | null): string {
  if (seconds === null) return 'Not recorded'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-100 p-4">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

export function FamilyPilotProgressReport({ report }: { readonly report: StudentReport }) {
  return (
    <div className="family-pilot-progress-report space-y-5" data-learner-ref={report.learnerRef}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-bold text-slate-900">{report.displayName}</h3>
        <p className="text-sm text-slate-600">{periodLabel(report)}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <SummaryTile label="Assignments started" value={report.assignmentsStarted} />
          <SummaryTile label="Assignments completed" value={report.assignmentsCompleted} />
          <SummaryTile label="Open work" value={report.openWorkCount} />
          <SummaryTile
            label="Completion"
            value={report.completionPercent !== null ? `${report.completionPercent}%` : 'No work scheduled'}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-bold text-slate-900">Currently working on</h3>
        {report.currentLesson ? (
          <p className="mt-1 text-slate-700">
            {report.currentLesson}
            {report.currentSegment ? ` — ${report.currentSegment}` : ''}
          </p>
        ) : (
          <p className="mt-1 text-slate-600">Nothing in progress for {report.displayName}.</p>
        )}
        <p className="mt-2 text-sm text-slate-600">Study time recorded: {formatTimeOnTask(report.timeOnTaskSeconds)}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby={`family-pilot-attention-${report.learnerRef}`}>
        <h3 id={`family-pilot-attention-${report.learnerRef}`} className="text-xl font-bold text-slate-900">
          Needs attention
        </h3>
        {report.itemsNeedingParentAttention.length === 0 ? (
          <p className="mt-2 text-slate-600">Nothing needs attention for {report.displayName} in this period.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {report.itemsNeedingParentAttention.map((item, index) => (
              <li key={item.blockRef ?? item.recommendationRef ?? index} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                {item.kind === 'paused-work' ? (
                  <p className="text-sm font-semibold text-amber-900">Paused: {item.title}</p>
                ) : (
                  <p className="text-sm font-semibold text-amber-900">
                    Review needed (due {item.dueDate}){item.reasonCodes && item.reasonCodes.length > 0 ? ` — ${item.reasonCodes.join(', ')}` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
