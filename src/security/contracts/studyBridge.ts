import type { StudyCancellationReason } from '../../study/lifecycle/StudyLifecycle'
import type { SecurityLifecycleEventType } from './lifecycle'

/**
 * Total, deterministic mapping into the existing Study cancellation vocabulary.
 * A null result means the event does not cancel learner-owned Study work.
 */
export const STUDY_BRIDGE_EVENT_MAP: Readonly<
  Record<SecurityLifecycleEventType, StudyCancellationReason | null>
> = Object.freeze({
  'learner-authenticated': null,
  'learner-session-expired': 'session-expired',
  'learner-lock': 'logout',
  'learner-sign-out': 'logout',
  'learner-switch-start': 'learner-switch',
  'learner-credential-reset': 'authorization-loss',
  'parent-session-expired': null,
  'parent-lock': null,
  'household-switch': 'household-switch',
  'household-sign-out': 'logout',
  'import-or-replacement': 'authorization-loss',
  'provenance-loss': 'authorization-loss',
  'global-revocation': 'authorization-loss',
})

export function studyCancellationReasonFor(
  event: SecurityLifecycleEventType,
): StudyCancellationReason | null {
  return STUDY_BRIDGE_EVENT_MAP[event]
}
