// FAMILY-PILOT-DURABLE-INDEXEDDB: a higher-capacity backing store for the
// accepted Family Pilot durable Study ports.
//
// The accepted module (src/study/family-pilot/durable-ports) is unchanged and
// stays the authority on what a Study document is, what may reach a device, and
// what happens when a record is corrupt. Its one seam is `StorageLike` — a
// synchronous `getItem`/`setItem`/`removeItem` triple it accepts by injection —
// and that seam is what this file implements. Nothing about the durable-port
// semantics moves here; only where the bytes land.
//
// Why that seam and not a rewrite: the blocker being removed is capacity, not
// correctness. localStorage gives an origin roughly 5 MB, which at the accepted
// module's own measured ~13 KB per completed five-segment lesson is about 400
// completed lessons for a whole household. IndexedDB is quota-managed against
// disk instead, which is the only browser-native store that changes that number
// without a server.
//
// The one real problem this creates: IndexedDB is asynchronous and `StorageLike`
// is not. It is solved by a hydrated view — every key this scope may touch is
// read into memory when the store is opened, reads are served from that view,
// and a write updates the view and queues a durable transaction. That makes the
// synchronous contract honest for reads, and it makes writes optimistic. An
// optimistic write is only acceptable if the household can be told when one did
// not land, so:
//
//   • `flush()` awaits the queued transactions and THROWS on failure, and
//     ports.ts calls it after every mutating port call, so a failed write
//     becomes a refusal at the same call the caller made;
//   • a failed durable write rolls the view back to what is known to be on the
//     device — including back to "unreadable", which is a state, not an absence;
//   • the failure is recorded in the accepted module's own `:health` sidecar, so
//     a later cold load still reports `previousWriteFailed`.
//
// A failure is reported once and then cleared, so a household whose device has
// room again simply carries on. That is only sound because ports.ts runs one
// port call at a time against a handle: the caller that gets the refusal is
// always the caller whose write was refused.
//
// The view can still be stale in one direction: another connection's writes are
// not seen until this handle is reopened. That is handled where it matters — the
// document is written under a compare-and-set precondition inside the
// transaction, so a stale connection is refused rather than allowed to erase the
// other tab's work.
//
// Isolation is stricter here than in the accepted module, not looser. One handle
// serves exactly one student: it may read and write that learner's document, that
// learner's quarantine payload, and the device-wide health flag, and it throws on
// any other key. A composition bug cannot reach a sibling's record through it.

import type { StudyLearnerScope } from '../../types'
import {
  FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX,
  durableStudyDocumentKey,
  durableStudyQuarantineKey,
  parseDurableStudyDocument,
  type StorageLike,
} from '../durable-ports'
import {
  IndexedDbRecordError,
  openIndexedDbRecordStore,
  type IndexedDbRecordStore,
  type IndexedDbRecordStoreOptions,
} from './indexedDbRecords'

/**
 * The accepted module's device health sidecar and the value it writes there.
 * Both are private to that module, so they are restated rather than imported —
 * and pinned by a test that drives a real failed write through the accepted
 * store and asserts this store reports `previousWriteFailed` after a reopen.
 */
const HEALTH_KEY = `${FAMILY_PILOT_DURABLE_PORTS_KEY_PREFIX}:health`
const HEALTH_WRITE_FAILED = 'write-failed'

/**
 * The envelope version, which is independent of the Study document schema
 * version inside it. This one changes if the way a record is wrapped changes;
 * that one changes if the Study document changes. A record wrapped by a newer
 * build is refused for read AND for write, so this build can neither
 * misinterpret it nor overwrite it.
 */
const ENVELOPE_VERSION = 1 as const

export type FamilyPilotDurableStorageFailureKind =
  /** No IndexedDB on this platform. The caller decides what to do instead. */
  | 'storage-unavailable'
  /** The stored database was created by a newer build of this app. */
  | 'database-version-ahead'
  /** A stored record was wrapped by a newer build of this app. */
  | 'record-version-ahead'
  /** A stored record is not a record this build wrote. */
  | 'record-unreadable'
  /** A durable write did not land — quota, a closed connection, a disk error. */
  | 'write-failed'
  /**
   * Another connection — a second tab on the same student — changed this
   * document since this one read it. The other connection's work is intact and
   * this write was refused.
   */
  | 'concurrent-write'
  /**
   * A localStorage record from the accepted store exists and could not be
   * imported and verified. Reads fail closed rather than presenting a student
   * who has a school year of work as a student with none.
   */
  | 'migration-unverified'

export class FamilyPilotDurableStorageError extends Error {
  readonly kind: FamilyPilotDurableStorageFailureKind

  constructor(kind: FamilyPilotDurableStorageFailureKind, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'FamilyPilotDurableStorageError'
    this.kind = kind
  }
}

export interface FamilyPilotLegacyMigrationResult {
  readonly status: 'not-needed' | 'imported' | 'failed'
  /** Which of this student's accepted-store keys were copied in on this open. */
  readonly importedKeys: readonly string[]
  readonly documentBytes: number
  /** Whether the imported document parses as current work for this student. */
  readonly documentReadable: boolean
  /**
   * Always true. The accepted store's records are never removed by this module,
   * on any path, including a verified import and an explicit household reset.
   */
  readonly legacyRetained: true
}

export interface FamilyPilotDurableStorageStatus {
  readonly durable: boolean
  readonly failureKind: FamilyPilotDurableStorageFailureKind | null
  readonly failureMessage: string | null
  readonly pendingWrites: number
}

export interface FamilyPilotIndexedDbStudyStorage {
  readonly scope: StudyLearnerScope
  /** The seam handed to `createFamilyPilotDurableStudyPorts`. */
  readonly storage: StorageLike
  readonly migration: FamilyPilotLegacyMigrationResult
  /**
   * Awaits every queued transaction. Throws if one did not land, and keeps
   * throwing until a new write is started, so every caller sharing the batch is
   * told rather than only the first one to ask.
   */
  flush(): Promise<void>
  status(): FamilyPilotDurableStorageStatus
  /** What the platform says this origin is using and may use, when it says. */
  estimate(): Promise<{ readonly usage: number | null; readonly quota: number | null }>
  close(): void
}

export interface FamilyPilotIndexedDbStudyStorageOptions extends IndexedDbRecordStoreOptions {
  readonly scope: StudyLearnerScope
  /**
   * The accepted store's existing device storage, read once on open so an
   * already-running household keeps its work. Injectable for tests; defaults to
   * this browser's localStorage, and is never written to and never cleared.
   */
  readonly legacyStorage?: Pick<Storage, 'getItem'>
}

interface StoredEnvelope {
  readonly envelopeVersion: number
  readonly key: string
  readonly value: string
}

/**
 * What one key holds. "Unreadable" is a state a key can be IN, not a way of
 * being absent — keeping the two apart in one type is what stops a rolled-back
 * write from turning a corrupt record into an empty one.
 */
type RecordState =
  | { readonly kind: 'value'; readonly value: string }
  | { readonly kind: 'unreadable'; readonly reason: FamilyPilotDurableStorageFailureKind }

function envelope(key: string, value: string): StoredEnvelope {
  return { envelopeVersion: ENVELOPE_VERSION, key, value }
}

/**
 * `key` is carried inside the record and checked on the way out. IndexedDB
 * cannot hand back the wrong row on its own, but this is the last line between a
 * key-derivation mistake anywhere upstream and one sibling reading another's
 * Study work, and it costs one comparison.
 */
function decode(key: string, raw: unknown): RecordState {
  const unreadable = (reason: FamilyPilotDurableStorageFailureKind): RecordState => ({ kind: 'unreadable', reason })
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return unreadable('record-unreadable')
  const stored = raw as Partial<StoredEnvelope>
  if (typeof stored.envelopeVersion !== 'number' || !Number.isSafeInteger(stored.envelopeVersion)) {
    return unreadable('record-unreadable')
  }
  if (stored.envelopeVersion > ENVELOPE_VERSION) return unreadable('record-version-ahead')
  if (stored.envelopeVersion < ENVELOPE_VERSION) return unreadable('record-unreadable')
  if (stored.key !== key || typeof stored.value !== 'string') return unreadable('record-unreadable')
  return { kind: 'value', value: stored.value }
}

/** A record this build must not replace, however the caller asks. */
function writeProtected(state: RecordState | undefined): FamilyPilotDurableStorageFailureKind | null {
  if (state?.kind !== 'unreadable') return null
  return state.reason === 'record-version-ahead' || state.reason === 'migration-unverified' ? state.reason : null
}

function browserLegacyStorage(): Pick<Storage, 'getItem'> | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function documentReadableForScope(raw: string, scope: StudyLearnerScope): boolean {
  try {
    return parseDurableStudyDocument(JSON.parse(raw), scope).status === 'current'
  } catch {
    return false
  }
}

/**
 * Opens one student's higher-capacity durable Study storage.
 *
 * Throws rather than degrading. A caller that lands on a device without
 * IndexedDB, or on a database a newer build wrote, has to decide what to do —
 * quietly falling back to localStorage here would reintroduce the ~400-lesson
 * ceiling this module exists to remove, and do it invisibly.
 */
export async function openFamilyPilotIndexedDbStudyStorage(
  options: FamilyPilotIndexedDbStudyStorageOptions,
): Promise<FamilyPilotIndexedDbStudyStorage> {
  const scope: StudyLearnerScope = {
    householdRef: options.scope.householdRef,
    learnerRef: options.scope.learnerRef,
  }
  if (!scope.householdRef || !scope.learnerRef) {
    throw new Error('Authenticated household and learner references are required.')
  }
  const documentKey = durableStudyDocumentKey(scope)
  const quarantineKey = durableStudyQuarantineKey(scope)
  // The household is deliberately absent from the document key: the accepted
  // store detects a learner bound to a second household by reading the household
  // out of the document itself. Namespacing IndexedDB by household would turn
  // that refusal into an empty document and a silent restart of finished work.
  const allowedKeys: readonly string[] = Object.freeze([documentKey, quarantineKey, HEALTH_KEY])
  /**
   * Written once the accepted store's localStorage records have been imported
   * and verified. Without it, ANY later absence of the document record — most
   * obviously the household's own "start this student over" — would look like a
   * device that had never migrated, and would import the old school year back
   * over the reset.
   */
  const migratedMarkerKey = `${documentKey}:migrated-from-localstorage`

  let connectionClosed = false
  let records: IndexedDbRecordStore
  try {
    records = await openIndexedDbRecordStore({
      ...options,
      // A newer build in another tab is upgrading. The connection is gone from
      // here on; say so rather than reporting a healthy store.
      onClosed: () => { connectionClosed = true },
    })
  } catch (error) {
    if (error instanceof IndexedDbRecordError) {
      throw new FamilyPilotDurableStorageError(
        error.kind === 'database-version-ahead' ? 'database-version-ahead' : 'storage-unavailable',
        error.message,
        error,
      )
    }
    throw error
  }

  /** What is known to be on the device, and what this page currently believes. */
  const device = new Map<string, RecordState>()
  const view = new Map<string, RecordState>()

  let hydrated: ReadonlyMap<string, unknown>
  try {
    hydrated = await records.read([...allowedKeys, migratedMarkerKey])
  } catch (error) {
    records.close()
    throw new FamilyPilotDurableStorageError(
      'storage-unavailable',
      error instanceof Error ? error.message : 'Saved Study work could not be read from this device.',
      error,
    )
  }
  for (const key of allowedKeys) {
    if (!hydrated.has(key)) continue
    device.set(key, decode(key, hydrated.get(key)))
  }
  const alreadyMigrated = hydrated.has(migratedMarkerKey)

  let chain: Promise<void> = Promise.resolve()
  let pending = 0
  let failure: { kind: FamilyPilotDurableStorageFailureKind; message: string } | null = null

  function restoreView(key?: string): void {
    const keys = key === undefined ? allowedKeys : [key]
    for (const restoring of keys) {
      const known = device.get(restoring)
      if (known) view.set(restoring, known)
      else view.delete(restoring)
    }
  }

  /**
   * The accepted store detects a second tab by re-reading the device before it
   * writes. Against this seam that read hits this connection's own view, so the
   * check has to move down here: the document is written only if what is on the
   * device is still what this connection last saw. Without it the last tab to
   * write would silently erase the other's work.
   *
   * The quarantine payload gets a weaker rule — write only if absent — which is
   * the accepted store's own "the FIRST corruption is the evidence worth
   * keeping", made to hold across connections. The health flag gets none: it is
   * a device-wide fact any connection may set.
   */
  function preconditionFor(key: string): ((current: unknown) => boolean) | undefined {
    if (key === quarantineKey) return (current) => current === undefined
    if (key !== documentKey) return undefined
    const expected = device.get(key)
    return (current) => {
      if (current === undefined) return expected === undefined
      const stored = decode(key, current)
      if (!expected) return false
      return expected.kind === 'value'
        ? stored.kind === 'value' && stored.value === expected.value
        : stored.kind === 'unreadable'
    }
  }

  /** After a conflict, catch up to what the other connection actually wrote. */
  async function rehydrate(key: string): Promise<void> {
    try {
      const read = await records.read([key])
      if (read.has(key)) device.set(key, decode(key, read.get(key)))
      else device.delete(key)
    } catch {
      // A device that will not answer a read is already failing this write.
    }
  }

  function enqueue(key: string, value: string | null): void {
    pending += 1
    chain = chain.then(async () => {
      // Once a write in this batch has failed, nothing further lands until the
      // failure has been reported. Otherwise the accepted store's own
      // `health: ready` write, queued immediately after a refused document
      // write, would land and erase the evidence of the refusal.
      if (failure) {
        pending -= 1
        return
      }
      try {
        if (value === null) {
          await records.remove(key)
          device.delete(key)
        } else {
          await records.write(key, envelope(key, value), preconditionFor(key))
          device.set(key, { kind: 'value', value })
        }
      } catch (error) {
        const conflicted = error instanceof IndexedDbRecordError && error.kind === 'conflict'
        if (conflicted) await rehydrate(key)
        // Only the document is Study work. The health flag and the preserved
        // corrupt payload are diagnostics the accepted store itself writes
        // best-effort, and failing a student's completed step because a
        // one-word flag would not fit is the wrong answer.
        if (key === documentKey) {
          failure = {
            kind: conflicted ? 'concurrent-write' : 'write-failed',
            message: error instanceof Error ? error.message : 'Study work could not be saved to this device.',
          }
          restoreView()
        } else {
          restoreView(key)
        }
      } finally {
        pending -= 1
      }
    })
  }

  async function recordHealthFailure(): Promise<void> {
    view.set(HEALTH_KEY, { kind: 'value', value: HEALTH_WRITE_FAILED })
    try {
      await records.write(HEALTH_KEY, envelope(HEALTH_KEY, HEALTH_WRITE_FAILED))
      device.set(HEALTH_KEY, { kind: 'value', value: HEALTH_WRITE_FAILED })
    } catch {
      // A device that will not hold the flag is already reporting its failure
      // through the refusal this call is about to throw.
    }
  }

  /**
   * Copies this student's accepted-store localStorage records in on first open
   * and verifies each one by reading it back out of IndexedDB. The originals are
   * left exactly where they are: a verified import is still not a reason to
   * destroy the only other copy of a household's school year.
   */
  async function importLegacyRecords(): Promise<FamilyPilotLegacyMigrationResult> {
    const legacy = options.legacyStorage ?? browserLegacyStorage()
    const notNeeded: FamilyPilotLegacyMigrationResult = {
      status: 'not-needed',
      importedKeys: [],
      documentBytes: 0,
      documentReadable: false,
      legacyRetained: true,
    }
    if (!legacy || alreadyMigrated) return notNeeded

    const candidates: [string, string][] = []
    for (const key of allowedKeys) {
      // Present in IndexedDB — in any state, including unreadable — means this
      // device has already moved on. Importing over it would resurrect work the
      // household has since replaced.
      if (device.has(key)) continue
      let value: string | null
      try {
        value = legacy.getItem(key)
      } catch {
        value = null
      }
      if (value !== null) candidates.push([key, value])
    }

    const imported: string[] = []
    let documentImported = false
    for (const [key, value] of candidates) {
      try {
        // Only if still absent: a second connection opening at the same moment
        // must not have this one's stale legacy copy written over its work.
        await records.write(key, envelope(key, value), (current) => current === undefined)
        const readBack = decode(key, (await records.read([key])).get(key))
        if (readBack.kind !== 'value' || readBack.value !== value) {
          throw new Error('Imported record did not read back.')
        }
        device.set(key, readBack)
        imported.push(key)
        if (key === documentKey) documentImported = true
      } catch {
        // Only the document blocks Study. A quarantine payload or a device flag
        // that failed to copy is a lost diagnostic, not a lost school year.
        if (key === documentKey) {
          device.set(key, { kind: 'unreadable', reason: 'migration-unverified' })
        }
      }
    }

    const documentValue = candidates.find(([key]) => key === documentKey)?.[1]
    const failed = documentValue !== undefined && !documentImported
    if (!failed) {
      try {
        await records.write(migratedMarkerKey, envelope(migratedMarkerKey, new Date(0).toISOString()))
      } catch {
        // Without the marker the next open falls back to "is the document
        // present", which is the weaker guard but still not destructive.
      }
    }
    if (candidates.length === 0) return notNeeded
    return {
      status: failed ? 'failed' : 'imported',
      importedKeys: Object.freeze(imported),
      documentBytes: documentValue?.length ?? 0,
      documentReadable: documentValue !== undefined && documentReadableForScope(documentValue, scope),
      legacyRetained: true,
    }
  }

  function assertAllowed(key: string): void {
    if (!allowedKeys.includes(key)) {
      throw new Error('Durable Study storage was addressed outside this student’s scope.')
    }
  }

  const storage: StorageLike = {
    getItem(key) {
      assertAllowed(key)
      const state = view.get(key)
      if (state === undefined) return null
      // Throwing is what the accepted store reads as 'storage-read-failed', and
      // it is the honest answer: something is stored here and this build must not
      // present it, or its absence, as this student having no work.
      if (state.kind === 'unreadable') {
        throw new FamilyPilotDurableStorageError(state.reason, 'Saved Study work could not be read from this device.')
      }
      return state.value
    },
    setItem(key, value) {
      assertAllowed(key)
      const protectedBy = writeProtected(view.get(key))
      if (protectedBy) throw refusalFor(protectedBy, 'replaced')
      view.set(key, { kind: 'value', value })
      enqueue(key, value)
    },
    removeItem(key) {
      assertAllowed(key)
      const protectedBy = writeProtected(view.get(key))
      if (protectedBy) throw refusalFor(protectedBy, 'removed')
      view.delete(key)
      enqueue(key, null)
    },
  }

  restoreView()
  const migration = await importLegacyRecords()
  restoreView()

  return {
    scope,
    storage,
    migration,
    async flush() {
      await chain
      if (!failure) return
      const reported = failure
      // Inside the chain, so a write queued while this is in flight is ordered
      // after it and cannot land 'ready' over the failure being recorded.
      chain = chain.then(() => recordHealthFailure())
      await chain
      // Reported once and cleared, so the household can carry on the moment the
      // device will take a write again. ports.ts runs one port call at a time
      // against this handle, which is what makes "reported once" mean "reported
      // to the caller who caused it".
      failure = null
      throw new FamilyPilotDurableStorageError(reported.kind, reported.message)
    },
    status() {
      const document = view.get(documentKey)
      const blocked = document?.kind === 'unreadable' ? document.reason : null
      return Object.freeze({
        durable: failure === null && blocked === null && !connectionClosed,
        failureKind: failure?.kind ?? blocked ?? (connectionClosed ? 'storage-unavailable' : null),
        failureMessage: failure?.message ?? null,
        pendingWrites: pending,
      })
    },
    estimate() {
      return records.estimate()
    },
    close() {
      records.close()
    },
  }
}

function refusalFor(
  kind: FamilyPilotDurableStorageFailureKind,
  action: 'replaced' | 'removed',
): FamilyPilotDurableStorageError {
  return kind === 'record-version-ahead'
    ? new FamilyPilotDurableStorageError(
        kind,
        `Saved Study work was written by a newer version of this app and was not ${action}.`,
      )
    : new FamilyPilotDurableStorageError(
        kind,
        `Existing saved Study work could not be moved to this device’s new storage, so nothing was ${action}.`,
      )
}
