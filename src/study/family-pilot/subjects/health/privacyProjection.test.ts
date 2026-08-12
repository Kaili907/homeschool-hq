import { describe, expect, it } from 'vitest'
import { getHealthUnit, listHealthLessons } from './lookup'
import {
  HealthPrivacyViolationError,
  assertNoDisallowedHealthFields,
  projectHealthLessonForGuardian,
  projectHealthLessonForStudy,
} from './privacyProjection'
import { loadHealthCatalog } from './rawContent.node'
import type { HealthLesson } from './types'

const catalog = loadHealthCatalog()
const allLessons = catalog.courses.flatMap((course) => course.lessons)

describe('assertNoDisallowedHealthFields — content-integrity guard', () => {
  it('passes for every one of the 108 real Health lessons (no-body-measurement, no-media, no-disclosure paths)', () => {
    expect(allLessons).toHaveLength(108)
    for (const lesson of allLessons) {
      expect(() => assertNoDisallowedHealthFields(lesson)).not.toThrow()
    }
  })

  it('rejects a lesson that requires media', () => {
    const lesson = allLessons[0]
    const withRequiredMedia: HealthLesson = { ...lesson, media: { ...lesson.media, required: true } }
    expect(() => assertNoDisallowedHealthFields(withRequiredMedia)).toThrow(HealthPrivacyViolationError)
  })

  it('rejects a lesson that asks a learner to disclose a body measurement', () => {
    const lesson = allLessons[0]
    const withBodyAsk: HealthLesson = { ...lesson, studentActivity: 'Record your weight and height in the log.' }
    expect(() => assertNoDisallowedHealthFields(withBodyAsk)).toThrow(HealthPrivacyViolationError)
  })

  it('rejects a lesson that asks for a diagnosis or sexual-history disclosure', () => {
    const lesson = allLessons[0]
    const withDiagnosisAsk: HealthLesson = { ...lesson, formativeCheck: 'Have you ever been diagnosed with anything?' }
    expect(() => assertNoDisallowedHealthFields(withDiagnosisAsk)).toThrow(HealthPrivacyViolationError)
  })

  it('rejects a lesson that asks the learner to capture photo/voice/camera media', () => {
    const lesson = allLessons[0]
    const withPhotoAsk: HealthLesson = { ...lesson, extension: 'Take a photo of your example and upload it.' }
    expect(() => assertNoDisallowedHealthFields(withPhotoAsk)).toThrow(HealthPrivacyViolationError)
  })
})

describe('projectHealthLessonForStudy', () => {
  it('never includes body measurements, media requirements, or raw learner text', () => {
    for (const lesson of listHealthLessons(catalog, '5')) {
      const projection = projectHealthLessonForStudy(lesson)
      expect(projection.mediaRequired).toBe(false)
      expect(projection.bodyMeasurementIncluded).toBe(false)
      expect(projection.rawLearnerTextIncluded).toBe(false)
    }
  })

  it('excludes internal scoring guidance and tutor-routing fields from the student-facing projection', () => {
    const lesson = listHealthLessons(catalog, '5')[0]
    const projection = projectHealthLessonForStudy(lesson) as unknown as Record<string, unknown>
    expect(projection.answerOrScoringGuidance).toBeUndefined()
    expect(projection.adaptiveTutorRoutes).toBeUndefined()
  })
})

describe('projectHealthLessonForGuardian', () => {
  it('carries only the curriculum-authored guardian summary and safety markers, never raw learner text', () => {
    const unit = getHealthUnit(catalog, '7', 6)!
    const lesson = listHealthLessons(catalog, '7').find((candidate) => candidate.unitNumber === 6)!
    const projection = projectHealthLessonForGuardian(lesson, unit)
    expect(projection.summary).toBe(lesson.parentOrGuardianVisibility)
    expect(projection.safetyCritical).toBe(true)
    expect(projection.requiresGuardianConfirmation).toBe(true)
    expect(projection.rawLearnerTextIncluded).toBe(false)
  })
})
