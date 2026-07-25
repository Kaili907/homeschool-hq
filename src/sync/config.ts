import type { AppState } from '../types'
import { createOperationId } from './coordination'
import {
  datasetFingerprint,
  persistDatasetVerified,
  readPersistedDataset,
} from './provenance'
import {
  emptyHouseholdMeta,
  type HouseholdSyncMeta,
  type OwnershipTransition,
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
const TRANSITION_PREFIX = 'homeschool-hq:sync:transition:'
const LEGACY_SESSION_KEY = 'homeschool-hq:sync:session'
const LEGACY_META_KEY = 'homeschool-hq:sync:meta'

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

function transitionKey(householdId: string): string {
  return `${TRANSITION_PREFIX}${encodeURIComponent(householdId)}`
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
      datasetFingerprint:
        typeof parsed.datasetFingerprint === 'string'
          ? parsed.datasetFingerprint
          : null,
      cloudRevision:
        typeof parsed.cloudRevision === 'string' ? parsed.cloudRevision : null,
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
  saveHouseholdMetaVerified(meta)
}

export function saveHouseholdMetaVerified(meta: HouseholdSyncMeta): boolean {
  try {
    const store = ls()
    if (!store) return false
    const key = metaKey(meta.householdId)
    store.setItem(key, JSON.stringify(meta))
    const stored = store.getItem(key)
    return (
      stored !== null && JSON.parse(stored).householdId === meta.householdId
    )
  } catch {
    return false
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
  expectedFingerprint: string,
): HouseholdSyncMeta {
  const persisted = readPersistedDataset()
  if (!persisted.ok || persisted.fingerprint !== expectedFingerprint) {
    throw new Error(
      'Household ownership was not saved because persisted Academy data did not match.',
    )
  }
  for (const meta of listHouseholdMetas()) {
    if (meta.householdId !== householdId && meta.ownsLocalData) {
      saveHouseholdMeta({
        ...meta,
        ownsLocalData: false,
        pauseReason:
          'A different household was explicitly assigned this dataset.',
      })
    }
  }
  const claimed: HouseholdSyncMeta = {
    ...next,
    householdId,
    email,
    binding: 'bound',
    ownsLocalData: true,
    datasetFingerprint: expectedFingerprint,
    pauseReason: undefined,
  }
  if (!saveHouseholdMetaVerified(claimed)) {
    throw new Error('Household ownership metadata could not be saved safely.')
  }
  return claimed
}

function clearPending(meta: HouseholdSyncMeta): HouseholdSyncMeta {
  return {
    ...meta,
    profiles: Object.fromEntries(
      Object.entries(meta.profiles).map(([id, profile]) => [
        id,
        { ...profile, dirty: false },
      ]),
    ),
  }
}

/** Fail closed after import, unknown recovery, or external provenance change. */
export function invalidateAllLocalOwnership(reason: string): void {
  for (const meta of listHouseholdMetas()) {
    saveHouseholdMeta({
      ...clearPending(meta),
      binding: 'unbound',
      ownsLocalData: false,
      datasetFingerprint: null,
      reconciliation: 'review',
      conflictProfileIds: [],
      pauseReason: reason,
    })
  }
}

export function pauseHouseholdForMismatch(
  householdId: string,
  email: string | undefined,
  reason: string,
): HouseholdSyncMeta {
  const paused: HouseholdSyncMeta = {
    ...clearPending(loadHouseholdMeta(householdId, email)),
    binding: 'unbound',
    ownsLocalData: false,
    datasetFingerprint: null,
    reconciliation: 'review',
    conflictProfileIds: [],
    pauseReason: reason,
  }
  saveHouseholdMeta(paused)
  return paused
}

function saveTransition(transition: OwnershipTransition): boolean {
  try {
    const store = ls()
    if (!store) return false
    const key = transitionKey(transition.targetHouseholdId)
    store.setItem(key, JSON.stringify(transition))
    return (
      (JSON.parse(store.getItem(key) ?? 'null') as OwnershipTransition | null)
        ?.operationId === transition.operationId
    )
  } catch {
    return false
  }
}

export function loadOwnershipTransition(
  householdId: string,
): OwnershipTransition | null {
  try {
    const raw = ls()?.getItem(transitionKey(householdId))
    if (!raw) return null
    const transition = JSON.parse(raw) as Partial<OwnershipTransition>
    return transition.version === 1 &&
      transition.targetHouseholdId === householdId &&
      typeof transition.operationId === 'string' &&
      typeof transition.expectedFingerprint === 'string' &&
      typeof transition.previousFingerprint === 'string' &&
      (transition.phase === 'prepared' ||
        transition.phase === 'app-state-written' ||
        transition.phase === 'review') &&
      !!transition.nextMeta
      ? (transition as OwnershipTransition)
      : null
  } catch {
    return null
  }
}

function removeTransition(transition: OwnershipTransition): void {
  try {
    const key = transitionKey(transition.targetHouseholdId)
    const stored = loadOwnershipTransition(transition.targetHouseholdId)
    if (stored?.operationId === transition.operationId) ls()?.removeItem(key)
  } catch {
    // A leftover completed transition is safe and will be recovered next boot.
  }
}

export function prepareOwnershipTransition(
  householdId: string,
  email: string,
  nextMeta: HouseholdSyncMeta,
  replacement: AppState,
  now = Date.now(),
  expectedPreviousFingerprint?: string,
): OwnershipTransition {
  const current = readPersistedDataset()
  if (!current.ok) throw new Error(current.error)
  if (
    expectedPreviousFingerprint &&
    current.fingerprint !== expectedPreviousFingerprint
  ) {
    throw new Error(
      'Persisted Academy data changed immediately before ownership replacement.',
    )
  }
  const transition: OwnershipTransition = {
    version: 1,
    operationId: createOperationId('ownership'),
    targetHouseholdId: householdId,
    targetEmail: email,
    expectedFingerprint: datasetFingerprint(replacement),
    previousFingerprint: current.fingerprint,
    previousOwnerHouseholdId: localDataOwner()?.householdId ?? null,
    phase: 'prepared',
    createdAt: now,
    nextMeta,
  }
  if (!saveTransition(transition)) {
    throw new Error('The pending household transition could not be saved.')
  }
  return transition
}

export function persistOwnershipTransitionDataset(
  transition: OwnershipTransition,
  replacement: AppState,
): OwnershipTransition {
  const current = loadOwnershipTransition(transition.targetHouseholdId)
  if (current?.operationId !== transition.operationId) {
    throw new Error('The household transition is no longer current.')
  }
  if (datasetFingerprint(replacement) !== transition.expectedFingerprint) {
    throw new Error('The replacement dataset changed during household binding.')
  }
  const persisted = persistDatasetVerified(replacement)
  if (
    !persisted.ok ||
    persisted.fingerprint !== transition.expectedFingerprint
  ) {
    throw new Error(
      persisted.ok
        ? 'Persisted Academy provenance did not match the pending transition.'
        : persisted.error,
    )
  }
  const written: OwnershipTransition = {
    ...transition,
    phase: 'app-state-written',
  }
  if (!saveTransition(written)) {
    throw new Error('The written household transition could not be verified.')
  }
  return written
}

export function finalizeOwnershipTransition(
  transition: OwnershipTransition,
): HouseholdSyncMeta {
  const current = loadOwnershipTransition(transition.targetHouseholdId)
  const persisted = readPersistedDataset()
  if (
    current?.operationId !== transition.operationId ||
    !persisted.ok ||
    persisted.fingerprint !== transition.expectedFingerprint
  ) {
    throw new Error('Household binding finalization failed provenance checks.')
  }
  const claimed = claimLocalData(
    transition.targetHouseholdId,
    transition.targetEmail,
    transition.nextMeta,
    transition.expectedFingerprint,
  )
  removeTransition(transition)
  return claimed
}

export function replaceDatasetAndClaim(
  householdId: string,
  email: string,
  nextMeta: HouseholdSyncMeta,
  replacement: AppState,
  expectedPreviousFingerprint?: string,
): HouseholdSyncMeta {
  const prepared = prepareOwnershipTransition(
    householdId,
    email,
    nextMeta,
    replacement,
    Date.now(),
    expectedPreviousFingerprint,
  )
  const written = persistOwnershipTransitionDataset(prepared, replacement)
  return finalizeOwnershipTransition(written)
}

export type TransitionRecovery =
  | { kind: 'none' }
  | { kind: 'restored-old'; householdId: string }
  | { kind: 'finished-new'; householdId: string }
  | { kind: 'review'; householdId: string; reason: string }

export function recoverOwnershipTransitions(): TransitionRecovery[] {
  const store = ls()
  if (!store) return [{ kind: 'none' }]
  const householdIds: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (!key?.startsWith(TRANSITION_PREFIX)) continue
    try {
      householdIds.push(decodeURIComponent(key.slice(TRANSITION_PREFIX.length)))
    } catch {
      // Ignore malformed keys that cannot create a trusted binding.
    }
  }
  if (householdIds.length === 0) return [{ kind: 'none' }]
  const persisted = readPersistedDataset(store)
  const recoveries: TransitionRecovery[] = []
  for (const householdId of householdIds) {
    const transition = loadOwnershipTransition(householdId)
    if (!transition) continue
    if (
      persisted.ok &&
      persisted.fingerprint === transition.previousFingerprint
    ) {
      removeTransition(transition)
      recoveries.push({ kind: 'restored-old', householdId })
      continue
    }
    if (
      persisted.ok &&
      persisted.fingerprint === transition.expectedFingerprint
    ) {
      try {
        finalizeOwnershipTransition({
          ...transition,
          phase: 'app-state-written',
        })
        recoveries.push({ kind: 'finished-new', householdId })
        continue
      } catch {
        // Fall through to the fail-closed review state.
      }
    }
    const reason =
      'Academy data changed during an interrupted household transition. Cloud writes are paused for parent review.'
    invalidateAllLocalOwnership(reason)
    saveTransition({ ...transition, phase: 'review' })
    recoveries.push({ kind: 'review', householdId, reason })
  }
  return recoveries
}

export function cleanupLegacySyncStorage(): void {
  try {
    const store = ls()
    store?.removeItem(LEGACY_SESSION_KEY)
    store?.removeItem(LEGACY_META_KEY)
  } catch {
    // The official client never reads these keys; inaccessible storage is inert.
  }
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
export const transitionPrefixForTests = TRANSITION_PREFIX
export const legacySyncKeysForTests = {
  session: LEGACY_SESSION_KEY,
  meta: LEGACY_META_KEY,
}
