import { describe, expect, it } from 'vitest'
import { calendarDraftForPlan } from './calendarAdapter'
import { adaptHostLessonToStudyPlan } from './curriculumAdapter'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from './ports'
import { AcceptedRc1HostRuntime } from './runtimeFacade'
import { createStudyTurnRequestRef, isStudyBridgeOpaqueId } from './studyRequestRef'
import { SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'
import type { StudySafetyResult } from './types'

// STUDY-A1-COMP Phase 9, end to end through production code: real calendar
// adapter -> real curriculum adapter -> real runtime facade -> real Tutor bridge.
//
// The bridge admits an opaque event identifier of at most 128 characters. The
// reference StudySessionContainer used to mint —
//   `request:${blockRef}:session:${segmentRef}:${Date.now()}`
// — grows with the block and the segment, and a *clear* learner turn that
// overshoots is refused by the bridge's pre-Core gateway before the classifier
// runs. When this card landed, that refusal came back as `bridge-stop-invalid-input`,
// which the container wrote to the durable A6-5-C ledger as a safety stop: a girl
// who typed "ready" was locked out across refreshes and her dad was shown a
// safety incident.
//
// STUDY-A1-BRIDGE-STATUS-C closed the second half of that. The bounded reference
// this file installs is still what production uses, and an over-long one is still
// refused; what changed is that the refusal is now classified from the bridge's
// own provenance as a structural `quarantined` result, so it is a technical
// failure rather than a statement about the child. See
// bridgeStatusBoundary.integration.test.ts for that boundary in full.

const CLEAR: StudySafetyResult = { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }

const alwaysClear: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-comp-request-ref-v1',
  evaluate: async () => CLEAR,
}

/**
 * Exactly what the host builds today: an opaque learner reference, a lesson
 * reference of the shape the Academy already produces, and the canonical
 * calendar/curriculum adapters that turn them into a block and its segments.
 */
async function realisticBlock(lessonRef: string) {
  const context = syntheticGrade5StudyContext('math')
  const { ports: localPorts } = createLocalDevelopmentStudyPorts()
  const ports: StudyPortBundle = { ...localPorts, safety: alwaysClear }
  const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
  const plan = adaptHostLessonToStudyPlan({
    lessonRef,
    title: 'Realistic Grade 5 mathematics lesson',
    kind: 'math',
    skillRefs: [`${lessonRef}:skill`],
  })
  const entry = await ports.calendar.create(scope, calendarDraftForPlan({
    scope,
    plan,
    householdTimeZone: context.householdTimeZone,
    instant: SYNTHETIC_NOW,
    timerHidden: false,
  }))
  return { context, ports, entry, scope }
}

/** The construction StudySessionContainer used before this card. */
function legacyRequestRef(blockRef: string, segmentRef: string): string {
  return `request:${blockRef}:session:${segmentRef}:${Date.now()}`
}

describe('Study turn request reference against the Tutor bridge opaque-id bound', () => {
  it('shows the legacy construction overshooting 128 characters on ordinary host references', async () => {
    // `grade-5:daily-study` is the lesson reference the host itself supplies in
    // App.tsx today — nothing exotic.
    const { entry } = await realisticBlock('grade-5:daily-study')
    const segments = entry.segments.map((segment) => segment.segmentRef)
    expect(segments.length).toBeGreaterThan(0)
    const lengths = segments.map((segmentRef) => legacyRequestRef(entry.blockRef, segmentRef).length)
    // At the host's own shortest realistic lesson reference the legacy form is
    // already sitting on the boundary, and its longest segment is over it.
    expect(Math.max(...lengths)).toBeGreaterThan(128)
  })

  it('refuses a clear learner turn on the legacy reference, without calling it a safety stop', async () => {
    const { context, ports, entry, scope } = await realisticBlock(
      'manuel-academy:mathematics:level-5:unit-04:lesson-03',
    )
    const sessionRef = `${entry.blockRef}:session`
    const segmentRef = entry.segments[0]!.segmentRef
    const requestRef = legacyRequestRef(entry.blockRef, segmentRef)
    expect(requestRef.length).toBeGreaterThan(128)
    expect(isStudyBridgeOpaqueId(requestRef)).toBe(false)

    const runtime = new AcceptedRc1HostRuntime(ports)
    runtime.launch(context, entry, sessionRef)
    const result = await runtime.submit({
      context,
      entry,
      scope: { ...scope, sessionRef },
      requestRef,
      segmentRef,
      transientLearnerText: 'ready',
      expectedAnswer: 'ready',
      occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
    })

    // Fail closed — the turn does not reach Tutor Core — but nothing about this
    // child was unsafe, so the result carries no classification, no delivery
    // status and no student message for the container to record.
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') throw new Error('unreachable')
    expect(result.reasonCode).toBe('bridge-urgent-gateway-invalid-context')
  })

  it('reaches the Tutor path for the same clear turn once the bounded reference is used', async () => {
    const { context, ports, entry, scope } = await realisticBlock(
      'manuel-academy:mathematics:level-5:unit-04:lesson-03',
    )
    const sessionRef = `${entry.blockRef}:session`
    const segmentRef = entry.segments[0]!.segmentRef
    const requestRef = createStudyTurnRequestRef()
    expect(isStudyBridgeOpaqueId(requestRef)).toBe(true)

    const runtime = new AcceptedRc1HostRuntime(ports)
    runtime.launch(context, entry, sessionRef)
    const result = await runtime.submit({
      context,
      entry,
      scope: { ...scope, sessionRef },
      requestRef,
      segmentRef,
      transientLearnerText: 'ready',
      expectedAnswer: 'ready',
      occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
    })

    expect(result.status).not.toBe('stopped')
    expect(result.status).toBe('accepted')
  })

  it('leaves a genuinely flagged turn stopping exactly as before', async () => {
    // The correction must not buy anything past the safety gate: the same
    // bounded reference with a non-clear classifier still stops.
    const { context, entry, scope } = await realisticBlock('grade-5:daily-study')
    const { ports: localPorts } = createLocalDevelopmentStudyPorts()
    const ports: StudyPortBundle = {
      ...localPorts,
      safety: {
        mode: 'production',
        classifierVersion: 'test-study-a1-comp-request-ref-urgent-v1',
        evaluate: async () => ({
          outcome: 'urgent' as const,
          mayContinue: false,
          adultHelpState: 'proposed-not-delivered' as const,
        }),
      },
    }
    const sessionRef = `${entry.blockRef}:session`
    const runtime = new AcceptedRc1HostRuntime(ports)
    runtime.launch(context, entry, sessionRef)
    const result = await runtime.submit({
      context,
      entry,
      scope: { ...scope, sessionRef },
      requestRef: createStudyTurnRequestRef(),
      segmentRef: entry.segments[0]!.segmentRef,
      transientLearnerText: 'ready',
      expectedAnswer: 'ready',
      occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
    })
    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') throw new Error('unreachable')
    expect(result.classification).toBe('urgent')
  })
})
