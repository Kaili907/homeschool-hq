import {
  lazy,
  Suspense,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { AppState, Profile } from '../../types'
import { defaultSchoolYear } from '../../curriculum/pacing'
import { loadPlans } from '../../curriculum/loader'
import type { PlannerDestination } from '../../planner/types'
import { useLocalCalendarDate } from '../../planner/useLocalDate'
import { TodayView } from './TodayView'
import { CalendarView } from './CalendarView'
import { PlansView } from './PlansView'
import { StatusView } from './StatusView'

const DailyPlanView = lazy(() =>
  import('../../planner/components/DailyPlanView').then((module) => ({
    default: module.DailyPlanView,
  })),
)

export type HubTab = 'today' | 'daily-plan' | 'calendar' | 'plans' | 'status'

interface Props {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
  onClose: () => void
  /** open the classic admin Grown-Ups panel (templates, stars, sync, backup). */
  onOpenClassic: () => void
  onOpenPlannerDestination: (
    profileId: string,
    destination: PlannerDestination,
  ) => boolean
}

const TABS: { id: HubTab; label: string; emoji: string }[] = [
  { id: 'daily-plan', label: 'Daily Plan', emoji: '🗓️' },
  { id: 'today', label: 'Today', emoji: '🌅' },
  { id: 'calendar', label: 'Calendar', emoji: '🗓️' },
  { id: 'plans', label: 'Plans', emoji: '📚' },
  { id: 'status', label: 'Status', emoji: '📊' },
]

/**
 * MP — the Parent Hub: a parent-PIN-gated command center with four views. Reads and
 * plans; never grades. The classic admin panel stays reachable for config that isn't
 * a view (mission templates, stars, tutor, cloud sync, backup).
 */
export function ParentHub({
  state,
  onStateChange,
  onClose,
  onOpenClassic,
  onOpenPlannerDestination,
}: Props) {
  const [tab, setTab] = useState<HubTab>('today')
  const today = useLocalCalendarDate()
  const docs = useMemo(() => loadPlans(), [])
  const profiles = useMemo(() => Object.values(state.profiles), [state.profiles])

  // The hub defaults its start date from MM's mindset start date, so Dad needn't re-enter it.
  const sy = state.schoolYear ?? defaultSchoolYear(state.mindsetStartDate ?? '')
  const setSchoolYear = (next: typeof sy) => onStateChange((s) => ({ ...s, schoolYear: next }))
  const patchProfile = (id: string, update: (prev: Profile) => Profile) =>
    onStateChange((s) => (s.profiles[id] ? { ...s, profiles: { ...s.profiles, [id]: update(s.profiles[id]) } } : s))

  return (
    <div className="min-h-screen bg-slate-100" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 print:max-w-none print:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">🏫 Parent Hub</h1>
            <p className="text-sm text-slate-500">Reads &amp; plans — the gradebooks stay the record of truth.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onOpenClassic}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Classic panel
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Done
            </button>
          </div>
        </div>

        {/* tab bar */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1 sm:grid-cols-5 print:hidden">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                tab === tb.id ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="mr-1">{tb.emoji}</span>
              {tb.label}
            </button>
          ))}
        </div>

        {!sy.startDate && tab !== 'calendar' && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            Set a school-year start date on the <button className="underline" onClick={() => setTab('calendar')}>Calendar</button> tab to activate pacing.
          </div>
        )}

        <div className="mt-4">
          {tab === 'today' && <TodayView profiles={profiles} docs={docs} sy={sy} today={today} state={state} />}
          {tab === 'daily-plan' && (
            <Suspense
              fallback={
                <div
                  className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600"
                  role="status"
                >
                  Loading Daily Plan…
                </div>
              }
            >
              <DailyPlanView
                state={state}
                onStateChange={onStateChange}
                profiles={profiles}
                docs={docs}
                schoolYear={sy}
                today={today}
                onOpenDestination={onOpenPlannerDestination}
              />
            </Suspense>
          )}
          {tab === 'calendar' && (
            <CalendarView profiles={profiles} docs={docs} sy={sy} today={today} onChange={setSchoolYear} />
          )}
          {tab === 'plans' && (
            <PlansView profiles={profiles} docs={docs} sy={sy} today={today} onPatchProfile={patchProfile} />
          )}
          {tab === 'status' && (
            <StatusView profiles={profiles} today={today} onPatchProfile={patchProfile} />
          )}
        </div>
      </div>
    </div>
  )
}
