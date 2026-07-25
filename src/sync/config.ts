import type { AppState } from '../types'
import {
  emptyHouseholdMeta,
  type HouseholdSyncMeta,
  type SignedInUser,
} from './types'

/**
 * Supabase is optional. The anon key is public by design and RLS protects rows.
 * A service-role key must never be referenced by browser code.
 */
export function supabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
}

export function supabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
}

export function supabaseConfigured(): boolean {
  return supabaseUrl() !== '' && supabaseAnonKey() !== ''
}

const META_PREFIX = 'homeschool-hq:sync:household:'
const SYNC_BACKUP_PREFIX = 'homeschool-hq:backup:sync:'

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function metaKey(householdId: string): string {
  return `${META_PREFIX}${encodeURIComponent(householdId)}`
}

function isHouseholdMeta(
  value: unknown,
  householdId: string,
): value is HouseholdSyncMeta {
  if (!value || typeof value !== 'object') return false
  const meta = value as Partial<HouseholdSyncMeta>
  return (
    meta.householdId === householdId &&
    (meta.binding === 'bound' || meta.binding === 'unbound') &&
    typeof meta.ownsLocalData === 'boolean' &&
    !!meta.profiles &&
    typeof meta.profiles === 'object'
  )
}

/** Load metadata only from this verified household's namespaced key. */
export function loadHouseholdMeta(
  householdId: string,
  email?: string,
): HouseholdSyncMeta {
  const raw = ls()?.getItem(metaKey(householdId))
  if (!raw) return emptyHouseholdMeta(householdId, email)
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isHouseholdMeta(parsed, householdId))
      return emptyHouseholdMeta(householdId, email)
    return {
      ...emptyHouseholdMeta(householdId, email),
      ...parsed,
      ...(email ? { email } : {}),
      conflictProfileIds: Array.isArray(parsed.conflictProfileIds)
        ? parsed.conflictProfileIds.filter(
            (id): id is string => typeof id === 'string',
          )
        : [],
    }
  } catch {
    return emptyHouseholdMeta(householdId, email)
  }
}

export function saveHouseholdMeta(meta: HouseholdSyncMeta): void {
  try {
    ls()?.setItem(metaKey(meta.householdId), JSON.stringify(meta))
  } catch {
    /* best effort; sync remains safely paused if persistence is unavailable */
  }
}

/** Enumerate per-household records without introducing a global metadata key. */
export function listHouseholdMetas(): HouseholdSyncMeta[] {
  const store = ls()
  if (!store) return []
  const metas: HouseholdSyncMeta[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (!key?.startsWith(META_PREFIX)) continue
    let id: string
    try {
      id = decodeURIComponent(key.slice(META_PREFIX.length))
    } catch {
      continue
    }
    const meta = loadHouseholdMeta(id)
    if (meta.householdId === id) metas.push(meta)
  }
  return metas
}

/** The verified household currently assigned to the browser's local AppState. */
export function localDataOwner(
  exceptHouseholdId?: string,
): HouseholdSyncMeta | null {
  return (
    listHouseholdMetas().find(
      (meta) =>
        meta.householdId !== exceptHouseholdId &&
        meta.binding === 'bound' &&
        meta.ownsLocalData,
    ) ?? null
  )
}

/**
 * Assign current local data to one household and remove ownership from other
 * household-scoped records. Records remain, which protects account switching.
 */
export function claimLocalData(
  householdId: string,
  email: string,
  next: HouseholdSyncMeta,
): HouseholdSyncMeta {
  for (const meta of listHouseholdMetas()) {
    if (meta.householdId !== householdId && meta.ownsLocalData) {
      saveHouseholdMeta({ ...meta, ownsLocalData: false })
    }
  }
  const claimed: HouseholdSyncMeta = {
    ...next,
    householdId,
    email,
    binding: 'bound',
    ownsLocalData: true,
  }
  saveHouseholdMeta(claimed)
  return claimed
}

/** Snapshot local data before an explicitly confirmed cloud replacement/merge. */
export function backupLocalForHousehold(
  householdId: string,
  state: AppState,
): string | null {
  try {
    const store = ls()
    if (!store) return null
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const key = `${SYNC_BACKUP_PREFIX}${encodeURIComponent(householdId)}:${stamp}`
    store.setItem(key, JSON.stringify(state))
    return key
  } catch {
    return null
  }
}

export function asSignedInUser(meta: HouseholdSyncMeta): SignedInUser {
  return { id: meta.householdId, email: meta.email ?? meta.householdId }
}

export const householdMetaPrefixForTests = META_PREFIX
