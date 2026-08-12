import { describe, expect, it } from 'vitest'
import { getScienceLesson, listScienceLessons } from './catalog'
import { scienceLessonSafetyRequirements } from './safety'
import { loadScienceCatalog } from './source.node'

describe('FAMILY-PILOT-SCIENCE-1 scienceLessonSafetyRequirements', () => {
  const catalog = loadScienceCatalog()
  const lesson = getScienceLesson(catalog, '5', listScienceLessons(catalog, '5')[0].lessonId)!

  it('never requires unsupervised hazardous materials, a learner photo/camera, or voice recording', () => {
    const requirements = scienceLessonSafetyRequirements(lesson)
    expect(requirements.requiresUnsupervisedHazardousMaterials).toBe(false)
    expect(requirements.requiresLearnerPhotoOrCamera).toBe(false)
    expect(requirements.requiresVoiceRecording).toBe(false)
    expect(requirements.mediaRequired).toBe(false)
  })

  it('preserves the source lesson’s guardian-visible safety text rather than stripping it', () => {
    const requirements = scienceLessonSafetyRequirements(lesson)
    expect(requirements.materials).toEqual(lesson.safety.materials)
    expect(requirements.safetyAndPrivacyNotes).toEqual(lesson.safety.safetyAndPrivacy)
    expect(requirements.guardianVisibilitySummary).toBe(lesson.safety.parentOrGuardianVisibility)
    expect(requirements.safetyAndPrivacyNotes.length).toBeGreaterThan(0)
    expect(requirements.guardianVisibilitySummary.length).toBeGreaterThan(0)
  })

  it('provides a functional text-only fallback for when no media is available', () => {
    const requirements = scienceLessonSafetyRequirements(lesson)
    expect(requirements.noMediaFallback).toBe(lesson.safety.noMediaFallback)
    expect(requirements.noMediaFallback.length).toBeGreaterThan(0)
  })

  it('reports multi-occasion mastery for the frozen course’s mastery_rule text', () => {
    const requirements = scienceLessonSafetyRequirements(lesson)
    expect(requirements.masteryRequiresMultipleOccasions).toBe(true)
  })

  it('carries the lessonId and holds these guarantees for every lesson across every grade', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const ref of listScienceLessons(catalog, grade)) {
        const detail = getScienceLesson(catalog, grade, ref.lessonId)!
        const requirements = scienceLessonSafetyRequirements(detail)
        expect(requirements.lessonId).toBe(detail.lessonId)
        expect(requirements.requiresUnsupervisedHazardousMaterials).toBe(false)
        expect(requirements.requiresLearnerPhotoOrCamera).toBe(false)
        expect(requirements.requiresVoiceRecording).toBe(false)
        expect(requirements.mediaRequired).toBe(false)
        expect(requirements.masteryRequiresMultipleOccasions).toBe(true)
        expect(requirements.safetyAndPrivacyNotes.length).toBeGreaterThan(0)
      }
    }
  })
})
