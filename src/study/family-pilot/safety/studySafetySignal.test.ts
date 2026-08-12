import { describe, expect, it } from 'vitest'
import { canStudentResume, createInitialSafetyState, createSafetyHold } from './holdStore'
import { safetyHoldInputFromStudySafetyClassification } from './studySafetySignal'

describe('Study Safety classification signal conversion', () => {
  it.each(['urgent', 'uncertain'] as const)('converts a %s classification into a hold that blocks resume', (classification) => {
    const holdInput = safetyHoldInputFromStudySafetyClassification({
      studentRef: 'student:amelia',
      sessionRef: 'session:1',
      classification,
      occurredAt: '2026-08-12T12:00:00.000Z',
    })
    expect(holdInput?.reasonCode).toBe(classification === 'urgent' ? 'study-safety-urgent' : 'study-safety-uncertain')
    const { state } = createSafetyHold(createInitialSafetyState(), holdInput!)
    expect(canStudentResume(state, 'student:amelia', 'session:1')).toBe(false)
  })

  it.each(['clear', 'invalid'] as const)('produces no hold input for a %s classification', (classification) => {
    expect(safetyHoldInputFromStudySafetyClassification({
      studentRef: 'student:amelia',
      sessionRef: 'session:1',
      classification,
      occurredAt: '2026-08-12T12:00:00.000Z',
    })).toBeNull()
  })
})
