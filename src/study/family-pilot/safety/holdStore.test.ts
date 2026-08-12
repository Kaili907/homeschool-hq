import { describe, expect, it } from 'vitest'
import {
  acknowledgeSafetyHold,
  canStudentResume,
  clearSafetyHold,
  createInitialSafetyState,
  createSafetyHold,
  getOpenSafetyHold,
  listOpenSafetyHolds,
  snapshotSafetyState,
} from './holdStore'
import type { CreateSafetyHoldInputV1, FamilyPilotSafetyStateV1 } from './types'

function input(overrides: Partial<CreateSafetyHoldInputV1> = {}): CreateSafetyHoldInputV1 {
  return {
    studentRef: 'student:amelia',
    sessionRef: 'session:1',
    createdAt: '2026-08-12T12:00:00.000Z',
    reasonCode: 'study-safety-urgent',
    source: 'study-safety',
    ...overrides,
  }
}

describe('createSafetyHold', () => {
  it('creates an open hold with stable identifiers', () => {
    const { hold } = createSafetyHold(createInitialSafetyState(), input())
    expect(hold).toMatchObject({
      studentRef: 'student:amelia',
      sessionRef: 'session:1',
      status: 'open',
      reasonCode: 'study-safety-urgent',
      source: 'study-safety',
    })
    expect(hold.holdRef).toBeTruthy()
    expect(hold.createdAt).toBe('2026-08-12T12:00:00.000Z')
  })

  it('is idempotent for a repeated semantic hold while the existing one is still open (requirement 7)', () => {
    const first = createSafetyHold(createInitialSafetyState(), input())
    const second = createSafetyHold(first.state, input({ createdAt: '2026-08-12T12:05:00.000Z' }))
    expect(second.hold.holdRef).toBe(first.hold.holdRef)
    expect(second.state.holds).toHaveLength(1)
  })

  it('creates a fresh hold once the prior semantic hold was cleared', () => {
    const first = createSafetyHold(createInitialSafetyState(), input())
    const cleared = clearSafetyHold(first.state, first.hold.holdRef, { clearedAt: '2026-08-12T12:10:00.000Z', clearedBy: 'parent:dad' })
    const second = createSafetyHold(cleared, input({ createdAt: '2026-08-12T12:20:00.000Z' }))
    expect(second.hold.holdRef).not.toBe(first.hold.holdRef)
    expect(second.state.holds).toHaveLength(2)
  })
})

describe('resume gating', () => {
  it('blocks resume while a hold is open (requirement 2)', () => {
    const { state } = createSafetyHold(createInitialSafetyState(), input())
    expect(canStudentResume(state, 'student:amelia', 'session:1')).toBe(false)
  })

  it('allows resume once explicitly cleared (requirement 4)', () => {
    const { state, hold } = createSafetyHold(createInitialSafetyState(), input())
    const cleared = clearSafetyHold(state, hold.holdRef, { clearedAt: '2026-08-12T12:10:00.000Z', clearedBy: 'parent:dad' })
    expect(canStudentResume(cleared, 'student:amelia', 'session:1')).toBe(true)
    expect(getOpenSafetyHold(cleared, 'student:amelia')).toBeNull()
  })

  it('acknowledging a hold does not itself allow resume', () => {
    const { state, hold } = createSafetyHold(createInitialSafetyState(), input())
    const acknowledged = acknowledgeSafetyHold(state, hold.holdRef, { acknowledgedAt: '2026-08-12T12:01:00.000Z' })
    expect(canStudentResume(acknowledged, 'student:amelia', 'session:1')).toBe(false)
    expect(getOpenSafetyHold(acknowledged, 'student:amelia')?.status).toBe('acknowledged')
  })

  it('throws for an unknown holdRef', () => {
    expect(() => clearSafetyHold(createInitialSafetyState(), 'missing', { clearedAt: 'x', clearedBy: 'parent:dad' })).toThrow()
    expect(() => acknowledgeSafetyHold(createInitialSafetyState(), 'missing', { acknowledgedAt: 'x' })).toThrow()
  })
})

describe('student and session isolation', () => {
  it("student A's hold never blocks student B (requirement 5)", () => {
    const { state } = createSafetyHold(createInitialSafetyState(), input({ studentRef: 'student:amelia' }))
    expect(canStudentResume(state, 'student:beatrice', 'session:1')).toBe(true)
    expect(listOpenSafetyHolds(state, 'student:beatrice')).toHaveLength(0)
  })

  it('two students may independently hold open safety states, remaining separate (requirement 6)', () => {
    const afterA = createSafetyHold(createInitialSafetyState(), input({ studentRef: 'student:amelia', sessionRef: 'session:a' }))
    const afterB = createSafetyHold(afterA.state, input({ studentRef: 'student:beatrice', sessionRef: 'session:b' }))
    expect(canStudentResume(afterB.state, 'student:amelia', 'session:a')).toBe(false)
    expect(canStudentResume(afterB.state, 'student:beatrice', 'session:b')).toBe(false)
    const clearedA = clearSafetyHold(afterB.state, afterA.hold.holdRef, { clearedAt: 't', clearedBy: 'parent:dad' })
    expect(canStudentResume(clearedA, 'student:amelia', 'session:a')).toBe(true)
    expect(canStudentResume(clearedA, 'student:beatrice', 'session:b')).toBe(false)
  })

  it('a stale hold from an old session does not attach to a different student reusing the same sessionRef (requirement 8)', () => {
    const stale = createSafetyHold(createInitialSafetyState(), input({ studentRef: 'student:amelia', sessionRef: 'session:reused' }))
    // A different student later gets assigned the same sessionRef value.
    expect(canStudentResume(stale.state, 'student:beatrice', 'session:reused')).toBe(true)
    expect(getOpenSafetyHold(stale.state, 'student:beatrice')).toBeNull()
  })
})

describe('minimization and immutability', () => {
  it('a hold snapshot contains no raw learner text (requirement 10)', () => {
    const { hold, state } = createSafetyHold(createInitialSafetyState(), input())
    expect(Object.keys(hold).sort()).toEqual(
      ['createdAt', 'dedupeKey', 'holdRef', 'reasonCode', 'schemaVersion', 'sessionRef', 'source', 'status', 'studentRef'].sort(),
    )
    const serialized = JSON.stringify(snapshotSafetyState(state))
    expect(serialized).not.toMatch(/kill myself|hurts me|touched me|transientText/i)
  })

  it('clearing a hold does not touch any other part of state (requirement 12: no unrelated data is deleted)', () => {
    const first = createSafetyHold(createInitialSafetyState(), input({ sessionRef: 'session:1', reasonCode: 'study-safety-urgent' }))
    const second = createSafetyHold(first.state, input({ sessionRef: 'session:2', reasonCode: 'tutor-concerning-content', source: 'tutor-core' }))
    const before: FamilyPilotSafetyStateV1 = JSON.parse(JSON.stringify(second.state))
    const cleared = clearSafetyHold(second.state, second.hold.holdRef, { clearedAt: 't', clearedBy: 'parent:dad' })
    // The input state object itself is untouched (pure function).
    expect(second.state).toEqual(before)
    // Only the targeted hold changed; the other student/session's hold is untouched.
    const untouchedHold = cleared.holds.find((item) => item.holdRef === first.hold.holdRef)
    expect(untouchedHold).toEqual(first.hold)
    expect(cleared.holds).toHaveLength(2)
  })
})
