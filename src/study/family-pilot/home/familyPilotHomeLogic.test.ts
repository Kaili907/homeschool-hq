import { describe, expect, it } from 'vitest'
import { resolveHomeAssignmentAction, simpleProgressPercent } from './familyPilotHomeLogic'

describe('resolveHomeAssignmentAction', () => {
  it('offers Start for a not-started assignment', () => {
    expect(resolveHomeAssignmentAction({ status: 'not-started' })).toBe('start')
  })

  it('offers Resume for an in-progress assignment', () => {
    expect(resolveHomeAssignmentAction({ status: 'in-progress' })).toBe('resume')
  })

  it('offers no action for a completed assignment', () => {
    expect(resolveHomeAssignmentAction({ status: 'completed' })).toBeNull()
  })
})

describe('simpleProgressPercent', () => {
  it('is 0 when nothing is assigned today', () => {
    expect(simpleProgressPercent(0, 0)).toBe(0)
  })

  it('rounds to the nearest whole percent', () => {
    expect(simpleProgressPercent(1, 3)).toBe(33)
  })

  it('is 100 once every assignment is complete', () => {
    expect(simpleProgressPercent(4, 4)).toBe(100)
  })

  it('clamps a completed count above the total', () => {
    expect(simpleProgressPercent(9, 4)).toBe(100)
  })

  it('clamps a negative completed count', () => {
    expect(simpleProgressPercent(-2, 4)).toBe(0)
  })
})
