import { useEffect, useRef, useState } from 'react'
import { SKILL_BY_ID, type SkillId } from './skills'
import type { AnswerRecord, Profile } from './types'
import { generateFresh } from './generators'
import { loadProfile, recordAnswer, saveProfile } from './storage'
import {
  PLACEMENT_TOTAL,
  PRACTICE_TOTAL,
  applyPlacement,
  buildPracticePlan,
  placementDifficulty,
  placementOrder,
  summarizePlacement,
  type PlacementSkillResult,
  type PlanItem,
} from './engine'
import { QuizSession } from './components/QuizSession'
import { SkillTree } from './components/SkillTree'
import { BackupPanel } from './components/BackupPanel'
import { Confetti } from './components/Confetti'

type Screen =
  | { kind: 'home' }
  | { kind: 'placement'; order: SkillId[] }
  | { kind: 'placementResults'; results: PlacementSkillResult[] }
  | { kind: 'practice'; plan: PlanItem[] }
  | { kind: 'practiceResults'; history: AnswerRecord[] }

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile)
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const seenRef = useRef(new Set<string>())

  useEffect(() => {
    saveProfile(profile)
  }, [profile])

  const startPlacement = () => setScreen({ kind: 'placement', order: placementOrder() })
  const startPractice = () => setScreen({ kind: 'practice', plan: buildPracticePlan(profile) })
  const goHome = () => setScreen({ kind: 'home' })

  if (screen.kind === 'placement') {
    return (
      <QuizSession
        title="Placement Quest"
        emoji="🗺️"
        total={PLACEMENT_TOTAL}
        getQuestion={(index, history) =>
          generateFresh(screen.order[index], placementDifficulty(history), seenRef.current)
        }
        onFinish={(history) => {
          const results = summarizePlacement(history)
          setProfile((p) => {
            const withPlacement = applyPlacement(p, results)
            return {
              ...withPlacement,
              totals: { ...withPlacement.totals, sessions: withPlacement.totals.sessions + 1 },
            }
          })
          setScreen({ kind: 'placementResults', results })
        }}
        onQuit={goHome}
      />
    )
  }

  if (screen.kind === 'practice') {
    return (
      <QuizSession
        title="Daily Practice"
        emoji="✏️"
        total={PRACTICE_TOTAL}
        getQuestion={(index) =>
          generateFresh(screen.plan[index].skill, screen.plan[index].difficulty, seenRef.current)
        }
        onAnswer={(q, correct) =>
          setProfile((p) => recordAnswer(p, q.skillId, q.difficulty, correct))
        }
        onFinish={(history) => {
          const best = longestStreak(history)
          setProfile((p) => ({
            ...p,
            lastPracticeDate: new Date().toISOString().slice(0, 10),
            totals: {
              ...p.totals,
              sessions: p.totals.sessions + 1,
              bestStreak: Math.max(p.totals.bestStreak, best),
            },
          }))
          setScreen({ kind: 'practiceResults', history })
        }}
        onQuit={goHome}
      />
    )
  }

  if (screen.kind === 'placementResults') {
    return <PlacementResults results={screen.results} onHome={goHome} onPractice={startPractice} />
  }

  if (screen.kind === 'practiceResults') {
    return (
      <PracticeResults
        history={screen.history}
        onHome={goHome}
        onAgain={startPractice}
      />
    )
  }

  // home
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-violet-900 sm:text-5xl">
          🏠 Homeschool HQ
        </h1>
        <p className="mt-1 text-lg font-bold text-violet-600">
          3rd Grade Math Trainer — hi, {profile.name}! 👋
        </p>
        {profile.totals.questionsAnswered > 0 && (
          <div className="mt-3 inline-flex flex-wrap justify-center gap-2 text-sm font-extrabold">
            <span className="rounded-full bg-white/80 px-4 py-1 text-amber-600 shadow">
              ⭐ {profile.totals.correct} correct
            </span>
            <span className="rounded-full bg-white/80 px-4 py-1 text-orange-600 shadow">
              🔥 Best streak: {profile.totals.bestStreak}
            </span>
            <span className="rounded-full bg-white/80 px-4 py-1 text-sky-600 shadow">
              📚 {profile.totals.sessions} sessions
            </span>
          </div>
        )}
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          onClick={startPlacement}
          className="rounded-3xl border-b-8 border-fuchsia-700 bg-gradient-to-br from-fuchsia-500 to-violet-600 p-6 text-left shadow-xl transition-all hover:scale-[1.02] active:translate-y-1 active:border-b-4"
        >
          <div className="text-4xl">🗺️</div>
          <div className="mt-1 text-2xl font-extrabold text-white">
            {profile.placementDone ? 'Retake Placement Quest' : 'Placement Quest'}
          </div>
          <div className="font-bold text-fuchsia-100">
            20 questions to map out your skills!
          </div>
        </button>
        <button
          onClick={startPractice}
          className="rounded-3xl border-b-8 border-emerald-700 bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-left shadow-xl transition-all hover:scale-[1.02] active:translate-y-1 active:border-b-4"
        >
          <div className="text-4xl">✏️</div>
          <div className="mt-1 text-2xl font-extrabold text-white">Daily Practice</div>
          <div className="font-bold text-emerald-100">
            15 questions picked just for you!
          </div>
        </button>
      </div>

      {!profile.placementDone && (
        <div className="mt-4 rounded-2xl bg-amber-100 p-3 text-center text-sm font-bold text-amber-800 shadow">
          💡 Tip: take the Placement Quest first so Daily Practice knows what to work on!
        </div>
      )}

      <h2 className="mt-8 mb-3 text-2xl font-extrabold text-violet-900">🌳 Your Skills Tree</h2>
      <SkillTree profile={profile} />

      <div className="mt-8">
        <BackupPanel profile={profile} onProfileChange={setProfile} />
      </div>
    </div>
  )
}

function longestStreak(history: AnswerRecord[]): number {
  let best = 0
  let cur = 0
  for (const r of history) {
    cur = r.correct ? cur + 1 : 0
    best = Math.max(best, cur)
  }
  return best
}

const STATUS_UI = {
  mastered: { chip: 'bg-green-500 text-white', label: 'Mastered ⭐' },
  developing: { chip: 'bg-amber-400 text-amber-950', label: 'Growing 🌱' },
  'not-started': { chip: 'bg-slate-200 text-slate-500', label: 'Not started' },
} as const

function PlacementResults({
  results,
  onHome,
  onPractice,
}: {
  results: PlacementSkillResult[]
  onHome: () => void
  onPractice: () => void
}) {
  const mastered = results.filter((r) => r.status === 'mastered').length
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Confetti burst={1} />
      <div className="animate-pop rounded-3xl bg-white p-6 text-center shadow-xl">
        <div className="text-5xl">🗺️✨</div>
        <h1 className="mt-2 text-3xl font-extrabold text-violet-900">Quest complete!</h1>
        <p className="mt-1 font-bold text-slate-500">
          Here is your skill map — {mastered} skill{mastered === 1 ? '' : 's'} mastered already!
        </p>
      </div>
      <div className="mt-4 space-y-2">
        {results.map((r) => {
          const meta = SKILL_BY_ID[r.skillId]
          const ui = STATUS_UI[r.status]
          return (
            <div
              key={r.skillId}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow"
            >
              <div className="text-3xl">{meta.emoji}</div>
              <div className="flex-1">
                <div className="font-extrabold text-slate-800">{meta.name}</div>
                {r.asked > 0 && (
                  <div className="text-xs font-bold text-slate-400">
                    {r.correct}/{r.asked} correct
                  </div>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${ui.chip}`}>
                {ui.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          onClick={onPractice}
          className="rounded-3xl border-b-8 border-emerald-700 bg-emerald-500 px-6 py-4 text-xl font-extrabold text-white shadow-xl active:translate-y-1 active:border-b-4"
        >
          Start practicing! ✏️
        </button>
        <button
          onClick={onHome}
          className="rounded-3xl border-b-8 border-violet-300 bg-white px-6 py-4 text-xl font-extrabold text-violet-800 shadow-xl active:translate-y-1 active:border-b-4"
        >
          Back home 🏠
        </button>
      </div>
    </div>
  )
}

function PracticeResults({
  history,
  onHome,
  onAgain,
}: {
  history: AnswerRecord[]
  onHome: () => void
  onAgain: () => void
}) {
  const score = history.filter((r) => r.correct).length
  const best = longestStreak(history)
  const great = score >= Math.ceil(history.length * 0.8)
  const message = great
    ? 'AMAZING work! You are on fire! 🔥'
    : score >= history.length / 2
      ? 'Nice job — you are getting stronger! 💪'
      : 'Good practice! Every try makes your brain grow! 🧠'
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 text-center">
      {great && <Confetti burst={1} />}
      <div className="animate-pop rounded-3xl bg-white p-8 shadow-xl">
        <div className="text-6xl">{great ? '🏆' : '🎈'}</div>
        <h1 className="mt-2 text-3xl font-extrabold text-violet-900">Practice done!</h1>
        <div className="mt-4 text-5xl font-extrabold text-emerald-600">
          {score}/{history.length}
        </div>
        <div className="mt-1 font-bold text-slate-500">questions correct</div>
        {best >= 3 && (
          <div className="mt-2 text-lg font-extrabold text-orange-500">🔥 Best streak: {best}!</div>
        )}
        <p className="mt-4 text-lg font-bold text-slate-700">{message}</p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          onClick={onAgain}
          className="rounded-3xl border-b-8 border-emerald-700 bg-emerald-500 px-6 py-4 text-xl font-extrabold text-white shadow-xl active:translate-y-1 active:border-b-4"
        >
          Practice again! 🔁
        </button>
        <button
          onClick={onHome}
          className="rounded-3xl border-b-8 border-violet-300 bg-white px-6 py-4 text-xl font-extrabold text-violet-800 shadow-xl active:translate-y-1 active:border-b-4"
        >
          Back home 🏠
        </button>
      </div>
    </div>
  )
}
