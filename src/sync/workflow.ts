import type { Profile } from '../types'
import {
  automaticSyncPlan,
  buildReconciliationPreview,
  markDirty,
  metaAfterSuccessfulSync,
} from './engine'
import type {
  CloudPullResult,
  CloudPushResult,
  HouseholdSyncMeta,
  ReconciliationPreview,
  RemoteProfileRow,
} from './types'
import { toWireProfile } from '../portableProfile'

export interface SyncTransport {
  pull: () => Promise<CloudPullResult>
  push: (
    rows: RemoteProfileRow[],
    expectedCloudRows: RemoteProfileRow[],
    expectedRevision: string,
  ) => Promise<CloudPushResult>
}

export type HouseholdInspection =
  | { kind: 'pull-error'; error: string }
  | {
      kind: 'preview'
      rows: RemoteProfileRow[]
      revision: string
      preview: ReconciliationPreview
    }

/** Read-only first/account-switch inspection. It has no push capability by design. */
export async function inspectUnboundHousehold(
  local: Record<string, Profile>,
  meta: HouseholdSyncMeta,
  pull: SyncTransport['pull'],
): Promise<HouseholdInspection> {
  const result = await pull()
  return result.ok
    ? {
        kind: 'preview',
        rows: result.rows,
        revision: result.revision,
        preview: buildReconciliationPreview(local, result.rows, meta),
      }
    : { kind: 'pull-error', error: result.error }
}

export type AutomaticCycle =
  | { kind: 'unbound' }
  | { kind: 'pull-error'; error: string }
  | {
      kind: 'review'
      rows: RemoteProfileRow[]
      revision: string
      preview: ReconciliationPreview
      meta: HouseholdSyncMeta
    }
  | {
      kind: 'push-error'
      error: string
      meta: HouseholdSyncMeta
      conflict?: true
      revision?: string
    }
  | {
      kind: 'success'
      rows: RemoteProfileRow[]
      revision: string
      profiles: Record<string, Profile>
      meta: HouseholdSyncMeta
    }

/**
 * Matching-household automatic cycle. A successful pull is mandatory before
 * any push, and a two-sided conflict returns review without calling push.
 */
export async function executeAutomaticCycle(
  local: Record<string, Profile>,
  meta: HouseholdSyncMeta,
  now: number,
  transport: SyncTransport,
): Promise<AutomaticCycle> {
  if (meta.binding !== 'bound' || !meta.ownsLocalData)
    return { kind: 'unbound' }
  const pulled = await transport.pull()
  if (!pulled.ok) return { kind: 'pull-error', error: pulled.error }

  const plan = automaticSyncPlan(
    local,
    pulled.rows,
    meta,
    now,
    pulled.revision,
  )
  if (!plan.ok) {
    const conflictProfileIds = plan.preview.profiles
      .filter((profile) => profile.category === 'both-changed')
      .map((profile) => profile.id)
    return {
      kind: 'review',
      rows: pulled.rows,
      revision: pulled.revision,
      preview: plan.preview,
      meta: {
        ...meta,
        reconciliation: 'review',
        conflictProfileIds,
      },
    }
  }

  if (plan.toPush.length > 0) {
    const pushed = await transport.push(
      plan.toPush,
      pulled.rows,
      pulled.revision,
    )
    if (!pushed.ok) {
      const pending = markDirty(
        meta,
        plan.toPush.map((row) => row.profile_id),
        now,
      )
      return {
        kind: 'push-error',
        error: pushed.error,
        ...(pushed.conflict ? { conflict: true as const } : {}),
        ...(pushed.revision ? { revision: pushed.revision } : {}),
        meta: pushed.conflict
          ? {
              ...pending,
              reconciliation: 'review',
              pauseReason:
                'Another device updated this household. Review the refreshed cloud state before retrying.',
            }
          : pending,
      }
    }
    pulled.revision = pushed.revision
  }
  const rowsAfter = [
    ...pulled.rows.filter(
      (row) =>
        !plan.toPush.some((pushed) => pushed.profile_id === row.profile_id),
    ),
    ...plan.toPush,
  ]
  return {
    kind: 'success',
    rows: rowsAfter,
    revision: pulled.revision,
    profiles: plan.profiles,
    meta: { ...plan.nextMeta, cloudRevision: pulled.revision },
  }
}

/** Prepare an explicitly confirmed upload; dispatch remains behind the lease guard. */
export function prepareConfirmedLocalUpload(
  local: Record<string, Profile>,
  meta: HouseholdSyncMeta,
  now: number,
  expectedRevision: string,
): { rows: RemoteProfileRow[]; meta: HouseholdSyncMeta } {
  const rows = Object.values(local).map((profile) => ({
    profile_id: profile.id,
    data: toWireProfile(profile),
    updated_at: new Date(now).toISOString(),
  }))
  return {
    rows,
    meta: metaAfterSuccessfulSync(meta, local, rows, now, expectedRevision),
  }
}
