import { describe, expect, it, vi } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import { createLocalSessionId } from '../contracts/sessions'
import type { StudyCancellationReason } from '../../study/lifecycle/StudyLifecycle'
import { SerializedLifecycleDelivery, type SecurityLifecycleSink } from './lifecycleDelivery'
import {
  executeLearnerAccessActions,
  transitionLearnerAccess,
} from './lockSwitchStateMachine'
import { LearnerSessionController } from './learnerSession'
import { GlobalRevocationCoordinator } from './revocation'
import type { SecurityStorage } from './runtime'
import {
  cancelStudyForSecurityLifecycleEvent,
  type StudyCancellationPort,
} from '../study/authStudyCancellationBridge'

describe('safe Study Bridge compatibility', () => {
  it('runs the actual bridge switch trace exactly once before requesting PIN', async () => {
    const trace: string[] = []
    let finishCancellation!: () => void
    const cancellation = new Promise<void>((resolve) => { finishCancellation = resolve })
    const transition = transitionLearnerAccess({
      status: 'active',
      profileId: parseProfileId('p1')!,
      sessionId: createLocalSessionId(() => 'd9428888-122b-4f9b-9424-1f35c63d5750'),
    }, {
      type: 'learner-switch',
      targetProfileId: parseProfileId('p2')!,
      occurredAt: '2026-08-09T12:01:00.000Z',
    })
    const values = new Map<string, string>()
    const storage: SecurityStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
      removeItem: (key) => { values.delete(key) },
    }
    const revocation = new GlobalRevocationCoordinator({
      storage,
      lockManager: {
        request: (_name, _options, callback) => Promise.resolve(callback()),
      },
    })
    const session = new LearnerSessionController({
      storage,
      revocation,
      ownershipLockManager: {
        request: (_name, _options, callback) => Promise.resolve(callback({ name: 'owner' })),
      },
      onLifecycleEvent: (event) => cancelStudyForSecurityLifecycleEvent(event, {
        cancel: async () => {
          trace.push('cancel-start')
          await cancellation
          trace.push('cancel-done')
        },
      }),
    })
    const originalRevoke = revocation.revoke.bind(revocation)
    const tracedRevocation = {
      currentEpoch: () => revocation.currentEpoch(),
      subscribe: revocation.subscribe.bind(revocation),
      revoke: async (cause: Parameters<typeof revocation.revoke>[0]) => {
        trace.push('revoke')
        return originalRevoke(cause)
      },
      close: revocation.close.bind(revocation),
    }
    const execution = executeLearnerAccessActions(transition.actions, {
      learnerSession: session,
      revocation: tracedRevocation,
      requestLearnerPin: () => { trace.push('PIN') },
    })
    await vi.waitFor(() => expect(trace).toEqual(['revoke', 'cancel-start']))

    finishCancellation()
    await execution
    expect(trace).toEqual(['revoke', 'cancel-start', 'cancel-done', 'PIN'])
    await session.close()
    revocation.close()
  })

  it('accepts the bridge Promise directly and awaits its asynchronous cancel port', async () => {
    const trace: string[] = []
    let finishCancellation!: () => void
    const cancellation = new Promise<void>((resolve) => { finishCancellation = resolve })
    const port: StudyCancellationPort = {
      cancel: async (reason) => {
        trace.push(`cancel-start:${reason}`)
        await cancellation
        trace.push(`cancel-done:${reason}`)
      },
    }
    const sink: SecurityLifecycleSink = (event) => cancelStudyForSecurityLifecycleEvent(event, port)
    const delivery = new SerializedLifecycleDelivery(sink)
    const delivered = delivery.enqueue({
      type: 'learner-switch-start',
      occurredAt: '2026-08-09T12:01:00.000Z',
    }, () => { trace.push('rejected') })
    await Promise.resolve()
    await Promise.resolve()
    expect(trace).toEqual(['cancel-start:learner-switch'])

    finishCancellation()
    await expect(delivered).resolves.toBe(true)
    expect(trace).toEqual([
      'cancel-start:learner-switch',
      'cancel-done:learner-switch',
    ])
  })

  it('preserves learner Study across Parent lock per the safe bridge contract', async () => {
    const cancel = async (_reason: StudyCancellationReason) => {
      throw new Error('Parent lock must not cancel learner Study')
    }
    await expect(cancelStudyForSecurityLifecycleEvent({
      type: 'parent-lock',
      occurredAt: '2026-08-09T12:01:00.000Z',
    }, { cancel })).resolves.toBeNull()
  })
})
