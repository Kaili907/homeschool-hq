import { describe, expect, it } from 'vitest'
import {
  addFamilyPilotAssignment,
  createFamilyPilotStudent,
  loadFamilyPilotState,
  saveFamilyPilotState,
  startFamilyPilotAssignment,
  type FamilyPilotStateV1,
  type FamilyPilotStoreOptions,
} from '../core'
import { familyPilotSessionRef } from '../study'
import { checkStudyEntry, checkTutorEntry } from './safety'
import { FamilyPilotSafetyHoldBridge } from './safetyHolds'

const NOW = '2026-08-12T10:00:00.000Z'

/** One household device's Core storage, seeded so an assignment already has a live sessionRef. */
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

function seedInto(store: FamilyPilotStoreOptions, state: FamilyPilotStateV1, seed: {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly blockRef?: string
}): FamilyPilotStateV1 {
  let next = createFamilyPilotStudent(state, { studentRef: seed.studentRef, displayName: seed.studentRef }, NOW)
  next = addFamilyPilotAssignment(next, seed.studentRef, {
    assignmentRef: seed.assignmentRef,
    lessonRef: `${seed.assignmentRef}:lesson`,
    subject: 'Math',
    title: 'Test lesson',
    totalSegments: 3,
  }, NOW)
  if (seed.blockRef) {
    next = startFamilyPilotAssignment(next, seed.studentRef, seed.assignmentRef, seed.blockRef, NOW)
  }
  return next
}

function seedCoreStore(
  seeds: readonly { readonly studentRef: string; readonly assignmentRef: string; readonly blockRef: string }[],
): FamilyPilotStoreOptions {
  const store: FamilyPilotStoreOptions = { storage: memoryStorage(), now: () => NOW }
  let state = loadFamilyPilotState(store).state
  for (const seed of seeds) state = seedInto(store, state, seed)
  saveFamilyPilotState(state, store)
  return store
}

const STUDENT_A = 'student:a'
const STUDENT_B = 'student:b'
const ASSIGNMENT_1 = 'assignment:1'
const ASSIGNMENT_2 = 'assignment:2'
const BLOCK_1 = 'block:1'
const BLOCK_2 = 'block:2'
const SESSION_1 = familyPilotSessionRef(BLOCK_1)
const SESSION_2 = familyPilotSessionRef(BLOCK_2)

function bridge(coreStore: FamilyPilotStoreOptions, storage = memoryStorage()) {
  return new FamilyPilotSafetyHoldBridge({ coreStore, storage, now: () => NOW })
}

describe('FamilyPilotSafetyHoldBridge', () => {
  it('a Study safety signal creates an open hold that blocks exact entry', () => {
    const coreStore = seedCoreStore([{ studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1, blockRef: BLOCK_1 }])
    const b = bridge(coreStore)

    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 })).toEqual({ allowed: true })

    const hold = b.recordStudySignal({
      studentRef: STUDENT_A,
      sessionRef: SESSION_1,
      classification: 'urgent',
      occurredAt: NOW,
    })
    expect(hold?.status).toBe('open')

    const decision = checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) expect(decision.reasonCode).toBe('study-safety-urgent')
  })

  it('a Tutor concerning-content signal and a Study safety signal share one effective hold authority', () => {
    const coreStore = seedCoreStore([{ studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1, blockRef: BLOCK_1 }])
    const b = bridge(coreStore)

    b.recordTutorSignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, concerning: true, occurredAt: NOW })

    // Blocks BOTH the Study entry gate and the Tutor entry gate — one authority, two doors.
    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 }).allowed).toBe(false)
    expect(checkTutorEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 }).allowed).toBe(false)
  })

  it('a non-concerning Tutor signal and a clear/invalid Study classification create no hold', () => {
    const coreStore = seedCoreStore([{ studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1, blockRef: BLOCK_1 }])
    const b = bridge(coreStore)

    expect(b.recordTutorSignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, concerning: false, occurredAt: NOW })).toBeNull()
    expect(b.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, classification: 'clear', occurredAt: NOW })).toBeNull()
    expect(b.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, classification: 'invalid', occurredAt: NOW })).toBeNull()
    expect(b.openHoldsFor(STUDENT_A)).toHaveLength(0)
  })

  it('a parent can see and resolve the exact open hold, and the exact session may resume', () => {
    const coreStore = seedCoreStore([{ studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1, blockRef: BLOCK_1 }])
    const b = bridge(coreStore)
    const hold = b.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, classification: 'uncertain', occurredAt: NOW })!

    expect(b.openHoldsFor(STUDENT_A)).toHaveLength(1)
    expect(b.openHoldsFor(STUDENT_A)[0]!.holdRef).toBe(hold.holdRef)

    const outcome = b.resolveHold(hold.holdRef, 'family-pilot-parent')
    expect(outcome.ok).toBe(true)
    expect(b.openHoldsFor(STUDENT_A)).toHaveLength(0)
    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 })).toEqual({ allowed: true })
  })

  it('resolving one hold never touches learner B', () => {
    const coreStore = seedCoreStore([
      { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1, blockRef: BLOCK_1 },
      { studentRef: STUDENT_B, assignmentRef: ASSIGNMENT_2, blockRef: BLOCK_2 },
    ])
    const b = bridge(coreStore)
    const holdA = b.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, classification: 'urgent', occurredAt: NOW })!
    b.recordStudySignal({ studentRef: STUDENT_B, sessionRef: SESSION_2, classification: 'urgent', occurredAt: NOW })

    b.resolveHold(holdA.holdRef, 'family-pilot-parent')

    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 }).allowed).toBe(true)
    expect(checkStudyEntry(b.port, { studentRef: STUDENT_B, assignmentRef: ASSIGNMENT_2 }).allowed).toBe(false)
  })

  it('resolving one session never touches another session for the same learner', () => {
    const coreStore = seedCoreStore([
      { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1, blockRef: BLOCK_1 },
      { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_2, blockRef: BLOCK_2 },
    ])
    const b = bridge(coreStore)
    const hold1 = b.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, classification: 'urgent', occurredAt: NOW })!
    b.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_2, classification: 'urgent', occurredAt: NOW })

    b.resolveHold(hold1.holdRef, 'family-pilot-parent')

    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 }).allowed).toBe(true)
    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_2 }).allowed).toBe(false)
  })

  it('a later new hold on the same resolved session blocks again', () => {
    const coreStore = seedCoreStore([{ studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1, blockRef: BLOCK_1 }])
    const b = bridge(coreStore)
    const hold = b.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, classification: 'urgent', occurredAt: NOW })!
    b.resolveHold(hold.holdRef, 'family-pilot-parent')
    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 }).allowed).toBe(true)

    b.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, classification: 'uncertain', occurredAt: '2026-08-12T10:05:00.000Z' })

    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 }).allowed).toBe(false)
  })

  it('resolving an unknown holdRef fails closed and changes nothing', () => {
    const coreStore = seedCoreStore([{ studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1, blockRef: BLOCK_1 }])
    const b = bridge(coreStore)
    b.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, classification: 'urgent', occurredAt: NOW })

    const outcome = b.resolveHold('not-a-real-hold-ref', 'family-pilot-parent')

    expect(outcome.ok).toBe(false)
    expect(b.openHoldsFor(STUDENT_A)).toHaveLength(1)
    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 }).allowed).toBe(false)
  })

  it('open/cleared state survives a reload — a second bridge over the same storage sees it', () => {
    const coreStore = seedCoreStore([{ studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1, blockRef: BLOCK_1 }])
    const storage = memoryStorage()
    const first = bridge(coreStore, storage)
    const hold = first.recordStudySignal({ studentRef: STUDENT_A, sessionRef: SESSION_1, classification: 'urgent', occurredAt: NOW })!

    const reloaded = bridge(coreStore, storage)
    expect(reloaded.openHoldsFor(STUDENT_A)).toHaveLength(1)
    expect(checkStudyEntry(reloaded.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 }).allowed).toBe(false)

    reloaded.resolveHold(hold.holdRef, 'family-pilot-parent')
    const reloadedAgain = bridge(coreStore, storage)
    expect(reloadedAgain.openHoldsFor(STUDENT_A)).toHaveLength(0)
    expect(checkStudyEntry(reloadedAgain.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 }).allowed).toBe(true)
  })

  it('an assignment that has not started yet has no sessionRef to hold, and is allowed', () => {
    const store: FamilyPilotStoreOptions = { storage: memoryStorage(), now: () => NOW }
    const state = seedInto(store, loadFamilyPilotState(store).state, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 })
    saveFamilyPilotState(state, store)

    const b = bridge(store)
    expect(checkStudyEntry(b.port, { studentRef: STUDENT_A, assignmentRef: ASSIGNMENT_1 })).toEqual({ allowed: true })
  })
})
