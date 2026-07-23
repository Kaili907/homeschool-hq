import { useEffect, useRef, useState } from 'react'
import type { AnswerRecord, Question } from '../types'
import { VisualView } from './Viz'
import { Confetti } from './Confetti'
import { useTheme } from '../theme'

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
  const t = useTheme()
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

  function feedbackFor(correct: boolean): string {
    const answer = question.choices[question.answerIndex]
    if (t.cheers === 'full') {
      return correct
        ? CHEERS[Math.floor(Math.random() * CHEERS.length)]
        : `${OOPS[Math.floor(Math.random() * OOPS.length)]}  The answer is ${answer}.`
    }
    if (t.cheers === 'brief') {
      return correct ? 'Nice ✓' : `Not quite — answer: ${answer}`
    }
    return correct ? '✓' : `✗  ${answer}`
  }

  function handleChoice(i: number) {
    if (selected !== null) return
    const correct = i === question.answerIndex
    setSelected(i)
    onAnswer?.(question, correct)
    const newStreak = correct ? streak + 1 : 0
    setStreak(newStreak)
    setFeedback(feedbackFor(correct))
    if (t.confetti && correct && newStreak >= 3 && (newStreak === 3 || newStreak % 5 === 0)) {
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
      {t.confetti && <Confetti burst={burst} />}

      {/* header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (window.confirm('Stop and go back? Your progress in this round will not be saved.')) onQuit()
          }}
          className={`${t.secondaryBtn} px-4 py-2 text-xl`}
          aria-label="quit"
        >
          ✕
        </button>
        <div className="flex-1">
          <div className={`text-lg font-extrabold ${t.heading}`}>
            {t.bigEmoji ? `${emoji} ${title}` : title}
          </div>
          <div className={`mt-1 h-4 w-full overflow-hidden rounded-full ${t.progressTrack}`}>
            <div
              className={`h-full rounded-full ${t.progressFill} transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className={`${t.statPill} px-3 py-2 text-center`}>
          <div className="text-sm font-bold text-slate-500">
            {index + 1}/{total}
          </div>
          {streak >= 2 && (
            <div
              className={`text-lg font-extrabold text-orange-500 ${t.cheers === 'full' ? 'animate-wiggle' : ''}`}
            >
              🔥{streak}
            </div>
          )}
        </div>
      </div>

      {/* question card */}
      <div key={index} className={`mt-6 flex-1 ${t.cheers === 'minimal' ? '' : 'animate-pop'}`}>
        <div className={`${t.card} p-6`}>
          <p
            className={`whitespace-pre-line text-center text-2xl font-extrabold leading-snug sm:text-3xl ${t.heading}`}
          >
            {question.prompt}
          </p>
          {question.visual && (
            <div className="mt-5">
              <VisualView visual={question.visual} />
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
                className={`${cls} px-4 py-5 text-2xl font-extrabold transition-all`}
                onClick={() => handleChoice(i)}
                disabled={selected !== null}
              >
                {choice}
              </button>
            )
          })}
        </div>

        <div className="mt-4 min-h-12 text-center">
          {feedback && (
            <div
              className={`${t.cheers === 'minimal' ? '' : 'animate-pop'} inline-block rounded-2xl px-6 py-3 text-xl font-extrabold ${
                selected === question.answerIndex
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-800'
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
