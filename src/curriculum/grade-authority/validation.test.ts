import { describe, expect, it } from 'vitest'
import { SUPPORTED_ACADEMY_GRADES } from './constants'
import { gradeLabel, isSupportedAcademyGrade, parseSupportedAcademyGrade } from './validation'

describe('isSupportedAcademyGrade', () => {
  it('accepts every currently-supported grade', () => {
    for (const grade of SUPPORTED_ACADEMY_GRADES) {
      expect(isSupportedAcademyGrade(grade)).toBe(true)
    }
  })

  it('rejects grade 6 — no curriculum has been authored for it', () => {
    expect(isSupportedAcademyGrade(6)).toBe(false)
  })

  it('rejects grades 1 and 2', () => {
    expect(isSupportedAcademyGrade(1)).toBe(false)
    expect(isSupportedAcademyGrade(2)).toBe(false)
  })

  it('rejects non-integers, out-of-range numbers, and non-numbers', () => {
    expect(isSupportedAcademyGrade(5.5)).toBe(false)
    expect(isSupportedAcademyGrade(0)).toBe(false)
    expect(isSupportedAcademyGrade(-7)).toBe(false)
    expect(isSupportedAcademyGrade(13)).toBe(false)
    expect(isSupportedAcademyGrade('5')).toBe(false)
    expect(isSupportedAcademyGrade(null)).toBe(false)
    expect(isSupportedAcademyGrade(undefined)).toBe(false)
  })
})

describe('parseSupportedAcademyGrade', () => {
  it('parses every supported grade from its number and string forms', () => {
    for (const grade of SUPPORTED_ACADEMY_GRADES) {
      expect(parseSupportedAcademyGrade(grade)).toBe(grade)
      expect(parseSupportedAcademyGrade(String(grade))).toBe(grade)
    }
  })

  it('correctly parses two-digit grades without truncation', () => {
    expect(parseSupportedAcademyGrade('10')).toBe(10)
    expect(parseSupportedAcademyGrade('11')).toBe(11)
    expect(parseSupportedAcademyGrade('12')).toBe(12)
    expect(parseSupportedAcademyGrade(10)).toBe(10)
  })

  it('rejects grade 6 and grades 1/2 in string form', () => {
    expect(parseSupportedAcademyGrade('6')).toBeNull()
    expect(parseSupportedAcademyGrade('1')).toBeNull()
    expect(parseSupportedAcademyGrade('2')).toBeNull()
  })

  it('rejects malformed numeric strings', () => {
    expect(parseSupportedAcademyGrade('010')).toBeNull()
    expect(parseSupportedAcademyGrade('10.0')).toBeNull()
    expect(parseSupportedAcademyGrade(' 10')).toBeNull()
    expect(parseSupportedAcademyGrade('10 ')).toBeNull()
    expect(parseSupportedAcademyGrade('grade-10')).toBeNull()
    expect(parseSupportedAcademyGrade('')).toBeNull()
    expect(parseSupportedAcademyGrade('1e1')).toBeNull()
  })

  it('rejects non-string, non-number input', () => {
    expect(parseSupportedAcademyGrade(null)).toBeNull()
    expect(parseSupportedAcademyGrade(undefined)).toBeNull()
    expect(parseSupportedAcademyGrade({})).toBeNull()
    expect(parseSupportedAcademyGrade([10])).toBeNull()
  })
})

describe('gradeLabel', () => {
  it('formats single- and two-digit grades', () => {
    expect(gradeLabel(3)).toBe('Grade 3')
    expect(gradeLabel(10)).toBe('Grade 10')
    expect(gradeLabel(12)).toBe('Grade 12')
  })
})
