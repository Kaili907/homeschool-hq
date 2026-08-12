import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { AcademyGrade } from '../../types'
import {
  FAMILY_PILOT_SUBJECT,
  type FamilyPilotCatalog,
  type PilotCourseRef,
  type PilotLessonRef,
  type PilotUnitRef,
} from './types'

/**
 * FAMILY-PILOT-CURR-1 — thrown instead of guessing when the frozen curriculum
 * source doesn't match what the catalog needs. A precise blocker, not an
 * invented lesson.
 */
export class FamilyPilotContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FamilyPilotContentError'
  }
}

/**
 * RELEASE-SCOPED, deliberately NOT the canonical supported-grade list. These are
 * the grade directories that exist under curriculum-content/manuel-academy/
 * <version>/grades/, and loadCourse reads each one off disk. Widening this to
 * SUPPORTED_ACADEMY_GRADES would make the loader throw FamilyPilotContentError
 * for grade-3/4/9/10/11/12 directories the release does not ship. It grows when
 * a release ships more grades, not when the authority does.
 */
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

interface RawLesson {
  readonly lesson_id: string
  readonly course_id: string
  readonly unit_number: number
  readonly day_in_unit: number
  readonly course_day: number
  readonly title: string
}

function readLessons(path: string, label: string): readonly RawLesson[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new FamilyPilotContentError(`${label} is unavailable at ${path}`)
  }
  const lessons: RawLesson[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      throw new FamilyPilotContentError(`${label} contains an invalid line`)
    }
    const record = value as {
      lesson_id?: unknown
      course_id?: unknown
      unit_number?: unknown
      day_in_unit?: unknown
      course_day?: unknown
      title?: unknown
      standards?: unknown
    }
    if (
      typeof record.lesson_id !== 'string' || !record.lesson_id ||
      typeof record.course_id !== 'string' || !record.course_id ||
      typeof record.unit_number !== 'number' ||
      typeof record.day_in_unit !== 'number' ||
      typeof record.course_day !== 'number' ||
      typeof record.title !== 'string' || !record.title ||
      !Array.isArray(record.standards) || record.standards.length === 0
    ) {
      throw new FamilyPilotContentError(`${label} has a lesson missing required fields`)
    }
    lessons.push({
      lesson_id: record.lesson_id,
      course_id: record.course_id,
      unit_number: record.unit_number,
      day_in_unit: record.day_in_unit,
      course_day: record.course_day,
      title: record.title,
    })
  }
  return lessons
}

function readReleaseVersion(): string {
  const registry = readJson(
    join(CONTENT_ROOT, 'production-release-registry.json'),
    'production release registry',
  ) as { currentRelease?: unknown; releases?: unknown }
  if (typeof registry.currentRelease !== 'string' || !registry.currentRelease) {
    throw new FamilyPilotContentError('production release registry has no currentRelease')
  }
  const releases = Array.isArray(registry.releases) ? registry.releases : []
  const active = releases.find(
    (release): release is { version: string; status: string } =>
      !!release && typeof release === 'object' &&
      (release as { status?: unknown }).status === 'active',
  )
  if (!active || active.version !== registry.currentRelease) {
    throw new FamilyPilotContentError('production release registry has no matching active release')
  }
  return registry.currentRelease
}

function loadCourse(releaseVersion: string, grade: AcademyGrade): PilotCourseRef {
  const base = join(CONTENT_ROOT, releaseVersion, 'grades', `grade-${grade}`, 'courses', FAMILY_PILOT_SUBJECT)
  const label = `grade-${grade} ${FAMILY_PILOT_SUBJECT}`

  const units = readJson(join(base, 'units.json'), `${label} units.json`)
  if (!Array.isArray(units) || units.length === 0) {
    throw new FamilyPilotContentError(`${label} units.json is empty or malformed`)
  }
  const assessments = readJson(join(base, 'assessments.json'), `${label} assessments.json`)
  if (!Array.isArray(assessments)) {
    throw new FamilyPilotContentError(`${label} assessments.json is malformed`)
  }
  const assessmentIds = new Set(
    assessments.map((a) => (a as { assessment_id?: unknown }).assessment_id).filter((id) => typeof id === 'string'),
  )

  const rawLessons = readLessons(join(base, 'lessons.jsonl'), `${label} lessons.jsonl`)
  if (rawLessons.length === 0) throw new FamilyPilotContentError(`${label} lessons.jsonl is empty`)

  const courseId = rawLessons[0].course_id
  const byId = new Map<string, RawLesson>()
  for (const lesson of rawLessons) {
    if (lesson.course_id !== courseId) {
      throw new FamilyPilotContentError(`${label} has mixed course_id across lessons.jsonl`)
    }
    if (byId.has(lesson.lesson_id)) {
      throw new FamilyPilotContentError(`${label} lessons.jsonl has duplicate lesson_id ${lesson.lesson_id}`)
    }
    byId.set(lesson.lesson_id, lesson)
  }

  const sortedByDay = rawLessons.slice().sort((a, b) => a.course_day - b.course_day)
  sortedByDay.forEach((lesson, index) => {
    const expectedDay = index + 1
    if (lesson.course_day !== expectedDay) {
      throw new FamilyPilotContentError(
        `${label} course_day sequence has a gap or duplicate at position ${expectedDay} (got ${lesson.course_day})`,
      )
    }
  })

  const seenLessonIds = new Set<string>()
  const unitRefs: PilotUnitRef[] = units
    .slice()
    .sort((a, b) => (a as { unit_number: number }).unit_number - (b as { unit_number: number }).unit_number)
    .map((raw) => {
      const unit = raw as {
        unit_id?: unknown
        course_id?: unknown
        unit_number?: unknown
        title?: unknown
        assessment_id?: unknown
        lesson_ids?: unknown
      }
      if (
        typeof unit.unit_id !== 'string' || typeof unit.course_id !== 'string' ||
        typeof unit.unit_number !== 'number' || typeof unit.title !== 'string' ||
        !Array.isArray(unit.lesson_ids) || unit.lesson_ids.length === 0
      ) {
        throw new FamilyPilotContentError(`${label} unit ${String(unit.unit_id)} is missing required fields`)
      }
      if (unit.course_id !== courseId) {
        throw new FamilyPilotContentError(`${label} has mixed course_id between units.json and lessons.jsonl`)
      }
      for (const lessonId of unit.lesson_ids) {
        if (typeof lessonId !== 'string') {
          throw new FamilyPilotContentError(`${label} unit ${unit.unit_id} has a non-string lesson id`)
        }
        const lesson = byId.get(lessonId)
        if (!lesson) {
          throw new FamilyPilotContentError(`${label} unit ${unit.unit_id} references unknown lesson ${lessonId}`)
        }
        if (lesson.unit_number !== unit.unit_number) {
          throw new FamilyPilotContentError(
            `${label} lesson ${lessonId} belongs to unit ${lesson.unit_number}, not ${unit.unit_number} as units.json claims`,
          )
        }
        if (seenLessonIds.has(lessonId)) {
          throw new FamilyPilotContentError(`${label} lesson ${lessonId} is listed in more than one unit`)
        }
        seenLessonIds.add(lessonId)
      }
      const assessmentId = typeof unit.assessment_id === 'string' ? unit.assessment_id : null
      if (assessmentId !== null && !assessmentIds.has(assessmentId)) {
        throw new FamilyPilotContentError(`${label} unit ${unit.unit_id} references unknown assessment ${assessmentId}`)
      }
      return Object.freeze({
        unitId: unit.unit_id,
        courseId: unit.course_id,
        unitNumber: unit.unit_number,
        title: unit.title,
        assessmentId,
        lessonIds: Object.freeze(unit.lesson_ids.slice()) as readonly string[],
      })
    })

  if (seenLessonIds.size !== byId.size) {
    throw new FamilyPilotContentError(`${label} units.json does not cover every lesson in lessons.jsonl`)
  }

  const unitIdByNumber = new Map(unitRefs.map((unit) => [unit.unitNumber, unit.unitId]))
  const lessons: PilotLessonRef[] = sortedByDay.map((lesson) => {
    const unitId = unitIdByNumber.get(lesson.unit_number)
    if (!unitId) {
      throw new FamilyPilotContentError(`${label} lesson ${lesson.lesson_id} references unit ${lesson.unit_number}, which has no units.json entry`)
    }
    return Object.freeze({
      lessonId: lesson.lesson_id,
      courseId: lesson.course_id,
      grade,
      unitId,
      unitNumber: lesson.unit_number,
      dayInUnit: lesson.day_in_unit,
      courseDay: lesson.course_day,
      title: lesson.title,
    })
  })

  return Object.freeze({
    courseId,
    grade,
    subject: FAMILY_PILOT_SUBJECT,
    title: `Grade ${grade} Mathematics`,
    units: Object.freeze(unitRefs),
    lessons: Object.freeze(lessons),
  })
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
