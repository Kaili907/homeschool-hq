import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { AcademyGrade } from '../../../../types'
import type {
  PhysicalEducationCatalog,
  PhysicalEducationCourse,
  PhysicalEducationLesson,
  PhysicalEducationLessonFlowPhase,
  PhysicalEducationUnit,
} from './types'

/**
 * FF-M5 — thrown instead of guessing when the frozen curriculum source
 * doesn't match what the Physical Education catalog needs. A precise
 * blocker, not an invented lesson. Mirrors src/curriculum/family-pilot/source.node.ts.
 */
export class PhysicalEducationContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhysicalEducationContentError'
  }
}

const PE_GRADES: readonly AcademyGrade[] = ['5', '7', '8']
const SUBJECT_DIR = 'physical-education'

const CONTENT_ROOT = fileURLToPath(
  new URL('../../../../../curriculum-content/manuel-academy/', import.meta.url),
)

function readJson(path: string, label: string): unknown {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new PhysicalEducationContentError(`${label} is unavailable at ${path}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new PhysicalEducationContentError(`${label} is not valid JSON at ${path}`)
  }
}

function readReleaseVersion(): string {
  const registry = readJson(
    join(CONTENT_ROOT, 'production-release-registry.json'),
    'production release registry',
  ) as { currentRelease?: unknown; releases?: unknown }
  if (typeof registry.currentRelease !== 'string' || !registry.currentRelease) {
    throw new PhysicalEducationContentError('production release registry has no currentRelease')
  }
  const releases = Array.isArray(registry.releases) ? registry.releases : []
  const active = releases.find(
    (release): release is { version: string; status: string } =>
      !!release && typeof release === 'object' &&
      (release as { status?: unknown }).status === 'active',
  )
  if (!active || active.version !== registry.currentRelease) {
    throw new PhysicalEducationContentError('production release registry has no matching active release')
  }
  return registry.currentRelease
}

function str(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PhysicalEducationContentError(`${label} must be a non-empty string`)
  }
  return value
}

function strArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item)) {
    throw new PhysicalEducationContentError(`${label} must be a non-empty string array`)
  }
  return Object.freeze([...value]) as readonly string[]
}

function num(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new PhysicalEducationContentError(`${label} must be an integer`)
  }
  return value
}

function readLessonFlow(value: unknown, label: string): readonly PhysicalEducationLessonFlowPhase[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PhysicalEducationContentError(`${label} lesson_flow must be a non-empty array`)
  }
  return Object.freeze(value.map((raw, index) => {
    const item = raw as Record<string, unknown>
    return Object.freeze({
      segment: str(item.segment, `${label} lesson_flow[${index}].segment`),
      minutes: str(item.minutes, `${label} lesson_flow[${index}].minutes`),
      guidance: str(item.teacher_or_tutor_action, `${label} lesson_flow[${index}].teacher_or_tutor_action`),
    })
  }))
}

function readMedia(value: unknown, label: string): PhysicalEducationLesson['media'] {
  const media = value as Record<string, unknown>
  if (!media || typeof media !== 'object') {
    throw new PhysicalEducationContentError(`${label} media must be an object`)
  }
  if (media.required !== false) {
    // A lesson that requires media would violate the no-camera/photo/video
    // proof rule, so this is refused outright rather than silently accepted.
    throw new PhysicalEducationContentError(`${label} media.required must be false`)
  }
  return Object.freeze({
    suggestion: str(media.suggestion, `${label} media.suggestion`),
    required: false,
    fallback: str(media.fallback, `${label} media.fallback`),
  })
}

/** units.json is the sole source of unit_id; a lesson record only carries
 * unit_number and unit_title, so unitId is joined in afterward in loadCourse. */
type RawPhysicalEducationLesson = Omit<PhysicalEducationLesson, 'unitId'>

function readLesson(raw: unknown, label: string, grade: AcademyGrade): RawPhysicalEducationLesson {
  const record = raw as Record<string, unknown>
  const lessonId = str(record.lesson_id, `${label} lesson_id`)
  const lessonLabel = `${label} ${lessonId}`
  return Object.freeze({
    lessonId,
    courseId: str(record.course_id, `${lessonLabel} course_id`),
    grade,
    unitNumber: num(record.unit_number, `${lessonLabel} unit_number`),
    unitTitle: str(record.unit_title, `${lessonLabel} unit_title`),
    dayInUnit: num(record.day_in_unit, `${lessonLabel} day_in_unit`),
    courseDay: num(record.course_day, `${lessonLabel} course_day`),
    title: str(record.title, `${lessonLabel} title`),
    phase: str(record.phase, `${lessonLabel} phase`),
    focus: str(record.focus, `${lessonLabel} focus`),
    estimatedMinutes: str(record.estimated_minutes, `${lessonLabel} estimated_minutes`),
    standards: strArray(record.standards, `${lessonLabel} standards`),
    essentialQuestion: str(record.essential_question, `${lessonLabel} essential_question`),
    learningObjectives: strArray(record.learning_objectives, `${lessonLabel} learning_objectives`),
    successCriteria: strArray(record.success_criteria, `${lessonLabel} success_criteria`),
    materials: strArray(record.materials, `${lessonLabel} materials`),
    lessonFlow: readLessonFlow(record.lesson_flow, lessonLabel),
    studentActivity: str(record.student_activity, `${lessonLabel} student_activity`),
    formativeCheck: str(record.formative_check, `${lessonLabel} formative_check`),
    masteryRule: str(record.mastery_rule, `${lessonLabel} mastery_rule`),
    extension: str(record.extension, `${lessonLabel} extension`),
    accessibilityAndAccommodations: strArray(
      record.accessibility_and_accommodations,
      `${lessonLabel} accessibility_and_accommodations`,
    ),
    safetyAndPrivacy: strArray(record.safety_and_privacy, `${lessonLabel} safety_and_privacy`),
    media: readMedia(record.media, lessonLabel),
    parentOrGuardianVisibility: str(record.parent_or_guardian_visibility, `${lessonLabel} parent_or_guardian_visibility`),
    homeConnection: str(record.home_connection, `${lessonLabel} home_connection`),
  })
}

function readLessons(path: string, label: string, grade: AcademyGrade): readonly RawPhysicalEducationLesson[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new PhysicalEducationContentError(`${label} is unavailable at ${path}`)
  }
  const lessons: RawPhysicalEducationLesson[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      throw new PhysicalEducationContentError(`${label} contains an invalid line`)
    }
    lessons.push(readLesson(value, label, grade))
  }
  return lessons
}

function loadCourse(releaseVersion: string, grade: AcademyGrade): PhysicalEducationCourse {
  const base = join(CONTENT_ROOT, releaseVersion, 'grades', `grade-${grade}`, 'courses', SUBJECT_DIR)
  const label = `grade-${grade} ${SUBJECT_DIR}`

  const units = readJson(join(base, 'units.json'), `${label} units.json`)
  if (!Array.isArray(units) || units.length === 0) {
    throw new PhysicalEducationContentError(`${label} units.json is empty or malformed`)
  }
  const assessments = readJson(join(base, 'assessments.json'), `${label} assessments.json`)
  if (!Array.isArray(assessments)) {
    throw new PhysicalEducationContentError(`${label} assessments.json is malformed`)
  }
  const assessmentIds = new Set(
    assessments.map((a) => (a as { assessment_id?: unknown }).assessment_id).filter((id) => typeof id === 'string'),
  )

  const lessons = readLessons(join(base, 'lessons.jsonl'), `${label} lessons.jsonl`, grade)
  if (lessons.length === 0) throw new PhysicalEducationContentError(`${label} lessons.jsonl is empty`)

  const courseId = lessons[0].courseId
  const byId = new Map<string, RawPhysicalEducationLesson>()
  for (const lesson of lessons) {
    if (lesson.courseId !== courseId) {
      throw new PhysicalEducationContentError(`${label} has mixed course_id across lessons.jsonl`)
    }
    if (byId.has(lesson.lessonId)) {
      throw new PhysicalEducationContentError(`${label} lessons.jsonl has duplicate lesson_id ${lesson.lessonId}`)
    }
    byId.set(lesson.lessonId, lesson)
  }

  const sortedByDay = lessons.slice().sort((a, b) => a.courseDay - b.courseDay)
  sortedByDay.forEach((lesson, index) => {
    const expectedDay = index + 1
    if (lesson.courseDay !== expectedDay) {
      throw new PhysicalEducationContentError(
        `${label} course_day sequence has a gap or duplicate at position ${expectedDay} (got ${lesson.courseDay})`,
      )
    }
  })

  const seenLessonIds = new Set<string>()
  const unitRefs: PhysicalEducationUnit[] = units
    .slice()
    .sort((a, b) => (a as { unit_number: number }).unit_number - (b as { unit_number: number }).unit_number)
    .map((raw) => {
      const unit = raw as {
        unit_id?: unknown
        course_id?: unknown
        unit_number?: unknown
        title?: unknown
        essential_question?: unknown
        assessment_id?: unknown
        lesson_ids?: unknown
      }
      if (
        typeof unit.unit_id !== 'string' || typeof unit.course_id !== 'string' ||
        typeof unit.unit_number !== 'number' || typeof unit.title !== 'string' ||
        typeof unit.essential_question !== 'string' ||
        !Array.isArray(unit.lesson_ids) || unit.lesson_ids.length === 0
      ) {
        throw new PhysicalEducationContentError(`${label} unit ${String(unit.unit_id)} is missing required fields`)
      }
      if (unit.course_id !== courseId) {
        throw new PhysicalEducationContentError(`${label} has mixed course_id between units.json and lessons.jsonl`)
      }
      for (const lessonId of unit.lesson_ids) {
        if (typeof lessonId !== 'string') {
          throw new PhysicalEducationContentError(`${label} unit ${unit.unit_id} has a non-string lesson id`)
        }
        const lesson = byId.get(lessonId)
        if (!lesson) {
          throw new PhysicalEducationContentError(`${label} unit ${unit.unit_id} references unknown lesson ${lessonId}`)
        }
        if (lesson.unitNumber !== unit.unit_number) {
          throw new PhysicalEducationContentError(
            `${label} lesson ${lessonId} belongs to unit ${lesson.unitNumber}, not ${unit.unit_number} as units.json claims`,
          )
        }
        if (seenLessonIds.has(lessonId)) {
          throw new PhysicalEducationContentError(`${label} lesson ${lessonId} is listed in more than one unit`)
        }
        seenLessonIds.add(lessonId)
      }
      const assessmentId = typeof unit.assessment_id === 'string' ? unit.assessment_id : null
      if (assessmentId !== null && !assessmentIds.has(assessmentId)) {
        throw new PhysicalEducationContentError(`${label} unit ${unit.unit_id} references unknown assessment ${assessmentId}`)
      }
      return Object.freeze({
        unitId: unit.unit_id,
        courseId: unit.course_id,
        grade,
        unitNumber: unit.unit_number,
        title: unit.title,
        essentialQuestion: unit.essential_question,
        assessmentId,
        lessonIds: Object.freeze(unit.lesson_ids.slice()) as readonly string[],
      })
    })

  if (seenLessonIds.size !== byId.size) {
    throw new PhysicalEducationContentError(`${label} units.json does not cover every lesson in lessons.jsonl`)
  }

  const unitIdByNumber = new Map(unitRefs.map((unit) => [unit.unitNumber, unit.unitId]))
  const lessons_: PhysicalEducationLesson[] = sortedByDay.map((lesson) => {
    const unitId = unitIdByNumber.get(lesson.unitNumber)
    if (!unitId) {
      throw new PhysicalEducationContentError(
        `${label} lesson ${lesson.lessonId} references unit ${lesson.unitNumber}, which has no units.json entry`,
      )
    }
    return Object.freeze({ ...lesson, unitId })
  })

  return Object.freeze({
    courseId,
    grade,
    subject: 'physical-education' as const,
    title: `Grade ${grade} Physical Education`,
    units: Object.freeze(unitRefs),
    lessons: Object.freeze(lessons_),
  })
}

let cached: PhysicalEducationCatalog | undefined

/**
 * Loads (and caches) the Physical Education catalog from the frozen
 * curriculum source. Throws PhysicalEducationContentError instead of
 * returning a partial or guessed catalog.
 */
export function loadPhysicalEducationCatalog(): PhysicalEducationCatalog {
  if (cached) return cached
  const releaseVersion = readReleaseVersion()
  const courses = PE_GRADES.map((grade) => loadCourse(releaseVersion, grade))
  cached = Object.freeze({ releaseVersion, courses: Object.freeze(courses) })
  return cached
}
