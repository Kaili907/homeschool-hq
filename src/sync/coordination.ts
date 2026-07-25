import { remoteRowsSignature } from './engine'
import type {
  CloudPullResult,
  CloudPushResult,
  RemoteProfileRow,
} from './types'

export const LEASE_PREFIX = 'homeschool-hq:sync:lease:'
export const DEFAULT_LEASE_MS = 30_000

export interface MutationLease {
  version: 1
  householdId: string
  token: string
  tabId: string
  operationId: string
  datasetFingerprint: string
  importEpoch: string
  cloudRevision: string
  expiresAt: number
}

const leaseKey = (householdId: string): string =>
  `${LEASE_PREFIX}${encodeURIComponent(householdId)}`

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function createOperationId(prefix = 'sync'): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${id}`
}

export function readMutationLease(
  householdId: string,
  storage: Storage | null = browserStorage(),
): MutationLease | null {
  if (!storage) return null
  try {
    const parsed = JSON.parse(
      storage.getItem(leaseKey(householdId)) ?? 'null',
    ) as Partial<MutationLease> | null
    if (
      !parsed ||
      parsed.version !== 1 ||
      parsed.householdId !== householdId ||
      typeof parsed.token !== 'string' ||
      typeof parsed.tabId !== 'string' ||
      typeof parsed.operationId !== 'string' ||
      typeof parsed.datasetFingerprint !== 'string' ||
      typeof parsed.importEpoch !== 'string' ||
      typeof parsed.cloudRevision !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null
    }
    return parsed as MutationLease
  } catch {
    return null
  }
}

export function tryAcquireMutationLease(
  request: Omit<MutationLease, 'version' | 'token' | 'expiresAt'>,
  now = Date.now(),
  storage: Storage | null = browserStorage(),
  leaseMs = DEFAULT_LEASE_MS,
): MutationLease | null {
  if (!storage) return null
  const current = readMutationLease(request.householdId, storage)
  if (current && current.expiresAt > now) return null
  const lease: MutationLease = {
    version: 1,
    ...request,
    token: createOperationId('lease'),
    expiresAt: now + leaseMs,
  }
  try {
    storage.setItem(leaseKey(request.householdId), JSON.stringify(lease))
  } catch {
    return null
  }
  const confirmed = readMutationLease(request.householdId, storage)
  return confirmed?.token === lease.token ? lease : null
}

export function mutationLeaseIsOwned(
  lease: MutationLease,
  now = Date.now(),
  storage: Storage | null = browserStorage(),
): boolean {
  const current = readMutationLease(lease.householdId, storage)
  return (
    !!current &&
    current.token === lease.token &&
    current.tabId === lease.tabId &&
    current.operationId === lease.operationId &&
    current.datasetFingerprint === lease.datasetFingerprint &&
    current.importEpoch === lease.importEpoch &&
    current.cloudRevision === lease.cloudRevision &&
    current.expiresAt > now
  )
}

export function renewMutationLease(
  lease: MutationLease,
  now = Date.now(),
  storage: Storage | null = browserStorage(),
  leaseMs = DEFAULT_LEASE_MS,
): MutationLease | null {
  if (!storage || !mutationLeaseIsOwned(lease, now, storage)) return null
  const renewed = { ...lease, expiresAt: now + leaseMs }
  try {
    storage.setItem(leaseKey(lease.householdId), JSON.stringify(renewed))
  } catch {
    return null
  }
  return mutationLeaseIsOwned(renewed, now, storage) ? renewed : null
}

export function releaseMutationLease(
  lease: MutationLease,
  storage: Storage | null = browserStorage(),
): void {
  if (!storage) return
  if (readMutationLease(lease.householdId, storage)?.token !== lease.token)
    return
  try {
    storage.removeItem(leaseKey(lease.householdId))
  } catch {
    // Expiry remains the fail-safe after a storage failure.
  }
}

export function isLeaseStorageKey(key: string | null): boolean {
  return !!key?.startsWith(LEASE_PREFIX)
}

export function leaseStorageKeyForTests(householdId: string): string {
  return leaseKey(householdId)
}

export interface GuardedMutation {
  householdId: string
  datasetFingerprint: string
  importEpoch: string
  cloudRevision: string
  signal: AbortSignal
  lifecycleValid: () => boolean
  authenticatedHouseholdId: () => string | null
  verifyAuthenticatedHousehold: () => Promise<boolean>
  verifyPostResponseAuth: () => Promise<boolean>
  currentDatasetContext: () => Promise<{
    fingerprint: string
    importEpoch: string
  } | null>
  leaseValid: () => boolean
  refreshLease: () => boolean
  withDatasetLock: <T>(callback: () => Promise<T>) => Promise<T>
  pull: () => Promise<CloudPullResult>
  push: () => Promise<CloudPushResult>
  finalize: () => void | Promise<void>
}

/**
 * The final mutation boundary. All mutable inputs are re-read after the cloud
 * check and synchronously again immediately before request dispatch.
 */
export async function executeGuardedMutation(
  guard: GuardedMutation,
): Promise<CloudPushResult> {
  const invalidReason = async (): Promise<string | null> => {
    const context = await guard.currentDatasetContext()
    if (guard.signal.aborted) return 'The sync operation was cancelled.'
    if (!guard.lifecycleValid()) return 'The sync operation is no longer current.'
    if (guard.authenticatedHouseholdId() !== guard.householdId) {
      return 'The authenticated household changed.'
    }
    if (
      context?.fingerprint !== guard.datasetFingerprint ||
      context.importEpoch !== guard.importEpoch
    ) {
      return 'Academy data or its import generation changed.'
    }
    if (!guard.leaseValid()) return 'The household sync lease changed or expired.'
    return null
  }
  const stillValid = async (): Promise<boolean> => !(await invalidReason())

  const initialInvalid = await invalidReason()
  if (initialInvalid || !(await guard.verifyAuthenticatedHousehold())) {
    return {
      ok: false,
      error: initialInvalid ?? 'The verified household session changed.',
    }
  }
  const cloud = await guard.pull()
  if (!cloud.ok) {
    return {
      ok: false,
      error: `Cloud data could not be rechecked: ${cloud.error}`,
    }
  }
  if (remoteRowsSignature(cloud.rows) !== guard.cloudRevision) {
    return {
      ok: false,
      error:
        'Cloud data changed before the write. Review the refreshed cloud state.',
    }
  }
  if (
    !(await stillValid()) ||
    !(await guard.verifyAuthenticatedHousehold())
  ) {
    return { ok: false, error: 'The verified household session changed.' }
  }
  return guard.withDatasetLock(async () => {
    if (
      !(await stillValid()) ||
      !guard.refreshLease() ||
      !(await stillValid())
    ) {
      return {
        ok: false,
        error: 'Identity, provenance, or sync lease changed before writing.',
      }
    }
    const pushed = await guard.push()
    if (!pushed.ok) return pushed
    if (
      !(await stillValid()) ||
      !(await guard.verifyPostResponseAuth()) ||
      !(await stillValid())
    ) {
      return {
        ok: false,
        error:
          'The cloud request completed, but its local result was discarded because the session, data, import generation, operation, or lease changed.',
      }
    }
    try {
      await guard.finalize()
      return pushed
    } catch (cause) {
      return {
        ok: false,
        error:
          cause instanceof Error
            ? cause.message
            : 'The local sync finalization failed safely.',
      }
    }
  })
}

export function guardedCloudRevision(rows: RemoteProfileRow[]): string {
  return remoteRowsSignature(rows)
}
