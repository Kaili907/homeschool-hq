import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BrowserLearnerResponseStore,
  LearnerResponseRuntime,
  type LearnerResponseStore,
} from '../final-app/learner-response'
import {
  RESPONSE_STAGE,
  TECHNOLOGY_DIRECTOR_LESSON,
  TECHNOLOGY_DIRECTOR_LESSON_REF,
  TECHNOLOGY_DIRECTOR_RESPONSE_MATERIAL,
  type CodeTest,
  type RemediationRoute,
  type ResponseStageId,
} from './lesson'
import './TechnologyDirectorPreview.css'

export type TechnologyPreviewScreen =
  | 'concept'
  | 'worked'
  | 'guided'
  | 'independent'
  | 'mastery'
  | 'decision'
  | 'remediation'
  | 'fresh'
  | 'complete'

type Feedback = Readonly<{ kind: 'saved' | 'error'; message: string }>

export interface TechnologyDirectorPreviewProps {
  readonly initialScreen?: TechnologyPreviewScreen
  readonly responseStore?: LearnerResponseStore
}

const experience = TECHNOLOGY_DIRECTOR_LESSON.learner_experience

const SCREEN_META: Readonly<Record<TechnologyPreviewScreen, { label: string; step: number; total: number }>> = Object.freeze({
  concept: { label: 'Learn', step: 1, total: 5 },
  worked: { label: 'Worked example', step: 2, total: 5 },
  guided: { label: 'Guided debug', step: 3, total: 5 },
  independent: { label: 'Independent build', step: 4, total: 5 },
  mastery: { label: 'Mastery debug', step: 5, total: 5 },
  decision: { label: 'Choose next step', step: 5, total: 5 },
  remediation: { label: 'Different explanation', step: 6, total: 7 },
  fresh: { label: 'Fresh check', step: 7, total: 7 },
  complete: { label: 'Review pending', step: 5, total: 5 },
})

function CodeBlock({ code, label }: { readonly code: string; readonly label: string }) {
  return (
    <div className="technology-preview__code-wrap">
      <p className="technology-preview__code-label">{label}</p>
      <pre className="technology-preview__code" tabIndex={0} aria-label={label}><code>{code}</code></pre>
    </div>
  )
}

function BulletList({ items }: { readonly items: readonly string[] }) {
  return <ul className="technology-preview__list">{items.map((item) => <li key={item}>{item}</li>)}</ul>
}

function TestTable({ tests }: { readonly tests: readonly CodeTest[] }) {
  return (
    <div className="technology-preview__table-wrap" tabIndex={0} role="region" aria-label="Public test evidence">
      <table>
        <thead><tr><th scope="col">Input</th><th scope="col">Expected</th>{tests.some((test) => test.observed) ? <th scope="col">Observed</th> : null}</tr></thead>
        <tbody>{tests.map((test) => <tr key={test.input}><td><code>{test.input}</code></td><td><code>{test.expected}</code></td>{tests.some((candidate) => candidate.observed) ? <td><code>{test.observed ?? '—'}</code></td> : null}</tr>)}</tbody>
      </table>
    </div>
  )
}

function StringTestList({ tests }: { readonly tests: readonly string[] }) {
  return <div className="technology-preview__tests" aria-label="Public tests">{tests.map((test) => <code key={test}>{test}</code>)}</div>
}

function EvidenceForm({
  stage,
  draft,
  setDraft,
  feedback,
  busy,
  onSubmit,
  onContinue,
}: {
  readonly stage: ResponseStageId
  readonly draft: string
  readonly setDraft: (value: string) => void
  readonly feedback: Feedback | null
  readonly busy: boolean
  readonly onSubmit: () => void
  readonly onContinue: () => void
}) {
  const labels: Readonly<Record<ResponseStageId, string>> = {
    guided: 'Your trace, hypothesis, change, and rerun notes',
    independent: 'Your implementation, tests, invariant argument, and trade-off',
    mastery: 'Your corrected code, six-move defect log, tests, invariant, and efficiency analysis',
    fresh: 'Your fresh corrected code, defect log, tests, invariant, and efficiency analysis',
  }
  return (
    <form className="technology-preview__response" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
      <label htmlFor={`technology-preview-${stage}-response`}>{labels[stage]}</label>
      <textarea
        id={`technology-preview-${stage}-response`}
        rows={12}
        value={draft}
        disabled={busy || feedback?.kind === 'saved'}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck="false"
        autoComplete="off"
      />
      {feedback ? <div className={`technology-preview__feedback technology-preview__feedback--${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'} tabIndex={-1}><p>{feedback.message}</p></div> : null}
      {feedback?.kind === 'saved' ? (
        <button type="button" className="technology-preview__primary" onClick={onContinue}>{stage === 'mastery' ? 'Choose what comes next' : stage === 'fresh' ? 'Finish for trusted review' : 'Continue'}</button>
      ) : (
        <button type="submit" className="technology-preview__primary" disabled={busy || !draft.trim()}>{busy ? 'Saving…' : 'Save response for review'}</button>
      )}
    </form>
  )
}

export function TechnologyDirectorPreview({
  initialScreen = 'concept',
  responseStore,
}: TechnologyDirectorPreviewProps = {}) {
  const [screen, setScreen] = useState<TechnologyPreviewScreen>(initialScreen)
  const [route, setRoute] = useState<RemediationRoute | null>(null)
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const store = useMemo(() => responseStore ?? new BrowserLearnerResponseStore({
    databaseName: 'manuel-academy.director-review.technology-sample-r1',
    legacyStorage: { getItem: () => null },
  }), [responseStore])
  const runtime = useMemo(() => new LearnerResponseRuntime(TECHNOLOGY_DIRECTOR_RESPONSE_MATERIAL, {
    lessonRef: TECHNOLOGY_DIRECTOR_LESSON_REF,
    studentRef: 'director-review-r1',
    assignmentRef: 'technology-director-sample-r1',
    attemptRef: 'technology-director-sample-r1',
  }, store), [store])

  useEffect(() => {
    setDraft('')
    setFeedback(null)
    setHintOpen(false)
    headingRef.current?.focus()
  }, [screen])

  const move = (next: TechnologyPreviewScreen) => setScreen(next)
  const stage = ['guided', 'independent', 'mastery', 'fresh'].includes(screen) ? screen as ResponseStageId : null

  const submit = async () => {
    if (!stage || busy || !draft.trim()) return
    setBusy(true)
    setFeedback(null)
    const refs = RESPONSE_STAGE[stage]
    const result = await runtime.submit({
      lessonRef: TECHNOLOGY_DIRECTOR_LESSON_REF,
      sectionRef: refs.sectionRef,
      itemRef: refs.itemRef,
      segmentRef: `${TECHNOLOGY_DIRECTOR_LESSON_REF}:segment:${stage}`,
      value: draft,
    })
    setBusy(false)
    if (result.status === 'rejected') {
      setFeedback({ kind: 'error', message: result.message })
      return
    }
    setFeedback({ kind: 'saved', message: 'Response saved on this device for trusted review. No correctness result or protected solution is shown.' })
  }

  const continueAfterSave = () => {
    if (screen === 'guided') move('independent')
    else if (screen === 'independent') move('mastery')
    else if (screen === 'mastery') move('decision')
    else if (screen === 'fresh') move('complete')
  }

  const meta = SCREEN_META[screen]
  const protectedStage = ['independent', 'mastery', 'decision', 'remediation', 'fresh'].includes(screen)

  return (
    <main className="technology-preview">
      <header className="technology-preview__topbar">
        <div>
          <p className="technology-preview__eyebrow">Technology Director preview · Grade 10</p>
          <p className="technology-preview__lesson-title">{TECHNOLOGY_DIRECTOR_LESSON.lesson_title}</p>
        </div>
        <div className="technology-preview__static-badge"><span aria-hidden="true">●</span> Static lesson · no Tutor required</div>
      </header>

      <div className="technology-preview__layout">
        <aside className="technology-preview__rail" aria-label="Lesson progress">
          <p className="technology-preview__rail-label">{meta.label}</p>
          <p className="technology-preview__step">Step {meta.step} of {meta.total}</p>
          <div className="technology-preview__meter" aria-hidden="true"><span style={{ width: `${meta.step / meta.total * 100}%` }} /></div>
          <dl>
            <div><dt>Time</dt><dd>{TECHNOLOGY_DIRECTOR_LESSON.estimated_minutes}</dd></div>
            <div><dt>Evidence</dt><dd>{screen === 'concept' || screen === 'worked' ? 'Instruction only' : screen === 'guided' ? 'Formative' : 'Protected'}</dd></div>
            <div><dt>Review</dt><dd>Trusted adult rubric</dd></div>
          </dl>
          <p className="technology-preview__privacy">Use only the fictional local data shown here. Never paste credentials, private messages, locations, or personal data. No network request or account is needed.</p>
        </aside>

        <section className="technology-preview__card" aria-labelledby="technology-preview-heading">
          {protectedStage ? <div className="technology-preview__boundary" role="note"><strong>Independent boundary:</strong> teaching fixtures are closed. Only the public specification, tests, and permitted cue remain visible.</div> : null}

          {screen === 'concept' ? (
            <>
              <p className="technology-preview__kicker">Explicit concept teaching</p>
              <h1 id="technology-preview-heading" ref={headingRef} tabIndex={-1}>{experience.concept_teaching.title}</h1>
              <p className="technology-preview__lead">{experience.concept_teaching.entry_check}</p>
              <h2>Today you will</h2>
              <BulletList items={experience.learning_targets} />
              <div className="technology-preview__prose">{experience.concept_teaching.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
              <h2>Technical vocabulary</h2>
              <dl className="technology-preview__terms">{experience.concept_teaching.key_terms.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.definition}</dd></div>)}</dl>
              <h2>Check before you apply it</h2>
              <BulletList items={experience.concept_teaching.application_check} />
              <button type="button" className="technology-preview__primary" onClick={() => move('worked')}>Open the worked example</button>
            </>
          ) : null}

          {screen === 'worked' ? (
            <>
              <p className="technology-preview__kicker">Completed analogous example · not scored</p>
              <h1 id="technology-preview-heading" ref={headingRef} tabIndex={-1}>{experience.worked_example.title}</h1>
              <p className="technology-preview__lead">{experience.worked_example.goal}</p>
              <div className="technology-preview__analogue"><strong>Why this is safe to study:</strong> it uses a single loop and an early-return defect. The later protected task uses different data, nested pair coverage, and a different decisive repair.</div>
              <CodeBlock code={experience.worked_example.starter_code} label="Starting code for the non-target example" />
              <p><strong>Observed evidence:</strong> {experience.worked_example.public_observation}</p>
              <ol className="technology-preview__debug-cycle">{experience.worked_example.annotations.map((annotation) => <li key={annotation.move}><span>{annotation.move}</span><p>{annotation.reasoning}</p></li>)}</ol>
              <CodeBlock code={experience.worked_example.completed_code} label="Completed code for the non-target example" />
              <div className="technology-preview__invariant"><strong>Correctness and cost</strong><p>{experience.worked_example.correctness_and_efficiency}</p></div>
              <p className="technology-preview__transfer"><strong>Transfer question:</strong> {experience.worked_example.transfer_prompt}</p>
              <button type="button" className="technology-preview__primary" onClick={() => move('guided')}>Try the guided debug</button>
            </>
          ) : null}

          {screen === 'guided' ? (
            <>
              <p className="technology-preview__kicker">Guided task · support will fade</p>
              <h1 id="technology-preview-heading" ref={headingRef} tabIndex={-1}>{experience.guided_task.title}</h1>
              <p className="technology-preview__lead">{experience.guided_task.goal}</p>
              <CodeBlock code={experience.guided_task.starter_code} label="Guided debugging code" />
              <TestTable tests={experience.guided_task.public_tests} />
              <h2>Your debugging moves</h2>
              <BulletList items={experience.guided_task.prompts} />
              <details className="technology-preview__cue"><summary>Check what to inspect</summary><p>{experience.guided_task.immediate_check}</p></details>
              <p className="technology-preview__fade"><strong>Support fade:</strong> {experience.guided_task.support_fade}</p>
              <EvidenceForm stage="guided" draft={draft} setDraft={setDraft} feedback={feedback} busy={busy} onSubmit={() => void submit()} onContinue={continueAfterSave} />
            </>
          ) : null}

          {screen === 'independent' ? (
            <>
              <p className="technology-preview__kicker">Independent creation · protected evidence</p>
              <h1 id="technology-preview-heading" ref={headingRef} tabIndex={-1}>{experience.independent_creation.title}</h1>
              <CodeBlock code={experience.independent_creation.starter_code} label="Independent creation starter" />
              <h2>Specification</h2><BulletList items={experience.independent_creation.specification} />
              <h2>Public tests</h2><StringTestList tests={experience.independent_creation.public_tests} />
              <h2>Submit all five evidence parts</h2><BulletList items={experience.independent_creation.evidence_requirements} />
              <details className="technology-preview__cue"><summary>Clarify the support limit</summary><p>You may clarify a term or instruction. No algorithm step, implementation structure, decisive condition, completed trace, or solution code is available.</p></details>
              <EvidenceForm stage="independent" draft={draft} setDraft={setDraft} feedback={feedback} busy={busy} onSubmit={() => void submit()} onContinue={continueAfterSave} />
            </>
          ) : null}

          {screen === 'mastery' ? (
            <>
              <p className="technology-preview__kicker">Fresh mastery · full debugging cycle</p>
              <h1 id="technology-preview-heading" ref={headingRef} tabIndex={-1}>{experience.mastery_debug.title}</h1>
              <CodeBlock code={experience.mastery_debug.starter_code} label="Protected mastery starter code" />
              <div className="technology-preview__symptom"><strong>Observed symptom</strong><p>{experience.mastery_debug.observed_symptom}</p></div>
              <h2>Specification</h2><BulletList items={experience.mastery_debug.specification} />
              <h2>Public tests</h2><StringTestList tests={experience.mastery_debug.public_tests} />
              <h2>Required defect log</h2><BulletList items={experience.mastery_debug.debug_log_template} />
              <button type="button" className="technology-preview__secondary" aria-expanded={hintOpen} onClick={() => setHintOpen((open) => !open)}>{hintOpen ? 'Close permitted cue' : 'Use permitted evidence cue'}</button>
              {hintOpen ? <div className="technology-preview__hint" role="note"><p><strong>Ceiling: {experience.mastery_debug.hint_ceiling.replaceAll('_', ' ').toLowerCase()}.</strong> {experience.mastery_debug.available_hint}</p><p>This cue identifies evidence to inspect; it does not name the passing change.</p></div> : null}
              <EvidenceForm stage="mastery" draft={draft} setDraft={setDraft} feedback={feedback} busy={busy} onSubmit={() => void submit()} onContinue={continueAfterSave} />
            </>
          ) : null}

          {screen === 'decision' ? (
            <>
              <p className="technology-preview__kicker">Evidence saved · no automated correctness claim</p>
              <h1 id="technology-preview-heading" ref={headingRef} tabIndex={-1}>Choose what happens before trusted review</h1>
              <p className="technology-preview__lead">Your independent records are saved. If your reasoning felt complete, finish for rubric review. If you noticed a specific gap, choose the matching different explanation and then complete a fresh check.</p>
              <button type="button" className="technology-preview__primary" onClick={() => move('complete')}>Finish for trusted review</button>
              <div className="technology-preview__route-grid">{experience.remediation_routes.map((candidate) => <article key={candidate.trigger_id}><p className="technology-preview__route-signal">{candidate.learner_signal}</p><h2>{candidate.title}</h2><button type="button" className="technology-preview__secondary" onClick={() => { setRoute(candidate); move('remediation') }}>Use this explanation</button></article>)}</div>
            </>
          ) : null}

          {screen === 'remediation' && route ? (
            <>
              <p className="technology-preview__kicker">Targeted remediation · original solution still protected</p>
              <h1 id="technology-preview-heading" ref={headingRef} tabIndex={-1}>{route.title}</h1>
              <p className="technology-preview__lead">{route.alternate_teaching}</p>
              <section className="technology-preview__practice-card"><h2>Analogous practice</h2><p>{route.analogue_task}</p></section>
              <section className="technology-preview__contrast"><h2>Contrast the reasoning</h2><p>{route.contrast_check}</p></section>
              <div className="technology-preview__protected-note"><strong>Answer boundary preserved:</strong> this explanation does not reveal the original mastery repair. The next response uses a new algorithm structure and defect family.</div>
              <button type="button" className="technology-preview__primary" onClick={() => move('fresh')}>Open the fresh independent check</button>
            </>
          ) : null}

          {screen === 'fresh' ? (
            <>
              <p className="technology-preview__kicker">Fresh evidence after a different explanation</p>
              <h1 id="technology-preview-heading" ref={headingRef} tabIndex={-1}>{experience.fresh_mastery_check.title}</h1>
              <CodeBlock code={experience.fresh_mastery_check.starter_code} label="Fresh protected starter code" />
              <div className="technology-preview__symptom"><strong>Specification</strong><p>{experience.fresh_mastery_check.specification}</p><strong>Observed symptom</strong><p>{experience.fresh_mastery_check.observed_symptom}</p></div>
              <h2>Public tests</h2><StringTestList tests={experience.fresh_mastery_check.public_tests} />
              <p>{experience.fresh_mastery_check.evidence_requirements}</p>
              <details className="technology-preview__cue"><summary>Clarify the support limit</summary><p>Only term or instruction clarification is available. The decisive state update and completed repair remain withheld.</p></details>
              <EvidenceForm stage="fresh" draft={draft} setDraft={setDraft} feedback={feedback} busy={busy} onSubmit={() => void submit()} onContinue={continueAfterSave} />
            </>
          ) : null}

          {screen === 'complete' ? (
            <>
              <p className="technology-preview__kicker">Lesson record complete</p>
              <h1 id="technology-preview-heading" ref={headingRef} tabIndex={-1}>Saved for trusted rubric review</h1>
              <p className="technology-preview__lead">This preview does not auto-score or claim mastery. A trusted adult reviews the independent code/pseudocode, traces, invariant arguments, debugging cycle, verification, and trade-off reasoning.</p>
              <div className="technology-preview__complete-grid">
                <section><h2>What is saved</h2><p>Your responses remain in an isolated Director-review IndexedDB on this device.</p></section>
                <section><h2>What stays protected</h2><p>Exact target repairs, restricted checks, accepted traces, and answer-bearing scoring guidance never enter this learner bundle.</p></section>
                <section><h2>Safety state</h2><p>No account, upload, network request, personal data, credential, microphone, camera, or live system was required.</p></section>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}
