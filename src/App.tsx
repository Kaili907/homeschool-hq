import { useEffect, useMemo, useRef, useState } from 'react'
import { SKILL_BY_ID, type SkillId } from './skills'
import type { AnswerRecord, AppState, Profile } from './types'
import { generateFresh } from './generators'
import {
  downloadJson,
  finishSession,
  loadAppState,
  readLocalStorageKey,
  recordAnswer,
  saveAppState,
  updateProfile,
} from './appState'
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
import { THEMES, ThemeContext, useTheme } from './theme'
import { QuizSession } from './components/QuizSession'
import { SkillTree } from './components/SkillTree'
import { Picker } from './components/Picker'
import { PinPad } from './components/PinPad'
import { GrownUps } from './components/GrownUps'
import { Confetti } from './components/Confetti'

type Screen =
  | { kind: 'picker' }
  | { kind: 'kidPin'; profileId: string }
  | { kind: 'kidPinCreate'; profileId: string; firstEntry?: string }
  | { kind: 'home' }
  | { kind: 'placement'; order: SkillId[] }
  | { kind: 'placementResults'; results: PlacementSkillResult[] }
  | { kind: 'practice'; plan: PlanItem[] }
  | { kind: 'practiceResults'; history: AnswerRecord[] }
  | { kind: 'parentPin' }
  | { kind: 'parentPinCreate'; firstEntry?: string }
  | { kind: 'grownups' }

export default function App() {
  const loaded = useMemo(loadAppState, [])
  const [state, setState] = useState<AppState>(loaded.state)
  const [screen, setScreen] = useState<Screen>({ kind: 'picker' })
  const [showMigration, setShowMigration] = useState(loaded.migrated)
  const seenRef = useRef(new Set<string>())

  useEffect(() => {
    saveAppState(state)
  }, [state])

  const active = state.activeProfileId ? state.profiles[state.activeProfileId] : null
  const tokens = THEMES[active?.theme ?? 'playful']

  const setProfile = (p: Profile) => setState((s) => updateProfile(s, p))
  const signOut = () => {
    setState((s) => ({ ...s, activeProfileId: null }))
    setScreen({ kind: 'picker' })
  }

  // ---------- profile-free screens ----------

  if (screen.kind === 'picker') {
    return (
      <Picker
        state={state}
        migrationBanner={
          showMigration && loaded.backupKey
            ? {
                onDownload: () => {
                  const raw = readLocalStorageKey(loaded.backupKey!)
                  if (raw) downloadJson(`${loaded.backupKey!.replaceAll(':', '_')}.json`, raw)
                },
                onDismiss: () => setShowMigration(false),
              }
            : undefined
        }
        onPick={(profileId) => {
          const p = state.profiles[profileId]
          setScreen(p.pin === '' ? { kind: 'kidPinCreate', profileId } : { kind: 'kidPin', profileId })
        }}
        onGrownUps={() =>
          setScreen(state.parentPin === '' ? { kind: 'parentPinCreate' } : { kind: 'parentPin' })
        }
      />
    )
  }

  if (screen.kind === 'kidPin' || screen.kind === 'kidPinCreate') {
    const profile = state.profiles[screen.profileId]
    const t = THEMES[profile.theme]
    return (
      <ThemeContext.Provider value={t}>
        <div style={{ fontFamily: t.font, background: t.appBg }} className="min-h-screen">
          {screen.kind === 'kidPin' ? (
            <PinPad
              title={`Hi, ${profile.name}!`}
              subtitle="Enter your secret PIN"
              onComplete={(pin) => {
                if (pin === profile.pin) {
                  setState((s) => ({ ...s, activeProfileId: profile.id }))
                  setScreen({ kind: 'home' })
                  return null
                }
                return 'Oops — that is not it. Try again!'
              }}
              onCancel={() => setScreen({ kind: 'picker' })}
            />
          ) : (
            <PinPad
              title={screen.firstEntry ? 'One more time!' : `Welcome, ${profile.name}!`}
              subtitle={
                screen.firstEntry ? 'Type your new PIN again to lock it in' : 'Choose a secret 4-digit PIN'
              }
              onComplete={(pin) => {
                if (!screen.firstEntry) {
                  setScreen({ kind: 'kidPinCreate', profileId: profile.id, firstEntry: pin })
                  return null
                }
                if (pin === screen.firstEntry) {
                  setProfile({ ...profile, pin })
                  setState((s) => ({ ...s, activeProfileId: profile.id }))
                  setScreen({ kind: 'home' })
                  return null
                }
                setScreen({ kind: 'kidPinCreate', profileId: profile.id })
                return 'The PINs did not match — start over.'
              }}
              onCancel={() => setScreen({ kind: 'picker' })}
            />
          )}
        </div>
      </ThemeContext.Provider>
    )
  }

  if (screen.kind === 'parentPin' || screen.kind === 'parentPinCreate') {
    const t = THEMES.clean
    return (
      <ThemeContext.Provider value={t}>
        <div style={{ fontFamily: t.font, background: t.appBg }} className="min-h-screen">
          {screen.kind === 'parentPin' ? (
            <PinPad
              title="Grown-Ups only"
              subtitle="Enter the parent PIN"
              onComplete={(pin) => {
                if (pin === state.parentPin) {
                  setScreen({ kind: 'grownups' })
                  return null
                }
                return 'Wrong PIN.'
              }}
              onCancel={() => setScreen({ kind: 'picker' })}
            />
          ) : (
            <PinPad
              title={screen.firstEntry ? 'Confirm parent PIN' : 'Set a parent PIN'}
              subtitle={
                screen.firstEntry
                  ? 'Type it again to confirm'
                  : 'This PIN gates the Grown-Ups panel'
              }
              onComplete={(pin) => {
                if (!screen.firstEntry) {
                  setScreen({ kind: 'parentPinCreate', firstEntry: pin })
                  return null
                }
                if (pin === screen.firstEntry) {
                  setState((s) => ({ ...s, parentPin: pin }))
                  setScreen({ kind: 'grownups' })
                  return null
                }
                setScreen({ kind: 'parentPinCreate' })
                return 'PINs did not match — start over.'
              }}
              onCancel={() => setScreen({ kind: 'picker' })}
            />
          )}
        </div>
      </ThemeContext.Provider>
    )
  }

  if (screen.kind === 'grownups') {
    return (
      <GrownUps
        state={state}
        onStateChange={setState}
        onClose={() => setScreen({ kind: 'picker' })}
        onChangeParentPin={() => setScreen({ kind: 'parentPinCreate' })}
      />
    )
  }

  // ---------- signed-in screens ----------

  if (!active) {
    // defensive: no active profile → back to picker
    return (
      <Picker
        state={state}
        onPick={(profileId) => {
          const p = state.profiles[profileId]
          setScreen(p.pin === '' ? { kind: 'kidPinCreate', profileId } : { kind: 'kidPin', profileId })
        }}
        onGrownUps={() =>
          setScreen(state.parentPin === '' ? { kind: 'parentPinCreate' } : { kind: 'parentPin' })
        }
      />
    )
  }

  return (
    <ThemeContext.Provider value={tokens}>
      <div style={{ fontFamily: tokens.font, background: tokens.appBg }} className="min-h-screen">
        {screen.kind === 'placement' && (
          <QuizSession
            title="Placement Quest"
            emoji="🗺️"
            total={PLACEMENT_TOTAL}
            getQuestion={(index, history) =>
              generateFresh(screen.order[index], placementDifficulty(history), seenRef.current)
            }
            onFinish={(history) => {
              const results = summarizePlacement(history)
              setProfile(finishSession(applyPlacement(active, results), 0))
              setScreen({ kind: 'placementResults', results })
            }}
            onQuit={() => setScreen({ kind: 'home' })}
          />
        )}

        {screen.kind === 'practice' && (
          <QuizSession
            title="Daily Practice"
            emoji="✏️"
            total={PRACTICE_TOTAL}
            getQuestion={(index) =>
              generateFresh(screen.plan[index].skill, screen.plan[index].difficulty, seenRef.current)
            }
            onAnswer={(q, correct) =>
              setProfile(recordAnswer(state.profiles[active.id], q.skillId, q.difficulty, correct))
            }
            onFinish={(history) => {
              setProfile(finishSession(state.profiles[active.id], longestStreak(history)))
              setScreen({ kind: 'practiceResults', history })
            }}
            onQuit={() => setScreen({ kind: 'home' })}
          />
        )}

        {screen.kind === 'placementResults' && (
          <PlacementResults
            results={screen.results}
            onHome={() => setScreen({ kind: 'home' })}
            onPractice={() => setScreen({ kind: 'practice', plan: buildPracticePlan(active) })}
          />
        )}

        {screen.kind === 'practiceResults' && (
          <PracticeResults
            history={screen.history}
            onHome={() => setScreen({ kind: 'home' })}
            onAgain={() => setScreen({ kind: 'practice', plan: buildPracticePlan(active) })}
          />
        )}

        {screen.kind === 'home' && (
          <Home
            profile={active}
            onSignOut={signOut}
            onPlacement={() => setScreen({ kind: 'placement', order: placementOrder() })}
            onPractice={() => setScreen({ kind: 'practice', plan: buildPracticePlan(active) })}
          />
        )}
      </div>
    </ThemeContext.Provider>
  )
}

// ---------- home ----------

function Home({
  profile,
  onSignOut,
  onPlacement,
  onPractice,
}: {
  profile: Profile
  onSignOut: () => void
  onPlacement: () => void
  onPractice: () => void
}) {
  const t = useTheme()
  const isTrainerReady = profile.grade === '3'
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${t.heading}`}>
            {t.bigEmoji ? '🏠 ' : ''}Hi, {profile.name}!
          </h1>
          <p className={`mt-1 font-bold ${t.sub}`}>
            {profile.streaks.current > 0
              ? `🔥 ${profile.streaks.current}-day streak — keep it going!`
              : 'Ready to learn today?'}
          </p>
        </div>
        <button onClick={onSignOut} className={`${t.secondaryBtn} px-4 py-2 text-sm`}>
          Sign out
        </button>
      </header>

      {profile.totals.questionsAnswered > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-extrabold">
          <span className={`${t.statPill} px-4 py-1 text-amber-600`}>
            ⭐ {profile.totals.correct} correct
          </span>
          <span className={`${t.statPill} px-4 py-1 text-orange-600`}>
            🔥 Best: {profile.totals.bestStreak}
          </span>
          <span className={`${t.statPill} px-4 py-1 text-sky-600`}>
            📚 {profile.totals.sessions} sessions
          </span>
        </div>
      )}

      {isTrainerReady ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              onClick={onPlacement}
              className="rounded-3xl border-b-8 border-fuchsia-700 bg-gradient-to-br from-fuchsia-500 to-violet-600 p-6 text-left shadow-xl transition-all hover:scale-[1.02] active:translate-y-1 active:border-b-4"
            >
              <div className="text-4xl">🗺️</div>
              <div className="mt-1 text-2xl font-extrabold text-white">
                {profile.placementDone ? 'Retake Placement Quest' : 'Placement Quest'}
              </div>
              <div className="font-bold text-fuchsia-100">20 questions to map out your skills!</div>
            </button>
            <button
              onClick={onPractice}
              className="rounded-3xl border-b-8 border-emerald-700 bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-left shadow-xl transition-all hover:scale-[1.02] active:translate-y-1 active:border-b-4"
            >
              <div className="text-4xl">✏️</div>
              <div className="mt-1 text-2xl font-extrabold text-white">Daily Practice</div>
              <div className="font-bold text-emerald-100">15 questions picked just for you!</div>
            </button>
          </div>

          {!profile.placementDone && (
            <div className="mt-4 rounded-2xl bg-amber-100 p-3 text-center text-sm font-bold text-amber-800 shadow">
              💡 Tip: take the Placement Quest first so Daily Practice knows what to work on!
            </div>
          )}

          <h2 className={`mt-8 mb-3 text-2xl font-extrabold ${t.heading}`}>
            {t.bigEmoji ? '🌳 ' : ''}Your Skills Tree
          </h2>
          <SkillTree profile={profile} />
        </>
      ) : (
        <div className={`${t.card} mt-8 p-8 text-center`}>
          <div className={t.bigEmoji ? 'text-5xl' : 'text-3xl'}>
            {t.id === 'clean' ? '📋' : '🚧'}
          </div>
          <h2 className={`mt-3 text-2xl font-extrabold ${t.heading}`}>
            Your practice space is on its way
          </h2>
          <p className={`mx-auto mt-2 max-w-md font-semibold ${t.sub}`}>
            Grade {profile.grade} lessons and your Morning Mission arrive in the next update. Your
            profile, PIN and streaks are already saved.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------- results ----------

function longestStreak(history: AnswerRecord[]): number {
  let best = 0
  let cur = 0
  for (const r of history) {
    cur = r.correct ? cur + 1 : 0
    best = Math.max(best, cur)
  }
  return best
}

function PlacementResults({
  results,
  onHome,
  onPractice,
}: {
  results: PlacementSkillResult[]
  onHome: () => void
  onPractice: () => void
}) {
  const t = useTheme()
  const chip = {
    mastered: { cls: t.chipMastered, label: t.cheers === 'full' ? 'Mastered ⭐' : 'Mastered' },
    developing: { cls: t.chipDeveloping, label: t.cheers === 'full' ? 'Growing 🌱' : 'In progress' },
    'not-started': { cls: t.chipNotStarted, label: 'Not started' },
  } as const
  const mastered = results.filter((r) => r.status === 'mastered').length
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {t.confetti && <Confetti burst={1} />}
      <div className={`${t.card} animate-pop p-6 text-center`}>
        {t.bigEmoji && <div className="text-5xl">🗺️✨</div>}
        <h1 className={`mt-2 text-3xl font-extrabold ${t.heading}`}>Quest complete!</h1>
        <p className={`mt-1 font-bold ${t.sub}`}>
          Here is your skill map — {mastered} skill{mastered === 1 ? '' : 's'} mastered already!
        </p>
      </div>
      <div className="mt-4 space-y-2">
        {results.map((r) => {
          const meta = SKILL_BY_ID[r.skillId]
          const ui = chip[r.status]
          return (
            <div key={r.skillId} className={`${t.card} flex items-center gap-3 p-3`}>
              {t.bigEmoji && <div className="text-3xl">{meta.emoji}</div>}
              <div className="flex-1">
                <div className={`font-extrabold ${t.heading}`}>{meta.name}</div>
                {r.asked > 0 && (
                  <div className="text-xs font-bold text-slate-400">
                    {r.correct}/{r.asked} correct
                  </div>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${ui.cls}`}>
                {ui.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button onClick={onPractice} className={`${t.primaryBtn} px-6 py-4 text-xl`}>
          Start practicing! ✏️
        </button>
        <button onClick={onHome} className={`${t.secondaryBtn} px-6 py-4 text-xl`}>
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
  const t = useTheme()
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
      {great && t.confetti && <Confetti burst={1} />}
      <div className={`${t.card} animate-pop p-8`}>
        {t.bigEmoji && <div className="text-6xl">{great ? '🏆' : '🎈'}</div>}
        <h1 className={`mt-2 text-3xl font-extrabold ${t.heading}`}>Practice done!</h1>
        <div className="mt-4 text-5xl font-extrabold text-emerald-600">
          {score}/{history.length}
        </div>
        <div className={`mt-1 font-bold ${t.sub}`}>questions correct</div>
        {best >= 3 && (
          <div className="mt-2 text-lg font-extrabold text-orange-500">🔥 Best streak: {best}!</div>
        )}
        {t.cheers === 'full' && <p className={`mt-4 text-lg font-bold ${t.heading}`}>{message}</p>}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button onClick={onAgain} className={`${t.primaryBtn} px-6 py-4 text-xl`}>
          Practice again! 🔁
        </button>
        <button onClick={onHome} className={`${t.secondaryBtn} px-6 py-4 text-xl`}>
          Back home 🏠
        </button>
      </div>
    </div>
  )
}
