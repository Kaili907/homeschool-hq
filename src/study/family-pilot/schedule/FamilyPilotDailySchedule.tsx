import { getCurrentScheduleItem } from './operations'
import { scheduleProgress } from './projections'
import type { ScheduleItemKind, ScheduleItemStatus, ScheduleItemV1 } from './schema'

// FAMILY-PILOT-SCHEDULE: presentational only. It answers "what does this
// student need to do today, and what is next?" by rendering the items the
// host passes in; it holds no state of its own and persists nothing. Start
// and complete are host-owned actions — the host decides what to write down
// and when, this component only asks for it.

export interface FamilyPilotDailyScheduleProps {
  readonly studentRef: string
  readonly items: readonly ScheduleItemV1[]
  readonly onStartItem?: (scheduleItemRef: string) => void
  readonly onCompleteItem?: (scheduleItemRef: string) => void
}

const KIND_LABEL: Readonly<Record<ScheduleItemKind, string>> = Object.freeze({
  assignment: 'Assignment',
  'study-session': 'Study session',
  break: 'Break',
})

const STATUS_LABEL: Readonly<Record<ScheduleItemStatus, string>> = Object.freeze({
  pending: 'Not started',
  'in-progress': 'In progress',
  completed: 'Done',
})

export function FamilyPilotDailySchedule({
  studentRef,
  items,
  onStartItem,
  onCompleteItem,
}: FamilyPilotDailyScheduleProps) {
  const mine = items
    .filter((item) => item.studentRef === studentRef)
    .slice()
    .sort((a, b) => a.order - b.order)
  const progress = scheduleProgress(items, studentRef)
  const current = getCurrentScheduleItem(items, studentRef)

  return (
    <section className="mt-6" aria-labelledby="family-pilot-schedule">
      <h2 id="family-pilot-schedule" className="font-extrabold">Today&rsquo;s schedule</h2>
      <p className="mt-1 font-semibold text-slate-600">
        {progress.academicCompleted} of {progress.academicTotal} done · {progress.percentComplete}%
      </p>

      {mine.length === 0 && (
        <p className="mt-2 font-semibold text-slate-600">Nothing scheduled today.</p>
      )}

      {mine.length > 0 && progress.allDone && (
        <p className="mt-2 rounded-lg border border-green-300 bg-green-50 p-3 font-semibold text-green-700" role="status">
          All done for today.
        </p>
      )}

      <ul className="mt-2 space-y-2">
        {mine.map((item) => {
          const isCurrent = current?.scheduleItemRef === item.scheduleItemRef
          return (
            <li
              key={item.scheduleItemRef}
              data-schedule-item-ref={item.scheduleItemRef}
              data-status={item.status}
              className={`rounded-lg border p-3 ${
                isCurrent ? 'border-cyan-800 bg-cyan-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{item.title}</p>
                  <p className="mt-1 font-semibold text-slate-600">
                    {KIND_LABEL[item.kind]} · {STATUS_LABEL[item.status]}
                  </p>
                </div>
                <div className="flex gap-2">
                  {item.status === 'pending' && onStartItem && (
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-cyan-800 bg-cyan-700 px-3 py-2 font-bold text-white"
                      onClick={() => onStartItem(item.scheduleItemRef)}
                    >
                      Start
                    </button>
                  )}
                  {item.status !== 'completed' && onCompleteItem && (
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-slate-400 bg-white px-3 py-2 font-bold"
                      onClick={() => onCompleteItem(item.scheduleItemRef)}
                    >
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
