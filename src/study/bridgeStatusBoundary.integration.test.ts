import { describe, expect, it, vi } from 'vitest'
import { calendarDraftForPlan } from './calendarAdapter'
import { adaptHostLessonToStudyPlan } from './curriculumAdapter'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from './ports'
import { AcceptedRc1HostRuntime, type StudyTutorTurnResult } from './runtimeFacade'
import { createStudyTurnRequestRef } from './studyRequestRef'
import { SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'
import type { StudyCalendarEntry, StudySafetyResult } from './types'

// STUDY-A1-BRIDGE-STATUS-C — the Tutor bridge's return states, classified at the
// host boundary rather than collapsed into one.
//
// `SafeTutorBridgeResult` carries a single `stopped-or-quarantined` arm whose
// name says outright that it holds two different things. The host facade mapped
// the whole arm to a `stopped` result, and StudySessionContainer writes every
// `stopped` result to the durable A6-5-C safety ledger. So an event-ledger
// collision, a replayed turn or an over-long legacy identifier — none of which
// is a determination about this child — became a learner safety incident that
// survives a refresh and shows up in her dad's record.
//
// The split below is taken from the bridge's own discriminated union, never from
// the human-readable learner message: every one of these results carries the
// identical `STUDY_LEARNER_STOP_MESSAGE`, so a message string could not tell
// them apart even in principle.
//
//   pre-Core gateway determinations (a classifier judged, or refused to judge,
//   this learner's text) ................................. learner safety
//     stop-for-urgent-adult-review
//     stop-for-uncertain-adult-review
//     stop-invalid-input / urgent-gateway-input-limit
//     stop-invalid-input / urgent-gateway-invalid-classifier
//
//   everything the gateway cleared before it happened ..... structural
//     stop-invalid-input / urgent-gateway-invalid-context   (host identifiers)
//     quarantined                                          (contract/ledger)
//     duplicate-ignored                                    (replay)
//
// `urgent-gateway-input-limit` is deliberately on the safety side: the gateway
// refuses the text *before* normalizing or classifying it, so nothing ever
// judged it. The bridge's reviewed deterministic layer runs on every turn and
// may escalate above the host's own classifier (proved below), so text it never
// saw cannot be called clear. Fail closed, as A6-5-C requires.

const CLEAR: StudySafetyResult = { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }

const alwaysClear: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-bridge-status-clear-v1',
  evaluate: async () => CLEAR,
}

function classifyingPort(outcome: 'urgent' | 'uncertain'): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: `test-study-a1-bridge-status-${outcome}-v1`,
    evaluate: async () => ({ outcome, mayContinue: false, adultHelpState: 'proposed-not-delivered' as const }),
  }
}

/** The Academy lesson reference shape the host already produces. */
const ACADEMY_LESSON_REF = 'manuel-academy:mathematics:level-5:unit-04:lesson-03'

/** One real Study block, built through the real curriculum and calendar adapters. */
async function studyBlock(overrides: Partial<StudyPortBundle> = {}, lessonRef = 'grade-5:daily-study') {
  const context = syntheticGrade5StudyContext('math')
  const { ports: localPorts } = createLocalDevelopmentStudyPorts()
  const ports: StudyPortBundle = { ...localPorts, safety: alwaysClear, ...overrides }
  const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
  const plan = adaptHostLessonToStudyPlan({
    lessonRef,
    title: 'Grade 5 daily study',
    kind: 'math',
    skillRefs: ['synthetic:grade5:math:multiplication'],
  })
  const entry = await ports.calendar.create(scope, calendarDraftForPlan({
    scope,
    plan,
    householdTimeZone: context.householdTimeZone,
    instant: SYNTHETIC_NOW,
    timerHidden: false,
  }))
  return { context, ports, entry, scope, localPorts }
}

interface TurnOverrides {
  readonly entry?: StudyCalendarEntry
  readonly segmentRef?: string
  readonly requestRef?: string
  readonly transientLearnerText?: string
}

async function submitTurn(
  base: Awaited<ReturnType<typeof studyBlock>>,
  overrides: TurnOverrides = {},
): Promise<StudyTutorTurnResult> {
  const entry = overrides.entry ?? base.entry
  const sessionRef = `${entry.blockRef}:session`
  const runtime = new AcceptedRc1HostRuntime(base.ports)
  runtime.launch(base.context, entry, sessionRef)
  return runtime.submit({
    context: base.context,
    entry,
    scope: { ...base.scope, sessionRef },
    requestRef: overrides.requestRef ?? createStudyTurnRequestRef(),
    segmentRef: overrides.segmentRef ?? entry.segments[0]!.segmentRef,
    transientLearnerText: overrides.transientLearnerText ?? 'ready',
    expectedAnswer: 'ready',
    occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
  })
}

/** A host event ledger that answers the bridge's accepted-event append this way. */
function ledgerAnswering(
  status: 'duplicate-ignored' | 'idempotency-collision',
  delegate: StudyPortBundle['eventLedger'],
): StudyPortBundle['eventLedger'] {
  return {
    append: async (scope, event, operation) =>
      event.type === 'tutor-directive' ? status : delegate.append(scope, event, operation),
  }
}

/**
 * A persisted block carrying a reference longer than the bridge's 128-character
 * opaque-id bound. The calendar runtime refuses to *create* one, so this is the
 * legacy or externally-restored shape rather than one this host builds today —
 * which is exactly why it must be a technical refusal and not a safety incident.
 */
function withLessonRef(entry: StudyCalendarEntry, lessonRef: string): StudyCalendarEntry {
  return { ...entry, lessonRef }
}

function withSegmentRef(entry: StudyCalendarEntry, segmentRef: string): StudyCalendarEntry {
  return {
    ...entry,
    segments: [{ ...entry.segments[0]!, segmentRef }, ...entry.segments.slice(1)],
  }
}

/** The unbounded turn reference the host built before STUDY-A1-COMP Phase 9. */
function legacyRequestRef(blockRef: string, segmentRef: string): string {
  return `study-turn:${blockRef}:session:${segmentRef}`
}

const OVER_LONG = 'x'.repeat(140)

describe('structural Tutor bridge failures are not learner safety determinations', () => {
  it('does not make a safety determination out of an event-ledger collision', async () => {
    // Reachable in production: the durable ledger enforces uniqueness on
    // (session, event), and a retried turn can land on an existing row.
    const { ports: local } = createLocalDevelopmentStudyPorts()
    const base = await studyBlock({ eventLedger: ledgerAnswering('idempotency-collision', local.eventLedger) })

    const result = await submitTurn(base)

    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') throw new Error('unreachable')
    expect(result.reasonCode).toBe('bridge-quarantined')
  })

  it('does not make a safety determination out of a replayed accepted event', async () => {
    const { ports: local } = createLocalDevelopmentStudyPorts()
    const base = await studyBlock({ eventLedger: ledgerAnswering('duplicate-ignored', local.eventLedger) })

    const result = await submitTurn(base)

    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') throw new Error('unreachable')
    expect(result.reasonCode).toBe('bridge-duplicate-ignored')
  })

  it('does not make a safety determination out of an over-long legacy lesson reference', async () => {
    const base = await studyBlock()

    const result = await submitTurn(base, { entry: withLessonRef(base.entry, `manuel-academy:legacy:${OVER_LONG}`) })

    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') throw new Error('unreachable')
    expect(result.reasonCode).toBe('bridge-quarantined')
  })

  it('does not make a safety determination out of an over-long legacy segment reference', async () => {
    const base = await studyBlock()
    const segmentRef = `${base.entry.segments[0]!.segmentRef}:${OVER_LONG}`

    const result = await submitTurn(base, { entry: withSegmentRef(base.entry, segmentRef), segmentRef })

    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') throw new Error('unreachable')
    expect(result.reasonCode).toBe('bridge-quarantined')
  })

  it('does not make a safety determination out of an unbounded legacy turn reference', async () => {
    // The STUDY-A1-COMP Phase 9 correction stopped the host building this shape.
    // The defect class it exposed is closed here: even when the identifier is
    // refused, refusing it is not a statement about the child.
    const base = await studyBlock({}, ACADEMY_LESSON_REF)
    const requestRef = legacyRequestRef(base.entry.blockRef, base.entry.segments[0]!.segmentRef)
    expect(requestRef.length).toBeGreaterThan(128)

    const result = await submitTurn(base, { requestRef })

    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') throw new Error('unreachable')
    expect(result.reasonCode).toBe('bridge-urgent-gateway-invalid-context')
  })

  it('carries nothing a caller could write a safety record from', async () => {
    // Structural refusals are shaped so the durable path is not merely unused but
    // unbuildable: no classification, no delivery status, no student message.
    const { ports: local } = createLocalDevelopmentStudyPorts()
    const base = await studyBlock({ eventLedger: ledgerAnswering('idempotency-collision', local.eventLedger) })

    const result = await submitTurn(base)

    expect(Object.keys(result).sort()).toEqual(['reasonCode', 'status'])
    for (const field of ['classification', 'deliveryStatus', 'studentMessage', 'coreSubmitInvocations']) {
      expect(Object.hasOwn(result, field)).toBe(false)
    }
  })

  it('records no completion and no accepted session for a structural refusal', async () => {
    const { ports: local } = createLocalDevelopmentStudyPorts()
    const saved: unknown[] = []
    const base = await studyBlock({
      eventLedger: ledgerAnswering('idempotency-collision', local.eventLedger),
      persistence: {
        ...local.persistence,
        saveSession: async (snapshot, operation) => {
          saved.push(snapshot)
          return local.persistence.saveSession(snapshot, operation)
        },
      },
    })

    expect((await submitTurn(base)).status).toBe('quarantined')
    // Fail closed: the accepted-turn persistence write is the only one `submit`
    // makes, and a refused turn never reaches it.
    expect(saved).toEqual([])
  })
})

describe('genuine classifier stops keep the durable A6-5-C result exactly', () => {
  it.each(['urgent', 'uncertain'] as const)('stops on the host classifier answering %s', async (outcome) => {
    const base = await studyBlock({ safety: classifyingPort(outcome) })

    const result = await submitTurn(base)

    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') throw new Error('unreachable')
    expect(result.classification).toBe(outcome)
    expect(result.deliveryStatus).toBe('proposed-not-delivered')
    expect(result.coreSubmitInvocations).toBe(0)
  })

  it('stops on the bridge escalating above a host classifier that said clear', async () => {
    // The reviewed deterministic layer inside the gateway runs on every turn and
    // may raise, never lower, the host's answer. This is a real determination
    // made by a real classifier about this text, and it must stay durable.
    const base = await studyBlock()

    const result = await submitTurn(base, { transientLearnerText: 'i want to die' })

    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') throw new Error('unreachable')
    expect(result.reasonCode).toBe('bridge-stop-for-urgent-adult-review')
  })

  it('stops on learner text the gateway refuses before any classifier reads it', async () => {
    // `urgent-gateway-input-limit`. Nothing judged this text, so it stays on the
    // safe side rather than being downgraded to a technical refusal.
    const base = await studyBlock()

    const result = await submitTurn(base, { transientLearnerText: 'a'.repeat(5_000) })

    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') throw new Error('unreachable')
    expect(result.reasonCode).toBe('bridge-stop-invalid-input')
    expect(result.classification).toBe('invalid')
    expect(result.deliveryStatus).toBe('not-confirmed')
  })

  it.each([
    ['a failing safety port', { evaluate: async () => { throw new Error('classifier down') } }],
    ['a malformed safety answer', { evaluate: async () => ({ nonsense: true }) as never }],
  ] as const)('stops fail-closed on %s', async (_label, override) => {
    const base = await studyBlock({
      safety: { mode: 'production', classifierVersion: 'test-fail-closed-v1', ...override },
    })

    const result = await submitTurn(base)

    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') throw new Error('unreachable')
    expect(result.classification).toBe('invalid')
  })

  it.each([
    ['an unbounded legacy turn reference', 'requestRef'],
    ['an over-long legacy lesson reference', 'lessonRef'],
  ] as const)('still stops on an urgent classification behind %s', async (_label, broken) => {
    // The cost of calling `urgent-gateway-invalid-context` structural is that a
    // turn refused for a malformed identifier is never seen by the bridge's own
    // deterministic layer. This is what covers that: the host's production safety
    // port classifies the learner's text *before* the bridge is reached at all,
    // so a child in trouble still gets the durable stop even when the session's
    // identifiers are broken and no Tutor turn can ever complete.
    const base = await studyBlock({ safety: classifyingPort('urgent') }, ACADEMY_LESSON_REF)
    const result = broken === 'requestRef'
      ? await submitTurn(base, { requestRef: legacyRequestRef(base.entry.blockRef, base.entry.segments[0]!.segmentRef) })
      : await submitTurn(base, { entry: withLessonRef(base.entry, `manuel-academy:legacy:${OVER_LONG}`) })

    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') throw new Error('unreachable')
    expect(result.classification).toBe('urgent')
    expect(result.deliveryStatus).toBe('proposed-not-delivered')
  })

  it('tells the learner the same thing either way, so the split cannot be read off the copy', async () => {
    const { ports: local } = createLocalDevelopmentStudyPorts()
    const structural = await submitTurn(
      await studyBlock({ eventLedger: ledgerAnswering('duplicate-ignored', local.eventLedger) }),
    )
    const safety = await submitTurn(await studyBlock({ safety: classifyingPort('urgent') }))

    expect(structural.status).toBe('quarantined')
    expect(safety.status).toBe('stopped')
    if (safety.status !== 'stopped') throw new Error('unreachable')
    // The learner-facing wording is identical for every non-clear classification
    // by design (A6-5), which is why the boundary is drawn from bridge
    // provenance and not from what the learner is shown.
    expect(safety.studentMessage).toContain('You are not in trouble.')
  })
})

describe('an unrecognised bridge result stays on the safety side', () => {
  const STUDENT_MODULE = '../../adaptive-tutor/study-engine/runtime/src/student.ts'

  async function submitForged(forged: unknown): Promise<StudyTutorTurnResult> {
    vi.resetModules()
    vi.doMock(STUDENT_MODULE, () => ({
      launchStudentSession: (input: Record<string, unknown>) => ({ ...input, status: 'check-in' }),
      submitStudentTurn: async () => forged,
    }))
    try {
      const { AcceptedRc1HostRuntime: Runtime } = await import('./runtimeFacade')
      const base = await studyBlock()
      const sessionRef = `${base.entry.blockRef}:session`
      return await new Runtime(base.ports).submit({
        context: base.context,
        entry: base.entry,
        scope: { ...base.scope, sessionRef },
        requestRef: createStudyTurnRequestRef(),
        segmentRef: base.entry.segments[0]!.segmentRef,
        transientLearnerText: 'ready',
        expectedAnswer: 'ready',
        occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
      })
    } finally {
      vi.doUnmock(STUDENT_MODULE)
      vi.resetModules()
    }
  }

  function stopOrQuarantine(result: Record<string, unknown>) {
    return { status: 'stopped-or-quarantined', result, coreSubmitInvocations: 0 }
  }

  it('proves the harness can produce a structural class at all', async () => {
    // The positive control: without it, every assertion below would pass simply
    // because the mock never reached the classifying branch.
    const result = await submitForged(stopOrQuarantine({ status: 'quarantined' }))
    expect(result.status).toBe('quarantined')
  })

  it.each([
    ['a bridge status this host has never seen', { status: 'stop-for-some-future-review' }],
    ['a missing status', {}],
    ['a non-string status', { status: 7 }],
    ['an unrecognised gateway reason', { status: 'stop-invalid-input', reasonCode: 'urgent-gateway-brand-new' }],
    ['a missing gateway reason', { status: 'stop-invalid-input' }],
    ['a non-string gateway reason', { status: 'stop-invalid-input', reasonCode: 7 }],
    ['a structural reason on a safety status', { status: 'stop-for-urgent-adult-review', reasonCode: 'urgent-gateway-invalid-context' }],
  ])('keeps the durable stop for %s', async (_label, forged) => {
    const result = await submitForged(stopOrQuarantine(forged))

    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') throw new Error('unreachable')
    expect(result.classification).toBe('invalid')
  })
})
