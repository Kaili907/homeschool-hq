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

export interface SyncTransport {
  pull: () => Promise<CloudPullResult>
  push: (rows: RemoteProfileRow[]) => Promise<CloudPushResult>
}

export type HouseholdInspection =
  | { kind: 'pull-error'; error: string }
  | {
      kind: 'preview'
      rows: RemoteProfileRow[]
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
      preview: ReconciliationPreview
      meta: HouseholdSyncMeta
    }
  | { kind: 'push-error'; error: string; meta: HouseholdSyncMeta }
  | {
      kind: 'success'
      rows: RemoteProfileRow[]
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

  const plan = automaticSyncPlan(local, pulled.rows, meta, now)
  if (!plan.ok) {
    const conflictProfileIds = plan.preview.profiles
      .filter((profile) => profile.category === 'both-changed')
      .map((profile) => profile.id)
    return {
      kind: 'review',
      rows: pulled.rows,
      preview: plan.preview,
      meta: {
        ...meta,
        reconciliation: 'review',
        conflictProfileIds,
      },
    }
  }

  if (plan.toPush.length > 0) {
    const pushed = await transport.push(plan.toPush)
    if (!pushed.ok) {
      return {
        kind: 'push-error',
        error: pushed.error,
        meta: markDirty(
          meta,
          plan.toPush.map((row) => row.profile_id),
          now,
        ),
      }
    }
  }
  return {
    kind: 'success',
    rows: pulled.rows,
    profiles: plan.profiles,
    meta: plan.nextMeta,
  }
}

/** Explicitly confirmed empty-cloud upload. Calling this function is the confirmation boundary. */
export async function executeConfirmedLocalUpload(
  local: Record<string, Profile>,
  meta: HouseholdSyncMeta,
  now: number,
  push: SyncTransport['push'],
): Promise<
  | { ok: false; error: string }
  | { ok: true; rows: RemoteProfileRow[]; meta: HouseholdSyncMeta }
> {
  const rows = Object.values(local).map((profile) => ({
    profile_id: profile.id,
    data: profile,
    updated_at: new Date(now).toISOString(),
  }))
  const result = await push(rows)
  return result.ok
    ? {
        ok: true,
        rows,
        meta: metaAfterSuccessfulSync(meta, local, rows, now),
      }
    : result
}
