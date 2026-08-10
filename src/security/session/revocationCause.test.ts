import { describe, expect, it, vi } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import {
  LearnerSessionController,
  type LearnerSessionOwnershipLock,
  type LearnerSessionOwnershipLockManager,
} from './learnerSession'
import {
  GLOBAL_REVOCATION_LOCK_NAME,
  GlobalRevocationCoordinator,
  type RevocationBroadcastPort,
  type RevocationLockManager,
} from './revocation'
import type { SecurityStorage } from './runtime'

const START = Date.parse('2026-08-09T12:00:00.000Z')
const UUID_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const UUID_B = 'b3d48c11-53bb-4d8f-bb8b-d2f311abf5ef'
const P1 = parseProfileId('p1')!

class MemoryStorage implements SecurityStorage {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

class BroadcastHub {
  readonly channels = new Set<HubChannel>()

  create = (): RevocationBroadcastPort => {
    const channel = new HubChannel(this)
    this.channels.add(channel)
    return channel
  }

  inject(message: unknown): void {
    for (const channel of this.channels) channel.onmessage?.({ data: message })
  }
}

class HubChannel implements RevocationBroadcastPort {
  onmessage: ((event: { readonly data: unknown }) => void) | null = null
  constructor(private readonly hub: BroadcastHub) {}
  postMessage(message: unknown): void {
    for (const channel of this.hub.channels) {
      if (channel !== this) channel.onmessage?.({ data: message })
    }
  }
  close(): void { this.hub.channels.delete(this) }
}

class RevocationLocks implements RevocationLockManager {
  #tail: Promise<void> = Promise.resolve()
  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T> {
    expect(name).toBe(GLOBAL_REVOCATION_LOCK_NAME)
    const result = this.#tail.then(callback)
    this.#tail = result.then(() => undefined, () => undefined)
    return result
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
}

describe('causeful global revocation transport', () => {
  it('preserves the exact cause remotely while the cleared initiating tab receives no duplicate', async () => {
    const storage = new MemoryStorage()
    const hub = new BroadcastHub()
    const localCoordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      channelFactory: hub.create,
      lockManager: new RevocationLocks(),
    })
    const remoteCoordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      channelFactory: hub.create,
    })
    const localEvents: string[] = []
    const remoteEvents: string[] = []
    const remoteNotices: string[] = []
    let finishRemoteCancellation!: () => void
    const remoteCancellation = new Promise<void>((resolve) => { finishRemoteCancellation = resolve })
    remoteCoordinator.subscribe((notice) => { remoteNotices.push(notice.cause) })
    const local = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: localCoordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { localEvents.push(event.type) },
    })
    const remote = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: remoteCoordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_B,
      onLifecycleEvent: async (event) => {
        if (event.type !== 'learner-lock') return
        remoteEvents.push(`${event.type}:start`)
        await remoteCancellation
        remoteEvents.push(`${event.type}:done`)
      },
    })
    await local.create(P1)
    await remote.create(P1)
    localEvents.length = 0
    remoteEvents.length = 0

    await local.clearLocal()
    await localCoordinator.revoke('learner-lock')
    await vi.waitFor(() => {
      expect(remoteEvents).toEqual(['learner-lock:start'])
    })

    expect(localEvents).toEqual([])
    expect(remoteNotices).toEqual(['learner-lock'])
    expect(remote.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    finishRemoteCancellation()
    await remote.whenLifecycleIdle()
    expect(remoteEvents).toEqual(['learner-lock:start', 'learner-lock:done'])

    await local.close()
    await remote.close()
    localCoordinator.close()
    remoteCoordinator.close()
  })

  it('fails closed with generic global-revocation for a malformed cause envelope', async () => {
    const storage = new MemoryStorage()
    const hub = new BroadcastHub()
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      channelFactory: hub.create,
    })
    const events: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { events.push(event.type) },
    })
    await session.create(P1)
    events.length = 0

    hub.inject({
      schemaVersion: 1,
      epoch: 1,
      cause: 'attacker-controlled-cause',
      occurredAt: new Date(START).toISOString(),
    })
    await vi.waitFor(() => expect(events).toEqual(['global-revocation']))

    expect(session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await session.close()
    coordinator.close()
  })
})
