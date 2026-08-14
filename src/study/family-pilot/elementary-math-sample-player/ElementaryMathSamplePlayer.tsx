import { useEffect, useMemo, useRef, useState } from 'react'
import type { LearnerAssessmentReceipt, LearnerResponseSubmissionResult } from '../final-app/learner-response'
import { ELEMENTARY_MATH_SAMPLE_MATERIAL } from './fixture'
import { createElementaryMathPresentation } from './presentation'
import type { ElementaryMathPresentationStep, ElementaryMathSamplePlayerProps, ElementaryMathStage } from './types'
import './ElementaryMathSamplePlayer.css'

const STAGE_LABELS: Readonly<Record<ElementaryMathStage, string>> = Object.freeze({
  LEARN: 'Learn',
  EXAMPLE: 'Example',
  GUIDED: "Let's Try One",
  INDEPENDENT: 'Your Turn',
  MASTERY: 'Check What You Know',
})

type Feedback = Readonly<{
  kind: 'PENDING_ASSESSMENT' | LearnerAssessmentReceipt['decision'] | 'ERROR' | 'INFO'
  message: string
}>

function feedbackFor(result: Extract<LearnerResponseSubmissionResult, { status: 'saved' }>): Feedback {
  const decision = result.record.assessment?.decision
  if (decision === 'CORRECT') return { kind: decision, message: 'You got it! Nice thinking.' }
  if (decision === 'INCORRECT') return { kind: decision, message: 'Not quite yet. Your answer is saved, and you can try again.' }
  if (decision === 'REVIEW_REQUIRED' || decision === 'PARTIAL') {
    return { kind: decision, message: 'Your answer is saved for a closer look.' }
  }
  return { kind: 'PENDING_ASSESSMENT', message: 'Answer saved. A trusted checker can review it later.' }
}

function segmentRefFor(step: ElementaryMathPresentationStep): string {
  const role = step.stage === 'MASTERY' ? 'reflect' : step.stage === 'LEARN' || step.stage === 'EXAMPLE' ? 'learn' : 'practice'
  return `${step.item.lessonRef}:segment:${role}`
}

function nextButtonLabel(step: ElementaryMathPresentationStep, hasNext: boolean): string {
  if (!hasNext) return 'Finish Lesson'
  if (step.stage === 'EXAMPLE') return step.position === step.total ? "Let's Try One" : 'Next Example'
  if (step.stage === 'GUIDED' && step.position === step.total) return 'Start Your Turn'
  if (step.stage === 'INDEPENDENT' && step.position === step.total) return 'Check What You Know'
  return 'Next Question'
}

function Progress({ step }: { readonly step: ElementaryMathPresentationStep }) {
  const label = STAGE_LABELS[step.stage]
  if (step.stage === 'LEARN') return <p className="elementary-player__progress">{label}</p>
  return <p className="elementary-player__progress" aria-label={`${label}, ${step.position} of ${step.total}`}>{label} <span aria-hidden="true">•</span> {step.position} of {step.total}</p>
}

export function ElementaryMathSamplePlayer({
  runtime,
  initialItemRef,
  onNeedHelp,
  onTakeBreak,
  onSaveForLater,
  onComplete,
}: ElementaryMathSamplePlayerProps) {
  const flow = useMemo(() => createElementaryMathPresentation(ELEMENTARY_MATH_SAMPLE_MATERIAL), [])
  const requestedStart = initialItemRef ? flow.findIndex((candidate) => candidate.item.itemRef === initialItemRef) : 0
  const [stepIndex, setStepIndex] = useState(requestedStart >= 0 ? requestedStart : 0)
  const [revealedExampleSteps, setRevealedExampleSteps] = useState(1)
  const [draft, setDraft] = useState('')
  const [selectedChoice, setSelectedChoice] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const step = flow[stepIndex]!

  useEffect(() => {
    headingRef.current?.focus()
  }, [stepIndex, complete])

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus()
  }, [feedback])

  if (runtime.context.lessonRef !== ELEMENTARY_MATH_SAMPLE_MATERIAL.lessonRef) {
    throw new Error('The elementary math sample player requires its matching sample lesson runtime.')
  }

  const resetQuestion = () => {
    setDraft('')
    setSelectedChoice('')
    setFeedback(null)
    setRevealedExampleSteps(1)
  }

  const moveNext = () => {
    resetQuestion()
    if (stepIndex >= flow.length - 1) {
      setComplete(true)
      onComplete?.()
      return
    }
    setStepIndex((current) => current + 1)
  }

  const savePlace = (callback: ElementaryMathSamplePlayerProps['onSaveForLater'], unavailableMessage: string) => {
    if (callback) callback({ stepIndex, itemRef: step.item.itemRef })
    else setFeedback({ kind: 'INFO', message: unavailableMessage })
  }

  const askJarvis = () => {
    if (onNeedHelp) onNeedHelp(step.item.itemRef)
    else setFeedback({ kind: 'INFO', message: 'Tutor help is not connected in this sample yet.' })
  }

  const answerValue = step.item.responseType === 'CHOICE' ? selectedChoice : draft
  const submitAnswer = async () => {
    if (busy || !answerValue.trim()) return
    setBusy(true)
    setFeedback(null)
    const result = await runtime.submit({
      lessonRef: step.item.lessonRef,
      sectionRef: step.item.sectionRef,
      itemRef: step.item.itemRef,
      segmentRef: segmentRefFor(step),
      value: answerValue,
    })
    setBusy(false)
    if (result.status === 'rejected') {
      setFeedback({ kind: 'ERROR', message: result.message })
      return
    }
    setFeedback(feedbackFor(result))
  }

  if (complete) {
    return (
      <main className="elementary-player elementary-player--complete">
        <section className="elementary-player__card">
          <p className="elementary-player__eyebrow">Math mission complete</p>
          <h1 ref={headingRef} tabIndex={-1}>Great work!</h1>
          <p>You learned, practiced, and checked what you know about rounding.</p>
        </section>
      </main>
    )
  }

  const isQuestion = !['READ', 'NONE'].includes(step.item.responseType)
  const hasNext = stepIndex < flow.length - 1
  const exampleSteps = step.item.example?.split('\n').filter(Boolean) ?? []
  const showingAllExampleSteps = revealedExampleSteps >= exampleSteps.length
  const stageLabel = STAGE_LABELS[step.stage]

  return (
    <main className="elementary-player">
      <header className="elementary-player__topbar">
        <div>
          <p className="elementary-player__eyebrow">Grade 3 Math</p>
          <p className="elementary-player__lesson-title">{ELEMENTARY_MATH_SAMPLE_MATERIAL.title}</p>
        </div>
        <button
          type="button"
          className="elementary-player__quiet-button"
          onClick={() => savePlace(onSaveForLater, 'Saving your place is not connected in this sample yet.')}
        >
          Save for Later
        </button>
      </header>

      <section className="elementary-player__card" aria-labelledby="elementary-player-heading">
        <Progress step={step} />
        <h1 id="elementary-player-heading" ref={headingRef} tabIndex={-1}>{stageLabel}</h1>

        {step.stage === 'LEARN' ? (
          <div className="elementary-player__learn">
            <h2>What does rounding mean?</h2>
            {(step.item.instruction ?? '').split('\n').filter(Boolean).map((line, index) => (
              index === 0 ? <p key={line} className="elementary-player__lead">{line}</p> : <p key={line} className="elementary-player__rule"><span aria-hidden="true">✓</span>{line}</p>
            ))}
            <button type="button" className="elementary-player__primary-button" onClick={moveNext}>Show Me an Example</button>
          </div>
        ) : step.stage === 'EXAMPLE' ? (
          <div className="elementary-player__example">
            <p className="elementary-player__prompt">{step.item.prompt}</p>
            <ol aria-label={`Steps for example ${step.position}`}>
              {exampleSteps.slice(0, revealedExampleSteps).map((exampleStep, index) => (
                <li key={exampleStep} className={index === exampleSteps.length - 1 ? 'elementary-player__example-answer' : undefined}>{exampleStep}</li>
              ))}
            </ol>
            {!showingAllExampleSteps ? (
              <button type="button" className="elementary-player__primary-button" onClick={() => setRevealedExampleSteps((count) => count + 1)}>Show Next Step</button>
            ) : (
              <button type="button" className="elementary-player__primary-button" onClick={moveNext}>{nextButtonLabel(step, hasNext)}</button>
            )}
          </div>
        ) : (
          <div className="elementary-player__question">
            {step.item.instruction ? <p className="elementary-player__instruction">{step.item.instruction}</p> : null}
            <p className="elementary-player__prompt">{step.item.prompt}</p>
            <form onSubmit={(event) => { event.preventDefault(); void submitAnswer() }}>
              {step.item.responseType === 'CHOICE' ? (
                <fieldset disabled={busy || Boolean(feedback && feedback.kind !== 'ERROR' && feedback.kind !== 'INFO')}>
                  <legend>Choose your answer</legend>
                  <div className="elementary-player__choices">
                    {step.item.choices.map((choice) => (
                      <label key={choice.choiceRef} className="elementary-player__choice">
                        <input
                          type="radio"
                          name="elementary-math-answer"
                          value={choice.choiceRef}
                          checked={selectedChoice === choice.choiceRef}
                          onChange={() => setSelectedChoice(choice.choiceRef)}
                        />
                        <span>{choice.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : step.item.responseType === 'CONSTRUCTED_RESPONSE' ? (
                <div className="elementary-player__field">
                  <label htmlFor="elementary-math-response">Explain your thinking</label>
                  <textarea
                    id="elementary-math-response"
                    value={draft}
                    disabled={busy || Boolean(feedback && feedback.kind !== 'ERROR' && feedback.kind !== 'INFO')}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={5}
                    autoComplete="off"
                  />
                </div>
              ) : (
                <div className="elementary-player__field elementary-player__field--number">
                  <label htmlFor="elementary-math-response">Your answer</label>
                  <input
                    id="elementary-math-response"
                    type="text"
                    inputMode={step.item.responseType === 'NUMERIC' ? 'numeric' : 'text'}
                    pattern={step.item.responseType === 'NUMERIC' ? '[0-9,.-]*' : undefined}
                    value={draft}
                    disabled={busy || Boolean(feedback && feedback.kind !== 'ERROR' && feedback.kind !== 'INFO')}
                    onChange={(event) => setDraft(event.target.value)}
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                </div>
              )}

              {!feedback || feedback.kind === 'ERROR' || feedback.kind === 'INFO' ? (
                <button type="submit" className="elementary-player__primary-button" disabled={busy || !answerValue.trim()}>
                  {busy ? 'Saving…' : 'Check Answer'}
                </button>
              ) : null}
            </form>
          </div>
        )}

        {feedback ? (
          <div
            ref={feedbackRef}
            className={`elementary-player__feedback elementary-player__feedback--${feedback.kind.toLowerCase()}`}
            role={feedback.kind === 'ERROR' ? 'alert' : 'status'}
            tabIndex={-1}
            aria-atomic="true"
          >
            <p>{feedback.message}</p>
            {isQuestion && !['ERROR', 'INFO'].includes(feedback.kind) ? (
              <div className="elementary-player__feedback-actions">
                {feedback.kind === 'INCORRECT' ? <button type="button" className="elementary-player__secondary-button" onClick={() => { setDraft(''); setSelectedChoice(''); setFeedback(null) }}>Try Again</button> : null}
                <button type="button" className="elementary-player__primary-button" onClick={moveNext}>{nextButtonLabel(step, hasNext)}</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <nav className="elementary-player__support" aria-label="Lesson help and break controls">
        <button type="button" className="elementary-player__support-button" onClick={askJarvis} aria-describedby={!onNeedHelp ? 'elementary-player-tutor-note' : undefined}>Need Help? Ask Jarvis</button>
        <button type="button" className="elementary-player__support-button" onClick={() => savePlace(onTakeBreak, 'Break controls are not connected in this sample yet.')}>Take a Break</button>
      </nav>
      {!onNeedHelp ? <p id="elementary-player-tutor-note" className="elementary-player__sr-only">Tutor help is not connected in this sample yet.</p> : null}
    </main>
  )
}
