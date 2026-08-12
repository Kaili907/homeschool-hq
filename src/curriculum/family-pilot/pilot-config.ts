import type { AcademyGrade } from '../../types'
import { FAMILY_PILOT_SUBJECT } from './types'
import type { FamilyPilotCatalog, PilotUnitRef } from './types'

/**
 * FAMILY-PILOT-CONFIG-1 — the one supervised Family Pilot configuration:
 * grade 5, mathematics, Unit 1 ("Mathematical Habits and Whole-Number
 * Reasoning"). Chosen as the course's first unit — no prerequisite from an
 * earlier unit, 18 lessons with full lesson content, and a matching
 * assessment (ma-g5-mathematics-u01-assessment) — over any later, more
 * novel-looking unit. Only stable refs live here; no curriculum text is
 * copied.
 */
export const FAMILY_PILOT_STATIC_CONFIG = {
  grade: '5' as AcademyGrade,
  subject: FAMILY_PILOT_SUBJECT,
  courseId: 'ma-g5-mathematics',
  unitId: 'ma-g5-mathematics-u01',
} as const

/** Resolves the configured pilot unit against a loaded catalog. Throws if
 * the catalog doesn't have a matching grade/course/unit — a stale config
 * should fail loudly, not silently fall back to a different unit. */
export function resolveFamilyPilotUnit(catalog: FamilyPilotCatalog): PilotUnitRef {
  const course = catalog.courses.find(
    (c) => c.grade === FAMILY_PILOT_STATIC_CONFIG.grade && c.courseId === FAMILY_PILOT_STATIC_CONFIG.courseId,
  )
  if (!course) {
    throw new Error(`Family Pilot config course ${FAMILY_PILOT_STATIC_CONFIG.courseId} is not in the catalog`)
  }
  const unit = course.units.find((u) => u.unitId === FAMILY_PILOT_STATIC_CONFIG.unitId)
  if (!unit) {
    throw new Error(`Family Pilot config unit ${FAMILY_PILOT_STATIC_CONFIG.unitId} is not in course ${course.courseId}`)
  }
  return unit
}
