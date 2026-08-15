import { describe, expect, it } from 'vitest'
import { SUPPORTED_ACADEMY_GRADES } from './constants'
import {
  ACADEMY_ASSESSMENT_ID_PATTERN,
  ACADEMY_COURSE_ID_PATTERN,
  ACADEMY_LESSON_ID_PATTERN,
  ACADEMY_UNIT_ID_PATTERN,
  SUPPORTED_GRADE_ALTERNATION,
  academyAssessmentId,
  academyCourseId,
  academyLessonId,
  academyUnitId,
  gradeLessonIdToken,
  gradeRouteToken,
  parseAcademyAssessmentId,
  parseAcademyCourseId,
  parseAcademyLessonId,
  parseAcademyUnitId,
  parseGradeFromLessonId,
  parseGradeFromRouteToken,
} from './tokens'

describe('canonical Academy id grammar', () => {
  it('uses a longest-first supported-grade alternation', () => {
    expect(SUPPORTED_GRADE_ALTERNATION).toBe('10|11|12|3|4|5|7|8|9')
  })

  it('round-trips course, unit, lesson, and assessment ids for every grade', () => {
    for (const grade of SUPPORTED_ACADEMY_GRADES) {
      const courseId = academyCourseId(grade, 'english-language-arts')
      const unitId = academyUnitId(grade, 'english-language-arts', 1)
      const lessonId = academyLessonId(grade, 'english-language-arts', 1, 2)
      const assessmentId = academyAssessmentId(grade, 'english-language-arts', 1)

      expect(parseAcademyCourseId(courseId)).toEqual({ grade, subject: 'english-language-arts' })
      expect(parseAcademyUnitId(unitId)).toEqual({
        grade, subject: 'english-language-arts', unitNumber: 1,
      })
      expect(parseAcademyLessonId(lessonId)).toEqual({
        grade, subject: 'english-language-arts', unitNumber: 1, lessonNumber: 2,
      })
      expect(parseAcademyAssessmentId(assessmentId)).toEqual({
        grade, subject: 'english-language-arts', unitNumber: 1,
      })
      expect(parseGradeFromLessonId(lessonId)).toBe(grade)
      expect(parseGradeFromRouteToken(`${gradeRouteToken(grade)}:academy-week-1-day-1`)).toBe(grade)
    }
  })

  it('emits the exact two-digit identifier forms', () => {
    expect(gradeLessonIdToken(10)).toBe('g10')
    expect(academyCourseId(10, 'mathematics')).toBe('ma-g10-mathematics')
    expect(academyUnitId(10, 'mathematics', 1)).toBe('ma-g10-mathematics-u01')
    expect(academyLessonId(10, 'mathematics', 1, 1)).toBe('ma-g10-mathematics-u01-l01')
    expect(academyAssessmentId(10, 'mathematics', 1)).toBe(
      'ma-g10-mathematics-u01-assessment',
    )
  })

  it('never truncates Grades 10, 11, or 12 to Grade 1', () => {
    for (const grade of [10, 11, 12] as const) {
      expect(parseGradeFromLessonId(`ma-g${grade}-mathematics-u01-l01`)).toBe(grade)
      expect(parseGradeFromRouteToken(`grade-${grade}`)).toBe(grade)
      expect(parseGradeFromLessonId(`ma-g${grade}-mathematics-u01-l01`)).not.toBe(1)
    }
  })

  it('rejects unsupported grades and malformed identifiers explicitly', () => {
    for (const value of [
      'ma-g6-mathematics',
      'ma-g1-mathematics',
      'ma-g10-Mathematics',
      'ma-g10--mathematics',
    ]) {
      expect(parseAcademyCourseId(value)).toBeNull()
    }
    expect(parseAcademyUnitId('ma-g6-mathematics-u01')).toBeNull()
    expect(parseAcademyLessonId('ma-g6-mathematics-u01-l01')).toBeNull()
    expect(parseAcademyAssessmentId('ma-g6-mathematics-u01-assessment')).toBeNull()
    expect(() => academyCourseId(10, 'Bad Subject')).toThrow(RangeError)
    expect(() => academyLessonId(10, 'mathematics', 100, 1)).toThrow(RangeError)
  })

  it('keeps the exported patterns aligned with the parsers', () => {
    expect(ACADEMY_COURSE_ID_PATTERN.test('ma-g12-mathematics')).toBe(true)
    expect(ACADEMY_UNIT_ID_PATTERN.test('ma-g12-mathematics-u01')).toBe(true)
    expect(ACADEMY_LESSON_ID_PATTERN.test('ma-g12-mathematics-u01-l01')).toBe(true)
    expect(ACADEMY_ASSESSMENT_ID_PATTERN.test('ma-g12-mathematics-u01-assessment')).toBe(true)
  })
})
