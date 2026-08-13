import { describe, expect, it, vi } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import { createLocalSessionId } from '../contracts/sessions'
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

class OwnershipLocks implements LearnerSessionOwnershipLockManager {
  readonly #held = new Set<string>()

  request<T>(
    name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LearnerSessionOwnershipLock | null) => T | Promise<T>,
  ): Promise<T> {
    if (this.#held.has(name)) return Promise.resolve(callback(null))
    this.#held.add(name)
    return Promise.resolve(callback({ name })).finally(() => { this.#held.delete(name) })
  }

  get count(): number { return this.#held.size }
}

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function setupRuntime() {
  const sessionStorage = new MemoryStorage()
  const deviceStorage = new MemoryStorage()
  const ownershipLocks = new OwnershipLocks()
  const revocationLocks = new SerialRevocationLocks()
  const cleanup = deferred()
  const trace: string[] = []
  const lifecycleEvents: string[] = []
  const revocation = new GlobalRevocationCoordinator({
    storage: deviceStorage,
    clock: () => START,
    lockManager: revocationLocks,
  })
  const uuids = [UUID_A, UUID_B]
  const session = new LearnerSessionController({
    storage: sessionStorage,
    revocation,
    ownershipLockManager: ownershipLocks,
    clock: () => START,
    randomUUID: () => uuids.shift() ?? UUID_B,
    onLifecycleEvent: async (event) => {
      lifecycleEvents.push(event.type)
      await cancelStudyForSecurityLifecycleEvent(event, {
        cancel: async (reason) => {
          trace.push(`cancel-start:${reason}`)
          await cleanup.promise
          trace.push(`cancel-done:${reason}`)
        },
      })
    },
  })
  const record = await session.create(P1)
  trace.length = 0
  lifecycleEvents.length = 0
  revocation.subscribe((notice) => { trace.push(`revoke:${notice.cause}`) })
  const learnerSessionPort = {
    clearLocal: async () => {
      await session.clearLocal()
      trace.push('clear')
    },
    deliverLifecycle: session.deliverLifecycle.bind(session),
  }
  const active = { status: 'active' as const, profileId: P1, sessionId: record.sessionId }
  const execute = (
    event: LearnerAccessEvent,
    requestLearnerPin: () => void | Promise<void> = () => undefined,
  ) => executeLearnerAccessActions(transitionLearnerAccess(active, event).actions, {
    learnerSession: learnerSessionPort,
    revocation,
    requestLearnerPin,
  })
  return {
    session,
    sessionStorage,
    deviceStorage,
    ownershipLocks,
    revocationLocks,
    revocation,
    cleanup,
    trace,
    lifecycleEvents,
    learnerSessionPort,
    execute,
  }
}

async function beginSwitch(runtime: Awaited<ReturnType<typeof setupRuntime>>, onPin = () => undefined) {
  const execution = runtime.execute({
    type: 'learner-switch',
    targetProfileId: P2,
    occurredAt: new Date(START + 60_000).toISOString(),
  }, onPin)
  await vi.waitFor(() => expect(runtime.trace).toEqual([
    'clear',
    'revoke:learner-switch-start',
    'cancel-start:learner-switch',
  ]))
  return { execution }
}

async function closeRuntime(runtime: Awaited<ReturnType<typeof setupRuntime>>) {
  await runtime.session.close()
  runtime.revocation.close()
}

describe('composed initiating lifecycle barrier', () => {
  it('blocks concurrent create without p2 authority until the real switch cleanup completes', async () => {
    const runtime = await setupRuntime()
    const { execution } = await beginSwitch(runtime)
    let settled = false
    const create = runtime.session.create(P2).finally(() => { settled = true })
    await Promise.resolve()

    expect(settled).toBe(false)
    expect(runtime.session.session).toBeNull()
    expect(runtime.sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()
    expect(runtime.ownershipLocks.count).toBe(0)
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start'])

    runtime.cleanup.resolve()
    await execution
    await expect(create).resolves.toMatchObject({ profileId: 'p2' })
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start', 'learner-authenticated'])
    await closeRuntime(runtime)
  })

  it('refuses a direct create() over the live learner and admits it after the reviewed switch', async () => {
    const runtime = await setupRuntime()
    expect(runtime.session.session).toMatchObject({ profileId: 'p1' })
    const serialized = runtime.sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)

    // create() is not a switch: it may not quietly retire live learner authority.
    await expect(runtime.session.create(P2)).rejects.toThrow('An active learner session must end')
    expect(runtime.session.session).toMatchObject({ profileId: 'p1' })
    expect(runtime.sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBe(serialized)
    expect(runtime.lifecycleEvents).toEqual([])
    expect(runtime.trace).toEqual([])

    // The reviewed path ends the previous learner, with cancellation and revocation.
    const { execution } = await beginSwitch(runtime)
    runtime.cleanup.resolve()
    await execution
    await expect(runtime.session.create(P2)).resolves.toMatchObject({ profileId: 'p2' })
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start', 'learner-authenticated'])
    await closeRuntime(runtime)
  })

  it('blocks restore while the real switch cleanup is pending', async () => {
    const runtime = await setupRuntime()
    const { execution } = await beginSwitch(runtime)
    let settled = false
    const restore = runtime.session.restore().finally(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(runtime.session.session).toBeNull()

    runtime.cleanup.resolve()
    await execution
    await expect(restore).resolves.toEqual({ status: 'ended', reason: 'none' })
    await closeRuntime(runtime)
  })

  it('blocks authentication publication behind the real switch cleanup', async () => {
    const runtime = await setupRuntime()
    const { execution } = await beginSwitch(runtime)
    const publication = executeLearnerAccessActions(transitionLearnerAccess({
      status: 'locked', reason: 'switch-cancelled',
    }, {
      type: 'authenticated',
      profileId: P2,
      sessionId: createLocalSessionId(() => UUID_B),
      occurredAt: new Date(START + 61_000).toISOString(),
    }).actions, {
      learnerSession: runtime.learnerSessionPort,
      revocation: runtime.revocation,
      requestLearnerPin: () => undefined,
    })
    await Promise.resolve()
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start'])

    runtime.cleanup.resolve()
    await execution
    await publication
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start', 'learner-authenticated'])
    await closeRuntime(runtime)
  })

  it('blocks pending-route resume and Study start until switch cleanup succeeds', async () => {
    const runtime = await setupRuntime()
    const continuation: string[] = []
    const { execution } = await beginSwitch(runtime, () => {
      continuation.push('route-resume', 'study-start')
    })
    expect(continuation).toEqual([])

    runtime.cleanup.resolve()
    await execution
    expect(continuation).toEqual(['route-resume', 'study-start'])
    expect(runtime.trace).toEqual([
      'clear',
      'revoke:learner-switch-start',
      'cancel-start:learner-switch',
      'cancel-done:learner-switch',
    ])
    await closeRuntime(runtime)
  })

  it('latches rejected real switch cleanup and permanently rejects replacement authority', async () => {
    const runtime = await setupRuntime()
    let pinRequested = false
    const { execution } = await beginSwitch(runtime, () => { pinRequested = true })
    runtime.cleanup.reject(new Error('Study cancellation failed'))

    await expect(execution).rejects.toThrow('Security lifecycle delivery failed closed')
    expect(pinRequested).toBe(false)
    expect(runtime.session.session).toBeNull()
    expect(runtime.sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()
    expect(runtime.ownershipLocks.count).toBe(0)
    expect(runtime.session.lifecycleDeliveryFailed).toBe(true)
    await expect(runtime.session.create(P2)).rejects.toThrow('Security lifecycle delivery failed closed')
    await expect(runtime.session.restore()).resolves.toEqual({ status: 'ended', reason: 'lifecycle-failed' })

    const publication = transitionLearnerAccess({ status: 'locked', reason: 'switch-cancelled' }, {
      type: 'authenticated',
      profileId: P2,
      sessionId: createLocalSessionId(() => UUID_B),
      occurredAt: new Date(START + 61_000).toISOString(),
    })
    await expect(executeLearnerAccessActions(publication.actions, {
      learnerSession: runtime.learnerSessionPort,
      revocation: runtime.revocation,
      requestLearnerPin: () => undefined,
    })).rejects.toThrow('Security lifecycle delivery failed closed')
    expect(runtime.lifecycleEvents).toEqual(['learner-switch-start'])
    await closeRuntime(runtime)
  })

  it.each([
    [{ type: 'lock', occurredAt: new Date(START + 60_000).toISOString() }, 'learner-lock', 'logout'],
    [{ type: 'logout', occurredAt: new Date(START + 60_000).toISOString() }, 'learner-sign-out', 'logout'],
    [{
      type: 'authorization-loss',
      source: 'learner-credential-reset',
      occurredAt: new Date(START + 60_000).toISOString(),
    }, 'learner-credential-reset', 'authorization-loss'],
    [{
      type: 'authorization-loss',
      source: 'provenance-loss',
      occurredAt: new Date(START + 60_000).toISOString(),
    }, 'provenance-loss', 'authorization-loss'],
  ] as const)(
    'routes pending and rejected %s cleanup through the shared terminal barrier',
    async (event, cause, reason) => {
      const runtime = await setupRuntime()
      const execution = runtime.execute(event as LearnerAccessEvent)
      await vi.waitFor(() => expect(runtime.trace).toEqual([
        'clear',
        `revoke:${cause}`,
        `cancel-start:${reason}`,
      ]))
      let createSettled = false
      const create = runtime.session.create(P2).finally(() => { createSettled = true })
      await Promise.resolve()
      expect(createSettled).toBe(false)
      expect(runtime.session.session).toBeNull()
      expect(runtime.sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()

      runtime.cleanup.reject(new Error('Study cancellation failed'))
      await expect(execution).rejects.toThrow('Security lifecycle delivery failed closed')
      await expect(create).rejects.toThrow('Security lifecycle delivery failed closed')
      expect(runtime.session.lifecycleDeliveryFailed).toBe(true)
      expect(runtime.lifecycleEvents).toEqual([cause])
      await closeRuntime(runtime)
    },
  )

  it('clears explicit global-revocation authorization loss inside the shared barrier', async () => {
    const runtime = await setupRuntime()
    const execution = runtime.execute({
      type: 'authorization-loss',
      source: 'global-revocation',
      occurredAt: new Date(START + 60_000).toISOString(),
    })
    await vi.waitFor(() => expect(runtime.trace).toEqual([
      'clear',
      'cancel-start:authorization-loss',
    ]))
    let createSettled = false
    const create = runtime.session.create(P2).finally(() => { createSettled = true })
    await Promise.resolve()
    expect(createSettled).toBe(false)
    expect(runtime.sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()

    runtime.cleanup.reject(new Error('Study cancellation failed'))
    await expect(execution).rejects.toThrow('Security lifecycle delivery failed closed')
    await expect(create).rejects.toThrow('Security lifecycle delivery failed closed')
    expect(runtime.session.lifecycleDeliveryFailed).toBe(true)
    expect(runtime.lifecycleEvents).toEqual(['global-revocation'])
    await closeRuntime(runtime)
  })

  it('keeps switch/create cleanup lock order acyclic', async () => {
    const runtime = await setupRuntime()
    const { execution } = await beginSwitch(runtime)
    const create = runtime.session.create(P2)
    expect(runtime.revocationLocks.active).toBe(0)
    expect(runtime.ownershipLocks.count).toBe(0)

    runtime.cleanup.resolve()
    await execution
    await create
    expect(runtime.revocationLocks.maximumActive).toBe(1)
    expect(runtime.ownershipLocks.count).toBe(1)
    await closeRuntime(runtime)
  })
})
