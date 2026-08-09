import { describe, expect, it, vi } from 'vitest'
import type { SecurityLifecycleEvent, SecurityLifecycleEventType } from '../contracts/lifecycle'
import { createLocalSessionId } from '../contracts/sessions'
import type { StudyIdentityClient } from '../../study/client/studyIdentityClient'
import { STUDY_READINESS_SCHEMA_VERSION } from '../../study/contracts/production/versions'
import {
  runCurrentStudyWork,
  StudyLifecycleAbortError,
  StudyLifecycleBoundary,
  type StudyLifecycleBinding,
  type StudyCancellationReason,
} from '../../study/lifecycle/StudyLifecycle'
import { createVerifiedStudyRuntimeAdapter } from '../../study/production/verifiedRuntimeAdapter'
import {
  executeLearnerAccessActions,
  transitionLearnerAccess,
} from '../session/lockSwitchStateMachine'
import {
  cancelStudyForSecurityLifecycleEvent,
  type StudyCancellationPort,
} from './authStudyCancellationBridge'

const OCCURRED_AT = '2026-08-09T12:00:00.000Z'
const EXPIRES_AT = '2099-08-09T12:00:00.000Z'
const LEARNER_A_SESSION_ID = 'd9428888-122b-4f9b-9424-1f35c63d5750'

const learnerABinding: StudyLifecycleBinding = Object.freeze({
  authenticatedSessionRef: 'session:opaque-a',
  householdRef: 'household:verified-a',
  learnerRef: 'learner:verified-a',
  launchGrantRef: 'grant:opaque-a',
  featureEnabled: true,
  authorizationRevision: 1,
  expiresAt: EXPIRES_AT,
})

function event(type: SecurityLifecycleEventType): SecurityLifecycleEvent {
  return Object.freeze({ type, occurredAt: OCCURRED_AT })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('auth security to Study cancellation bridge', () => {
  it.each([
    ['learner-session-expired', 'session-expired'],
    ['learner-switch-start', 'learner-switch'],
    ['household-switch', 'household-switch'],
    ['learner-credential-reset', 'authorization-loss'],
    ['import-or-replacement', 'authorization-loss'],
    ['provenance-loss', 'authorization-loss'],
    ['global-revocation', 'authorization-loss'],
    ['learner-sign-out', 'logout'],
    ['learner-lock', 'logout'],
    ['household-sign-out', 'logout'],
  ] as const)('maps %s to the authoritative %s cancellation', async (type, reason) => {
    const cancel = vi.fn()

    await expect(cancelStudyForSecurityLifecycleEvent(event(type), { cancel })).resolves.toBe(reason)

    expect(cancel).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledWith(reason)
  })

  it.each(['learner-authenticated'] as const)(
    'preserves Study for the explicitly unrelated %s event',
    async (type) => {
      const cancel = vi.fn()

      await expect(cancelStudyForSecurityLifecycleEvent(event(type), { cancel })).resolves.toBeNull()

      expect(cancel).not.toHaveBeenCalled()
    },
  )

  it.each(['parent-lock', 'parent-session-expired'] as const)(
    'preserves active Study learner authority across %s',
    async (type) => {
      const lifecycle = new StudyLifecycleBoundary(learnerABinding)
      const learnerAuthority = lifecycle.token()
      const cancel = vi.fn((reason: StudyCancellationReason) => lifecycle.cancel(reason))

      await expect(cancelStudyForSecurityLifecycleEvent(event(type), { cancel })).resolves.toBeNull()

      expect(cancel).not.toHaveBeenCalled()
      expect(learnerAuthority.isCurrent()).toBe(true)
      expect(learnerAuthority.signal.aborted).toBe(false)
      expect(lifecycle.binding).toEqual(learnerABinding)
    },
  )

  it('does not create Study authority when learner authentication is announced', async () => {
    const lifecycle = new StudyLifecycleBoundary()
    const cancel = vi.fn((reason: StudyCancellationReason) => lifecycle.cancel(reason))

    await expect(cancelStudyForSecurityLifecycleEvent(event('learner-authenticated'), { cancel }))
      .resolves.toBeNull()

    expect(cancel).not.toHaveBeenCalled()
    expect(lifecycle.binding).toBeNull()
  })

  it('fails closed when an untyped caller sends an unmapped event into the security-only seam', async () => {
    const cancel = vi.fn()
    const futureSecurityEvent = {
      type: 'future-security-authorization-loss',
      occurredAt: OCCURRED_AT,
    } as unknown as SecurityLifecycleEvent

    await expect(cancelStudyForSecurityLifecycleEvent(futureSecurityEvent, { cancel }))
      .resolves.toBe('authorization-loss')
    expect(cancel).toHaveBeenCalledWith('authorization-loss')
  })

  it('cancels learner A before learner B can begin a fresh preview lifecycle', async () => {
    const lifecycle = new StudyLifecycleBoundary(learnerABinding)
    const learnerA = lifecycle.token()

    await cancelStudyForSecurityLifecycleEvent(event('learner-switch-start'), lifecycle)

    expect(learnerA.isCurrent()).toBe(false)
    expect(learnerA.signal.reason).toBe('learner-switch')
    expect(lifecycle.binding).toBeNull()

    const learnerB = lifecycle.beginEpoch({
      ...learnerABinding,
      authenticatedSessionRef: 'session:opaque-b',
      learnerRef: 'learner:verified-b',
      launchGrantRef: 'grant:opaque-b',
      authorizationRevision: 2,
    })
    expect(learnerB.epoch).toBeGreaterThan(learnerA.epoch)
    expect(learnerB.binding.learnerRef).toBe('learner:verified-b')
    expect(JSON.stringify(learnerB.binding)).not.toContain('opaque-a')
  })

  it('invalidates active Study authority with logout when the learner locks', async () => {
    const lifecycle = new StudyLifecycleBoundary(learnerABinding)
    const learnerAuthority = lifecycle.token()

    await expect(cancelStudyForSecurityLifecycleEvent(event('learner-lock'), lifecycle))
      .resolves.toBe('logout')

    expect(learnerAuthority.isCurrent()).toBe(false)
    expect(learnerAuthority.signal.reason).toBe('logout')
    expect(lifecycle.binding).toBeNull()
  })

  it('awaits the actual Session Runtime executor bridge before requesting learner B PIN', async () => {
    const order: string[] = []
    const cancellation = deferred<void>()
    const transition = transitionLearnerAccess({
      status: 'active',
      profileId: 'learner-a',
      sessionId: createLocalSessionId(() => LEARNER_A_SESSION_ID),
    }, {
      type: 'learner-switch',
      targetProfileId: 'learner-b',
      occurredAt: OCCURRED_AT,
    })
    const studyPort: StudyCancellationPort = {
      async cancel() {
        order.push('cancel-start')
        await cancellation.promise
        order.push('cancel-done')
      },
    }

    const execution = executeLearnerAccessActions(transition.actions, {
      revocation: {
        currentEpoch: () => 0,
        subscribe: () => () => undefined,
        async revoke(cause) {
          order.push('revoke')
          return Object.freeze({
            schemaVersion: 1 as const,
            epoch: 1,
            cause,
            occurredAt: OCCURRED_AT,
          })
        },
        close: () => undefined,
      },
      onLifecycle: async (lifecycleEvent) => {
        await cancelStudyForSecurityLifecycleEvent(lifecycleEvent, studyPort)
      },
      requestLearnerPin: () => { order.push('pin') },
    })
    await vi.waitFor(() => expect(order).toEqual(['revoke', 'cancel-start']))

    cancellation.resolve()
    await execution

    expect(order).toEqual(['revoke', 'cancel-start', 'cancel-done', 'pin'])
  })

  it('routes learner expiry through the preview lifecycle and rejects a late response', async () => {
    const lifecycle = new StudyLifecycleBoundary(learnerABinding)
    const token = lifecycle.token()
    const response = deferred<string>()
    const committed: string[] = []
    const inFlight = runCurrentStudyWork(
      token,
      async () => response.promise,
      { operationRef: 'preview:late-after-expiry' },
    ).then((value) => committed.push(value))

    await cancelStudyForSecurityLifecycleEvent(event('learner-session-expired'), lifecycle)
    response.resolve('learner-a-result')

    await expect(inFlight).rejects.toMatchObject({
      name: 'AbortError',
      reason: 'session-expired',
    })
    expect(committed).toEqual([])
    expect(lifecycle.binding).toBeNull()
  })

  it.each([
    'learner-credential-reset',
    'import-or-replacement',
    'provenance-loss',
    'global-revocation',
  ] as const)('invalidates preview authority before %s replacement can proceed', async (type) => {
    const lifecycle = new StudyLifecycleBoundary(learnerABinding)
    const stale = lifecycle.token()

    await cancelStudyForSecurityLifecycleEvent(event(type), lifecycle)

    expect(stale.isCurrent()).toBe(false)
    expect(stale.signal.reason).toBe('authorization-loss')
    expect(lifecycle.binding).toBeNull()
  })

  it('awaits the cancellation port before reporting replacement-safe completion', async () => {
    const released = deferred<void>()
    const order: string[] = []
    const port: StudyCancellationPort = {
      async cancel(reason) {
        order.push(`cancel-start:${reason}`)
        await released.promise
        order.push(`cancel-finished:${reason}`)
      },
    }

    const handling = cancelStudyForSecurityLifecycleEvent(event('import-or-replacement'), port)
    await Promise.resolve()
    expect(order).toEqual(['cancel-start:authorization-loss'])

    released.resolve()
    await expect(handling).resolves.toBe('authorization-loss')
    expect(order).toEqual([
      'cancel-start:authorization-loss',
      'cancel-finished:authorization-loss',
    ])
  })

  it('uses production runtime cancellation to clear opaque identity and quarantine a late result', async () => {
    const academic = deferred<unknown>()
    let hasOpaqueSession = false
    const identity: StudyIdentityClient = {
      issueGuardianLaunch: vi.fn(async () => {
        hasOpaqueSession = true
        return Object.freeze({
          schemaVersion: 1,
          status: 'issued',
          sessionReference: `aca_stu_v1_${'a'.repeat(43)}`,
          expiresAt: EXPIRES_AT,
        } as const)
      }),
      verify: vi.fn(async () => Object.freeze({
        schemaVersion: 1,
        status: 'verified',
        expiresAt: EXPIRES_AT,
      } as const)),
      executeAcademicOperation: vi.fn(async () => academic.promise),
      revoke: vi.fn(async () => { hasOpaqueSession = false }),
      clear: vi.fn(() => { hasOpaqueSession = false }),
      hasSession: vi.fn(() => hasOpaqueSession),
    }
    const lifecycle = new StudyLifecycleBoundary()
    const runtime = createVerifiedStudyRuntimeAdapter({
      identityClient: identity,
      lifecycle,
      now: () => Date.parse(OCCURRED_AT),
      createLifecycleRef: () => 'host-lifecycle:bridge-test',
    })
    await runtime.launch({
      featureEnabled: true,
      authenticatedHostSession: true,
      hostSessionKey: 'verified-host-session-a',
      accessToken: 'memory-only-test-token',
      selectedStudentRef: { kind: 'legacy-profile-id', value: 'learner-a' },
      readiness: {
        schemaVersion: STUDY_READINESS_SCHEMA_VERSION,
        status: 'ready',
        expiresAt: EXPIRES_AT,
      },
    })
    const committed: unknown[] = []
    const executing = runtime.execute({
      operation: 'dashboard:read',
      request: {},
      operationRef: 'production:late-after-provenance-loss',
    }).then((value) => committed.push(value))
    await vi.waitFor(() => expect(identity.executeAcademicOperation).toHaveBeenCalledOnce())

    await cancelStudyForSecurityLifecycleEvent(event('provenance-loss'), runtime)
    academic.resolve({ learnerRef: 'learner-a', assignments: [] })

    await expect(executing).rejects.toBeInstanceOf(StudyLifecycleAbortError)
    expect(committed).toEqual([])
    expect(identity.revoke).toHaveBeenCalledOnce()
    expect(hasOpaqueSession).toBe(false)
    expect(runtime.isReady()).toBe(false)
    expect(lifecycle.binding).toBeNull()
  })
})
