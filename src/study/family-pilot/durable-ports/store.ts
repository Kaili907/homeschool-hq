// FAMILY-PILOT-DURABLE-PORTS: device-local persistence.
//
// Key naming, the injectable StorageLike seam, the `:health` sidecar and the
// write-then-read-back check all follow src/study/safety/localStopLedger.ts and
// src/study/family-pilot/core/store.ts, which are this repository's established
// device-local stores. Nothing here contacts a network and nothing here reads a
// Node API, so the module is importable in a production browser bundle.
//
// One document per student, not one per household. Two sisters working the same
// lesson are two keys, so a read for one of them cannot reach the other's record
// even if a parse or a scope check were ever to go wrong.
//
// The key is keyed on the LEARNER only, and the household is verified inside the
// document. Putting the household in the key instead would have quietly turned
// the accepted provider's 'Cross-household learner reference rejected.' into two
// divergent documents for one student — the work done under the first household
// would simply stop appearing rather than being refused.
//
// Deliberate divergence from core/store.ts: there is no 'recovered' status here.
// core/store.ts may substitute an empty state for a corrupt one because it backs
// a projection. This document is the Study authority record; substituting an
// empty one would restart finished work and unblock a stopped session. Corrupt
// state becomes 'quarantined' — the payload is preserved, and every port refuses
// to act until the household explicitly resets.

import type { StudyLearnerScope } from '../../types'
import { assertMinimizedForStorage } from './minimization'
import {
  emptyDurableStudyDocument,
  parseDurableStudyDocument,
  type DurableSchemaReasonCode,
  type DurableStudyDocumentV1,
} from './schema'

export const FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX = 'manuel-academy.study.family-pilot-durable-ports.v1'
/**
 * The `:health` sidecar from src/study/safety/localStopLedger.ts, and it is read
 * rather than only written. A device that ran out of room mid-session refuses
 * that write at the time, but the household is usually not looking; the flag is
 * how a later page load can still tell them this device has been dropping work.
 */
const HEALTH_KEY = `${FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX}:health`

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const WRITE_FAILED = 'write-failed' as const

export type FamilyPilotDurableStoreStatus =
  /** Loaded from device storage and writable. */
  | 'ready'
  /** Stored state was corrupt. The payload is preserved; every port refuses. */
  | 'quarantined'
  /**
   * This build must neither read nor write this document, and nothing is
   * destroyed: it was written by a newer build, it belongs to another household,
   * or the read itself failed. Fail closed, leave it exactly as it is.
   */
  | 'read-only'
  /** No device storage at all. Work stays in memory for this page only. */
  | 'unavailable'

export type FamilyPilotDurableStoreReasonCode =
  | DurableSchemaReasonCode
  | 'storage-unavailable'
  | 'storage-write-failed'
  /** Another tab wrote this student's document since it was read here. */
  | 'concurrent-write'
  /**
   * Storage was present and then refused to be read. That is a failure, not an
   * absence: serving an empty document here would offer finished work as new.
   */
  | 'storage-read-failed'
  /**
   * The document this write would produce is one this build could not read back.
   * The write is refused so that the next read is not a quarantined document.
   */
  | 'write-rejected-unreadable'

export interface FamilyPilotDurableStoreSnapshot {
  readonly status: FamilyPilotDurableStoreStatus
  readonly document: DurableStudyDocumentV1
  readonly reasonCode: FamilyPilotDurableStoreReasonCode | null
  /**
   * Exactly what was stored when this snapshot was taken, or null for an absent
   * document. A caller hands it back on write so that a second tab's completed
   * work is never silently overwritten by this tab's older copy.
   */
  readonly raw: string | null
  /**
   * A write to this device failed at some earlier point and has not succeeded
   * since. The document itself is still whatever did land, so Study keeps
   * working; this is what a parent surface shows to explain missing work.
   */
  readonly previousWriteFailed: boolean
}

export interface FamilyPilotDurableStoreOptions {
  readonly storage?: StorageLike
  readonly now?: () => string
}

/**
 * A page without device storage still has to work — a family in a private
 * window must not be locked out of Study. One process-wide map stands in, so a
 * freshly constructed port bundle still sees the same work within that page,
 * and the status reported to the caller stays 'unavailable' throughout.
 */
const pageMemory = new Map<string, string>()
const pageMemoryStorage: StorageLike = {
  getItem: (key) => pageMemory.get(key) ?? null,
  setItem: (key, value) => { pageMemory.set(key, value) },
  removeItem: (key) => { pageMemory.delete(key) },
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    // A privacy mode that throws on property access is "no storage", not a crash.
    return undefined
  }
}

/**
 * Keyed on the learner alone; the household is checked inside the document.
 * The reference is percent-encoded so a learner reference containing the `:`
 * delimiter cannot be made to collide with another student's key.
 */
export function durableStudyDocumentKey(scope: StudyLearnerScope): string {
  return `${FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX}:learner:${encodeURIComponent(scope.learnerRef)}`
}

export function durableStudyQuarantineKey(scope: StudyLearnerScope): string {
  return `${durableStudyDocumentKey(scope)}:quarantine`
}

function snapshot(
  status: FamilyPilotDurableStoreStatus,
  document: DurableStudyDocumentV1,
  reasonCode: FamilyPilotDurableStoreReasonCode | null,
  raw: string | null = null,
  previousWriteFailed = false,
): FamilyPilotDurableStoreSnapshot {
  return Object.freeze({ status, document, reasonCode, raw, previousWriteFailed })
}

function readHealth(storage: StorageLike): boolean {
  try {
    return storage.getItem(HEALTH_KEY) === WRITE_FAILED
  } catch {
    return false
  }
}

function recordHealth(storage: StorageLike, value: typeof WRITE_FAILED | 'ready'): void {
  try {
    storage.setItem(HEALTH_KEY, value)
  } catch {
    // Storage that cannot even hold the flag is already reporting its failure
    // through the refused write itself.
  }
}

function quarantine(storage: StorageLike, scope: StudyLearnerScope, raw: string): void {
  try {
    // The FIRST corruption is the evidence worth keeping; a later bad write must
    // not overwrite it with its own already-damaged successor.
    if (storage.getItem(durableStudyQuarantineKey(scope)) !== null) return
    storage.setItem(durableStudyQuarantineKey(scope), raw.slice(0, 64_000))
  } catch {
    // Losing the quarantine copy must not change the refusal.
  }
}

/**
 * Reads one student's Study document. Never throws. An unreadable payload is
 * reported as 'quarantined' with an empty document attached — the empty document
 * is a placeholder for the caller's types, never a state to run Study against,
 * which is why every port checks the status before it looks at the document.
 */
export function loadDurableStudyDocument(
  scope: StudyLearnerScope,
  options: FamilyPilotDurableStoreOptions = {},
): FamilyPilotDurableStoreSnapshot {
  const provided = options.storage ?? browserStorage()
  const storage = provided ?? pageMemoryStorage
  const durable = provided !== undefined
  const now = options.now ?? (() => new Date().toISOString())
  const empty = emptyDurableStudyDocument(scope, now())
  const missing = durable ? 'ready' : 'unavailable'
  const missingReason = durable ? null : ('storage-unavailable' as const)
  const failed = readHealth(storage)

  let raw: string | null
  try {
    raw = storage.getItem(durableStudyDocumentKey(scope))
  } catch {
    // Storage existed and then refused. `provided` distinguishes that from a
    // device with no storage at all, and only the latter may run in memory.
    return durable
      ? snapshot('read-only', empty, 'storage-read-failed', null, failed)
      : snapshot('unavailable', empty, 'storage-unavailable', null, failed)
  }
  if (raw === null) return snapshot(missing, empty, missingReason, null, failed)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    quarantine(storage, scope, raw)
    return snapshot('quarantined', empty, 'schema-unreadable', raw, failed)
  }

  const outcome = parseDurableStudyDocument(parsed, scope)
  if (outcome.status === 'current') return snapshot(missing, outcome.document, missingReason, raw, failed)
  if (
    outcome.reasonCode === 'schema-version-ahead' ||
    outcome.reasonCode === 'calendar-schema-ahead' ||
    outcome.reasonCode === 'household-binding-mismatch'
  ) {
    // Refuse to read or write rather than reinterpret a schema this build does
    // not know. The household keeps its data; a newer build still loads it.
    return snapshot('read-only', empty, outcome.reasonCode, raw, failed)
  }
  quarantine(storage, scope, raw)
  return snapshot('quarantined', empty, outcome.reasonCode, raw, failed)
}

/**
 * Writes one student's document and verifies the write actually landed. A quota
 * failure that reports success but stores nothing must never be read back later
 * as saved work, so the read-back check is not optional.
 */
export function saveDurableStudyDocument(
  scope: StudyLearnerScope,
  document: DurableStudyDocumentV1,
  options: FamilyPilotDurableStoreOptions & {
    /** The `raw` from the snapshot this write is based on; omit to write unconditionally. */
    readonly expectedRaw?: string | null
  } = {},
): FamilyPilotDurableStoreSnapshot {
  const provided = options.storage ?? browserStorage()
  const storage = provided ?? pageMemoryStorage
  const durable = provided !== undefined
  // The last gate before anything reaches the device.
  assertMinimizedForStorage(document)
  const serialized = JSON.stringify(document)
  // Read-side and write-side cannot be allowed to drift. Anything this build
  // could not parse back is refused HERE, as one failed call, rather than
  // landing and quarantining the student's whole record on the next read. This
  // is what makes "a corrupt record fails the whole document closed" a safe
  // policy instead of a way to lose a household's work to a long reference.
  const readBack = parseDurableStudyDocument(JSON.parse(serialized), scope)
  if (readBack.status !== 'current') {
    return snapshot(durable ? 'ready' : 'unavailable', document, 'write-rejected-unreadable', options.expectedRaw ?? null)
  }
  if (options.expectedRaw !== undefined) {
    let current: string | null
    try {
      current = storage.getItem(durableStudyDocumentKey(scope))
    } catch {
      recordHealth(storage, WRITE_FAILED)
      return snapshot('unavailable', document, 'storage-write-failed', null, true)
    }
    if (current !== options.expectedRaw) {
      // Not a device failure: this tab simply lost the race, and the other tab's
      // work is intact. The health flag stays as it was.
      return snapshot(durable ? 'ready' : 'unavailable', document, 'concurrent-write', current, readHealth(storage))
    }
  }
  try {
    storage.setItem(durableStudyDocumentKey(scope), serialized)
  } catch {
    recordHealth(storage, WRITE_FAILED)
    return snapshot('unavailable', document, 'storage-write-failed', null, true)
  }
  try {
    if (storage.getItem(durableStudyDocumentKey(scope)) !== serialized) {
      recordHealth(storage, WRITE_FAILED)
      return snapshot('unavailable', document, 'storage-write-failed', null, true)
    }
  } catch {
    recordHealth(storage, WRITE_FAILED)
    return snapshot('unavailable', document, 'storage-write-failed', null, true)
  }
  // The write landed and was verified, so any earlier failure is behind us.
  recordHealth(storage, 'ready')
  return durable
    ? snapshot('ready', document, null, serialized)
    : snapshot('unavailable', document, 'storage-unavailable', serialized)
}

/**
 * The household's explicit "start this student over". This is the only
 * operation that discards a student's durable Study work, and it clears the
 * quarantined payload with it.
 */
export function resetDurableStudyDocument(
  scope: StudyLearnerScope,
  options: FamilyPilotDurableStoreOptions = {},
): FamilyPilotDurableStoreSnapshot {
  const provided = options.storage ?? browserStorage()
  const storage = provided ?? pageMemoryStorage
  const now = options.now ?? (() => new Date().toISOString())
  try {
    storage.removeItem(durableStudyDocumentKey(scope))
    storage.removeItem(durableStudyQuarantineKey(scope))
    // HEALTH_KEY is deliberately NOT cleared: it is a fact about this device,
    // not about this student, and a sister's parent surface still needs it.
  } catch {
    return snapshot('unavailable', emptyDurableStudyDocument(scope, now()), 'storage-write-failed')
  }
  return saveDurableStudyDocument(scope, emptyDurableStudyDocument(scope, now()), options)
}

/** Diagnostic read of a preserved corrupt payload. Never used to run Study. */
export function readDurableStudyQuarantine(
  scope: StudyLearnerScope,
  options: FamilyPilotDurableStoreOptions = {},
): string | null {
  const storage = options.storage ?? browserStorage() ?? pageMemoryStorage
  try {
    return storage.getItem(durableStudyQuarantineKey(scope))
  } catch {
    return null
  }
}
