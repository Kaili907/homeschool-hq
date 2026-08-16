export const SECURITY_LIFECYCLE_EVENT_TYPES = Object.freeze([
  'learner-authenticated',
  'learner-session-expired',
  'learner-lock',
  'learner-sign-out',
  'learner-switch-start',
  'learner-credential-reset',
  'parent-session-expired',
  'parent-lock',
  'household-switch',
  'household-sign-out',
  'import-or-replacement',
  'provenance-loss',
  'global-revocation',
] as const)

export type SecurityLifecycleEventType = typeof SECURITY_LIFECYCLE_EVENT_TYPES[number]

export interface SecurityLifecycleEvent {
  readonly type: SecurityLifecycleEventType
  readonly occurredAt: string
}

/** Stable meanings shared by the future session controller and Study bridge. */
export const SECURITY_LIFECYCLE_EVENT_SEMANTICS: Readonly<
  Record<SecurityLifecycleEventType, string>
> = Object.freeze({
  'learner-authenticated': 'A learner credential was accepted and a new learner session may begin.',
  'learner-session-expired': 'The learner idle or absolute deadline elapsed; learner authority is no longer current.',
  'learner-lock': 'The current learner session was explicitly locked on this device.',
  'learner-sign-out': 'The current learner explicitly ended the local learner session.',
  'learner-switch-start': 'A learner change began; work owned by the previous learner must stop before replacement.',
  'learner-credential-reset': 'The learner credential changed or entered reset-required state; prior learner authority is invalid.',
  'parent-session-expired': 'The memory-only Parent session crossed its idle or absolute deadline.',
  'parent-lock': 'The memory-only Parent session was explicitly locked and discarded.',
  'household-switch': 'The verified household context is changing; work bound to the previous household must stop.',
  'household-sign-out': 'The verified household ended its authenticated local context.',
  'import-or-replacement': 'A dataset import or replacement changed the provenance root for local educational data.',
  'provenance-loss': 'Required verified ownership or dataset provenance can no longer be established.',
  'global-revocation': 'A newer global revocation epoch invalidated every older local session and grant.',
})
