import { useMemo, useState } from 'react'
import { FamilyPilotLessonPlayer, createRichLessonRenderModel } from '../family-pilot/lesson-player'
import { mapLearnerMaterialToStudySegments, type LearnerMaterialDto } from '../family-pilot/final-app/learner-response'
import type { FamilyPilotStudySnapshot } from '../family-pilot/study'
import { SOCIAL_STUDIES_R3_PREVIEW_PATH } from './route'

import grade3Unit8Lesson7 from '../../../curriculum-production/social-studies-r3/lessons/grade-03/ma-g3-social-studies-u08-l07.lesson.json'

/**
 * Ephemeral Director preview for Social Studies Production R3.
 *
 * Same posture as the frozen R2 gallery and the Mathematics R3 preview: it mounts the
 * real Rich Study Player over a throwaway in-memory session. It never writes learner
 * progress, assignments, or cloud data, and it introduces no engine, runtime, or lesson
 * model of its own.
 */

interface R3Lesson extends LearnerMaterialDto {
  readonly grade: number
  readonly unitRef: string
  readonly productionStatus: string
  readonly courseProgress: { readonly day: number; readonly totalDays: number }
  readonly sourceIntegrity: { readonly policy: string; readonly sources: readonly string[] }
}

// Static imports, matching the proven pattern in the frozen R2 gallery registry.
const LESSONS: readonly R3Lesson[] = [
  grade3Unit8Lesson7 as unknown as R3Lesson,
]

function selectedLesson(): R3Lesson | null {
  const requested = new URLSearchParams(window.location.search).get('lesson')
  return LESSONS.find((lesson) => lesson.lessonRef === requested) ?? LESSONS[0] ?? null
}

function LessonPreview({ lesson }: { readonly lesson: R3Lesson }) {
  const renderModel = useMemo(() => createRichLessonRenderModel(lesson), [lesson])
  const responseModel = useMemo(() => mapLearnerMaterialToStudySegments(lesson), [lesson])
  const [segmentOrdinal, setSegmentOrdinal] = useState(1)
  const [status, setStatus] = useState<'active' | 'completed'>('active')
  const [answered, setAnswered] = useState<readonly string[]>([])
  const [cursor, setCursor] = useState<string | null>(null)

  const role = segmentOrdinal === 1 ? 'LEARN' : segmentOrdinal === 2 ? 'PRACTICE' : 'REFLECT'
  const roleItems = responseModel.segments.find((segment) => segment.role === role)?.items ?? []
  const unanswered = roleItems.find((item) => item.required && !answered.includes(item.itemRef)) ?? null
  const lessonRef = lesson.lessonRef
  const segmentRefs = [`${lessonRef}:learn`, `${lessonRef}:practice`, `${lessonRef}:reflect`]
  const requiredTotal = responseModel.segments.flatMap((segment) => segment.items).filter((item) => item.required).length

  const snapshot: FamilyPilotStudySnapshot = {
    session: {
      householdRef: 'social-studies-r3-preview:ephemeral', learnerRef: 'social-studies-r3-preview:reviewer',
      blockRef: `social-studies-r3-preview:${lessonRef}`, sessionRef: `social-studies-r3-preview:${lessonRef}`,
    },
    lessonRef,
    title: lesson.title,
    assignmentState: status === 'completed' ? 'completed' : 'active',
    sessionStatus: status === 'completed' ? 'completed' : 'active',
    segmentRef: status === 'completed' ? null : segmentRefs[segmentOrdinal - 1]!,
    segmentOrdinal: status === 'completed' ? null : segmentOrdinal,
    completedSegmentRefs: segmentRefs.slice(0, status === 'completed' ? 3 : segmentOrdinal - 1),
    remainingSegmentRefs: status === 'completed' ? [] : segmentRefs.slice(segmentOrdinal - 1),
    elapsedActiveSecondsInSegment: 0,
    checkpointRef: null,
    checkpointRevision: 0,
    presentationProgressRef: cursor,
    lastAcceptedEventRef: null,
    masteryAuthority: 'completion-only',
    tutorBridgeAvailable: false,
    requiredWorkCompletionPercent: Math.round((answered.length / Math.max(1, requiredTotal)) * 100),
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }

  const segmentContent = {
    title: unanswered?.title,
    instruction: unanswered?.instruction,
    prompt: unanswered?.prompt,
    example: unanswered?.example,
    lessonRef,
    sectionRef: unanswered?.sectionRef,
    itemRef: unanswered?.itemRef,
    responseKind: unanswered?.responseType ?? 'none' as const,
    choices: unanswered?.choices.map((choice) => ({ id: choice.choiceRef, label: choice.label })),
    pendingAssessmentCount: answered.length,
    answeredItemRefs: answered,
    requiredItemRefs: roleItems.filter((item) => item.required).map((item) => item.itemRef),
    canCompleteSegment: !unanswered,
    assessmentDecisions: Object.fromEntries(answered.map((itemRef) => [itemRef, 'REVIEW_REQUIRED' as const])),
  }

  const advanceSegment = () => {
    setCursor(null)
    if (segmentOrdinal < 3) setSegmentOrdinal((value) => value + 1)
    else setStatus('completed')
  }
  const restart = () => {
    setStatus('active')
    setSegmentOrdinal(1)
    setAnswered([])
    setCursor(renderModel.pages.find((page) => page.role === 'LEARN')?.progressRef ?? null)
  }

  const unitNumber = Number(lesson.unitRef.slice(-2))
  return (
    <div className="social-studies-r3-preview">
      <header>
        <p>Social Studies Production R3 · ephemeral preview · {lesson.productionStatus}</p>
        <h1>Grade {lesson.grade} Social Studies · Unit {unitNumber}, course day {lesson.courseProgress.day} of {lesson.courseProgress.totalDays}</h1>
        <p>{lessonRef} · {lesson.title}</p>
      </header>
      <p role="note">
        Preview controls end here. The lesson below is the real Rich Study Player. Responses exist
        only in memory and reset when this page is reloaded. Nothing is saved to learner progress.
      </p>
      <p role="note">Source integrity: {lesson.sourceIntegrity.policy}</p>
      <section aria-label={`Grade ${lesson.grade} Social Studies Rich Study Player`}>
        <FamilyPilotLessonPlayer
          status={status}
          snapshot={snapshot}
          segmentContent={segmentContent}
          renderModel={renderModel}
          tutorHelpAvailable={false}
          onSubmitAction={() => { if (unanswered) setAnswered((held) => held.includes(unanswered.itemRef) ? held : [...held, unanswered.itemRef]) }}
          onPause={(progressRef) => setCursor(progressRef ?? null)}
          onResume={() => undefined}
          onNext={advanceSegment}
          onCompleteSegment={advanceSegment}
          onOpenTutor={() => undefined}
          onExit={restart}
          onReviewLesson={restart}
        />
      </section>
    </div>
  )
}

export default function SocialStudiesR3PreviewRoute() {
  const lesson = selectedLesson()
  if (!lesson) {
    return (
      <main>
        <h1>Social Studies Production R3 preview</h1>
        <p>No R3 lesson files were found under <code>curriculum-production/social-studies-r3/lessons</code>.</p>
      </main>
    )
  }
  return <LessonPreview lesson={lesson} />
}

export { SOCIAL_STUDIES_R3_PREVIEW_PATH }
