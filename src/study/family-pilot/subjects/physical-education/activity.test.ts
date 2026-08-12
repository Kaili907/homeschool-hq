import { describe, expect, it } from 'vitest'
import { toActivity } from './activity'
import { listLessonsForGrade } from './catalog'
import { loadPhysicalEducationCatalog } from './curriculumSource.node'

const catalog = loadPhysicalEducationCatalog()
const BODY_METRIC_TERMS = ['body fat', 'body-fat', 'bmi', 'body mass index', 'weigh-in', 'body weight measurement']

describe('activity/task representation', () => {
  it('never requires media, body measurement, or public performance for any lesson', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of listLessonsForGrade(catalog, grade)) {
        const activity = toActivity(lesson)
        expect(activity.requiresMediaProof).toBe(false)
        expect(activity.requiresBodyMeasurement).toBe(false)
        expect(activity.requiresPublicPerformance).toBe(false)
      }
    }
  })

  it('retains a non-empty set of accessible/adapted movement alternatives for every lesson', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of listLessonsForGrade(catalog, grade)) {
        const activity = toActivity(lesson)
        expect(activity.accessibleAlternatives.length).toBeGreaterThan(0)
        expect(activity.accessibleAlternatives).toEqual(lesson.accessibilityAndAccommodations)
      }
    }
  })

  it('carries safety markers through unmodified', () => {
    const lesson = listLessonsForGrade(catalog, '5')[0]
    const activity = toActivity(lesson)
    expect(activity.safetyMarkers).toEqual(lesson.safetyAndPrivacy)
    expect(activity.safetyMarkers.length).toBeGreaterThan(0)
  })

  it('never mentions a body-measurement metric anywhere in the activity representation', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of listLessonsForGrade(catalog, grade)) {
        const activity = toActivity(lesson)
        const blob = JSON.stringify(activity).toLowerCase()
        for (const term of BODY_METRIC_TERMS) {
          expect(blob).not.toContain(term)
        }
      }
    }
  })

  it('represents phases from the lesson flow without any question/answer field', () => {
    const lesson = listLessonsForGrade(catalog, '5')[0]
    const activity = toActivity(lesson)
    expect(activity.phases.length).toBe(lesson.lessonFlow.length)
    for (const phase of activity.phases) {
      expect(phase).not.toHaveProperty('answer')
      expect(phase).not.toHaveProperty('correctAnswer')
      expect(phase).not.toHaveProperty('score')
    }
  })
})
