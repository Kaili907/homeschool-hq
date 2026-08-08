import { describe, expect, it } from 'vitest'
import { syntheticGrade5StudyContext } from '../../demonstrations'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../../ports'
import { AcceptedRc1HostRuntime, type StudyTutorTurnResult } from '../../runtimeFacade'
import { studyBridgeSessionRef } from '../../studyBridgeSessionRef'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { HostStudyLaunchContext, StudyCalendarEntry, StudyLearnerScope, StudySafetyResult } from '../../types'
import { type StudyTutorRef, parseStudyTutorRef } from './refs'
import {
  STUDY_TUTOR_CONTRACT_VERSION,
  type StudyTutorLaunch,
  type StudyTutorResult,
  type StudyTutorRuntime,
  type StudyTutorTurn,
} from './runtime'
import { parseStudyTutorResult } from './results'

/**
 * STUDY-A1-TUTOR-CONTRACT Phase 8 — the contract is not fantasy.
 *
 * Everything below is test-only and stays test-only. The preview runtime is
 * `portable-non-production` and bound to the local-release-candidate identity
 * sentinel, so it can never be the production wrapper; the point here is only
 * that a thin adapter satisfies StudyTutorRuntime with the contract left
 * exactly as written, and that all four semantic branches survive the crossing.
 *
 * What the adapter demonstrates about the boundary:
 *  - the host's `HostStudyLaunchContext`, `StudyCalendarEntry` and `StudyScope`
 *    stay on the host side of it. Only instruction crosses.
 *  - the durable session reference never crosses either. The host sends the
 *    bounded correlation reference and keeps the durable one, which is what
 *    already keeps an Academy-length reference from returning as a refusal the
 *    host would record as a safety incident.
 */

/**
 * Host strings become Tutor references only by being validated, which is the
 * whole point of the type: the adapter is the place the host's own vocabulary
 * is checked against the bridge's rule, and a host reference that fails it is a
 * host bug rather than something to pass along and let a child absorb as a
 * safety stop.
 */
function hostRef(value: string): StudyTutorRef {
  const ref = parseStudyTutorRef(value)
  if (ref === null) throw new Error(`Host reference is not admissible to a Tutor: ${JSON.stringify(value)}`)
  return ref
}

/** Total over the preview union — this compiles only while it has four branches. */
function contractResult(result: StudyTutorTurnResult): StudyTutorResult {
  switch (result.status) {
    case 'accepted':
      return { status: 'accepted', eventRef: result.eventRef, visibleText: result.presentation.visibleText }
    case 'stopped':
      return { status: 'stopped', reasonCode: result.reasonCode, deliveryStatus: result.deliveryStatus }
    case 'interrupted':
      return { status: 'interrupted', interruption: result.interruption }
    case 'quarantined':
      return { status: 'quarantined', reasonCode: result.reasonCode }
    default: {
      const unreachable: never = result
      throw new Error(`Unmapped preview result: ${JSON.stringify(unreachable)}`)
    }
  }
}

interface PreviewHostBinding {
  readonly context: HostStudyLaunchContext
  readonly entry: StudyCalendarEntry
  readonly scope: StudyLearnerScope & { readonly sessionRef: string }
}

class PreviewTutorAdapter implements StudyTutorRuntime {
  readonly contractVersion = STUDY_TUTOR_CONTRACT_VERSION

  constructor(
    private readonly runtime: AcceptedRc1HostRuntime,
    private readonly host: PreviewHostBinding,
  ) {}

  async launch(launch: StudyTutorLaunch): Promise<void> {
    if (launch.sessionRef !== studyBridgeSessionRef(this.host.scope.sessionRef)) {
      throw new Error('Tutor launch does not name this host session.')
    }
    this.runtime.launch(this.host.context, this.host.entry, this.host.scope.sessionRef)
  }

  async submit(turn: StudyTutorTurn): Promise<StudyTutorResult> {
    const segment = this.host.entry.segments.find((candidate) => candidate.segmentRef === turn.segmentRef)
    const skillRef = this.host.context.skillRefs[0] ?? `${this.host.entry.lessonRef}:completion`
    if (
      turn.sessionRef !== studyBridgeSessionRef(this.host.scope.sessionRef) ||
      turn.lessonRef !== this.host.entry.lessonRef ||
      turn.subject !== this.host.context.subject ||
      turn.skillRef !== skillRef ||
      (segment !== undefined && turn.taskType !== segment.taskType)
    ) {
      return { status: 'quarantined', reasonCode: 'host-turn-mismatch' }
    }
    return contractResult(await this.runtime.submit({
      context: this.host.context,
      entry: this.host.entry,
      scope: this.host.scope,
      requestRef: turn.requestRef,
      segmentRef: turn.segmentRef,
      transientLearnerText: turn.transientLearnerText,
      expectedAnswer: turn.expectedAnswer,
      occurredAt: turn.occurredAt,
    }))
  }
}

const CLEAR: StudySafetyResult = { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
const URGENT: StudySafetyResult = { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' }
const SESSION_REJECTED: StudySafetyResult = {
  outcome: 'invalid',
  mayContinue: false,
  adultHelpState: 'not-confirmed',
  interruption: { kind: 'session-authorization', reason: 'study-session-rejected' },
}

function safetyPort(decision: StudySafetyResult): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'test-a1-tutor-contract-v1',
    evaluate: async (request) => (request.contentKind === 'learner-input' ? decision : CLEAR),
  }
}

let sequence = 0

async function adapter(decision: StudySafetyResult): Promise<{
  readonly tutor: StudyTutorRuntime
  readonly host: PreviewHostBinding
  readonly ports: StudyPortBundle
}> {
  sequence += 1
  const context = syntheticGrade5StudyContext('math')
  const { ports: localPorts } = createLocalDevelopmentStudyPorts()
  const ports: StudyPortBundle = { ...localPorts, safety: safetyPort(decision) }
  const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: `tutor-contract-${sequence}` })
  const host: PreviewHostBinding = {
    context,
    entry,
    scope: { ...scope, sessionRef: `session:tutor-contract:${sequence}` },
  }
  return { tutor: new PreviewTutorAdapter(new AcceptedRc1HostRuntime(ports), host), host, ports }
}

function turnFor(host: PreviewHostBinding, overrides: Partial<StudyTutorTurn> = {}): StudyTutorTurn {
  const segment = host.entry.segments[0]!
  return {
    sessionRef: hostRef(studyBridgeSessionRef(host.scope.sessionRef)),
    requestRef: hostRef(`study-turn:tutor-contract-${sequence}`),
    lessonRef: hostRef(host.entry.lessonRef),
    segmentRef: hostRef(segment.segmentRef),
    subject: host.context.subject,
    skillRef: hostRef(host.context.skillRefs[0]!),
    taskType: segment.taskType,
    transientLearnerText: 'ready',
    expectedAnswer: 'ready',
    occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
    learnerLocalDate: host.context.learnerLocalDate,
    householdTimeZone: host.context.householdTimeZone,
    ...overrides,
  }
}

describe('preview runtime adapted to the production Tutor contract', () => {
  it('satisfies the interface and launches from the bounded session reference alone', async () => {
    const { tutor, host } = await adapter(CLEAR)
    expect(tutor.contractVersion).toBe(STUDY_TUTOR_CONTRACT_VERSION)
    await expect(tutor.launch({
      sessionRef: hostRef(studyBridgeSessionRef(host.scope.sessionRef)),
      lessonRef: hostRef(host.entry.lessonRef),
      householdTimeZone: host.context.householdTimeZone,
      learnerLocalDate: host.context.learnerLocalDate,
    })).resolves.toBeUndefined()
  })

  it('carries an accepted turn across as an opaque reference and transient prose', async () => {
    const { tutor, host } = await adapter(CLEAR)
    await tutor.launch({
      sessionRef: hostRef(studyBridgeSessionRef(host.scope.sessionRef)),
      lessonRef: hostRef(host.entry.lessonRef),
      householdTimeZone: host.context.householdTimeZone,
      learnerLocalDate: host.context.learnerLocalDate,
    })
    const result = await tutor.submit(turnFor(host))
    expect(result.status).toBe('accepted')
    // The contract's own validator admits what the preview actually produces.
    expect(parseStudyTutorResult(result)).toEqual(result)
    if (result.status === 'accepted') {
      expect(result.visibleText.length).toBeGreaterThan(0)
      expect(Object.keys(result).sort()).toEqual(['eventRef', 'status', 'visibleText'])
    }
  })

  it('carries a safety stop across without a Tutor-authored learner message', async () => {
    const { tutor, host } = await adapter(URGENT)
    await tutor.launch({
      sessionRef: hostRef(studyBridgeSessionRef(host.scope.sessionRef)),
      lessonRef: hostRef(host.entry.lessonRef),
      householdTimeZone: host.context.householdTimeZone,
      learnerLocalDate: host.context.learnerLocalDate,
    })
    const canary = 'RAW_STUDENT_ANSWER_CANARY'
    const result = await tutor.submit(turnFor(host, { transientLearnerText: canary }))
    expect(result).toEqual({
      status: 'stopped',
      reasonCode: 'mounted-input-safety-urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    expect(parseStudyTutorResult(result)).toEqual(result)
    expect(JSON.stringify(result)).not.toContain(canary)
  })

  it('keeps a refused session an interruption rather than a stop', async () => {
    const { tutor, host } = await adapter(SESSION_REJECTED)
    await tutor.launch({
      sessionRef: hostRef(studyBridgeSessionRef(host.scope.sessionRef)),
      lessonRef: hostRef(host.entry.lessonRef),
      householdTimeZone: host.context.householdTimeZone,
      learnerLocalDate: host.context.learnerLocalDate,
    })
    const result = await tutor.submit(turnFor(host))
    expect(result).toEqual({
      status: 'interrupted',
      interruption: { kind: 'session-authorization', reason: 'study-session-rejected' },
    })
    expect(parseStudyTutorResult(result)).toEqual(result)
  })

  it('carries a structural refusal across as quarantine', async () => {
    const { tutor, host } = await adapter(CLEAR)
    await tutor.launch({
      sessionRef: hostRef(studyBridgeSessionRef(host.scope.sessionRef)),
      lessonRef: hostRef(host.entry.lessonRef),
      householdTimeZone: host.context.householdTimeZone,
      learnerLocalDate: host.context.learnerLocalDate,
    })
    const fromPreview = await tutor.submit(turnFor(host, { segmentRef: hostRef('segment:not-in-this-block') }))
    expect(fromPreview).toEqual({ status: 'quarantined', reasonCode: 'unknown-segment' })
    expect(parseStudyTutorResult(fromPreview)).toEqual(fromPreview)
    // And a turn that does not describe this host's block never reaches Tutor Core.
    const fromAdapter = await tutor.submit(turnFor(host, { lessonRef: hostRef('lesson:some-other-block') }))
    expect(fromAdapter).toEqual({ status: 'quarantined', reasonCode: 'host-turn-mismatch' })
  })

  it('sends instruction and one bounded session reference, and no host identity', async () => {
    const { host } = await adapter(CLEAR)
    const wire = JSON.stringify(turnFor(host))
    for (const identity of [
      host.context.householdRef,
      host.context.learnerRef,
      host.context.hostProfileRef,
      host.entry.blockRef,
    ]) expect(wire).not.toContain(identity)

    // An Academy-length durable reference is bounded before it crosses, and the
    // learner it names does not travel inside the bounded form.
    const durable = `block:${host.context.learnerRef}:2026-08-01:${'lesson-x'.repeat(12)}:session`
    expect(durable.length).toBeGreaterThan(128)
    const crossing = studyBridgeSessionRef(durable)
    expect(crossing.length).toBeLessThanOrEqual(128)
    expect(crossing).not.toContain(host.context.learnerRef)
  })
})
