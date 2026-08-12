import { findFamilyPilotStudent, loadFamilyPilotState, type FamilyPilotStoreOptions } from '../core'
import { familyPilotSessionRef } from '../study'
import {
  canStudentResume,
  clearSafetyHold,
  createInitialSafetyState,
  createSafetyHold,
  listOpenSafetyHolds,
  parseSafetyStateJsonWithRecovery,
  safetyHoldInputFromStudySafetyClassification,
  safetyHoldInputFromTutorConcerningSignal,
  serializeSafetyState,
  type FamilyPilotSafetyStateV1,
  type SafetyHoldV1,
  type StudySafetyClassificationSignalV1,
  type TutorConcerningContentSignalV1,
} from '../safety'
import type { FamilyPilotSafetyDecision, FamilyPilotSafetyPort } from './safety'

// FAMILY-PILOT-INTEGRATION: wires the Family Pilot safety-hold store (built on
// its own branch, mac/family-pilot-safety-r1) into convergence C1's
// FamilyPilotSafetyPort seam.
//
// This is deliberately a SEPARATE, additive concern from
// src/study/safety/localStopLedger.ts. That ledger's isSessionStoppedByLocalLedger
// is permanent by design ("a stop is a stop... narrowing this would let a
// flagged learner back in by refreshing" — see its own doc comment) and this
// module never reads, writes, or reinterprets it. A Family Pilot safety hold
// is a narrower, parent-resolvable pause layered in FRONT of Study/Tutor
// entry: it can block a student from starting or resuming a session, and an
// explicit parent action can lift that block for that exact session — but it
// has no power over, and no visibility into, the permanent ledger's own
// stop. The two can both be active on the same session at once; clearing one
// never clears the other.

export const FAMILY_PILOT_SAFETY_HOLDS_KEY = 'manuel-academy.study.family-pilot-safety-holds.v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export interface FamilyPilotSafetyHoldBridgeOptions {
  /** The SAME store the Family Pilot Core session uses, so assignmentRef -> sessionRef resolution sees live data. */
  readonly coreStore?: FamilyPilotStoreOptions
  readonly storage?: StorageLike
  readonly now?: () => string
}

export interface FamilyPilotResolveHoldOutcome {
  readonly ok: boolean
  readonly message: string
  readonly hold?: SafetyHoldV1
}

/**
 * The narrow surface the controller needs to record a signal without
 * depending on the concrete bridge class — a FamilyPilotSafetyHoldBridge
 * satisfies this structurally.
 */
export interface FamilyPilotSafetySignalSink {
  readonly recordStudySignal: (signal: StudySafetyClassificationSignalV1) => void
  readonly recordTutorSignal: (signal: TutorConcerningContentSignalV1) => void
}

const BLOCKED_MESSAGE = 'This needs an adult to look at before continuing. Please go get a parent.'

/**
 * Owns the Family Pilot safety-hold state (device-local, storage-agnostic
 * persistence via safety/persistence.ts) and exposes:
 *  - `port`: the read-only FamilyPilotSafetyPort consulted before Study/Tutor entry.
 *  - `recordStudySignal` / `recordTutorSignal`: where a hold gets created.
 *  - `openHoldsFor` / `resolveHold`: what the Parent surface uses to see and
 *    resolve an exact hold.
 *
 * There is exactly one FamilyPilotSafetyStateV1 here — no parallel store. All
 * five entry points (create from Study, create from Tutor, decide entry,
 * list for a parent, resolve) read and write the same in-memory state, which
 * is persisted after every mutation.
 */
export class FamilyPilotSafetyHoldBridge {
  readonly #storage: StorageLike | undefined
  readonly #coreStore: FamilyPilotStoreOptions
  readonly #now: () => string
  #state: FamilyPilotSafetyStateV1

  constructor(options: FamilyPilotSafetyHoldBridgeOptions = {}) {
    this.#storage = options.storage ?? browserStorage()
    this.#coreStore = options.coreStore ?? {}
    this.#now = options.now ?? (() => new Date().toISOString())
    this.#state = this.#load()
  }

  #load(): FamilyPilotSafetyStateV1 {
    if (!this.#storage) return createInitialSafetyState()
    try {
      return parseSafetyStateJsonWithRecovery(this.#storage.getItem(FAMILY_PILOT_SAFETY_HOLDS_KEY)).state
    } catch {
      return createInitialSafetyState()
    }
  }

  #save(): void {
    try {
      this.#storage?.setItem(FAMILY_PILOT_SAFETY_HOLDS_KEY, serializeSafetyState(this.#state))
    } catch {
      // Best-effort, matching every other device-local store in this repo: a
      // failed write leaves the in-memory state (this process's decisions)
      // correct for this page; a reload may lose only the very latest write.
    }
  }

  /** Core's persisted blockRef for this assignment, projected to the Study runtime's own sessionRef shape. */
  #sessionRefFor(studentRef: string, assignmentRef: string): string | null {
    const snapshot = loadFamilyPilotState(this.#coreStore)
    const student = findFamilyPilotStudent(snapshot.state, studentRef)
    const record = student?.assignments.find((item) => item.assignmentRef === assignmentRef)
    if (!record || record.sessionRef === null) return null
    return familyPilotSessionRef(record.sessionRef)
  }

  #decide(input: { readonly studentRef: string; readonly assignmentRef: string }): FamilyPilotSafetyDecision {
    const sessionRef = this.#sessionRefFor(input.studentRef, input.assignmentRef)
    // Nothing has started yet for this assignment, so there is no session a
    // hold could be keyed on: no opinion, not a refusal.
    if (!sessionRef) return { allowed: true }
    if (canStudentResume(this.#state, input.studentRef, sessionRef)) return { allowed: true }
    const blocking = listOpenSafetyHolds(this.#state, input.studentRef)
      .filter((hold) => hold.sessionRef === sessionRef)
    const reasonCode = blocking[0]?.reasonCode ?? 'family-pilot-safety-hold'
    return { allowed: false, reasonCode, studentMessage: BLOCKED_MESSAGE }
  }

  readonly port: FamilyPilotSafetyPort = Object.freeze({
    checkStudyEntry: (input: { readonly studentRef: string; readonly assignmentRef: string }) => this.#decide(input),
    checkTutorEntry: (input: { readonly studentRef: string; readonly assignmentRef: string }) => this.#decide(input),
  })

  /** Fired from the Study runtime's own non-clear classification. 'invalid' and 'clear' create no hold — see studySafetySignal.ts. */
  recordStudySignal(signal: StudySafetyClassificationSignalV1): SafetyHoldV1 | null {
    const input = safetyHoldInputFromStudySafetyClassification(signal)
    if (!input) return null
    const { state, hold } = createSafetyHold(this.#state, input)
    this.#state = state
    this.#save()
    return hold
  }

  /** Fired from the Tutor bridge's own isConcerning() signal. A non-concerning signal creates no hold. */
  recordTutorSignal(signal: TutorConcerningContentSignalV1): SafetyHoldV1 | null {
    const input = safetyHoldInputFromTutorConcerningSignal(signal)
    if (!input) return null
    const { state, hold } = createSafetyHold(this.#state, input)
    this.#state = state
    this.#save()
    return hold
  }

  /** Every still-open hold for one student, oldest first — what the Parent surface lists. */
  openHoldsFor(studentRef: string): readonly SafetyHoldV1[] {
    return listOpenSafetyHolds(this.#state, studentRef)
  }

  /**
   * The only way a hold stops blocking resume. Scoped to the exact holdRef a
   * parent chose — never "clear all" for a student. Fails closed: an unknown
   * or already-foreign holdRef changes nothing and reports failure rather
   * than silently succeeding.
   */
  resolveHold(holdRef: string, clearedBy: string): FamilyPilotResolveHoldOutcome {
    const existing = this.#state.holds.find((hold) => hold.holdRef === holdRef)
    if (!existing) return { ok: false, message: 'That hold could not be found. Nothing was changed.' }
    try {
      this.#state = clearSafetyHold(this.#state, holdRef, { clearedAt: this.#now(), clearedBy })
    } catch {
      return { ok: false, message: 'That hold could not be resolved. Nothing was changed.' }
    }
    this.#save()
    const hold = this.#state.holds.find((item) => item.holdRef === holdRef)
    return { ok: true, message: 'Resolved. This learner may resume.', hold }
  }
}
