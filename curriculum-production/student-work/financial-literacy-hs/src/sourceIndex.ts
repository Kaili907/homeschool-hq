/**
 * Reads the authored high-school Financial Literacy corpus at a pinned commit.
 *
 * The source lane lives on `mac/hs912-rfl-finlit-r1` and is not checked out in
 * this worktree, so it is read through `git show` at exactly the committed tip
 * this lane was authored against. Pinning the SHA rather than the branch name
 * means a later commit on that branch cannot silently change what this corpus
 * claims to cover.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const SOURCE_BRANCH = 'mac/hs912-rfl-finlit-r1'
export const SOURCE_SHA = '481296a9e794770348881b43bd0d1fa4f794db29'
export const SOURCE_ROOT = 'curriculum-authoring/full-family-highschool-9-12/subjects/financial-literacy'
export const SOURCE_CORPUS_VERSION = `${SOURCE_BRANCH}@${SOURCE_SHA.slice(0, 12)}`

const REPO = fileURLToPath(new URL('../../../../', import.meta.url))

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

function show(path: string): string {
  return execFileSync('git', ['show', `${SOURCE_SHA}:${path}`], {
    cwd: REPO,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

let cached: SourceLesson[] | undefined

export function loadSourceLessons(): SourceLesson[] {
  if (cached) return cached
  const out: SourceLesson[] = []
  for (const grade of [9, 10, 11, 12]) {
    const raw = show(`${SOURCE_ROOT}/courses/financial-literacy-${grade}/lessons.jsonl`)
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
  }
  cached = out
  return out
}

export function sourceLessonMap(): Map<string, SourceLesson> {
  return new Map(loadSourceLessons().map((l) => [l.lessonId, l]))
}
