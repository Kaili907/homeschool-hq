import { describe, expect, it } from 'vitest'
import { canStudentResume, createInitialSafetyState, createSafetyHold } from './holdStore'
import { safetyHoldInputFromTutorConcerningSignal } from './tutorSignal'

describe('Tutor concerning-content signal conversion (requirement 11)', () => {
  it('converts a concerning Tutor signal into a minimized safety hold that blocks resume', () => {
    const holdInput = safetyHoldInputFromTutorConcerningSignal({
      studentRef: 'student:amelia',
      sessionRef: 'session:1',
      concerning: true,
      occurredAt: '2026-08-12T12:00:00.000Z',
    })
    expect(holdInput).toEqual({
      studentRef: 'student:amelia',
      sessionRef: 'session:1',
      createdAt: '2026-08-12T12:00:00.000Z',
      reasonCode: 'tutor-concerning-content',
      source: 'tutor-core',
    })
    const { state } = createSafetyHold(createInitialSafetyState(), holdInput!)
    expect(canStudentResume(state, 'student:amelia', 'session:1')).toBe(false)
  })

  it('produces no hold input when the Tutor signal is not concerning', () => {
    const holdInput = safetyHoldInputFromTutorConcerningSignal({
      studentRef: 'student:amelia',
      sessionRef: 'session:1',
      concerning: false,
      occurredAt: '2026-08-12T12:00:00.000Z',
    })
    expect(holdInput).toBeNull()
  })
})
