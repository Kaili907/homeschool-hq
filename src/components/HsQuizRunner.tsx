import { useEffect, useRef, useState } from 'react'
import type { HsQuestion } from '../hs/hsQuestion'
import { GeoFigureView } from './GeoFigure'
import { useTheme } from '../theme'

export interface HsQuizRecord {
  correct: boolean
}

interface HsQuizRunnerProps {
  title: string
  total: number
  getQuestion: (index: number) => HsQuestion
  onAnswer?: (unit: string, correct: boolean) => void
  onFinish: (records: HsQuizRecord[]) => void
  onQuit: () => void
  /** present → SAT-style countdown; the quiz auto-submits when it hits 0 */
  timedSeconds?: number
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * High-school practice runner (clean theme only). One component serves both the
 * untimed unit practice and the timed quiz — the only difference is the
 * countdown. No confetti, no cheer copy: teens get a quiet ✓ / ✗.
 */
export function HsQuizRunner({
  title,
  total,
  getQuestion,
  onAnswer,
  onFinish,
  onQuit,
  timedSeconds,
}: HsQuizRunnerProps) {
  const t = useTheme()
  const [index, setIndex] = useState(0)
  const [question, setQuestion] = useState<HsQuestion>(() => getQuestion(0))
  const [selected, setSelected] = useState<number | null>(null)
  const [records, setRecords] = useState<HsQuizRecord[]>([])
  const [remaining, setRemaining] = useState(timedSeconds ?? 0)
  const recordsRef = useRef<HsQuizRecord[]>([])
  const advanceRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  const finish = (recs: HsQuizRecord[]) => {
    if (doneRef.current) return
    doneRef.current = true
    if (advanceRef.current !== null) window.clearTimeout(advanceRef.current)
    onFinish(recs)
  }

  // countdown for timed mode
  useEffect(() => {
    if (!timedSeconds) return
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id)
          finish(recordsRef.current)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedSeconds])

  useEffect(() => {
    return () => {
      if (advanceRef.current !== null) window.clearTimeout(advanceRef.current)
    }
  }, [])

  function choose(i: number) {
    if (selected !== null || doneRef.current) return
    const correct = i === question.answerIndex
    setSelected(i)
    onAnswer?.(question.unit, correct)
    const next = [...records, { correct }]
    recordsRef.current = next
    setRecords(next)
    advanceRef.current = window.setTimeout(
      () => {
        if (index + 1 >= total) {
          finish(next)
        } else {
          setIndex(index + 1)
          setQuestion(getQuestion(index + 1))
          setSelected(null)
        }
      },
      correct ? 650 : 1150,
    )
  }

  const answer = question.choices[question.answerIndex]
  const progress = (index / total) * 100
  const lowTime = timedSeconds && remaining <= 15

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-4">
      {/* header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (window.confirm('Stop this round? Progress in this round will not be saved.')) onQuit()
          }}
          className={`${t.secondaryBtn} px-4 py-2 text-lg`}
          aria-label="quit"
        >
          ✕
        </button>
        <div className="flex-1">
          <div className={`text-lg font-semibold ${t.heading}`}>{title}</div>
          <div className={`mt-1 h-2.5 w-full overflow-hidden rounded-full ${t.progressTrack}`}>
            <div className={`h-full rounded-full ${t.progressFill} transition-all duration-300`} style={{ width: `${progress}%` }} />
          </div>
        </div>
        {timedSeconds ? (
          <div
            className={`rounded-md border px-3 py-1.5 text-center font-mono text-lg font-bold tabular-nums ${
              lowTime ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-700'
            }`}
            aria-label="time remaining"
          >
            ⏱ {mmss(remaining)}
          </div>
        ) : (
          <div className={`${t.statPill} px-3 py-1.5 text-sm font-semibold text-slate-500`}>
            {index + 1}/{total}
          </div>
        )}
      </div>

      {/* question */}
      <div key={index} className="mt-6 flex-1">
        <div className={`${t.card} p-6`}>
          <p className={`whitespace-pre-line text-center text-xl font-semibold leading-snug sm:text-2xl ${t.heading}`}>
            {question.prompt}
          </p>
          {question.figure && (
            <div className="mt-4">
              <GeoFigureView figure={question.figure} />
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {question.choices.map((choice, i) => {
            let cls: string
            if (selected === null) cls = t.choiceIdle
            else if (i === question.answerIndex) cls = t.choiceCorrect
            else if (i === selected) cls = t.choiceWrong
            else cls = t.choiceDisabled
            return (
              <button
                key={i}
                className={`${cls} px-4 py-4 text-lg font-semibold transition-all`}
                onClick={() => choose(i)}
                disabled={selected !== null}
              >
                {choice}
              </button>
            )
          })}
        </div>

        <div className="mt-4 min-h-10 text-center">
          {selected !== null && (
            <div
              className={`inline-block rounded-lg px-5 py-2 text-lg font-semibold ${
                selected === question.answerIndex ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {selected === question.answerIndex ? '✓' : `✗  ${answer}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
