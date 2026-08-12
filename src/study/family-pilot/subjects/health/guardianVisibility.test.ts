import { describe, expect, it } from 'vitest'
import { deriveGuardianVisibility, isSafetyCriticalUnit } from './guardianVisibility'
import { getHealthLesson, getHealthUnit, listHealthUnits } from './lookup'
import { loadHealthCatalog } from './rawContent.node'

const catalog = loadHealthCatalog()

describe('isSafetyCriticalUnit', () => {
  it('flags units covering trusted-support, boundaries/consent, substances, or sexual health', () => {
    const flaggedTitles = [
      ['5', 1] as const, // Whole-Person Wellbeing and Trusted Support
      ['5', 4] as const, // Relationships, Communication, and Consent Foundations
      ['5', 6] as const, // Safety, Decisions, and Community Health
      ['7', 4] as const, // Relationships, Consent, and Communication
      ['7', 5] as const, // Substance, Medication, and Risk-Reduction Skills
      ['7', 6] as const, // Sexual Health, Safety, and Community Wellbeing
      ['8', 4] as const, // Healthy Relationships, Consent, and Digital Boundaries
      ['8', 5] as const, // Substance Use, Medication, and Harm Prevention
      ['8', 6] as const, // Sexual Health, Disease Prevention, and Community Action
    ]
    for (const [grade, unitNumber] of flaggedTitles) {
      const unit = getHealthUnit(catalog, grade, unitNumber)!
      expect(isSafetyCriticalUnit(unit), `grade ${grade} unit ${unitNumber} (${unit.title})`).toBe(true)
    }
  })

  it('does not flag a unit with no safety/consent/substance/crisis topic', () => {
    // Grade 8 Unit 2: Nutrition, Movement, Sleep, and Performance Without Diet Culture
    const unit = getHealthUnit(catalog, '8', 2)!
    expect(isSafetyCriticalUnit(unit)).toBe(false)
  })

  it('every safety-critical unit across the catalog requires guardian confirmation on its lessons', () => {
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        if (!isSafetyCriticalUnit(unit)) continue
        const lesson = getHealthLesson(catalog, unit.lessonIds[0])!
        const visibility = deriveGuardianVisibility(lesson, unit)
        expect(visibility.safetyCritical).toBe(true)
        expect(visibility.requiresGuardianConfirmation).toBe(true)
      }
    }
  })
})

describe('deriveGuardianVisibility', () => {
  it('carries the lesson’s own guardian-visibility text and never learner text', () => {
    const unit = getHealthUnit(catalog, '5', 1)!
    const lesson = getHealthLesson(catalog, unit.lessonIds[0])!
    const visibility = deriveGuardianVisibility(lesson, unit)
    expect(visibility.lessonId).toBe(lesson.lessonId)
    expect(visibility.unitId).toBe(unit.unitId)
    expect(visibility.summary).toBe(lesson.parentOrGuardianVisibility)
    expect(Object.keys(visibility).sort()).toEqual(
      ['lessonId', 'requiresGuardianConfirmation', 'safetyCritical', 'summary', 'unitId'].sort(),
    )
  })

  it('marks every unit in the catalog as safety-critical or not — no undefined outcomes', () => {
    for (const course of catalog.courses) {
      for (const unit of listHealthUnits(catalog, course.grade)) {
        expect(typeof isSafetyCriticalUnit(unit)).toBe('boolean')
      }
    }
  })
})
