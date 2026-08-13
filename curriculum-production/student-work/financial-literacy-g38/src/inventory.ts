import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Grade, SourceLesson } from './types.ts'

/** Repository root, four levels up from this file's directory. */
export const REPO_ROOT = new URL('../../../../', import.meta.url).pathname

export const REQUESTED_GRADES: readonly Grade[] = [3, 4, 5, 7, 8]

/** Grades 3 and 4 were released on a branch that is not checked out here. */
const G34_REF = 'mac/g34-rfl-finlit-r1'

export const SOURCE_CORPUS_VERSION = '1.0.0'

export function sourcePath(grade: Grade): string {
  return `curriculum-content/manuel-academy/${SOURCE_CORPUS_VERSION}/grades/grade-${grade}/courses/financial-literacy/lessons.jsonl`
}

export function sourceRef(grade: Grade): string {
  return grade === 3 || grade === 4 ? G34_REF : 'worktree'
}

function readSourceJsonl(grade: Grade): string {
  const path = sourcePath(grade)
  if (sourceRef(grade) === 'worktree') return readFileSync(join(REPO_ROOT, path), 'utf-8')
  return execFileSync('git', ['show', `${G34_REF}:${path}`], { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })
}

interface RawLesson {
  readonly lesson_id: string
  readonly course_id: string
  readonly grade: number
  readonly unit_number: number
  readonly unit_title: string
  readonly day_in_unit: number
  readonly phase: string
  readonly title: string
  readonly focus: string
  readonly standards?: readonly string[]
}

/** "ma-g5-financial-literacy-u03-l05" -> "g5-u03-l05" */
export function lessonKey(lessonId: string): string {
  const match = /^ma-g(\d+)-financial-literacy-(u\d+)-(l\d+)$/.exec(lessonId)
  if (!match) throw new Error(`unrecognised financial-literacy lesson id: ${lessonId}`)
  return `g${match[1]}-${match[2]}-${match[3]}`
}

export function loadSourceLessons(): SourceLesson[] {
  const lessons: SourceLesson[] = []
  for (const grade of REQUESTED_GRADES) {
    const lines = readSourceJsonl(grade).split('\n').filter((l) => l.trim().length > 0)
    for (const line of lines) {
      const raw = JSON.parse(line) as RawLesson
      if (raw.grade !== grade) throw new Error(`grade-${grade} source contains a grade-${raw.grade} lesson: ${raw.lesson_id}`)
      lessons.push({
        key: lessonKey(raw.lesson_id),
        lessonId: raw.lesson_id,
        courseId: raw.course_id,
        grade,
        unitNumber: raw.unit_number,
        unitTitle: raw.unit_title,
        dayInUnit: raw.day_in_unit,
        phase: raw.phase,
        title: raw.title,
        focus: raw.focus,
        standards: raw.standards ?? [],
        sourceRef: sourceRef(grade),
        sourcePath: sourcePath(grade),
      })
    }
  }
  const seen = new Set<string>()
  for (const lesson of lessons) {
    if (seen.has(lesson.key)) throw new Error(`duplicate lesson key derived from source: ${lesson.key}`)
    seen.add(lesson.key)
  }
  return lessons
}

export function countsByGrade(lessons: readonly SourceLesson[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const lesson of lessons) counts[`grade-0${lesson.grade}`] = (counts[`grade-0${lesson.grade}`] ?? 0) + 1
  return counts
}
