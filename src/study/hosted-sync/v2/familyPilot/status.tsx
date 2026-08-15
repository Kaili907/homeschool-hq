import type { ReactElement } from 'react'
import { FAMILY_HOSTED_SYNC_CONVERGENCE_R1 } from './policy'

export type ParentSyncStatusR1 =
  | 'LOCAL_ONLY'
  | 'SYNC_READY'
  | 'SYNCING'
  | 'UP_TO_DATE'
  | 'NEEDS_ATTENTION'
  | 'OFFLINE_SAVED'

const LABEL: Readonly<Record<ParentSyncStatusR1, string>> = Object.freeze({
  LOCAL_ONLY: 'Local only',
  SYNC_READY: 'Sync ready',
  SYNCING: 'Syncing',
  UP_TO_DATE: 'Up to date',
  NEEDS_ATTENTION: 'Needs attention',
  OFFLINE_SAVED: 'Offline / saved on this device',
})

export function parentSyncStatusLabelR1(status: ParentSyncStatusR1): string {
  return LABEL[status]
}

/** The only status the current unactivated product may select by default. */
export function currentParentSyncStatusR1(): ParentSyncStatusR1 {
  return FAMILY_HOSTED_SYNC_CONVERGENCE_R1.enabled ? 'SYNC_READY' : 'LOCAL_ONLY'
}

/** Parent-only status copy. No provider, token, or learner-facing error enters this component. */
export function ParentSyncStatusR1({
  status = currentParentSyncStatusR1(),
}: {
  readonly status?: ParentSyncStatusR1
}): ReactElement {
  return (
    <p
      aria-label="Family data status"
      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600"
    >
      {parentSyncStatusLabelR1(status)}
    </p>
  )
}
