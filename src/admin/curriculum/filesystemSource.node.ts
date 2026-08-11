import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  CurriculumSourceError,
  type CurriculumBrowserSource,
  type CurriculumCatalog,
  type CurriculumLessonDetail,
} from './contracts'
import { buildCurriculumCatalog, parseCurriculumLesson } from './readModel'

const DEFAULT_SOURCE_ROOT = fileURLToPath(
  new URL('../../../curriculum-content/manuel-academy/1.0.0/', import.meta.url),
)

async function readText(path: string, label: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    throw new CurriculumSourceError('unavailable', `${label} is unavailable`)
  }
}

export function createFilesystemCurriculumSource(
  sourceRoot = DEFAULT_SOURCE_ROOT,
): CurriculumBrowserSource {
  let catalogPromise: Promise<CurriculumCatalog> | undefined
  const courseLessons = new Map<string, Promise<Map<string, string>>>()

  const loadCatalog = (): Promise<CurriculumCatalog> => {
    if (catalogPromise) return catalogPromise
    catalogPromise = (async () => {
      const [manifestJson, courseIndexJson, unitIndexJson, lessonIndexCsv, validationJson] =
        await Promise.all([
          readText(join(sourceRoot, 'curriculum-manifest.json'), 'curriculum manifest'),
          readText(join(sourceRoot, 'course-index.json'), 'course index'),
          readText(join(sourceRoot, 'unit-index.json'), 'unit index'),
          readText(join(sourceRoot, 'lesson-index.csv'), 'lesson index'),
          readText(join(sourceRoot, 'validation', 'validation.json'), 'validation report'),
        ])
      let validationPassed = false
      try {
        const validation = JSON.parse(validationJson) as { overall?: unknown }
        validationPassed = validation.overall === 'PASS'
      } catch {
        throw new CurriculumSourceError('malformed', 'validation report is not valid JSON')
      }
      let courseRows: unknown
      try {
        courseRows = JSON.parse(courseIndexJson) as unknown
      } catch {
        throw new CurriculumSourceError('malformed', 'course-index.json is not valid JSON')
      }
      if (!Array.isArray(courseRows)) throw new CurriculumSourceError('malformed', 'course index must be an array')
      const assessmentJsonByCourse: Record<string, string> = {}
      await Promise.all(courseRows.map(async (value) => {
        if (!value || typeof value !== 'object') throw new CurriculumSourceError('malformed', 'course index row must be an object')
        const row = value as Record<string, unknown>
        if (typeof row.course_id !== 'string' || typeof row.grade !== 'number' || typeof row.subject !== 'string') {
          throw new CurriculumSourceError('malformed', 'course index row has invalid identifiers')
        }
        assessmentJsonByCourse[row.course_id] = await readText(
          join(sourceRoot, 'grades', `grade-${row.grade}`, 'courses', row.subject, 'assessments.json'),
          `${row.course_id} assessments`,
        )
      }))
      return buildCurriculumCatalog({
        manifestJson,
        courseIndexJson,
        unitIndexJson,
        lessonIndexCsv,
        assessmentJsonByCourse,
        validationPassed,
      })
    })()
    catalogPromise.catch(() => {
      catalogPromise = undefined
    })
    return catalogPromise
  }

  const loadLessonLines = (
    courseId: string,
    grade: number,
    subject: string,
  ): Promise<Map<string, string>> => {
    const cached = courseLessons.get(courseId)
    if (cached) return cached
    const request = readText(
      join(sourceRoot, 'grades', `grade-${grade}`, 'courses', subject, 'lessons.jsonl'),
      `${courseId} lessons`,
    ).then((raw) => {
      const lines = new Map<string, string>()
      for (const line of raw.split(/\r?\n/).filter((value) => value.trim())) {
        let value: unknown
        try {
          value = JSON.parse(line) as unknown
        } catch {
          throw new CurriculumSourceError('malformed', `${courseId} lessons contain invalid JSON`)
        }
        if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>).lesson_id !== 'string') {
          throw new CurriculumSourceError('malformed', `${courseId} lessons contain an invalid lesson identifier`)
        }
        const lessonId = (value as { lesson_id: string }).lesson_id
        if (lines.has(lessonId)) throw new CurriculumSourceError('inconsistent', `${courseId} lessons contain duplicate identifiers`)
        lines.set(lessonId, line)
      }
      return lines
    })
    courseLessons.set(courseId, request)
    request.catch(() => courseLessons.delete(courseId))
    return request
  }

  const loadLesson = async (lessonId: string): Promise<CurriculumLessonDetail> => {
    const catalog = await loadCatalog()
    const summary = catalog.lessons.find((lesson) => lesson.lessonId === lessonId)
    if (!summary) throw new CurriculumSourceError('not-found', 'That lesson is not in this published curriculum version')
    const course = catalog.courses.find((item) => item.courseId === summary.courseId)
    if (!course) throw new CurriculumSourceError('inconsistent', `${lessonId} has no course metadata`)
    const lines = await loadLessonLines(course.courseId, course.grade, course.subject)
    const rawLine = lines.get(lessonId)
    if (!rawLine) throw new CurriculumSourceError('inconsistent', `${lessonId} is indexed but its detail is unavailable`)
    const assessment = catalog.assessments.find(
      (item) => item.courseId === summary.courseId && item.unitNumber === summary.unitNumber,
    )
    return parseCurriculumLesson(rawLine, summary, catalog.source, assessment)
  }

  return {
    loadIdentity: async () => (await loadCatalog()).source,
    loadCatalog,
    loadLesson,
  }
}
