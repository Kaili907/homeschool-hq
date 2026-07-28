import { currentDailyBlock, nextDailyBlock } from '../selectors'
import type { DailyPlan, DailyPlanBlock, PlannerAction } from '../types'
import { DailyProgress } from './DailyProgress'
import { DailyTimeline } from './DailyTimeline'

interface Props {
  plan: DailyPlan
  onAction: (block: DailyPlanBlock, action: PlannerAction) => void
}

const friendlyDate = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function StudentMyDay({ plan, onAction }: Props) {
  const current = currentDailyBlock(plan)
  const next = nextDailyBlock(plan, current)
  const pausedAlternative =
    current?.progress.status === 'paused'
      ? plan.blocks.find(
          (block) =>
            block.instanceId !== current.instanceId &&
            block.block.scheduleBehavior === 'flexible' &&
            block.block.category === 'break' &&
            ['not-started', 'skipped'].includes(block.progress.status),
        ) ??
        (next?.block.scheduleBehavior === 'flexible' &&
        ['not-started', 'skipped'].includes(next.progress.status)
          ? next
          : undefined)
      : undefined
  const finished = plan.blocks.length > 0 && plan.summary.remainingCount === 0

  return (
    <section
      className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-5"
      aria-labelledby="my-day-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="my-day-heading" className="text-2xl font-bold text-slate-900">
            My Day
          </h2>
          <p className="text-sm font-semibold text-slate-500">{friendlyDate(plan.date)}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-700">
          ≈ {plan.summary.plannedMinutesRemaining} min left
        </span>
      </div>

      <div className="mt-3">
        <DailyProgress summary={plan.summary} />
      </div>

      {plan.blocks.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
          <div className="text-lg font-bold text-slate-700">Nothing scheduled today</div>
          <p className="mt-1 text-sm text-slate-500">Check your existing mission below.</p>
        </div>
      ) : finished ? (
        <div
          className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center"
          role="status"
        >
          <div className="text-xl font-bold text-emerald-800">Finished for the day ✓</div>
          <p className="mt-1 text-sm font-semibold text-emerald-700">
            Every eligible plan block is complete or excused.
          </p>
        </div>
      ) : current ? (
        <div className="mt-3 rounded-xl border-2 border-blue-300 bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
            {current.progress.status === 'paused' ? 'Paused activity' : 'One next action'}
          </div>
          <h3 className="mt-1 break-words text-xl font-bold text-slate-900">
            {current.block.title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {current.block.description || `${current.block.expectedMinutes} planned minutes`}
          </p>
          {current.block.requiresParentHelp && (
            <p className="mt-2 text-sm font-bold text-violet-700">Ask a parent for help.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {['not-started', 'skipped'].includes(current.progress.status) && (
              <button
                type="button"
                onClick={() => onAction(current, 'start')}
                className="rounded-lg bg-blue-600 px-5 py-3 text-base font-bold text-white hover:bg-blue-700"
              >
                Start
              </button>
            )}
            {current.progress.status === 'in-progress' && (
              <button
                type="button"
                onClick={() => onAction(current, 'pause')}
                className="rounded-lg border border-amber-400 bg-amber-50 px-5 py-3 text-base font-bold text-amber-800"
              >
                Pause
              </button>
            )}
            {current.progress.status === 'paused' && (
              <>
                <button
                  type="button"
                  onClick={() => onAction(current, 'resume')}
                  className="rounded-lg bg-blue-600 px-5 py-3 text-base font-bold text-white hover:bg-blue-700"
                >
                  Continue
                </button>
                {pausedAlternative && (
                  <button
                    type="button"
                    onClick={() => onAction(pausedAlternative, 'start')}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-5 py-3 text-base font-bold text-blue-700"
                  >
                    {pausedAlternative.block.category === 'break'
                      ? 'Take a break instead'
                      : 'Start next instead'}
                  </button>
                )}
              </>
            )}
            {current.canManuallyComplete &&
              !['completed', 'excused', 'moved'].includes(current.progress.status) && (
                <button
                  type="button"
                  onClick={() => onAction(current, 'complete')}
                  className="rounded-lg bg-emerald-600 px-5 py-3 text-base font-bold text-white hover:bg-emerald-700"
                >
                  Mark complete
                </button>
              )}
          </div>
          {!current.canManuallyComplete && (
            <p className="mt-2 text-xs font-bold text-sky-700">
              This checks itself when the linked activity is finished.
            </p>
          )}
        </div>
      ) : null}

      {next && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Next</span>
            <span className="ml-2 break-words text-sm font-bold text-slate-700">
              {next.block.title}
            </span>
          </div>
        </div>
      )}

      {plan.blocks.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">
            View ordered daily timeline ({plan.blocks.length})
          </summary>
          <div className="mt-2">
            <DailyTimeline plan={plan} />
          </div>
        </details>
      )}
      <p className="mt-3 text-center text-xs font-semibold text-slate-500">
        Plan checkmarks record schedule completion, not academic mastery.
      </p>
    </section>
  )
}
