import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../theme'
import {
  computeAccuracy,
  getTypingState,
  gradeWpmTarget,
  isMastered,
  unlockedLessons,
} from '../../typing/engine'
import type { DrillResult } from '../../typing/engine'
import { LESSONS } from '../../typing/lessons'
import type { Lesson } from '../../typing/lessons'
import type { Profile } from '../../types'
import DrillView from './DrillView'

/**
 * SE-A typing trainer "MK" — the ladder screen.
 *
 * Every lesson is framed as a growing goal, never a failure: accuracy is
 * the only gate (90% unlocks the next lesson), speed is shown as pacing
 * guidance against the grade-year goal, and a missed mastery attempt just
 * returns to the ladder with an encouraging note.
 */

export interface TypingTrainerProps {
  profile: Profile
  muted: boolean
  onDrillComplete: (result: DrillResult) => void
  onExit: () => void
}

type Mode = { kind: 'ladder' } | { kind: 'drill'; lesson: Lesson }

/** A single ~150ms celebratory beep. Silent no-op if Web Audio is unavailable. */
function playCelebrationBeep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
    window.setTimeout(() => ctx.close(), 300)
  } catch {
    // best-effort only; never block the celebration UI on audio failing
  }
}

export function TypingTrainer({ profile, muted, onDrillComplete, onExit }: TypingTrainerProps) {
  const t = useTheme()
  const state = getTypingState(profile)
  const unlocked = unlockedLessons(state)
  const nextLockedIndex = Math.min(state.unlockedIndex + 1, LESSONS.length - 1)
  const nextLocked = state.unlockedIndex < LESSONS.length - 1 ? LESSONS[nextLockedIndex] : null
  const ladderDone = state.unlockedIndex >= LESSONS.length - 1 && !!state.lessons[LESSONS[LESSONS.length - 1].id]?.passed

  const [mode, setMode] = useState<Mode>({ kind: 'ladder' })
  const [celebrating, setCelebrating] = useState(false)
  const [gentleNote, setGentleNote] = useState(false)
  const celebrateTimerRef = useRef<number | null>(null)
  const noteTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (celebrateTimerRef.current) window.clearTimeout(celebrateTimerRef.current)
      if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current)
    }
  }, [])

  const bestWpm = Math.max(0, ...Object.values(state.lessons).map((l) => l.bestWpm))
  const goalWpm = gradeWpmTarget(profile.grade)
  const goalPct = Math.min(100, Math.round((bestWpm / goalWpm) * 100))

  function handleSelectLesson(lesson: Lesson) {
    setGentleNote(false)
    setMode({ kind: 'drill', lesson })
  }

  function handleComplete(result: DrillResult) {
    const selected = LESSONS.find((l) => l.id === result.lessonId)
    const idx = selected ? LESSONS.findIndex((l) => l.id === selected.id) : -1
    const accuracy = computeAccuracy(result.correctChars, result.typedChars)
    const alreadyPassed = !!state.lessons[result.lessonId]?.passed
    const willAdvance = isMastered(accuracy) && !alreadyPassed && idx === state.unlockedIndex

    onDrillComplete(result)
    setMode({ kind: 'ladder' })

    if (willAdvance) {
      setCelebrating(true)
      if (!muted && t.cheers !== 'minimal') playCelebrationBeep()
      celebrateTimerRef.current = window.setTimeout(() => setCelebrating(false), 1500)
    } else {
      setGentleNote(true)
      noteTimerRef.current = window.setTimeout(() => setGentleNote(false), 4000)
    }
  }

  if (mode.kind === 'drill') {
    return (
      <DrillView
        lesson={mode.lesson}
        grade={profile.grade}
        onComplete={handleComplete}
        onQuit={() => setMode({ kind: 'ladder' })}
      />
    )
  }

  const bigEmoji = t.bigEmoji

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      {celebrating && (
        <div
          className={`${t.card} pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto mt-2 w-fit px-6 py-3 text-center ${
            t.id === 'playful' ? 'animate-bounce' : 'animate-pulse'
          }`}
        >
          <p className={`${t.heading} text-lg font-extrabold`}>
            Lesson up! {bigEmoji ? '🎉' : ''}
          </p>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h1 className={`${t.heading} text-2xl font-extrabold`}>{bigEmoji ? '⌨️ Typing' : 'Typing'}</h1>
        <button type="button" onClick={onExit} className={`${t.secondaryBtn} px-4 py-2 text-sm`}>
          Back home
        </button>
      </div>

      <p className={`${t.sub} mb-4 text-sm`}>
        5-minute daily drill. Accuracy 90% moves you up — speed comes with practice.
      </p>

      <div className={`${t.card} mb-5 p-4`}>
        <p className={`${t.heading} mb-2 text-sm font-semibold`}>
          Your speed goal: {bestWpm} / {goalWpm} WPM
        </p>
        <div className={`h-3 w-full overflow-hidden rounded-full ${t.progressTrack}`}>
          <div
            className={`h-full rounded-full ${t.progressFill} transition-all`}
            style={{ width: `${goalPct}%` }}
          />
        </div>
      </div>

      {gentleNote && (
        <div className={`${t.card} mb-4 p-3 text-center text-sm ${t.sub}`}>Nice work — keep going!</div>
      )}

      <div className="flex flex-col gap-3">
        {unlocked.map((lesson) => {
          const lessonState = state.lessons[lesson.id]
          return (
            <button
              key={lesson.id}
              type="button"
              onClick={() => handleSelectLesson(lesson)}
              className={`${t.card} flex items-center justify-between gap-3 p-4 text-left transition-transform hover:scale-[1.01]`}
            >
              <div>
                <p className={`${t.heading} font-bold`}>
                  {lessonState?.passed ? '✓ ' : ''}
                  {lesson.title}
                </p>
                {lessonState && (
                  <p className={`${t.sub} text-xs`}>
                    Best: {lessonState.bestAccuracy}% accuracy · {lessonState.bestWpm} WPM
                  </p>
                )}
              </div>
            </button>
          )
        })}

        {nextLocked && (
          <div className={`${t.card} flex items-center justify-between gap-3 p-4 opacity-60`}>
            <div>
              <p className="font-bold text-slate-500">🔒 {nextLocked.title}</p>
              <p className="text-xs text-slate-400">Master the one above (90%) to unlock</p>
            </div>
          </div>
        )}

        {ladderDone && (
          <div className={`${t.card} p-4 text-center`}>
            <p className={`${t.heading} font-bold`}>You&apos;ve finished every lesson! {bigEmoji ? '🌟' : ''}</p>
          </div>
        )}
      </div>
    </div>
  )
}
