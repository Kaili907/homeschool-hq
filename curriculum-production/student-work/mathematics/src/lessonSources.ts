import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LessonRef } from './types.ts'

/**
 * Reads the authored mathematics lessons this session is allowed to consume.
 *
 * Grades 5, 7, and 8 come from the canonical released curriculum package;
 * grades 9-12 come from the completed high-school authoring tree inherited via
 * mac/hs912-math-r1. Both are read-only inputs: nothing here writes to them.
 *
 * Grades 3 and 4 are deliberately excluded — that authoring branch is still
 * moving, so no student work is produced for it.
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

const CANONICAL_ROOT = join(repoRoot, 'curriculum-content', 'manuel-academy', '1.0.0')
const HS_ROOT = join(
  repoRoot,
  'curriculum-authoring',
  'full-family-highschool-9-12',
  'subjects',
  'mathematics',
)

export const CANONICAL_GRADES = [5, 7, 8] as const
export const HIGH_SCHOOL_GRADES = [9, 10, 11, 12] as const
export const ELIGIBLE_GRADES = [...CANONICAL_GRADES, ...HIGH_SCHOOL_GRADES]

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

function lessonsPathFor(grade: number): string {
  return grade <= 8
    ? join(CANONICAL_ROOT, 'grades', `grade-${grade}`, 'courses', 'mathematics', 'lessons.jsonl')
    : join(HS_ROOT, 'courses', `grade-${grade}`, 'lessons.jsonl')
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
