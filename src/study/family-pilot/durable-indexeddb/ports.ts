// FAMILY-PILOT-DURABLE-INDEXEDDB: composition.
//
// The accepted `createFamilyPilotDurableStudyPorts` over the IndexedDB-backed
// seam, plus the one thing the seam cannot do for itself.
//
// The accepted store verifies a write by reading it straight back. Against this
// seam that read-back hits the in-memory mirror, so it proves the page agrees
// with itself and nothing more. The durable transaction is still in flight. So
// every port call here awaits `flush()` before it returns, and a transaction
// that did not land becomes the accepted module's own
// `FamilyPilotDurableStudyStorageError('storage-write-failed')` — the error the
// Family Pilot runtime already maps to "Nothing was recorded".
//
// Reads are wrapped too. Their queue is empty, so the flush is a resolved await,
// and wrapping everything means a later port role cannot be added to the bundle
// and quietly skip the check.

import {
  FamilyPilotDurableStudyStorageError,
  createFamilyPilotDurableStudyPorts,
  type FamilyPilotDurableStudyServices,
} from '../durable-ports'
import type { StudyPortBundle, StudySafetyPort } from '../../ports'
import type { StudyLearnerScope } from '../../types'
import {
  FamilyPilotDurableStorageError,
  openFamilyPilotIndexedDbStudyStorage,
  type FamilyPilotIndexedDbStudyStorage,
  type FamilyPilotIndexedDbStudyStorageOptions,
  type FamilyPilotLegacyMigrationResult,
} from './storage'

export const FAMILY_PILOT_INDEXEDDB_STUDY_PORTS_LABEL =
  'FAMILY PILOT — INDEXEDDB-BACKED DURABLE STUDY PORTS' as const

export interface FamilyPilotIndexedDbStudyPortsOptions extends FamilyPilotIndexedDbStudyStorageOptions {
  /**
   * Required, exactly as the accepted bundle requires it. This module ships no
   * safety classifier and adds no default; changing where the bytes land is not
   * a reason to acquire an opinion about safety.
   */
  readonly safety: StudySafetyPort
  readonly now?: () => Date
}

export interface FamilyPilotIndexedDbStudyPorts {
  readonly label: typeof FAMILY_PILOT_INDEXEDDB_STUDY_PORTS_LABEL
  readonly ports: StudyPortBundle
  readonly services: FamilyPilotDurableStudyServices
  readonly storage: FamilyPilotIndexedDbStudyStorage
  readonly migration: FamilyPilotLegacyMigrationResult
  /** The household's explicit "start this student over", confirmed durable. */
  reset(scope: StudyLearnerScope): Promise<void>
  close(): void
}

async function confirmDurable(storage: FamilyPilotIndexedDbStudyStorage): Promise<void> {
  try {
    await storage.flush()
  } catch (error) {
    if (error instanceof FamilyPilotDurableStorageError) {
      // 'concurrent-write' is the accepted store's own reason code for exactly
      // this: another tab moved first, its work is intact, and this call did
      // nothing. It must not be reported as a device failure.
      throw new FamilyPilotDurableStudyStorageError(
        error.kind === 'concurrent-write' ? 'concurrent-write' : 'storage-write-failed',
        `${error.message} Nothing was recorded.`,
      )
    }
    throw error
  }
}

/**
 * One port call at a time per handle.
 *
 * The accepted store reads the whole document, decides, and writes it back, and
 * against this seam the read is served from a page-local view. Two overlapping
 * calls would therefore both decide against the same starting document, and the
 * second would be reported as saved while its write was dropped. Serializing
 * costs nothing for a runtime that already awaits each step, and it is what
 * makes a refusal always land on the caller whose write was refused.
 */
function callGate(): <T>(call: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve()
  return <T,>(call: () => Promise<T>) => {
    const run = queue.then(call)
    queue = run.catch(() => undefined)
    return run
  }
}

function durabilityConfirmed<T extends object>(
  group: T,
  storage: FamilyPilotIndexedDbStudyStorage,
  gate: ReturnType<typeof callGate>,
): T {
  const confirmed = Object.entries(group).map(([name, member]) => {
    if (typeof member !== 'function') return [name, member] as const
    const call = member as (...args: readonly unknown[]) => Promise<unknown>
    return [
      name,
      async (...args: readonly unknown[]) => gate(async () => {
        const result = await call(...args)
        await confirmDurable(storage)
        return result
      }),
    ] as const
  })
  return Object.freeze(Object.fromEntries(confirmed)) as T
}

/**
 * Opens one student's higher-capacity durable storage and composes the accepted
 * Study port bundle over it.
 *
 * One handle is one student. The storage handle it is built on hydrates and
 * serves only that learner's records, so two students on one device are two
 * handles and cannot address each other's work even by mistake.
 */
export async function createFamilyPilotIndexedDbStudyPorts(
  options: FamilyPilotIndexedDbStudyPortsOptions,
): Promise<FamilyPilotIndexedDbStudyPorts> {
  const storage = await openFamilyPilotIndexedDbStudyStorage(options)
  const gate = callGate()
  const { ports, services } = createFamilyPilotDurableStudyPorts({
    safety: options.safety,
    storage: storage.storage,
    ...(options.now ? { now: options.now } : {}),
  })
  const confirmed: StudyPortBundle = Object.freeze({
    persistence: durabilityConfirmed(ports.persistence, storage, gate),
    checkpoint: durabilityConfirmed(ports.checkpoint, storage, gate),
    reviewQueue: durabilityConfirmed(ports.reviewQueue, storage, gate),
    calendar: durabilityConfirmed(ports.calendar, storage, gate),
    parentSettings: durabilityConfirmed(ports.parentSettings, storage, gate),
    adultPrivate: durabilityConfirmed(ports.adultPrivate, storage, gate),
    eventLedger: durabilityConfirmed(ports.eventLedger, storage, gate),
    outbox: durabilityConfirmed(ports.outbox, storage, gate),
    // Not wrapped: the safety port is the caller's, it writes nothing here, and
    // a durability check has no business standing between a student and a
    // safety decision.
    safety: ports.safety,
  })
  return Object.freeze({
    label: FAMILY_PILOT_INDEXEDDB_STUDY_PORTS_LABEL,
    ports: confirmed,
    // Deliberately unwrapped: `health` is a read and `reset` is exposed on this
    // handle instead, because it is the one operation that discards work and so
    // must be the confirmed-durable one.
    services,
    storage,
    migration: storage.migration,
    async reset(scope: StudyLearnerScope) {
      return gate(async () => {
        services.reset(scope)
        await confirmDurable(storage)
      })
    },
    close() {
      storage.close()
    },
  })
}
