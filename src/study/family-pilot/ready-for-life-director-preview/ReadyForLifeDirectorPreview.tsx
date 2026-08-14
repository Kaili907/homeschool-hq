import { useEffect, useMemo, useRef, useState } from 'react'
import { countCompleteReadyForLifeSceneEvidence, READY_FOR_LIFE_SAMPLE, READY_FOR_LIFE_SAMPLE_STAGES } from './sample'
import type { ReadyForLifeRisk, ReadyForLifeStageId } from './types'
import './readyForLifeDirectorPreview.css'

type TaskPath = 'home' | 'simulation'

const DIRECTOR_CHECKS = Object.freeze([
  'Practical goal and local authority are explicit',
  'Every named learner resource is embedded',
  'Model shows actions, reasoning, and a criteria check',
  'Guided attempt includes feedback, correction, and release',
  'Real task and equal-credit simulation are both runnable',
  'Evidence is observable and minimally sensitive',
  'Retry closes with a parallel reattempt and return path',
  'Active, elapsed, adult, and simulation time are honest',
  'Guardian alone certifies the physical Home Check',
  'Tutor coaching stops at permission and certification',
])

const GUIDED_CORRECT_ID = 'point-name-ask'

function RiskStrip() {
  return (
    <div className="rfl-preview__risk-strip" aria-label="Risk word guide">
      {READY_FOR_LIFE_SAMPLE.riskWords.map((risk) => (
        <article className="rfl-preview__risk-card" key={risk.value}>
          <span aria-hidden="true">{risk.value === 'safe-or-unsure' ? '?' : risk.label.slice(0, 1)}</span>
          <div><strong>{risk.label}</strong><small>{risk.cue}</small></div>
        </article>
      ))}
    </div>
  )
}

function BoundaryNotice({ compact = false }: { readonly compact?: boolean }) {
  return (
    <aside className={`rfl-preview__boundary${compact ? ' rfl-preview__boundary--compact' : ''}`}>
      <span className="rfl-preview__boundary-icon" aria-hidden="true">◆</span>
      <div>
        <strong>Physical completion needs a guardian.</strong>
        <p>Jarvis may coach the lesson. It cannot give household permission, observe the space, move an item, or certify that the Home Check happened.</p>
      </div>
    </aside>
  )
}

function StageShell({
  eyebrow,
  title,
  children,
  headingRef,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly children: React.ReactNode
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>
}) {
  return (
    <section className="rfl-preview__lesson-card" aria-labelledby="rfl-stage-heading">
      <p className="rfl-preview__eyebrow">{eyebrow}</p>
      <h1 id="rfl-stage-heading" ref={headingRef} tabIndex={-1}>{title}</h1>
      {children}
    </section>
  )
}

export function ReadyForLifeDirectorPreview() {
  const lesson = READY_FOR_LIFE_SAMPLE
  const [stage, setStage] = useState<ReadyForLifeStageId>('goal')
  const [guidedChoice, setGuidedChoice] = useState('')
  const [showCorrection, setShowCorrection] = useState(false)
  const [correctionDecision, setCorrectionDecision] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [guidedCorrected, setGuidedCorrected] = useState(false)
  const [taskPath, setTaskPath] = useState<TaskPath>('simulation')
  const [homeChecks, setHomeChecks] = useState<Readonly<Record<string, boolean>>>({})
  const [sceneResponses, setSceneResponses] = useState<Readonly<Record<string, ReadyForLifeRisk | ''>>>({})
  const [sceneNotes, setSceneNotes] = useState<Readonly<Record<string, string>>>({})
  const [reflection, setReflection] = useState('')
  const [reflectionSaved, setReflectionSaved] = useState(false)
  const [guardianConfirmed, setGuardianConfirmed] = useState(false)
  const [guardianSignoff, setGuardianSignoff] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const currentIndex = READY_FOR_LIFE_SAMPLE_STAGES.findIndex((item) => item.id === stage)
  const guidedResult = lesson.guidedAttempt.choices.find((choice) => choice.id === guidedChoice)
  const selectedSceneCount = countCompleteReadyForLifeSceneEvidence(
    lesson.independentTask.simulationPath.scenes.map((scene) => scene.id),
    sceneResponses,
    sceneNotes,
  )
  const selectedHomeCount = Object.values(homeChecks).filter(Boolean).length
  const nextStage = READY_FOR_LIFE_SAMPLE_STAGES[currentIndex + 1]
  const taskEvidenceReady = taskPath === 'simulation'
    ? selectedSceneCount === lesson.independentTask.simulationPath.scenes.length
    : selectedHomeCount === lesson.independentTask.realPath.checkpoints.length

  const stageSummary = useMemo(() => ({
    goal: true,
    model: true,
    guided: guidedCorrected,
    independent: taskEvidenceReady,
    evidence: reflectionSaved,
    retry: false,
    signoff: taskPath === 'simulation' ? taskEvidenceReady : guardianSignoff,
  }), [guidedCorrected, guardianSignoff, reflectionSaved, taskEvidenceReady, taskPath])

  useEffect(() => {
    headingRef.current?.focus()
  }, [stage])

  const openStage = (next: ReadyForLifeStageId) => setStage(next)

  const renderStage = () => {
    if (stage === 'goal') {
      return (
        <StageShell eyebrow="Step 1 · Get ready" title="Spot, stop, and ask" headingRef={headingRef}>
          <p className="rfl-preview__lead">{lesson.goal}</p>
          <div className="rfl-preview__meta-row">
            <span>Grade 3</span><span>30–40 active min</span><span>One session</span>
          </div>
          <h2>Your risk-word guide</h2>
          <RiskStrip />
          <h2>What you need</h2>
          <div className="rfl-preview__materials">
            {lesson.materials.map((material) => (
              <article key={material.id}>
                <span className={`rfl-preview__tag rfl-preview__tag--${material.delivery}`}>{material.delivery === 'embedded' ? 'On this page' : 'Home Check only'}</span>
                <h3>{material.label}</h3>
                <p>{material.usedFor}</p>
              </article>
            ))}
          </div>
          <BoundaryNotice />
        </StageShell>
      )
    }

    if (stage === 'model') {
      return (
        <StageShell eyebrow="Step 2 · Watch" title={lesson.model.title} headingRef={headingRef}>
          <div className="rfl-preview__scene rfl-preview__scene--model">
            <div className="rfl-preview__scene-art" aria-hidden="true"><span>lamp</span><i /><b>walking path</b></div>
            <div><span className="rfl-preview__tag">Sample picture</span><p>{lesson.model.startingCondition}</p></div>
          </div>
          <ol className="rfl-preview__model-steps">
            {lesson.model.actions.map((action) => <li key={action.label}><strong>{action.label}</strong><p>{action.detail}</p></li>)}
          </ol>
          <div className="rfl-preview__criteria"><strong>Check the model</strong><p>{lesson.model.criteriaCheck}</p></div>
        </StageShell>
      )
    }

    if (stage === 'guided') {
      return (
        <StageShell eyebrow="Step 3 · Try together" title={lesson.guidedAttempt.title} headingRef={headingRef}>
          <div className="rfl-preview__scene">
            <div className="rfl-preview__scene-art rfl-preview__scene-art--bottle" aria-hidden="true"><span>?</span></div>
            <div><span className="rfl-preview__tag">Coach card</span><p>{lesson.guidedAttempt.scenario}</p></div>
          </div>
          <fieldset className="rfl-preview__choices">
            <legend>{lesson.guidedAttempt.prompt}</legend>
            {lesson.guidedAttempt.choices.map((choice) => (
              <label key={choice.id}>
                <input type="radio" name="guided-choice" value={choice.id} checked={guidedChoice === choice.id} onChange={() => { setGuidedChoice(choice.id); setShowCorrection(false); setCorrectionDecision(''); setCorrectionReason(''); setGuidedCorrected(false) }} />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          {guidedResult ? (
            <div className={`rfl-preview__feedback${guidedResult.releasesLearner ? ' rfl-preview__feedback--ready' : ''}`} role="status">
              <strong>{guidedResult.releasesLearner ? 'Good safety reasoning.' : 'Pause and adjust.'}</strong>
              <p>{guidedResult.feedback}</p>
              {guidedChoice === GUIDED_CORRECT_ID && !showCorrection ? <button type="button" className="rfl-preview__primary" onClick={() => setShowCorrection(true)}>Try the fresh card</button> : null}
            </div>
          ) : null}
          {showCorrection ? (
            <div className="rfl-preview__fresh-turn">
              <span aria-hidden="true">{guidedCorrected ? '✓' : '2'}</span>
              <div>
                <strong>Correction turn</strong>
                <p>{lesson.guidedAttempt.correctionTurn}</p>
                <fieldset>
                  <legend>Your decision</legend>
                  <label><input type="radio" name="correction-decision" value="safe" checked={correctionDecision === 'safe'} onChange={() => { setCorrectionDecision('safe'); setGuidedCorrected(false) }} /> Safe in this picture</label>
                  <label><input type="radio" name="correction-decision" value="unsure" checked={correctionDecision === 'unsure'} onChange={() => { setCorrectionDecision('unsure'); setGuidedCorrected(false) }} /> I am not sure, so I would ask</label>
                </fieldset>
                <label className="rfl-preview__short-field" htmlFor="guided-correction-reason">Give one risk-based reason</label>
                <input id="guided-correction-reason" type="text" value={correctionReason} onChange={(event) => { setCorrectionReason(event.target.value); setGuidedCorrected(false) }} />
                {!guidedCorrected ? <button type="button" className="rfl-preview__primary" disabled={!correctionDecision || correctionReason.trim().length < 8} onClick={() => setGuidedCorrected(true)}>Finish correction turn</button> : <small role="status">{lesson.guidedAttempt.releaseCondition}</small>}
              </div>
            </div>
          ) : null}
        </StageShell>
      )
    }

    if (stage === 'independent') {
      const real = lesson.independentTask.realPath
      const simulation = lesson.independentTask.simulationPath
      return (
        <StageShell eyebrow="Step 4 · Your turn" title="Choose one equal-credit path" headingRef={headingRef}>
          <div className="rfl-preview__path-picker" role="group" aria-label="Independent task path">
            <button type="button" aria-pressed={taskPath === 'simulation'} onClick={() => setTaskPath('simulation')}><span>Works anywhere</span><strong>Scene Check</strong><small>No home details. No adult needed.</small></button>
            <button type="button" aria-pressed={taskPath === 'home'} onClick={() => setTaskPath('home')}><span>Guardian required</span><strong>Home Check</strong><small>Adult chooses, stays, and handles.</small></button>
          </div>
          {taskPath === 'simulation' ? (
            <div>
              <div className="rfl-preview__path-intro"><span className="rfl-preview__tag">Equal credit</span><h2>{simulation.title}</h2><p>{simulation.directions}</p></div>
              <div className="rfl-preview__scene-grid">
                {simulation.scenes.map((scene, index) => (
                  <article key={scene.id}>
                    <div><span>{String(index + 1).padStart(2, '0')}</span><h3>{scene.title}</h3></div>
                    <p>{scene.description}</p>
                    <label htmlFor={`${scene.id}-risk`}>Choose a risk or safe/unsure</label>
                    <select id={`${scene.id}-risk`} value={sceneResponses[scene.id] ?? ''} onChange={(event) => setSceneResponses((current) => ({ ...current, [scene.id]: event.target.value as ReadyForLifeRisk }))}>
                      <option value="">Choose one…</option>
                      {lesson.riskWords.map((risk) => <option key={risk.value} value={risk.value}>{risk.label}</option>)}
                    </select>
                    <label htmlFor={`${scene.id}-note`}>Reason and safe next move</label>
                    <textarea id={`${scene.id}-note`} rows={2} value={sceneNotes[scene.id] ?? ''} onChange={(event) => setSceneNotes((current) => ({ ...current, [scene.id]: event.target.value }))} placeholder="Because… I would…" />
                  </article>
                ))}
              </div>
              <p className="rfl-preview__completion-note"><strong>{selectedSceneCount} of {simulation.scenes.length} scenes recorded.</strong> {simulation.completionCondition}</p>
            </div>
          ) : (
            <div>
              <div className="rfl-preview__path-intro"><span className="rfl-preview__tag rfl-preview__tag--adult-local">Guardian required</span><h2>{real.title}</h2><p>{real.permissionRule}</p></div>
              <BoundaryNotice compact />
              <ol className="rfl-preview__plain-steps">{real.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              <fieldset className="rfl-preview__home-checks">
                <legend>Learner process record <small>Self-report only; this does not certify the walkthrough.</small></legend>
                {real.checkpoints.map((checkpoint) => (
                  <label key={checkpoint}><input type="checkbox" checked={Boolean(homeChecks[checkpoint])} onChange={(event) => setHomeChecks((current) => ({ ...current, [checkpoint]: event.target.checked }))} /><span>{checkpoint}</span></label>
                ))}
              </fieldset>
              <p className="rfl-preview__completion-note"><strong>{selectedHomeCount} of {real.checkpoints.length} checks recorded.</strong> {real.completionCondition}</p>
            </div>
          )}
        </StageShell>
      )
    }

    if (stage === 'evidence') {
      return (
        <StageShell eyebrow="Step 5 · Show it" title="Use small, useful evidence" headingRef={headingRef}>
          <div className="rfl-preview__evidence-grid">
            <article><span>01</span><h2>Process record</h2><p>{lesson.evidence.learnerEvidence[0]}</p></article>
            <article><span>02</span><h2>Short reflection</h2><p>{lesson.evidence.learnerEvidence[1]}</p></article>
            <article><span>03</span><h2>Physical event</h2><p>{lesson.evidence.learnerEvidence[2]}</p></article>
          </div>
          <div className="rfl-preview__reflection">
            <label htmlFor="rfl-reflection">Your reflection</label>
            <p>{lesson.evidence.reflectionPrompt}</p>
            <textarea id="rfl-reflection" rows={5} value={reflection} onChange={(event) => { setReflection(event.target.value); setReflectionSaved(false) }} placeholder="Write two or three careful sentences…" />
            <button type="button" className="rfl-preview__primary" disabled={reflection.trim().length < 12} onClick={() => setReflectionSaved(true)}>{reflectionSaved ? 'Reflection saved' : 'Save reflection'}</button>
          </div>
          <details className="rfl-preview__privacy"><summary>Privacy check</summary><p>Do not submit: {lesson.evidence.doNotCollect.join(', ')}.</p></details>
        </StageShell>
      )
    }

    if (stage === 'retry') {
      return (
        <StageShell eyebrow="Step 6 · Try again" title="A retry has a way back" headingRef={headingRef}>
          <p className="rfl-preview__lead rfl-preview__lead--small">A missed step is information. It is not a character judgment.</p>
          <ol className="rfl-preview__retry-loop">
            <li><span>1</span><div><strong>Trigger</strong><p>{lesson.retry.trigger}</p></div></li>
            <li><span>2</span><div><strong>Reteach with a contrast</strong><p>{lesson.retry.targetedReteach}</p></div></li>
            <li><span>3</span><div><strong>Supported reattempt</strong><p>{lesson.retry.supportedReattempt}</p></div></li>
            <li><span>4</span><div><strong>Feedback</strong><p>{lesson.retry.feedback}</p></div></li>
            <li><span>5</span><div><strong>Parallel reattempt</strong><p>{lesson.retry.parallelReattempt}</p></div></li>
            <li><span>6</span><div><strong>Exit and return</strong><p>{lesson.retry.exitCriterion} {lesson.retry.returnPath}</p></div></li>
          </ol>
        </StageShell>
      )
    }

    return (
      <StageShell eyebrow="Step 7 · Finish" title="Use the right completion authority" headingRef={headingRef}>
        {taskPath === 'simulation' ? (
          <div className="rfl-preview__simulation-finish">
            <span aria-hidden="true">✓</span>
            <div><h2>Scene Check selected</h2><p>No physical home action is claimed. The learner can submit the six invented-scene responses and reflection for human review without guardian attestation.</p><strong>{taskEvidenceReady ? 'Simulation evidence is ready for review.' : `Complete ${lesson.independentTask.simulationPath.scenes.length - selectedSceneCount} more scene response(s).`}</strong></div>
          </div>
        ) : (
          <div className="rfl-preview__signoff">
            <span className="rfl-preview__tag rfl-preview__tag--adult-local">Adult-only preview</span>
            <h2>Guardian Home Check attestation</h2>
            <p>This minimal record certifies only the physical event and safety boundary. It does not score the learner’s reflection, effort, character, or overall mastery.</p>
            <ul>{lesson.completion.minimumGuardianEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
            <label className="rfl-preview__guardian-confirm"><input type="checkbox" checked={guardianConfirmed} onChange={(event) => { setGuardianConfirmed(event.target.checked); setGuardianSignoff(false) }} /><span>I am the household-authorized guardian who gave permission and observed this Home Check.</span></label>
            <button type="button" className="rfl-preview__primary" disabled={!guardianConfirmed || !taskEvidenceReady} onClick={() => setGuardianSignoff(true)}>Record preview signoff</button>
            {guardianSignoff ? <p className="rfl-preview__signed" role="status"><strong>Preview signoff recorded.</strong> No identifying proof or production record was created.</p> : null}
          </div>
        )}
        <BoundaryNotice />
        <div className="rfl-preview__tutor-card"><span>J</span><div><strong>Jarvis coaching boundary</strong><p>{lesson.tutor.completionAuthority}</p><small>{lesson.tutor.guardianHandoff}</small></div></div>
      </StageShell>
    )
  }

  return (
    <main className="rfl-preview">
      <header className="rfl-preview__topbar">
        <div className="rfl-preview__brand"><span aria-hidden="true">MA</span><div><strong>Manuel Academy</strong><small>Ready for Life · Director sample R1</small></div></div>
        <div className="rfl-preview__local"><span>Local composition</span><small>No state authority claimed</small></div>
      </header>

      <div className="rfl-preview__layout">
        <aside className="rfl-preview__director-rail">
          <div className="rfl-preview__lesson-id"><span>Representative lesson</span><strong>{lesson.identity.lessonId}</strong><small>Grade 3 · Unit 1 · Application</small></div>
          <nav aria-label="Ready for Life lesson stages">
            {READY_FOR_LIFE_SAMPLE_STAGES.map((item, index) => (
              <button type="button" key={item.id} className={stage === item.id ? 'is-current' : ''} aria-current={stage === item.id ? 'step' : undefined} onClick={() => openStage(item.id)}>
                <span>{stageSummary[item.id] ? '✓' : index + 1}</span><div><strong>{item.shortLabel}</strong><small>{item.label}</small></div>
              </button>
            ))}
          </nav>
          <details className="rfl-preview__director-checks" open>
            <summary>Director gate <span>10/10 shown</span></summary>
            <ul>{DIRECTOR_CHECKS.map((check) => <li key={check}><span aria-hidden="true">✓</span>{check}</li>)}</ul>
          </details>
        </aside>

        <div className="rfl-preview__workspace">
          <div className="rfl-preview__workspace-label"><span>Learner-safe preview</span><small>{currentIndex + 1} of {READY_FOR_LIFE_SAMPLE_STAGES.length}</small></div>
          {renderStage()}
          <nav className="rfl-preview__stage-actions" aria-label="Lesson stage controls">
            <button type="button" className="rfl-preview__secondary" disabled={currentIndex === 0} onClick={() => openStage(READY_FOR_LIFE_SAMPLE_STAGES[currentIndex - 1]!.id)}>Back</button>
            {nextStage ? <button type="button" className="rfl-preview__primary" onClick={() => openStage(nextStage.id)}>Continue to {nextStage.shortLabel}</button> : <button type="button" className="rfl-preview__primary" onClick={() => openStage('goal')}>Review from the start</button>}
          </nav>
        </div>
      </div>
    </main>
  )
}
