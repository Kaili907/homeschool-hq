import type { AppState } from '../types'
import {
  createOperationId,
  type FinalizationDatasetExpectation,
  type FinalizationGuard,
} from './coordination'
import {
  beginDurableImportTransition,
  datasetFingerprint,
  ensureDatasetProvenance,
  finishDurableImportTransition,
  markImportDatasetWritten,
  persistDatasetVerified,
  readDatasetProvenance,
  readPersistedDataset,
  recordPersistedDatasetFingerprint,
  type DatasetProvenanceRecord,
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
const TRANSITION_PREFIX = 'homeschool-hq:sync:transition:v2:'
const LEGACY_TRANSITION_PREFIX = 'homeschool-hq:sync:transition:'
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

function transitionKey(householdId: string, transitionId: string): string {
  return `${TRANSITION_PREFIX}${encodeURIComponent(householdId)}:${encodeURIComponent(transitionId)}`
}

function isHouseholdMeta(
  value: unknown,
  householdId: string,
): value is HouseholdSyncMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const meta = value as Partial<HouseholdSyncMeta>
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  const allowedMetaKeys = new Set([
    'householdId',
    'email',
    'binding',
    'ownsLocalData',
    'datasetFingerprint',
    'importEpoch',
    'cloudRevision',
    'profiles',
    'lastSyncAt',
    'reconciliation',
    'conflictProfileIds',
    'pauseReason',
  ])
  if (Object.keys(value).some((key) => !allowedMetaKeys.has(key))) return false
  const profiles =
    meta.profiles && typeof meta.profiles === 'object' && !Array.isArray(meta.profiles)
      ? Object.entries(meta.profiles)
      : []
  return (
    meta.householdId === householdId &&
    householdId.length > 0 &&
    householdId.length <= 200 &&
    (meta.email === undefined ||
      (typeof meta.email === 'string' && meta.email.length <= 512)) &&
    (meta.binding === 'bound' || meta.binding === 'unbound') &&
    typeof meta.ownsLocalData === 'boolean' &&
    (meta.datasetFingerprint === null ||
      (typeof meta.datasetFingerprint === 'string' &&
        meta.datasetFingerprint.length <= 256)) &&
    (meta.importEpoch === null ||
      (typeof meta.importEpoch === 'string' &&
        meta.importEpoch.length <= 256)) &&
    (meta.cloudRevision === null ||
      (typeof meta.cloudRevision === 'string' &&
        /^(0|[1-9]\d*)$/.test(meta.cloudRevision))) &&
    profiles.length <= 5 &&
    profiles.every(
      ([id, profile]) =>
        /^p[1-5]$/.test(id) &&
        !!profile &&
        typeof profile === 'object' &&
        !Array.isArray(profile) &&
        Object.keys(profile).every((key) =>
          [
            'updatedAt',
            'dirty',
            'lastLocalHash',
            'lastCloudHash',
            'cloudUpdatedAt',
          ].includes(key),
        ) &&
        typeof profile.updatedAt === 'number' &&
        Number.isFinite(profile.updatedAt) &&
        typeof profile.dirty === 'boolean' &&
        (profile.lastLocalHash === undefined ||
          (typeof profile.lastLocalHash === 'string' &&
            profile.lastLocalHash.length <= 256)) &&
        (profile.lastCloudHash === undefined ||
          (typeof profile.lastCloudHash === 'string' &&
            profile.lastCloudHash.length <= 256)) &&
        (profile.cloudUpdatedAt === undefined ||
          (typeof profile.cloudUpdatedAt === 'number' &&
            Number.isFinite(profile.cloudUpdatedAt))),
    ) &&
    (meta.lastSyncAt === undefined ||
      (typeof meta.lastSyncAt === 'number' &&
        Number.isFinite(meta.lastSyncAt))) &&
    (meta.reconciliation === 'unbound' ||
      meta.reconciliation === 'ready' ||
      meta.reconciliation === 'review') &&
    Array.isArray(meta.conflictProfileIds) &&
    meta.conflictProfileIds.length <= 5 &&
    meta.conflictProfileIds.every(
      (id) => typeof id === 'string' && /^p[1-5]$/.test(id),
    ) &&
    new Set(meta.conflictProfileIds).size === meta.conflictProfileIds.length &&
    (meta.pauseReason === undefined ||
      (typeof meta.pauseReason === 'string' &&
        meta.pauseReason.length <= 2_000)) &&
    (!meta.ownsLocalData ||
      (meta.binding === 'bound' &&
        typeof meta.datasetFingerprint === 'string' &&
        typeof meta.importEpoch === 'string'))
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
      importEpoch:
        typeof parsed.importEpoch === 'string' ? parsed.importEpoch : null,
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
    if (stored === null) return false
    const parsed = JSON.parse(stored) as unknown
    return (
      isHouseholdMeta(parsed, meta.householdId) &&
      JSON.stringify(parsed) === JSON.stringify(meta)
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

export type OwnershipCommitted = (meta: HouseholdSyncMeta) => void

interface PreparedOwnershipClaim {
  claimed: HouseholdSyncMeta
  otherOwnersBefore: HouseholdSyncMeta[]
}

function ownershipStillCompatible(
  meta: HouseholdSyncMeta,
  expectedFingerprint: string,
  expectedImportEpoch: string,
  transition?: OwnershipTransition,
): boolean {
  return (
    !meta.ownsLocalData ||
    (meta.binding === 'bound' &&
      meta.datasetFingerprint === expectedFingerprint &&
      meta.importEpoch === expectedImportEpoch) ||
    (!!transition &&
      meta.binding === 'bound' &&
      meta.ownsLocalData &&
      meta.householdId === transition.targetHouseholdId &&
      meta.datasetFingerprint === transition.previousFingerprint &&
      meta.importEpoch === transition.expectedImportEpoch)
  )
}

async function prepareOwnershipClaim(
  householdId: string,
  email: string,
  next: HouseholdSyncMeta,
  expectedFingerprint: string,
  guard: FinalizationGuard,
  expectedTransition?: OwnershipTransition,
): Promise<PreparedOwnershipClaim> {
  await guard.assertCurrent('Ownership claim started')
  const persisted = await readPersistedDataset()
  await guard.assertCurrent('Ownership claim verified persisted Academy data')
  const provenance = readDatasetProvenance()
  const targetBefore = loadHouseholdMeta(householdId, email)
  const currentTransition = expectedTransition
    ? loadOwnershipTransition(householdId, expectedTransition.transitionId)
    : null
  if (
    !persisted.ok ||
    persisted.fingerprint !== expectedFingerprint ||
    !provenance ||
    provenance.importTransition ||
    provenance.fingerprint !== expectedFingerprint ||
    provenance.importEpoch !== guard.importEpoch ||
    !ownershipStillCompatible(
      targetBefore,
      expectedFingerprint,
      provenance.importEpoch,
      expectedTransition,
    ) ||
    (expectedTransition &&
      (currentTransition?.operationId !== expectedTransition.operationId ||
        currentTransition.phase !== expectedTransition.phase))
  ) {
    throw new Error(
      'Household ownership was not saved because persisted Academy data or its operation context did not match.',
    )
  }
  const claimed: HouseholdSyncMeta = {
    ...next,
    householdId,
    email,
    binding: 'bound',
    ownsLocalData: true,
    datasetFingerprint: expectedFingerprint,
    importEpoch: provenance.importEpoch,
    pauseReason: undefined,
  }
  await guard.assertCurrent('Ownership claim prepared for durable commit')
  return {
    claimed,
    otherOwnersBefore: listHouseholdMetas().filter(
      (meta) => meta.householdId !== householdId && meta.ownsLocalData,
    ),
  }
}

function commitPreparedOwnership(
  prepared: PreparedOwnershipClaim,
  guard: FinalizationGuard,
  expectedTransition?: OwnershipTransition,
): HouseholdSyncMeta {
  guard.assertCurrentNow('Immediately before ownership metadata commit')
  const provenance = readDatasetProvenance()
  const targetCurrent = loadHouseholdMeta(
    prepared.claimed.householdId,
    prepared.claimed.email,
  )
  const currentTransition = expectedTransition
    ? loadOwnershipTransition(
        prepared.claimed.householdId,
        expectedTransition.transitionId,
      )
    : null
  if (
    !provenance ||
    provenance.importTransition ||
    provenance.fingerprint !== prepared.claimed.datasetFingerprint ||
    provenance.importEpoch !== prepared.claimed.importEpoch ||
    !ownershipStillCompatible(
      targetCurrent,
      prepared.claimed.datasetFingerprint!,
      prepared.claimed.importEpoch!,
      expectedTransition,
    ) ||
    (expectedTransition &&
      (currentTransition?.operationId !== expectedTransition.operationId ||
        currentTransition.phase !== expectedTransition.phase))
  ) {
    throw new Error(
      'Household ownership changed immediately before its durable write.',
    )
  }

  try {
    for (const previous of prepared.otherOwnersBefore) {
      guard.assertCurrentNow(
        'Immediately before invalidating previous household ownership',
      )
      const current = loadHouseholdMeta(previous.householdId, previous.email)
      if (
        current.ownsLocalData &&
        current.datasetFingerprint === previous.datasetFingerprint &&
        current.importEpoch === previous.importEpoch
      ) {
        if (
          !saveHouseholdMetaVerified({
            ...current,
            ownsLocalData: false,
            pauseReason:
              'A different household was explicitly assigned this dataset.',
          })
        ) {
          throw new Error(
            'Previous household ownership could not be invalidated safely.',
          )
        }
      }
    }
    guard.assertCurrentNow('Immediately before bound ownership write')
    if (!saveHouseholdMetaVerified(prepared.claimed)) {
      throw new Error('Household ownership metadata could not be saved safely.')
    }
    guard.adoptCurrentHouseholdBinding()
    guard.assertCurrentNow('Immediately after bound ownership write')
    return prepared.claimed
  } catch (cause) {
    invalidateAllLocalOwnership(
      'Academy ownership finalization failed and requires parent review.',
    )
    throw cause
  }
}

/**
 * Assign current local data to one household and remove ownership from other
 * household-scoped records. Records remain, which protects account switching.
 */
export async function claimLocalData(
  householdId: string,
  email: string,
  next: HouseholdSyncMeta,
  expectedFingerprint: string,
  guard: FinalizationGuard,
  onCommitted?: OwnershipCommitted,
): Promise<HouseholdSyncMeta> {
  const prepared = await prepareOwnershipClaim(
    householdId,
    email,
    next,
    expectedFingerprint,
    guard,
  )
  const claimed = commitPreparedOwnership(prepared, guard)
  try {
    guard.assertCurrentNow('Immediately before ownership publication')
    onCommitted?.(claimed)
    guard.assertCurrentNow('Immediately after ownership publication')
    return claimed
  } catch (cause) {
    invalidateAllLocalOwnership(
      'Academy ownership publication failed and requires parent review.',
    )
    throw cause
  }
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
      importEpoch: null,
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
    importEpoch: null,
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
    const key = transitionKey(
      transition.targetHouseholdId,
      transition.transitionId,
    )
    const existing = loadOwnershipTransition(
      transition.targetHouseholdId,
      transition.transitionId,
    )
    const successors: Record<OwnershipTransition['phase'], string[]> = {
      prepared: ['prepared', 'dataset-written', 'review'],
      'dataset-written': ['dataset-written', 'ownership-written', 'review'],
      'ownership-written': ['ownership-written', 'committed', 'review'],
      committed: ['committed'],
      review: ['review'],
    }
    if (
      (!existing && transition.phase !== 'prepared') ||
      (existing &&
        (existing.operationId !== transition.operationId ||
          !successors[existing.phase].includes(transition.phase)))
    ) {
      return false
    }
    store.setItem(key, JSON.stringify(transition))
    const verified = parseOwnershipTransition(
      store.getItem(key),
      transition.targetHouseholdId,
      transition.transitionId,
    )
    return (
      verified?.operationId === transition.operationId &&
      verified.phase === transition.phase
    )
  } catch {
    return false
  }
}

function validTransitionToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 200 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
  )
}

function parseOwnershipTransition(
  raw: string | null,
  householdId: string,
  transitionId: string,
): OwnershipTransition | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const transition = value as Partial<OwnershipTransition>
    if (
      transition.version !== 2 ||
      transition.targetHouseholdId !== householdId ||
      transition.transitionId !== transitionId ||
      !validTransitionToken(transition.transitionId) ||
      !validTransitionToken(transition.operationId) ||
      typeof transition.targetEmail !== 'string' ||
      transition.targetEmail.length > 512 ||
      typeof transition.expectedFingerprint !== 'string' ||
      typeof transition.expectedImportEpoch !== 'string' ||
      typeof transition.expectedCloudRevision !== 'string' ||
      !/^(0|[1-9]\d*)$/.test(transition.expectedCloudRevision) ||
      typeof transition.previousFingerprint !== 'string' ||
      !(
        transition.previousOwnerHouseholdId === null ||
        typeof transition.previousOwnerHouseholdId === 'string'
      ) ||
      !(
        transition.phase === 'prepared' ||
        transition.phase === 'dataset-written' ||
        transition.phase === 'ownership-written' ||
        transition.phase === 'committed' ||
        transition.phase === 'review'
      ) ||
      typeof transition.createdAt !== 'number' ||
      !Number.isFinite(transition.createdAt) ||
      typeof transition.updatedAt !== 'number' ||
      !Number.isFinite(transition.updatedAt) ||
      transition.updatedAt < transition.createdAt ||
      !isHouseholdMeta(transition.nextMeta, householdId) ||
      transition.nextMeta.cloudRevision !== transition.expectedCloudRevision ||
      (transition.failureReason !== undefined &&
        typeof transition.failureReason !== 'string')
    ) {
      return null
    }
    return transition as OwnershipTransition
  } catch {
    return null
  }
}

export function listOwnershipTransitions(): OwnershipTransition[] {
  const store = ls()
  if (!store) return []
  const transitions: OwnershipTransition[] = []
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index)
    if (!key?.startsWith(TRANSITION_PREFIX)) continue
    const suffix = key.slice(TRANSITION_PREFIX.length)
    const separator = suffix.indexOf(':')
    if (separator < 1) continue
    try {
      const householdId = decodeURIComponent(suffix.slice(0, separator))
      const transitionId = decodeURIComponent(suffix.slice(separator + 1))
      const transition = parseOwnershipTransition(
        store.getItem(key),
        householdId,
        transitionId,
      )
      if (transition) transitions.push(transition)
    } catch {
      // Malformed keys are retained but can never become trusted ownership.
    }
  }
  return transitions
}

export function loadOwnershipTransition(
  householdId: string,
  transitionId?: string,
): OwnershipTransition | null {
  const matches = listOwnershipTransitions().filter(
    (transition) =>
      transition.targetHouseholdId === householdId &&
      (!transitionId || transition.transitionId === transitionId),
  )
  return matches.length === 1 ? matches[0] : null
}

function removeTransition(transition: OwnershipTransition): boolean {
  try {
    const key = transitionKey(
      transition.targetHouseholdId,
      transition.transitionId,
    )
    const stored = loadOwnershipTransition(
      transition.targetHouseholdId,
      transition.transitionId,
    )
    if (stored?.operationId !== transition.operationId) return false
    ls()?.removeItem(key)
    return (
      loadOwnershipTransition(
        transition.targetHouseholdId,
        transition.transitionId,
      ) === null
    )
  } catch {
    // A leftover completed transition is safe and will be recovered next boot.
    return false
  }
}

function hasUnparseableTransitionStorage(): boolean {
  const store = ls()
  if (!store) return false
  const validKeys = new Set(
    listOwnershipTransitions().map((transition) =>
      transitionKey(transition.targetHouseholdId, transition.transitionId),
    ),
  )
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index)
    if (
      key?.startsWith(LEGACY_TRANSITION_PREFIX) &&
      !validKeys.has(key)
    ) {
      return true
    }
  }
  return false
}

export async function prepareOwnershipTransition(
  householdId: string,
  email: string,
  nextMeta: HouseholdSyncMeta,
  replacement: AppState,
  guard: FinalizationGuard,
  now = Date.now(),
  expectedPreviousFingerprint?: string,
): Promise<OwnershipTransition> {
  await guard.assertCurrent('Ownership replacement started')
  const current = await readPersistedDataset()
  await guard.assertCurrent('Ownership replacement read persisted Academy data')
  if (!current.ok) throw new Error(current.error)
  const provenance = await ensureDatasetProvenance()
  await guard.assertCurrent('Ownership replacement read dataset provenance')
  if (provenance.importTransition) {
    throw new Error('An Academy import is still being finalized.')
  }
  if (
    expectedPreviousFingerprint &&
    current.fingerprint !== expectedPreviousFingerprint
  ) {
    throw new Error(
      'Persisted Academy data changed immediately before ownership replacement.',
    )
  }
  const expectedFingerprint = await datasetFingerprint(replacement)
  await guard.assertCurrent('Ownership replacement fingerprinted new data')
  if (!nextMeta.cloudRevision) {
    throw new Error('A verified server revision is required for replacement.')
  }
  const transitionId = createOperationId('transition')
  const transition: OwnershipTransition = {
    version: 2,
    transitionId,
    operationId: guard.operationId,
    targetHouseholdId: householdId,
    targetEmail: email,
    expectedFingerprint,
    expectedImportEpoch: provenance.importEpoch,
    expectedCloudRevision: nextMeta.cloudRevision,
    previousFingerprint: current.fingerprint,
    previousOwnerHouseholdId: localDataOwner()?.householdId ?? null,
    phase: 'prepared',
    createdAt: now,
    updatedAt: now,
    nextMeta,
  }
  guard.assertCurrentNow('Immediately before pending ownership transition write')
  if (!saveTransition(transition)) {
    throw new Error('The pending household transition could not be saved.')
  }
  return transition
}

export async function persistOwnershipTransitionDataset(
  transition: OwnershipTransition,
  replacement: AppState,
  guard: FinalizationGuard,
): Promise<OwnershipTransition> {
  await guard.assertCurrent('Ownership transition persistence started')
  const current = loadOwnershipTransition(
    transition.targetHouseholdId,
    transition.transitionId,
  )
  if (current?.operationId !== transition.operationId) {
    throw new Error('The household transition is no longer current.')
  }
  const replacementFingerprint = await datasetFingerprint(replacement)
  await guard.assertCurrent('Ownership transition rechecked replacement data')
  if (replacementFingerprint !== transition.expectedFingerprint) {
    throw new Error('The replacement dataset changed during household binding.')
  }
  guard.assertCurrentNow('Immediately before replacement AppState write')
  const persisted = await persistDatasetVerified(replacement)
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
  const splitExpectation: FinalizationDatasetExpectation = {
    persistedFingerprint: transition.expectedFingerprint,
    memoryFingerprint: transition.previousFingerprint,
    provenanceFingerprint: transition.previousFingerprint,
  }
  await guard.assertCurrent(
    'Ownership transition verified replacement AppState write',
    splitExpectation,
  )
  const provenance = readDatasetProvenance()
  if (
    !provenance ||
    provenance.importTransition ||
    provenance.importEpoch !== transition.expectedImportEpoch
  ) {
    throw new Error('The dataset import generation changed during binding.')
  }
  guard.assertCurrentNow(
    'Immediately before replacement provenance write',
    splitExpectation,
  )
  recordPersistedDatasetFingerprint(transition.expectedFingerprint)
  const writtenExpectation: FinalizationDatasetExpectation = {
    ...splitExpectation,
    provenanceFingerprint: transition.expectedFingerprint,
  }
  guard.updateExpectedDataset(writtenExpectation)
  await guard.assertCurrent(
    'Ownership transition verified replacement provenance',
    writtenExpectation,
  )
  const written: OwnershipTransition = {
    ...transition,
    phase: 'dataset-written',
    updatedAt: Date.now(),
  }
  guard.assertCurrentNow(
    'Immediately before written ownership transition update',
    writtenExpectation,
  )
  if (!saveTransition(written)) {
    throw new Error('The written household transition could not be verified.')
  }
  return written
}

export async function finalizeOwnershipTransition(
  transition: OwnershipTransition,
  guard: FinalizationGuard,
  onCommitted?: OwnershipCommitted,
): Promise<HouseholdSyncMeta> {
  await guard.assertCurrent('Ownership transition finalization started')
  const current = loadOwnershipTransition(
    transition.targetHouseholdId,
    transition.transitionId,
  )
  const persisted = await readPersistedDataset()
  await guard.assertCurrent('Ownership transition finalization re-read data')
  const provenance = readDatasetProvenance()
  if (
    current?.operationId !== transition.operationId ||
    current.phase !== 'dataset-written' ||
    !persisted.ok ||
    persisted.fingerprint !== transition.expectedFingerprint ||
    !provenance ||
    provenance.importTransition ||
    provenance.importEpoch !== transition.expectedImportEpoch ||
    provenance.fingerprint !== transition.expectedFingerprint
  ) {
    throw new Error('Household binding finalization failed provenance checks.')
  }
  const prepared = await prepareOwnershipClaim(
    transition.targetHouseholdId,
    transition.targetEmail,
    transition.nextMeta,
    transition.expectedFingerprint,
    guard,
    transition,
  )
  const claimed = commitPreparedOwnership(prepared, guard, transition)
  const ownershipWritten: OwnershipTransition = {
    ...transition,
    phase: 'ownership-written',
    updatedAt: Date.now(),
  }
  guard.assertCurrentNow(
    'Immediately before ownership-written transition advancement',
  )
  if (!saveTransition(ownershipWritten)) {
    throw new Error('The ownership-written transition could not be verified.')
  }
  guard.publishExpectedDataset(transition.expectedFingerprint, () => {
    onCommitted?.(claimed)
  })
  const committed: OwnershipTransition = {
    ...ownershipWritten,
    phase: 'committed',
    updatedAt: Date.now(),
  }
  guard.assertCurrentNow('Immediately before committed transition advancement')
  if (!saveTransition(committed)) {
    throw new Error('The committed ownership transition could not be verified.')
  }
  guard.assertCurrentNow('Immediately before ownership transition cleanup')
  if (!removeTransition(committed)) {
    throw new Error('The completed ownership transition was not cleared.')
  }
  guard.assertCurrentNow('Immediately after ownership transition cleanup')
  return claimed
}

export async function replaceDatasetAndClaim(
  householdId: string,
  email: string,
  nextMeta: HouseholdSyncMeta,
  replacement: AppState,
  guard: FinalizationGuard,
  onCommitted?: OwnershipCommitted,
  expectedPreviousFingerprint?: string,
): Promise<HouseholdSyncMeta> {
  let transition: OwnershipTransition | null = null
  try {
    transition = await prepareOwnershipTransition(
      householdId,
      email,
      nextMeta,
      replacement,
      guard,
      Date.now(),
      expectedPreviousFingerprint,
    )
    const written = await persistOwnershipTransitionDataset(
      transition,
      replacement,
      guard,
    )
    return await finalizeOwnershipTransition(written, guard, onCommitted)
  } catch (cause) {
    if (
      transition &&
      loadOwnershipTransition(householdId, transition.transitionId)
        ?.operationId === transition.operationId
    ) {
      const current = loadOwnershipTransition(
        householdId,
        transition.transitionId,
      )
      if (current?.phase === 'committed') {
        // All durable data, ownership, and publication steps succeeded. A
        // cleanup failure leaves the committed marker as the recovery record;
        // do not overwrite coherent new ownership with stale/unbound metadata.
      } else if (current) {
        saveTransition({
          ...current,
          phase: 'review',
          updatedAt: Date.now(),
          failureReason:
            cause instanceof Error
              ? cause.message
              : 'Academy replacement finalization failed.',
        })
        invalidateAllLocalOwnership(
          'An interrupted Academy replacement remains unbound for parent review.',
        )
      }
    }
    throw cause
  }
}

export type TransitionRecovery =
  | { kind: 'none' }
  | { kind: 'restored-old'; householdId: string }
  | { kind: 'finished-new'; householdId: string }
  | { kind: 'review'; householdId: string; reason: string }

export interface TransitionRecoveryOptions {
  authenticatedUser: SignedInUser | null
  inMemoryState: AppState
  verifyCurrentHousehold: () => Promise<boolean>
  lifecycleValid: () => boolean
  publish: (
    state: AppState,
    fingerprint: string,
    meta: HouseholdSyncMeta,
  ) => void
}

function recoveryFinalizationGuard(
  transition: OwnershipTransition,
  options: TransitionRecoveryOptions,
): FinalizationGuard {
  let expectation: FinalizationDatasetExpectation = {
    persistedFingerprint: transition.expectedFingerprint,
    memoryFingerprint: transition.expectedFingerprint,
    provenanceFingerprint: transition.expectedFingerprint,
  }
  let ownershipAdopted = false
  let completed = false
  const transitionContextIsCurrent = (): boolean => {
    if (!options.lifecycleValid()) return false
    const current = loadOwnershipTransition(
      transition.targetHouseholdId,
      transition.transitionId,
    )
    if (
      current?.operationId === transition.operationId &&
      current.expectedFingerprint === transition.expectedFingerprint &&
      current.expectedImportEpoch === transition.expectedImportEpoch &&
      current.expectedCloudRevision === transition.expectedCloudRevision &&
      current.phase !== 'review'
    ) {
      return true
    }
    if ((!ownershipAdopted && !completed) || current) return false
    const meta = loadHouseholdMeta(
      transition.targetHouseholdId,
      transition.targetEmail,
    )
    return (
      meta.binding === 'bound' &&
      meta.ownsLocalData &&
      meta.datasetFingerprint === transition.expectedFingerprint &&
      meta.importEpoch === transition.expectedImportEpoch
    )
  }
  const assertRecoveryCurrent = async (stage: string): Promise<void> => {
    const persisted = await readPersistedDataset()
    const provenance = readDatasetProvenance()
    if (
      !transitionContextIsCurrent() ||
      !persisted.ok ||
      persisted.fingerprint !== expectation.persistedFingerprint ||
      !provenance ||
      provenance.importTransition ||
      provenance.fingerprint !== expectation.provenanceFingerprint ||
      provenance.importEpoch !== transition.expectedImportEpoch
    ) {
      throw new Error(`${stage}: interrupted ownership recovery is stale.`)
    }
  }
  const assertRecoveryCurrentNow = (stage: string): void => {
    const provenance = readDatasetProvenance()
    if (
      !transitionContextIsCurrent() ||
      !provenance ||
      provenance.importTransition ||
      provenance.fingerprint !== expectation.provenanceFingerprint ||
      provenance.importEpoch !== transition.expectedImportEpoch
    ) {
      throw new Error(`${stage}: interrupted ownership recovery is stale.`)
    }
  }
  return {
    operationId: transition.operationId,
    householdId: transition.targetHouseholdId,
    importEpoch: transition.expectedImportEpoch,
    cloudRevision: transition.nextMeta.cloudRevision ?? '',
    resultingCloudRevision: transition.expectedCloudRevision,
    assertCurrent: async (stage, expected = expectation) => {
      expectation = expected
      await assertRecoveryCurrent(stage)
      if (!(await options.verifyCurrentHousehold())) {
        throw new Error(`${stage}: authenticated recovery household changed.`)
      }
      await assertRecoveryCurrent(stage)
    },
    assertCurrentNow: (stage, expected = expectation) => {
      expectation = expected
      assertRecoveryCurrentNow(stage)
    },
    updateExpectedDataset: (expected) => {
      expectation = expected
    },
    publishExpectedDataset: (expectedMemoryFingerprint, publish) => {
      assertRecoveryCurrentNow('Immediately before recovery publication')
      publish()
      expectation = {
        ...expectation,
        memoryFingerprint: expectedMemoryFingerprint,
      }
      assertRecoveryCurrentNow('Immediately after recovery publication')
    },
    adoptCurrentHouseholdBinding: () => {
      ownershipAdopted = true
    },
    isCurrent: async () => {
      try {
        await assertRecoveryCurrent('Ownership recovery check')
        return true
      } catch {
        return false
      }
    },
  }
}

function reviewTransition(
  transition: OwnershipTransition,
  reason: string,
): void {
  if (transition.phase === 'review' || transition.phase === 'committed') return
  saveTransition({
    ...transition,
    phase: 'review',
    updatedAt: Date.now(),
    failureReason: reason,
  })
}

export async function recoverOwnershipTransitions(
  options: TransitionRecoveryOptions,
): Promise<TransitionRecovery[]> {
  const store = ls()
  if (!store) return [{ kind: 'none' }]
  const transitions = listOwnershipTransitions()
  if (transitions.length === 0 && !hasUnparseableTransitionStorage()) {
    return [{ kind: 'none' }]
  }
  const ambiguousReason =
    'Academy ownership recovery is ambiguous or malformed. Local data remains unbound for parent review.'
  if (hasUnparseableTransitionStorage() || transitions.length !== 1) {
    invalidateAllLocalOwnership(ambiguousReason)
    return transitions.length > 0
      ? transitions.map((transition) => ({
          kind: 'review' as const,
          householdId: transition.targetHouseholdId,
          reason: ambiguousReason,
        }))
      : [{ kind: 'review', householdId: 'unknown', reason: ambiguousReason }]
  }
  const transition = transitions[0]
  const authenticatedUser = options.authenticatedUser
  if (
    !authenticatedUser ||
    authenticatedUser.id !== transition.targetHouseholdId ||
    !options.lifecycleValid() ||
    !(await options.verifyCurrentHousehold()) ||
    !options.lifecycleValid()
  ) {
    const reason = authenticatedUser
      ? 'The signed-in household does not match the pending Academy recovery.'
      : 'Sign in to the matching household before reviewing Academy recovery.'
    invalidateAllLocalOwnership(reason)
    return [
      {
        kind: 'review',
        householdId: transition.targetHouseholdId,
        reason,
      },
    ]
  }
  if (transition.phase === 'review') {
    const reason =
      transition.failureReason ??
      'This Academy transition requires an explicit parent decision.'
    invalidateAllLocalOwnership(reason)
    return [
      {
        kind: 'review',
        householdId: transition.targetHouseholdId,
        reason,
      },
    ]
  }
  const persisted = await readPersistedDataset(store)
  const provenance = readDatasetProvenance(store)
  if (!persisted.ok || !provenance || provenance.importTransition) {
    const reason =
      'Persisted Academy recovery data or provenance is invalid. Local data remains unbound.'
    reviewTransition(transition, reason)
    invalidateAllLocalOwnership(reason)
    return [
      { kind: 'review', householdId: transition.targetHouseholdId, reason },
    ]
  }
  if (
    transition.phase === 'prepared' &&
    persisted.fingerprint === transition.previousFingerprint
  ) {
    const reason =
      'An Academy replacement stopped before the new dataset was durable. Local data is preserved but ownership requires parent review.'
    reviewTransition(transition, reason)
    invalidateAllLocalOwnership(reason)
    return [
      { kind: 'review', householdId: transition.targetHouseholdId, reason },
    ]
  }
  if (
    persisted.fingerprint !== transition.expectedFingerprint ||
    provenance.fingerprint !== transition.expectedFingerprint ||
    provenance.importEpoch !== transition.expectedImportEpoch
  ) {
    const reason =
      'Academy data changed during interrupted recovery. Local data remains unbound for review.'
    reviewTransition(transition, reason)
    invalidateAllLocalOwnership(reason)
    return [
      { kind: 'review', householdId: transition.targetHouseholdId, reason },
    ]
  }
  try {
    const memoryFingerprint = await datasetFingerprint(options.inMemoryState)
    if (memoryFingerprint !== transition.expectedFingerprint) {
      throw new Error('Mounted Academy data does not match recovery data.')
    }
    const guard = recoveryFinalizationGuard(transition, options)
    if (transition.phase === 'dataset-written') {
      await finalizeOwnershipTransition(transition, guard, (meta) => {
        options.publish(
          persisted.state,
          transition.expectedFingerprint,
          meta,
        )
      })
    } else {
      const meta = loadHouseholdMeta(
        transition.targetHouseholdId,
        transition.targetEmail,
      )
      if (
        meta.binding !== 'bound' ||
        !meta.ownsLocalData ||
        meta.datasetFingerprint !== transition.expectedFingerprint ||
        meta.importEpoch !== transition.expectedImportEpoch ||
        meta.cloudRevision !== transition.expectedCloudRevision
      ) {
        throw new Error('Recovery ownership metadata is not coherent.')
      }
      guard.adoptCurrentHouseholdBinding()
      guard.publishExpectedDataset(transition.expectedFingerprint, () => {
        options.publish(
          persisted.state,
          transition.expectedFingerprint,
          meta,
        )
      })
      const committed =
        transition.phase === 'committed'
          ? transition
          : {
              ...transition,
              phase: 'committed' as const,
              updatedAt: Date.now(),
            }
      if (
        transition.phase !== 'committed' &&
        !saveTransition(committed)
      ) {
        throw new Error('Recovery commit marker could not be verified.')
      }
      if (!removeTransition(committed)) {
        throw new Error('Recovery marker could not be cleared.')
      }
    }
    return [
      { kind: 'finished-new', householdId: transition.targetHouseholdId },
    ]
  } catch (cause) {
    const reason =
      cause instanceof Error
        ? cause.message
        : 'Academy recovery failed and requires parent review.'
    const current =
      loadOwnershipTransition(
        transition.targetHouseholdId,
        transition.transitionId,
      ) ?? transition
    reviewTransition(current, reason)
    invalidateAllLocalOwnership(reason)
    return [
      { kind: 'review', householdId: transition.targetHouseholdId, reason },
    ]
  }
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

export function isLegacySyncStorageKey(key: string | null): boolean {
  return key === LEGACY_SESSION_KEY || key === LEGACY_META_KEY
}

export function removeRecreatedLegacySyncKey(key: string | null): boolean {
  if (!isLegacySyncStorageKey(key)) return false
  try {
    ls()?.removeItem(key!)
  } catch {
    // The official client never reads these keys; failed cleanup stays inert.
  }
  return true
}

/**
 * Runs synchronously from the confirmed-import getter before React receives the
 * replacement value. The epoch/transition fence is durable first; metadata
 * invalidation follows. Even a crash between writes cannot authorize sync
 * because every mutation rejects an unresolved transition or epoch mismatch.
 */
export function beginConfirmedImportInvalidation(
  reason: string,
): DatasetProvenanceRecord {
  const transition = beginDurableImportTransition(reason)
  invalidateAllLocalOwnership(reason)
  return transition
}

/**
 * Called while the dataset Web Lock is held after the imported AppState was
 * written and re-read. It clears only the transition marker; household
 * ownership deliberately remains unbound.
 */
export async function finishConfirmedImportPersistence(
  state: AppState,
): Promise<DatasetProvenanceRecord | null> {
  const transition = readDatasetProvenance()?.importTransition
  if (!transition) return null
  const persisted = await persistDatasetVerified(state)
  if (!persisted.ok) throw new Error(persisted.error)
  markImportDatasetWritten(transition.operationId, persisted.fingerprint)
  return finishDurableImportTransition(
    transition.operationId,
    persisted.fingerprint,
  )
}

/**
 * Startup recovery for a crash anywhere after the durable import fence. The
 * currently stored dataset is verified and recorded under the already-bumped
 * epoch, but no household is rebound. This covers both "old value still
 * stored" and "new value stored before finalization" without guessing trust.
 */
export async function recoverDurableImportTransition(): Promise<boolean> {
  const transition = readDatasetProvenance()?.importTransition
  if (!transition) return false
  const persisted = await readPersistedDataset()
  if (!persisted.ok) {
    invalidateAllLocalOwnership(
      'Imported Academy data could not be verified after an interrupted restore. Cloud sync remains paused.',
    )
    return false
  }
  invalidateAllLocalOwnership(
    'An interrupted Academy import was recovered. The local data remains unbound until parent review.',
  )
  markImportDatasetWritten(transition.operationId, persisted.fingerprint)
  finishDurableImportTransition(transition.operationId, persisted.fingerprint)
  return true
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
