import type { SecurityLifecycleEvent } from '../contracts/lifecycle'
import { studyCancellationReasonFor } from '../contracts/studyBridge'
import type { StudyCancellationReason } from '../../study/lifecycle/StudyLifecycle'

/**
 * The mode-specific Study authority that already owns lifecycle cleanup.
 * Preview supplies its shared lifecycle boundary; production supplies its
 * verified runtime adapter. The security bridge never recreates that cleanup.
 */
export interface StudyCancellationPort {
  cancel(reason: StudyCancellationReason): void | Promise<void>
}

/**
 * Translates an already-decided security lifecycle event into Study cleanup.
 * A null result is an explicit preserve decision from the total contract map.
 */
export async function cancelStudyForSecurityLifecycleEvent(
  event: SecurityLifecycleEvent,
  port: StudyCancellationPort,
): Promise<StudyCancellationReason | null> {
  const mappedReason = studyCancellationReasonFor(event.type)
  // The public type and total map make this unreachable for valid callers. If
  // an untyped runtime caller crosses this security-only seam with a future or
  // malformed security event, fail closed instead of preserving stale Study.
  const reason = mappedReason === undefined ? 'authorization-loss' : mappedReason
  if (reason === null) return null
  await port.cancel(reason)
  return reason
}
