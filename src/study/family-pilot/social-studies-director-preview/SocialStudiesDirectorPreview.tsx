import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PREVIEW_SOURCES,
  PREVIEW_STAGES,
  RESPONSE_PROMPTS,
  SOCIAL_STUDIES_SAMPLE_CANONICAL_TITLE,
  SOCIAL_STUDIES_SAMPLE_DISPLAY_TITLE,
  SOCIAL_STUDIES_SAMPLE_LESSON_REF,
  TIMELINE,
  VOCABULARY,
  type PreviewSource,
  type PreviewStage,
} from './content'
import './SocialStudiesDirectorPreview.css'

const REVIEW_STORAGE_KEY = 'manuel-academy.director-review.social-studies-r1.responses'

type Responses = Readonly<Record<string, string>>

function readResponses(): Responses {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(REVIEW_STORAGE_KEY)
    return stored ? JSON.parse(stored) as Responses : {}
  } catch {
    return {}
  }
}

function SourceLink({ source }: { readonly source: PreviewSource }) {
  return (
    <a className="ss-preview__source-link" href={source.url} target="_blank" rel="noreferrer">
      Open canonical source <span aria-hidden="true">↗</span>
    </a>
  )
}

function SourceIdentity({ source }: { readonly source: PreviewSource }) {
  return (
    <div className="ss-preview__source-identity">
      <span className="ss-preview__source-label">{source.label}</span>
      <h2>{source.title}</h2>
      <dl>
        <div><dt>Creator</dt><dd>{source.creator}</dd></div>
        <div><dt>Date</dt><dd>{source.date}</dd></div>
        <div><dt>Repository</dt><dd>{source.repository}</dd></div>
        <div><dt>Source form</dt><dd>{source.form}</dd></div>
        <div><dt>Treatment</dt><dd>{source.treatment}</dd></div>
      </dl>
      <SourceLink source={source} />
    </div>
  )
}

function SourceQuote({ source }: { readonly source: PreviewSource }) {
  return (
    <figure className="ss-preview__quote">
      <blockquote>{source.evidence}</blockquote>
      <figcaption>{source.title} · {source.repository}</figcaption>
    </figure>
  )
}

function ResponseEditor({
  stageId,
  value,
  saved,
  onChange,
  onSave,
}: {
  readonly stageId: string
  readonly value: string
  readonly saved: boolean
  readonly onChange: (value: string) => void
  readonly onSave: () => void
}) {
  const response = RESPONSE_PROMPTS[stageId]
  if (!response) return null
  const inputId = `ss-response-${stageId}`
  return (
    <section className="ss-preview__response" aria-labelledby={`${inputId}-heading`}>
      <h2 id={`${inputId}-heading`}>{response.label}</h2>
      <p className="ss-preview__prompt">{response.prompt}</p>
      {response.hint ? (
        <details>
          <summary>Use a neutral writing frame</summary>
          <p>{response.hint}</p>
        </details>
      ) : null}
      <label htmlFor={inputId}>Write in your own words</label>
      <textarea
        id={inputId}
        value={value}
        rows={8}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
      <div className="ss-preview__response-actions">
        <button type="button" className="ss-preview__primary" disabled={!value.trim()} onClick={onSave}>Save evidence</button>
        {saved ? <p role="status">Saved on this device. No score was produced.</p> : null}
      </div>
    </section>
  )
}

function WelcomeContent() {
  return (
    <>
      <section className="ss-preview__lead-card">
        <p className="ss-preview__big-question">How can two real sources help us explain disagreement without pretending they tell every side?</p>
        <div className="ss-preview__goal-grid">
          <div><span>Today I will</span><strong>compare a law and a persuasive print.</strong></div>
          <div><span>I will show it by</span><strong>making a claim with two source details and a limit.</strong></div>
        </div>
      </section>
      <section>
        <h2>Words you will use</h2>
        <div className="ss-preview__vocabulary">
          {VOCABULARY.map((entry) => <article key={entry.term}><h3>{entry.term}</h3><p>{entry.definition}</p></article>)}
        </div>
      </section>
      <aside className="ss-preview__notice">
        <strong>Respectful history rule</strong>
        <p>Analyze evidence. Do not act out an identity or invent a person’s thoughts. “The source does not show that” is a strong historical answer.</p>
      </aside>
    </>
  )
}

function ContextContent() {
  return (
    <>
      <section className="ss-preview__context-grid">
        <article>
          <h2>Who and under what conditions?</h2>
          <p>Parliament issued rules for Britain’s American colonies. People in the colonies did not respond as one group. This lesson studies an official law and a Boston print, then names the viewpoint evidence that is still missing.</p>
        </article>
        <article>
          <h2>Where?</h2>
          <div className="ss-preview__place-strip" aria-label="Text-based spatial orientation">
            <span>Great Britain</span><span aria-hidden="true">Atlantic Ocean →</span><span>American colonies</span><span aria-hidden="true">→</span><span>Boston</span>
          </div>
          <p className="ss-preview__small">Accessible spatial orientation derived from the canonical source titles and repository place record. Geography supports context; map reading is not the measured skill.</p>
        </article>
      </section>
      <section>
        <h2>Use the timeline as evidence, not decoration</h2>
        <p>Sequence helps us ask cause-and-effect questions. Sequence alone does not prove that one event caused the next.</p>
        <ol className="ss-preview__timeline">
          {TIMELINE.map((event) => (
            <li key={event.year}><time>{event.year}</time><div><strong>{event.title}</strong><p>{event.note}</p><code>{event.sourceRef}</code></div></li>
          ))}
        </ol>
      </section>
    </>
  )
}

function ModelContent() {
  const source = PREVIEW_SOURCES.model
  return (
    <>
      <SourceIdentity source={source} />
      <p>{source.context}</p>
      <SourceQuote source={source} />
      <section className="ss-preview__reasoning">
        <h2>Watch the reasoning, step by step</h2>
        <ol>
          <li><strong>Notice a source detail.</strong><span>The resolution uses the words {source.evidence}.</span></li>
          <li><strong>Name only what it supports.</strong><span>The phrase supports a claim that the resolution proposed a change from colonies to independent states.</span></li>
          <li><strong>Link the detail to the claim.</strong><span>The political-status words are evidence because they name the exact change being proposed.</span></li>
          <li><strong>Check the boundary.</strong><span>{source.limitation}</span></li>
        </ol>
      </section>
      <aside className="ss-preview__transfer"><strong>Your transfer move:</strong> detail → supported idea → because → limit.</aside>
    </>
  )
}

function ParliamentContent() {
  const source = PREVIEW_SOURCES.parliament
  return (
    <>
      <SourceIdentity source={source} />
      <section className="ss-preview__source-reading">
        <h2>Before you interpret</h2>
        <p>{source.context}</p>
        <SourceQuote source={source} />
        <div className="ss-preview__limit"><strong>Source limit</strong><p>{source.limitation}</p></div>
      </section>
    </>
  )
}

function RevereContent() {
  const source = PREVIEW_SOURCES.revere
  return (
    <>
      <SourceIdentity source={source} />
      <section className="ss-preview__visual-source">
        <a href={source.url} target="_blank" rel="noreferrer" aria-label="Open the Paul Revere print at the Library of Congress">
          <img src={source.imageUrl} alt={source.imageAlt} />
        </a>
        <div>
          <h2>Look in layers</h2>
          <ol><li>People and positions</li><li>Actions</li><li>Words and title</li><li>Details that create a feeling</li></ol>
          <p>{source.context}</p>
          <div className="ss-preview__limit"><strong>Source limit</strong><p>{source.limitation}</p></div>
        </div>
      </section>
    </>
  )
}

function CompareContent() {
  return (
    <>
      <p className="ss-preview__big-question">Do not blend the sources into one voice. Compare them across the same dimensions.</p>
      <div className="ss-preview__comparison" role="table" aria-label="Comparison of Source A and Source B">
        <div role="row" className="ss-preview__comparison-head"><span role="columnheader">Question</span><span role="columnheader">Source A</span><span role="columnheader">Source B</span></div>
        <div role="row"><strong role="rowheader">Who made it?</strong><span role="cell">Parliament of Great Britain</span><span role="cell">Paul Revere</span></div>
        <div role="row"><strong role="rowheader">What form?</strong><span role="cell">A law</span><span role="cell">A printed engraving</span></div>
        <div role="row"><strong role="rowheader">What can it show?</strong><span role="cell">Parliament’s stated purpose and requirements</span><span role="cell">Revere’s chosen portrayal of the Boston event</span></div>
        <div role="row"><strong role="rowheader">What can it not show alone?</strong><span role="cell">Every colonist’s response</span><span role="cell">A complete, neutral event record</span></div>
      </div>
      <aside className="ss-preview__notice">
        <strong>Missing perspective alert</strong>
        <p>Neither source directly records a Loyalist colonist explaining loyalty. Source A is Parliament’s institutional voice. A historian must not relabel it as a Loyalist colonist’s voice.</p>
      </aside>
    </>
  )
}

function MasteryAContent() {
  return (
    <>
      <SourceIdentity source={PREVIEW_SOURCES.parliament} />
      <figure className="ss-preview__quote">
        <blockquote>“upon every pamphlet and paper”</blockquote>
        <figcaption>A different clause in the verified Stamp Act transcript · original spelling retained</figcaption>
      </figure>
      <p className="ss-preview__fresh-note">Freshness check: this clause was not used in the model or guided question. No writing frame is shown.</p>
    </>
  )
}

function MasteryBContent() {
  return (
    <>
      <SourceIdentity source={PREVIEW_SOURCES.revere} />
      <div className="ss-preview__fresh-note">Freshness check: the task now asks you to design corroboration for a missing perspective. It does not repeat the guided image observation.</div>
      <aside className="ss-preview__notice"><strong>Remember</strong><p>A trustworthy answer may say which evidence is missing. Do not invent a Loyalist quotation.</p></aside>
    </>
  )
}

function RepairMenu({ onRepair, onFinish }: { readonly onRepair: () => void; readonly onFinish: () => void }) {
  return (
    <div className="ss-preview__choice-panel">
      <button type="button" onClick={onRepair}><strong>Repair an evidence link</strong><span>Use a different model, then retry with a fresh source.</span></button>
      <button type="button" onClick={onFinish}><strong>Finish for now</strong><span>Your responses stay pending for a trusted adult’s review.</span></button>
    </div>
  )
}

function RepairContent() {
  const source = PREVIEW_SOURCES.repair
  return (
    <>
      <aside className="ss-preview__signal"><strong>Use this repair when:</strong> a response states an idea but gives no exact source detail, or the claim goes beyond the detail.</aside>
      <SourceIdentity source={source} />
      <SourceQuote source={source} />
      <section className="ss-preview__reasoning">
        <h2>Try a boundary test</h2>
        <ol>
          <li><strong>Detail</strong><span>The treaty calls the states {source.evidence}.</span></li>
          <li><strong>Supported claim</strong><span>The treaty recognizes an independent political status.</span></li>
          <li><strong>Unsupported leap</strong><span>The phrase does not reveal why every person chose protest or loyalty before the war.</span></li>
        </ol>
      </section>
      <p><strong>Why this is different:</strong> instead of repeating the failed comparison, this model sorts one claim inside the source boundary and one claim outside it.</p>
    </>
  )
}

function RetryContent() {
  const source = PREVIEW_SOURCES.retry
  return <><SourceIdentity source={source} /><p>{source.context}</p><SourceQuote source={source} /><div className="ss-preview__limit"><strong>Source limit</strong><p>{source.limitation}</p></div></>
}

function CompleteContent() {
  return (
    <section className="ss-preview__completion">
      <div aria-hidden="true">✓</div>
      <h2>History work complete</h2>
      <p>You used real sources, kept perspectives separate, connected evidence to a claim, and named what the evidence could not show.</p>
      <p>No automatic score was produced. A trusted adult can review the evidence against the protected lesson criteria.</p>
    </section>
  )
}

function StageContent({ stage, onRepair, onFinish }: { readonly stage: PreviewStage; readonly onRepair: () => void; readonly onFinish: () => void }) {
  switch (stage.kind) {
    case 'welcome': return <WelcomeContent />
    case 'context': return <ContextContent />
    case 'model': return <ModelContent />
    case 'source-a': return <ParliamentContent />
    case 'guided-a': return <><ParliamentContent /></>
    case 'source-b': return <RevereContent />
    case 'guided-b': return <><RevereContent /></>
    case 'compare': return <CompareContent />
    case 'independent': return <CompareContent />
    case 'mastery-a': return <MasteryAContent />
    case 'mastery-b': return <MasteryBContent />
    case 'repair-menu': return <RepairMenu onRepair={onRepair} onFinish={onFinish} />
    case 'repair': return <RepairContent />
    case 'retry': return <RetryContent />
    case 'complete': return <CompleteContent />
  }
}

export function SocialStudiesDirectorPreview() {
  const [stageIndex, setStageIndex] = useState(0)
  const [responses, setResponses] = useState<Responses>(readResponses)
  const [savedStage, setSavedStage] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const stage = PREVIEW_STAGES[stageIndex]!
  const response = responses[stage.id] ?? ''
  const visibleStages = useMemo(() => PREVIEW_STAGES.filter((candidate) => !['repair', 'retry', 'complete'].includes(candidate.kind)), [])

  useEffect(() => {
    headingRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [stageIndex])

  const navigateTo = (id: string) => {
    const nextIndex = PREVIEW_STAGES.findIndex((candidate) => candidate.id === id)
    if (nextIndex >= 0) setStageIndex(nextIndex)
  }
  const changeResponse = (value: string) => {
    setSavedStage('')
    setResponses((current) => ({ ...current, [stage.id]: value }))
  }
  const saveResponse = () => {
    try { window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(responses)) } catch { /* Preview remains usable when storage is unavailable. */ }
    setSavedStage(stage.id)
  }
  const defaultNext = stage.kind === 'retry' ? 'complete' : PREVIEW_STAGES[Math.min(stageIndex + 1, PREVIEW_STAGES.length - 1)]!.id
  const canShowDefaultNext = !['repair-menu', 'complete'].includes(stage.kind)

  return (
    <div className="ss-preview" data-director-preview="social-studies-r1">
      <header className="ss-preview__topbar">
        <div>
          <p>Manuel Academy · Grade 5 Social Studies</p>
          <strong>{SOCIAL_STUDIES_SAMPLE_DISPLAY_TITLE}</strong>
        </div>
        <span>Director sample R1</span>
      </header>

      <div className="ss-preview__layout">
        <aside className="ss-preview__rail" aria-label="Lesson sections">
          <p className="ss-preview__rail-label">Lesson path</p>
          <ol>
            {visibleStages.map((candidate) => {
              const index = PREVIEW_STAGES.findIndex((item) => item.id === candidate.id)
              const current = candidate.id === stage.id
              return (
                <li key={candidate.id}>
                  <button type="button" aria-current={current ? 'step' : undefined} onClick={() => setStageIndex(index)}>
                    <span>{index + 1}</span>{candidate.shortLabel}
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="ss-preview__provenance">
            <span>Canonical lesson</span>
            <code>{SOCIAL_STUDIES_SAMPLE_LESSON_REF}</code>
            <span>{SOCIAL_STUDIES_SAMPLE_CANONICAL_TITLE}</span>
          </div>
        </aside>

        <main className="ss-preview__main">
          <div className="ss-preview__mobile-progress" aria-label={`Lesson step ${stageIndex + 1} of ${PREVIEW_STAGES.length}`}>
            <span style={{ width: `${((stageIndex + 1) / PREVIEW_STAGES.length) * 100}%` }} />
          </div>
          <article className="ss-preview__card">
            <p className="ss-preview__eyebrow">{stage.eyebrow}</p>
            <h1 ref={headingRef} tabIndex={-1}>{stage.title}</h1>
            <StageContent stage={stage} onRepair={() => navigateTo('repair')} onFinish={() => navigateTo('complete')} />
            <ResponseEditor stageId={stage.id} value={response} saved={savedStage === stage.id} onChange={changeResponse} onSave={saveResponse} />
          </article>

          <nav className="ss-preview__navigation" aria-label="Lesson navigation">
            <button type="button" disabled={stageIndex === 0} onClick={() => setStageIndex((current) => Math.max(0, current - 1))}>Back</button>
            {canShowDefaultNext ? <button type="button" className="ss-preview__primary" onClick={() => navigateTo(defaultNext)}>{stage.kind === 'retry' ? 'Finish lesson' : 'Continue'}</button> : null}
          </nav>
          <footer>
            <p>Source metadata and links come from the canonical Social Studies source registry. Source quotations are short verbatim excerpts from the linked repository transcripts. Learner responses remain unscored.</p>
          </footer>
        </main>
      </div>
    </div>
  )
}
