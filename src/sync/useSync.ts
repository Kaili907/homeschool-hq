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
import {
  asSignedInUser,
  backupLocalForHousehold,
  claimLocalData,
  cleanupLegacySyncStorage,
  invalidateAllLocalOwnership,
  loadHouseholdMeta,
  localDataOwner,
  pauseHouseholdForMismatch,
  recoverOwnershipTransitions,
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
  tryAcquireMutationLease,
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
  DATASET_WRITE_LOCK_NAME,
  datasetFingerprint,
  readPersistedDataset,
  verifyOwnedDatasetProvenance,
} from './provenance'
import {
  getCurrentSession,
  getVerifiedAuthContext,
  onAuthSessionChange,
  pullProfiles,
  pushProfiles,
  signInWithPassword,
  signOutRemote,
  userFromSession,
} from './supabase'
import type {
  CloudPushResult,
  ConflictChoice,
  HouseholdSyncMeta,
  RemoteProfileRow,
  SignedInUser,
  SyncStatus,
} from './types'
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

function profilesFromRows(rows: RemoteProfileRow[]): Record<string, Profile> {
  return Object.fromEntries(rows.map((row) => [row.profile_id, row.data]))
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
  const [user, setUser] = useState<SignedInUser | null>(null)
  const [meta, setMeta] = useState<HouseholdSyncMeta | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<SyncStatus['decision']>(null)

  const mountedRef = useRef(false)
  const userRef = useRef<SignedInUser | null>(null)
  const metaRef = useRef<HouseholdSyncMeta | null>(null)
  const remoteRowsRef = useRef<RemoteProfileRow[]>([])
  const profilesRef = useRef(state.profiles)
  const snapshotRef = useRef(state.profiles)
  const stateRef = useRef(state)
  const stateFingerprintRef = useRef(datasetFingerprint(state))
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
      if (operationRef.current?.id === operation.id) operationRef.current = null
      safeSetBusy(false)
    },
    [safeSetBusy],
  )

  const abortOperation = useCallback(() => {
    operationRef.current?.controller.abort()
    operationRef.current = null
    safeSetBusy(false)
  }, [safeSetBusy])

  const setProfilesFromPersistedSync = useCallback(
    (nextState: AppState) => {
      const fingerprint = datasetFingerprint(nextState)
      snapshotRef.current = nextState.profiles
      profilesRef.current = nextState.profiles
      stateRef.current = nextState
      stateFingerprintRef.current = fingerprint
      setState(() => nextState)
    },
    [setState],
  )

  const strictProvenanceCheck = useCallback(
    (
      householdId: string,
      expectedUser: SignedInUser,
      allowUnbound: boolean,
    ): ProvenanceCheck => {
      if (
        userRef.current?.id !== householdId ||
        expectedUser.id !== householdId
      ) {
        throw new Error(
          'Sync stopped because the authenticated household changed.',
        )
      }
      const persisted = readPersistedDataset()
      if (!persisted.ok) throw new Error(persisted.error)
      const memoryFingerprint = datasetFingerprint(stateRef.current)
      if (memoryFingerprint !== persisted.fingerprint) {
        throw new Error(
          'This tab does not match the currently persisted Academy data.',
        )
      }
      const current = loadHouseholdMeta(householdId, expectedUser.email)
      if (!allowUnbound) {
        const provenance = verifyOwnedDatasetProvenance(
          current,
          stateRef.current,
        )
        if (externalBlockedRef.current || !provenance.ok)
          throw new Error(provenanceMismatchMessage)
      }
      return { meta: current, fingerprint: persisted.fingerprint }
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
      expectedUser: SignedInUser,
      operation: ActiveOperation,
      allowUnbound: boolean,
      commit?: (validatedFingerprint: string) => void | Promise<void>,
    ): Promise<CloudPushResult> => {
      const initial = strictProvenanceCheck(
        expectedUser.id,
        expectedUser,
        allowUnbound,
      )
      const expectedCloudRevision = remoteRowsSignature(expectedCloudRows)
      let verifiedAccessToken: string | null = null

      return runUnderWebLock(expectedUser.id, async () => {
        let lease: MutationLease | null = tryAcquireMutationLease({
          householdId: expectedUser.id,
          tabId: tabIdRef.current,
          operationId: operation.id,
          datasetFingerprint: initial.fingerprint,
          cloudRevision: expectedCloudRevision,
        })
        if (!lease) {
          return {
            ok: false,
            error: 'Another tab currently owns the household sync lease.',
          }
        }
        try {
          return executeGuardedMutation({
            householdId: expectedUser.id,
            datasetFingerprint: initial.fingerprint,
            cloudRevision: expectedCloudRevision,
            signal: operation.controller.signal,
            authenticatedHouseholdId: () => userRef.current?.id ?? null,
            verifyAuthenticatedHousehold: async () => {
              const verified = await getVerifiedAuthContext()
              verifiedAccessToken =
                verified?.user.id === expectedUser.id
                  ? verified.accessToken
                  : null
              return (
                !operation.controller.signal.aborted &&
                userRef.current?.id === expectedUser.id &&
                verified?.user.id === expectedUser.id
              )
            },
            currentDatasetFingerprint: () => {
              try {
                return strictProvenanceCheck(
                  expectedUser.id,
                  expectedUser,
                  allowUnbound,
                ).fingerprint
              } catch {
                return null
              }
            },
            leaseValid: () => !!lease && mutationLeaseIsOwned(lease),
            refreshLease: () => {
              if (!lease) return false
              const renewed = renewMutationLease(lease)
              if (!renewed) return false
              lease = renewed
              return true
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
              const pushed =
                rows.length === 0
                  ? { ok: true as const }
                  : !verifiedAccessToken
                    ? {
                        ok: false as const,
                        error:
                          'A server-verified auth token was unavailable for the write.',
                      }
                    : await pushProfiles(
                        rows,
                        verifiedAccessToken,
                        operation.controller.signal,
                      )
              if (!pushed.ok) return pushed
              try {
                await commit?.(initial.fingerprint)
                return pushed
              } catch (cause) {
                return {
                  ok: false,
                  error:
                    cause instanceof Error
                      ? cause.message
                      : 'The local ownership transaction failed.',
                }
              }
            },
          })
        } finally {
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
        strictProvenanceCheck(householdMeta.householdId, verifiedUser, false)
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
            push: (rows, expectedCloudRows) =>
              guardedCloudPush(
                rows,
                expectedCloudRows,
                verifiedUser,
                operation,
                false,
              ),
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
          safeSetError(
            `Cloud data was read, but local changes were not uploaded: ${cycle.error}`,
          )
          return
        }
        remoteRowsRef.current = cycle.rows
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
        let claimed: HouseholdSyncMeta | null = null
        const finalized = await guardedCloudPush(
          [],
          cycle.rows,
          verifiedUser,
          operation,
          false,
          (validatedFingerprint) => {
            claimed = replaceDatasetAndClaim(
              verifiedUser.id,
              verifiedUser.email,
              cycle.meta,
              nextState,
              validatedFingerprint,
            )
          },
        )
        if (!finalized.ok || !claimed) {
          throw new Error(
            finalized.ok
              ? 'Automatic sync did not finalize household ownership.'
              : finalized.error,
          )
        }
        setProfilesFromPersistedSync(nextState)
        persistCurrentMeta(claimed)
        setDecision(null)
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

  // Upgrade cleanup and interrupted transition recovery happen before auth.
  useEffect(() => {
    mountedRef.current = true
    cleanupLegacySyncStorage()
    const recoveries = recoverOwnershipTransitions()
    const review = recoveries.find((item) => item.kind === 'review')
    if (review?.kind === 'review') setError(review.reason)
    setBootstrapped(true)
    return () => {
      mountedRef.current = false
      abortOperation()
    }
  }, [abortOperation])

  // The official client restores and refreshes its supported persisted session.
  useEffect(() => {
    if (!configured || !bootstrapped) return
    let live = true
    void getCurrentSession().then((session) => {
      if (!live || !mountedRef.current) return
      const restored = userFromSession(session)
      userRef.current = restored
      setUser(restored)
    })
    const unsubscribe = onAuthSessionChange((_event, session) => {
      const next = userFromSession(session)
      if (userRef.current?.id && userRef.current.id !== next?.id)
        abortOperation()
      userRef.current = next
      if (mountedRef.current) setUser(next)
    })
    return () => {
      live = false
      unsubscribe()
    }
  }, [abortOperation, bootstrapped, configured])

  // A verified identity auto-resumes only with matching durable provenance.
  useEffect(() => {
    if (!bootstrapped) return
    if (!user) {
      metaRef.current = null
      setMeta(null)
      setDecision(null)
      return
    }
    let householdMeta = loadHouseholdMeta(user.id, user.email)
    if (householdMeta.binding === 'bound' && householdMeta.ownsLocalData) {
      const persisted = readPersistedDataset()
      const memoryFingerprint = datasetFingerprint(stateRef.current)
      if (
        !persisted.ok ||
        persisted.fingerprint !== memoryFingerprint ||
        householdMeta.datasetFingerprint !== persisted.fingerprint
      ) {
        householdMeta = pauseHouseholdForMismatch(
          user.id,
          user.email,
          provenanceMismatchMessage,
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
  }, [
    bootstrapped,
    online,
    persistCurrentMeta,
    prepareUnbound,
    runBoundSync,
    user?.id,
  ])

  // Persisted state is the authority for provenance. Normal same-tab edits may
  // advance the owned fingerprint; imports always invalidate ownership.
  useEffect(() => {
    const previousFingerprint = stateFingerprintRef.current
    const nextFingerprint = datasetFingerprint(state)
    const changed = changedProfiles(snapshotRef.current, state.profiles)
    snapshotRef.current = state.profiles
    stateFingerprintRef.current = nextFingerprint
    if (!bootstrapped || previousFingerprint === nextFingerprint) return
    const imported = isImportedAppState(state)
    let cancelled = false
    void waitForAppStatePersistence()
      .then(() => {
        if (cancelled || !mountedRef.current) return
        const persisted = readPersistedDataset()
        const current = metaRef.current
        if (
          imported ||
          !persisted.ok ||
          persisted.fingerprint !== nextFingerprint
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
          !current ||
          current.binding !== 'bound' ||
          !current.ownsLocalData ||
          current.datasetFingerprint !== previousFingerprint ||
          externalBlockedRef.current
        ) {
          return
        }
        const advanced = markDirty(
          { ...current, datasetFingerprint: nextFingerprint },
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
      })
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
    }
    const storageChanged = (event: StorageEvent) => {
      const key = event.key
      if (
        key !== APP_STATE_STORAGE_KEY &&
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
    await signOutRemote()
  }, [abortOperation])

  const verifyDecisionCloud = useCallback(
    async (
      verifiedUser: SignedInUser,
      operation: ActiveOperation,
    ): Promise<RemoteProfileRow[]> => {
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
        remoteRowsSignature(pull.rows) !==
        remoteRowsSignature(remoteRowsRef.current)
      ) {
        remoteRowsRef.current = pull.rows
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
      return pull.rows
    },
    [decision],
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
      const confirmedRows = await verifyDecisionCloud(verifiedUser, operation)
      if (confirmedRows.length !== 0) {
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
      )
      let claimed: HouseholdSyncMeta | null = null
      const result = await guardedCloudPush(
        prepared.rows,
        confirmedRows,
        verifiedUser,
        operation,
        true,
        (validatedFingerprint) => {
          claimed = claimLocalData(
            verifiedUser.id,
            verifiedUser.email,
            prepared.meta,
            validatedFingerprint,
          )
        },
      )
      if (!result.ok || !claimed) {
        throw new Error(
          result.ok
            ? 'The upload did not finalize household ownership.'
            : result.error,
        )
      }
      persistCurrentMeta(claimed)
      if (mountedRef.current) setDecision(null)
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
    persistCurrentMeta,
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
      strictProvenanceCheck(verifiedUser.id, verifiedUser, true)
      const verifiedRows = await verifyDecisionCloud(verifiedUser, operation)
      if (verifiedRows.length === 0) {
        throw new Error('The household cloud is empty.')
      }
      if (!backupLocalForHousehold(verifiedUser.id, stateRef.current)) {
        throw new Error(
          'A local safety backup could not be created; cloud data was not applied.',
        )
      }
      const profiles = profilesFromRows(verifiedRows)
      const nextState = appStateWithProfiles(stateRef.current, profiles)
      const next = metaAfterSuccessfulSync(
        loadHouseholdMeta(verifiedUser.id, verifiedUser.email),
        profiles,
        verifiedRows,
        Date.now(),
      )
      // Recheck identity/cloud adjacent to the local ownership transaction.
      let claimed: HouseholdSyncMeta | null = null
      const guarded = await guardedCloudPush(
        [],
        verifiedRows,
        verifiedUser,
        operation,
        true,
        (validatedFingerprint) => {
          claimed = replaceDatasetAndClaim(
            verifiedUser.id,
            verifiedUser.email,
            next,
            nextState,
            validatedFingerprint,
          )
        },
      )
      if (!guarded.ok || !claimed) {
        throw new Error(
          guarded.ok
            ? 'Cloud replacement did not finalize household ownership.'
            : guarded.error,
        )
      }
      setProfilesFromPersistedSync(nextState)
      persistCurrentMeta(claimed)
      if (mountedRef.current) setDecision(null)
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
    persistCurrentMeta,
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
        strictProvenanceCheck(verifiedUser.id, verifiedUser, true)
        const verifiedRows = await verifyDecisionCloud(verifiedUser, operation)
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
        )
        const nextState = appStateWithProfiles(
          stateRef.current,
          selected.profiles,
        )
        let claimed: HouseholdSyncMeta | null = null
        const push = await guardedCloudPush(
          selected.toPush,
          verifiedRows,
          verifiedUser,
          operation,
          true,
          (validatedFingerprint) => {
            claimed = replaceDatasetAndClaim(
              verifiedUser.id,
              verifiedUser.email,
              next,
              nextState,
              validatedFingerprint,
            )
          },
        )
        if (!push.ok || !claimed) {
          throw new Error(
            push.ok
              ? 'The reviewed merge did not finalize household ownership.'
              : push.error,
          )
        }
        setProfilesFromPersistedSync(nextState)
        persistCurrentMeta(claimed)
        if (mountedRef.current) setDecision(null)
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
      persistCurrentMeta,
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
