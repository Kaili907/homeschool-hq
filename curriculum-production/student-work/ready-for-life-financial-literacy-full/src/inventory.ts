import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = new URL('../../../../', import.meta.url).pathname

export type Subject = 'ready-for-life' | 'financial-literacy'

export interface CourseRef {
  readonly grade: number
  readonly subject: Subject
  /** Path relative to the repository root. */
  readonly path: string
  /** Git ref holding this course, or null when it is present in the worktree. */
  readonly ref: string | null
}

export interface SourceLesson {
  readonly lesson_id: string
  readonly title: string
  readonly unit_number: number
  readonly student_activity?: string
  readonly answer_or_scoring_guidance?: string
  readonly materials?: readonly string[]
  readonly [key: string]: unknown
}

function coursePath(grade: number, subject: Subject): string {
  return `curriculum-content/manuel-academy/1.0.0/grades/grade-${grade}/courses/${subject}/lessons.jsonl`
}

/**
 * Every Ready for Life / Financial Literacy course that is actually authored
 * somewhere in this repository. Grades 3 and 4 exist only on
 * mac/g34-rfl-finlit-r1; grades 5, 7, and 8 are in this worktree. Grades 9
 * through 12 are absent from every ref and so are deliberately not listed.
 */
export const AUTHORED_COURSES: readonly CourseRef[] = [3, 4, 5, 7, 8].flatMap((grade) =>
  (['ready-for-life', 'financial-literacy'] as const).map((subject) => ({
    grade,
    subject,
    path: coursePath(grade, subject),
    ref: grade === 3 || grade === 4 ? 'mac/g34-rfl-finlit-r1' : null,
  })),
)

/** Grades the production brief asked for that have no authored source at all. */
export const GRADES_WITHOUT_SOURCE: readonly number[] = [9, 10, 11, 12]

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
 * How many distinct values a field takes across a course. A field with one
 * distinct value across every lesson carries no per-lesson information and
 * cannot be the basis for per-lesson production material.
 */
export function fieldVariety(lessons: readonly SourceLesson[], field: string): FieldVariety {
  const values = lessons.map((lesson) => JSON.stringify(lesson[field] ?? null))
  return { field, distinct: new Set(values).size, total: values.length }
}
