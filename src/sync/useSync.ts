import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, Profile } from '../types'
import {
  asSignedInUser,
  backupLocalForHousehold,
  claimLocalData,
  loadHouseholdMeta,
  localDataOwner,
  saveHouseholdMeta,
  supabaseConfigured,
} from './config'
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
  getCurrentSession,
  onAuthSessionChange,
  pullProfiles,
  pushProfiles,
  signInWithPassword,
  signOutRemote,
  userFromSession,
} from './supabase'
import {
  executeAutomaticCycle,
  executeConfirmedLocalUpload,
  inspectUnboundHousehold,
} from './workflow'
import type {
  ConflictChoice,
  HouseholdSyncMeta,
  RemoteProfileRow,
  SignedInUser,
  SyncDecision,
  SyncStatus,
} from './types'

export interface SyncApi {
  status: SyncStatus
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  /** Safe retry/manual sync. Unbound households only get a read-only preview. */
  syncNow: () => Promise<void>
  /** First-sync action, available only after a successful empty-cloud pull. */
  uploadLocal: () => Promise<void>
  /** Confirmed cloud replacement; a local backup is required before application. */
  useCloud: () => Promise<void>
  /** Apply explicit whole-profile choices for true two-sided conflicts. */
  applyReviewedMerge: (choices: Record<string, ConflictChoice>) => Promise<void>
  cancelDecision: () => void
}

const profilesFromRows = (rows: RemoteProfileRow[]): Record<string, Profile> =>
  Object.fromEntries(rows.map((row) => [row.profile_id, row.data]))

/**
 * Safe local-first sync:
 * - no unbound or switched household can push;
 * - every sync pulls successfully before any push;
 * - matching bindings auto-apply only one-sided changes;
 * - two-sided changes require explicit whole-profile choices.
 */
export function useSync(
  state: AppState,
  setState: (fn: (prev: AppState) => AppState) => void,
): SyncApi {
  const configured = supabaseConfigured()
  const [user, setUser] = useState<SignedInUser | null>(null)
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<SyncDecision | null>(null)
  const [meta, setMeta] = useState<HouseholdSyncMeta | null>(null)

  const userRef = useRef<SignedInUser | null>(null)
  const metaRef = useRef<HouseholdSyncMeta | null>(null)
  const remoteRowsRef = useRef<RemoteProfileRow[]>([])
  const profilesRef = useRef(state.profiles)
  const snapshotRef = useRef(state.profiles)
  const stateRef = useRef(state)
  const syncNowRef = useRef<() => Promise<void>>(async () => undefined)
  const pushTimer = useRef<number | null>(null)
  const boundSyncInFlight = useRef(false)
  const syncAbortRef = useRef<AbortController | null>(null)
  const decisionAbortRef = useRef<AbortController | null>(null)

  userRef.current = user
  metaRef.current = meta
  profilesRef.current = state.profiles
  stateRef.current = state

  const persistCurrentMeta = useCallback((next: HouseholdSyncMeta) => {
    saveHouseholdMeta(next)
    metaRef.current = next
    setMeta(next)
  }, [])

  const setProfilesFromSync = useCallback(
    (profiles: Record<string, Profile>) => {
      snapshotRef.current = profiles
      profilesRef.current = profiles
      setState((prev) => ({
        ...prev,
        profiles,
        activeProfileId:
          prev.activeProfileId && profiles[prev.activeProfileId]
            ? prev.activeProfileId
            : null,
      }))
    },
    [setState],
  )

  const prepareUnbound = useCallback(
    async (verifiedUser: SignedInUser, householdMeta: HouseholdSyncMeta) => {
      setBusy(true)
      setError(null)
      setDecision(null)
      try {
        const inspection = await inspectUnboundHousehold(
          profilesRef.current,
          householdMeta,
          pullProfiles,
        )
        if (userRef.current?.id !== verifiedUser.id) return
        if (inspection.kind === 'pull-error') {
          setError(`Cloud data could not be loaded: ${inspection.error}`)
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
        setBusy(false)
      }
    },
    [],
  )

  const runBoundSync = useCallback(
    async (householdMeta: HouseholdSyncMeta) => {
      const verifiedUser = userRef.current
      if (
        !verifiedUser ||
        verifiedUser.id !== householdMeta.householdId ||
        householdMeta.binding !== 'bound' ||
        !householdMeta.ownsLocalData
      ) {
        return
      }
      if (boundSyncInFlight.current) return
      boundSyncInFlight.current = true
      const controller = new AbortController()
      syncAbortRef.current = controller
      setBusy(true)
      setError(null)
      try {
        const cycle = await executeAutomaticCycle(
          profilesRef.current,
          householdMeta,
          Date.now(),
          {
            pull: () => pullProfiles(undefined, controller.signal),
            push: (rows) => {
              if (
                controller.signal.aborted ||
                userRef.current?.id !== householdMeta.householdId
              ) {
                return Promise.resolve({
                  ok: false as const,
                  error:
                    'Sync stopped because the authenticated household changed.',
                })
              }
              return pushProfiles(rows, undefined, controller.signal)
            },
          },
        )
        if (
          controller.signal.aborted ||
          userRef.current?.id !== householdMeta.householdId
        ) {
          return
        }
        if (cycle.kind === 'pull-error') {
          setError(`Cloud data could not be loaded: ${cycle.error}`)
          return
        }
        if (cycle.kind === 'unbound') return
        if (cycle.kind === 'push-error') {
          persistCurrentMeta(cycle.meta)
          setError(
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
        setProfilesFromSync(cycle.profiles)
        persistCurrentMeta(cycle.meta)
        setDecision(null)
      } finally {
        boundSyncInFlight.current = false
        if (syncAbortRef.current === controller) syncAbortRef.current = null
        setBusy(false)
      }
    },
    [persistCurrentMeta, setProfilesFromSync],
  )

  const syncNow = useCallback(async () => {
    const verifiedUser = userRef.current
    if (!configured || !verifiedUser) return
    const householdMeta = loadHouseholdMeta(verifiedUser.id, verifiedUser.email)
    persistCurrentMeta(householdMeta)
    if (householdMeta.binding === 'bound' && householdMeta.ownsLocalData) {
      await runBoundSync(householdMeta)
    } else {
      await prepareUnbound(verifiedUser, householdMeta)
    }
  }, [configured, persistCurrentMeta, prepareUnbound, runBoundSync])
  syncNowRef.current = syncNow

  // The official client restores and refreshes its own persisted session.
  useEffect(() => {
    if (!configured) return
    let live = true
    void getCurrentSession().then((session) => {
      if (!live) return
      const restored = userFromSession(session)
      userRef.current = restored
      setUser(restored)
    })
    const unsubscribe = onAuthSessionChange((_event, session) => {
      const next = userFromSession(session)
      if (userRef.current?.id && userRef.current.id !== next?.id) {
        syncAbortRef.current?.abort()
        decisionAbortRef.current?.abort()
      }
      userRef.current = next
      setUser(next)
    })
    return () => {
      live = false
      unsubscribe()
    }
  }, [configured])

  // A verified identity may auto-resume only when its namespaced binding matches.
  useEffect(() => {
    if (!user) {
      metaRef.current = null
      setMeta(null)
      setDecision(null)
      return
    }
    const householdMeta = loadHouseholdMeta(user.id, user.email)
    persistCurrentMeta(householdMeta)
    if (!online) return
    if (householdMeta.binding === 'bound' && householdMeta.ownsLocalData) {
      void runBoundSync(householdMeta)
    } else {
      void prepareUnbound(user, householdMeta)
    }
  }, [user?.id, online, persistCurrentMeta, prepareUnbound, runBoundSync])

  // Local writes queue against the household that explicitly owns local AppState.
  useEffect(() => {
    const changed = changedProfiles(snapshotRef.current, state.profiles)
    snapshotRef.current = state.profiles
    if (changed.length === 0) return

    const current = metaRef.current
    const owner =
      current?.binding === 'bound' && current.ownsLocalData
        ? current
        : localDataOwner()
    if (!owner) return
    const next = markDirty(owner, changed, Date.now())
    saveHouseholdMeta(next)
    if (current?.householdId === next.householdId) {
      metaRef.current = next
      setMeta(next)
    }

    if (
      !online ||
      userRef.current?.id !== next.householdId ||
      next.reconciliation === 'review'
    ) {
      return
    }
    if (pushTimer.current !== null) window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => void syncNowRef.current(), 1500)
  }, [state.profiles, online])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      if (pushTimer.current !== null) window.clearTimeout(pushTimer.current)
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const result = await signInWithPassword(email, password)
    if (!result.ok) return { ok: false, error: result.error }
    userRef.current = result.user
    setUser(result.user)
    return { ok: true }
  }, [])

  const signOut = useCallback(async () => {
    if (pushTimer.current !== null) {
      window.clearTimeout(pushTimer.current)
      pushTimer.current = null
    }
    syncAbortRef.current?.abort()
    decisionAbortRef.current?.abort()
    userRef.current = null
    setUser(null)
    setDecision(null)
    setError(null)
    await signOutRemote()
  }, [])

  const verifyDecisionCloud = useCallback(
    async (signal: AbortSignal): Promise<RemoteProfileRow[]> => {
      const verifiedUser = userRef.current
      if (!verifiedUser || !decision)
        throw new Error('There is no sync decision to confirm.')
      const pull = await pullProfiles(undefined, signal)
      if (signal.aborted || userRef.current?.id !== verifiedUser.id) {
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
        setDecision({
          ...decision,
          cloud: pull.rows.length === 0 ? 'empty' : 'data',
          preview: buildReconciliationPreview(
            profilesRef.current,
            pull.rows,
            householdMeta,
          ),
        })
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
    const currentDecision = decision
    if (
      !verifiedUser ||
      !currentDecision ||
      currentDecision.cloud !== 'empty'
    ) {
      throw new Error(
        'Local upload is available only after a successful empty-cloud check.',
      )
    }
    const householdMeta = loadHouseholdMeta(verifiedUser.id, verifiedUser.email)
    setBusy(true)
    setError(null)
    const controller = new AbortController()
    decisionAbortRef.current = controller
    try {
      const confirmedRows = await verifyDecisionCloud(controller.signal)
      if (confirmedRows.length !== 0) {
        throw new Error(
          'The household cloud is no longer empty. Review the refreshed preview.',
        )
      }
      const result = await executeConfirmedLocalUpload(
        profilesRef.current,
        householdMeta,
        Date.now(),
        (rows) => pushProfiles(rows, undefined, controller.signal),
      )
      if (!result.ok) throw new Error(result.error)
      const claimed = claimLocalData(
        verifiedUser.id,
        verifiedUser.email,
        result.meta,
      )
      persistCurrentMeta(claimed)
      setDecision(null)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Upload failed.'
      setError(message)
      throw cause
    } finally {
      if (decisionAbortRef.current === controller)
        decisionAbortRef.current = null
      setBusy(false)
    }
  }, [decision, persistCurrentMeta, verifyDecisionCloud])

  const useCloud = useCallback(async () => {
    const verifiedUser = userRef.current
    if (!verifiedUser || !decision || remoteRowsRef.current.length === 0) {
      throw new Error('A verified cloud copy is required.')
    }
    setBusy(true)
    setError(null)
    const controller = new AbortController()
    decisionAbortRef.current = controller
    try {
      const verifiedRows = await verifyDecisionCloud(controller.signal)
      if (verifiedRows.length === 0)
        throw new Error('The household cloud is empty.')
      if (!backupLocalForHousehold(verifiedUser.id, stateRef.current)) {
        throw new Error(
          'A local safety backup could not be created; cloud data was not applied.',
        )
      }
      const profiles = profilesFromRows(verifiedRows)
      const next = metaAfterSuccessfulSync(
        loadHouseholdMeta(verifiedUser.id, verifiedUser.email),
        profiles,
        verifiedRows,
        Date.now(),
      )
      const claimed = claimLocalData(verifiedUser.id, verifiedUser.email, next)
      setProfilesFromSync(profiles)
      persistCurrentMeta(claimed)
      setDecision(null)
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Cloud data was not applied.'
      setError(message)
      throw cause
    } finally {
      if (decisionAbortRef.current === controller)
        decisionAbortRef.current = null
      setBusy(false)
    }
  }, [decision, persistCurrentMeta, setProfilesFromSync, verifyDecisionCloud])

  const applyReviewedMerge = useCallback(
    async (choices: Record<string, ConflictChoice>) => {
      const verifiedUser = userRef.current
      if (!verifiedUser || !decision)
        throw new Error('There is no merge to apply.')
      setBusy(true)
      setError(null)
      const controller = new AbortController()
      decisionAbortRef.current = controller
      try {
        const verifiedRows = await verifyDecisionCloud(controller.signal)
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
        const push = await pushProfiles(
          selected.toPush,
          undefined,
          controller.signal,
        )
        if (!push.ok) throw new Error(push.error)
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
        const claimed = claimLocalData(
          verifiedUser.id,
          verifiedUser.email,
          next,
        )
        setProfilesFromSync(selected.profiles)
        persistCurrentMeta(claimed)
        setDecision(null)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Merge failed.'
        setError(message)
        throw cause
      } finally {
        if (decisionAbortRef.current === controller)
          decisionAbortRef.current = null
        setBusy(false)
      }
    },
    [decision, persistCurrentMeta, setProfilesFromSync, verifyDecisionCloud],
  )

  const cancelDecision = useCallback(() => {
    setDecision(null)
    setError(null)
  }, [])

  const status: SyncStatus = {
    configured,
    online,
    user,
    binding: user ? (meta?.binding ?? 'unbound') : 'signed-out',
    lastSyncAt: meta?.lastSyncAt ?? null,
    pendingCount: meta ? dirtyIds(meta).length : 0,
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
