import type { CanonicalStudyTaskType, StudyLessonPlan, StudyPlanSegment } from '../../../types'
import type { ScienceLessonDetail } from './types'

/**
 * FAMILY-PILOT-SCIENCE-1 — the Study adapter.
 *
 * This does not invent a new lesson shape. Every science lesson's own
 * lesson_flow is already a fixed five-part sequence (Welcome and retrieval,
 * Model or mini-lesson, Guided practice, Independent application, Exit
 * ticket and next step) — the same reviewed shape
 * src/study/curriculumAdapter.ts's HOST_STUDY_MAPPING.math segments already
 * use (retrieve, teach, guide, try, check). This maps each science lesson's
 * own five real segment titles onto that same canonical task-type sequence,
 * rather than routing through the 'math' host-lesson kind — which would
 * mislabel every science block's subject and its Tutor static-help copy as
 * math (see tutorCapability.ts).
 */

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

const SEGMENT_TASK_TYPES: readonly CanonicalStudyTaskType[] = [
  'retrieval-practice',
  'direct-instruction',
  'guided-practice',
  'independent-practice',
  'mastery-check',
]

/** "5–8" / "45–65" → the midpoint, rounded. Source ranges always parse to at
 * least one integer; loadScienceCatalog would already have rejected a lesson
 * whose lesson_flow minutes were not a plain string before this ever runs. */
function parseEstimatedMinutes(range: string): number {
  const numbers = range.match(/\d+/g)?.map(Number) ?? []
  if (numbers.length === 0) {
    throw new Error(`Cannot parse estimated minutes from "${range}"`)
  }
  const sum = numbers.reduce((total, value) => total + value, 0)
  return Math.round(sum / numbers.length)
}

function assertSafeRef(value: string, label: string): void {
  if (!SAFE_REF.test(value)) throw new Error(`${label} must be a stable opaque reference.`)
}

/** Projects one science lesson onto the Study runtime's canonical lesson
 * plan. Pure — safe to call during render, same as the math pilot's
 * adaptHostLessonToStudyPlan. */
export function adaptScienceLessonToStudy(lesson: ScienceLessonDetail): StudyLessonPlan {
  assertSafeRef(lesson.lessonId, 'Science lessonId')
  if (!lesson.title.trim()) throw new Error('Science lesson title is required.')
  lesson.standards.forEach((ref) => assertSafeRef(ref, 'Science standard ref'))
  if (lesson.lessonFlow.length !== SEGMENT_TASK_TYPES.length) {
    throw new Error(
      `Science lesson ${lesson.lessonId} does not have the expected five-part lesson flow.`,
    )
  }

  const segments: StudyPlanSegment[] = lesson.lessonFlow.map((step, index) => {
    const segmentRef = `${lesson.lessonId}:segment:${index + 1}`
    assertSafeRef(segmentRef, 'Science segmentRef')
    return {
      segmentRef,
      title: step.segment,
      taskType: SEGMENT_TASK_TYPES[index],
      estimatedMinutes: parseEstimatedMinutes(step.minutes),
      required: true,
    }
  })

  return {
    lessonRef: lesson.lessonId,
    title: lesson.title.trim(),
    // Science is neither math, reading, nor writing in the Study runtime's
    // fixed subject set (src/study/types.ts); 'other' is the accurate
    // bucket, matching the same choice already made for review and
    // parent-created content in HOST_STUDY_MAPPING.
    subject: 'other',
    skillRefs: [...lesson.standards],
    segments,
    // Science mastery_rule requires accurate independent evidence on at
    // least two occasions (see safety.ts's masteryRequiresMultipleOccasions)
    // — that is a Tutor Core-governed decision, not mere completion.
    masteryAuthority: 'tutor-core',
    source: 'manuel-academy',
  }
}
