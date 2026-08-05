import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudySafetyPort } from './ports'
import { AcceptedRc1HostRuntime } from './runtimeFacade'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'

describe('accepted RC1 host runtime boundary', () => {
  const productionSafety = (outcome: 'clear' | 'urgent' = 'clear'): StudySafetyPort => ({
    mode: 'production',
    classifierVersion: 'test-mounted-safety-v1',
    evaluate: async () => outcome === 'clear'
      ? { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
      : { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' },
  })

  it('fails before runtime launch when a required persistence or safety port is missing', async () => {
    const context = syntheticGrade5StudyContext('math')
    const { ports } = createLocalDevelopmentStudyPorts()
    const { entry } = await createSyntheticMathBlock(ports)
    expect(() => new AcceptedRc1HostRuntime({ safety: ports.safety }).launch(context, entry, 'session:missing-ports')).toThrow(/missing/i)
    expect(() => new AcceptedRc1HostRuntime({ persistence: ports.persistence }).launch(context, entry, 'session:missing-safety')).toThrow(/missing/i)
  })

  it('rejects a calendar block belonging to the wrong selected learner', async () => {
    const context = syntheticGrade5StudyContext('math')
    const { ports } = createLocalDevelopmentStudyPorts()
    const { entry } = await createSyntheticMathBlock(ports, { learnerRef: 'learner:other' })
    expect(() => new AcceptedRc1HostRuntime(ports).launch(context, entry, 'session:wrong-learner')).toThrow(/wrong learner/i)
  })

  it('routes an urgent safety result to stop before Tutor Core and persists no raw answer', async () => {
    const context = syntheticGrade5StudyContext('math')
    const { ports: localPorts, services } = createLocalDevelopmentStudyPorts()
    const ports = { ...localPorts, safety: productionSafety('urgent') }
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'safety-stop' })
    const runtime = new AcceptedRc1HostRuntime(ports)
    const sessionRef = 'session:synthetic-safety-stop'
    runtime.launch(context, entry, sessionRef)
    const canary = 'RAW_STUDENT_ANSWER_CANARY'
    const result = await runtime.submit({
      context,
      entry,
      scope: { ...scope, sessionRef },
      requestRef: 'request:synthetic-safety-stop',
      segmentRef: entry.segments[0]!.segmentRef,
      transientLearnerText: canary,
      expectedAnswer: 'ready',
      occurredAt: new Date(SYNTHETIC_NOW.getTime() + 1000).toISOString(),
    })
    expect(result.status).toBe('stopped')
    if (result.status === 'stopped') {
      expect(result.coreSubmitInvocations).toBe(0)
      expect(result.deliveryStatus).toBe('proposed-not-delivered')
    }
    expect(JSON.stringify(services.inspectPublicStateForTest())).not.toContain(canary)
    expect(services.inspectPublicStateForTest()).toMatchObject({ outbox: [] })
  })

  it('accepts clear input through the bridge but reprojects only a host-bound safe presentation', async () => {
    const context = syntheticGrade5StudyContext('math')
    const { ports: localPorts, services } = createLocalDevelopmentStudyPorts()
    const ports = { ...localPorts, safety: productionSafety() }
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'accepted' })
    const runtime = new AcceptedRc1HostRuntime(ports)
    const sessionRef = 'session:synthetic-accepted'
    runtime.launch(context, entry, sessionRef)
    const canary = 'ready'
    const result = await runtime.submit({
      context,
      entry,
      scope: { ...scope, sessionRef },
      requestRef: 'request:synthetic-accepted',
      segmentRef: entry.segments[0]!.segmentRef,
      transientLearnerText: canary,
      expectedAnswer: 'ready',
      occurredAt: new Date(SYNTHETIC_NOW.getTime() + 2000).toISOString(),
    })
    expect(result.status).toBe('accepted')
    if (result.status === 'accepted') {
      expect(result.presentation).toMatchObject({
        captionsAlwaysVisible: true,
        lessonMayContinueWithoutMedia: true,
        transcriptIncluded: false,
      })
      expect(result.presentation.visibleText).not.toContain(canary)
    }
    const publicState = JSON.stringify(services.inspectPublicStateForTest())
    expect(publicState).not.toMatch(/transientLearnerText|rawAnswerIncluded["']?\s*:\s*true/i)
    expect(publicState).not.toContain('learner:local-release-candidate')
  })

  it('discards a stale host binding before bridge work', async () => {
    const context = syntheticGrade5StudyContext('math')
    const { ports } = createLocalDevelopmentStudyPorts()
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'stale' })
    const result = await new AcceptedRc1HostRuntime(ports).submit({
      context,
      entry,
      scope: { ...scope, sessionRef: 'session:stale' },
      requestRef: 'request:stale',
      segmentRef: entry.segments[0]!.segmentRef,
      transientLearnerText: 'ready',
      expectedAnswer: 'ready',
      occurredAt: new Date().toISOString(),
      isCurrentBinding: () => false,
    })
    expect(result).toEqual({ status: 'quarantined', reasonCode: 'stale-host-binding' })
  })
})
