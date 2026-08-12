import { adaptHostLessonToStudyPlan, type HostLessonDescriptor } from '../../../curriculumAdapter'
import type { StudyLessonPlan } from '../../../types'
import type { FamilyPilotAssignment } from '../../study/types'
import type { HealthLesson } from './types'

/**
 * Health's Study Engine adapter.
 *
 * This does not add a new HostStudyLessonKind: that enum
 * (src/study/curriculumAdapter.ts) is shared across every Family Pilot
 * subject module landing in parallel and is out of this module's ownership
 * (src/study/family-pilot/subjects/health/**). Health lessons ride the
 * existing 'review' kind instead — subject 'other', source 'manuel-academy'.
 * That kind's masteryAuthority label is 'tutor-core', but the Tutor Core
 * bridge only ever activates for subject 'math' (see
 * familyPilotTutorBridgeAvailable in FamilyPilotStudyRuntime.ts), so every
 * Health assignment degrades to completion-only recording in practice: no
 * grading call is ever made against Health content, and no new mastery
 * engine or progression state is introduced. Multi-occasion mastery stays
 * exactly what the curriculum's own mastery_rule field describes (repeated,
 * varied exposure across lessons) rather than a per-answer grading decision.
 */

/** Refs are opaque and must satisfy the Study adapter's SAFE_REF. */
function sanitizeRef(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 120)
}

export function toHostLessonDescriptor(lesson: HealthLesson): HostLessonDescriptor {
  return {
    lessonRef: sanitizeRef(lesson.lessonId),
    title: lesson.title,
    kind: 'review',
    skillRefs: [sanitizeRef(`${lesson.courseId}:unit:${lesson.unitNumber}`)],
  }
}

/** Wraps a Health lesson as a Family Pilot Study assignment for FamilyPilotStudyRuntime.startAssignment. */
export function toFamilyPilotAssignment(lesson: HealthLesson): FamilyPilotAssignment {
  return { kind: 'static-curriculum', lesson: toHostLessonDescriptor(lesson) }
}

/**
 * The lesson's Study segment plan, derived without a live Study session —
 * adaptHostLessonToStudyPlan is pure, so this is safe to call during render.
 */
export function healthLessonStudyPlan(lesson: HealthLesson): StudyLessonPlan {
  return adaptHostLessonToStudyPlan(toHostLessonDescriptor(lesson))
}

export function healthLessonSegments(
  lesson: HealthLesson,
): readonly { readonly segmentRef: string; readonly title: string; readonly estimatedMinutes: number }[] {
  return healthLessonStudyPlan(lesson).segments.map((segment) => ({
    segmentRef: segment.segmentRef,
    title: segment.title,
    estimatedMinutes: segment.estimatedMinutes,
  }))
}
