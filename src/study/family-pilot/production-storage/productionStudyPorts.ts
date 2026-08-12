// FAMILY-PILOT-PRODUCTION-STORAGE: the composition, and nothing else.
//
// Four accepted modules already exist and none of them is changed here:
//
//   ../durable-ports        the StudyPortBundle and what a Study document is
//   ../durable-indexeddb    where the bytes land, and the localStorage import
//   ../durable-ports/safetySeam   "can this student's saved record be trusted"
//   ../integration/safety   the Family Pilot Safety Hold seam
//
// What was still missing is the thing that turns them into one deployable
// household: a handle that opens every student on the device at once, keeps
// their records apart, joins the two refusals into a single Study-entry
// decision, and can answer a parent surface's "is this device actually saving
// our work". That is all this file does.
//
// It is NOT a Study Engine, NOT a second port bundle, and it does not touch
// App.tsx. The bundle each student gets is the accepted one, byte for byte, as
// ../durable-indexeddb composed it.
//
// Two rules worth stating because a later convergence will lean on them:
//
//   • One student is one storage handle and one connection. Nothing is shared
//     between students except the database itself, so a bug in this file cannot
//     hand student A the bundle keyed to student B — the key is fixed when the
//     handle is opened, not when a call is made.
//   • Opening throws rather than degrading, exactly as the layer below does. A
//     device with no IndexedDB, or a database a newer build wrote, is the
//     caller's decision to make; quietly falling back would reintroduce the
//     capacity ceiling this whole path exists to remove, invisibly.
//
// Two limitations are inherited rather than fixed here, because both live in the
// accepted store and this module owns no line of it. They are stated so that no
// surface built on this one over-promises, and both are pinned by tests:
//
//   • The device write-health sidecar is ONE record per origin, and each
//     student's handle keeps its own hydrated view of it. A sibling's successful
//     write can therefore clear the evidence that another student's write was
//     dropped. `previousWriteFailed` is a real signal when it is set and is not
//     a guarantee when it is clear.
//   • `services.health()` is read-shaped but not read-only: on a corrupt
//     document the accepted store preserves the payload, which through this seam
//     queues a device write that nothing flushes. It is bounded — the quarantine
//     write lands only if absent — but a health call is not free of side effects.

import type { StudyPortBundle, StudySafetyPort } from '../../ports'
import type { StudyLearnerScope } from '../../types'
import {
  createFamilyPilotIndexedDbStudyPorts,
  type FamilyPilotIndexedDbStudyPorts,
  type FamilyPilotIndexedDbStudyPortsOptions,
  type FamilyPilotDurableStorageFailureKind,
  type FamilyPilotLegacyMigrationResult,
} from '../durable-indexeddb'
import {
  durableStudyRecordDecision,
  type FamilyPilotDurableStoreReasonCode,
  type FamilyPilotDurableStoreStatus,
} from '../durable-ports'
import type { FamilyPilotSafetyPort } from '../integration/safety'
import { createFamilyPilotStudyEntrySafety } from './studyEntrySafety'

export const FAMILY_PILOT_PRODUCTION_STUDY_PORTS_LABEL =
  'FAMILY PILOT — PRODUCTION STUDY PORTS (INDEXEDDB)' as const

export interface FamilyPilotProductionStudyPortsOptions
  extends Omit<FamilyPilotIndexedDbStudyPortsOptions, 'scope'> {
  /**
   * Required, and required by both modules below this one for the same reason:
   * nothing on this path ships a safety classifier of its own. The Family Pilot
   * Safety Hold module owns that decision, in this build and every later one.
   */
  readonly safety: StudySafetyPort
  /** The household these students belong to; the Study scope's first half. */
  readonly householdRef: string
  /**
   * Every student this device will run. They are opened up front so that
   * migration, readiness and the Study-entry guard are known before a child
   * presses Start, rather than discovered part way through a lesson.
   */
  readonly students: readonly string[]
  /**
   * The Family Pilot Safety Hold seam. Absent is "no opinion" and never
   * "denied", which is the rule ../integration/safety already fixed.
   */
  readonly safetyHolds?: FamilyPilotSafetyPort
}

export interface FamilyPilotProductionStudentHealth {
  readonly studentRef: string
  /** This student's work is being saved to this device right now. */
  readonly ready: boolean
  readonly status: FamilyPilotDurableStoreStatus
  readonly reasonCode: FamilyPilotDurableStoreReasonCode | null
  /**
   * A write failed and has not succeeded since, as this student's handle sees it.
   *
   * Read it as "set means a drop really happened", never as "clear means no drop
   * happened". The accepted store keeps one health sidecar per origin and each
   * handle hydrates its own view of it at open time, so: live, the student whose
   * write was refused reports it and a sibling opened before the failure does
   * not; and across a reopen a sibling's successful write in between can have
   * cleared it for everyone. Both are pinned in composition.test.ts.
   */
  readonly previousWriteFailed: boolean
  /** Always false. An adult's private note body is never written to a device. */
  readonly adultPrivateNotesDurable: false
  readonly storageFailureKind: FamilyPilotDurableStorageFailureKind | null
  readonly pendingWrites: number
  readonly migration: FamilyPilotLegacyMigrationResult
}

export interface FamilyPilotProductionStorageHealth {
  readonly label: typeof FAMILY_PILOT_PRODUCTION_STUDY_PORTS_LABEL
  readonly backend: 'indexeddb'
  readonly householdRef: string
  /** Every student on this device is saving work. One is enough to make it false. */
  readonly ready: boolean
  readonly students: readonly FamilyPilotProductionStudentHealth[]
  /** What the platform says, when it says. Null is "this browser would not tell us". */
  readonly usageBytes: number | null
  readonly quotaBytes: number | null
}

export interface FamilyPilotProductionStudent {
  readonly studentRef: string
  readonly scope: StudyLearnerScope
  /** The accepted durable bundle, opened against this student's records only. */
  readonly ports: StudyPortBundle
  readonly migration: FamilyPilotLegacyMigrationResult
  health(): FamilyPilotProductionStudentHealth
  /**
   * The household's explicit "start this student over", confirmed durable AND
   * confirmed to have happened. Throws if the record was left in place — see
   * the implementation for why that is not the same question.
   */
  reset(): Promise<void>
}

export interface FamilyPilotProductionStudyPorts {
  readonly label: typeof FAMILY_PILOT_PRODUCTION_STUDY_PORTS_LABEL
  readonly householdRef: string
  readonly students: readonly string[]
  student(studentRef: string): FamilyPilotProductionStudent
  ports(studentRef: string): StudyPortBundle
  /** Safety Hold and durable-record refusal, joined. See ./studyEntrySafety. */
  readonly studyEntrySafety: FamilyPilotSafetyPort
  health(): Promise<FamilyPilotProductionStorageHealth>
  close(): void
}

function studentHealth(
  studentRef: string,
  handle: FamilyPilotIndexedDbStudyPorts,
): FamilyPilotProductionStudentHealth {
  const record = handle.services.health(handle.storage.scope)
  const device = handle.storage.status()
  return Object.freeze({
    studentRef,
    // Every half has to agree. The record can parse perfectly while the device
    // is refusing every write; a device with room to spare says nothing about a
    // document this build may not read; and a write that failed and has not
    // succeeded since means work is not being saved now, however healthy the
    // other two look. `ready: false` is therefore trustworthy in the direction
    // that matters — it is never optimistic — while `ready: true` inherits the
    // sidecar's blind spot described in the file header.
    ready: record.durable && !record.previousWriteFailed && device.durable,
    status: record.status,
    reasonCode: record.reasonCode,
    previousWriteFailed: record.previousWriteFailed,
    adultPrivateNotesDurable: false,
    storageFailureKind: device.failureKind,
    pendingWrites: device.pendingWrites,
    migration: handle.migration,
  })
}

/**
 * Opens every student's durable Study storage for one household and composes
 * the pilot-level surface over it.
 *
 * Throws if any student cannot be opened, after closing the handles that did
 * open. A half-open household is the state in which a parent surface reports
 * "ready" while one child's work is going nowhere.
 */
export async function createFamilyPilotProductionStudyPorts(
  options: FamilyPilotProductionStudyPortsOptions,
): Promise<FamilyPilotProductionStudyPorts> {
  const { householdRef, students, safetyHolds, ...storageOptions } = options
  if (!householdRef) throw new Error('A household reference is required.')
  if (students.length === 0) throw new Error('At least one student reference is required.')
  const unique = new Set(students)
  if (unique.size !== students.length) {
    // Two handles on one student are two connections, and the second would be
    // refused as a stale tab on its first write. Say so now instead.
    throw new Error('Each student may be opened once per device.')
  }

  const handles = new Map<string, FamilyPilotIndexedDbStudyPorts>()
  let closed = false
  try {
    for (const studentRef of students) {
      if (!studentRef) throw new Error('A student reference is required.')
      handles.set(studentRef, await createFamilyPilotIndexedDbStudyPorts({
        ...storageOptions,
        scope: { householdRef, learnerRef: studentRef },
      }))
    }
  } catch (error) {
    for (const opened of handles.values()) opened.close()
    throw error
  }

  const required = (studentRef: string): FamilyPilotIndexedDbStudyPorts => {
    // Closing drops the connections but not the hydrated views behind them, so
    // a closed household would otherwise keep answering reads and keep
    // reporting itself ready while nothing could be written. Refusing here is
    // what makes "readiness is reportable" survive teardown.
    if (closed) throw new Error('This household’s durable Study storage has been closed.')
    const handle = handles.get(studentRef)
    if (!handle) throw new Error('That student is not open on this device.')
    return handle
  }

  const studyEntrySafety = createFamilyPilotStudyEntrySafety({
    ...(safetyHolds ? { holds: safetyHolds } : {}),
    // A student with no handle has no port bundle either, so there is nothing
    // for this guard to protect and nothing it could honestly say.
    durableRecord: (studentRef) => {
      // Deliberately the raw map and not `required`: this is a safety hook, it
      // must not throw, and a closed household refuses at `ports()` anyway.
      const handle = handles.get(studentRef)
      return handle
        ? durableStudyRecordDecision(handle.services, handle.storage.scope)
        : { allowed: true }
    },
  })

  // Copied once, so a caller mutating its own array afterwards cannot change
  // which students this handle reports on, resets, or closes.
  const roster: readonly string[] = Object.freeze([...students])

  return Object.freeze({
    label: FAMILY_PILOT_PRODUCTION_STUDY_PORTS_LABEL,
    householdRef,
    students: roster,
    student(studentRef: string) {
      const handle = required(studentRef)
      return Object.freeze({
        studentRef,
        scope: handle.storage.scope,
        ports: handle.ports,
        migration: handle.migration,
        health: () => studentHealth(studentRef, handle),
        reset: async () => {
          await handle.reset(handle.storage.scope)
          // A durable write landing is not the same as the record being gone.
          // The accepted store REFUSES to remove a document written by a newer
          // build, or one whose legacy import could not be verified, and returns
          // that refusal as a snapshot rather than throwing — which arrives here
          // as a resolved promise and no queued write. Reporting that as "start
          // this student over: done" would leave a parent with the one blocked
          // child they were trying to unblock, and no way to know. So the
          // postcondition is checked rather than assumed.
          const after = studentHealth(studentRef, handle)
          if (after.status !== 'ready' || after.reasonCode !== null || after.storageFailureKind !== null) {
            throw new Error(
              'Saved Study work for this student could not be cleared from this device ' +
              `(${after.storageFailureKind ?? after.reasonCode ?? after.status}). Nothing was changed.`,
            )
          }
        },
      })
    },
    ports(studentRef: string) {
      return required(studentRef).ports
    },
    studyEntrySafety,
    async health() {
      const perStudent = roster.map((studentRef) => studentHealth(studentRef, required(studentRef)))
      // The estimate is per origin, not per student, so one handle is asked.
      const estimate = await required(roster[0]).storage.estimate()
      return Object.freeze({
        label: FAMILY_PILOT_PRODUCTION_STUDY_PORTS_LABEL,
        backend: 'indexeddb' as const,
        householdRef,
        ready: perStudent.every((student) => student.ready),
        students: Object.freeze(perStudent),
        usageBytes: estimate.usage,
        quotaBytes: estimate.quota,
      })
    },
    close() {
      closed = true
      for (const handle of handles.values()) handle.close()
    },
  })
}
