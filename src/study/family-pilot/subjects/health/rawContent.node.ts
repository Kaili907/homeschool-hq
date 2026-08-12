import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { assertNoDisallowedHealthFields } from './privacyProjection'
import type {
  HealthAdaptiveTutorRoute,
  HealthCatalog,
  HealthCourse,
  HealthGrade,
  HealthLesson,
  HealthLessonFlowSegment,
  HealthLessonMedia,
  HealthUnit,
} from './types'

/**
 * Node-only loader for the canonical Health curriculum. This is the Health
 * subject's own read of curriculum-content/manuel-academy — it does not
 * import or extend src/curriculum/family-pilot (that module is scoped to the
 * mathematics pilot course) — kept self-contained so this subject can be
 * owned, reviewed, and shipped independently of the other Family Pilot
 * subject modules landing in parallel.
 *
 * It never synthesizes missing content: any structural surprise throws
 * HealthContentError instead of returning a partial or guessed catalog.
 */

export class HealthContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HealthContentError'
  }
}

const HEALTH_GRADES: readonly HealthGrade[] = ['5', '7', '8']
const SUBJECT_DIR = 'health'

const CONTENT_ROOT = fileURLToPath(
  new URL('../../../../../curriculum-content/manuel-academy/', import.meta.url),
)

function readJson(path: string, label: string): unknown {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new HealthContentError(`${label} is unavailable at ${path}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new HealthContentError(`${label} is not valid JSON at ${path}`)
  }
}

function readReleaseVersion(): string {
  const registry = readJson(
    join(CONTENT_ROOT, 'production-release-registry.json'),
    'production release registry',
  ) as { currentRelease?: unknown; releases?: unknown }
  if (typeof registry.currentRelease !== 'string' || !registry.currentRelease) {
    throw new HealthContentError('production release registry has no currentRelease')
  }
  const releases = Array.isArray(registry.releases) ? registry.releases : []
  const active = releases.find(
    (release): release is { version: string; status: string } =>
      !!release && typeof release === 'object' &&
      (release as { status?: unknown }).status === 'active',
  )
  if (!active || active.version !== registry.currentRelease) {
    throw new HealthContentError('production release registry has no matching active release')
  }
  return registry.currentRelease
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new HealthContentError(`${label} must be a non-empty string`)
  return value
}

function requireStringArray(value: unknown, label: string, minItems: number): readonly string[] {
  if (!Array.isArray(value) || value.length < minItems) {
    throw new HealthContentError(`${label} must be an array with at least ${minItems} item(s)`)
  }
  return value.map((item, index) => requireString(item, `${label}[${index}]`))
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new HealthContentError(`${label} must be a boolean`)
  return value
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new HealthContentError(`${label} must be a number`)
  return value
}

function parseLessonFlow(value: unknown, label: string): readonly HealthLessonFlowSegment[] {
  if (!Array.isArray(value) || value.length < 5) {
    throw new HealthContentError(`${label} must be an array with at least 5 segments`)
  }
  return value.map((raw, index) => {
    const row = raw as { segment?: unknown; minutes?: unknown; teacher_or_tutor_action?: unknown }
    return {
      segment: requireString(row.segment, `${label}[${index}].segment`),
      minutes: requireString(row.minutes, `${label}[${index}].minutes`),
      teacherOrTutorAction: requireString(row.teacher_or_tutor_action, `${label}[${index}].teacher_or_tutor_action`),
    }
  })
}

function parseAdaptiveTutorRoutes(value: unknown, label: string): readonly HealthAdaptiveTutorRoute[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HealthContentError(`${label} must be a non-empty array`)
  }
  return value.map((raw, index) => {
    const row = raw as { signal?: unknown; action?: unknown }
    return {
      signal: requireString(row.signal, `${label}[${index}].signal`),
      action: requireString(row.action, `${label}[${index}].action`),
    }
  })
}

function parseMedia(value: unknown, label: string): HealthLessonMedia {
  if (!value || typeof value !== 'object') throw new HealthContentError(`${label} must be an object`)
  const row = value as { suggestion?: unknown; required?: unknown; fallback?: unknown }
  return {
    suggestion: requireString(row.suggestion, `${label}.suggestion`),
    required: requireBoolean(row.required, `${label}.required`),
    fallback: requireString(row.fallback, `${label}.fallback`),
  }
}

const LESSON_ID_PATTERN = /^ma-g(5|7|8)-health-u[0-9]{2}-l[0-9]{2}$/

function parseLesson(raw: unknown, grade: HealthGrade, label: string): HealthLesson {
  if (!raw || typeof raw !== 'object') throw new HealthContentError(`${label} is not an object`)
  const row = raw as Record<string, unknown>

  const lessonId = requireString(row.lesson_id, `${label}.lesson_id`)
  if (!LESSON_ID_PATTERN.test(lessonId)) throw new HealthContentError(`${label} has a malformed lesson_id: ${lessonId}`)

  if (row.subject !== 'health') throw new HealthContentError(`${label} has non-health subject: ${String(row.subject)}`)
  if (String(row.grade) !== grade) throw new HealthContentError(`${label} grade ${String(row.grade)} does not match expected ${grade}`)

  return {
    schemaVersion: requireString(row.schema_version, `${label}.schema_version`),
    lessonId,
    courseId: requireString(row.course_id, `${label}.course_id`),
    grade,
    subject: 'health',
    courseDay: requireNumber(row.course_day, `${label}.course_day`),
    unitNumber: requireNumber(row.unit_number, `${label}.unit_number`),
    unitTitle: requireString(row.unit_title, `${label}.unit_title`),
    dayInUnit: requireNumber(row.day_in_unit, `${label}.day_in_unit`),
    title: requireString(row.title, `${label}.title`),
    phase: requireString(row.phase, `${label}.phase`),
    focus: requireString(row.focus, `${label}.focus`),
    estimatedMinutes: requireString(row.estimated_minutes, `${label}.estimated_minutes`),
    standards: requireStringArray(row.standards, `${label}.standards`, 1),
    essentialQuestion: requireString(row.essential_question, `${label}.essential_question`),
    learningObjectives: requireStringArray(row.learning_objectives, `${label}.learning_objectives`, 3),
    successCriteria: requireStringArray(row.success_criteria, `${label}.success_criteria`, 1),
    materials: requireStringArray(row.materials, `${label}.materials`, 1),
    lessonFlow: parseLessonFlow(row.lesson_flow, `${label}.lesson_flow`),
    studentActivity: requireString(row.student_activity, `${label}.student_activity`),
    formativeCheck: requireString(row.formative_check, `${label}.formative_check`),
    answerOrScoringGuidance: requireString(row.answer_or_scoring_guidance, `${label}.answer_or_scoring_guidance`),
    adaptiveTutorRoutes: parseAdaptiveTutorRoutes(row.adaptive_tutor_routes, `${label}.adaptive_tutor_routes`),
    masteryRule: requireString(row.mastery_rule, `${label}.mastery_rule`),
    extension: requireString(row.extension, `${label}.extension`),
    accessibilityAndAccommodations: requireStringArray(
      row.accessibility_and_accommodations,
      `${label}.accessibility_and_accommodations`,
      5,
    ),
    safetyAndPrivacy: requireStringArray(row.safety_and_privacy, `${label}.safety_and_privacy`, 2),
    media: parseMedia(row.media, `${label}.media`),
    parentOrGuardianVisibility: requireString(row.parent_or_guardian_visibility, `${label}.parent_or_guardian_visibility`),
    homeConnection: requireString(row.home_connection, `${label}.home_connection`),
  }
}

function readLessons(path: string, grade: HealthGrade, label: string): readonly HealthLesson[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new HealthContentError(`${label} is unavailable at ${path}`)
  }
  const lessons: HealthLesson[] = []
  let lineNumber = 0
  for (const line of raw.split(/\r?\n/)) {
    lineNumber += 1
    if (!line.trim()) continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      throw new HealthContentError(`${label} line ${lineNumber} is not valid JSON`)
    }
    const lesson = parseLesson(value, grade, `${label} line ${lineNumber}`)
    // Defense in depth: a lesson that fails the privacy/safety content
    // guard must never load, not merely fail a test — see
    // assertNoDisallowedHealthFields in privacyProjection.ts.
    assertNoDisallowedHealthFields(lesson)
    lessons.push(lesson)
  }
  return lessons
}

function parseUnit(raw: unknown, grade: HealthGrade, label: string): HealthUnit {
  if (!raw || typeof raw !== 'object') throw new HealthContentError(`${label} is not an object`)
  const row = raw as Record<string, unknown>
  const assessmentId = row.assessment_id
  return {
    unitId: requireString(row.unit_id, `${label}.unit_id`),
    courseId: requireString(row.course_id, `${label}.course_id`),
    grade,
    unitNumber: requireNumber(row.unit_number, `${label}.unit_number`),
    title: requireString(row.title, `${label}.title`),
    days: requireNumber(row.days, `${label}.days`),
    standards: requireStringArray(row.standards, `${label}.standards`, 1),
    essentialQuestion: requireString(row.essential_question, `${label}.essential_question`),
    topics: requireStringArray(row.topics, `${label}.topics`, 1),
    performanceTask: requireString(row.performance_task, `${label}.performance_task`),
    assessmentId: assessmentId === null || assessmentId === undefined ? null : requireString(assessmentId, `${label}.assessment_id`),
    lessonIds: requireStringArray(row.lesson_ids, `${label}.lesson_ids`, 1),
  }
}

function readCourseTitleAndDescription(
  courseIndexPath: string,
  courseId: string,
): { readonly title: string; readonly description: string } {
  const index = readJson(courseIndexPath, 'course-index.json')
  if (!Array.isArray(index)) throw new HealthContentError('course-index.json is malformed')
  const entry = index.find(
    (candidate) => !!candidate && typeof candidate === 'object' && (candidate as { course_id?: unknown }).course_id === courseId,
  ) as { title?: unknown; description?: unknown } | undefined
  if (!entry) throw new HealthContentError(`course-index.json has no entry for ${courseId}`)
  return {
    title: requireString(entry.title, `course-index.json[${courseId}].title`),
    description: requireString(entry.description, `course-index.json[${courseId}].description`),
  }
}

function loadCourse(releaseVersion: string, grade: HealthGrade): HealthCourse {
  const releaseRoot = join(CONTENT_ROOT, releaseVersion)
  const base = join(releaseRoot, 'grades', `grade-${grade}`, 'courses', SUBJECT_DIR)
  const label = `grade-${grade} ${SUBJECT_DIR}`

  const rawUnits = readJson(join(base, 'units.json'), `${label} units.json`)
  if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
    throw new HealthContentError(`${label} units.json is empty or malformed`)
  }
  const rawAssessments = readJson(join(base, 'assessments.json'), `${label} assessments.json`)
  if (!Array.isArray(rawAssessments)) throw new HealthContentError(`${label} assessments.json is malformed`)
  const assessmentIds = new Set(
    rawAssessments
      .map((entry) => (entry as { assessment_id?: unknown }).assessment_id)
      .filter((id): id is string => typeof id === 'string'),
  )

  const lessons = readLessons(join(base, 'lessons.jsonl'), grade, `${label} lessons.jsonl`)
  if (lessons.length === 0) throw new HealthContentError(`${label} lessons.jsonl is empty`)

  const courseId = lessons[0].courseId
  const byId = new Map<string, HealthLesson>()
  for (const lesson of lessons) {
    if (lesson.courseId !== courseId) throw new HealthContentError(`${label} has mixed course_id across lessons.jsonl`)
    if (byId.has(lesson.lessonId)) throw new HealthContentError(`${label} lessons.jsonl has duplicate lesson_id ${lesson.lessonId}`)
    byId.set(lesson.lessonId, lesson)
  }

  const sortedByDay = lessons.slice().sort((a, b) => a.courseDay - b.courseDay)
  sortedByDay.forEach((lesson, index) => {
    const expectedDay = index + 1
    if (lesson.courseDay !== expectedDay) {
      throw new HealthContentError(
        `${label} course_day sequence has a gap or duplicate at position ${expectedDay} (got ${lesson.courseDay})`,
      )
    }
  })

  const seenLessonIds = new Set<string>()
  const units: HealthUnit[] = rawUnits
    .slice()
    .sort((a, b) => (a as { unit_number: number }).unit_number - (b as { unit_number: number }).unit_number)
    .map((raw) => {
      const unit = parseUnit(raw, grade, `${label} units.json unit`)
      if (unit.courseId !== courseId) throw new HealthContentError(`${label} has mixed course_id between units.json and lessons.jsonl`)
      for (const lessonId of unit.lessonIds) {
        const lesson = byId.get(lessonId)
        if (!lesson) throw new HealthContentError(`${label} unit ${unit.unitId} references unknown lesson ${lessonId}`)
        if (lesson.unitNumber !== unit.unitNumber) {
          throw new HealthContentError(
            `${label} lesson ${lessonId} belongs to unit ${lesson.unitNumber}, not ${unit.unitNumber} as units.json claims`,
          )
        }
        if (seenLessonIds.has(lessonId)) throw new HealthContentError(`${label} lesson ${lessonId} is listed in more than one unit`)
        seenLessonIds.add(lessonId)
      }
      if (unit.assessmentId !== null && !assessmentIds.has(unit.assessmentId)) {
        throw new HealthContentError(`${label} unit ${unit.unitId} references unknown assessment ${unit.assessmentId}`)
      }
      return unit
    })

  if (seenLessonIds.size !== byId.size) throw new HealthContentError(`${label} units.json does not cover every lesson in lessons.jsonl`)
  if (units.length !== 6) throw new HealthContentError(`${label} must have exactly 6 units, found ${units.length}`)
  if (sortedByDay.length !== 36) throw new HealthContentError(`${label} must have exactly 36 lessons, found ${sortedByDay.length}`)

  const { title, description } = readCourseTitleAndDescription(join(releaseRoot, 'course-index.json'), courseId)

  return Object.freeze({
    courseId,
    grade,
    title,
    description,
    units: Object.freeze(units),
    lessons: Object.freeze(sortedByDay),
  })
}

let cached: HealthCatalog | undefined

/**
 * Loads (and caches) the canonical Health catalog for grades 5, 7, and 8 from
 * the frozen curriculum source. Throws HealthContentError instead of
 * returning a partial or synthesized catalog.
 */
export function loadHealthCatalog(): HealthCatalog {
  if (cached) return cached
  const releaseVersion = readReleaseVersion()
  const courses = HEALTH_GRADES.map((grade) => loadCourse(releaseVersion, grade))
  cached = Object.freeze({ releaseVersion, courses: Object.freeze(courses) })
  return cached
}

/** Test-only seam: forces the next loadHealthCatalog() call to re-read from disk. */
export function resetHealthCatalogCacheForTests(): void {
  cached = undefined
}
