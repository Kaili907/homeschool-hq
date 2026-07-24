import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, Profile } from '../types'
import {
  getStoredSession,
  loadMeta,
  saveMeta,
  setStoredSession,
  supabaseConfigured,
  type StoredSession,
} from './config'
import {
  changedProfiles,
  clearDirty,
  dirtyIds,
  markDirty,
  pendingRows,
  reconcile,
  summarizeLocal,
  summarizeRemote,
} from './engine'
import { pullProfiles, pushProfiles, signInWithPassword, signOutRemote } from './supabase'
import type { SyncMeta, SyncStatus, SyncSummary } from './types'

export interface SyncApi {
  status: SyncStatus
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  /** manual "Sync now": pull + reconcile + push pending. */
  syncNow: () => Promise<void>
  /** migration previews — shown to Dad BEFORE anything is applied. */
  previewPushLocal: () => SyncSummary
  previewPullCloud: () => Promise<SyncSummary>
  /** one-time migrations (explicit, confirmed by the UI). */
  pushAllLocal: () => Promise<void>
  pullCloud: () => Promise<void>
}

/**
 * M6 local-first sync hook. Local writes always land first (App's own saveAppState
 * is unchanged); this pushes async and pulls on open + reconnect. It NEVER blocks
 * the UI: every network call is fire-and-forget and folds results back through the
 * functional AppState setter. With no Supabase config it is entirely inert.
 */
export function useSync(state: AppState, setState: (fn: (prev: AppState) => AppState) => void): SyncApi {
  const configured = supabaseConfigured()
  const [session, setSession] = useState<StoredSession | null>(() => (configured ? getStoredSession() : null))
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [busy, setBusy] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(() => loadMeta().lastSyncAt ?? null)

  const metaRef = useRef<SyncMeta>(loadMeta())
  const snapshotRef = useRef<Record<string, Profile>>(state.profiles) // last state we've accounted for
  const sessionRef = useRef<StoredSession | null>(session)
  const profilesRef = useRef<Record<string, Profile>>(state.profiles)
  sessionRef.current = session
  profilesRef.current = state.profiles

  const persistMeta = useCallback((m: SyncMeta) => {
    metaRef.current = m
    saveMeta(m)
    setPendingCount(dirtyIds(m).length)
    if (m.lastSyncAt) setLastSyncAt(m.lastSyncAt)
  }, [])

  /** Push everything currently dirty (the offline queue). No-op when signed out. */
  const pushDirty = useCallback(async () => {
    const s = sessionRef.current
    if (!configured || !s) return
    const rows = pendingRows(profilesRef.current, metaRef.current)
    if (rows.length === 0) return
    const ok = await pushProfiles(s, rows)
    if (ok) persistMeta(clearDirty(metaRef.current, rows.map((r) => r.profile_id)))
  }, [configured, persistMeta])

  /** Pull + reconcile + push the converged union. The one true sync step. */
  const runSync = useCallback(async () => {
    const s = sessionRef.current
    if (!configured || !s) return
    setBusy(true)
    try {
      const remote = await pullProfiles(s)
      const result = reconcile(profilesRef.current, metaRef.current, remote, Date.now())
      // apply merged profiles; update the snapshot FIRST so the change-detection
      // effect doesn't mistake a pull for a local edit.
      snapshotRef.current = result.profiles
      profilesRef.current = result.profiles
      setState((prev) => ({ ...prev, profiles: result.profiles }))
      persistMeta(result.meta)
      if (result.toPush.length > 0) {
        const ok = await pushProfiles(s, result.toPush)
        if (ok) persistMeta(clearDirty(metaRef.current, result.toPush.map((r) => r.profile_id)))
      }
    } finally {
      setBusy(false)
    }
  }, [configured, persistMeta, setState])

  // Detect local edits → mark dirty → debounced push. (Never blocks the writer.)
  const pushTimer = useRef<number | null>(null)
  useEffect(() => {
    const changed = changedProfiles(snapshotRef.current, state.profiles)
    snapshotRef.current = state.profiles
    if (changed.length === 0) return
    persistMeta(markDirty(metaRef.current, changed, Date.now()))
    if (!configured || !sessionRef.current || !online) return // queued; flushes on reconnect
    if (pushTimer.current !== null) window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => void pushDirty(), 1500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.profiles])

  // Pull on open (once signed in) and whenever we come back online.
  useEffect(() => {
    if (configured && session && online) void runSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, configured])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const goOnline = () => {
      setOnline(true)
      void (async () => {
        await pushDirty()
        await runSync()
      })()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [pushDirty, runSync])

  // ---------- actions ----------

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await signInWithPassword(email, password)
      if (!res.ok) return { ok: false, error: res.error }
      setStoredSession(res.session)
      sessionRef.current = res.session
      setSession(res.session)
      return { ok: true }
    },
    [],
  )

  const signOut = useCallback(async () => {
    const s = sessionRef.current
    if (s) await signOutRemote(s)
    setStoredSession(null) // clears the sync session; LOCAL data + meta stay intact
    sessionRef.current = null
    setSession(null)
  }, [])

  const previewPushLocal = useCallback(() => summarizeLocal(profilesRef.current, metaRef.current), [])

  const previewPullCloud = useCallback(async () => {
    const s = sessionRef.current
    if (!configured || !s) return { count: 0, perGirl: [] }
    return summarizeRemote(await pullProfiles(s))
  }, [configured])

  /** Migration: mark every local profile dirty and push it (union upsert). */
  const pushAllLocal = useCallback(async () => {
    const s = sessionRef.current
    if (!configured || !s) return
    persistMeta(markDirty(metaRef.current, Object.keys(profilesRef.current), Date.now()))
    await pushDirty()
  }, [configured, persistMeta, pushDirty])

  /** Migration: pull + reconcile (merge, never silent-overwrite). */
  const pullCloud = useCallback(async () => {
    await runSync()
  }, [runSync])

  const status: SyncStatus = {
    configured,
    online,
    user: session ? session.user : null,
    lastSyncAt,
    pendingCount,
    busy,
  }

  return { status, signIn, signOut, syncNow: runSync, previewPushLocal, previewPullCloud, pushAllLocal, pullCloud }
}
