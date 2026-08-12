import { useEffect, useRef, useState } from 'react'
import type { FamilyPilotLessonPlayerProps } from './types'

/**
 * Family Pilot lesson/player surface. Purely a display over Study state
 * handed down as props — it holds no session, no persistence, and no
 * progression logic. Every transition is a callback the host interprets
 * against the existing FamilyPilotStudyRuntime action vocabulary.
 */
export function FamilyPilotLessonPlayer({
  status,
  snapshot,
  segmentContent,
  errorMessage,
  tutorHelpAvailable,
  busy,
  onSubmitAction,
  onPause,
  onResume,
  onNext,
  onCompleteSegment,
  onOpenTutor,
  onExit,
}: FamilyPilotLessonPlayerProps) {
  const [responseText, setResponseText] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sessionKey = snapshot
    ? `${snapshot.session.householdRef}|${snapshot.session.learnerRef}|${snapshot.session.sessionRef}`
    : null

  // A changed session (student switch, or a fresh assignment) and a changed
  // segment both invalidate any unsent draft. Free-response text is held in
  // this component only for the duration of one segment and is never sent
  // anywhere except through onSubmitAction.
  useEffect(() => {
    setResponseText('')
  }, [sessionKey, snapshot?.segmentRef])

  useEffect(() => {
    headingRef.current?.focus()
  }, [status, snapshot?.segmentRef])

  const isBusy = busy ?? false
  const tutorAvailable = tutorHelpAvailable ?? false
  const title = snapshot?.title ?? 'Current lesson'
  const totalSegments = snapshot
    ? snapshot.completedSegmentRefs.length + snapshot.remainingSegmentRefs.length
    : null
  const stepText = snapshot?.segmentOrdinal && totalSegments
    ? `Step ${snapshot.segmentOrdinal} of ${totalSegments}`
    : null

  const tutorButton = tutorAvailable ? (
    <button type="button" onClick={onOpenTutor}>Ask the Tutor for help</button>
  ) : null

  if (status === 'loading') {
    return (
      <main aria-busy="true">
        <h1 ref={headingRef} tabIndex={-1}>Loading lesson…</h1>
        <p role="status">Preparing your Study session…</p>
        <button type="button" onClick={onExit}>Cancel</button>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main>
        <h1 ref={headingRef} tabIndex={-1}>Lesson unavailable</h1>
        <p role="alert">{errorMessage ?? 'This lesson could not be loaded.'}</p>
        <button type="button" onClick={onExit}>Back</button>
      </main>
    )
  }

  if (status === 'completed') {
    return (
      <main>
        <h1 ref={headingRef} tabIndex={-1}>{title}: lesson complete</h1>
        <p role="status">Great work — this lesson is finished.</p>
        <button type="button" onClick={onExit}>Done</button>
      </main>
    )
  }

  if (status === 'paused') {
    return (
      <main>
        <h1 ref={headingRef} tabIndex={-1}>{title}: paused</h1>
        <p role="status">Study is paused. Current status: {snapshot?.sessionStatus ?? 'paused'}.</p>
        <button type="button" disabled={isBusy} onClick={onResume}>Resume</button>
        <button type="button" onClick={onExit}>Exit</button>
        {tutorButton}
      </main>
    )
  }

  const responseKind = segmentContent?.responseKind ?? 'text'
  const segmentTitle = segmentContent?.title
  // No Tutor Core mastery decision is possible for this segment (see
  // FamilyPilotStudyRuntime.submitStudyAction's 'recorded' path): there is
  // nothing to grade, so the step is acknowledged directly instead of
  // collecting a response for a decision that will never be made. Unknown
  // (missing snapshot) defaults to the response path, the more common case.
  const canSubmitResponse = responseKind !== 'none' && (snapshot?.tutorBridgeAvailable ?? true)

  const handleSubmit = () => {
    const trimmed = responseText.trim()
    if (isBusy || !trimmed) return
    onSubmitAction(trimmed)
    setResponseText('')
  }

  const handleChoice = (choiceId: string) => {
    if (isBusy) return
    onSubmitAction(choiceId)
  }

  return (
    <main>
      <header>
        <p>{title}</p>
        <button type="button" onClick={onExit}>Save and exit</button>
      </header>
      <h1 ref={headingRef} tabIndex={-1}>{segmentTitle ?? 'Current step'}</h1>
      {stepText ? <p role="status">{stepText}</p> : null}
      <p>Status: {snapshot?.sessionStatus ?? 'active'}</p>

      {segmentContent?.instruction ? <p>{segmentContent.instruction}</p> : null}
      {segmentContent?.example ? (
        <div>
          <p>Worked example</p>
          <p>{segmentContent.example}</p>
        </div>
      ) : null}
      {segmentContent?.prompt ? <p>{segmentContent.prompt}</p> : null}

      {responseKind === 'none' ? (
        <button type="button" disabled={isBusy} onClick={onNext}>Continue</button>
      ) : !canSubmitResponse ? (
        // Completion-only work (see FamilyPilotStudySnapshot.tutorBridgeAvailable):
        // no mastery decision applies, so the step is acknowledged directly.
        <button type="button" disabled={isBusy} onClick={onCompleteSegment}>Mark step complete</button>
      ) : responseKind === 'choice' ? (
        <div role="group" aria-label="Choose your answer">
          {(segmentContent?.choices ?? []).map((choice) => (
            <button key={choice.id} type="button" disabled={isBusy} onClick={() => handleChoice(choice.id)}>
              {choice.label}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <label htmlFor="family-pilot-lesson-response">Your response</label>
          <textarea
            id="family-pilot-lesson-response"
            value={responseText}
            disabled={isBusy}
            onChange={(event) => setResponseText(event.target.value)}
            aria-describedby="family-pilot-lesson-response-help"
          />
          <p id="family-pilot-lesson-response-help">This response is temporary and is not saved by this screen.</p>
          <button type="button" disabled={isBusy || !responseText.trim()} onClick={handleSubmit}>Submit</button>
        </div>
      )}

      <div>
        <button type="button" disabled={isBusy} onClick={onPause}>Pause</button>
        {tutorButton}
      </div>
    </main>
  )
}
