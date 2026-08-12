import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { AcademyGrade } from '../../../../types'
import {
  READY_FOR_LIFE_SUBJECT,
  type RflAdaptiveTutorRoute,
  type RflCatalog,
  type RflCourseRef,
  type RflLessonFlowStep,
  type RflLessonRef,
  type RflUnitRef,
} from './types'

/**
 * FULL-FAMILY-READY-FOR-LIFE-CURR — thrown instead of guessing when the
 * frozen curriculum source doesn't match what this lane needs. A precise
 * blocker, not an invented lesson. Mirrors FamilyPilotContentError in
 * ../../../../curriculum/family-pilot/source.node.ts.
 */
export class RflContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RflContentError'
  }
}

const RFL_GRADES: readonly AcademyGrade[] = ['5', '7', '8']
const LESSONS_PER_GRADE = 36
const UNITS_PER_GRADE = 6

const CONTENT_ROOT = fileURLToPath(
  new URL('../../../../../curriculum-content/manuel-academy/', import.meta.url),
)

function readJson(path: string, label: string): unknown {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new RflContentError(`${label} is unavailable at ${path}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new RflContentError(`${label} is not valid JSON at ${path}`)
  }
}

interface RawLesson {
  readonly lesson_id: string
  readonly course_id: string
  readonly unit_number: number
  readonly unit_title: string
  readonly day_in_unit: number
  readonly course_day: number
  readonly title: string
  readonly focus: string
  readonly estimated_minutes: string
  readonly lesson_flow: readonly RflLessonFlowStep[]
  readonly student_activity: string
  readonly formative_check: string
  readonly extension: string
  readonly mastery_rule: string
  readonly safety_and_privacy: readonly string[]
  readonly parent_or_guardian_visibility: string
  readonly home_connection: string
  readonly adaptive_tutor_routes: readonly RflAdaptiveTutorRoute[]
}

function readLessonFlow(value: unknown, label: string): readonly RflLessonFlowStep[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RflContentError(`${label} has a lesson with an empty lesson_flow`)
  }
  return value.map((raw) => {
    const step = raw as { segment?: unknown; minutes?: unknown; teacher_or_tutor_action?: unknown }
    if (
      typeof step.segment !== 'string' || !step.segment ||
      typeof step.minutes !== 'string' || !step.minutes ||
      typeof step.teacher_or_tutor_action !== 'string' || !step.teacher_or_tutor_action
    ) {
      throw new RflContentError(`${label} has a lesson_flow step missing required fields`)
    }
    return Object.freeze({
      segment: step.segment,
      minutes: step.minutes,
      teacherOrTutorAction: step.teacher_or_tutor_action,
    })
  })
}

function readAdaptiveTutorRoutes(value: unknown, label: string): readonly RflAdaptiveTutorRoute[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RflContentError(`${label} has a lesson with empty adaptive_tutor_routes`)
  }
  return value.map((raw) => {
    const route = raw as { signal?: unknown; action?: unknown }
    if (typeof route.signal !== 'string' || !route.signal || typeof route.action !== 'string' || !route.action) {
      throw new RflContentError(`${label} has an adaptive_tutor_routes entry missing required fields`)
    }
    return Object.freeze({ signal: route.signal, action: route.action })
  })
}

function readSafetyAndPrivacy(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || !entry)) {
    throw new RflContentError(`${label} has a lesson with malformed safety_and_privacy`)
  }
  return Object.freeze(value.slice()) as readonly string[]
}

function readLessons(path: string, label: string): readonly RawLesson[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new RflContentError(`${label} is unavailable at ${path}`)
  }
  const lessons: RawLesson[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      throw new RflContentError(`${label} contains an invalid line`)
    }
    const record = value as {
      lesson_id?: unknown
      course_id?: unknown
      subject?: unknown
      unit_number?: unknown
      unit_title?: unknown
      day_in_unit?: unknown
      course_day?: unknown
      title?: unknown
      focus?: unknown
      estimated_minutes?: unknown
      standards?: unknown
      lesson_flow?: unknown
      student_activity?: unknown
      formative_check?: unknown
      extension?: unknown
      mastery_rule?: unknown
      safety_and_privacy?: unknown
      parent_or_guardian_visibility?: unknown
      home_connection?: unknown
      adaptive_tutor_routes?: unknown
    }
    if (
      typeof record.lesson_id !== 'string' || !record.lesson_id ||
      typeof record.course_id !== 'string' || !record.course_id ||
      record.subject !== READY_FOR_LIFE_SUBJECT ||
      typeof record.unit_number !== 'number' ||
      typeof record.unit_title !== 'string' || !record.unit_title ||
      typeof record.day_in_unit !== 'number' ||
      typeof record.course_day !== 'number' ||
      typeof record.title !== 'string' || !record.title ||
      typeof record.focus !== 'string' || !record.focus ||
      typeof record.estimated_minutes !== 'string' || !record.estimated_minutes ||
      !Array.isArray(record.standards) || record.standards.length === 0 ||
      typeof record.student_activity !== 'string' || !record.student_activity ||
      typeof record.formative_check !== 'string' || !record.formative_check ||
      typeof record.extension !== 'string' || !record.extension ||
      typeof record.mastery_rule !== 'string' || !record.mastery_rule ||
      typeof record.parent_or_guardian_visibility !== 'string' || !record.parent_or_guardian_visibility ||
      typeof record.home_connection !== 'string' || !record.home_connection
    ) {
      throw new RflContentError(`${label} has a lesson missing required fields`)
    }
    lessons.push({
      lesson_id: record.lesson_id,
      course_id: record.course_id,
      unit_number: record.unit_number,
      unit_title: record.unit_title,
      day_in_unit: record.day_in_unit,
      course_day: record.course_day,
      title: record.title,
      focus: record.focus,
      estimated_minutes: record.estimated_minutes,
      lesson_flow: readLessonFlow(record.lesson_flow, label),
      student_activity: record.student_activity,
      formative_check: record.formative_check,
      extension: record.extension,
      mastery_rule: record.mastery_rule,
      safety_and_privacy: readSafetyAndPrivacy(record.safety_and_privacy, label),
      parent_or_guardian_visibility: record.parent_or_guardian_visibility,
      home_connection: record.home_connection,
      adaptive_tutor_routes: readAdaptiveTutorRoutes(record.adaptive_tutor_routes, label),
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
    throw new RflContentError('production release registry has no currentRelease')
  }
  const releases = Array.isArray(registry.releases) ? registry.releases : []
  const active = releases.find(
    (release): release is { version: string; status: string } =>
      !!release && typeof release === 'object' &&
      (release as { status?: unknown }).status === 'active',
  )
  if (!active || active.version !== registry.currentRelease) {
    throw new RflContentError('production release registry has no matching active release')
  }
  return registry.currentRelease
}

function loadCourse(releaseVersion: string, grade: AcademyGrade): RflCourseRef {
  const base = join(CONTENT_ROOT, releaseVersion, 'grades', `grade-${grade}`, 'courses', READY_FOR_LIFE_SUBJECT)
  const label = `grade-${grade} ${READY_FOR_LIFE_SUBJECT}`

  const units = readJson(join(base, 'units.json'), `${label} units.json`)
  if (!Array.isArray(units) || units.length === 0) {
    throw new RflContentError(`${label} units.json is empty or malformed`)
  }
  if (units.length !== UNITS_PER_GRADE) {
    throw new RflContentError(
      `${label} must have exactly ${UNITS_PER_GRADE} units, found ${units.length}`,
    )
  }
  const assessments = readJson(join(base, 'assessments.json'), `${label} assessments.json`)
  if (!Array.isArray(assessments)) {
    throw new RflContentError(`${label} assessments.json is malformed`)
  }
  const assessmentIds = new Set(
    assessments.map((a) => (a as { assessment_id?: unknown }).assessment_id).filter((id) => typeof id === 'string'),
  )

  const rawLessons = readLessons(join(base, 'lessons.jsonl'), `${label} lessons.jsonl`)
  if (rawLessons.length !== LESSONS_PER_GRADE) {
    throw new RflContentError(
      `${label} must have exactly ${LESSONS_PER_GRADE} lessons, found ${rawLessons.length}`,
    )
  }

  const courseId = rawLessons[0].course_id
  const byId = new Map<string, RawLesson>()
  for (const lesson of rawLessons) {
    if (lesson.course_id !== courseId) {
      throw new RflContentError(`${label} has mixed course_id across lessons.jsonl`)
    }
    if (byId.has(lesson.lesson_id)) {
      throw new RflContentError(`${label} lessons.jsonl has duplicate lesson_id ${lesson.lesson_id}`)
    }
    byId.set(lesson.lesson_id, lesson)
  }

  const sortedByDay = rawLessons.slice().sort((a, b) => a.course_day - b.course_day)
  sortedByDay.forEach((lesson, index) => {
    const expectedDay = index + 1
    if (lesson.course_day !== expectedDay) {
      throw new RflContentError(
        `${label} course_day sequence has a gap or duplicate at position ${expectedDay} (got ${lesson.course_day})`,
      )
    }
  })

  const seenLessonIds = new Set<string>()
  const unitRefs: RflUnitRef[] = units
    .slice()
    .sort((a, b) => (a as { unit_number: number }).unit_number - (b as { unit_number: number }).unit_number)
    .map((raw) => {
      const unit = raw as {
        unit_id?: unknown
        course_id?: unknown
        unit_number?: unknown
        title?: unknown
        performance_task?: unknown
        assessment_id?: unknown
        lesson_ids?: unknown
      }
      if (
        typeof unit.unit_id !== 'string' || typeof unit.course_id !== 'string' ||
        typeof unit.unit_number !== 'number' || typeof unit.title !== 'string' ||
        typeof unit.performance_task !== 'string' || !unit.performance_task ||
        !Array.isArray(unit.lesson_ids) || unit.lesson_ids.length === 0
      ) {
        throw new RflContentError(`${label} unit ${String(unit.unit_id)} is missing required fields`)
      }
      if (unit.course_id !== courseId) {
        throw new RflContentError(`${label} has mixed course_id between units.json and lessons.jsonl`)
      }
      for (const lessonId of unit.lesson_ids) {
        if (typeof lessonId !== 'string') {
          throw new RflContentError(`${label} unit ${unit.unit_id} has a non-string lesson id`)
        }
        const lesson = byId.get(lessonId)
        if (!lesson) {
          throw new RflContentError(`${label} unit ${unit.unit_id} references unknown lesson ${lessonId}`)
        }
        if (lesson.unit_number !== unit.unit_number) {
          throw new RflContentError(
            `${label} lesson ${lessonId} belongs to unit ${lesson.unit_number}, not ${unit.unit_number} as units.json claims`,
          )
        }
        if (seenLessonIds.has(lessonId)) {
          throw new RflContentError(`${label} lesson ${lessonId} is listed in more than one unit`)
        }
        seenLessonIds.add(lessonId)
      }
      const assessmentId = typeof unit.assessment_id === 'string' ? unit.assessment_id : null
      if (assessmentId !== null && !assessmentIds.has(assessmentId)) {
        throw new RflContentError(`${label} unit ${unit.unit_id} references unknown assessment ${assessmentId}`)
      }
      return Object.freeze({
        unitId: unit.unit_id,
        courseId: unit.course_id,
        unitNumber: unit.unit_number,
        title: unit.title,
        performanceTask: unit.performance_task,
        assessmentId,
        lessonIds: Object.freeze(unit.lesson_ids.slice()) as readonly string[],
      })
    })

  if (seenLessonIds.size !== byId.size) {
    throw new RflContentError(`${label} units.json does not cover every lesson in lessons.jsonl`)
  }

  const unitByNumber = new Map(unitRefs.map((unit) => [unit.unitNumber, unit]))
  const lessons: RflLessonRef[] = sortedByDay.map((lesson) => {
    const unit = unitByNumber.get(lesson.unit_number)
    if (!unit) {
      throw new RflContentError(`${label} lesson ${lesson.lesson_id} references unit ${lesson.unit_number}, which has no units.json entry`)
    }
    if (lesson.unit_title !== unit.title) {
      throw new RflContentError(
        `${label} lesson ${lesson.lesson_id} unit_title "${lesson.unit_title}" does not match units.json title "${unit.title}" for unit ${lesson.unit_number}`,
      )
    }
    return Object.freeze({
      lessonId: lesson.lesson_id,
      courseId: lesson.course_id,
      grade,
      unitId: unit.unitId,
      unitNumber: lesson.unit_number,
      unitTitle: unit.title,
      dayInUnit: lesson.day_in_unit,
      courseDay: lesson.course_day,
      title: lesson.title,
      focus: lesson.focus,
      estimatedMinutes: lesson.estimated_minutes,
      lessonFlow: lesson.lesson_flow,
      studentActivity: lesson.student_activity,
      formativeCheck: lesson.formative_check,
      extension: lesson.extension,
      masteryRule: lesson.mastery_rule,
      safetyAndPrivacy: lesson.safety_and_privacy,
      parentOrGuardianVisibility: lesson.parent_or_guardian_visibility,
      homeConnection: lesson.home_connection,
      adaptiveTutorRoutes: lesson.adaptive_tutor_routes,
    })
  })

  return Object.freeze({
    courseId,
    grade,
    subject: READY_FOR_LIFE_SUBJECT,
    title: `Grade ${grade} Ready for Life`,
    units: Object.freeze(unitRefs),
    lessons: Object.freeze(lessons),
  })
}

let cached: RflCatalog | undefined

/** Loads (and caches) the Ready for Life catalog from the frozen curriculum
 * source. Throws RflContentError instead of returning a partial or guessed
 * catalog. Exactly 36 lessons / 6 units per grade, 108 / 18 total. */
export function loadReadyForLifeCatalog(): RflCatalog {
  if (cached) return cached
  const releaseVersion = readReleaseVersion()
  const courses = RFL_GRADES.map((grade) => loadCourse(releaseVersion, grade))
  const totalLessons = courses.reduce((sum, course) => sum + course.lessons.length, 0)
  const totalUnits = courses.reduce((sum, course) => sum + course.units.length, 0)
  if (totalLessons !== LESSONS_PER_GRADE * RFL_GRADES.length || totalUnits !== UNITS_PER_GRADE * RFL_GRADES.length) {
    throw new RflContentError(
      `Ready for Life catalog must total ${LESSONS_PER_GRADE * RFL_GRADES.length} lessons / ${UNITS_PER_GRADE * RFL_GRADES.length} units, found ${totalLessons} / ${totalUnits}`,
    )
  }
  cached = Object.freeze({ releaseVersion, courses: Object.freeze(courses) })
  return cached
}

/** Grade routing: the one course for a grade, or a precise error if the
 * grade isn't part of the Ready for Life pilot scope. */
export function getReadyForLifeCourse(catalog: RflCatalog, grade: AcademyGrade): RflCourseRef {
  const course = catalog.courses.find((c) => c.grade === grade)
  if (!course) throw new RflContentError(`No Ready for Life course is loaded for grade ${grade}`)
  return course
}

export function getReadyForLifeLesson(catalog: RflCatalog, lessonId: string): RflLessonRef {
  for (const course of catalog.courses) {
    const lesson = course.lessons.find((l) => l.lessonId === lessonId)
    if (lesson) return lesson
  }
  throw new RflContentError(`No Ready for Life lesson found for ${lessonId}`)
}
