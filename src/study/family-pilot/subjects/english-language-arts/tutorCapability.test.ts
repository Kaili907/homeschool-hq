import { describe, expect, it } from 'vitest'
import type { StudyScope } from '../../../types'
import type { FamilyPilotHelpContext } from '../../tutor/types'
import { getElaTutorCapability } from './tutorCapability'

const scope: StudyScope = { householdRef: 'household:1', learnerRef: 'learner:a', sessionRef: 'session:1' }

function readingContext(overrides: Partial<FamilyPilotHelpContext> = {}): FamilyPilotHelpContext {
  return { scope, subject: 'reading', grade: 5, noAudio: false, mediaAvailable: true, ...overrides }
}

describe('getElaTutorCapability', () => {
  it('never blocks the lesson: a reading segment always resolves to a usable help path', () => {
    const eligibility = getElaTutorCapability(readingContext())
    expect(['tutor-core', 'static-fallback']).toContain(eligibility.path)
  })

  it('routes reading segments to the static fallback with a subject-specific, non-empty reason', () => {
    const eligibility = getElaTutorCapability(readingContext())
    expect(eligibility.path).toBe('static-fallback')
    expect(eligibility.reason.length).toBeGreaterThan(0)
  })

  it('routes writing segments to the static fallback the same way', () => {
    const eligibility = getElaTutorCapability(readingContext({ subject: 'writing' }))
    expect(eligibility.path).toBe('static-fallback')
  })

  it('never claims tutor-core eligibility for ELA even when a math-shaped problem field is present', () => {
    // Guards against a future canHelp change accidentally treating ELA like math
    // by way of a leftover `problem` field on the shared context type.
    const eligibility = getElaTutorCapability(
      readingContext({ problem: { prompt: '2 + 2 = ?', correctAnswer: '4', studentAnswer: '4' } }),
    )
    expect(eligibility.path).toBe('static-fallback')
  })
})
