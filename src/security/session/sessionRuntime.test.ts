import { describe, expect, it, vi } from 'vitest'
import { SECURITY_LIFECYCLE_EVENT_TYPES } from '../contracts/lifecycle'
import { SECURITY_SESSION_POLICY } from '../contracts/sessionPolicy'
import { createLocalSessionId } from '../contracts/sessions'
import { studyCancellationReasonFor } from '../contracts/studyBridge'
import {
  LearnerActivityController,
  type ActivityScheduler,
} from './activity'
import {
  LearnerSessionController,
  LEARNER_SESSION_STORAGE_KEY,
} from './learnerSession'
import {
  executeLearnerAccessActions,
  INITIAL_LEARNER_ACCESS_STATE,
  transitionLearnerAccess,
} from './lockSwitchStateMachine'
import { ParentSessionController } from './parentSession'
import { ParentStepUpController } from './parentStepUp'
import {
  GlobalRevocationCoordinator,
  type RevocationBroadcastPort,
} from './revocation'
import type { SecurityStorage } from './runtime'

const UUID_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const UUID_B = 'b3d48c11-53bb-4d8f-bb8b-d2f311abf5ef'
const UUID_C = '44444444-4444-4444-8444-444444444444'
const START = Date.parse('2026-08-09T12:00:00.000Z')

class MemoryStorage implements SecurityStorage {
  readonly values = new Map<string, string>()
  writes = 0

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.writes += 1
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

class BroadcastHub {
  readonly channels = new Set<BroadcastChannelFake>()

  create = (): RevocationBroadcastPort => {
    const channel = new BroadcastChannelFake(this)
    this.channels.add(channel)
    return channel
  }
}

class BroadcastChannelFake implements RevocationBroadcastPort {
  onmessage: ((event: { readonly data: unknown }) => void) | null = null

  constructor(private readonly hub: BroadcastHub) {}

  postMessage(message: unknown): void {
    for (const channel of this.hub.channels) {
      if (channel !== this) channel.onmessage?.({ data: message })
    }
  }

  close(): void {
    this.hub.channels.delete(this)
  }
}

function setupLearner(options: { writeThrottleMs?: number } = {}) {
  const sessionStorage = new MemoryStorage()
  const deviceStorage = new MemoryStorage()
  let now = START
  const revocation = new GlobalRevocationCoordinator({ storage: deviceStorage, clock: () => now })
  const lifecycle = vi.fn()
  const session = new LearnerSessionController({
    storage: sessionStorage,
    revocation,
    clock: () => now,
    randomUUID: () => UUID_A,
    activityWriteThrottleMs: options.writeThrottleMs,
    onLifecycleEvent: lifecycle,
  })
  return {
    session,
    sessionStorage,
    deviceStorage,
    revocation,
    lifecycle,
    now: () => now,
    setNow: (value: number) => { now = value },
    advance: (value: number) => { now += value },
  }
}

describe('learner session controller', () => {
  it('creates only the approved tab-scoped session metadata', () => {
    const runtime = setupLearner()
    const record = runtime.session.create('learner-a')

    expect(record).toMatchObject({
      schemaVersion: 1,
      sessionId: UUID_A,
      profileId: 'learner-a',
      authenticatedAt: '2026-08-09T12:00:00.000Z',
      lastMeaningfulActivityAt: '2026-08-09T12:00:00.000Z',
      absoluteExpiresAt: '2026-08-09T20:00:00.000Z',
      globalRevocationEpoch: 0,
    })
    expect(Object.keys(JSON.parse(runtime.sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)!))).toEqual([
      'schemaVersion',
      'sessionId',
      'profileId',
      'authenticatedAt',
      'lastMeaningfulActivityAt',
      'absoluteExpiresAt',
      'globalRevocationEpoch',
    ])
    expect(runtime.sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).not.toMatch(/pin|verifier|secret/i)
    expect(runtime.lifecycle).toHaveBeenCalledWith({
      type: 'learner-authenticated',
      occurredAt: '2026-08-09T12:00:00.000Z',
    })
  })

  it('restores a refresh-compatible session record in the same tab', () => {
    const runtime = setupLearner()
    const created = runtime.session.create('learner-a')
    const refreshed = new LearnerSessionController({
      storage: runtime.sessionStorage,
      revocation: runtime.revocation,
      clock: runtime.now,
    })

    expect(refreshed.restore()).toEqual({ status: 'active', session: created })
    refreshed.close()
  })

  it('fails closed and removes malformed or extended session records', () => {
    const runtime = setupLearner()
    runtime.sessionStorage.setItem(LEARNER_SESSION_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      sessionId: UUID_A,
      profileId: 'learner-a',
      authenticatedAt: '2026-08-09T12:00:00.000Z',
      lastMeaningfulActivityAt: '2026-08-09T12:00:00.000Z',
      absoluteExpiresAt: '2026-08-09T20:00:00.000Z',
      globalRevocationEpoch: 0,
      pin: '1234',
    }))

    expect(runtime.session.restore()).toEqual({ status: 'ended', reason: 'malformed-record' })
    expect(runtime.sessionStorage.getItem(LEARNER_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('expires at the 30-minute idle boundary', () => {
    const runtime = setupLearner()
    runtime.session.create('learner-a')
    runtime.advance(SECURITY_SESSION_POLICY.learner.idleTimeoutMs - 1)
    expect(runtime.session.recheck().status).toBe('active')
    runtime.advance(1)
    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'idle-expired' })
  })

  it('expires at the 8-hour absolute boundary despite continued activity', () => {
    const runtime = setupLearner({ writeThrottleMs: 0 })
    runtime.session.create('learner-a')
    while (runtime.now() + 14 * 60_000 < START + SECURITY_SESSION_POLICY.learner.absoluteTimeoutMs) {
      runtime.advance(14 * 60_000)
      expect(runtime.session.noteMeaningfulActivity().status).toBe('active')
    }
    runtime.setNow(START + SECURITY_SESSION_POLICY.learner.absoluteTimeoutMs)
    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'absolute-expired' })
  })

  it('updates meaningful activity in memory and throttles sessionStorage writes', () => {
    const runtime = setupLearner({ writeThrottleMs: 5_000 })
    runtime.session.create('learner-a')
    runtime.advance(1_000)
    expect(runtime.session.noteMeaningfulActivity()).toMatchObject({
      status: 'active',
      session: { lastMeaningfulActivityAt: '2026-08-09T12:00:01.000Z' },
    })
    expect(runtime.sessionStorage.writes).toBe(1)
    runtime.advance(4_000)
    runtime.session.noteMeaningfulActivity()
    expect(runtime.sessionStorage.writes).toBe(2)
  })

  it('fails closed on a backward clock jump even when still after authentication', () => {
    const runtime = setupLearner()
    runtime.session.create('learner-a')
    runtime.advance(10_000)
    expect(runtime.session.recheck().status).toBe('active')
    runtime.advance(-1)
    expect(runtime.session.recheck()).toEqual({ status: 'ended', reason: 'clock-anomaly' })
  })
})

describe('meaningful activity accounting', () => {
  it('counts visible pointer/keyboard/approved interactions and ignores hidden activity and pointermove', () => {
    const runtime = setupLearner({ writeThrottleMs: 0 })
    runtime.session.create('learner-a')
    const documentEvents = new EventTarget()
    const pageEvents = new EventTarget()
    let visibility: DocumentVisibilityState = 'visible'
    const intervals: Array<() => void> = []
    const scheduler: ActivityScheduler = {
      setInterval: (callback) => { intervals.push(callback); return callback },
      clearInterval: () => undefined,
    }
    const activity = new LearnerActivityController({
      session: runtime.session,
      documentEvents,
      pageEvents,
      visibility: () => visibility,
      clock: runtime.now,
      scheduler,
    })
    activity.start()

    runtime.advance(1_000)
    documentEvents.dispatchEvent(new Event('pointerdown'))
    expect(runtime.session.session?.lastMeaningfulActivityAt).toBe('2026-08-09T12:00:01.000Z')
    runtime.advance(1_000)
    documentEvents.dispatchEvent(new Event('pointermove'))
    expect(runtime.session.session?.lastMeaningfulActivityAt).toBe('2026-08-09T12:00:01.000Z')
    visibility = 'hidden'
    runtime.advance(1_000)
    documentEvents.dispatchEvent(new Event('keydown'))
    expect(activity.approvedLearnerInteraction().status).toBe('active')
    expect(runtime.session.session?.lastMeaningfulActivityAt).toBe('2026-08-09T12:00:01.000Z')
    intervals[0]()
    expect(runtime.session.session?.lastMeaningfulActivityAt).toBe('2026-08-09T12:00:01.000Z')
    visibility = 'visible'
    documentEvents.dispatchEvent(new Event('visibilitychange'))
    runtime.advance(1_000)
    activity.approvedLearnerInteraction()
    expect(runtime.session.session?.lastMeaningfulActivityAt).toBe('2026-08-09T12:00:04.000Z')
    activity.stop()
  })
})

describe('global and cross-tab revocation', () => {
  it('persists and increments a non-secret global epoch', () => {
    const storage = new MemoryStorage()
    const coordinator = new GlobalRevocationCoordinator({ storage, clock: () => START })
    expect(coordinator.currentEpoch()).toBe(0)
    expect(coordinator.revoke('learner-lock')).toMatchObject({ epoch: 1, cause: 'learner-lock' })
    expect(new GlobalRevocationCoordinator({ storage }).currentEpoch()).toBe(1)
  })

  it('invalidates learner sessions in multiple tabs after an explicit revocation', () => {
    const deviceStorage = new MemoryStorage()
    const hub = new BroadcastHub()
    let now = START
    const firstEpoch = new GlobalRevocationCoordinator({
      storage: deviceStorage,
      clock: () => now,
      channelFactory: hub.create,
    })
    const secondEpoch = new GlobalRevocationCoordinator({
      storage: deviceStorage,
      clock: () => now,
      channelFactory: hub.create,
    })
    const first = new LearnerSessionController({
      storage: new MemoryStorage(), revocation: firstEpoch, clock: () => now, randomUUID: () => UUID_A,
    })
    const second = new LearnerSessionController({
      storage: new MemoryStorage(), revocation: secondEpoch, clock: () => now, randomUUID: () => UUID_B,
    })
    first.create('learner-a')
    second.create('learner-a')

    firstEpoch.revoke('learner-lock')

    expect(first.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    expect(second.recheck()).toEqual({ status: 'ended', reason: 'global-revocation' })
    first.close()
    second.close()
    firstEpoch.close()
    secondEpoch.close()
  })

  it('never propagates an unlock or newly created tab session', () => {
    const deviceStorage = new MemoryStorage()
    const hub = new BroadcastHub()
    const firstEpoch = new GlobalRevocationCoordinator({ storage: deviceStorage, channelFactory: hub.create })
    const secondEpoch = new GlobalRevocationCoordinator({ storage: deviceStorage, channelFactory: hub.create })
    const notices = vi.fn()
    secondEpoch.subscribe(notices)
    const first = new LearnerSessionController({
      storage: new MemoryStorage(), revocation: firstEpoch, clock: () => START, randomUUID: () => UUID_A,
    })
    const second = new LearnerSessionController({
      storage: new MemoryStorage(), revocation: secondEpoch, clock: () => START, randomUUID: () => UUID_B,
    })

    first.create('learner-a')

    expect(notices).not.toHaveBeenCalled()
    expect(second.recheck()).toEqual({ status: 'ended', reason: 'none' })
  })
})

describe('Parent session and one-operation step-up', () => {
  function setupParent() {
    const storage = new MemoryStorage()
    let now = START
    const revocation = new GlobalRevocationCoordinator({ storage, clock: () => now })
    const parent = new ParentSessionController({
      revocation,
      clock: () => now,
      randomUUID: () => UUID_A,
    })
    return {
      parent,
      revocation,
      now: () => now,
      advance: (value: number) => { now += value },
      setNow: (value: number) => { now = value },
    }
  }

  it('is memory-only, disappears on refresh, and observes idle expiry', () => {
    const runtime = setupParent()
    expect(runtime.parent.create('parent-a', 'household-a')).toMatchObject({
      storage: 'memory-only',
      sessionId: UUID_A,
    })
    const refreshed = new ParentSessionController({
      revocation: runtime.revocation,
      clock: runtime.now,
    })
    expect(refreshed.recheck()).toEqual({ status: 'ended', reason: 'none' })
    runtime.advance(SECURITY_SESSION_POLICY.parent.idleTimeoutMs)
    expect(runtime.parent.recheck()).toEqual({ status: 'ended', reason: 'idle-expired' })
  })

  it('enforces the 60-minute absolute Parent expiry despite activity', () => {
    const runtime = setupParent()
    runtime.parent.create('parent-a', 'household-a')
    for (let elapsed = 14 * 60_000; elapsed < SECURITY_SESSION_POLICY.parent.absoluteTimeoutMs; elapsed += 14 * 60_000) {
      runtime.setNow(START + elapsed)
      expect(runtime.parent.noteMeaningfulActivity().status).toBe('active')
    }
    runtime.setNow(START + SECURITY_SESSION_POLICY.parent.absoluteTimeoutMs)
    expect(runtime.parent.recheck()).toEqual({ status: 'ended', reason: 'absolute-expired' })
  })

  it('binds step-up to its exact purpose and consumes it once', () => {
    const runtime = setupParent()
    runtime.parent.create('parent-a', 'household-a')
    const stepUp = new ParentStepUpController({
      parentSession: runtime.parent,
      clock: runtime.now,
      randomUUID: () => UUID_B,
    })
    const grant = stepUp.issue('replace-dataset:operation-1')
    expect(grant).toMatchObject({
      storage: 'memory-only',
      grantId: UUID_B,
      parentSessionId: UUID_A,
      operationUseLimit: 1,
    })
    expect(stepUp.consume('reset-credential:operation-1')).toBe(false)
    expect(stepUp.consume('replace-dataset:operation-1')).toBe(true)
    expect(stepUp.consume('replace-dataset:operation-1')).toBe(false)
  })

  it('expires step-up at two minutes and revokes it when Parent ends', () => {
    const runtime = setupParent()
    runtime.parent.create('parent-a', 'household-a')
    const stepUp = new ParentStepUpController({
      parentSession: runtime.parent,
      clock: runtime.now,
      randomUUID: () => UUID_C,
    })
    stepUp.issue('operation-1')
    runtime.advance(SECURITY_SESSION_POLICY.parentStepUp.maximumLifetimeMs)
    expect(stepUp.consume('operation-1')).toBe(false)
    stepUp.issue('operation-2')
    runtime.parent.lock()
    expect(stepUp.grant).toBeNull()
  })
})

describe('Lock/Switch state machine and Study lifecycle seam', () => {
  it('revokes Learner A before requesting Learner B PIN and leaves cancel locked', () => {
    const active = transitionLearnerAccess(INITIAL_LEARNER_ACCESS_STATE, {
      type: 'authenticated',
      profileId: 'learner-a',
      sessionId: createLocalSessionId(() => UUID_A),
      occurredAt: '2026-08-09T12:00:00.000Z',
    }).state
    const switching = transitionLearnerAccess(active, {
      type: 'learner-switch',
      targetProfileId: 'learner-b',
      occurredAt: '2026-08-09T12:01:00.000Z',
    })
    expect(switching.actions.map((action) => action.type)).toEqual([
      'revoke-global',
      'security-lifecycle',
      'request-learner-pin',
    ])
    expect(switching.actions[1]).toMatchObject({ studyCancellationReason: 'learner-switch' })
    expect(transitionLearnerAccess(switching.state, { type: 'cancel-switch' }).state).toEqual({
      status: 'locked',
      reason: 'switch-cancelled',
    })
  })

  it('executes revocation, lifecycle emission, then PIN request in order', () => {
    const order: string[] = []
    const active = {
      status: 'active' as const,
      profileId: 'learner-a',
      sessionId: createLocalSessionId(() => UUID_A),
    }
    const transition = transitionLearnerAccess(active, {
      type: 'learner-switch',
      targetProfileId: 'learner-b',
      occurredAt: '2026-08-09T12:01:00.000Z',
    })
    executeLearnerAccessActions(transition.actions, {
      revocation: {
        currentEpoch: () => 0,
        subscribe: () => () => undefined,
        revoke: () => { order.push('revoke'); return { schemaVersion: 1, epoch: 1, cause: 'learner-switch-start', occurredAt: '2026-08-09T12:01:00.000Z' } },
        close: () => undefined,
      },
      onLifecycle: () => order.push('lifecycle'),
      requestLearnerPin: () => order.push('pin'),
    })
    expect(order).toEqual(['revoke', 'lifecycle', 'pin'])
  })

  it('exposes logout, session-expired, authorization-loss, and household-switch vocabulary', () => {
    const active = {
      status: 'active' as const,
      profileId: 'learner-a',
      sessionId: createLocalSessionId(() => UUID_A),
    }
    expect(transitionLearnerAccess(active, {
      type: 'logout', occurredAt: '2026-08-09T12:00:00.000Z',
    }).actions).toContainEqual(expect.objectContaining({ studyCancellationReason: 'logout' }))
    expect(transitionLearnerAccess(active, {
      type: 'session-expired', occurredAt: '2026-08-09T12:00:00.000Z',
    }).actions).toContainEqual(expect.objectContaining({ studyCancellationReason: 'session-expired' }))
    expect(transitionLearnerAccess(active, {
      type: 'authorization-loss', source: 'provenance-loss', occurredAt: '2026-08-09T12:00:00.000Z',
    }).actions).toContainEqual(expect.objectContaining({ studyCancellationReason: 'authorization-loss' }))
    expect(transitionLearnerAccess(active, {
      type: 'household-switch', occurredAt: '2026-08-09T12:00:00.000Z',
    }).actions).toContainEqual(expect.objectContaining({ studyCancellationReason: 'household-switch' }))
  })

  it('keeps the complete foundation lifecycle vocabulary mapped without calling Study', () => {
    expect(new Set(SECURITY_LIFECYCLE_EVENT_TYPES).size).toBe(SECURITY_LIFECYCLE_EVENT_TYPES.length)
    for (const type of SECURITY_LIFECYCLE_EVENT_TYPES) {
      expect(() => studyCancellationReasonFor(type)).not.toThrow()
    }
  })
})
