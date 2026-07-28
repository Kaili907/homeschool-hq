import { ACTIVITY_CATEGORY_LABELS, PLANNER_STATUS_LABELS } from '../defaults'
import type { DailyPlan, DailyPlanBlock, PlannerAction } from '../types'

interface Props {
  plan: DailyPlan
  parentControls?: boolean
  onAction?: (block: DailyPlanBlock, action: PlannerAction) => void
  onEdit?: (block: DailyPlanBlock) => void
}

const STATUS_STYLE: Record<DailyPlanBlock['progress']['status'], string> = {
  'not-started': 'border-slate-200 bg-white',
  'in-progress': 'border-blue-500 bg-blue-50 ring-2 ring-blue-100',
  paused: 'border-amber-400 bg-amber-50 border-dashed',
  completed: 'border-emerald-400 bg-emerald-50',
  skipped: 'border-rose-300 bg-rose-50',
  excused: 'border-slate-300 bg-slate-100',
  moved: 'border-violet-300 bg-violet-50',
}

const SMALL_BUTTON =
  'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

export function DailyTimeline({
  plan,
  parentControls = false,
  onAction,
  onEdit,
}: Props) {
  if (plan.blocks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="font-semibold text-slate-600">No activities are scheduled for this day.</p>
        <p className="mt-1 text-sm text-slate-400">
          Recurring activities can be added from the Daily Plan editor.
        </p>
      </div>
    )
  }

  return (
    <ol className="space-y-2" aria-label="Ordered daily timeline">
      {plan.blocks.map((row) => {
        const status = row.progress.status
        const shifted = row.effectiveStartTime !== row.scheduledStartTime
        const editable =
          row.block.source.kind === 'manual' || row.block.source.kind === 'romeo-online'
        return (
          <li
            key={row.instanceId}
            className={`min-w-0 rounded-xl border p-3 ${STATUS_STYLE[status]}`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="w-14 shrink-0 pt-0.5 text-sm font-bold text-slate-700">
                <time dateTime={`${row.date}T${row.effectiveStartTime}`}>
                  {row.effectiveStartTime}
                </time>
                {shifted && (
                  <div className="text-[10px] font-semibold text-slate-400">
                    was {row.scheduledStartTime}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="min-w-0 break-words font-bold text-slate-900">
                    {row.block.title}
                  </h3>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {PLANNER_STATUS_LABELS[status]}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {row.block.scheduleBehavior === 'fixed' ? 'Fixed time' : 'Flexible'}
                  </span>
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-500">
                  {ACTIVITY_CATEGORY_LABELS[row.block.category]} · {row.block.expectedMinutes} min
                  {row.generated ? ' · Generated' : ''}
                  {row.block.requiresParentHelp ? ' · Parent help' : ''}
                </div>
                {row.block.description && (
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {row.block.description}
                  </p>
                )}
                {(row.block.location || row.block.notes) && (
                  <p className="mt-1 break-words text-xs text-slate-500">
                    {[row.block.location, row.block.notes].filter(Boolean).join(' · ')}
                  </p>
                )}
                {row.block.source.kind === 'mission' && row.block.source.autoOnly && (
                  <p className="mt-1 text-xs font-bold text-sky-700">
                    Completed only by its linked activity — no manual bypass.
                  </p>
                )}

                {parentControls && onAction && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['not-started', 'skipped'].includes(status) && (
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        onClick={() => onAction(row, 'start')}
                      >
                        Start
                      </button>
                    )}
                    {status === 'in-progress' && (
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        onClick={() => onAction(row, 'pause')}
                      >
                        Pause
                      </button>
                    )}
                    {status === 'paused' && (
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        onClick={() => onAction(row, 'resume')}
                      >
                        Continue
                      </button>
                    )}
                    {row.canManuallyComplete &&
                      !['completed', 'excused', 'moved'].includes(status) && (
                        <button
                          type="button"
                          className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                          onClick={() => onAction(row, 'complete')}
                        >
                          Complete
                        </button>
                      )}
                    {row.canSetDisposition &&
                      !['completed', 'excused', 'moved', 'skipped'].includes(status) && (
                        <button
                          type="button"
                          className={SMALL_BUTTON}
                          onClick={() => onAction(row, 'skip')}
                        >
                          Skip
                        </button>
                      )}
                    {row.canSetDisposition &&
                      !['completed', 'excused', 'moved'].includes(status) && (
                        <button
                          type="button"
                          className={SMALL_BUTTON}
                          onClick={() => onAction(row, 'excuse')}
                        >
                          Excuse
                        </button>
                      )}
                    {editable && onEdit && (
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        onClick={() => onEdit(row)}
                      >
                        Edit schedule
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
