import { useEffect, useState } from 'react'
import { ACTIVITY_CATEGORY_LABELS, PLANNER_STATUS_LABELS } from '../defaults'
import type {
  DailyPlan,
  DailyPlanBlock,
  PlannerAction,
  PlannerAvailabilityNotice,
  PlannerCommandOutcome,
  PlannerPlacement,
  StudentDailyPlan,
} from '../types'

interface Props {
  plan: DailyPlan | StudentDailyPlan
  parentControls?: boolean
  onAction?: (
    block: DailyPlanBlock,
    action: PlannerAction,
  ) => PlannerCommandOutcome | void
  onEdit?: (block: DailyPlanBlock) => void
  /** Parent integration may own a longer-lived command lock. */
  pendingInstanceId?: string
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

const minuteLabel = (minute: number): string => {
  const dayOffset = Math.floor(minute / 1440)
  const inDay = ((minute % 1440) + 1440) % 1440
  const time = `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(
    inDay % 60,
  ).padStart(2, '0')}`
  return dayOffset > 0 ? `day +${dayOffset} at ${time}` : time
}

function PlacementLabel({ placement }: { placement: PlannerPlacement }) {
  if (placement.kind === 'scheduled') {
    return <time dateTime={placement.startTime}>{placement.startTime}</time>
  }
  if (placement.kind === 'overflow') {
    return (
      <span>
        Overflow
        <span className="block text-[10px] font-semibold">#{placement.order}</span>
      </span>
    )
  }
  return <span>Unavailable</span>
}

function AvailabilityNotices({
  notices,
}: {
  notices: PlannerAvailabilityNotice[]
}) {
  if (notices.length === 0) return null
  return (
    <aside
      className="mb-3 min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-3"
      aria-label="Unavailable curriculum"
    >
      <div className="font-bold text-amber-900">Some curriculum is not available yet</div>
      <ul className="mt-1 space-y-1">
        {notices.map((notice) => (
          <li key={notice.id} className="min-w-0 text-sm text-amber-900">
            <span className="font-semibold">{notice.title}:</span>{' '}
            <span className="break-words">{notice.message}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs font-semibold text-amber-800">
        Unavailable notices do not count against daily completion.
      </p>
    </aside>
  )
}

export function DailyTimeline({
  plan,
  parentControls = false,
  onAction,
  onEdit,
  pendingInstanceId,
}: Props) {
  const [localPendingInstanceId, setLocalPendingInstanceId] = useState<
    string | undefined
  >()
  useEffect(() => {
    setLocalPendingInstanceId(undefined)
  }, [plan])
  const pendingId = pendingInstanceId ?? localPendingInstanceId

  const invoke = (
    row: (typeof plan.blocks)[number],
    action: PlannerAction,
  ) => {
    if (!onAction || pendingId === row.instanceId) return
    setLocalPendingInstanceId(row.instanceId)
    // Parent controls receive the full model; StudentMyDay never wires actions
    // through this timeline and receives a structurally sanitized plan.
    const outcome = onAction(row as DailyPlanBlock, action)
    if (outcome?.kind !== 'applied') setLocalPendingInstanceId(undefined)
  }

  if (plan.blocks.length === 0) {
    return (
      <>
        <AvailabilityNotices notices={plan.notices} />
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="font-semibold text-slate-600">
            {plan.notices.length > 0
              ? 'No actionable activities are available for this day.'
              : 'No activities are scheduled for this day.'}
          </p>
          {parentControls && (
            <p className="mt-1 text-sm text-slate-400">
              Recurring activities can be added from the Daily Plan editor.
            </p>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <AvailabilityNotices notices={plan.notices} />
      <ol className="space-y-2" aria-label="Ordered daily timeline">
        {plan.blocks.map((row) => {
          const status = row.progress.status
          const placement = row.placement
          const shifted =
            placement.kind === 'scheduled' &&
            placement.startTime !== row.scheduledStartTime
          const editable =
            row.block.source.kind === 'manual' ||
            row.block.source.kind === 'romeo-online'
          const parentNotes =
            parentControls && 'parentNotes' in row.block
              ? row.block.parentNotes
              : undefined
          const navigationUnavailable =
            row.navigation?.destination.kind === 'unavailable'
          const actionPending = pendingId === row.instanceId
          const mayOpen = row.canStart && !navigationUnavailable
          const terminal = ['completed', 'excused', 'moved'].includes(status)
          return (
            <li
              key={row.instanceId}
              className={`min-w-0 rounded-xl border p-3 ${STATUS_STYLE[status]}`}
              aria-busy={actionPending}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="w-16 shrink-0 pt-0.5 text-sm font-bold text-slate-700">
                  <PlacementLabel placement={placement} />
                  {shifted && (
                    <div className="text-[10px] font-semibold text-slate-500">
                      preferred {row.scheduledStartTime}
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
                    <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {row.block.scheduleBehavior === 'fixed'
                        ? 'Fixed time'
                        : 'Flexible'}
                    </span>
                    {placement.kind === 'overflow' && (
                      <span className="rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-800">
                        Overflow · unscheduled
                      </span>
                    )}
                    {placement.kind === 'unavailable' && (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                        Unavailable
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 break-words text-xs font-semibold text-slate-500">
                    {ACTIVITY_CATEGORY_LABELS[row.block.category]} ·{' '}
                    {row.block.expectedMinutes} min
                    {row.generated ? ' · Generated' : ''}
                    {row.block.requiresParentHelp ? ' · Parent help' : ''}
                  </div>
                  {row.block.studentInstructions && (
                    <p className="mt-1 break-words text-sm text-slate-600">
                      {row.block.studentInstructions}
                    </p>
                  )}
                  {row.block.location && (
                    <p className="mt-1 break-words text-xs text-slate-500">
                      Location: {row.block.location}
                    </p>
                  )}
                  {parentNotes && (
                    <p className="mt-1 break-words rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-900">
                      <span className="font-bold">Parent note:</span> {parentNotes}
                    </p>
                  )}
                  {placement.kind === 'overflow' && (
                    <p className="mt-1 break-words text-xs font-bold text-orange-800">
                      This activity does not fit in today&apos;s available schedule.
                      It remains ordered as overflow #{placement.order}; earliest{' '}
                      {minuteLabel(placement.earliestStartMinute)}.
                    </p>
                  )}
                  {placement.kind === 'scheduled' && placement.conflict && (
                    <p className="mt-1 text-xs font-bold text-rose-800">
                      Schedule conflict: this saved occurrence overlaps another reserved
                      interval.
                    </p>
                  )}
                  {(row.unavailableReason || navigationUnavailable) && (
                    <p className="mt-1 break-words text-xs font-bold text-amber-900">
                      Open unavailable: {row.unavailableReason ??
                        (row.navigation?.destination.kind === 'unavailable'
                          ? row.navigation.destination.message
                          : 'No dependable destination is available.')}
                    </p>
                  )}
                  {row.block.source.kind === 'mission' &&
                    row.block.source.autoOnly && (
                      <p className="mt-1 text-xs font-bold text-sky-700">
                        Completed only by its linked activity — no manual bypass.
                      </p>
                    )}

                  {parentControls && onAction && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {['not-started', 'skipped'].includes(status) && mayOpen && (
                        <button
                          type="button"
                          className={SMALL_BUTTON}
                          disabled={actionPending}
                          onClick={() => invoke(row, 'start')}
                        >
                          Start
                        </button>
                      )}
                      {status === 'in-progress' && (
                        <button
                          type="button"
                          className={SMALL_BUTTON}
                          disabled={actionPending}
                          onClick={() => invoke(row, 'pause')}
                        >
                          Pause
                        </button>
                      )}
                      {status === 'paused' && mayOpen && (
                        <button
                          type="button"
                          className={SMALL_BUTTON}
                          disabled={actionPending}
                          onClick={() => invoke(row, 'resume')}
                        >
                          Continue
                        </button>
                      )}
                      {row.canManuallyComplete &&
                        !navigationUnavailable &&
                        !terminal && (
                        <button
                          type="button"
                          disabled={actionPending}
                          className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => invoke(row, 'complete')}
                        >
                          Complete
                        </button>
                      )}
                      {row.canSetDisposition &&
                        !['completed', 'excused', 'moved', 'skipped'].includes(
                          status,
                        ) && (
                          <button
                            type="button"
                            className={SMALL_BUTTON}
                            disabled={actionPending}
                            onClick={() => invoke(row, 'skip')}
                          >
                            Skip
                          </button>
                        )}
                      {row.canSetDisposition && !terminal && (
                        <>
                          <button
                            type="button"
                            className={SMALL_BUTTON}
                            disabled={actionPending}
                            onClick={() => invoke(row, 'excuse')}
                          >
                            Excuse
                          </button>
                          <button
                            type="button"
                            className={SMALL_BUTTON}
                            disabled={actionPending}
                            onClick={() => invoke(row, 'move')}
                          >
                            Move
                          </button>
                        </>
                      )}
                      {terminal &&
                        row.canSetDisposition &&
                        row.block.source.kind !== 'mission' && (
                          <button
                            type="button"
                            className={SMALL_BUTTON}
                            disabled={actionPending}
                            onClick={() => invoke(row, 'reopen')}
                          >
                            Reopen activity
                          </button>
                        )}
                      {editable && row.canSetDisposition && onEdit && (
                        <button
                          type="button"
                          className={SMALL_BUTTON}
                          disabled={actionPending}
                          onClick={() => onEdit(row as DailyPlanBlock)}
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
    </>
  )
}
