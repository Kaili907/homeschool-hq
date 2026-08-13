import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LessonRef } from './types.ts'

/**
 * Reads the authored Grade 3/4 mathematics lessons this pipeline consumes.
 *
 * The grades 5-12 sibling pipeline (curriculum-production/student-work/
 * mathematics) reads its lesson records directly from the shared authoring
 * trees. Grade 3/4 authoring lives on a separate branch (mac/g34-math-r1)
 * that this pipeline's worktree does not otherwise carry, so its lesson
 * records are vendored read-only into data/source/ (see data/source/README.md
 * for provenance and the pinned source commit) rather than read from a path
 * that would not exist outside that branch.
 */

/**
 * Walk up from the working directory to the repository root. Generation runs
 * through an esbuild bundle in a temporary directory, so import.meta.url is not
 * a usable anchor; the working directory always sits inside the repository for
 * both the generator script and the vitest suite.
 */
function findRepoRoot(): string {
  let current = process.cwd()
  for (let depth = 0; depth < 12; depth += 1) {
    if (existsSync(join(current, 'curriculum-content', 'manuel-academy'))) {
      return current
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  throw new Error(`Could not locate repository root from ${process.cwd()}`)
}

const repoRoot = findRepoRoot()

const VENDORED_ROOT = join(
  repoRoot,
  'curriculum-production',
  'student-work',
  'mathematics-g34',
  'data',
  'source',
)

export const ELIGIBLE_GRADES = [3, 4] as const

export type EligibleGrade = (typeof ELIGIBLE_GRADES)[number]

interface RawLesson {
  lesson_id: string
  course_id: string
  grade: number
  subject: string
  course_day: number
  unit_number: number
  unit_title: string
  day_in_unit: number
  title: string
  phase: string
  focus: string
  standards: string[]
  mastery_rule?: string
  answer_or_scoring_guidance?: string
  extension?: string
}

export interface SourceLesson {
  ref: LessonRef
  standards: readonly string[]
  masteryRule: string
  scoringGuidance: string
  extension: string
}

function lessonsPathFor(grade: EligibleGrade): string {
  return join(VENDORED_ROOT, `grade-${grade}`, 'lessons.jsonl')
}

function toSourceLesson(raw: RawLesson): SourceLesson {
  return {
    ref: {
      lessonId: raw.lesson_id,
      courseId: raw.course_id,
      grade: raw.grade,
      subject: 'mathematics',
      unitNumber: raw.unit_number,
      unitTitle: raw.unit_title,
      dayInUnit: raw.day_in_unit,
      courseDay: raw.course_day,
      phase: raw.phase,
      focus: raw.focus,
      title: raw.title,
    },
    standards: [...raw.standards],
    masteryRule: raw.mastery_rule ?? '',
    scoringGuidance: raw.answer_or_scoring_guidance ?? '',
    extension: raw.extension ?? '',
  }
}

export function readLessons(grade: EligibleGrade): SourceLesson[] {
  const text = readFileSync(lessonsPathFor(grade), 'utf8')
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => toSourceLesson(JSON.parse(line) as RawLesson))
    .filter((lesson) => lesson.ref.subject === 'mathematics')
}

export function readAllLessons(): SourceLesson[] {
  return ELIGIBLE_GRADES.flatMap((grade) => readLessons(grade))
}
