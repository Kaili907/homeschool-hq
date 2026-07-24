import { useEffect, useRef, useState } from 'react'
import type { AnswerRecord, Difficulty, Question } from '../types'
import type { SkillId } from '../skills'
import { VisualView } from './Viz'
import { Confetti } from './Confetti'
import { Walkthrough } from './Walkthrough'
import { explain } from '../explain'
import { useTheme } from '../theme'
import type { ResolvedVoicePrefs } from '../tutor/tutorState'

interface QuizSessionProps {
  title: string
  emoji: string
  total: number
  getQuestion: (index: number, history: AnswerRecord[]) => Question
  onAnswer?: (q: Question, correct: boolean) => void
  onFinish: (history: AnswerRecord[]) => void
  onQuit: () => void

  // ---------- MT-1 tutor (all optional; absent => classic auto-advance quiz) ----------
  /** turns on the walkthrough flow, "explain this one" button and voice. */
  tutorEnabled?: boolean
  voice?: ResolvedVoicePrefs
  muted?: boolean
  onToggleMute?: () => void
  /** make a fresh "try one like it" question at the same skill + difficulty. */
  makeRetry?: (skillId: SkillId, difficulty: Difficulty) => Question
  /** a right/wrong retry answer (recorded at reduced mastery weight upstream). */
  onRetryAnswer?: (q: Question, correct: boolean) => void
  /** a wrong-answer walkthrough was viewed (drives the Needs-Dad escalation). */
  onWalkthrough?: (skillId: SkillId) => void
}

const CHEERS = ['Great job! 🎉', 'You got it! ⭐', 'Awesome! 🌟', 'Way to go! 🙌', 'Super! 🦄', 'Nailed it! 🎯']
const OOPS = ['Almost! 💪', 'Nice try! 🌱', 'Keep going! 🚀', "You'll get the next one! 🍀"]

type Walk = { question: Question; mode: 'retry' | 'review'; chosenIndex?: number }
type Retry = { question: Question; selected: number | null }
/** MT-1V beat 2: a fresh worked example auto-played end-to-end. */
type Example = { question: Question }

export function QuizSession({
  title,
  emoji,
  total,
  getQuestion,
  onAnswer,
  onFinish,
  onQuit,
  tutorEnabled,
  voice,
  muted,
  onToggleMute,
  makeRetry,
  onRetryAnswer,
  onWalkthrough,
}: QuizSessionProps) {
  const t = useTheme()
  const [index, setIndex] = useState(0)
  const [history, setHistory] = useState<AnswerRecord[]>([])
  const [question, setQuestion] = useState<Question>(() => getQuestion(0, []))
  const [selected, setSelected] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [burst, setBurst] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [walk, setWalk] = useState<Walk | null>(null)
  const [retry, setRetry] = useState<Retry | null>(null)
  const [example, setExample] = useState<Example | null>(null)
  const timerRef = useRef<number | null>(null)
  const nextHistoryRef = useRef<AnswerRecord[]>([])

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

  /** Advance to the next planned question (or finish). Resets every sub-state. */
  function goNext() {
    const newHistory = nextHistoryRef.current
    if (index + 1 >= total) {
      onFinish(newHistory)
      return
    }
    setHistory(newHistory)
    setIndex(index + 1)
    setQuestion(getQuestion(index + 1, newHistory))
    setSelected(null)
    setFeedback('')
    setWalk(null)
    setRetry(null)
    setExample(null)
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
    nextHistoryRef.current = [...history, rec]

    // Classic path (placement / tutor off): auto-advance on a timer.
    if (!tutorEnabled) {
      timerRef.current = window.setTimeout(goNext, correct ? 1100 : 2200)
    }
    // Tutor path is button-driven — the control bar below handles what's next.
  }

  function openWalkthrough(mode: 'retry' | 'review') {
    // Escalation is logged once here (beat 1). Beat 2 ("Watch another") is part of
    // the SAME walkthrough and must not log again.
    if (mode === 'retry') onWalkthrough?.(question.skillId)
    setWalk({ question, mode, chosenIndex: selected ?? undefined })
  }

  // Beat 2 → beat 3: auto-play a fresh worked example, then offer her turn.
  function watchAnother() {
    if (!makeRetry) return
    setExample({ question: makeRetry(question.skillId, question.difficulty) })
    setWalk(null)
  }

  function finishWalkthrough(mode: 'retry' | 'review') {
    setExample(null)
    if (mode === 'retry' && makeRetry) {
      setRetry({ question: makeRetry(question.skillId, question.difficulty), selected: null })
      setWalk(null)
    } else {
      goNext()
    }
  }

  function handleRetryChoice(i: number) {
    if (!retry || retry.selected !== null) return
    const correct = i === retry.question.answerIndex
    setRetry({ ...retry, selected: i })
    onRetryAnswer?.(retry.question, correct)
  }

  const progress = (index / total) * 100
  const answered = selected !== null
  const wasCorrect = answered && selected === question.answerIndex
  const voicePrefs: ResolvedVoicePrefs = voice ?? { rate: 1, enabled: false, voiceOptIn: false }
  const showMute = !!tutorEnabled && !!onToggleMute && voicePrefs.enabled

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
        {showMute && (
          <button
            onClick={onToggleMute}
            className={`${t.secondaryBtn} px-3 py-2 text-lg`}
            aria-label={muted ? 'unmute voice' : 'mute voice'}
            title={muted ? 'Voice muted' : 'Mute voice'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        )}
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

      {/* body */}
      {example ? (
        // Beat 2: a fresh same-skill/difficulty problem, auto-played end-to-end.
        <Walkthrough
          question={example.question}
          explanation={explain(example.question)}
          mode="retry"
          autoplay
          voice={voicePrefs}
          muted={!!muted}
          onToggleMute={() => onToggleMute?.()}
          onDone={() => finishWalkthrough('retry')}
        />
      ) : walk ? (
        <Walkthrough
          question={walk.question}
          explanation={explain(walk.question, walk.chosenIndex)}
          mode={walk.mode}
          voice={voicePrefs}
          muted={!!muted}
          onToggleMute={() => onToggleMute?.()}
          onDone={() => finishWalkthrough(walk.mode)}
          onWatchAnother={walk.mode === 'retry' && makeRetry ? watchAnother : undefined}
        />
      ) : retry ? (
        <RetryCard retry={retry} onPick={handleRetryChoice} onContinue={goNext} />
      ) : (
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

          {/* feedback + controls */}
          <div className="mt-4 min-h-12 text-center">
            {/* classic path: just the feedback pill */}
            {!tutorEnabled && feedback && (
              <div
                className={`${t.cheers === 'minimal' ? '' : 'animate-pop'} inline-block rounded-2xl px-6 py-3 text-xl font-extrabold ${
                  wasCorrect ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {feedback}
              </div>
            )}

            {/* tutor path: control bar */}
            {tutorEnabled && answered && (
              <div className="flex flex-col items-center gap-3">
                {wasCorrect ? (
                  <>
                    <div className="inline-block animate-pop rounded-2xl bg-green-100 px-6 py-3 text-xl font-extrabold text-green-700">
                      {feedback || 'Correct! ✓'}
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={() => openWalkthrough('review')}
                        className={`${t.secondaryBtn} px-5 py-3 text-base`}
                      >
                        💡 Explain this one
                      </button>
                      <button onClick={goNext} className={`${t.primaryBtn} px-6 py-3 text-lg`}>
                        Next ▶
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="inline-block animate-pop rounded-2xl bg-amber-100 px-6 py-3 text-xl font-extrabold text-amber-800">
                      Not quite — want to see how it works?
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={() => openWalkthrough('retry')}
                        className={`${t.primaryBtn} px-6 py-3 text-lg`}
                      >
                        Show me how ▶
                      </button>
                      <button onClick={goNext} className={`${t.secondaryBtn} px-5 py-3 text-base`}>
                        Skip for now
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- retry ("try one like it") ----------

function RetryCard({
  retry,
  onPick,
  onContinue,
}: {
  retry: Retry
  onPick: (i: number) => void
  onContinue: () => void
}) {
  const t = useTheme()
  const { question, selected } = retry
  const answered = selected !== null
  const correct = answered && selected === question.answerIndex

  return (
    <div className="mt-6 flex-1">
      <div className={`mb-3 text-center text-lg font-extrabold ${t.heading}`}>
        {t.bigEmoji ? '✏️ ' : ''}Your turn — try one like it!
      </div>
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
              onClick={() => onPick(i)}
              disabled={answered}
            >
              {choice}
            </button>
          )
        })}
      </div>

      <div className="mt-4 min-h-12 text-center">
        {answered && (
          <div className="flex flex-col items-center gap-3">
            <div
              className={`inline-block animate-pop rounded-2xl px-6 py-3 text-xl font-extrabold ${
                correct ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {correct ? 'You did it yourself! 🌟' : `The answer is ${question.choices[question.answerIndex]}.`}
            </div>
            <button onClick={onContinue} className={`${t.primaryBtn} px-6 py-3 text-lg`}>
              Keep going ▶
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
