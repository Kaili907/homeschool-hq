import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../../ports'
import { FamilyPilotController } from './controller'
import { hostLessonCurriculumPort } from './curriculum'
import { launchContextFor } from './identity'
import { checkStudyEntry } from './safety'
import { FamilyPilotSafetyHoldBridge } from './safetyHolds'

// FAMILY-PILOT-INTEGRATION: the required pilot safety flow, driven through the
// REAL controller, REAL Core store and REAL Study runtime — the exact wiring
// IntegratedPilotSurface.tsx composes, with only clock/storage/curriculum
// injected. A pass here means the composed safety integration works, not
// that a set of mocks agree with each other.

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

function urgentSafetyPort(): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'family-pilot-safety-integration-controller-test-v1',
    evaluate: async () => ({ outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' }),
  }
}

function harness() {
  const now = () => new Date('2026-03-04T15:00:00.000Z')
  const coreStore = { storage: memoryStorage(), now: () => now().toISOString() }
  const { ports: localPorts } = createLocalDevelopmentStudyPorts({ now })
  const ports: StudyPortBundle = { ...localPorts, safety: urgentSafetyPort() }
  const bridge = new FamilyPilotSafetyHoldBridge({ coreStore, storage: memoryStorage(), now: () => now().toISOString() })
  const controller = new FamilyPilotController({
    ports,
    curriculum: hostLessonCurriculumPort(1),
    store: coreStore,
    safety: bridge.port,
    safetySignals: bridge,
    now,
    householdTimeZone: 'UTC',
    defaultGrade: '5',
    newStudentRef: () => 'student:fixed-1',
  })
  return { controller, bridge, now }
}

describe('Family Pilot safety-hold integration, driven through the real controller', () => {
  it('an urgent Study safety result creates a hold that blocks the SAME assignment, and a parent resolve lets it resume', async () => {
    const { controller, bridge, now } = harness()
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0]!.studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)
    const assignmentRef = controller.assignmentsFor(ref)[0]!.assignmentRef

    const started = await controller.start(ref, assignmentRef)
    if (started.status !== 'ok' || !started.study) throw new Error('expected a Study snapshot')

    const stopped = await controller.runtime.submitStudyAction({
      context: launchContextFor({
        studentRef: ref,
        grade: 5,
        subject: 'math',
        lessonRef: started.study.lessonRef,
        skillRefs: ['grade-5:math:current'],
        householdTimeZone: 'UTC',
        at: now(),
      }),
      session: started.study.session,
      transientLearnerText: 'a raw student answer',
    })
    expect(stopped.status).toBe('stopped')

    // Blocked at the pilot's own entry gate — the same door start()/resume() use.
    const blockedResume = await controller.resume(ref, assignmentRef)
    expect(blockedResume.status).toBe('rejected')
    // Rejected at the FAMILY PILOT gate specifically (checkStudyEntry runs
    // before the runtime is even touched) — not some other reason.
    if (blockedResume.status === 'rejected') expect(blockedResume.reason).toBe('study-safety-urgent')

    const [hold] = bridge.openHoldsFor(ref)
    expect(hold).toBeDefined()
    expect(hold!.sessionRef).toBe(started.study.session.sessionRef)

    const outcome = bridge.resolveHold(hold!.holdRef, 'family-pilot-parent')
    expect(outcome.ok).toBe(true)
    expect(bridge.openHoldsFor(ref)).toHaveLength(0)

    // The Family Pilot hold no longer blocks entry, so the SAME learner and
    // SAME session may resume — the required pilot flow, end to end.
    const afterResolve = await controller.resume(ref, assignmentRef)
    expect(afterResolve.status).toBe('ok')
  })

  it('a second, never-stopped learner is unaffected by the first learner’s hold', async () => {
    const { controller, bridge } = harness()
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0]!.studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)
    const assignmentRef = controller.assignmentsFor(ref)[0]!.assignmentRef
    const started = await controller.start(ref, assignmentRef)
    if (started.status !== 'ok') throw new Error('expected ok')

    bridge.recordStudySignal({
      studentRef: ref,
      sessionRef: started.study!.session.sessionRef,
      classification: 'urgent',
      occurredAt: '2026-03-04T15:05:00.000Z',
    })

    const otherRef = 'student:never-held'
    expect(checkStudyEntry(bridge.port, { studentRef: otherRef, assignmentRef: 'assignment:unrelated' }))
      .toEqual({ allowed: true })
  })

  it('a Tutor concerning-content turn also blocks the pilot entry gate for that exact session', async () => {
    const { controller, bridge } = harness()
    controller.createStudent('Ada')
    const ref = controller.snapshot().state.students[0]!.studentRef
    controller.selectStudent(ref)
    controller.ensureAssignments(ref)
    const assignmentRef = controller.assignmentsFor(ref)[0]!.assignmentRef
    const started = await controller.start(ref, assignmentRef)
    if (started.status !== 'ok') throw new Error('expected ok')

    const help = controller.help(ref, assignmentRef)
    if (!help) throw new Error('expected a help step')

    const turn = await controller.helpTurn(help.session, 'I want to hurt myself')
    expect(turn.session.flaggedForAdult).toBe(true)

    const [hold] = bridge.openHoldsFor(ref)
    expect(hold?.reasonCode).toBe('tutor-concerning-content')

    const blockedHelp = controller.help(ref, assignmentRef)
    expect(blockedHelp?.session.closed).toBe(true)
  })
})
