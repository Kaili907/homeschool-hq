import { describe, expect, it } from 'vitest'
import { parseProfileId } from '../contracts/profileId'
import { createLocalSessionId } from '../contracts/sessions'
import type { StudyCancellationReason } from '../../study/lifecycle/StudyLifecycle'
import { studyCancellationReasonFor } from '../contracts/studyBridge'
import { SerializedLifecycleDelivery, type SecurityLifecycleSink } from './lifecycleDelivery'
import {
  executeLearnerAccessActions,
  transitionLearnerAccess,
  type LearnerAccessActionPorts,
} from './lockSwitchStateMachine'
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
    const execution = executeLearnerAccessActions(transition.actions, {
      learnerSession: { clearLocal: () => undefined },
      revocation: {
        currentEpoch: () => 0,
        subscribe: () => () => undefined,
        revoke: async (cause) => {
          trace.push('revoke')
          return Object.freeze({
            schemaVersion: 1 as const,
            epoch: 1,
            cause,
            occurredAt: '2026-08-09T12:01:00.000Z',
          })
        },
        close: () => undefined,
      },
      onLifecycle: (event) => cancelStudyForSecurityLifecycleEvent(event, {
        cancel: async () => {
          trace.push('cancel-start')
          await cancellation
          trace.push('cancel-done')
        },
      }),
      requestLearnerPin: () => { trace.push('PIN') },
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(trace).toEqual(['revoke', 'cancel-start'])

    finishCancellation()
    await execution
    expect(trace).toEqual(['revoke', 'cancel-start', 'cancel-done', 'PIN'])
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
    const actionPortSink: LearnerAccessActionPorts['onLifecycle'] = (event) => (
      cancelStudyForSecurityLifecycleEvent(event, port)
    )
    const sink: SecurityLifecycleSink = (event) => actionPortSink(
      event,
      studyCancellationReasonFor(event.type),
    )
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
