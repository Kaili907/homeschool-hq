import { useEffect, useRef, useState } from 'react'
import type { AnswerRecord, Question } from '../types'
import { VisualView } from './Viz'
import { Confetti } from './Confetti'

interface QuizSessionProps {
  title: string
  emoji: string
  total: number
  getQuestion: (index: number, history: AnswerRecord[]) => Question
  onAnswer?: (q: Question, correct: boolean) => void
  onFinish: (history: AnswerRecord[]) => void
  onQuit: () => void
}

const CHEERS = ['Great job! 🎉', 'You got it! ⭐', 'Awesome! 🌟', 'Way to go! 🙌', 'Super! 🦄', 'Nailed it! 🎯']
const OOPS = ['Almost! 💪', 'Nice try! 🌱', 'Keep going! 🚀', "You'll get the next one! 🍀"]

export function QuizSession({
  title,
  emoji,
  total,
  getQuestion,
  onAnswer,
  onFinish,
  onQuit,
}: QuizSessionProps) {
  const [index, setIndex] = useState(0)
  const [history, setHistory] = useState<AnswerRecord[]>([])
  const [question, setQuestion] = useState<Question>(() => getQuestion(0, []))
  const [selected, setSelected] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [burst, setBurst] = useState(0)
  const [feedback, setFeedback] = useState('')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  function handleChoice(i: number) {
    if (selected !== null) return
    const correct = i === question.answerIndex
    setSelected(i)
    onAnswer?.(question, correct)
    const newStreak = correct ? streak + 1 : 0
    setStreak(newStreak)
    setFeedback(
      correct
        ? CHEERS[Math.floor(Math.random() * CHEERS.length)]
        : `${OOPS[Math.floor(Math.random() * OOPS.length)]}  The answer is ${question.choices[question.answerIndex]}.`,
    )
    if (correct && newStreak >= 3 && (newStreak === 3 || newStreak % 5 === 0)) {
      setBurst((b) => b + 1)
    }
    const rec: AnswerRecord = { question, chosenIndex: i, correct }
    const newHistory = [...history, rec]
    timerRef.current = window.setTimeout(
      () => {
        if (index + 1 >= total) {
          onFinish(newHistory)
        } else {
          setHistory(newHistory)
          setIndex(index + 1)
          setQuestion(getQuestion(index + 1, newHistory))
          setSelected(null)
          setFeedback('')
        }
      },
      correct ? 1100 : 2200,
    )
  }

  const progress = (index / total) * 100

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-4">
      <Confetti burst={burst} />

      {/* header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (window.confirm('Stop and go back home? Your progress in this round will not be saved.')) onQuit()
          }}
          className="rounded-2xl bg-white/80 px-4 py-2 text-xl font-bold text-violet-700 shadow hover:bg-white"
          aria-label="quit"
        >
          ✕
        </button>
        <div className="flex-1">
          <div className="text-lg font-extrabold text-violet-900">
            {emoji} {title}
          </div>
          <div className="mt-1 h-4 w-full overflow-hidden rounded-full bg-white/70 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-2 text-center shadow">
          <div className="text-sm font-bold text-slate-500">
            {index + 1}/{total}
          </div>
          {streak >= 2 && <div className="animate-wiggle text-lg font-extrabold text-orange-500">🔥{streak}</div>}
        </div>
      </div>

      {/* question card */}
      <div key={index} className="animate-pop mt-6 flex-1">
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <p className="whitespace-pre-line text-center text-2xl font-extrabold leading-snug text-slate-800 sm:text-3xl">
            {question.prompt}
          </p>
          {question.visual && (
            <div className="mt-5">
              <VisualView visual={question.visual} />
            </div>
          )}
        </div>

        <div className={`mt-5 grid gap-3 ${question.choices.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {question.choices.map((choice, i) => {
            let cls =
              'rounded-3xl border-b-8 px-4 py-5 text-2xl font-extrabold shadow-lg transition-all active:translate-y-1 active:border-b-4 '
            if (selected === null) {
              cls += 'border-violet-300 bg-white text-violet-900 hover:bg-violet-50'
            } else if (i === question.answerIndex) {
              cls += 'border-green-600 bg-green-400 text-white'
            } else if (i === selected) {
              cls += 'border-rose-600 bg-rose-400 text-white'
            } else {
              cls += 'border-slate-200 bg-slate-100 text-slate-400'
            }
            return (
              <button key={i} className={cls} onClick={() => handleChoice(i)} disabled={selected !== null}>
                {choice}
              </button>
            )
          })}
        </div>

        <div className="mt-4 min-h-12 text-center">
          {feedback && (
            <div
              className={`animate-pop inline-block rounded-2xl px-6 py-3 text-xl font-extrabold shadow ${
                selected === question.answerIndex ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {feedback}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
