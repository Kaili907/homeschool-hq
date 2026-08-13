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
  const [selectedChoice, setSelectedChoice] = useState('')
  const [activityComplete, setActivityComplete] = useState(false)
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
    setSelectedChoice('')
    setActivityComplete(false)
  }, [sessionKey, snapshot?.segmentRef, segmentContent?.itemRef])

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

  const legacyKind = segmentContent?.responseKind
  const responseKind = legacyKind === 'text' ? 'TEXT'
    : legacyKind === 'choice' ? 'CHOICE'
      : legacyKind === 'none' ? 'NONE'
        : legacyKind ?? 'TEXT'
  const segmentTitle = segmentContent?.title
  // Explicit uppercase kinds come from the learner-response runtime, which
  // saves evidence as pending even when Tutor Core is unavailable. An old
  // caller with no explicit response contract retains completion-only behavior.
  const responseCollectsEvidence = ['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'].includes(responseKind)
  const isProductionResponse = Boolean(segmentContent?.responseKind && /^[A-Z_]+$/.test(segmentContent.responseKind))
  const canSubmitResponse = responseCollectsEvidence && (isProductionResponse || (snapshot?.tutorBridgeAvailable ?? true))

  const handleSubmit = () => {
    const trimmed = responseText.trim()
    if (isBusy || !trimmed) return
    onSubmitAction(trimmed)
    setResponseText('')
  }

  const handleChoice = (choiceId: string) => {
    if (isBusy) return
    setSelectedChoice(choiceId)
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
      {segmentContent?.pendingAssessmentCount ? (
        <p role="status">{segmentContent.pendingAssessmentCount} saved response{segmentContent.pendingAssessmentCount === 1 ? '' : 's'} pending assessment.</p>
      ) : null}

      {responseKind === 'NONE' || responseKind === 'READ' ? (
        <div>
          {responseKind === 'READ' ? <p>This is instructional material. No answer is expected.</p> : null}
          <button type="button" disabled={isBusy} onClick={onNext}>Continue</button>
        </div>
      ) : responseKind === 'RUBRIC_REVIEW_PENDING' ? (
        <div>
          <p role="status">Your work is saved for rubric review. No correctness claim is shown while review is pending.</p>
          <button type="button" disabled={isBusy} onClick={onNext}>Continue</button>
        </div>
      ) : responseKind === 'GUARDIAN_ATTESTATION' ? (
        <div>
          <p role="status">A guardian will attest this activity after your learner work is saved.</p>
          <button type="button" disabled={isBusy} onClick={onNext}>Continue</button>
        </div>
      ) : !canSubmitResponse ? (
        // Legacy completion-only callers have no learner evidence contract.
        <button type="button" disabled={isBusy} onClick={onCompleteSegment}>Mark step complete</button>
      ) : responseKind === 'CHOICE' ? (
        <form onSubmit={(event) => { event.preventDefault(); if (!isBusy && selectedChoice) onSubmitAction(selectedChoice) }}>
          <fieldset disabled={isBusy}>
            <legend>Choose your answer</legend>
            {(segmentContent?.choices ?? []).map((choice) => (
              <label key={choice.id} style={{ display: 'block', minHeight: 44 }}>
                <input
                  type="radio"
                  name="family-pilot-lesson-choice"
                  value={choice.id}
                  checked={selectedChoice === choice.id}
                  onChange={() => handleChoice(choice.id)}
                />
                {choice.label}
              </label>
            ))}
          </fieldset>
          <button type="button" disabled={isBusy || !selectedChoice} onClick={() => { if (!isBusy && selectedChoice) onSubmitAction(selectedChoice) }}>Submit answer</button>
        </form>
      ) : responseKind === 'NUMERIC' || (responseKind === 'TEXT' && isProductionResponse) ? (
        <form onSubmit={(event) => { event.preventDefault(); handleSubmit() }}>
          <label htmlFor="family-pilot-lesson-response">Your response</label>
          <input
            id="family-pilot-lesson-response"
            type="text"
            inputMode={responseKind === 'NUMERIC' ? 'decimal' : 'text'}
            autoComplete="off"
            value={responseText}
            disabled={isBusy}
            onChange={(event) => setResponseText(event.target.value)}
            aria-describedby="family-pilot-lesson-response-help"
          />
          <p id="family-pilot-lesson-response-help">Your response is saved on this device before assessment.</p>
          <button type="button" disabled={isBusy || !responseText.trim()} onClick={handleSubmit}>Submit</button>
        </form>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); handleSubmit() }}>
          <label htmlFor="family-pilot-lesson-response">
            {responseKind === 'ACTIVITY_EVIDENCE' ? 'Describe what you completed or where your evidence is saved' : 'Your response'}
          </label>
          <textarea
            id="family-pilot-lesson-response"
            value={responseText}
            disabled={isBusy}
            onChange={(event) => setResponseText(event.target.value)}
            aria-describedby="family-pilot-lesson-response-help"
          />
          {responseKind === 'ACTIVITY_EVIDENCE' ? (
            <label style={{ display: 'block', minHeight: 44 }}>
              <input type="checkbox" checked={activityComplete} disabled={isBusy} onChange={(event) => setActivityComplete(event.target.checked)} />
              I completed the action described above.
            </label>
          ) : null}
          <p id="family-pilot-lesson-response-help">Your response is saved on this device before assessment.</p>
          <button type="button" disabled={isBusy || !responseText.trim() || (responseKind === 'ACTIVITY_EVIDENCE' && !activityComplete)} onClick={handleSubmit}>Submit</button>
        </form>
      )}

      <div>
        <button type="button" disabled={isBusy} onClick={onPause}>Pause</button>
        {tutorButton}
      </div>
    </main>
  )
}
