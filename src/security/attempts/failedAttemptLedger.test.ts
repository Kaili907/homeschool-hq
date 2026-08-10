import { describe, expect, it } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import {
  FAILED_ATTEMPT_LOCK_PREFIX,
  FAILED_ATTEMPT_POLICY,
  FAILED_ATTEMPT_STORAGE_PREFIX,
  FailedAttemptLedger,
  failedAttemptLockName,
  type AttemptLockManager,
  type FailedAttemptStatus,
  type FailedAttemptSubject,
} from './failedAttemptLedger'
import type { SecurityStorage } from '../session/runtime'

const START = Date.parse('2026-08-09T12:00:00.000Z')
const P1 = parseProfileId('p1')!
const P2 = parseProfileId('p2')!

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

class SerialAttemptLockManager implements AttemptLockManager {
  readonly names: string[] = []
  readonly #tails = new Map<string, Promise<void>>()

  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T> {
    this.names.push(name)
    const tail = this.#tails.get(name) ?? Promise.resolve()
    const result = tail.then(callback)
    this.#tails.set(name, result.then(() => undefined, () => undefined))
    return result
  }
}

function setup() {
  const storage = new MemoryStorage()
  const locks = new SerialAttemptLockManager()
  let now = START
  const ledger = new FailedAttemptLedger({ storage, clock: () => now, lockManager: locks })
  return {
    ledger,
    storage,
    locks,
    now: () => now,
    setNow: (value: number) => { now = value },
    advance: (ms: number) => { now += ms },
  }
}

async function failureCycle(
  ledger: FailedAttemptLedger,
  subject: FailedAttemptSubject,
  advance: (ms: number) => void,
  attempts = 10,
): Promise<FailedAttemptStatus[]> {
  const results: FailedAttemptStatus[] = []
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await ledger.recordFailure(subject)
    results.push(result)
    if (result.status === 'cooldown') advance(result.remainingMs)
  }
  return results
}

describe('failed PIN attempt ledger', () => {
  it('implements the approved progressive learner schedule', async () => {
    const runtime = setup()
    const subject = { kind: 'learner' as const, profileId: P1 }
    const results = await failureCycle(runtime.ledger, subject, runtime.advance)

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
    expect([...runtime.storage.values.keys()]).toEqual([
      `${FAILED_ATTEMPT_STORAGE_PREFIX}learner:p1`,
    ])
    expect([...runtime.storage.values.values()].join(' ')).not.toMatch(/pin|verifier|secret|1234/i)
  })

  it('uses unambiguous credential, authority, scope, and encoded-subject lock names', async () => {
    const runtime = setup()
    const learner = { kind: 'learner' as const, profileId: P1 }
    const parent = { kind: 'parent' as const, householdId: 'p1' }

    await Promise.all([runtime.ledger.status(learner), runtime.ledger.status(parent)])

    expect(new Set(runtime.locks.names).size).toBe(2)
    expect(runtime.locks.names).toEqual([
      failedAttemptLockName(learner),
      failedAttemptLockName(parent),
    ])
    expect(runtime.locks.names.every((name) => name.startsWith(FAILED_ATTEMPT_LOCK_PREFIX))).toBe(true)
    expect(failedAttemptLockName(learner)).toContain('pin:learner:profile:')
    expect(failedAttemptLockName(parent)).toContain('pin:parent:household:')
    expect(() => failedAttemptLockName(
      { kind: 'learner', profileId: 'bad\nsubject' } as unknown as FailedAttemptSubject,
    )).toThrow('invalid')
  })

  it.each([' p1', 'P1', 'p6', '😀'])('rejects a noncanonical learner attempt subject: %s', (profileId) => {
    expect(() => failedAttemptLockName(
      { kind: 'learner', profileId } as unknown as FailedAttemptSubject,
    )).toThrow('invalid')
  })

  it('keeps learner and Parent counters separate and applies the Parent lock duration', async () => {
    const runtime = setup()
    const learner = { kind: 'learner' as const, profileId: P1 }
    const parent = { kind: 'parent' as const, householdId: 'p1' }

    await runtime.ledger.recordFailure(learner)
    await expect(runtime.ledger.status(parent)).resolves.toEqual({ status: 'ready', failedAttempts: 0 })
    const parentResults = await failureCycle(runtime.ledger, parent, runtime.advance)
    expect(parentResults[9]).toMatchObject({
      status: 'temporarily-locked',
      remainingMs: FAILED_ATTEMPT_POLICY.temporaryLockMs.parent,
    })
  })

  it('allows another attempt after normal lock expiry without erasing history', async () => {
    const runtime = setup()
    const subject = { kind: 'learner' as const, profileId: P1 }
    await failureCycle(runtime.ledger, subject, runtime.advance)

    runtime.advance(FAILED_ATTEMPT_POLICY.temporaryLockMs.learner)

    await expect(runtime.ledger.status(subject)).resolves.toEqual({ status: 'ready', failedAttempts: 10 })
    await expect(runtime.ledger.recordFailure(subject)).resolves.toMatchObject({
      status: 'temporarily-locked',
      failedAttempts: 11,
    })
  })

  it('serializes two concurrent failures without losing either increment', async () => {
    const storage = new MemoryStorage()
    const locks = new SerialAttemptLockManager()
    const subject = { kind: 'learner' as const, profileId: P1 }
    const first = new FailedAttemptLedger({ storage, clock: () => START, lockManager: locks })
    const second = new FailedAttemptLedger({ storage, clock: () => START, lockManager: locks })

    const results = await Promise.all([first.recordFailure(subject), second.recordFailure(subject)])

    expect(results.map((result) => result.failedAttempts)).toEqual([1, 2])
    await expect(first.status(subject)).resolves.toEqual({ status: 'ready', failedAttempts: 2 })
  })

  it('applies the stronger final policy when concurrent failures cross the lock threshold', async () => {
    const runtime = setup()
    const subject = { kind: 'learner' as const, profileId: P2 }
    await failureCycle(runtime.ledger, subject, runtime.advance, 8)
    const second = new FailedAttemptLedger({
      storage: runtime.storage,
      clock: runtime.now,
      lockManager: runtime.locks,
    })

    const results = await Promise.all([
      runtime.ledger.recordFailure(subject),
      second.recordFailure(subject),
    ])

    expect(results[0]).toMatchObject({ status: 'cooldown', failedAttempts: 9, remainingMs: 60_000 })
    expect(results[1]).toMatchObject({
      status: 'temporarily-locked',
      failedAttempts: 10,
      remainingMs: FAILED_ATTEMPT_POLICY.temporaryLockMs.learner,
    })
    await expect(runtime.ledger.status(subject)).resolves.toMatchObject({
      status: 'temporarily-locked',
      failedAttempts: 10,
    })
  })

  it('does not let an earlier concurrent observer overwrite maxObservedAt', async () => {
    const storage = new MemoryStorage()
    const locks = new SerialAttemptLockManager()
    const subject = { kind: 'learner' as const, profileId: P2 }
    const initial = new FailedAttemptLedger({ storage, clock: () => START, lockManager: locks })
    await initial.recordFailure(subject)
    const later = new FailedAttemptLedger({ storage, clock: () => START + 10_000, lockManager: locks })
    const earlier = new FailedAttemptLedger({ storage, clock: () => START + 5_000, lockManager: locks })

    const laterStatus = later.status(subject)
    const earlierStatus = earlier.status(subject)

    await expect(laterStatus).resolves.toEqual({ status: 'ready', failedAttempts: 1 })
    await expect(earlierStatus).resolves.toEqual({ status: 'ledger-invalid', failedAttempts: 1 })
    expect([...storage.values.values()].join(' ')).toContain('2026-08-09T12:00:10.000Z')
  })

  it('serializes success/failure races according to operation ordering', async () => {
    const subject = { kind: 'parent' as const, householdId: 'household-race' }

    const failureFirst = setup()
    await Promise.all([
      failureFirst.ledger.recordFailure(subject),
      failureFirst.ledger.recordSuccess(subject),
    ])
    await expect(failureFirst.ledger.status(subject)).resolves.toEqual({ status: 'ready', failedAttempts: 0 })

    const successFirst = setup()
    await Promise.all([
      successFirst.ledger.recordSuccess(subject),
      successFirst.ledger.recordFailure(subject),
    ])
    await expect(successFirst.ledger.status(subject)).resolves.toEqual({ status: 'ready', failedAttempts: 1 })
  })

  it('persists a forward observation and fails closed after rollback', async () => {
    const runtime = setup()
    const subject = { kind: 'learner' as const, profileId: P1 }
    await failureCycle(runtime.ledger, subject, runtime.advance)
    const beforeJump = runtime.now()

    runtime.advance(365 * 24 * 60 * 60 * 1_000)
    await expect(runtime.ledger.status(subject)).resolves.toEqual({ status: 'ready', failedAttempts: 10 })
    runtime.setNow(beforeJump + FAILED_ATTEMPT_POLICY.temporaryLockMs.learner + 1)

    await expect(runtime.ledger.status(subject)).resolves.toEqual({ status: 'ledger-invalid', failedAttempts: 10 })
    await expect(runtime.ledger.recordFailure(subject)).resolves.toEqual({ status: 'ledger-invalid', failedAttempts: 10 })
    await expect(runtime.ledger.recordSuccess(subject)).rejects.toThrow('ledger is invalid')
  })

  it('reconstructs from persisted state after sleep and preserves lock and rollback protection', async () => {
    const storage = new MemoryStorage()
    const locks = new SerialAttemptLockManager()
    const subject = { kind: 'parent' as const, householdId: 'household-sleep' }
    let now = START
    {
      const original = new FailedAttemptLedger({ storage, clock: () => now, lockManager: locks })
      await failureCycle(original, subject, (ms) => { now += ms })
    }

    const lockedAt = now
    now += FAILED_ATTEMPT_POLICY.temporaryLockMs.parent + 1
    const restored = new FailedAttemptLedger({ storage, clock: () => now, lockManager: locks })
    await expect(restored.status(subject)).resolves.toEqual({ status: 'ready', failedAttempts: 10 })

    now = lockedAt + FAILED_ATTEMPT_POLICY.temporaryLockMs.parent
    const rolledBackAfterRestore = new FailedAttemptLedger({ storage, clock: () => now, lockManager: locks })
    await expect(rolledBackAfterRestore.status(subject)).resolves.toEqual({
      status: 'ledger-invalid',
      failedAttempts: 10,
    })
  })

  it('resets all failure state after a successful attempt', async () => {
    const runtime = setup()
    const subject = { kind: 'parent' as const, householdId: 'household-a' }
    await runtime.ledger.recordFailure(subject)
    await runtime.ledger.recordFailure(subject)
    await expect(runtime.ledger.status(subject)).resolves.toEqual({ status: 'ready', failedAttempts: 2 })

    await runtime.ledger.recordSuccess(subject)

    await expect(runtime.ledger.status(subject)).resolves.toEqual({ status: 'ready', failedAttempts: 0 })
  })

  it('fails closed instead of using an unlocked fallback', async () => {
    const ledger = new FailedAttemptLedger({ storage: new MemoryStorage(), clock: () => START })
    const subject = { kind: 'learner' as const, profileId: P1 }

    await expect(ledger.status(subject)).rejects.toThrow('coordination is unavailable')
    await expect(ledger.recordFailure(subject)).rejects.toThrow('coordination is unavailable')
    await expect(ledger.recordSuccess(subject)).rejects.toThrow('coordination is unavailable')
  })
})
