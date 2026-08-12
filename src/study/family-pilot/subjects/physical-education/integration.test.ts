import { describe, expect, it } from 'vitest'
import { DEFAULT_STUDY_ACCESSIBILITY } from '../../../hostContext'
import { StudyLifecycleBoundary } from '../../../lifecycle'
import { createLocalDevelopmentStudyPorts } from '../../../localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../../../ports'
import { SYNTHETIC_NOW } from '../../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext, StudyLearnerScope } from '../../../types'
import {
  FamilyPilotStudyRuntime,
  familyPilotStudySession,
  familyPilotTutorBridgeAvailable,
} from '../../study/FamilyPilotStudyRuntime'
import type { FamilyPilotStudySession } from '../../study/types'
import { listLessonsForGrade } from './catalog'
import { loadPhysicalEducationCatalog } from './curriculumSource.node'
import { adaptPhysicalEducationLessonToStudyPlan, physicalEducationCalendarDraft } from './studyAdapter'
import type { PhysicalEducationLesson } from './types'

/**
 * FF-M5 — proves the Study segment adapter's output is genuinely consumable
 * by the accepted RC1 Study runtime (no parallel engine), through the
 * `{ kind: 'calendar-block' }` seam FamilyPilotAssignment already exposes for
 * exactly this case: content whose block kind and mastery authority fall
 * outside curriculumAdapter.ts's closed HOST_STUDY_MAPPING.
 */

const RAW_TEXT_CANARY = 'PE-INTEGRATION-RAW-LEARNER-TEXT-CANARY'
const catalog = loadPhysicalEducationCatalog()

function safetyPort(): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'physical-education-test-safety-v1',
    evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
  }
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

function pilotDevice() {
  let tick = 0
  const now = () => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000))
  const { ports: localPorts } = createLocalDevelopmentStudyPorts({ now })
  const ports: StudyPortBundle = { ...localPorts, safety: safetyPort() }
  const lifecycle = new StudyLifecycleBoundary()
  const safetyStopStorage = memoryStorage()
  return {
    ports,
    now,
    reload: () => new FamilyPilotStudyRuntime({ ports, now, lifecycle, safetyStopStorage }),
  }
}

function studentContext(learnerId: string, householdId = 'household:pe-pilot'): HostStudyLaunchContext {
  return {
    householdRef: householdId,
    learnerRef: `learner:${learnerId}`,
    hostProfileRef: learnerId,
    grade: 5,
    subject: 'other',
    lessonRef: 'unset',
    skillRefs: ['unset'],
    householdTimeZone: 'America/New_York',
    learnerLocalDate: '2026-08-12',
    accessibility: DEFAULT_STUDY_ACCESSIBILITY,
    timerPreference: { visibility: 'shown', milestonesOnly: false },
    parentLimits: { maximumWorkMinutes: 45, breakMinutes: 10 },
    accommodationLimits: {},
  }
}

/**
 * The seam a future PE-aware host would call: build the plan, draft it onto
 * the calendar through the real port, then start it via 'calendar-block' —
 * never through curriculumAdapter.ts's closed HOST_STUDY_MAPPING.
 */
async function startPhysicalEducationAssignment(
  ports: StudyPortBundle,
  runtime: FamilyPilotStudyRuntime,
  context: HostStudyLaunchContext,
  lesson: PhysicalEducationLesson,
  instant: Date,
) {
  const scope: StudyLearnerScope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
  const plan = adaptPhysicalEducationLessonToStudyPlan(lesson)
  const draft = physicalEducationCalendarDraft({
    scope,
    plan,
    householdTimeZone: context.householdTimeZone,
    instant,
    timerHidden: context.timerPreference.visibility === 'hidden',
  })
  const entry = await ports.calendar.create(scope, draft)
  const started = await runtime.startAssignment({ context, assignment: { kind: 'calendar-block', entry } })
  if (started.status !== 'ok') throw new Error(`start failed: ${started.reason}`)
  return { snapshot: started.snapshot, session: started.snapshot.session }
}

function storedHandle(session: FamilyPilotStudySession): FamilyPilotStudySession {
  return JSON.parse(JSON.stringify(session)) as FamilyPilotStudySession
}

describe('Physical Education Study integration', () => {
  it('starts through the calendar-block seam with no adaptive Tutor bridge available', async () => {
    const device = pilotDevice()
    const runtime = device.reload()
    const context = studentContext('start')
    const lesson = listLessonsForGrade(catalog, '5')[0]
    const { snapshot } = await startPhysicalEducationAssignment(device.ports, runtime, context, lesson, device.now())

    expect(snapshot.assignmentState).toBe('active')
    expect(snapshot.sessionStatus).toBe('active')
    expect(snapshot.segmentOrdinal).toBe(1)
    expect(snapshot.remainingSegmentRefs).toHaveLength(5)
    expect(snapshot.masteryAuthority).toBe('completion-only')
    expect(snapshot.tutorBridgeAvailable).toBe(false)
  })

  it('records PE work as completion-only — never an accepted Tutor Core turn', async () => {
    const device = pilotDevice()
    const runtime = device.reload()
    const context = studentContext('recorded')
    const lesson = listLessonsForGrade(catalog, '5')[1]
    const { session } = await startPhysicalEducationAssignment(device.ports, runtime, context, lesson, device.now())

    const action = await runtime.submitStudyAction({ context, session, transientLearnerText: RAW_TEXT_CANARY })
    expect(action.status).toBe('recorded')
    if (action.status !== 'recorded') throw new Error('expected recorded')
    expect(action.visibleText).toContain('No mastery decision was made.')

    // The raw text held for the turn must never appear anywhere durable.
    const durable = JSON.stringify(await device.ports.persistence.loadSession({
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      sessionRef: session.sessionRef,
    }))
    expect(durable).not.toContain(RAW_TEXT_CANARY)
  })

  it('sequences all five lesson-flow phases in order, then reaches completed', async () => {
    const device = pilotDevice()
    const runtime = device.reload()
    const context = studentContext('sequencing')
    const lesson = listLessonsForGrade(catalog, '7')[20]
    const { session, snapshot } = await startPhysicalEducationAssignment(device.ports, runtime, context, lesson, device.now())

    expect(snapshot.remainingSegmentRefs).toHaveLength(5)
    expect(snapshot.segmentRef).toBe(`${lesson.lessonId}:segment:1`)

    for (let step = 0; step < 5; step += 1) {
      const advanced = await runtime.completeSegment({ context, session })
      if (advanced.status !== 'ok') throw new Error(advanced.reason)
      expect(advanced.snapshot.completedSegmentRefs).toHaveLength(step + 1)
      expect(advanced.snapshot.completedSegmentRefs[step]).toBe(`${lesson.lessonId}:segment:${step + 1}`)
    }

    const finished = await runtime.completeAssignment({ context, session })
    if (finished.status !== 'ok') throw new Error(finished.reason)
    expect(finished.snapshot.assignmentState).toBe('completed')
    expect(finished.snapshot.sessionStatus).toBe('completed')
    expect(finished.snapshot.remainingSegmentRefs).toEqual([])
    expect(finished.snapshot.requiredWorkCompletionPercent).toBe(100)
  })

  it('pause/resume compatibility — pauses, survives a reload, and resumes on the same step', async () => {
    const device = pilotDevice()
    const runtime = device.reload()
    const context = studentContext('pause-resume')
    const lesson = listLessonsForGrade(catalog, '8')[40]
    const { session } = await startPhysicalEducationAssignment(device.ports, runtime, context, lesson, device.now())

    const midway = await runtime.completeSegment({ context, session })
    if (midway.status !== 'ok') throw new Error(midway.reason)

    const paused = await runtime.pause({ context, session })
    if (paused.status !== 'ok') throw new Error(paused.reason)
    expect(paused.snapshot.assignmentState).toBe('paused')

    const reloaded = device.reload()
    const afterReload = await reloaded.resumeAssignment({ context, session: storedHandle(session) })
    if (afterReload.status !== 'ok') throw new Error(afterReload.reason)
    expect(afterReload.snapshot.assignmentState).toBe('paused')
    expect(afterReload.snapshot.segmentRef).toBe(paused.snapshot.segmentRef)

    const resumed = await reloaded.resume({ context, session })
    if (resumed.status !== 'ok') throw new Error(resumed.reason)
    expect(resumed.snapshot.assignmentState).toBe('active')
    expect(resumed.snapshot.segmentRef).toBe(paused.snapshot.segmentRef)
    expect(resumed.snapshot.segmentOrdinal).toBe(2)
  })

  it('student isolation — two learners in one household stay on separate PE assignments', async () => {
    const device = pilotDevice()
    const runtimeOne = device.reload()
    const runtimeTwo = device.reload()
    const contextOne = studentContext('isolation-one')
    const contextTwo = studentContext('isolation-two')
    const lesson = listLessonsForGrade(catalog, '5')[2]

    const first = await startPhysicalEducationAssignment(device.ports, runtimeOne, contextOne, lesson, device.now())
    const second = await startPhysicalEducationAssignment(device.ports, runtimeTwo, contextTwo, lesson, device.now())

    expect(second.session.blockRef).not.toBe(first.session.blockRef)
    await runtimeOne.completeSegment({ context: contextOne, session: first.session })

    const secondSnapshot = await runtimeTwo.snapshot({ context: contextTwo, session: second.session })
    if (secondSnapshot.status !== 'ok') throw new Error(secondSnapshot.reason)
    expect(secondSnapshot.snapshot.completedSegmentRefs).toEqual([])

    // Learner two's handle must never open under learner one's identity.
    const crossOpen = await runtimeOne.snapshot({
      context: contextOne,
      session: familyPilotStudySession(contextOne, second.session.blockRef),
    })
    expect(crossOpen).toMatchObject({ status: 'rejected', reason: 'unknown-assignment' })
  })

  it('never offers the adaptive Tutor bridge for any grade-5/7/8 PE lesson', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of listLessonsForGrade(catalog, grade).slice(0, 3)) {
        const plan = adaptPhysicalEducationLessonToStudyPlan(lesson)
        const fakeEntry = {
          subject: plan.subject,
          masteryAuthority: plan.masteryAuthority,
          segments: plan.segments,
        } as unknown as Parameters<typeof familyPilotTutorBridgeAvailable>[0]
        expect(familyPilotTutorBridgeAvailable(fakeEntry)).toBe(false)
      }
    }
  })
})
