import { describe, expect, it, vi } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import type { StudyCancellationReason } from '../../study/lifecycle/StudyLifecycle'
import { cancelStudyForSecurityLifecycleEvent } from '../study/authStudyCancellationBridge'
import {
  LearnerSessionController,
  LEARNER_SESSION_STORAGE_KEY,
  type LearnerSessionOwnershipLock,
  type LearnerSessionOwnershipLockManager,
} from './learnerSession'
import {
  executeLearnerAccessActions,
  transitionLearnerAccess,
  type LearnerAccessEvent,
} from './lockSwitchStateMachine'
import { ParentSessionController } from './parentSession'
import {
  GLOBAL_REVOCATION_STORAGE_KEY,
  GLOBAL_REVOCATION_LOCK_NAME,
  GlobalRevocationCoordinator,
  type GlobalRevocationCause,
  type GlobalRevocationNotice,
  type GlobalRevocationObservation,
  type GlobalRevocationSource,
  type RevocationBroadcastPort,
  type RevocationLockManager,
  type RevocationStorageEvent,
  type RevocationStorageEventSource,
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

class StorageEventHub implements RevocationStorageEventSource {
  readonly listeners = new Set<(event: RevocationStorageEvent) => void>()
  addEventListener(
    _type: 'storage',
    listener: (event: RevocationStorageEvent) => void,
  ): void {
    this.listeners.add(listener)
  }
  removeEventListener(
    _type: 'storage',
    listener: (event: RevocationStorageEvent) => void,
  ): void {
    this.listeners.delete(listener)
  }
  emit(newValue: string | null): void {
    for (const listener of this.listeners) {
      listener({ key: GLOBAL_REVOCATION_STORAGE_KEY, newValue })
    }
  }
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
  requests = 0
  get held(): boolean { return this.#held }
  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LearnerSessionOwnershipLock | null) => T | Promise<T>,
  ): Promise<T> {
    this.requests += 1
    if (this.#held) return Promise.resolve(callback(null))
    this.#held = true
    return Promise.resolve(callback({ name })).finally(() => { this.#held = false })
  }
}

class DeferredOwnershipLocks implements LearnerSessionOwnershipLockManager {
  requests = 0
  held = false
  #allowRequest!: () => void
  readonly #requestGate = new Promise<void>((resolve) => { this.#allowRequest = resolve })

  allowRequest(): void { this.#allowRequest() }

  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LearnerSessionOwnershipLock | null) => T | Promise<T>,
  ): Promise<T> {
    this.requests += 1
    return this.#requestGate.then(async () => {
      this.held = true
      try {
        return await callback({ name })
      } finally {
        this.held = false
      }
    })
  }
}

function revocationNotice(
  cause: GlobalRevocationCause,
  epoch = 1,
  occurredAt = new Date(START + 30_000).toISOString(),
): GlobalRevocationNotice {
  return Object.freeze({ schemaVersion: 1, epoch, cause, occurredAt })
}

function persistNotice(storage: MemoryStorage, notice: GlobalRevocationNotice): void {
  storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, JSON.stringify(notice))
}

async function setupRemoteRace() {
  const storage = new MemoryStorage()
  const hub = new BroadcastHub()
  const coordinator = new GlobalRevocationCoordinator({
    storage,
    clock: () => START,
    channelFactory: hub.create,
  })
  const lifecycleEvents: string[] = []
  const studyCancellations: StudyCancellationReason[] = []
  const ownership = new OwnershipLocks()
  const session = new LearnerSessionController({
    storage: new MemoryStorage(),
    revocation: coordinator,
    ownershipLockManager: ownership,
    clock: () => START,
    randomUUID: () => UUID_A,
    onLifecycleEvent: (event) => {
      lifecycleEvents.push(event.type)
      return cancelStudyForSecurityLifecycleEvent(event, {
        cancel: (reason) => { studyCancellations.push(reason) },
      })
    },
  })
  await session.create(P1)
  lifecycleEvents.length = 0
  studyCancellations.length = 0
  return { storage, hub, coordinator, session, ownership, lifecycleEvents, studyCancellations }
}

describe('causeful global revocation transport', () => {
  it.each([
    ['learner-lock', 'logout'],
    ['learner-switch-start', 'learner-switch'],
    ['learner-credential-reset', 'authorization-loss'],
  ] as const)(
    'preserves polling-first durable %s instead of degrading to generic',
    async (cause, expectedStudyReason) => {
      const runtime = await setupRemoteRace()
      const notice = revocationNotice(cause)
      persistNotice(runtime.storage, notice)

      expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
      await runtime.session.whenLifecycleIdle()
      expect(runtime.lifecycleEvents).toEqual([cause])
      expect(runtime.studyCancellations).toEqual([expectedStudyReason])

      runtime.hub.inject(notice)
      runtime.session.recheck()
      await runtime.session.whenLifecycleIdle()
      expect(runtime.lifecycleEvents).toEqual([cause])
      expect(runtime.studyCancellations).toEqual([expectedStudyReason])

      await runtime.session.close()
      runtime.coordinator.close()
    },
  )

  it('preserves browser-event-first learner-lock when polling follows in the same turn', async () => {
    const runtime = await setupRemoteRace()
    const notice = revocationNotice('learner-lock')
    persistNotice(runtime.storage, notice)

    runtime.hub.inject(notice)
    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await runtime.session.whenLifecycleIdle()

    expect(runtime.lifecycleEvents).toEqual(['learner-lock'])
    expect(runtime.studyCancellations).toEqual(['logout'])
    expect(runtime.coordinator.currentEpoch()).toBe(1)
    runtime.hub.inject(notice)
    await runtime.session.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['learner-lock'])

    await runtime.session.close()
    runtime.coordinator.close()
  })

  it('preserves a durable specific cause when a storage event wins before polling', async () => {
    const storage = new MemoryStorage()
    const storageEvents = new StorageEventHub()
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      storageEvents,
      clock: () => START,
    })
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    await session.create(P1)
    lifecycleEvents.length = 0
    const notice = revocationNotice('learner-switch-start')
    persistNotice(storage, notice)

    storageEvents.emit(JSON.stringify(notice))
    expect(session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await session.whenLifecycleIdle()
    expect(lifecycleEvents).toEqual(['learner-switch-start'])

    await session.close()
    coordinator.close()
  })

  it('uses generic fallback for a newer browser notice without a durable envelope', async () => {
    const runtime = await setupRemoteRace()

    runtime.hub.inject(revocationNotice('learner-lock'))
    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await runtime.session.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['global-revocation'])
    expect(runtime.studyCancellations).toEqual(['authorization-loss'])

    await runtime.session.close()
    runtime.coordinator.close()
  })

  it('fails closed generically when the durable envelope is malformed', async () => {
    const runtime = await setupRemoteRace()
    runtime.storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      epoch: 1,
      cause: 'attacker-controlled-cause',
      occurredAt: new Date(START).toISOString(),
    }))

    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await runtime.session.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['global-revocation'])
    expect(runtime.studyCancellations).toEqual(['authorization-loss'])

    await runtime.session.close()
    runtime.coordinator.close()
  })

  it('fails closed generically when a durable legacy epoch has no cause envelope', async () => {
    const runtime = await setupRemoteRace()
    runtime.storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, '1')

    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await runtime.session.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['global-revocation'])
    expect(runtime.studyCancellations).toEqual(['authorization-loss'])

    await runtime.session.close()
    runtime.coordinator.close()
  })

  it('fails closed for a malformed browser message after a positive durable epoch', async () => {
    const storage = new MemoryStorage()
    const hub = new BroadcastHub()
    persistNotice(storage, revocationNotice('learner-lock'))
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      channelFactory: hub.create,
    })
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    await session.create(P1)
    lifecycleEvents.length = 0

    hub.inject({ malformed: true })
    await vi.waitFor(() => expect(lifecycleEvents).toEqual(['global-revocation']))
    expect(session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })

    await session.close()
    coordinator.close()
  })

  it('fails closed when a storage notification exposes malformed durable state at the observed epoch', async () => {
    const storage = new MemoryStorage()
    const storageEvents = new StorageEventHub()
    persistNotice(storage, revocationNotice('learner-lock'))
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      storageEvents,
    })
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    await session.create(P1)
    lifecycleEvents.length = 0
    const malformed = {
      schemaVersion: 1,
      epoch: 1,
      cause: 'attacker-controlled-cause',
      occurredAt: new Date(START).toISOString(),
    }
    const serializedMalformed = JSON.stringify(malformed)
    storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, serializedMalformed)

    storageEvents.emit(serializedMalformed)
    await vi.waitFor(() => expect(lifecycleEvents).toEqual(['global-revocation']))
    expect(session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })

    await session.close()
    coordinator.close()
  })

  it('recovers the valid epoch-zero baseline without synthesizing a revocation', async () => {
    const storage = new MemoryStorage()
    storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, '{malformed')
    const coordinator = new GlobalRevocationCoordinator({ storage, clock: () => START })
    const notices: string[] = []
    coordinator.subscribe((notice) => { notices.push(notice.cause) })

    storage.removeItem(GLOBAL_REVOCATION_STORAGE_KEY)
    expect(coordinator.currentEpoch()).toBe(0)
    await Promise.resolve()
    await Promise.resolve()
    expect(notices).toEqual([])

    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
    })
    await session.create(P1)
    expect(session.recheck().status).toBe('active')

    await session.close()
    coordinator.close()
  })

  it('uses generic fallback when an optional source returns a mismatched notice epoch', async () => {
    let observation: GlobalRevocationObservation | null = Object.freeze({ epoch: 0, notice: null })
    const source: GlobalRevocationSource = {
      currentEpoch: () => observation?.epoch ?? null,
      currentRevocation: () => observation,
      subscribe: () => () => undefined,
    }
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: source,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    await session.create(P1)
    lifecycleEvents.length = 0
    observation = Object.freeze({ epoch: 2, notice: revocationNotice('learner-lock', 1) })

    expect(session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await session.whenLifecycleIdle()
    expect(lifecycleEvents).toEqual(['global-revocation'])

    await session.close()
  })

  it('fails closed when a supplied mismatched notice masks an unchanged observation epoch', async () => {
    let observation: GlobalRevocationObservation | null = Object.freeze({ epoch: 0, notice: null })
    const source: GlobalRevocationSource = {
      currentEpoch: () => observation?.epoch ?? null,
      currentRevocation: () => observation,
      subscribe: () => () => undefined,
    }
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: source,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    await session.create(P1)
    lifecycleEvents.length = 0
    observation = Object.freeze({ epoch: 0, notice: revocationNotice('learner-lock', 1) })

    expect(session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await session.whenLifecycleIdle()
    expect(lifecycleEvents).toEqual(['global-revocation'])

    await session.close()
  })

  it('ignores stale browser envelopes but fails closed on a durable epoch rollback', async () => {
    const storage = new MemoryStorage()
    const hub = new BroadcastHub()
    const current = revocationNotice('learner-lock', 2)
    persistNotice(storage, current)
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      channelFactory: hub.create,
    })
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    await session.create(P1)
    lifecycleEvents.length = 0

    hub.inject(revocationNotice('learner-switch-start', 1))
    expect(session.recheck().status).toBe('active')
    expect(coordinator.currentEpoch()).toBe(2)
    expect(lifecycleEvents).toEqual([])

    persistNotice(storage, revocationNotice('learner-switch-start', 1))
    expect(session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await session.whenLifecycleIdle()
    expect(lifecycleEvents).toEqual(['global-revocation'])

    await session.close()
    coordinator.close()
  })

  it('preserves monotonic delivery across a newer durable jump and stale notification', async () => {
    const storage = new MemoryStorage()
    const hub = new BroadcastHub()
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      channelFactory: hub.create,
    })
    const causes: string[] = []
    coordinator.subscribe((notice) => { causes.push(notice.cause) })
    const second = revocationNotice('learner-switch-start', 2)
    const third = revocationNotice('learner-credential-reset', 3)

    persistNotice(storage, second)
    expect(coordinator.currentEpoch()).toBe(2)
    persistNotice(storage, third)
    expect(coordinator.currentEpoch()).toBe(3)
    hub.inject(second)
    expect(coordinator.currentEpoch()).toBe(3)
    await vi.waitFor(() => expect(causes).toEqual([
      'learner-switch-start',
      'learner-credential-reset',
    ]))

    coordinator.close()
  })

  it('releases the revocation lock after durable publication while delivery stays ordered', async () => {
    const storage = new MemoryStorage()
    storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, '0')
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      lockManager: new RevocationLocks(),
    })
    let releaseFirstDelivery!: () => void
    const firstDelivery = new Promise<void>((resolve) => { releaseFirstDelivery = resolve })
    const notices: GlobalRevocationCause[] = []
    coordinator.subscribe(async (notice) => {
      notices.push(notice.cause)
      if (notice.epoch === 1) await firstDelivery
    })

    const first = coordinator.beginRevoke('learner-lock')
    await expect(first.published).resolves.toMatchObject({ epoch: 1, cause: 'learner-lock' })
    const second = coordinator.beginRevoke('learner-sign-out')
    await expect(second.published).resolves.toMatchObject({ epoch: 2, cause: 'learner-sign-out' })
    expect(JSON.parse(storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY)!)).toMatchObject({
      epoch: 2,
      cause: 'learner-sign-out',
    })
    expect(notices).toEqual(['learner-lock'])

    releaseFirstDelivery()
    await expect(first.settled).resolves.toMatchObject({ epoch: 1 })
    await expect(second.settled).resolves.toMatchObject({ epoch: 2 })
    expect(notices).toEqual(['learner-lock', 'learner-sign-out'])

    coordinator.close()
  })

  it('denies fresh learner and Parent authority when durable revocation is already exhausted', async () => {
    const storage = new MemoryStorage()
    const sessionStorage = new MemoryStorage()
    const ownership = new OwnershipLocks()
    persistNotice(storage, revocationNotice('learner-lock', Number.MAX_SAFE_INTEGER))
    const coordinator = new GlobalRevocationCoordinator({ storage, clock: () => START })
    const lifecycleEvents: string[] = []
    const learner = new LearnerSessionController({
      storage: sessionStorage,
      revocation: coordinator,
      ownershipLockManager: ownership,
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    const parent = new ParentSessionController({
      revocation: coordinator,
      clock: () => START,
      randomUUID: () => UUID_B,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })

    await expect(learner.create(P1)).rejects.toThrow('exhausted')
    expect(() => parent.create('parent-a', 'household-a')).toThrow('exhausted')
    expect(learner.session).toBeNull()
    expect(parent.session).toBeNull()
    expect(sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()
    expect(ownership.requests).toBe(0)
    expect(lifecycleEvents).not.toContain('learner-authenticated')

    await learner.close()
    parent.close()
    coordinator.close()
  })

  it('does not terminal-latch a transport-only MAX without authoritative durable MAX', async () => {
    const storage = new MemoryStorage()
    const hub = new BroadcastHub()
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      channelFactory: hub.create,
    })
    const notices: GlobalRevocationNotice[] = []
    coordinator.subscribe((notice) => { notices.push(notice) })
    const transportOnly = revocationNotice('learner-lock', Number.MAX_SAFE_INTEGER)

    hub.inject(transportOnly)
    hub.inject(transportOnly)
    await vi.waitFor(() => expect(notices.length).toBe(1))
    expect(notices[0]).toMatchObject({ epoch: 1, cause: 'global-revocation' })
    expect(coordinator.isExhausted()).toBe(false)
    expect(coordinator.currentEpoch()).toBeNull()

    persistNotice(storage, revocationNotice('learner-lock', 1))
    expect(coordinator.currentEpoch()).toBe(1)
    expect(coordinator.isExhausted()).toBe(false)
    const learner = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
    })
    await expect(learner.create(P1)).resolves.toMatchObject({ globalRevocationEpoch: 1 })

    await learner.close()
    coordinator.close()
  })

  it('fails closed at MAX-1 on malformed traffic without fabricating exhaustion', async () => {
    const storage = new MemoryStorage()
    const hub = new BroadcastHub()
    persistNotice(storage, revocationNotice('learner-lock', Number.MAX_SAFE_INTEGER - 1))
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      channelFactory: hub.create,
      lockManager: new RevocationLocks(),
    })
    const notices: GlobalRevocationCause[] = []
    coordinator.subscribe((notice) => { notices.push(notice.cause) })
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    await session.create(P1)
    lifecycleEvents.length = 0

    hub.inject({ malformed: true })
    hub.inject({ malformed: true })
    await vi.waitFor(() => expect(notices).toEqual(['global-revocation']))
    await vi.waitFor(() => expect(lifecycleEvents).toEqual(['global-revocation']))
    await session.whenLifecycleIdle()
    expect(session.session).toBeNull()
    expect(lifecycleEvents).toEqual(['global-revocation'])
    expect(coordinator.currentEpoch()).toBeNull()
    expect(coordinator.isExhausted()).toBe(false)

    await expect(coordinator.revoke('learner-lock')).resolves.toMatchObject({
      epoch: Number.MAX_SAFE_INTEGER,
      cause: 'learner-lock',
    })
    expect(coordinator.isExhausted()).toBe(true)
    expect(JSON.parse(storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY)!)).toMatchObject({
      epoch: Number.MAX_SAFE_INTEGER,
      cause: 'learner-lock',
    })
    expect(notices).toEqual(['global-revocation', 'learner-lock'])

    await session.close()
    coordinator.close()
  })

  it('keeps MAX publication pending until an in-flight learner create compensates and releases ownership', async () => {
    const storage = new MemoryStorage()
    persistNotice(storage, revocationNotice('learner-lock', Number.MAX_SAFE_INTEGER - 1))
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      lockManager: new RevocationLocks(),
    })
    const ownership = new OwnershipLocks()
    let releaseAuthentication!: () => void
    const authentication = new Promise<void>((resolve) => { releaseAuthentication = resolve })
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: ownership,
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: async (event) => {
        if (event.type === 'learner-authenticated') {
          lifecycleEvents.push('learner-authenticated:start')
          await authentication
          lifecycleEvents.push('learner-authenticated:done')
          return
        }
        lifecycleEvents.push(event.type)
      },
    })
    const creating = session.create(P1).then(
      () => null,
      (error: unknown) => error,
    )
    await vi.waitFor(() => expect(lifecycleEvents).toEqual(['learner-authenticated:start']))
    expect(ownership.held).toBe(true)

    let revokeSettled = false
    const revoking = coordinator.revoke('learner-lock').finally(() => { revokeSettled = true })
    await vi.waitFor(() => expect(ownership.held).toBe(false))
    expect(revokeSettled).toBe(false)
    expect(session.session).toBeNull()

    releaseAuthentication()
    const creationError = await creating
    expect(creationError).toBeInstanceOf(Error)
    expect((creationError as Error).message).toContain('revoked before publication')
    await expect(revoking).resolves.toMatchObject({
      epoch: Number.MAX_SAFE_INTEGER,
      cause: 'learner-lock',
    })
    expect(lifecycleEvents).toEqual([
      'learner-authenticated:start',
      'learner-authenticated:done',
      'learner-lock',
    ])
    expect(session.session).toBeNull()
    expect(ownership.held).toBe(false)
    await expect(coordinator.revoke('learner-sign-out')).rejects.toThrow('exhausted')

    await session.close()
    coordinator.close()
  })

  it('does not deadlock terminal revocation inside queued initiating lifecycle cleanup', async () => {
    const storage = new MemoryStorage()
    persistNotice(storage, revocationNotice('learner-lock', Number.MAX_SAFE_INTEGER - 1))
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      lockManager: new RevocationLocks(),
    })
    const sessionStorage = new MemoryStorage()
    const ownership = new OwnershipLocks()
    const notices: GlobalRevocationCause[] = []
    coordinator.subscribe((notice) => { notices.push(notice.cause) })
    let releaseAuthentication!: () => void
    const authentication = new Promise<void>((resolve) => { releaseAuthentication = resolve })
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: sessionStorage,
      revocation: coordinator,
      ownershipLockManager: ownership,
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: async (event) => {
        if (event.type === 'learner-authenticated') {
          lifecycleEvents.push('learner-authenticated:start')
          await authentication
          lifecycleEvents.push('learner-authenticated:done')
          return
        }
        lifecycleEvents.push(event.type)
      },
    })
    const creating = session.create(P1).then(
      () => null,
      (error: unknown) => error,
    )
    await vi.waitFor(() => expect(lifecycleEvents).toEqual(['learner-authenticated:start']))
    expect(ownership.held).toBe(true)

    let executionSettled = false
    const executing = executeLearnerAccessActions([{
      type: 'security-lifecycle',
      event: {
        type: 'learner-lock',
        occurredAt: new Date(START + 60_000).toISOString(),
      },
      studyCancellationReason: 'logout',
      clearLocal: true,
      revokeCause: 'learner-lock',
    }] as const, {
      learnerSession: session,
      revocation: coordinator,
      requestLearnerPin: () => undefined,
    }).finally(() => { executionSettled = true })
    await Promise.resolve()
    expect(executionSettled).toBe(false)

    releaseAuthentication()
    await vi.waitFor(() => expect(executionSettled).toBe(true), { timeout: 500 })
    await expect(executing).resolves.toBeUndefined()
    const creationError = await creating
    expect(creationError).toBeInstanceOf(Error)
    expect((creationError as Error).message).toContain('revoked before publication')
    expect(lifecycleEvents).toEqual([
      'learner-authenticated:start',
      'learner-authenticated:done',
      'learner-lock',
    ])
    expect(coordinator.currentEpoch()).toBe(Number.MAX_SAFE_INTEGER)
    expect(coordinator.isExhausted()).toBe(true)
    expect(JSON.parse(storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY)!)).toMatchObject({
      epoch: Number.MAX_SAFE_INTEGER,
      cause: 'learner-lock',
    })
    expect(notices).toEqual(['learner-lock'])
    expect(session.session).toBeNull()
    expect(sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()
    expect(ownership.held).toBe(false)
    await expect(coordinator.revoke('learner-sign-out')).rejects.toThrow('exhausted')
    expect(lifecycleEvents).toHaveLength(3)

    await session.close()
    coordinator.close()
  })

  it('keeps MAX publication pending until an in-flight learner restore fails closed', async () => {
    const storage = new MemoryStorage()
    const sessionStorage = new MemoryStorage()
    persistNotice(storage, revocationNotice('learner-lock', Number.MAX_SAFE_INTEGER - 1))
    const bootstrapCoordinator = new GlobalRevocationCoordinator({ storage, clock: () => START })
    const bootstrap = new LearnerSessionController({
      storage: sessionStorage,
      revocation: bootstrapCoordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
    })
    await bootstrap.create(P1)
    await bootstrap.close()
    bootstrapCoordinator.close()

    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      lockManager: new RevocationLocks(),
    })
    const ownership = new DeferredOwnershipLocks()
    const lifecycleEvents: string[] = []
    const restored = new LearnerSessionController({
      storage: sessionStorage,
      revocation: coordinator,
      ownershipLockManager: ownership,
      clock: () => START,
      randomUUID: () => UUID_B,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    const restoring = restored.restore()
    await vi.waitFor(() => expect(ownership.requests).toBe(1))

    let revokeSettled = false
    const revoking = coordinator.revoke('learner-lock').finally(() => { revokeSettled = true })
    await vi.waitFor(() => expect(coordinator.isExhausted()).toBe(true))
    expect(revokeSettled).toBe(false)
    ownership.allowRequest()

    await expect(restoring).resolves.toEqual({ status: 'ended', reason: 'global-revocation' })
    await expect(revoking).resolves.toMatchObject({
      epoch: Number.MAX_SAFE_INTEGER,
      cause: 'learner-lock',
    })
    expect(lifecycleEvents).toEqual(['learner-lock'])
    expect(restored.session).toBeNull()
    expect(ownership.held).toBe(false)
    expect(sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()

    await restored.close()
    coordinator.close()
  })

  it('delivers a specific MAX transition once across polling, browser races, repeats, and rollback', async () => {
    const runtime = await setupRemoteRace()
    const notices: GlobalRevocationCause[] = []
    runtime.coordinator.subscribe((notice) => { notices.push(notice.cause) })
    const terminal = revocationNotice('learner-switch-start', Number.MAX_SAFE_INTEGER)
    const ownershipRequests = runtime.ownership.requests
    persistNotice(runtime.storage, terminal)

    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    runtime.hub.inject(terminal)
    runtime.hub.inject(terminal)
    runtime.session.recheck()
    await runtime.session.whenLifecycleIdle()
    await vi.waitFor(() => expect(notices).toEqual(['learner-switch-start']))
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start'])
    expect(runtime.studyCancellations).toEqual(['learner-switch'])

    const rolledBack = revocationNotice('learner-lock', Number.MAX_SAFE_INTEGER - 1)
    persistNotice(runtime.storage, rolledBack)
    runtime.hub.inject(rolledBack)
    runtime.hub.inject(revocationNotice('learner-lock', 1))
    expect(runtime.coordinator.currentEpoch()).toBe(Number.MAX_SAFE_INTEGER)
    await expect(runtime.session.create(P1)).rejects.toThrow('exhausted')
    expect(runtime.ownership.requests).toBe(ownershipRequests)
    expect(notices).toEqual(['learner-switch-start'])
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start'])

    // The denied create() clears end-state bookkeeping; a later restore() must
    // not re-deliver the terminal event the controller has already delivered.
    await expect(runtime.session.restore())
      .resolves.toEqual({ status: 'ended', reason: 'global-revocation' })
    await runtime.session.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start'])
    expect(runtime.studyCancellations).toEqual(['learner-switch'])

    await runtime.session.close()
    runtime.coordinator.close()
  })

  it('delivers malformed MAX fallback generically exactly once', async () => {
    const runtime = await setupRemoteRace()
    const notices: GlobalRevocationCause[] = []
    runtime.coordinator.subscribe((notice) => { notices.push(notice.cause) })
    const malformed = {
      schemaVersion: 1,
      epoch: Number.MAX_SAFE_INTEGER,
      cause: 'attacker-controlled-cause',
      occurredAt: new Date(START).toISOString(),
    }
    runtime.storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, JSON.stringify(malformed))

    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    runtime.hub.inject(malformed)
    runtime.hub.inject(malformed)
    await runtime.session.whenLifecycleIdle()
    await vi.waitFor(() => expect(notices.length).toBeGreaterThanOrEqual(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(notices).toEqual(['global-revocation'])
    expect(runtime.lifecycleEvents).toEqual(['global-revocation'])
    expect(runtime.studyCancellations).toEqual(['authorization-loss'])

    await expect(runtime.session.create(P1)).rejects.toThrow('exhausted')
    await expect(runtime.session.restore())
      .resolves.toEqual({ status: 'ended', reason: 'global-revocation' })
    await runtime.session.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['global-revocation'])
    expect(runtime.studyCancellations).toEqual(['authorization-loss'])

    await runtime.session.close()
    runtime.coordinator.close()
  })

  it('delivers legacy MAX without a cause envelope generically exactly once', async () => {
    const runtime = await setupRemoteRace()
    const notices: GlobalRevocationCause[] = []
    runtime.coordinator.subscribe((notice) => { notices.push(notice.cause) })
    const legacyMaximum = String(Number.MAX_SAFE_INTEGER)
    runtime.storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, legacyMaximum)

    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    runtime.hub.inject(legacyMaximum)
    runtime.hub.inject(legacyMaximum)
    await runtime.session.whenLifecycleIdle()
    await vi.waitFor(() => expect(notices.length).toBeGreaterThanOrEqual(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(notices).toEqual(['global-revocation'])
    expect(runtime.lifecycleEvents).toEqual(['global-revocation'])
    expect(runtime.studyCancellations).toEqual(['authorization-loss'])

    // A legacy numeric MAX carries no envelope, so notice identity can never
    // dedupe it. Only the controller-lifetime latch can.
    await expect(runtime.session.create(P1)).rejects.toThrow('exhausted')
    await expect(runtime.session.restore())
      .resolves.toEqual({ status: 'ended', reason: 'global-revocation' })
    await runtime.session.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['global-revocation'])
    expect(runtime.studyCancellations).toEqual(['authorization-loss'])

    await runtime.session.close()
    runtime.coordinator.close()
  })

  it('denies learner restoration at MAX before claiming ownership and removes the candidate', async () => {
    const deviceStorage = new MemoryStorage()
    const sessionStorage = new MemoryStorage()
    const bootstrapCoordinator = new GlobalRevocationCoordinator({ storage: deviceStorage, clock: () => START })
    const bootstrapSession = new LearnerSessionController({
      storage: sessionStorage,
      revocation: bootstrapCoordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
    })
    await bootstrapSession.create(P1)
    await bootstrapSession.close()
    bootstrapCoordinator.close()
    persistNotice(
      deviceStorage,
      revocationNotice('learner-credential-reset', Number.MAX_SAFE_INTEGER),
    )

    const coordinator = new GlobalRevocationCoordinator({ storage: deviceStorage, clock: () => START })
    const ownership = new OwnershipLocks()
    const lifecycleEvents: GlobalRevocationCause[] = []
    const restored = new LearnerSessionController({
      storage: sessionStorage,
      revocation: coordinator,
      ownershipLockManager: ownership,
      clock: () => START,
      randomUUID: () => UUID_B,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type as GlobalRevocationCause) },
    })

    await expect(restored.restore()).resolves.toEqual({ status: 'ended', reason: 'global-revocation' })
    await restored.whenLifecycleIdle()
    expect(ownership.requests).toBe(0)
    expect(restored.session).toBeNull()
    expect(sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()
    expect(lifecycleEvents).toEqual(['learner-credential-reset'])

    await expect(restored.create(P1)).rejects.toThrow('exhausted')
    await expect(restored.restore())
      .resolves.toEqual({ status: 'ended', reason: 'global-revocation' })
    await restored.whenLifecycleIdle()
    expect(lifecycleEvents).toEqual(['learner-credential-reset'])
    expect(ownership.requests).toBe(0)

    await restored.close()
    coordinator.close()
  })

  it('clears existing Parent authority and denies replacement when MAX is observed', async () => {
    const storage = new MemoryStorage()
    const coordinator = new GlobalRevocationCoordinator({ storage, clock: () => START })
    const lifecycleEvents: string[] = []
    const parent = new ParentSessionController({
      revocation: coordinator,
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    parent.create('parent-a', 'household-a')
    lifecycleEvents.length = 0
    persistNotice(storage, revocationNotice('household-sign-out', Number.MAX_SAFE_INTEGER))

    expect(() => parent.create('parent-b', 'household-b')).toThrow('exhausted')
    expect(parent.session).toBeNull()
    await parent.whenLifecycleIdle()
    expect(lifecycleEvents).toEqual(['household-sign-out'])

    parent.close()
    coordinator.close()
  })

  it('does not overflow or settle revoke-at-MAX until active authority cleanup completes', async () => {
    const storage = new MemoryStorage()
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      lockManager: new RevocationLocks(),
    })
    let releaseCleanup!: () => void
    const cleanup = new Promise<void>((resolve) => { releaseCleanup = resolve })
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => {
        lifecycleEvents.push(event.type)
        if (event.type === 'learner-lock') return cleanup
      },
    })
    await session.create(P1)
    lifecycleEvents.length = 0
    const terminal = revocationNotice('learner-lock', Number.MAX_SAFE_INTEGER)
    const serializedTerminal = JSON.stringify(terminal)
    storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, serializedTerminal)

    let settled = false
    const attempted = coordinator.revoke('learner-sign-out').then(
      () => null,
      (error: unknown) => error,
    ).finally(() => { settled = true })
    await vi.waitFor(() => expect(lifecycleEvents).toEqual(['learner-lock']))
    await Promise.resolve()
    expect(session.session).toBeNull()
    expect(settled).toBe(false)
    expect(storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY)).toBe(serializedTerminal)

    releaseCleanup()
    const error = await attempted
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('exhausted')
    expect(settled).toBe(true)
    expect(JSON.parse(storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY)!)).toMatchObject({
      epoch: Number.MAX_SAFE_INTEGER,
      cause: 'learner-lock',
    })

    await session.close()
    coordinator.close()
  })

  it('delivers one exact cancellation when polling and browser delivery race behind a slow subscriber', async () => {
    const storage = new MemoryStorage()
    const hub = new BroadcastHub()
    const coordinator = new GlobalRevocationCoordinator({
      storage,
      clock: () => START,
      channelFactory: hub.create,
    })
    let releaseSlowSubscriber!: () => void
    const slowSubscriber = new Promise<void>((resolve) => { releaseSlowSubscriber = resolve })
    coordinator.subscribe(() => slowSubscriber)
    const lifecycleEvents: string[] = []
    const session = new LearnerSessionController({
      storage: new MemoryStorage(),
      revocation: coordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    let coordinatorDeliveryDrained = false
    coordinator.subscribe(() => { coordinatorDeliveryDrained = true })
    await session.create(P1)
    lifecycleEvents.length = 0
    const notice = revocationNotice('learner-lock')
    persistNotice(storage, notice)

    expect(session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    hub.inject(notice)
    await session.whenLifecycleIdle()
    expect(lifecycleEvents).toEqual(['learner-lock'])

    releaseSlowSubscriber()
    await vi.waitFor(() => expect(coordinatorDeliveryDrained).toBe(true))
    expect(lifecycleEvents).toEqual(['learner-lock'])
    await session.close()
    coordinator.close()
  })

  it('uses the durable envelope when a browser message claims a conflicting specific cause', async () => {
    const runtime = await setupRemoteRace()
    const durable = revocationNotice('learner-switch-start')
    persistNotice(runtime.storage, durable)

    runtime.hub.inject(revocationNotice('learner-lock'))
    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await runtime.session.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start'])
    expect(runtime.studyCancellations).toEqual(['learner-switch'])

    await runtime.session.close()
    runtime.coordinator.close()
  })

  it('recovers a valid durable cause when the browser message is malformed', async () => {
    const runtime = await setupRemoteRace()
    const durable = revocationNotice('learner-credential-reset')
    persistNotice(runtime.storage, durable)

    runtime.hub.inject({ malformed: true })
    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await runtime.session.whenLifecycleIdle()
    expect(runtime.lifecycleEvents).toEqual(['learner-credential-reset'])
    expect(runtime.studyCancellations).toEqual(['authorization-loss'])

    await runtime.session.close()
    runtime.coordinator.close()
  })

  it('restores a stale same-tab record with the current durable cause without revoking a fresh session', async () => {
    const deviceStorage = new MemoryStorage()
    const sessionStorage = new MemoryStorage()
    const initialCoordinator = new GlobalRevocationCoordinator({
      storage: deviceStorage,
      clock: () => START,
    })
    const initialSession = new LearnerSessionController({
      storage: sessionStorage,
      revocation: initialCoordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
    })
    await initialSession.create(P1)
    await initialSession.close()
    initialCoordinator.close()
    persistNotice(deviceStorage, revocationNotice('learner-lock'))

    const restoredCoordinator = new GlobalRevocationCoordinator({
      storage: deviceStorage,
      clock: () => START,
    })
    const lifecycleEvents: string[] = []
    const restoredSession = new LearnerSessionController({
      storage: sessionStorage,
      revocation: restoredCoordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_B,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })

    await expect(restoredSession.restore()).resolves.toEqual({
      status: 'ended',
      reason: 'global-revocation',
    })
    expect(lifecycleEvents).toEqual(['learner-lock'])

    await restoredSession.create(P1)
    expect(restoredSession.recheck().status).toBe('active')

    await restoredSession.close()
    restoredCoordinator.close()
  })

  it('preserves the exact durable household cause for Parent polling', async () => {
    const storage = new MemoryStorage()
    const coordinator = new GlobalRevocationCoordinator({ storage, clock: () => START })
    const lifecycleEvents: string[] = []
    const parent = new ParentSessionController({
      revocation: coordinator,
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => { lifecycleEvents.push(event.type) },
    })
    parent.create('parent-a', 'household-a')
    persistNotice(storage, revocationNotice('household-sign-out'))

    expect(parent.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    await parent.whenLifecycleIdle()
    expect(lifecycleEvents).toEqual(['household-sign-out'])

    parent.close()
    coordinator.close()
  })

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

  it.each([
    [{ type: 'lock', occurredAt: new Date(START).toISOString() }, 'learner-lock', 'logout'],
    [{ type: 'logout', occurredAt: new Date(START).toISOString() }, 'learner-sign-out', 'logout'],
    [{
      type: 'learner-switch',
      targetProfileId: P2,
      occurredAt: new Date(START).toISOString(),
    }, 'learner-switch-start', 'learner-switch'],
    [{
      type: 'authorization-loss',
      source: 'learner-credential-reset',
      occurredAt: new Date(START).toISOString(),
    }, 'learner-credential-reset', 'authorization-loss'],
  ] as const)(
    'emits one initiating-tab cancellation for %s and preserves remote cause',
    async (event, expectedCause, expectedReason) => {
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
      const localAutonomous: StudyCancellationReason[] = []
      const remoteSpecific: StudyCancellationReason[] = []
      const remoteCauses: string[] = []
      remoteCoordinator.subscribe((notice) => { remoteCauses.push(notice.cause) })
      const local = new LearnerSessionController({
        storage: new MemoryStorage(),
        revocation: localCoordinator,
        ownershipLockManager: new OwnershipLocks(),
        clock: () => START,
        randomUUID: () => UUID_A,
        onLifecycleEvent: (lifecycleEvent) => cancelStudyForSecurityLifecycleEvent(lifecycleEvent, {
          cancel: (reason) => { localAutonomous.push(reason) },
        }),
      })
      const remote = new LearnerSessionController({
        storage: new MemoryStorage(),
        revocation: remoteCoordinator,
        ownershipLockManager: new OwnershipLocks(),
        clock: () => START,
        randomUUID: () => UUID_B,
        onLifecycleEvent: (lifecycleEvent) => cancelStudyForSecurityLifecycleEvent(lifecycleEvent, {
          cancel: (reason) => { remoteSpecific.push(reason) },
        }),
      })
      const localRecord = await local.create(P1)
      await remote.create(P1)
      localAutonomous.length = 0
      remoteSpecific.length = 0

      const transition = transitionLearnerAccess({
        status: 'active', profileId: P1, sessionId: localRecord.sessionId,
      }, event as LearnerAccessEvent)
      await executeLearnerAccessActions(transition.actions, {
        learnerSession: local,
        revocation: localCoordinator,
        requestLearnerPin: () => undefined,
      })
      await remote.whenLifecycleIdle()

      expect(localAutonomous).toEqual([expectedReason])
      expect(remoteSpecific).toEqual([expectedReason])
      expect(remoteCauses).toEqual([expectedCause])
      expect(remote.session).toBeNull()

      await local.close()
      await remote.close()
      localCoordinator.close()
      remoteCoordinator.close()
    },
  )

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

  it('blocks and terminally fails remote replacement authority when exact-cause cleanup rejects', async () => {
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
    const localStorage = new MemoryStorage()
    const remoteStorage = new MemoryStorage()
    const remoteEvents: string[] = []
    let rejectRemoteCancellation!: (error: Error) => void
    const remoteCancellation = new Promise<void>((_resolve, reject) => {
      rejectRemoteCancellation = reject
    })
    const local = new LearnerSessionController({
      storage: localStorage,
      revocation: localCoordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_A,
      onLifecycleEvent: (event) => cancelStudyForSecurityLifecycleEvent(event, {
        cancel: () => undefined,
      }),
    })
    const remote = new LearnerSessionController({
      storage: remoteStorage,
      revocation: remoteCoordinator,
      ownershipLockManager: new OwnershipLocks(),
      clock: () => START,
      randomUUID: () => UUID_B,
      onLifecycleEvent: (event) => {
        remoteEvents.push(event.type)
        return cancelStudyForSecurityLifecycleEvent(event, {
          cancel: () => remoteCancellation,
        })
      },
    })
    const localRecord = await local.create(P1)
    await remote.create(P1)
    remoteEvents.length = 0

    const transition = transitionLearnerAccess({
      status: 'active', profileId: P1, sessionId: localRecord.sessionId,
    }, {
      type: 'learner-switch',
      targetProfileId: P2,
      occurredAt: new Date(START + 60_000).toISOString(),
    })
    await executeLearnerAccessActions(transition.actions, {
      learnerSession: local,
      revocation: localCoordinator,
      requestLearnerPin: () => undefined,
    })
    await vi.waitFor(() => expect(remoteEvents).toEqual(['learner-switch-start']))

    let createSettled = false
    const replacement = remote.create(P2).finally(() => { createSettled = true })
    await Promise.resolve()
    expect(createSettled).toBe(false)
    expect(remote.session).toBeNull()
    expect(remoteStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()

    rejectRemoteCancellation(new Error('Remote Study cancellation failed'))
    await expect(replacement).rejects.toThrow('Security lifecycle delivery failed closed')
    expect(remote.lifecycleDeliveryFailed).toBe(true)
    await expect(remote.restore()).resolves.toEqual({ status: 'ended', reason: 'lifecycle-failed' })

    await local.close()
    await remote.close()
    localCoordinator.close()
    remoteCoordinator.close()
  })
})
