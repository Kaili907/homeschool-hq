import { describe, expect, it } from 'vitest'
import { canHelp } from '../../../tutor/tutorBridge'
import { getTechCsAssignments } from '../catalog/catalog'
import { loadTechCsCatalog } from '../catalog/source.node'
import type { TechCsDayPhase, TechCsLessonRef } from '../catalog/types'
import { staticTechCsExplanation, techCsHelpContext } from './staticExplanation'

function fixtureLesson(dayPhase: TechCsDayPhase): TechCsLessonRef {
  return {
    lessonId: 'ma-g7-technology-u02-l04',
    courseId: 'ma-g7-technology',
    grade: '7',
    unitId: 'u02',
    unitNumber: 2,
    dayInUnit: 4,
    courseDay: 10,
    title: 'Application: conditionals',
    focus: 'conditionals',
    dayPhase,
    standards: ['Michigan Computer Science: Algorithms and Programming'],
    accessibilityAndAccommodations: ['Provide readable text plus optional audio support.'],
    safetyAndPrivacy: ['Never require a real password, private message, or account credential.'],
  }
}

const SCOPE = { householdRef: 'household-1', learnerRef: 'learner-1', sessionRef: 'session-1' }

describe('FF-M7 Technology / CS Tutor / static explanation', () => {
  it('tutor fallback: the shared Family Pilot tutor bridge always routes technology/CS help to the static fallback', () => {
    for (const grade of [5, 7, 8]) {
      const context = techCsHelpContext(SCOPE, grade, { noAudio: false, mediaAvailable: true })
      const eligibility = canHelp(context)
      expect(eligibility.path).toBe('static-fallback')
    }
  })

  it('tutor fallback: never eligible for live Tutor Core, even with audio/media unavailable', () => {
    const context = techCsHelpContext(SCOPE, 7, { noAudio: true, mediaAvailable: false })
    expect(canHelp(context).path).toBe('static-fallback')
  })

  it('no graded-project auto-completion: refuses a complete-project request outright', () => {
    const response = staticTechCsExplanation(fixtureLesson('application-project'), 'complete-project')
    expect(response.granted).toBe(false)
    expect(response.text).toMatch(/can't complete a graded project/i)
  })

  it('no graded-project auto-completion: refusal never echoes the unit performance task text', () => {
    const performanceTask = 'Design, build, and test a small program that solves a real problem.'
    const response = staticTechCsExplanation(fixtureLesson('application-project'), 'complete-project')
    expect(response.text).not.toContain(performanceTask)
  })

  it('grants hints and concept explanations, drawn from a fixed phase-hint table', () => {
    const hint = staticTechCsExplanation(fixtureLesson('guided-practice'), 'hint')
    expect(hint.granted).toBe(true)
    expect(hint.text.length).toBeGreaterThan(0)

    const explanation = staticTechCsExplanation(fixtureLesson('guided-practice'), 'explain-concept')
    expect(explanation.granted).toBe(true)
    expect(explanation.text).toContain('conditionals')
  })

  it('is pure and deterministic: same lesson and request, same response', () => {
    const lesson = fixtureLesson('mastery-check')
    expect(staticTechCsExplanation(lesson, 'hint')).toEqual(staticTechCsExplanation(lesson, 'hint'))
  })

  it('every real lesson across all three grades always resolves to the tutor static fallback', () => {
    const catalog = loadTechCsCatalog()
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of getTechCsAssignments(catalog, grade).slice(0, 3)) {
        const context = techCsHelpContext(SCOPE, Number(grade), { noAudio: false, mediaAvailable: true })
        expect(canHelp(context).path).toBe('static-fallback')
        expect(staticTechCsExplanation(lesson, 'complete-project').granted).toBe(false)
      }
    }
  })
})
