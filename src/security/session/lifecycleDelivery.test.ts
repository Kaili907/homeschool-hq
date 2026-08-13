import { describe, expect, it, vi } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import type {
  GlobalRevocationCause,
  GlobalRevocationListener,
  GlobalRevocationSource,
} from './revocation'
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
const P2 = parseProfileId('p2')!

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

class EmittingRevocation implements GlobalRevocationSource {
  readonly #listeners = new Set<GlobalRevocationListener>()
  #epoch = 0
  currentEpoch(): number { return this.#epoch }
  subscribe(listener: GlobalRevocationListener): () => void {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }
  emit(cause: GlobalRevocationCause): void {
    this.#epoch += 1
    const notice = Object.freeze({
      schemaVersion: 1 as const,
      epoch: this.#epoch,
      cause,
      occurredAt: new Date(START).toISOString(),
    })
    for (const listener of this.#listeners) void listener(notice)
  }
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

  get held(): boolean { return this.#held }
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

  it('defensively drains later cleanup after rejection while the barrier stays failed', async () => {
    const trace: string[] = []
    const rejected: string[] = []
    const delivery = new SerializedLifecycleDelivery(async (event) => {
      trace.push(event.type)
      if (event.type === 'learner-lock') throw new Error('first cleanup failed')
    })
    const first = delivery.enqueue({
      type: 'learner-lock', occurredAt: new Date(START).toISOString(),
    }, () => { rejected.push('learner-lock') })
    const second = delivery.enqueue({
      type: 'learner-sign-out', occurredAt: new Date(START + 1).toISOString(),
    }, () => { rejected.push('learner-sign-out') })

    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBe(true)
    expect(trace).toEqual(['learner-lock', 'learner-sign-out'])
    expect(rejected).toEqual(['learner-lock'])
    await expect(delivery.requireClean()).rejects.toThrow('lifecycle delivery failed closed')
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

  it('blocks replacement learner authority until prior cleanup finishes', async () => {
    let now = START
    let finishCancellation!: () => void
    const cancellation = new Promise<void>((resolve) => { finishCancellation = resolve })
    const trace: string[] = []
    const storage = new MemoryStorage()
    const ownership = new OwnershipLocks()
    const session = new LearnerSessionController({
      storage,
      revocation: new StableRevocation(),
      ownershipLockManager: ownership,
      clock: () => now,
      randomUUID: () => UUID_A,
      onLifecycleEvent: async (event) => {
        trace.push(`${event.type}:start`)
        if (event.type === 'learner-session-expired') await cancellation
        trace.push(`${event.type}:done`)
      },
    })
    await session.create(P1)
    trace.length = 0
    now += 30 * 60_000
    expect(session.recheck()).toEqual({ status: 'ended', reason: 'idle-expired' })

    const replacement = session.create(P2)
    await vi.waitFor(() => expect(trace).toEqual(['learner-session-expired:start']))
    expect(session.session).toBeNull()
    expect(storage.getItem('manuel-academy.security.learner-session.v1')).toBeNull()
    expect(ownership.held).toBe(false)
    expect(trace).not.toContain('learner-authenticated:start')

    finishCancellation()
    await expect(replacement).resolves.toMatchObject({ profileId: 'p2' })
    expect(trace).toEqual([
      'learner-session-expired:start',
      'learner-session-expired:done',
      'learner-authenticated:start',
      'learner-authenticated:done',
    ])
    await session.close()
  })

  it('makes cleanup rejection terminal for create and restore for the controller lifetime', async () => {
    let now = START
    const storage = new MemoryStorage()
    const ownership = new OwnershipLocks()
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const session = new LearnerSessionController({
        storage,
        revocation: new StableRevocation(),
        ownershipLockManager: ownership,
        clock: () => now,
        randomUUID: () => UUID_A,
        onLifecycleEvent: async (event) => {
          if (event.type === 'learner-session-expired') throw new Error('Study cleanup rejected')
        },
      })
      const original = await session.create(P1)
      now += 30 * 60_000
      expect(session.recheck()).toEqual({ status: 'ended', reason: 'idle-expired' })
      await session.whenLifecycleIdle()

      await expect(session.create(P2)).rejects.toThrow('lifecycle delivery failed closed')
      storage.setItem('manuel-academy.security.learner-session.v1', JSON.stringify({
        ...original,
        profileId: 'p2',
        lastMeaningfulActivityAt: new Date(now).toISOString(),
        absoluteExpiresAt: new Date(START + 8 * 60 * 60_000).toISOString(),
      }))
      await expect(session.restore()).resolves.toEqual({ status: 'ended', reason: 'lifecycle-failed' })
      expect(session.session).toBeNull()
      expect(storage.getItem('manuel-academy.security.learner-session.v1')).toBeNull()
      expect(ownership.held).toBe(false)
      expect(session.lifecycleDeliveryFailed).toBe(true)
      expect(unhandled).not.toHaveBeenCalled()
      await session.close()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('makes absolute-expiry cleanup failure terminal', async () => {
    let now = START
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: new StableRevocation(),
      ownershipLockManager: new OwnershipLocks(),
      clock: () => now,
      randomUUID: () => UUID_A,
      onLifecycleEvent: async (event) => {
        if (event.type === 'learner-session-expired') throw new Error('absolute cleanup failed')
      },
    })
    await session.create(P1)
    now += 8 * 60 * 60_000
    expect(session.recheck()).toEqual({ status: 'ended', reason: 'absolute-expired' })
    await session.whenLifecycleIdle()
    await expect(session.create(P2)).rejects.toThrow('lifecycle delivery failed closed')
    expect(session.session).toBeNull()
    await session.close()
  })

  it('makes remote-revocation cleanup failure terminal', async () => {
    const revocation = new EmittingRevocation()
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: async (event) => {
        if (event.type === 'learner-lock') throw new Error('remote cleanup failed')
      },
    })
    await session.create(P1)
    revocation.emit('learner-lock')
    await session.whenLifecycleIdle()
    await expect(session.create(P2)).rejects.toThrow('lifecycle delivery failed closed')
    expect(session.session).toBeNull()
    await session.close()
  })

  it('makes restored-session invalidation cleanup failure terminal', async () => {
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
    const session = new LearnerSessionController({
      storage,
      revocation: new StableRevocation(),
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: async (event) => {
        if (event.type === 'provenance-loss') throw new Error('restore cleanup failed')
      },
    })

    await expect(session.restore()).resolves.toEqual({ status: 'ended', reason: 'lifecycle-failed' })
    await expect(session.create(P2)).rejects.toThrow('lifecycle delivery failed closed')
    expect(storage.getItem('manuel-academy.security.learner-session.v1')).toBeNull()
    await session.close()
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
