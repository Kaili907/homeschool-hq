import { describe, expect, it, vi } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import {
  LearnerSessionController,
  type LearnerSessionOwnershipLock,
  type LearnerSessionOwnershipLockManager,
} from './learnerSession'
import { ParentSessionController } from './parentSession'
import {
  GLOBAL_REVOCATION_LOCK_NAME,
  GlobalRevocationCoordinator,
  type RevocationLockManager,
} from './revocation'
import type { SecurityStorage } from './runtime'

const START = Date.parse('2026-08-09T12:00:00.000Z')
const UUID_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const UUID_B = 'b3d48c11-53bb-4d8f-bb8b-d2f311abf5ef'
const P1 = parseProfileId('p1')!
const P2 = parseProfileId('p2')!

class MemoryStorage implements SecurityStorage {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

class SerialRevocationLocks implements RevocationLockManager {
  #tail: Promise<void> = Promise.resolve()
  active = 0
  maximumActive = 0

  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T> {
    expect(name).toBe(GLOBAL_REVOCATION_LOCK_NAME)
    const result = this.#tail.then(async () => {
      this.active += 1
      this.maximumActive = Math.max(this.maximumActive, this.active)
      try {
        return await callback()
      } finally {
        this.active -= 1
      }
    })
    this.#tail = result.then(() => undefined, () => undefined)
    return result
  }
}

/**
 * Models the real Web Locks contract: the lock is only genuinely gone once the
 * `request` promise settles, which can be well after the callback returns.
 */
class DeferredReleaseOwnershipLocks implements LearnerSessionOwnershipLockManager {
  held = false
  #allowRelease!: () => void
  readonly #releaseGate = new Promise<void>((resolve) => { this.#allowRelease = resolve })

  allowRelease(): void { this.#allowRelease() }

  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LearnerSessionOwnershipLock | null) => T | Promise<T>,
  ): Promise<T> {
    this.held = true
    return Promise.resolve(callback({ name })).then(async (result) => {
      await this.#releaseGate
      this.held = false
      return result
    })
  }
}

class OwnershipLocks implements LearnerSessionOwnershipLockManager {
  #held = false
  get held(): boolean { return this.#held }

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

describe('authority release settlement', () => {
  it('keeps revocation settlement pending until learner ownership release completes', async () => {
    const deviceStorage = new MemoryStorage()
    const ownership = new DeferredReleaseOwnershipLocks()
    const coordinator = new GlobalRevocationCoordinator({
      storage: deviceStorage,
      clock: () => START,
      lockManager: new SerialRevocationLocks(),
    })
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: ownership,
      clock: () => START,
      randomUUID: () => UUID_A,
    })
    await session.create(P1)
    expect(ownership.held).toBe(true)

    let settled = false
    const attempt = coordinator.beginRevoke('learner-lock')
    const settlement = attempt.settled.finally(() => { settled = true })
    await attempt.published

    // Durable publication is complete, but the Web Lock is still held.
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(settled).toBe(false)
    expect(ownership.held).toBe(true)
    expect(session.session).toBeNull()

    ownership.allowRelease()
    await settlement
    expect(settled).toBe(true)
    expect(ownership.held).toBe(false)

    await session.close()
    coordinator.close()
  })

  it('settles concurrent revocation and Parent authority without a lock cycle', async () => {
    const deviceStorage = new MemoryStorage()
    const revocationLocks = new SerialRevocationLocks()
    const ownership = new OwnershipLocks()
    const coordinator = new GlobalRevocationCoordinator({
      storage: deviceStorage,
      clock: () => START,
      lockManager: revocationLocks,
    })
    // Parent subscribes first so the sequential listener fan-out reaches it
    // before the learner; a Parent barrier that waited on learner state here
    // would close the cycle.
    let releaseParentCleanup!: () => void
    const parentCleanup = new Promise<void>((resolve) => { releaseParentCleanup = resolve })
    const parentEvents: string[] = []
    const parent = new ParentSessionController({
      revocation: coordinator,
      clock: () => START,
      randomUUID: () => UUID_B,
      onLifecycleEvent: async (event) => {
        parentEvents.push(event.type)
        await parentCleanup
      },
    })
    const learner = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: ownership,
      clock: () => START,
      randomUUID: () => UUID_A,
    })
    await learner.create(P1)
    parent.create('parent-a', 'household-a')

    let revoked = false
    const revoking = coordinator.revoke('household-switch').finally(() => { revoked = true })
    await vi.waitFor(() => expect(parentEvents).toEqual(['household-switch']))

    // Parent cleanup is genuinely in flight inside revocation delivery. The
    // synchronous barrier refuses instead of waiting, so it can never join the
    // wait graph that delivery is already in.
    expect(() => parent.create('parent-b', 'household-b'))
      .toThrow('Parent lifecycle cleanup is pending')
    expect(revoked).toBe(false)
    expect(revocationLocks.active).toBe(0)

    releaseParentCleanup()
    await expect(revoking).resolves.toMatchObject({ epoch: 1, cause: 'household-switch' })
    await parent.whenLifecycleIdle()
    expect(parent.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    expect(learner.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    expect(revocationLocks.maximumActive).toBe(1)
    expect(revocationLocks.active).toBe(0)
    expect(ownership.held).toBe(false)

    // Cleanup settled successfully, so fresh authentication may create again.
    expect(parent.create('parent-b', 'household-b')).toMatchObject({ globalRevocationEpoch: 1 })
    await expect(learner.create(P2)).resolves.toMatchObject({ globalRevocationEpoch: 1 })

    await learner.close()
    parent.close()
    coordinator.close()
  })
})
