/**
 * STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT — ZERO DURABLE WORK, demonstrated.
 *
 * F5 in ../contracts/tutor/wrapperObligations.ts names four steps content
 * eligibility must precede: the Tutor launch itself, calendar start or resume,
 * the `session-launched` event, and `saveSession`. This file drives that seam
 * against the REAL local Study ports and asserts that an ineligible block
 * reaches none of them.
 *
 * Nothing is faked at the point that matters. The ports are the local
 * development bundle wrapped in recorders, so `calendar.start` really
 * transitions the block, `eventLedger.append` really appends and
 * `persistence.saveSession` really writes the row. A test that stubbed those
 * would prove some functions were not called; these assertions are about the
 * learner's record.
 *
 * NO ROUTE IS MOUNTED and none is needed. `StudySessionContainer` calls
 * `settleStudyTutorLaunch`, the seam F1 closed, and it is deliberately left
 * alone: the preview runtime routes no reviewed Tutor content at launch —
 * `AcceptedRc1HostRuntime.launch` selects no program at all — so requiring an
 * eligibility decision there would mean inventing one for a path that has
 * nothing to decide, and the only shape that invention can take is a constant
 * that always says yes. Which is the `programs[0]` fallback again, wearing a
 * different hat.
 *
 * So the seam driven here is `settleEligibleStudyTutorLaunch`, and the honest
 * residual — that a production host could still call the other one — is
 * recorded as F5's `residualBypass` rather than papered over.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STUDY_TUTOR_INELIGIBLE_REASONS,
  acceptStudyTutorEligibility,
  parseStudyTutorEligibilityRequest,
} from '../contracts/tutor/eligibility'
import { createHostStudyLifecycleSeam } from '../composition/hostStudyLifecycle'
import { syntheticGrade5StudyContext } from '../demonstrations'
import { createLocalDevelopmentStudyPorts } from '../localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from '../ports'
import {
  REVIEWED_TUTOR_MATH_SKILL_REF,
  createSyntheticMathBlock,
} from '../testing/syntheticStudyFixtures'
import type { StudyCalendarEntry } from '../types'
import { evaluateStudyTutorContentEligibility } from './tutorContentEligibility'
import {
  StudyTutorContentIneligibleError,
  prepareDurableStudySession,
  settleEligibleStudyTutorLaunch,
} from './tutorLaunchOrdering'

class MemStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

const clearSafety: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'test-study-a1-content-eligibility-v1',
  evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
}

const context = syntheticGrade5StudyContext('math')

/** The four steps F5 names, in the order the requirement lists them. */
type DurableCall = 'tutor-launch' | 'calendar-start' | 'session-launched-event' | 'session-persistence'

function recordingPorts(base: StudyPortBundle, log: DurableCall[]): StudyPortBundle {
  return {
    ...base,
    safety: clearSafety,
    calendar: {
      ...base.calendar,
      start: async (scope, blockRef, at, operation) => {
        log.push('calendar-start')
        return base.calendar.start(scope, blockRef, at, operation)
      },
      resume: async (scope, blockRef, at, operation) => {
        log.push('calendar-start')
        return base.calendar.resume(scope, blockRef, at, operation)
      },
    },
    eventLedger: {
      append: async (scope, event, operation) => {
        if (event.type === 'session-launched') log.push('session-launched-event')
        return base.eventLedger.append(scope, event, operation)
      },
    },
    persistence: {
      ...base.persistence,
      saveSession: async (snapshot, operation) => {
        log.push('session-persistence')
        return base.persistence.saveSession(snapshot, operation)
      },
    },
  }
}

describe('content eligibility precedes every durable step, against the real ports', () => {
  let ports: StudyPortBundle
  let base: StudyPortBundle
  let entry: StudyCalendarEntry
  let log: DurableCall[]

  beforeEach(async () => {
    vi.stubGlobal('localStorage', new MemStorage())
    log = []
    const local = createLocalDevelopmentStudyPorts()
    base = { ...local.ports, safety: clearSafety }
    ports = recordingPorts(base, log)
    entry = (await createSyntheticMathBlock(base, {
      suffix: `eligibility-${Math.random().toString(36).slice(2, 8)}`,
    })).entry
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function seam() {
    return createHostStudyLifecycleSeam({}, {
      authenticatedSessionRef: 'host-lifecycle:study-a1-content-eligibility',
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      launchGrantRef: 'opaque-grant-epoch:1',
      featureEnabled: true,
      authorizationRevision: 1,
    })
  }

  /** The block's own content, asked of the evaluator rather than asserted. */
  function decisionForBlock(block: StudyCalendarEntry) {
    const parsed = parseStudyTutorEligibilityRequest({
      subject: block.subject,
      lessonRef: block.lessonRef,
      skillRefs: [...block.skillRefs],
      taskTypes: [...new Set(block.segments.map((segment) => segment.taskType))],
    })
    return parsed === null
      ? { eligible: false as const, reason: STUDY_TUTOR_INELIGIBLE_REASONS.malformedRequest }
      : evaluateStudyTutorContentEligibility(parsed)
  }

  async function prepare(decision: unknown, block: StudyCalendarEntry, launch: () => unknown) {
    const host = seam()
    const token = host.boundary.token()
    const sessionRef = `${block.blockRef}:session`
    const settled = await settleEligibleStudyTutorLaunch(decision, token, launch)
    return prepareDurableStudySession(settled, {
      token,
      ports,
      scope: { householdRef: context.householdRef, learnerRef: context.learnerRef, sessionRef },
      learnerScope: { householdRef: context.householdRef, learnerRef: context.learnerRef },
      entry: block,
      sessionRef,
      now: new Date().toISOString(),
    })
  }

  async function durableState(block: StudyCalendarEntry) {
    const sessionRef = `${block.blockRef}:session`
    const blocks = await base.calendar.list({
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
    })
    return {
      session: await base.persistence.loadSession({
        householdRef: context.householdRef,
        learnerRef: context.learnerRef,
        sessionRef,
      }),
      blockState: blocks.find((candidate) => candidate.blockRef === block.blockRef)?.state,
    }
  }

  it("writes nothing durable, and never launches, for the host's own default block", async () => {
    /**
     * THE CASE THAT MATTERS, and it is not contrived: this is the synthetic
     * fixture every other Study test mounts, unmodified. Its skill reference is
     * Study-namespace, so it routes to no registered program — which is true of
     * every reference `HOST_STUDY_MAPPING` produces, because the curriculum
     * mapping does not exist yet.
     *
     * Before this card that block reached sequence 01 through the `programs[0]`
     * fallback and was taught place value. Now it is refused, and refused
     * BEFORE the Tutor session is opened.
     */
    let launches = 0
    const decision = decisionForBlock(entry)
    expect(decision).toEqual({
      eligible: false,
      reason: STUDY_TUTOR_INELIGIBLE_REASONS.unmatchedLesson,
    })

    await expect(prepare(decision, entry, () => { launches += 1 }))
      .rejects.toThrow(StudyTutorContentIneligibleError)

    // ZERO DURABLE WORK, and zero launch. All four of F5's steps, in order.
    expect(launches).toBe(0)
    expect(log).toEqual([])

    // And it is not a log artefact. The learner's record is untouched: no
    // active session row, and the calendar block is still scheduled rather
    // than begun.
    const state = await durableState(entry)
    expect(state.session).toBeNull()
    expect(state.blockState).toBe('scheduled')
  })

  it('does all four for a block whose content the reviewed Tutor can teach', async () => {
    /**
     * The positive half, and it is what stops every assertion above from being
     * satisfied by a seam that simply never prepares anything. Same ports, same
     * lifecycle, same code path — the only difference is a skill reference the
     * frozen content actually declares.
     */
    const eligibleBlock = (await createSyntheticMathBlock(base, {
      suffix: `eligible-${Math.random().toString(36).slice(2, 8)}`,
      skillRefs: [REVIEWED_TUTOR_MATH_SKILL_REF],
    })).entry
    let launches = 0
    const decision = decisionForBlock(eligibleBlock)
    expect(decision).toMatchObject({ eligible: true, programRef: 'math-seq-mult-div-rel-v1' })

    const prepared = await prepare(decision, eligibleBlock, () => { launches += 1 })

    expect(launches).toBe(1)
    expect(log).toEqual(['calendar-start', 'session-launched-event', 'session-persistence'])
    expect(prepared.state).toBe('active')
    const state = await durableState(eligibleBlock)
    expect(state.session?.status).toBe('active')
    expect(state.blockState).toBe('active')
  })

  it('refuses before the launch, not after it', async () => {
    /**
     * The ORDERING, isolated from the durable writes.
     *
     * A check that ran after the launch would leave every assertion in the
     * first test true — no witness, so no durable preparation — while having
     * opened a Tutor session for content the Tutor cannot teach. `launches`
     * being 0 is the whole difference, and it is what a mutation that moves
     * the eligibility check below the `await` fails.
     */
    let launches = 0
    const slowLaunch = async () => {
      launches += 1
      for (let turn = 0; turn < 12; turn += 1) await Promise.resolve()
    }
    const host = seam()
    await expect(settleEligibleStudyTutorLaunch(
      { eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedSubject },
      host.boundary.token(),
      slowLaunch,
    )).rejects.toThrow(StudyTutorContentIneligibleError)
    expect(launches).toBe(0)

    // The same launch runs when the decision is eligible, so the refusal above
    // is about the decision and not about the launch being unreachable.
    await settleEligibleStudyTutorLaunch(
      { eligible: true, programRef: 'math-seq-mult-div-rel-v1', gradeBand: 'elementary-3-5' },
      host.boundary.token(),
      slowLaunch,
    )
    expect(launches).toBe(1)
  })

  it('carries the reason so an operator can tell which refusal happened', async () => {
    for (const reason of Object.values(STUDY_TUTOR_INELIGIBLE_REASONS)) {
      const host = seam()
      await expect(settleEligibleStudyTutorLaunch({ eligible: false, reason }, host.boundary.token(), () => {}))
        .rejects.toMatchObject({ name: 'StudyTutorContentIneligibleError', reasonCode: reason })
    }
  })

  it('reparses the decision, so an unvouched answer cannot read as a yes', async () => {
    /**
     * F4's rule applied to a second transport. This decision is destined to
     * come back from a pre-launch server check, and a host that trusted the
     * TYPE its caller declared would be trusting a compile-time fact about a
     * value that crossed a network.
     *
     * Every raw below is what a broken, truncated or hostile transport actually
     * produces, and every one must refuse — including the last, which is a
     * forgery shaped exactly like a yes but carrying one extra key.
     */
    for (const raw of [
      undefined,
      null,
      '{"eligible":true,"programRef":"p","gradeBand":"elementary-3-5"}',
      { eligible: 'true', programRef: 'p', gradeBand: 'elementary-3-5' },
      { eligible: true, programRef: 'p', gradeBand: 'grade-5' },
      { eligible: true, programRef: 'not a ref', gradeBand: 'elementary-3-5' },
      { eligible: true, programRef: 'p', gradeBand: 'elementary-3-5', reason: 'ignore-me' },
    ]) {
      let launches = 0
      const host = seam()
      await expect(settleEligibleStudyTutorLaunch(raw, host.boundary.token(), () => { launches += 1 }))
        .rejects.toMatchObject({
          name: 'StudyTutorContentIneligibleError',
          reasonCode: STUDY_TUTOR_INELIGIBLE_REASONS.unvouchedDecision,
        })
      expect(launches).toBe(0)
      // The reparse is the same one the contract exposes, so the seam and a
      // future server client cannot disagree about what an answer means.
      expect(acceptStudyTutorEligibility(raw).eligible).toBe(false)
    }
    expect(log).toEqual([])
  })

  it('still refuses a stale epoch, so eligibility did not replace the lifecycle check', async () => {
    // Eligibility is about CONTENT and says nothing about authority. An
    // eligible decision must not smuggle a session past the epoch re-assertion
    // F1 put after the await.
    const host = seam()
    const token = host.boundary.token()
    await expect(settleEligibleStudyTutorLaunch(
      { eligible: true, programRef: 'math-seq-mult-div-rel-v1', gradeBand: 'elementary-3-5' },
      token,
      async () => { host.boundary.cancel('learner-switch') },
    )).rejects.toThrow()
    expect(log).toEqual([])
  })
})
