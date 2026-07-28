import { useEffect, useRef, useState } from 'react'
import type {
  PlannerAction,
  PlannerCommandOutcome,
  StudentDailyPlan,
  StudentDailyPlanBlock,
} from '../types'
import { DailyProgress } from './DailyProgress'
import { DailyTimeline } from './DailyTimeline'

interface Props {
  plan: StudentDailyPlan
  onAction: (
    block: StudentDailyPlanBlock,
    action: PlannerAction,
  ) => PlannerCommandOutcome | void
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
  const [pendingInstanceId, setPendingInstanceId] = useState<string>()
  const pendingInstanceRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    pendingInstanceRef.current = undefined
    setPendingInstanceId(undefined)
  }, [plan])

  const navigationUnavailable = (
    block: StudentDailyPlanBlock | undefined,
  ): string | undefined => {
    if (!block) return undefined
    if (block.unavailableReason) return block.unavailableReason
    return block.navigation?.destination.kind === 'unavailable'
      ? block.navigation.destination.message
      : undefined
  }
  const canOpen = (block: StudentDailyPlanBlock): boolean =>
    block.canStart &&
    Boolean(block.navigation) &&
    block.navigation?.destination.kind !== 'unavailable'
  const actionable = (block: StudentDailyPlanBlock): boolean =>
    block.progress.status === 'in-progress' ||
    block.progress.status === 'paused' ||
    canOpen(block) ||
    (block.canManuallyComplete && !navigationUnavailable(block))
  const remaining = plan.blocks.filter(
    (block) =>
      ['not-started', 'in-progress', 'paused', 'skipped'].includes(
        block.progress.status,
      ) && actionable(block),
  )
  const current =
    remaining.find((block) => block.progress.status === 'in-progress') ??
    remaining.find((block) => block.progress.status === 'paused') ??
    remaining[0]
  const currentIndex = current
    ? remaining.findIndex((block) => block.instanceId === current.instanceId)
    : -1
  const next = currentIndex >= 0 ? remaining[currentIndex + 1] : remaining[0]
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
        canOpen(next) &&
        ['not-started', 'skipped'].includes(next.progress.status)
          ? next
          : undefined)
      : undefined
  const hasFinishedDisposition = plan.blocks.some((block) =>
    ['completed', 'excused', 'moved'].includes(block.progress.status),
  )
  const finished =
    hasFinishedDisposition && plan.summary.remainingCount === 0
  const invoke = (block: StudentDailyPlanBlock, action: PlannerAction) => {
    if (pendingInstanceRef.current) return
    pendingInstanceRef.current = block.instanceId
    setPendingInstanceId(block.instanceId)
    const outcome = onAction(block, action)
    if (outcome?.kind !== 'applied') {
      pendingInstanceRef.current = undefined
      setPendingInstanceId(undefined)
    }
  }

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

      {plan.notices.length > 0 && (
        <aside
          className="mt-3 min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-3"
          aria-label="Unavailable curriculum"
        >
          <div className="font-bold text-amber-900">
            Some curriculum is not available yet
          </div>
          <ul className="mt-1 space-y-1">
            {plan.notices.map((notice) => (
              <li key={notice.id} className="break-words text-sm text-amber-900">
                <span className="font-semibold">{notice.title}:</span>{' '}
                {notice.message}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs font-semibold text-amber-800">
            These notices do not count against your daily progress.
          </p>
        </aside>
      )}

      {plan.blocks.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
          <div className="text-lg font-bold text-slate-700">
            {plan.notices.length > 0
              ? 'No activities are ready to open yet'
              : 'Nothing scheduled today'}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {plan.notices.length > 0
              ? 'A parent can review the unavailable curriculum above.'
              : 'Check your existing mission below.'}
          </p>
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
            {current.block.studentInstructions ||
              `${current.block.expectedMinutes} planned minutes`}
          </p>
          {current.block.requiresParentHelp && (
            <p className="mt-2 text-sm font-bold text-violet-700">Ask a parent for help.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {['not-started', 'skipped'].includes(current.progress.status) &&
              canOpen(current) && (
                <button
                  type="button"
                  disabled={Boolean(pendingInstanceId)}
                  onClick={() => invoke(current, 'start')}
                  className="rounded-lg bg-blue-600 px-5 py-3 text-base font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {current.navigation?.destination.kind === 'manual-activity'
                    ? 'Start'
                    : 'Start and open'}
                </button>
              )}
            {current.progress.status === 'in-progress' && (
              <button
                type="button"
                disabled={Boolean(pendingInstanceId)}
                onClick={() => invoke(current, 'pause')}
                className="rounded-lg border border-amber-400 bg-amber-50 px-5 py-3 text-base font-bold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Pause
              </button>
            )}
            {current.progress.status === 'paused' && (
              <>
                {canOpen(current) && (
                  <button
                    type="button"
                    disabled={Boolean(pendingInstanceId)}
                    onClick={() => invoke(current, 'resume')}
                    className="rounded-lg bg-blue-600 px-5 py-3 text-base font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continue
                  </button>
                )}
                {pausedAlternative && canOpen(pausedAlternative) && (
                  <button
                    type="button"
                    disabled={Boolean(pendingInstanceId)}
                    onClick={() => invoke(pausedAlternative, 'start')}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-5 py-3 text-base font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pausedAlternative.block.category === 'break'
                      ? 'Take a break instead'
                      : 'Start next instead'}
                  </button>
                )}
              </>
            )}
            {current.canManuallyComplete &&
              !navigationUnavailable(current) &&
              !['completed', 'excused', 'moved'].includes(current.progress.status) && (
                <button
                  type="button"
                  disabled={Boolean(pendingInstanceId)}
                  onClick={() => invoke(current, 'complete')}
                  className="rounded-lg bg-emerald-600 px-5 py-3 text-base font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark complete
                </button>
              )}
          </div>
          {navigationUnavailable(current) && (
            <p className="mt-2 break-words rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm font-bold text-amber-900">
              Open unavailable: {navigationUnavailable(current)}
            </p>
          )}
          {!current.canManuallyComplete && (
            <p className="mt-2 text-xs font-bold text-sky-700">
              A linked activity or parent-controlled source records completion.
            </p>
          )}
        </div>
      ) : (
        <div
          className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-center"
          role="status"
        >
          <div className="font-bold text-amber-900">
            No remaining activity can be opened right now
          </div>
          <p className="mt-1 text-sm text-amber-800">
            Review the unavailable messages or ask a parent for help.
          </p>
        </div>
      )}

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
