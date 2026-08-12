import type { AcademyGrade } from '../../types'
import { FAMILY_PILOT_SUBJECT, type FamilyPilotCatalog, type PilotCourseRef } from './types'
import { FamilyPilotContentError, buildCourse, parseLessonLines, resolveReleaseVersion } from './parse'

const REGISTRY_PATH = '../../../curriculum-content/manuel-academy/production-release-registry.json'
const registryFiles = import.meta.glob(
  '../../../curriculum-content/manuel-academy/production-release-registry.json',
  { eager: true, import: 'default' },
) as Record<string, unknown>
const registry = registryFiles[REGISTRY_PATH]

/**
 * FAMILY-PILOT-CURR-1 — browser build of the Family Pilot curriculum
 * loader. The Node source (source.node.ts) reads the frozen curriculum
 * files off disk at call time; a browser bundle has no filesystem, so this
 * loads the same mathematics-only files through Vite's static
 * import.meta.glob instead — resolved and inlined at build time, not
 * fetched over the network. Grades/subjects outside the pilot's scope
 * (arts, ELA, grades other than 5/7/8, etc.) are never matched by the glob,
 * so they never enter the bundle. See parse.ts for the validation shared
 * with source.node.ts.
 */

const PILOT_GRADES: readonly AcademyGrade[] = ['5', '7', '8']

const unitsAndAssessments = import.meta.glob(
  '../../../curriculum-content/manuel-academy/*/grades/*/courses/mathematics/{units,assessments}.json',
  { eager: true, import: 'default' },
) as Record<string, unknown>

const lessonFiles = import.meta.glob(
  '../../../curriculum-content/manuel-academy/*/grades/*/courses/mathematics/lessons.jsonl',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

function courseKey(releaseVersion: string, grade: AcademyGrade, file: string): string {
  return `../../../curriculum-content/manuel-academy/${releaseVersion}/grades/grade-${grade}/courses/${FAMILY_PILOT_SUBJECT}/${file}`
}

function loadCourse(releaseVersion: string, grade: AcademyGrade): PilotCourseRef {
  const label = `grade-${grade} ${FAMILY_PILOT_SUBJECT}`

  const unitsKey = courseKey(releaseVersion, grade, 'units.json')
  const units = unitsAndAssessments[unitsKey]
  if (units === undefined) {
    throw new FamilyPilotContentError(`${label} units.json is unavailable at ${unitsKey}`)
  }

  const assessmentsKey = courseKey(releaseVersion, grade, 'assessments.json')
  const assessments = unitsAndAssessments[assessmentsKey]
  if (assessments === undefined) {
    throw new FamilyPilotContentError(`${label} assessments.json is unavailable at ${assessmentsKey}`)
  }

  const lessonsKey = courseKey(releaseVersion, grade, 'lessons.jsonl')
  const lessonsRaw = lessonFiles[lessonsKey]
  if (lessonsRaw === undefined) {
    throw new FamilyPilotContentError(`${label} lessons.jsonl is unavailable at ${lessonsKey}`)
  }
  const rawLessons = parseLessonLines(lessonsRaw, `${label} lessons.jsonl`)

  return buildCourse(grade, label, units, assessments, rawLessons)
}

let cached: FamilyPilotCatalog | undefined

/** Browser-build equivalent of source.node.ts's loadFamilyPilotCatalog:
 * same contract, same validation, same errors — sourced from Vite's
 * build-time static imports instead of node:fs. */
export function loadFamilyPilotCatalog(): FamilyPilotCatalog {
  if (cached) return cached
  const releaseVersion = resolveReleaseVersion(registry)
  const courses = PILOT_GRADES.map((grade) => loadCourse(releaseVersion, grade))
  cached = Object.freeze({ releaseVersion, courses: Object.freeze(courses) })
  return cached
}

export { FamilyPilotContentError }
