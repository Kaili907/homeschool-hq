import { describe, expect, it } from 'vitest'
import { evaluatePreCoreUrgentSafety } from '../../adaptive-tutor/study-engine/bridges/tutor-core/src/safety-gateway.ts'
import { calendarDraftForPlan } from './calendarAdapter'
import { adaptHostLessonToStudyPlan } from './curriculumAdapter'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from './ports'
import { AcceptedRc1HostRuntime } from './runtimeFacade'
import { studyBridgeSessionRef } from './studyBridgeSessionRef'
import { createStudyTurnRequestRef, isStudyBridgeOpaqueId } from './studyRequestRef'
import { SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'
import type { StudySafetyResult } from './types'

// STUDY-A1-SESSIONREF-C, end to end through production code: real calendar
// adapter -> real curriculum adapter -> real runtime facade -> real Tutor bridge.
//
// The Study session container derives `${blockRef}:session` and that value
// reaches the Tutor bridge as `sessionId`, where the pre-core safety gateway
// admits an opaque identifier of at most 128 characters
// (`validOpaqueId` in bridges/tutor-core/src/safety-gateway.ts). The calendar
// adapter builds
//   block:<learnerRef ≤32>:<YYYY-MM-DD>:<lessonRef ≤80>
// so an Academy-length lesson reference produces a 133-character session
// reference — over the bound. The gateway refuses it *before* the classifier
// runs, shaped as `stop-invalid-input`, and the container writes that to the
// durable A6-5-C ledger as a learner safety stop.
//
// The bridge's `sessionId` is a transport correlation identifier, not the
// durable Study session key: the host's stop ledger, checkpoint, persistence
// and event scope are all keyed on `scope.sessionRef` and never on what the
// bridge echoes. So the durable reference stays exactly as it is, and only the
// value presented to the bridge is bounded.

const CLEAR: StudySafetyResult = { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }

const alwaysClear: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-sessionref-v1',
  evaluate: async () => CLEAR,
}

/** The exact Academy lesson reference shape the host already produces. */
const ACADEMY_LESSON_REF = 'manuel-academy:mathematics:level-5:unit-04:lesson-03:multiplying-whole-numbers'

async function realisticBlock(lessonRef: string, safety: StudySafetyPort = alwaysClear) {
  const context = syntheticGrade5StudyContext('math')
  const { ports: localPorts } = createLocalDevelopmentStudyPorts()
  const ports: StudyPortBundle = { ...localPorts, safety }
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

/** The container's derivation, verbatim. */
function containerSessionRef(blockRef: string): string {
  return `${blockRef}:session`
}

async function clearTurn(lessonRef: string, safety: StudySafetyPort = alwaysClear) {
  const { context, ports, entry, scope } = await realisticBlock(lessonRef, safety)
  const sessionRef = containerSessionRef(entry.blockRef)
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
  return { sessionRef, result }
}

describe('Study session reference against the Tutor bridge opaque-id bound', () => {
  it('shows an Academy-length block reference overshooting the bound', async () => {
    const { entry } = await realisticBlock(ACADEMY_LESSON_REF)
    const sessionRef = containerSessionRef(entry.blockRef)
    // The block reference itself is admissible; appending `:session` is what
    // crosses the bound, which is why this was invisible until the turn ran.
    expect(isStudyBridgeOpaqueId(entry.blockRef)).toBe(true)
    expect(sessionRef.length).toBe(133)
    expect(isStudyBridgeOpaqueId(sessionRef)).toBe(false)
  })

  it('accepts a clear turn on that Academy-length session reference', async () => {
    // Before this card: `stopped` / `bridge-stop-invalid-input`, which the
    // container records as a durable learner safety stop. A girl who typed
    // "ready" is locked out across refreshes and her dad sees a safety incident.
    const { sessionRef, result } = await clearTurn(ACADEMY_LESSON_REF)
    expect(sessionRef.length).toBeGreaterThan(128)
    expect(result.status).toBe('accepted')
  })

  it('accepts a clear turn on a short session reference exactly as before', async () => {
    const { sessionRef, result } = await clearTurn('grade-5:daily-study')
    expect(isStudyBridgeOpaqueId(sessionRef)).toBe(true)
    expect(sessionRef.length).toBeLessThanOrEqual(128)
    expect(result.status).toBe('accepted')
  })

  it('leaves a genuinely flagged turn stopping exactly as before, at either length', async () => {
    // The correction must buy nothing past the safety gate.
    const urgent: StudySafetyPort = {
      mode: 'production',
      classifierVersion: 'test-study-a1-sessionref-urgent-v1',
      evaluate: async () => ({
        outcome: 'urgent' as const,
        mayContinue: false,
        adultHelpState: 'proposed-not-delivered' as const,
      }),
    }
    for (const lessonRef of [ACADEMY_LESSON_REF, 'grade-5:daily-study']) {
      const { result } = await clearTurn(lessonRef, urgent)
      expect(result.status).toBe('stopped')
      if (result.status !== 'stopped') throw new Error('unreachable')
      expect(result.classification).toBe('urgent')
      expect(result.deliveryStatus).toBe('proposed-not-delivered')
    }
  })
})

describe('the bounded bridge session identifier itself', () => {
  it('passes an already-admissible reference through unchanged', () => {
    // Every session reference that works today keeps the exact identity it has
    // today at the bridge, so nothing that already passed changes shape.
    for (const value of ['a', 'block:x:2026-08-01:lesson:session', 'A'.repeat(128)]) {
      expect(studyBridgeSessionRef(value)).toBe(value)
    }
  })

  it('holds at 127, 128 and 129 characters', () => {
    const at = (length: number) => `s${'a'.repeat(length - 1)}`
    expect(studyBridgeSessionRef(at(127))).toBe(at(127))
    expect(studyBridgeSessionRef(at(128))).toBe(at(128))
    expect(studyBridgeSessionRef(at(129))).not.toBe(at(129))
    for (const length of [127, 128, 129]) {
      const bridgeRef = studyBridgeSessionRef(at(length))
      expect(bridgeRef.length).toBeLessThanOrEqual(128)
      expect(isStudyBridgeOpaqueId(bridgeRef)).toBe(true)
    }
  })

  it('bounds every reference the calendar adapter can build, and every degenerate one', async () => {
    // The adapter's own maximum: a 32-character learner suffix, a date, and an
    // 80-character lesson suffix, plus `:session`.
    const maximal = `block:${'L'.repeat(32)}:2026-08-01:${'x'.repeat(80)}:session`
    expect(maximal.length).toBe(138)
    const cases = [
      maximal,
      '',
      ':leading-colon',
      'has spaces and 🙂 emoji',
      'x'.repeat(4096),
      `${'x'.repeat(4096)}:session`,
    ]
    for (const value of cases) {
      const bridgeRef = studyBridgeSessionRef(value)
      expect(bridgeRef.length).toBeLessThanOrEqual(128)
      expect(isStudyBridgeOpaqueId(bridgeRef)).toBe(true)
    }
  })

  it('is stable for the same reference and distinct for near-identical ones', () => {
    // Stability is what a remount depends on; distinctness is what stops two
    // sessions sharing one bridge correlation identifier.
    const base = `block:${'L'.repeat(32)}:2026-08-01:${'x'.repeat(80)}:session`
    expect(studyBridgeSessionRef(base)).toBe(studyBridgeSessionRef(base))
    const neighbours = new Set(
      Array.from({ length: 500 }, (_, index) =>
        studyBridgeSessionRef(`${base.slice(0, -8)}-${index}:session`)),
    )
    expect(neighbours.size).toBe(500)
    // Differing only in the final character, and only in length.
    expect(studyBridgeSessionRef(`${base}a`)).not.toBe(studyBridgeSessionRef(`${base}b`))
    expect(studyBridgeSessionRef(`${base}a`)).not.toBe(studyBridgeSessionRef(base))
  })

  it('is admitted by the bridge gateway itself, not only by the host mirror of it', () => {
    // `isStudyBridgeOpaqueId` is a copy of `validOpaqueId` and could drift from
    // it, so this asks the real gateway. A clear turn is used throughout, so the
    // only thing that can produce `stop-invalid-input` here is the identifier.
    const ask = (sessionId: string) => evaluatePreCoreUrgentSafety(
      'ready',
      { eventId: 'study-turn:fixture', sessionId, occurredAt: '2026-08-01T13:00:05.000Z' },
    )
    const cases = [
      `block:${'L'.repeat(32)}:2026-08-01:${'x'.repeat(80)}:session`,
      `s${'a'.repeat(128)}`,
      '',
      'has spaces and 🙂 emoji',
    ]
    for (const sessionRef of cases) {
      // The raw reference is exactly what the gateway refuses today.
      expect(ask(sessionRef).status).toBe('stop-invalid-input')
      // The derived one is admitted.
      expect(ask(studyBridgeSessionRef(sessionRef)).status).toBe('continue-to-tutor-core')
    }
    // And a reference the gateway already admits is passed through untouched.
    const short = 'block:learner:2026-08-01:lesson:session'
    expect(studyBridgeSessionRef(short)).toBe(short)
    expect(ask(short).status).toBe('continue-to-tutor-core')
  })

  it('carries nothing from the reference it derives from', () => {
    // No slice, no prefix, no suffix: an over-long reference contributes only
    // through the digest, so no learner-identifying fragment survives into it.
    const sessionRef = `block:learner:private-name-fragment:2026-08-01:${'x'.repeat(80)}:session`
    const bridgeRef = studyBridgeSessionRef(sessionRef)
    expect(bridgeRef).not.toContain('private-name-fragment')
    expect(bridgeRef).not.toContain('learner')
    expect(bridgeRef.startsWith('study-session:')).toBe(true)
  })
})
