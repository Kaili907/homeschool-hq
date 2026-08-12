// FAMILY-PILOT-PRODUCTION-STORAGE: one household device, for tests.
//
// `reopen()` is the point of it. It throws away every runtime, every port
// bundle and every storage handle in the household, so the in-memory mirror
// that makes the synchronous storage seam possible is rebuilt from the database
// for every student. A test that passes through a reopen is a test that passed
// through a cold start of the whole composition, not of one student's handle.
//
// The accepted module's own test kit is reused for the pieces that are not
// specific to this layer — the safety classifier, the launch context, the
// lesson. Restating them here would create a second definition of "a pilot
// student" that could drift from the one the layer below is tested against.
//
// Test-only. Never imported by this module's own source.

import { StudyLifecycleBoundary } from '../../../lifecycle'
import type { HostStudyLaunchContext } from '../../../types'
import { createFakeIndexedDb } from '../../durable-indexeddb/testing/fakeIndexedDb'
import { mathLesson, safetyPort, studentContext } from '../../durable-indexeddb/testing/pilotDevice'
import type { FamilyPilotSafetyPort } from '../../integration/safety'
import { FamilyPilotStudyRuntime } from '../../study/FamilyPilotStudyRuntime'
import { createFamilyPilotProductionStudyPorts } from '../productionStudyPorts'

export { mathLesson, storedHandle, studentContext } from '../../durable-indexeddb/testing/pilotDevice'

export const HOUSEHOLD = studentContext('probe').householdRef

/** Every student in these tests is `studentContext(id)`, so the ref is derived. */
export function studentRefOf(id: string): string {
  return studentContext(id).learnerRef
}

export interface HouseholdDeviceOptions {
  /** An accepted-store localStorage device to migrate from, if there is one. */
  readonly legacyStorage?: Pick<Storage, 'getItem'>
  /** A clock that continues where another device left off. */
  readonly clock?: () => Date
  /** The Family Pilot Safety Hold seam, when a test is exercising one. */
  readonly holds?: FamilyPilotSafetyPort
}

export function householdDevice(options: HouseholdDeviceOptions = {}) {
  const fake = createFakeIndexedDb()
  let tick = 0
  const now = options.clock ?? (() => new Date(Date.UTC(2026, 7, 1, 13, 0, 0) + (tick += 1000)))
  const safetyStopValues = new Map<string, string>()
  const safetyStopStorage = {
    getItem: (key: string) => safetyStopValues.get(key) ?? null,
    setItem: (key: string, value: string) => { safetyStopValues.set(key, value) },
  }
  return {
    fake,
    now,
    /** A cold start of the whole household: new connections, new mirrors. */
    reopen: async (students: readonly string[]) => {
      const handle = await createFamilyPilotProductionStudyPorts({
        householdRef: HOUSEHOLD,
        students,
        safety: safetyPort(),
        factory: fake.factory,
        storageManager: fake.storageManager,
        now,
        ...(options.holds ? { safetyHolds: options.holds } : {}),
        ...(options.legacyStorage ? { legacyStorage: options.legacyStorage } : {}),
      })
      const runtimes = new Map(students.map((studentRef) => [
        studentRef,
        new FamilyPilotStudyRuntime({
          ports: handle.ports(studentRef),
          now,
          lifecycle: new StudyLifecycleBoundary(),
          safetyStopStorage,
        }),
      ]))
      const runtime = (studentRef: string): FamilyPilotStudyRuntime => {
        const found = runtimes.get(studentRef)
        if (!found) throw new Error(`no runtime for ${studentRef}`)
        return found
      }
      return { handle, runtime }
    },
  }
}

export async function startMath(
  runtime: FamilyPilotStudyRuntime,
  context: HostStudyLaunchContext,
  lessonId: string,
) {
  const started = await runtime.startAssignment({
    context,
    assignment: { kind: 'static-curriculum', lesson: mathLesson(lessonId) },
  })
  if (started.status !== 'ok') throw new Error(`start failed: ${started.reason}`)
  return started.snapshot.session
}
