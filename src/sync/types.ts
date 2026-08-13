import type { WireProfile } from '../portableProfile'

/**
 * One profile row as stored in Supabase. RLS supplies and verifies household_id.
 *
 * `data` is the reconciliation engine's credential-free compatibility row, not
 * a raw Profile. Its `pin` field can only be the blank sentinel and the Sync V2
 * serializer removes it before dispatch.
 */
export interface RemoteProfileRow {
  profile_id: string
  data: WireProfile
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
  /** Fingerprint of the exact persisted AppState this household owns. */
  datasetFingerprint: string | null
  /** Durable import generation explicitly approved with this binding. */
  importEpoch: string | null
  /** Server-managed household revision from the last verified cloud snapshot. */
  cloudRevision: string | null
  profiles: Record<string, ProfileSyncMeta>
  lastSyncAt?: number
  reconciliation: ReconciliationState
  conflictProfileIds: string[]
  pauseReason?: string
}

export const emptyHouseholdMeta = (
  householdId: string,
  email?: string,
): HouseholdSyncMeta => ({
  householdId,
  ...(email ? { email } : {}),
  binding: 'unbound',
  ownsLocalData: false,
  datasetFingerprint: null,
  importEpoch: null,
  cloudRevision: null,
  profiles: {},
  reconciliation: 'unbound',
  conflictProfileIds: [],
})

/**
 * Monotonic durable replacement state machine:
 * prepared -> dataset-written -> ownership-written -> committed -> removed.
 * Any phase may fail closed to review, which is never auto-finalized.
 */
export type OwnershipTransitionPhase =
  | 'prepared'
  | 'dataset-written'
  | 'ownership-written'
  | 'committed'
  | 'review'

export interface OwnershipTransition {
  version: 2
  transitionId: string
  operationId: string
  targetHouseholdId: string
  targetEmail: string
  expectedFingerprint: string
  expectedImportEpoch: string
  expectedCloudRevision: string
  previousFingerprint: string
  previousOwnerHouseholdId: string | null
  phase: OwnershipTransitionPhase
  createdAt: number
  updatedAt: number
  failureReason?: string
  nextMeta: HouseholdSyncMeta
}

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
  | { ok: true; rows: RemoteProfileRow[]; revision: string }
  | { ok: false; error: string }

export type CloudPushResult =
  | { ok: true; revision: string; replayed?: boolean }
  | {
      ok: false
      error: string
      conflict?: true
      revision?: string
    }

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
  provenance: 'verified' | 'unbound' | 'paused'
  pauseReason: string | null
  busy: boolean
  error: string | null
  decision: SyncDecision | null
}

export type ConflictChoice = 'local' | 'cloud'
