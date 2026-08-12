import type { CanonicalStudyTaskType, StudyLessonPlan, StudyPlanSegment } from '../../../types'
import type { ArtsMusicLessonRef } from './types'

/**
 * ARTS-MUSIC-1 — a local, subject-owned Study segment adaptation. It mirrors
 * the shape adaptHostLessonToStudyPlan (src/study/curriculumAdapter.ts)
 * produces, but is derived from each lesson's own lessonFlow rather than a
 * fixed lookup table, so a learner previewing an Arts & Music lesson sees
 * its real step titles (Welcome and retrieval / Model or mini-lesson /
 * Guided practice / Independent application / Exit ticket and next step)
 * instead of a generic placeholder.
 *
 * Every taskType used below is an existing CanonicalStudyTaskType member —
 * this file adds no new engine vocabulary. It does not add a
 * HostStudyLessonKind row to curriculumAdapter.ts (that file is shared
 * across every subject lane and outside this lane's ownership). When an
 * Arts & Music assignment is actually started through
 * FamilyPilotStudyRuntime, its HostLessonDescriptor uses kind:
 * 'parent-created' (see curriculumPort.ts), which already resolves through
 * the existing, reviewed completion-only path — "Study completion uses
 * existing runtime authority," not a subject-invented one. This adapter is
 * the source of truth for what the learner sees while previewing/working
 * the lesson; adaptHostLessonToStudyPlan is what the runtime record tracks.
 */

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

function parseMinutes(range: string): number {
  const numbers = range.match(/\d+/g)?.map(Number) ?? []
  if (numbers.length === 0) return 10
  const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
  return Math.max(1, Math.round(average))
}

interface SegmentClassification {
  readonly taskType: CanonicalStudyTaskType
  readonly customTaskTypeId?: string
  readonly suffix: string
}

/** Keyword classification, not an exact-string lookup, so a future content
 * revision that rewords a step title still lands on a sensible taskType
 * instead of throwing. */
function classifySegment(name: string): SegmentClassification {
  const lower = name.toLowerCase()
  if (lower.includes('retriev') || lower.includes('welcome') || lower.includes('warm')) {
    return { taskType: 'retrieval-practice', suffix: 'retrieve' }
  }
  if (lower.includes('model') || lower.includes('mini-lesson') || lower.includes('teach')) {
    return { taskType: 'direct-instruction', suffix: 'teach' }
  }
  if (lower.includes('guided')) {
    return { taskType: 'guided-practice', suffix: 'guide' }
  }
  if (lower.includes('independent')) {
    return { taskType: 'independent-practice', suffix: 'try' }
  }
  if (lower.includes('exit') || lower.includes('reflect') || lower.includes('next step')) {
    return { taskType: 'reflection', suffix: 'reflect' }
  }
  return { taskType: 'custom', customTaskTypeId: 'arts-music-segment', suffix: 'segment' }
}

export function adaptArtsMusicLessonToStudyPlan(lesson: ArtsMusicLessonRef): StudyLessonPlan {
  if (!SAFE_REF.test(lesson.lessonId)) throw new Error('lessonId must be a stable opaque reference.')
  if (!lesson.title.trim()) throw new Error('Lesson title is required.')

  const segments: StudyPlanSegment[] = lesson.lessonFlow.map((flowSegment, index) => {
    const classification = classifySegment(flowSegment.segment)
    const segmentRef = `${lesson.lessonId}:segment:${classification.suffix}-${index}`
    if (!SAFE_REF.test(segmentRef)) throw new Error('segmentRef must be a stable opaque reference.')
    return {
      segmentRef,
      title: flowSegment.segment,
      taskType: classification.taskType,
      ...(classification.customTaskTypeId ? { customTaskTypeId: classification.customTaskTypeId } : {}),
      estimatedMinutes: parseMinutes(flowSegment.minutes),
      required: true,
    }
  })

  return {
    lessonRef: lesson.lessonId,
    title: lesson.title,
    subject: 'other',
    skillRefs: [`${lesson.courseId}:unit:${lesson.unitNumber}`],
    segments,
    masteryAuthority: 'completion-only',
    source: 'manuel-academy',
  }
}
