import type { Profile } from '../types'
import type {
  ConflictChoice,
  HouseholdSyncMeta,
  ProfileSyncMeta,
  ReconciliationPreview,
  RemoteProfileRow,
} from './types'

const iso = (ms: number) => new Date(ms).toISOString()
const msOf = (value: string) => Date.parse(value)

/** Small deterministic content fingerprint. It is change detection, not security. */
export function profileHash(profile: Profile): string {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  const text = JSON.stringify(canonicalize(profile))
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function remoteRowsSignature(rows: RemoteProfileRow[]): string {
  return [...rows]
    .sort((a, b) => a.profile_id.localeCompare(b.profile_id))
    .map(
      (row) => `${row.profile_id}:${row.updated_at}:${profileHash(row.data)}`,
    )
    .join('|')
}

export function changedProfiles(
  prev: Record<string, Profile>,
  next: Record<string, Profile>,
): string[] {
  const ids = new Set<string>([...Object.keys(prev), ...Object.keys(next)])
  return [...ids].filter(
    (id) => JSON.stringify(prev[id]) !== JSON.stringify(next[id]),
  )
}

export function markDirty(
  meta: HouseholdSyncMeta,
  ids: string[],
  now: number,
): HouseholdSyncMeta {
  if (ids.length === 0) return meta
  const profiles = { ...meta.profiles }
  for (const id of ids) {
    profiles[id] = { ...profiles[id], updatedAt: now, dirty: true }
  }
  return { ...meta, profiles }
}

export function dirtyIds(meta: HouseholdSyncMeta): string[] {
  return Object.keys(meta.profiles).filter((id) => meta.profiles[id]?.dirty)
}

export function pendingRows(
  local: Record<string, Profile>,
  meta: HouseholdSyncMeta,
): RemoteProfileRow[] {
  return dirtyIds(meta)
    .filter((id) => local[id])
    .map((id) => ({
      profile_id: id,
      data: local[id],
      updated_at: iso(meta.profiles[id].updatedAt),
    }))
}

export function clearDirtyAfterPush(
  meta: HouseholdSyncMeta,
  rows: RemoteProfileRow[],
): HouseholdSyncMeta {
  if (rows.length === 0) return meta
  const profiles = { ...meta.profiles }
  for (const row of rows) {
    const hash = profileHash(row.data)
    profiles[row.profile_id] = {
      ...profiles[row.profile_id],
      updatedAt: msOf(row.updated_at),
      dirty: false,
      lastLocalHash: hash,
      lastCloudHash: hash,
      cloudUpdatedAt: msOf(row.updated_at),
    }
  }
  return { ...meta, profiles }
}

export function buildReconciliationPreview(
  local: Record<string, Profile>,
  remote: RemoteProfileRow[],
  meta: HouseholdSyncMeta,
): ReconciliationPreview {
  const remoteById = new Map(remote.map((row) => [row.profile_id, row]))
  const ids = new Set([...Object.keys(local), ...remoteById.keys()])
  const profiles: ReconciliationPreview['profiles'] = []
  const potentiallyDestructive: string[] = []

  for (const id of ids) {
    const loc = local[id]
    const cloud = remoteById.get(id)
    const profileMeta = meta.profiles[id]
    let category: ReconciliationPreview['profiles'][number]['category']

    if (loc && !cloud) {
      category = 'local-only'
    } else if (!loc && cloud) {
      category = 'cloud-only'
    } else if (loc && cloud) {
      const localHash = profileHash(loc)
      const cloudHash = profileHash(cloud.data)
      if (localHash === cloudHash) {
        category = 'unchanged'
      } else if (
        meta.binding !== 'bound' ||
        !profileMeta?.lastLocalHash ||
        !profileMeta.lastCloudHash
      ) {
        category = 'both-changed'
      } else {
        const localChanged = localHash !== profileMeta.lastLocalHash
        const cloudChanged = cloudHash !== profileMeta.lastCloudHash
        category =
          localChanged && cloudChanged
            ? 'both-changed'
            : localChanged
              ? 'local-changed'
              : cloudChanged
                ? 'cloud-changed'
                : 'both-changed'
      }
    } else {
      continue
    }

    const name = loc?.name ?? cloud?.data.name ?? id
    profiles.push({
      id,
      name,
      category,
      localUpdatedAt: profileMeta?.updatedAt ?? null,
      cloudUpdatedAt: cloud ? msOf(cloud.updated_at) : null,
    })
    if (category === 'both-changed') {
      potentiallyDestructive.push(
        `${name} changed in both places; choosing either copy replaces the other copy.`,
      )
    } else if (category === 'cloud-only') {
      potentiallyDestructive.push(
        `${name} exists only in the cloud and would be added to this device.`,
      )
    } else if (category === 'local-only') {
      potentiallyDestructive.push(
        `${name} exists only on this device and would be uploaded by a merge.`,
      )
    }
  }

  return {
    profiles,
    hasConflicts: profiles.some(
      (profile) => profile.category === 'both-changed',
    ),
    potentiallyDestructive,
  }
}

export interface MergeSelectionResult {
  profiles: Record<string, Profile>
  toPush: RemoteProfileRow[]
}

/**
 * Apply an explicit parent-reviewed selection. This never performs a shallow
 * whole-profile merge: every two-sided conflict must choose one complete copy.
 */
export function applyReviewedSelection(
  local: Record<string, Profile>,
  remote: RemoteProfileRow[],
  preview: ReconciliationPreview,
  choices: Record<string, ConflictChoice>,
  now: number,
): MergeSelectionResult {
  const remoteById = new Map(remote.map((row) => [row.profile_id, row]))
  const profiles: Record<string, Profile> = {}
  const toPush: RemoteProfileRow[] = []

  for (const item of preview.profiles) {
    const loc = local[item.id]
    const cloud = remoteById.get(item.id)
    const choice =
      item.category === 'both-changed'
        ? choices[item.id]
        : item.category === 'cloud-only' || item.category === 'cloud-changed'
          ? 'cloud'
          : 'local'
    if (!choice)
      throw new Error(
        `Choose a copy for ${item.name} before applying the merge.`,
      )

    if (choice === 'cloud') {
      if (!cloud) throw new Error(`Cloud copy for ${item.name} is unavailable.`)
      profiles[item.id] = cloud.data
    } else {
      if (!loc) throw new Error(`Device copy for ${item.name} is unavailable.`)
      profiles[item.id] = loc
      if (!cloud || profileHash(loc) !== profileHash(cloud.data)) {
        toPush.push({
          profile_id: item.id,
          data: loc,
          updated_at: iso(Math.max(now, item.localUpdatedAt ?? 0)),
        })
      }
    }
  }
  return { profiles, toPush }
}

/** Establish clean comparison baselines after a successful reviewed operation. */
export function metaAfterSuccessfulSync(
  meta: HouseholdSyncMeta,
  profiles: Record<string, Profile>,
  remote: RemoteProfileRow[],
  now: number,
): HouseholdSyncMeta {
  const remoteById = new Map(remote.map((row) => [row.profile_id, row]))
  const profileMeta: Record<string, ProfileSyncMeta> = {}
  for (const [id, profile] of Object.entries(profiles)) {
    const row = remoteById.get(id)
    const hash = profileHash(profile)
    profileMeta[id] = {
      updatedAt: row ? msOf(row.updated_at) : now,
      dirty: false,
      lastLocalHash: hash,
      lastCloudHash: hash,
      cloudUpdatedAt: row ? msOf(row.updated_at) : now,
    }
  }
  return {
    ...meta,
    profiles: profileMeta,
    cloudRevision: remoteRowsSignature(remote),
    lastSyncAt: now,
    reconciliation: 'ready',
    conflictProfileIds: [],
    pauseReason: undefined,
  }
}

/**
 * Safe automatic continuation for an already matching binding.
 * True two-sided changes stop for review; one-sided changes are deterministic.
 */
export function automaticSyncPlan(
  local: Record<string, Profile>,
  remote: RemoteProfileRow[],
  meta: HouseholdSyncMeta,
  now: number,
):
  | { ok: false; preview: ReconciliationPreview }
  | {
      ok: true
      preview: ReconciliationPreview
      profiles: Record<string, Profile>
      toPush: RemoteProfileRow[]
      nextMeta: HouseholdSyncMeta
    } {
  const preview = buildReconciliationPreview(local, remote, meta)
  if (preview.hasConflicts) return { ok: false, preview }
  const selected = applyReviewedSelection(local, remote, preview, {}, now)
  const remoteAfter = [
    ...remote.filter(
      (row) =>
        !selected.toPush.some((pushed) => pushed.profile_id === row.profile_id),
    ),
    ...selected.toPush,
  ]
  return {
    ok: true,
    preview,
    profiles: selected.profiles,
    toPush: selected.toPush,
    nextMeta: metaAfterSuccessfulSync(
      meta,
      selected.profiles,
      remoteAfter,
      now,
    ),
  }
}
