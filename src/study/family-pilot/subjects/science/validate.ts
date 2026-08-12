import { loadScienceCatalog } from './source.node'
import type { ScienceCatalog } from './types'

/**
 * FAMILY-PILOT-SCIENCE-1 — the subject-lane health check.
 *
 * loadScienceCatalog already throws ScienceContentError the moment any single
 * record is malformed. This function instead checks the catalog's overall
 * shape once it has loaded successfully — the canonical expected scope (108
 * lessons / 9 units per grade, 324 lessons total across grades 5, 7, 8) and
 * the cross-course invariants (stable, non-colliding refs; gapless schedule
 * order) a CI gate or the mission's own test suite can assert on directly.
 */

export interface ScienceSubjectLaneValidationReport {
  readonly ok: boolean
  readonly issues: readonly string[]
  readonly totalLessons: number
  readonly lessonsByGrade: Readonly<Record<string, number>>
  readonly unitsByGrade: Readonly<Record<string, number>>
}

const EXPECTED_LESSONS_PER_GRADE = 108
const EXPECTED_UNITS_PER_GRADE = 9
const EXPECTED_TOTAL_LESSONS = 324

export function validateScienceSubjectLane(
  catalog: ScienceCatalog = loadScienceCatalog(),
): ScienceSubjectLaneValidationReport {
  const issues: string[] = []
  const lessonsByGrade: Record<string, number> = {}
  const unitsByGrade: Record<string, number> = {}
  const allLessonIds: string[] = []
  const allUnitIds: string[] = []

  for (const course of catalog.courses) {
    lessonsByGrade[course.grade] = course.lessons.length
    unitsByGrade[course.grade] = course.units.length

    if (course.lessons.length !== EXPECTED_LESSONS_PER_GRADE) {
      issues.push(
        `grade ${course.grade} has ${course.lessons.length} lessons, expected ${EXPECTED_LESSONS_PER_GRADE}`,
      )
    }
    if (course.units.length !== EXPECTED_UNITS_PER_GRADE) {
      issues.push(`grade ${course.grade} has ${course.units.length} units, expected ${EXPECTED_UNITS_PER_GRADE}`)
    }

    const days = course.lessons.map((lesson) => lesson.courseDay)
    const gaplessDays = Array.from({ length: days.length }, (_unused, index) => index + 1)
    if (JSON.stringify(days) !== JSON.stringify(gaplessDays)) {
      issues.push(`grade ${course.grade} course_day sequence is not a gapless 1..N schedule order`)
    }

    for (const lesson of course.lessons) {
      allLessonIds.push(lesson.lessonId)
      if (!course.lessonDetailById.has(lesson.lessonId)) {
        issues.push(`grade ${course.grade} lesson ${lesson.lessonId} has no lesson detail`)
      }
    }
    for (const unit of course.units) allUnitIds.push(unit.unitId)
  }

  if (allLessonIds.length !== EXPECTED_TOTAL_LESSONS) {
    issues.push(`catalog has ${allLessonIds.length} total lessons, expected ${EXPECTED_TOTAL_LESSONS}`)
  }
  if (new Set(allLessonIds).size !== allLessonIds.length) {
    issues.push('lesson refs collide across grades or within a grade')
  }
  if (new Set(allUnitIds).size !== allUnitIds.length) {
    issues.push('unit refs collide across grades or within a grade')
  }
  if (catalog.courses.length !== 3) {
    issues.push(`catalog has ${catalog.courses.length} courses, expected 3 (grades 5, 7, 8)`)
  }

  return {
    ok: issues.length === 0,
    issues,
    totalLessons: allLessonIds.length,
    lessonsByGrade,
    unitsByGrade,
  }
}
