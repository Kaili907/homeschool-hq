import type { CanonicalStudyTaskType, StudyLessonPlan, StudyPlanSegment, StudySubject } from '../../../../types'
import type { TechCsLessonRef } from '../catalog/types'

/**
 * FF-M7 — projects a technology/CS lesson into the existing generic Study
 * Engine segment shape (src/study/types.ts's StudyPlanSegment / StudyLessonPlan),
 * the same contract src/study/curriculumAdapter.ts's HOST_STUDY_MAPPING uses
 * for every other subject. StudySubject has no technology-specific value, so
 * this uses 'other' — the same escape hatch 'review' and 'parent-created'
 * already use there.
 *
 * Every canonical lesson has the same 5-part lesson_flow (Welcome and
 * retrieval, Model or mini-lesson, Guided practice, Independent application,
 * Exit ticket), so the segment shape is fixed; only the last two segments'
 * taskType shifts with the lesson's day-level phase (dayPhase), so a project
 * day surfaces as project-work and a mastery-check day surfaces as
 * mastery-check instead of the ordinary independent-practice/reflection pair.
 */

const STUDY_SUBJECT: StudySubject = 'other'

interface SegmentSpec {
  readonly suffix: 'retrieve' | 'teach' | 'guide' | 'apply' | 'check'
  readonly title: string
  readonly estimatedMinutes: number
}

const SEGMENT_SPECS: readonly SegmentSpec[] = [
  { suffix: 'retrieve', title: 'Warm-up recall', estimatedMinutes: 6 },
  { suffix: 'teach', title: 'New idea', estimatedMinutes: 10 },
  { suffix: 'guide', title: 'Work together', estimatedMinutes: 14 },
  { suffix: 'apply', title: 'Independent application', estimatedMinutes: 20 },
  { suffix: 'check', title: 'Exit ticket', estimatedMinutes: 6 },
]

function taskTypeFor(spec: SegmentSpec, lesson: TechCsLessonRef): CanonicalStudyTaskType {
  switch (spec.suffix) {
    case 'retrieve':
      return 'retrieval-practice'
    case 'teach':
      return 'direct-instruction'
    case 'guide':
      return 'guided-practice'
    case 'apply':
      return lesson.dayPhase === 'application-project' ? 'project-work' : 'independent-practice'
    case 'check':
      return lesson.dayPhase === 'mastery-check' ? 'mastery-check' : 'reflection'
  }
}

export function techCsSegmentRef(lesson: TechCsLessonRef, suffix: SegmentSpec['suffix']): string {
  return `${lesson.lessonId}:segment:${suffix}`
}

/** The lesson's Study-compatible segments, in fixed lesson_flow order. Pure —
 * same lesson in, same segment refs and shape out, every time. */
export function techCsLessonSegments(lesson: TechCsLessonRef): readonly StudyPlanSegment[] {
  return SEGMENT_SPECS.map((spec) => ({
    segmentRef: techCsSegmentRef(lesson, spec.suffix),
    title: spec.title,
    taskType: taskTypeFor(spec, lesson),
    estimatedMinutes: spec.estimatedMinutes,
    required: true,
  }))
}

/**
 * The full Study-compatible lesson plan. masteryAuthority is
 * 'completion-only': technology/CS lessons have no single answer-checked
 * problem for live Tutor Core to grade (see tutor/staticExplanation.ts), so
 * grading authority stays with the human, matching the same choice
 * HOST_STUDY_MAPPING makes for parent-created and Romeo Virtual Academy work.
 */
export function techCsLessonPlan(lesson: TechCsLessonRef): StudyLessonPlan {
  return {
    lessonRef: lesson.lessonId,
    title: lesson.title,
    subject: STUDY_SUBJECT,
    skillRefs: [`${lesson.courseId}:unit:${lesson.unitNumber}`],
    segments: techCsLessonSegments(lesson),
    masteryAuthority: 'completion-only',
    source: 'manuel-academy',
  }
}
