import { useMemo, useRef, useState } from 'react'
import type { CourseTrack, Difficulty, Profile } from '../types'
import { finishSession, isoToday } from '../appState'
import { useTheme } from '../theme'
import { MissionCard } from './MissionCard'
import { MindsetCard } from './mindset/MindsetCard'
import { HsQuizRunner, type HsQuizRecord } from './HsQuizRunner'
import { ALGEBRA_TOPIC_IDS, GEOMETRY_UNITS, GEOMETRY_UNIT_IDS } from '../hs/hsCatalog'
import { geometryFresh } from '../hs/geometryGen'
import { algebraQuestion, buildAlgebraDeck } from '../hs/algebraGen'
import type { HsQuestion } from '../hs/hsQuestion'
import type { HomeAssessmentCard } from './assessment/homeCards'
import {
  courseProgress,
  ensureHsDefaults,
  getHsStat,
  recordHsAnswer,
  sortedCollegeTasks,
  toggleCourseUnit,
  updateCollegeTask,
} from '../hs/hsState'
import { ServiceHoursCard } from './service/ServiceHoursCard'

const PRACTICE_TOTAL = 8
const ALGEBRA_TOTAL = 5
const TIMED_TOTAL = 10
const TIMED_SECONDS = 360 // 6:00 — brisk SAT-style pacing for 10 questions

type TimedSource = 'geometry' | 'algebra' | 'mixed'

type HsScreen =
  | { kind: 'home' }
  | { kind: 'practice'; unit: string }
  | { kind: 'algebra' }
  | { kind: 'timed'; source: TimedSource }
  | { kind: 'results'; title: string; score: number; total: number; answered: number }

interface Props {
  profile: Profile
  onProfileChange: (update: (prev: Profile) => Profile) => void
  onSignOut: () => void
  onToggleItem: (itemId: string, done: boolean) => void
  // MA×M4 integration: assessments are HS content, so the teen home surfaces
  // the same assigned-assessment cards MA renders on the kids' home.
  assessmentCards: HomeAssessmentCard[]
  onOpenAssessment: (testId: string) => void
  onOpenMindset: () => void
  onOpenStudy?: () => void
  studyMode?: 'preview' | 'production' | 'unavailable'
  mindsetStartDate: string | undefined
}

const rnd = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

function pickUnitDifficulty(attempts: number, correct: number): Difficulty {
  const acc = attempts >= 4 ? correct / attempts : 0.55
  const base = acc < 0.5 ? 1 : acc < 0.8 ? 2 : 3
  const roll = Math.random()
  const d = roll < 0.2 ? base - 1 : roll > 0.85 ? base + 1 : base
  return Math.min(3, Math.max(1, d)) as Difficulty
}

const longestStreak = (recs: HsQuizRecord[]) => {
  let best = 0
  let cur = 0
  for (const r of recs) {
    cur = r.correct ? cur + 1 : 0
    best = Math.max(best, cur)
  }
  return best
}

export function HighSchoolHome({
  profile: rawProfile,
  onProfileChange,
  onSignOut,
  onToggleItem,
  assessmentCards,
  onOpenAssessment,
  onOpenMindset,
  onOpenStudy,
  studyMode,
  mindsetStartDate,
}: Props) {
  const t = useTheme()
  const [screen, setScreen] = useState<HsScreen>({ kind: 'home' })
  const seenRef = useRef(new Set<string>())
  const deckRef = useRef<HsQuestion[]>([])

  // Seed the additive HS fields (courses, senior deadlines) at render rather than
  // via an effect: App's own ensureToday effect writes the profile on mount from a
  // stale snapshot, so a seeding effect would race and lose. Deriving is race-free —
  // the first real HS edit (a tick, a quiz answer) persists the seeded shape.
  // NB: this is the RENDER/READ view; every WRITE seeds prev inside its updater
  // (below) so the persisted shape matches regardless of write ordering.
  const profile = useMemo(() => ensureHsDefaults(rawProfile), [rawProfile])

  const isSenior = profile.grade === '12'

  // ---------- launchers ----------
  const startPractice = (unit: string) => {
    seenRef.current = new Set()
    setScreen({ kind: 'practice', unit })
  }
  const startAlgebra = () => {
    deckRef.current = buildAlgebraDeck(ALGEBRA_TOTAL)
    setScreen({ kind: 'algebra' })
  }
  const startTimed = (source: TimedSource) => {
    seenRef.current = new Set()
    setScreen({ kind: 'timed', source })
  }

  // Writers derive their base from the freshest committed profile via the
  // functional update, so a finishSession firing right after the final answer
  // composes onto it instead of clobbering the just-recorded question. Each
  // seeds prev with ensureHsDefaults so the additive HS shape always persists.
  const recordAnswer = (unit: string, correct: boolean) =>
    onProfileChange((prev) => recordHsAnswer(ensureHsDefaults(prev), unit, correct))

  const finishRound = (title: string, total: number, recs: HsQuizRecord[]) => {
    onProfileChange((prev) => finishSession(ensureHsDefaults(prev), longestStreak(recs)))
    setScreen({
      kind: 'results',
      title,
      score: recs.filter((r) => r.correct).length,
      total,
      answered: recs.length,
    })
  }

  // ---------- quiz screens ----------
  if (screen.kind === 'practice') {
    const unit = GEOMETRY_UNITS.find((u) => u.id === screen.unit)!
    return (
      <HsQuizRunner
        title={`Geometry · ${unit.name}`}
        total={PRACTICE_TOTAL}
        getQuestion={() => {
          const s = getHsStat(profile, unit.id)
          return geometryFresh(unit.id, pickUnitDifficulty(s.attempts, s.correct), seenRef.current)
        }}
        onAnswer={recordAnswer}
        onFinish={(recs) => finishRound(`Geometry · ${unit.name}`, PRACTICE_TOTAL, recs)}
        onQuit={() => setScreen({ kind: 'home' })}
      />
    )
  }

  if (screen.kind === 'algebra') {
    return (
      <HsQuizRunner
        title="Algebra I warm-up"
        total={ALGEBRA_TOTAL}
        getQuestion={(i) => deckRef.current[i] ?? algebraQuestion(rnd(ALGEBRA_TOPIC_IDS), 2)}
        onAnswer={recordAnswer}
        onFinish={(recs) => finishRound('Algebra I warm-up', ALGEBRA_TOTAL, recs)}
        onQuit={() => setScreen({ kind: 'home' })}
      />
    )
  }

  if (screen.kind === 'timed') {
    const src = screen.source
    const label = src === 'geometry' ? 'Geometry' : src === 'algebra' ? 'Algebra' : 'Mixed'
    return (
      <HsQuizRunner
        title={`Timed quiz · ${label}`}
        total={TIMED_TOTAL}
        timedSeconds={TIMED_SECONDS}
        getQuestion={() => {
          const useGeo = src === 'geometry' || (src === 'mixed' && Math.random() < 0.6)
          const d = rnd([1, 2, 2, 3] as const) as Difficulty
          return useGeo
            ? geometryFresh(rnd(GEOMETRY_UNIT_IDS), d, seenRef.current)
            : algebraQuestion(rnd(ALGEBRA_TOPIC_IDS), d)
        }}
        onAnswer={recordAnswer}
        onFinish={(recs) => finishRound(`Timed quiz · ${label}`, TIMED_TOTAL, recs)}
        onQuit={() => setScreen({ kind: 'home' })}
      />
    )
  }

  if (screen.kind === 'results') {
    return (
      <ResultsView
        title={screen.title}
        score={screen.score}
        total={screen.total}
        answered={screen.answered}
        onHome={() => setScreen({ kind: 'home' })}
      />
    )
  }

  // ---------- home ----------
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${t.heading}`}>Hi, {profile.name}</h1>
          <p className={`mt-1 text-sm font-medium ${t.sub}`}>
            {profile.streaks.current > 0
              ? `${profile.streaks.current}-day streak`
              : 'Practice & progress — Grade ' + profile.grade}
          </p>
        </div>
        <button onClick={onSignOut} className={`${t.secondaryBtn} px-4 py-2 text-sm`}>
          Sign out
        </button>
      </header>

      {/* UI-HOME-C: this dashboard-reachable workspace remains assistant-free
          until the separate capability and safety gates are cleared. */}

      {onOpenStudy && (
        <button
          onClick={onOpenStudy}
          className="mt-5 flex min-h-11 w-full items-center gap-3 rounded-2xl border border-cyan-300 bg-cyan-50 p-4 text-left font-bold text-cyan-950 shadow-sm hover:bg-cyan-100"
        >
          <span aria-hidden="true" className="text-2xl">🧭</span>
          <span><span className="block text-lg">Today’s Study plan</span><span className="block text-sm font-medium text-cyan-800">{studyMode === 'preview'
            ? 'Launch the explicit local Study preview'
            : studyMode === 'production'
              ? 'Open the verified production Study workspace'
              : 'Check whether Study is available'}</span></span>
        </button>
      )}

      {profile.totals.questionsAnswered > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <span className={`${t.statPill} px-3 py-1 text-slate-600`}>{profile.totals.correct} correct</span>
          <span className={`${t.statPill} px-3 py-1 text-slate-600`}>{profile.totals.sessions} sessions</span>
          <span className={`${t.statPill} px-3 py-1 text-slate-600`}>{profile.totals.questionsAnswered} answered</span>
        </div>
      )}

      {/* MA×M4 integration: assigned assessments (HS content) sit at the very top */}
      {assessmentCards.length > 0 && (
        <div className="mt-6 space-y-3">
          {assessmentCards.map(({ test, status }) => (
            <button
              key={test.id}
              onClick={() => onOpenAssessment(test.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-500"
            >
              <span className="text-3xl">📋</span>
              <span className="flex-1">
                <span className="block font-bold text-slate-900">{test.title}</span>
                <span className="block text-sm font-semibold text-slate-500">
                  {status === 'in-progress'
                    ? 'In progress — see Dad to continue'
                    : 'Placement — see Dad before starting'}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                {status === 'in-progress' ? 'resume' : 'start'}
              </span>
            </button>
          ))}
        </div>
      )}

      {isSenior && (
        <div className="mt-6">
          <CollegeDeadlines profile={profile} onProfileChange={onProfileChange} />
        </div>
      )}

      <div className="mt-6">
        <MissionCard profile={profile} onToggle={onToggleItem} />
      </div>

      {/* MM mindset — weekly lesson + habit card (teens: core + extension + journal) */}
      <MindsetCard profile={profile} startDate={mindsetStartDate} onOpen={onOpenMindset} />

      {/* SE-B service-hours log (teens) */}
      <div className="mt-6">
        <ServiceHoursCard profile={profile} onProfileChange={onProfileChange} />
      </div>

      {/* Geometry practice sets */}
      <h2 className={`mt-8 mb-3 text-xl font-bold ${t.heading}`}>Geometry practice</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GEOMETRY_UNITS.map((u) => {
          const s = getHsStat(profile, u.id)
          const acc = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : null
          return (
            <button
              key={u.id}
              onClick={() => startPractice(u.id)}
              className={`${t.card} p-4 text-left transition-all hover:border-slate-400`}
            >
              <div className={`font-semibold ${t.heading}`}>{u.name}</div>
              <div className={`mt-0.5 text-xs ${t.sub}`}>{u.blurb}</div>
              <div className="mt-2 text-xs font-medium text-slate-400">
                {acc === null ? 'Not started' : `${acc}% · ${s.attempts} tried`}
              </div>
            </button>
          )
        })}
      </div>

      {/* Algebra warm-up + timed quiz */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className={`${t.card} p-5`}>
          <div className={`text-lg font-bold ${t.heading}`}>Algebra I warm-up</div>
          <p className={`mt-1 text-sm ${t.sub}`}>
            5 quick questions — equations, slope & factoring to keep the foundation warm.
          </p>
          <button onClick={startAlgebra} className={`${t.primaryBtn} mt-3 px-4 py-2 text-sm`}>
            Start warm-up
          </button>
        </div>
        <div className={`${t.card} p-5`}>
          <div className={`text-lg font-bold ${t.heading}`}>Timed quiz</div>
          <p className={`mt-1 text-sm ${t.sub}`}>10 questions, 6-minute countdown — SAT-style pacing.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => startTimed('geometry')} className={`${t.secondaryBtn} px-3 py-2 text-sm`}>
              Geometry
            </button>
            <button onClick={() => startTimed('algebra')} className={`${t.secondaryBtn} px-3 py-2 text-sm`}>
              Algebra
            </button>
            <button onClick={() => startTimed('mixed')} className={`${t.primaryBtn} px-3 py-2 text-sm`}>
              Mixed
            </button>
          </div>
        </div>
      </div>

      {/* Course progress tracker */}
      <h2 className={`mt-8 mb-3 text-xl font-bold ${t.heading}`}>Course progress</h2>
      <CourseTracker profile={profile} onProfileChange={onProfileChange} />
    </div>
  )
}

// ---------- results ----------

function ResultsView({
  title,
  score,
  total,
  answered,
  onHome,
}: {
  title: string
  score: number
  total: number
  answered: number
  onHome: () => void
}) {
  const t = useTheme()
  const skipped = total - answered
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 text-center">
      <div className={`${t.card} p-8`}>
        <div className={`text-sm font-medium ${t.sub}`}>{title}</div>
        <div className="mt-3 text-5xl font-bold text-slate-900">
          {score}/{total}
        </div>
        <div className={`mt-1 text-sm ${t.sub}`}>
          correct{skipped > 0 ? ` · ${skipped} not reached (ran out of time)` : ''}
        </div>
        <div className="mt-4 text-sm font-medium text-slate-500">
          {Math.round((score / total) * 100)}% this round
        </div>
      </div>
      <button onClick={onHome} className={`${t.primaryBtn} mt-6 px-6 py-3`}>
        Back home
      </button>
    </div>
  )
}

// ---------- senior college-application deadlines ----------

function CollegeDeadlines({ profile, onProfileChange }: { profile: Profile; onProfileChange: (update: (prev: Profile) => Profile) => void }) {
  const t = useTheme()
  const today = isoToday()
  const sorted = useMemo(() => sortedCollegeTasks(profile.collegeTasks ?? [], today), [profile.collegeTasks, today])
  const overdueCount = sorted.filter((s) => s.overdue).length

  const friendlyDue = (due: string) => {
    if (due === '') return 'No date'
    const [y, m, d] = due.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className={`${t.card} p-5`}>
      <div className="flex items-baseline justify-between">
        <h2 className={`text-lg font-bold ${t.heading}`}>College-app deadlines</h2>
        {overdueCount > 0 && (
          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
            {overdueCount} overdue
          </span>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className={`mt-2 text-sm ${t.sub}`}>Dad can add application tasks in the Grown-Ups panel.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map(({ task, overdue }) => (
            <li
              key={task.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                overdue ? 'border-rose-300 bg-rose-50' : task.done ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={task.done}
                onChange={(e) => onProfileChange((prev) => updateCollegeTask(ensureHsDefaults(prev), task.id, { done: e.target.checked }))}
                className="h-4 w-4 shrink-0"
                aria-label={`mark ${task.label} done`}
              />
              <span className={`flex-1 text-sm font-semibold ${task.done ? 'text-slate-400 line-through' : overdue ? 'text-rose-800' : 'text-slate-800'}`}>
                {task.label}
              </span>
              <span className={`shrink-0 text-xs font-bold ${overdue ? 'text-rose-600' : 'text-slate-400'}`}>
                {overdue ? 'OVERDUE · ' : ''}
                {friendlyDue(task.due)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- course progress tracker ----------

function CourseTracker({ profile, onProfileChange }: { profile: Profile; onProfileChange: (update: (prev: Profile) => Profile) => void }) {
  const t = useTheme()
  const [open, setOpen] = useState<string | null>(null)
  const courses = profile.courses ?? []

  if (courses.length === 0) {
    return <p className={`text-sm ${t.sub}`}>Dad can set up courses in the Grown-Ups panel.</p>
  }

  return (
    <div className="space-y-3">
      {courses.map((c: CourseTrack) => {
        const { done, total, pct } = courseProgress(c)
        const expanded = open === c.id
        return (
          <div key={c.id} className={`${t.card} p-4`}>
            <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(expanded ? null : c.id)}>
              <span className={`font-semibold ${t.heading}`}>{c.name}</span>
              <div className={`ml-auto flex-1 max-w-[45%] h-2.5 overflow-hidden rounded-full ${t.progressTrack}`}>
                <div className={`h-full rounded-full ${t.progressFill}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="shrink-0 text-xs font-bold text-slate-500">
                {done}/{total}
              </span>
              <span className="shrink-0 text-slate-400">{expanded ? '▴' : '▾'}</span>
            </button>
            {expanded && (
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {c.units.map((u) => (
                  <li key={u.id}>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={u.done}
                        onChange={(e) => onProfileChange((prev) => toggleCourseUnit(ensureHsDefaults(prev), c.id, u.id, e.target.checked))}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className={u.done ? 'text-slate-400 line-through' : 'text-slate-700'}>{u.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
