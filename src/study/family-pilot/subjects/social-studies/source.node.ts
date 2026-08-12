import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AcademyGrade } from '../../../../types'
import {
  SOCIAL_STUDIES_GRADES,
  SOCIAL_STUDIES_LESSONS_PER_GRADE,
  SOCIAL_STUDIES_PHASE_SEQUENCE,
  SOCIAL_STUDIES_SUBJECT_DIR,
  SOCIAL_STUDIES_TOTAL_LESSONS,
  SOCIAL_STUDIES_TOTAL_UNITS,
  SOCIAL_STUDIES_UNITS_PER_GRADE,
  type SocialStudiesAssessmentRef,
  type SocialStudiesCatalog,
  type SocialStudiesCourseRef,
  type SocialStudiesLessonRef,
  type SocialStudiesPhase,
  type SocialStudiesUnitRef,
} from './types'

/**
 * FF-M3 — thrown instead of guessing when the frozen curriculum source
 * doesn't match what the catalog needs. A precise blocker, not an invented
 * lesson or unit. Mirrors src/curriculum/family-pilot/source.node.ts's
 * FamilyPilotContentError so a source-custody failure here BLOCKs the same
 * way the rest of the Family Pilot does.
 */
export class SocialStudiesContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SocialStudiesContentError'
  }
}

const CONTENT_ROOT = new URL('../../../../../curriculum-content/manuel-academy/', import.meta.url)
const PHASE_SET: ReadonlySet<string> = new Set(SOCIAL_STUDIES_PHASE_SEQUENCE)

function contentRootPath(): string {
  return CONTENT_ROOT.protocol === 'file:' ? new URL(CONTENT_ROOT).pathname : CONTENT_ROOT.toString()
}

function readJson(path: string, label: string): unknown {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new SocialStudiesContentError(`${label} is unavailable at ${path}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new SocialStudiesContentError(`${label} is not valid JSON at ${path}`)
  }
}

function asStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new SocialStudiesContentError(`${label} must be an array of strings`)
  }
  return value as readonly string[]
}

interface RawLesson {
  readonly lesson_id: string
  readonly course_id: string
  readonly grade: number
  readonly unit_number: number
  readonly day_in_unit: number
  readonly course_day: number
  readonly title: string
  readonly phase: string
  readonly focus: string
  readonly essential_question: string
  readonly standards: readonly string[]
  readonly materials: readonly string[]
}

function readLessons(path: string, label: string): readonly RawLesson[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new SocialStudiesContentError(`${label} is unavailable at ${path}`)
  }
  const lessons: RawLesson[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      throw new SocialStudiesContentError(`${label} contains an invalid line`)
    }
    const record = value as {
      lesson_id?: unknown
      course_id?: unknown
      grade?: unknown
      unit_number?: unknown
      day_in_unit?: unknown
      course_day?: unknown
      title?: unknown
      phase?: unknown
      focus?: unknown
      essential_question?: unknown
      standards?: unknown
      materials?: unknown
    }
    if (
      typeof record.lesson_id !== 'string' || !record.lesson_id ||
      typeof record.course_id !== 'string' || !record.course_id ||
      typeof record.grade !== 'number' ||
      typeof record.unit_number !== 'number' ||
      typeof record.day_in_unit !== 'number' ||
      typeof record.course_day !== 'number' ||
      typeof record.title !== 'string' || !record.title ||
      typeof record.phase !== 'string' || !record.phase ||
      typeof record.focus !== 'string' || !record.focus ||
      typeof record.essential_question !== 'string' || !record.essential_question ||
      !Array.isArray(record.standards) || record.standards.length === 0 ||
      !Array.isArray(record.materials)
    ) {
      throw new SocialStudiesContentError(`${label} has a lesson missing required fields`)
    }
    lessons.push({
      lesson_id: record.lesson_id,
      course_id: record.course_id,
      grade: record.grade,
      unit_number: record.unit_number,
      day_in_unit: record.day_in_unit,
      course_day: record.course_day,
      title: record.title,
      phase: record.phase,
      focus: record.focus,
      essential_question: record.essential_question,
      standards: asStringArray(record.standards, `${label} lesson ${record.lesson_id} standards`),
      materials: asStringArray(record.materials, `${label} lesson ${record.lesson_id} materials`),
    })
  }
  return lessons
}

function readReleaseVersion(): string {
  const registry = readJson(
    join(contentRootPath(), 'production-release-registry.json'),
    'production release registry',
  ) as { currentRelease?: unknown; releases?: unknown }
  if (typeof registry.currentRelease !== 'string' || !registry.currentRelease) {
    throw new SocialStudiesContentError('production release registry has no currentRelease')
  }
  const releases = Array.isArray(registry.releases) ? registry.releases : []
  const active = releases.find(
    (release): release is { version: string; status: string } =>
      !!release && typeof release === 'object' &&
      (release as { status?: unknown }).status === 'active',
  )
  if (!active || active.version !== registry.currentRelease) {
    throw new SocialStudiesContentError('production release registry has no matching active release')
  }
  return registry.currentRelease
}

function readAssessments(path: string, label: string): readonly {
  readonly assessment_id: string
  readonly unit_number: number
  readonly unit_title: string
  readonly standards: readonly string[]
  readonly total_points: number
  readonly promptCount: number
}[] {
  const raw = readJson(path, label)
  if (!Array.isArray(raw)) {
    throw new SocialStudiesContentError(`${label} is malformed`)
  }
  return raw.map((entry) => {
    const record = entry as {
      assessment_id?: unknown
      unit_number?: unknown
      unit_title?: unknown
      standards?: unknown
      total_points?: unknown
      prompts?: unknown
    }
    if (
      typeof record.assessment_id !== 'string' || !record.assessment_id ||
      typeof record.unit_number !== 'number' ||
      typeof record.unit_title !== 'string' || !record.unit_title ||
      typeof record.total_points !== 'number' ||
      !Array.isArray(record.prompts) || record.prompts.length === 0
    ) {
      throw new SocialStudiesContentError(`${label} has an assessment missing required fields`)
    }
    return {
      assessment_id: record.assessment_id,
      unit_number: record.unit_number,
      unit_title: record.unit_title,
      standards: asStringArray(record.standards, `${label} assessment ${record.assessment_id} standards`),
      total_points: record.total_points,
      promptCount: record.prompts.length,
    }
  })
}

function loadCourse(releaseVersion: string, grade: AcademyGrade): SocialStudiesCourseRef {
  const base = join(contentRootPath(), releaseVersion, 'grades', `grade-${grade}`, 'courses', SOCIAL_STUDIES_SUBJECT_DIR)
  const label = `grade-${grade} ${SOCIAL_STUDIES_SUBJECT_DIR}`

  const rawUnits = readJson(join(base, 'units.json'), `${label} units.json`)
  if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
    throw new SocialStudiesContentError(`${label} units.json is empty or malformed`)
  }
  if (rawUnits.length !== SOCIAL_STUDIES_UNITS_PER_GRADE) {
    throw new SocialStudiesContentError(
      `${label} units.json has ${rawUnits.length} units, expected exactly ${SOCIAL_STUDIES_UNITS_PER_GRADE}`,
    )
  }

  const assessments = readAssessments(join(base, 'assessments.json'), `${label} assessments.json`)
  const assessmentById = new Map(assessments.map((assessment) => [assessment.assessment_id, assessment]))

  const rawLessons = readLessons(join(base, 'lessons.jsonl'), `${label} lessons.jsonl`)
  if (rawLessons.length !== SOCIAL_STUDIES_LESSONS_PER_GRADE) {
    throw new SocialStudiesContentError(
      `${label} lessons.jsonl has ${rawLessons.length} lessons, expected exactly ${SOCIAL_STUDIES_LESSONS_PER_GRADE}`,
    )
  }

  const courseId = rawLessons[0].course_id
  const byId = new Map<string, RawLesson>()
  for (const lesson of rawLessons) {
    if (lesson.course_id !== courseId) {
      throw new SocialStudiesContentError(`${label} has mixed course_id across lessons.jsonl`)
    }
    if (String(lesson.grade) !== grade) {
      throw new SocialStudiesContentError(`${label} lesson ${lesson.lesson_id} has grade ${lesson.grade}, expected ${grade}`)
    }
    if (byId.has(lesson.lesson_id)) {
      throw new SocialStudiesContentError(`${label} lessons.jsonl has duplicate lesson_id ${lesson.lesson_id}`)
    }
    byId.set(lesson.lesson_id, lesson)
  }

  const sortedByDay = rawLessons.slice().sort((a, b) => a.course_day - b.course_day)
  sortedByDay.forEach((lesson, index) => {
    const expectedDay = index + 1
    if (lesson.course_day !== expectedDay) {
      throw new SocialStudiesContentError(
        `${label} course_day sequence has a gap or duplicate at position ${expectedDay} (got ${lesson.course_day})`,
      )
    }
  })

  const seenLessonIds = new Set<string>()
  const unitRefs: SocialStudiesUnitRef[] = rawUnits
    .slice()
    .sort((a, b) => (a as { unit_number: number }).unit_number - (b as { unit_number: number }).unit_number)
    .map((raw, unitIndex) => {
      const unit = raw as {
        unit_id?: unknown
        course_id?: unknown
        unit_number?: unknown
        title?: unknown
        essential_question?: unknown
        standards?: unknown
        topics?: unknown
        performance_task?: unknown
        assessment_id?: unknown
        lesson_ids?: unknown
      }
      if (
        typeof unit.unit_id !== 'string' || typeof unit.course_id !== 'string' ||
        typeof unit.unit_number !== 'number' || typeof unit.title !== 'string' ||
        typeof unit.essential_question !== 'string' || typeof unit.performance_task !== 'string' ||
        !Array.isArray(unit.lesson_ids) || unit.lesson_ids.length === 0
      ) {
        throw new SocialStudiesContentError(`${label} unit ${String(unit.unit_id)} is missing required fields`)
      }
      if (unit.course_id !== courseId) {
        throw new SocialStudiesContentError(`${label} has mixed course_id between units.json and lessons.jsonl`)
      }
      if (unit.unit_number !== unitIndex + 1) {
        throw new SocialStudiesContentError(
          `${label} units.json has a gap or duplicate unit_number at position ${unitIndex + 1} (got ${unit.unit_number})`,
        )
      }
      for (const [dayIndex, lessonId] of unit.lesson_ids.entries()) {
        if (typeof lessonId !== 'string') {
          throw new SocialStudiesContentError(`${label} unit ${unit.unit_id} has a non-string lesson id`)
        }
        const lesson = byId.get(lessonId)
        if (!lesson) {
          throw new SocialStudiesContentError(`${label} unit ${unit.unit_id} references unknown lesson ${lessonId}`)
        }
        if (lesson.unit_number !== unit.unit_number) {
          throw new SocialStudiesContentError(
            `${label} lesson ${lessonId} belongs to unit ${lesson.unit_number}, not ${unit.unit_number} as units.json claims`,
          )
        }
        const expectedPhase = SOCIAL_STUDIES_PHASE_SEQUENCE[dayIndex]
        if (lesson.day_in_unit !== dayIndex + 1 || lesson.phase !== expectedPhase) {
          throw new SocialStudiesContentError(
            `${label} lesson ${lessonId} has day_in_unit/phase "${lesson.day_in_unit}/${lesson.phase}", expected "${dayIndex + 1}/${expectedPhase}"`,
          )
        }
        if (seenLessonIds.has(lessonId)) {
          throw new SocialStudiesContentError(`${label} lesson ${lessonId} is listed in more than one unit`)
        }
        seenLessonIds.add(lessonId)
      }
      if (unit.lesson_ids.length !== SOCIAL_STUDIES_PHASE_SEQUENCE.length) {
        throw new SocialStudiesContentError(
          `${label} unit ${unit.unit_id} has ${unit.lesson_ids.length} lessons, expected exactly ${SOCIAL_STUDIES_PHASE_SEQUENCE.length}`,
        )
      }
      const assessmentId = typeof unit.assessment_id === 'string' ? unit.assessment_id : null
      if (assessmentId === null || !assessmentById.has(assessmentId)) {
        throw new SocialStudiesContentError(`${label} unit ${unit.unit_id} references unknown assessment ${String(unit.assessment_id)}`)
      }
      const assessment = assessmentById.get(assessmentId)
      if (assessment?.unit_number !== unit.unit_number) {
        throw new SocialStudiesContentError(`${label} unit ${unit.unit_id} assessment ${assessmentId} belongs to a different unit`)
      }
      return Object.freeze({
        unitId: unit.unit_id,
        courseId: unit.course_id,
        grade,
        unitNumber: unit.unit_number,
        title: unit.title,
        essentialQuestion: unit.essential_question,
        standards: asStringArray(unit.standards, `${label} unit ${unit.unit_id} standards`),
        topics: asStringArray(unit.topics, `${label} unit ${unit.unit_id} topics`),
        performanceTask: unit.performance_task,
        assessmentId,
        lessonIds: Object.freeze(unit.lesson_ids.slice()) as readonly string[],
      })
    })

  if (seenLessonIds.size !== byId.size) {
    throw new SocialStudiesContentError(`${label} units.json does not cover every lesson in lessons.jsonl`)
  }

  const unitByNumber = new Map(unitRefs.map((unit) => [unit.unitNumber, unit]))
  const lessons: SocialStudiesLessonRef[] = sortedByDay.map((lesson) => {
    const unit = unitByNumber.get(lesson.unit_number)
    if (!unit) {
      throw new SocialStudiesContentError(`${label} lesson ${lesson.lesson_id} references unit ${lesson.unit_number}, which has no units.json entry`)
    }
    return Object.freeze({
      lessonId: lesson.lesson_id,
      courseId: lesson.course_id,
      grade,
      unitId: unit.unitId,
      unitNumber: lesson.unit_number,
      dayInUnit: lesson.day_in_unit,
      courseDay: lesson.course_day,
      title: lesson.title,
      phase: lesson.phase as SocialStudiesPhase,
      focus: lesson.focus,
      essentialQuestion: lesson.essential_question,
      standards: lesson.standards,
      materials: lesson.materials,
    })
  })

  const assessmentRefs: SocialStudiesAssessmentRef[] = unitRefs.map((unit) => {
    const assessment = assessmentById.get(unit.assessmentId as string)
    if (!assessment) {
      throw new SocialStudiesContentError(`${label} unit ${unit.unitId} assessment ${String(unit.assessmentId)} vanished during load`)
    }
    return Object.freeze({
      assessmentId: assessment.assessment_id,
      courseId,
      grade,
      unitNumber: assessment.unit_number,
      unitTitle: assessment.unit_title,
      standards: assessment.standards,
      totalPoints: assessment.total_points,
      promptCount: assessment.promptCount,
    })
  })

  return Object.freeze({
    courseId,
    grade,
    title: `Grade ${grade} Social Studies`,
    units: Object.freeze(unitRefs),
    lessons: Object.freeze(lessons),
    assessments: Object.freeze(assessmentRefs),
  })
}

let cached: SocialStudiesCatalog | undefined

/**
 * Loads (and caches) the Family Pilot Social Studies catalog from the frozen
 * curriculum source. Throws SocialStudiesContentError — BLOCKing — instead
 * of returning a partial or guessed catalog. Also enforces the CANONICAL
 * EXPECTATION totals (324 lessons / 27 units across grades 5/7/8) as a final
 * cross-grade custody check.
 */
export function loadSocialStudiesCatalog(): SocialStudiesCatalog {
  if (cached) return cached
  const releaseVersion = readReleaseVersion()
  const courses = SOCIAL_STUDIES_GRADES.map((grade) => loadCourse(releaseVersion, grade))

  const totalLessons = courses.reduce((sum, course) => sum + course.lessons.length, 0)
  const totalUnits = courses.reduce((sum, course) => sum + course.units.length, 0)
  if (totalLessons !== SOCIAL_STUDIES_TOTAL_LESSONS || totalUnits !== SOCIAL_STUDIES_TOTAL_UNITS) {
    throw new SocialStudiesContentError(
      `Social Studies catalog totals ${totalLessons} lessons / ${totalUnits} units, expected exactly ${SOCIAL_STUDIES_TOTAL_LESSONS} / ${SOCIAL_STUDIES_TOTAL_UNITS}`,
    )
  }
  for (const course of courses) {
    for (const lesson of course.lessons) {
      if (!PHASE_SET.has(lesson.phase)) {
        throw new SocialStudiesContentError(`${course.courseId} lesson ${lesson.lessonId} has an unrecognized phase "${lesson.phase}"`)
      }
    }
  }

  cached = Object.freeze({ releaseVersion, courses: Object.freeze(courses) })
  return cached
}
