import { getPilotAssignments } from '../../../curriculum/family-pilot/catalog'
import { FAMILY_PILOT_STATIC_CONFIG, resolveFamilyPilotUnit } from '../../../curriculum/family-pilot/pilot-config'
import type { FamilyPilotCatalog } from '../../../curriculum/family-pilot/types'
import type { AcademyGrade } from '../../../types'
import { adaptHostLessonToStudyPlan, type HostLessonDescriptor } from '../../curriculumAdapter'

// FAMILY-PILOT-INTEGRATION: which lessons a student can be assigned.
//
// The pilot Curriculum module is the catalog authority, but its only loader
// (src/curriculum/family-pilot/source.node.ts) reads the frozen curriculum
// tree with node:fs and therefore cannot run in a browser. So curriculum
// arrives through a port: the catalog-backed adapter is the real one, and the
// host-lesson adapter is what a browser build can resolve today. Both produce
// the same descriptor type, so nothing downstream knows which one is in use.

export interface FamilyPilotCurriculumPort {
  /** Assignable lessons for a grade, in course completion order. */
  readonly listLessons: (grade: AcademyGrade) => readonly HostLessonDescriptor[]
}

/** Refs are opaque and must satisfy the Study adapter's SAFE_REF. */
function sanitizeRef(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 120)
}

/**
 * The real catalog, scoped to the one supervised Family Pilot configuration
 * (FAMILY_PILOT_STATIC_CONFIG: grade 5, ma-g5-mathematics, Unit 1's 18
 * lessons) rather than the full multi-unit course. Every pilot course is
 * mathematics (FAMILY_PILOT_SUBJECT), which maps onto the host 'math' lesson
 * kind and so inherits the reviewed five-segment math shape from
 * HOST_STUDY_MAPPING rather than a pilot-invented one. Any grade other than
 * the configured one returns no lessons — grade 7/8 catalog content must
 * never substitute for the pilot's single reviewed unit.
 */
export function catalogCurriculumPort(catalog: FamilyPilotCatalog): FamilyPilotCurriculumPort {
  return {
    listLessons: (grade) => {
      if (grade !== FAMILY_PILOT_STATIC_CONFIG.grade) return []
      const unit = resolveFamilyPilotUnit(catalog)
      return getPilotAssignments(catalog, { studentRef: 'catalog-query', grade })
        .filter((lesson) => lesson.unitId === unit.unitId)
        .map((lesson) => ({
          lessonRef: sanitizeRef(lesson.lessonId),
          title: lesson.title,
          kind: 'math' as const,
          skillRefs: [sanitizeRef(`${lesson.courseId}:unit:${lesson.unitNumber}`)],
        }))
    },
  }
}

/**
 * The browser path. It projects the same daily math/reading shape the existing
 * local preview seeds (see ensureLocalDevelopmentStudyDay in
 * src/study/calendarAdapter.ts) so the pilot reuses an established lesson
 * descriptor pattern instead of minting a parallel one.
 *
 * This is a stand-in for the frozen catalog, not a replacement for it: when a
 * browser-resolvable catalog exists, pass catalogCurriculumPort instead and
 * nothing else in the pilot changes.
 */
export function hostLessonCurriculumPort(
  lessonsPerGrade = 3,
): FamilyPilotCurriculumPort {
  return {
    listLessons: (grade) => {
      const gradeRef = `grade-${grade}`
      return Array.from({ length: Math.max(1, lessonsPerGrade) }, (_unused, index) => {
        const day = index + 1
        return {
          lessonRef: `${gradeRef}:math:day-${day}`,
          title: `Grade ${grade} math · lesson ${day}`,
          kind: 'math' as const,
          skillRefs: [`${gradeRef}:math:current`],
        }
      })
    },
  }
}

/**
 * The lesson's segments, derived without a live Study session so the student
 * can see real step titles before pressing Start. adaptHostLessonToStudyPlan is
 * pure, which is what makes this safe to call during render.
 */
export function lessonSegments(
  lesson: HostLessonDescriptor,
): readonly { readonly segmentRef: string; readonly title: string; readonly estimatedMinutes: number }[] {
  return adaptHostLessonToStudyPlan(lesson).segments.map((segment) => ({
    segmentRef: segment.segmentRef,
    title: segment.title,
    estimatedMinutes: segment.estimatedMinutes,
  }))
}

/** The Core assignment ref for a lesson. Stable, so re-seeding never duplicates. */
export function assignmentRefFor(lessonRef: string): string {
  return `assignment:${sanitizeRef(lessonRef)}`
}

export function lessonSubjectLabel(lesson: HostLessonDescriptor): string {
  return adaptHostLessonToStudyPlan(lesson).subject
}
