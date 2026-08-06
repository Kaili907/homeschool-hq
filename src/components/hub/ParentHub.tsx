import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { AppState, Profile } from '../../types'
import { isoToday, type AppStatePersistenceFailure } from '../../appState'
import { defaultSchoolYear } from '../../curriculum/pacing'
import { loadPlans } from '../../curriculum/loader'
import { TodayView } from './TodayView'
import { CalendarView } from './CalendarView'
import { ScheduleView } from './ScheduleView'
import { DEFAULT_CORE_DAY } from '../../schedule/coreDay'
import { PlansView } from './PlansView'
import { StatusView } from './StatusView'
import { StudyParentPanel, type StudyParentLearnerOption } from './StudyParentPanel'
import { AcademyParentPanel } from './AcademyParentPanel'
import { AcademyLevelsPanel } from './AcademyLevelsPanel'
import { StudyLocalSafetyStopsPanel } from './StudyLocalSafetyStopsPanel'
import { isAnyAcademyLevelEnabled } from '../../academy/workingLevel'
import type { StudyPortBundle } from '../../study/ports'
import type { StudyAdultAuthorization } from '../../study/types'

export type HubTab = 'today' | 'calendar' | 'plans' | 'status' | 'study' | 'safety' | 'schedule' | 'academy'

export interface ParentHubStudyIntegration {
  readonly householdRef: string
  readonly learners: readonly StudyParentLearnerOption[]
  readonly ports: StudyPortBundle
  readonly authorization: StudyAdultAuthorization
}

interface Props {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
  onClose: () => void
  /** open the classic admin Grown-Ups panel (templates, stars, sync, backup). */
  onOpenClassic: () => void
  studyEnabled?: boolean
  study?: ParentHubStudyIntegration
  studyUnavailableReason?: string
  persistenceFailure?: AppStatePersistenceFailure | null
  onDismissPersistenceFailure?: () => void
}

const TABS: { id: HubTab; label: string; emoji: string }[] = [
  { id: 'today', label: 'Today', emoji: '🌅' },
  { id: 'calendar', label: 'Calendar', emoji: '🗓️' },
  { id: 'schedule', label: 'Schedule', emoji: '📆' },
  { id: 'plans', label: 'Plans', emoji: '📚' },
  { id: 'status', label: 'Status', emoji: '📊' },
]

/**
 * MP — the Parent Hub: a parent-PIN-gated command center with four views. Reads and
 * plans; never grades. The classic admin panel stays reachable for config that isn't
 * a view (mission templates, stars, tutor, cloud sync, backup).
 */
export function ParentHub({ state, onStateChange, onClose, onOpenClassic, studyEnabled = false, study, studyUnavailableReason, persistenceFailure, onDismissPersistenceFailure }: Props) {
  const [tab, setTab] = useState<HubTab>('today')
  const today = isoToday()
  const docs = useMemo(() => loadPlans(), [])
  const profiles = useMemo(() => Object.values(state.profiles), [state.profiles])
  // ACADEMY-LEVEL-DECOUPLE: the Academy tab shows whenever the build has ANY
  // academy level enabled — not only when a profile already reaches one. The
  // working-level control lives on this tab, so gating it on "a profile already
  // qualifies" would make the setting that grants access unreachable.
  const academyEnabled = isAnyAcademyLevelEnabled()
  const tabs = [
    ...TABS,
    ...(academyEnabled ? [{ id: 'academy' as const, label: 'Academy', emoji: '🏫' }] : []),
    ...(studyEnabled ? [{ id: 'study' as const, label: 'Study', emoji: '🧭' }] : []),
    // A6-5-C: the safety record is always reachable for an adult, even when the
    // Study surface itself is unavailable — a stopped session must stay visible.
    { id: 'safety' as const, label: 'Safety', emoji: '🛟' },
  ]
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

        {persistenceFailure && (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950 print:hidden" role="alert">
            <div>
              <h2 className="font-bold">
                {persistenceFailure.wrote
                  ? "Changes were saved but couldn't be verified"
                  : "Changes aren't being saved"}
              </h2>
              <p className="mt-1 text-sm">
                {persistenceFailure.wrote
                  ? 'The stored Academy data may not match what was expected. Cloud sync is paused pending review.'
                  : 'The last saved Academy data is still intact.'}
              </p>
              <p className="mt-2 text-sm"><span className="font-semibold">Reason:</span> {persistenceFailure.error}</p>
            </div>
            {onDismissPersistenceFailure && (
              <button
                type="button"
                onClick={onDismissPersistenceFailure}
                className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* tab bar */}
        <div className="mt-4 flex gap-1 rounded-xl bg-slate-200/70 p-1 print:hidden">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              aria-pressed={tab === tb.id}
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
          {tab === 'calendar' && (
            <CalendarView profiles={profiles} docs={docs} sy={sy} today={today} onChange={setSchoolYear} />
          )}
          {tab === 'schedule' && (
            <ScheduleView
              profiles={profiles}
              today={today}
              config={state.coreDay ?? DEFAULT_CORE_DAY}
              onConfigChange={(next) => onStateChange((s) => ({ ...s, coreDay: next }))}
              onPatchProfile={patchProfile}
            />
          )}
          {tab === 'plans' && (
            <PlansView profiles={profiles} docs={docs} sy={sy} today={today} onPatchProfile={patchProfile} />
          )}
          {tab === 'status' && (
            <StatusView profiles={profiles} today={today} onPatchProfile={patchProfile} />
          )}
          {tab === 'academy' && (
            <div className="space-y-4">
              <AcademyLevelsPanel profiles={profiles} onPatchProfile={patchProfile} />
              <AcademyParentPanel profiles={profiles} sy={sy} onPatchProfile={patchProfile} />
            </div>
          )}
          {tab === 'study' && study && (
            <StudyParentPanel
              householdRef={study.householdRef}
              learners={study.learners}
              ports={study.ports}
              authorization={study.authorization}
            />
          )}
          {tab === 'study' && !study && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5" role="status">
              <h2 className="font-bold text-amber-950">Study controls unavailable</h2>
              <p className="mt-1 text-amber-900">{studyUnavailableReason ?? 'Verify the authenticated household and parent authorization first.'}</p>
            </section>
          )}
          {tab === 'safety' && <StudyLocalSafetyStopsPanel />}
        </div>
      </div>
    </div>
  )
}
