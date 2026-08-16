import {
  emptyFamilyPilotState,
  upgradeFamilyPilotState,
  type FamilyPilotSchemaReasonCode,
  type FamilyPilotStateV1,
} from './schema'

// FAMILY-PILOT-CORE: device-local persistence.
//
// Key naming, the injectable StorageLike seam and the `:health` sidecar all
// follow src/study/safety/localStopLedger.ts, which is the repository's
// established device-local store. Nothing here contacts a network.

export const FAMILY_PILOT_STATE_KEY = 'manuel-academy.study.family-pilot-state.v1'
const HEALTH_KEY = `${FAMILY_PILOT_STATE_KEY}:health`
/** Corrupt state is preserved here, never silently destroyed. */
export const FAMILY_PILOT_QUARANTINE_KEY = `${FAMILY_PILOT_STATE_KEY}:quarantine`

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type FamilyPilotStoreStatus =
  /** Loaded and writable. */
  | 'ready'
  /** Stored state was unreadable; a fresh empty state is in use. */
  | 'recovered'
  /** Stored state came from a newer build; readable state is empty and writes are refused. */
  | 'read-only'
  /** No usable storage at all; the pilot runs in memory for this page only. */
  | 'unavailable'

export type FamilyPilotStoreReasonCode =
  | FamilyPilotSchemaReasonCode
  | 'storage-unavailable'
  | 'storage-write-failed'

export interface FamilyPilotSnapshot {
  readonly status: FamilyPilotStoreStatus
  readonly state: FamilyPilotStateV1
  readonly reasonCode: FamilyPilotStoreReasonCode | null
}

export interface FamilyPilotStoreOptions {
  readonly storage?: StorageLike
  readonly now?: () => string
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    // A privacy mode that throws on property access is "no storage", not a crash.
    return undefined
  }
}

function snapshot(
  status: FamilyPilotStoreStatus,
  state: FamilyPilotStateV1,
  reasonCode: FamilyPilotStoreReasonCode | null,
): FamilyPilotSnapshot {
  return Object.freeze({ status, state, reasonCode })
}

function quarantine(storage: StorageLike, raw: string): void {
  try {
    // The FIRST corruption is the one worth keeping. A later bad write must not
    // overwrite the original evidence with its own already-damaged successor.
    if (storage.getItem(FAMILY_PILOT_QUARANTINE_KEY) !== null) return
    storage.setItem(FAMILY_PILOT_QUARANTINE_KEY, raw.slice(0, 64_000))
  } catch {
    // Losing the quarantine copy must not stop recovery.
  }
}

/**
 * Reads pilot state. Never throws and never rejects the whole document because
 * one record is bad — an unreadable payload becomes a recoverable empty state
 * with the original preserved under the quarantine key.
 */
export function loadFamilyPilotState(options: FamilyPilotStoreOptions = {}): FamilyPilotSnapshot {
  const storage = options.storage ?? browserStorage()
  const now = options.now ?? (() => new Date().toISOString())
  const empty = emptyFamilyPilotState(now())
  if (!storage) return snapshot('unavailable', empty, 'storage-unavailable')

  let raw: string | null
  try {
    raw = storage.getItem(FAMILY_PILOT_STATE_KEY)
  } catch {
    return snapshot('unavailable', empty, 'storage-unavailable')
  }
  if (raw === null) return snapshot('ready', empty, null)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    quarantine(storage, raw)
    return snapshot('recovered', empty, 'schema-unreadable')
  }

  const outcome = upgradeFamilyPilotState(parsed)
  if (outcome.status === 'current') return snapshot('ready', outcome.state, null)
  if (outcome.reasonCode === 'schema-version-ahead') {
    // Refuse to write rather than clobber a schema this build cannot read. The
    // household keeps its data; a newer build still loads it intact.
    return snapshot('read-only', empty, 'schema-version-ahead')
  }
  quarantine(storage, raw)
  return snapshot('recovered', empty, 'schema-unreadable')
}

/** Writes state, verifying the write actually landed. */
export function saveFamilyPilotState(
  state: FamilyPilotStateV1,
  options: FamilyPilotStoreOptions = {},
): FamilyPilotSnapshot {
  const storage = options.storage ?? browserStorage()
  if (!storage) return snapshot('unavailable', state, 'storage-unavailable')
  const serialized = JSON.stringify(state)
  try {
    storage.setItem(FAMILY_PILOT_STATE_KEY, serialized)
    storage.setItem(HEALTH_KEY, 'ready')
  } catch {
    // A full or denied quota leaves the in-memory state usable for this page.
    return snapshot('unavailable', state, 'storage-write-failed')
  }
  // Write-then-read-back, as src/sync/provenance.ts does. A quota-exceeded write
  // that reports success but stores nothing must not be read back as saved work.
  try {
    if (storage.getItem(FAMILY_PILOT_STATE_KEY) !== serialized) {
      return snapshot('unavailable', state, 'storage-write-failed')
    }
  } catch {
    return snapshot('unavailable', state, 'storage-write-failed')
  }
  return snapshot('ready', state, null)
}

/**
 * Clears pilot state, including any quarantined payload. This is the household's
 * explicit "start over" and is the only operation that discards student work.
 */
export function resetFamilyPilotState(options: FamilyPilotStoreOptions = {}): FamilyPilotSnapshot {
  const storage = options.storage ?? browserStorage()
  const now = options.now ?? (() => new Date().toISOString())
  const empty = emptyFamilyPilotState(now())
  if (!storage) return snapshot('unavailable', empty, 'storage-unavailable')
  try {
    storage.removeItem(FAMILY_PILOT_STATE_KEY)
    storage.removeItem(FAMILY_PILOT_QUARANTINE_KEY)
    storage.removeItem(HEALTH_KEY)
  } catch {
    return snapshot('unavailable', empty, 'storage-write-failed')
  }
  return saveFamilyPilotState(empty, options)
}

/**
 * Read-modify-write. A read-only snapshot (state from a newer build) refuses the
 * mutation and reports why, rather than overwriting what it cannot read.
 */
export function updateFamilyPilotState(
  mutate: (state: FamilyPilotStateV1) => FamilyPilotStateV1,
  options: FamilyPilotStoreOptions = {},
): FamilyPilotSnapshot {
  const current = loadFamilyPilotState(options)
  if (current.status === 'read-only') return current
  const now = options.now ?? (() => new Date().toISOString())
  const next = mutate(current.state)
  const stamped = Object.freeze({ ...next, updatedAt: now() })
  const written = saveFamilyPilotState(stamped, options)
  // A recovered read stays visible as recovered even when the write succeeds,
  // so the household is told its history was reset rather than quietly losing it.
  return current.status === 'recovered' && written.status === 'ready'
    ? snapshot('recovered', stamped, current.reasonCode)
    : written
}
