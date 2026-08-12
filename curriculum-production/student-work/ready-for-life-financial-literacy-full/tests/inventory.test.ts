import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import {
  ALL_COURSES,
  HS_AUTHORING_COURSES,
  RELEASED_COURSES,
  fieldVariety,
  loadCourseLessons,
} from '../src/inventory.ts'

const REPO_ROOT = new URL('../../../..', import.meta.url).pathname

/** Lesson counts derived from source, not asserted from the brief. */
const EXPECTED: Record<string, number> = {
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
  'grade-9/ready-for-life': 36,
  'grade-9/financial-literacy': 72,
  'grade-10/ready-for-life': 36,
  'grade-10/financial-literacy': 72,
  'grade-11/ready-for-life': 36,
  'grade-11/financial-literacy': 72,
  'grade-12/ready-for-life': 36,
  'grade-12/financial-literacy': 72,
}

const key = (c: { grade: number; subject: string }) => `grade-${c.grade}/${c.subject}`

describe('authored RFL/FinLit source inventory', () => {
  it('spans 10 released courses and 8 high-school authoring courses', () => {
    expect(RELEASED_COURSES).toHaveLength(10)
    expect(HS_AUTHORING_COURSES).toHaveLength(8)
  })

  it.each(ALL_COURSES)('grade-$grade/$subject ($stage) matches the derived count', (course) => {
    const lessons = loadCourseLessons(course)
    expect(lessons, `source unreachable: ${course.ref ?? 'worktree'}:${course.path}`).not.toBeNull()
    expect(lessons!).toHaveLength(EXPECTED[key(course)])
  })

  it('totals 396 released and 432 high-school lessons (828 authored overall)', () => {
    const sum = (cs: readonly typeof ALL_COURSES[number][]) =>
      cs.reduce((n, c) => n + (loadCourseLessons(c)?.length ?? 0), 0)
    expect(sum(RELEASED_COURSES)).toBe(396)
    expect(sum(HS_AUTHORING_COURSES)).toBe(432)
    expect(sum(ALL_COURSES)).toBe(828)
  })
})

describe('high school is authored but not released', () => {
  // The distinction that matters for a production claim: HS content exists,
  // but no curriculum-content RELEASE contains it. A scan restricted to
  // curriculum-content/ therefore misses all 432 lessons.
  it('no ref promotes grade 9-12 into a curriculum-content release', () => {
    const refs = execFileSync('git', ['for-each-ref', '--format=%(refname)'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\n')
      .filter(Boolean)

    const promoted: string[] = []
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
      if (listing.split('\n').some((p) => /\/grades\/grade-(9|10|11|12)$/.test(p))) {
        promoted.push(ref)
      }
    }
    expect(promoted, `unexpectedly released HS content on: ${promoted.join(', ')}`).toEqual([])
  })

  it('but all 8 high-school courses are reachable at authoring stage', () => {
    for (const course of HS_AUTHORING_COURSES) {
      expect(loadCourseLessons(course), `unreachable: ${course.path}`).not.toBeNull()
    }
  })

  it.each([
    'ma-g9-ready-for-life-u02-l04',
    'ma-g9-ready-for-life-u05-l02',
    'ma-g9-financial-literacy-u04-l04',
    'ma-g9-financial-literacy-u05-l04',
  ])('lesson %s cited by the shipped grade-09-hs packages does resolve', (lessonId) => {
    const all = HS_AUTHORING_COURSES.flatMap((c) => loadCourseLessons(c) ?? [])
    expect(all.some((l) => l.lesson_id === lessonId)).toBe(true)
  })
})

describe('per-lesson information actually present in source', () => {
  it.each(RELEASED_COURSES.filter((c) => c.ref === null))(
    'grade-$grade/$subject: scoring guidance and materials are single-valued',
    (course) => {
      const lessons = loadCourseLessons(course)!
      expect(fieldVariety(lessons, 'answer_or_scoring_guidance').distinct).toBe(1)
      expect(fieldVariety(lessons, 'materials').distinct).toBe(1)
    },
  )

  it('high-school scoring guidance varies more, but still fixes no answer', () => {
    for (const course of HS_AUTHORING_COURSES) {
      const lessons = loadCourseLessons(course)!
      const variety = fieldVariety(lessons, 'answer_or_scoring_guidance')
      // More distinct than the released courses, so promoting HS would be an
      // improvement over 1.0.0 -- but the text is still guidance on how to
      // judge, never an answer: across all 432 HS lessons none contains a
      // currency amount or a computation, and most explicitly defer to
      // "any defensible conclusion the fictional figures support".
      expect(variety.distinct).toBeGreaterThan(1)
      for (const lesson of lessons) {
        const guidance = String(lesson.answer_or_scoring_guidance ?? '')
        expect(guidance).not.toContain('$')
        expect(guidance).not.toContain('=')
      }
    }
  })
})
