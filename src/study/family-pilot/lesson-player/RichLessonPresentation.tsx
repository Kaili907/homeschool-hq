import { useEffect, useMemo, useRef, useState } from 'react'
import type { FamilyPilotStudySnapshot } from '../study'
import type {
  FamilyPilotLessonPlayerProps,
  FamilyPilotLessonSegmentContent,
  RichLessonDetail,
  RichLessonPage,
  RichLessonRenderModel,
  RichLessonSectionKind,
} from './types'
import './rich-lesson-player.css'

const KIND_LABEL: Readonly<Record<RichLessonSectionKind, string>> = Object.freeze({
  'lesson-goal': 'Lesson goal',
  teaching: 'Learn',
  vocabulary: 'Vocabulary',
  'worked-example': 'Worked example',
  'guided-practice': 'Guided practice',
  'independent-practice': 'Independent practice',
  'mastery-check': 'Check what you know',
  remediation: 'Reteach',
  challenge: 'Challenge',
  reflection: 'Reflection',
  'materials-safety': 'Materials and safety',
  source: 'Source',
  data: 'Data',
  map: 'Map',
  image: 'Image',
  reference: 'Reference',
})

function roleForOrdinal(ordinal: number | null | undefined) {
  if (ordinal === 2) return 'PRACTICE' as const
  if ((ordinal ?? 1) >= 3) return 'REFLECT' as const
  return 'LEARN' as const
}

function startingPage(
  pages: readonly RichLessonPage[],
  snapshot: FamilyPilotStudySnapshot,
  content: FamilyPilotLessonSegmentContent | undefined,
): number {
  if (!pages.length) return 0
  const cursor = pages.findIndex((page) => page.progressRef === snapshot.presentationProgressRef)
  const unresolved = content?.itemRef ? pages.findIndex((page) => page.item?.itemRef === content.itemRef) : -1
  if (cursor >= 0 && (unresolved < 0 || cursor <= unresolved)) return cursor
  const answered = new Set(content?.answeredItemRefs ?? [])
  if (answered.size && unresolved >= 0) return unresolved
  if (answered.size) {
    const lastAnswered = pages.reduce((held, page, index) => page.item && answered.has(page.item.itemRef) ? index : held, -1)
    if (lastAnswered >= 0) return Math.min(lastAnswered + 1, pages.length - 1)
  }
  return 0
}

function Detail({ detail }: { readonly detail: RichLessonDetail }) {
  const content = (
    <>
      {detail.label ? <h3>{detail.label}</h3> : null}
      {detail.text ? <p>{detail.text}</p> : null}
      {detail.items?.length ? <ul>{detail.items.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ul> : null}
    </>
  )
  if (detail.imageSrc) return <figure className="rich-lesson__media"><img src={detail.imageSrc} alt={detail.alt ?? detail.label ?? 'Lesson image'} />{detail.label ? <figcaption>{detail.label}</figcaption> : null}</figure>
  if (detail.href) return <div className="rich-lesson__detail">{content}<a href={detail.href} target="_blank" rel="noreferrer">Open referenced resource</a></div>
  return <div className="rich-lesson__detail">{content}</div>
}

function Progress({ snapshot, page }: { readonly snapshot: FamilyPilotStudySnapshot; readonly page: RichLessonPage }) {
  const segmentTotal = snapshot.completedSegmentRefs.length + snapshot.remainingSegmentRefs.length
  const segmentOrdinal = snapshot.segmentOrdinal ?? 1
  const overallMax = Math.max(segmentTotal, 1)
  return (
    <div className="rich-lesson__progress" aria-label="Lesson progress">
      <div>
        <span>Part {Math.min(segmentOrdinal, overallMax)} of {overallMax}</span>
        <span>{KIND_LABEL[page.kind]} · page {page.position} of {page.total}</span>
      </div>
      <progress value={(segmentOrdinal - 1) + page.position / page.total} max={overallMax}>
        Part {segmentOrdinal}, page {page.position} of {page.total}
      </progress>
    </div>
  )
}

export function RichLessonPresentation({
  snapshot,
  segmentContent,
  renderModel,
  tutorHelpAvailable,
  busy,
  onSubmitAction,
  onPause,
  onNext,
  onOpenTutor,
  onExit,
}: Pick<FamilyPilotLessonPlayerProps,
  'snapshot' | 'segmentContent' | 'renderModel' | 'tutorHelpAvailable' | 'busy' | 'onSubmitAction' |
  'onPause' | 'onNext' | 'onOpenTutor' | 'onExit'> & {
    readonly snapshot: FamilyPilotStudySnapshot
    readonly renderModel: RichLessonRenderModel
  }) {
  const role = roleForOrdinal(snapshot.segmentOrdinal)
  const pages = useMemo(() => renderModel.pages.filter((page) => page.role === role), [renderModel, role])
  const initialPage = startingPage(pages, snapshot, segmentContent)
  const [pageIndex, setPageIndex] = useState(initialPage)
  const [responseText, setResponseText] = useState('')
  const [selectedChoice, setSelectedChoice] = useState('')
  const [activityComplete, setActivityComplete] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sessionKey = `${snapshot.session.householdRef}|${snapshot.session.learnerRef}|${snapshot.session.sessionRef}`
  const page = pages[Math.min(pageIndex, Math.max(0, pages.length - 1))]

  useEffect(() => {
    setPageIndex(startingPage(pages, snapshot, segmentContent))
    setResponseText('')
    setSelectedChoice('')
    setActivityComplete(false)
  }, [sessionKey, snapshot.segmentRef, pages])

  useEffect(() => {
    setResponseText('')
    setSelectedChoice('')
    setActivityComplete(false)
  }, [page?.pageRef, segmentContent?.itemRef])

  useEffect(() => { headingRef.current?.focus() }, [page?.pageRef])

  if (!page) return (
    <section className="rich-lesson__card">
      <h1 ref={headingRef} tabIndex={-1}>Current lesson step</h1>
      <p>This lesson uses the established presentation for this step.</p>
      <button type="button" disabled={busy} onClick={onNext}>Continue</button>
    </section>
  )

  const item = page.item
  const answered = Boolean(item && segmentContent?.answeredItemRefs?.includes(item.itemRef))
  const currentResponseItem = Boolean(item && item.itemRef === segmentContent?.itemRef)
  const responseType = item?.responseType ?? 'READ'
  const interactive = ['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'].includes(responseType)
  const isBusy = busy ?? false
  const canContinue = !interactive || answered || responseType === 'RUBRIC_REVIEW_PENDING' || responseType === 'GUARDIAN_ATTESTATION'
  const hasNextPage = pageIndex < pages.length - 1
  const exampleSteps = item?.example?.split('\n').map((step) => step.trim()).filter(Boolean) ?? []

  const continueLesson = () => {
    if (isBusy || !canContinue) return
    if (hasNextPage) setPageIndex((current) => current + 1)
    else onNext()
  }
  const submitText = () => {
    const value = responseText.trim()
    if (isBusy || !currentResponseItem || !value || responseType === 'ACTIVITY_EVIDENCE' && !activityComplete) return
    onSubmitAction(value)
    setResponseText('')
  }
  const submitChoice = () => {
    if (isBusy || !currentResponseItem || !selectedChoice) return
    onSubmitAction(selectedChoice)
  }

  return (
    <main className="rich-lesson" data-subject={renderModel.subject.subject}>
      <a className="rich-lesson__skip" href="#rich-lesson-current">Skip to current lesson section</a>
      <header className="rich-lesson__topbar">
        <div>
          <p className="rich-lesson__subject">{renderModel.subject.label}</p>
          <p className="rich-lesson__lesson-title">{renderModel.title}</p>
        </div>
        <button type="button" className="rich-lesson__quiet-button" disabled={isBusy} onClick={() => onExit(page.progressRef)}>Save and exit</button>
      </header>

      <Progress snapshot={snapshot} page={page} />

      <article id="rich-lesson-current" className={`rich-lesson__card rich-lesson__card--${page.kind}`} aria-labelledby="rich-lesson-heading">
        <p className="rich-lesson__eyebrow">{KIND_LABEL[page.kind]}</p>
        <h1 id="rich-lesson-heading" ref={headingRef} tabIndex={-1}>{page.title}</h1>
        {page.directions ? <p className="rich-lesson__directions">{page.directions}</p> : null}
        {page.body ? <div className="rich-lesson__body">{page.body.split('\n').filter(Boolean).map((line, index) => <p key={`${index}:${line}`}>{line}</p>)}</div> : null}
        {page.details.length ? <div className="rich-lesson__details">{page.details.map((detail, index) => <Detail key={`${index}:${detail.label ?? detail.text ?? 'detail'}`} detail={detail} />)}</div> : null}
        {item?.instruction && item.instruction !== page.body && item.instruction !== page.directions ? <p className="rich-lesson__directions">{item.instruction}</p> : null}
        {item?.prompt ? <p className="rich-lesson__prompt">{item.prompt}</p> : null}
        {exampleSteps.length ? <ol className="rich-lesson__worked-steps" aria-label="Worked example steps">{exampleSteps.map((step, index) => <li key={`${index}:${step}`}>{step}</li>)}</ol> : null}

        {answered ? (
          <div className="rich-lesson__saved" role="status">
            <p>Response saved. No browser correctness decision was made.</p>
            <button type="button" className="rich-lesson__primary-button" disabled={isBusy} onClick={continueLesson}>{hasNextPage ? 'Continue' : 'Finish this part'}</button>
          </div>
        ) : responseType === 'RUBRIC_REVIEW_PENDING' ? (
          <div className="rich-lesson__saved" role="status"><p>Your work is saved for trusted rubric review.</p><button type="button" className="rich-lesson__primary-button" disabled={isBusy} onClick={continueLesson}>Continue</button></div>
        ) : responseType === 'GUARDIAN_ATTESTATION' ? (
          <div className="rich-lesson__saved" role="status"><p>A guardian can attest this activity after the learner work is saved.</p><button type="button" className="rich-lesson__primary-button" disabled={isBusy} onClick={continueLesson}>Continue</button></div>
        ) : !interactive ? (
          <button type="button" className="rich-lesson__primary-button" disabled={isBusy} onClick={continueLesson}>{hasNextPage ? 'Continue' : 'Finish this part'}</button>
        ) : !currentResponseItem ? (
          <p className="rich-lesson__notice" role="status">Return to the first unanswered question before continuing.</p>
        ) : responseType === 'CHOICE' ? (
          <form onSubmit={(event) => { event.preventDefault(); submitChoice() }}>
            <fieldset disabled={isBusy}>
              <legend>Choose your answer</legend>
              <div className="rich-lesson__choices">
                {item?.choices.map((choice) => <label key={choice.choiceRef} className="rich-lesson__choice"><input type="radio" name={`rich-lesson-choice-${item.itemRef}`} value={choice.choiceRef} checked={selectedChoice === choice.choiceRef} onChange={() => setSelectedChoice(choice.choiceRef)} /><span>{choice.label}</span></label>)}
              </div>
            </fieldset>
            <button type="button" className="rich-lesson__primary-button" disabled={isBusy || !selectedChoice} onClick={submitChoice}>Save response</button>
          </form>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); submitText() }}>
            <label className="rich-lesson__field" htmlFor="rich-lesson-response">
              <span>{responseType === 'ACTIVITY_EVIDENCE' ? 'Describe what you completed or where your evidence is saved' : responseType === 'CONSTRUCTED_RESPONSE' ? 'Explain your thinking' : 'Your response'}</span>
              {responseType === 'TEXT' || responseType === 'NUMERIC' ? <input id="rich-lesson-response" type="text" inputMode={responseType === 'NUMERIC' ? 'decimal' : 'text'} autoComplete="off" enterKeyHint="done" value={responseText} disabled={isBusy} onChange={(event) => setResponseText(event.target.value)} aria-describedby="rich-lesson-response-help" /> : <textarea id="rich-lesson-response" rows={5} value={responseText} disabled={isBusy} onChange={(event) => setResponseText(event.target.value)} aria-describedby="rich-lesson-response-help" />}
            </label>
            {responseType === 'ACTIVITY_EVIDENCE' ? <label className="rich-lesson__attestation"><input type="checkbox" checked={activityComplete} disabled={isBusy} onChange={(event) => setActivityComplete(event.target.checked)} /> <span>I completed the action described above.</span></label> : null}
            <p id="rich-lesson-response-help" className="rich-lesson__help">Your response is saved on this device through the learner-response runtime before assessment.</p>
            <button type="button" className="rich-lesson__primary-button" disabled={isBusy || !responseText.trim() || responseType === 'ACTIVITY_EVIDENCE' && !activityComplete} onClick={submitText}>Save response</button>
          </form>
        )}

        {segmentContent?.pendingAssessmentCount ? <p className="rich-lesson__pending" role="status">{segmentContent.pendingAssessmentCount} saved response{segmentContent.pendingAssessmentCount === 1 ? '' : 's'} pending trusted assessment.</p> : null}
      </article>

      <nav className="rich-lesson__support" aria-label="Lesson help and break controls">
        {tutorHelpAvailable ? <button type="button" disabled={isBusy} onClick={() => onOpenTutor({ lessonRef: renderModel.lessonRef, sectionRef: page.sectionRef, itemRef: item?.itemRef ?? null })}>Ask the Tutor for help</button> : null}
        <button type="button" disabled={isBusy} onClick={() => onPause(page.progressRef)}>Take a break</button>
      </nav>
    </main>
  )
}
