import { describe, expect, it, vi } from 'vitest'
import { SECURITY_SESSION_POLICY } from '../contracts/sessionPolicy'
import { ParentSessionController } from './parentSession'
import { ParentStepUpController } from './parentStepUp'
import {
  GLOBAL_REVOCATION_STORAGE_KEY,
  GlobalRevocationCoordinator,
  type GlobalRevocationCause,
  type GlobalRevocationNotice,
} from './revocation'
import type { SecurityStorage } from './runtime'

const START = Date.parse('2026-08-09T12:00:00.000Z')
const UUID_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const UUID_B = 'b3d48c11-53bb-4d8f-bb8b-d2f311abf5ef'

class MemoryStorage implements SecurityStorage {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
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

function setupParentRuntime() {
  const storage = new MemoryStorage()
  let now = START
  const cleanup = deferred()
  const lifecycleEvents: string[] = []
  const revocation = new GlobalRevocationCoordinator({ storage, clock: () => now })
  const parent = new ParentSessionController({
    revocation,
    clock: () => now,
    // Constant on purpose: a repeated session ID must not let a replacement
    // session inherit an earlier grant.
    randomUUID: () => UUID_A,
    onLifecycleEvent: async (event) => {
      lifecycleEvents.push(event.type)
      await cleanup.promise
    },
  })
  const stepUp = new ParentStepUpController({
    parentSession: parent,
    clock: () => now,
    randomUUID: () => UUID_B,
  })
  return {
    parent,
    stepUp,
    revocation,
    storage,
    cleanup,
    lifecycleEvents,
    advance: (value: number) => { now += value },
    close: () => {
      parent.close()
      revocation.close()
    },
  }
}

describe('Parent authority lifecycle barrier', () => {
  it('refuses replacement Parent authority while parent-lock cleanup is pending', async () => {
    const runtime = setupParentRuntime()
    runtime.parent.create('parent-a', 'household-a')

    runtime.parent.lock()
    expect(runtime.parent.session).toBeNull()

    expect(() => runtime.parent.create('parent-b', 'household-b'))
      .toThrow('Parent lifecycle cleanup is pending')
    expect(runtime.parent.session).toBeNull()
    expect(runtime.parent.lifecycleCleanupPending).toBe(true)

    await vi.waitFor(() => expect(runtime.lifecycleEvents).toEqual(['parent-lock']))
    expect(() => runtime.parent.create('parent-b', 'household-b'))
      .toThrow('Parent lifecycle cleanup is pending')

    runtime.cleanup.resolve()
    await runtime.parent.whenLifecycleIdle()

    expect(runtime.parent.lifecycleCleanupPending).toBe(false)
    expect(runtime.parent.lifecycleDeliveryFailed).toBe(false)
    expect(runtime.parent.create('parent-b', 'household-b')).toMatchObject({
      storage: 'memory-only',
      verifiedParentActorId: 'parent-b',
    })
    expect(runtime.lifecycleEvents).toEqual(['parent-lock'])
    runtime.close()
  })

  it.each([
    ['household-switch'],
    ['household-sign-out'],
    ['learner-credential-reset'],
    ['provenance-loss'],
  ] as const)(
    'routes the %s authority-ending event through the same Parent barrier',
    async (cause) => {
      const runtime = setupParentRuntime()
      runtime.parent.create('parent-a', 'household-a')
      persistNotice(runtime.storage, revocationNotice(cause))

      expect(runtime.parent.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
      expect(() => runtime.parent.create('parent-b', 'household-b'))
        .toThrow('Parent lifecycle cleanup is pending')
      expect(runtime.parent.session).toBeNull()
      expect(runtime.parent.lifecycleCleanupPending).toBe(true)

      runtime.cleanup.resolve()
      await runtime.parent.whenLifecycleIdle()
      expect(runtime.lifecycleEvents).toEqual([cause])
      expect(runtime.parent.create('parent-b', 'household-b')).toMatchObject({
        globalRevocationEpoch: 1,
      })
      runtime.close()
    },
  )

  it('blocks step-up issuance and consumption while Parent cleanup is pending', async () => {
    const runtime = setupParentRuntime()
    runtime.parent.create('parent-a', 'household-a')
    expect(runtime.stepUp.issue('replace-dataset:operation-1')).toMatchObject({
      parentSessionId: UUID_A,
      operationUseLimit: 1,
    })

    runtime.parent.lock()

    // The full exploit: replacement authority first, then a grant under it.
    expect(() => runtime.parent.create('parent-b', 'household-b'))
      .toThrow('Parent lifecycle cleanup is pending')
    expect(() => runtime.stepUp.issue('replace-dataset:operation-2'))
      .toThrow('Parent lifecycle cleanup is pending')
    expect(runtime.stepUp.consume('replace-dataset:operation-1')).toBe(false)
    expect(runtime.stepUp.grant).toBeNull()
    expect(runtime.parent.lifecycleCleanupPending).toBe(true)

    runtime.cleanup.resolve()
    await runtime.parent.whenLifecycleIdle()

    // Only a later fresh Parent authentication may mint step-up again.
    runtime.parent.create('parent-b', 'household-b')
    expect(runtime.stepUp.issue('replace-dataset:operation-2')).toMatchObject({
      operationId: 'replace-dataset:operation-2',
    })
    expect(runtime.stepUp.consume('replace-dataset:operation-2')).toBe(true)
    runtime.close()
  })

  it('permanently latches rejected Parent cleanup against replacement authority', async () => {
    const runtime = setupParentRuntime()
    runtime.parent.create('parent-a', 'household-a')
    runtime.parent.lock()
    await vi.waitFor(() => expect(runtime.lifecycleEvents).toEqual(['parent-lock']))

    runtime.cleanup.reject(new Error('Study cancellation failed'))
    await runtime.parent.whenLifecycleIdle()

    expect(() => runtime.parent.create('parent-b', 'household-b'))
      .toThrow('Parent lifecycle delivery failed closed')
    expect(runtime.parent.session).toBeNull()
    expect(runtime.parent.lifecycleDeliveryFailed).toBe(true)
    expect(runtime.parent.recheck()).toEqual({ status: 'ended', reason: 'lifecycle-failed' })

    // No recovery API, and neither elapsed time nor activity may clear it.
    expect((runtime.parent as unknown as Record<string, unknown>).resetFailure).toBeUndefined()
    runtime.advance(SECURITY_SESSION_POLICY.parent.absoluteTimeoutMs)
    expect(runtime.parent.noteMeaningfulActivity())
      .toEqual({ status: 'ended', reason: 'lifecycle-failed' })
    expect(runtime.parent.lifecycleDeliveryFailed).toBe(true)
    expect(() => runtime.parent.create('parent-b', 'household-b'))
      .toThrow('Parent lifecycle delivery failed closed')
    runtime.close()
  })

  it('denies step-up issuance and outstanding consumption after terminal Parent failure', async () => {
    const runtime = setupParentRuntime()
    runtime.parent.create('parent-a', 'household-a')
    const grant = runtime.stepUp.issue('replace-dataset:operation-1')
    expect(grant.grantId).toBe(UUID_B)

    // End Parent authority through revocation so the grant is outstanding when
    // the cleanup that removes that authority fails.
    persistNotice(runtime.storage, revocationNotice('household-sign-out'))
    expect(runtime.parent.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    runtime.cleanup.reject(new Error('Study cancellation failed'))
    await runtime.parent.whenLifecycleIdle()

    expect(runtime.parent.lifecycleDeliveryFailed).toBe(true)
    expect(() => runtime.stepUp.issue('replace-dataset:operation-2'))
      .toThrow('Parent lifecycle delivery failed closed')
    expect(runtime.stepUp.consume('replace-dataset:operation-1')).toBe(false)
    expect(runtime.stepUp.grant).toBeNull()
    runtime.close()
  })

  it.each([
    ['lock', (parent: ParentSessionController) => { parent.lock() }],
    ['idle expiry', (parent: ParentSessionController, advance: (value: number) => void) => {
      advance(SECURITY_SESSION_POLICY.parent.idleTimeoutMs)
      parent.recheck()
    }],
    ['absolute expiry', (parent: ParentSessionController, advance: (value: number) => void) => {
      advance(SECURITY_SESSION_POLICY.parent.absoluteTimeoutMs)
      parent.recheck()
    }],
  ] as const)('invalidates an outstanding step-up when the Parent session ends by %s', (_label, end) => {
    const runtime = setupParentRuntime()
    runtime.parent.create('parent-a', 'household-a')
    runtime.stepUp.issue('replace-dataset:operation-1')

    end(runtime.parent, runtime.advance)

    expect(runtime.stepUp.grant).toBeNull()
    expect(runtime.stepUp.consume('replace-dataset:operation-1')).toBe(false)
    runtime.close()
  })

  it('arms the cleanup barrier before any end subscriber runs', () => {
    const runtime = setupParentRuntime()
    runtime.parent.create('parent-a', 'household-a')

    let pendingInsideCallback: boolean | null = null
    let reentrantCreate = 'not-attempted'
    runtime.parent.subscribeEnded(() => {
      pendingInsideCallback = runtime.parent.lifecycleCleanupPending
      try {
        runtime.parent.create('parent-b', 'household-b')
        reentrantCreate = 'allowed'
      } catch (error) {
        reentrantCreate = (error as Error).message
      }
    })

    runtime.parent.lock()

    expect(pendingInsideCallback).toBe(true)
    expect(reentrantCreate).toBe('Parent lifecycle cleanup is pending.')
    expect(runtime.parent.session).toBeNull()
    runtime.cleanup.resolve()
    runtime.close()
  })

  it('denies a reentrant create() from a subscriber on the replacement transition too', () => {
    const runtime = setupParentRuntime()
    runtime.parent.create('parent-a', 'household-a')

    let reentrantCreate = 'not-attempted'
    runtime.parent.subscribeEnded(() => {
      try {
        runtime.parent.create('parent-c', 'household-c')
        reentrantCreate = 'allowed'
      } catch (error) {
        reentrantCreate = (error as Error).message
      }
    })

    // The replacement transition emits no lifecycle event, so the queue alone
    // cannot deny reentrancy here.
    const replacement = runtime.parent.create('parent-b', 'household-b')

    expect(reentrantCreate).toBe('Parent lifecycle cleanup is pending.')
    expect(runtime.parent.session).toBe(replacement)
    expect(replacement.verifiedParentActorId).toBe('parent-b')
    runtime.close()
  })

  it('contains a throwing end subscriber without abandoning cleanup', async () => {
    const runtime = setupParentRuntime()
    const observed: string[] = []
    runtime.parent.subscribeEnded(() => {
      observed.push('A')
      throw new Error('subscriber exploded')
    })
    runtime.parent.subscribeEnded(() => { observed.push('B') })
    runtime.parent.create('parent-a', 'household-a')
    runtime.stepUp.issue('replace-dataset:operation-1')

    expect(() => runtime.parent.lock()).not.toThrow()

    // A throwing listener stops neither the later listeners nor the barrier.
    expect(observed).toEqual(['A', 'B'])
    expect(runtime.parent.session).toBeNull()
    expect(runtime.parent.lifecycleCleanupPending).toBe(true)
    expect(runtime.stepUp.grant).toBeNull()
    expect(() => runtime.parent.create('parent-b', 'household-b'))
      .toThrow('Parent lifecycle cleanup is pending')

    await vi.waitFor(() => expect(runtime.lifecycleEvents).toEqual(['parent-lock']))
    runtime.cleanup.resolve()
    await runtime.parent.whenLifecycleIdle()

    // Legitimate re-authentication is available only once cleanup succeeded.
    expect(runtime.parent.create('parent-b', 'household-b')).toMatchObject({
      verifiedParentActorId: 'parent-b',
    })
    runtime.close()
  })

  it('keeps cleanup failure terminal even when an end subscriber threw', async () => {
    const runtime = setupParentRuntime()
    runtime.parent.subscribeEnded(() => { throw new Error('subscriber exploded') })
    runtime.parent.create('parent-a', 'household-a')

    expect(() => runtime.parent.lock()).not.toThrow()
    await vi.waitFor(() => expect(runtime.lifecycleEvents).toEqual(['parent-lock']))

    runtime.cleanup.reject(new Error('Study cancellation failed'))
    await runtime.parent.whenLifecycleIdle()

    expect(runtime.parent.lifecycleDeliveryFailed).toBe(true)
    expect(() => runtime.parent.create('parent-b', 'household-b'))
      .toThrow('Parent lifecycle delivery failed closed')
    expect(runtime.parent.recheck()).toEqual({ status: 'ended', reason: 'lifecycle-failed' })
    runtime.close()
  })

  it('never lets a replacement Parent session inherit a prior grant', async () => {
    const runtime = setupParentRuntime()
    const first = runtime.parent.create('parent-a', 'household-a')
    const generation = runtime.parent.authorityGeneration
    runtime.stepUp.issue('replace-dataset:operation-1')

    runtime.parent.lock()
    runtime.cleanup.resolve()
    await runtime.parent.whenLifecycleIdle()
    const second = runtime.parent.create('parent-a', 'household-a')

    // The security property. Today the end-listener already revokes on
    // replacement, so this pins existing behaviour rather than forcing it.
    expect(runtime.stepUp.grant).toBeNull()
    expect(runtime.stepUp.consume('replace-dataset:operation-1')).toBe(false)
    // Defence in depth: the injected identifier source repeats, so session ID
    // alone cannot separate the two authorities; the generation can.
    expect(second.sessionId).toBe(first.sessionId)
    expect(runtime.parent.authorityGeneration).toBe(generation + 1)
    runtime.close()
  })
})
