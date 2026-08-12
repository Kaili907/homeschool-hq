import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { AcademyGrade } from '../../types'
import { FAMILY_PILOT_SUBJECT, type FamilyPilotCatalog, type PilotCourseRef } from './types'
import { FamilyPilotContentError, buildCourse, parseLessonLines, resolveReleaseVersion, type RawLesson } from './parse'

export { FamilyPilotContentError }

const PILOT_GRADES: readonly AcademyGrade[] = ['5', '7', '8']

const CONTENT_ROOT = fileURLToPath(
  new URL('../../../curriculum-content/manuel-academy/', import.meta.url),
)

function readJson(path: string, label: string): unknown {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new FamilyPilotContentError(`${label} is unavailable at ${path}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new FamilyPilotContentError(`${label} is not valid JSON at ${path}`)
  }
}

function readLessons(path: string, label: string): readonly RawLesson[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new FamilyPilotContentError(`${label} is unavailable at ${path}`)
  }
  return parseLessonLines(raw, label)
}

function readReleaseVersion(): string {
  const registry = readJson(
    join(CONTENT_ROOT, 'production-release-registry.json'),
    'production release registry',
  )
  return resolveReleaseVersion(registry)
}

function loadCourse(releaseVersion: string, grade: AcademyGrade): PilotCourseRef {
  const base = join(CONTENT_ROOT, releaseVersion, 'grades', `grade-${grade}`, 'courses', FAMILY_PILOT_SUBJECT)
  const label = `grade-${grade} ${FAMILY_PILOT_SUBJECT}`

  const units = readJson(join(base, 'units.json'), `${label} units.json`)
  const assessments = readJson(join(base, 'assessments.json'), `${label} assessments.json`)
  const rawLessons = readLessons(join(base, 'lessons.jsonl'), `${label} lessons.jsonl`)

  return buildCourse(grade, label, units, assessments, rawLessons)
}

let cached: FamilyPilotCatalog | undefined

/** Loads (and caches) the Family Pilot catalog from the frozen curriculum
 * source. Throws FamilyPilotContentError instead of returning a partial or
 * guessed catalog. */
export function loadFamilyPilotCatalog(): FamilyPilotCatalog {
  if (cached) return cached
  const releaseVersion = readReleaseVersion()
  const courses = PILOT_GRADES.map((grade) => loadCourse(releaseVersion, grade))
  cached = Object.freeze({ releaseVersion, courses: Object.freeze(courses) })
  return cached
}
