import { remoteRowsSignature } from './engine'
import type {
  CloudPullResult,
  CloudPushResult,
  RemoteProfileRow,
} from './types'

export const LEASE_PREFIX = 'homeschool-hq:sync:lease:'
export const DEFAULT_LEASE_MS = 30_000
export const DEFAULT_LEASE_HEARTBEAT_MS = 10_000

export interface MutationLease {
  version: 2
  householdId: string
  token: string
  tabId: string
  operationId: string
  mutationId: string
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
      parsed.version !== 2 ||
      parsed.householdId !== householdId ||
      typeof parsed.token !== 'string' ||
      typeof parsed.tabId !== 'string' ||
      typeof parsed.operationId !== 'string' ||
      typeof parsed.mutationId !== 'string' ||
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
    version: 2,
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
    current.mutationId === lease.mutationId &&
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

export function updateMutationLeaseFingerprint(
  lease: MutationLease,
  datasetFingerprint: string,
  now = Date.now(),
  storage: Storage | null = browserStorage(),
): MutationLease | null {
  if (!storage || !mutationLeaseIsOwned(lease, now, storage)) return null
  const updated = { ...lease, datasetFingerprint }
  try {
    storage.setItem(leaseKey(lease.householdId), JSON.stringify(updated))
  } catch {
    return null
  }
  return mutationLeaseIsOwned(updated, now, storage) ? updated : null
}

export function startMutationLeaseHeartbeat(
  remainsCurrent: () => boolean,
  renew: () => boolean,
  onLost: () => void,
  intervalMs = DEFAULT_LEASE_HEARTBEAT_MS,
): () => void {
  let active = true
  const timer = globalThis.setInterval(() => {
    if (!active) return
    if (!remainsCurrent() || !renew()) {
      active = false
      globalThis.clearInterval(timer)
      onLost()
    }
  }, intervalMs)
  return () => {
    if (!active) return
    active = false
    globalThis.clearInterval(timer)
  }
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

export interface FinalizationDatasetExpectation {
  persistedFingerprint: string
  memoryFingerprint: string
  provenanceFingerprint: string
}

export interface FinalizationDatasetContext {
  persistedFingerprint: string | null
  memoryFingerprint: string | null
  provenanceFingerprint: string | null
  importEpoch: string | null
  importTransitionPending: boolean
  householdBindingValid: boolean
}

export interface FinalizationGuard {
  readonly operationId: string
  readonly householdId: string
  readonly importEpoch: string
  readonly cloudRevision: string
  readonly resultingCloudRevision: string
  assertCurrent(
    stage: string,
    expectation?: FinalizationDatasetExpectation,
  ): Promise<void>
  assertCurrentNow(
    stage: string,
    expectation?: FinalizationDatasetExpectation,
  ): void
  updateExpectedDataset(expectation: FinalizationDatasetExpectation): void
  publishExpectedDataset(
    expectedMemoryFingerprint: string,
    publish: () => void,
  ): void
  adoptCurrentHouseholdBinding(): void
  isCurrent(): Promise<boolean>
}

type FinalizationStageHook = (stage: string) => void | Promise<void>
let finalizationStageHookForTests: FinalizationStageHook | null = null

/**
 * A delay-only test seam. It cannot approve or bypass validation and is inert
 * in production builds.
 */
export function setFinalizationStageHookForTests(
  hook: FinalizationStageHook | null,
): void {
  if (import.meta.env.MODE !== 'test') {
    throw new Error('Finalization stage hooks are test-only.')
  }
  finalizationStageHookForTests = hook
}

async function pauseAtFinalizationStage(stage: string): Promise<void> {
  if (import.meta.env.MODE === 'test') {
    await finalizationStageHookForTests?.(stage)
  }
}

export interface GuardedMutation {
  operationId: string
  householdId: string
  datasetFingerprint: string
  importEpoch: string
  cloudRevision: string
  cloudSignature: string
  signal: AbortSignal
  lifecycleValid: () => boolean
  authenticatedHouseholdId: () => string | null
  verifyAuthenticatedHousehold: () => Promise<boolean>
  verifyPostResponseAuth: () => Promise<boolean>
  currentDatasetContext: () => Promise<FinalizationDatasetContext>
  currentSynchronousDatasetContext: () => Omit<
    FinalizationDatasetContext,
    'persistedFingerprint'
  >
  leaseValid: () => boolean
  refreshLease: () => boolean
  updateLeaseDatasetFingerprint: (fingerprint: string) => boolean
  adoptCurrentHouseholdBinding: () => void
  withDatasetLock: <T>(callback: () => Promise<T>) => Promise<T>
  pull: () => Promise<CloudPullResult>
  push: () => Promise<CloudPushResult>
  finalize: (finalization: FinalizationGuard) => void | Promise<void>
}

/**
 * The final mutation boundary. All mutable inputs are re-read after the cloud
 * check and synchronously again immediately before request dispatch.
 */
export async function executeGuardedMutation(
  guard: GuardedMutation,
): Promise<CloudPushResult> {
  let expectedDataset: FinalizationDatasetExpectation = {
    persistedFingerprint: guard.datasetFingerprint,
    memoryFingerprint: guard.datasetFingerprint,
    provenanceFingerprint: guard.datasetFingerprint,
  }
  let resultingCloudRevision = guard.cloudRevision

  const lifecycleInvalidReason = (): string | null => {
    if (guard.signal.aborted) return 'The sync operation was cancelled.'
    if (!guard.lifecycleValid()) return 'The sync operation is no longer current.'
    if (guard.authenticatedHouseholdId() !== guard.householdId) {
      return 'The authenticated household changed.'
    }
    if (!guard.leaseValid()) return 'The household sync lease changed or expired.'
    return null
  }

  const contextInvalidReason = (
    context: FinalizationDatasetContext,
    expectation: FinalizationDatasetExpectation,
  ): string | null => {
    if (
      context.persistedFingerprint !== expectation.persistedFingerprint ||
      context.memoryFingerprint !== expectation.memoryFingerprint ||
      context.provenanceFingerprint !== expectation.provenanceFingerprint ||
      context.importEpoch !== guard.importEpoch ||
      context.importTransitionPending ||
      !context.householdBindingValid
    ) {
      return 'Academy data, ownership, or its import generation changed.'
    }
    return null
  }

  const invalidReason = async (
    expectation = expectedDataset,
  ): Promise<string | null> => {
    const lifecycleReason = lifecycleInvalidReason()
    if (lifecycleReason) return lifecycleReason
    const context = await guard.currentDatasetContext()
    return lifecycleInvalidReason() ?? contextInvalidReason(context, expectation)
  }
  const stillValid = async (
    expectation = expectedDataset,
  ): Promise<boolean> => !(await invalidReason(expectation))

  const finalization: FinalizationGuard = {
    operationId: guard.operationId,
    householdId: guard.householdId,
    importEpoch: guard.importEpoch,
    cloudRevision: guard.cloudRevision,
    get resultingCloudRevision() {
      return resultingCloudRevision
    },
    assertCurrent: async (stage, expectation = expectedDataset) => {
      await pauseAtFinalizationStage(stage)
      const before = await invalidReason(expectation)
      if (before) throw new Error(`${stage}: ${before}`)
      if (!(await guard.verifyPostResponseAuth())) {
        throw new Error(`${stage}: The pinned household session is no longer valid.`)
      }
      const after = await invalidReason(expectation)
      if (after) throw new Error(`${stage}: ${after}`)
    },
    assertCurrentNow: (stage, expectation = expectedDataset) => {
      const lifecycleReason = lifecycleInvalidReason()
      if (lifecycleReason) throw new Error(`${stage}: ${lifecycleReason}`)
      const context = guard.currentSynchronousDatasetContext()
      if (
        context.memoryFingerprint !== expectation.memoryFingerprint ||
        context.provenanceFingerprint !== expectation.provenanceFingerprint ||
        context.importEpoch !== guard.importEpoch ||
        context.importTransitionPending ||
        !context.householdBindingValid
      ) {
        throw new Error(
          `${stage}: Academy data, ownership, or its import generation changed.`,
        )
      }
    },
    updateExpectedDataset: (expectation) => {
      if (
        expectation.persistedFingerprint !==
          expectedDataset.persistedFingerprint &&
        !guard.updateLeaseDatasetFingerprint(expectation.persistedFingerprint)
      ) {
        throw new Error(
          'The household sync lease could not adopt the finalized dataset.',
        )
      }
      expectedDataset = expectation
    },
    publishExpectedDataset: (expectedMemoryFingerprint, publish) => {
      finalization.assertCurrentNow(
        'Immediately before replacement publication',
      )
      publish()
      expectedDataset = {
        ...expectedDataset,
        memoryFingerprint: expectedMemoryFingerprint,
      }
      finalization.assertCurrentNow(
        'Immediately after replacement publication',
      )
    },
    adoptCurrentHouseholdBinding: guard.adoptCurrentHouseholdBinding,
    isCurrent: async () =>
      !(await invalidReason(expectedDataset)) &&
      (await guard.verifyPostResponseAuth()),
  }

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
  if (
    cloud.revision !== guard.cloudRevision ||
    remoteRowsSignature(cloud.rows) !== guard.cloudSignature
  ) {
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
    resultingCloudRevision = pushed.revision
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
      await finalization.assertCurrent('Before local finalization')
      await guard.finalize(finalization)
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
