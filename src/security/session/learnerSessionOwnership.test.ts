import { describe, expect, it, vi } from 'vitest'
import { parseProfileId, type ProfileId } from '../contracts/profileId'
import type {
  GlobalRevocationListener,
  GlobalRevocationSource,
} from './revocation'
import {
  LearnerSessionController,
  LEARNER_SESSION_STORAGE_KEY,
  learnerSessionOwnershipLockName,
  type LearnerSessionOwnershipLock,
  type LearnerSessionOwnershipLockManager,
} from './learnerSession'
import type { SecurityStorage } from './runtime'

const START = Date.parse('2026-08-09T12:00:00.000Z')
const UUID_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const P1 = parseProfileId('p1')!

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

class StableRevocation implements GlobalRevocationSource {
  readonly #listeners = new Set<GlobalRevocationListener>()

  currentEpoch(): number {
    return 0
  }

  subscribe(listener: GlobalRevocationListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

class ExclusiveOwnershipLocks implements LearnerSessionOwnershipLockManager {
  readonly #held = new Set<string>()

  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LearnerSessionOwnershipLock | null) => T | Promise<T>,
  ): Promise<T> {
    if (this.#held.has(name)) return Promise.resolve(callback(null))
    this.#held.add(name)
    return Promise.resolve(callback({ name })).finally(() => {
      this.#held.delete(name)
    })
  }

  isHeld(name: string): boolean {
    return this.#held.has(name)
  }
}

function controller(options: {
  storage?: MemoryStorage
  locks?: ExclusiveOwnershipLocks
  now?: () => number
  lifecycle?: (event: { readonly type: string; readonly occurredAt: string }) => void | Promise<unknown>
} = {}) {
  return new LearnerSessionController({
    storage: options.storage ?? new MemoryStorage(),
    revocation: new StableRevocation(),
    ownershipLockManager: options.locks,
    clock: options.now ?? (() => START),
    randomUUID: () => UUID_A,
    onLifecycleEvent: options.lifecycle,
  })
}

describe('exclusive learner-session tab ownership', () => {
  it('rejects a duplicated tab with copied sessionStorage while the original remains authoritative', async () => {
    const locks = new ExclusiveOwnershipLocks()
    const storageA = new MemoryStorage()
    const tabA = controller({ storage: storageA, locks })
    const record = await tabA.create(P1)
    const copiedStorage = new MemoryStorage()
    copiedStorage.setItem(LEARNER_SESSION_STORAGE_KEY, storageA.getItem(LEARNER_SESSION_STORAGE_KEY)!)
    const tabB = controller({ storage: copiedStorage, locks })

    await expect(tabB.restore()).resolves.toEqual({ status: 'ended', reason: 'ownership-conflict' })
    expect(tabA.recheck()).toEqual({ status: 'active', session: record })
    expect(copiedStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()

    await tabA.close()
    await tabB.close()
  })

  it('releases on same-tab document close so refresh can reacquire and restore', async () => {
    const locks = new ExclusiveOwnershipLocks()
    const storage = new MemoryStorage()
    const oldDocument = controller({ storage, locks })
    const record = await oldDocument.create(P1)
    await oldDocument.close()

    const refreshedDocument = controller({ storage, locks })
    await expect(refreshedDocument.restore()).resolves.toEqual({ status: 'active', session: record })
    await refreshedDocument.close()
  })

  it('allows at most one simultaneous restore of the same copied session', async () => {
    const locks = new ExclusiveOwnershipLocks()
    const seedStorage = new MemoryStorage()
    const seed = controller({ storage: seedStorage, locks })
    await seed.create(P1)
    const serialized = seedStorage.getItem(LEARNER_SESSION_STORAGE_KEY)!
    await seed.close()

    const firstStorage = new MemoryStorage()
    const secondStorage = new MemoryStorage()
    firstStorage.setItem(LEARNER_SESSION_STORAGE_KEY, serialized)
    secondStorage.setItem(LEARNER_SESSION_STORAGE_KEY, serialized)
    const first = controller({ storage: firstStorage, locks })
    const second = controller({ storage: secondStorage, locks })

    const results = await Promise.all([first.restore(), second.restore()])
    expect(results.filter((result) => result.status === 'active')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'ended')).toEqual([
      { status: 'ended', reason: 'ownership-conflict' },
    ])

    await first.close()
    await second.close()
  })

  it('releases the long-lived lock on explicit lock, expiry, and close', async () => {
    const locks = new ExclusiveOwnershipLocks()
    let now = START
    const storage = new MemoryStorage()
    const session = controller({ storage, locks, now: () => now })
    const record = await session.create(P1)
    const lockName = learnerSessionOwnershipLockName(record.sessionId)
    expect(locks.isHeld(lockName)).toBe(true)

    await session.clearLocal()
    expect(locks.isHeld(lockName)).toBe(false)

    const expiring = controller({ storage: new MemoryStorage(), locks, now: () => now })
    const expiringRecord = await expiring.create(P1)
    const expiringLock = learnerSessionOwnershipLockName(expiringRecord.sessionId)
    now += 30 * 60_000
    expect(expiring.recheck()).toEqual({ status: 'ended', reason: 'idle-expired' })
    await vi.waitFor(() => expect(locks.isHeld(expiringLock)).toBe(false))

    now = START
    const closing = controller({ storage: new MemoryStorage(), locks, now: () => now })
    const closingRecord = await closing.create(P1)
    const closingLock = learnerSessionOwnershipLockName(closingRecord.sessionId)
    await closing.close()
    expect(locks.isHeld(closingLock)).toBe(false)
    await session.close()
    await expiring.close()
  })

  it('fails closed when Web Locks are unavailable and rejects noncanonical IDs', async () => {
    const storage = new MemoryStorage()
    const locks = new ExclusiveOwnershipLocks()
    const seed = controller({ storage, locks })
    await seed.create(P1)
    await seed.close()

    const unsupported = controller({ storage })
    await expect(unsupported.restore()).resolves.toEqual({
      status: 'ended',
      reason: 'ownership-unavailable',
    })
    expect(storage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()
    await expect(unsupported.create(P1)).rejects.toThrow('ownership is unavailable')

    const canonicalOnly = controller({ storage: new MemoryStorage(), locks })
    for (const invalid of [' P1', 'P1', 'p6', '😀']) {
      await expect(canonicalOnly.create(invalid as ProfileId)).rejects.toThrow('profile ID is invalid')
    }
    await canonicalOnly.close()
  })
})
