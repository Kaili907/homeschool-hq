/**
 * Reads the grade-11 Financial Literacy source course at a pinned commit.
 *
 * The source lane lives on `mac/hs912-rfl-finlit-r1` and is not checked out in
 * this worktree, so it is read through `git show` at exactly the committed tip
 * this supplement was authored against. Pinning the SHA rather than the branch
 * name means a later commit on that branch cannot silently change what this
 * corpus claims to cover.
 *
 * This supplement reads grade 11 only. It is deliberately self-contained: it
 * shares no module with the grades 9-10 lane next door, so it can be reviewed,
 * tested, and merged on its own.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const SOURCE_BRANCH = 'mac/hs912-rfl-finlit-r1'
export const SOURCE_SHA = '481296a9e794770348881b43bd0d1fa4f794db29'
export const SOURCE_ROOT = 'curriculum-authoring/full-family-highschool-9-12/subjects/financial-literacy'
export const SOURCE_COURSE = `${SOURCE_ROOT}/courses/financial-literacy-11`
export const SOURCE_CORPUS_VERSION = `${SOURCE_BRANCH}@${SOURCE_SHA.slice(0, 12)}`

/** The grade this supplement owns. Grades 9, 10, and 12 are out of scope here. */
export const GRADE = 11 as const
/** Re-derived from the source course, not assumed: see `tests/corpus.test.ts`. */
export const EXPECTED_LESSON_COUNT = 72

const REPO = fileURLToPath(new URL('../../../../../', import.meta.url))

export interface SourceLesson {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: number
  readonly unitNumber: number
  readonly unitTitle: string
  readonly dayInUnit: number
  readonly courseDay: number
  readonly phase: string
  readonly focus: string
  readonly title: string
  readonly standards: readonly string[]
  readonly essentialQuestion: string
  readonly performanceTaskLink: string
  readonly isCapstoneLesson: boolean
  readonly simulationOnly: boolean
  readonly requiresRealFinancialData: boolean
}

export interface SourceUnit {
  readonly unitId: string
  readonly unitNumber: number
  readonly title: string
  readonly standards: readonly string[]
  readonly essentialQuestion: string
  readonly topics: readonly string[]
  readonly lessonIds: readonly string[]
}

function show(path: string): string {
  return execFileSync('git', ['show', `${SOURCE_SHA}:${path}`], {
    cwd: REPO,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

let cachedLessons: SourceLesson[] | undefined
let cachedUnits: SourceUnit[] | undefined

export function loadSourceLessons(): SourceLesson[] {
  if (cachedLessons) return cachedLessons
  const out: SourceLesson[] = []
  for (const line of show(`${SOURCE_COURSE}/lessons.jsonl`).split('\n')) {
    if (!line.trim()) continue
    const r = JSON.parse(line) as Record<string, unknown>
    out.push({
      lessonId: r.lesson_id as string,
      courseId: r.course_id as string,
      grade: r.grade as number,
      unitNumber: r.unit_number as number,
      unitTitle: r.unit_title as string,
      dayInUnit: r.day_in_unit as number,
      courseDay: r.course_day as number,
      phase: r.phase as string,
      focus: r.focus as string,
      title: r.title as string,
      standards: r.standards as string[],
      essentialQuestion: r.essential_question as string,
      performanceTaskLink: (r.performance_task_link as string) ?? '',
      isCapstoneLesson: Boolean(r.is_capstone_lesson),
      simulationOnly: Boolean(r.simulation_only),
      requiresRealFinancialData: Boolean(r.requires_real_financial_data),
    })
  }
  cachedLessons = out
  return out
}

export function loadSourceUnits(): SourceUnit[] {
  if (cachedUnits) return cachedUnits
  const raw = JSON.parse(show(`${SOURCE_COURSE}/units.json`)) as Record<string, unknown>[]
  cachedUnits = raw.map((u) => ({
    unitId: u.unit_id as string,
    unitNumber: u.unit_number as number,
    title: u.title as string,
    standards: u.standards as string[],
    essentialQuestion: u.essential_question as string,
    topics: u.topics as string[],
    lessonIds: u.lesson_ids as string[],
  }))
  return cachedUnits
}

export function sourceLessonMap(): Map<string, SourceLesson> {
  return new Map(loadSourceLessons().map((l) => [l.lessonId, l]))
}
