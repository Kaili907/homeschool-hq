import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = new URL('../../../../', import.meta.url).pathname

export type Subject = 'ready-for-life' | 'financial-literacy'

/** Which authoring stage a course has reached. */
export type Stage = 'RELEASED' | 'AUTHORING'

export interface CourseRef {
  readonly grade: number
  readonly subject: Subject
  readonly stage: Stage
  /** Path relative to the repository root. */
  readonly path: string
  /** Git ref holding this course, or null when it is present in the worktree. */
  readonly ref: string | null
}

export interface SourceLesson {
  readonly lesson_id: string
  readonly title: string
  readonly unit_number: number
  readonly focus?: string
  readonly student_activity?: string
  readonly answer_or_scoring_guidance?: string
  readonly materials?: readonly string[]
  readonly [key: string]: unknown
}

const HS_ROOT = 'curriculum-authoring/full-family-highschool-9-12/subjects'
export const HS_AUTHORING_REF = 'mac/hs912-rfl-finlit-r1'
export const G34_REF = 'mac/g34-rfl-finlit-r1'

/**
 * Courses promoted into the frozen curriculum-content 1.0.0 release. Grades 3
 * and 4 exist only on mac/g34-rfl-finlit-r1; grades 5, 7, and 8 are in this
 * worktree.
 */
export const RELEASED_COURSES: readonly CourseRef[] = [3, 4, 5, 7, 8].flatMap((grade) =>
  (['ready-for-life', 'financial-literacy'] as const).map((subject) => ({
    grade,
    subject,
    stage: 'RELEASED' as const,
    path: `curriculum-content/manuel-academy/1.0.0/grades/grade-${grade}/courses/${subject}/lessons.jsonl`,
    ref: grade === 3 || grade === 4 ? G34_REF : null,
  })),
)

/**
 * High school courses that are authored but NOT yet promoted into any
 * curriculum-content release. They live at authoring stage on
 * mac/hs912-rfl-finlit-r1, which is why a scan restricted to
 * curriculum-content/ misses them entirely.
 */
export const HS_AUTHORING_COURSES: readonly CourseRef[] = [9, 10, 11, 12].flatMap((grade) =>
  (['ready-for-life', 'financial-literacy'] as const).map((subject) => ({
    grade,
    subject,
    stage: 'AUTHORING' as const,
    path: `${HS_ROOT}/${subject}/courses/${subject}-${grade}/lessons.jsonl`,
    ref: HS_AUTHORING_REF,
  })),
)

export const ALL_COURSES: readonly CourseRef[] = [...RELEASED_COURSES, ...HS_AUTHORING_COURSES]

function readJsonl(course: CourseRef): string | null {
  if (course.ref === null) {
    const full = join(REPO_ROOT, course.path)
    return existsSync(full) ? readFileSync(full, 'utf-8') : null
  }
  try {
    return execFileSync('git', ['show', `${course.ref}:${course.path}`], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

/** Returns null when the course's source is not reachable from this checkout. */
export function loadCourseLessons(course: CourseRef): SourceLesson[] | null {
  const raw = readJsonl(course)
  if (raw === null) return null
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as SourceLesson)
}

export interface FieldVariety {
  readonly field: string
  readonly distinct: number
  readonly total: number
}

/**
 * How many distinct values a field takes across a course. A field with far
 * fewer distinct values than lessons carries correspondingly little
 * per-lesson information to build production material from.
 */
export function fieldVariety(lessons: readonly SourceLesson[], field: string): FieldVariety {
  const values = lessons.map((lesson) => JSON.stringify(lesson[field] ?? null))
  return { field, distinct: new Set(values).size, total: values.length }
}
