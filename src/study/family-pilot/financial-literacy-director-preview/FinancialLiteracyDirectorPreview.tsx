import { useEffect, useMemo, useRef, useState } from 'react'
import samplePackageJson from '../../../../curriculum-production/final/financial-literacy/packages/grade-08/swk-fl-g8-u04-l03.package.json'
import './financialLiteracyDirectorPreview.css'

type SamplePrompt = {
  readonly ref: string
  readonly promptType: 'fixed-choice' | 'fixed-numeric' | 'extended-response'
  readonly text: string
  readonly choices?: readonly string[]
  readonly unit?: string
}

type SampleTask = {
  readonly taskId: string
  readonly kind: string
  readonly title: string
  readonly directions: string
  readonly support?: readonly string[]
  readonly permittedSupports?: readonly string[]
  readonly fade?: string
  readonly independenceBoundary?: string
  readonly evidencePurpose?: string
  readonly prompts: readonly SamplePrompt[]
}

type SamplePackage = {
  readonly sampleRevision: string
  readonly lessonRef: {
    readonly lessonId: string
    readonly grade: number
    readonly title: string
    readonly unitTitle: string
  }
  readonly objective: string
  readonly scenario: string
  readonly conceptExplanation: {
    readonly title: string
    readonly paragraphs: readonly string[]
    readonly relationship: readonly string[]
    readonly commonConfusion: string
  }
  readonly calculationPolicy: {
    readonly rateMeaning: string
    readonly statementTiming: string
    readonly rounding: string
    readonly permittedTools: readonly string[]
  }
  readonly workedExamples: readonly {
    readonly exampleRef: string
    readonly title: string
    readonly fictionCue: string
    readonly facts: readonly string[]
    readonly goal: string
    readonly steps: readonly string[]
    readonly interpretation: string
    readonly tradeoff: string
    readonly limits: string
  }[]
  readonly tasks: readonly SampleTask[]
  readonly remediationRoutes: readonly {
    readonly misconceptionId: string
    readonly observableSignal: string
    readonly alternateExplanation: string
    readonly parallelWorkedCase: {
      readonly title: string
      readonly facts: string
      readonly steps: readonly string[]
    }
  }[]
  readonly safetyNotes: readonly string[]
}

type LessonStep =
  | { readonly key: 'concept'; readonly kind: 'CONCEPT'; readonly label: 'Learn' }
  | { readonly key: 'example'; readonly kind: 'EXAMPLE'; readonly label: 'Worked example' }
  | { readonly key: string; readonly kind: 'TASK'; readonly label: string; readonly task: SampleTask }
  | { readonly key: 'checkpoint'; readonly kind: 'CHECKPOINT'; readonly label: 'Choose next step' }
  | { readonly key: 'remediation-model'; readonly kind: 'REMEDIATION'; readonly label: 'Another way' }
  | { readonly key: 'complete'; readonly kind: 'COMPLETE'; readonly label: 'Complete' }

const samplePackage = samplePackageJson as unknown as SamplePackage
const primaryTasks = samplePackage.tasks.filter((task) => !task.kind.startsWith('remediation-'))
const remediationTasks = samplePackage.tasks.filter((task) => task.kind.startsWith('remediation-'))

function taskLabel(task: SampleTask): string {
  switch (task.kind) {
    case 'comprehension-check': return 'Check the idea'
    case 'guided': return 'Guided practice'
    case 'independent': return 'Your turn'
    case 'independent-decision': return 'Make a decision'
    case 'mastery': return 'Fresh check'
    case 'remediation-guided': return 'Supported retry'
    case 'remediation-retry': return 'Fresh retry'
    default: return task.title
  }
}

function buildSteps(remediationEnabled: boolean): readonly LessonStep[] {
  const steps: LessonStep[] = [
    { key: 'concept', kind: 'CONCEPT', label: 'Learn' },
    { key: 'example', kind: 'EXAMPLE', label: 'Worked example' },
    ...primaryTasks.map((task): LessonStep => ({
      key: task.taskId,
      kind: 'TASK',
      label: taskLabel(task),
      task,
    })),
    { key: 'checkpoint', kind: 'CHECKPOINT', label: 'Choose next step' },
  ]
  if (remediationEnabled) {
    steps.push(
      { key: 'remediation-model', kind: 'REMEDIATION', label: 'Another way' },
      ...remediationTasks.map((task): LessonStep => ({
        key: task.taskId,
        kind: 'TASK',
        label: taskLabel(task),
        task,
      })),
    )
  }
  steps.push({ key: 'complete', kind: 'COMPLETE', label: 'Complete' })
  return steps
}

function PromptField({
  prompt,
  value,
  onChange,
}: {
  readonly prompt: SamplePrompt
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  if (prompt.choices?.length) {
    return (
      <fieldset className="finlit-prompt finlit-choice-group">
        <legend>{prompt.text}</legend>
        <div className="finlit-choice-list">
          {prompt.choices.map((choice) => (
            <label className="finlit-choice" key={choice}>
              <input
                checked={value === choice}
                name={prompt.ref}
                onChange={() => onChange(choice)}
                type="radio"
                value={choice}
              />
              <span>{choice}</span>
            </label>
          ))}
        </div>
      </fieldset>
    )
  }
  const inputId = `finlit-${prompt.ref}`
  return (
    <div className="finlit-prompt">
      <label htmlFor={inputId}>{prompt.text}</label>
      {prompt.promptType === 'fixed-numeric' ? (
        <div className="finlit-money-input">
          <span aria-hidden="true">$</span>
          <input
            autoComplete="off"
            id={inputId}
            inputMode="decimal"
            onChange={(event) => onChange(event.target.value)}
            placeholder="0.00"
            type="text"
            value={value}
          />
          <small>USD · use two decimal places</small>
        </div>
      ) : (
        <>
          <textarea
            id={inputId}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Use only the fictional case facts in your explanation."
            rows={5}
            value={value}
          />
          <small>Make a claim, cite a case fact, and explain the financial meaning or tradeoff.</small>
        </>
      )}
    </div>
  )
}

function ConceptCard() {
  const concept = samplePackage.conceptExplanation
  return (
    <article className="finlit-card finlit-teach-card">
      <p className="finlit-eyebrow">Learn the relationship</p>
      <h2>{concept.title}</h2>
      <div className="finlit-copy">
        {concept.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <div className="finlit-equation-stack" aria-label="Three statement relationships">
        {concept.relationship.map((line, index) => (
          <div key={line}>
            <span>{index + 1}</span>
            <strong>{line}</strong>
          </div>
        ))}
      </div>
      <aside className="finlit-watch-out">
        <span aria-hidden="true">◇</span>
        <div><strong>Watch for this mix-up</strong><p>{concept.commonConfusion}</p></div>
      </aside>
      <details className="finlit-assumptions">
        <summary>Exact statement assumptions</summary>
        <ul>
          <li>{samplePackage.calculationPolicy.rateMeaning}</li>
          <li>{samplePackage.calculationPolicy.statementTiming}</li>
          <li>{samplePackage.calculationPolicy.rounding}</li>
        </ul>
      </details>
    </article>
  )
}

function WorkedExampleCard() {
  const example = samplePackage.workedExamples[0]
  return (
    <article className="finlit-card finlit-example-card">
      <p className="finlit-eyebrow">See the whole process first</p>
      <h2>{example.title}</h2>
      <p className="finlit-fiction-cue">{example.fictionCue}</p>
      <div className="finlit-facts">
        <h3>Statement facts</h3>
        <ul>{example.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      </div>
      <p className="finlit-goal"><strong>Goal:</strong> {example.goal}</p>
      <ol className="finlit-worked-steps">
        {example.steps.map((step, index) => (
          <li key={step}><span>{index + 1}</span><p>{step}</p></li>
        ))}
      </ol>
      <div className="finlit-interpret-grid">
        <section><h3>What it means</h3><p>{example.interpretation}</p></section>
        <section><h3>Real-world tradeoff</h3><p>{example.tradeoff}</p></section>
      </div>
      <p className="finlit-limit"><strong>Limit:</strong> {example.limits}</p>
    </article>
  )
}

function TaskCard({
  task,
  responses,
  updateResponse,
}: {
  readonly task: SampleTask
  readonly responses: Readonly<Record<string, string>>
  readonly updateResponse: (ref: string, value: string) => void
}) {
  const supports = task.support ?? task.permittedSupports
  return (
    <article className={`finlit-card finlit-task-card finlit-task-${task.kind}`}>
      <p className="finlit-eyebrow">{taskLabel(task)}</p>
      <h2>{task.title}</h2>
      <p className="finlit-directions">{task.directions}</p>
      {supports?.length ? (
        <details className="finlit-supports" open={task.kind === 'guided' || task.kind === 'remediation-guided'}>
          <summary>{task.kind.includes('independent') || task.kind === 'mastery' ? 'Allowed supports' : 'Step support'}</summary>
          <ul>{supports.map((support) => <li key={support}>{support}</li>)}</ul>
        </details>
      ) : null}
      {task.fade ? <p className="finlit-fade"><strong>Support fades:</strong> {task.fade}</p> : null}
      {task.independenceBoundary ? <p className="finlit-boundary"><strong>Independent-work boundary:</strong> {task.independenceBoundary}</p> : null}
      {task.evidencePurpose ? <p className="finlit-boundary"><strong>What this fresh check shows:</strong> {task.evidencePurpose}</p> : null}
      <div className="finlit-prompts">
        {task.prompts.map((prompt) => (
          <PromptField
            key={prompt.ref}
            onChange={(value) => updateResponse(prompt.ref, value)}
            prompt={prompt}
            value={responses[prompt.ref] ?? ''}
          />
        ))}
      </div>
    </article>
  )
}

function RemediationCard() {
  const route = samplePackage.remediationRoutes[0]
  return (
    <article className="finlit-card finlit-remediation-card">
      <p className="finlit-eyebrow">A different model for a specific mix-up</p>
      <h2>Use three balance boxes</h2>
      <p><strong>If this happened:</strong> {route.observableSignal}</p>
      <p>{route.alternateExplanation}</p>
      <section className="finlit-parallel-case">
        <h3>{route.parallelWorkedCase.title}</h3>
        <p>{route.parallelWorkedCase.facts}</p>
        <ol>{route.parallelWorkedCase.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>
      <p className="finlit-limit">This is a new fictional model, not the protected answer. Next you will try Nia's case with the boxes, then Omar's fresh case without them.</p>
    </article>
  )
}

function CheckpointCard({ onFinish, onRemediate }: { readonly onFinish: () => void; readonly onRemediate: () => void }) {
  return (
    <article className="finlit-card finlit-checkpoint-card">
      <p className="finlit-eyebrow">Fresh work submitted</p>
      <h2>Choose what happens next</h2>
      <p>Your responses are still private to this preview tab. No protected answers or automatic score appear here.</p>
      <div className="finlit-checkpoint-options">
        <button className="finlit-option-card" onClick={onFinish} type="button">
          <span aria-hidden="true">✓</span>
          <strong>Finish for now</strong>
          <small>Send the work to a trusted adult checker later.</small>
        </button>
        <button className="finlit-option-card finlit-option-help" onClick={onRemediate} type="button">
          <span aria-hidden="true">↻</span>
          <strong>Try another explanation</strong>
          <small>Use a different model, a supported retry, and a fresh check.</small>
        </button>
      </div>
    </article>
  )
}

function CompleteCard({ responseCount, onRestart }: { readonly responseCount: number; readonly onRestart: () => void }) {
  return (
    <article className="finlit-card finlit-complete-card">
      <div className="finlit-complete-mark" aria-hidden="true">✓</div>
      <p className="finlit-eyebrow">Lesson path complete</p>
      <h2>Your financial reasoning is ready for review.</h2>
      <p>{responseCount} response{responseCount === 1 ? '' : 's'} remain only in memory in this preview tab. No real financial data was requested or stored.</p>
      <button className="finlit-primary" onClick={onRestart} type="button">Restart preview</button>
    </article>
  )
}

export function FinancialLiteracyDirectorPreview() {
  const [stepIndex, setStepIndex] = useState(0)
  const [remediationEnabled, setRemediationEnabled] = useState(false)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const steps = useMemo(() => buildSteps(remediationEnabled), [remediationEnabled])
  const current = steps[Math.min(stepIndex, steps.length - 1)]
  const currentTask = current.kind === 'TASK' ? current.task : null
  const taskComplete = currentTask
    ? currentTask.prompts.every((prompt) => Boolean(responses[prompt.ref]?.trim()))
    : true
  const progress = current.kind === 'COMPLETE' ? 100 : Math.round((stepIndex / (steps.length - 1)) * 100)

  useEffect(() => {
    headingRef.current?.focus()
  }, [current.key])

  const moveNext = () => {
    if (!taskComplete) {
      setMessage('Complete each response in this section before continuing. You may use the supports listed above.')
      return
    }
    setMessage(currentTask ? 'Responses saved in this preview tab.' : '')
    setStepIndex((index) => Math.min(index + 1, steps.length - 1))
  }

  const restart = () => {
    setResponses({})
    setRemediationEnabled(false)
    setStepIndex(0)
    setMessage('Preview restarted. Earlier responses were cleared.')
  }

  return (
    <main className="finlit-preview-shell">
      <header className="finlit-topbar">
        <div className="finlit-brand" aria-label="Manuel Academy">
          <span aria-hidden="true">M</span>
          <div><strong>Manuel Academy</strong><small>Director review · local preview</small></div>
        </div>
        <div className="finlit-course-pill">Grade 8 · Financial Literacy</div>
      </header>

      <div className="finlit-progress-track" aria-label={`Lesson progress ${progress}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <section className="finlit-hero">
        <div>
          <p className="finlit-unit">{samplePackage.lessonRef.unitTitle}</p>
          <h1 ref={headingRef} tabIndex={-1}>How a Credit Card Payment Gets Split</h1>
          <p>{samplePackage.objective}</p>
        </div>
        <aside>
          <strong>Fictional finances only</strong>
          <p>{samplePackage.scenario}</p>
        </aside>
      </section>

      <div className="finlit-layout">
        <nav className="finlit-map" aria-label="Lesson map">
          <p>Lesson map</p>
          <ol>
            {steps.filter((step) => step.kind !== 'COMPLETE').map((step, index) => (
              <li className={index === stepIndex ? 'active' : index < stepIndex ? 'done' : ''} key={step.key}>
                <span aria-hidden="true">{index < stepIndex ? '✓' : index + 1}</span>
                <div><strong>{step.label}</strong>{index === stepIndex ? <small>Current</small> : null}</div>
              </li>
            ))}
          </ol>
          <div className="finlit-map-note">
            <strong>No live account needed</strong>
            <p>Calculator and scratch paper are allowed unless a section says otherwise.</p>
          </div>
        </nav>

        <section className="finlit-workspace" aria-live="polite">
          {current.kind === 'CONCEPT' ? <ConceptCard /> : null}
          {current.kind === 'EXAMPLE' ? <WorkedExampleCard /> : null}
          {current.kind === 'TASK' ? (
            <TaskCard
              responses={responses}
              task={current.task}
              updateResponse={(ref, value) => {
                setResponses((held) => ({ ...held, [ref]: value }))
                setMessage('')
              }}
            />
          ) : null}
          {current.kind === 'CHECKPOINT' ? (
            <CheckpointCard
              onFinish={() => setStepIndex((index) => index + 1)}
              onRemediate={() => {
                setRemediationEnabled(true)
                setStepIndex((index) => index + 1)
              }}
            />
          ) : null}
          {current.kind === 'REMEDIATION' ? <RemediationCard /> : null}
          {current.kind === 'COMPLETE' ? <CompleteCard onRestart={restart} responseCount={Object.values(responses).filter((value) => value.trim()).length} /> : null}

          {message ? <p className={message.includes('Complete each') ? 'finlit-message finlit-message-error' : 'finlit-message'} role={message.includes('Complete each') ? 'alert' : 'status'}>{message}</p> : null}

          {!['CHECKPOINT', 'COMPLETE'].includes(current.kind) ? (
            <footer className="finlit-actions">
              <button
                className="finlit-secondary"
                disabled={stepIndex === 0}
                onClick={() => {
                  setMessage('')
                  setStepIndex((index) => Math.max(0, index - 1))
                }}
                type="button"
              >Back</button>
              <p>Answers stay hidden during practice and fresh checks.</p>
              <button className="finlit-primary" onClick={moveNext} type="button">
                {current.kind === 'TASK' ? 'Save and continue' : 'Continue'}
              </button>
            </footer>
          ) : null}
        </section>
      </div>

      <footer className="finlit-footer">
        <span>{samplePackage.lessonRef.lessonId}</span>
        <span>{samplePackage.sampleRevision}</span>
      </footer>
    </main>
  )
}
