import { describe, expect, it } from 'vitest'
import { SUPPORTED_ACADEMY_GRADES } from './constants'
import {
  gradeLessonIdToken,
  gradeRouteToken,
  parseGradeFromLessonId,
  parseGradeFromRouteToken,
  SUPPORTED_GRADE_ALTERNATION,
  ACADEMY_COURSE_ID_PATTERN,
  ACADEMY_LESSON_ID_PATTERN,
} from './tokens'

describe('gradeLessonIdToken / gradeRouteToken', () => {
  it('round-trips every supported grade through the lesson-id token', () => {
    for (const grade of SUPPORTED_ACADEMY_GRADES) {
      const courseId = `ma-${gradeLessonIdToken(grade)}-math`
      const lessonId = `${courseId}-u01-l02`
      expect(parseGradeFromLessonId(courseId)).toBe(grade)
      expect(parseGradeFromLessonId(lessonId)).toBe(grade)
    }
  })

  it('round-trips every supported grade through the route token', () => {
    for (const grade of SUPPORTED_ACADEMY_GRADES) {
      const token = gradeRouteToken(grade)
      expect(parseGradeFromRouteToken(token)).toBe(grade)
      expect(parseGradeFromRouteToken(`${token}:academy-week-12-day-3`)).toBe(grade)
      expect(parseGradeFromRouteToken(`/academy/${token}/course`)).toBe(grade)
    }
  })

  it('produces the exact tokens the rest of the app already uses', () => {
    expect(gradeLessonIdToken(5)).toBe('g5')
    expect(gradeLessonIdToken(10)).toBe('g10')
    expect(gradeRouteToken(5)).toBe('grade-5')
    expect(gradeRouteToken(10)).toBe('grade-10')
  })
})

describe('two-digit grade token parsing (regression guard)', () => {
  it('does not truncate Grade 10/11/12 lesson ids down to Grade 1', () => {
    expect(parseGradeFromLessonId('ma-g10-math-u01-l02')).toBe(10)
    expect(parseGradeFromLessonId('ma-g11-math-u01-l02')).toBe(11)
    expect(parseGradeFromLessonId('ma-g12-math-u01-l02')).toBe(12)
    expect(parseGradeFromLessonId('ma-g10-math-u01-l02')).not.toBe(1)
  })

  it('does not truncate Grade 10/11/12 route tokens down to Grade 1', () => {
    expect(parseGradeFromRouteToken('grade-10')).toBe(10)
    expect(parseGradeFromRouteToken('grade-11')).toBe(11)
    expect(parseGradeFromRouteToken('grade-12')).toBe(12)
    expect(parseGradeFromRouteToken('grade-10:academy-week-1-day-1')).not.toBe(1)
  })

  it('does not mistake grade 1 (unsupported) for a prefix match inside a two-digit id', () => {
    // A lesson id that only contains two-digit grades must never report grade 1,
    // which a single-digit-capture regex (`g(\d)`) or a bare substring test
    // (`id.includes('g1')`) would incorrectly do.
    expect(parseGradeFromLessonId('ma-g12-ela-u03-l01')).not.toBe(1)
    expect(parseGradeFromRouteToken('grade-12')).not.toBe(1)
  })
})

describe('lesson-id and route-token grade extraction edge cases', () => {
  it('returns null when there is no grade token', () => {
    expect(parseGradeFromLessonId('ma-math-u01-l02')).toBeNull()
    expect(parseGradeFromRouteToken('academy/course')).toBeNull()
  })

  it('rejects a grade token naming an unsupported grade', () => {
    expect(parseGradeFromLessonId('ma-g6-math-u01-l02')).toBeNull()
    expect(parseGradeFromLessonId('ma-g1-math-u01-l02')).toBeNull()
    expect(parseGradeFromRouteToken('grade-6')).toBeNull()
    expect(parseGradeFromRouteToken('grade-2')).toBeNull()
  })

  it('does not match a grade digit embedded in an unrelated word', () => {
    expect(parseGradeFromLessonId('ma-stage10-math')).toBeNull()
    expect(parseGradeFromRouteToken('upgrade-10')).toBeNull()
  })
})

describe('shared course/lesson id patterns', () => {
  it('exposes a longest-first alternation so two-digit grades cannot truncate', () => {
    expect(SUPPORTED_GRADE_ALTERNATION).toBe('10|11|12|3|4|5|7|8|9')
  })

  it('parses every supported grade out of a course id', () => {
    for (const grade of SUPPORTED_ACADEMY_GRADES) {
      expect(ACADEMY_COURSE_ID_PATTERN.exec(`ma-g${grade}-mathematics`)?.slice(1)).toEqual([
        String(grade),
        'mathematics',
      ])
    }
  })

  it('never reads grade 10, 11 or 12 as grade 1', () => {
    for (const grade of [10, 11, 12] as const) {
      const parsed = ACADEMY_COURSE_ID_PATTERN.exec(`ma-g${grade}-mathematics`)
      expect(parsed?.[1]).toBe(String(grade))
      expect(parsed?.[2]).toBe('mathematics')
      expect(ACADEMY_LESSON_ID_PATTERN.test(`ma-g${grade}-mathematics-u02-l01`)).toBe(true)
      expect(parseGradeFromLessonId(`ma-g${grade}-mathematics-u02-l01`)).toBe(grade)
      expect(parseGradeFromRouteToken(`grade-${grade}`)).toBe(grade)
    }
  })

  it('rejects grades with no authored curriculum', () => {
    for (const grade of [0, 1, 2, 6, 13, 100]) {
      expect(ACADEMY_COURSE_ID_PATTERN.test(`ma-g${grade}-mathematics`)).toBe(false)
      expect(ACADEMY_LESSON_ID_PATTERN.test(`ma-g${grade}-mathematics-u02-l01`)).toBe(false)
      expect(parseGradeFromLessonId(`ma-g${grade}-mathematics-u02-l01`)).toBeNull()
    }
  })

  it('anchors both ends, so a grade token cannot ride in on a longer id', () => {
    expect(ACADEMY_COURSE_ID_PATTERN.test('xma-g5-mathematics')).toBe(false)
    expect(ACADEMY_COURSE_ID_PATTERN.test('ma-g5-mathematics-u01')).toBe(false)
    expect(ACADEMY_LESSON_ID_PATTERN.test('ma-g5-mathematics-u02-l01-extra')).toBe(false)
  })
})
