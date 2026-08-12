import type { AcademyGrade } from '../../types'
import { FAMILY_PILOT_SUBJECT, type PilotCourseRef, type PilotUnitRef } from './types'

/**
 * FAMILY-PILOT-CURR-1 — pure validation/assembly shared by source.node.ts
 * (fs-backed) and source.browser.ts (Vite static-import-backed). Neither
 * reads a file itself; each hands this already-loaded raw content so the
 * validation rules can't drift between the two environments.
 */
export class FamilyPilotContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FamilyPilotContentError'
  }
}

export interface RawLesson {
  readonly lesson_id: string
  readonly course_id: string
  readonly unit_number: number
  readonly day_in_unit: number
  readonly course_day: number
  readonly title: string
}

export function resolveReleaseVersion(registry: unknown): string {
  const reg = registry as { currentRelease?: unknown; releases?: unknown }
  if (typeof reg.currentRelease !== 'string' || !reg.currentRelease) {
    throw new FamilyPilotContentError('production release registry has no currentRelease')
  }
  const releases = Array.isArray(reg.releases) ? reg.releases : []
  const active = releases.find(
    (release): release is { version: string; status: string } =>
      !!release && typeof release === 'object' &&
      (release as { status?: unknown }).status === 'active',
  )
  if (!active || active.version !== reg.currentRelease) {
    throw new FamilyPilotContentError('production release registry has no matching active release')
  }
  return reg.currentRelease
}

export function parseLessonLines(raw: string, label: string): readonly RawLesson[] {
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

/** Assembles a validated PilotCourseRef from already-loaded, already-parsed
 * raw content. Throws FamilyPilotContentError on any contract violation. */
export function buildCourse(
  grade: AcademyGrade,
  label: string,
  unitsRaw: unknown,
  assessmentsRaw: unknown,
  rawLessons: readonly RawLesson[],
): PilotCourseRef {
  if (!Array.isArray(unitsRaw) || unitsRaw.length === 0) {
    throw new FamilyPilotContentError(`${label} units.json is empty or malformed`)
  }
  if (!Array.isArray(assessmentsRaw)) {
    throw new FamilyPilotContentError(`${label} assessments.json is malformed`)
  }
  const assessmentIds = new Set(
    assessmentsRaw.map((a) => (a as { assessment_id?: unknown }).assessment_id).filter((id) => typeof id === 'string'),
  )

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
  const unitRefs: PilotUnitRef[] = unitsRaw
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
  const lessons = sortedByDay.map((lesson) => {
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
