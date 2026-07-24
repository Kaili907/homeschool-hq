import type { Profile } from '../types'
import type { RemoteProfileRow, SyncMeta, SyncSummary } from './types'

/**
 * M6 sync engine — PURE. All conflict resolution, merging and queue bookkeeping
 * lives here with no network or React, so it is exhaustively unit-testable. The
 * transport (Supabase REST) and the React hook are thin shells over these.
 */

const iso = (ms: number) => new Date(ms).toISOString()
const msOf = (isoStr: string) => Date.parse(isoStr)

/**
 * Field-group last-write-wins: the winner's field-groups win, and any field-group
 * the LOSER has that the winner lacks is KEPT. Because every optional Profile
 * field-group is a top-level key, a shallow spread is exactly per-group LWW that
 * never drops a group the other side has.
 */
export function fieldGroupMerge(winner: Profile, loser: Profile): Profile {
  return { ...loser, ...winner }
}

export interface ReconcileResult {
  profiles: Record<string, Profile>
  meta: SyncMeta
  /** rows to push so the cloud converges to the merged union. */
  toPush: RemoteProfileRow[]
}

/**
 * Merge the local set with the pulled remote rows into one converged set.
 * - both present → newer (by updated_at) wins per field-group; loser-only groups
 *   are kept; the merged union is pushed when it differs from the remote row, so
 *   the cloud also converges (never drops either side's groups).
 * - local only  → keep it, push it (new to the cloud).
 * - remote only → adopt it, nothing to push.
 * Deterministic and side-effect free.
 */
export function reconcile(
  local: Record<string, Profile>,
  meta: SyncMeta,
  remote: RemoteProfileRow[],
  now: number,
): ReconcileResult {
  const remoteById = new Map(remote.map((r) => [r.profile_id, r]))
  const ids = new Set<string>([...Object.keys(local), ...remoteById.keys()])
  const profiles: Record<string, Profile> = {}
  const metaProfiles: SyncMeta['profiles'] = { ...meta.profiles }
  const toPush: RemoteProfileRow[] = []

  for (const id of ids) {
    const loc = local[id]
    const rem = remoteById.get(id)
    const locUpdated = meta.profiles[id]?.updatedAt ?? 0

    if (loc && !rem) {
      const at = locUpdated || now
      profiles[id] = loc
      metaProfiles[id] = { updatedAt: at, dirty: false }
      toPush.push({ profile_id: id, data: loc, updated_at: iso(at) })
      continue
    }
    if (!loc && rem) {
      profiles[id] = rem.data
      metaProfiles[id] = { updatedAt: msOf(rem.updated_at), dirty: false }
      continue
    }
    if (loc && rem) {
      const remUpdated = msOf(rem.updated_at)
      const localNewer = locUpdated >= remUpdated
      const merged = localNewer ? fieldGroupMerge(loc, rem.data) : fieldGroupMerge(rem.data, loc)
      const mergedUpdated = Math.max(locUpdated, remUpdated)
      profiles[id] = merged
      metaProfiles[id] = { updatedAt: mergedUpdated, dirty: false }
      if (JSON.stringify(merged) !== JSON.stringify(rem.data)) {
        toPush.push({ profile_id: id, data: merged, updated_at: iso(mergedUpdated) })
      }
    }
  }
  return { profiles, meta: { ...meta, profiles: metaProfiles, lastSyncAt: now }, toPush }
}

// ---------- dirty tracking / offline queue (pure) ----------

/** Which profiles changed vs a previous snapshot (JSON compare, per profile). */
export function changedProfiles(
  prev: Record<string, Profile>,
  next: Record<string, Profile>,
): string[] {
  const ids = new Set<string>([...Object.keys(prev), ...Object.keys(next)])
  const out: string[] = []
  for (const id of ids) {
    if (JSON.stringify(prev[id]) !== JSON.stringify(next[id])) out.push(id)
  }
  return out
}

/** Stamp profiles as locally modified (they now need pushing). */
export function markDirty(meta: SyncMeta, ids: string[], now: number): SyncMeta {
  if (ids.length === 0) return meta
  const profiles = { ...meta.profiles }
  for (const id of ids) profiles[id] = { updatedAt: now, dirty: true }
  return { ...meta, profiles }
}

/** Profile ids still waiting to push — the offline queue depth. */
export function dirtyIds(meta: SyncMeta): string[] {
  return Object.keys(meta.profiles).filter((id) => meta.profiles[id]?.dirty)
}

/** The rows to push for the currently-dirty profiles. */
export function pendingRows(local: Record<string, Profile>, meta: SyncMeta): RemoteProfileRow[] {
  return dirtyIds(meta)
    .filter((id) => local[id])
    .map((id) => ({ profile_id: id, data: local[id], updated_at: iso(meta.profiles[id].updatedAt) }))
}

/** Clear the dirty flag on ids that were successfully pushed. */
export function clearDirty(meta: SyncMeta, ids: string[]): SyncMeta {
  if (ids.length === 0) return meta
  const profiles = { ...meta.profiles }
  for (const id of ids) if (profiles[id]) profiles[id] = { ...profiles[id], dirty: false }
  return { ...meta, profiles }
}

/**
 * Flush the offline queue through `push`. On success returns the pushed ids (to
 * clear dirty); on failure returns [] (they stay queued for the next reconnect).
 * Never throws — a rejected push is treated as "still offline".
 */
export async function flushPending(
  rows: RemoteProfileRow[],
  push: (rows: RemoteProfileRow[]) => Promise<boolean>,
): Promise<string[]> {
  if (rows.length === 0) return []
  try {
    const ok = await push(rows)
    return ok ? rows.map((r) => r.profile_id) : []
  } catch {
    return []
  }
}

// ---------- migration previews (never silently overwrite) ----------

/** Summary of local profiles for the "Push this device" confirm. */
export function summarizeLocal(profiles: Record<string, Profile>, meta: SyncMeta): SyncSummary {
  const perGirl = Object.values(profiles).map((p) => ({
    id: p.id,
    name: p.name,
    updatedAt: meta.profiles[p.id]?.updatedAt ?? null,
  }))
  return { count: perGirl.length, perGirl }
}

/** Summary of cloud rows for the "Pull cloud data" confirm. */
export function summarizeRemote(rows: RemoteProfileRow[]): SyncSummary {
  const perGirl = rows.map((r) => ({ id: r.profile_id, name: r.data.name, updatedAt: msOf(r.updated_at) }))
  return { count: perGirl.length, perGirl }
}
