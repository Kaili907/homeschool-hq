// FAMILY-PILOT-DURABLE-INDEXEDDB: the test harness for one household device.
//
// `reload()` is the point of it: every call throws away the runtime, the port
// bundle AND the storage handle, so the in-memory mirror that makes the
// synchronous storage seam possible is rebuilt from the database every time. A
// test that passes through a reload is a test that passed through a cold start.
//
// Test-only. Never imported by the module's own source.

import type { HostLessonDescriptor } from '../../../curriculumAdapter'
import { syntheticGrade5StudyContext } from '../../../demonstrations'
import { StudyLifecycleBoundary } from '../../../lifecycle'
import type { StudySafetyPort } from '../../../ports'
import { SYNTHETIC_NOW } from '../../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext } from '../../../types'
import { FamilyPilotStudyRuntime } from '../../study/FamilyPilotStudyRuntime'
import type { FamilyPilotStudySession } from '../../study/types'
import { createFamilyPilotIndexedDbStudyPorts } from '../ports'
import { createFakeIndexedDb } from './fakeIndexedDb'

export function safetyPort(): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'family-pilot-indexeddb-test-safety-v1',
    evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
  }
}

export interface PilotDeviceOptions {
  /** An accepted-store localStorage device to migrate from, if there is one. */
  readonly legacyStorage?: Pick<Storage, 'getItem'>
  /**
   * A clock that continues where another device left off. Calendar transitions
   * are ordered, so a migrated household cannot be handed a clock that runs
   * before the work it just imported.
   */
  readonly clock?: () => Date
}

export function pilotDevice(options: PilotDeviceOptions = {}) {
  const fake = createFakeIndexedDb()
  let tick = 0
  const now = options.clock ?? (() => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000)))
  const safetyStopValues = new Map<string, string>()
  const safetyStopStorage = {
    getItem: (key: string) => safetyStopValues.get(key) ?? null,
    setItem: (key: string, value: string) => { safetyStopValues.set(key, value) },
  }
  return {
    fake,
    now,
    reload: async (context: HostStudyLaunchContext) => {
      const handle = await createFamilyPilotIndexedDbStudyPorts({
        safety: safetyPort(),
        scope: { householdRef: context.householdRef, learnerRef: context.learnerRef },
        factory: fake.factory,
        storageManager: fake.storageManager,
        now,
        ...(options.legacyStorage ? { legacyStorage: options.legacyStorage } : {}),
      })
      const runtime = new FamilyPilotStudyRuntime({
        ports: handle.ports,
        now,
        lifecycle: new StudyLifecycleBoundary(),
        safetyStopStorage,
      })
      return { runtime, handle }
    },
  }
}

export function studentContext(id: string): HostStudyLaunchContext {
  return { ...syntheticGrade5StudyContext('math'), learnerRef: `learner:pilot-${id}`, hostProfileRef: `pilot-${id}` }
}

export function mathLesson(id: string): HostLessonDescriptor {
  return {
    lessonRef: `pilot:grade5:math:${id}`,
    title: 'Grade 5 math study block',
    kind: 'math',
    skillRefs: ['pilot:grade5:math:multiplication'],
  }
}

/** The handle survives a reload only as JSON, so it is round-tripped as JSON. */
export function storedHandle(session: FamilyPilotStudySession): FamilyPilotStudySession {
  return JSON.parse(JSON.stringify(session)) as FamilyPilotStudySession
}

export async function startMath(
  device: ReturnType<typeof pilotDevice>,
  context: HostStudyLaunchContext,
  id: string,
) {
  const { runtime, handle } = await device.reload(context)
  const started = await runtime.startAssignment({
    context,
    assignment: { kind: 'static-curriculum', lesson: mathLesson(id) },
  })
  if (started.status !== 'ok') throw new Error(`start failed: ${started.reason}`)
  return { runtime, handle, session: started.snapshot.session }
}
