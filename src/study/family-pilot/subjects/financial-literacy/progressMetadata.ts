import type { StudyCalendarEntry } from '../../../types'
import { getLesson, getUnit } from './catalog'
import type { AcademyGrade } from '../../../../types'
import type { FinancialLiteracyCatalog } from './types'

/**
 * FAMILY-PILOT-FINLIT-1 — parent-visible progress metadata.
 *
 * src/study/family-pilot/parent/deriveSnapshot.ts already builds the Parent
 * Hub view from StudyCalendarEntry alone, with no subject branching — so as
 * long as this lane's lessons reach the calendar through studyAdapter.ts (as
 * every other Family Pilot subject's do), parent-visible progress needs no
 * changes there. What this module adds is finlit-specific display metadata
 * for that same calendar entry, plus an explicit, testable line between two
 * things that must never be conflated:
 *
 *  - lesson PRESENCE: a lesson exists in the loaded curriculum catalog.
 *  - completion EVIDENCE: a specific learner's Study calendar entry for that
 *    lesson reached state 'completed'.
 *
 * Importing content is not the same as a student doing the work, and this
 * lane must never award academic credit for the former. A parent summary can
 * be built from presence alone (it is not a credit claim); evidence
 * requires an actual completed StudyCalendarEntry, scoped to one learner.
 */

export interface FinLitParentLessonSummary {
  readonly lessonRef: string
  readonly title: string
  readonly unitTitle: string
  readonly grade: AcademyGrade
  /** The lesson's own authored parent-facing note, when the source lesson has one. */
  readonly parentVisibilityNote: string | null
}

/** Built from catalog presence only — never implies the lesson was done. */
export function parentLessonSummary(
  catalog: FinancialLiteracyCatalog,
  lessonRef: string,
): FinLitParentLessonSummary | null {
  const lesson = getLesson(catalog, lessonRef)
  if (!lesson) return null
  const unit = getUnit(catalog, lesson.unitId)
  return {
    lessonRef: lesson.lessonId,
    title: lesson.title,
    unitTitle: unit?.title ?? '',
    grade: lesson.grade,
    parentVisibilityNote: lesson.parentVisibility,
  }
}

export interface FinLitCompletionEvidence {
  readonly learnerRef: string
  readonly lessonRef: string
  readonly completedAt: string
}

/** Evidence can only come from an actual completed Study calendar entry for
 * one learner — never from the catalog, and never inferred from a lesson
 * merely existing. Returns null for every state short of 'completed'. */
export function completionEvidenceFromEntry(entry: StudyCalendarEntry): FinLitCompletionEvidence | null {
  if (entry.state !== 'completed') return null
  return { learnerRef: entry.learnerRef, lessonRef: entry.lessonRef, completedAt: entry.scheduledStart }
}
