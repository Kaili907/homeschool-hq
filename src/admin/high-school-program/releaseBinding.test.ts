import { describe, expect, it } from 'vitest'
import { ADMIN_EXPANDED_RELEASE } from '../releaseDataModel'
import { deriveHighSchoolProgramView } from './model'
import { HIGH_SCHOOL_PROGRAM_RELEASE_SNAPSHOT } from './releaseBinding'

describe('High School Program admitted release binding', () => {
  it('uses all real Grade 9-12 course refs, names, and population facts', () => {
    const highSchool = HIGH_SCHOOL_PROGRAM_RELEASE_SNAPSHOT.courses.filter((course) => course.grade >= 9)
    expect(highSchool).toHaveLength(40)
    expect(HIGH_SCHOOL_PROGRAM_RELEASE_SNAPSHOT.release?.counts).toEqual(ADMIN_EXPANDED_RELEASE.counts)
    expect(highSchool).toEqual(expect.arrayContaining([
      expect.objectContaining({ grade: 9, courseId: 'ma-g9-mathematics', courseName: 'Algebra I' }),
      expect.objectContaining({ grade: 10, courseId: 'ma-g10-science', courseName: 'Chemistry' }),
      expect.objectContaining({ grade: 11, courseId: 'ma-g11-mathematics', courseName: 'Algebra II' }),
      expect.objectContaining({ grade: 12, courseId: 'ma-g12-technology', courseName: 'Cybersecurity, AI Literacy, and Computing Capstone' }),
    ]))
    expect(highSchool.every((course) => course.authoringStatus === 'ADMITTED_RELEASE')).toBe(true)
  })

  it('preserves Grade 10/11/12 ids and resolves every predecessor prerequisite', () => {
    for (const grade of [10, 11, 12]) {
      const courses = HIGH_SCHOOL_PROGRAM_RELEASE_SNAPSHOT.courses.filter((course) => course.grade === grade)
      expect(courses).toHaveLength(10)
      expect(courses.every((course) => course.courseId.startsWith(`ma-g${grade}-`))).toBe(true)
    }
    const view = deriveHighSchoolProgramView(HIGH_SCHOOL_PROGRAM_RELEASE_SNAPSHOT)
    expect(view.prerequisites.filter((row) => row.courseId.startsWith('ma-g9-') || row.courseId.startsWith('ma-g10-') || row.courseId.startsWith('ma-g11-') || row.courseId.startsWith('ma-g12-')).every((row) => row.status === 'ok')).toBe(true)
  })

  it('reports the release as served without relaxing the World Language graduation blocker', () => {
    const view = deriveHighSchoolProgramView(HIGH_SCHOOL_PROGRAM_RELEASE_SNAPSHOT)
    expect(view.deliveryStatus.displayStatus).toBe('COVERED')
    expect(view.coverageGaps.find((gap) => gap.requirement === 'MMC_WORLD_LANGUAGE')?.displayStatus).toBe('NOT_COVERED')
    expect(view.graduationCompletionClaimable).toBe(false)
    expect(view.graduation.overallStatus).toBe('not_graduation_complete')
  })
})
