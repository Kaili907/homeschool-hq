import type { Profile } from '../types'

/** One profile row as stored in Supabase. RLS supplies and verifies household_id. */
export interface RemoteProfileRow {
  profile_id: string
  data: Profile
  updated_at: string
}

export interface SignedInUser {
  id: string
  email: string
}

export type BindingState = 'unbound' | 'bound'
export type ReconciliationState = 'unbound' | 'ready' | 'review'

/** Per-profile metadata for one verified household only. */
export interface ProfileSyncMeta {
  /** Local content-modification time. */
  updatedAt: number
  /** A household-scoped pending upload. */
  dirty: boolean
  /** Content hashes from the last successful reconciliation. */
  lastLocalHash?: string
  lastCloudHash?: string
  /** Last successfully observed cloud row revision. */
  cloudUpdatedAt?: number
}

/**
 * All sync state is persisted under a key containing this verified household id.
 * Nothing in this object is shared between authenticated households.
 */
export interface HouseholdSyncMeta {
  householdId: string
  email?: string
  binding: BindingState
  /** True only when the current local AppState has been explicitly assigned here. */
  ownsLocalData: boolean
  profiles: Record<string, ProfileSyncMeta>
  lastSyncAt?: number
  reconciliation: ReconciliationState
  conflictProfileIds: string[]
}

export const emptyHouseholdMeta = (
  householdId: string,
  email?: string,
): HouseholdSyncMeta => ({
  householdId,
  ...(email ? { email } : {}),
  binding: 'unbound',
  ownsLocalData: false,
  profiles: {},
  reconciliation: 'unbound',
  conflictProfileIds: [],
})

export type ReconciliationCategory =
  | 'local-only'
  | 'cloud-only'
  | 'local-changed'
  | 'cloud-changed'
  | 'both-changed'
  | 'unchanged'

export interface ReconciliationProfile {
  id: string
  name: string
  category: ReconciliationCategory
  localUpdatedAt: number | null
  cloudUpdatedAt: number | null
}

export interface ReconciliationPreview {
  profiles: ReconciliationProfile[]
  hasConflicts: boolean
  potentiallyDestructive: string[]
}

export type CloudPullResult =
  | { ok: true; rows: RemoteProfileRow[] }
  | { ok: false; error: string }

export type CloudPushResult = { ok: true } | { ok: false; error: string }

export type SyncDecisionReason = 'first-sync' | 'account-switch' | 'conflict'

export interface SyncDecision {
  reason: SyncDecisionReason
  cloud: 'empty' | 'data'
  preview: ReconciliationPreview
  previousHousehold?: SignedInUser
}

/** What the Grown-Ups sync panel renders. Kid screens never see this. */
export interface SyncStatus {
  configured: boolean
  online: boolean
  user: SignedInUser | null
  binding: BindingState | 'signed-out'
  lastSyncAt: number | null
  pendingCount: number
  busy: boolean
  error: string | null
  decision: SyncDecision | null
}

export type ConflictChoice = 'local' | 'cloud'
