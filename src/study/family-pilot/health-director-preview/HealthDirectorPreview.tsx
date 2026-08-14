import { type ReactNode, useEffect, useRef, useState } from 'react'
import { healthDirectorLesson } from './lesson'
import './health-director-preview.css'

type StepId = 'GOAL' | 'LEARN' | 'WORDS' | 'MODEL' | 'GUIDED' | 'PRACTICE' | 'CHECK' | 'RETRY'

const STEPS: readonly Readonly<{ id: StepId; label: string; kicker: string }>[] = [
  { id: 'GOAL', label: 'Your goal', kicker: 'Start here' },
  { id: 'LEARN', label: 'Learn', kicker: 'Build the idea' },
  { id: 'WORDS', label: 'Words', kicker: 'Use the terms' },
  { id: 'MODEL', label: 'See a model', kicker: 'Watch the thinking' },
  { id: 'GUIDED', label: 'Try together', kicker: 'Use a cue' },
  { id: 'PRACTICE', label: 'Your turn', kicker: 'Fresh practice' },
  { id: 'CHECK', label: 'Check', kicker: 'New situation' },
  { id: 'RETRY', label: 'Another way', kicker: 'Different explanation' },
] as const

const lesson = healthDirectorLesson
const experience = lesson.lessonExperience

function SituationCard({ children }: { readonly children: ReactNode }) {
  return (
    <div className="health-review__situation">
      <span aria-hidden="true">Fictional case</span>
      <p>{children}</p>
    </div>
  )
}

function Checklist({ items }: { readonly items: readonly string[] }) {
  return <ul className="health-review__checklist">{items.map((item) => <li key={item}>{item}</li>)}</ul>
}

function ChoiceGroup({
  legend,
  choices,
  name,
  value,
  onChange,
}: {
  readonly legend: string
  readonly choices: readonly string[]
  readonly name: string
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  return (
    <fieldset className="health-review__choices">
      <legend>{legend}</legend>
      {choices.map((choice) => (
        <label key={choice}>
          <input type="radio" name={name} value={choice} checked={value === choice} onChange={() => onChange(choice)} />
          <span>{choice}</span>
        </label>
      ))}
    </fieldset>
  )
}

function ResponseBox({
  id,
  label,
  value,
  onChange,
  rows = 6,
}: {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly rows?: number
}) {
  return (
    <label className="health-review__response" htmlFor={id}>
      <span>{label}</span>
      <textarea id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Type here, or use another response choice." />
      <small>You may also write, draw with labels, sign, or tell an adult who is helping with the lesson.</small>
    </label>
  )
}

function GoalStep({ entryChoice, setEntryChoice }: { readonly entryChoice: string; readonly setEntryChoice: (value: string) => void }) {
  const entry = experience.entryCheck
  return (
    <>
      <div className="health-review__goal-card">
        <span>What you’ll learn</span>
        <p>{lesson.learningGoal}</p>
      </div>
      <div className="health-review__privacy" role="note">
        <strong>Keep it fictional.</strong>
        <span>{experience.privacyNotice}</span>
      </div>
      <h2>{entry.heading}</h2>
      <ChoiceGroup legend={entry.directions} choices={entry.choices} name="entry-check" value={entryChoice} onChange={setEntryChoice} />
      <details className="health-review__support"><summary>Need a clue?</summary><p>{entry.support}</p></details>
      <p className="health-review__quiet-note">{entry.treatment}</p>
    </>
  )
}

function LearnStep() {
  const explanation = experience.explanation
  return (
    <>
      <h2>{explanation.heading}</h2>
      <div className="health-review__reading">{explanation.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      <div className="health-review__contrast">
        <span>Important difference</span>
        <p>{explanation.importantDistinction}</p>
      </div>
      <div className="health-review__rule" aria-label="Facts, connect, choose, ask decision rule">
        {explanation.decisionRule.split(/(?=FACTS:|CONNECT:|CHOOSE:|ASK:)/).filter(Boolean).map((line) => {
          const [label, ...rest] = line.split(':')
          return <div key={label}><strong>{label}</strong><span>{rest.join(':').trim()}</span></div>
        })}
      </div>
    </>
  )
}

function WordsStep({ choices, setChoice }: { readonly choices: readonly string[]; readonly setChoice: (index: number, value: string) => void }) {
  const vocabulary = experience.vocabulary
  const check = experience.vocabularyCheck
  return (
    <>
      <h2>{vocabulary.heading}</h2>
      <div className="health-review__terms">
        {vocabulary.terms.map((item) => (
          <article key={item.term}>
            <h3>{item.term}</h3>
            <p>{item.meaning}</p>
            <dl><dt>Example</dt><dd>{item.example}</dd><dt>Remember</dt><dd>{item.boundary}</dd></dl>
          </article>
        ))}
      </div>
      <div className="health-review__mini-check">
        <h2>{check.heading}</h2>
        <p>{check.directions}</p>
        {check.items.map((item, index) => (
          <ChoiceGroup key={item.prompt} legend={`${index + 1}. ${item.prompt}`} choices={item.choices} name={`vocabulary-${index}`} value={choices[index] ?? ''} onChange={(value) => setChoice(index, value)} />
        ))}
        <p className="health-review__self-check"><strong>Self-check:</strong> {check.selfCheck}</p>
      </div>
    </>
  )
}

function ModelStep() {
  const model = experience.modelExample
  return (
    <>
      <h2>{model.heading}</h2>
      <SituationCard>{model.situation}</SituationCard>
      <div className="health-review__options"><h3>Possible actions</h3><ol>{model.possibleActions.map((action) => <li key={action}>{action}</li>)}</ol></div>
      <div className="health-review__thinking">
        {model.thinkingSteps.map((step) => <article key={step.label}><strong>{step.label}</strong><p>{step.text}</p></article>)}
      </div>
      <div className="health-review__success"><strong>Check the model</strong><p>{model.successCheck}</p></div>
    </>
  )
}

function GuidedStep({ response, setResponse }: { readonly response: string; readonly setResponse: (value: string) => void }) {
  const guided = experience.guidedReasoning
  const [showCue, setShowCue] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  return (
    <>
      <h2>{guided.heading}</h2>
      <SituationCard>{guided.situation}</SituationCard>
      <Checklist items={guided.turnOne} />
      <ResponseBox id="guided-response" label="Make your first attempt." value={response} onChange={setResponse} />
      <div className="health-review__support-actions">
        <button type="button" className="health-review__text-button" onClick={() => setShowCue(true)}>Show one cue</button>
        {response.trim() ? <button type="button" className="health-review__text-button" onClick={() => setShowFeedback(true)}>Check my reasoning steps</button> : null}
      </div>
      {showCue ? <div className="health-review__cue" role="note"><strong>Cue</strong><p>{guided.cue}</p></div> : null}
      {showFeedback ? (
        <div className="health-review__feedback" role="status">
          <strong>Use the line that fits your work.</strong>
          <Checklist items={guided.feedbackMoves} />
          <p><strong>Revise:</strong> {guided.turnTwo}</p>
          <p>{guided.releaseCondition}</p>
        </div>
      ) : null}
    </>
  )
}

function PracticeStep({ response, setResponse }: { readonly response: string; readonly setResponse: (value: string) => void }) {
  const practice = experience.independentEvidence
  return (
    <>
      <h2>{practice.heading}</h2>
      <p className="health-review__eyebrow">Fresh independent case</p>
      <SituationCard>{practice.situation}</SituationCard>
      <Checklist items={practice.directions} />
      <ResponseBox id="independent-response" label="Write or give your full response." value={response} onChange={setResponse} rows={9} />
      <details className="health-review__support"><summary>Access supports you may use</summary><Checklist items={practice.permittedSupports} /><p>{practice.independenceBoundary}</p></details>
      <div className="health-review__success"><strong>Check your work</strong><Checklist items={practice.successCriteria} /></div>
    </>
  )
}

function CheckStep({ response, setResponse, onRetry, saved }: { readonly response: string; readonly setResponse: (value: string) => void; readonly onRetry: () => void; readonly saved: boolean }) {
  const check = experience.freshConceptCheck
  return (
    <>
      <h2>{check.heading}</h2>
      <p className="health-review__eyebrow">No model answer on this step</p>
      <SituationCard>{check.situation}</SituationCard>
      <Checklist items={check.directions} />
      <ResponseBox id="fresh-check-response" label="Explain your thinking." value={response} onChange={setResponse} rows={8} />
      <p className="health-review__quiet-note">{check.freshnessNote}</p>
      {saved ? <div className="health-review__saved" role="status"><strong>Work kept on this page only.</strong><span>This is one check. It does not mean the skill is mastered yet.</span></div> : null}
      <div className="health-review__choice-row">
        <button type="button" className="health-review__secondary" onClick={onRetry}>I need another explanation</button>
        <span>Choosing help is not a wrong answer.</span>
      </div>
    </>
  )
}

function RetryStep({ response, setResponse }: { readonly response: string; readonly setResponse: (value: string) => void }) {
  const retry = experience.remediation
  return (
    <>
      <h2>{retry.heading}</h2>
      <p>{retry.trigger}</p>
      <div className="health-review__alternate"><span>Five windows + the camera test</span><p>{retry.alternateExplanation}</p></div>
      <div className="health-review__contrast-list">{retry.contrast.map((item) => <p key={item}>{item}</p>)}</div>
      <div className="health-review__guided-correction"><strong>Quick correction</strong><p>{retry.guidedCorrection}</p></div>
      <h3>Fresh retry</h3>
      <SituationCard>{retry.freshRetry.situation}</SituationCard>
      <Checklist items={retry.freshRetry.directions} />
      <ResponseBox id="retry-response" label="Try the new case." value={response} onChange={setResponse} />
      <div className="health-review__success"><strong>Ready to return</strong><p>{retry.exitCriterion}</p></div>
    </>
  )
}

export function HealthDirectorPreview() {
  const [stepIndex, setStepIndex] = useState(0)
  const [entryChoice, setEntryChoice] = useState('')
  const [vocabularyChoices, setVocabularyChoices] = useState<readonly string[]>([])
  const [responses, setResponses] = useState<Readonly<Record<string, string>>>({})
  const [checkSaved, setCheckSaved] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const step = STEPS[stepIndex]!

  useEffect(() => { headingRef.current?.focus() }, [stepIndex])

  const setResponse = (key: string, value: string) => setResponses((current) => ({ ...current, [key]: value }))
  const setVocabularyChoice = (index: number, value: string) => setVocabularyChoices((current) => {
    const next = [...current]
    next[index] = value
    return next
  })
  const canContinue = step.id === 'GOAL' ? Boolean(entryChoice)
    : step.id === 'WORDS' ? vocabularyChoices.filter(Boolean).length === experience.vocabularyCheck.items.length
      : step.id === 'GUIDED' ? Boolean(responses.guided?.trim())
        : step.id === 'PRACTICE' ? Boolean(responses.practice?.trim())
          : step.id === 'CHECK' ? Boolean(responses.check?.trim())
            : step.id === 'RETRY' ? Boolean(responses.retry?.trim())
              : true

  const moveTo = (index: number) => setStepIndex(Math.max(0, Math.min(index, STEPS.length - 1)))

  return (
    <main className="health-review" data-lesson-id={lesson.lessonId}>
      <header className="health-review__topbar">
        <div className="health-review__brand"><span>MA</span><div><strong>Manuel Academy</strong><small>Health • Grade 5</small></div></div>
        <div className="health-review__review-mark"><span>Director review</span><strong>Real canonical lesson</strong></div>
      </header>

      <div className="health-review__layout">
        <aside className="health-review__rail" aria-label="Lesson path">
          <div className="health-review__rail-heading"><p>Today’s lesson</p><strong>{experience.learnerTitle}</strong><small>{lesson.estimatedMinutes} minutes</small></div>
          <ol>
            {STEPS.map((candidate, index) => (
              <li key={candidate.id} className={index === stepIndex ? 'is-current' : index < stepIndex ? 'is-complete' : ''}>
                <button type="button" onClick={() => index <= stepIndex && moveTo(index)} disabled={index > stepIndex} aria-current={index === stepIndex ? 'step' : undefined}>
                  <span>{index < stepIndex ? '✓' : index + 1}</span>
                  <span><strong>{candidate.label}</strong><small>{candidate.kicker}</small></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="health-review__adult-note"><strong>Need real-world help?</strong><p>Pause and tell a trusted adult. This lesson does not diagnose or give personal treatment advice.</p></div>
        </aside>

        <section className="health-review__lesson" aria-labelledby="health-review-title">
          <div className="health-review__stage-line"><span>{step.kicker}</span><span>Step {stepIndex + 1} of {STEPS.length}</span></div>
          <h1 id="health-review-title" ref={headingRef} tabIndex={-1}>{step.label}</h1>

          {step.id === 'GOAL' ? <GoalStep entryChoice={entryChoice} setEntryChoice={setEntryChoice} /> : null}
          {step.id === 'LEARN' ? <LearnStep /> : null}
          {step.id === 'WORDS' ? <WordsStep choices={vocabularyChoices} setChoice={setVocabularyChoice} /> : null}
          {step.id === 'MODEL' ? <ModelStep /> : null}
          {step.id === 'GUIDED' ? <GuidedStep response={responses.guided ?? ''} setResponse={(value) => setResponse('guided', value)} /> : null}
          {step.id === 'PRACTICE' ? <PracticeStep response={responses.practice ?? ''} setResponse={(value) => setResponse('practice', value)} /> : null}
          {step.id === 'CHECK' ? <CheckStep response={responses.check ?? ''} setResponse={(value) => { setCheckSaved(false); setResponse('check', value) }} onRetry={() => moveTo(7)} saved={checkSaved} /> : null}
          {step.id === 'RETRY' ? <RetryStep response={responses.retry ?? ''} setResponse={(value) => setResponse('retry', value)} /> : null}

          <nav className="health-review__actions" aria-label="Lesson navigation">
            {stepIndex > 0 ? <button type="button" className="health-review__secondary" onClick={() => moveTo(stepIndex - 1)}>Back</button> : <span />}
            {step.id === 'CHECK'
              ? <button type="button" className="health-review__primary" disabled={!canContinue || checkSaved} onClick={() => setCheckSaved(true)}>{checkSaved ? 'Work kept' : 'Complete this check'}</button>
              : stepIndex < STEPS.length - 1
              ? <button type="button" className="health-review__primary" disabled={!canContinue} onClick={() => moveTo(stepIndex + 1)}>Continue</button>
              : <button type="button" className="health-review__primary" disabled={!canContinue} onClick={() => moveTo(6)}>Return to the check</button>}
          </nav>

          <details className="health-review__lesson-note">
            <summary>Privacy, support, and optional reflection</summary>
            <p>{lesson.trustedAdultNote}</p>
            <p><strong>Private and optional:</strong> {lesson.optionalReflection.prompt}</p>
            <p>This reflection is not scored. It does not count for completion or mastery.</p>
          </details>
        </section>
      </div>
    </main>
  )
}
