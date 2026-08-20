import { useEffect, useState } from 'react'
import type { FamilyPilotLessonPlayerProps } from './types'
import './lesson-player.css'

export function FamilyPilotLessonPlayer({
  status,
  snapshot,
  segmentContent,
  renderModel,
  tutorHelpAvailable,
  busy,
  errorMessage,
  onContinue,
  onSubmitAction,
  onPause,
  onResume,
  onNext,
  onCompleteSegment,
  onOpenTutor,
  onExit,
}: FamilyPilotLessonPlayerProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [responseText, setResponseText] = useState('')
  const [selectedChoice, setSelectedChoice] = useState('')
  useEffect(() => { setPageIndex(0) }, [renderModel?.lessonRef])
  useEffect(() => {
    setResponseText('')
    setSelectedChoice('')
  }, [snapshot?.segmentRef, segmentContent?.itemRef])

  if (status === 'loading') return <main className="family-pilot-lesson-player" aria-busy="true"><p role="status">Preparing lesson…</p></main>
  if (status === 'blocked' || status === 'error' || (!renderModel && !segmentContent)) {
    return <main className="family-pilot-lesson-player"><h1>Lesson unavailable</h1><p role="alert">{errorMessage ?? 'This lesson cannot be opened right now.'}</p>{onExit && <button onClick={() => onExit()}>Back</button>}</main>
  }
  if (status === 'paused') {
    return <main className="family-pilot-lesson-player"><h1>{renderModel?.title ?? snapshot?.title ?? 'Lesson'}: paused</h1><p role="status">Your progress is saved.</p>{onResume && <button disabled={busy} onClick={onResume}>Resume</button>}{onExit && <button onClick={() => onExit()}>Exit</button>}</main>
  }
  if (status === 'completed') {
    return <main className="family-pilot-lesson-player"><h1>{renderModel?.title ?? snapshot?.title ?? 'Lesson'}: lesson complete</h1><p role="status">Great work — this lesson is finished.</p>{onExit && <button onClick={() => onExit()}>Done</button>}</main>
  }
  const page = renderModel?.pages[Math.min(pageIndex, renderModel.pages.length - 1)]
  const finalPage = page ? page.position === page.total : true
  const progressRef = page?.progressRef
  const rawKind = segmentContent?.responseKind
  const responseKind = rawKind === 'text' ? 'TEXT' : rawKind === 'choice' ? 'CHOICE' : rawKind === 'none' ? 'NONE' : rawKind ?? 'READ'
  const submitText = () => {
    const value = responseText.trim()
    if (!value || busy || !onSubmitAction) return
    onSubmitAction(value)
    setResponseText('')
  }
  const advance = onNext ?? onCompleteSegment ?? onContinue
  const responseControl = segmentContent ? (
    <section aria-labelledby="family-pilot-response-title">
      <h2 id="family-pilot-response-title">{segmentContent.title ?? 'Your response'}</h2>
      {segmentContent.instruction && <p>{segmentContent.instruction}</p>}
      {segmentContent.example && <p><strong>Example:</strong> {segmentContent.example}</p>}
      {segmentContent.prompt && <p>{segmentContent.prompt}</p>}
      {responseKind === 'CHOICE' ? (
        <form onSubmit={(event) => { event.preventDefault(); if (selectedChoice && onSubmitAction) onSubmitAction(selectedChoice) }}>
          <fieldset disabled={busy}><legend>Choose your answer</legend>{(segmentContent.choices ?? []).map((choice) => <label key={choice.id} style={{ display: 'block', minHeight: 44 }}><input type="radio" name="family-pilot-lesson-choice" checked={selectedChoice === choice.id} onChange={() => setSelectedChoice(choice.id)} />{choice.label}</label>)}</fieldset>
          <button type="submit" disabled={busy || !selectedChoice || !onSubmitAction}>Submit answer</button>
        </form>
      ) : ['TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'].includes(responseKind) ? (
        <form onSubmit={(event) => { event.preventDefault(); submitText() }}>
          <label htmlFor="family-pilot-lesson-response">{responseKind === 'ACTIVITY_EVIDENCE' ? 'Describe what you completed or where your evidence is saved' : 'Your response'}</label>
          {responseKind === 'NUMERIC' || responseKind === 'TEXT' ? <input id="family-pilot-lesson-response" type="text" inputMode={responseKind === 'NUMERIC' ? 'decimal' : 'text'} value={responseText} disabled={busy} onChange={(event) => setResponseText(event.target.value)} /> : <textarea id="family-pilot-lesson-response" value={responseText} disabled={busy} onChange={(event) => setResponseText(event.target.value)} />}
          <button type="submit" disabled={busy || !responseText.trim() || !onSubmitAction}>Submit response</button>
        </form>
      ) : advance ? <button type="button" disabled={busy} onClick={advance}>Continue</button> : null}
    </section>
  ) : null
  return (
    <main className="family-pilot-lesson-player" data-subject={renderModel?.subject.subject}>
      <header>
        {renderModel && <p className="lesson-subject">{renderModel.subject.label}</p>}
        <h1>{renderModel?.title ?? snapshot?.title ?? 'Current lesson'}</h1>
        {page && <p>Step {page.position} of {page.total}</p>}
      </header>
      {page && <article aria-labelledby="family-pilot-current-section">
        <h2 id="family-pilot-current-section">{page.title}</h2>
        {page.body && <p>{page.body}</p>}
        {page.directions && <p className="lesson-directions">{page.directions}</p>}
        {page.details.length > 0 && <ul>{page.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
      </article>}
      {responseControl}
      <nav aria-label="Lesson steps">
        {renderModel && <button disabled={pageIndex === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))}>Previous</button>}
        {renderModel && !finalPage && <button onClick={() => setPageIndex((value) => Math.min(renderModel.pages.length - 1, value + 1))}>Next</button>}
        {finalPage && onContinue && <button onClick={onContinue}>Complete this step</button>}
        {(status === 'ready' || status === 'active') && onPause && <button onClick={() => onPause(progressRef)}>Pause</button>}
        {tutorHelpAvailable && onOpenTutor && <button onClick={() => onOpenTutor({ lessonRef: segmentContent?.lessonRef ?? renderModel?.lessonRef ?? snapshot?.lessonRef ?? '', sectionRef: segmentContent?.sectionRef ?? null, itemRef: segmentContent?.itemRef ?? null })}>Ask the Tutor for help</button>}
        {onExit && <button onClick={() => onExit(progressRef)}>Exit lesson</button>}
      </nav>
      {snapshot && <p className="lesson-progress" aria-live="polite">{snapshot.requiredWorkCompletionPercent}% complete</p>}
    </main>
  )
}
