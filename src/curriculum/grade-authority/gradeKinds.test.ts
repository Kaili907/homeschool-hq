import { describe, expect, it } from 'vitest'
import { resolveWorkingAcademyGrade, type NominalStudentGrade } from './gradeKinds'

describe('resolveWorkingAcademyGrade — nominal vs. working vs. curriculum-supported', () => {
  it('falls back to the nominal grade when it is curriculum-supported', () => {
    expect(resolveWorkingAcademyGrade(5)).toBe(5)
    expect(resolveWorkingAcademyGrade(10)).toBe(10)
  })

  it('returns null when the nominal grade has no curriculum, even with no override', () => {
    const nominal: NominalStudentGrade = 6
    expect(resolveWorkingAcademyGrade(nominal)).toBeNull()
  })

  it('returns null for nominal grades 1 and 2, which are not curriculum-supported', () => {
    expect(resolveWorkingAcademyGrade(1)).toBeNull()
    expect(resolveWorkingAcademyGrade(2)).toBeNull()
  })

  it('prefers an explicit working-level override over the nominal grade', () => {
    // A student nominally in grade 6 (no curriculum) explicitly working at grade 5.
    expect(resolveWorkingAcademyGrade(6, 5)).toBe(5)
    // An override still wins even when the nominal grade is itself supported.
    expect(resolveWorkingAcademyGrade(5, 8)).toBe(8)
  })

  it('treats an explicit null override as "no override", not "no content"', () => {
    expect(resolveWorkingAcademyGrade(7, null)).toBe(7)
    expect(resolveWorkingAcademyGrade(6, null)).toBeNull()
  })

  it('keeps nominal and curriculum-supported grades as distinct types at the type level', () => {
    // NominalStudentGrade admits 1, 2, and 6 — AcademySupportedGrade does not.
    const nominalGrades: NominalStudentGrade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    expect(nominalGrades).toHaveLength(12)
  })
})
