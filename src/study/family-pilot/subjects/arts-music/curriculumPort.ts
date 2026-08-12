import type { AcademyGrade } from '../../../../types'
import type { HostLessonDescriptor } from '../../../curriculumAdapter'
import type { FamilyPilotCurriculumPort } from '../../integration/curriculum'
import { getArtsMusicAssignments } from './catalog'
import type { ArtsMusicCatalog } from './types'

/**
 * ARTS-MUSIC-1 — resolves an Arts & Music catalog into the same
 * FamilyPilotCurriculumPort shape the math catalog uses
 * (src/study/family-pilot/integration/curriculum.ts), so downstream code
 * that already knows how to list and start lessons for one subject can do
 * the same for this one without a subject-specific branch.
 *
 * Every lesson resolves to HostStudyLessonKind 'parent-created': the
 * existing, reviewed shape for a household activity Tutor Core does not
 * grade (subject 'other', masteryAuthority 'completion-only'). That keeps
 * lesson resolution inside this subject lane's own directory — see
 * studyAdapter.ts for the richer, subject-owned segment preview shown
 * before a learner presses Start, and its comment for why this lane does
 * not add a new HostStudyLessonKind to the shared engine.
 */

/** Refs are opaque and must satisfy the Study adapter's SAFE_REF. */
function sanitizeRef(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 120)
}

export function artsMusicCurriculumPort(catalog: ArtsMusicCatalog): FamilyPilotCurriculumPort {
  return {
    listLessons: (grade: AcademyGrade): readonly HostLessonDescriptor[] =>
      getArtsMusicAssignments(catalog, { studentRef: 'catalog-query', grade }).map((lesson) => ({
        lessonRef: sanitizeRef(lesson.lessonId),
        title: lesson.title,
        kind: 'parent-created' as const,
        skillRefs: [sanitizeRef(`${lesson.courseId}:unit:${lesson.unitNumber}`)],
      })),
  }
}
