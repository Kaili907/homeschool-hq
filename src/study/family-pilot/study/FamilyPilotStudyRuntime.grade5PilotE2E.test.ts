import { describe, expect, it } from 'vitest'
import { getNextLesson, getPilotAssignments } from '../../../curriculum/family-pilot/catalog'
import { FAMILY_PILOT_STATIC_CONFIG, resolveFamilyPilotUnit } from '../../../curriculum/family-pilot/pilot-config'
import { loadFamilyPilotCatalog } from '../../../curriculum/family-pilot/source.node'
import type { PilotLessonRef } from '../../../curriculum/family-pilot/types'
import { syntheticGrade5StudyContext } from '../../demonstrations'
import type { HostLessonDescriptor } from '../../curriculumAdapter'
import { StudyLifecycleBoundary } from '../../lifecycle'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../../ports'
import { SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext } from '../../types'
import { FamilyPilotStudyRuntime } from './FamilyPilotStudyRuntime'
import type { FamilyPilotStudySession } from './types'

/**
 * Proves FamilyPilotStudyRuntime itself — not a mock of it — can carry the
 * one configured Grade 5 Math pilot unit (FAMILY_PILOT_STATIC_CONFIG) through
 * a full local-device lifecycle, using the real curriculum catalog and the
 * existing local/test Study ports. No production route or hosted dependency
 * is touched: createLocalDevelopmentStudyPorts is an in-memory port bundle,
 * and loadFamilyPilotCatalog reads the frozen curriculum-content fixture
 * straight off disk.
 */

const catalog = loadFamilyPilotCatalog()
const unit = resolveFamilyPilotUnit(catalog)
// getPilotAssignments is the same query a host uses to hand a student their
// course in completion order; filtering to this unit is how it "receives"
// the Unit 1 assignment specifically.
const unitLessonsInOrder = getPilotAssignments(catalog, {
  studentRef: 'family-pilot-runtime-e2e',
  grade: FAMILY_PILOT_STATIC_CONFIG.grade,
}).filter((lesson) => lesson.unitId === unit.unitId)
const firstLesson = unitLessonsInOrder[0]

function safetyPort(outcome: 'clear' | 'urgent' = 'clear'): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'family-pilot-runtime-e2e-safety-v1',
    evaluate: async () => outcome === 'clear'
      ? { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
      : { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' },
  }
}

/** One household device: a single durable store plus a `reload()` that builds a
 * brand-new runtime over it, which is exactly what a browser refresh does. */
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

function pilotDevice(options: { readonly safety?: 'clear' | 'urgent' } = {}) {
  let tick = 0
  const now = () => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000))
  const { ports: localPorts, services } = createLocalDevelopmentStudyPorts({ now })
  const ports: StudyPortBundle = { ...localPorts, safety: safetyPort(options.safety ?? 'clear') }
  const lifecycle = new StudyLifecycleBoundary()
  const safetyStopStorage = memoryStorage()
  return {
    ports,
    services,
    lifecycle,
    safetyStopStorage,
    reload: () => new FamilyPilotStudyRuntime({ ports, now, lifecycle, safetyStopStorage }),
  }
}

function pilotLearnerContext(id: string): HostStudyLaunchContext {
  return {
    ...syntheticGrade5StudyContext('math'),
    householdRef: 'household:pilot-grade5-runtime-e2e',
    learnerRef: `learner:pilot-grade5-runtime-e2e-${id}`,
    hostProfileRef: `pilot-grade5-runtime-e2e-${id}`,
  }
}

/** Real catalog lessons carry no skillRefs of their own (only refs and
 * display metadata); a stable ref derived from the real lessonId keeps the
 * descriptor opaque without inventing curriculum content. */
function pilotLessonDescriptor(lesson: PilotLessonRef): HostLessonDescriptor {
  return {
    lessonRef: lesson.lessonId,
    title: lesson.title,
    kind: 'math',
    skillRefs: [`${lesson.lessonId}:skill`],
  }
}

/** The handle survives a reload only as JSON, so it is round-tripped as JSON. */
function storedHandle(session: FamilyPilotStudySession): FamilyPilotStudySession {
  return JSON.parse(JSON.stringify(session)) as FamilyPilotStudySession
}

async function startPilotLesson(
  device: ReturnType<typeof pilotDevice>,
  context: HostStudyLaunchContext,
  lesson: PilotLessonRef,
) {
  const runtime = device.reload()
  const started = await runtime.startAssignment({
    context,
    assignment: { kind: 'static-curriculum', lesson: pilotLessonDescriptor(lesson) },
  })
  if (started.status !== 'ok') throw new Error(`start failed: ${started.reason}`)
  return { runtime, snapshot: started.snapshot, session: started.snapshot.session }
}

describe('Family Pilot Grade 5 Math runtime E2E — real config, catalog, ports', () => {
  it('resolves the one configured Grade 5 Math Unit 1 pilot assignment from the real catalog', () => {
    expect(FAMILY_PILOT_STATIC_CONFIG.grade).toBe('5')
    expect(FAMILY_PILOT_STATIC_CONFIG.courseId).toBe('ma-g5-mathematics')
    expect(unit.unitNumber).toBe(1)
    expect(unitLessonsInOrder.length).toBeGreaterThan(1)
    expect(firstLesson.courseDay).toBe(1)
    expect(firstLesson.unitId).toBe(unit.unitId)
  })

  it('learner A: receives, starts, checkpoints, pauses, resumes, retains the checkpoint, and advances', async () => {
    const device = pilotDevice()
    const context = pilotLearnerContext('learner-a')

    // 1 + 2: receive the Unit 1 assignment (its first lesson) and start it.
    const { runtime, snapshot: started, session } = await startPilotLesson(device, context, firstLesson)

    // 3: obtain the first lesson/content reference. Content bodies stay out
    // of the runtime by design; the reference is the lesson and segment ref.
    expect(started.lessonRef).toBe(firstLesson.lessonId)
    expect(started.segmentRef).not.toBeNull()
    expect(started.segmentOrdinal).toBe(1)
    expect(started.tutorBridgeAvailable).toBe(true)
    expect(started.masteryAuthority).toBe('tutor-core')

    // 4: progress and checkpoint.
    const action = await runtime.submitStudyAction({ context, session, transientLearnerText: 'ready' })
    expect(action.status).toBe('accepted')
    const advanced = await runtime.completeSegment({ context, session })
    if (advanced.status !== 'ok') throw new Error(advanced.reason)
    const checkpointed = await runtime.checkpoint({ context, session })
    if (checkpointed.status !== 'ok') throw new Error(checkpointed.reason)
    expect(checkpointed.snapshot.segmentOrdinal).toBe(2)
    expect(checkpointed.snapshot.checkpointRevision).toBe(1)

    // 5: pause. Pausing itself saves a fresh checkpoint (revision 2), so
    // that — not the earlier manual checkpoint — is what a reload must retain.
    const paused = await runtime.pause({ context, session })
    if (paused.status !== 'ok') throw new Error(paused.reason)
    expect(paused.snapshot.assignmentState).toBe('paused')
    expect(paused.snapshot.checkpointRevision).toBe(2)

    // 6 + 7: resume after a reload, on the same durable store, and retain
    // the exact checkpoint position.
    const reloaded = device.reload()
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('paused')
    expect(afterReload.snapshot.segmentRef).toBe(paused.snapshot.segmentRef)
    expect(afterReload.snapshot.checkpointRef).toBe(paused.snapshot.checkpointRef)
    expect(afterReload.snapshot.checkpointRevision).toBe(2)

    const resumed = await reloaded.resume({ context, session })
    if (resumed.status !== 'ok') throw new Error(resumed.reason)
    expect(resumed.snapshot.assignmentState).toBe('active')

    // 8: advance according to the existing runtime contract.
    const advancedAgain = await reloaded.completeSegment({ context, session })
    if (advancedAgain.status !== 'ok') throw new Error(advancedAgain.reason)
    expect(advancedAgain.snapshot.segmentOrdinal).toBe(3)
    expect(advancedAgain.snapshot.completedSegmentRefs).toHaveLength(2)
  })

  it('chains from Unit 1 lesson 1 into lesson 2 once lesson 1 is complete, via the existing catalog + runtime contract', async () => {
    const device = pilotDevice()
    const context = pilotLearnerContext('learner-advance')
    const { runtime, session } = await startPilotLesson(device, context, firstLesson)

    for (let step = 0; step < 5; step += 1) {
      const action = await runtime.submitStudyAction({ context, session, transientLearnerText: 'ready' })
      expect(action.status).toBe('accepted')
      const advanced = await runtime.completeSegment({ context, session })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
    }
    const finished = await runtime.completeAssignment({ context, session })
    if (finished.status !== 'ok') throw new Error(finished.reason)
    expect(finished.snapshot.assignmentState).toBe('completed')

    const nextLesson = getNextLesson(catalog, firstLesson.lessonId)
    expect(nextLesson?.unitId).toBe(unit.unitId)
    expect(nextLesson?.courseDay).toBe(firstLesson.courseDay + 1)
    if (!nextLesson) throw new Error('Unit 1 has no second lesson to advance into.')

    const secondStart = await runtime.startAssignment({
      context,
      assignment: { kind: 'static-curriculum', lesson: pilotLessonDescriptor(nextLesson) },
    })
    if (secondStart.status !== 'ok') throw new Error(`lesson 2 start failed: ${secondStart.reason}`)
    expect(secondStart.snapshot.lessonRef).toBe(nextLesson.lessonId)
    expect(secondStart.snapshot.session.blockRef).not.toBe(session.blockRef)
  })

  it('keeps learner B isolated from learner A on the same pilot device', async () => {
    const device = pilotDevice()
    const learnerA = pilotLearnerContext('isolation-a')
    const learnerB = pilotLearnerContext('isolation-b')
    const a = await startPilotLesson(device, learnerA, firstLesson)
    const b = await startPilotLesson(device, learnerB, firstLesson)

    expect(b.session.blockRef).not.toBe(a.session.blockRef)
    const aAdvanced = await a.runtime.completeSegment({ context: learnerA, session: a.session })
    if (aAdvanced.status !== 'ok') throw new Error(aAdvanced.reason)

    const bSnapshot = await b.runtime.snapshot({ context: learnerB, session: b.session })
    if (bSnapshot.status !== 'ok') throw new Error(bSnapshot.reason)
    expect(bSnapshot.snapshot.completedSegmentRefs).toEqual([])
    expect(bSnapshot.snapshot.segmentOrdinal).toBe(1)

    const aSnapshot = await a.runtime.snapshot({ context: learnerA, session: a.session })
    if (aSnapshot.status !== 'ok') throw new Error(aSnapshot.reason)
    expect(aSnapshot.snapshot.completedSegmentRefs).toHaveLength(1)
  })

  it('rejects a stale session handle replayed under the wrong learner without corrupting existing state', async () => {
    const device = pilotDevice()
    const learnerA = pilotLearnerContext('stale-a')
    const learnerB = pilotLearnerContext('stale-b')
    const { session } = await startPilotLesson(device, learnerA, firstLesson)
    const stale = storedHandle(session)
    const runtime = device.reload()

    const before = device.services.inspectPublicStateForTest() as { sessions: unknown[]; calendar: unknown[] }

    for (const call of [
      () => runtime.resumeAssignment({ context: learnerB, session: stale }),
      () => runtime.snapshot({ context: learnerB, session: stale }),
      () => runtime.pause({ context: learnerB, session: stale }),
      () => runtime.completeSegment({ context: learnerB, session: stale }),
    ]) {
      expect(await call()).toMatchObject({ status: 'rejected', reason: 'student-mismatch' })
    }

    const after = device.services.inspectPublicStateForTest() as { sessions: unknown[]; calendar: unknown[] }
    expect(after.sessions).toHaveLength(before.sessions.length)
    expect(after.calendar).toHaveLength(before.calendar.length)
  })

  it('does not corrupt state when the same resume action is duplicated (fired twice concurrently)', async () => {
    const device = pilotDevice()
    const context = pilotLearnerContext('duplicate-resume')
    const { session } = await startPilotLesson(device, context, firstLesson)
    const paused = await device.reload().pause({ context, session })
    if (paused.status !== 'ok') throw new Error(paused.reason)

    const runtime = device.reload()
    const handle = storedHandle(session)
    const [first, second] = await Promise.all([
      runtime.resume({ context, session: handle }),
      runtime.resume({ context, session: handle }),
    ])
    if (first.status !== 'ok') throw new Error(first.reason)
    if (second.status !== 'ok') throw new Error(second.reason)
    expect(first.snapshot.segmentRef).toBe(second.snapshot.segmentRef)
    expect(first.snapshot.assignmentState).toBe('active')
    expect(second.snapshot.assignmentState).toBe('active')

    const state = device.services.inspectPublicStateForTest() as { sessions: unknown[]; calendar: unknown[] }
    // One learner, one block, one durable session row — the duplicated call
    // never produced a second assignment or a second session record.
    expect(state.calendar).toHaveLength(1)
    expect(state.sessions).toHaveLength(1)
  })

  it('a safety stop makes every subsequent mutation on the pilot session unavailable, durably', async () => {
    const device = pilotDevice({ safety: 'urgent' })
    const context = pilotLearnerContext('safety-stop')
    const { runtime, session } = await startPilotLesson(device, context, firstLesson)

    const action = await runtime.submitStudyAction({ context, session, transientLearnerText: 'my answer' })
    expect(action.status).toBe('stopped')
    expect(device.lifecycle.lastReason).toBe('safety-stop')
    expect(await runtime.completeSegment({ context, session }))
      .toMatchObject({ status: 'rejected', reason: 'session-stopped' })
    expect(await runtime.checkpoint({ context, session }))
      .toMatchObject({ status: 'rejected', reason: 'session-stopped' })
    expect(await runtime.pause({ context, session }))
      .toMatchObject({ status: 'rejected', reason: 'session-stopped' })

    // Durable: a brand-new runtime over the same store starts stopped too.
    const reloaded = device.reload()
    expect(await reloaded.resumeAssignment({ context, session: storedHandle(session) }))
      .toMatchObject({ status: 'rejected', reason: 'session-stopped' })
    expect(await reloaded.submitStudyAction({ context, session, transientLearnerText: 'ready' }))
      .toMatchObject({ status: 'rejected', reason: 'session-stopped' })
  })

  it('runs entirely on local/test Study ports — no production route or hosted dependency', () => {
    const { services } = createLocalDevelopmentStudyPorts()
    expect(services.mode).toBe('local-development')
  })
})
