import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  APP_STATE_IMPORT_EVENT,
  isImportedAppState,
  waitForAppStatePersistence,
} from '../appState'
import type { AppState, Profile } from '../types'
import { purgeVoiceCache } from '../tutor/voice'
import {
  asSignedInUser,
  backupLocalForHousehold,
  claimLocalData,
  cleanupLegacySyncStorage,
  invalidateAllLocalOwnership,
  isLegacySyncStorageKey,
  listOwnershipTransitions,
  loadHouseholdMeta,
  localDataOwner,
  pauseHouseholdForMismatch,
  recoverOwnershipTransitions,
  recoverDurableImportTransition,
  removeRecreatedLegacySyncKey,
  replaceDatasetAndClaim,
  saveHouseholdMeta,
  supabaseConfigured,
} from './config'
import {
  createOperationId,
  executeGuardedMutation,
  isLeaseStorageKey,
  mutationLeaseIsOwned,
  releaseMutationLease,
  renewMutationLease,
  startMutationLeaseHeartbeat,
  tryAcquireMutationLease,
  updateMutationLeaseFingerprint,
  type FinalizationGuard,
  type MutationLease,
} from './coordination'
import {
  applyReviewedSelection,
  buildReconciliationPreview,
  changedProfiles,
  dirtyIds,
  markDirty,
  metaAfterSuccessfulSync,
  remoteRowsSignature,
} from './engine'
import {
  APP_STATE_STORAGE_KEY,
  canonicalDatasetSnapshot,
  DATASET_PROVENANCE_STORAGE_KEY,
  DATASET_WRITE_LOCK_NAME,
  datasetFingerprint,
  ensureDatasetProvenance,
  readDatasetProvenance,
  readPersistedDataset,
  sha256Hex,
  verifyOwnedDatasetProvenance,
} from './provenance'
import {
  getVerifiedAuthContext,
  getVerifiedCurrentUser,
  onAuthSessionChange,
  pullProfiles,
  pushProfiles,
  signInWithPassword,
  signOutRemote,
  userFromSession,
  verifyPinnedAuthContext,
  type VerifiedAuthContext,
} from './supabase'
import type {
  CloudPushResult,
  ConflictChoice,
  HouseholdSyncMeta,
  RemoteProfileRow,
  SignedInUser,
  SyncStatus,
} from './types'
import { mergeDevicePrivateProfile } from './privacy'
import {
  executeAutomaticCycle,
  inspectUnboundHousehold,
  prepareConfirmedLocalUpload,
} from './workflow'

export interface SyncApi {
  status: SyncStatus
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
  uploadLocal: () => Promise<void>
  useCloud: () => Promise<void>
  applyReviewedMerge: (choices: Record<string, ConflictChoice>) => Promise<void>
  cancelDecision: () => void
}

interface ActiveOperation {
  id: string
  controller: AbortController
}

interface ProvenanceCheck {
  meta: HouseholdSyncMeta
  fingerprint: string
  importEpoch: string
}

interface LockManagerLike {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; ifAvailable?: true },
    callback: (lock: unknown | null) => Promise<T>,
  ): Promise<T>
}

const provenanceMismatchMessage =
  'Local Academy data no longer matches this household binding. Automatic sync is paused for parent review.'
const anotherTabMessage =
  'Another tab changed Academy data, authentication, or sync ownership. This tab cannot sync until the data is reviewed or reloaded.'
const importedMessage =
  'Imported Academy data is unbound. Review the signed-in household before enabling cloud sync.'

function appStateWithProfiles(
  state: AppState,
  profiles: Record<string, Profile>,
): AppState {
  return {
    ...state,
    profiles,
    activeProfileId:
      state.activeProfileId && profiles[state.activeProfileId]
        ? state.activeProfileId
        : null,
  }
}

function profilesFromRows(
  rows: RemoteProfileRow[],
  local: Record<string, Profile>,
): Record<string, Profile> {
  const profiles: Record<string, Profile> = Object.create(null)
  for (const row of rows) {
    profiles[row.profile_id] = mergeDevicePrivateProfile(row.data, local[row.profile_id])
  }
  return profiles
}

export function useSync(
  state: AppState,
  setState: Dispatch<SetStateAction<AppState>>,
): SyncApi {
  const configured = supabaseConfigured()
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [bootstrapped, setBootstrapped] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [user, setUser] = useState<SignedInUser | null>(null)
  const [meta, setMeta] = useState<HouseholdSyncMeta | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<SyncStatus['decision']>(null)

  const mountedRef = useRef(false)
  const userRef = useRef<SignedInUser | null>(null)
  const metaRef = useRef<HouseholdSyncMeta | null>(null)
  const remoteRowsRef = useRef<RemoteProfileRow[]>([])
  const remoteRevisionRef = useRef<string>('0')
  const profilesRef = useRef(state.profiles)
  const snapshotRef = useRef(state.profiles)
  const stateRef = useRef(state)
  const stateFingerprintRef = useRef<string | null>(null)
  const syncNowRef = useRef<() => Promise<void>>(async () => undefined)
  const pushTimer = useRef<number | null>(null)
  const operationRef = useRef<ActiveOperation | null>(null)
  const tabIdRef = useRef(createOperationId('tab'))
  const externalBlockedRef = useRef(false)

  userRef.current = user
  metaRef.current = meta
  profilesRef.current = state.profiles
  stateRef.current = state

  const safeSetBusy = useCallback((value: boolean) => {
    if (mountedRef.current) setBusy(value)
  }, [])
  const safeSetError = useCallback((value: string | null) => {
    if (mountedRef.current) setError(value)
  }, [])

  const persistCurrentMeta = useCallback((next: HouseholdSyncMeta) => {
    saveHouseholdMeta(next)
    metaRef.current = next
    if (mountedRef.current) setMeta(next)
  }, [])

  const publishCurrentMeta = useCallback((next: HouseholdSyncMeta) => {
    metaRef.current = next
    if (mountedRef.current) setMeta(next)
  }, [])

  const beginOperation = useCallback(
    (prefix: string): ActiveOperation => {
      if (operationRef.current) {
        throw new Error('Another sync operation is already in progress.')
      }
      const operation = {
        id: createOperationId(prefix),
        controller: new AbortController(),
      }
      operationRef.current = operation
      safeSetBusy(true)
      return operation
    },
    [safeSetBusy],
  )

  const finishOperation = useCallback(
    (operation: ActiveOperation) => {
      if (operationRef.current?.id === operation.id) {
        operationRef.current = null
        safeSetBusy(false)
      }
    },
    [safeSetBusy],
  )

  const abortOperation = useCallback(() => {
    operationRef.current?.controller.abort()
    operationRef.current = null
    safeSetBusy(false)
  }, [safeSetBusy])

  const setProfilesFromPersistedSync = useCallback(
    (nextState: AppState, fingerprint: string) => {
      snapshotRef.current = nextState.profiles
      profilesRef.current = nextState.profiles
      stateRef.current = nextState
      stateFingerprintRef.current = fingerprint
      setState(() => nextState)
    },
    [setState],
  )

  const strictProvenanceCheck = useCallback(
    async (
      householdId: string,
      expectedUser: SignedInUser,
      allowUnbound: boolean,
    ): Promise<ProvenanceCheck> => {
      if (
        userRef.current?.id !== householdId ||
        expectedUser.id !== householdId
      ) {
        throw new Error(
          'Sync stopped because the authenticated household changed.',
        )
      }
      const persisted = await readPersistedDataset()
      if (!persisted.ok) throw new Error(persisted.error)
      const memoryFingerprint = await datasetFingerprint(stateRef.current)
      if (memoryFingerprint !== persisted.fingerprint) {
        throw new Error(
          'This tab does not match the currently persisted Academy data.',
        )
      }
      const current = loadHouseholdMeta(householdId, expectedUser.email)
      const datasetProvenance = readDatasetProvenance()
      if (
        !datasetProvenance ||
        datasetProvenance.importTransition ||
        datasetProvenance.fingerprint !== persisted.fingerprint
      ) {
        throw new Error(provenanceMismatchMessage)
      }
      if (!allowUnbound) {
        const provenance = await verifyOwnedDatasetProvenance(
          current,
          stateRef.current,
        )
        if (externalBlockedRef.current || !provenance.ok)
          throw new Error(provenanceMismatchMessage)
      }
      return {
        meta: current,
        fingerprint: persisted.fingerprint,
        importEpoch: datasetProvenance.importEpoch,
      }
    },
    [],
  )

  const runUnderWebLock = useCallback(
    async <T>(householdId: string, callback: () => Promise<T>): Promise<T> => {
      const locks =
        typeof navigator === 'undefined'
          ? undefined
          : (navigator as Navigator & { locks?: LockManagerLike }).locks
      if (!locks) {
        if (typeof navigator === 'undefined') return callback()
        throw new Error(
          'This browser cannot safely coordinate cloud writes across tabs.',
        )
      }
      return locks.request(
        `academy-sync-mutation:${householdId}`,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          if (!lock) throw new Error('Another tab is updating this household.')
          return callback()
        },
      )
    },
    [],
  )

  const guardedCloudPush = useCallback(
    async (
      rows: RemoteProfileRow[],
      expectedCloudRows: RemoteProfileRow[],
      expectedServerRevision: string,
      expectedUser: SignedInUser,
      operation: ActiveOperation,
      allowUnbound: boolean,
      commit?: (
        validatedFingerprint: string,
        finalization: FinalizationGuard,
      ) => void | Promise<void>,
    ): Promise<CloudPushResult> => {
      const initial = await strictProvenanceCheck(
        expectedUser.id,
        expectedUser,
        allowUnbound,
      )
      stateFingerprintRef.current = initial.fingerprint
      const expectedCloudSignature = remoteRowsSignature(expectedCloudRows)
      const expectedMemoryCanonical = canonicalDatasetSnapshot(stateRef.current)
      const mutationId =
        rows.length === 0
          ? operation.id
          : `academy-${expectedServerRevision}-${await sha256Hex(
              remoteRowsSignature(rows),
            )}`
      const persistedRaw =
        typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(APP_STATE_STORAGE_KEY)
      let verifiedContext = await getVerifiedAuthContext(
        undefined,
        operation.controller.signal,
      )
      if (
        !verifiedContext ||
        verifiedContext.user.id !== expectedUser.id ||
        operation.controller.signal.aborted
      ) {
        return {
          ok: false,
          error: 'The verified household session was unavailable or timed out.',
        }
      }

      return runUnderWebLock(expectedUser.id, async () => {
        let lease: MutationLease | null = tryAcquireMutationLease({
          householdId: expectedUser.id,
          tabId: tabIdRef.current,
          operationId: operation.id,
          mutationId,
          datasetFingerprint: initial.fingerprint,
          importEpoch: initial.importEpoch,
          cloudRevision: expectedServerRevision,
        })
        if (!lease) {
          return {
            ok: false,
            error: 'Another tab currently owns the household sync lease.',
          }
        }
        let heartbeatLost = false
        let expectedMeta = JSON.stringify(initial.meta)
        const householdBindingValid = () =>
          JSON.stringify(
            loadHouseholdMeta(expectedUser.id, expectedUser.email),
          ) === expectedMeta
        const finalDispatchAuthorized = () => {
          const provenance = readDatasetProvenance()
          const currentRaw =
            typeof localStorage === 'undefined'
              ? null
              : localStorage.getItem(APP_STATE_STORAGE_KEY)
          return (
            mountedRef.current &&
            operationRef.current?.id === operation.id &&
            !operation.controller.signal.aborted &&
            userRef.current?.id === expectedUser.id &&
            !externalBlockedRef.current &&
            !heartbeatLost &&
            !!lease &&
            lease.householdId === expectedUser.id &&
            lease.operationId === operation.id &&
            lease.mutationId === mutationId &&
            lease.cloudRevision === expectedServerRevision &&
            mutationLeaseIsOwned(lease) &&
            currentRaw === persistedRaw &&
            canonicalDatasetSnapshot(stateRef.current) ===
              expectedMemoryCanonical &&
            stateFingerprintRef.current === initial.fingerprint &&
            provenance?.fingerprint === initial.fingerprint &&
            provenance.importEpoch === initial.importEpoch &&
            !provenance.importTransition &&
            householdBindingValid() &&
            remoteRevisionRef.current === expectedServerRevision &&
            listOwnershipTransitions().length === 0
          )
        }
        const heartbeatCanRun = () =>
          mountedRef.current &&
          operationRef.current?.id === operation.id &&
          userRef.current?.id === expectedUser.id &&
          !operation.controller.signal.aborted &&
          !externalBlockedRef.current
        const renewHeartbeat = () => {
          if (!lease) return false
          const provenance = readDatasetProvenance()
          if (
            !provenance ||
            provenance.importTransition ||
            provenance.importEpoch !== lease.importEpoch ||
            provenance.fingerprint !== lease.datasetFingerprint
          ) {
            return false
          }
          const renewed = renewMutationLease(lease)
          if (!renewed) return false
          lease = renewed
          return true
        }
        const stopHeartbeat = startMutationLeaseHeartbeat(
          heartbeatCanRun,
          renewHeartbeat,
          () => {
            heartbeatLost = true
            operation.controller.abort()
          },
        )
        try {
          return await executeGuardedMutation({
            operationId: operation.id,
            householdId: expectedUser.id,
            datasetFingerprint: initial.fingerprint,
            importEpoch: initial.importEpoch,
            cloudRevision: expectedServerRevision,
            cloudSignature: expectedCloudSignature,
            signal: operation.controller.signal,
            lifecycleValid: () =>
              mountedRef.current &&
              operationRef.current?.id === operation.id &&
              !externalBlockedRef.current,
            authenticatedHouseholdId: () => userRef.current?.id ?? null,
            verifyAuthenticatedHousehold: async () => {
              const verified = await getVerifiedAuthContext(
                undefined,
                operation.controller.signal,
              )
              verifiedContext =
                verified?.user.id === expectedUser.id
                  ? verified
                  : null
              return (
                !operation.controller.signal.aborted &&
                userRef.current?.id === expectedUser.id &&
                verified?.user.id === expectedUser.id
              )
            },
            verifyPostResponseAuth: async () =>
              !!verifiedContext &&
              (await verifyPinnedAuthContext(
                verifiedContext,
                expectedUser.id,
                undefined,
                operation.controller.signal,
              )),
            currentDatasetContext: async () => {
              const persisted = await readPersistedDataset()
              let memoryFingerprint: string | null = null
              try {
                memoryFingerprint = await datasetFingerprint(stateRef.current)
              } catch {
                // Invalid memory state fails the comparison below.
              }
              const provenance = readDatasetProvenance()
              return {
                persistedFingerprint: persisted.ok
                  ? persisted.fingerprint
                  : null,
                memoryFingerprint,
                provenanceFingerprint: provenance?.fingerprint ?? null,
                importEpoch: provenance?.importEpoch ?? null,
                importTransitionPending: !!provenance?.importTransition,
                householdBindingValid: householdBindingValid(),
              }
            },
            currentSynchronousDatasetContext: () => {
              const provenance = readDatasetProvenance()
              return {
                memoryFingerprint: stateFingerprintRef.current,
                provenanceFingerprint: provenance?.fingerprint ?? null,
                importEpoch: provenance?.importEpoch ?? null,
                importTransitionPending: !!provenance?.importTransition,
                householdBindingValid: householdBindingValid(),
              }
            },
            leaseValid: () =>
              !heartbeatLost && !!lease && mutationLeaseIsOwned(lease),
            refreshLease: () => {
              if (!lease) return false
              const renewed = renewMutationLease(lease)
              if (!renewed) return false
              lease = renewed
              return true
            },
            updateLeaseDatasetFingerprint: (fingerprint) => {
              if (!lease) return false
              const updated = updateMutationLeaseFingerprint(lease, fingerprint)
              if (!updated) return false
              lease = updated
              return true
            },
            adoptCurrentHouseholdBinding: () => {
              expectedMeta = JSON.stringify(
                loadHouseholdMeta(expectedUser.id, expectedUser.email),
              )
            },
            withDatasetLock: async (callback) => {
              if (typeof navigator === 'undefined') return callback()
              const locks = (
                navigator as Navigator & { locks?: LockManagerLike }
              ).locks
              if (!locks) {
                throw new Error(
                  'This browser cannot safely lock persisted Academy data.',
                )
              }
              return locks.request(
                DATASET_WRITE_LOCK_NAME,
                { mode: 'exclusive' },
                async () => callback(),
              )
            },
            pull: () => pullProfiles(undefined, operation.controller.signal),
            push: async () => {
              if (rows.length === 0) {
                return {
                  ok: true as const,
                  revision: expectedServerRevision,
                }
              }
              if (!verifiedContext) {
                return {
                  ok: false as const,
                  error:
                    'A server-verified auth context was unavailable for the write.',
                }
              }
              return pushProfiles(
                rows,
                expectedServerRevision,
                mutationId,
                verifiedContext,
                expectedUser.id,
                finalDispatchAuthorized,
                operation.controller.signal,
              )
            },
            finalize: async (finalization) =>
              commit?.(initial.fingerprint, finalization),
          })
        } finally {
          stopHeartbeat()
          if (lease) releaseMutationLease(lease)
        }
      })
    },
    [runUnderWebLock, strictProvenanceCheck],
  )

  const prepareUnbound = useCallback(
    async (verifiedUser: SignedInUser, householdMeta: HouseholdSyncMeta) => {
      let operation: ActiveOperation
      try {
        operation = beginOperation('inspect')
      } catch {
        return
      }
      safeSetError(null)
      if (mountedRef.current) setDecision(null)
      try {
        const inspection = await inspectUnboundHousehold(
          profilesRef.current,
          householdMeta,
          () => pullProfiles(undefined, operation.controller.signal),
        )
        if (
          operation.controller.signal.aborted ||
          userRef.current?.id !== verifiedUser.id ||
          !mountedRef.current
        ) {
          return
        }
        if (inspection.kind === 'pull-error') {
          safeSetError(`Cloud data could not be loaded: ${inspection.error}`)
          return
        }
        remoteRowsRef.current = inspection.rows
        remoteRevisionRef.current = inspection.revision
        const previous = localDataOwner(verifiedUser.id)
        setDecision({
          reason: previous ? 'account-switch' : 'first-sync',
          cloud: inspection.rows.length === 0 ? 'empty' : 'data',
          preview: inspection.preview,
          ...(previous ? { previousHousehold: asSignedInUser(previous) } : {}),
        })
      } finally {
        finishOperation(operation)
      }
    },
    [beginOperation, finishOperation, safeSetError],
  )

  const runBoundSync = useCallback(
    async (householdMeta: HouseholdSyncMeta) => {
      const verifiedUser = userRef.current
      if (!verifiedUser || verifiedUser.id !== householdMeta.householdId) return
      let operation: ActiveOperation
      try {
        await strictProvenanceCheck(
          householdMeta.householdId,
          verifiedUser,
          false,
        )
        operation = beginOperation('automatic')
      } catch (cause) {
        const reason =
          cause instanceof Error ? cause.message : provenanceMismatchMessage
        const paused = pauseHouseholdForMismatch(
          householdMeta.householdId,
          verifiedUser.email,
          reason,
        )
        persistCurrentMeta(paused)
        safeSetError(reason)
        return
      }
      safeSetError(null)
      try {
        const cycle = await executeAutomaticCycle(
          profilesRef.current,
          householdMeta,
          Date.now(),
          {
            pull: () => pullProfiles(undefined, operation.controller.signal),
            push: (rows, expectedCloudRows, expectedRevision) => {
              remoteRowsRef.current = expectedCloudRows
              remoteRevisionRef.current = expectedRevision
              return guardedCloudPush(
                rows,
                expectedCloudRows,
                expectedRevision,
                verifiedUser,
                operation,
                false,
              )
            },
          },
        )
        if (
          operation.controller.signal.aborted ||
          userRef.current?.id !== householdMeta.householdId ||
          !mountedRef.current
        ) {
          return
        }
        if (cycle.kind === 'pull-error') {
          safeSetError(`Cloud data could not be loaded: ${cycle.error}`)
          return
        }
        if (cycle.kind === 'unbound') return
        if (cycle.kind === 'push-error') {
          persistCurrentMeta(cycle.meta)
          if (cycle.conflict) {
            const refreshed = await pullProfiles(
              undefined,
              operation.controller.signal,
            )
            if (
              refreshed.ok &&
              mountedRef.current &&
              !operation.controller.signal.aborted &&
              userRef.current?.id === verifiedUser.id
            ) {
              remoteRowsRef.current = refreshed.rows
              remoteRevisionRef.current = refreshed.revision
              setDecision({
                reason: 'conflict',
                cloud: refreshed.rows.length === 0 ? 'empty' : 'data',
                preview: buildReconciliationPreview(
                  profilesRef.current,
                  refreshed.rows,
                  cycle.meta,
                ),
              })
            }
          }
          safeSetError(
            cycle.conflict
              ? cycle.error
              : `Cloud data was read, but local changes were not uploaded: ${cycle.error}`,
          )
          return
        }
        remoteRowsRef.current = cycle.rows
        remoteRevisionRef.current = cycle.revision
        if (cycle.kind === 'review') {
          persistCurrentMeta(cycle.meta)
          setDecision({
            reason: 'conflict',
            cloud: cycle.rows.length === 0 ? 'empty' : 'data',
            preview: cycle.preview,
          })
          return
        }
        const nextState = appStateWithProfiles(stateRef.current, cycle.profiles)
        const nextFingerprint = await datasetFingerprint(nextState)
        let published = false
        const finalized = await guardedCloudPush(
          [],
          cycle.rows,
          cycle.revision,
          verifiedUser,
          operation,
          false,
          async (validatedFingerprint, finalization) => {
            await replaceDatasetAndClaim(
              verifiedUser.id,
              verifiedUser.email,
              {
                ...cycle.meta,
                cloudRevision: finalization.resultingCloudRevision,
              },
              nextState,
              finalization,
              (claimed) => {
                setProfilesFromPersistedSync(nextState, nextFingerprint)
                publishCurrentMeta(claimed)
                if (mountedRef.current) setDecision(null)
                published = true
              },
              validatedFingerprint,
            )
          },
        )
        if (!finalized.ok || !published) {
          throw new Error(
            finalized.ok
              ? 'Automatic sync did not finalize household ownership.'
              : finalized.error,
          )
        }
      } catch (cause) {
        safeSetError(
          cause instanceof Error ? cause.message : 'Automatic sync failed.',
        )
      } finally {
        finishOperation(operation)
      }
    },
    [
      beginOperation,
      finishOperation,
      guardedCloudPush,
      persistCurrentMeta,
      publishCurrentMeta,
      safeSetError,
      setProfilesFromPersistedSync,
      strictProvenanceCheck,
    ],
  )

  const syncNow = useCallback(async () => {
    const verifiedUser = userRef.current
    if (!configured || !verifiedUser || operationRef.current) return
    const householdMeta = loadHouseholdMeta(verifiedUser.id, verifiedUser.email)
    persistCurrentMeta(householdMeta)
    if (householdMeta.binding === 'bound' && householdMeta.ownsLocalData) {
      await runBoundSync(householdMeta)
    } else {
      await prepareUnbound(verifiedUser, householdMeta)
    }
  }, [configured, persistCurrentMeta, prepareUnbound, runBoundSync])
  syncNowRef.current = syncNow

  // Upgrade cleanup and durable import recovery happen before auth. Household
  // ownership recovery is deliberately deferred until canonical auth is known.
  useEffect(() => {
    mountedRef.current = true
    cleanupLegacySyncStorage()
    let live = true
    void (async () => {
      try {
        await ensureDatasetProvenance()
        await recoverDurableImportTransition()
      } catch (cause) {
        if (live && mountedRef.current) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Academy provenance could not be initialized.',
          )
        }
      } finally {
        if (live && mountedRef.current) setBootstrapped(true)
      }
    })()
    return () => {
      live = false
      mountedRef.current = false
      abortOperation()
    }
  }, [abortOperation])

  // The official client restores and refreshes its supported persisted session.
  useEffect(() => {
    if (!configured || !bootstrapped) return
    let live = true
    const controller = new AbortController()
    void getVerifiedAuthContext(undefined, controller.signal).then((context) => {
      if (!live || !mountedRef.current) return
      const restored = context?.user ?? null
      userRef.current = restored
      setUser(restored)
    })
    const unsubscribe = onAuthSessionChange((_event, session) => {
      const next = userFromSession(session)
      const previousUserId = userRef.current?.id ?? null
      const householdChanged =
        previousUserId !== (next?.id ?? null)
      if (previousUserId && householdChanged) {
        abortOperation()
        void purgeVoiceCache()
      }
      if (householdChanged) setRecoveryReady(false)
      userRef.current = next
      if (mountedRef.current) setUser(next)
    })
    return () => {
      live = false
      controller.abort()
      unsubscribe()
    }
  }, [abortOperation, bootstrapped, configured])

  // A transition may recover only after the canonical current session has been
  // independently verified. Auth callbacks alone are never recovery authority.
  useEffect(() => {
    if (!bootstrapped) return
    let live = true
    const controller = new AbortController()
    setRecoveryReady(false)
    void (async () => {
      const canonical = configured
        ? await getVerifiedCurrentUser(undefined, controller.signal)
        : null
      if (!live || !mountedRef.current || controller.signal.aborted) return
      if ((canonical?.id ?? null) !== (userRef.current?.id ?? null)) {
        abortOperation()
        userRef.current = canonical
        setUser(canonical)
        return
      }
      const expectedId = canonical?.id ?? null
      const recoveries = await recoverOwnershipTransitions({
        authenticatedUser: canonical,
        inMemoryState: stateRef.current,
        verifyCurrentHousehold: async () => {
          const current = await getVerifiedCurrentUser(
            undefined,
            controller.signal,
          )
          return (
            !controller.signal.aborted &&
            (current?.id ?? null) === expectedId &&
            (userRef.current?.id ?? null) === expectedId
          )
        },
        lifecycleValid: () =>
          live &&
          mountedRef.current &&
          !controller.signal.aborted &&
          (userRef.current?.id ?? null) === expectedId,
        publish: (recoveredState, fingerprint, recoveredMeta) => {
          if (
            !live ||
            !mountedRef.current ||
            controller.signal.aborted ||
            userRef.current?.id !== recoveredMeta.householdId
          ) {
            throw new Error('Ownership recovery was invalidated before publication.')
          }
          setProfilesFromPersistedSync(recoveredState, fingerprint)
          publishCurrentMeta(recoveredMeta)
        },
      })
      if (!live || !mountedRef.current || controller.signal.aborted) return
      const review = recoveries.find((item) => item.kind === 'review')
      if (review?.kind === 'review') safeSetError(review.reason)
      setRecoveryReady(true)
    })().catch((cause) => {
      if (!live || !mountedRef.current || controller.signal.aborted) return
      externalBlockedRef.current = true
      safeSetError(
        cause instanceof Error
          ? cause.message
          : 'Academy ownership recovery requires parent review.',
      )
      setRecoveryReady(true)
    })
    return () => {
      live = false
      controller.abort()
    }
  }, [
    abortOperation,
    bootstrapped,
    configured,
    publishCurrentMeta,
    safeSetError,
    setProfilesFromPersistedSync,
    user?.id,
  ])

  // A verified identity auto-resumes only after authenticated transition
  // recovery and with matching durable provenance.
  useEffect(() => {
    if (!bootstrapped || !recoveryReady) return
    if (!user) {
      metaRef.current = null
      setMeta(null)
      setDecision(null)
      return
    }
    let live = true
    void (async () => {
      let householdMeta = loadHouseholdMeta(user.id, user.email)
      if (householdMeta.binding === 'bound' && householdMeta.ownsLocalData) {
        const provenance = await verifyOwnedDatasetProvenance(
          householdMeta,
          stateRef.current,
        )
        if (!provenance.ok) {
          householdMeta = pauseHouseholdForMismatch(
            user.id,
            user.email,
            provenanceMismatchMessage,
          )
          externalBlockedRef.current = true
        }
      }
      if (!live || !mountedRef.current || userRef.current?.id !== user.id) return
      // Import/storage events can invalidate ownership while the asynchronous
      // verification above is pending. Re-read the durable record and verify it
      // again before publishing any binding into mounted state.
      const durableMeta = loadHouseholdMeta(user.id, user.email)
      if (JSON.stringify(durableMeta) !== JSON.stringify(householdMeta)) {
        householdMeta = durableMeta
      }
      if (householdMeta.binding === 'bound' && householdMeta.ownsLocalData) {
        const finalProvenance = await verifyOwnedDatasetProvenance(
          householdMeta,
          stateRef.current,
        )
        if (
          !live ||
          !mountedRef.current ||
          userRef.current?.id !== user.id
        ) {
          return
        }
        if (!finalProvenance.ok || externalBlockedRef.current) {
          householdMeta = pauseHouseholdForMismatch(
            user.id,
            user.email,
            externalBlockedRef.current
              ? anotherTabMessage
              : provenanceMismatchMessage,
          )
          externalBlockedRef.current = true
        }
      }
      persistCurrentMeta(householdMeta)
      if (!online || operationRef.current) return
      if (householdMeta.binding === 'bound' && householdMeta.ownsLocalData) {
        void runBoundSync(householdMeta)
      } else {
        void prepareUnbound(user, householdMeta)
      }
    })().catch(() => {
      if (!live || !mountedRef.current) return
      const paused = pauseHouseholdForMismatch(
        user.id,
        user.email,
        provenanceMismatchMessage,
      )
      externalBlockedRef.current = true
      persistCurrentMeta(paused)
      safeSetError(provenanceMismatchMessage)
    })
    return () => {
      live = false
    }
  }, [
    bootstrapped,
    recoveryReady,
    online,
    persistCurrentMeta,
    prepareUnbound,
    runBoundSync,
    safeSetError,
    user?.id,
  ])

  // Persisted state is the authority for provenance. Normal same-tab edits may
  // advance the owned fingerprint; imports always invalidate ownership.
  useEffect(() => {
    const previousFingerprint = stateFingerprintRef.current
    const changed = changedProfiles(snapshotRef.current, state.profiles)
    snapshotRef.current = state.profiles
    const imported = isImportedAppState(state)
    let cancelled = false
    void (async () => {
      const nextFingerprint = await datasetFingerprint(state)
      if (cancelled || !mountedRef.current) return
      stateFingerprintRef.current = nextFingerprint
      if (!bootstrapped) return
      await waitForAppStatePersistence()
      if (cancelled || !mountedRef.current) return
      const persisted = await readPersistedDataset()
      const datasetProvenance = readDatasetProvenance()
      const current = metaRef.current
      const ownershipBaseline =
        previousFingerprint ?? current?.datasetFingerprint ?? null
      if (
        imported ||
        !persisted.ok ||
        persisted.fingerprint !== nextFingerprint ||
        !datasetProvenance ||
        datasetProvenance.importTransition ||
        datasetProvenance.fingerprint !== nextFingerprint
      ) {
        abortOperation()
        invalidateAllLocalOwnership(
          imported ? importedMessage : provenanceMismatchMessage,
        )
        externalBlockedRef.current = true
        if (current && mountedRef.current) {
          const paused = loadHouseholdMeta(current.householdId, current.email)
          metaRef.current = paused
          setMeta(paused)
        }
        setDecision(null)
        safeSetError(imported ? importedMessage : provenanceMismatchMessage)
        return
      }
      if (
        ownershipBaseline === null ||
        ownershipBaseline === nextFingerprint ||
        !current ||
        current.binding !== 'bound' ||
        !current.ownsLocalData ||
        current.datasetFingerprint !== ownershipBaseline ||
        current.importEpoch !== datasetProvenance.importEpoch ||
        externalBlockedRef.current
      ) {
        return
      }
      const advanced = markDirty(
        {
          ...current,
          datasetFingerprint: nextFingerprint,
          importEpoch: datasetProvenance.importEpoch,
        },
        changed,
        Date.now(),
      )
      persistCurrentMeta(advanced)
      if (
        changed.length > 0 &&
        online &&
        userRef.current?.id === advanced.householdId &&
        advanced.reconciliation !== 'review'
      ) {
        if (pushTimer.current !== null) window.clearTimeout(pushTimer.current)
        pushTimer.current = window.setTimeout(
          () => void syncNowRef.current(),
          1500,
        )
      }
    })()
      .catch(() => {
        if (cancelled || !mountedRef.current) return
        abortOperation()
        invalidateAllLocalOwnership(provenanceMismatchMessage)
        externalBlockedRef.current = true
        safeSetError(provenanceMismatchMessage)
      })
    return () => {
      cancelled = true
    }
  }, [
    abortOperation,
    bootstrapped,
    online,
    persistCurrentMeta,
    safeSetError,
    state,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    const importApplying = () => {
      abortOperation()
      externalBlockedRef.current = true
      safeSetError(importedMessage)
    }
    const storageChanged = (event: StorageEvent) => {
      const key = event.key
      if (isLegacySyncStorageKey(key)) {
        removeRecreatedLegacySyncKey(key)
        return
      }
      if (
        key !== APP_STATE_STORAGE_KEY &&
        key !== DATASET_PROVENANCE_STORAGE_KEY &&
        !key?.startsWith('homeschool-hq:sync:household:') &&
        !key?.startsWith('homeschool-hq:sync:transition:') &&
        !isLeaseStorageKey(key)
      ) {
        return
      }
      abortOperation()
      externalBlockedRef.current = true
      safeSetError(anotherTabMessage)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener(APP_STATE_IMPORT_EVENT, importApplying)
    window.addEventListener('storage', storageChanged)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener(APP_STATE_IMPORT_EVENT, importApplying)
      window.removeEventListener('storage', storageChanged)
      if (pushTimer.current !== null) window.clearTimeout(pushTimer.current)
    }
  }, [abortOperation, safeSetError])

  const signIn = useCallback(
    async (email: string, password: string) => {
      safeSetError(null)
      const result = await signInWithPassword(email, password)
      if (!result.ok) return { ok: false, error: result.error }
      userRef.current = result.user
      if (mountedRef.current) setUser(result.user)
      return { ok: true }
    },
    [safeSetError],
  )

  const signOut = useCallback(async () => {
    if (pushTimer.current !== null) {
      window.clearTimeout(pushTimer.current)
      pushTimer.current = null
    }
    abortOperation()
    userRef.current = null
    if (mountedRef.current) {
      setUser(null)
      setDecision(null)
      setError(null)
    }
    await purgeVoiceCache()
    await signOutRemote()
  }, [abortOperation])

  const verifyDecisionCloud = useCallback(
    async (
      verifiedUser: SignedInUser,
      operation: ActiveOperation,
    ): Promise<{ rows: RemoteProfileRow[]; revision: string }> => {
      if (!decision) throw new Error('There is no sync decision to confirm.')
      const pull = await pullProfiles(undefined, operation.controller.signal)
      if (
        operation.controller.signal.aborted ||
        userRef.current?.id !== verifiedUser.id
      ) {
        throw new Error(
          'Sync stopped because the authenticated household changed.',
        )
      }
      if (!pull.ok) {
        throw new Error(`Cloud data could not be rechecked: ${pull.error}`)
      }
      if (
        pull.revision !== remoteRevisionRef.current ||
        remoteRowsSignature(pull.rows) !==
          remoteRowsSignature(remoteRowsRef.current)
      ) {
        remoteRowsRef.current = pull.rows
        remoteRevisionRef.current = pull.revision
        const householdMeta = loadHouseholdMeta(
          verifiedUser.id,
          verifiedUser.email,
        )
        if (mountedRef.current) {
          setDecision({
            ...decision,
            cloud: pull.rows.length === 0 ? 'empty' : 'data',
            preview: buildReconciliationPreview(
              profilesRef.current,
              pull.rows,
              householdMeta,
            ),
          })
        }
        throw new Error(
          'Cloud data changed while you were reviewing it. Review the refreshed preview.',
        )
      }
      return { rows: pull.rows, revision: pull.revision }
    },
    [decision],
  )

  const refreshDecisionAfterConflict = useCallback(
    async (
      verifiedUser: SignedInUser,
      operation: ActiveOperation,
      householdMeta: HouseholdSyncMeta,
    ) => {
      const refreshed = await pullProfiles(
        undefined,
        operation.controller.signal,
      )
      if (
        !refreshed.ok ||
        operation.controller.signal.aborted ||
        !mountedRef.current ||
        userRef.current?.id !== verifiedUser.id
      ) {
        return
      }
      remoteRowsRef.current = refreshed.rows
      remoteRevisionRef.current = refreshed.revision
      const reviewMeta: HouseholdSyncMeta = {
        ...householdMeta,
        cloudRevision: refreshed.revision,
        reconciliation: 'review',
        pauseReason:
          'Another device updated this household. Review the refreshed cloud data before retrying.',
      }
      persistCurrentMeta(reviewMeta)
      setDecision({
        reason: 'conflict',
        cloud: refreshed.rows.length === 0 ? 'empty' : 'data',
        preview: buildReconciliationPreview(
          profilesRef.current,
          refreshed.rows,
          reviewMeta,
        ),
      })
    },
    [persistCurrentMeta],
  )

  const uploadLocal = useCallback(async () => {
    const verifiedUser = userRef.current
    if (!verifiedUser || !decision || decision.cloud !== 'empty') {
      throw new Error(
        'Local upload is available only after a successful empty-cloud check.',
      )
    }
    const operation = beginOperation('upload')
    safeSetError(null)
    externalBlockedRef.current = false
    try {
      const confirmed = await verifyDecisionCloud(verifiedUser, operation)
      if (confirmed.rows.length !== 0) {
        throw new Error(
          'The household cloud is no longer empty. Review the refreshed preview.',
        )
      }
      const householdMeta = loadHouseholdMeta(
        verifiedUser.id,
        verifiedUser.email,
      )
      const now = Date.now()
      const prepared = prepareConfirmedLocalUpload(
        profilesRef.current,
        householdMeta,
        now,
        confirmed.revision,
      )
      let published = false
      const result = await guardedCloudPush(
        prepared.rows,
        confirmed.rows,
        confirmed.revision,
        verifiedUser,
        operation,
        true,
        async (validatedFingerprint, finalization) => {
          await claimLocalData(
            verifiedUser.id,
            verifiedUser.email,
            {
              ...prepared.meta,
              cloudRevision: finalization.resultingCloudRevision,
            },
            validatedFingerprint,
            finalization,
            (claimed) => {
              publishCurrentMeta(claimed)
              if (mountedRef.current) setDecision(null)
              published = true
            },
          )
        },
      )
      if (!result.ok || !published) {
        if (!result.ok && result.conflict) {
          await refreshDecisionAfterConflict(
            verifiedUser,
            operation,
            householdMeta,
          )
        }
        throw new Error(
          result.ok
            ? 'The upload did not finalize household ownership.'
          : result.error,
        )
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Upload failed.'
      safeSetError(message)
      throw cause
    } finally {
      finishOperation(operation)
    }
  }, [
    beginOperation,
    decision,
    finishOperation,
    guardedCloudPush,
    publishCurrentMeta,
    refreshDecisionAfterConflict,
    safeSetError,
    verifyDecisionCloud,
  ])

  const useCloud = useCallback(async () => {
    const verifiedUser = userRef.current
    if (!verifiedUser || !decision || remoteRowsRef.current.length === 0) {
      throw new Error('A verified cloud copy is required.')
    }
    const operation = beginOperation('replace')
    safeSetError(null)
    externalBlockedRef.current = false
    try {
      await strictProvenanceCheck(verifiedUser.id, verifiedUser, true)
      const verified = await verifyDecisionCloud(verifiedUser, operation)
      const verifiedRows = verified.rows
      if (verifiedRows.length === 0) {
        throw new Error('The household cloud is empty.')
      }
      if (!backupLocalForHousehold(verifiedUser.id, stateRef.current)) {
        throw new Error(
          'A local safety backup could not be created; cloud data was not applied.',
        )
      }
      const profiles = profilesFromRows(verifiedRows, stateRef.current.profiles)
      const nextState = appStateWithProfiles(stateRef.current, profiles)
      const next = metaAfterSuccessfulSync(
        loadHouseholdMeta(verifiedUser.id, verifiedUser.email),
        profiles,
        verifiedRows,
        Date.now(),
        verified.revision,
      )
      // Recheck identity/cloud adjacent to the local ownership transaction.
      const nextFingerprint = await datasetFingerprint(nextState)
      let published = false
      const guarded = await guardedCloudPush(
        [],
        verifiedRows,
        verified.revision,
        verifiedUser,
        operation,
        true,
        async (validatedFingerprint, finalization) => {
          await replaceDatasetAndClaim(
            verifiedUser.id,
            verifiedUser.email,
            {
              ...next,
              cloudRevision: finalization.resultingCloudRevision,
            },
            nextState,
            finalization,
            (claimed) => {
              setProfilesFromPersistedSync(nextState, nextFingerprint)
              publishCurrentMeta(claimed)
              if (mountedRef.current) setDecision(null)
              published = true
            },
            validatedFingerprint,
          )
        },
      )
      if (!guarded.ok || !published) {
        throw new Error(
          guarded.ok
            ? 'Cloud replacement did not finalize household ownership.'
          : guarded.error,
        )
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Cloud data was not applied.'
      safeSetError(message)
      throw cause
    } finally {
      finishOperation(operation)
    }
  }, [
    beginOperation,
    decision,
    finishOperation,
    guardedCloudPush,
    publishCurrentMeta,
    safeSetError,
    setProfilesFromPersistedSync,
    strictProvenanceCheck,
    verifyDecisionCloud,
  ])

  const applyReviewedMerge = useCallback(
    async (choices: Record<string, ConflictChoice>) => {
      const verifiedUser = userRef.current
      if (!verifiedUser || !decision) {
        throw new Error('There is no merge to apply.')
      }
      const operation = beginOperation('merge')
      safeSetError(null)
      externalBlockedRef.current = false
      try {
        await strictProvenanceCheck(verifiedUser.id, verifiedUser, true)
        const verified = await verifyDecisionCloud(verifiedUser, operation)
        const verifiedRows = verified.rows
        const now = Date.now()
        const selected = applyReviewedSelection(
          profilesRef.current,
          verifiedRows,
          decision.preview,
          choices,
          now,
        )
        if (!backupLocalForHousehold(verifiedUser.id, stateRef.current)) {
          throw new Error(
            'A local safety backup could not be created; the merge was not applied.',
          )
        }
        const remoteAfter = [
          ...verifiedRows.filter(
            (row) =>
              !selected.toPush.some(
                (pushed) => pushed.profile_id === row.profile_id,
              ),
          ),
          ...selected.toPush,
        ]
        const next = metaAfterSuccessfulSync(
          loadHouseholdMeta(verifiedUser.id, verifiedUser.email),
          selected.profiles,
          remoteAfter,
          now,
          verified.revision,
        )
        const nextState = appStateWithProfiles(
          stateRef.current,
          selected.profiles,
        )
        const nextFingerprint = await datasetFingerprint(nextState)
        let published = false
        const push = await guardedCloudPush(
          selected.toPush,
          verifiedRows,
          verified.revision,
          verifiedUser,
          operation,
          true,
          async (validatedFingerprint, finalization) => {
            await replaceDatasetAndClaim(
              verifiedUser.id,
              verifiedUser.email,
              {
                ...next,
                cloudRevision: finalization.resultingCloudRevision,
              },
              nextState,
              finalization,
              (claimed) => {
                setProfilesFromPersistedSync(nextState, nextFingerprint)
                publishCurrentMeta(claimed)
                if (mountedRef.current) setDecision(null)
                published = true
              },
              validatedFingerprint,
            )
          },
        )
        if (!push.ok || !published) {
          if (!push.ok && push.conflict) {
            await refreshDecisionAfterConflict(
              verifiedUser,
              operation,
              loadHouseholdMeta(verifiedUser.id, verifiedUser.email),
            )
          }
          throw new Error(
            push.ok
              ? 'The reviewed merge did not finalize household ownership.'
              : push.error,
          )
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Merge failed.'
        safeSetError(message)
        throw cause
      } finally {
        finishOperation(operation)
      }
    },
    [
      beginOperation,
      decision,
      finishOperation,
      guardedCloudPush,
      publishCurrentMeta,
      refreshDecisionAfterConflict,
      safeSetError,
      setProfilesFromPersistedSync,
      strictProvenanceCheck,
      verifyDecisionCloud,
    ],
  )

  const cancelDecision = useCallback(() => {
    if (operationRef.current) return
    setDecision(null)
    setError(null)
  }, [])

  const provenance: SyncStatus['provenance'] =
    meta?.binding === 'bound' &&
    meta.ownsLocalData &&
    !!meta.datasetFingerprint &&
    !externalBlockedRef.current
      ? 'verified'
      : meta?.pauseReason || externalBlockedRef.current
        ? 'paused'
        : 'unbound'

  const status: SyncStatus = {
    configured,
    online,
    user,
    binding: user ? (meta?.binding ?? 'unbound') : 'signed-out',
    lastSyncAt: meta?.lastSyncAt ?? null,
    pendingCount: meta ? dirtyIds(meta).length : 0,
    provenance,
    pauseReason:
      meta?.pauseReason ??
      (externalBlockedRef.current ? anotherTabMessage : null),
    busy,
    error,
    decision,
  }

  return {
    status,
    signIn,
    signOut,
    syncNow,
    uploadLocal,
    useCloud,
    applyReviewedMerge,
    cancelDecision,
  }
}
