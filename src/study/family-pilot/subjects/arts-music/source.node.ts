import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { AcademyGrade } from '../../../../types'
import {
  ARTS_MUSIC_SUBJECT,
  type ArtsMusicAssessmentRef,
  type ArtsMusicCatalog,
  type ArtsMusicCourseRef,
  type ArtsMusicLessonRef,
  type ArtsMusicLessonSegment,
  type ArtsMusicUnitRef,
} from './types'

/**
 * ARTS-MUSIC-1 — thrown instead of guessing when the frozen curriculum
 * source doesn't match what the catalog needs. A precise blocker, not an
 * invented lesson. Mirrors src/curriculum/family-pilot/source.node.ts's
 * FamilyPilotContentError.
 */
export class ArtsMusicContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArtsMusicContentError'
  }
}

const PILOT_GRADES: readonly AcademyGrade[] = ['5', '7', '8']

const CONTENT_ROOT = fileURLToPath(
  new URL('../../../../../curriculum-content/manuel-academy/', import.meta.url),
)

function readJson(path: string, label: string): unknown {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new ArtsMusicContentError(`${label} is unavailable at ${path}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new ArtsMusicContentError(`${label} is not valid JSON at ${path}`)
  }
}

interface RawLessonFlowStep {
  readonly segment: string
  readonly minutes: string
  readonly teacher_or_tutor_action: string
}

interface RawLesson {
  readonly lesson_id: string
  readonly course_id: string
  readonly unit_number: number
  readonly day_in_unit: number
  readonly course_day: number
  readonly title: string
  readonly focus: string
  readonly estimated_minutes: string
  readonly lesson_flow: readonly ArtsMusicLessonSegment[]
}

function readLessonFlow(value: unknown, label: string, lessonId: string): readonly ArtsMusicLessonSegment[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ArtsMusicContentError(`${label} lesson ${lessonId} has an empty or missing lesson_flow`)
  }
  return value.map((raw) => {
    const step = raw as { segment?: unknown; minutes?: unknown; teacher_or_tutor_action?: unknown }
    if (
      typeof step.segment !== 'string' || !step.segment ||
      typeof step.minutes !== 'string' || !step.minutes ||
      typeof step.teacher_or_tutor_action !== 'string' || !step.teacher_or_tutor_action
    ) {
      throw new ArtsMusicContentError(`${label} lesson ${lessonId} has a lesson_flow step missing required fields`)
    }
    return Object.freeze({
      segment: step.segment,
      minutes: step.minutes,
      teacherOrTutorAction: step.teacher_or_tutor_action,
    })
  })
}

function readLessons(path: string, label: string): readonly RawLesson[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new ArtsMusicContentError(`${label} is unavailable at ${path}`)
  }
  const lessons: RawLesson[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      throw new ArtsMusicContentError(`${label} contains an invalid line`)
    }
    const record = value as {
      lesson_id?: unknown
      course_id?: unknown
      unit_number?: unknown
      day_in_unit?: unknown
      course_day?: unknown
      title?: unknown
      focus?: unknown
      estimated_minutes?: unknown
      standards?: unknown
      lesson_flow?: unknown
    }
    if (
      typeof record.lesson_id !== 'string' || !record.lesson_id ||
      typeof record.course_id !== 'string' || !record.course_id ||
      typeof record.unit_number !== 'number' ||
      typeof record.day_in_unit !== 'number' ||
      typeof record.course_day !== 'number' ||
      typeof record.title !== 'string' || !record.title ||
      typeof record.focus !== 'string' || !record.focus ||
      typeof record.estimated_minutes !== 'string' || !record.estimated_minutes ||
      !Array.isArray(record.standards) || record.standards.length === 0
    ) {
      throw new ArtsMusicContentError(`${label} has a lesson missing required fields`)
    }
    lessons.push({
      lesson_id: record.lesson_id,
      course_id: record.course_id,
      unit_number: record.unit_number,
      day_in_unit: record.day_in_unit,
      course_day: record.course_day,
      title: record.title,
      focus: record.focus,
      estimated_minutes: record.estimated_minutes,
      lesson_flow: readLessonFlow(record.lesson_flow, label, record.lesson_id),
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
    throw new ArtsMusicContentError('production release registry has no currentRelease')
  }
  const releases = Array.isArray(registry.releases) ? registry.releases : []
  const active = releases.find(
    (release): release is { version: string; status: string } =>
      !!release && typeof release === 'object' &&
      (release as { status?: unknown }).status === 'active',
  )
  if (!active || active.version !== registry.currentRelease) {
    throw new ArtsMusicContentError('production release registry has no matching active release')
  }
  return registry.currentRelease
}

function readAssessments(path: string, label: string): readonly ArtsMusicAssessmentRef[] {
  const raw = readJson(path, label)
  if (!Array.isArray(raw)) {
    throw new ArtsMusicContentError(`${label} is malformed`)
  }
  return raw.map((entry) => {
    const assessment = entry as {
      assessment_id?: unknown
      unit_number?: unknown
      total_points?: unknown
      rubric_dimensions?: unknown
      mastery_interpretation?: unknown
    }
    if (
      typeof assessment.assessment_id !== 'string' || !assessment.assessment_id ||
      typeof assessment.unit_number !== 'number' ||
      typeof assessment.total_points !== 'number' ||
      !Array.isArray(assessment.rubric_dimensions) || assessment.rubric_dimensions.length === 0 ||
      !assessment.rubric_dimensions.every((dimension) => typeof dimension === 'string')
    ) {
      throw new ArtsMusicContentError(`${label} has an assessment missing required fields`)
    }
    const mastery = assessment.mastery_interpretation as { secure?: unknown; developing?: unknown; not_yet?: unknown } | undefined
    if (
      !mastery ||
      typeof mastery.secure !== 'string' || !mastery.secure ||
      typeof mastery.developing !== 'string' || !mastery.developing ||
      typeof mastery.not_yet !== 'string' || !mastery.not_yet
    ) {
      throw new ArtsMusicContentError(`${label} assessment ${assessment.assessment_id} is missing mastery_interpretation`)
    }
    return Object.freeze({
      assessmentId: assessment.assessment_id,
      unitNumber: assessment.unit_number,
      totalPoints: assessment.total_points,
      rubricDimensions: Object.freeze(assessment.rubric_dimensions.slice()) as readonly string[],
      masteryInterpretation: Object.freeze({
        secure: mastery.secure,
        developing: mastery.developing,
        notYet: mastery.not_yet,
      }),
    })
  })
}

function loadCourse(releaseVersion: string, grade: AcademyGrade): ArtsMusicCourseRef {
  const base = join(CONTENT_ROOT, releaseVersion, 'grades', `grade-${grade}`, 'courses', ARTS_MUSIC_SUBJECT)
  const label = `grade-${grade} ${ARTS_MUSIC_SUBJECT}`

  const units = readJson(join(base, 'units.json'), `${label} units.json`)
  if (!Array.isArray(units) || units.length === 0) {
    throw new ArtsMusicContentError(`${label} units.json is empty or malformed`)
  }

  const assessments = readAssessments(join(base, 'assessments.json'), `${label} assessments.json`)
  const assessmentIds = new Set(assessments.map((assessment) => assessment.assessmentId))

  const rawLessons = readLessons(join(base, 'lessons.jsonl'), `${label} lessons.jsonl`)
  if (rawLessons.length === 0) throw new ArtsMusicContentError(`${label} lessons.jsonl is empty`)

  const courseId = rawLessons[0].course_id
  const byId = new Map<string, RawLesson>()
  for (const lesson of rawLessons) {
    if (lesson.course_id !== courseId) {
      throw new ArtsMusicContentError(`${label} has mixed course_id across lessons.jsonl`)
    }
    if (byId.has(lesson.lesson_id)) {
      throw new ArtsMusicContentError(`${label} lessons.jsonl has duplicate lesson_id ${lesson.lesson_id}`)
    }
    byId.set(lesson.lesson_id, lesson)
  }

  const sortedByDay = rawLessons.slice().sort((a, b) => a.course_day - b.course_day)
  sortedByDay.forEach((lesson, index) => {
    const expectedDay = index + 1
    if (lesson.course_day !== expectedDay) {
      throw new ArtsMusicContentError(
        `${label} course_day sequence has a gap or duplicate at position ${expectedDay} (got ${lesson.course_day})`,
      )
    }
  })

  const seenLessonIds = new Set<string>()
  const unitRefs: ArtsMusicUnitRef[] = units
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
        throw new ArtsMusicContentError(`${label} unit ${String(unit.unit_id)} is missing required fields`)
      }
      if (unit.course_id !== courseId) {
        throw new ArtsMusicContentError(`${label} has mixed course_id between units.json and lessons.jsonl`)
      }
      for (const lessonId of unit.lesson_ids) {
        if (typeof lessonId !== 'string') {
          throw new ArtsMusicContentError(`${label} unit ${unit.unit_id} has a non-string lesson id`)
        }
        const lesson = byId.get(lessonId)
        if (!lesson) {
          throw new ArtsMusicContentError(`${label} unit ${unit.unit_id} references unknown lesson ${lessonId}`)
        }
        if (lesson.unit_number !== unit.unit_number) {
          throw new ArtsMusicContentError(
            `${label} lesson ${lessonId} belongs to unit ${lesson.unit_number}, not ${unit.unit_number} as units.json claims`,
          )
        }
        if (seenLessonIds.has(lessonId)) {
          throw new ArtsMusicContentError(`${label} lesson ${lessonId} is listed in more than one unit`)
        }
        seenLessonIds.add(lessonId)
      }
      const assessmentId = typeof unit.assessment_id === 'string' ? unit.assessment_id : null
      if (assessmentId !== null && !assessmentIds.has(assessmentId)) {
        throw new ArtsMusicContentError(`${label} unit ${unit.unit_id} references unknown assessment ${assessmentId}`)
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
    throw new ArtsMusicContentError(`${label} units.json does not cover every lesson in lessons.jsonl`)
  }

  const unitIdByNumber = new Map(unitRefs.map((unit) => [unit.unitNumber, unit.unitId]))
  const lessons: ArtsMusicLessonRef[] = sortedByDay.map((lesson) => {
    const unitId = unitIdByNumber.get(lesson.unit_number)
    if (!unitId) {
      throw new ArtsMusicContentError(`${label} lesson ${lesson.lesson_id} references unit ${lesson.unit_number}, which has no units.json entry`)
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
      estimatedMinutes: lesson.estimated_minutes,
      lessonFlow: lesson.lesson_flow,
    })
  })

  return Object.freeze({
    courseId,
    grade,
    subject: ARTS_MUSIC_SUBJECT,
    title: `Grade ${grade} Arts & Music`,
    units: Object.freeze(unitRefs),
    assessments: Object.freeze(assessments),
    lessons: Object.freeze(lessons),
  })
}

let cached: ArtsMusicCatalog | undefined

/** Loads (and caches) the Arts & Music catalog from the frozen curriculum
 * source. Throws ArtsMusicContentError instead of returning a partial or
 * guessed catalog. */
export function loadArtsMusicCatalog(): ArtsMusicCatalog {
  if (cached) return cached
  const releaseVersion = readReleaseVersion()
  const courses = PILOT_GRADES.map((grade) => loadCourse(releaseVersion, grade))
  cached = Object.freeze({ releaseVersion, courses: Object.freeze(courses) })
  return cached
}
