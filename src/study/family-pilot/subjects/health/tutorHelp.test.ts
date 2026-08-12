import { describe, expect, it } from 'vitest'
import { getHealthUnit, listHealthLessons } from './lookup'
import { loadHealthCatalog } from './rawContent.node'
import { healthCanHelp, healthStaticHelp, healthTutorGuidanceForSignal } from './tutorHelp'

const catalog = loadHealthCatalog()

// Targeted at diagnostic *claims directed at the learner* — not at the
// curriculum's own safe, arms-length topic mentions (e.g. a lesson focus of
// "anxiety and depression literacy without diagnosis" is exactly the
// non-clinician framing this boundary requires, so it must not trip these).
const DIAGNOSTIC_LANGUAGE_PATTERNS: readonly RegExp[] = [
  /you (have|are showing signs of|might have|are diagnosed)/i,
  /diagnosed with/i,
  /your diagnosis/i,
  /you (have|might have) (a|an) (disorder|condition)/i,
  /it sounds like you/i,
]

describe('healthCanHelp', () => {
  it('always resolves to static-fallback — Health has no path to a grading or clinical tutor', () => {
    // healthCanHelp takes no learner-derived input at all: there is nothing
    // for a "clinician" decision to be inferred from.
    expect(healthCanHelp()).toEqual({
      path: 'static-fallback',
      reason: 'Health uses curriculum-grounded static help only; it never routes to a grading or clinical tutor.',
    })
  })
})

describe('healthStaticHelp — tutor fallback, no diagnostic inference', () => {
  it('is available for every lesson in the catalog and never uses diagnostic language', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const unit = getHealthUnit(catalog, lesson.grade, lesson.unitNumber)!
        const message = healthStaticHelp({ lesson, unit })
        expect(message.length).toBeGreaterThan(0)
        for (const pattern of DIAGNOSTIC_LANGUAGE_PATTERNS) {
          expect(message, `${lesson.lessonId}: "${message}"`).not.toMatch(pattern)
        }
      }
    }
  })

  it('appends a trusted-adult nudge for safety-critical units and omits it otherwise', () => {
    const safetyCriticalUnit = getHealthUnit(catalog, '7', 6)! // Sexual Health, Safety, and Community Wellbeing
    const safetyCriticalLesson = listHealthLessons(catalog, '7').find((l) => l.unitNumber === 6)!
    expect(healthStaticHelp({ lesson: safetyCriticalLesson, unit: safetyCriticalUnit })).toContain('trusted adult')

    const otherUnit = getHealthUnit(catalog, '8', 2)! // Nutrition/Movement/Sleep, not flagged safety-critical
    const otherLesson = listHealthLessons(catalog, '8').find((l) => l.unitNumber === 2)!
    expect(healthStaticHelp({ lesson: otherLesson, unit: otherUnit })).not.toContain('trusted adult')
  })

  it('has no parameter for learner free text — the signal for "help" comes only from lesson/unit content', () => {
    expect(healthStaticHelp.length).toBe(1) // one destructured { lesson, unit } argument only
  })
})

describe('healthTutorGuidanceForSignal', () => {
  it('returns the curriculum’s own adaptive-tutor-route action for a known signal', () => {
    const lesson = listHealthLessons(catalog, '5')[0]
    const guidance = healthTutorGuidanceForSignal(lesson, 'prerequisite gap')
    expect(guidance).toBe(lesson.adaptiveTutorRoutes.find((route) => route.signal === 'prerequisite gap')?.action)
    expect(guidance).not.toBeNull()
  })

  it('returns null for a signal the lesson has no route for, instead of guessing', () => {
    const lesson = listHealthLessons(catalog, '5')[0]
    const guidance = healthTutorGuidanceForSignal(lesson, 'an unmodeled signal' as never)
    expect(guidance).toBeNull()
  })

  it('takes no learner-text parameter — only a fixed signal enum selected by the caller', () => {
    expect(healthTutorGuidanceForSignal.length).toBe(2)
  })
})
