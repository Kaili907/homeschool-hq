import {
  CURRICULUM_GRADES,
  CurriculumSourceError,
  type CurriculumBrowserSource,
  type CurriculumCatalog,
  type CurriculumLessonDetail,
  type CurriculumLessonSummary,
} from './contracts'

const CATALOG_PATH = '/family-pilot-final/2.0.0/admin-curriculum-catalog.json'
const COURSE_ROOT = '/family-pilot-final/2.0.0/courses'

type CatalogFetch = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeCatalog(value: unknown): CurriculumCatalog {
  if (!record(value) || !record(value.source) || value.source.version !== '2.0.0'
    || !Array.isArray(value.grades) || !Array.isArray(value.courses) || !Array.isArray(value.units)
    || !Array.isArray(value.lessons) || !Array.isArray(value.assessments)
    || JSON.stringify(value.grades) !== JSON.stringify(CURRICULUM_GRADES)
    || value.courses.length !== 90 || value.units.length !== 698
    || value.lessons.length !== 8_292 || value.assessments.length !== 699) {
    throw new CurriculumSourceError('inconsistent', 'The admitted 2.0.0 curriculum projection is incomplete.')
  }
  return value as unknown as CurriculumCatalog
}

async function json(fetcher: CatalogFetch, path: string): Promise<unknown> {
  let response: Pick<Response, 'ok' | 'status' | 'json'>
  try {
    response = await fetcher(path, { method: 'GET', credentials: 'omit', cache: 'no-store' })
  } catch {
    throw new CurriculumSourceError('unavailable', 'The admitted curriculum projection is unavailable.')
  }
  if (!response.ok) throw new CurriculumSourceError(response.status === 404 ? 'not-found' : 'unavailable', 'The admitted curriculum projection is unavailable.')
  try { return await response.json() } catch {
    throw new CurriculumSourceError('malformed', 'The admitted curriculum projection is malformed.')
  }
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Read-only Admin source over the same admitted release artifacts served to the learner runtime. */
export function createAdmittedReleaseCurriculumSource(fetcher: CatalogFetch = fetch): CurriculumBrowserSource {
  let catalogPromise: Promise<CurriculumCatalog> | null = null
  const catalog = () => catalogPromise ??= json(fetcher, CATALOG_PATH).then(safeCatalog)
  return {
    async loadIdentity() { return (await catalog()).source },
    async loadCatalog() { return catalog() },
    async loadLesson(lessonId) {
      const loaded = await catalog()
      const summary = loaded.lessons.find((lesson) => lesson.lessonId === lessonId)
      if (!summary) throw new CurriculumSourceError('not-found', 'That admitted lesson is unavailable.')
      const payload = await json(fetcher, `${COURSE_ROOT}/${encodeURIComponent(summary.courseId)}.json`)
      if (!record(payload) || !Array.isArray(payload.lessons) || !record(payload.materials)) {
        throw new CurriculumSourceError('malformed', 'The admitted lesson payload is malformed.')
      }
      const row = payload.lessons.find((item) => record(item) && item.lessonRef === lessonId)
      const material = payload.materials[lessonId]
      if (!record(row) || !record(material)) throw new CurriculumSourceError('not-found', 'That admitted lesson is unavailable.')
      const sections = Array.isArray(material.sections) ? material.sections.filter(record) : []
      const independent = sections.find((section) => String(section.title ?? '').toLowerCase().includes('independent response'))
      const formativeCheck = typeof independent?.prompt === 'string' ? independent.prompt : typeof independent?.body === 'string' ? independent.body : null
      if (!formativeCheck) throw new CurriculumSourceError('inconsistent', 'The admitted lesson has no learner response contract.')
      const detail: CurriculumLessonDetail = {
        ...(summary as CurriculumLessonSummary),
        schemaVersion: typeof material.dtoVersion === 'string' ? material.dtoVersion : '1.0',
        ...(typeof row.estimatedMinutes === 'string' ? { estimatedMinutes: row.estimatedMinutes } : {}),
        ...(typeof material.essentialQuestion === 'string' ? { essentialQuestion: material.essentialQuestion } : {}),
        learningObjectives: strings(material.learningObjectives),
        successCriteria: strings(material.successCriteria),
        materials: strings(material.materials),
        lessonFlow: sections.flatMap((section) => {
          const segment = typeof section.title === 'string' ? section.title : typeof section.sectionRef === 'string' ? section.sectionRef : null
          const teacherOrTutorAction = typeof section.body === 'string' ? section.body : typeof section.prompt === 'string' ? section.prompt : null
          return segment && teacherOrTutorAction ? [{ segment, teacherOrTutorAction }] : []
        }),
        formativeCheck,
        adaptiveTutorRoutes: [],
        accommodations: strings(material.accommodations),
        safetyAndPrivacy: strings(material.safetyRules),
        source: loaded.source,
      }
      return Object.freeze(detail)
    },
  }
}
