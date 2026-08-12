import { describe, expect, it } from 'vitest'
import {
  firstLesson,
  getAssessmentForLesson,
  getAssessmentForUnit,
  getLesson,
  getNextLesson,
  getUnit,
  lastLesson,
  listLessons,
  listUnits,
  midLesson,
  totalLessonCount,
  totalUnitCount,
} from './catalog'
import { SOCIAL_STUDIES_PHASE_SEQUENCE } from './types'
import type { SocialStudiesCatalog, SocialStudiesLessonRef, SocialStudiesUnitRef } from './types'

/** A small fixture, independent of the filesystem loader, so catalog.ts
 * edge cases (first/mid/last, unknown ref, assessment joining, grade
 * isolation) are pinned without depending on the real curriculum's size. */
function fixtureLesson(
  courseId: string,
  grade: '5' | '7',
  unitId: string,
  unitNumber: number,
  dayInUnit: number,
  courseDay: number,
): SocialStudiesLessonRef {
  return {
    lessonId: `${unitId}-l${String(dayInUnit).padStart(2, '0')}`,
    courseId,
    grade,
    unitId,
    unitNumber,
    dayInUnit,
    courseDay,
    title: `Lesson ${dayInUnit}`,
    phase: SOCIAL_STUDIES_PHASE_SEQUENCE[dayInUnit - 1],
    focus: `focus-${dayInUnit}`,
    essentialQuestion: 'Why does this matter?',
    standards: ['Fixture Standard 1'],
    materials: ['notebook'],
  }
}

function fixtureUnit(
  courseId: string,
  grade: '5' | '7',
  unitId: string,
  unitNumber: number,
  assessmentId: string,
): { readonly unit: SocialStudiesUnitRef; readonly lessons: readonly SocialStudiesLessonRef[] } {
  const lessons = SOCIAL_STUDIES_PHASE_SEQUENCE.map((_phase, index) =>
    fixtureLesson(courseId, grade, unitId, unitNumber, index + 1, (unitNumber - 1) * SOCIAL_STUDIES_PHASE_SEQUENCE.length + index + 1),
  )
  const unit: SocialStudiesUnitRef = {
    unitId,
    courseId,
    grade,
    unitNumber,
    title: `Unit ${unitNumber}`,
    essentialQuestion: 'Why does this matter?',
    standards: ['Fixture Standard 1'],
    topics: ['primary and secondary sources', 'maps and spatial thinking'],
    performanceTask: 'Build a fixture exhibit.',
    assessmentId,
    lessonIds: lessons.map((lesson) => lesson.lessonId),
  }
  return { unit, lessons }
}

function fixtureCatalog(): SocialStudiesCatalog {
  const g5 = fixtureUnit('ma-g5-social-studies', '5', 'ma-g5-social-studies-u01', 1, 'ma-g5-social-studies-u01-assessment')
  const g7 = fixtureUnit('ma-g7-social-studies', '7', 'ma-g7-social-studies-u01', 1, 'ma-g7-social-studies-u01-assessment')
  return {
    releaseVersion: '0.0.0-fixture',
    courses: [
      {
        courseId: 'ma-g5-social-studies',
        grade: '5',
        title: 'Grade 5 Social Studies',
        units: [g5.unit],
        lessons: g5.lessons,
        assessments: [
          {
            assessmentId: g5.unit.assessmentId as string,
            courseId: 'ma-g5-social-studies',
            grade: '5',
            unitNumber: 1,
            unitTitle: g5.unit.title,
            standards: g5.unit.standards,
            totalPoints: 30,
            promptCount: 6,
          },
        ],
      },
      {
        courseId: 'ma-g7-social-studies',
        grade: '7',
        title: 'Grade 7 Social Studies',
        units: [g7.unit],
        lessons: g7.lessons,
        assessments: [
          {
            assessmentId: g7.unit.assessmentId as string,
            courseId: 'ma-g7-social-studies',
            grade: '7',
            unitNumber: 1,
            unitTitle: g7.unit.title,
            standards: g7.unit.standards,
            totalPoints: 30,
            promptCount: 6,
          },
        ],
      },
    ],
  }
}

describe('FF-M3 social studies catalog', () => {
  const catalog = fixtureCatalog()

  it('lists lessons and units per grade without leaking across grades', () => {
    expect(listLessons(catalog, '5').every((lesson) => lesson.grade === '5')).toBe(true)
    expect(listLessons(catalog, '7').every((lesson) => lesson.grade === '7')).toBe(true)
    expect(listUnits(catalog, '5')).toHaveLength(1)
    expect(listUnits(catalog, '8')).toHaveLength(0)
    expect(listLessons(catalog, '8')).toHaveLength(0)
  })

  it('resolves first, mid, and last lessons deterministically', () => {
    const first = firstLesson(catalog, '5')
    const mid = midLesson(catalog, '5')
    const last = lastLesson(catalog, '5')
    expect(first?.lessonId).toBe('ma-g5-social-studies-u01-l01')
    expect(last?.lessonId).toBe('ma-g5-social-studies-u01-l12')
    // 12 lessons, index floor((12-1)/2) = 5 -> the 6th lesson (l06).
    expect(mid?.lessonId).toBe('ma-g5-social-studies-u01-l06')
    expect(first?.lessonId).not.toBe(last?.lessonId)
  })

  it('resolves a lesson by ref with a stable identity across repeated calls', () => {
    const a = getLesson(catalog, 'ma-g5-social-studies-u01-l01')
    const b = getLesson(catalog, 'ma-g5-social-studies-u01-l01')
    expect(a).toBe(b)
    expect(getLesson(catalog, 'unknown-ref')).toBeUndefined()
  })

  it('walks to the next lesson and stops at the course boundary', () => {
    const next = getNextLesson(catalog, 'ma-g5-social-studies-u01-l01')
    expect(next?.lessonId).toBe('ma-g5-social-studies-u01-l02')
    expect(getNextLesson(catalog, 'ma-g5-social-studies-u01-l12')).toBeUndefined()
    expect(getNextLesson(catalog, 'unknown-ref')).toBeUndefined()
  })

  it('resolves a unit by ref', () => {
    expect(getUnit(catalog, 'ma-g5-social-studies-u01')?.title).toBe('Unit 1')
    expect(getUnit(catalog, 'unknown-unit')).toBeUndefined()
  })

  it('reports exact aggregate counts across grades', () => {
    expect(totalLessonCount(catalog)).toBe(24)
    expect(totalUnitCount(catalog)).toBe(2)
  })

  it('joins assessment content to exactly one lesson per unit: the "Unit assessment" phase lesson', () => {
    const unitAssessmentLessons = listLessons(catalog, '5').filter((lesson) => lesson.phase === 'Unit assessment')
    expect(unitAssessmentLessons).toHaveLength(1)

    const withAssessment = listLessons(catalog, '5').filter((lesson) => getAssessmentForLesson(catalog, lesson.lessonId))
    expect(withAssessment).toHaveLength(1)
    expect(withAssessment[0].phase).toBe('Unit assessment')
    expect(getAssessmentForLesson(catalog, withAssessment[0].lessonId)?.assessmentId).toBe(
      'ma-g5-social-studies-u01-assessment',
    )

    // No duplicate completion authority: the assessment is reachable by unit too, but it's the
    // same single assessment record, not a second assignable item.
    expect(getAssessmentForUnit(catalog, 'ma-g5-social-studies-u01')?.assessmentId).toBe(
      getAssessmentForLesson(catalog, withAssessment[0].lessonId)?.assessmentId,
    )
  })

  it('never attaches assessment content to a non-"Unit assessment" phase lesson', () => {
    const nonAssessmentLessons = listLessons(catalog, '5').filter((lesson) => lesson.phase !== 'Unit assessment')
    for (const lesson of nonAssessmentLessons) {
      expect(getAssessmentForLesson(catalog, lesson.lessonId)).toBeUndefined()
    }
  })
})
