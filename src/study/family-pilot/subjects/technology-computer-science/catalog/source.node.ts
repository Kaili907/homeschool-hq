import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { AcademyGrade } from '../../../../../types'
import { textContainsCredentialLikeContent } from '../accessibility/metadata'
import {
  TECH_CS_SUBJECT,
  type TechCsCatalog,
  type TechCsCourseRef,
  type TechCsDayPhase,
  type TechCsLessonRef,
  type TechCsUnitRef,
} from './types'

/**
 * FF-M7 — thrown instead of guessing when the frozen curriculum source
 * doesn't match what the catalog needs. A precise blocker, not an invented
 * lesson.
 */
export class TechCsContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TechCsContentError'
  }
}

const TECH_CS_GRADES: readonly AcademyGrade[] = ['5', '7', '8']
const LESSONS_PER_GRADE = 36
const UNITS_PER_GRADE = 6

const CONTENT_ROOT = fileURLToPath(
  new URL('../../../../../../curriculum-content/manuel-academy/', import.meta.url),
)

/**
 * day_in_unit 1..6 maps to the same pedagogical phase across every grade and
 * unit in the canonical content — verified against the real curriculum
 * before writing this table (see source.node.test.ts). Loading fails loudly
 * if a lesson's phase label ever drifts from this table instead of silently
 * accepting whatever the file says.
 */
const DAY_PHASE_BY_DAY_IN_UNIT: Readonly<Record<number, { readonly phase: TechCsDayPhase; readonly label: string }>> = {
  1: { phase: 'launch-diagnostic', label: 'Launch and diagnostic' },
  2: { phase: 'explicit-model', label: 'Explicit model' },
  3: { phase: 'guided-practice', label: 'Guided practice' },
  4: { phase: 'application-project', label: 'Application or project' },
  5: { phase: 'mastery-check', label: 'Mastery check' },
  6: { phase: 'correction-reflection', label: 'Correction and reflection' },
}

function readJson(path: string, label: string): unknown {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new TechCsContentError(`${label} is unavailable at ${path}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new TechCsContentError(`${label} is not valid JSON at ${path}`)
  }
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && entry.length > 0)
}

/** Every string value found anywhere in a parsed JSON tree — used to scan
 * assessments.json (nested prompts, rubrics, mastery interpretation) for
 * credential-like content without needing to know its exact shape. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value)
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, out))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStrings(entry, out))
  }
  return out
}

interface RawLesson {
  readonly lesson_id: string
  readonly course_id: string
  readonly unit_number: number
  readonly day_in_unit: number
  readonly course_day: number
  readonly title: string
  readonly focus: string
  readonly phase: string
  readonly standards: readonly string[]
  readonly accessibility_and_accommodations: readonly string[]
  readonly safety_and_privacy: readonly string[]
}

function readLessons(path: string, label: string): readonly RawLesson[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new TechCsContentError(`${label} is unavailable at ${path}`)
  }
  const lessons: RawLesson[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      throw new TechCsContentError(`${label} contains an invalid line`)
    }
    const record = value as {
      lesson_id?: unknown
      course_id?: unknown
      subject?: unknown
      unit_number?: unknown
      day_in_unit?: unknown
      course_day?: unknown
      title?: unknown
      focus?: unknown
      phase?: unknown
      standards?: unknown
      accessibility_and_accommodations?: unknown
      safety_and_privacy?: unknown
    }
    if (
      typeof record.lesson_id !== 'string' || !record.lesson_id ||
      typeof record.course_id !== 'string' || !record.course_id ||
      record.subject !== TECH_CS_SUBJECT ||
      typeof record.unit_number !== 'number' ||
      typeof record.day_in_unit !== 'number' ||
      typeof record.course_day !== 'number' ||
      typeof record.title !== 'string' || !record.title ||
      typeof record.focus !== 'string' || !record.focus ||
      typeof record.phase !== 'string' || !record.phase ||
      !nonEmptyStringArray(record.standards) ||
      !nonEmptyStringArray(record.accessibility_and_accommodations) ||
      !nonEmptyStringArray(record.safety_and_privacy)
    ) {
      throw new TechCsContentError(`${label} has a lesson missing required fields`)
    }
    const expected = DAY_PHASE_BY_DAY_IN_UNIT[record.day_in_unit]
    if (!expected || expected.label !== record.phase) {
      throw new TechCsContentError(
        `${label} lesson ${record.lesson_id} has phase "${record.phase}" at day_in_unit ${record.day_in_unit}, expected "${expected?.label ?? 'a known day_in_unit'}"`,
      )
    }
    if (textContainsCredentialLikeContent([
      record.title,
      record.focus,
      ...record.standards,
      ...record.accessibility_and_accommodations,
      ...record.safety_and_privacy,
    ])) {
      throw new TechCsContentError(`${label} lesson ${record.lesson_id} contains credential-like content`)
    }
    lessons.push({
      lesson_id: record.lesson_id,
      course_id: record.course_id,
      unit_number: record.unit_number,
      day_in_unit: record.day_in_unit,
      course_day: record.course_day,
      title: record.title,
      focus: record.focus,
      phase: record.phase,
      standards: record.standards,
      accessibility_and_accommodations: record.accessibility_and_accommodations,
      safety_and_privacy: record.safety_and_privacy,
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
    throw new TechCsContentError('production release registry has no currentRelease')
  }
  const releases = Array.isArray(registry.releases) ? registry.releases : []
  const active = releases.find(
    (release): release is { version: string; status: string } =>
      !!release && typeof release === 'object' &&
      (release as { status?: unknown }).status === 'active',
  )
  if (!active || active.version !== registry.currentRelease) {
    throw new TechCsContentError('production release registry has no matching active release')
  }
  return registry.currentRelease
}

function loadCourse(releaseVersion: string, grade: AcademyGrade): TechCsCourseRef {
  const base = join(CONTENT_ROOT, releaseVersion, 'grades', `grade-${grade}`, 'courses', TECH_CS_SUBJECT)
  const label = `grade-${grade} ${TECH_CS_SUBJECT}`

  const units = readJson(join(base, 'units.json'), `${label} units.json`)
  if (!Array.isArray(units) || units.length !== UNITS_PER_GRADE) {
    throw new TechCsContentError(`${label} units.json must contain exactly ${UNITS_PER_GRADE} units`)
  }
  const assessments = readJson(join(base, 'assessments.json'), `${label} assessments.json`)
  if (!Array.isArray(assessments)) {
    throw new TechCsContentError(`${label} assessments.json is malformed`)
  }
  if (textContainsCredentialLikeContent(collectStrings(assessments))) {
    throw new TechCsContentError(`${label} assessments.json contains credential-like content`)
  }
  const assessmentIds = new Set(
    assessments.map((a) => (a as { assessment_id?: unknown }).assessment_id).filter((id) => typeof id === 'string'),
  )

  const rawLessons = readLessons(join(base, 'lessons.jsonl'), `${label} lessons.jsonl`)
  if (rawLessons.length !== LESSONS_PER_GRADE) {
    throw new TechCsContentError(`${label} lessons.jsonl must contain exactly ${LESSONS_PER_GRADE} lessons, found ${rawLessons.length}`)
  }

  const courseId = rawLessons[0].course_id
  const byId = new Map<string, RawLesson>()
  for (const lesson of rawLessons) {
    if (lesson.course_id !== courseId) {
      throw new TechCsContentError(`${label} has mixed course_id across lessons.jsonl`)
    }
    if (byId.has(lesson.lesson_id)) {
      throw new TechCsContentError(`${label} lessons.jsonl has duplicate lesson_id ${lesson.lesson_id}`)
    }
    byId.set(lesson.lesson_id, lesson)
  }

  const sortedByDay = rawLessons.slice().sort((a, b) => a.course_day - b.course_day)
  sortedByDay.forEach((lesson, index) => {
    const expectedDay = index + 1
    if (lesson.course_day !== expectedDay) {
      throw new TechCsContentError(
        `${label} course_day sequence has a gap or duplicate at position ${expectedDay} (got ${lesson.course_day})`,
      )
    }
  })

  const seenLessonIds = new Set<string>()
  const unitRefs: TechCsUnitRef[] = units
    .slice()
    .sort((a, b) => (a as { unit_number: number }).unit_number - (b as { unit_number: number }).unit_number)
    .map((raw) => {
      const unit = raw as {
        unit_id?: unknown
        course_id?: unknown
        unit_number?: unknown
        title?: unknown
        topics?: unknown
        performance_task?: unknown
        assessment_id?: unknown
        lesson_ids?: unknown
      }
      if (
        typeof unit.unit_id !== 'string' || typeof unit.course_id !== 'string' ||
        typeof unit.unit_number !== 'number' || typeof unit.title !== 'string' ||
        !nonEmptyStringArray(unit.topics) ||
        typeof unit.performance_task !== 'string' || !unit.performance_task ||
        !Array.isArray(unit.lesson_ids) || unit.lesson_ids.length === 0
      ) {
        throw new TechCsContentError(`${label} unit ${String(unit.unit_id)} is missing required fields`)
      }
      if (unit.course_id !== courseId) {
        throw new TechCsContentError(`${label} has mixed course_id between units.json and lessons.jsonl`)
      }
      if (textContainsCredentialLikeContent([unit.title, unit.performance_task, ...unit.topics])) {
        throw new TechCsContentError(`${label} unit ${unit.unit_id} contains credential-like content`)
      }
      for (const lessonId of unit.lesson_ids) {
        if (typeof lessonId !== 'string') {
          throw new TechCsContentError(`${label} unit ${unit.unit_id} has a non-string lesson id`)
        }
        const lesson = byId.get(lessonId)
        if (!lesson) {
          throw new TechCsContentError(`${label} unit ${unit.unit_id} references unknown lesson ${lessonId}`)
        }
        if (lesson.unit_number !== unit.unit_number) {
          throw new TechCsContentError(
            `${label} lesson ${lessonId} belongs to unit ${lesson.unit_number}, not ${unit.unit_number} as units.json claims`,
          )
        }
        if (seenLessonIds.has(lessonId)) {
          throw new TechCsContentError(`${label} lesson ${lessonId} is listed in more than one unit`)
        }
        seenLessonIds.add(lessonId)
      }
      const assessmentId = typeof unit.assessment_id === 'string' ? unit.assessment_id : null
      if (assessmentId !== null && !assessmentIds.has(assessmentId)) {
        throw new TechCsContentError(`${label} unit ${unit.unit_id} references unknown assessment ${assessmentId}`)
      }
      return Object.freeze({
        unitId: unit.unit_id,
        courseId: unit.course_id,
        unitNumber: unit.unit_number,
        title: unit.title,
        topics: Object.freeze(unit.topics.slice()) as readonly string[],
        performanceTask: unit.performance_task,
        assessmentId,
        lessonIds: Object.freeze(unit.lesson_ids.slice()) as readonly string[],
      })
    })

  if (seenLessonIds.size !== byId.size) {
    throw new TechCsContentError(`${label} units.json does not cover every lesson in lessons.jsonl`)
  }

  const unitIdByNumber = new Map(unitRefs.map((unit) => [unit.unitNumber, unit.unitId]))
  const lessons: TechCsLessonRef[] = sortedByDay.map((lesson) => {
    const unitId = unitIdByNumber.get(lesson.unit_number)
    if (!unitId) {
      throw new TechCsContentError(`${label} lesson ${lesson.lesson_id} references unit ${lesson.unit_number}, which has no units.json entry`)
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
      focus: lesson.focus,
      dayPhase: DAY_PHASE_BY_DAY_IN_UNIT[lesson.day_in_unit].phase,
      standards: Object.freeze(lesson.standards.slice()) as readonly string[],
      accessibilityAndAccommodations: Object.freeze(lesson.accessibility_and_accommodations.slice()) as readonly string[],
      safetyAndPrivacy: Object.freeze(lesson.safety_and_privacy.slice()) as readonly string[],
    })
  })

  return Object.freeze({
    courseId,
    grade,
    subject: TECH_CS_SUBJECT,
    title: `Grade ${grade} Technology and Computer Science`,
    units: Object.freeze(unitRefs),
    lessons: Object.freeze(lessons),
  })
}

let cached: TechCsCatalog | undefined

/** Loads (and caches) the Technology / CS catalog from the frozen curriculum
 * source. Throws TechCsContentError instead of returning a partial or
 * guessed catalog. */
export function loadTechCsCatalog(): TechCsCatalog {
  if (cached) return cached
  const releaseVersion = readReleaseVersion()
  const courses = TECH_CS_GRADES.map((grade) => loadCourse(releaseVersion, grade))
  const totalLessons = courses.reduce((sum, course) => sum + course.lessons.length, 0)
  const totalUnits = courses.reduce((sum, course) => sum + course.units.length, 0)
  if (totalLessons !== TECH_CS_GRADES.length * LESSONS_PER_GRADE || totalUnits !== TECH_CS_GRADES.length * UNITS_PER_GRADE) {
    throw new TechCsContentError(
      `Technology / CS catalog must total ${TECH_CS_GRADES.length * LESSONS_PER_GRADE} lessons and ${TECH_CS_GRADES.length * UNITS_PER_GRADE} units, found ${totalLessons} lessons and ${totalUnits} units`,
    )
  }
  cached = Object.freeze({ releaseVersion, courses: Object.freeze(courses) })
  return cached
}
