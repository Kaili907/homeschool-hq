import { describe, expect, it } from 'vitest'
import { ADMIN_EXPANDED_RELEASE, buildAdminReleaseReadModel } from './releaseDataModel'

describe('Admin expanded release read model', () => {
  it('derives the admitted population from the supplied source projections', () => {
    expect(ADMIN_EXPANDED_RELEASE.releaseVersion).toBe('2.0.0')
    expect(ADMIN_EXPANDED_RELEASE.counts).toEqual({
      grades: 9,
      courses: 90,
      units: 698,
      lessons: 8_292,
      assessments: 699,
    })
    expect(ADMIN_EXPANDED_RELEASE.courses).toHaveLength(ADMIN_EXPANDED_RELEASE.counts.courses)
    expect(ADMIN_EXPANDED_RELEASE.courses.reduce((sum, course) => sum + course.unitCount, 0)).toBe(ADMIN_EXPANDED_RELEASE.counts.units)
    expect(ADMIN_EXPANDED_RELEASE.courses.reduce((sum, course) => sum + course.lessonCount, 0)).toBe(ADMIN_EXPANDED_RELEASE.counts.lessons)
  })

  it('preserves real high-school refs and named courses from source data', () => {
    const highSchool = ADMIN_EXPANDED_RELEASE.courses.filter((course) => course.grade >= 9)
    expect(highSchool).toHaveLength(40)
    expect(highSchool).toEqual(expect.arrayContaining([
      expect.objectContaining({ grade: 9, courseRef: 'ma-g9-mathematics', title: 'Algebra I' }),
      expect.objectContaining({ grade: 10, courseRef: 'ma-g10-science', title: 'Chemistry' }),
      expect.objectContaining({ grade: 11, courseRef: 'ma-g11-mathematics', title: 'Algebra II' }),
      expect.objectContaining({ grade: 12, courseRef: 'ma-g12-technology', title: 'Cybersecurity, AI Literacy, and Computing Capstone' }),
    ]))
    for (const grade of [10, 11, 12]) {
      expect(highSchool.filter((course) => course.grade === grade).every((course) => course.courseRef.startsWith(`ma-g${grade}-`))).toBe(true)
    }
  })

  it('fails closed when a reported total drifts from the catalog projection', () => {
    expect(() => buildAdminReleaseReadModel({
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      manifestSourcePath: 'test/manifest.json',
      catalogSourcePath: 'test/catalog.json',
      releaseId: 'test', releaseVersion: 'test', classification: 'test', admissionStatus: 'ADMITTED',
      supportedGrades: [9], counts: { grades: 1, courses: 2, units: 1, lessons: 1, assessments: 1 },
      assessmentBindings: { total: 1 },
      courses: [{ courseRef: 'course', grade: 9, subject: 'math', title: 'Math', days: 1, unitCount: 1, lessonCount: 1 }],
    })).toThrow(/courses total disagrees/)
  })
})
