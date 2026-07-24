import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../theme'
import { DRILL_SECONDS, buildDrillText, computeAccuracy, computeWpm, gradeWpmTarget } from '../../typing/engine'
import type { DrillResult } from '../../typing/engine'
import type { Lesson } from '../../typing/lessons'
import type { Grade } from '../../types'
import Keyboard from './Keyboard'

/**
 * SE-A typing trainer "MK" — one 5-minute typewriter-style drill.
 *
 * Errors are never penalties: a wrong key just doesn't advance the cursor,
 * so accuracy falls out naturally from correctChars / typedChars. The kid
 * always sees exactly what to fix, never a "you failed" state.
 */

export interface DrillViewProps {
  lesson: Lesson
  grade: Grade
  onComplete: (result: DrillResult) => void
  onQuit: () => void
}

/** How much of the target text stays visible around the cursor. */
const WINDOW_BEFORE = 20
const WINDOW_AFTER = 140
/** Top the buffer up once fewer than this many chars remain ahead of the cursor. */
const REFILL_THRESHOLD = 60

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function DrillView({ lesson, grade, onComplete, onQuit }: DrillViewProps) {
  const t = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  const [target, setTarget] = useState(() => buildDrillText(lesson))
  const [pos, setPos] = useState(0)
  const [typedChars, setTypedChars] = useState(0)
  const [correctChars, setCorrectChars] = useState(0)
  const [startTs, setStartTs] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(DRILL_SECONDS)
  const [errorPos, setErrorPos] = useState<number | null>(null)

  // Authoritative live counters, updated SYNCHRONOUSLY in handleKeyDown so a fast
  // typist's back-to-back keystrokes never compare against a stale `pos` (React state
  // lags a render behind rapid input). React state below mirrors these for rendering;
  // the timer, finish path, and match decision all read this ref, not the closure.
  const stateRef = useRef({ pos: 0, correctChars: 0, typedChars: 0, startTs: null as number | null })

  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const finishedRef = useRef(false)
  const finishRef = useRef<() => void>(() => {})
  finishRef.current = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    const s = stateRef.current
    const elapsedMs = s.startTs ? Date.now() - s.startTs : 0
    onCompleteRef.current({
      lessonId: lesson.id,
      correctChars: s.correctChars,
      typedChars: s.typedChars,
      elapsedMs,
    })
  }

  // Autofocus the typing surface on mount.
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  // Countdown ticks 4x/sec so live WPM/accuracy feel responsive; auto-finish at 0.
  useEffect(() => {
    const mountTs = Date.now()
    const iv = setInterval(() => {
      const elapsed = Date.now() - mountTs
      const rem = Math.max(0, DRILL_SECONDS - Math.floor(elapsed / 1000))
      setRemaining(rem)
      if (rem <= 0) finishRef.current()
    }, 250)
    return () => clearInterval(iv)
  }, [])

  // Keep the buffer topped up so the cursor never runs off the end of the text.
  useEffect(() => {
    if (target.length - pos < REFILL_THRESHOLD) {
      setTarget((prev) => `${prev} ${buildDrillText(lesson)}`)
    }
  }, [pos, target, lesson])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (finishedRef.current) return
    const s = stateRef.current

    if (e.key === 'Backspace') {
      e.preventDefault()
      s.pos = Math.max(0, s.pos - 1)
      setPos(s.pos)
      setErrorPos(null)
      return
    }

    // Ignore modifier/navigation keys (their e.key is a named string, length > 1)
    // and any ctrl/meta chord (copy/paste/shortcuts), leaving plain chars + Shift-combos through.
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return

    e.preventDefault()
    if (s.startTs === null) {
      s.startTs = Date.now()
      setStartTs(s.startTs)
    }
    s.typedChars += 1
    setTypedChars(s.typedChars)

    // Appends only extend the buffer, so target[s.pos] is stable even if `target`
    // is a render behind; s.pos is the authoritative cursor read from the ref.
    if (e.key === target[s.pos]) {
      s.correctChars += 1
      setCorrectChars(s.correctChars)
      s.pos += 1
      setPos(s.pos)
      setErrorPos(null)
    } else {
      const errAt = s.pos
      setErrorPos(errAt)
      window.setTimeout(() => setErrorPos((cur) => (cur === errAt ? null : cur)), 250)
    }
  }

  const elapsedMs = startTs ? Date.now() - startTs : 0
  const wpm = computeWpm(correctChars, elapsedMs)
  const accuracy = computeAccuracy(correctChars, typedChars)
  const goalWpm = gradeWpmTarget(grade)

  const winStart = Math.max(0, pos - WINDOW_BEFORE)
  const winEnd = Math.min(target.length, pos + WINDOW_AFTER)
  const visible = target.slice(winStart, winEnd)

  const big = t.id === 'playful'

  return (
    <div className={`${t.card} p-4 sm:p-6`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`${t.heading} ${big ? 'text-2xl' : 'text-xl'} font-bold`}>{lesson.title}</h2>
          <p className={`${t.sub} text-sm`}>{lesson.hint}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onQuit} className={`${t.secondaryBtn} px-4 py-2 text-sm`}>
            Back
          </button>
          <button type="button" onClick={() => finishRef.current()} className={`${t.primaryBtn} px-4 py-2 text-sm`}>
            Finish
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className={`${t.statPill} px-3 py-1.5 text-sm font-semibold`}>⏱ {formatClock(remaining)}</span>
        <span className={`${t.statPill} px-3 py-1.5 text-sm font-semibold`}>
          {wpm} WPM <span className="font-normal opacity-70">/ goal {goalWpm}</span>
        </span>
        <span className={`${t.statPill} px-3 py-1.5 text-sm font-semibold`}>{accuracy}% accuracy</span>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => containerRef.current?.focus()}
        className={`mb-4 cursor-text rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono leading-relaxed outline-none focus:ring-2 focus:ring-emerald-400 ${
          big ? 'text-lg' : 'text-base'
        }`}
      >
        {visible.split('').map((ch, i) => {
          const absoluteIndex = winStart + i
          const isTyped = absoluteIndex < pos
          const isCurrent = absoluteIndex === pos
          const isError = errorPos === absoluteIndex
          let cls = 'text-slate-800'
          if (isTyped) cls = 'text-slate-300'
          if (isCurrent) cls = isError ? 'bg-rose-200 text-rose-900 rounded' : 'bg-emerald-200 text-emerald-950 rounded underline'
          return (
            <span key={absoluteIndex} className={cls}>
              {ch === ' ' ? ' ' : ch}
            </span>
          )
        })}
      </div>

      <Keyboard focusKeys={lesson.focusKeys} nextChar={target[pos]} />
    </div>
  )
}
