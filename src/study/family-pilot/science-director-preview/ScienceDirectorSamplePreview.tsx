import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { loadFinalFamilyPilotCatalog, type FinalLearnerMaterialSection, type FinalLearnerProductionMaterial } from '../../../curriculum/final-app-data'
import {
  createScienceSamplePresentation,
  SCIENCE_DIRECTOR_SAMPLE_LESSON_REF,
  SCIENCE_DIRECTOR_SAMPLE_TITLE,
  type ScienceSampleStage,
} from './model'
import './science-director-preview.css'

const STAGE_KICKERS: Readonly<Record<ScienceSampleStage, string>> = Object.freeze({
  NOTICE: 'Phenomenon first',
  LEARN: 'Clear explanation + vocabulary',
  MODEL: 'Worked scientific reasoning',
  GUIDED: 'Support begins to fade',
  INDEPENDENT: 'Fresh application',
  MASTERY: 'Teaching support hidden',
  REMEDIATION: 'A different explanation',
})

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    if (part.startsWith('_') && part.endsWith('_')) return <em key={index}>{part.slice(1, -1)}</em>
    return <Fragment key={index}>{part}</Fragment>
  })
}

function isSpecialLine(line: string): boolean {
  return /^###\s+|^\s*[-*]\s+|^\s*\d+\.\s+|^\|/.test(line) || /^\*\*Q\d+\.\*\*/.test(line) || line.trim() === '>'
}

function MarkdownBody({ body }: { readonly body: string }) {
  const lines = body.split('\n')
  const blocks: ReactNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!.trim()
    if (!line || line === '>' || /^\*\*Q\d+\.\*\*/.test(line)) {
      index += 1
      continue
    }
    if (line.startsWith('### ')) {
      blocks.push(<h3 key={`h-${index}`}>{inlineMarkdown(line.slice(4))}</h3>)
      index += 1
      continue
    }
    if (line.startsWith('|') && lines[index + 1]?.trim().startsWith('|')) {
      const rows: string[][] = []
      while (index < lines.length && lines[index]!.trim().startsWith('|')) {
        const cells = lines[index]!.trim().split('|').slice(1, -1).map((cell) => cell.trim())
        if (!cells.every((cell) => /^:?-+:?$/.test(cell))) rows.push(cells)
        index += 1
      }
      const [headers, ...bodyRows] = rows
      if (headers) blocks.push(
        <div className="science-preview__table-wrap" key={`table-${index}`}>
          <table>
            <thead><tr>{headers.map((cell) => <th key={cell}>{inlineMarkdown(cell)}</th>)}</tr></thead>
            <tbody>{bodyRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inlineMarkdown(cell)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^\s*[-*]\s+/, '').trim())
        index += 1
      }
      blocks.push(<ul key={`ul-${index}`}>{items.map((item) => <li key={item}>{inlineMarkdown(item)}</li>)}</ul>)
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^\s*\d+\.\s+/, '').trim())
        index += 1
      }
      blocks.push(<ol key={`ol-${index}`}>{items.map((item) => <li key={item}>{inlineMarkdown(item)}</li>)}</ol>)
      continue
    }
    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index]!.trim() && !isSpecialLine(lines[index]!.trim())) {
      paragraph.push(lines[index]!.trim())
      index += 1
    }
    blocks.push(<p key={`p-${index}`}>{inlineMarkdown(paragraph.join(' '))}</p>)
  }
  return <div className="science-preview__markdown">{blocks}</div>
}

function SamplePlayer({ material }: { readonly material: FinalLearnerProductionMaterial }) {
  const presentation = useMemo(() => createScienceSamplePresentation(material), [material])
  const [stepIndex, setStepIndex] = useState(0)
  const [responses, setResponses] = useState<Readonly<Record<string, string>>>({})
  const [savedStep, setSavedStep] = useState<number | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const step = presentation.steps[stepIndex]!
  const items = step.section.items ?? []
  const complete = items.every((item) => (responses[item.itemRef] ?? '').trim())

  useEffect(() => {
    headingRef.current?.focus()
    setSavedStep(null)
  }, [stepIndex])

  const moveNext = () => setStepIndex((current) => Math.min(current + 1, presentation.steps.length - 1))
  const submitStep = () => {
    if (!items.length) moveNext()
    else if (complete) setSavedStep(stepIndex)
  }

  return (
    <main className="science-preview" data-lesson-ref={material.lessonRef}>
      <header className="science-preview__topbar">
        <div>
          <p>Grade 3 Science <span aria-hidden="true">/</span> Director review</p>
          <strong>Testable Questions</strong>
        </div>
        <span className="science-preview__data-badge">Real lesson data</span>
      </header>

      <div className="science-preview__shell">
        <aside className="science-preview__rail" aria-label="Lesson progress">
          <p className="science-preview__rail-title">Today’s path</p>
          <ol>
            {presentation.steps.map((candidate, index) => (
              <li key={candidate.stage} className={index === stepIndex ? 'is-current' : index < stepIndex ? 'is-complete' : ''}>
                <span>{index < stepIndex ? '✓' : index + 1}</span>
                <div><strong>{candidate.shortLabel}</strong><small>{STAGE_KICKERS[candidate.stage]}</small></div>
              </li>
            ))}
          </ol>
          <div className="science-preview__honesty-note">
            <strong>Evidence honesty</strong>
            <p>No learner experiment is run here. No observation or result is invented.</p>
          </div>
        </aside>

        <section className={`science-preview__lesson science-preview__lesson--${step.stage.toLowerCase()}`} aria-labelledby="science-preview-heading">
          <div className="science-preview__stage-meta">
            <span>{STAGE_KICKERS[step.stage]}</span>
            <span>Step {stepIndex + 1} of {presentation.steps.length}</span>
          </div>
          <h1 id="science-preview-heading" ref={headingRef} tabIndex={-1}>{step.section.title.replace(/^\d+\.\s*/, '')}</h1>
          {step.stage === 'MASTERY' ? <div className="science-preview__protected" role="note">Fresh check: the definition and worked model are hidden on this step.</div> : null}
          <MarkdownBody body={step.section.body ?? ''} />

          {items.length ? (
            <form className="science-preview__responses" onSubmit={(event) => { event.preventDefault(); submitStep() }}>
              {items.map((item) => (
                <label key={item.itemRef}>
                  <span>{item.prompt}</span>
                  <textarea
                    value={responses[item.itemRef] ?? ''}
                    onChange={(event) => setResponses((current) => ({ ...current, [item.itemRef]: event.target.value }))}
                    rows={4}
                    placeholder="Write, draw on paper, or record what you would say."
                  />
                </label>
              ))}
              {!complete ? <p className="science-preview__response-note">Complete {items.length === 1 ? 'the response' : 'both responses'} to continue this review flow.</p> : null}
              {savedStep === stepIndex ? (
                <div className="science-preview__saved" role="status">
                  <strong>Response held on this page only.</strong>
                  <span>No score or mastery decision is made in the Director preview.</span>
                </div>
              ) : null}
              <div className="science-preview__actions">
                {step.stage !== 'MASTERY' && stepIndex > 0 ? <button type="button" className="is-secondary" onClick={() => setStepIndex((current) => current - 1)}>Back</button> : null}
                {savedStep === stepIndex
                  ? <button type="button" onClick={moveNext}>{stepIndex === presentation.steps.length - 1 ? 'Finish Review' : 'Continue'}</button>
                  : <button type="submit" disabled={!complete}>Save Responses</button>}
              </div>
            </form>
          ) : (
            <div className="science-preview__actions">
              {stepIndex > 0 ? <button type="button" className="is-secondary" onClick={() => setStepIndex((current) => current - 1)}>Back</button> : null}
              {stepIndex < presentation.steps.length - 1 ? <button type="button" onClick={moveNext}>Continue</button> : <button type="button" onClick={() => setStepIndex(0)}>Review Again</button>}
            </div>
          )}

          <details className="science-preview__policy">
            <summary>Open the complete Science safety policy reference</summary>
            <MarkdownBody body={presentation.safetyReference.body ?? ''} />
          </details>
        </section>
      </div>
    </main>
  )
}

export function ScienceDirectorSamplePreview() {
  const [material, setMaterial] = useState<FinalLearnerProductionMaterial | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    void loadFinalFamilyPilotCatalog()
      .then((catalog) => catalog.getMaterial(SCIENCE_DIRECTOR_SAMPLE_LESSON_REF))
      .then((loaded) => {
        if (!live) return
        if (!loaded || loaded.lessonRef !== SCIENCE_DIRECTOR_SAMPLE_LESSON_REF || loaded.title !== SCIENCE_DIRECTOR_SAMPLE_TITLE) {
          throw new Error('The canonical Grade 3 Science sample is unavailable or has changed identity.')
        }
        createScienceSamplePresentation(loaded)
        setMaterial(loaded)
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : 'The Science sample could not be opened.')
      })
    return () => { live = false }
  }, [])

  if (error) return <main className="science-preview science-preview--state"><h1>Preview unavailable</h1><p role="alert">{error}</p></main>
  if (!material) return <main className="science-preview science-preview--state" aria-busy="true"><p role="status">Opening the real Grade 3 Science lesson…</p></main>
  return <SamplePlayer material={material} />
}
