import {
  CurriculumSourceError,
  type CurriculumAssessmentEvidence,
  type CurriculumBrowserSource,
  type CurriculumCatalog,
  type CurriculumCourseSummary,
  type CurriculumLessonDetail,
  type CurriculumLessonSummary,
  type CurriculumSourceIdentity,
  type CurriculumUnitSummary,
} from './contracts'
import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from '../adminDependencyTimeout'

export type CurriculumBrowserFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

async function getJson(
  fetcher: CurriculumBrowserFetch,
  getAccessToken: () => Promise<string | null>,
  path: string,
  timeoutMs: number,
): Promise<unknown> {
  let response: Pick<Response, 'ok' | 'status' | 'json'>
  try {
    const accessToken = await withAdminDependencyTimeout(() => getAccessToken(), timeoutMs)
    if (!accessToken) throw new CurriculumSourceError('unavailable', 'Administrator authorization is unavailable')
    response = await withAdminDependencyTimeout((signal) => fetcher(path, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      signal,
    }), timeoutMs)
  } catch {
    throw new CurriculumSourceError('unavailable', 'The authorized curriculum service is unavailable')
  }
  if (!response.ok) {
    throw new CurriculumSourceError(
      response.status === 404 ? 'not-found' : 'unavailable',
      response.status === 404
        ? 'That curriculum record is unavailable'
        : `The authorized curriculum service returned HTTP ${response.status}`,
    )
  }
  try {
    return await response.json()
  } catch {
    throw new CurriculumSourceError('malformed', 'The authorized curriculum service returned malformed data')
  }
}

/**
 * Typed ADMIN-1 integration seam. The server must derive identity and enforce
 * curriculum:read; this client sends no role, capability, or actor assertion.
 */
export function createAdminCurriculumHttpSource(
  fetcher: CurriculumBrowserFetch = fetch,
  basePath = '/api/admin/curriculum',
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  timeoutMs = 10_000,
): CurriculumBrowserSource {
  return {
    async loadIdentity() {
      return requireProjection(
        await getJson(fetcher, getAccessToken, `${basePath}/catalog-identity`, timeoutMs),
        adaptSource,
      )
    },
    async loadCatalog() {
      return requireProjection(
        await getJson(fetcher, getAccessToken, `${basePath}/catalog`, timeoutMs),
        adaptCatalog,
      )
    },
    async loadLesson(lessonId) {
      return requireProjection(
        await getJson(fetcher, getAccessToken, `${basePath}/lessons/${encodeURIComponent(lessonId)}`, timeoutMs),
        (value) => adaptLesson(value, lessonId),
      )
    },
  }
}

const GRADES = new Set([5, 7, 8])

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
}

function text(value: unknown, maximum = 20_000): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
}

function integer(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum
}

function strings(value: unknown, maximum = 1_000): readonly string[] | null {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => !text(item))) return null
  return Object.freeze([...value]) as readonly string[]
}

function requireProjection<T>(value: unknown, adapter: (candidate: unknown) => T | null): T {
  const projected = adapter(value)
  if (!projected) throw new CurriculumSourceError('malformed', 'The authorized curriculum service returned malformed data')
  return projected
}

function adaptSource(value: unknown): CurriculumSourceIdentity | null {
  if (!record(value) || !exact(value, [
    'packageId', 'version', 'authoredOn', 'status', 'lifecycle', 'validationStatus',
  ]) || !text(value.packageId, 240) || !text(value.version, 100) || !text(value.authoredOn, 100)
    || !text(value.status, 100) || value.lifecycle !== 'published'
    || !['passed', 'unavailable'].includes(String(value.validationStatus))) return null
  return Object.freeze({ ...value }) as unknown as CurriculumSourceIdentity
}

function adaptCourse(value: unknown): CurriculumCourseSummary | null {
  if (!record(value) || !exact(value,
    ['courseId', 'grade', 'subject', 'title', 'days'], ['description', 'capstone'])
    || !text(value.courseId, 160) || !GRADES.has(value.grade as number) || !text(value.subject, 160)
    || !text(value.title, 500) || !integer(value.days, 1)
    || (value.description !== undefined && !text(value.description))
    || (value.capstone !== undefined && !text(value.capstone))) return null
  return Object.freeze({ ...value }) as unknown as CurriculumCourseSummary
}

function adaptUnit(value: unknown): CurriculumUnitSummary | null {
  if (!record(value) || !exact(value, [
    'unitId', 'courseId', 'grade', 'subject', 'unitNumber', 'title', 'days',
    'standards', 'topics', 'lessonIds',
  ], ['essentialQuestion', 'performanceTask', 'assessmentId'])
    || !text(value.unitId, 160) || !text(value.courseId, 160) || !GRADES.has(value.grade as number)
    || !text(value.subject, 160) || !integer(value.unitNumber, 1) || !text(value.title, 500)
    || !integer(value.days, 1) || (value.essentialQuestion !== undefined && !text(value.essentialQuestion))
    || (value.performanceTask !== undefined && !text(value.performanceTask))
    || (value.assessmentId !== undefined && !text(value.assessmentId, 160))) return null
  const standards = strings(value.standards)
  const topics = strings(value.topics)
  const lessonIds = strings(value.lessonIds, 10_000)
  if (!standards || !topics || !lessonIds) return null
  return Object.freeze({ ...value, standards, topics, lessonIds }) as unknown as CurriculumUnitSummary
}

function adaptLessonSummary(value: unknown): CurriculumLessonSummary | null {
  if (!record(value) || !exact(value, [
    'lessonId', 'courseId', 'grade', 'subject', 'courseDay', 'unitNumber', 'unitTitle',
    'dayInUnit', 'title', 'standards',
  ], ['phase', 'focus']) || !text(value.lessonId, 160) || !text(value.courseId, 160)
    || !GRADES.has(value.grade as number) || !text(value.subject, 160) || !integer(value.courseDay, 1)
    || !integer(value.unitNumber, 1) || !text(value.unitTitle, 500) || !integer(value.dayInUnit, 1)
    || !text(value.title, 500) || (value.phase !== undefined && !text(value.phase, 200))
    || (value.focus !== undefined && !text(value.focus))) return null
  const standards = strings(value.standards)
  return standards ? Object.freeze({ ...value, standards }) as unknown as CurriculumLessonSummary : null
}

function adaptAssessment(value: unknown): CurriculumAssessmentEvidence | null {
  if (!record(value) || !exact(value,
    ['assessmentId', 'courseId', 'unitNumber', 'unitTitle', 'standards'], ['totalPoints'])
    || !text(value.assessmentId, 160) || !text(value.courseId, 160) || !integer(value.unitNumber, 1)
    || !text(value.unitTitle, 500) || (value.totalPoints !== undefined && !integer(value.totalPoints))) return null
  const standards = strings(value.standards)
  return standards ? Object.freeze({ ...value, standards }) as unknown as CurriculumAssessmentEvidence : null
}

function adaptCatalog(value: unknown): CurriculumCatalog | null {
  if (!record(value) || !exact(value, ['source', 'grades', 'courses', 'units', 'lessons', 'assessments'])
    || !Array.isArray(value.grades) || value.grades.length > GRADES.size
    || value.grades.some((grade) => !GRADES.has(grade as number)) || new Set(value.grades).size !== value.grades.length
    || !Array.isArray(value.courses) || value.courses.length > 1_000
    || !Array.isArray(value.units) || value.units.length > 10_000
    || !Array.isArray(value.lessons) || value.lessons.length > 20_000
    || !Array.isArray(value.assessments) || value.assessments.length > 10_000) return null
  const source = adaptSource(value.source)
  const courses = value.courses.map(adaptCourse)
  const units = value.units.map(adaptUnit)
  const lessons = value.lessons.map(adaptLessonSummary)
  const assessments = value.assessments.map(adaptAssessment)
  if (!source || [...courses, ...units, ...lessons, ...assessments].some((item) => item === null)
    || new Set(courses.map((item) => item?.courseId)).size !== courses.length
    || new Set(units.map((item) => item?.unitId)).size !== units.length
    || new Set(lessons.map((item) => item?.lessonId)).size !== lessons.length
    || new Set(assessments.map((item) => item?.assessmentId)).size !== assessments.length) return null
  return Object.freeze({
    source,
    grades: Object.freeze([...value.grades]),
    courses: Object.freeze(courses), units: Object.freeze(units),
    lessons: Object.freeze(lessons), assessments: Object.freeze(assessments),
  }) as unknown as CurriculumCatalog
}

function adaptLesson(value: unknown, expectedLessonId: string): CurriculumLessonDetail | null {
  const summaryKeys = [
    'lessonId', 'courseId', 'grade', 'subject', 'courseDay', 'unitNumber', 'unitTitle',
    'dayInUnit', 'title', 'standards',
  ]
  const required = [
    ...summaryKeys, 'schemaVersion', 'learningObjectives', 'successCriteria', 'materials',
    'lessonFlow', 'formativeCheck', 'adaptiveTutorRoutes', 'accommodations', 'safetyAndPrivacy', 'source',
  ]
  const optional = [
    'phase', 'focus', 'estimatedMinutes', 'essentialQuestion', 'studentActivity', 'scoringGuidance',
    'masteryRule', 'extension', 'media', 'parentVisibility', 'homeConnection', 'assessment',
  ]
  if (!record(value) || !exact(value, required, optional)) return null
  const summaryValue = Object.fromEntries([...summaryKeys, 'phase', 'focus']
    .filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]))
  const summary = adaptLessonSummary(summaryValue)
  const source = adaptSource(value.source)
  const learningObjectives = strings(value.learningObjectives)
  const successCriteria = strings(value.successCriteria)
  const materials = strings(value.materials)
  const accommodations = strings(value.accommodations)
  const safetyAndPrivacy = strings(value.safetyAndPrivacy)
  if (!summary || summary.lessonId !== expectedLessonId || !source || !text(value.schemaVersion, 100)
    || !learningObjectives || !successCriteria || !materials || !accommodations || !safetyAndPrivacy
    || !text(value.formativeCheck) || !Array.isArray(value.lessonFlow) || value.lessonFlow.length > 1_000
    || !Array.isArray(value.adaptiveTutorRoutes) || value.adaptiveTutorRoutes.length > 1_000) return null
  const lessonFlow = value.lessonFlow.map((segment) => record(segment) && exact(segment,
    ['segment', 'teacherOrTutorAction'], ['minutes']) && text(segment.segment, 500)
    && text(segment.teacherOrTutorAction) && (segment.minutes === undefined || text(segment.minutes, 100))
    ? Object.freeze({ ...segment }) : null)
  const adaptiveTutorRoutes = value.adaptiveTutorRoutes.map((route) => record(route)
    && exact(route, ['signal', 'action']) && text(route.signal) && text(route.action)
    ? Object.freeze({ ...route }) : null)
  for (const key of [
    'estimatedMinutes', 'essentialQuestion', 'studentActivity', 'scoringGuidance', 'masteryRule',
    'extension', 'parentVisibility', 'homeConnection',
  ]) if (value[key] !== undefined && !text(value[key])) return null
  let media = value.media
  if (media !== undefined && typeof media !== 'string') {
    if (!record(media)) return null
    const mediaRecord = media
    if (!exact(mediaRecord, [], ['required', 'description', 'suggestion', 'fallback'])
      || (mediaRecord.required !== undefined && typeof mediaRecord.required !== 'boolean')
      || ['description', 'suggestion', 'fallback'].some((key) => mediaRecord[key] !== undefined && !text(mediaRecord[key]))) return null
    media = Object.freeze({ ...mediaRecord })
  } else if (media !== undefined && !text(media)) return null
  const assessment = value.assessment === undefined ? undefined : adaptAssessment(value.assessment)
  if (lessonFlow.some((segment) => segment === null) || adaptiveTutorRoutes.some((route) => route === null)
    || (value.assessment !== undefined && !assessment)) return null
  return Object.freeze({
    ...value, ...summary, source, learningObjectives, successCriteria, materials,
    accommodations, safetyAndPrivacy, lessonFlow: Object.freeze(lessonFlow),
    adaptiveTutorRoutes: Object.freeze(adaptiveTutorRoutes),
    ...(media === undefined ? {} : { media }), ...(assessment === undefined ? {} : { assessment }),
  }) as unknown as CurriculumLessonDetail
}
