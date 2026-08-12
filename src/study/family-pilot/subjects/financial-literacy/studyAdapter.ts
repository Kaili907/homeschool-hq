import { adaptHostLessonToStudyPlan, type HostLessonDescriptor } from '../../../curriculumAdapter'
import type { AcademyGrade } from '../../../../types'
import type { StudyLessonPlan } from '../../../types'
import { getAssignments } from './catalog'
import type { FinancialLiteracyCatalog, FinLitLessonRef, FinLitStudentRef } from './types'

/**
 * FAMILY-PILOT-FINLIT-1 — the Study adapter.
 *
 * StudySubject ('math' | 'reading' | 'writing' | 'other') has no financial-
 * literacy member, and the Tutor Core bridge only grades math — see
 * src/study/runtimeFacade.ts and src/study/family-pilot/tutor/tutorBridge.ts.
 * So every financial-literacy lesson maps onto the existing 'parent-created'
 * host kind (src/study/curriculumAdapter.ts): subject 'other', masteryAuthority
 * 'completion-only'. This is not a downgrade invented for this lane — it is
 * the same seam 'romeo-virtual-academy' content already uses for non-Tutor-Core
 * material. Reviewed generators (see practiceBridge.ts) may supply ungraded
 * practice, but only this adapter's plan ever reaches the Study Engine, so
 * lesson progress is always recorded as completion, never as an invented
 * mastery decision.
 */

/** Refs are opaque and must satisfy the Study adapter's SAFE_REF. */
function sanitizeRef(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 120)
}

export interface FinancialLiteracyCurriculumPort {
  /** Assignable lessons for a grade, in course completion order. */
  readonly listLessons: (grade: AcademyGrade) => readonly HostLessonDescriptor[]
}

export function hostLessonFor(lesson: FinLitLessonRef): HostLessonDescriptor {
  return {
    lessonRef: sanitizeRef(lesson.lessonId),
    title: lesson.title,
    kind: 'parent-created',
    skillRefs: [sanitizeRef(`${lesson.courseId}:unit:${lesson.unitNumber}`)],
  }
}

/** The real catalog port. Every lesson is host kind 'parent-created', so it
 * inherits the reviewed single-segment completion-only shape from
 * HOST_STUDY_MAPPING rather than a pilot-invented one. */
export function financialLiteracyCurriculumPort(catalog: FinancialLiteracyCatalog): FinancialLiteracyCurriculumPort {
  return {
    listLessons: (grade) =>
      getAssignments(catalog, { studentRef: 'catalog-query', grade } satisfies FinLitStudentRef).map(hostLessonFor),
  }
}

/** Pure — safe to call during render, same contract as
 * src/study/family-pilot/integration/curriculum.ts's lessonSegments. */
export function lessonStudyPlan(lesson: FinLitLessonRef): StudyLessonPlan {
  return adaptHostLessonToStudyPlan(hostLessonFor(lesson))
}

/** The Core assignment ref for a lesson. Stable, so re-seeding never duplicates. */
export function assignmentRefFor(lessonRef: string): string {
  return `assignment:${sanitizeRef(lessonRef)}`
}
