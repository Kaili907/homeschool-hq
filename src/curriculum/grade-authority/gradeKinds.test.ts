import { describe, expect, it } from 'vitest'
import {
  NOMINAL_STUDENT_GRADES,
  resolveWorkingAcademyGrade,
  type NominalStudentGrade,
} from './gradeKinds'

describe('nominal, working, and curriculum-supported grades', () => {
  it('keeps the nominal vocabulary distinct and includes 6, 9, and 11', () => {
    expect(NOMINAL_STUDENT_GRADES).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const nominal: NominalStudentGrade[] = [6, 9, 11]
    expect(nominal).toEqual([6, 9, 11])
  })

  it('resolves a supported nominal grade and fails closed for nominal Grade 6', () => {
    expect(resolveWorkingAcademyGrade(9)).toBe(9)
    expect(resolveWorkingAcademyGrade(6)).toBeNull()
  })

  it('prefers a curriculum-supported subject override without changing nominal grade', () => {
    const nominal: NominalStudentGrade = 8
    expect(resolveWorkingAcademyGrade(nominal, 7)).toBe(7)
    expect(nominal).toBe(8)
  })
})
