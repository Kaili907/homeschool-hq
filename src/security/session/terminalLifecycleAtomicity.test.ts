import { describe, expect, it } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import { LearnerSessionController, LEARNER_SESSION_STORAGE_KEY } from './learnerSession'
import {
  GLOBAL_REVOCATION_EXHAUSTED_EPOCH,
  type GlobalRevocationCause,
  type GlobalRevocationListener,
  type GlobalRevocationNotice,
  type GlobalRevocationObservation,
  type GlobalRevocationSource,
} from './revocation'
import type { SecurityStorage } from './runtime'
import type {
  LearnerSessionOwnershipLock,
  LearnerSessionOwnershipLockManager,
} from './learnerSession'

const START = Date.parse('2026-08-09T12:00:00.000Z')
const UUID_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const P1 = parseProfileId('p1')!

class MemoryStorage implements SecurityStorage {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

class OwnershipLocks implements LearnerSessionOwnershipLockManager {
  #held = new Set<string>()
  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LearnerSessionOwnershipLock | null) => T | Promise<T>,
  ): Promise<T> {
    if (this.#held.has(name)) return Promise.resolve(callback(null))
    this.#held.add(name)
    return Promise.resolve(callback({ name })).finally(() => { this.#held.delete(name) })
  }
}

function notice(
  cause: GlobalRevocationCause,
  epoch: number,
  occurredAt = new Date(START + 30_000).toISOString(),
): GlobalRevocationNotice {
  return Object.freeze({ schemaVersion: 1, epoch, cause, occurredAt })
}

/**
 * A revocation source the test drives directly. `observe` publishes a new
 * durable observation WITHOUT notifying subscribers, which is exactly the
 * poll/browser race: this tab reads the exhausted epoch before — or instead of
 * — receiving the in-process notice.
 */
class ScriptedRevocation implements GlobalRevocationSource {
  readonly #listeners = new Set<GlobalRevocationListener>()
  #observation: GlobalRevocationObservation | null = Object.freeze({ epoch: 0, notice: null })

  currentRevocation(): GlobalRevocationObservation | null { return this.#observation }
  currentEpoch(): number | null { return this.#observation?.epoch ?? null }
  subscribe(listener: GlobalRevocationListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  observe(observation: GlobalRevocationObservation): void {
    this.#observation = Object.freeze(observation)
  }

  async publish(published: GlobalRevocationNotice): Promise<void> {
    this.observe({ epoch: published.epoch, notice: published })
    for (const listener of [...this.#listeners]) await listener(published)
  }
}

function setup() {
  const storage = new MemoryStorage()
  const revocation = new ScriptedRevocation()
  const lifecycleEvents: string[] = []
  const learner = new LearnerSessionController({
    storage,
    revocation,
    ownershipLockManager: new OwnershipLocks(),
    clock: () => START,
    randomUUID: () => UUID_A,
    onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
  })
  return { storage, revocation, learner, lifecycleEvents }
}

const TERMINAL_CAUSES = [
  'learner-lock',
  'learner-switch-start',
  'learner-credential-reset',
  'global-revocation',
] as const

describe('terminal MAX lifecycle delivery atomicity', () => {
  it.each(TERMINAL_CAUSES)(
    'delivers exactly one terminal notification for a fresh %s MAX',
    async (cause) => {
      const runtime = setup()
      runtime.revocation.observe({
        epoch: GLOBAL_REVOCATION_EXHAUSTED_EPOCH,
        notice: notice(cause, GLOBAL_REVOCATION_EXHAUSTED_EPOCH),
      })

      await expect(runtime.learner.restore()).resolves.toEqual({
        status: 'ended',
        reason: 'global-revocation',
      })
      await runtime.learner.whenLifecycleIdle()

      expect(runtime.lifecycleEvents).toEqual([cause])
      await runtime.learner.close()
    },
  )

  it.each(TERMINAL_CAUSES)(
    'still delivers the terminal %s notification after an ordinary revocation already ended the session',
    async (cause) => {
      const runtime = setup()
      await runtime.learner.create(P1)
      // Ordinary revocation first: this leaves the controller with no session
      // and a `global-revocation` end reason, which is the state that used to
      // suppress the later terminal delivery.
      await runtime.revocation.publish(notice('learner-sign-out', 1))
      await runtime.learner.whenLifecycleIdle()
      expect(runtime.lifecycleEvents).toEqual(['learner-authenticated', 'learner-sign-out'])

      runtime.revocation.observe({
        epoch: GLOBAL_REVOCATION_EXHAUSTED_EPOCH,
        notice: notice(cause, GLOBAL_REVOCATION_EXHAUSTED_EPOCH),
      })
      await runtime.learner.restore()
      await runtime.learner.whenLifecycleIdle()

      expect(runtime.lifecycleEvents).toEqual([
        'learner-authenticated',
        'learner-sign-out',
        cause,
      ])
      await runtime.learner.close()
    },
  )

  it('delivers a generic terminal notification when MAX carries no envelope', async () => {
    const runtime = setup()
    await runtime.learner.create(P1)
    await runtime.revocation.publish(notice('learner-sign-out', 1))
    await runtime.learner.whenLifecycleIdle()

    // Legacy numeric MAX: no cause envelope to compare identity against.
    runtime.revocation.observe({ epoch: GLOBAL_REVOCATION_EXHAUSTED_EPOCH, notice: null })
    await runtime.learner.restore()
    await runtime.learner.whenLifecycleIdle()

    expect(runtime.lifecycleEvents).toEqual([
      'learner-authenticated',
      'learner-sign-out',
      'global-revocation',
    ])
    await runtime.learner.close()
  })

  it('delivers exactly one terminal notification across repeated denied create/restore cycles', async () => {
    const runtime = setup()
    await runtime.learner.create(P1)
    await runtime.revocation.publish(notice('learner-sign-out', 1))
    await runtime.learner.whenLifecycleIdle()

    runtime.revocation.observe({
      epoch: GLOBAL_REVOCATION_EXHAUSTED_EPOCH,
      notice: notice('learner-lock', GLOBAL_REVOCATION_EXHAUSTED_EPOCH),
    })

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await expect(runtime.learner.create(P1)).rejects.toThrow('exhausted')
      await expect(runtime.learner.restore()).resolves.toEqual({
        status: 'ended',
        reason: 'global-revocation',
      })
      await runtime.learner.whenLifecycleIdle()
    }

    expect(runtime.lifecycleEvents.filter((type) => type === 'learner-lock')).toHaveLength(1)
    expect(runtime.learner.session).toBeNull()
    expect(runtime.storage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()
    await runtime.learner.close()
  })

  it('delivers the terminal notification when ownership is already held by another owner', async () => {
    const locks = new OwnershipLocks()
    const storage = new MemoryStorage()
    const revocation = new ScriptedRevocation()
    const lifecycleEvents: string[] = []
    const holder = new LearnerSessionController({
      storage,
      revocation,
      ownershipLockManager: locks,
      clock: () => START,
      randomUUID: () => UUID_A,
    })
    const record = await holder.create(P1)

    const contender = new LearnerSessionController({
      storage: (() => {
        const copy = new MemoryStorage()
        copy.setItem(LEARNER_SESSION_STORAGE_KEY, JSON.stringify(record))
        return copy
      })(),
      revocation,
      ownershipLockManager: locks,
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })

    // Ordinary conflict first, so `#lastEndReason` is set before MAX arrives.
    await expect(contender.restore()).resolves.toEqual({
      status: 'ended',
      reason: 'ownership-conflict',
    })
    await contender.whenLifecycleIdle()

    revocation.observe({
      epoch: GLOBAL_REVOCATION_EXHAUSTED_EPOCH,
      notice: notice('learner-credential-reset', GLOBAL_REVOCATION_EXHAUSTED_EPOCH),
    })
    await contender.restore()
    await contender.whenLifecycleIdle()

    expect(lifecycleEvents).toEqual(['provenance-loss', 'learner-credential-reset'])
    await contender.close()
    await holder.close()
  })
})

describe('ordinary end emission', () => {
  it('does not re-emit when the same end reason repeats with no session', async () => {
    const runtime = setup()
    const malformed = JSON.stringify({ schemaVersion: 1, sessionId: 'not-a-uuid' })

    runtime.storage.setItem(LEARNER_SESSION_STORAGE_KEY, malformed)
    await expect(runtime.learner.restore()).resolves.toEqual({
      status: 'ended',
      reason: 'malformed-record',
    })
    await runtime.learner.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['provenance-loss'])

    // The identical end repeats; the notification must not.
    runtime.storage.setItem(LEARNER_SESSION_STORAGE_KEY, malformed)
    await expect(runtime.learner.restore()).resolves.toEqual({
      status: 'ended',
      reason: 'malformed-record',
    })
    await runtime.learner.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['provenance-loss'])

    await runtime.learner.close()
  })
})
