import { useCallback, useEffect, useMemo, useState } from 'react'
import { FamilyPilotLessonPlayer, createRichLessonRenderModel } from '../family-pilot/lesson-player'
import {
  LearnerResponseRuntime,
  MemoryLearnerResponseStore,
  type LearnerResponseAttemptContext,
  type LearnerResponsePresentation,
} from '../family-pilot/final-app/learner-response'
import type { FamilyPilotStudySnapshot } from '../family-pilot/study'
import { SCIENCE_R3_PREVIEW_LESSONS, type ScienceR3PreviewLesson } from './registry'
import './science-r3-preview.css'

const SEGMENT_COUNT = 3

/**
 * A preview attempt that exists only in this tab's memory. No household, no learner, no
 * assignment, and no Family Cloud record is referenced, and the store below is discarded on
 * reload, so nothing here can write learner progress.
 */
function previewContext(lessonRef: string): LearnerResponseAttemptContext {
  return Object.freeze({
    lessonRef,
    studentRef: 'curriculum-preview-r3:ephemeral-reviewer',
    assignmentRef: 'curriculum-preview-r3:no-assignment',
    attemptRef: 'curriculum-preview-r3:in-memory-attempt',
  })
}

function PreviewLesson({ lesson }: { readonly lesson: ScienceR3PreviewLesson }) {
  const renderModel = useMemo(() => createRichLessonRenderModel(lesson.material), [lesson])
  const [attempt, setAttempt] = useState(0)
  const runtime = useMemo(
    // The real runtime and the real canonical in-memory store. No assessor is supplied, so
    // every saved response stays PENDING_ASSESSMENT exactly as it does in production.
    () => new LearnerResponseRuntime(lesson.material, previewContext(lesson.lessonRef), new MemoryLearnerResponseStore()),
    [lesson, attempt],
  )
  const [segmentOrdinal, setSegmentOrdinal] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [presentation, setPresentation] = useState<LearnerResponsePresentation | null>(null)
  const [busy, setBusy] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [rejection, setRejection] = useState<string | null>(null)

  const segmentRefs = useMemo(
    () => Array.from({ length: SEGMENT_COUNT }, (_, index) => `${lesson.lessonRef}:preview-segment:${index + 1}`),
    [lesson],
  )
  const segmentRef = segmentRefs[segmentOrdinal - 1]!

  const refresh = useCallback(async () => {
    setPresentation(await runtime.open(segmentOrdinal, segmentRef))
  }, [runtime, segmentOrdinal, segmentRef])

  useEffect(() => {
    let live = true
    void runtime.open(segmentOrdinal, segmentRef).then((view) => { if (live) setPresentation(view) })
    return () => { live = false }
  }, [runtime, segmentOrdinal, segmentRef])

  const item = presentation?.item ?? null
  const answered = presentation?.answeredItemRefs ?? []

  const snapshot: FamilyPilotStudySnapshot = {
    session: {
      householdRef: 'curriculum-preview-r3:ephemeral',
      learnerRef: 'curriculum-preview-r3:reviewer',
      blockRef: `curriculum-preview-r3:${lesson.lessonRef}`,
      sessionRef: `curriculum-preview-r3:${lesson.lessonRef}`,
    },
    lessonRef: lesson.lessonRef,
    title: lesson.material.title,
    assignmentState: completed ? 'completed' : 'active',
    sessionStatus: completed ? 'completed' : 'active',
    segmentRef: completed ? null : segmentRef,
    segmentOrdinal: completed ? null : segmentOrdinal,
    completedSegmentRefs: segmentRefs.slice(0, completed ? SEGMENT_COUNT : segmentOrdinal - 1),
    remainingSegmentRefs: completed ? [] : segmentRefs.slice(segmentOrdinal - 1),
    elapsedActiveSecondsInSegment: 0,
    checkpointRef: null,
    checkpointRevision: 0,
    presentationProgressRef: cursor,
    lastAcceptedEventRef: null,
    masteryAuthority: 'completion-only',
    tutorBridgeAvailable: false,
    requiredWorkCompletionPercent: presentation?.requiredItemRefs.length
      ? Math.round((presentation.requiredItemRefs.filter((ref) => answered.includes(ref)).length / presentation.requiredItemRefs.length) * 100)
      : 100,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }

  const submit = async (responseText: string) => {
    if (!item) return
    setBusy(true)
    const result = await runtime.submit({
      lessonRef: lesson.lessonRef,
      sectionRef: item.sectionRef,
      itemRef: item.itemRef,
      segmentRef,
      value: responseText,
    })
    setRejection(result.status === 'rejected' ? result.message : null)
    await refresh()
    setBusy(false)
  }

  // The runtime, not the host, decides when a part is finished. A part with an unanswered
  // required response never advances, so viewing a page can never stand in for a response.
  const advance = () => {
    if (!presentation?.canCompleteSegment) {
      setRejection('Answer every question in this part before finishing it.')
      return
    }
    setCursor(null)
    setRejection(null)
    if (segmentOrdinal < SEGMENT_COUNT) setSegmentOrdinal((value) => value + 1)
    else setCompleted(true)
  }

  const restart = () => {
    setCursor(renderModel.pages.find((page) => page.role === 'LEARN')?.progressRef ?? null)
    setRejection(null)
    setCompleted(false)
    setSegmentOrdinal(1)
    setAttempt((value) => value + 1)
  }

  return (
    <main className="science-r3-preview">
      <header className="science-r3-preview__header">
        <p className="science-r3-preview__kicker">Manuel Academy · Science R3 Wave 1 · non-production preview</p>
        <h1>Grade {lesson.grade} Science — {lesson.title}</h1>
        <p>{lesson.course} · {lesson.unitTitle} · course day {lesson.courseDay} of {lesson.courseLessonCount}</p>
        <dl className="science-r3-preview__facts">
          <div><dt>Lesson</dt><dd><code>{lesson.lessonRef}</code></dd></div>
          <div><dt>Standards</dt><dd>{lesson.standards.join(', ')}</dd></div>
          <div><dt>Phase</dt><dd>{lesson.phase}</dd></div>
          <div><dt>Source</dt><dd><code>{lesson.lessonPath}</code></dd></div>
        </dl>
      </header>

      <p className="science-r3-preview__boundary" role="note">
        The lesson below is the real Rich Study Player. Responses are held in memory for this tab only.
        No learner progress, assignment, School Plan, or Family Cloud record is created or changed here,
        and nothing is written to this device. Reloading clears the attempt.
      </p>

      {rejection ? <p className="science-r3-preview__rejection" role="alert">{rejection}</p> : null}

      <section className="science-r3-preview__player" aria-label={`Grade ${lesson.grade} Science Rich Study Player`}>
        <FamilyPilotLessonPlayer
          status={completed ? 'completed' : 'active'}
          snapshot={snapshot}
          segmentContent={{
            title: item?.title,
            instruction: item?.instruction,
            prompt: item?.prompt,
            example: item?.example,
            lessonRef: lesson.lessonRef,
            sectionRef: item?.sectionRef,
            itemRef: item?.itemRef,
            responseKind: item?.responseType ?? 'none',
            choices: item?.choices.map((choice) => ({ id: choice.choiceRef, label: choice.label })),
            pendingAssessmentCount: presentation?.pendingAssessmentCount ?? 0,
            answeredItemRefs: answered,
            requiredItemRefs: presentation?.requiredItemRefs ?? [],
            canCompleteSegment: presentation?.canCompleteSegment ?? false,
            assessmentDecisions: presentation?.assessmentDecisions ?? {},
          }}
          renderModel={renderModel}
          tutorHelpAvailable={false}
          busy={busy}
          onSubmitAction={(responseText) => { void submit(responseText) }}
          onPause={(progressRef) => setCursor(progressRef ?? null)}
          onResume={() => undefined}
          onNext={advance}
          onCompleteSegment={advance}
          onOpenTutor={() => undefined}
          onExit={(progressRef) => setCursor(progressRef ?? null)}
          onReviewLesson={restart}
        />
      </section>

      <footer className="science-r3-preview__footer">
        <button type="button" onClick={restart}>Start this lesson over</button>
        <p>Saved responses stay <strong>PENDING_ASSESSMENT</strong>: this preview supplies no assessor, so the browser makes no correctness or mastery claim.</p>
      </footer>
    </main>
  )
}

export function ScienceR3Preview() {
  const [lesson] = SCIENCE_R3_PREVIEW_LESSONS
  if (!lesson) {
    return (
      <main className="science-r3-preview">
        <h1>No authored Science R3 lesson</h1>
        <p>The Wave 1 manifest reports no authored lesson to preview.</p>
      </main>
    )
  }
  return <PreviewLesson key={lesson.lessonRef} lesson={lesson} />
}

export default ScienceR3Preview
