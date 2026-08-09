import { describe, expect, it } from 'vitest'
import {
  FAILED_ATTEMPT_POLICY,
  FailedAttemptLedger,
  type FailedAttemptStatus,
  type FailedAttemptSubject,
} from './failedAttemptLedger'
import type { SecurityStorage } from '../session/runtime'

const START = Date.parse('2026-08-09T12:00:00.000Z')

class MemoryStorage implements SecurityStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function setup() {
  const storage = new MemoryStorage()
  let now = START
  const ledger = new FailedAttemptLedger({ storage, clock: () => now })
  return {
    ledger,
    storage,
    advance: (ms: number) => { now += ms },
  }
}

function failureCycle(
  ledger: FailedAttemptLedger,
  subject: FailedAttemptSubject,
  advance: (ms: number) => void,
  attempts = 10,
): FailedAttemptStatus[] {
  const results: FailedAttemptStatus[] = []
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = ledger.recordFailure(subject)
    results.push(result)
    if (result.status === 'cooldown') advance(result.remainingMs)
  }
  return results
}

describe('failed PIN attempt ledger', () => {
  it('implements the approved progressive learner schedule', () => {
    const runtime = setup()
    const subject = { kind: 'learner' as const, profileId: 'learner-a' }
    const results = failureCycle(runtime.ledger, subject, runtime.advance)

    expect(results.map((result) => result.status)).toEqual([
      'ready',
      'ready',
      'cooldown',
      'cooldown',
      'cooldown',
      'cooldown',
      'cooldown',
      'cooldown',
      'cooldown',
      'temporarily-locked',
    ])
    expect(results.map((result) => result.status === 'cooldown' ? result.remainingMs : 0)).toEqual([
      0, 0, 5_000, 15_000, 30_000, 60_000, 60_000, 60_000, 60_000, 0,
    ])
    expect(results[9]).toMatchObject({
      status: 'temporarily-locked',
      failedAttempts: 10,
      remainingMs: FAILED_ATTEMPT_POLICY.temporaryLockMs.learner,
    })
    expect([...runtime.storage.values.values()].join(' ')).not.toMatch(/pin|verifier|secret|1234/i)
  })

  it('keeps learner and Parent counters separate and applies the Parent lock duration', () => {
    const runtime = setup()
    const learner = { kind: 'learner' as const, profileId: 'same-visible-id' }
    const parent = { kind: 'parent' as const, householdId: 'same-visible-id' }

    runtime.ledger.recordFailure(learner)
    expect(runtime.ledger.status(parent)).toEqual({ status: 'ready', failedAttempts: 0 })
    const parentResults = failureCycle(runtime.ledger, parent, runtime.advance)
    expect(parentResults[9]).toMatchObject({
      status: 'temporarily-locked',
      remainingMs: FAILED_ATTEMPT_POLICY.temporaryLockMs.parent,
    })
  })

  it('allows a fresh cycle after the temporary learner lock expires', () => {
    const runtime = setup()
    const subject = { kind: 'learner' as const, profileId: 'learner-a' }
    failureCycle(runtime.ledger, subject, runtime.advance)

    runtime.advance(FAILED_ATTEMPT_POLICY.temporaryLockMs.learner)

    expect(runtime.ledger.status(subject)).toEqual({ status: 'ready', failedAttempts: 0 })
    expect(runtime.ledger.recordFailure(subject)).toEqual({ status: 'ready', failedAttempts: 1 })
  })

  it('resets all failure state after a successful attempt', () => {
    const runtime = setup()
    const subject = { kind: 'parent' as const, householdId: 'household-a' }
    runtime.ledger.recordFailure(subject)
    runtime.ledger.recordFailure(subject)
    expect(runtime.ledger.status(subject)).toEqual({ status: 'ready', failedAttempts: 2 })

    runtime.ledger.recordSuccess(subject)

    expect(runtime.ledger.status(subject)).toEqual({ status: 'ready', failedAttempts: 0 })
  })
})
