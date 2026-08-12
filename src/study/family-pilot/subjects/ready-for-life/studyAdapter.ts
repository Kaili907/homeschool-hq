import type {
  CanonicalStudyTaskType,
  StudyCalendarBlockKind,
  StudyLessonPlan,
  StudyPlanSegment,
  StudySubject,
} from '../../../types'
import type { RflLessonRef } from './types'

/**
 * FULL-FAMILY-READY-FOR-LIFE-STUDY — projects a Ready for Life lesson into
 * the existing Study shapes (src/study/types.ts) so the existing Study
 * runtime's session/progress/resume authority can run it, the same way
 * ../../curriculumAdapter.ts projects host lessons. This lane doesn't touch
 * curriculumAdapter.ts or its closed HostStudyLessonKind mapping — it builds
 * an equivalent StudyLessonPlan directly from the lesson's own authored
 * lesson_flow, which curriculumAdapter.ts has no entry for.
 *
 * masteryAuthority is 'completion-only': Ready for Life tasks are household
 * routines, not Tutor Core–graded problems. Real-world-action lessons still
 * gate on guardian confirmation before completion — see completionEvidence.ts.
 * That gate is enforced by the completion adapter, not by masteryAuthority.
 */

/** Every lesson_flow segment name that appears across the whole course,
 * fixed order, mapped once. Confirmed exhaustive at test time. */
const SEGMENT_TASK_TYPE: Readonly<Record<string, { readonly suffix: string; readonly taskType: CanonicalStudyTaskType }>> = {
  'Welcome and retrieval': { suffix: 'retrieve', taskType: 'retrieval-practice' },
  'Model or mini-lesson': { suffix: 'model', taskType: 'direct-instruction' },
  'Guided practice': { suffix: 'guide', taskType: 'guided-practice' },
  'Independent application': { suffix: 'apply', taskType: 'independent-practice' },
  'Exit ticket and next step': { suffix: 'reflect', taskType: 'reflection' },
}

export const READY_FOR_LIFE_STUDY_SUBJECT: StudySubject = 'other'
export const READY_FOR_LIFE_BLOCK_KIND: StudyCalendarBlockKind = 'project_work'

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

/** "5–8" or "5-8" (en dash or hyphen) -> the midpoint, rounded up. A single
 * "20" parses as itself. */
function parseMinutes(range: string): number {
  const parts = range.split(/[–-]/).map((part) => Number.parseInt(part.trim(), 10))
  if (parts.length === 0 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Cannot parse a minutes value from "${range}"`)
  }
  const sum = parts.reduce((total, part) => total + part, 0)
  return Math.ceil(sum / parts.length)
}

export function adaptReadyForLifeLessonToStudyPlan(lesson: RflLessonRef): StudyLessonPlan {
  if (!SAFE_REF.test(lesson.lessonId)) throw new Error('lessonId must be a stable opaque reference.')

  const segments: StudyPlanSegment[] = lesson.lessonFlow.map((step) => {
    const mapping = SEGMENT_TASK_TYPE[step.segment]
    if (!mapping) throw new Error(`Unrecognized lesson_flow segment "${step.segment}" for ${lesson.lessonId}`)
    const segmentRef = `${lesson.lessonId}:segment:${mapping.suffix}`
    if (!SAFE_REF.test(segmentRef)) throw new Error('segmentRef must be a stable opaque reference.')
    return {
      segmentRef,
      title: step.segment,
      taskType: mapping.taskType,
      estimatedMinutes: parseMinutes(step.minutes),
      required: true,
    }
  })

  return {
    lessonRef: lesson.lessonId,
    title: lesson.title,
    subject: READY_FOR_LIFE_STUDY_SUBJECT,
    skillRefs: [`${lesson.courseId}:unit:${lesson.unitNumber}`],
    segments,
    masteryAuthority: 'completion-only',
    source: 'manuel-academy',
  }
}
