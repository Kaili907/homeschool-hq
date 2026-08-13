/**
 * Reads the authored Grade 12 Financial Literacy source at a pinned commit.
 *
 * The source lane lives on `mac/hs912-rfl-finlit-r1` and is not checked out in
 * this worktree, so it is read through `git show` at exactly the committed tip
 * this lane was authored against. Pinning the SHA rather than the branch name
 * means a later commit on that branch cannot silently change what this corpus
 * claims to cover.
 *
 * This lane covers grade 12 only. `loadSourceLessons` therefore reads the
 * grade 12 course, and `loadSourceUnits` reads the unit records the coverage
 * test uses to prove the authored corpus matches the source's own unit
 * structure rather than a count this lane made up.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const SOURCE_BRANCH = 'mac/hs912-rfl-finlit-r1'
export const SOURCE_SHA = '481296a9e794770348881b43bd0d1fa4f794db29'
export const SOURCE_ROOT = 'curriculum-authoring/full-family-highschool-9-12/subjects/financial-literacy'
export const SOURCE_CORPUS_VERSION = `${SOURCE_BRANCH}@${SOURCE_SHA.slice(0, 12)}`
export const GRADE = 12

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
}

export interface SourceUnit {
  readonly unitId: string
  readonly unitNumber: number
  readonly title: string
  readonly standards: readonly string[]
  readonly topics: readonly string[]
  readonly performanceTask: string
  readonly isCapstoneUnit: boolean
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
  const raw = show(`${SOURCE_ROOT}/courses/financial-literacy-${GRADE}/lessons.jsonl`)
  for (const line of raw.split('\n')) {
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
    })
  }
  cachedLessons = out
  return out
}

export function loadSourceUnits(): SourceUnit[] {
  if (cachedUnits) return cachedUnits
  const raw = show(`${SOURCE_ROOT}/courses/financial-literacy-${GRADE}/units.json`)
  const parsed = JSON.parse(raw) as Record<string, unknown>[]
  cachedUnits = parsed.map((u) => ({
    unitId: u.unit_id as string,
    unitNumber: u.unit_number as number,
    title: u.title as string,
    standards: u.standards as string[],
    topics: u.topics as string[],
    performanceTask: u.performance_task as string,
    isCapstoneUnit: Boolean(u.is_capstone_unit),
    lessonIds: u.lesson_ids as string[],
  }))
  return cachedUnits
}

export function sourceLessonMap(): Map<string, SourceLesson> {
  return new Map(loadSourceLessons().map((l) => [l.lessonId, l]))
}

/**
 * Emitted package ids of the sibling high-school lane, read at the current
 * working tree. The progression check uses these to prove no grade 12 package
 * id collides with a package that lane already ships, and to compare grade 12
 * prompt shapes against the grades already authored there.
 */
export const SIBLING_LANE = '../financial-literacy-hs'
