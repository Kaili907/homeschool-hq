import { useEffect, useMemo, useRef, useState } from 'react'
import {
  artsMusicDirectorLesson as lesson,
  artsMusicDirectorScoring as scoring,
  artsMusicVisualHierarchyModelUrl,
  workBlock,
} from './lesson'
import './arts-music-director-preview.css'

const STAGES = [
  { id: 'overview', short: 'Start', label: 'Studio brief' },
  { id: 'learn', short: 'Learn', label: 'How hierarchy works' },
  { id: 'model', short: 'Model', label: 'See decisions develop' },
  { id: 'guided', short: 'Try', label: 'Guided placement study' },
  { id: 'create', short: 'Create', label: 'Independent composition' },
  { id: 'reflect', short: 'Reflect', label: 'Trace your decisions' },
  { id: 'critique', short: 'Critique', label: 'Evidence before advice' },
  { id: 'check', short: 'Check', label: 'Explain the mechanism' },
  { id: 'rubric', short: 'Rubric', label: 'How this work is read' },
  { id: 'retry', short: 'Retry', label: 'Focused repair routes' },
] as const

type StageId = typeof STAGES[number]['id']

const guided = workBlock('GUIDED_PRACTICE')
const independent = workBlock('INDEPENDENT_CREATION')
const reflection = workBlock('REFLECTION')
const critique = workBlock('CRITIQUE')
const knowledgeCheck = workBlock('KNOWLEDGE_CHECK')

function CheckList({ items, tone = 'ink' }: { readonly items: readonly string[]; readonly tone?: 'ink' | 'cream' }) {
  return (
    <ul className={`am-check-list am-check-list--${tone}`}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function NoteField({
  id,
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly rows?: number
  readonly placeholder?: string
}) {
  return (
    <label className="am-field" htmlFor={id}>
      <span>{label}</span>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function StageHeader({ eyebrow, title, intro }: { readonly eyebrow: string; readonly title: string; readonly intro: string }) {
  return (
    <header className="am-stage-header">
      <p>{eyebrow}</p>
      <h1 tabIndex={-1}>{title}</h1>
      <p className="am-stage-intro">{intro}</p>
    </header>
  )
}

export function ArtsMusicDirectorPreview() {
  const [stageId, setStageId] = useState<StageId>('overview')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [cueOpen, setCueOpen] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const headingContainer = useRef<HTMLElement>(null)
  const stageIndex = STAGES.findIndex((stage) => stage.id === stageId)
  const stage = STAGES[stageIndex]

  useEffect(() => {
    headingContainer.current?.querySelector<HTMLHeadingElement>('h1')?.focus()
    setSavedMessage('')
  }, [stageId])

  const completedNotes = useMemo(
    () => Object.values(notes).filter((value) => value.trim()).length,
    [notes],
  )
  const updateNote = (id: string, value: string) => setNotes((current) => ({ ...current, [id]: value }))
  const go = (id: StageId) => setStageId(id)
  const next = () => setStageId(STAGES[Math.min(stageIndex + 1, STAGES.length - 1)].id)
  const previous = () => setStageId(STAGES[Math.max(stageIndex - 1, 0)].id)

  return (
    <div className="am-preview-shell" data-director-preview="arts-music-r1">
      <a className="am-skip-link" href="#am-lesson-stage">Skip to lesson stage</a>
      <header className="am-topbar">
        <div className="am-brand">
          <span aria-hidden="true">M</span>
          <div>
            <p>Manuel Academy</p>
            <strong>Studio</strong>
          </div>
        </div>
        <div className="am-review-badge">
          <span aria-hidden="true" />
          Director review · R1 sample
        </div>
      </header>

      <div className="am-layout">
        <aside className="am-sidebar" aria-label="Lesson stages">
          <div className="am-lesson-meta">
            <p>Grade 9 · Visual art</p>
            <h2>Build a visual path</h2>
            <span>{lesson.estimated_minutes} · formative</span>
          </div>
          <nav>
            <ol>
              {STAGES.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={stageId === item.id ? 'is-current' : ''}
                    aria-current={stageId === item.id ? 'step' : undefined}
                    onClick={() => go(item.id)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div><strong>{item.short}</strong><small>{item.label}</small></div>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <p className="am-draft-status"><strong>{completedNotes}</strong> note{completedNotes === 1 ? '' : 's'} in this tab</p>
        </aside>

        <main id="am-lesson-stage" className="am-main" ref={headingContainer}>
          <div className="am-mobile-progress" aria-label={`Stage ${stageIndex + 1} of ${STAGES.length}`}>
            <span style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }} />
          </div>
          <p className="am-stage-count">Stage {stageIndex + 1} of {STAGES.length} · {stage.short}</p>

          {stageId === 'overview' ? (
            <>
              <StageHeader
                eyebrow="Studio brief"
                title="Build a visual path"
                intro="Direct attention through an original composition, then test whether the route you intended is the route the work actually creates."
              />
              <section className="am-question-card">
                <p>Essential question</p>
                <blockquote>{lesson.essential_question}</blockquote>
              </section>
              <div className="am-two-column">
                <section className="am-panel">
                  <p className="am-kicker">Learning goal</p>
                  <h2>Make relationships intentional</h2>
                  <p>{lesson.r1_sample.learning_goal}</p>
                  <div className="am-callout am-callout--choice">
                    <strong>Your choices stay yours.</strong>
                    <p>Your subject, style, medium, mood, focal point, and final revision can differ from the model. Difference is not an error.</p>
                  </div>
                </section>
                <section className="am-panel">
                  <p className="am-kicker">Materials</p>
                  <h2>Start with what you have</h2>
                  <CheckList items={lesson.materials} />
                </section>
              </div>
              <details className="am-details">
                <summary>Privacy and access routes</summary>
                <p>{lesson.presentation_and_privacy.presentation_options}</p>
                <p>{lesson.presentation_and_privacy.text_or_no_audio_alternative}</p>
              </details>
            </>
          ) : null}

          {stageId === 'learn' ? (
            <>
              <StageHeader
                eyebrow="Concept instruction"
                title="Hierarchy is a relationship"
                intro="Visual hierarchy is the order in which a composition invites attention. It comes from differences among parts—not from one universally important shape."
              />
              <div className="am-teaching-grid">
                {lesson.r1_sample.concept_instruction.map((block, index) => (
                  <article className="am-teaching-card" key={block.id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <h2>{block.title}</h2>
                    <p>{block.body}</p>
                  </article>
                ))}
              </div>
              <section className="am-vocabulary" aria-labelledby="am-vocabulary-title">
                <p className="am-kicker">Working vocabulary</p>
                <h2 id="am-vocabulary-title">Words you will use while making</h2>
                <dl>
                  {lesson.r1_sample.vocabulary.map((entry) => (
                    <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.definition}</dd></div>
                  ))}
                </dl>
              </section>
            </>
          ) : null}

          {stageId === 'model' ? (
            <>
              <StageHeader
                eyebrow="Academy-original worked example"
                title="See three decisions develop"
                intro="The model begins with an unclear first stop, builds emphasis through relationships, and then adds a route. It is one possible solution—not a template to copy."
              />
              <figure className="am-model">
                <img
                  src={artsMusicVisualHierarchyModelUrl}
                  alt="Three panels show a circle, striped rectangle, and triangle. Equal visual weight becomes a small isolated dark circle first, a central striped rectangle second, and a large pale triangle third. An alternate panel makes the triangle first to show valid variation."
                />
                <figcaption>
                  <strong>Three Stops</strong> · Manuel Academy original · CC BY 4.0
                  <span className="am-model-scroll-cue">Swipe or scroll sideways to inspect every panel.</span>
                </figcaption>
              </figure>
              <details className="am-details" data-testid="accessible-model-description">
                <summary>Read the complete visual and tactile description</summary>
                <p>{lesson.sourceReference}</p>
              </details>
              <section className="am-sequence">
                <p className="am-kicker">Technique sequence</p>
                <h2>From intention to test</h2>
                <ol>
                  {lesson.r1_sample.technique_sequence.map((item) => (
                    <li key={item.step}>
                      <span>{item.step}</span>
                      <div><h3>{item.action}</h3><p><strong>Notice:</strong> {item.notice}</p><p><strong>Why:</strong> {item.why}</p></div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          ) : null}

          {stageId === 'guided' ? (
            <>
              <StageHeader eyebrow="Guided skill work · about 10 minutes" title={guided.title} intro={guided.prompt ?? ''} />
              <section className="am-panel am-panel--studio">
                <div className="am-constraint-row"><strong>Keep fixed</strong><span>same three forms · similar size · similar value</span></div>
                <div className="am-constraint-row"><strong>You choose</strong><span>{guided.bounded_choice}</span></div>
                <div className="am-constraint-row"><strong>Look for</strong><span>{guided.observable_criterion}</span></div>
              </section>
              <div className="am-callout">
                <strong>Attempt before the cue</strong>
                <p>{guided.attempt_before_support}</p>
              </div>
              <NoteField
                id="guided-notice"
                label="What arrived first in A and B? Cite spacing or placement."
                value={notes['guided-notice'] ?? ''}
                onChange={(value) => updateNote('guided-notice', value)}
                placeholder="In A, I noticed… In B, the isolated…"
              />
              <button type="button" className="am-text-button" aria-expanded={cueOpen} onClick={() => setCueOpen((open) => !open)}>
                {cueOpen ? 'Hide placement cue' : 'Open a placement cue after your attempt'}
              </button>
              {cueOpen ? <div className="am-cue" role="note"><strong>Placement cue</strong><p>{guided.optional_cue}</p></div> : null}
              <p className="am-fade-note"><strong>Before independent work:</strong> {guided.support_fade}</p>
            </>
          ) : null}

          {stageId === 'create' ? (
            <>
              <StageHeader eyebrow="Independent creation · about 25 minutes" title={independent.title} intro={independent.prompt ?? ''} />
              <div className="am-two-column am-two-column--create">
                <section className="am-panel">
                  <p className="am-kicker">Non-negotiable evidence</p>
                  <h2>What the study must show</h2>
                  <CheckList items={independent.objective_constraints ?? []} />
                </section>
                <section className="am-panel am-panel--dark">
                  <p className="am-kicker">Creative authority</p>
                  <h2>What remains your choice</h2>
                  <CheckList items={independent.learner_owned_choices ?? []} tone="cream" />
                </section>
              </div>
              <section className="am-planner">
                <h2>Set intent before developing the study</h2>
                <div className="am-planner-grid">
                  <NoteField id="intent" label="Intended first → second → third stops" value={notes.intent ?? ''} onChange={(value) => updateNote('intent', value)} rows={3} />
                  <NoteField id="variables" label="Two or more hierarchy variables you will test" value={notes.variables ?? ''} onChange={(value) => updateNote('variables', value)} rows={3} />
                  <NoteField id="intermediate" label="Where you preserved the intermediate state" value={notes.intermediate ?? ''} onChange={(value) => updateNote('intermediate', value)} rows={3} />
                  <NoteField id="path-check" label="Three-second path check: what arrived first, then next?" value={notes['path-check'] ?? ''} onChange={(value) => updateNote('path-check', value)} rows={3} />
                </div>
                <NoteField id="revision" label="Your revision decision and evidence: change, keep, or revise the intent" value={notes.revision ?? ''} onChange={(value) => updateNote('revision', value)} rows={4} />
              </section>
              <p className="am-support-note"><strong>Support still permitted:</strong> {independent.permitted_support}</p>
            </>
          ) : null}

          {stageId === 'reflect' ? (
            <>
              <StageHeader eyebrow="Reflection · about 6 minutes" title={reflection.title} intro="Use your actual work and process record. Reflection can identify success, uncertainty, or a next test; praise is not required." />
              <div className="am-prompt-stack">
                {(reflection.prompts ?? []).map((prompt, index) => (
                  <NoteField key={prompt} id={`reflection-${index}`} label={`${index + 1}. ${prompt}`} value={notes[`reflection-${index}`] ?? ''} onChange={(value) => updateNote(`reflection-${index}`, value)} />
                ))}
              </div>
            </>
          ) : null}

          {stageId === 'critique' ? (
            <>
              <StageHeader eyebrow="Private critique · about 6 minutes" title={critique.title} intro="Critique observable evidence against intention. It does not rank taste, prescribe style, or transfer authorship." />
              <section className="am-sequence am-sequence--compact">
                <ol>
                  {(critique.protocol ?? []).map((item, index) => <li key={item}><span>{index + 1}</span><div><p>{item}</p></div></li>)}
                </ol>
              </section>
              <div className="am-callout am-callout--choice"><strong>Full-credit private route</strong><p>{critique.private_route}</p></div>
              <NoteField id="critique-note" label="Evidence-based critique note" value={notes['critique-note'] ?? ''} onChange={(value) => updateNote('critique-note', value)} placeholder="I first notice… because… Compared with the intended path… One question I have… Two options are…" rows={7} />
            </>
          ) : null}

          {stageId === 'check' ? (
            <>
              <StageHeader eyebrow="Concept check · about 4 minutes" title={knowledgeCheck.title} intro={knowledgeCheck.note ?? ''} />
              <div className="am-prompt-stack">
                {(knowledgeCheck.prompts ?? []).map((prompt, index) => (
                  <NoteField key={prompt} id={`check-${index}`} label={`${index + 1}. ${prompt}`} value={notes[`check-${index}`] ?? ''} onChange={(value) => updateNote(`check-${index}`, value)} />
                ))}
              </div>
              <div className="am-callout"><strong>No instant right/wrong label</strong><p>These responses are saved as evidence for criteria-based review. More than one supported answer can be valid.</p></div>
            </>
          ) : null}

          {stageId === 'rubric' ? (
            <>
              <StageHeader eyebrow="Clear scoring authority" title="The rubric reads evidence, not taste" intro="Objective constraints are checked for presence. Judgment-based dimensions use observable anchors and accept legitimate variation." />
              <div className="am-rubric-key">
                <span><i className="is-objective" /> Objective</span>
                <span><i className="is-judgment" /> Judgment-based</span>
              </div>
              <div className="am-rubric">
                {scoring.rubric.map((row) => (
                  <details key={row.dimension} open={row.dimension === 'Visual-hierarchy evidence'}>
                    <summary><span className={row.criterion_kind === 'OBJECTIVE' ? 'is-objective' : 'is-judgment'}>{row.criterion_kind === 'OBJECTIVE' ? 'Objective' : 'Judgment-based'}</span>{row.dimension}</summary>
                    <dl>
                      <div><dt>Exceeds</dt><dd>{row.exceeds}</dd></div>
                      <div><dt>Meets</dt><dd>{row.meets}</dd></div>
                      <div><dt>Developing</dt><dd>{row.developing}</dd></div>
                      <div><dt>Beginning</dt><dd>{row.beginning}</dd></div>
                    </dl>
                  </details>
                ))}
              </div>
              <section className="am-variation">
                <p className="am-kicker">Legitimate variation</p>
                <h2>These differences are not mistakes</h2>
                <CheckList items={scoring.legitimate_variation} />
              </section>
            </>
          ) : null}

          {stageId === 'retry' ? (
            <>
              <StageHeader eyebrow="Appropriate remediation" title="Repair one observable mismatch" intro="A retry uses different instruction and fresh evidence. It is never assigned because a reviewer dislikes the style or because the work differs from the model." />
              <div className="am-callout am-callout--choice"><strong>No repair is needed when…</strong><p>The visual path is clear but different from the example, or the learner supports an intentionally subtle, ambiguous, or distributed hierarchy with evidence.</p></div>
              <div className="am-retry-grid">
                {lesson.r1_sample.remediation_paths.map((path, index) => (
                  <article className="am-retry-card" key={path.ref}>
                    <p>Repair route {index + 1}</p>
                    <h2>{index === 0 ? 'When every area competes' : 'When another area arrives first'}</h2>
                    <dl>
                      <div><dt>Different explanation</dt><dd>{path.different_instruction}</dd></div>
                      <div><dt>Small supported attempt</dt><dd>{path.supported_attempt}</dd></div>
                      <div><dt>Self-noticing cue</dt><dd>{path.self_noticing_cue}</dd></div>
                      <div><dt>Fresh retry</dt><dd>{path.fresh_retry}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
              <NoteField id="retry-evidence" label="If you used a repair route: what changed in the fresh check?" value={notes['retry-evidence'] ?? ''} onChange={(value) => updateNote('retry-evidence', value)} />
            </>
          ) : null}

          <footer className="am-stage-footer">
            <button type="button" className="am-button am-button--quiet" onClick={previous} disabled={stageIndex === 0}>Previous</button>
            <p aria-live="polite">{savedMessage}</p>
            {stageIndex < STAGES.length - 1 ? (
              <button type="button" className="am-button" onClick={next}>Continue to {STAGES[stageIndex + 1].short}</button>
            ) : (
              <button type="button" className="am-button" onClick={() => setSavedMessage('Review notes are ready in this tab. No mastery claim was made.')}>Finish preview review</button>
            )}
          </footer>
        </main>
      </div>
    </div>
  )
}
