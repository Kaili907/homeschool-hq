import { describe, expect, it } from 'vitest'
import {
  formatAcademyPath,
  isAcademyPath,
  parseAcademyPath,
  type AcademyRoute,
} from './academyRoute'

describe('CURR-1 academy routes', () => {
  const ROUTES: AcademyRoute[] = [
    { kind: 'home' },
    { kind: 'schedule' },
    { kind: 'course', courseId: 'ma-g5-mathematics' },
    { kind: 'unit', courseId: 'ma-g7-science', unitNumber: 3 },
    { kind: 'assessment', courseId: 'ma-g8-financial-literacy', unitNumber: 7 },
    {
      kind: 'lesson',
      courseId: 'ma-g5-english-language-arts',
      unitNumber: 1,
      lessonId: 'ma-g5-english-language-arts-u01-l09',
    },
  ]

  it('round-trips every route kind through format + parse', () => {
    for (const route of ROUTES) {
      expect(parseAcademyPath(formatAcademyPath(route))).toEqual(route)
    }
  })

  it('non-academy paths parse to null (the app falls through to normal routing)', () => {
    expect(parseAcademyPath('/')).toBeNull()
    expect(parseAcademyPath('/study-engine')).toBeNull()
    expect(parseAcademyPath('/academia')).toBeNull()
  })

  it('malformed academy subpaths degrade to home, never crash', () => {
    expect(parseAcademyPath('/academy/nope')).toEqual({ kind: 'home' })
    expect(parseAcademyPath('/academy/course/not-a-course-id')).toEqual({ kind: 'home' })
    expect(parseAcademyPath('/academy/course/ma-g5-mathematics/unit/zero')).toEqual({ kind: 'home' })
    expect(parseAcademyPath('/academy/course/ma-g5-mathematics/unit/2/lesson/evil')).toEqual({
      kind: 'home',
    })
    expect(
      parseAcademyPath('/academy/course/ma-g5-mathematics/unit/2/lesson/ma-g5-mathematics-u02-l01/x'),
    ).toEqual({ kind: 'home' })
  })

  it('ids naming a grade with no authored curriculum degrade to home', () => {
    // Grade 6 is the canonical unsupported grade (see curriculum/grade-authority);
    // 1 and 2 are below the authored range.
    expect(parseAcademyPath('/academy/course/ma-g6-mathematics')).toEqual({ kind: 'home' })
    expect(parseAcademyPath('/academy/course/ma-g1-mathematics')).toEqual({ kind: 'home' })
    expect(parseAcademyPath('/academy/course/ma-g2-mathematics')).toEqual({ kind: 'home' })
  })

  it('two-digit grades parse as themselves, never as grade 1', () => {
    for (const grade of ['10', '11', '12'] as const) {
      expect(parseAcademyPath(`/academy/course/ma-g${grade}-mathematics`)).toEqual({
        kind: 'course',
        courseId: `ma-g${grade}-mathematics`,
      })
      expect(
        parseAcademyPath(
          `/academy/course/ma-g${grade}-mathematics/unit/2/lesson/ma-g${grade}-mathematics-u02-l01`,
        ),
      ).toEqual({
        kind: 'lesson',
        courseId: `ma-g${grade}-mathematics`,
        unitNumber: 2,
        lessonId: `ma-g${grade}-mathematics-u02-l01`,
      })
    }
  })

  it('isAcademyPath matches the surface root and its subpaths only', () => {
    expect(isAcademyPath('/academy')).toBe(true)
    expect(isAcademyPath('/academy/schedule')).toBe(true)
    expect(isAcademyPath('/academyx')).toBe(false)
    expect(isAcademyPath('/')).toBe(false)
  })
})
