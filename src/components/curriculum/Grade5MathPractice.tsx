import { useState } from 'react'
import type { Profile } from '../../types'
import { finishSession } from '../../appState'
import { recordHsAnswer } from '../../hs/hsState'
import {
  GRADE5_MATH_PRACTICE_ITEM_COUNT,
  GRADE5_MATH_PRACTICE_UNITS,
  generateGrade5MathPracticeItem,
  grade5MathPracticeUnit,
  grade5MathPracticeUnitKey,
  type Grade5MathPracticeQuestion,
  type Grade5MathPracticeUnit,
} from '../../curriculum/practice/grade5MathPracticeUnits'
import { VisualView } from '../Viz'
import { useTheme } from '../../theme'

/**
 * MOUNT-G5-MATH — the Grade 5 math practice surface. Behind
 * curriculum/practice/featureFlag; App renders it only for a grade-5 profile
 * with the flag on.
 *
 * The unit is chosen explicitly by the student or parent. There is no adaptive
 * sequencing, no mastery inference, and no automatic advancement: those need
 * placement data this app does not have yet, and guessing would aim the work at
 * the wrong level.
 */

type View =
  | { kind: 'picker' }
  | { kind: 'round'; unitNumber: number }
  | { kind: 'results'; unitNumber: number; results: boolean[] }

interface Props {
  onPatch: (update: (prev: Profile) => Profile) => void
  onExit: () => void
}

function longestStreak(results: readonly boolean[]): number {
  let best = 0
  let run = 0
  for (const correct of results) {
    run = correct ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

export function Grade5MathPractice({ onPatch, onExit }: Props) {
  const [view, setView] = useState<View>({ kind: 'picker' })

  if (view.kind === 'picker') {
    return <UnitPicker onPick={(unitNumber) => setView({ kind: 'round', unitNumber })} onExit={onExit} />
  }

  const unit = grade5MathPracticeUnit(view.unitNumber)!

  if (view.kind === 'results') {
    return (
      <RoundResults
        unit={unit}
        results={view.results}
        onAgain={() => setView({ kind: 'round', unitNumber: unit.unitNumber })}
        onUnits={() => setView({ kind: 'picker' })}
        onExit={onExit}
      />
    )
  }

  return (
    <Grade5MathPracticeRound
      unit={unit}
      total={GRADE5_MATH_PRACTICE_ITEM_COUNT}
      getQuestion={(index) => generateGrade5MathPracticeItem(unit, index)}
      onAnswer={(correct) =>
        onPatch((p) => recordHsAnswer(p, grade5MathPracticeUnitKey(unit.unitNumber), correct))
      }
      onFinish={(results) => {
        onPatch((p) => finishSession(p, longestStreak(results)))
        setView({ kind: 'results', unitNumber: unit.unitNumber, results })
      }}
      onQuit={() => setView({ kind: 'picker' })}
    />
  )
}

// ---------- unit picker ----------

function UnitPicker({ onPick, onExit }: { onPick: (unitNumber: number) => void; onExit: () => void }) {
  const t = useTheme()
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight ${t.heading}`}>Grade 5 Math</h1>
          <p className={`mt-1 font-bold ${t.sub}`}>Pick the unit you want to practice.</p>
        </div>
        <button onClick={onExit} className={`${t.secondaryBtn} px-4 py-2 text-sm`}>
          Back home
        </button>
      </header>

      <div className="mt-6 space-y-3">
        {GRADE5_MATH_PRACTICE_UNITS.map((unit) => (
          <button
            key={unit.unitNumber}
            onClick={() => onPick(unit.unitNumber)}
            className={`${t.card} flex min-h-11 w-full items-center gap-4 p-4 text-left transition-all hover:border-cyan-400`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold ${t.chipDeveloping}`}
            >
              {unit.unitNumber}
            </span>
            <span className="flex-1">
              <span className={`block text-lg font-extrabold ${t.heading}`}>
                Unit {unit.unitNumber}
              </span>
              <span className={`block font-bold ${t.sub}`}>{unit.title}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- practice round ----------

interface RoundProps {
  unit: Grade5MathPracticeUnit
  total: number
  getQuestion: (index: number) => Grade5MathPracticeQuestion
  onAnswer: (correct: boolean) => void
  onFinish: (results: boolean[]) => void
  onQuit: () => void
}

/**
 * One round of practice. Structure follows QuizSession (progress bar, quit,
 * choice grid, feedback) minus the tutor/walkthrough flow, which is keyed to the
 * skill registry the curriculum generators do not belong to. A wrong answer
 * shows the item type's AUTHORED worked example — that prose is the teaching
 * content, shipped with the generator, not composed here.
 */
export function Grade5MathPracticeRound({
  unit,
  total,
  getQuestion,
  onAnswer,
  onFinish,
  onQuit,
}: RoundProps) {
  const t = useTheme()
  const [index, setIndex] = useState(0)
  const [question, setQuestion] = useState<Grade5MathPracticeQuestion>(() => getQuestion(0))
  const [selected, setSelected] = useState<number | null>(null)
  const [results, setResults] = useState<boolean[]>([])

  const answer = question.choices[question.answerIndex]
  const answered = selected !== null
  const wasCorrect = answered && selected === question.answerIndex
  const progress = (index / total) * 100

  function choose(i: number) {
    if (selected !== null) return
    const correct = i === question.answerIndex
    setSelected(i)
    setResults([...results, correct])
    onAnswer(correct)
  }

  function next() {
    if (index + 1 >= total) {
      onFinish(results)
      return
    }
    setIndex(index + 1)
    setQuestion(getQuestion(index + 1))
    setSelected(null)
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onQuit}
          className={`${t.secondaryBtn} px-4 py-2 text-xl`}
          aria-label="back to units"
        >
          ✕
        </button>
        <div className="flex-1">
          <div className={`text-lg font-extrabold ${t.heading}`}>
            Unit {unit.unitNumber} — {unit.title}
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
        </div>
      </div>

      <div key={index} className="mt-6 flex-1">
        <div className={`${t.card} p-6`}>
          <p
            className={`whitespace-pre-line text-center text-2xl font-extrabold leading-snug ${t.heading}`}
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
                onClick={() => choose(i)}
                disabled={selected !== null}
              >
                {choice}
              </button>
            )
          })}
        </div>

        {answered && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <div
              className={`inline-block rounded-2xl px-6 py-3 text-xl font-extrabold ${
                wasCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {wasCorrect ? 'Nice — that is right! ✓' : `Not quite. The answer is ${answer}.`}
            </div>
            {!wasCorrect && <WorkedExample question={question} />}
            <button onClick={next} className={`${t.primaryBtn} px-6 py-3 text-lg`}>
              {index + 1 >= total ? 'Finish ▶' : 'Next ▶'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The item type's authored worked example, shown verbatim after a wrong answer. */
function WorkedExample({ question }: { question: Grade5MathPracticeQuestion }) {
  const t = useTheme()
  const { prompt, steps, answer } = question.workedExample
  return (
    <div className="w-full rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-left">
      <div className="text-base font-extrabold text-amber-900">Here is one worked out</div>
      <p className="mt-2 whitespace-pre-line text-lg font-bold text-amber-900">{prompt}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-6 text-base font-semibold text-amber-900">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <div className={`mt-3 text-base font-extrabold ${t.heading}`}>Answer: {answer}</div>
    </div>
  )
}

// ---------- round results ----------

function RoundResults({
  unit,
  results,
  onAgain,
  onUnits,
  onExit,
}: {
  unit: Grade5MathPracticeUnit
  results: boolean[]
  onAgain: () => void
  onUnits: () => void
  onExit: () => void
}) {
  const t = useTheme()
  const score = results.filter(Boolean).length
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 text-center">
      <div className={`${t.card} p-8`}>
        <h1 className={`text-3xl font-extrabold ${t.heading}`}>Round done!</h1>
        <p className={`mt-1 font-bold ${t.sub}`}>
          Unit {unit.unitNumber} — {unit.title}
        </p>
        <div className="mt-4 text-5xl font-extrabold text-emerald-600">
          {score}/{results.length}
        </div>
        <div className={`mt-1 font-bold ${t.sub}`}>questions correct</div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <button onClick={onAgain} className={`${t.primaryBtn} px-6 py-4 text-lg`}>
          Practice again
        </button>
        <button onClick={onUnits} className={`${t.secondaryBtn} px-6 py-4 text-lg`}>
          Pick a unit
        </button>
        <button onClick={onExit} className={`${t.secondaryBtn} px-6 py-4 text-lg`}>
          Back home
        </button>
      </div>
    </div>
  )
}
