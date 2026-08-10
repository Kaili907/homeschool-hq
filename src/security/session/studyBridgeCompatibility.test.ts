import { describe, expect, it } from 'vitest'
import type { StudyCancellationReason } from '../../study/lifecycle/StudyLifecycle'
import type { SecurityLifecycleEvent } from '../contracts/lifecycle'
import { studyCancellationReasonFor } from '../contracts/studyBridge'
import { SerializedLifecycleDelivery, type SecurityLifecycleSink } from './lifecycleDelivery'
import type { LearnerAccessActionPorts } from './lockSwitchStateMachine'

interface SafeStudyBridgePort {
  cancel(reason: StudyCancellationReason): void | Promise<void>
}

type SafeStudyBridgeApi = (
  event: SecurityLifecycleEvent,
  port: SafeStudyBridgePort,
) => Promise<StudyCancellationReason | null>

/** Structural copy of the independently safe bridge API at 4f12c862. */
const cancelStudyForSecurityLifecycleEvent: SafeStudyBridgeApi = async (event, port) => {
  const reason = studyCancellationReasonFor(event.type)
  if (reason === null) return null
  await port.cancel(reason)
  return reason
}

describe('safe Study Bridge compatibility', () => {
  it('accepts the bridge Promise directly and awaits its asynchronous cancel port', async () => {
    const trace: string[] = []
    let finishCancellation!: () => void
    const cancellation = new Promise<void>((resolve) => { finishCancellation = resolve })
    const port: SafeStudyBridgePort = {
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
    }, () => trace.push('rejected'))
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
