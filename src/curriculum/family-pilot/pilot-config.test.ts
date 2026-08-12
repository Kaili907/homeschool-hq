import { describe, expect, it } from 'vitest'
import { FAMILY_PILOT_STATIC_CONFIG, resolveFamilyPilotUnit } from './pilot-config'
import { loadFamilyPilotCatalog } from './source.node'

describe('FAMILY-PILOT-CONFIG-1 static pilot configuration', () => {
  it('is grade 5 mathematics — never grade 7 or 8 — with no catalog needed', () => {
    expect(FAMILY_PILOT_STATIC_CONFIG.grade).toBe('5')
    expect(FAMILY_PILOT_STATIC_CONFIG.subject).toBe('mathematics')
    expect(['7', '8']).not.toContain(FAMILY_PILOT_STATIC_CONFIG.grade)
  })

  it('names the grade 5 mathematics course and its first unit', () => {
    expect(FAMILY_PILOT_STATIC_CONFIG.courseId).toBe('ma-g5-mathematics')
    expect(FAMILY_PILOT_STATIC_CONFIG.unitId).toBe('ma-g5-mathematics-u01')
  })

  it('resolves through the real catalog to a unit with lesson and assessment content', () => {
    const catalog = loadFamilyPilotCatalog()
    const unit = resolveFamilyPilotUnit(catalog)

    expect(unit.unitId).toBe(FAMILY_PILOT_STATIC_CONFIG.unitId)
    expect(unit.unitNumber).toBe(1)
    expect(unit.lessonIds.length).toBeGreaterThan(0)
    expect(unit.assessmentId).not.toBeNull()

    const course = catalog.courses.find((c) => c.courseId === FAMILY_PILOT_STATIC_CONFIG.courseId)!
    expect(course.grade).toBe('5')
    for (const lessonId of unit.lessonIds) {
      expect(course.lessons.some((lesson) => lesson.lessonId === lessonId)).toBe(true)
    }
  })

  it('throws instead of silently falling back when the configured course is missing', () => {
    expect(() =>
      resolveFamilyPilotUnit({ releaseVersion: 'x', courses: [] }),
    ).toThrow(/course ma-g5-mathematics is not in the catalog/)
  })

  it('throws instead of silently falling back when the configured unit is missing', () => {
    const catalogWithoutUnit = {
      releaseVersion: 'x',
      courses: [
        {
          courseId: 'ma-g5-mathematics',
          grade: '5' as const,
          subject: 'mathematics' as const,
          title: 'Grade 5 Mathematics',
          units: [],
          lessons: [],
        },
      ],
    }
    expect(() => resolveFamilyPilotUnit(catalogWithoutUnit)).toThrow(
      /unit ma-g5-mathematics-u01 is not in course ma-g5-mathematics/,
    )
  })
})
