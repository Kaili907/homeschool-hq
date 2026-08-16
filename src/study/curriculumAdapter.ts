import type {
  CanonicalStudyTaskType,
  StudyCalendarBlockKind,
  StudyLessonPlan,
  StudyPlanSegment,
  StudySubject,
} from './types'

export type HostStudyLessonKind =
  | 'math'
  | 'reading'
  | 'writing'
  | 'manuel-academy-activity'
  | 'quiz-practice'
  | 'quiz-assessment'
  | 'review'
  | 'parent-created'
  | 'romeo-virtual-academy'

export interface HostLessonDescriptor {
  readonly lessonRef: string
  readonly title: string
  readonly kind: HostStudyLessonKind
  readonly skillRefs: readonly string[]
  readonly segmentRefs?: readonly string[]
}

interface MappingRow {
  readonly subject: StudySubject
  readonly blockKind: StudyCalendarBlockKind
  readonly source: StudyLessonPlan['source']
  readonly masteryAuthority: StudyLessonPlan['masteryAuthority']
  readonly segments: readonly {
    readonly suffix: string
    readonly title: string
    readonly taskType: CanonicalStudyTaskType
    readonly customTaskTypeId?: string
    readonly estimatedMinutes: number
  }[]
}

export const HOST_STUDY_MAPPING: Readonly<Record<HostStudyLessonKind, MappingRow>> = {
  'manuel-academy-activity': {
    subject: 'other',
    blockKind: 'new_instruction',
    source: 'manuel-academy',
    masteryAuthority: 'completion-only',
    segments: [
      { suffix: 'learn', title: 'Learn from the lesson', taskType: 'direct-instruction', estimatedMinutes: 8 },
      { suffix: 'practice', title: 'Complete the student work', taskType: 'independent-practice', estimatedMinutes: 12 },
      { suffix: 'reflect', title: 'Review what you learned', taskType: 'reflection', estimatedMinutes: 5 },
    ],
  },
  math: {
    subject: 'math',
    blockKind: 'new_instruction',
    source: 'manuel-academy',
    masteryAuthority: 'tutor-core',
    segments: [
      { suffix: 'retrieve', title: 'Warm-up recall', taskType: 'retrieval-practice', estimatedMinutes: 4 },
      { suffix: 'teach', title: 'New idea', taskType: 'direct-instruction', estimatedMinutes: 6 },
      { suffix: 'guide', title: 'Work together', taskType: 'guided-practice', estimatedMinutes: 8 },
      { suffix: 'try', title: 'Try independently', taskType: 'independent-practice', estimatedMinutes: 8 },
      { suffix: 'check', title: 'Tutor checkpoint', taskType: 'mastery-check', estimatedMinutes: 4 },
    ],
  },
  reading: {
    subject: 'reading',
    blockKind: 'reading',
    source: 'manuel-academy',
    masteryAuthority: 'tutor-core',
    segments: [
      { suffix: 'preview', title: 'Preview the passage', taskType: 'direct-instruction', estimatedMinutes: 4 },
      { suffix: 'read', title: 'Read one section', taskType: 'reading', estimatedMinutes: 12 },
      { suffix: 'reflect', title: 'Explain the main idea', taskType: 'reflection', estimatedMinutes: 5 },
    ],
  },
  writing: {
    subject: 'writing',
    blockKind: 'writing',
    source: 'manuel-academy',
    masteryAuthority: 'tutor-core',
    segments: [
      { suffix: 'plan', title: 'Plan the response', taskType: 'direct-instruction', estimatedMinutes: 5 },
      { suffix: 'draft', title: 'Draft one section', taskType: 'writing', estimatedMinutes: 15 },
      { suffix: 'review', title: 'Review and reflect', taskType: 'reflection', estimatedMinutes: 5 },
    ],
  },
  'quiz-practice': {
    subject: 'math',
    blockKind: 'independent_practice',
    source: 'manuel-academy',
    masteryAuthority: 'tutor-core',
    segments: [
      { suffix: 'retrieve', title: 'Recall key ideas', taskType: 'retrieval-practice', estimatedMinutes: 5 },
      { suffix: 'practice', title: 'Practice questions', taskType: 'independent-practice', estimatedMinutes: 15 },
    ],
  },
  'quiz-assessment': {
    subject: 'math',
    blockKind: 'assessment',
    source: 'manuel-academy',
    masteryAuthority: 'tutor-core',
    segments: [{ suffix: 'check', title: 'Tutor-governed check', taskType: 'mastery-check', estimatedMinutes: 20 }],
  },
  review: {
    subject: 'other',
    blockKind: 'review',
    source: 'manuel-academy',
    masteryAuthority: 'tutor-core',
    segments: [
      { suffix: 'retrieve', title: 'Recall from memory', taskType: 'retrieval-practice', estimatedMinutes: 8 },
      { suffix: 'reflect', title: 'Review reflection', taskType: 'reflection', estimatedMinutes: 4 },
    ],
  },
  'parent-created': {
    subject: 'other',
    blockKind: 'parent_created_activity',
    source: 'parent',
    masteryAuthority: 'completion-only',
    segments: [
      {
        suffix: 'activity',
        title: 'Parent-created activity',
        taskType: 'custom',
        customTaskTypeId: 'parent-created-activity',
        estimatedMinutes: 20,
      },
    ],
  },
  'romeo-virtual-academy': {
    subject: 'other',
    blockKind: 'romeo_virtual_academy_activity',
    source: 'romeo-virtual-academy',
    masteryAuthority: 'completion-only',
    segments: [
      {
        suffix: 'reference',
        title: 'Romeo Virtual Academy activity',
        taskType: 'custom',
        customTaskTypeId: 'romeo-virtual-academy-activity',
        estimatedMinutes: 30,
      },
    ],
  },
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

export function adaptHostLessonToStudyPlan(input: HostLessonDescriptor): StudyLessonPlan {
  if (!SAFE_REF.test(input.lessonRef)) throw new Error('lessonRef must be a stable opaque reference.')
  if (!input.title.trim()) throw new Error('Lesson title is required.')
  input.skillRefs.forEach((ref) => {
    if (!SAFE_REF.test(ref)) throw new Error('skillRefs must be stable opaque references.')
  })
  const mapping = HOST_STUDY_MAPPING[input.kind]
  if (input.segmentRefs && input.segmentRefs.length !== mapping.segments.length) {
    throw new Error('Caller-authored segmentRefs must match the canonical segment count.')
  }
  const segments: StudyPlanSegment[] = mapping.segments.map((segment, index) => {
    const segmentRef = input.segmentRefs?.[index] ?? `${input.lessonRef}:segment:${segment.suffix}`
    if (!SAFE_REF.test(segmentRef)) throw new Error('segmentRef must be a stable opaque reference.')
    return {
      segmentRef,
      title: segment.title,
      taskType: segment.taskType,
      ...(segment.customTaskTypeId ? { customTaskTypeId: segment.customTaskTypeId } : {}),
      estimatedMinutes: segment.estimatedMinutes,
      required: true,
    }
  })
  return {
    lessonRef: input.lessonRef,
    title: input.title.trim(),
    subject: mapping.subject,
    skillRefs: [...input.skillRefs],
    segments,
    masteryAuthority: mapping.masteryAuthority,
    source: mapping.source,
  }
}

/** Legacy QuizSession remains outside Study; this describes its future presentation-only seam. */
export const LEGACY_QUIZ_INTEGRATION_POLICY = Object.freeze({
  current: 'legacy-flow-remains-available',
  studyUse: 'presentation-only-after-accepted-tutor-receipt',
  masteryAuthority: 'tutor-core',
})
