import type { Profile } from '../types'

/**
 * M6 Supabase sync — types. The sync layer is LOCAL-FIRST: every write lands in
 * localStorage first (unchanged UX); the cloud is a mirror it pushes to and pulls
 * from. All of this is optional — with no Supabase config the app is exactly today.
 */

/** One profile row as stored in Supabase (the Profile as JSONB + its sync metadata). */
export interface RemoteProfileRow {
  profile_id: string
  data: Profile
  /** ISO — the content-modification time used for last-write-wins. */
  updated_at: string
}

/**
 * Per-device sync metadata. Kept in its OWN localStorage slot, OUTSIDE AppState, so
 * it never rides along in a JSON export and never affects signed-out behavior.
 */
export interface SyncMeta {
  /** per-profile local last-modified (epoch ms) + whether it still needs pushing. */
  profiles: Record<string, { updatedAt: number; dirty: boolean }>
  lastSyncAt?: number
}

export const emptyMeta = (): SyncMeta => ({ profiles: {} })

export interface SignedInUser {
  id: string
  email: string
}

/** What the Grown-Ups sync panel renders (kid screens never see any of this). */
export interface SyncStatus {
  /** VITE_SUPABASE_URL + anon key are present. */
  configured: boolean
  online: boolean
  user: SignedInUser | null
  lastSyncAt: number | null
  /** profiles still waiting to push (offline queue depth). */
  pendingCount: number
  /** a push/pull is in flight. */
  busy: boolean
}

/** A one-time migration preview shown before Push/Pull actually applies. */
export interface SyncSummary {
  count: number
  perGirl: { id: string; name: string; updatedAt: number | null }[]
}
