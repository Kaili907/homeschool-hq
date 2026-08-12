import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { AcademyGrade } from '../../../../types'
import {
  SCIENCE_GRADES,
  SCIENCE_SUBJECT,
  type ScienceAssessmentPrompt,
  type ScienceCatalog,
  type ScienceCourseRef,
  type ScienceLessonDetail,
  type ScienceLessonFlowStep,
  type ScienceLessonRef,
  type ScienceUnitAssessment,
  type ScienceUnitRef,
} from './types'

/**
 * FAMILY-PILOT-SCIENCE-1 — thrown instead of guessing when the frozen
 * curriculum source doesn't match what the Science lane needs. A precise
 * blocker, never an invented lesson (see the mission's "Never invent
 * replacement lessons" rule).
 */
export class ScienceContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScienceContentError'
  }
}

const CONTENT_ROOT = fileURLToPath(
  new URL('../../../../../curriculum-content/manuel-academy/', import.meta.url),
)

const FORBIDDEN_MEDIA_PATTERN = /camera|photograph|upload (a|your) (photo|video|picture)|voice recording|record (yourself|your voice)/i

function readJson(path: string, label: string): unknown {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new ScienceContentError(`${label} is unavailable at ${path}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new ScienceContentError(`${label} is not valid JSON at ${path}`)
  }
}

function readReleaseVersion(): string {
  const registry = readJson(
    join(CONTENT_ROOT, 'production-release-registry.json'),
    'production release registry',
  ) as { currentRelease?: unknown; releases?: unknown }
  if (typeof registry.currentRelease !== 'string' || !registry.currentRelease) {
    throw new ScienceContentError('production release registry has no currentRelease')
  }
  const releases = Array.isArray(registry.releases) ? registry.releases : []
  const active = releases.find(
    (release): release is { version: string; status: string } =>
      !!release && typeof release === 'object' &&
      (release as { status?: unknown }).status === 'active',
  )
  if (!active || active.version !== registry.currentRelease) {
    throw new ScienceContentError('production release registry has no matching active release')
  }
  return registry.currentRelease
}

function requireString(value: unknown, field: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ScienceContentError(`${label} has a lesson with an invalid or missing "${field}"`)
  }
  return value
}

function requireStringArray(value: unknown, field: string, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new ScienceContentError(`${label} has a lesson with an invalid or missing "${field}"`)
  }
  return value as string[]
}

function readLessonFlow(value: unknown, label: string): readonly ScienceLessonFlowStep[] {
  if (!Array.isArray(value) || value.length !== 5) {
    throw new ScienceContentError(`${label} has a lesson whose lesson_flow is not the expected five-part sequence`)
  }
  return value.map((raw, index) => {
    const step = raw as { segment?: unknown; minutes?: unknown; teacher_or_tutor_action?: unknown }
    if (
      typeof step.segment !== 'string' || !step.segment.trim() ||
      typeof step.minutes !== 'string' || !step.minutes.trim() ||
      typeof step.teacher_or_tutor_action !== 'string' || !step.teacher_or_tutor_action.trim()
    ) {
      throw new ScienceContentError(`${label} has a malformed lesson_flow step at position ${index + 1}`)
    }
    return Object.freeze({
      segment: step.segment,
      minutes: step.minutes,
      teacherOrTutorAction: step.teacher_or_tutor_action,
    })
  })
}

function assertNoForbiddenMedia(strings: readonly string[], label: string, lessonId: string): void {
  for (const text of strings) {
    if (FORBIDDEN_MEDIA_PATTERN.test(text)) {
      throw new ScienceContentError(
        `${label} lesson ${lessonId} requires camera, photo, or voice-recording media, which the Science lane may not accept`,
      )
    }
  }
}

interface RawLesson {
  readonly lesson_id: string
  readonly course_id: string
  readonly unit_number: number
  readonly day_in_unit: number
  readonly course_day: number
  readonly title: string
  readonly detail: ScienceLessonDetail
}

function readLessons(path: string, label: string, grade: AcademyGrade): readonly RawLesson[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new ScienceContentError(`${label} is unavailable at ${path}`)
  }
  const lessons: RawLesson[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      throw new ScienceContentError(`${label} contains an invalid line`)
    }
    const record = value as Record<string, unknown>
    const lessonId = requireString(record.lesson_id, 'lesson_id', label)
    const courseId = requireString(record.course_id, 'course_id', label)
    const title = requireString(record.title, 'title', label)
    if (
      typeof record.unit_number !== 'number' ||
      typeof record.day_in_unit !== 'number' ||
      typeof record.course_day !== 'number'
    ) {
      throw new ScienceContentError(`${label} has a lesson missing required numeric fields`)
    }
    const standards = requireStringArray(record.standards, 'standards', label)
    const learningObjectives = requireStringArray(record.learning_objectives, 'learning_objectives', label)
    const successCriteria = requireStringArray(record.success_criteria, 'success_criteria', label)
    const materials = requireStringArray(record.materials, 'materials', label)
    const safetyAndPrivacy = requireStringArray(record.safety_and_privacy, 'safety_and_privacy', label)
    const essentialQuestion = requireString(record.essential_question, 'essential_question', label)
    const phase = requireString(record.phase, 'phase', label)
    const focus = requireString(record.focus, 'focus', label)
    const masteryRule = requireString(record.mastery_rule, 'mastery_rule', label)
    const parentOrGuardianVisibility = requireString(
      record.parent_or_guardian_visibility,
      'parent_or_guardian_visibility',
      label,
    )
    const lessonFlow = readLessonFlow(record.lesson_flow, label)

    const media = record.media as { suggestion?: unknown; required?: unknown; fallback?: unknown } | undefined
    if (
      !media || typeof media !== 'object' ||
      typeof media.suggestion !== 'string' ||
      media.required !== false ||
      typeof media.fallback !== 'string' || !media.fallback.trim()
    ) {
      throw new ScienceContentError(
        `${label} lesson ${lessonId} must declare media as optional (required: false) with a text-only fallback`,
      )
    }

    assertNoForbiddenMedia([media.suggestion, media.fallback, ...materials], label, lessonId)

    lessons.push({
      lesson_id: lessonId,
      course_id: courseId,
      unit_number: record.unit_number,
      day_in_unit: record.day_in_unit,
      course_day: record.course_day,
      title,
      detail: Object.freeze({
        lessonId,
        courseId,
        grade,
        unitId: '', // filled in once the owning unit is known, below
        unitNumber: record.unit_number,
        dayInUnit: record.day_in_unit,
        courseDay: record.course_day,
        title,
        phase,
        focus,
        essentialQuestion,
        standards: Object.freeze(standards.slice()),
        learningObjectives: Object.freeze(learningObjectives.slice()),
        successCriteria: Object.freeze(successCriteria.slice()),
        lessonFlow,
        masteryRule,
        safety: Object.freeze({
          materials: Object.freeze(materials.slice()),
          safetyAndPrivacy: Object.freeze(safetyAndPrivacy.slice()),
          mediaSuggestion: media.suggestion,
          mediaRequired: false,
          noMediaFallback: media.fallback,
          parentOrGuardianVisibility,
        }),
      }),
    })
  }
  return lessons
}

function readAssessments(path: string, label: string): ReadonlyMap<string, ScienceUnitAssessment> {
  const raw = readJson(path, `${label} assessments.json`)
  if (!Array.isArray(raw)) throw new ScienceContentError(`${label} assessments.json is malformed`)
  const byId = new Map<string, ScienceUnitAssessment>()
  for (const entry of raw) {
    const record = entry as Record<string, unknown>
    const assessmentId = requireString(record.assessment_id, 'assessment_id', `${label} assessments.json`)
    if (typeof record.unit_number !== 'number' || typeof record.total_points !== 'number') {
      throw new ScienceContentError(`${label} assessments.json entry ${assessmentId} is missing numeric fields`)
    }
    const unitTitle = requireString(record.unit_title, 'unit_title', `${label} assessments.json`)
    const standards = requireStringArray(record.standards, 'standards', `${label} assessments.json`)
    const rawPrompts = record.prompts
    if (!Array.isArray(rawPrompts) || rawPrompts.length === 0) {
      throw new ScienceContentError(`${label} assessments.json entry ${assessmentId} has no prompts`)
    }
    const prompts: ScienceAssessmentPrompt[] = rawPrompts.map((p) => {
      const prompt = p as { type?: unknown; prompt?: unknown; points?: unknown }
      if (
        typeof prompt.type !== 'string' || !prompt.type.trim() ||
        typeof prompt.prompt !== 'string' || !prompt.prompt.trim() ||
        typeof prompt.points !== 'number'
      ) {
        throw new ScienceContentError(`${label} assessments.json entry ${assessmentId} has a malformed prompt`)
      }
      return { type: prompt.type, prompt: prompt.prompt, points: prompt.points }
    })
    if (byId.has(assessmentId)) {
      throw new ScienceContentError(`${label} assessments.json has duplicate assessment_id ${assessmentId}`)
    }
    byId.set(assessmentId, Object.freeze({
      assessmentId,
      unitNumber: record.unit_number,
      unitTitle,
      standards: Object.freeze(standards.slice()),
      totalPoints: record.total_points,
      prompts: Object.freeze(prompts),
    }))
  }
  return byId
}

function loadCourse(releaseVersion: string, grade: AcademyGrade): ScienceCourseRef {
  const base = join(CONTENT_ROOT, releaseVersion, 'grades', `grade-${grade}`, 'courses', SCIENCE_SUBJECT)
  const label = `grade-${grade} ${SCIENCE_SUBJECT}`

  const rawUnits = readJson(join(base, 'units.json'), `${label} units.json`)
  if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
    throw new ScienceContentError(`${label} units.json is empty or malformed`)
  }
  const assessmentsById = readAssessments(join(base, 'assessments.json'), label)

  const rawLessons = readLessons(join(base, 'lessons.jsonl'), `${label} lessons.jsonl`, grade)
  if (rawLessons.length === 0) throw new ScienceContentError(`${label} lessons.jsonl is empty`)

  const courseId = rawLessons[0].course_id
  const byId = new Map<string, RawLesson>()
  for (const lesson of rawLessons) {
    if (lesson.course_id !== courseId) {
      throw new ScienceContentError(`${label} has mixed course_id across lessons.jsonl`)
    }
    if (byId.has(lesson.lesson_id)) {
      throw new ScienceContentError(`${label} lessons.jsonl has duplicate lesson_id ${lesson.lesson_id}`)
    }
    byId.set(lesson.lesson_id, lesson)
  }

  const sortedByDay = rawLessons.slice().sort((a, b) => a.course_day - b.course_day)
  sortedByDay.forEach((lesson, index) => {
    const expectedDay = index + 1
    if (lesson.course_day !== expectedDay) {
      throw new ScienceContentError(
        `${label} course_day sequence has a gap or duplicate at position ${expectedDay} (got ${lesson.course_day})`,
      )
    }
  })

  const seenLessonIds = new Set<string>()
  const unitRefs: ScienceUnitRef[] = rawUnits
    .slice()
    .sort((a, b) => (a as { unit_number: number }).unit_number - (b as { unit_number: number }).unit_number)
    .map((raw) => {
      const unit = raw as Record<string, unknown>
      const unitId = requireString(unit.unit_id, 'unit_id', `${label} units.json`)
      const unitCourseId = requireString(unit.course_id, 'course_id', `${label} units.json`)
      const title = requireString(unit.title, 'title', `${label} units.json`)
      const essentialQuestion = requireString(unit.essential_question, 'essential_question', `${label} units.json`)
      const standards = requireStringArray(unit.standards, 'standards', `${label} units.json`)
      if (typeof unit.unit_number !== 'number' || !Array.isArray(unit.lesson_ids) || unit.lesson_ids.length === 0) {
        throw new ScienceContentError(`${label} unit ${unitId} is missing required fields`)
      }
      if (unitCourseId !== courseId) {
        throw new ScienceContentError(`${label} has mixed course_id between units.json and lessons.jsonl`)
      }
      for (const lessonId of unit.lesson_ids) {
        if (typeof lessonId !== 'string') {
          throw new ScienceContentError(`${label} unit ${unitId} has a non-string lesson id`)
        }
        const lesson = byId.get(lessonId)
        if (!lesson) {
          throw new ScienceContentError(`${label} unit ${unitId} references unknown lesson ${lessonId}`)
        }
        if (lesson.unit_number !== unit.unit_number) {
          throw new ScienceContentError(
            `${label} lesson ${lessonId} belongs to unit ${lesson.unit_number}, not ${unit.unit_number} as units.json claims`,
          )
        }
        if (seenLessonIds.has(lessonId)) {
          throw new ScienceContentError(`${label} lesson ${lessonId} is listed in more than one unit`)
        }
        seenLessonIds.add(lessonId)
      }
      const assessmentId = typeof unit.assessment_id === 'string' ? unit.assessment_id : null
      if (assessmentId !== null && !assessmentsById.has(assessmentId)) {
        throw new ScienceContentError(`${label} unit ${unitId} references unknown assessment ${assessmentId}`)
      }
      return Object.freeze({
        unitId,
        courseId: unitCourseId,
        grade,
        unitNumber: unit.unit_number,
        title,
        essentialQuestion,
        standards: Object.freeze(standards.slice()),
        assessmentId,
        lessonIds: Object.freeze((unit.lesson_ids as string[]).slice()),
      })
    })

  if (seenLessonIds.size !== byId.size) {
    throw new ScienceContentError(`${label} units.json does not cover every lesson in lessons.jsonl`)
  }
  if (unitRefs.length !== 9) {
    throw new ScienceContentError(`${label} must have exactly 9 units, found ${unitRefs.length}`)
  }
  if (byId.size !== 108) {
    throw new ScienceContentError(`${label} must have exactly 108 lessons, found ${byId.size}`)
  }

  const unitIdByNumber = new Map(unitRefs.map((unit) => [unit.unitNumber, unit.unitId]))
  const lessonDetailById = new Map<string, ScienceLessonDetail>()
  const lessons: ScienceLessonRef[] = sortedByDay.map((lesson) => {
    const unitId = unitIdByNumber.get(lesson.unit_number)
    if (!unitId) {
      throw new ScienceContentError(`${label} lesson ${lesson.lesson_id} references unit ${lesson.unit_number}, which has no units.json entry`)
    }
    const detail: ScienceLessonDetail = Object.freeze({ ...lesson.detail, unitId })
    lessonDetailById.set(lesson.lesson_id, detail)
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
    subject: SCIENCE_SUBJECT,
    title: `Grade ${grade} Science`,
    units: Object.freeze(unitRefs),
    lessons: Object.freeze(lessons),
    lessonDetailById,
    assessmentsById,
  })
}

let cached: ScienceCatalog | undefined

/** Loads (and caches) the Family Pilot Science catalog from the frozen
 * curriculum source. Throws ScienceContentError instead of returning a
 * partial or guessed catalog. */
export function loadScienceCatalog(): ScienceCatalog {
  if (cached) return cached
  const releaseVersion = readReleaseVersion()
  const courses = SCIENCE_GRADES.map((grade) => loadCourse(releaseVersion, grade))
  cached = Object.freeze({ releaseVersion, courses: Object.freeze(courses) })
  return cached
}
