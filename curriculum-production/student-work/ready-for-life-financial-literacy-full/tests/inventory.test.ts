import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import {
  AUTHORED_COURSES,
  GRADES_WITHOUT_SOURCE,
  fieldVariety,
  loadCourseLessons,
} from '../src/inventory.ts'

const REPO_ROOT = new URL('../../../..', import.meta.url).pathname

/** Lesson counts derived from source, not asserted from the brief. */
const EXPECTED_LESSON_COUNTS: Record<string, number> = {
  'grade-3/ready-for-life': 36,
  'grade-3/financial-literacy': 36,
  'grade-4/ready-for-life': 36,
  'grade-4/financial-literacy': 36,
  'grade-5/ready-for-life': 36,
  'grade-5/financial-literacy': 36,
  'grade-7/ready-for-life': 36,
  'grade-7/financial-literacy': 36,
  'grade-8/ready-for-life': 36,
  'grade-8/financial-literacy': 72,
}

describe('authored RFL/FinLit source inventory', () => {
  it('covers exactly the ten authored courses', () => {
    expect(AUTHORED_COURSES).toHaveLength(10)
  })

  it.each(AUTHORED_COURSES)('grade-$grade/$subject matches the derived lesson count', (course) => {
    const lessons = loadCourseLessons(course)
    expect(lessons, `source unreachable: ${course.ref ?? 'worktree'}:${course.path}`).not.toBeNull()
    expect(lessons!).toHaveLength(EXPECTED_LESSON_COUNTS[`grade-${course.grade}/${course.subject}`])
  })

  it('totals 396 authored lessons', () => {
    const total = AUTHORED_COURSES.reduce(
      (sum, course) => sum + (loadCourseLessons(course)?.length ?? 0),
      0,
    )
    expect(total).toBe(396)
  })
})

describe('grades the brief requested that have no authored source', () => {
  // One scan of every ref, shared by all four grades: ~524 refs, so a
  // per-grade scan would re-walk the whole ref list four times over.
  const gradesFound = (() => {
    const refs = execFileSync('git', ['for-each-ref', '--format=%(refname)'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\n')
      .filter(Boolean)

    const found = new Map<number, string[]>()
    for (const ref of refs) {
      let listing: string
      try {
        listing = execFileSync(
          'git',
          ['ls-tree', '-r', '-d', '--name-only', ref, 'curriculum-content/'],
          { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
        )
      } catch {
        continue
      }
      for (const grade of GRADES_WITHOUT_SOURCE) {
        if (listing.split('\n').some((path) => path.endsWith(`/grades/grade-${grade}`))) {
          found.set(grade, [...(found.get(grade) ?? []), ref])
        }
      }
    }
    return found
  })()

  it.each(GRADES_WITHOUT_SOURCE)('no ref in the repository holds grade-%i content', (grade) => {
    const hits = gradesFound.get(grade) ?? []
    expect(hits, `unexpected grade-${grade} source on: ${hits.join(', ')}`).toEqual([])
  })
})

describe('per-lesson information actually present in source', () => {
  const inWorktree = AUTHORED_COURSES.filter((course) => course.ref === null)

  it.each(inWorktree)(
    'grade-$grade/$subject: scoring guidance is identical across every lesson',
    (course) => {
      const lessons = loadCourseLessons(course)!
      // A single distinct value means the field carries no per-lesson answer
      // content, so no FinLit answer key can be derived from it.
      expect(fieldVariety(lessons, 'answer_or_scoring_guidance').distinct).toBe(1)
      expect(fieldVariety(lessons, 'materials').distinct).toBe(1)
    },
  )
})
