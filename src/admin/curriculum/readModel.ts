import {
  CURRICULUM_SEARCH_LIMIT,
  CurriculumSourceError,
  type CurriculumAssessmentEvidence,
  type CurriculumCatalog,
  type CurriculumCourseSummary,
  type CurriculumGrade,
  type CurriculumLessonDetail,
  type CurriculumLessonSummary,
  type CurriculumSearchFilters,
  type CurriculumSearchResult,
  type CurriculumSourceIdentity,
  type CurriculumStandardCoverage,
  type CurriculumUnitSummary,
} from './contracts'

const SUPPORTED_GRADES = new Set<number>([5, 7, 8])
type JsonObject = Record<string, unknown>

export interface CurriculumCatalogInput {
  readonly manifestJson: string
  readonly courseIndexJson: string
  readonly unitIndexJson: string
  readonly lessonIndexCsv: string
  readonly assessmentJsonByCourse: Readonly<Record<string, string>>
  readonly validationPassed: boolean
}

function malformed(message: string): never {
  throw new CurriculumSourceError('malformed', message)
}

function inconsistent(message: string): never {
  throw new CurriculumSourceError('inconsistent', message)
}

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    malformed(`${label} is not valid JSON`)
  }
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) malformed(`${label} must be an object`)
  return value as JsonObject
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) malformed(`${label} must be an array`)
  return value
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') malformed(`${label} must be a non-empty string`)
  return value
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return string(value, label)
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) malformed(`${label} must be a number`)
  return value
}

function grade(value: unknown, label: string): CurriculumGrade {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !SUPPORTED_GRADES.has(parsed)) malformed(`${label} is unsupported`)
  return parsed as CurriculumGrade
}

function stringArray(value: unknown, label: string, required = false): string[] {
  if (value === undefined || value === null) {
    if (required) malformed(`${label} must be an array`)
    return []
  }
  return array(value, label).map((item, index) => string(item, `${label}[${index}]`))
}

function parseCsv(raw: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index]
    if (quoted) {
      if (char === '"' && raw[index + 1] === '"') {
        cell += '"'
        index++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (quoted) malformed('lesson-index.csv contains an unterminated quoted field')
  if (cell !== '' || row.length > 0) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value !== ''))
}

function parseSourceIdentity(manifestJson: string, validationPassed: boolean): {
  source: CurriculumSourceIdentity
  grades: CurriculumGrade[]
  expectedCounts: { courses: number; units: number; lessons: number }
} {
  const manifest = object(parseJson(manifestJson, 'curriculum-manifest.json'), 'curriculum manifest')
  const counts = object(manifest.counts, 'curriculum manifest counts')
  return {
    source: {
      packageId: string(manifest.package_id, 'curriculum manifest package_id'),
      version: string(manifest.version, 'curriculum manifest version'),
      authoredOn: string(manifest.authored_on, 'curriculum manifest authored_on'),
      status: string(manifest.status, 'curriculum manifest status'),
      lifecycle: 'published',
      validationStatus: validationPassed ? 'passed' : 'unavailable',
    },
    grades: array(manifest.grades, 'curriculum manifest grades').map((value, index) =>
      grade(value, `curriculum manifest grades[${index}]`),
    ),
    expectedCounts: {
      courses: number(counts.courses, 'curriculum manifest course count'),
      units: number(counts.units, 'curriculum manifest unit count'),
      lessons: number(counts.lessons, 'curriculum manifest lesson count'),
    },
  }
}

function parseCourses(raw: string): CurriculumCourseSummary[] {
  return array(parseJson(raw, 'course-index.json'), 'course index').map((item, index) => {
    const course = object(item, `course index row ${index + 1}`)
    return {
      courseId: string(course.course_id, `course ${index + 1} course_id`),
      grade: grade(course.grade, `course ${index + 1} grade`),
      subject: string(course.subject, `course ${index + 1} subject`),
      title: string(course.title, `course ${index + 1} title`),
      days: number(course.days, `course ${index + 1} days`),
      description: optionalString(course.description, `course ${index + 1} description`),
      capstone: optionalString(course.capstone, `course ${index + 1} capstone`),
    }
  })
}

function parseUnits(raw: string): CurriculumUnitSummary[] {
  return array(parseJson(raw, 'unit-index.json'), 'unit index').map((item, index) => {
    const unit = object(item, `unit index row ${index + 1}`)
    return {
      unitId: string(unit.unit_id, `unit ${index + 1} unit_id`),
      courseId: string(unit.course_id, `unit ${index + 1} course_id`),
      grade: grade(unit.grade, `unit ${index + 1} grade`),
      subject: string(unit.subject, `unit ${index + 1} subject`),
      unitNumber: number(unit.unit_number, `unit ${index + 1} unit_number`),
      title: string(unit.title, `unit ${index + 1} title`),
      days: number(unit.days, `unit ${index + 1} days`),
      standards: stringArray(unit.standards, `unit ${index + 1} standards`, true),
      essentialQuestion: optionalString(unit.essential_question, `unit ${index + 1} essential_question`),
      topics: stringArray(unit.topics, `unit ${index + 1} topics`),
      performanceTask: optionalString(unit.performance_task, `unit ${index + 1} performance_task`),
      lessonIds: stringArray(unit.lesson_ids, `unit ${index + 1} lesson_ids`, true),
      assessmentId: optionalString(unit.assessment_id, `unit ${index + 1} assessment_id`),
    }
  })
}

const LESSON_INDEX_COLUMNS = [
  'lesson_id', 'course_id', 'grade', 'subject', 'course_day', 'unit_number',
  'unit_title', 'day_in_unit', 'title', 'phase', 'focus', 'standards',
] as const

function parseLessonIndex(raw: string): CurriculumLessonSummary[] {
  const rows = parseCsv(raw)
  if (rows.length < 2) malformed('lesson-index.csv has no lesson rows')
  const header = rows[0]
  for (const column of LESSON_INDEX_COLUMNS) {
    if (!header.includes(column)) malformed(`lesson-index.csv is missing ${column}`)
  }
  const at = (row: string[], column: string) => row[header.indexOf(column)] ?? ''
  return rows.slice(1).map((row, index) => ({
    lessonId: string(at(row, 'lesson_id'), `lesson index row ${index + 2} lesson_id`),
    courseId: string(at(row, 'course_id'), `lesson index row ${index + 2} course_id`),
    grade: grade(at(row, 'grade'), `lesson index row ${index + 2} grade`),
    subject: string(at(row, 'subject'), `lesson index row ${index + 2} subject`),
    courseDay: number(Number(at(row, 'course_day')), `lesson index row ${index + 2} course_day`),
    unitNumber: number(Number(at(row, 'unit_number')), `lesson index row ${index + 2} unit_number`),
    unitTitle: string(at(row, 'unit_title'), `lesson index row ${index + 2} unit_title`),
    dayInUnit: number(Number(at(row, 'day_in_unit')), `lesson index row ${index + 2} day_in_unit`),
    title: string(at(row, 'title'), `lesson index row ${index + 2} title`),
    phase: optionalString(at(row, 'phase'), `lesson index row ${index + 2} phase`),
    focus: optionalString(at(row, 'focus'), `lesson index row ${index + 2} focus`),
    standards: at(row, 'standards').split(';').map((value) => value.trim()).filter(Boolean),
  }))
}

function parseAssessments(
  rawByCourse: Readonly<Record<string, string>>,
  unitsByAssessmentId: ReadonlyMap<string, CurriculumUnitSummary>,
): CurriculumAssessmentEvidence[] {
  const assessments: CurriculumAssessmentEvidence[] = []
  for (const [courseId, raw] of Object.entries(rawByCourse).sort(([a], [b]) => a.localeCompare(b))) {
    const values = array(parseJson(raw, `${courseId} assessments.json`), `${courseId} assessments`)
    for (const [index, value] of values.entries()) {
      const assessment = object(value, `${courseId} assessment ${index + 1}`)
      const assessmentId = string(assessment.assessment_id, `${courseId} assessment ${index + 1} id`)
      const unit = unitsByAssessmentId.get(assessmentId)
      if (!unit || unit.courseId !== courseId) inconsistent(`${assessmentId} is not linked by unit-index.json`)
      assessments.push({
        assessmentId,
        courseId,
        unitNumber: number(assessment.unit_number, `${assessmentId} unit_number`),
        unitTitle: string(assessment.unit_title, `${assessmentId} unit_title`),
        standards: stringArray(assessment.standards, `${assessmentId} standards`, true),
        totalPoints: assessment.total_points === undefined
          ? undefined
          : number(assessment.total_points, `${assessmentId} total_points`),
      })
    }
  }
  return assessments
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) inconsistent(`${label} contains duplicate identifiers`)
}

export function buildCurriculumCatalog(input: CurriculumCatalogInput): CurriculumCatalog {
  const { source, grades, expectedCounts } = parseSourceIdentity(input.manifestJson, input.validationPassed)
  const courses = parseCourses(input.courseIndexJson)
  const units = parseUnits(input.unitIndexJson)
  const lessons = parseLessonIndex(input.lessonIndexCsv)
  assertUnique(courses.map((item) => item.courseId), 'course index')
  assertUnique(units.map((item) => item.unitId), 'unit index')
  assertUnique(lessons.map((item) => item.lessonId), 'lesson index')
  if (courses.length !== expectedCounts.courses || units.length !== expectedCounts.units || lessons.length !== expectedCounts.lessons) {
    inconsistent('curriculum indexes do not match manifest counts')
  }
  const coursesById = new Map(courses.map((course) => [course.courseId, course]))
  const unitsById = new Map(units.map((unit) => [unit.unitId, unit]))
  const unitsByAssessmentId = new Map(
    units.filter((unit) => unit.assessmentId).map((unit) => [unit.assessmentId!, unit]),
  )
  for (const unit of units) {
    const course = coursesById.get(unit.courseId)
    if (!course || course.grade !== unit.grade || course.subject !== unit.subject) inconsistent(`${unit.unitId} has no matching course`)
  }
  for (const lesson of lessons) {
    const course = coursesById.get(lesson.courseId)
    const unitId = `${lesson.courseId}-u${String(lesson.unitNumber).padStart(2, '0')}`
    const unit = unitsById.get(unitId)
    if (!course || !unit || lesson.grade !== course.grade || !unit.lessonIds.includes(lesson.lessonId)) {
      inconsistent(`${lesson.lessonId} is not linked by the course and unit indexes`)
    }
  }
  const assessments = parseAssessments(input.assessmentJsonByCourse, unitsByAssessmentId)
  return { source, grades, courses, units, lessons, assessments }
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

export function searchCurriculum(
  catalog: CurriculumCatalog,
  filters: CurriculumSearchFilters,
  limit: number = CURRICULUM_SEARCH_LIMIT,
): CurriculumSearchResult {
  const keyword = normalize(filters.keyword ?? '')
  const standard = normalize(filters.standard ?? '')
  const matches = catalog.lessons.filter((lesson) => {
    if (filters.grade !== undefined && lesson.grade !== filters.grade) return false
    if (filters.courseId && lesson.courseId !== filters.courseId) return false
    if (filters.unitNumber !== undefined && lesson.unitNumber !== filters.unitNumber) return false
    if (standard && !lesson.standards.some((value) => normalize(value).includes(standard))) return false
    if (!keyword) return true
    return [lesson.lessonId, lesson.courseId, String(lesson.grade), String(lesson.unitNumber), lesson.unitTitle,
      lesson.title, lesson.phase ?? '', lesson.focus ?? '', ...lesson.standards]
      .some((value) => normalize(value).includes(keyword))
  }).sort((a, b) =>
    a.grade - b.grade || a.courseId.localeCompare(b.courseId) || a.courseDay - b.courseDay || a.lessonId.localeCompare(b.lessonId),
  )
  const safeLimit = Math.max(1, Math.min(limit, CURRICULUM_SEARCH_LIMIT))
  return { lessons: matches.slice(0, safeLimit), totalMatches: matches.length, limited: matches.length > safeLimit }
}

export function buildStandardsCoverage(catalog: CurriculumCatalog): CurriculumStandardCoverage[] {
  const standards = [...new Set(catalog.lessons.flatMap((lesson) => lesson.standards))].sort((a, b) => a.localeCompare(b))
  return standards.map((standard) => {
    const lessons = catalog.lessons.filter((lesson) => lesson.standards.includes(standard))
    const relevantUnits = new Set(lessons.map((lesson) => `${lesson.courseId}:${lesson.unitNumber}`))
    const assessmentEvidence = catalog.assessments.filter(
      (assessment) => assessment.standards.includes(standard) && relevantUnits.has(`${assessment.courseId}:${assessment.unitNumber}`),
    )
    return { standard, lessons, assessmentEvidence }
  })
}

export function parseCurriculumLesson(
  rawLine: string,
  summary: CurriculumLessonSummary,
  source: CurriculumSourceIdentity,
  assessment?: CurriculumAssessmentEvidence,
): CurriculumLessonDetail {
  const lesson = object(parseJson(rawLine, `${summary.lessonId} lesson`), summary.lessonId)
  if (string(lesson.lesson_id, `${summary.lessonId} lesson_id`) !== summary.lessonId) inconsistent(`${summary.lessonId} detail has a different lesson_id`)
  if (string(lesson.course_id, `${summary.lessonId} course_id`) !== summary.courseId) inconsistent(`${summary.lessonId} detail has a different course_id`)
  if (grade(lesson.grade, `${summary.lessonId} grade`) !== summary.grade) inconsistent(`${summary.lessonId} detail has a different grade`)
  if (number(lesson.unit_number, `${summary.lessonId} unit_number`) !== summary.unitNumber) inconsistent(`${summary.lessonId} detail has a different unit`)
  const flow = array(lesson.lesson_flow, `${summary.lessonId} lesson_flow`).map((value, index) => {
    const segment = object(value, `${summary.lessonId} lesson_flow[${index}]`)
    return {
      segment: string(segment.segment, `${summary.lessonId} lesson_flow[${index}].segment`),
      minutes: optionalString(segment.minutes, `${summary.lessonId} lesson_flow[${index}].minutes`),
      teacherOrTutorAction: string(segment.teacher_or_tutor_action, `${summary.lessonId} lesson_flow[${index}].teacher_or_tutor_action`),
    }
  })
  const routes = lesson.adaptive_tutor_routes === undefined
    ? []
    : array(lesson.adaptive_tutor_routes, `${summary.lessonId} adaptive_tutor_routes`).map((value, index) => {
        const route = object(value, `${summary.lessonId} adaptive_tutor_routes[${index}]`)
        return {
          signal: string(route.signal, `${summary.lessonId} adaptive_tutor_routes[${index}].signal`),
          action: string(route.action, `${summary.lessonId} adaptive_tutor_routes[${index}].action`),
        }
      })
  let media: CurriculumLessonDetail['media']
  if (typeof lesson.media === 'string') media = lesson.media
  else if (lesson.media !== undefined && lesson.media !== null) {
    const value = object(lesson.media, `${summary.lessonId} media`)
    if (value.required !== undefined && typeof value.required !== 'boolean') malformed(`${summary.lessonId} media.required must be boolean`)
    media = {
      required: value.required as boolean | undefined,
      description: optionalString(value.description, `${summary.lessonId} media.description`),
      suggestion: optionalString(value.suggestion, `${summary.lessonId} media.suggestion`),
      fallback: optionalString(value.fallback, `${summary.lessonId} media.fallback`),
    }
  }
  return {
    ...summary,
    schemaVersion: string(lesson.schema_version, `${summary.lessonId} schema_version`),
    estimatedMinutes: optionalString(lesson.estimated_minutes, `${summary.lessonId} estimated_minutes`),
    essentialQuestion: optionalString(lesson.essential_question, `${summary.lessonId} essential_question`),
    learningObjectives: stringArray(lesson.learning_objectives, `${summary.lessonId} learning_objectives`, true),
    successCriteria: stringArray(lesson.success_criteria, `${summary.lessonId} success_criteria`),
    materials: stringArray(lesson.materials, `${summary.lessonId} materials`),
    lessonFlow: flow,
    studentActivity: optionalString(lesson.student_activity, `${summary.lessonId} student_activity`),
    formativeCheck: string(lesson.formative_check, `${summary.lessonId} formative_check`),
    scoringGuidance: optionalString(lesson.answer_or_scoring_guidance, `${summary.lessonId} answer_or_scoring_guidance`),
    masteryRule: optionalString(lesson.mastery_rule, `${summary.lessonId} mastery_rule`),
    adaptiveTutorRoutes: routes,
    extension: optionalString(lesson.extension, `${summary.lessonId} extension`),
    accommodations: stringArray(lesson.accessibility_and_accommodations, `${summary.lessonId} accessibility_and_accommodations`, true),
    safetyAndPrivacy: stringArray(lesson.safety_and_privacy, `${summary.lessonId} safety_and_privacy`, true),
    media,
    parentVisibility: optionalString(lesson.parent_or_guardian_visibility, `${summary.lessonId} parent_or_guardian_visibility`),
    homeConnection: optionalString(lesson.home_connection, `${summary.lessonId} home_connection`),
    assessment,
    source,
  }
}
