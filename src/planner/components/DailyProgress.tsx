import type { DailyPlanSummary } from '../types'

interface Props {
  summary: DailyPlanSummary
  compact?: boolean
}

export function DailyProgress({ summary, compact = false }: Props) {
  return (
    <section
      aria-label="Daily plan progress"
      className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Daily completion
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {summary.completionPercentage}%
          </div>
        </div>
        <div className="text-right text-sm font-semibold text-slate-600">
          {summary.completedCount} completed · {summary.remainingCount} remaining
        </div>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={`${summary.completionPercentage}% of eligible daily plan blocks completed`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.completionPercentage}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${summary.completionPercentage}%` }}
        />
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        <Metric label="Planned" value={`${summary.plannedMinutes} min`} />
        <Metric label="Remaining" value={`≈ ${summary.plannedMinutesRemaining} min`} />
        {!compact && <Metric label="Active time" value={`${summary.activeMinutes} min`} />}
        {!compact && (
          <Metric
            label="Eligible blocks"
            value={`${summary.completedCount}/${summary.eligibleCount}`}
          />
        )}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-2 py-2">
      <div className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="text-sm font-bold text-slate-700">{value}</div>
    </div>
  )
}
