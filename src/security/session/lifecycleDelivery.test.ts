import { describe, expect, it, vi } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import type { GlobalRevocationListener, GlobalRevocationSource } from './revocation'
import {
  LearnerSessionController,
  type LearnerSessionOwnershipLock,
  type LearnerSessionOwnershipLockManager,
} from './learnerSession'
import { SerializedLifecycleDelivery } from './lifecycleDelivery'
import type { SecurityStorage } from './runtime'

const START = Date.parse('2026-08-09T12:00:00.000Z')
const UUID_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const P1 = parseProfileId('p1')!

class MemoryStorage implements SecurityStorage {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

class StableRevocation implements GlobalRevocationSource {
  currentEpoch(): number { return 0 }
  subscribe(_listener: GlobalRevocationListener): () => void { return () => undefined }
}

class OwnershipLocks implements LearnerSessionOwnershipLockManager {
  #held = false
  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LearnerSessionOwnershipLock | null) => T | Promise<T>,
  ): Promise<T> {
    if (this.#held) return Promise.resolve(callback(null))
    this.#held = true
    return Promise.resolve(callback({ name })).finally(() => { this.#held = false })
  }
}

describe('serialized Promise-aware security lifecycle delivery', () => {
  it('awaits each async sink and preserves deterministic event order', async () => {
    const trace: string[] = []
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
    const delivery = new SerializedLifecycleDelivery(async (event) => {
      trace.push(`start:${event.type}`)
      if (event.type === 'learner-lock') await firstGate
      trace.push(`done:${event.type}`)
    })

    const first = delivery.enqueue({ type: 'learner-lock', occurredAt: new Date(START).toISOString() }, vi.fn())
    const second = delivery.enqueue({ type: 'learner-sign-out', occurredAt: new Date(START + 1).toISOString() }, vi.fn())
    await vi.waitFor(() => expect(trace).toEqual(['start:learner-lock']))
    releaseFirst()
    await Promise.all([first, second])

    expect(trace).toEqual([
      'start:learner-lock',
      'done:learner-lock',
      'start:learner-sign-out',
      'done:learner-sign-out',
    ])
  })

  it('awaits autonomous expiry cancellation before reporting lifecycle idle', async () => {
    let now = START
    let releaseCancellation!: () => void
    const cancellation = new Promise<void>((resolve) => { releaseCancellation = resolve })
    const trace: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: new StableRevocation(),
      ownershipLockManager: new OwnershipLocks(),
      clock: () => now,
      randomUUID: () => UUID_A,
      onLifecycleEvent: async (event) => {
        if (event.type !== 'learner-session-expired') return
        trace.push('cancel-start')
        await cancellation
        trace.push('cancel-done')
      },
    })
    await session.create(P1)
    now += 30 * 60_000

    expect(session.recheck()).toEqual({ status: 'ended', reason: 'idle-expired' })
    const idle = session.whenLifecycleIdle().then(() => trace.push('idle'))
    await vi.waitFor(() => expect(trace).toEqual(['cancel-start']))
    releaseCancellation()
    await idle
    expect(trace).toEqual(['cancel-start', 'cancel-done', 'idle'])
    await session.close()
  })

  it('contains sink rejection, marks failure, and keeps learner authority closed', async () => {
    let now = START
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const session = new LearnerSessionController({
        storage: new MemoryStorage(),
        revocation: new StableRevocation(),
        ownershipLockManager: new OwnershipLocks(),
        clock: () => now,
        randomUUID: () => UUID_A,
        onLifecycleEvent: async (event) => {
          if (event.type === 'learner-session-expired') throw new Error('Study cancellation failed')
        },
      })
      await session.create(P1)
      now += 30 * 60_000
      expect(session.recheck()).toEqual({ status: 'ended', reason: 'idle-expired' })
      await session.whenLifecycleIdle()
      await Promise.resolve()

      expect(session.session).toBeNull()
      expect(session.lifecycleDeliveryFailed).toBe(true)
      expect(unhandled).not.toHaveBeenCalled()
      await session.close()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('awaits restored-record invalidation before restore completes', async () => {
    const storage = new MemoryStorage()
    storage.setItem('manuel-academy.security.learner-session.v1', JSON.stringify({
      schemaVersion: 1,
      sessionId: UUID_A,
      profileId: 'P1',
      authenticatedAt: new Date(START).toISOString(),
      lastMeaningfulActivityAt: new Date(START).toISOString(),
      absoluteExpiresAt: new Date(START + 8 * 60 * 60_000).toISOString(),
      globalRevocationEpoch: 0,
    }))
    let finishCancellation!: () => void
    const cancellation = new Promise<void>((resolve) => { finishCancellation = resolve })
    const trace: string[] = []
    const session = new LearnerSessionController({
      storage,
      revocation: new StableRevocation(),
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: async (event) => {
        trace.push(`${event.type}:start`)
        await cancellation
        trace.push(`${event.type}:done`)
      },
    })

    const restoring = session.restore()
    await vi.waitFor(() => expect(trace).toEqual(['provenance-loss:start']))
    expect(session.session).toBeNull()
    let completed = false
    void restoring.then(() => { completed = true })
    await Promise.resolve()
    expect(completed).toBe(false)

    finishCancellation()
    await expect(restoring).resolves.toEqual({ status: 'ended', reason: 'malformed-record' })
    expect(trace).toEqual(['provenance-loss:start', 'provenance-loss:done'])
    await session.close()
  })
})
