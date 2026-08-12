import type { StudyCancellationReason } from '../../study/lifecycle/StudyLifecycle'
import type { SecurityLifecycleEventType } from './lifecycle'

/**
 * Total, deterministic mapping into the existing Study cancellation vocabulary.
 * A null result means the event does not cancel learner-owned Study work.
 *
 * The map has a null prototype so an untyped runtime caller cannot reach a
 * `Function` or `Object` through an inherited name — `toString`, `constructor`,
 * `valueOf`, `__proto__` and the rest resolve to `undefined`, which is the
 * bridge's fail-closed fallback rather than a value that reaches Study.
 */
export const STUDY_BRIDGE_EVENT_MAP: Readonly<
  Record<SecurityLifecycleEventType, StudyCancellationReason | null>
> = Object.freeze(Object.assign(Object.create(null) as Record<
  SecurityLifecycleEventType,
  StudyCancellationReason | null
>, {
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
}))

export function studyCancellationReasonFor(
  event: SecurityLifecycleEventType,
): StudyCancellationReason | null {
  return STUDY_BRIDGE_EVENT_MAP[event]
}
