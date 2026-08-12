import { adaptHostLessonToStudyPlan, type HostLessonDescriptor, type HostStudyLessonKind } from '../../../curriculumAdapter'
import type { StudyPlanSegment } from '../../../types'
import type { SocialStudiesLessonRef, SocialStudiesPhase } from './types'

/**
 * FF-M3 — the Study adapter. This is the ONLY place Social Studies lessons
 * turn into something the existing Study Engine understands. It reuses the
 * existing host-lesson kinds and their reviewed segment shapes
 * (src/study/curriculumAdapter.ts) rather than inventing a Social Studies
 * lesson state machine, mastery system, or checkpoint system — see NO
 * REBUILD.
 *
 * Every phase maps to a HostStudyLessonKind whose StudySubject is an
 * honest description of the work, not just the closest segment count:
 *   - source/model/practice phases -> 'reading'  (subject: reading)
 *   - the performance-task/argument-build phase -> 'writing' (subject: writing)
 *   - review/reteach/assessment/reflection phases -> 'review' (subject: other)
 * None of these subjects is 'math', so the existing Tutor bridge's
 * `canHelp` (src/study/family-pilot/tutor/tutorBridge.ts) can never route a
 * Social Studies segment to live Tutor Core — every Tutor interaction here
 * is the static fallback by construction. That is what keeps the Tutor from
 * ever generating the student's graded civic argument: it cannot take a
 * turn at all on this subject, so there is nothing to ghostwrite.
 */
const PHASE_TO_HOST_KIND: Readonly<Record<SocialStudiesPhase, HostStudyLessonKind>> = {
  'Launch and diagnostic': 'reading',
  'Concept model A': 'reading',
  'Guided practice A': 'reading',
  'Independent application A': 'reading',
  'Concept model B': 'reading',
  'Guided practice B': 'reading',
  'Investigation or close reading': 'reading',
  'Reteach and varied practice': 'review',
  'Performance task build': 'writing',
  'Synthesis and review': 'review',
  'Unit assessment': 'review',
  'Correction and reflection': 'review',
}

const SAFE_REF_UNSAFE_CHARS = /[^A-Za-z0-9._:-]/g

function sanitizeRef(value: string): string {
  return value.replace(SAFE_REF_UNSAFE_CHARS, '-').slice(0, 191)
}

/** The stable, opaque HostLessonDescriptor for one Social Studies lesson.
 * Pure: same lesson in, same descriptor out, every time. */
export function toHostLessonDescriptor(lesson: SocialStudiesLessonRef): HostLessonDescriptor {
  const kind = PHASE_TO_HOST_KIND[lesson.phase]
  if (!kind) {
    throw new Error(`Social Studies lesson ${lesson.lessonId} has an unmapped phase "${lesson.phase}"`)
  }
  return {
    lessonRef: lesson.lessonId,
    title: lesson.title,
    kind,
    skillRefs: lesson.standards.map((standard) => sanitizeRef(`${lesson.courseId}:standard:${standard}`)),
  }
}

/** The lesson's segments, derived without a live Study session — same
 * pattern as src/study/family-pilot/integration/curriculum.ts's
 * lessonSegments, since adaptHostLessonToStudyPlan is pure. Segment order is
 * exactly HOST_STUDY_MAPPING's order for the lesson's kind, so it is
 * deterministic across reloads. */
export function lessonSegments(lesson: SocialStudiesLessonRef): readonly StudyPlanSegment[] {
  return adaptHostLessonToStudyPlan(toHostLessonDescriptor(lesson)).segments
}

/** The Core assignment ref for a lesson. Stable, so re-seeding never
 * duplicates — mirrors the format used across the rest of Family Pilot. */
export function assignmentRefFor(lesson: SocialStudiesLessonRef): string {
  return `assignment:${sanitizeRef(lesson.lessonId)}`
}
