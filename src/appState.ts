import type { AppState, Profile, SkillState, SkillStatus } from './types'
import type { SkillId } from './skills'
import { defaultAppState, migrateV1ToV2 } from './migration'
import {
  APP_STATE_STORAGE_KEY,
  DATASET_WRITE_LOCK_NAME,
  ensureDatasetProvenance,
  persistDatasetVerified,
  readDatasetProvenance,
  recordPersistedDatasetFingerprint,
  validateAppStateForSync,
} from './sync/provenance'
import {
  beginConfirmedImportInvalidation,
  finishConfirmedImportPersistence,
} from './sync/config'

const V1_KEY = 'homeschool-hq:profile:v1'
const BACKUP_PREFIX = 'homeschool-hq:backup:v1:'
const IMPORT_BACKUP_PREFIX = 'homeschool-hq:backup:import:'
const QUARANTINE_PREFIX = 'homeschool-hq:quarantine:app:'
export const APP_STATE_IMPORT_EVENT = 'academy:app-state-import'
const importedStates = new WeakSet<object>()

export interface LoadResult {
  state: AppState
  migrated: boolean
  /** localStorage key holding the pre-migration v1 snapshot */
  backupKey?: string
  /** Preserved malformed source that was not published into the application. */
  quarantineKey?: string
  recoveryError?: string
}

function quarantineRawState(raw: string, source: 'v1' | 'v2'): string | null {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const key = `${QUARANTINE_PREFIX}${source}:${stamp}`
    localStorage.setItem(key, raw)
    return key
  } catch {
    return null
  }
}

/**
 * Load app state. If only v1 data exists, snapshot it to a timestamped
 * backup key FIRST, then migrate. The original v1 key is never deleted.
 */
export function loadAppState(): LoadResult {
  const raw2 = localStorage.getItem(APP_STATE_STORAGE_KEY)
  if (raw2) {
    try {
      const parsed = JSON.parse(raw2) as unknown
      const validation = validateAppStateForSync(parsed)
      if (validation.ok) return { state: validation.state, migrated: false }
    } catch {
      // The exact malformed JSON is quarantined below before a safe default is
      // published; it is never silently discarded.
    }
    const quarantineKey = quarantineRawState(raw2, 'v2')
    const fresh = defaultAppState()
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(fresh))
    return {
      state: fresh,
      migrated: false,
      ...(quarantineKey ? { quarantineKey } : {}),
      recoveryError:
        'Stored Academy data was preserved for recovery but was not loaded because it is malformed.',
    }
  }
  try {
    const raw1 = localStorage.getItem(V1_KEY)
    if (raw1) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupKey = `${BACKUP_PREFIX}${stamp}`
      localStorage.setItem(backupKey, raw1) // backup BEFORE any conversion
      const migrated = migrateV1ToV2(JSON.parse(raw1))
      if (migrated) {
        const validation = validateAppStateForSync(migrated)
        if (validation.ok) {
          localStorage.setItem(
            APP_STATE_STORAGE_KEY,
            JSON.stringify(validation.state),
          )
          return { state: validation.state, migrated: true, backupKey }
        }
      }
      const quarantineKey = quarantineRawState(raw1, 'v1')
      const fresh = defaultAppState()
      localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(fresh))
      return {
        state: fresh,
        migrated: false,
        backupKey,
        ...(quarantineKey ? { quarantineKey } : {}),
        recoveryError:
          'Legacy Academy data was preserved for recovery but could not be migrated safely.',
      }
    }
  } catch {
    // fall through
  }
  const fresh = defaultAppState()
  localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(fresh))
  return { state: fresh, migrated: false }
}

interface DatasetLockManager {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T>
}

let latestAppStatePersistence: Promise<void> = Promise.resolve()

export async function saveAppState(state: AppState): Promise<void> {
  latestAppStatePersistence = (async () => {
    const persist = async () => {
      const persisted = await persistDatasetVerified(state)
      if (!persisted.ok) {
        // Local-first storage still gets its ordinary JSON write attempt inside
        // persistDatasetVerified. Provenance remains mismatched, which blocks
        // cloud mutation without making the offline UI unusable.
        return
      }
      try {
        const current = readDatasetProvenance()
        if (current?.importTransition) {
          await finishConfirmedImportPersistence(state)
          return
        }
        await ensureDatasetProvenance()
        recordPersistedDatasetFingerprint(persisted.fingerprint)
      } catch {
        // Fail closed: stale/missing provenance prevents cloud mutation.
      }
    }
    const locks =
      typeof navigator === 'undefined'
        ? undefined
        : (navigator as Navigator & { locks?: DatasetLockManager }).locks
    if (!locks) return persist()
    await locks.request(DATASET_WRITE_LOCK_NAME, { mode: 'exclusive' }, persist)
  })()
  return latestAppStatePersistence
}

export function waitForAppStatePersistence(): Promise<void> {
  return latestAppStatePersistence
}

export function isImportedAppState(state: AppState): boolean {
  return importedStates.has(state)
}

export function listV1BackupKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(BACKUP_PREFIX)) keys.push(k)
  }
  return keys.sort()
}

export function readLocalStorageKey(key: string): string | null {
  return localStorage.getItem(key)
}

// ---------- per-profile helpers ----------

/** Local calendar date (missions roll over at the family's midnight, not UTC's). */
export function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getStat(p: Profile, id: SkillId): SkillState {
  return p.skills[id] ?? { attempts: 0, correct: 0, mastery: 0 }
}

export function statusOf(stat: SkillState | undefined): SkillStatus {
  if (!stat || stat.attempts === 0) return 'not-started'
  return stat.mastery >= 75 ? 'mastered' : 'developing'
}

/**
 * Update mastery after one answered question. Returns a new profile object.
 * `weight` is 'full' for a normal question and 'retry' for the MT-1
 * "try one like it" question after a walkthrough — a right retry still counts,
 * but at reduced mastery weight (a walkthrough-assisted win isn't a full win).
 */
export function recordAnswer(
  p: Profile,
  skillId: SkillId,
  difficulty: number,
  correct: boolean,
  weight: 'full' | 'retry' = 'full',
): Profile {
  const prev = getStat(p, skillId)
  const gain = weight === 'retry' ? 2 : 4 + difficulty * 2
  const drop = weight === 'retry' ? 3 : 7
  const stat: SkillState = {
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    mastery: correct
      ? Math.min(100, prev.mastery + gain)
      : Math.max(5, prev.mastery - drop),
    lastSeen: isoToday(),
  }
  return {
    ...p,
    skills: { ...p.skills, [skillId]: stat },
    totals: {
      ...p.totals,
      questionsAnswered: p.totals.questionsAnswered + 1,
      correct: p.totals.correct + (correct ? 1 : 0),
    },
  }
}

/**
 * Session finished: bump sessions and best answer-streak.
 * Day streaks are owned by mission completion (src/missions.ts), not practice.
 */
export function finishSession(p: Profile, bestAnswerStreak: number): Profile {
  return {
    ...p,
    lastPracticeDate: isoToday(),
    totals: {
      ...p.totals,
      sessions: p.totals.sessions + 1,
      bestStreak: Math.max(p.totals.bestStreak, bestAnswerStreak),
    },
  }
}

export function updateProfile(state: AppState, profile: Profile): AppState {
  return { ...state, profiles: { ...state.profiles, [profile.id]: profile } }
}

/**
 * Apply a functional update to one profile against the LATEST app state.
 * ALWAYS call this inside a functional state update, e.g.
 *   setState((s) => patchProfile(s, id, (prev) => recordAnswer(prev, ...)))
 * so the reducer derives its base from the freshest committed profile. Two
 * writes in the same tick — or a session-finish racing the final answer — then
 * compose instead of both starting from the same stale render snapshot and the
 * second clobbering the first. Unknown ids are a no-op (returns state as-is).
 */
export function patchProfile(
  state: AppState,
  id: string,
  update: (prev: Profile) => Profile,
): AppState {
  const prev = state.profiles[id]
  if (!prev) return state
  return updateProfile(state, update(prev))
}

// ---------- backup (all profiles) ----------

export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * The exact JSON the standard export-all writes. MM privacy: no sanitizer is needed
 * here because reflection TEXT never lives in AppState — it is kept in journalStore's
 * own localStorage slot (see mindset/journalStore.ts). This serializes only AppState,
 * which carries mindset COMPLETION signals but never a girl's words.
 */
export function serializeAllBackup(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function exportAllBackup(state: AppState): void {
  downloadJson(
    `homeschool-hq-all-profiles-${isoToday()}.json`,
    serializeAllBackup(state),
  )
}

export type ImportResult =
  | { ok: true; state: AppState; note: string }
  | { ok: false; error: string }

function backupBeforeImport(current: AppState): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    localStorage.setItem(
      `${IMPORT_BACKUP_PREFIX}${stamp}`,
      JSON.stringify(current),
    )
    return true
  } catch {
    return false
  }
}

function successfulImport(state: AppState, note: string): ImportResult {
  let announced = false
  return {
    ok: true,
    get state() {
      if (!announced) {
        announced = true
        if (typeof localStorage !== 'undefined') {
          beginConfirmedImportInvalidation(
            'Imported Academy data is unbound and requires parent review.',
          )
        }
        importedStates.add(state)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(APP_STATE_IMPORT_EVENT, {
              detail: readDatasetProvenance(),
            }),
          )
        }
      }
      return state
    },
    note: `${note} Imported Academy data will remain unbound until a parent reviews cloud sync.`,
  }
}

/**
 * Import a backup file. v2 files replace the whole app state; v1 single-profile
 * files replace only the 3rd grader (p1), keeping the other four intact.
 */
export function importBackup(current: AppState, text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  const validatedV2 = validateAppStateForSync(parsed)
  if (validatedV2.ok) {
    if (!backupBeforeImport(current)) {
      return {
        ok: false,
        error:
          'A local safety backup could not be created, so no data was imported.',
      }
    }
    return successfulImport(
      validatedV2.state,
      'Full backup restored (all profiles).',
    )
  }
  const asV1 = migrateV1ToV2(parsed)
  if (asV1) {
    const merged = {
      ...current,
      profiles: { ...current.profiles, p1: asV1.profiles.p1 },
    }
    const validation = validateAppStateForSync(merged)
    if (!validation.ok) {
      return {
        ok: false,
        error:
          'That legacy backup contains malformed Academy data and was not imported.',
      }
    }
    if (!backupBeforeImport(current)) {
      return {
        ok: false,
        error:
          'A local safety backup could not be created, so no data was imported.',
      }
    }
    return successfulImport(
      validation.state,
      'Old single-profile backup restored into the 3rd grader profile.',
    )
  }
  return { ok: false, error: 'That file is not a Homeschool HQ backup.' }
}
