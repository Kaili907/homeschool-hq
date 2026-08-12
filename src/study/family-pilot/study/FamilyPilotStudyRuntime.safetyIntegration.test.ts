import { describe, expect, it } from 'vitest'
import { syntheticGrade5StudyContext } from '../../demonstrations'
import type { HostLessonDescriptor } from '../../curriculumAdapter'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import { isSessionStoppedByLocalLedger } from '../../safety/localStopLedger'
import type { StudyPortBundle, StudySafetyPort } from '../../ports'
import { SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext } from '../../types'
import { FamilyPilotStudyRuntime, type FamilyPilotStudySafetyStopSignal } from './FamilyPilotStudyRuntime'

/**
 * Wave 12 of the RED->GREEN list: this file exists to prove the Family Pilot
 * safety-hold layer changes NOTHING about the Study Engine's own permanent
 * local-stop ledger — same durable write, same durable block on reload —
 * whether or not onSafetyStop is wired.
 */

const RAW_ANSWER_CANARY = 'PILOT-RAW-STUDENT-ANSWER-CANARY'

function safetyPort(outcome: 'clear' | 'urgent'): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'family-pilot-safety-integration-test-v1',
    evaluate: async () => outcome === 'clear'
      ? { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
      : { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' },
  }
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

function pilotDevice(options: { readonly onSafetyStop?: (signal: FamilyPilotStudySafetyStopSignal) => void } = {}) {
  let tick = 0
  const now = () => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000))
  const { ports: localPorts } = createLocalDevelopmentStudyPorts({ now })
  const ports: StudyPortBundle = { ...localPorts, safety: safetyPort('urgent') }
  const safetyStopStorage = memoryStorage()
  return {
    ports,
    safetyStopStorage,
    runtime: new FamilyPilotStudyRuntime({ ports, now, safetyStopStorage, onSafetyStop: options.onSafetyStop }),
  }
}

function studentContext(id: string): HostStudyLaunchContext {
  return { ...syntheticGrade5StudyContext('math'), learnerRef: `learner:pilot-safety-${id}`, hostProfileRef: `pilot-safety-${id}` }
}

function mathLesson(id: string): HostLessonDescriptor {
  return {
    lessonRef: `pilot:safety:grade5:math:${id}`,
    title: 'Grade 5 math study block',
    kind: 'math',
    skillRefs: ['pilot:grade5:math:multiplication'],
  }
}

describe('FamilyPilotStudyRuntime onSafetyStop', () => {
  it('fires with the exact classification and session on a stopped result — an unset callback changes nothing', async () => {
    const signals: FamilyPilotStudySafetyStopSignal[] = []
    const device = pilotDevice({ onSafetyStop: (signal) => signals.push(signal) })
    const context = studentContext('one')
    const started = await device.runtime.startAssignment({
      context,
      assignment: { kind: 'static-curriculum', lesson: mathLesson('one') },
    })
    if (started.status !== 'ok') throw new Error(started.reason)
    const session = started.snapshot.session

    const action = await device.runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY })

    expect(action.status).toBe('stopped')
    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({
      studentRef: context.learnerRef,
      sessionRef: session.sessionRef,
      classification: 'urgent',
    })
  })

  it('a subscriber that throws never affects the permanent stop write', async () => {
    const device = pilotDevice({ onSafetyStop: () => { throw new Error('boom') } })
    const context = studentContext('two')
    const started = await device.runtime.startAssignment({
      context,
      assignment: { kind: 'static-curriculum', lesson: mathLesson('two') },
    })
    if (started.status !== 'ok') throw new Error(started.reason)
    const session = started.snapshot.session

    const action = await device.runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY })

    expect(action.status).toBe('stopped')
    expect(isSessionStoppedByLocalLedger(
      { studentRef: context.learnerRef, sessionRef: session.sessionRef },
      device.safetyStopStorage,
    )).toBe(true)
  })

  it('with no onSafetyStop at all, the permanent stop still writes exactly as before this branch', async () => {
    const device = pilotDevice()
    const context = studentContext('three')
    const started = await device.runtime.startAssignment({
      context,
      assignment: { kind: 'static-curriculum', lesson: mathLesson('three') },
    })
    if (started.status !== 'ok') throw new Error(started.reason)
    const session = started.snapshot.session

    const action = await device.runtime.submitStudyAction({ context, session, transientLearnerText: RAW_ANSWER_CANARY })

    expect(action.status).toBe('stopped')
    expect(isSessionStoppedByLocalLedger(
      { studentRef: context.learnerRef, sessionRef: session.sessionRef },
      device.safetyStopStorage,
    )).toBe(true)
    // The permanent ledger is still unresolvable: no Family Pilot hold resolution
    // can ever change this, because this runtime never consults the hold bridge.
    expect(await device.runtime.resumeAssignment({ context, session }))
      .toMatchObject({ status: 'rejected', reason: 'session-stopped' })
  })
})
